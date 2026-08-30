// Spawn-separation audit and economy measurement. Drives the real sim, inspects
// the live entity list every frame, and plays well enough to survive - a policy
// that never dodges dies in 4s and never reaches a gate, which made the first
// version of this file assert nothing at all.
const noop = () => {};
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: (t, k, v) => ((t[k] = v), true) });
let rafCb = null;
const L = Object.create(null);
globalThis.document = { getElementById: () => ({ getContext: () => ctx }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.localStorage = Object.create(null);
globalThis.addEventListener = (t, f) => { (L[t] ||= []).push(f); };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
globalThis.AudioContext = function () { return { destination: {}, createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource: () => ({ connect: noop, start: noop }) }; };
let seed = 0x5f3a91;
Math.random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const M = await import('../src/main.js');
const C = M.C, H = 500, W = 900;
const OS = C.OBJ * H;
const fireEv = (t, e) => (L[t] || []).forEach((f) => f(e));
const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : ''));
let t = 0;
const tick = () => { t += 1000 / 60; rafCb(t); };
rafCb(0); tick();

const hw = (o) => (o[2] === 4 || o[2] === 5 ? o[5] / 2 : o[2] === 1 ? OS * C.PR : OS * C.ORB);
const hh = (o) => (o[2] === 5 ? H : o[2] === 4 ? o[6] / 2 : o[2] === 1 ? OS * C.PR : OS * C.ORB);
const cy = (o) => (o[2] === 5 ? H / 2 : o[1]);
const NAME = { 1: 'prism', 2: 'rainbow', 3: 'mystery', 4: 'block', 5: 'gate' };

// --- a pilot good enough to stay alive ------------------------------------
const held = Object.create(null);
const hold = (k, on) => {
  if (!!held[k] === !!on) return;
  held[k] = on;
  fireEv(on ? 'keydown' : 'keyup', { key: k, preventDefault() {} });
};
const release = () => { for (const k of Object.keys(held)) hold(k, false); };
const BEAMY = () => C.BEAMY * H;
// threat: a solid whose box the unicorn is about to run into
const threat = (d) => d.ents.filter((o) => (o[2] === 4 || o[2] === 5) && !o[7] &&
  o[0] + hw(o) > d.px - 20 && o[0] - hw(o) < d.px + W * 0.45);
const pilot = (d, shoot) => {
  const th = threat(d);
  // vertical: run for whichever side of the nearest blocking box is closer
  const near = th.filter((o) => Math.abs(cy(o) - d.py) < hh(o) + 60)
                 .sort((a, b) => a[0] - b[0])[0];
  let up = false, down = false;
  if (near) {
    if (near[2] === 5) {                              // a gate: line up with the panel
      if (d.py > near[4] + 8) up = true; else if (d.py < near[4] - 8) down = true;
    } else {
      const top = cy(near) - hh(near), bot = cy(near) + hh(near);
      if (top - C.PAD * H > H - C.PAD * H - bot) up = true; else down = true;
    }
  }
  hold('arrowup', up); hold('arrowdown', down);
  hold('arrowright', !near && d.px < W * 0.3);
  hold('arrowleft', d.px > W * 0.42);
  // fire at whatever the beam line is pointed at
  const line = d.py + BEAMY();
  const inBeam = th.some((o) => o[0] > d.px &&
    (o[2] === 5 ? Math.abs(o[4] - line) < C.GATESQ * H : Math.abs(o[1] - line) < hh(o) + 24));
  hold(' ', shoot === undefined ? inBeam : (shoot === 'always' ? true : shoot === 'never' ? false : inBeam));
};
const restart = () => {
  release();
  for (let i = 0; i < 3; i++) {
    fireEv('keydown', { key: 'w', preventDefault() {} });
    fireEv('keyup', { key: 'w', preventDefault() {} });
    tick();
  }
};

