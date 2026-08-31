// The renderer's proof: projection, camera, primitives, culling, depth order,
// and that the shading is three discrete steps rather than a ramp.
//
// It owns its own geometry. Step 2's demonstration box was scene content, and
// scene content is exactly what changes every milestone - this suite went red the
// moment the box was replaced by a game, which told me nothing useful.
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const rec = { polys: [], cur: null, style: '#000', curved: 0 };
const canvas = { style: {}, width: 0, height: 0 };
const ctx = new Proxy({ canvas }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'beginPath') return () => { rec.cur = []; };
    if (k === 'lineTo' || k === 'moveTo') return (x, y) => rec.cur && rec.cur.push([x, y]);
    if (k === 'fill') return () => { if (rec.cur && rec.cur.length) rec.polys.push({ p: rec.cur, c: rec.style }); rec.cur = null; };
    if (k === 'arc' || k === 'arcTo' || k === 'ellipse' || k === 'quadraticCurveTo' || k === 'bezierCurveTo' || k === 'roundRect') return () => { rec.curved++; };
    return () => anyObj;
  },
  set(t, k, v) { if (k === 'fillStyle') rec.style = v; t[k] = v; return true; },
});
const L = Object.create(null);
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = () => {};

const M = await import('../src/main.js');
const C = M.C;
// Printing FAIL and exiting 0 means nothing downstream can tell. It counts.
let failed = 0;
const ok = (l, c, x) => { if (!c) failed++;
  console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : '')); };
process.on('exit', () => failed && process.exitCode === undefined && (process.exitCode = 1));
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const W = 900, H = 500, PX = C._ZOOM * H;
const BOXR = 0.55, BOXZ = 3.2, BOXC = [190, 196, 224];

console.log('--- projection ---------------------------------------------------');
{
  M.look(0, 0);
  const centre = M.proj(M.cam([0, 0, 5]));
  ok('a point dead ahead lands at the centre of the screen',
     near(centre[0], W / 2, 1e-9) && near(centre[1], H / 2, 1e-9),
     '(' + centre.map((v) => v.toFixed(1)).join(', ') + ') on a ' + W + 'x' + H + ' viewport');

  const rows = [0, C._F, 4 * C._F].map((z) => {
    const got = M.proj(M.cam([0.1, 0, z]));
    return { z, want: C._F / (C._F + z), gotS: (got[0] - W / 2) / (0.1 * PX) };
  });
  ok('the perspective divide is exactly s = F/(F+z)',
     rows.every((r) => near(r.gotS, r.want, 1e-9)),
     rows.map((r) => 'z=' + r.z.toFixed(1) + ' s=' + r.gotS.toFixed(4)).join('  '));
  ok('and things shrink with distance', rows[0].gotS > rows[1].gotS && rows[1].gotS > rows[2].gotS,
     rows.map((r) => r.gotS.toFixed(3)).join(' > '));

  const below = M.proj(M.cam([0, 0.5, 5]));
  ok('positive y is down the screen', below[1] > H / 2,
     'y=+0.5 projects to py=' + below[1].toFixed(0) + ', below the centre line at ' + H / 2);

  const frac = (h) => {
    globalThis.innerWidth = Math.round(h * 1.8); globalThis.innerHeight = h;
    L.resize.forEach((f) => f());
    const a = M.proj(M.cam([-BOXR, 0, BOXZ])), b = M.proj(M.cam([BOXR, 0, BOXZ]));
    return (b[0] - a[0]) / M.dbg().H;
  };
  const f1 = frac(500), f2 = frac(1080);
  ok('the framing is resolution independent', near(f1, f2, 1e-9),
     'a ' + (2 * BOXR) + 'm box spans ' + (100 * f1).toFixed(2) + '% of the height at 900x500 and ' +
     (100 * f2).toFixed(2) + '% at 1944x1080');
  globalThis.innerWidth = 900; globalThis.innerHeight = 500;
  L.resize.forEach((f) => f());
}

