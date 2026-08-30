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


// The draw on its own, with no run around it. Measuring this through a played run
// was hopeless in one direction: a rainbow-only build dies by wave 5, so there
// was never a wave 10 to read a gap at, and the probe reported the ZERO it had
// initialised rather than saying it had no data.
//
// Here the levels are just set, the wave is set past every gate, and deal() is
// called a thousand times. That isolates the mechanism from survival entirely.
const P = (x, n) => String(x).padEnd(n);
const R = (x, n) => String(x).padStart(n);
const HORN = [0, 1], BIND = [2, 3, 4];

const sample = (hornLv, bindLv, adapt, n) => {
  C._ADAPT = adapt;
  M.restart();
  M.setWave(20);                                  // past every gate
  for (const i of HORN) M.setLv(i, hornLv);
  for (const i of BIND) M.setLv(i, bindLv);
  let horn = 0, bind = 0, other = 0;
  for (let k = 0; k < n; k++) {
    for (const i of M.dealNow()) {
      if (HORN.includes(i)) horn++;
      else if (BIND.includes(i)) bind++;
      else other++;
    }
  }
  const t = horn + bind + other;
  return { horn: 100 * horn / t, bind: 100 * bind / t, other: 100 * other / t };
};

console.log('');
console.log('=== WHAT THE DRAW OFFERS WHEN ONE SIDE IS AHEAD ==================');
console.log('');
console.log('  A thousand draws of three cards, at wave 20 so nothing is gated.');
console.log('  Left: the horn is four levels up on the rainbow. Right: the mirror.');
console.log('');
console.log('  ' + P('_ADAPT', 9) +
  R('horn ahead: horn', 19) + R('bind', 8) +
  R('   |   ', 9) + R('bind ahead: horn', 19) + R('bind', 8));
for (const a of [1, 2, 3, 4, 6, 9]) {
  const A = sample(5, 1, a, 400), B = sample(1, 3, a, 400);
  console.log('  ' + P(a, 9) +
    R(A.horn.toFixed(0) + '%', 19) + R(A.bind.toFixed(0) + '%', 8) +
    R('   |   ', 9) + R(B.horn.toFixed(0) + '%', 19) + R(B.bind.toFixed(0) + '%', 8));
}
C._ADAPT = 2;
console.log('');
console.log('  _ADAPT 1 is the weighting switched off, for reference. Symmetric');
console.log('  means the two halves of the table mirror each other.');
