// Konstanta aturan permainan & helper format.

export const MAX_INVEST = 25_000_000;
export const TARGET_SPEND = 80_000_000;
export const MIN_FEEDBACK = 20;
export const AMOUNT_CHIPS = [0, 5_000_000, 10_000_000, 15_000_000, 20_000_000, 25_000_000];

export const PHASES = {
  IDLE: {
    label: '⏳ MENUNGGU SESI DIMULAI',
    badge: 'bg-slate-600 text-slate-100 ring-slate-400/40',
    duration: null,
  },
  PITCH: {
    label: '🎤 THE PITCH & LIVE DEMO (10 MENIT)',
    badge: 'bg-emerald-600 text-white ring-emerald-300/50',
    duration: 600,
  },
  QA: {
    label: '🦈 SHARK ATTACK: WAJIB TANYA (5 MENIT)',
    badge: 'bg-gradient-to-r from-orange-600 to-red-600 text-white ring-orange-300/50',
    duration: 300,
  },
  INVEST: {
    label: '💰 DEAL OR NO DEAL: BUKA INVESTASI (1 MENIT)',
    badge: 'bg-gradient-to-r from-blue-700 to-amber-500 text-white ring-amber-300/50',
    duration: 60,
  },
};

const rupiahFmt = new Intl.NumberFormat('id-ID');

export function formatRupiah(value) {
  return `Rp ${rupiahFmt.format(Math.round(Number(value) || 0))}`;
}

/** "Rp 20 Jt", "Rp 2,5 Jt", "Rp 0" */
export function formatRupiahShort(value) {
  const n = Number(value) || 0;
  if (n === 0) return 'Rp 0';
  if (n >= 1_000_000) {
    const jt = n / 1_000_000;
    return `Rp ${jt.toLocaleString('id-ID', { maximumFractionDigits: 1 })} Jt`;
  }
  return formatRupiah(n);
}

export function formatClock(seconds) {
  if (seconds == null) return '--:--';
  const s = Math.max(0, seconds);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Urutan alami: "Kelompok 2" sebelum "Kelompok 10" */
export function compareName(a, b) {
  return String(a).localeCompare(String(b), 'id', { numeric: true, sensitivity: 'base' });
}

/** Ubah error Supabase/Postgres menjadi pesan ramah siswa. */
export function friendlyError(err) {
  if (!err) return '';
  const msg = String(err.message || err);
  if (err.code === '23505') return 'DUPLICATE';
  if (msg.includes('BUDGET_EXCEEDED')) return 'Sisa modal kelompokmu tidak cukup untuk nominal ini.';
  if (msg.includes('INVEST_TIME_UP')) return 'Waktu investasi sudah habis.';
  if (msg.includes('INVEST_CLOSED')) return 'Sesi investasi untuk presenter ini sudah ditutup / berganti.';
  if (msg.includes('CLASS_MISMATCH')) return 'Kelompokmu tidak berada di kelas yang sama dengan presenter.';
  if (msg.includes('NOT_FOUND')) return 'Data kelompok tidak ditemukan (mungkin baru dihapus guru).';
  if (err.code === '23514') return 'Data ditolak server (cek nominal maks Rp 25 Jt & alasan min. 20 karakter).';
  if (/fetch|network|Failed/i.test(msg)) return 'Koneksi internet terputus. Coba lagi.';
  return msg;
}

export function safeStorage(type = 'local') {
  try {
    const s = type === 'session' ? window.sessionStorage : window.localStorage;
    const k = '__t__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
  }
}
