// Efek suara sintetis murni Web Audio API — tanpa file MP3 (bebas 404/CORS).

let ctx = null;
let enabled = false;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Panggil dari event klik (gesture) agar browser mengizinkan audio. */
export async function unlockAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') {
    try { await c.resume(); } catch { /* diabaikan */ }
  }
  return Boolean(c && c.state === 'running');
}

export function setSoundEnabled(value) {
  enabled = Boolean(value);
  if (enabled) unlockAudio();
}

export function isSoundEnabled() {
  return enabled;
}

function tone(c, { freq, start, duration, type = 'sine', peak = 0.3, attack = 0.005, dest }) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(dest);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** "Cha-Ching!" — dua nada tinggi cepat E6 -> B6 + kilau logam. */
export function playCoinSound() {
  if (!enabled) return;
  const c = getCtx();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + 0.01;
  const master = c.createGain();
  master.gain.value = 0.5;
  master.connect(c.destination);

  const E6 = 1318.51;
  const B6 = 1975.53;
  // "Cha"
  tone(c, { freq: E6, start: t, duration: 0.12, type: 'square', peak: 0.18, dest: master });
  tone(c, { freq: E6 * 2, start: t, duration: 0.08, type: 'sine', peak: 0.08, dest: master });
  // "Ching!"
  tone(c, { freq: B6, start: t + 0.09, duration: 0.55, type: 'square', peak: 0.2, dest: master });
  tone(c, { freq: B6 * 1.5, start: t + 0.09, duration: 0.45, type: 'sine', peak: 0.1, dest: master });
  tone(c, { freq: B6 * 2.01, start: t + 0.1, duration: 0.35, type: 'triangle', peak: 0.07, dest: master });
}

/** Bel akhir babak — harmoni lonceng logam (parsial inharmonik). */
export function playBellSound() {
  if (!enabled) return;
  const c = getCtx();
  if (!c || c.state !== 'running') return;
  const master = c.createGain();
  master.gain.value = 0.55;
  master.connect(c.destination);

  const base = 659.25; // E5
  const partials = [
    { r: 0.5, p: 0.25, d: 3.2 },  // hum
    { r: 1.0, p: 0.35, d: 2.8 },  // fundamental
    { r: 1.19, p: 0.16, d: 2.2 }, // minor third
    { r: 1.5, p: 0.14, d: 2.0 },  // fifth
    { r: 2.0, p: 0.12, d: 1.6 },  // octave
    { r: 2.74, p: 0.08, d: 1.2 }, // inharmonik khas logam
    { r: 5.4, p: 0.04, d: 0.6 },
  ];
  // dua kali dentang
  [0, 0.7].forEach((offset, i) => {
    const t = c.currentTime + 0.01 + offset;
    partials.forEach(({ r, p, d }) =>
      tone(c, { freq: base * r, start: t, duration: d, peak: p * (i === 0 ? 1 : 0.8), attack: 0.003, dest: master }),
    );
  });
}
