import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Terapkan 1 event postgres_changes ke array baris (immutable).
 */
function applyChange(rows, payload) {
  const { eventType, new: newRow, old: oldRow } = payload;
  if (eventType === 'INSERT') {
    if (rows.some((r) => r.id === newRow.id)) return rows.map((r) => (r.id === newRow.id ? newRow : r));
    return [...rows, newRow];
  }
  if (eventType === 'UPDATE') {
    if (!rows.some((r) => r.id === newRow.id)) return [...rows, newRow];
    return rows.map((r) => (r.id === newRow.id ? newRow : r));
  }
  if (eventType === 'DELETE') {
    const id = oldRow?.id;
    return id ? rows.filter((r) => r.id !== id) : rows;
  }
  return rows;
}

/**
 * Hook pusat sinkronisasi realtime.
 * - Memuat stage_state, groups, investments + berlangganan WebSocket.
 * - Refetch otomatis setiap (re)connect & saat tab kembali aktif (anti data basi).
 * - Event yang datang SAAT fetch berjalan di-buffer lalu diterapkan ulang (anti hilang data).
 * - Koreksi selisih jam laptop via RPC server_now().
 * - Countdown lokal 250ms tanpa menulis ke database.
 */
export function useSharkTankSync({ onInvestmentInsert, onTimerEnd } = {}) {
  const [stage, setStage] = useState(null);
  const [groups, setGroups] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connection, setConnection] = useState('connecting'); // connecting | live | offline
  const [secondsLeft, setSecondsLeft] = useState(null);

  const offsetRef = useRef(0); // serverTime - localTime (ms)
  const [offsetVersion, setOffsetVersion] = useState(0);
  const insertCbRef = useRef(onInvestmentInsert);
  const timerEndCbRef = useRef(onTimerEnd);
  const bufferRef = useRef(null);
  const fetchSeqRef = useRef(0);
  const bellRef = useRef({ key: null, sawPositive: false, rung: false });

  useEffect(() => {
    insertCbRef.current = onInvestmentInsert;
    timerEndCbRef.current = onTimerEnd;
  });

  /** Waktu "sekarang" versi server (ms). */
  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const syncClock = useCallback(async () => {
    if (!supabase) return;
    try {
      const t0 = Date.now();
      const { data, error: err } = await supabase.rpc('server_now');
      const t1 = Date.now();
      if (!err && data) {
        const serverMs = new Date(data).getTime();
        if (!Number.isNaN(serverMs)) {
          offsetRef.current = serverMs - (t0 + t1) / 2;
          setOffsetVersion((v) => v + 1);
        }
      }
    } catch {
      /* tetap pakai jam lokal */
    }
  }, []);

  const fetchAll = useCallback(async () => {
    if (!supabase) return;
    const seq = ++fetchSeqRef.current;
    bufferRef.current = [];
    try {
      const [s, g, i] = await Promise.all([
        supabase.from('stage_state').select('*').eq('id', 1).maybeSingle(),
        supabase.from('groups').select('*').order('created_at', { ascending: true }),
        supabase.from('investments').select('*').order('created_at', { ascending: true }),
      ]);
      if (seq !== fetchSeqRef.current) return; // ada fetch lebih baru
      const firstErr = s.error || g.error || i.error;
      if (firstErr) throw firstErr;
      if (!s.data) throw new Error('Baris stage_state (id = 1) belum ada. Jalankan ulang schema.sql.');

      let st = s.data;
      let gr = g.data || [];
      let inv = i.data || [];
      for (const ev of bufferRef.current || []) {
        if (ev.table === 'stage_state' && ev.payload.new?.id === 1) st = ev.payload.new;
        if (ev.table === 'groups') gr = applyChange(gr, ev.payload);
        if (ev.table === 'investments') inv = applyChange(inv, ev.payload);
      }
      bufferRef.current = null;
      setStage(st);
      setGroups(gr);
      setInvestments(inv);
      setError(null);
    } catch (err) {
      if (seq === fetchSeqRef.current) {
        bufferRef.current = null;
        setError(err?.message || String(err));
      }
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, []);

  // ---- Realtime subscription ----
  useEffect(() => {
    if (!supabase) return undefined;

    const handle = (table) => (payload) => {
      if (bufferRef.current) bufferRef.current.push({ table, payload });
      if (table === 'stage_state') {
        if (payload.new?.id === 1) setStage(payload.new);
      } else if (table === 'groups') {
        setGroups((prev) => applyChange(prev, payload));
      } else if (table === 'investments') {
        setInvestments((prev) => applyChange(prev, payload));
        if (payload.eventType === 'INSERT') insertCbRef.current?.(payload.new);
      }
    };

    const channel = supabase
      .channel(`shark-tank-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stage_state' }, handle('stage_state'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, handle('groups'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments' }, handle('investments'))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live');
          fetchAll(); // isi ulang data yang mungkin terlewat saat putus
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('offline');
        }
      });

    fetchAll();
    syncClock();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchAll();
        syncClock();
      }
    };
    const onOnline = () => {
      fetchAll();
      syncClock();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const clockTimer = setInterval(syncClock, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      clearInterval(clockTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchAll, syncClock]);

  // ---- Countdown lokal (250ms) — TIDAK pernah menulis ke DB ----
  const timerEndAt = stage?.timer_end_at ?? null;
  const pausedLeft = stage?.paused_seconds_left ?? null;

  useEffect(() => {
    const compute = () => {
      if (pausedLeft != null) return pausedLeft;
      if (!timerEndAt) return null;
      return Math.max(0, Math.ceil((new Date(timerEndAt).getTime() - (Date.now() + offsetRef.current)) / 1000));
    };
    const tick = () => setSecondsLeft(compute()); // React tidak re-render jika nilainya sama
    tick();
    if (pausedLeft != null || !timerEndAt) return undefined;
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timerEndAt, pausedLeft, offsetVersion]);

  // ---- Bel tepat 1x saat menyentuh 00:00 ----
  useEffect(() => {
    if (!timerEndAt) return; // pause / idle
    if (bellRef.current.key !== timerEndAt) {
      bellRef.current = { key: timerEndAt, sawPositive: false, rung: false };
    }
    if (secondsLeft > 0) {
      bellRef.current.sawPositive = true;
    } else if (secondsLeft === 0 && bellRef.current.sawPositive && !bellRef.current.rung) {
      bellRef.current.rung = true; // tidak berbunyi saat halaman di-refresh setelah waktu habis
      timerEndCbRef.current?.();
    }
  }, [secondsLeft, timerEndAt]);

  // ---- Kalkulasi keuangan real-time (tidak disimpan di DB) ----
  const statsById = useMemo(() => {
    const map = new Map();
    for (const g of groups) map.set(g.id, { spent: 0, totalRaised: 0, investorCount: 0 });
    for (const inv of investments) {
      const amount = Number(inv.amount) || 0;
      const investor = map.get(inv.investor_group_id);
      if (investor) investor.spent += amount;
      const target = map.get(inv.target_group_id);
      if (target) {
        target.totalRaised += amount;
        if (amount > 0) target.investorCount += 1;
      }
    }
    for (const g of groups) {
      const s = map.get(g.id);
      s.remainingBudget = Number(g.initial_budget) - s.spent;
    }
    return map;
  }, [groups, investments]);

  const getStats = useCallback(
    (groupId) => statsById.get(groupId) || { spent: 0, totalRaised: 0, investorCount: 0, remainingBudget: 0 },
    [statsById],
  );

  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const activeClass = stage?.active_class ?? '';
  const classGroups = useMemo(
    () => groups.filter((g) => g.class_name === activeClass),
    [groups, activeClass],
  );
  const classInvestments = useMemo(
    () =>
      investments
        .filter((i) => i.class_name === activeClass)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [investments, activeClass],
  );
  const activeGroup = stage?.active_group_id ? groupsById.get(stage.active_group_id) || null : null;

  return {
    stage,
    groups,
    investments,
    loading,
    error,
    connection,
    secondsLeft,
    isPaused: pausedLeft != null,
    serverNow,
    refetch: fetchAll,
    getStats,
    groupsById,
    classGroups,
    classInvestments,
    activeGroup,
  };
}
