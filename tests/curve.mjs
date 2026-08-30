// The progression, sampled off the real constants at real times.
const noop = () => {};
const anyObj = new Proxy({ width: 10, style: {} }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: (t, k, v) => ((t[k] = v), true) });
globalThis.document = { getElementById: () => ({ getContext: () => ctx, style: {} }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.localStorage = Object.create(null);
globalThis.addEventListener = noop;
globalThis.requestAnimationFrame = noop;
globalThis.AudioContext = function () { return { destination: {}, createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource: () => ({ connect: noop, start: noop }) }; };
const { C } = await import('../src/main.js');
const H = 500, W = 900;

const hard = (t) => Math.min(1, t / C.HARD_TO);
const lerp = (a, b, h) => a + (b - a) * h;

const at = (t) => {
  const h = hard(t);
  const raw = Math.min(C.CAP2, Math.min(C.CAP, 1 + C.STEP * t) + Math.max(0, t - C.HARD_TO) * C.ENDL);
  const ds = Math.min(1, C.CAP / raw);
  const ob = lerp(C.SP_OBST, C.SP_OBST_HI, h) * ds;
  const rb = C.SP_RB * ds;
  const sp = Math.min(1, lerp(C.SPIKE, C.SPIKE * 1.8, h));
  const sc = lerp(1, C.OBSC, h);
  const cross = C.VIEW / raw;
  const aw = (C.OBW + C.OBW2) / 2 * H * sc, ah = (C.OBH + C.OBH2) / 2 * H * sc;
  const clearS = (C.HP[0] * (1 - sp) + C.HP[1] * sp) * C.HITT;
  return {
    raw, ob, rb, sp, sc, cross,
    onScreen: cross / ob,
    cover: (cross / ob) * aw * ah / (W * H),
    duty: clearS / ob,
    income: C.RGEN + C.RBFILL / rb,
    gap: raw * (W / C.VIEW) * ob,        // pixels between consecutive blocks
  };
};

console.log('t        speed  window   block   spiked  size   on-scr  cover   duty   income  net    block gap');
for (const t of [0, 20, 40, 66, 90, 120, 159, 240, 400, 660, 900]) {
  const v = at(t);
  const forced = Math.min(1, v.duty) * C.BEAMC;
  console.log(
    (t + 's').padEnd(8) +
    v.raw.toFixed(2).padStart(5) + 'x' +
    (v.cross.toFixed(1) + 's').padStart(8) +
    (v.ob.toFixed(2) + 's').padStart(8) +
    (100 * v.sp).toFixed(0).padStart(7) + '%' +
    v.sc.toFixed(2).padStart(7) + 'x' +
    v.onScreen.toFixed(1).padStart(8) +
    (100 * v.cover).toFixed(1).padStart(7) + '%' +
    (100 * v.duty).toFixed(0).padStart(6) + '%' +
    v.income.toFixed(2).padStart(8) +
    (v.income - forced).toFixed(2).padStart(7) +
    (v.gap.toFixed(0) + 'px').padStart(11));
}

// Assertions, so this is a suite and not just a printout. Both of these were
// real defects: the field used to THIN over the first 66s while the speed rose,
// and every number froze at HARD_TO so a long run stopped being tested.
const ok = (l, c, x) => console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x ? '  ' + x : ''));
let coverDrop = -1, windowGrow = -1, prev = null;
for (let t = 0; t <= 1200; t += 1) {
  const v = at(t);
  if (prev) {
    if (v.cover < prev.cover - 1e-9 && coverDrop < 0) coverDrop = t;
    if (v.cross > prev.cross + 1e-9 && windowGrow < 0) windowGrow = t;
  }
  prev = v;
}
console.log('');
ok('the screen never empties as the run goes on', coverDrop < 0,
   coverDrop < 0 ? 'cover rises from ' + (100 * at(0).cover).toFixed(1) + '% to ' + (100 * at(1200).cover).toFixed(1) + '% without ever falling'
                 : 'first drop at ' + coverDrop + 's');
ok('and the reaction window only ever closes', windowGrow < 0,
   windowGrow < 0 ? at(0).cross.toFixed(1) + 's down to ' + at(1200).cross.toFixed(1) + 's'
                  : 'first widening at ' + windowGrow + 's');
const late = [at(159), at(300), at(600), at(1200)];
ok('difficulty keeps rising past the end of the ramp',
   late.every((v, i) => i === 0 || v.duty > late[i - 1].duty - 1e-9) && late[3].duty > late[0].duty * 1.3,
   'forced duty ' + late.map((v) => (100 * v.duty).toFixed(0) + '%').join(' -> '));
const end = at(1e5);
ok('but income never catches the beam, so the bar keeps constraining',
   end.income < C.BEAMC * 0.85,
   'income tops out at ' + end.income.toFixed(2) + ' bars/s against ' + C.BEAMC + '/s of beam');
ok('the field keeps its spacing in SPACE past the cap',
   Math.abs(at(240).gap - at(900).gap) < 1,
   at(240).gap.toFixed(0) + 'px between blocks at 4 minutes, ' + at(900).gap.toFixed(0) + 'px at 15');
ok('speed stops before it would empty the screen', C.CAP2 < 2.6,
   'tops out at ' + C.CAP2 + 'x, reached at ' + (C.HARD_TO + (C.CAP2 - C.CAP) / C.ENDL).toFixed(0) + 's');
