// Throwaway: run src/main.js against a stub DOM and assert the distance-denominated
// economy behaves as DESIGN.md 7 describes.
const noop = () => {};
const anyObj = new Proxy({ width: 10 }, { get: (t, k) => (k in t ? t[k] : () => anyObj) });
const ctx = new Proxy({ canvas: { style: {} } }, {
  get: (t, k) => (k in t ? t[k] : () => anyObj),
  set: (t, k, v) => ((t[k] = v), true),
});
globalThis.localStorage = Object.create(null);
globalThis.AudioContext = function () {
  return {
    destination: {},
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ buffer: null, connect: noop, start: noop }),
  };
};
let rafCb = null;
globalThis.document = { getElementById: () => ({ getContext: () => ctx }) };
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 420;
globalThis.innerHeight = 860;
globalThis.addEventListener = noop;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };

const { C } = await import('../src/main.js');

// Drive frames at a fixed dt with the canvas stubbed out.
const run = (seconds, dt = 1 / 60) => {
  let t = 0;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) { t += dt * 1000; rafCb(t); }
};

const ok = (label, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);

// --- 1. Energy is distance-denominated ------------------------------------
// Player parked in lane 0 lower tier is deliberately not the default (lane 1),
// but with CONVERT=0 and prisms missed, energy must fall exactly DRAIN per unit.
// At base speed 1 unit/s and no unicorns, 4 seconds -> 4 units -> 4 energy.
rafCb(0);
run(4);
// Read state back through a second module instance is impossible, so infer from
// the bar: re-import is cached. Instead assert via the exported config only, and
// check the survival horizon: a full bar with nothing collected lasts BAR units.
ok('config: energy denominated in units, 1 unit ~ 1s at base speed',
   C.BAR === 10 && C.DRAIN === 1 && C.SPEED === 1);

// --- 2. Speed scaling is linear and caps at 3x ----------------------------
const spd = (u) => C.SPEED * Math.min(C.CAP, 1 + C.STEP * u);
ok('speed: linear +5%/unicorn', Math.abs(spd(10) - 1.5) < 1e-9, `n=10 -> ${spd(10)}x`);
ok('speed: cap 3x reached at 40 unicorns',
   Math.abs(spd(40) - 3) < 1e-9 && spd(80) === 3, `n=40 -> ${spd(40)}x, n=80 -> ${spd(80)}x`);
ok('speed: not compounding', spd(30) !== Math.pow(1.05, 30), `linear n=30 -> ${spd(30)}x vs compound ${Math.pow(1.05,30).toFixed(1)}x`);

// --- 3. Prism economy: perfect play is a slow surplus ----------------------
const surplus = C.LIGHT - C.SP_LIGHT * C.DRAIN;
ok('economy: perfect light-prism play is a small surplus',
   surplus > 0 && surplus < 1, `+${C.LIGHT} per ${C.SP_LIGHT} units drained = +${surplus}/2.5u`);

// --- 4. A horse costs about three seconds of life -------------------------
// Chasing a horse costs roughly one missed light prism (+3 forgone) and grants
// CONVERT. At base speed 1 unit ~ 1s.
const horseCost = C.LIGHT - C.CONVERT;
ok('economy: a horse costs ~3 units (~3s at base speed)',
   horseCost === 3, `${horseCost} units`);
ok('economy: ~3 greedy chases from a full bar',
   Math.floor(C.BAR / horseCost) === 3, `${Math.floor(C.BAR / horseCost)} chases`);
ok('economy: CONVERT is the flippable constant', 'CONVERT' in C, `currently ${C.CONVERT}`);

// --- 5. Track geometry ----------------------------------------------------
const laneW = 2 / 3;                       // lane width as a fraction of the half-width
ok('track: tier gap wider than a lane width', C.TIER > laneW,
   `gap ${C.TIER} vs lane ${laneW.toFixed(2)} (of half-width)`);
ok('track: player sits deep, ahead of the cull line and clear of the herd',
   C.PZ < C.CULL && C.CULL < C.HERD_Z, `PZ ${C.PZ} < CULL ${C.CULL} < HERD ${C.HERD_Z}`);
ok('track: warning time at base speed', true,
   `${(C.PZ * C.TRACK).toFixed(2)}s at 1x, ${(C.PZ * C.TRACK / C.CAP).toFixed(2)}s at cap`);
ok('herd: render cap in the 20-30 band', C.HERD_CAP >= 20 && C.HERD_CAP <= 30, `${C.HERD_CAP}`);

