import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, LogOut, Play, Pause, Square, HelpCircle, Coins, Snowflake, Plus, Trash2, Download,
  Users, ScrollText, Trophy, Loader2, Minus, MonitorPlay, School,
} from 'lucide-react';
import { ADMIN_PASSWORD, supabase } from '../lib/supabase';
import { useSharkTankSync } from '../hooks/useSharkTankSync';
import { playBellSound, playCoinSound } from '../utils/soundEffects';
import {
  PHASES, TARGET_SPEND, compareName, formatRupiah, formatRupiahShort, formatTime, safeStorage,
} from '../utils/format';
import {
  Card, ConnectionDot, FullScreenMessage, Leaderboard, PhaseBadge, SectionTitle, SoundToggle, TimerDisplay,
} from '../components/shared';

const session = safeStorage('session');
const ADMIN_KEY = 'sharktank_admin_ok';
const DEFAULT_CLASSES = ['9A', '9B', '9C', '9D'];

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => session.getItem(ADMIN_KEY) === '1');
  if (!authed) {
    return (
      <AdminLogin
        onSuccess={() => {
          session.setItem(ADMIN_KEY, '1');
          setAuthed(true);
        }}
      />
    );
  }
  return (
    <AdminDashboard
      onLogout={() => {
        session.removeItem(ADMIN_KEY);
        setAuthed(false);
      }}
    />
  );
}

function AdminLogin({ onSuccess }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) onSuccess();
    else {
      setErr('Password salah.');
      setPw('');
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-slate-900 p-6 ring-1 ring-slate-700">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-amber-400" />
          <h1 className="mt-2 text-2xl font-black">Panel Kontrol Guru</h1>
          <p className="text-sm text-slate-400">IoT Shark Tank: Battle of Innovators</p>
        </div>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => { setPw(e.target.value); setErr(''); }}
          placeholder="Password guru"
          className="w-full rounded-xl bg-slate-800 px-3 py-3 text-white ring-1 ring-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        {err && <p className="text-sm font-semibold text-red-400">{err}</p>}
        <button type="submit" className="w-full rounded-xl bg-amber-400 py-3 font-black text-slate-900 hover:bg-amber-300">Masuk</button>
        <a href="/" className="block text-center text-xs text-slate-500 hover:text-slate-300">← ke halaman siswa</a>
      </form>
    </div>
  );
}

