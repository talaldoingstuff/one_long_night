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
  // TRACK and PZ move together. PZ is the ribbon's DEPTH, so raising it pushes
  // the ribbon further into the scene and UP the screen, closing the band
  // between it and the herd. PZ * TRACK is the warning time in seconds at base
  // speed, so lowering TRACK as PZ rises keeps reaction time identical.
  //   PZ 0.62 / TRACK 4.0   ribbon 49% down, 23% of screen behind it
  //   PZ 0.75 / TRACK 3.31  ribbon 39% down, 15% behind it   <- here
  // Both warn 2.48s at base speed and 0.83s at the 3x cap.
  TRACK: 3.31,        // track units visible from spawn edge to horizon
  PZ: 0.75,           // player depth. 0 = spawn edge (near), 1 = horizon (far)
  CULL: 0.79,         // objects die just past the player, keeping the player->herd gap clear
  HERD_Z: 0.93,       // lifted with PZ so the gap stays a visible band, not a sliver
  HERD_CAP: 24,       // DESIGN.md 5 render cap 20-30; the counter carries the rest
  NEAR: 0.44,         // track half-width at the spawn edge, fraction of screen width
  FAR: 0.1,           // track half-width at the horizon
  BOT: 1,             // spawn edge, fraction of screen height
  TOP: 0.18,          // horizon
  TIER: 0.75,         // tier gap as a multiple of the track half-width at that depth.
                      // Must exceed one lane width (2/3 of the half-width) or the rails blur.
  OBJ: 0.2,           // object base size at the spawn edge, fraction of screen width
  EASE: 0.2,          // seconds to arc across one lane or one tier (DESIGN.md 6)

  // --- Solid objects (DESIGN.md 5) -----------------------------------------
  // The CAMERA stays fake-3D on purpose: 5 requires depth to read as vertical
  // screen position rather than scale, or the six-lane grid and the massed herd
  // stop being legible in portrait. The OBJECTS are real geometry projected
  // through that camera - vertices in local space, shaded by face normal.
  // These two are the camera pitch, roughly 40 degrees per 5.
  PCY: 0.77,          // a unit of object height, as screen-y   (cos of the pitch)
  PCZ: 0.64,          // a unit of object depth,  as screen-y   (sin of the pitch)
  // Depth foreshortening WITHIN a solid. A true 40-degree pitch (0.64) spreads
  // an animal's own length across as much screen-y as its height: the barrel is
  // 0.58 long, which at 0.64 became 27px of vertical spread against 28px of
  // actual height. The rump then sat above the head, the horn could not clear
  // the body, and the front hooves - being nearer the camera - punched 9px
  // through the lane. DESIGN.md 5 already compresses depth for the track and for
  // exactly this reason; solids get the same treatment.
  PCD: 0.32,
  LEGL: 0.225,        // length of each leg segment
  LEGY: -0.1,         // hip height relative to the barrel line
  FHZ: 0.225,          // front hip, along the body
  HHZ: -0.24,         // hind hip
  // Which way the hind knee folds, relative to FOLD. -1 matches the front legs.
  // +1 was the anatomical hock, and it threw the lower leg 74 degrees forward
  // mid-stride against the front leg's 25 - which is what read as a spider.
  HFOLD: -1,
  HTILT: 0,           // extra backward lean on the hind legs, radians
  PHH: 0.4,           // hind pair's phase offset from the front pair, in strides
  PHS: 0.15,          // and the left/right split within each pair
  // The mane is generated along the neck rather than placed by hand, so it
  // follows the neck wherever the neck goes instead of being left behind.
  MANEN: 5,           // how many tufts
  MANE0: 0.3,        // where the first sits along the neck, 0 = shoulder, 1 = poll
  MANE1: 1.2,        // and the last
  MANEL: 0.1,       // how far each stands off the crest
  MANER: 0.026,        // tuft thickness
  MANEX: 0.01,           // sideways flop
  MANEP: 0.1,        // tip thickness as a fraction of the root. Low is pointy.
  SWING: 0.8,         // how far the hip swings fore and aft, radians
  FOLD: 0.5,          // how hard the knee folds mid-swing
  LEGR: [.1, .06, .04, .045, .05, .032],      // hip w,h - knee w,h - hoof w,h
  OUTL: 0.009,        // face outline width, as a fraction of the animal's scale.
                      // At this setting it is sub-pixel everywhere except the
                      // spawn edge, so canvas antialiases it into a hairline
                      // rather than a drawn border. 0 turns it off entirely.
  OUTA: 0.45,         // and its opacity. Width and alpha are separate because a
                      // thin opaque line still reads as heavy.
  ASC: 0.9,         // animals only. Compressing PCD removed the fake vertical
                      // spread that was padding their height. This is the scale
                      // that looked right in the lab, not a derived number.
  // The animal's heading, radians, about the vertical axis.
  //   0     tail-on, running directly away from the camera
  //   PI    head-on, running directly at it
  //   PI+/-0.9   three-quarter front - the face and chest read, and the body
  //              still has width. Anything near PI exactly is a narrow silhouette.
  // DEGREES of turn away from head-on. The animal is 1.27 long and 0.36 wide,
  // so its LENGTH projects length*sin(YAW) onto screen x while its WIDTH
  // projects width*cos(YAW) - and it only reads as front-facing while width
  // wins. That crossover is at 16 degrees. At 30 the length contributed 2.4x
  // more screen width than the width did, which is why it kept reading side-on
  // however far the depth cue was pushed.
  YAW: 90,
  STANCE: 0.175,       // half the distance between the left and right legs. Wider
                      // also lifts the crossover above, so it earns twice.
  LOD: 26,            // below this on-screen size legs lose their lower segment
  PR: 0.165,          // prism radius, in object-size units
  PSPIN: 2.2,         // prism turns per unit of track
  // The sheet runs ALONG the track, not across it: longer than it is wide, with
  // one rainbow stripe per lengthwise column, and the ripple travelling away
  // from the camera so it reads as motion ahead rather than a sideways flap.
  RW: 0.5,            // rainbow band width, in object-size units. Narrow: a
                      // rainbow is a band, and at 1.1 it read as a flag.
  RD: 1.8,            // rainbow sheet depth - much longer than the width
  RZ: -0.5,           // shifts the sheet back toward the camera. Centred on the
                      // anchor it pushed forward past the cull line, which made
                      // the play field behind it read as far deeper than it is.
  RH: 0.22,           // rainbow ripple amplitude
  RY: 0.42,           // how far the sheet floats above its lane
  RV: 5.2,            // travelling waves along the sheet's length. Bounded:
                      // RH * RV * PCY must stay under RD * PCZ, or consecutive
                      // segments move further than their screen spacing, the
                      // sheet folds through itself and the painter order inverts.
                      // At these values 0.88 against a 1.15 ceiling.
  RU: 1.6,            // per-column phase skew, so the crest sweeps rather than
                      // arriving flat. Free of the bound above: columns differ in
                      // screen x, so they can never occlude one another.

  // --- Feel (DESIGN.md 5, 6) -----------------------------------------------
  GALLOP: 1.5,        // stride cycles per unit of track, so the gait tracks speed
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

