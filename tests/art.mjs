// Measure the new block / gate / rainbow-sphere art by recording what the real
// renderer draws, then selecting only the ops that land on the object.
const noop = () => {};
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const rec = { rects: [], arcs: [], polys: [], texts: [], style: '#000', cur: null, alpha: 1 };
const ctx = new Proxy({ canvas: { style: {} } }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'fillRect') return (x, y, w, h) => rec.rects.push({ x, y, w, h, c: rec.style, a: rec.alpha });
    if (k === 'arc') return (x, y, r) => (rec.cur = { arc: { x, y, r } });
    if (k === 'beginPath') return () => { rec.cur = { p: [] }; };
    if (k === 'moveTo' || k === 'lineTo') return (x, y) => rec.cur && rec.cur.p && rec.cur.p.push([x, y]);
    if (k === 'fill') return () => {
      if (!rec.cur) return;
      if (rec.cur.arc) rec.arcs.push({ x: rec.cur.arc.x, y: rec.cur.arc.y, r: rec.cur.arc.r, c: rec.style, a: rec.alpha });
      else if (rec.cur.p && rec.cur.p.length) rec.polys.push({ p: rec.cur.p, c: rec.style, a: rec.alpha });
      rec.cur = null;
    };
    if (k === 'fillText') return (s) => rec.texts.push(s);
    return () => anyObj;
  },
  set(t, k, v) { if (k === 'fillStyle') rec.style = v; if (k === 'globalAlpha') rec.alpha = v; t[k] = v; return true; },
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
const fireKey = (k, d) => (L[d ? 'keydown' : 'keyup'] || []).forEach((f) => f({ key: k, preventDefault() {} }));
const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : ''));
let t = 0;
const shot = (ents) => {
  M.place(ents); rec.rects = []; rec.arcs = []; rec.polys = []; rec.texts = [];
  t += 1000 / 60; rafCb(t);
  return M.dbg().ents[0];            // where it actually was when it was drawn
};
const inBox = (o, x, y, w, h) =>
  o.x >= x - 2 && o.x + (o.w || 0) <= x + w + 2 && o.y >= y - 2 && o.y + (o.h || 0) <= y + h + 2;

// ---- 1. a spiked block ----------------------------------------------------
const BX = 620, BY = 250, BW = 60, BH = 44;
const blk = shot([[BX, BY, 4, 0, 1, BW, BH, 0, C.HP[1], 0]]);
const x0 = blk[0] - BW / 2, y0 = blk[1] - BH / 2, CX = blk[0], CY = blk[1];
const plates = rec.rects.filter((r) => inBox(r, x0, y0, BW, BH));
const nails = rec.arcs.filter((a) => a.x > x0 - 2 && a.x < x0 + BW + 2 && a.y > y0 - 2 && a.y < y0 + BH + 2);
const pl = Math.min(BW, BH) * 0.17;
ok('the block draws a body plus four frame plates', plates.length === 5,
   plates.length + ' rects: ' + plates.map((r) => r.w.toFixed(0) + 'x' + r.h.toFixed(0)).join(' '));
ok('nail heads sit on the frame, not the middle', nails.length >= 8 &&
   nails.every((a) => a.x < x0 + pl || a.x > x0 + BW - pl || a.y < y0 + pl || a.y > y0 + BH - pl),
   nails.length + ' nails, r=' + (nails[0] ? nails[0].r.toFixed(2) : '-') + 'px');

const quads = rec.polys.filter((q) => q.p.length === 4 &&
  q.p.every((v) => v[0] > x0 - 4 && v[0] < x0 + BW + 4 && v[1] > y0 - 4 && v[1] < y0 + BH + 4));
const diag = quads.map((q) => {
  const cx = q.p.reduce((a, v) => a + v[0], 0) / 4, cy = q.p.reduce((a, v) => a + v[1], 0) / 4;
  return { cx, cy, len: Math.hypot(q.p[1][0] - q.p[0][0], q.p[1][1] - q.p[0][1]) };
});
ok('two long plates cross at the centre of the block', diag.length === 2 &&
   diag.every((d) => Math.abs(d.cx - CX) < 2 && Math.abs(d.cy - CY) < 2 && d.len > Math.min(BW, BH) * 0.9),
   diag.length + ' plates, lengths ' + diag.map((d) => d.len.toFixed(0)).join(' and '));

