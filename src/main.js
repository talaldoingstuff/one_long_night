// Rainbowed - js13kGames 2026.
// One module, no abstraction layers (DESIGN.md 3).

// ---------------------------------------------------------------------------
// TUNING. Every constant from DESIGN.md 7 lives here. Flip and reload.
// ---------------------------------------------------------------------------
export const C = {
  // --- Economy (DESIGN.md 7) -----------------------------------------------
  // ENERGY IS DENOMINATED IN TRACK UNITS, NOT SECONDS. If it drained per second
  // while spawns were spaced per distance, the game would get *easier* as it sped
  // up. Distance makes the economy speed-invariant; speed only compresses
  // reaction time. At base speed 1 unit ~ 1 second, so time intuitions still map.
  BAR: 10,            // bar capacity, units
  DRAIN: 1,           // energy lost per unit travelled
  LIGHT: 3,           // light prism
  DARK: -2,           // dark prism
  CONVERT: 0,         // horse conversion. DESIGN.md 7 first tuning question:
                      // flip to 1 to halve the cost of a horse and make aggression viable.

  // --- Spawn spacing, in track units (DESIGN.md 7) --------------------------
  SP_LIGHT: 2.5,
  SP_DARK: 4,
  SP_HORSE: 5,
  SP_BOOST: 15,
  UP_LIGHT: 0.75,     // P(light prism spawns on the upper tier) - light skews up
  UP_DARK: 0.25,      // P(dark prism spawns on the upper tier)  - dark skews down

  // --- Speed (DESIGN.md 7) --------------------------------------------------
  SPEED: 1,           // base units per second
  STEP: 0.05,         // LINEAR +5% per unicorn. Never compound: 1.05^n destroys itself by 30.
  CAP: 3,             // 3x base, reached at 40 unicorns

  // --- Camera and track (DESIGN.md 5) --------------------------------------
  TRACK: 4,           // track units visible from spawn edge to horizon
  PZ: 0.62,           // player depth. 0 = spawn edge (near), 1 = horizon (far)
  CULL: 0.66,         // objects die just past the player, keeping the player->herd gap clear
  HERD_Z: 0.9,
  HERD_CAP: 24,       // DESIGN.md 5 render cap 20-30; the counter carries the rest
  NEAR: 0.44,         // track half-width at the spawn edge, fraction of screen width
  FAR: 0.1,           // track half-width at the horizon
  BOT: 1,             // spawn edge, fraction of screen height
  TOP: 0.18,          // horizon
  TIER: 0.75,         // tier gap as a multiple of the track half-width at that depth.
                      // Must exceed one lane width (2/3 of the half-width) or the rails blur.
  OBJ: 0.2,           // object base size at the spawn edge, fraction of screen width
  EASE: 0.2,          // seconds to arc across one lane or one tier (DESIGN.md 6)

  // --- Feel (DESIGN.md 5, 6) -----------------------------------------------
  GALLOP: 2.4,        // stride cycles per unit of track, so the gait tracks speed
  ARC: 0.4,           // seconds for a converted unicorn to arc up into the herd
  LIFT: 0.16,         // peak of that arc, fraction of screen height
  PARTS: 90,          // particle cap
  RIPPLE: 9,          // ribbon ripple cycles per unit of track
  GRAV: 900,          // particle gravity, px/s^2

  // --- Boosters (DESIGN.md 8) ----------------------------------------------
  // Auto-activate on touch, no held slot - the control scheme has no spare
  // gesture. Pickups spawn marked with a question mark.
  //
  // On denomination: DESIGN.md 8 writes the energy saver as "5s". Under 7's
  // distance model that is worth three times as much at the speed cap as at
  // base, which is exactly the speed-dependence the distance rule exists to
  // remove. So the saver and the bad-luck window are measured in UNITS here.
  // Time slow stays in seconds - 8 notes it buys pure reaction time and grants
  // no energy, so it cannot unbalance the economy either way.
  BW: [3, 1, 3, 2],   // spawn weights: saver, refill, slow, bad luck. Refill rarest.
  SAVE_U: 5,          // energy saver: units of track with no drain
  SLOW_S: 5,          // time slow: seconds
  SLOW_F: 0.55,       // speed multiplier while slowed
  LUCK_U: 6,          // bad luck: units of track where every light prism reads as dark
  REFILL: 0.75,       // refill to 75%, not full - rescue a bad position, do not erase it

  // --- Difficulty past the speed cap (DESIGN.md 7) -------------------------
  // Speed stops at 3x. After that, escalate through dark-prism ratio and spawn
  // density instead, so difficulty shifts from reflex to decision-making.
  HARD_AT: 40,        // unicorns where speed caps and escalation begins
  HARD_TO: 80,        // unicorns where escalation is complete
  // Light prisms thin out, but must stay under LIGHT/DRAIN = 3.0 or perfect play
  // goes energy-negative and the run becomes unsurvivable by arithmetic rather
  // than by skill. At 2.9 the surplus drops from +0.5 to +0.1 a lap: still
  // sustainable, with no margin left for a single mistake.
  SP_LIGHT_HI: 2.9,
  SP_DARK_HI: 2.5,    // dark prisms crowd in
  SP_HORSE_HI: 3.5,   // more horses, so more temptation
  UP_DARK_HI: 0.5,    // dark prisms start taking the upper tier too, so the
                      // "ascend to survive" lane stops being safe

  // --- Audio (DESIGN.md 9) -------------------------------------------------
  // Separate buses. One shared gain made SFX and music impossible to balance,
  // and stacking a 0.3 master under 0.3 notes is why everything was inaudible.
  VOL: 0.75,          // master
  MUS: 0.6,           // music bus
  SFX: 0.95,          // sfx bus
  BPM: 126,
};