const { min, max, round, sin, cos, abs, hypot, random, PI } = Math;
let g = document.getElementById('c').getContext('2d');
// Test seam: tools/model-lab.html redirects drawing onto its own canvases so
// it can show the real horse() at real sizes without a second copy of it.
// App-build exports are dropped, so this costs the bundle nothing.
export const setCtx = (c) => (g = c);
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
export { zzfxG, horse, PARTS, LEGS };

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
// One palette, held as numbers so faces can be shaded, and derived once into
// strings for everything that just needs a flat colour.
const RBV = [[255, 59, 107], [255, 149, 0], [255, 214, 10], [58, 211, 95], [34, 201, 255], [180, 92, 255]];
const CH = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const shade = (c, k) => 'rgb(' + CH(c[0] * k) + ',' + CH(c[1] * k) + ',' + CH(c[2] * k) + ')';
const RB = RBV.map((c) => shade(c, 1));

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
// Solid renderer (DESIGN.md 5).
//
// The camera projection already existed - PCY/PCZ map an object's local 3D
// space onto the screen, and prism() culls its own back faces. What did not
// exist is a face-level painter's algorithm: prism gets away with culling alone
// because it is one convex solid, but an animal built from a dozen boxes has
// parts that occlude each other, so faces have to be sorted.
//
// Faces are gathered in world space, culled against the view direction, sorted
// far-to-near and filled flat. Hard polygon edges, no curves, no gradients.
// ---------------------------------------------------------------------------
let CO = 1, SI = 0, SX = 0, SY = 0, SS = 1, FQ = [];

