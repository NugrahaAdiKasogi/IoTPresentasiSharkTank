import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LogOut, Lock, Send, Loader2, Wallet, MessageCircleQuestion, NotebookPen, Gauge,
  LineChart, Wrench, CheckCircle2, Hourglass, Users, Activity, Trophy, Presentation,
  AlertTriangle, KeyRound, Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSharkTankSync } from '../hooks/useSharkTankSync';
import { playBellSound, playCoinSound } from '../utils/soundEffects';
import {
  AMOUNT_CHIPS, MIN_FEEDBACK, TARGET_SPEND, compareName, formatRupiah, formatRupiahShort,
  formatTime, friendlyError, safeStorage,
} from '../utils/format';
import {
  Card, ConnectionDot, FeedLine, FullScreenMessage, Leaderboard, PhaseBadge, SectionTitle,
  SoundToggle, TimerDisplay,
} from '../components/shared';

const store = safeStorage('local');
const SESSION_KEY = 'sharktank_session';

function readSession() {
  try {
    const raw = store.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.groupId ? parsed : null;
  } catch {
    return null;
  }
}

export default function StudentPage() {
  const [session, setSession] = useState(readSession);
  const stageRef = useRef(null);

  const sync = useSharkTankSync({
    onInvestmentInsert: (inv) => {
      if (Number(inv.amount) > 0 && inv.class_name === stageRef.current?.active_class) playCoinSound();
    },
    onTimerEnd: () => playBellSound(),
  });
  const { stage, loading, error, groupsById } = sync;
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const myGroup = session ? groupsById.get(session.groupId) || null : null;

  // Kelompok dihapus guru -> sesi login di laptop ini otomatis dibersihkan
  useEffect(() => {
    if (!loading && !error && stage && session && !groupsById.has(session.groupId)) {
      store.removeItem(SESSION_KEY);
      setSession(null);
    }
  }, [loading, error, stage, session, groupsById]);

  const login = (groupId) => {
    const s = { groupId, at: Date.now() };
    store.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
  };
  const logout = () => {
    if (!window.confirm('Keluar / ganti kelompok di laptop ini?')) return;
    store.removeItem(SESSION_KEY);
    setSession(null);
  };

  if (loading && !stage) {
    return (
      <FullScreenMessage title="🦈 Menghubungkan ke Shark Tank…">
        <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Memuat data kelas secara realtime.</p>
      </FullScreenMessage>
    );
  }
  if (error && !stage) {
    return (
      <FullScreenMessage title="⚠️ Gagal memuat data" tone="red">
        <p className="font-mono text-red-300">{error}</p>
        <p>Pastikan <code>schema.sql</code> sudah dijalankan di Supabase dan internet tersambung.</p>
        <button type="button" onClick={sync.refetch} className="mt-2 rounded-lg bg-white px-4 py-2 font-bold text-slate-900">Coba Lagi</button>
      </FullScreenMessage>
    );
  }

  if (!myGroup) return <LoginScreen sync={sync} onLogin={login} />;

  return <StudentDashboard sync={sync} myGroup={myGroup} onLogout={logout} />;
}

/* =====================================================================
   A. LOGIN KELOMPOK
   ===================================================================== */
