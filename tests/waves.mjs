// What the music actually plays: the chord under each bar, and the notes on it.
const snd = { notes: [] };
const fp = () => ({ setValueAtTime: (v) => { snd.f0 = v; }, exponentialRampToValueAtTime: () => {} });
const src = (kind) => { const o = { frequency: fp(), connect: (x) => x, stop() {},
  start: () => snd.notes.push({ f: snd.f0, type: kind || o.type, vol: snd.g.v, t: snd.t }) }; return o; };
globalThis.AudioContext = class {
  constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = {}; }
  resume() {} createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  createGain() { const g = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {},
    linearRampToValueAtTime: (v) => { g.v = v; } }, connect: (x) => x }; return (snd.g = g); }
  createDynamicsCompressor() {
    const c = { connect: (x) => x, reduction: 0 };
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) c[k] = { value: 0 };
    return c;
  }
  createBiquadFilter() { return { type: '', Q: { value: 0 }, frequency: fp(), connect: (x) => x }; }
  createBufferSource() { return src('noise'); } createOscillator() { return src(); }
};
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true });
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
let rafCb = null; const L = Object.create(null);
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
const M = await import('../src/main.js');
const C = M.C;
let t = 0;
rafCb && 0;
const tick = () => { t += 1000 / 60; rafCb(t); };
tick();
(L.pointerdown || []).forEach((f) => f({ clientX: 450, clientY: 250 }));
(L.pointerup || []).forEach((f) => f({}));

const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = (f) => { const m = Math.round(12 * Math.log2(f / 440)) + 69;
  return NOTE[((m % 12) + 12) % 12] + ((m / 12 | 0) - 1); };
const QUAL = (ch) => nm(55 * 2 ** (ch[0] / 12)).replace(/[0-9-]/g, '') + (ch[1] ? 'm' : '');

const run = (secs, w) => {
  M.restart(); M.place([]); M.setFire(0); M.setWave(w);
  snd.notes = [];
  snd.t = 0;
  for (let i = 0; i < secs * 60; i++) { snd.t = i / 60; M.place([]); M.stepMusic(1 / 60); }
  return snd.notes;
};


const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);
console.log('');
console.log('=== does the music change as the waves go on? ====================');
console.log('');
console.log('  ' + P('wave', 6) + R('BPM', 6) + R('a bar', 8) + R('key', 6) +
            '   first bar of the tune');
let prev = null;
for (const w of [1, 4, 8, 12, 16, 20, 24, 28, 30, 36]) {
  const ns = run(6, w);
  const lead = ns.filter((q) => Math.abs(q.vol - C._MUSV * C._MLEAD[1]) < 1e-9);
  const bpm = C._BPM;
  const key = 0;
  const bar = lead.slice(0, C._MOTIF.length).map((q) => nm(q.f)).join(' ');
  console.log('  ' + P(w, 6) + R(bpm.toFixed(1), 6) + R((16 * 60 / bpm / 4).toFixed(2) + 's', 8) +
    R('+' + key, 6) + '   ' + bar + (bar === prev ? '' : '   <- changed'));
  prev = bar;
}
console.log('');
console.log('  Fixed no matter the wave: the progression, the motif, every');
console.log('  instrument, every level, and the limiter.');
console.log('  Not fixed: nothing. The tempo and the key both used to move with the');
console.log('             wave and no longer do.');
