// The environment and the HUD text: sky ramp, three mountain ranges, the
// parallax between them, and which text carries an outline.
const noop = () => {};
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const rec = { polys: [], rects: [], fills: [], strokes: [], cur: null, style: '#000', font: '', stops: [] };
const grad = { addColorStop: (o, c) => rec.stops.push({ o, c }) };
const ctx = new Proxy({ canvas: { style: {} } }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
    if (k === 'fillRect') return (x, y, w, h) => rec.rects.push({ x, y, w, h, c: rec.style });
    if (k === 'beginPath') return () => { rec.cur = []; };
    if (k === 'moveTo' || k === 'lineTo') return (x, y) => rec.cur && rec.cur.push([x, y]);
    if (k === 'fill') return () => { if (rec.cur && rec.cur.length) rec.polys.push({ p: rec.cur, c: rec.style }); rec.cur = null; };
    if (k === 'fillText') return (v, x, y) => rec.fills.push({ v, x, y, c: rec.style, font: rec.font });
    if (k === 'strokeText') return (v, x, y) => rec.strokes.push({ v, x, y, font: rec.font });
    return () => anyObj;
  },
  set(t, k, v) { if (k === 'fillStyle') rec.style = v; if (k === 'font') rec.font = v; t[k] = v; return true; },
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
const C = M.C, H = 500, W = 900;
const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : ''));
let t = 0;
const frame = (clear) => {
  rec.polys = []; rec.rects = []; rec.fills = []; rec.strokes = [];
  if (clear !== false) M.place([]);
  t += 1000 / 60; rafCb(t);
};
rafCb(0); frame();

const rgb = (c) => (c[0] === '#'
  ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  : (c.match(/\d+/g) || []).map(Number));
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const px = (f) => Number((/(\d+)px/.exec(f) || [0, 0])[1]);

// ---- 1. the sky ----------------------------------------------------------
{
  const st = rec.stops, top = rgb(st[0].c), bot = rgb(st[st.length - 1].c);
  const lum = (c) => (c[0] + c[1] + c[2]) / 3;
  const blue = (c) => c[2] > c[0] && c[2] > c[1];
  ok('the sky is a vertical ramp, blue throughout', st.length >= 2 && blue(top) && blue(bot),
     st.map((x) => x.c).join(' -> '));
  ok('light at the top, deeper at the bottom', lum(top) > lum(bot) + 40,
     'luminance ' + lum(top).toFixed(0) + ' down to ' + lum(bot).toFixed(0));
}

// ---- 2. three ranges: a ground line each, with peaks rising from it ------
const HAZEC = [178, 160, 150];
// Select peaks by the layer's own fill colour, not by geometry: the unicorn is
// drawn from triangles too, and some of them start at the same y as a ground
// line, which quietly contaminated the set.
const ranges = () => C.MT.map((m) => {
  const base = m[0] * H;
  const ground = rec.rects.find((r) => Math.abs(r.y - base) < 0.5 && r.w >= W - 0.5);
  return {
    base,
    ground,
    peaks: rec.polys.filter((q) => q.p.length === 3 && ground && q.c === ground.c),
  };
});
{
  const r = ranges();
  ok('each range sits on its own ground line', r.every((x) => x.ground),
     r.map((x) => 'y=' + x.base.toFixed(0)).join(', '));
  ok('and its peaks rise from exactly that line, not from random heights',
     r.every((x) => x.peaks.length >= 4 && x.peaks.every((q) =>
       Math.abs(q.p[2][1] - x.base) < 0.5 && q.p[1][1] < x.base)),
     r.map((x) => x.peaks.length + ' peaks').join(', '));
  ok('peaks vary in height rather than one shape repeated',
     r.every((x) => new Set(x.peaks.map((q) => q.p[1][1].toFixed(1))).size > x.peaks.length * 0.7),
     'layer 0 peak tops: ' + r[0].peaks.slice(0, 5).map((q) => q.p[1][1].toFixed(0)).join(', '));
  ok('neighbouring peaks overlap, so they read as a range not loose triangles',
     r.every((x) => {
       const sorted = x.peaks.map((q) => [q.p[0][0], q.p[2][0]]).sort((a, b) => a[0] - b[0]);
       return sorted.slice(1).every((s, i) => s[0] < sorted[i][1]);
     }), 'every peak base starts before the previous one ends');
  const cols = r.map((x) => rgb(x.ground.c));
  ok('all three are brownish', cols.every((c) => c[0] > c[2] + 20),
     cols.map((c) => 'rgb(' + c.join(',') + ')').join(' '));
  const toHaze = cols.map((c) => d3(c, HAZEC));
  ok('the back range is the most hazed, the front the least',
     toHaze[0] < toHaze[1] && toHaze[1] < toHaze[2],
     'distance from the haze colour: ' + toHaze.map((v) => v.toFixed(0)).join(' < '));
}

