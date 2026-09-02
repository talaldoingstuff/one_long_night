// The desktop-only gate, which needs a file of its own.
//
// `coarse` is read ONCE at import time - it is a property of the device and
// asking every frame would be a media query sixty times a second for an answer
// that cannot change. So a check that wants the coarse branch has to have
// matchMedia answering before main.js is imported, and tests/loop.mjs has already
// imported it. Hence a separate process.
let seed = 1;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// THE STUB THIS FILE EXISTS FOR. Answers coarse to (pointer:coarse) and fine to
// anything else, which is what a phone reports.
globalThis.matchMedia = (q) => ({ matches: /coarse/.test(q) });

const rec = { ops: [], style: '#000', font: '' };
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const canvas = { style: {}, width: 0, height: 0 };
const ctx = new Proxy({ canvas }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'fillRect') return (x, y, w, h) =>
      rec.ops.push({ op: 'rect', x, y, w, h, c: rec.style });
    if (k === 'fillText') return (s, x, y) =>
      rec.ops.push({ op: 'text', s, x, y, c: rec.style, f: parseFloat(rec.font) });
    return () => anyObj;
  },
  set(t, k, v) {
    if (k === 'fillStyle') rec.style = v;
    if (k === 'font') rec.font = v;
    return true;
  },
});
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 420; globalThis.innerHeight = 900;      // a phone, upright
let rafCb = null;
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
const noop = () => {};
const param = { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop,
                exponentialRampToValueAtTime: noop };
const node = { frequency: param, gain: param, pan: param, Q: param, type: '', buffer: null,
               connect: () => node, start: noop, stop: noop,
               threshold: param, knee: param, ratio: param, attack: param, release: param };
globalThis.AudioContext = function () {
  return { currentTime: 0, sampleRate: 44100, state: 'running', destination: node, resume: noop,
           createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
           createGain: () => node, createStereoPanner: () => node, createOscillator: () => node,
           createBufferSource: () => node, createBiquadFilter: () => node,
           createDynamicsCompressor: () => node };
};
globalThis.localStorage = { getItem: () => null, setItem: noop };

const M = await import('../src/main.js');
const C = M.C;

let failed = 0;
const ok = (l, c, x) => { if (!c) failed++;
  console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : '')); };
process.on('exit', () => failed && process.exitCode === undefined && (process.exitCode = 1));

console.log('');
console.log('--- the desktop-only gate ------------------------------------------');

let t = 0;
const tick = (n = 1) => { for (let i = 0; i < n; i++) { rec.ops = []; t += 1000 / 60; rafCb(t); } };
tick();
const txt = () => rec.ops.filter((o) => o.op === 'text').map((o) => o.s);

const P = C._GATE.split('|');
ok('a coarse pointer gets the gate instead of the game',
   P.every((line) => txt().includes(line)),
   '"' + txt().join('" / "') + '"');

// The point of a gate is that nothing behind it runs. THREAT LEVEL and the wave
// number are the first things a frame of the real game draws.
ok('and none of the game is drawn behind it',
   !txt().some((s) => /WAVE|THREAT|ANYWHERE|CENTURIES/i.test(s)),
   'no HUD, no title, no lore - the frame returns at the gate and nothing after ' +
   'it runs, so a phone cannot half-play this');

ok('and it is drawn over black rather than over the world',
   rec.ops.some((o) => o.op === 'rect' && o.c === '#000' && o.w >= 420),
   'the sky is not drawn at all: the gate is the whole frame');

// The heading has to survive a phone held upright, which is the one shape it is
// guaranteed to be read in. This is the mistake the title screen already made
// once - u comes off the NARROW side, and on a portrait window that is the width.
const head = rec.ops.find((o) => o.op === 'text' && o.s === P[0]);
const body = rec.ops.filter((o) => o.op === 'text' && o.s !== P[0]);
ok('and the heading is the largest thing on it',
   body.every((o) => o.f < head.f),
   'heading ' + head.f + 'px over body at ' + body.map((o) => o.f).join(', ') + 'px');

// 9.1x its own size is ONE LONG NIGHT measured in Palatino in headless Chrome;
// the gate's heading is shorter than that, so this is a safe over-estimate.
ok('and it fits across a 420px phone held upright',
   head.f * 9.1 < 420 * 0.92 && body.every((o) => o.f * 16.2 < 420 * 0.92),
   'heading ' + (100 * head.f * 9.1 / 420).toFixed(0) + '% of the width, longest ' +
   'body line under ' + (100 * Math.max(...body.map((o) => o.f)) * 16.2 / 420).toFixed(0) +
   '% - both capped against W, because on a portrait window the narrow side IS the width');

ok('and the words say which machine to use, not merely that this one is wrong',
   /computer|desktop/i.test(C._GATE) && /mouse/i.test(C._GATE),
   '"' + C._GATE.replace(/\|/g, ' / ') + '" - a dead end that does not say where ' +
   'to go is worse than no message');

console.log('');
console.log(failed ? '  ' + failed + ' problem(s)' : '  a finger gets a sign, not a broken game');