const { min, max, round, sin, cos, abs, random, PI } = Math;
const g = document.getElementById('c').getContext('2d');
const cv = g.canvas;
let W, H, sky;

const resize = () => {
  const d = devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  cv.width = W * d | 0; cv.height = H * d | 0;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  g.setTransform(d, 0, 0, d, 0, 0);
  // Glow band sitting on the horizon, built once per resize rather than per frame.
  sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#07091a');
  sky.addColorStop(C.TOP * 0.9, '#1b2450');
  // clamped: TOP is a tuning constant, and addColorStop throws outside 0..1
  sky.addColorStop(min(1, C.TOP * 1.25), '#0c1130');
  sky.addColorStop(1, '#07080f');
};

// ---------------------------------------------------------------------------
// Fake-3D projection (DESIGN.md 5). Painter's algorithm, no WebGL.
// Depth reads as vertical screen position; scale is the secondary cue.
// ---------------------------------------------------------------------------
const LERP = (a, b, t) => a + (b - a) * t;
const HW = (z) => LERP(C.NEAR, C.FAR, z) * W;          // track half-width, px
const GY = (z) => LERP(C.BOT, C.TOP, z) * H;           // ground line, px
const SC = (z) => LERP(1, C.FAR / C.NEAR, z);          // object scale
const LX = (lane, z) => W / 2 + (lane - 1) * HW(z) * (2 / 3);
const EY = (z, tier) => GY(z) - tier * C.TIER * HW(z); // tier lift is scale-correct
const OS = (z) => SC(z) * C.OBJ * W;                   // object size at depth z

// ---------------------------------------------------------------------------
// State. Entities are arrays, not objects (DESIGN.md 3):
//   [z, lane, tier, type, phase]  and boosters carry a 6th slot, the booster id.
//   type 0 = horse, 1 = light prism, 2 = dark prism, 3 = booster.
// The array stays sorted far-to-near for free: spawns push at z=0, the near end.
// ---------------------------------------------------------------------------
let ents, arcs, parts, dist, energy, uni, over, px, py, tx, ty, lastTy, flash,
    bSave, bSlow, bLuck, nL, nD, nH, nB, last;

// Personal best, in namespaced localStorage (DESIGN.md 4). Never
// localStorage.clear() - js13k entries share an origin. Private mode throws on
// access, hence the guards.
const BEST = 'rbwd.best';
let best = 0;
try { best = +localStorage[BEST] || 0; } catch (e) {}

const reset = () => {
  ents = []; arcs = []; parts = [];
  dist = 0; energy = C.BAR; uni = 0; over = 0; flash = 0;
  bSave = bSlow = bLuck = 0;
  px = tx = 1; py = ty = lastTy = 0;
  nL = C.SP_LIGHT; nD = C.SP_DARK; nH = C.SP_HORSE; nB = C.SP_BOOST;
};

// ---------------------------------------------------------------------------
// Audio (DESIGN.md 9). ZzFX: parameter arrays, no sample data.
// The context is created on the first input, never at load - constructing one
// before a user gesture logs a warning in Chrome, and a warning is a console
// message we do not get to have.
// ---------------------------------------------------------------------------
let zzfxX;
const zzfxR = 44100;

const AC = () => { if (!zzfxX) try { zzfxX = new AudioContext(); } catch (e) {} };

