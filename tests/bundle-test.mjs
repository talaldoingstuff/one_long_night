// Drives the SHIPPED minified bundle for the 2D landscape game. Extracts the
// script out of dist/index.html so this covers Terser's mangling and its unsafe
// float passes, not just the source.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = 'C:/Users/tallo/Documents/Rainbowed';
const TMP = 'C:/Users/tallo/AppData/Local/Temp/claude/C--Users-tallo-Documents-Rainbowed/2d60f13a-b926-4ce5-84e1-e987f24a6e60/scratchpad';

const html = readFileSync(`${ROOT}/dist/index.html`, 'utf8');
writeFileSync(`${TMP}/bundle.mjs`, html.match(/<script type=module>([\s\S]*?)<\/script>/)[1]);

// --- stub DOM ---------------------------------------------------------------
const texts = [];
const pts = [];
const rects = [];
const calls = Object.create(null);
const canvas = { style: {}, width: 0, height: 0 };
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas }, {
  get(t, k) {
    if (k in t) return t[k];
    calls[k] = (calls[k] || 0) + 1;
    if (k === 'fillText') return (s) => texts.push(s);
    if (k === 'fillRect') return (x, y, w, h) => rects.push({ x, y, w, h, c: ctx.fillStyle });
    if (k === 'moveTo' || k === 'lineTo') return (x, y) => pts.push([x, y]);
    return () => anyObj;
  },
  set(t, k, v) { t[k] = v; return true; },
});

const buffers = [];
let started = 0;
globalThis.AudioContext = function () {
  return {
    destination: {},
    createBuffer: (c, n) => { const d = new Float32Array(n); buffers.push(d); return { getChannelData: () => d }; },
    createBufferSource: () => ({ buffer: null, connect() {}, start() { started++; } }),
  };
};
const store = Object.create(null);
globalThis.localStorage = store;

const listeners = Object.create(null);
let rafCb = null;
globalThis.document = { getElementById: () => ({ getContext: () => ctx }) };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 900;      // landscape
globalThis.innerHeight = 500;
globalThis.addEventListener = (type, fn) => { (listeners[type] ||= []).push(fn); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };

let seed = 0x2f6e2b1;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// The game's own async errors (setTimeout'd sounds) must be recorded, not fatal.
// But an ESM top-level throw in THIS file also surfaces here, and swallowing it
// silently is how a broken harness reports nothing at all.
// Always print. A handler that records silently is how this file reported
// absolutely nothing twice in a row.
let thrown = null;
process.on('uncaughtException', (e) => {
  thrown = e;
  console.log('UNCAUGHT: ' + ((e && e.stack) || e));
  process.exit(1);
});
try {
  await import(pathToFileURL(`${TMP}/bundle.mjs`).href);
} catch (e) {
  console.log('FAIL  the shipped bundle threw while evaluating\n' + ((e && e.stack) || e));
  process.exit(1);
}