const R3 = (x, y, z) => [x * CO - z * SI, y, x * SI + z * CO];   // yaw about vertical
const DEP = (p) => p[2] * C.PCY - p[1] * C.PCD;                  // distance into the screen
const PRJ = (p) => [SX + p[0] * SS, SY - (p[1] * C.PCY + p[2] * C.PCD) * SS];

// Light from above, front and left. Shading is quantised to exactly three
// steps: a smooth ramp on a low-poly solid reads as a smudge, not as facets.
const LD = [-0.5, 0.68, -0.54];

const face = (n, pts, col) => {
  if (n[2] * C.PCY - n[1] * C.PCD >= 0) return;         // pointing away from the camera
  const d = n[0] * LD[0] + n[1] * LD[1] + n[2] * LD[2];
  let z = 0;
  for (const q of pts) z += DEP(q);
  FQ.push([z, shade(col, d > 0.45 ? 1 : d > -0.12 ? 0.66 : 0.4), pts.map(PRJ)]);
};

// One primitive covers everything: a box swept along an arbitrary axis in the
// animal's sagittal plane, with independent half-width and half-height at each
// end. Taper one end to nothing and it is a cone; taper neither and it is a box.
const solid = (ax, ay, az, bx, by, bz, w0, h0, w1, h1, col) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = hypot(dx, dy, dz) || 1;
  const px = dx / L, py = dy / L, pz = dz / L;           // the part's own axis
  // Orthonormal frame: u is the lateral axis with the part's direction projected
  // out. Building the cross-section from dy and dz alone was fine while every
  // part lay in the sagittal plane, but a part that leans sideways then came out
  // sheared, with side-face normals that were wrong for both shading and
  // culling. For an unleaned part this reduces to exactly (1,0,0).
  let ux = 1 - px * px, uy = -px * py, uz = -px * pz;
  const uL = hypot(ux, uy, uz) || 1;
  ux /= uL; uy /= uL; uz /= uL;
  const vx = py * uz - pz * uy, vy = pz * ux - px * uz, vz = px * uy - py * ux;
  const V = (x, y, z, su, sv, w, h) => R3(x + su * w * ux + sv * h * vx,
                                          y + su * w * uy + sv * h * vy,
                                          z + su * w * uz + sv * h * vz);
  const A = (su, sv) => V(ax, ay, az, su, sv, w0, h0);
  const B = (su, sv) => V(bx, by, bz, su, sv, w1, h1);
  face(R3(ux, uy, uz), [A(1, 1), A(1, -1), B(1, -1), B(1, 1)], col);
  face(R3(-ux, -uy, -uz), [A(-1, 1), B(-1, 1), B(-1, -1), A(-1, -1)], col);
  face(R3(vx, vy, vz), [A(1, 1), B(1, 1), B(-1, 1), A(-1, 1)], col);
  face(R3(-vx, -vy, -vz), [A(1, -1), A(-1, -1), B(-1, -1), B(1, -1)], col);
  face(R3(-px, -py, -pz), [A(1, 1), A(-1, 1), A(-1, -1), A(1, -1)], col);
  face(R3(px, py, pz), [B(1, 1), B(1, -1), B(-1, -1), B(-1, 1)], col);
};