const zzfxG = (q = 1, k = .05, c = 220, e = 0, t = 0, u = .1, r = 0, F = 1, v = 0, z = 0, w = 0, A = 0, l = 0, B = 0, x = 0, G = 0, d = 0, y = 1, m = 0, C2 = 0) => {
  let b = 2 * PI, H = v *= 500 * b / zzfxR ** 2, D = c *= (1 + 2 * k * random() - k) * b / zzfxR,
      Z = [], h, g2 = 0, E = 0, a = 0, n = 1, J = 0, K = 0, f = 0, p;
  e = 99 + zzfxR * e; m *= zzfxR; t *= zzfxR; u *= zzfxR; d *= zzfxR;
  z *= 500 * b / zzfxR ** 3; x *= b / zzfxR; w *= b / zzfxR; A *= zzfxR; l = zzfxR * l | 0;
  for (h = e + m + t + u + d | 0; a < h; Z[a++] = f)
    ++K % (100 * G | 0) || (
      f = r ? 1 < r ? 2 < r ? 3 < r ? sin((g2 % b) ** 3)
        : max(min(Math.tan(g2), 1), -1)
        : 1 - (2 * g2 / b % 2 + 2) % 2
        : 1 - 4 * abs(round(g2 / b) - g2 / b)
        : sin(g2),
      f = (l ? 1 - C2 + C2 * sin(2 * PI * a / l) : 1) * (0 < f ? 1 : -1) * abs(f) ** F * q *
          (a < e ? a / e : a < e + m ? 1 - (a - e) / m * (1 - y) : a < e + m + t ? y : a < h - d ? (h - a - d) / u * y : 0),
      f = d ? f / 2 + (d > a ? 0 : (a < h - d ? 1 : (h - a) / d) * Z[a - d | 0] / 2) : f
    ),
    // x is modulation, A is pitchJumpTime. Swapping these two is silent-ish
    // death for every preset with a pitch jump, and it still produces finite,
    // non-zero samples - so only an ear or a frequency test catches it.
    p = (c += v += z) * cos(x * E++),
    g2 += p + p * B * sin(a ** 5),
    n && ++n > A && (c += w, D += w, n = 0),
    !l || ++J % l || (c = D, v = H, n = n || 1);
  return Z;
};

// Exported for the frequency tests only. App-build exports are dropped, so this
// costs nothing in the bundle - verified against npm run size.
export { zzfxG };

// Buses. p[0] is the preset's own volume; the bus and master scale it.
const snd = (p, bus) => {
  if (!zzfxX) return;
  const q = p.slice();
  q[0] = (q[0] ?? 1) * C.VOL * bus;
  const d = zzfxG(...q), s = zzfxX.createBufferSource(), b = zzfxX.createBuffer(1, d.length, zzfxR);
  b.getChannelData(0).set(d);
  s.buffer = b;
  s.connect(zzfxX.destination);
  s.start();
};
const sfx = (p) => snd(p, C.SFX);
const mus = (p) => snd(p, C.MUS);
const seq = (list) => list.forEach(([p, ms]) => setTimeout(() => sfx(p), ms));

// A plain sine note: the shape both the game-over fall and the conversion rise
// are built from, so the two read as inversions of one another.
const N = (f, rel = .3, dly = .2) => [1, .02, f, , .06, rel, , 1.6, , , , , , , , , dly];

const S_LIGHT = [1.1, .02, 1100, , .03, .2, , 2, , , 300, .03, , , , , .15];   // rises a third
const S_DARK  = [1.1, .02, 300, , .03, .2, , 2, , , -67, .03, , , , , .15];    // the same, falling a third
const S_TIER  = [.45, .02, 700, , .015, .12, , 1, , , 260, .02, , , , , .12];
const S_BOOST = [1.3, .02, 440, .01, .1, .3, , 1.8, , , 220, .04, .06, , , , .2];
const S_OVER  = [[N(440), 0], [N(349), 160], [N(262, .9, .35), 320]];          // three notes falling
const S_CONV  = [[N(440, .2), 0], [N(587, .2), 80],                          // rising, with a
                 [[1, .02, 880, , .05, .8, , 2.2, , , , , , , , , .4, , , .25], 160]];   // shimmer on top

// ---------------------------------------------------------------------------
// Music (DESIGN.md 9). Three layers: triangle bass, hat, staccato melody.
// The melody is a motif developed rather than looped - transposed onto each
// chord of an 8-bar progression, its cadence lifted an octave on alternate
// passes. Recognisable, never twice the same.
// ---------------------------------------------------------------------------
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
const PROG = [[0, 1], [10, 0], [8, 0], [10, 0], [0, 1], [8, 0], [3, 0], [7, 0]];
const MOTIF = [[4, 2], [3, 1], [2, 1], [4, 4], [7, 2], [4, 2], [2, 4]];
let mT = 0, mS = 0, mI = 0, mW = 0, mP = 0;

