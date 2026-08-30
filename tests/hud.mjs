// The HUD: what it says, where it says it, and in what colour. Text is recorded
// with its position, fill and alpha so these are measurements, not eyeballing.
const noop = () => {};
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const rec = { texts: [], rects: [], style: '#000', alpha: 1, align: 'left', font: '' };
const ctx = new Proxy({ canvas: { style: {} } }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'fillText') return (s, x, y) => rec.texts.push({ s, x, y, c: rec.style, a: rec.alpha, align: rec.align, font: rec.font });
    if (k === 'fillRect') return (x, y, w, h) => rec.rects.push({ x, y, w, h, c: rec.style });
    return () => anyObj;
  },
  set(t, k, v) {
    if (k === 'fillStyle') rec.style = v;
    if (k === 'globalAlpha') rec.alpha = v;
    if (k === 'textAlign') rec.align = v;
    if (k === 'font') rec.font = v;
    t[k] = v; return true;
  },
});
let rafCb = null;
const L = Object.create(null);
globalThis.document = { getElementById: () => ({ getContext: () => ctx }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.localStorage = Object.create(null);
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
globalThis.AudioContext = function () { return { destination: {}, createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource: () => ({ connect: noop, start: noop }) }; };
const M = await import('../src/main.js');
const C = M.C, H = 500;
const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : ''));
let t = 0;
const frame = () => { rec.texts = []; rec.rects = []; t += 1000 / 60; rafCb(t); };
rafCb(0); frame();

// ---- 1. the charge readout is gone --------------------------------------
frame();
ok('the CHARGE counter is gone from under the timers',
   !rec.texts.some((x) => x.s.startsWith('CHARGE')),
   'lines drawn: ' + rec.texts.filter((x) => x.align !== 'center' && x.s.length > 2).map((x) => JSON.stringify(x.s)).join(' '));

// ---- 2. the bar is labelled, in rainbow, widely tracked ------------------
{
  const bar = rec.rects.filter((r) => r.y === 12 && r.h === 14);
  // Pinning the label to a hard-coded baseline broke the moment it was resized.
  const letters = rec.texts.filter((x) => x.s.length === 1 && x.s !== '?').sort((a, b) => a.x - b.x);
  const word = letters.map((x) => x.s).join('');
  ok('the bar is labelled RAINBOW ENERGY', word === 'RAINBOW ENERGY', JSON.stringify(word));
  ok('the label sits under the bar', bar.length > 0 && letters.length > 0 &&
     letters[0].y > bar[0].y + bar[0].h,
     'bar ends at y=' + (bar[0].y + bar[0].h) + ', label baseline y=' + letters[0].y);
  const cols = new Set(letters.map((x) => x.c));
  ok('the letters are rainbow, not one colour', cols.size === 6,
     cols.size + ' distinct fills: ' + [...cols].join(' '));
  const adv = letters.slice(1).map((x, i) => x.x - letters[i].x);
  const px = +(/(\d+)px/.exec(letters[0].font) || [0, 0])[1];
  ok('and they are tracked wider than the glyphs themselves',
     new Set(adv.map((v) => v.toFixed(2))).size === 1 && adv[0] > px * 0.6,
     adv[0].toFixed(0) + 'px apart on a ' + px + 'px monospace face (glyph advance is ~' + (px * 0.6).toFixed(1) + 'px)');
}

// ---- 3. a collected booster names itself and fades ----------------------
const NAMES = ['FULL CHARGE', 'SLOW TIME', 'PATH CLEARED', 'BAD LUCK'];
for (let b = 0; b < 4; b++) {
  const d = M.dbg();
  M.place([[d.px, d.py, 3, 0, b, 0, 0, 0, 0, 0]]);
  frame();
  const pop = rec.texts.filter((x) => x.align === 'center');
  if (!pop.length) { ok('booster ' + b + ' names itself', false, 'nothing popped'); continue; }
  const p0 = pop[0];
  ok('"' + NAMES[b] + '" pops up when that sphere is collected', p0.s === NAMES[b], JSON.stringify(p0.s));
  ok('  ...in ' + (b === 3 ? 'light red' : 'white'), p0.c === (b === 3 ? '#ff9a9a' : '#fff'), p0.c);
  // and it fades while rising
  // Run past the toast's whole life (MSGT) so "it goes away" is actually tested.
  const span = Math.ceil(C.MSGT * 60) + 15;
  let prevA = p0.a, prevY = p0.y, fades = true, rises = true, seen = 1;
  for (let i = 0; i < span; i++) {
    frame();
    const q = rec.texts.filter((x) => x.align === 'center')[0];
    if (!q) break;
    seen++;
    if (q.a > prevA + 1e-9) fades = false;
    if (q.y > prevY + 1e-9) rises = false;
    prevA = q.a; prevY = q.y;
  }
  ok('  ...then fades and rises away', fades && rises && prevA < p0.a && prevY < p0.y && seen <= span,
     'lasted ' + (seen / 60).toFixed(2) + 's of a ' + C.MSGT + 's window, rose ' +
     (p0.y - prevY).toFixed(0) + 'px of ' + C.MSGR + ', faded to alpha ' + prevA.toFixed(2) + ' before vanishing');
}