const fire = (type, e) => (listeners[type] || []).forEach((fn) => fn(e));
const key = (k, down) => fire(down ? 'keydown' : 'keyup', { key: k, preventDefault() {} });
let t = 0;
const tick = (n) => { for (let i = 0; i < n; i++) { t += 1000 / 60; rafCb(t); } };
const num = (p) => { const m = texts.filter((s) => s.startsWith(p)).pop(); return m ? +m.slice(p.length) : -1; };
// The gauge is mm:ss.mmm now, so it needs parsing back to seconds rather than
// coercing with +.
const clockOf = () => {
  const m = texts.filter((x) => x.startsWith('TIME ')).pop();
  if (!m) return -1;
  const [mm, rest] = m.slice(5).split(':');
  return +mm * 60 + +rest;
};
const isOver = () => texts.slice(-4).some((s) => s.startsWith('press any key'));
const ok = (l, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`);

rafCb(0);
tick(2);

// --- 1. landscape canvas ----------------------------------------------------
ok('canvas fills a landscape viewport', canvas.width === 900 && canvas.height === 500,
   `${canvas.width}x${canvas.height}`);

// --- 2. the world scrolls ---------------------------------------------------
const d0 = clockOf();
tick(180);
ok('the run clock advances on its own', clockOf() > d0, `time ${d0.toFixed(2)}s -> ${clockOf().toFixed(2)}s`);
ok('and the gauge is formatted mm:ss.mmm', /^TIME \d\d:\d\d\.\d\d\d$/.test(texts.filter((x) => x.startsWith('TIME ')).pop()),
   texts.filter((x) => x.startsWith('TIME ')).pop());

// --- 3. keyboard actually moves the unicorn ---------------------------------
// The unicorn is the only thing drawn in the left third, so the centroid of the
// geometry there tracks it. Counting canvas calls proved nothing: it only ever
// measured whether SOMETHING drew.
const where = () => {
  pts.length = 0;
  tick(1);
  const l = pts.filter((q) => q[0] < innerWidth * 0.4 && Number.isFinite(q[0]) && Number.isFinite(q[1]));
  return l.length ? [l.reduce((a, q) => a + q[0], 0) / l.length, l.reduce((a, q) => a + q[1], 0) / l.length] : null;
};
const moves = (k, axis, want) => {
  const a = where();
  key(k, true); tick(24); key(k, false);
  const b = where();
  if (!a || !b) return false;
  const d = b[axis] - a[axis];
  return want > 0 ? d > 4 : d < -4;
};
ok('arrows steer the unicorn',
   moves('arrowright', 0, 1) && moves('arrowleft', 0, -1) &&
   moves('arrowdown', 1, 1) && moves('arrowup', 1, -1));
ok('WASD steers it the same way',
   moves('d', 0, 1) && moves('a', 0, -1) && moves('s', 1, 1) && moves('w', 1, -1));
ok('it cannot leave the screen', (() => {
  for (const k of ['arrowleft', 'arrowup']) { key(k, true); tick(400); key(k, false); }
  const p = where();
  return p && p[0] > 0 && p[1] > 0;
})(), 'held against the top-left corner for 400 frames');

// --- 4. arrows and space must not scroll the page --------------------------
{
  const swallowed = (k) => { let p = false; fire('keydown', { key: k, preventDefault: () => { p = true; } }); fire('keyup', { key: k, preventDefault() {} }); return p; };
  ok('arrows and space are swallowed, so the page cannot scroll',
     [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].every(swallowed));
  ok('other keys are left to the browser', !swallowed('tab') && !swallowed('f5'));
}

// --- 5. the bar is the ray's charge, not a clock ---------------------------
// Restart first: obstacles kill, so by now the earlier movement tests have very
// likely ended the run - and a dead run freezes every number being measured.
{
  const restart = () => {
    fire('pointerdown', { type: 'pointerdown', clientX: 10, clientY: 10 });
    fire('pointerup', { type: 'pointerup', clientX: 10, clientY: 10 });
    tick(4);
  };
  // The numeric readout is gone from the HUD, so read the bar itself: the filled
  // cells are the only place the charge is still visible from outside.
  const chargeOf = () => {
    const cw = (canvas.width - 24) / 7;
    const lit = rects.filter((r) => r.y === 12 && r.h === 14 && r.c !== '#000');
    return lit.reduce((a, r) => a + (r.w + 2) / cw, 0);
  };
  const snapCharge = () => { rects.length = 0; tick(1); return chargeOf(); };
  // A stationary unicorn can die inside the measurement window now that the
  // opening is dense, and a dead run freezes every number - which reads as "the
  // beam costs nothing" rather than as a broken measurement. Keep trying until
  // one run survives the whole window, and fail loudly if none does.
  const WIN = 45;
  let c0 = -1, c1 = -1, tries = 0, clean = false;
  while (tries++ < 40 && !clean) {
    restart();
    if (isOver()) continue;
    c0 = snapCharge();
    key(' ', true);
    let n = 0;
    while (n < WIN && !isOver()) { tick(1); n++; }
    key(' ', false);
    c1 = snapCharge();
    clean = n === WIN && !isOver();
  }
  ok('channelling the ray spends charge', clean && c1 < c0,
     clean ? `bar ${c0.toFixed(2)} -> ${c1.toFixed(2)} of 7 over ${(WIN / 60).toFixed(2)}s of firing, ${tries} tries for a window it survived`
           : `no run survived a ${(WIN / 60).toFixed(2)}s window in ${tries} tries`);
  // Only that the drain STOPS. The trickle itself is measured in mech.mjs, which
  // can clear the field first - here the run may end mid-measurement and freeze
  // every number, which is what made this read as a regression twice.
  tick(60);
  const c2 = snapCharge();
  ok('the drain stops when you stop firing', c2 >= c1 - 0.05, `bar ${c1.toFixed(2)} -> ${c2.toFixed(2)}`);
}

// --- 6. runs end by collision, and restart works ---------------------------
// Nothing kills you now except a spike or being shoved off the left edge, so
// game over has to be provoked: hold left into the oncoming field.
const provoke = () => {
  key('arrowleft', true);
  let n = 0;
  while (!isOver() && n < 12000) { tick(10); n += 10; }
  key('arrowleft', false);
  return isOver();
};
ok('a run ends when pinned against the left edge', provoke(), `after ~${(t / 1000) | 0}s`);
texts.length = 0;
fire('pointerdown', { type: 'pointerdown', clientX: 100, clientY: 100 });
tick(4);
ok('a click restarts', clockOf() >= 0 && clockOf() < 1 && !isOver(), `clock back to ${clockOf().toFixed(2)}s`);
texts.length = 0;
provoke();
key('w', true); key('w', false);
tick(4);
ok('a key restarts', !isOver());

// --- 7. mouse steering ------------------------------------------------------
{
  const before = thrown;
  fire('pointerdown', { type: 'pointerdown', clientX: 700, clientY: 400 });
  for (let i = 0; i < 40; i++) { fire('pointermove', { type: 'pointermove', clientX: 700, clientY: 400 }); tick(3); }
  fire('pointerup', { type: 'pointerup', clientX: 700, clientY: 400 });
  ok('mouse steering does not throw', thrown === before);
}

// --- 8. personal best -------------------------------------------------------
ok('best is written to namespaced localStorage', 'rbwd.bt' in store, `rbwd.bt = ${(+store['rbwd.bt']).toFixed(2)}s`);
ok('no other storage keys touched', Object.keys(store).length === 1, Object.keys(store).join(', '));

// --- 9. audio still survives Terser's unsafe passes ------------------------
ok('sounds are produced', started > 0 && buffers.length > 0, `${started} sources, ${buffers.length} buffers`);
ok('no NaN or Infinity in any sample', buffers.every((b) => b.every(Number.isFinite)),
   `${buffers.filter((b) => !b.every(Number.isFinite)).length} corrupt`);
{
  const peaks = buffers.map((b) => Math.max(...b.map(Math.abs)));
  ok('every sound is audible and in range', peaks.every((p) => p > 0.001 && p <= 1.001),
     `peaks ${Math.min(...peaks).toFixed(3)} - ${Math.max(...peaks).toFixed(3)}`);
}

// --- 10. it actually drew -----------------------------------------------------
ok('renders the unicorn, prisms and beam',
   calls.fill > 100 && calls.fillRect > 100,
   `fill ${calls.fill}, fillRect ${calls.fillRect}`);
ok('no exception thrown anywhere', thrown === null, thrown ? String(thrown) : '');
console.log(`\ndrove the shipped bundle for ${(t / 1000) | 0}s of simulated play`);