const nf = (ch, d, base) => {
  const sc = ch[1] ? MIN : MAJ;
  const s = sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  return base * 2 ** ((ch[0] + s + min(12, uni / 7 | 0)) / 12);
};

const music = (dt, spd) => {
  if ((mT -= dt) > 0) return;
  const st = 60 / (C.BPM * (0.7 + 0.3 * spd)) / 4;   // seconds per 16th, tempo tracks speed
  mT = st;
  const i = mS++, ch = PROG[(i >> 4) % 8];
  // No kick, no snare. Triangle rather than the sawtooth, at a little over half
  // the level: the saw was the part that read as synthetic.
  if (i % 4 === 0) mus([.45, .02, nf(ch, 0, 55), .01, .07, .22, 1, 1.2]);  // bass
  mus([i % 2 ? .07 : .14, .02, 7500, , .004, .03, 4, 1.8]);               // hat
  if (mW > 0) mW--;
  else {
    let [d, dur] = MOTIF[mI];
    // Each phrase is exactly one bar, so it sits on one chord. Inverting every
    // fourth phrase (d = -d) is inversion by the book, but negating around
    // degree zero drops the line under the tonic and reads as a wrong note
    // against the three phrases before it. The chord changes carry the variety.
    if (mP % 2 === 1 && mI === MOTIF.length - 1) d += 7;
    // A note has to last as long as it is written for. With one fixed envelope
    // the two four-step notes ended 0.18s early, and since the second of them
    // closes the bar, every phrase finished with a hole in it.
    const L = dur * st;
    mus([.55, .02, nf(ch, d, 440), .004, L * .25, L * .35, 1, 1.5, , , , , , , , , .13, 1, , .06]);
    mW = dur - 1;
    if (++mI >= MOTIF.length) { mI = 0; mP++; }
  }
};

const RL = () => random() * 3 | 0;
const AP = (a, b, r) => a + max(-r, min(r, b - a));      // constant-rate approach
const JIT = (i) => (sin(i * 97.31) * 4096 % 1 + 1) % 1;  // deterministic herd jitter

// ---------------------------------------------------------------------------
// Input (DESIGN.md 6).
// Pointer: one code path for mouse and touch. Touch only reports moves while
// held, mouse reports buttons=0 when not held, so the same two lines mean
// "hold and drag" on both.
// Keyboard: arrows and WASD as the desktop alternative. Both routes write the
// same tx/ty targets, so there is still only one movement path downstream.
// ---------------------------------------------------------------------------
const PT = (e) => {
  if (!e.buttons) return;
  AC();
  if (over) return reset();
  tx = min(2, e.clientX / W * 3 | 0);   // X -> lane
  ty = e.clientY < H / 2 ? 1 : 0;       // Y -> tier, split on the screen midline
};

const KEY = 'arrowleft,a,arrowright,d,arrowup,w,arrowdown,s'.split(',');

const KD = (e) => {
  AC();
  if (over) return reset();
  const k = KEY.indexOf(e.key.toLowerCase());
  if (k < 0) return;
  e.preventDefault();
  if (k < 4) tx = max(0, min(2, tx + (k & 2 ? 1 : -1)));  // 0,1 left   2,3 right
  else ty = k < 6 ? 1 : 0;                                // 4,5 up     6,7 down
};

// ---------------------------------------------------------------------------
// Particles. [x, y, vx, vy, life, span, colour]
// ---------------------------------------------------------------------------
const RB = ['#ff3b6b', '#ff9500', '#ffd60a', '#3ad35f', '#22c9ff', '#b45cff'];

const burst = (x, y, n, spread, col) => {
  for (let i = 0; i < n && parts.length < C.PARTS; i++)
    parts.push([
      x, y,
      (random() - 0.5) * spread,
      (random() - 0.7) * spread,
      0, 0.25 + random() * 0.35,
      col || RB[random() * 6 | 0],
    ]);
};

// Where unicorn i stands in the massed herd. Shared by the herd renderer and the
// conversion arc so a landing unicorn arrives exactly on its slot.
const herdSlot = (i) => {
  const z = C.HERD_Z + JIT(i + 3) * 0.06;
  return [W / 2 + (JIT(i) * 2 - 1) * HW(z) * 0.95, GY(z), OS(z)];
};