function AdminDashboard({ onLogout }) {
  const sync = useSharkTankSync({
    onInvestmentInsert: (inv) => { if (Number(inv.amount) > 0) playCoinSound(); },
    onTimerEnd: () => playBellSound(),
  });
  const { stage, loading, error, connection } = sync;
  const [toast, setToast] = useState(null);

  const notify = (msg, tone = 'error') => {
    const id = Date.now() + Math.random();
    setToast({ msg, tone, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4000);
  };

  if (loading && !stage) {
    return <FullScreenMessage title="Memuat panel guru…"><Loader2 className="h-5 w-5 animate-spin" /></FullScreenMessage>;
  }
  if (error && !stage) {
    return (
      <FullScreenMessage title="⚠️ Gagal memuat data" tone="red">
        <p className="font-mono text-red-300">{error}</p>
        <p>Pastikan <code>supabase/schema.sql</code> sudah dijalankan.</p>
        <button type="button" onClick={sync.refetch} className="mt-2 rounded-lg bg-white px-4 py-2 font-bold text-slate-900">Coba Lagi</button>
      </FullScreenMessage>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <span className="font-black">Panel Guru — IoT Shark Tank</span>
            <ConnectionDot connection={connection} />
          </div>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold ring-1 ring-slate-600 hover:bg-slate-700">
              <MonitorPlay className="h-4 w-4" /> Layar Siswa
            </a>
            <button type="button" onClick={onLogout} className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold ring-1 ring-slate-600 hover:bg-slate-700">
              <LogOut className="h-4 w-4" /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 p-4">
        <StagePanel sync={sync} notify={notify} />
        <div className="grid gap-5 xl:grid-cols-2">
          <GroupsPanel sync={sync} notify={notify} />
          <ResultsPanel sync={sync} notify={notify} />
        </div>
      </main>

      {toast && (
        <div
          key={toast.id}
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-bold shadow-2xl ring-1 ${
            toast.tone === 'error' ? 'bg-red-600 text-white ring-red-300' : 'bg-emerald-600 text-white ring-emerald-300'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   PANEL 1 — STAGE & TIMER CONTROLLER
   ===================================================================== */
function StagePanel({ sync, notify }) {
  const { stage, classGroups, groups, activeGroup, secondsLeft, isPaused, serverNow } = sync;
  const [busy, setBusy] = useState(false);
  const [classInput, setClassInput] = useState(stage.active_class);

  useEffect(() => {
    setClassInput(stage.active_class);
  }, [stage.active_class]);

  const classOptions = useMemo(() => {
    const set = new Set(DEFAULT_CLASSES);
    groups.forEach((g) => set.add(g.class_name));
    return [...set].sort((a, b) => compareName(a, b));
  }, [groups]);

  const sortedClassGroups = useMemo(
    () => [...classGroups].sort((a, b) => compareName(a.group_name, b.group_name)),
    [classGroups],
  );

  const updateStage = async (patch) => {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.from('stage_state').update(patch).eq('id', 1);
    setBusy(false);
    if (error) notify(`Gagal memperbarui panggung: ${error.message}`);
  };

  const RESET_TIMER = { timer_end_at: null, paused_seconds_left: null };

  const changeClass = (cls) => {
    const value = cls.trim().toUpperCase();
    if (!value || value === stage.active_class) return;
    if (stage.phase !== 'IDLE' && !window.confirm(`Sesi sedang berjalan (${stage.phase}). Pindah ke kelas ${value} dan reset panggung?`)) {
      setClassInput(stage.active_class);
      return;
    }
    setClassInput(value);
    updateStage({ active_class: value, active_group_id: null, phase: 'IDLE', ...RESET_TIMER });
  };

  const changePresenter = (groupId) =>
    updateStage({ active_group_id: groupId || null, phase: 'IDLE', ...RESET_TIMER });

  const startPhase = (phase) => {
    if (!stage.active_group_id) return notify('Pilih presenter aktif terlebih dahulu.');
    const duration = PHASES[phase].duration;
    updateStage({
      phase,
      timer_end_at: new Date(serverNow() + duration * 1000).toISOString(),
      paused_seconds_left: null,
    });
  };

  const pause = () => {
    if (!stage.timer_end_at) return;
    const left = Math.max(0, Math.ceil((new Date(stage.timer_end_at).getTime() - serverNow()) / 1000));
    updateStage({ paused_seconds_left: left, timer_end_at: null });
  };

  const resume = () => {
    if (stage.paused_seconds_left == null) return;
    updateStage({
      timer_end_at: new Date(serverNow() + stage.paused_seconds_left * 1000).toISOString(),
      paused_seconds_left: null,
    });
  };

  const resetIdle = () => updateStage({ phase: 'IDLE', ...RESET_TIMER });
  const toggleFreeze = () => updateStage({ is_leaderboard_frozen: !stage.is_leaderboard_frozen });

  const running = stage.phase !== 'IDLE';
  const noPresenter = !stage.active_group_id;
  const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-black ring-2 transition disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <Card className="ring-amber-500/30">
      <SectionTitle icon={School} right={busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}>
        Panel 1 — Stage &amp; Timer Controller
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-400">Kelas Aktif</span>
            <div className="flex gap-2">
              <input
                list="class-options"
                value={classInput}
                onChange={(e) => setClassInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && changeClass(classInput)}
                className="w-28 rounded-xl bg-slate-800 px-3 py-2.5 text-lg font-black text-white ring-1 ring-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <datalist id="class-options">
                {classOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
              <button type="button" disabled={busy} onClick={() => changeClass(classInput)} className="rounded-xl bg-indigo-600 px-4 font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                Terapkan
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {classOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => changeClass(c)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-black ring-1 ${
                    c === stage.active_class ? 'bg-amber-400 text-slate-900 ring-amber-300' : 'bg-slate-800 text-slate-300 ring-slate-600 hover:bg-slate-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-400">Presenter Aktif</span>
            <select
              value={stage.active_group_id || ''}
              onChange={(e) => changePresenter(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl bg-slate-800 px-3 py-2.5 font-bold text-white ring-1 ring-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">— Belum ada presenter —</option>
              {sortedClassGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.group_name} — {g.project_title}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">Mengganti presenter otomatis mengembalikan fase ke IDLE.</span>
          </label>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-bold uppercase text-slate-400">Kontrol Fase</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
            <button type="button" disabled={busy || noPresenter} onClick={() => startPhase('PITCH')} className={`${btn} bg-emerald-600 text-white ring-emerald-400 hover:bg-emerald-500`}>
              <Play className="h-5 w-5" /> Mulai Pitch (10:00)
            </button>
            <button type="button" disabled={busy || noPresenter} onClick={() => startPhase('QA')} className={`${btn} bg-orange-600 text-white ring-orange-400 hover:bg-orange-500`}>
              <HelpCircle className="h-5 w-5" /> Mulai Q&amp;A (05:00)
            </button>
            <button type="button" disabled={busy || noPresenter} onClick={() => startPhase('INVEST')} className={`${btn} bg-blue-700 text-white ring-amber-400 hover:bg-blue-600`}>
              <Coins className="h-5 w-5" /> Buka Investasi (01:00)
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {isPaused ? (
              <button type="button" disabled={busy || !running} onClick={resume} className={`${btn} bg-yellow-400 text-slate-900 ring-yellow-200`}>
                <Play className="h-5 w-5" /> Resume
              </button>
            ) : (
              <button type="button" disabled={busy || !running || !stage.timer_end_at} onClick={pause} className={`${btn} bg-slate-700 text-white ring-slate-500 hover:bg-slate-600`}>
                <Pause className="h-5 w-5" /> Pause
              </button>
            )}
            <button type="button" disabled={busy || !running} onClick={resetIdle} className={`${btn} bg-red-700 text-white ring-red-400 hover:bg-red-600`}>
              <Square className="h-5 w-5" /> Reset ke Idle
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={toggleFreeze}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 font-black ring-2 transition ${
              stage.is_leaderboard_frozen ? 'bg-cyan-500/20 text-cyan-200 ring-cyan-400' : 'bg-slate-800 text-slate-300 ring-slate-600'
            }`}
          >
            <span className="flex items-center gap-2"><Snowflake className="h-5 w-5" /> ❄️ Freeze Leaderboard</span>
            <span className={`relative h-7 w-12 rounded-full transition ${stage.is_leaderboard_frozen ? 'bg-cyan-400' : 'bg-slate-600'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${stage.is_leaderboard_frozen ? 'left-6' : 'left-1'}`} />
            </span>
          </button>
        </div>

        <div className="flex min-w-[260px] flex-col items-center justify-center gap-2 rounded-2xl bg-black/50 p-4 ring-1 ring-slate-700">
          <PhaseBadge phase={stage.phase} />
          <TimerDisplay phase={stage.phase} secondsLeft={secondsLeft} isPaused={isPaused} className="w-[5ch] text-6xl" />
          {isPaused && running && <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-black text-slate-900">⏸ JEDA</span>}
          <p className="max-w-[240px] truncate text-center text-sm text-slate-300">
            {activeGroup ? <><b>{activeGroup.group_name}</b> — {activeGroup.project_title}</> : 'Belum ada presenter'}
          </p>
        </div>
      </div>
    </Card>
  );
}

/* =====================================================================
   PANEL 2 — QUESTION TRACKER & MANAJEMEN KELOMPOK
   ===================================================================== */
function GroupsPanel({ sync, notify }) {
  const { stage, classGroups, investments } = sync;
  const [form, setForm] = useState({ group_name: '', project_title: '', pin: '' });
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState({});

  const sorted = useMemo(() => [...classGroups].sort((a, b) => compareName(a.group_name, b.group_name)), [classGroups]);
  const activeId = stage.active_group_id;

  const investedSet = useMemo(() => {
    const s = new Set();
    if (activeId) investments.forEach((i) => { if (i.target_group_id === activeId) s.add(i.investor_group_id); });
    return s;
  }, [investments, activeId]);

  const eligible = sorted.filter((g) => g.id !== activeId);
  const investedCount = eligible.filter((g) => investedSet.has(g.id)).length;

  const adjust = async (g, delta) => {
    if (pending[g.id]) return;
    setPending((p) => ({ ...p, [g.id]: true }));
    const { error } = await supabase.rpc('adjust_questions', { p_group_id: g.id, p_delta: delta });
    setPending((p) => ({ ...p, [g.id]: false }));
    if (error) notify(`Gagal mengubah pertanyaan: ${error.message}`);
  };

  const addGroup = async (e) => {
    e.preventDefault();
    const name = form.group_name.trim();
    const title = form.project_title.trim();
    const pin = form.pin.trim();
    if (!name || !title) return notify('Nama kelompok & judul proyek wajib diisi.');
    if (!/^\d{4}$/.test(pin)) return notify('PIN harus 4 digit angka.');
    setSaving(true);
    const { error } = await supabase.from('groups').insert({ class_name: stage.active_class, group_name: name, project_title: title, pin });
    setSaving(false);
    if (error) {
      notify(error.code === '23505' ? `"${name}" sudah ada di kelas ${stage.active_class}.` : `Gagal menambah: ${error.message}`);
      return;
    }
    setForm({ group_name: '', project_title: '', pin: '' });
    notify(`${name} ditambahkan ke kelas ${stage.active_class}.`, 'ok');
  };

  const deleteGroup = async (g) => {
    if (!window.confirm(`Hapus ${g.group_name} (${g.project_title})?\n\nSELURUH transaksi investasi yang terkait kelompok ini juga akan terhapus permanen.`)) return;
    const { error } = await supabase.from('groups').delete().eq('id', g.id);
    if (error) notify(`Gagal menghapus: ${error.message}`);
    else notify(`${g.group_name} dihapus.`, 'ok');
  };

  return (
    <Card>
      <SectionTitle
        icon={Users}
        right={
          activeId && stage.phase === 'INVEST' ? (
            <span className="num rounded-full bg-blue-600/30 px-3 py-1 text-xs font-black text-blue-100">
              Sudah invest: {investedCount}/{eligible.length}
            </span>
          ) : null
        }
      >
        Panel 2 — Shark Attack Tracker &amp; Kelompok ({stage.active_class})
      </SectionTitle>

      <div className="space-y-2">
        {sorted.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Belum ada kelompok. Tambahkan di bawah.</p>}
        {sorted.map((g) => {
          const zero = g.questions_asked === 0;
          const isActive = g.id === activeId;
          return (
            <div
              key={g.id}
              className={`grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl p-3 ring-1 sm:grid-cols-[1fr_auto_auto] ${
                zero ? 'bg-red-500/10 ring-red-500/50' : 'bg-slate-800/70 ring-slate-700'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-black text-white">
                  {g.group_name}
                  <span className="num ml-2 rounded bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-amber-300" title="PIN login">PIN {g.pin}</span>
                </p>
                <p className="truncate text-xs text-slate-400">{g.project_title}</p>
                <p className="mt-1 text-xs font-bold">
                  {!activeId ? (
                    <span className="text-slate-500">Ronde: —</span>
                  ) : isActive ? (
                    <span className="text-red-300">🎤 Presenter</span>
                  ) : investedSet.has(g.id) ? (
                    <span className="text-emerald-400">Sudah Invest ✅</span>
                  ) : (
                    <span className="text-yellow-300">Belum ⏳</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button type="button" disabled={pending[g.id] || g.questions_asked === 0} onClick={() => adjust(g, -1)} className="rounded-lg bg-slate-700 p-2 hover:bg-slate-600 disabled:opacity-30" title="-1">
                  <Minus className="h-4 w-4" />
                </button>
                <span className={`num w-10 text-center text-2xl font-black ${zero ? 'text-red-400' : 'text-emerald-300'}`}>{g.questions_asked}</span>
                <button type="button" disabled={pending[g.id]} onClick={() => adjust(g, 1)} className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-2 text-sm font-black text-white hover:bg-orange-500 disabled:opacity-50">
                  <Plus className="h-4 w-4" /> 1 Tanya
                </button>
              </div>

              <button type="button" onClick={() => deleteGroup(g)} className="col-span-2 justify-self-end rounded-lg p-2 text-slate-500 hover:bg-red-600/20 hover:text-red-300 sm:col-span-1" title="Hapus kelompok">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <form onSubmit={addGroup} className="mt-4 grid gap-2 rounded-xl bg-slate-950/60 p-3 ring-1 ring-slate-700 sm:grid-cols-[1fr_1.5fr_90px]">
        <input
          value={form.group_name}
          onChange={(e) => setForm({ ...form, group_name: e.target.value })}
          placeholder="Kelompok 1"
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white ring-1 ring-slate-600 focus:outline-none focus:ring-amber-400"
        />
        <input
          value={form.project_title}
          onChange={(e) => setForm({ ...form, project_title: e.target.value })}
          placeholder="Smart Trash Bin IoT"
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white ring-1 ring-slate-600 focus:outline-none focus:ring-amber-400"
        />
        <input
          value={form.pin}
          inputMode="numeric"
          maxLength={4}
          onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          placeholder="PIN"
          className="num rounded-lg bg-slate-800 px-3 py-2 text-center font-mono text-sm text-white ring-1 ring-slate-600 focus:outline-none focus:ring-amber-400"
        />
        <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black sm:col-span-3 text-white hover:bg-emerald-500 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah ke {stage.active_class}
        </button>
      </form>
    </Card>
  );
}

/* =====================================================================
   PANEL 3 — LEADERBOARD ASLI, AUDIT LOG & EXPORT CSV
   ===================================================================== */
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ResultsPanel({ sync, notify }) {
  const { stage, classGroups, classInvestments, getStats, groupsById } = sync;

  const deleteInvestment = async (inv) => {
    const from = groupsById.get(inv.investor_group_id)?.group_name || '?';
    const to = groupsById.get(inv.target_group_id)?.group_name || '?';
    if (!window.confirm(`Hapus transaksi ${from} ➔ ${to} (${formatRupiah(inv.amount)})?\nKelompok ${from} akan bisa mengirim ulang jika fase INVEST untuk ${to} masih terbuka.`)) return;
    const { error } = await supabase.from('investments').delete().eq('id', inv.id);
    if (error) notify(`Gagal menghapus transaksi: ${error.message}`);
    else notify('Transaksi dihapus.', 'ok');
  };

  const exportCsv = () => {
    const header = ['Kelas', 'Nama_Kelompok', 'Judul_Proyek', 'Total_Dana_Masuk', 'Jumlah_Investor', 'Modal_Terpakai', 'Sisa_Modal', 'Syarat_80Jt_Terpenuhi', 'Total_Bertanya'];
    const rows = [...classGroups]
      .sort((a, b) => compareName(a.group_name, b.group_name))
      .map((g) => {
        const s = getStats(g.id);
        return [g.class_name, g.group_name, g.project_title, s.totalRaised, s.investorCount, s.spent, s.remainingBudget, s.spent >= TARGET_SPEND ? 'Ya' : 'Tidak', g.questions_asked];
      });
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `rekap-shark-tank-${stage.active_class}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle
          icon={Trophy}
          right={
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-black text-white hover:bg-emerald-500">
              <Download className="h-4 w-4" /> 📥 Export Rekap Nilai (CSV)
            </button>
          }
        >
          Panel 3 — Klasemen Asli
        </SectionTitle>
        {stage.is_leaderboard_frozen && (
          <p className="mb-2 rounded-lg bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-200">❄️ Layar siswa sedang dibekukan — tampilan di sini tetap asli.</p>
        )}
        <Leaderboard groups={classGroups} getStats={getStats} frozen={stage.is_leaderboard_frozen} forceReveal activeGroupId={stage.active_group_id} />
      </Card>

      <Card>
        <SectionTitle icon={ScrollText} right={<span className="num text-xs text-slate-400">{classInvestments.length} transaksi</span>}>
          Live Audit Log
        </SectionTitle>
        {classInvestments.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Belum ada transaksi di kelas {stage.active_class}.</p>
        ) : (
          <ul className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {classInvestments.map((inv) => (
              <li key={inv.id} className="animate-pop rounded-xl bg-slate-800/70 p-3 ring-1 ring-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <b>{groupsById.get(inv.investor_group_id)?.group_name || '?'}</b>
                    <span className="mx-1 text-slate-500">➔</span>
                    <b>{groupsById.get(inv.target_group_id)?.group_name || '?'}</b>
                    <span className={`num ml-2 font-black ${Number(inv.amount) > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                      {Number(inv.amount) > 0 ? formatRupiahShort(inv.amount) : 'Rp 0 (No Deal)'}
                    </span>
                    <span className="num ml-2 text-xs text-slate-500">{formatTime(inv.created_at)}</span>
                  </div>
                  <button type="button" onClick={() => deleteInvestment(inv)} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-red-600/20 hover:text-red-300" title="Hapus transaksi">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-sm italic text-slate-300">“{inv.feedback}”</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