const flush = () => {
  FQ.sort((a, b) => b[0] - a[0]);
  // A dark edge on every face. It separates same-coloured parts - head from
  // neck, neck from barrel - which shading alone cannot do, and it also draws
  // each box's own three visible faces apart.
  const lw = SS * C.OUTL;
  g.lineWidth = lw;
  g.strokeStyle = 'rgba(18,14,24,' + C.OUTA + ')';
  g.lineJoin = 'round';
  for (const [, c, p] of FQ) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]);
    g.closePath();
    g.fill();
    if (lw > 0.06) g.stroke();
  }
  FQ = [];
};

// ---------------------------------------------------------------------------
// Horse / unicorn. Boxes and cones in the animal's own space: x across it, y up,
// z forward. The wild horse is desaturated grey and carries colour only in its
// mane, so conversion has somewhere to go - the unicorn gains a rainbow mane
// and a gold horn long enough to break the body silhouette.
// ---------------------------------------------------------------------------
const BODY = [[176, 145, 110], [246, 245, 252]];   // horse light brown, unicorn white
const MANE = [104, 84, 72];   // the wild horse's one piece of colour, muted so
                              // the unicorn's rainbow mane is a clear step up
const GOLD = [255, 214, 10], EYE = [22, 17, 28], EYEU = [58, 150, 255];   // horse dark, unicorn blue

// [side, hind]. The gait pattern itself lives in C: PHH offsets the hind pair
// from the front, PHS splits left from right. 0.5 / 0.12 is a transverse gallop;
// PHH 0 bounds both pairs together, PHS 0.5 walks them alternately.
const LEGS = [[-1, 0], [-1, 1], [1, 0], [1, 1]];

// The model, as data rather than code, so tools/horse-editor.html can move a
// joint and see it immediately instead of another round of guesswork.
//   [ax,ay,az, bx,by,bz, w0,h0, w1,h1, mat, nodA,nodB, flags]
// y is measured from the barrel line and follows its bob. nodA/nodB scale the
// head nod at each end. mat: 0 body, 7 horn, otherwise RBV[mat-1] on a unicorn
// and the muted mane colour on a horse. flags: 1 = full detail only, 2 = unicorn only.
const PARTS = [
  [0, .06, -.27, 0, .12, -.55, .04, .045, .014, .015, 6, 0, 0, 0],           // tail
  [0, 0, -.3, 0, 0, .28, .15, .16, .16, .17, 0, 0, 0, 0],                    // barrel
  [.025, .105, .2, .075, .2737, .365, .1, .11, .075, .085, 0, 0, 1, 0],      // neck
  [.1, .345, .345, .1, .2546, .5834, .085, .099, .055, .061, 0, 1, 1, 0],    // head
  [.1, .3927, .4239, .1, .6829, .5077, .03, .03, .002, .002, 7, 1, 1, 2],    // horn
  [.148, .3319, .4239, .156, .3187, .4724, .02, .02, .013, .013, 8, 1, 1, 1],   // eye near
  [.052, .3319, .4239, .044, .3187, .4724, .02, .02, .013, .013, 8, 1, 1, 1],   // eye far
];