// ---------------------------------------------------------------------------
// Simulation. The economy advances on distance, nothing on wall time.
// Animation timers (arcs, particles) are in seconds - that is presentation, not
// economy, so the distance rule does not apply to them.
// ---------------------------------------------------------------------------
// Escalation past the speed cap, 0 -> 1 (DESIGN.md 7).
const HARD = () => min(1, max(0, (uni - C.HARD_AT) / (C.HARD_TO - C.HARD_AT)));

// A light prism reads and behaves as dark while the bad-luck window is open.
const isDark = (t) => t === 2 || (t === 1 && bLuck > 0);

const BSUM = C.BW.reduce((a, b) => a + b, 0);
const pickBoost = () => {
  let r = random() * BSUM, i = 0;
  while ((r -= C.BW[i]) >= 0) i++;
  return i;
};

const applyBoost = (b, x, y) => {
  if (b === 0) bSave = C.SAVE_U;                          // energy saver
  else if (b === 1) energy = max(energy, C.BAR * C.REFILL); // refill, never a downgrade
  else if (b === 2) bSlow = C.SLOW_S;                     // time slow
  else bLuck = C.LUCK_U;                                  // bad luck
  burst(x, y, 16, OS(C.PZ) * 5);
  sfx(S_BOOST);
};

const step = (dt) => {
  const spd = C.SPEED * min(C.CAP, 1 + C.STEP * uni) * (bSlow > 0 ? C.SLOW_F : 1);
  const dd = spd * dt;                 // track units travelled this frame
  dist += dd;
  if (bSave <= 0) energy -= dd * C.DRAIN;
  bSave = max(0, bSave - dd);          // saver and bad luck are distance-denominated,
  bLuck = max(0, bLuck - dd);          // time slow is not - see the note in C
  bSlow = max(0, bSlow - dt);
  flash = max(0, flash - dt * 3);
  music(dt, spd);

  const r = dt / C.EASE;
  px = AP(px, tx, r); py = AP(py, ty, r);
  const pl = round(px), pt = round(py);

  // A tier change throws a few sparks so the move never reads as a teleport.
  if (ty !== lastTy) {
    burst(LX(px, C.PZ), EY(C.PZ, py), 6, OS(C.PZ) * 3);
    sfx(S_TIER);
    lastTy = ty;
  }

  const dz = dd / C.TRACK;
  for (let i = ents.length; i--;) {
    const o = ents[i], nz = o[0] + dz;
    // Contact is the frame the object crosses the player's fixed depth.
    if (o[0] < C.PZ && nz >= C.PZ && o[1] === pl && o[2] === pt) {
      const hx = LX(pl, C.PZ), hy = EY(C.PZ, pt), hs = OS(C.PZ);
      if (o[3] === 3) {
        applyBoost(o[5], hx, hy);
      } else if (o[3]) {
        const dark = isDark(o[3]);
        energy = min(C.BAR, energy + (dark ? C.DARK : C.LIGHT));
        burst(hx, hy, 10, hs * 4, dark ? '#7b3ab6' : '#ffe9a0');
        sfx(dark ? S_DARK : S_LIGHT);
        if (dark) flash = 1;
      } else {
        // Conversion: the unicorn arcs from the interception point up into the
        // herd. DESIGN.md 5 - this is the score-feedback moment, and it lands
        // where the player is already looking.
        const [tx2, ty2, ts] = herdSlot(min(uni, C.HERD_CAP - 1));
        arcs.push([hx, hy, tx2, ty2, hs, ts, 0, o[4]]);
        uni++;
        energy = min(C.BAR, energy + C.CONVERT);
        burst(hx, hy, 14, hs * 5);
        seq(S_CONV);
      }
      ents.splice(i, 1);
      continue;
    }
    o[0] = nz;
    if (nz > C.CULL) ents.splice(i, 1);
  }

  for (let i = arcs.length; i--;) if ((arcs[i][6] += dt / C.ARC) >= 1) arcs.splice(i, 1);

  for (let i = parts.length; i--;) {
    const p = parts[i];
    p[0] += p[2] * dt;
    p[1] += p[3] * dt;
    p[3] += C.GRAV * dt;
    if ((p[4] += dt) > p[5]) parts.splice(i, 1);
  }

  // Spawners are distance-driven, same as the economy. Past the speed cap the
  // spacings and the dark-prism tier skew ramp instead of the speed.
  const h = HARD();
  while (dist >= nL) { nL += LERP(C.SP_LIGHT, C.SP_LIGHT_HI, h); ents.push([0, RL(), random() < C.UP_LIGHT ? 1 : 0, 1, random()]); }
  while (dist >= nD) { nD += LERP(C.SP_DARK, C.SP_DARK_HI, h);   ents.push([0, RL(), random() < LERP(C.UP_DARK, C.UP_DARK_HI, h) ? 1 : 0, 2, random()]); }
  while (dist >= nH) { nH += LERP(C.SP_HORSE, C.SP_HORSE_HI, h); ents.push([0, RL(), 0, 0, random()]); }  // horses: lower tier only
  while (dist >= nB) { nB += C.SP_BOOST; ents.push([0, RL(), random() < 0.5 ? 1 : 0, 3, random(), pickBoost()]); }

  if (energy <= 0) {
    energy = 0; over = 1;
    seq(S_OVER);
    if (uni > best) { best = uni; try { localStorage[BEST] = best; } catch (e) {} }
  }
};

