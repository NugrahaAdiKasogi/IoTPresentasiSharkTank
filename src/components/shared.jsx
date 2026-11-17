import { useEffect, useState } from 'react';
import { Volume2, VolumeX, Wifi, WifiOff, Snowflake, Trophy, Radio } from 'lucide-react';
import { PHASES, formatClock, formatRupiah, formatRupiahShort, compareName, safeStorage } from '../utils/format';
import { setSoundEnabled, unlockAudio } from '../utils/soundEffects';

const store = safeStorage('local');
const SOUND_KEY = 'sharktank_sound';

/** Tombol "🔊 Suara: ON/OFF" — mengaktifkan AudioContext setelah klik. */
export function SoundToggle({ className = '' }) {
  const [on, setOn] = useState(() => store.getItem(SOUND_KEY) === 'on');

  useEffect(() => {
    setSoundEnabled(on);
    if (!on) return undefined;
    // Jika preferensi ON tersimpan, buka kunci audio pada interaksi pertama
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [on]);

  const toggle = async () => {
    const next = !on;
    if (next) await unlockAudio();
    store.setItem(SOUND_KEY, next ? 'on' : 'off');
    setOn(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold ring-1 transition ${
        on ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/50 hover:bg-emerald-500/30' : 'bg-slate-800 text-slate-300 ring-slate-600 hover:bg-slate-700'
      } ${className}`}
      title="Klik untuk mengizinkan efek suara"
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      <span className="whitespace-nowrap">Suara: {on ? 'ON' : 'OFF'}</span>
    </button>
  );
}

export function ConnectionDot({ connection }) {
  const live = connection === 'live';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        live ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/20 text-red-300'
      }`}
      title={live ? 'Terhubung realtime' : 'Koneksi realtime terputus — mencoba menyambung ulang'}
    >
      {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {live ? 'LIVE' : connection === 'connecting' ? 'MENYAMBUNG…' : 'OFFLINE'}
    </span>
  );
}

export function PhaseBadge({ phase, size = 'md' }) {
  const cfg = PHASES[phase] || PHASES.IDLE;
  const sz = size === 'lg' ? 'px-4 py-2 text-base md:text-lg' : 'px-3 py-1.5 text-xs md:text-sm';
  return (
    <span className={`inline-flex items-center rounded-full font-extrabold tracking-wide ring-2 ${cfg.badge} ${sz}`}>
      {cfg.label}
    </span>
  );
}

/** Warna timer: kuning sisa 2 menit (PITCH), merah berkedip 30 detik terakhir. */
export function timerColor(phase, secondsLeft, isPaused) {
  if (secondsLeft == null || phase === 'IDLE') return { cls: 'text-slate-500', blink: false };
  if (secondsLeft <= 30) return { cls: 'text-red-500', blink: !isPaused && secondsLeft > 0 };
  if (phase === 'PITCH' && secondsLeft <= 120) return { cls: 'text-yellow-300', blink: false };
  return { cls: 'text-white', blink: false };
}

export function TimerDisplay({ phase, secondsLeft, isPaused, className = '' }) {
  const { cls, blink } = timerColor(phase, secondsLeft, isPaused);
  return (
    <span className={`num inline-block text-center font-mono font-black leading-none ${cls} ${className}`}>
      <span className={blink ? 'animate-blink' : ''}>{formatClock(phase === 'IDLE' ? null : secondsLeft)}</span>
    </span>
  );
}

/** Leaderboard untuk siswa (bisa freeze) & admin (forceReveal). */
export function Leaderboard({ groups, getStats, frozen, forceReveal = false, highlightId, activeGroupId }) {
  const hide = frozen && !forceReveal;
  const rows = groups
    .map((g) => ({ g, s: getStats(g.id) }))
    .sort((a, b) => {
      if (hide) return compareName(a.g.group_name, b.g.group_name);
      return (
        b.s.totalRaised - a.s.totalRaised ||
        b.s.investorCount - a.s.investorCount ||
        compareName(a.g.group_name, b.g.group_name)
      );
    });

  return (
    <div className="space-y-2">
      {hide && (
        <div className="flex items-center gap-2 rounded-xl bg-cyan-500/15 px-3 py-2 text-sm font-extrabold text-cyan-200 ring-1 ring-cyan-400/40">
          <Snowflake className="h-4 w-4 shrink-0" /> ❄️ KLASEMEN SEMENTARA DIKUNCI (KEJUTAN AKHIR!)
        </div>
      )}
      {rows.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Belum ada kelompok di kelas ini.</p>}
      <ol className="space-y-1.5">
        {rows.map(({ g, s }, idx) => {
          const rank = idx + 1;
          const medal = !hide && s.totalRaised > 0 ? ['🥇', '🥈', '🥉'][idx] : null;
          return (
            <li
              key={g.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ${
                g.id === highlightId ? 'bg-indigo-500/20 ring-indigo-400/60' : 'bg-slate-800/70 ring-slate-700'
              }`}
            >
              <span className="num w-8 shrink-0 text-center text-lg font-black text-slate-300">
                {hide ? '•' : medal || rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">
                  {g.group_name}
                  {g.id === activeGroupId && (
                    <Radio className="ml-1.5 inline h-3.5 w-3.5 animate-pulse text-red-400" aria-label="sedang presentasi" />
                  )}
                </p>
                <p className="truncate text-xs text-slate-400">{g.project_title}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="num font-black text-amber-300">{hide ? 'Rp ???' : formatRupiah(s.totalRaised)}</p>
                <p className="num text-xs text-slate-400">{hide ? '? investor' : `${s.investorCount} investor`}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function FeedLine({ inv, groupsById, hideAmount }) {
  const from = groupsById.get(inv.investor_group_id)?.group_name || 'Kelompok (dihapus)';
  const to = groupsById.get(inv.target_group_id)?.group_name || 'Kelompok (dihapus)';
  const amount = Number(inv.amount);
  if (hideAmount) {
    return (
      <span>
        🔒 <b>{from}</b> mengirim keputusan investasi ke <b>{to}</b>
      </span>
    );
  }
  if (amount === 0) {
    return (
      <span>
        🙅 <b>{from}</b> memutuskan <b>NO DEAL (Rp 0)</b> untuk <b>{to}</b>
      </span>
    );
  }
  return (
    <span>
      💸 <b>{from}</b> menginvestasikan <b className="num text-amber-300">{formatRupiahShort(amount)}</b> ke <b>{to}</b>
    </span>
  );
}

export function SectionTitle({ icon: Icon = Trophy, children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-300">
        <Icon className="h-4 w-4 text-amber-400" />
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Card({ className = '', children }) {
  return <section className={`rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-700/70 md:p-5 ${className}`}>{children}</section>;
}

export function FullScreenMessage({ title, children, tone = 'slate' }) {
  const ring = tone === 'red' ? 'ring-red-500/50' : 'ring-slate-700';
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className={`w-full max-w-xl rounded-2xl bg-slate-900 p-6 ring-1 ${ring}`}>
        <h1 className="mb-3 text-xl font-black">{title}</h1>
        <div className="space-y-2 text-sm text-slate-300">{children}</div>
      </div>
    </div>
  );
}
