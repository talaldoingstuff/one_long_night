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

console.log('');
console.log('  progression: ' + C._PROG.map(QUAL).join(' - '));
console.log('  motif:       ' + C._MOTIF.map(([d, n]) => 'deg ' + d + ' x' + n).join(', ') +
            '   (' + C._MOTIF.reduce((a, b) => a + b[1], 0) + ' sixteenths = one bar)');
for (const w of [1, 30]) {
  const ns = run(30, w);
  const lead = ns.filter((q) => Math.abs(q.vol - C._MUSV * C._MLEAD[1]) < 1e-9);
  const bass = ns.filter((q) => Math.abs(q.vol - C._MUSV * C._MBASS[2]) < 1e-9);
  const hat = ns.length - lead.length - bass.length;
  const st = 60 / C._BPM / 4;
  console.log('');
  console.log('  wave ' + w + ':  ' + (st * 16).toFixed(2) + 's a bar, ' +
    lead.length + ' melody notes and ' + bass.length + ' bass in 30s, hat ' + hat);
  // one line a bar, so the tune can be read
  let bar = 0;
  for (let b = 0; b < 8; b++) {
    const t0 = b * st * 16, t1 = t0 + st * 16;
    const inBar = lead.filter((q) => q.t >= t0 - 1e-9 && q.t < t1 - 1e-9);
    if (!inBar.length) break;
    console.log('    bar ' + (b + 1) + '  ' + String(QUAL(C._PROG[b % C._PROG.length])).padEnd(5) +
      inBar.map((q) => nm(q.f)).join(' '));
  }
}

console.log('');
console.log('--- does the hat arrive when the field does? ---');
const crowded = (n, secs) => {
  M.restart(); M.place([]); M.setFire(0); M.setWave(10);
  snd.notes = [];
  for (let i = 0; i < secs * 60; i++) {
    M.place(Array.from({ length: n }, () => [0, C._GY, 9, 9, 9, 0, 0, 0, 0]));
    M.stepMusic(1 / 60);
  }
  return snd.notes.filter((q) => Math.abs(q.f - C._MHAT[0]) < 1).length;
};
console.log('  empty field      ' + crowded(0, 20) + ' hat');
console.log('  ' + (C._MUSTHR / 2 | 0) + ' ghosts         ' + crowded(C._MUSTHR / 2 | 0, 20) + ' hat');
console.log('  ' + C._MUSTHR + ' ghosts         ' + crowded(C._MUSTHR, 20) + ' hat');