// ---------------------------------------------------------------------------
// Horse / unicorn mesh and gallop rig.
//
// One parametric side-profile sprite, reused for the wild horses, the conversion
// arc and every unicorn in the herd - which is why this is the largest single
// line in the byte budget and why it is worth it.
//
// (cx, y) is the ground the hooves stand on, s is the body-length reference,
// ph is the gallop phase in cycles, u selects horse (0) or unicorn (1).
// ---------------------------------------------------------------------------

// [hipX, phase, hockSign]. Transverse gallop, 4 beats: the two far legs first so
// the near pair paints over them. Hind legs bend the opposite way to the front.
const LEGS = [[0.26, 0.12, -1], [-0.3, 0.62, 1], [0.26, 0, -1], [-0.3, 0.5, 1]];

//        barrel      near leg   far leg    mane/tail
const HIDE = [
  ['#8a5a2e', '#6d4522', '#54341a', '#3d2712'],   // horse
  ['#fbfaff', '#e3ddf4', '#bdb4d8', '#c9a6ff'],   // unicorn
];

const leg = (hx, hy, s, th, sign, col) => {
  const a = sin(th) * 0.9;                  // hip swings fore and aft
  const b = (1 - cos(th)) * 0.55 * sign;    // knee/hock folds hardest mid-swing
  const L = s * 0.25;
  const kx = hx + sin(a) * L, ky = hy + cos(a) * L;
  g.strokeStyle = col;
  g.lineWidth = s * 0.07;
  g.beginPath();
  g.moveTo(hx, hy);
  g.lineTo(kx, ky);
  g.lineTo(kx + sin(a + b) * L, ky + cos(a + b) * L);
  g.stroke();
};

const horse = (cx, y, s, ph, u) => {
  const c = HIDE[u];
  const th = ph * 2 * PI;
  const by = y - s * 0.58 + sin(th * 2) * s * 0.045;   // barrel centre, bobbing
  const hy = by + s * 0.08;
  const hb = sin(th * 2 + 1) * s * 0.03;               // head nods a beat behind

  g.lineCap = 'round';
  for (let i = 0; i < 2; i++) leg(cx + LEGS[i][0] * s, hy, s, th + LEGS[i][1] * 2 * PI, LEGS[i][2], c[2]);

  // tail
  g.strokeStyle = c[3];
  g.lineWidth = s * 0.09;
  g.beginPath();
  g.moveTo(cx - s * 0.4, by - s * 0.12);
  g.quadraticCurveTo(cx - s * 0.62, by - s * 0.02 + sin(th) * s * 0.07, cx - s * 0.68, by + s * 0.26);
  g.stroke();

  // barrel, haunch, chest - three fills that union into a body silhouette
  g.fillStyle = c[0];
  g.beginPath(); g.ellipse(cx - s * 0.04, by, s * 0.42, s * 0.2, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(cx - s * 0.26, by - s * 0.02, s * 0.21, 0, 7); g.fill();
  g.beginPath(); g.arc(cx + s * 0.24, by - s * 0.01, s * 0.19, 0, 7); g.fill();

  // neck and head
  g.beginPath();
  g.moveTo(cx + s * 0.12, by - s * 0.14);
  g.lineTo(cx + s * 0.32, by - s * 0.5 + hb);
  g.lineTo(cx + s * 0.5, by - s * 0.55 + hb);
  g.lineTo(cx + s * 0.6, by - s * 0.4 + hb);
  g.lineTo(cx + s * 0.5, by - s * 0.33 + hb);
  g.lineTo(cx + s * 0.36, by - s * 0.34 + hb);
  g.lineTo(cx + s * 0.3, by - s * 0.04);
  g.fill();

  // ear
  g.beginPath();
  g.moveTo(cx + s * 0.44, by - s * 0.53 + hb);
  g.lineTo(cx + s * 0.47, by - s * 0.66 + hb);
  g.lineTo(cx + s * 0.51, by - s * 0.55 + hb);
  g.fill();

  // mane along the crest. The unicorn's runs rainbow.
  g.lineWidth = s * 0.05;
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    g.strokeStyle = u ? RB[i + 1] : c[3];
    g.beginPath();
    g.moveTo(cx + s * (0.18 + t * 0.24), by - s * (0.24 + t * 0.28) + hb * t);
    g.lineTo(cx + s * (0.1 + t * 0.24), by - s * (0.34 + t * 0.3) + hb * t);
    g.stroke();
  }

  // eye
  g.fillStyle = '#1a1020';
  g.beginPath(); g.arc(cx + s * 0.47, by - s * 0.47 + hb, s * 0.022, 0, 7); g.fill();

  for (let i = 2; i < 4; i++) leg(cx + LEGS[i][0] * s, hy, s, th + LEGS[i][1] * 2 * PI, LEGS[i][2], c[1]);

  if (u) {   // horn
    g.fillStyle = '#ffd60a';
    g.beginPath();
    g.moveTo(cx + s * 0.47, by - s * 0.56 + hb);
    g.lineTo(cx + s * 0.62, by - s * 0.88 + hb);
    g.lineTo(cx + s * 0.53, by - s * 0.55 + hb);
    g.fill();
  }
};

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const shadow = (cx, z, s) => {   // DESIGN.md 5: the single most important depth cue
  g.globalAlpha = 0.35;
  g.fillStyle = '#000';
  g.beginPath(); g.ellipse(cx, GY(z), s * 0.5, s * 0.18, 0, 0, 7); g.fill();
  g.globalAlpha = 1;
};

