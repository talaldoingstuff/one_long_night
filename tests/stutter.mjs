// Ghost assertions below are about TYPES[0], the Drifter - the type that was
// the whole roster when they were written.
// Step 3's core loop, driven through the real module: spawning, closing, firing,
// travel time, collision, hearts, death, restart.
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const rec = { ops: [], style: '#000', sstyle: '#000', alpha: 1, comp: 'source-over', cur: null };
const canvas = { style: {}, width: 0, height: 0 };
const ctx = new Proxy({ canvas }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'beginPath') return () => { rec.cur = []; rec.arc = null; };
    if (k === 'lineTo' || k === 'moveTo') return (x, y) => rec.cur && rec.cur.push([x, y]);
    if (k === 'fill') return (rule) => { rec.ops.push({ op: 'fill', rule, c: rec.style, alpha: rec.alpha, comp: rec.comp, n: rec.cur ? rec.cur.length : 0, p: rec.cur, a: rec.arc }); rec.cur = null; };
    if (k === 'stroke') return () => { rec.ops.push({ op: 'stroke', c: rec.sstyle, w: rec.lw, cap: rec.cap, alpha: rec.alpha, comp: rec.comp, n: rec.cur ? rec.cur.length : 0, p: rec.cur, a: rec.arc }); };
    if (k === 'translate') return (x, y) => rec.ops.push({ op: 'translate', x, y });
    if (k === 'createLinearGradient') return (x0, y0, x1, y1) => {
      const stops = [];
      return { addColorStop: (o, c) => stops.push(o + ':' + c),
               toString: () => 'grad(' + x0 + ',' + y0 + ',' + x1 + ',' + y1 + ';' +
                 stops.join(' ') + ')' };
    };
    if (k === 'strokeRect') return (x, y, w, h) => rec.ops.push({ op: 'srect', x, y, w, h, c: rec.sstyle, lw: rec.lw });
    if (k === 'fillRect') return (x, y, w, h) => rec.ops.push({ op: 'rect', x, y, w, h, c: rec.style, alpha: rec.alpha, comp: rec.comp });
    if (k === 'fillText') return (s, x, y) => rec.ops.push({ op: 'text', s, x, y, c: rec.style, align: rec.align, f: parseFloat(rec.font), comp: rec.comp });
    if (k === 'arc') return (x, y, rad, a0, a1) => { (rec.cur = rec.cur || []).push([x, y]); rec.arc = [x, y, rad, a0, a1]; };
    return () => anyObj;
  },
  set(t, k, v) {
    if (k === 'fillStyle') rec.style = '' + v;
    if (k === 'strokeStyle') rec.sstyle = v;
    if (k === 'lineWidth') rec.lw = v;
    if (k === 'lineCap') rec.cap = v;
    if (k === 'globalAlpha') rec.alpha = v;
    if (k === 'globalCompositeOperation') rec.comp = v;
    if (k === 'textAlign') rec.align = v;
    if (k === 'font') rec.font = v;
    t[k] = v; return true;
  },
});
// A recording AudioContext. A sound is one source under a gain and a panner, built
// and connected in that order and then started, so a note is complete by the time
// start() is called and can be pushed whole. The pitch sweep is recorded wherever
// it lands - on the oscillator for a pitched sound, on the bandpass for a noise
// one - because from and to mean the same thing to the player either way.
const snd = { notes: [], made: 0 };
const freqParam = () => ({
  setValueAtTime: (v) => { snd.f0 = v; },
  exponentialRampToValueAtTime: (v) => { snd.f1 = v; },
});
const source = (kind) => {
  const o = {
    frequency: freqParam(),
    connect: (x) => x,
    start: (at) => snd.notes.push({ f0: snd.f0, f1: snd.f1, type: kind || o.type,
                                    vol: snd.g.v, at }),
    stop: () => {},
  };
  return o;
};
globalThis.AudioContext = class {
  constructor() {
    snd.made++;
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = {};
  }
  resume() { this.state = 'running'; }
  createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  createGain() {
    const g2 = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {},
                         linearRampToValueAtTime: (v) => { g2.v = v; } },
                 connect: (x) => { snd.gainTo = x; return x; } };
    return (snd.g = g2);
  }
  createDynamicsCompressor() {
    const c = { connect: (x) => { snd.toDest = x === this.destination; return x; }, reduction: 0 };
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) c[k] = { value: 0 };
    return (snd.lim = c);
  }
  createBiquadFilter() {
    return { type: '', Q: { value: 0 }, frequency: freqParam(), connect: (x) => x };
  }
  createBufferSource() { return source('noise'); }
  createOscillator() { return source(); }
};