// ---- 3. lifted, and spaced apart vertically -----------------------------
{
  const bases = C.MT.map((m) => m[0] * H);
  const gaps = bases.slice(1).map((b, i) => b - bases[i]);
  const tops = C.MT.map((m) => (m[0] - m[1]) * H);
  console.log('  ground lines at y = ' + bases.map((v) => v.toFixed(0)).join(', ') +
              '   gaps ' + gaps.map((v) => v.toFixed(0) + 'px').join(', '));
  ok('the ranges are lifted clear of the bottom', bases[0] < H * 0.55,
     'the back range starts ' + (100 - 100 * bases[0] / H).toFixed(0) + '% up the screen');
  ok('and are spaced apart vertically', gaps.every((v) => v > H * 0.15),
     'smallest gap ' + Math.min.apply(null, gaps).toFixed(0) + 'px against ' + (H * 0.15).toFixed(0) + ' required');
  ok('sky still shows above the furthest peaks', tops[0] > 40,
     'sky visible down to y=' + tops[0].toFixed(0) + ', the top ' + (100 * tops[0] / H).toFixed(0) + '%');
}

// ---- 4. parallax --------------------------------------------------------
{
  const apexes = (i) => ranges()[i].peaks.map((q) => q.p[1]);
  let track = [0, 1, 2].map((i) => apexes(i).reduce((a, b) => (Math.abs(b[0] - W / 2) < Math.abs(a[0] - W / 2) ? b : a)));
  const start = track.map((v) => v[0]);
  for (let f = 0; f < 90; f++) {
    frame();
    track = track.map((ref, i) => {
      const c = apexes(i).filter((v) => Math.abs(v[0] - ref[0]) < 90 && Math.abs(v[1] - ref[1]) < 2);
      return c.length ? c.reduce((a, b) => (Math.abs(b[0] - ref[0]) < Math.abs(a[0] - ref[0]) ? b : a)) : ref;
    });
  }
  const moved = track.map((v, i) => start[i] - v[0]);
  console.log('  over 1.5s, tracked peaks moved left by ' + moved.map((v) => v.toFixed(0) + 'px').join(', '));
  ok('the back range is the slowest and the front the fastest',
     moved[0] < moved[1] && moved[1] < moved[2], moved.map((v) => v.toFixed(0)).join(' < '));
  const ratios = [moved[1] / moved[0], moved[2] / moved[1]];
  const want = [C.MT[1][3] / C.MT[0][3], C.MT[2][3] / C.MT[1][3]];
  ok('and each moves at the fraction it was given',
     ratios.every((v, i) => Math.abs(v - want[i]) / want[i] < 0.12),
     'ratios ' + ratios.map((v) => v.toFixed(2)).join(', ') + ' against ' + want.map((v) => v.toFixed(2)).join(', '));
}

// ---- 5. the bar and its label ------------------------------------------
{
  frame();
  const bar = rec.rects.filter((r) => r.y === 12 && r.h === 14 && r.c === '#000');
  ok('the energy bar is half the screen wide',
     bar.length === 1 && Math.abs(bar[0].w - (W - 24) / 2) < 0.5,
     bar[0] ? bar[0].w.toFixed(0) + 'px on a ' + W + 'px screen' : 'not found');
  const letters = rec.fills.filter((x) => x.v.length === 1).sort((a, b) => a.x - b.x);
  const time = rec.fills.find((x) => x.v.startsWith('TIME'));
  ok('the label reads RAINBOW ENERGY', letters.map((x) => x.v).join('') === 'RAINBOW ENERGY',
     JSON.stringify(letters.map((x) => x.v).join('')));
  ok('at the same size as the rest of the HUD', px(letters[0].font) === px(time.font),
     letters[0].font + ' against ' + time.font);
  const adv = letters[1].x - letters[0].x;
  ok('and still tracked wider than the glyphs', adv > px(letters[0].font) * 0.6 + 1,
     adv.toFixed(0) + 'px apart, glyph advance is about ' + (px(letters[0].font) * 0.6).toFixed(1) + 'px');
}

// ---- 6. outlines: on the HUD, off the game-over panel -------------------
{
  frame();
  const stroked = new Set(rec.strokes.map((x) => x.v));
  const hudText = rec.fills.filter((x) => x.v !== '?');
  ok('every HUD string is outlined', hudText.length > 0 && hudText.every((x) => stroked.has(x.v)),
     hudText.filter((x) => x.v.length > 1).map((x) => JSON.stringify(x.v)).join(' ') + ' + 14 label letters');

  const d = M.dbg();
  M.place([[d.px, d.py, 3, 0, 3, 0, 0, 0, 0]]);
  frame(false);
  const pop = rec.fills.find((x) => x.v === 'BAD LUCK');
  ok('the booster popup is outlined too', !!pop && rec.strokes.some((x) => x.v === 'BAD LUCK'),
     pop ? 'drawn in ' + pop.c + ', with an outline' : 'popup not drawn');

  L.keydown.forEach((f) => f({ key: 'arrowleft', preventDefault() {} }));
  let n = 0;
  while (!M.dbg().over && n < 4000) { frame(false); n++; }
  L.keyup.forEach((f) => f({ key: 'arrowleft', preventDefault() {} }));
  frame(false);
  const overText = rec.fills.filter((x) => x.v.startsWith('press any key') || x.v === 'NEW BEST' || /^\d\d:/.test(x.v));
  const overStroked = overText.filter((x) => rec.strokes.some((y) => y.v === x.v && Math.abs(y.y - x.y) < 0.5));
  ok('the game-over panel is left un-outlined', M.dbg().over && overText.length > 0 && overStroked.length === 0,
     overText.length + ' game-over lines drawn, ' + overStroked.length + ' stroked');
}