console.log('\n--- camera -------------------------------------------------------');
{
  const ahead = [0, 0, 5];
  M.look(0.2, 0);
  const right = M.proj(M.cam(ahead));
  M.look(-0.2, 0);
  const left = M.proj(M.cam(ahead));
  ok('turning right sends the world left', right[0] < W / 2 && left[0] > W / 2,
     'yaw +0.2 puts it at px=' + right[0].toFixed(0) + ', yaw -0.2 at px=' + left[0].toFixed(0));
  M.look(0, 0.2);
  const up = M.proj(M.cam(ahead));
  M.look(0, -0.2);
  const dn = M.proj(M.cam(ahead));
  ok('looking up sends the world down', up[1] > H / 2 && dn[1] < H / 2,
     'pitch +0.2 puts it at py=' + up[1].toFixed(0) + ', pitch -0.2 at py=' + dn[1].toFixed(0));
  M.look(0, 0);
  const d = M.cam([0, 0, 5]);
  ok('the camera never translates', near(d[0], 0) && near(d[1], 0) && near(d[2], 5),
     'a point 5m ahead is still 5m ahead in camera space');

  let worst = 0;
  for (const [y, p] of [[0, 0], [1.1, 0.3], [-2.4, -0.5], [3.9, 0.55]]) {
    M.look(y, p);
    for (const v of [[0.3, -0.2, 0.8], [0, 0, 1], [-1, 2, 5]]) {
      const b = M.cam(M.unCam(v));
      worst = Math.max(worst, Math.hypot(b[0] - v[0], b[1] - v[1], b[2] - v[2]));
    }
  }
  ok('unCam is the exact inverse of cam, at every angle', worst < 1e-12,
     'worst round-trip ' + worst.toExponential(1) + 'm - so a horn leaves the muzzle where it is drawn');
  M.look(0, 0);
}

console.log('\n--- primitives ---------------------------------------------------');
const outward = (fs, o) => fs.every((f) => {
  const k = f[0].length;
  const c = f[0].reduce((a, v) => [a[0] + v[0] / k, a[1] + v[1] / k, a[2] + v[2] / k], [0, 0, 0]);
  return (c[0] - o[0]) * f[1] + (c[1] - o[1]) * f[2] + (c[2] - o[2]) * f[3] > -1e-9;
});
{
  M.FACES.length = 0;
  const r = BOXR, o = [0, 0, BOXZ];
  M.box(M.frame(o, [r, 0, 0], [0, r, 0], [0, 0, r]), BOXC);
  const fs = M.FACES.slice();
  ok('a box is six quads', fs.length === 6 && fs.every((f) => f[0].length === 4), fs.length + ' faces');
  ok('every normal points out of the solid', outward(fs, o), 'checked against the box centre');
  ok('and every normal is unit length', fs.every((f) => near(Math.hypot(f[1], f[2], f[3]), 1, 1e-9)),
     'lengths ' + fs.map((f) => Math.hypot(f[1], f[2], f[3]).toFixed(3)).join(' '));
  M.FACES.length = 0;

  const oc = [0, 0, 4];
  M.cone(M.frame(oc, [0.3, 0, 0], [0, 0.5, 0], [0, 0, 0.3]), 8, [255, 200, 0]);
  const cs = M.FACES.slice();
  const tris = cs.filter((f) => f[0].length === 3);
  ok('a cone is n sides plus a base', cs.length === 9 && tris.length === 8,
     tris.length + ' triangles and a ' + cs.find((f) => f[0].length > 3)[0].length + '-gon base');
  ok('its apex sits at +1 along its own u axis',
     tris.every((f) => f[0].some((v) => near(v[1], oc[1] + 0.5, 1e-9))), 'every side triangle reaches it');
  ok('and its normals point outward from the same winding rule', outward(cs, oc),
     'no generator writes a normal by hand');
  M.FACES.length = 0;

  const a = 0.7, ca = Math.cos(a), sa = Math.sin(a), r2 = 0.5;
  M.box(M.frame([0, 0, 4], [ca * r2, sa * r2, 0], [-sa * r2, ca * r2, 0], [0, 0, r2]), BOXC);
  const ls = M.FACES.slice();
  ok('a leant frame gives square faces, not sheared ones',
     ls.every((f) => {
       const e = [f[0][1][0] - f[0][0][0], f[0][1][1] - f[0][0][1], f[0][1][2] - f[0][0][2]];
       return near(e[0] * f[1] + e[1] * f[2] + e[2] * f[3], 0, 1e-9);
     }), 'every normal is perpendicular to its own edge');
  ok('and the box keeps its size when leant',
     ls.every((f) => near(Math.hypot(f[0][1][0] - f[0][0][0], f[0][1][1] - f[0][0][1], f[0][1][2] - f[0][0][2]), 2 * r2, 1e-9)),
     'every edge is ' + (2 * r2).toFixed(3) + 'm, as built');
  M.FACES.length = 0;
}