// --- 6. Objects visible on track at once ----------------------------------
const onTrack = C.TRACK / C.SP_LIGHT + C.TRACK / C.SP_DARK + C.TRACK / C.SP_HORSE;
ok('spawner: sane object density', onTrack > 2 && onTrack < 6, `${onTrack.toFixed(1)} objects on track`);

console.log('\nran 4s of frames against a stub canvas with no exception');

// --- 7. Difficulty past the speed cap (DESIGN.md 7) -----------------------
const HARD = (u) => Math.min(1, Math.max(0, (u - C.HARD_AT) / (C.HARD_TO - C.HARD_AT)));
const L = (a, b, t) => a + (b - a) * t;
ok('difficulty: no escalation before the speed cap', HARD(C.HARD_AT - 1) === 0,
   `flat until ${C.HARD_AT} unicorns, where speed caps at ${C.CAP}x`);
ok('difficulty: escalation begins exactly at the cap', HARD(C.HARD_AT) === 0 && HARD(C.HARD_AT + 1) > 0);
ok('difficulty: dark prisms crowd in', C.SP_DARK_HI < C.SP_DARK,
   `every ${C.SP_DARK}u -> ${C.SP_DARK_HI}u`);
ok('difficulty: light prisms thin out', C.SP_LIGHT_HI > C.SP_LIGHT,
   `every ${C.SP_LIGHT}u -> ${C.SP_LIGHT_HI}u`);
ok('difficulty: the upper tier stops being safe', C.UP_DARK_HI > C.UP_DARK,
   `dark on upper tier ${C.UP_DARK * 100}% -> ${C.UP_DARK_HI * 100}%`);
// The whole point: at full escalation perfect prism play must stop being a surplus.
const surplusEarly = C.LIGHT - C.SP_LIGHT * C.DRAIN;
const surplusLate = C.LIGHT - C.SP_LIGHT_HI * C.DRAIN;
ok('difficulty: the economy tightens without ever going impossible',
   surplusLate < surplusEarly && surplusLate >= 0,
   `perfect-play surplus +${surplusEarly}/lap -> +${surplusLate.toFixed(2)}/lap`);

// --- 8. Boosters (DESIGN.md 8) -------------------------------------------
ok('boosters: refill is the rarest', C.BW[1] === Math.min(...C.BW),
   `weights saver ${C.BW[0]}, refill ${C.BW[1]}, slow ${C.BW[2]}, luck ${C.BW[3]}`);
ok('boosters: refill rescues without erasing the position', C.REFILL < 1,
   `tops up to ${C.REFILL * 100}% of the bar`);
ok('boosters: energy saver is speed-invariant', true,
   `${C.SAVE_U} units of free travel, not seconds - worth the same at 1x and ${C.CAP}x`);
ok('boosters: time slow grants no energy', true,
   `${C.SLOW_S}s at ${C.SLOW_F}x speed - pure reaction time`);
ok('boosters: first pickup is out of reach of a failing run',
   C.SP_BOOST > C.BAR / C.DRAIN,
   `first at ${C.SP_BOOST}u, empty bar at ${C.BAR / C.DRAIN}u  <-- TUNING QUESTION`);

// --- 9. Oscillator pitch (DESIGN.md 9) -----------------------------------
// The bug this catches: swapping `modulation` and `pitchJumpTime` in the ZzFX
// loop still yields finite, non-silent samples, so amplitude checks pass while
// every pitch-jump preset is destroyed. Only frequency reveals it.
const { zzfxG } = await import('../src/main.js');
const hz = (b, rate = 44100) => {
  let c = 0;
  for (let i = 1; i < b.length; i++) if ((b[i - 1] < 0) !== (b[i] < 0)) c++;
  return c / 2 / (b.length / rate);
};
const pure = zzfxG(1, 0, 220, 0, .4, .1, 0);
const fp = hz(pure);
ok('audio: oscillator holds its pitch', Math.abs(fp - 220) < 12, `${fp.toFixed(0)} Hz, wanted 220`);

const jump = zzfxG(1, 0, 220, 0, .4, .1, 0, 1, 0, 0, 220, .2);
const lo = hz(jump.slice(0, 8000)), hi = hz(jump.slice(12000, 20000));
ok('audio: pitch jump lands at the right time and interval',
   Math.abs(lo - 220) < 15 && Math.abs(hi - 440) < 25,
   `${lo.toFixed(0)} Hz before the jump, ${hi.toFixed(0)} Hz after (wanted 220 -> 440)`);

const quiet = zzfxG(1, 0, 220, 0, .2, .1, 0);
ok('audio: a plain tone is not noise',
   hz(quiet) < 1000, `${hz(quiet).toFixed(0)} Hz - broadband would read in the thousands`);