// Confine to the block's own neighbourhood. The mountain ranges are triangles
// too, and picking every 3-vertex polygon on screen pulled 300px-wide peaks in
// as if they were teeth.
const tris = rec.polys.filter((q) => q.p.length === 3 &&
  q.p.every((v) => v[0] > x0 - BW && v[0] < x0 + BW * 2 && v[1] > y0 - BH && v[1] < y0 + BH * 2));
const side = (q) => {
  const tip = q.p[1];
  if (tip[1] < y0) return 'top';
  if (tip[1] > y0 + BH) return 'bottom';
  if (tip[0] < x0) return 'left';
  if (tip[0] > x0 + BW) return 'right';
  return '?';
};
const g2 = {};
for (const q of tris) (g2[side(q)] || (g2[side(q)] = [])).push(q);
const proud = (q) => {
  const s = side(q), tip = q.p[1];
  return s === 'top' ? y0 - tip[1] : s === 'bottom' ? tip[1] - (y0 + BH) : s === 'left' ? x0 - tip[0] : tip[0] - (x0 + BW);
};
const EDGES = ['top', 'right', 'bottom', 'left'];
const sizes = {};
for (const k of EDGES) sizes[k] = (g2[k] || []).map(proud);
const allProud = EDGES.flatMap((k) => sizes[k]);
ok('all four edges grow teeth', EDGES.every((k) => (g2[k] || []).length >= 2),
   EDGES.map((k) => k + ':' + sizes[k].length).join(' '));
ok('the top teeth stand exactly as proud as the other three sides',
   allProud.length > 0 && Math.max.apply(null, allProud) - Math.min.apply(null, allProud) < 0.01,
   'every tooth stands ' + (allProud.length ? allProud[0].toFixed(2) : '-') + 'px proud');
const wid = (k) => (g2[k] || []).map((q) => Math.hypot(q.p[2][0] - q.p[0][0], q.p[2][1] - q.p[0][1]));
const tw = EDGES.map((k) => wid(k)[0] || 0);
ok('and the same width rule applies to every edge',
   Math.max.apply(null, tw) / Math.min.apply(null, tw) < 1.25,
   'tooth widths t/r/b/l = ' + tw.map((v) => v.toFixed(1)).join(' / '));
ok('top and bottom rows have equal tooth counts', g2.top.length === g2.bottom.length,
   g2.top.length + ' vs ' + g2.bottom.length);

// ---- 2. the gate ----------------------------------------------------------
const GW = C.GATEW * H;
const gt = shot([[BX, H / 2, 5, 0, 260, GW, H * 2, 0, 0, 0]]);
const gx = gt[0] - GW / 2;
const col = rec.rects.filter((r) => r.x >= gx - 2 && r.x + r.w <= gx + GW + 2);
const lum = (c) => { const m = c.match(/\d+/g).map(Number); return (m[0] + m[1] + m[2]) / 3; };
const green = col.filter((r) => { const m = r.c.match(/\d+/g).map(Number); return m[1] > m[0] && m[1] > m[2]; });
const band = col.filter((r) => Math.abs(r.h - (C.GATESQ * H) / 6 - 1) < 0.6);
ok('the gate is built from stacked plated segments, not one slab', col.length >= 15,
   col.length + ' rects down the column');
ok('the gate is dark green', green.length > col.length * 0.5 &&
   green.every((r) => lum(r.c) < 130),
   green.length + '/' + col.length + ' green rects, brightest ' +
   Math.max.apply(null, green.map((r) => lum(r.c))).toFixed(0) + '/255');
ok('the rainbow panel is six bands the full width of the column',
   band.length === 6 && band.every((r) => Math.abs(r.w - GW) < 0.6),
   band.length + ' bands, ' + (band[0] ? band[0].w.toFixed(1) : '-') + 'px wide on a ' + GW.toFixed(1) + 'px column');
const segs = col.filter((r) => r.w >= GW - 0.6 && r.h < H * 0.5).map((r) => r.h);
ok('and the gate keeps block proportions rather than one stretched plate',
   Math.max.apply(null, segs) < GW * 2.2,
   'tallest full-width plate is ' + Math.max.apply(null, segs).toFixed(0) + 'px on a ' + GW.toFixed(0) + 'px column');
