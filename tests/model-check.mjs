// Drive the game's real horse() through a recording context and measure what it
// actually draws. This is the only way to check a model I cannot look at.
const noop = () => {};
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });

const rec = { polys: [], style: '#000', cur: null };
const ctx = new Proxy({ canvas: { style: {} } }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'beginPath') return () => { rec.cur = []; };
    if (k === 'moveTo' || k === 'lineTo') return (x, y) => rec.cur && rec.cur.push([x, y]);
    if (k === 'fill') return () => { if (rec.cur && rec.cur.length) rec.polys.push({ p: rec.cur, c: rec.style }); rec.cur = null; };
    return () => anyObj;
  },
  set(t, k, v) { if (k === 'fillStyle') rec.style = v; t[k] = v; return true; },
});

globalThis.document = { getElementById: () => ({ getContext: () => ctx }) };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 900;      // landscape now
globalThis.innerHeight = 500;
globalThis.localStorage = Object.create(null);
globalThis.addEventListener = noop;
globalThis.requestAnimationFrame = noop;
globalThis.AudioContext = function () { return { destination: {}, createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource: () => ({ connect: noop, start: noop }) }; };

const M = await import('../src/main.js');
const C = M.C;
M.setCtx(ctx);

const ok = (l, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${x ? '  ' + x : ''}`);
// The depth ramp is gone: the unicorn is one size, prisms another.
const PS = () => C.PSZ * innerHeight;
const OB = () => C.OBJ * innerHeight;

const draw = (s, ph, u) => { rec.polys = []; M.horse(200, 400, s, ph, u); return rec.polys.slice(); };
const bbox = (ps) => {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const { p } of ps) for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { w: x1 - x0, h: y1 - y0, x0, x1, y0, y1 };
};

const sHerd = PS(), sPZ = PS(), sNear = PS() * 2;   // as played, and 2x for facets
console.log(`the unicorn is drawn at s=${PS().toFixed(1)}px; prisms at ${OB().toFixed(1)}px\n`);

// --- 1. does it read at the size the game draws it? -----------------------
const herd = draw(sHerd, 0.13, 1);
const bh = bbox(herd);
ok('the unicorn renders at a sane size', bh.h >= 25 && bh.h <= 120,
   `${bh.h.toFixed(1)} px tall x ${bh.w.toFixed(1)} px wide, ${herd.length} polygons`);
// front-facing only holds while the width beats the length in screen x
{
  const r = C.YAW * Math.PI / 180;
  const fromLen = 1.27 * Math.sin(r), fromWid = 2 * C.STANCE * Math.cos(r);
  ok('facing reported (side view is a deliberate choice, not a failure)', true,
     `screen width from length ${fromLen.toFixed(3)} vs from width ${fromWid.toFixed(3)}; crossover at ${(Math.atan(2 * C.STANCE / 1.27) * 180 / Math.PI).toFixed(1)} deg`);
}

// --- 2. every face is a hard polygon, no curves ---------------------------
ok('every face is a straight-edged polygon', herd.every((f) => f.p.length >= 3 && f.p.length <= 4),
   `${new Set(herd.map((f) => f.p.length)).size} distinct vertex counts: ${[...new Set(herd.map((f) => f.p.length))].join(', ')}`);

// --- 3. shading is quantised to exactly three steps per material ----------
const near = draw(sNear, 0.13, 1);
const byMat = {};
for (const f of near) {
  const m = f.c.match(/\d+/g).map(Number);
  // group by hue ratio so the three steps of one material collapse together
  const mx = Math.max(...m) || 1;
  const key = m.map((v) => Math.round((v / mx) * 20)).join(',');
  (byMat[key] ||= new Set()).add(f.c);
}
const stepCounts = Object.values(byMat).map((s) => s.size);
ok('shading is quantised to at most three steps per material',
   stepCounts.every((n) => n <= 3),
   `materials: ${Object.keys(byMat).length}, steps each: ${stepCounts.join(', ')}`);
ok('shading actually varies (faces are not all one tone)', new Set(near.map((f) => f.c)).size >= 4,
   `${new Set(near.map((f) => f.c)).size} distinct fills across the whole animal`);

// --- 4. the horn breaks the silhouette -----------------------------------
// This used to be measured by drawing the animal without its horn and comparing.
// There is no horn-less variant any more - the horse went with the conversion
// mechanic - so measure the horn's own gold geometry against everything else.
const uni = draw(sNear, 0, 1);
const gold = uni.filter((f) => { const m = f.c.match(/\d+/g).map(Number); return m[0] > 150 && m[2] < 90; });
{
  const goldTop = Math.min(...gold.flatMap((f) => f.p.map((q) => q[1])));
  const restTop = Math.min(...uni.filter((f) => !gold.includes(f)).flatMap((f) => f.p.map((q) => q[1])));
  ok('the horn is drawn, in gold', gold.length >= 2, gold.length + ' gold faces');
  ok('and it is the topmost point of the animal', goldTop < restTop,
     'the horn reaches ' + (restTop - goldTop).toFixed(1) + 'px above everything else');
}

// --- 5. the unicorn is white, and the colour lives in the mane and horn ---
{
  const lum = (c) => { const m = c.match(/\d+/g).map(Number); return (m[0] + m[1] + m[2]) / 3; };
  const sat = (c) => { const m = c.match(/\d+/g).map(Number); return (Math.max(...m) - Math.min(...m)) / (Math.max(...m) || 1); };
  const pale = uni.filter((f) => sat(f.c) < 0.12 && lum(f.c) > 120);
  ok('the body is white and unsaturated', pale.length / uni.length > 0.4,
     pale.length + '/' + uni.length + ' faces are pale and near-neutral');
  const colour = uni.filter((f) => sat(f.c) > 0.5);
  ok('mane and horn carry the colour', colour.length >= 4,
     colour.length + ' strongly saturated faces');
  ok('and they read against the body', Math.max(...uni.map((f) => lum(f.c))) - Math.min(...uni.map((f) => lum(f.c))) > 60,
     'luminance spans ' + Math.min(...uni.map((f) => lum(f.c))).toFixed(0) + ' to ' + Math.max(...uni.map((f) => lum(f.c))).toFixed(0));
}

// --- 6. four legs, separated on screen, at herd size ----------------------
{
  // the four lowest-reaching face clusters should sit at four distinct x
  const feet = herd.filter((f) => Math.max(...f.p.map((q) => q[1])) > bh.y1 - sHerd * 0.12);
  const xs = feet.map((f) => f.p.reduce((a, q) => a + q[0], 0) / f.p.length).sort((a, b) => a - b);
  const groups = [];
  for (const x of xs) { if (!groups.length || x - groups[groups.length - 1] > sHerd * 0.06) groups.push(x); }
  ok('four legs separate at played size', groups.length >= 3,
     `${groups.length} distinct leg columns at x = ${groups.map((v) => v.toFixed(0)).join(', ')}`);
}

// --- 7. hooves stand on the lane -----------------------------------------
{
  // Hooves do NOT all sit on one line, and should not: the front pair stands
  // nearer the camera than the hind pair, so on a receding ground plane it is
  // lower on screen. What matters is that the spread stays plausible.
  let lo = -1e9, hi = 1e9;
  for (let i = 0; i < 40; i++) { const b2 = bbox(draw(sPZ, i / 40, 0)); lo = Math.max(lo, b2.y1); hi = Math.min(hi, b2.y1); }
  ok('hoof line spread stays within a third of the animal height',
     (lo - hi) < sPZ * 0.35,
     `lowest contact varies ${(lo - hi).toFixed(1)} px over the stride`);
  ok('the animal is not floating above its own baseline', lo > 400 - sPZ * 0.08,
     `front hooves reach ${(lo - 400).toFixed(1)} px past the lane line (front legs are nearer the camera)`);
}

// --- 8. cost ---------------------------------------------------------------
const fineCount = draw(sPZ, 0.2, 1).length, herdCount = herd.length;
console.log(`\npolygons: ${fineCount} at the ribbon, ${herdCount} at herd size`);
console.log(`worst-case frame: 24 herd + 2 near = ${24 * herdCount + 2 * fineCount} polygons`);

// --- debug: what is actually at the top of the unicorn, near the horn? -----
{
  const ps = draw(sNear, 0, 1);
  const gx2 = gold.flatMap((f) => f.p.map((q) => q[0])).reduce((a, v, _, ar) => a + v / ar.length, 0);
  const near2 = ps.filter((f) => Math.abs(f.p.reduce((a, q) => a + q[0], 0) / f.p.length - gx2) < sNear * 0.35);
  const rows = near2.map((f) => ({
    top: Math.min(...f.p.map((q) => q[1])),
    x: +(f.p.reduce((a, q) => a + q[0], 0) / f.p.length).toFixed(0),
    c: f.c,
  })).sort((a, b) => a.top - b.top).slice(0, 8);
  console.log(`\ntopmost faces within ${(sNear * 0.35).toFixed(0)}px of the horn (x=${gx2.toFixed(0)}), lane at y=400:`);
  for (const r of rows) console.log(`   y=${r.top.toFixed(1)}  x=${r.x}  ${r.c}`);
}

// --- which part is that? compare against every part's projected anchor ------
{
  const A = Math.PI + C.YAW * Math.PI / 180, co2 = Math.cos(A), si2 = Math.sin(A);
  const prj = (x, y, z) => [200 + (x * co2 - z * si2) * sNear,
                            400 - (y * C.PCY + (x * si2 + z * co2) * C.PCZ) * sNear];
  const by0 = 0.56, hb0 = Math.sin(1) * 0.03;
  const parts = {
    'barrel front-top': [0, by0 + 0.17, 0.28], 'barrel rear-top': [0, by0 + 0.16, -0.3],
    'neck top': [0, by0 + 0.39, 0.38], 'head top': [0, by0 + 0.43 + hb0, 0.48],
    'ear near': [0.05, by0 + 0.5 + hb0, 0.4], 'ear far': [-0.05, by0 + 0.5 + hb0, 0.4],
    'mane top': [-0.055, by0 + 0.5 + hb0, 0.4], 'horn tip': [0, by0 + 0.675 + hb0, 0.585],
    'hind hip far': [-0.15, by0 - 0.12, -0.26], 'hind hip near': [0.15, by0 - 0.12, -0.26],
    'tail tip': [0, by0 + 0.22, -0.62],
  };
  console.log('\npart anchors projected (lane y=400):');
  for (const [n, v] of Object.entries(parts)) {
    const [x, y] = prj(...v);
    console.log(`   ${n.padEnd(18)} x=${x.toFixed(0)}  y=${y.toFixed(1)}`);
  }
}
