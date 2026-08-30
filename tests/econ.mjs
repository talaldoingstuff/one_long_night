// The energy economy under a per-SECOND beam cost, across the speed range.
// Demand is spaced by distance and cost is charged by time, so the two scale
// differently with speed - which is the whole question.
const noop = () => {};
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, { get: (t, k) => (k in t ? t[k] : () => anyObj), set: (t, k, v) => ((t[k] = v), true) });
globalThis.document = { getElementById: () => ({ getContext: () => ctx }) };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 900; globalThis.innerHeight = 500;
globalThis.localStorage = Object.create(null);
globalThis.addEventListener = noop;
globalThis.requestAnimationFrame = noop;
globalThis.AudioContext = function () { return { destination: {}, createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource: () => ({ connect: noop, start: noop }) }; };
const { C } = await import('../src/main.js');

const line = (label, h) => {
  const rb = C.SP_RB + (C.SP_RB_HI - C.SP_RB) * h;
  const ob = C.SP_OBST + (C.SP_OBST_HI - C.SP_OBST) * h;
  const sp = Math.min(1, C.SPIKE + (C.SPIKE * 1.8 - C.SPIKE) * h);
  const income = C.RGEN + C.RBFILL / rb;                       // bars per second
  const clearS = (C.HP[0] * (1 - sp) + C.HP[1] * sp) * C.HITT; // seconds of beam per block
  const duty = clearS / ob;
  const empt = C.BAR / (C.BEAMC - income);
  console.log('  ' + label.padEnd(10) + income.toFixed(2).padStart(8) + C.BEAMC.toFixed(2).padStart(11) +
              (empt > 0 ? empt.toFixed(0) + 's' : 'NEVER').padStart(14) +
              (100 * duty).toFixed(0).padStart(13) + '%' +
              (income - Math.min(1, duty) * C.BEAMC).toFixed(2).padStart(10));
};
console.log(`bar ${C.BAR} | beam ${C.BEAMC}/s | trickle ${C.RGEN}/s (a bar every ${(1 / C.RGEN).toFixed(0)}s) | sphere +${C.RBFILL} every ${C.SP_RB}s`);
console.log('');
console.log('  phase      income/s   spend/s   held down empties   forced duty   net/s if clearing all');
line('early', 0);
line('late', 1);
console.log('');
console.log('  Speed does not appear in this table, and that is the point: the run is');
console.log('  denominated in seconds end to end, so nothing revalues when it speeds up.');