const gn = rec.arcs.filter((a) => a.x > gx - 2 && a.x < gx + GW + 2);
ok('gate nails are drawn too', gn.length > 10, gn.length + ' nails');
// The column must be unbroken behind the panel: skipping the segments the panel
// overlapped left a visible hole taller than the panel itself.
{
  const body = col.filter((r) => Math.abs(r.w - GW) < 0.6 && r.h > 20)
                  .map((r) => [r.y, r.y + r.h]).sort((a, b) => a[0] - b[0]);
  let reach = body.length ? body[0][0] : 1e9, hole = 0;
  for (const [a, b] of body) { if (a > reach + 0.5) hole = Math.max(hole, a - reach); reach = Math.max(reach, b); }
  ok('the column is unbroken behind the rainbow panel', hole < 1 && reach >= H - 1,
     'largest gap ' + hole.toFixed(1) + 'px, plates run y=' + (body[0] ? body[0][0].toFixed(0) : '-') + ' to ' + reach.toFixed(0));
}

// ---- 3. rainbow sphere vs mystery sphere ---------------------------------
const rs = shot([[BX, 200, 2, 0, 0, 0, 0, 0, 0, 0]]);
const rb = rec.arcs.filter((a) => Math.abs(a.x - rs[0]) < 40 && Math.abs(a.y - 200) < 40);
const ms = shot([[BX, 200, 3, 0, 0, 0, 0, 0, 0, 0]]);
const my = rec.arcs.filter((a) => Math.abs(a.x - ms[0]) < 40 && Math.abs(a.y - 200) < 40);
const myQ = rec.texts.indexOf('?') >= 0;
ok('the rainbow sphere draws concentric rainbow rings',
   rb.length === 6 && new Set(rb.map((a) => a.c)).size === 6,
   rb.length + ' rings, ' + new Set(rb.map((a) => a.c)).size + ' distinct colours, radii ' +
   rb.map((a) => a.r.toFixed(1)).join(' > '));
ok('it is not the dark question-marked orb any more',
   !rb.some((a) => a.c === '#0d1b3a') && rb.length > 0,
   'fills: ' + Array.from(new Set(rb.map((a) => a.c))).slice(0, 3).join(' '));
ok('the mystery sphere still reads as the dark "?" orb',
   my.some((a) => a.c === '#0d1b3a') && myQ, 'question mark drawn: ' + myQ);
const rmax = Math.max.apply(null, rb.map((a) => a.r)), mmax = Math.max.apply(null, my.map((a) => a.r));
// Matched sizes are deliberate: the two pickups are told apart by colour alone,
// rainbow rings against a dark question-marked orb.
ok('the two spheres are the same size, and differ by colour alone', Math.abs(rmax - mmax) < 0.2,
   'rainbow ' + rmax.toFixed(1) + 'px vs mystery ' + mmax.toFixed(1) + 'px radius');

// PR is in OBJECT-size units, not screen height. Scaling it by H printed 51.5px
// for something that draws at 11.3px.
console.log('\nprism half-width is ' + (C.PR * C.OBJ * H).toFixed(1) + 'px');

// ---- 4. the hit flash: a steady 2Hz beat, not a damage blip --------------
{
  // Park a block dead ahead of the beam and hold the trigger, then watch the
  // white overlay that covers the whole block.
  const d0 = M.dbg();
  const BW2 = 70, BH2 = 70;
  const line = d0.py + C.BEAMY * H;
  const place = () => M.place([[M.dbg().px + 320, line, 4, 0, 1, BW2, BH2, 0, 99]]);  // spiked
  place();
  fireKey(' ', true);
  const alphas = [];
  for (let i = 0; i < 150; i++) {                 // 2.5s
    place();                                      // keep it there and keep it alive
    rec.rects = [];
    t += 1000 / 60; rafCb(t);
    const o = M.dbg().ents.find((e) => e[2] === 4);
    if (!o) { alphas.push(0); continue; }
    const white = rec.rects.filter((r) => r.c === '#fff' && Math.abs(r.w - BW2) < 1 && Math.abs(r.h - BH2) < 1);
    alphas.push(white.length ? white[0].a : 0);
  }
  fireKey(' ', false);
  const lit = alphas.filter((a) => a > 0).length;
  ok('the ray makes the block it is on flash', lit > alphas.length * 0.8,
     lit + ' of ' + alphas.length + ' frames carry a white overlay');
  // count sawtooth resets: alpha jumps up instead of falling
  let peaks = 0;
  for (let i = 1; i < alphas.length; i++) if (alphas[i] > alphas[i - 1] + 0.2) peaks++;
  const hz = peaks / (alphas.length / 60);
  ok('and it flashes at the configured rate, not the damage rate',
     Math.abs(hz - C.FLASHHZ) < 0.5,
     hz.toFixed(2) + ' flashes a second (FLASHHZ is ' + C.FLASHHZ + ', damage lands every ' + C.HITT + 's)');
  ok('peak brightness matches FLASHA', Math.abs(Math.max.apply(null, alphas) - C.FLASHA) < 0.06,
     'peak alpha ' + Math.max.apply(null, alphas).toFixed(2) + ' against ' + C.FLASHA);
}