let rafCb = null;
const L = Object.create(null);
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
let seed = 0x4d3f21;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const M = await import('../src/main.js');
const C = M.C;
const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : ''));
let t = 0;
const tick = (n = 1) => { for (let i = 0; i < n; i++) { rec.ops = []; t += 1000 / 60; rafCb(t); } };
const fire = (t2, e) => (L[t2] || []).forEach((f) => f(e));
const press = (x = 450, y = 250) => fire('pointerdown', { clientX: x, clientY: y });
const release = () => fire('pointerup', {});
const drag = (x, y) => fire('pointermove', { clientX: x, clientY: y });
// Press and wait for the arming window to actually finish. Ticking exactly
// ARM*60 frames looks equivalent and is not: dt comes off a float clock that has
// been accumulating all suite, so by the later blocks eighteen frames sum to
// 0.2999999999998 and the charge never starts. Wait for the state, not the count.
const armed = () => { press(); let i = 0; while (!M.anim().charging && i++ < 600) tick(); };
// A wave now ends on a card, so anything that waits for the next one has to take
// one. Clicks the middle of the nth card, which is the path a player takes.
const pickCard = (n = 0) => {
  const b = M.boxes()[n];
  press(b[0] + b[2] / 2, b[1] + b[3] / 2);
  release();
};
const clearWave = (max = 60 * 60) => {
  let i = 0;
  while (!M.anim().picking && i++ < max) { if (M.dbg().ghosts.length) M.place([]); tick(); }
  return i;
};
let prevented = 0;
const key = (type, code) => fire(type, { type, code, preventDefault: () => prevented++ });
const kdown = (code) => key('keydown', code);
const kup = (code) => key('keyup', code);
const allUp = () => ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown',
                     'ArrowLeft', 'ArrowRight', 'Space'].forEach(kup);
// Firing is automatic: after a restart the cooldown is zero, so one tick fires
// exactly one horn. This replaces every press()-to-shoot in the suite.
const shoot = () => { tick(); return M.dbg().horns[M.dbg().horns.length - 1]; };
tick();
const madeBeforeAnyPress = snd.made;


const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);
M.restart(); M.look(0, 0); M.setFire(0);

const jumps = (label, place, frames) => {
  M.restart(); M.look(0, 0); M.setFire(0);
  let prev = null, mx = 0, big = 0;
  const xs = [];
  for (let i = 0; i < frames; i++) {
    place(i);
    tick();
    const a = M.aimPoint();
    if (prev) {
      const d = Math.hypot(a[0] - prev[0], a[1] - prev[1]);
      if (d > mx) mx = d;
      if (d > 2) big++;
    }
    prev = a;
    xs.push(a[0]);
  }
  console.log('  ' + P(label, 46) + R(mx.toFixed(1) + 'px', 11) + R(big, 8));
};

console.log('');
console.log('=== DOES THE CROSSHAIR JUMP? =====================================');
console.log('');
console.log('  The crosshair sits at the point the shots converge on, and the horn');
console.log('  is over a metre off the camera axis - so when the convergence RANGE');
console.log('  changes, the crosshair moves on screen.');
console.log('');
console.log('  ' + P('', 46) + R('worst jump', 11) + R('frames >2px', 8));

jumps('nothing on the field', () => M.place([]), 120);
jumps('one ghost walking in from 6m', (i) => {
  const z = 6 - i * 0.04;
  M.place(z > C._GCONTACT ? [[0, C._GY, z, 99, 99, 0, 0, 0, 0]] : []);
}, 120);
jumps('one ghost crossing the crosshair at 4m', (i) => {
  M.place([[-1.2 + i * 0.02, C._GY, 4, 99, 99, 0, 0, 0, 0]]);
}, 120);
jumps('two, one behind the other, both near the line', (i) => {
  M.place([[0.02 * Math.sin(i / 7), C._GY, 3, 99, 99, 0, 0, 0, 0],
           [0.02 * Math.cos(i / 5), C._GY, 9, 99, 99, 0, 0, 0, 0]]);
}, 120);
jumps('two side by side, drifting past each other', (i) => {
  M.place([[-0.5 + i * 0.008, C._GY, 5, 99, 99, 0, 0, 0, 0],
           [0.5 - i * 0.008, C._GY, 5.2, 99, 99, 0, 0, 0, 0]]);
}, 120);
console.log('');
console.log('  A jump over about 2px in one frame is a visible flick. The fallback');
console.log('  range is ' + C._CONV + 'm, so a ghost at 2m swaps the convergence point');
console.log('  seven metres closer in a single frame.');