const horse = (cx, gy, s, ph, u) => {
  const A = PI + C.YAW * PI / 180;
  CO = cos(A); SI = sin(A); SX = cx; SY = gy; SS = s * C.ASC;
  const th = ph * 2 * PI, bd = BODY[u], R = C.LEGR;
  const by = 0.56 + sin(th * 2) * 0.04;             // barrel line, bobbing
  const hb = sin(th * 2 + 1) * 0.03;                // head nods a beat behind
  const fine = s > C.LOD;

  for (const [side, hind] of LEGS) {                // four legs, two segments each
    const L = C.LEGL;
    const t = th + ((hind ? C.PHH : 0) + (side < 0 ? C.PHS : 0)) * 2 * PI;
    const a = sin(t) * C.SWING + (hind ? C.HTILT : 0);
    const b = (1 - cos(t)) * C.FOLD * (hind ? C.HFOLD : -1);
    const lz = hind ? C.HHZ : C.FHZ;
    const x = side * C.STANCE, hy = by + C.LEGY;
    const kz = lz + sin(a) * L, ky = hy - cos(a) * L;
    solid(x, hy, lz, x, ky, kz, R[0], R[1], R[2], R[3], bd);
    if (fine) solid(x, ky, kz, x, ky - cos(a + b) * L, kz + sin(a + b) * L, R[2], R[3], R[4], R[5], bd);
  }
  // Mane, swept along the neck. Reading the neck out of PARTS means moving the
  // neck carries the mane with it, which placing tufts by hand never did.
  const nk = PARTS[2];
  const ny = nk[4] - nk[1], nz = nk[5] - nk[2], nL = hypot(ny, nz) || 1;
  const vy = nz / nL, vz = -ny / nL;                 // up the crest
  // MANER is the tuft's maximum thickness, not its actual one: a tuft can never
  // be wider than the gap it has, or the mane merges into one lump. On a short
  // neck five tufts at .03 were 70% wider than their spacing.
  const gap = C.MANEN > 1 ? (C.MANE1 - C.MANE0) / (C.MANEN - 1) * nL : 1;
  const mr = min(C.MANER, gap * 0.48);
  for (let i = 0; i < C.MANEN; i++) {
    const t = C.MANEN < 2 ? 0.5 : LERP(C.MANE0, C.MANE1, i / (C.MANEN - 1));
    // One lateral line for every tuft. Lerping the neck's own x made the mane
    // fan sideways whenever the neck leaned, instead of running straight.
    const ax = (nk[0] + nk[3]) / 2;
    const ay = LERP(nk[1], nk[4], t), az = LERP(nk[2], nk[5], t);
    const h = LERP(nk[7], nk[9], t), o = h * 0.6, e = h + C.MANEL;
    solid(ax, by + ay + o * vy + hb * t, az + o * vz,
          ax - C.MANEX, by + ay + e * vy + hb * t, az + e * vz,
          mr, mr, mr * C.MANEP, mr * C.MANEP,
          u ? RBV[1 + i % 5] : MANE);
  }

  // Order does not matter here: flush() sorts every face by depth.
  for (const q of PARTS) {
    if ((q[13] & 1 && !fine) || (q[13] & 2 && !u)) continue;
    const m = q[10];
    solid(q[0], by + q[1] + hb * q[11], q[2], q[3], by + q[4] + hb * q[12], q[5],
          q[6], q[7], q[8], q[9], m ? (m === 7 ? GOLD : m === 8 ? (u ? EYEU : EYE) : u ? RBV[m - 1] : MANE) : bd);
  }
  flush();
};

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
// DESIGN.md 5: the single most important depth cue. `r` is the caster's own
// screen radius - a prism and a rainbow are nothing like the same size, and one
// shadow width for both is what made them look unmoored.
const shadow = (cx, z, r) => {
  g.globalAlpha = 0.35;
  g.fillStyle = '#000';
  g.beginPath(); g.ellipse(cx, GY(z), r, r * 0.36, 0, 0, 7); g.fill();
  g.globalAlpha = 1;
};

// ---------------------------------------------------------------------------
// Prisms are real solids: an octahedron, six vertices at +/-r on each axis and
// eight triangular faces, one per sign combination (sx, sy, sz). Each face's
// normal IS its sign vector, so shading is one dot product and needs no cross
// products or vertex tables. The solid is convex and the projection is affine,
// so back-face culling alone gives correct occlusion - nothing needs sorting.
// ---------------------------------------------------------------------------
const LGT = [-0.42, 0.76, -0.5];                  // light direction, unit-ish
const PCOL = [[255, 255, 255], [150, 84, 226]];   // light prism, dark prism