// ---- 5. a struck gate flashes and fades as one piece --------------------
{
  const FADE = 0.4;
  M.place([[400, H / 2, 5, 0, 250, C.GATEW * H, H * 2, FADE, 0]]);   // fade set = struck
  rec.rects = []; rec.polys = [];
  t += 1000 / 60; rafCb(t);
  const g2 = M.dbg().ents.find((e) => e[2] === 5);
  const gw = C.GATEW * H, gx = g2[0] - gw / 2;
  const col = rec.rects.filter((r) => r.x >= gx - 2 && r.x + r.w <= gx + gw + 2);
  const white = col.filter((r) => r.c === '#fff');
  const body = col.filter((r) => r.c !== '#fff' && Math.abs(r.w - gw) < 0.6 && r.h > 20);
  ok('a gate struck at its rainbow panel flashes like a block', g2 && white.length > 0,
     white.length + ' white overlays down the column, alpha ' + (white[0] ? white[0].a.toFixed(2) : '-'));
  // The whole column must fade together. plated() used to reset globalAlpha to 1
  // after its flash, so only the topmost segment kept the gate's fade and every
  // segment below it stayed fully opaque.
  const alphas = body.map((r) => r.a);
  const want = g2[7] / C.GFADE;
  ok('every segment of the column carries the same fade',
     alphas.length > 3 && Math.max.apply(null, alphas) - Math.min.apply(null, alphas) < 1e-9,
     alphas.length + ' segments at alpha ' + alphas.map((v) => v.toFixed(2)).join('/'));
  ok('and that fade is the one the gate set', Math.abs(alphas[0] - want) < 1e-6,
     alphas[0].toFixed(3) + ' against o[7]/GFADE = ' + want.toFixed(3));
  ok('the flash fades out with the gate rather than staying bright',
     white.every((r) => r.a < want + 1e-9),
     'brightest flash ' + Math.max.apply(null, white.map((r) => r.a)).toFixed(2) +
     ', capped by the fade at ' + want.toFixed(2));
  // an unstruck gate is fully opaque
  M.place([[400, H / 2, 5, 0, 250, C.GATEW * H, H * 2, 0, 0]]);
  rec.rects = [];
  t += 1000 / 60; rafCb(t);
  const g3 = M.dbg().ents.find((e) => e[2] === 5);
  const solid = rec.rects.filter((r) => r.x >= g3[0] - gw / 2 - 2 && r.x + r.w <= g3[0] + gw / 2 + 2 &&
    Math.abs(r.w - gw) < 0.6 && r.h > 20);
  ok('an unstruck gate is fully opaque and unflashed',
     solid.length > 3 && solid.every((r) => r.a === 1) && !rec.rects.some((r) => r.c === '#fff' && r.x >= g3[0] - gw / 2 - 2 && r.x + r.w <= g3[0] + gw / 2 + 2),
     solid.length + ' segments, all at alpha 1, no white overlay');
}