// ---- phase 1: spawn separation, with gates forced to be common -----------
const SG = C.SP_GATE, SB = C.SP_BOOST, SBH = C.SP_BOOST_HI;
C.SP_GATE = 7; C.SP_BOOST = 6; C.SP_BOOST_HI = 6;   // so a short run still reaches them
let frames = 0, worst = { pen: -1e9 }, gateWorst = { gap: 1e9 }, deaths = 0, gateFrames = 0;
const seen = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const tag = new WeakMap();
let uid = 0;
restart();
while (frames < 60 * 900) {
  const d = M.dbg();
  if (d.over) { deaths++; restart(); frames++; continue; }
  pilot(d);
  tick(); frames++;
  const es = M.dbg().ents;
  for (const o of es) if (!tag.has(o)) { tag.set(o, ++uid); seen[o[2]]++; }
  if (es.some((o) => o[2] === 5)) gateFrames++;
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      if (!a[2] || !b[2] || a[7] || b[7]) continue;
      const pen = Math.min(hw(a) + hw(b) - Math.abs(a[0] - b[0]),
                           hh(a) + hh(b) - Math.abs(cy(a) - cy(b)));
      if (pen > worst.pen) worst = { pen, a: NAME[a[2]], b: NAME[b[2]] };
      if (a[2] === 5 || b[2] === 5) {
        const g = a[2] === 5 ? a : b, e = a[2] === 5 ? b : a;
        const gap = Math.abs(g[0] - e[0]) - hw(g) - hw(e);
        if (gap < gateWorst.gap) gateWorst = { gap, other: NAME[e[2]] };
      }
    }
  }
}
console.log(`drove ${(frames / 60).toFixed(0)}s, ${deaths} deaths, ${uid} objects, gates on screen for ${(100 * gateFrames / frames).toFixed(0)}% of it\n`);
{
  // Can the unicorn always get through? For every column of the field, find the
  // widest clear vertical slot and compare it with the unicorn's own height. A
  // block leaves a small gap on one side and a huge one on the other, so what
  // matters is the WIDEST slot, not the nearest edge.
  const PADp = C.PAD * H, need = 2 * C.PSZ * H * C.PH;
  const slot = (h) => {
    const hbMax = C.OBH2 * H * (1 + (C.OBSC - 1) * h) / 2;
    let worst = 1e9, at = 0;
    for (let cyB = PADp + C.OBJ * H; cyB <= H - PADp - C.OBJ * H; cyB += 1) {
      const best = Math.max((cyB - hbMax) - PADp, (H - PADp) - (cyB + hbMax));
      if (best < worst) { worst = best; at = cyB; }
    }
    return { worst, at, tall: hbMax * 2 };
  };
  const eS = slot(0), lS = slot(1);
  console.log(`  the unicorn is ${need.toFixed(0)}px tall; the worst single block leaves:`);
  console.log(`    early: a ${eS.tall.toFixed(0)}px block at y=${eS.at} still leaves ${eS.worst.toFixed(0)}px (${(eS.worst / need).toFixed(1)}x clearance)`);
  console.log(`    late : a ${lS.tall.toFixed(0)}px block at y=${lS.at} still leaves ${lS.worst.toFixed(0)}px (${(lS.worst / need).toFixed(1)}x clearance)`);
  ok('a single block can always be flown around, even at full size',
     lS.worst > need * 1.2, `${lS.worst.toFixed(0)}px of slot against a ${need.toFixed(0)}px unicorn`);
  // two blocks could only wall the screen off if they could sit at the same x
  const sepNeed = C.OBH2 * H * C.OBSC + C.SEP * H;
  const band = (H - 2 * PADp - 2 * C.OBJ * H);
  ok('and two full-size blocks can never share a column',
     sepNeed > band, `they would have to be ${sepNeed.toFixed(0)}px apart in a ${band.toFixed(0)}px band of spawn heights`);
}
console.log('spawned: ' + Object.entries(seen).map(([k, v]) => `${NAME[k]} ${v}`).join(', '));
ok('nothing ever overlaps anything else', worst.pen < 0,
   worst.pen < 0 ? `tightest pair was ${(-worst.pen).toFixed(0)}px clear (${worst.a}/${worst.b})`
                 : `${worst.a} overlaps ${worst.b} by ${worst.pen.toFixed(0)}px`);
ok('nothing ever spawns on a gate', seen[5] > 0 && gateWorst.gap > 0,
   `${seen[5]} gates seen; nearest neighbour was a ${gateWorst.other} at ${gateWorst.gap.toFixed(0)}px clear`);
ok('and a gate keeps its whole corridor', gateWorst.gap > C.GCLR * H * 0.8,
   `${gateWorst.gap.toFixed(0)}px against a ${(C.GCLR * H).toFixed(0)}px reserved corridor`);
C.SP_GATE = SG; C.SP_BOOST = SB; C.SP_BOOST_HI = SBH;

// ---- phase 2: the economy -------------------------------------------------
console.log('\n--- economy ---');
const sample = (mode, label) => {
  restart();
  let n = 0, fireN = 0, minE = 1e9, e0 = M.dbg().energy, dry = 0;
  while (n < 60 * 180) {
    const d = M.dbg();
    if (d.over) break;
    pilot(d, mode);
    if (held[' ']) fireN++;
    if (d.energy < 0.05) dry++;
    minE = Math.min(minE, d.energy);
    tick(); n++;
  }
  const d = M.dbg();
  release();
  console.log(`  ${label.padEnd(26)} lived ${(n / 60).toFixed(0)}s | trigger ${(100 * fireN / Math.max(1, n)).toFixed(0)}% | ` +
              `charge ${e0.toFixed(1)}->${d.energy.toFixed(1)} low ${minE.toFixed(1)} | empty ${(100 * dry / Math.max(1, n)).toFixed(0)}% of the time`);
  return { n, minE, dry: dry / Math.max(1, n) };
};
const A = sample('never', 'never fire');
const B = sample('always', 'hold the trigger down');
const D = sample(undefined, 'fire at what blocks you');

// The arithmetic summary lives in econ.mjs now. It used to be printed here in
// per-unit terms, which went silently wrong the moment the beam started being
// charged per second: a break-even of "324% of spheres" is two denominations
// divided by each other.
console.log('  (arithmetic summary: econ.mjs - the economy is per-second now)');