const track = () => {
  const n = HW(0), f = HW(1), yb = GY(0), yt = GY(1), cx = W / 2;
  g.fillStyle = '#161d38';                          // ground plane: filled trapezoid
  g.beginPath();
  g.moveTo(cx - n, yb); g.lineTo(cx + n, yb); g.lineTo(cx + f, yt); g.lineTo(cx - f, yt);
  g.fill();
  g.lineWidth = 1.5;
  g.lineCap = 'butt';
  for (let i = 0; i < 3; i++) {
    const o = (i - 1) * (2 / 3);
    g.strokeStyle = '#3a4a80';                      // 3 lane centre lines
    g.beginPath(); g.moveTo(cx + o * n, yb); g.lineTo(cx + o * f, yt); g.stroke();
    g.strokeStyle = '#7a6ac0';                      // 3 upper rails: lines only, not a plane
    g.beginPath();
    g.moveTo(cx + o * n, yb - C.TIER * n); g.lineTo(cx + o * f, yt - C.TIER * f);
    g.stroke();
  }
};

const herd = () => {   // massed at the horizon, ignoring the lane grid
  // Unicorns still in flight are not standing in the herd yet.
  const n = min(uni - arcs.length, C.HERD_CAP);
  for (let i = 0; i < n; i++) {
    const [x, y, s] = herdSlot(i);
    horse(x, y, s, dist * C.GALLOP + JIT(i + 11), 1);
  }
};

const ent = (o) => {
  const z = o[0], s = OS(z), cx = LX(o[1], z), y = EY(z, o[2]);
  if (o[2]) shadow(cx, z, s);
  if (o[3] === 3) {                                  // booster, marked with a ?
    const oy = y - s * 0.45;
    g.fillStyle = '#0d1b3a';
    g.beginPath(); g.arc(cx, oy, s * 0.34, 0, 7); g.fill();
    g.lineWidth = s * 0.08;
    g.strokeStyle = RB[(dist * 4 | 0) % 6];          // cycles so it reads as a prize
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold ' + s * 0.4 + 'px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', cx, oy);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  } else if (o[3]) {                                 // prism
    const dark = isDark(o[3]);
    const spin = sin(dist * 3 + o[4] * 7) * 0.3;
    g.fillStyle = dark ? '#5b2a86' : '#ffe9a0';
    g.beginPath();
    g.moveTo(cx + spin * s * 0.2, y - s * 0.95);
    g.lineTo(cx + s * 0.42, y);
    g.lineTo(cx - s * 0.42, y);
    g.fill();
    g.fillStyle = dark ? '#8d4fd0' : '#fffdf2';      // lit facet
    g.beginPath();
    g.moveTo(cx + spin * s * 0.2, y - s * 0.95);
    g.lineTo(cx + s * 0.42, y);
    g.lineTo(cx + s * 0.1, y);
    g.fill();
  } else {
    horse(cx, y, s, dist * C.GALLOP + o[4], 0);
  }
};