function LoginScreen({ sync, onLogin }) {
  const { stage, classGroups, connection } = sync;
  const [groupId, setGroupId] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');

  const sorted = useMemo(() => [...classGroups].sort((a, b) => compareName(a.group_name, b.group_name)), [classGroups]);

  useEffect(() => {
    if (groupId && !sorted.some((g) => g.id === groupId)) setGroupId('');
  }, [sorted, groupId]);

  const submit = (e) => {
    e.preventDefault();
    const g = sorted.find((x) => x.id === groupId);
    if (!g) return setErr('Pilih kelompok terlebih dahulu.');
    if (!/^\d{4}$/.test(pin)) return setErr('PIN harus 4 digit angka.');
    if (g.pin !== pin) {
      setPin('');
      return setErr('PIN salah. Tanyakan ke guru jika lupa.');
    }
    onLogin(g.id);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#1e3a8a_0%,_#020617_60%)] p-4 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-6xl">🦈</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight">IoT Shark Tank</h1>
          <p className="font-semibold text-amber-300">Battle of Innovators</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-slate-900/90 p-6 shadow-2xl ring-1 ring-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Kelas aktif saat ini</span>
            <ConnectionDot connection={connection} />
          </div>
          <div className="rounded-xl bg-indigo-600/20 py-3 text-center text-3xl font-black text-indigo-200 ring-1 ring-indigo-400/40">
            {stage?.active_class || '-'}
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-300">Nama Kelompok</span>
            <select
              value={groupId}
              onChange={(e) => { setGroupId(e.target.value); setErr(''); }}
              className="w-full rounded-xl bg-slate-800 px-3 py-3 font-semibold text-white ring-1 ring-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">— Pilih kelompokmu —</option>
              {sorted.map((g) => (
                <option key={g.id} value={g.id}>{g.group_name} — {g.project_title}</option>
              ))}
            </select>
            {sorted.length === 0 && <span className="mt-1 block text-xs text-amber-300">Guru belum menambahkan kelompok untuk kelas ini.</span>}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-300">PIN 4 Digit</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setErr(''); }}
                placeholder="••••"
                className="num w-full rounded-xl bg-slate-800 py-3 pl-11 pr-3 text-center text-2xl font-black tracking-[0.6em] text-white ring-1 ring-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </label>

          {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-300">{err}</p>}

          <button type="submit" className="w-full rounded-xl bg-amber-400 py-3 text-lg font-black text-slate-900 transition hover:bg-amber-300 active:scale-[0.99]">
            Masuk ke Arena 🦈
          </button>
          <p className="text-center text-xs text-slate-500">Satu kelompok boleh login di beberapa laptop — dompetnya tetap satu.</p>
        </form>
      </div>
    </div>
  );
}

/* =====================================================================
   B + C + D. DASHBOARD SISWA
   ===================================================================== */
function StudentDashboard({ sync, myGroup, onLogout }) {
  const { stage, activeGroup, secondsLeft, isPaused, connection } = sync;
  const isPresenter = stage.active_group_id === myGroup.id;
  const wrongClass = myGroup.class_name !== stage.active_class;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ---------- STICKY LIVE BANNER ---------- */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-black">🦈 IoT Shark Tank</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">Kelas {stage.active_class}</span>
            <ConnectionDot connection={connection} />
          </div>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <span className="hidden rounded-lg bg-indigo-500/20 px-3 py-1.5 text-sm font-bold text-indigo-200 sm:inline">
              {myGroup.group_name}
            </span>
            <button type="button" onClick={onLogout} className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-300 ring-1 ring-slate-600 hover:bg-slate-700">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Ganti Kelompok / Logout</span>
            </button>
          </div>
        </div>
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[1fr_auto]">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <PhaseBadge phase={stage.phase} />
              {isPaused && stage.phase !== 'IDLE' && (
                <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-xs font-black text-slate-900">⏸ JEDA</span>
              )}
            </div>
            <p className="truncate text-sm md:text-base">
              {activeGroup ? (
                <>
                  <span className="text-slate-400">Presenter: </span>
                  <b className="text-white">{activeGroup.group_name}</b>
                  <span className="text-slate-400"> — </span>
                  <span className="font-semibold text-amber-300">{activeGroup.project_title}</span>
                </>
              ) : (
                <span className="text-slate-400">Belum ada presenter terpilih</span>
              )}
            </p>
          </div>
          <div className="justify-self-start rounded-2xl bg-black/60 px-5 py-2 ring-1 ring-slate-700 md:justify-self-end">
            <TimerDisplay phase={stage.phase} secondsLeft={secondsLeft} isPaused={isPaused} className="w-[5ch] text-5xl md:text-6xl" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        {wrongClass ? (
          <Card className="text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
            <h2 className="mt-2 text-xl font-black">Sesi kelasmu sedang tidak aktif</h2>
            <p className="mt-1 text-slate-400">
              {myGroup.group_name} terdaftar di kelas <b>{myGroup.class_name}</b>, sedangkan panggung saat ini untuk kelas <b>{stage.active_class}</b>.
            </p>
          </Card>
        ) : isPresenter ? (
          <PresenterView sync={sync} myGroup={myGroup} />
        ) : (
          <AudienceView sync={sync} myGroup={myGroup} />
        )}

        {!wrongClass && <BottomBoards sync={sync} myGroup={myGroup} />}
      </main>
    </div>
  );
}

