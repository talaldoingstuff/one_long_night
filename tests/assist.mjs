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
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return (x0, y0, x1, y1) => {
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
const DEG = 180 / Math.PI;

M.restart(); M.look(0, 0); M.setFire(0);
const crossAt = () => M.aimPoint();

// The on-screen radius of a ghost of type k at range z, by drawing one and
// measuring the outline the game actually produces.
const radiusAt = (k, z) => {
  M.place([[0, C._GY, z, 99, 99, 0, 0, k, 0]]);
  rec.ops = []; tick();
  const b = rec.ops.filter((o) => o.op === 'fill' && o.comp === 'lighter' && o.n > 8)[0];
  if (!b) return null;
  const xs = b.p.map((q) => q[0]), ys = b.p.map((q) => q[1]);
  return (Math.max(...xs) - Math.min(...xs)) / 2;
};

console.log('');
console.log('=== WHAT THE ASSIST ACTUALLY REACHES =============================');
console.log('');
console.log('  ASSISTR ' + C._ASSISTR + ' radii pulls the camera; TGTR ' + C._TGTR +
            ' radii lights the ghost up.');
console.log('  Same ghost, same crosshair - two different circles.');
console.log('');
console.log('  ' + P('ghost', 10) + R('range', 7) + R('body r', 9) +
            R('assist zone', 14) + R('   ', 4) + R('highlight', 12) + R('   ', 4));
console.log('  ' + P('', 10) + R('', 7) + R('px', 9) + R('px', 8) + R('deg', 8) +
            R('px', 8) + R('deg', 8));
for (const [k, nm] of [[0, 'Drifter'], [2, 'Hulk'], [1, 'Darter']]) {
  for (const z of [3, 7, 12, 16]) {
    const r = radiusAt(k, z);
    if (r === null) continue;
    // px -> degrees: a point at depth z moves z*dth in camera x, times s*PX on screen
    const s = C._F / (C._F + z);
    const perDeg = z * s * (500 * C._ZOOM) / DEG;
    console.log('  ' + P(nm, 10) + R(z + 'm', 7) + R(r.toFixed(0), 9) +
      R((r * C._ASSISTR).toFixed(0), 8) + R((r * C._ASSISTR / perDeg).toFixed(1), 8) +
      R((r * C._TGTR).toFixed(0), 8) + R((r * C._TGTR / perDeg).toFixed(1), 8));
  }
}
console.log('');
console.log('  and how hard it pulls: ASSIST ' + C._ASSIST + ' closes that much of the');
console.log('  remaining gap a second, so half of it goes in ' +
            (Math.log(2) / C._ASSIST).toFixed(2) + 's and 95% in ' +
            (3 / C._ASSIST).toFixed(2) + 's. The pull is proportional to the gap, so');
console.log('  it is strongest at the edge of the zone and fades to nothing at the middle.');
