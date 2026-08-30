// How far does a run actually get?
//
// This DRIVES THE GAME rather than modelling it. The old version re-implemented
// the spawner, the roster and the cards in its own arithmetic, and then the real
// ones were tuned underneath it - so it kept answering confidently about numbers
// that had not existed for weeks. Nothing here knows a rule; it presses keys,
// points the camera and reads the same dbg() the tests read.
//
// Math.random is DESTRUCTURED at the top of main.js, so it has to be replaced
// before the import and cannot be swapped afterwards. The generator below closes
// over a mutable seed instead, which is what lets each run differ.
let seed = 1;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, {
  get: (t, k) => (k in t ? t[k] : () => anyObj), set: () => true,
});
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
let rafCb = null;
const L = Object.create(null);
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };

// A press builds an AudioContext, and there is not one here. Silence rather than
// a recorder: this probe is about survival, and the sound tests already cover the
// sound.
const noop = () => {};
const param = { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop,
                exponentialRampToValueAtTime: noop };
const node = { frequency: param, gain: param, pan: param, Q: param, type: '', buffer: null,
               connect: () => node, start: noop, stop: noop,
               threshold: param, knee: param, ratio: param, attack: param, release: param };
globalThis.AudioContext = function () {
  return {
    currentTime: 0, sampleRate: 44100, state: 'running', destination: node, resume: noop,
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createGain: () => node, createStereoPanner: () => node, createOscillator: () => node,
    createBufferSource: () => node, createBiquadFilter: () => node,
    createDynamicsCompressor: () => node,
  };
};

const M = await import('../src/main.js');
const C = M.C;

let clock = 0;
const tick = () => { clock += 1000 / 60; rafCb(clock); };
const key = (type, code) => (L[type] || []).forEach((f) => f({ type, code, preventDefault() {} }));

const NAMES = ['SHOT RATE', 'SHOT DAMAGE', 'RAINBOW RADIUS', 'RAINBOW COOLDOWN',
               'RAINBOW HOLD', 'EXTRA HEART', 'HEAL'];


// What twenty waves are worth. The ghost counts come from the real spawner - the
// budget is geometric and buys at random from what is unlocked, so they are not a
// formula anybody can write down.
const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);

M.restart(); M.setFire(0); M.look(0, 0);
const sent = [];
for (let w = 1; w <= 20; w++) {
  M.setWave(w);
  const b0 = M.anim().bonus;
  let i = 0;
  while (!M.anim().picking && i++ < 60 * 300) { M.place([]); tick(); }
  sent.push((M.anim().bonus - b0) / C._PTW);
  if (M.anim().picking) { key('keydown', 'Digit1'); key('keyup', 'Digit1'); }
}

const rate = (w) => 1 - 0.2 * (w - 1) / 19;      // 100% at wave 1 easing to 80% by 20

console.log('');
console.log('=== TWENTY WAVES, WHAT THEY ARE WORTH ============================');
console.log('');
console.log('  A wave cleared pays ' + C._PTW + ' a ghost it SENT; every kill pays 1 more.');
console.log('  So a wave killed clean is three points a ghost, and one let past is one.');
console.log('');
console.log('  ' + P('wave', 6) + R('ghosts', 8) + R('  |  ', 7) +
  R('PERFECT', 9) + R('running', 9) + R('  |  ', 7) +
  R('kills', 7) + R('rough', 8) + R('running', 9));
let pt = 0, rt = 0;
for (let w = 1; w <= 20; w++) {
  const n = sent[w - 1];
  const perfect = n * 3;
  const k = Math.round(n * rate(w));
  const rough = n * C._PTW + k;
  pt += perfect; rt += rough;
  console.log('  ' + P(w, 6) + R(n, 8) + R('  |  ', 7) +
    R(perfect, 9) + R(pt, 9) + R('  |  ', 7) +
    R(k + '/' + n, 7) + R(rough, 8) + R(rt, 9));
}
console.log('');
console.log('  perfect twenty waves        ' + pt);
console.log('  rough twenty waves          ' + rt + '   (' + (100 * rt / pt).toFixed(0) + '% of it)');
console.log('');
console.log('  The rough column kills every ghost on wave 1 and eases to four in five');
console.log('  by wave 20 - each one let past costs 2 of the 3 it was worth.');