/* ---------------- KONDISI 1: MODE PANGGUNG (PRESENTER) ---------------- */
function PresenterView({ sync, myGroup }) {
  const { stage, secondsLeft, isPaused, getStats, classInvestments, groupsById } = sync;
  const frozen = stage.is_leaderboard_frozen;
  const stats = getStats(myGroup.id);
  const incoming = classInvestments.filter((i) => i.target_group_id === myGroup.id);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 text-center ring-1 ring-indigo-500/40 md:p-10">
        <p className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-[0.3em] text-indigo-300">
          <Presentation className="h-4 w-4" /> Mode Panggung — {myGroup.group_name}
        </p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-white md:text-6xl lg:text-7xl">{myGroup.project_title}</h1>
        <div className="mt-4"><PhaseBadge phase={stage.phase} size="lg" /></div>
        <div className="mt-6">
          <TimerDisplay phase={stage.phase} secondsLeft={secondsLeft} isPaused={isPaused} className="w-[5ch] text-[22vw] md:text-[11rem]" />
        </div>
        {isPaused && stage.phase !== 'IDLE' && <p className="text-xl font-black text-yellow-300">⏸ WAKTU DIJEDA GURU</p>}
      </section>

      <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        <section className="flex flex-col justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-yellow-400 p-6 text-slate-900 shadow-lg">
          <p className="text-sm font-black uppercase tracking-widest">💰 Total Dana Terkumpul Sesi Ini</p>
          <p className="num mt-2 text-4xl font-black md:text-5xl">{frozen ? 'Rp ???' : formatRupiah(stats.totalRaised)}</p>
          <p className="mt-2 flex items-center gap-2 font-bold">
            <Users className="h-5 w-5" /> {frozen ? '? investor' : `${stats.investorCount} kelompok berinvestasi`}
          </p>
          {frozen && <p className="mt-2 text-sm font-bold">❄️ Nominal disembunyikan sampai pengumuman akhir!</p>}
        </section>

        <Card>
          <SectionTitle icon={Sparkles} right={<span className="text-xs text-slate-400">{incoming.length} keputusan</span>}>
            Investor Live & Feedback
          </SectionTitle>
          {incoming.length === 0 ? (
            <p className="py-8 text-center text-slate-400">Menunggu investor… Tunjukkan demo terbaik kalian! 🚀</p>
          ) : (
            <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {incoming.map((inv) => (
                <li key={inv.id} className="animate-pop rounded-xl bg-slate-800 p-3 ring-1 ring-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-white">{groupsById.get(inv.investor_group_id)?.group_name || 'Kelompok'}</b>
                    <span className={`num font-black ${Number(inv.amount) > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                      {frozen ? 'Rp ???' : Number(inv.amount) > 0 ? `+ ${formatRupiahShort(inv.amount)}` : 'NO DEAL'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm italic text-slate-300">“{inv.feedback}”</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------------- KONDISI 2: PENONTON / INVESTOR ---------------- */
function AudienceView({ sync, myGroup }) {
  const { stage, activeGroup, getStats, investments } = sync;
  const stats = getStats(myGroup.id);
  const existing = activeGroup
    ? investments.find((i) => i.investor_group_id === myGroup.id && i.target_group_id === activeGroup.id)
    : null;

  return (
    <div className="space-y-5">
      <WalletHeader myGroup={myGroup} stats={stats} />

      {stage.phase === 'IDLE' || !activeGroup ? (
        <Card className="py-10 text-center">
          <Hourglass className="mx-auto h-12 w-12 animate-pulse text-slate-400" />
          <h2 className="mt-3 text-2xl font-black">Menunggu sesi dimulai…</h2>
          <p className="mx-auto mt-1 max-w-md text-slate-400">
            {activeGroup
              ? `Bersiap! ${activeGroup.group_name} akan segera mempresentasikan "${activeGroup.project_title}".`
              : 'Guru sedang menyiapkan presenter berikutnya. Siapkan catatan dan pertanyaan kritismu.'}
          </p>
        </Card>
      ) : stage.phase === 'PITCH' || stage.phase === 'QA' ? (
        <ListenMode myGroup={myGroup} activeGroup={activeGroup} phase={stage.phase} />
      ) : existing ? (
        <InvestConfirmed inv={existing} activeGroup={activeGroup} />
      ) : (
        <InvestForm
          key={activeGroup.id}
          sync={sync}
          myGroup={myGroup}
          activeGroup={activeGroup}
          remaining={stats.remainingBudget}
        />
      )}
    </div>
  );
}

function WalletHeader({ myGroup, stats }) {
  const budget = Number(myGroup.initial_budget) || 0;
  const usedPct = budget > 0 ? Math.min(100, (stats.spent / budget) * 100) : 0;
  const targetPct = budget > 0 ? Math.min(100, (TARGET_SPEND / budget) * 100) : 80;
  const reached = stats.spent >= TARGET_SPEND;
  const asked = myGroup.questions_asked;

  return (
    <section className="grid gap-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-5 ring-1 ring-indigo-500/30 md:grid-cols-[1fr_auto]">
      <div>
        <p className="flex items-center gap-2 text-sm font-bold text-slate-400">
          <Wallet className="h-4 w-4 text-amber-400" /> Dompet {myGroup.group_name}
        </p>
        <p className="num mt-1 text-3xl font-black text-white md:text-4xl">
          Sisa Modal: <span className="text-amber-300">{formatRupiah(stats.remainingBudget)}</span>
        </p>
        <p className="num text-sm text-slate-400">dari {formatRupiah(budget)}</p>

        <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${reached ? 'bg-emerald-500' : 'bg-amber-400'}`}
            style={{ width: `${usedPct}%` }}
          />
          <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `${targetPct}%` }} title="Target minimal Rp 80 Jt" />
        </div>
        <p className="num mt-1.5 text-xs font-semibold text-slate-300">
          Modal terpakai {formatRupiahShort(stats.spent)} / target minimal {formatRupiahShort(TARGET_SPEND)}{' '}
          {reached ? <span className="text-emerald-400">✅ Target tercapai</span> : <span className="text-amber-300">— gunakan modalmu dengan bijak!</span>}
        </p>
      </div>
      <div className="flex items-center md:justify-end">
        <span
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-base font-black ring-2 ${
            asked === 0 ? 'bg-red-500/15 text-red-300 ring-red-500/50' : 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/50'
          }`}
        >
          <MessageCircleQuestion className="h-5 w-5" />
          {asked === 0 ? 'Belum Bertanya ❌' : `Sudah Bertanya (${asked}x) ✅`}
        </span>
      </div>
    </section>
  );
}

const QUESTION_PROMPTS = [
  {
    icon: Gauge,
    title: 'Threshold Sensor',
    color: 'from-cyan-600/30 ring-cyan-500/40',
    text: 'Berapa nilai batas (threshold) sensor yang kalian pakai dan bagaimana cara menentukannya? Apa yang terjadi jika pembacaan sensor naik-turun tepat di sekitar batas itu?',
  },
  {
    icon: LineChart,
    title: 'Grafik Google Sheets',
    color: 'from-emerald-600/30 ring-emerald-500/40',
    text: 'Pada grafik data di Google Sheets kalian, apa arti lonjakan atau penurunan pada waktu tertentu? Keputusan apa yang bisa diambil pengguna dari grafik itu?',
  },
  {
    icon: Wrench,
    title: 'Kendala Implementasi Fisik',
    color: 'from-orange-600/30 ring-orange-500/40',
    text: 'Jika alat ini dipasang sungguhan di sekolah/rumah, apa kendala fisiknya (daya listrik, sinyal Wi-Fi, cuaca, biaya komponen, perawatan)? Bagaimana solusinya?',
  },
];

function ListenMode({ myGroup, activeGroup, phase }) {
  const key = `sharktank_notes_${myGroup.id}_${activeGroup.id}`;
  const [notes, setNotes] = useState(() => store.getItem(key) || '');

  const update = (value) => {
    setNotes(value);
    store.setItem(key, value);
  };
  const addPrompt = (text) => update(notes.trim() ? `${notes.trim()}\n\n• ${text}` : `• ${text}`);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl bg-slate-800/80 p-4 ring-1 ring-slate-600">
        <Lock className="mt-0.5 h-6 w-6 shrink-0 text-slate-300" />
        <div>
          <p className="font-black text-white">Form investasi terkunci 🔒</p>
          <p className="text-slate-300">Simak presentasi &amp; demo Tinkercad. Investasi dibuka setelah sesi tanya jawab!</p>
          {phase === 'QA' && (
            <p className="mt-1 font-bold text-orange-300">🦈 Shark Attack dimulai — angkat tangan dan ajukan pertanyaan tajammu sekarang!</p>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <SectionTitle icon={NotebookPen} right={<span className="text-xs text-slate-500">tersimpan otomatis di laptop ini</span>}>
            Catatan Pertanyaan
          </SectionTitle>
          <textarea
            value={notes}
            onChange={(e) => update(e.target.value)}
            rows={10}
            placeholder={`Catat hal menarik dari presentasi ${activeGroup.group_name} dan susun pertanyaanmu di sini…`}
            className="w-full resize-y rounded-xl bg-slate-950 p-3 text-slate-100 ring-1 ring-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </Card>
        <div className="space-y-3">
          <p className="text-sm font-extrabold uppercase tracking-wider text-slate-300">💡 Pemantik Pertanyaan Kritis</p>
          {QUESTION_PROMPTS.map(({ icon: Icon, title, color, text }) => (
            <div key={title} className={`rounded-2xl bg-gradient-to-br ${color} to-slate-900 p-4 ring-1`}>
              <p className="flex items-center gap-2 font-black text-white"><Icon className="h-5 w-5" /> {title}</p>
              <p className="mt-1 text-sm text-slate-200">{text}</p>
              <button type="button" onClick={() => addPrompt(text)} className="mt-2 text-xs font-bold text-indigo-200 underline-offset-2 hover:underline">
                + Salin ke catatan
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InvestForm({ sync, myGroup, activeGroup, remaining }) {
  const { secondsLeft, isPaused, refetch } = sync;
  const [amount, setAmount] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const lockRef = useRef(false);

  const trimmedLen = feedback.trim().length;
  const timeUp = secondsLeft === 0 && !isPaused;
  const amountValid = amount !== null && amount <= remaining;
  const canSubmit = amountValid && trimmedLen >= MIN_FEEDBACK && !submitting && !timeUp;

  useEffect(() => {
    if (amount !== null && amount > remaining) setAmount(null);
  }, [amount, remaining]);

  const submit = async (e) => {
    e.preventDefault();
    if (lockRef.current || !canSubmit) return;
    lockRef.current = true;
    setSubmitting(true);
    setErr('');
    setInfo('');
    try {
      const { error } = await supabase.from('investments').insert({
        class_name: myGroup.class_name,
        investor_group_id: myGroup.id,
        target_group_id: activeGroup.id,
        amount,
        feedback: feedback.trim(),
      });
      if (error) {
        const msg = friendlyError(error);
        if (msg === 'DUPLICATE') {
          setInfo('Rekan satu kelompokmu baru saja mengirim keputusan lebih dulu. Menampilkan keputusan kelompok…');
        } else {
          setErr(msg);
        }
      }
      await refetch(); // pastikan kartu konfirmasi muncul walau event realtime terlambat
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      lockRef.current = false;
      setSubmitting(false);
    }
  };

  if (timeUp) {
    return (
      <Card className="py-10 text-center ring-red-500/40">
        <Hourglass className="mx-auto h-12 w-12 text-red-400" />
        <h2 className="mt-3 text-2xl font-black text-red-300">⌛ Waktu investasi untuk {activeGroup.group_name} sudah habis</h2>
        <p className="mt-1 text-slate-400">Kelompokmu belum mengirim keputusan. Segera beri tahu guru jika ada kendala teknis.</p>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl bg-gradient-to-br from-blue-950 via-slate-900 to-amber-950/40 p-5 ring-2 ring-amber-400/50 md:p-6">
      <div>
        <p className="text-sm font-black uppercase tracking-widest text-amber-300">💰 Deal or No Deal?</p>
        <h2 className="text-2xl font-black text-white md:text-3xl">
          Investasi untuk {activeGroup.group_name}: <span className="text-amber-300">{activeGroup.project_title}</span>
        </h2>
        <p className="text-sm text-slate-400">Diskusikan dengan kelompokmu. Hanya SATU keputusan per kelompok — siapa pun yang menekan kirim pertama akan tercatat.</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-slate-300">1. Pilih nominal</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {AMOUNT_CHIPS.map((v) => {
            const disabled = v > remaining || submitting;
            const active = amount === v;
            return (
              <button
                key={v}
                type="button"
                disabled={disabled}
                onClick={() => setAmount(v)}
                className={`num rounded-xl px-3 py-3 text-base font-black ring-2 transition ${
                  active
                    ? 'bg-amber-400 text-slate-900 ring-amber-200'
                    : 'bg-slate-800 text-white ring-slate-600 hover:ring-amber-400'
                } disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:ring-slate-600`}
                title={v > remaining ? 'Melebihi sisa modal kelompokmu' : ''}
              >
                {v === 0 ? 'Rp 0' : formatRupiah(v)}
              </button>
            );
          })}
        </div>
        {amount === 0 && <p className="mt-2 text-sm text-slate-400">Rp 0 = <b>No Deal</b>. Tetap wajib memberi alasan yang membangun.</p>}
      </div>

      <div>
        <div className="mb-2 flex items-end justify-between">
          <p className="text-sm font-bold text-slate-300">2. Alasan / Feedback (wajib)</p>
          <span className={`num text-sm font-bold ${trimmedLen >= MIN_FEEDBACK ? 'text-emerald-400' : 'text-red-400'}`}>
            {trimmedLen}/{MIN_FEEDBACK} karakter min.
          </span>
        </div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value.slice(0, 500))}
          rows={4}
          disabled={submitting}
          placeholder="Contoh: Sensor ultrasoniknya responsif dan grafiknya jelas, tapi perlu solusi daya baterai untuk di luar ruangan."
          className="w-full rounded-xl bg-slate-950 p-3 text-slate-100 ring-1 ring-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {err && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-300">⚠️ {err}</p>}
      {info && <p className="rounded-lg bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-200">ℹ️ {info}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 py-4 text-xl font-black text-slate-900 shadow-lg transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
      >
        {submitting ? <><Loader2 className="h-6 w-6 animate-spin" /> Mengirim…</> : <><Send className="h-6 w-6" /> Kirim Investasi 🚀</>}
      </button>
    </form>
  );
}

function InvestConfirmed({ inv, activeGroup }) {
  return (
    <section className="rounded-2xl bg-emerald-950/60 p-6 text-center ring-2 ring-emerald-500/60">
      <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
      <h2 className="mt-2 text-2xl font-black text-emerald-200">✅ Keputusan Investasi Kelompokmu Sudah Terkirim!</h2>
      <p className="mt-1 text-slate-300">untuk {activeGroup.group_name} — {activeGroup.project_title}</p>
      <p className="num mt-4 text-4xl font-black text-white">{Number(inv.amount) === 0 ? 'Rp 0 (No Deal)' : formatRupiah(inv.amount)}</p>
      <blockquote className="mx-auto mt-3 max-w-2xl rounded-xl bg-slate-900/70 p-4 italic text-slate-200 ring-1 ring-slate-700">“{inv.feedback}”</blockquote>
      <p className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400"><Lock className="h-3.5 w-3.5" /> Terkunci • dikirim {formatTime(inv.created_at)}</p>
    </section>
  );
}

/* ---------------- D. LIVE TICKER & LEADERBOARD ---------------- */
function BottomBoards({ sync, myGroup }) {
  const { stage, classInvestments, classGroups, getStats, groupsById } = sync;
  const frozen = stage.is_leaderboard_frozen;
  const latest = classInvestments.slice(0, 5);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <SectionTitle icon={Activity}>Live Investment Feed</SectionTitle>
        {latest.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Belum ada transaksi di kelas ini.</p>
        ) : (
          <ul className="space-y-2">
            {latest.map((inv) => (
              <li key={inv.id} className="animate-pop flex items-center justify-between gap-3 rounded-xl bg-slate-800/70 px-3 py-2 text-sm ring-1 ring-slate-700">
                <FeedLine inv={inv} groupsById={groupsById} hideAmount={frozen} />
                <span className="num shrink-0 text-xs text-slate-500">{formatTime(inv.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <SectionTitle icon={Trophy}>Klasemen Investasi — Kelas {stage.active_class}</SectionTitle>
        <Leaderboard groups={classGroups} getStats={getStats} frozen={frozen} highlightId={myGroup.id} activeGroupId={stage.active_group_id} />
      </Card>
    </div>
  );
}