const player = () => {
  const z = C.PZ, s = OS(z), cx = LX(px, z), y = EY(z, py);
  if (py > 0.02) shadow(cx, z, s);
  // The rainbow itself: six stripes sliced across, each slice displaced by a
  // travelling sine so the ribbon ripples as it drifts. Fades as energy drops.
  g.globalAlpha = 0.5 + 0.5 * min(1, energy / C.BAR * 2.5);
  const w = s * 1.5, n = 10, sw = w / n;
  for (let b = 0; b < 6; b++) {
    g.fillStyle = RB[b];
    for (let i = 0; i < n; i++) {
      const d = sin(i / n * 5 + dist * C.RIPPLE) * s * 0.1;
      g.fillRect(cx - w / 2 + i * sw, y - s * 0.6 + b * s * 0.1 + d, sw + 1, s * 0.12);
    }
  }
  g.globalAlpha = 1;
};

const drawParts = () => {
  for (const p of parts) {
    g.globalAlpha = 1 - p[4] / p[5];
    g.fillStyle = p[6];
    g.fillRect(p[0] - 2, p[1] - 2, 4, 4);
  }
  g.globalAlpha = 1;
};

const drawArcs = () => {
  for (const a of arcs) {
    const u = a[6];
    horse(
      LERP(a[0], a[2], u),
      LERP(a[1], a[3], u) - sin(u * PI) * C.LIFT * H,
      LERP(a[4], a[5], u),
      dist * C.GALLOP + a[7],
      1
    );
  }
};

const hud = () => {
  const bw = W - 24;
  g.fillStyle = '#000';
  g.fillRect(12, 12, bw, 14);
  // The bar is the rainbow's strength, so it reads as one.
  const fw = bw * energy / C.BAR;
  for (let i = 0; i < 6; i++) {
    const x0 = bw / 6 * i;
    if (x0 >= fw) break;
    g.fillStyle = RB[i];
    g.fillRect(12 + x0, 12, min(bw / 6, fw - x0), 14);
  }
  g.fillStyle = '#fff';
  g.font = '16px monospace';
  g.fillText('UNICORNS ' + uni, 12, 48);
  if (best) { g.fillStyle = '#8a93b8'; g.fillText('BEST ' + best, 12, 68); }

  // Active booster windows, in the units each one is denominated in.
  let bx = W - 12;
  const chip = (t, span, col) => {
    if (t <= 0) return;
    bx -= 38;
    g.fillStyle = '#0006'; g.fillRect(bx, 38, 34, 6);
    g.fillStyle = col;     g.fillRect(bx, 38, 34 * min(1, t / span), 6);
  };
  chip(bSave, C.SAVE_U, '#4d8');
  chip(bSlow, C.SLOW_S, '#4af');
  chip(bLuck, C.LUCK_U, '#a4f');

  if (flash > 0) {                          // dark prism sting
    g.globalAlpha = flash * 0.25;
    g.fillStyle = '#7b3ab6';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  if (over) {
    g.fillStyle = '#000c';
    g.fillRect(0, H / 2 - 50, W, 100);
    g.fillStyle = '#fff';
    g.font = '28px monospace';
    g.fillText(uni + ' UNICORNS', 20, H / 2 - 8);
    g.font = '16px monospace';
    g.fillStyle = uni >= best && uni ? '#ffd60a' : '#8a93b8';
    g.fillText(uni >= best && uni ? 'NEW BEST' : 'BEST ' + best, 20, H / 2 + 14);
    g.fillStyle = '#fff';
    g.fillText('tap or press a key to run again', 20, H / 2 + 36);
  }
};

const render = () => {
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  track();
  herd();
  // Painter's algorithm, far to near. ents is already z-descending, and the player
  // slots in at its fixed depth: herd, gap, player, play field, spawn edge.
  let drawn = 0;
  for (const o of ents) {
    if (!drawn && o[0] <= C.PZ) { player(); drawn = 1; }
    ent(o);
  }
  if (!drawn) player();
  drawArcs();     // the score moment rides over everything
  drawParts();
  hud();
};

const frame = (t) => {
  requestAnimationFrame(frame);
  const dt = min(0.05, (t - last) / 1000) || 0;
  last = t;
  if (!over) step(dt);
  render();
};

addEventListener('resize', resize);
addEventListener('pointerdown', PT);
addEventListener('pointermove', PT);
addEventListener('keydown', KD);
resize();
reset();
last = 0;
requestAnimationFrame(frame);