const prism = (cx, gy, s, a, dark) => {
  const co = cos(a), si = sin(a), r = s * C.PR, c = PCOL[dark], cy = gy - r * C.PCY;
  for (let i = 0; i < 8; i++) {
    const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1;
    const nx = sx * co - sz * si, nz = sx * si + sz * co;   // normal, turned about Y
    if (nz * C.PCY >= sy * C.PCZ) continue;                 // faces away from the camera
    g.fillStyle = shade(c, 0.34 + 0.66 * max(0, (nx * LGT[0] + sy * LGT[1] + nz * LGT[2]) / 1.733));
    g.beginPath();
    g.moveTo(cx + sx * r * co, cy - sx * r * si * C.PCZ);   // (sx, 0, 0)
    g.lineTo(cx,               cy - sy * r * C.PCY);        // (0, sy, 0)
    g.lineTo(cx - sz * r * si, cy - sz * r * co * C.PCZ);   // (0, 0, sz)
    g.fill();
  }
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
  // only prisms and boosters are ever raised; horses are lower tier only
  if (o[2]) shadow(cx, z, s * (o[3] === 3 ? 0.34 : C.PR * 1.15));
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
    prism(cx, y, s, dist * C.PSPIN + o[4] * 7, isDark(o[3]) ? 1 : 0);
  } else {
    horse(cx, y, s, dist * C.GALLOP + o[4], 0);
  }
};

// The rainbow is a sheet, not a stack of bars: a grid of quads lying in the
// x-z plane, lifted by a wave travelling away from the camera and projected
// through the same camera as everything else. Six lengthwise stripes, one per
// column, each quad shaded by the slope of the wave beneath it - so the ripple
// reads as a surface catching light rather than as scrolling stripes.
const NX = 6, NZ = 12;   // 6 colour stripes long-ways, 12 segments of ripple

const player = () => {
  const z = C.PZ, s = OS(z), cx = LX(px, z), gy = EY(z, py);
  if (py > 0.02) shadow(cx, z, s * C.RW * 0.55);
  const w = s * C.RW, d = s * C.RD, ph = dist * C.RIPPLE, top = gy - s * C.RY;
  const amp = C.RH * s;
  // local (u, v) in [-.5, .5] -> screen y. Height and depth both fold into
  // screen-y through the camera pitch.
  // The phase advances with v, so crests travel away from the camera. The u term
  // only skews it per column, which is what stops the crest arriving dead flat.
  const SY = (u, v) =>
    top - amp * sin(v * C.RV + ph + u * C.RU) * C.PCY - (v + C.RZ) * d * C.PCZ;

  g.globalAlpha = 0.55 + 0.45 * min(1, energy / C.BAR * 2.5);
  // One continuous polygon per colour, down one edge and back up the other.
  // The previous version was a grid of quads, each stroked in its own shade to
  // hide the seams - and those strokes are what read as checkering. A stripe
  // drawn whole has no internal edges to show. The ripple still reads, through
  // the wave in each stripe's own outline.
  for (let i = 0; i < NX; i++) {
    const u0 = i / NX - 0.5, u1 = u0 + 1.04 / NX;   // 4% overlap kills the seams
    g.fillStyle = shade(RBV[i], 0.66 + 0.34 * cos(ph + u0 * C.RU * 3));
    g.beginPath();
    for (let j = 0; j <= NZ; j++) {
      const v = 0.5 - j / NZ, y = SY(u0, v);
      j ? g.lineTo(cx + u0 * w, y) : g.moveTo(cx + u0 * w, y);
    }
    for (let j = NZ; j >= 0; j--) {
      const v = 0.5 - j / NZ;
      g.lineTo(cx + u1 * w, SY(u1, v));
    }
    g.fill();
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