console.log('\n--- culling, shading ---------------------------------------------');
{
  M.look(0, 0);
  let minF = 99, maxF = 0, straight = true;
  const fills = new Set(), verts = new Set();
  rec.curved = 0;
  // A full turn on two axes, so every face comes round to the light. Sampling a
  // short arc reported two shading steps instead of three the first time.
  for (let i = 0; i < 400; i++) {
    const a = i * 0.0314, b = i * 0.0157, r = BOXR;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    M.FACES.length = 0;
    M.box(M.frame([0, 0, BOXZ],
      [ca * r, 0, -sa * r],
      [sa * sb * r, cb * r, ca * sb * r],
      [sa * cb * r, -sb * r, ca * cb * r]), BOXC);
    rec.polys = [];
    const n = M.flush();
    minF = Math.min(minF, n); maxF = Math.max(maxF, n);
    for (const p of rec.polys) { fills.add(p.c); verts.add(p.p.length); if (p.p.length < 3) straight = false; }
  }
  ok('back faces are culled: never more than half a box is visible', maxF <= 3 && minF >= 1,
     'between ' + minF + ' and ' + maxF + ' of 6 faces over a full turn on both axes');
  ok('and it does reach three, so culling is not just dropping everything', maxF === 3,
     'peak ' + maxF + ' faces');
  ok('shading is quantised to exactly three steps', fills.size === 3, [...fills].join('  '));
  const lum = [...fills].map((c) => c.match(/\d+/g).map(Number).reduce((a, v) => a + v, 0) / 3).sort((a, b) => a - b);
  const want = C._STEP.map((k) => (BOXC[0] * k | 0) + (BOXC[1] * k | 0) + (BOXC[2] * k | 0)).map((v) => v / 3).sort((a, b) => a - b);
  ok('and the three steps are the ones STEP asks for',
     lum.length === 3 && lum.every((v, i) => near(v, want[i], 0.51)),
     'luminance ' + lum.map((v) => v.toFixed(0)).join(' / ') + ' against ' + want.map((v) => v.toFixed(0)).join(' / '));
  ok('every face is a hard-edged polygon', straight && rec.curved === 0,
     [...verts].join(',') + ' vertices per face, ' + rec.curved + ' curve calls');
}

console.log('\n--- depth order and the near plane -------------------------------');
{
  M.FACES.length = 0;
  M.look(0, 0);
  const r = 0.4;
  M.box(M.frame([0, 0, 6], [r, 0, 0], [0, r, 0], [0, 0, r]), [255, 0, 0]);
  M.box(M.frame([0, 0, 3], [r, 0, 0], [0, r, 0], [0, 0, r]), [0, 0, 255]);
  rec.polys = [];
  const n = M.flush();
  const order = rec.polys.map((p) => (p.c.startsWith('rgb(0,0') ? 'near' : 'far'));
  ok('the far solid is painted before the near one', n === 2 && order.join() === 'far,near',
     n + ' faces, drawn ' + order.join(' then '));

  M.FACES.length = 0;
  M.box(M.frame([0, 0, 0.01], [0.4, 0, 0], [0, 0.4, 0], [0, 0, 0.4]), BOXC);
  rec.polys = [];
  ok('geometry closer than NEAR is dropped, not drawn inside out', M.flush() === 0,
     'a box straddling the eye drew nothing');
}