// ---- 6. the flash covers the spikes, not just the body ------------------
{
  const BX3 = 620, BY3 = 250, W3 = 70, H3 = 70;
  const d = M.dbg();
  const ln = d.py + C.BEAMY * H;
  let found = null;
  for (let i = 0; i < 120 && !found; i++) {
    M.place([[M.dbg().px + 320, ln, 4, 0, 1, W3, H3, 0, 99]]);   // spiked, effectively immortal
    fireKey(' ', true);
    rec.rects = []; rec.polys = [];
    t += 1000 / 60; rafCb(t);
    const body = rec.rects.filter((r) => r.c === '#fff' && Math.abs(r.w - W3) < 1 && r.a > 0.3);
    if (body.length) found = { body: body[0], polys: rec.polys.slice() };
  }
  fireKey(' ', false);
  if (!found) ok('the flash covers the spikes as well as the body', false, 'never caught a lit frame');
  else {
    const bx = found.body.x, by = found.body.y;
    const whiteTeeth = found.polys.filter((q) => q.p.length === 3 && q.c === '#fff' && q.a > 0.3);
    // a tooth counts as covered only if its tip is OUTSIDE the body box
    const outside = whiteTeeth.filter((q) => {
      const [tx, ty] = q.p[1];
      return tx < bx - 0.5 || tx > bx + W3 + 0.5 || ty < by - 0.5 || ty > by + H3 + 0.5;
    });
    const sides = new Set(outside.map((q) => {
      const [tx, ty] = q.p[1];
      return ty < by ? 'top' : ty > by + H3 ? 'bottom' : tx < bx ? 'left' : 'right';
    }));
    ok('the flash covers the spikes as well as the body', sides.size === 4,
       outside.length + ' white teeth stand proud of the body, on ' + sides.size + ' sides: ' + [...sides].join(' '));
    ok('and the teeth flash at the same alpha as the body',
       outside.every((q) => Math.abs(q.a - found.body.a) < 1e-9),
       'teeth alpha ' + (outside[0] ? outside[0].a.toFixed(2) : '-') + ' vs body ' + found.body.a.toFixed(2));
  }
}

// ---- 7. an empty bar silences the ray cleanly ---------------------------
{
  M.place([]);
  fireKey(' ', true);
  let n = 0;
  while (M.dbg().energy > 0.001 && n < 4000) { M.place([]); t += 1000 / 60; rafCb(t); n++; }
  ok('the bar can actually be run dry', M.dbg().energy <= 0.001, 'took ' + (n / 60).toFixed(1) + 's of held trigger');
  // Watch for longer than the lockout: RELOAD bars at RGEN a second is how long
  // the silence should last, so the window has to clear it or the test measures
  // its own impatience.
  const span = Math.ceil((C.RELOAD / C.RGEN + 4) * 60);
  let lit = 0, flips = 0, silent = 0, prev = M.dbg().SEG.length > 0 ? 1 : 0;
  let backAt = -1, run = 0;
  const runs = [];
  for (let i = 0; i < span; i++) {
    M.place([]);
    t += 1000 / 60; rafCb(t);
    const on = M.dbg().SEG.length > 0 ? 1 : 0;
    if (on !== prev) { flips++; runs.push(run); run = 0; }
    run++;
    if (on && backAt < 0) backAt = i;
    if (!on && backAt < 0) silent++;
    prev = on; lit += on;
  }
  fireKey(' ', false);
  // Drop the first and last runs: both are truncated by the window's edges, and a
  // half-counted tail looks exactly like a strobe.
  runs.shift();
  // Counting transitions is the wrong measure: over 10s the honest behaviour is
  // silence, a burst, silence again - several transitions, none of them a strobe.
  // What must never happen is a SHORT run. It used to be one frame long.
  const complete = runs.filter((r) => r > 0);
  const shortest = complete.length ? Math.min.apply(null, complete) : 1e9;
  ok('an empty bar silences the ray instead of strobing it', shortest >= 12,
     'shortest unbroken on-or-off stretch is ' + (shortest / 60).toFixed(2) + 's across ' +
     (span / 60).toFixed(1) + 's of holding an empty trigger, over ' + flips + ' changes (it was 1 frame, 30 a second)');
  ok('and it comes back on its own once RELOAD has recharged', lit > 0,
     'silent for ' + (silent / 60).toFixed(1) + 's, then fired again - RELOAD is ' + C.RELOAD +
     ' bars at ' + C.RGEN + '/s, so ' + (C.RELOAD / C.RGEN).toFixed(1) + 's was expected');
}
