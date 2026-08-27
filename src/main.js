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

  // --- Spawn spacing, in track units (DESIGN.md 7) --------------------------
  SP_LIGHT: 2.5,
  SP_DARK: 4,
  SP_BOOST: 15,

  // --- Speed (DESIGN.md 7) --------------------------------------------------
  SPEED: 1,           // base units per second
  STEP: 0.0333,       // LINEAR, per unit travelled. Never compound.
  CAP: 3,             // 3x base, reached at 40 unicorns

  // --- The world (landscape, 2D play) --------------------------------------
  // Play is flat: the unicorn moves freely in screen x and y while the level
  // scrolls right to left. Objects are still solids, but nothing is at a
  // "depth" any more - there is no lane grid, no tier and no horizon.
  VIEW: 5,            // how many track units span the screen width
  PX0: 0.16,          // where the unicorn starts, fraction of width
  PSPD: 0.75,         // player speed, fractions of screen height per second
  PAD: 0.07,          // keep-out margin at every edge, fraction of height
  OBJ: 0.22,          // object size, fraction of screen HEIGHT (landscape)
  PSZ: 0.195,         // the unicorn's own size
  // Collision is an ELLIPSE around each thing's REAL drawn extent. Using the
  // object slot (OS) as the radius made a prism's hitbox 2.7x the prism, so
  // pickups fired 31px from anything visible.
  SEP: 0.16,          // nothing spawns within this of another, fraction of height.
                      // Three spawners fire off independent distance markers, so
                      // without it two can land on the same frame at the same y.
  HITR: 0.82,         // forgiveness: fraction of the summed visual radii
  PW: 0.5,            // the unicorn's half-width, as a fraction of its size
  PH: 0.42,           // and half-height

  // --- Solid objects (DESIGN.md 5) -----------------------------------------
  // Play is flat, but each OBJECT is real geometry: vertices in its own local
  // space, projected and shaded by face normal. These two are the pitch that
  // projection uses, roughly 40 degrees.
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
  // Flying pose. horse() takes a 0..1 blend, so an animal can leave the ground
  // and return to the gallop without a visible switch.
  FLYF: 1.15,         // front legs reach forward, radians from vertical
  FLYB: -1.05,        // hind legs stream back
  FLYK: 0.12,         // how much knee fold survives. 0 is dead straight.
  // Flight was completely still - legs pinned, bob and nod switched off. It now
  // moves exactly as it does on the ground, 50% faster. Bigger amplitudes and a
  // 3x beat read as thrashing, not flying.
  FLYR: 2.25,            // flight beats per stride
  FLYW: 0.03,         // how far the legs flutter around the flying pose, radians
  FBOB: 0.01,        // body rise and fall in flight
  FBOBR: 2.25,           // ...per stride
  FNOD: 0.012,         // head nod in flight
  FNODR: 2.25,           // ...per stride
  // Bounce. The barrel bob lifts the whole animal and the head nods on top of
  // it, so the head carries both and reads as twice the motion the body has.
  // Rates are cycles per stride: the body beats twice, the head nods once.
  BOB: 0.02,         // barrel rise and fall, body-lengths
  BOBR: 1.5,            // ...per stride
  NOD: 0.024,         // head nod on top of that
  NODR: 1.5,            // ...per stride
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
  PR: 0.0825,         // prism radius across, in object-size units
  PRY: 2.6,           // and its vertical stretch. A regular octahedron reads as
                      // wide, because height foreshortens by PCY and width does
                      // not; stretching y is what makes it a standing crystal.
  ORB: 0.172,          // mystery sphere radius - just over the prism's width
  PSPIN: 2.2,         // prism turns per unit of track

  // --- Feel and the beam ---------------------------------------------------
  GALLOP: 1.5,        // stride cycles per unit of track, so the gait tracks speed
  PARTS: 90,          // particle cap
  GRAV: 900,          // particle gravity, px/s^2
  // The beam is denominated in DISTANCE like everything else in the economy, so
  // holding it costs the same at 1x as at the speed cap. Firing through a dark
  // prism has to cost less than eating one, or there is no decision in it.
  BEAM: 0.55,         // energy per unit of track while firing
  BEAMH: 0.026,        // beam half-height, fraction of screen height
  BEAMY: 0.014,        // where it leaves, relative to the unicorn centre
  BEAMX: 0,       // and how far BEHIND it starts, in unicorn-size units, so
                      // the beam emerges from behind the body rather than at it

  // --- Boosters (DESIGN.md 8) ----------------------------------------------
  // Auto-activate on contact, no held slot. Pickups arrive as mystery spheres
  // marked with a question mark.
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
  HARD_AT: 60,        // units travelled where the speed cap lands and escalation starts
  HARD_TO: 200,       // units where escalation is complete
  // Light prisms thin out, but must stay under LIGHT/DRAIN = 3.0 or perfect play
  // goes energy-negative and the run becomes unsurvivable by arithmetic rather
  // than by skill. At 2.9 the surplus drops from +0.5 to +0.1 a lap: still
  // sustainable, with no margin left for a single mistake.
  SP_LIGHT_HI: 2.9,
  SP_DARK_HI: 2.5,    // dark prisms crowd in
  SP_BOOST_HI: 22,    // mystery spheres thin out as the run goes on

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
  // Landscape sky, built once per resize rather than per frame.
  sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#070a1c');
  sky.addColorStop(0.55, '#131a3c');
  sky.addColorStop(1, '#0a0d1e');
};

// ---------------------------------------------------------------------------
// Screen mapping. Play is 2D now, so there is no depth ramp, no lane grid and
// no horizon - just pixels. The 3D that remains lives INSIDE each object, in
// the solid renderer below.
// ---------------------------------------------------------------------------
const LERP = (a, b, t) => a + (b - a) * t;
const PPU = () => W / C.VIEW;          // pixels per track unit
const OS = () => C.OBJ * H;            // object size
const PAD = () => C.PAD * H;

// ---------------------------------------------------------------------------
// State. Entities are arrays, not objects (DESIGN.md 3):
//   [z, lane, tier, type, phase]  and boosters carry a 6th slot, the booster id.
//   type 0 = horse, 1 = light prism, 2 = dark prism, 3 = booster.
// The array stays sorted far-to-near for free: spawns push at z=0, the near end.
// ---------------------------------------------------------------------------
let ents, parts, dist, energy, over, px, py, vx, vy, fire, flash,
    bSave, bSlow, bLuck, nL, nD, nB, last, fly;

// Personal best, in namespaced localStorage (DESIGN.md 4). Never
// localStorage.clear() - js13k entries share an origin. Private mode throws on
// access, hence the guards.
const BEST = 'rbwd.best';
let best = 0;
try { best = +localStorage[BEST] || 0; } catch (e) {}

const reset = () => {
  ents = []; parts = [];
  dist = 0; energy = C.BAR; over = 0; flash = 0; fire = 0; fly = 1;
  bSave = bSlow = bLuck = 0;
  px = C.PX0 * W; py = H / 2; vx = vy = 0;
  nL = C.SP_LIGHT; nD = C.SP_DARK; nB = C.SP_BOOST;
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
const S_BOOST = [1.3, .02, 440, .01, .1, .3, , 1.8, , , 220, .04, .06, , , , .2];
const S_OVER  = [[N(440), 0], [N(349), 160], [N(262, .9, .35), 320]];          // three notes falling

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
  // The key used to climb with the unicorn count; distance is the run length now.
  return base * 2 ** ((ch[0] + s + min(12, dist / 30 | 0)) / 12);
};

const music = (dt) => {
  if ((mT -= dt) > 0) return;
  const st = 60 / C.BPM / 4;                         // seconds per 16th, fixed tempo
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


// ---------------------------------------------------------------------------
// Input. Arrows or WASD to fly, Space to fire; mouse steers and the left button
// fires. Both routes write the same vx/vy/fire, so there is one movement path
// downstream however you are playing.
// ---------------------------------------------------------------------------
const KEYS = {};
const AXIS = (neg, pos) => (KEYS[pos] ? 1 : 0) - (KEYS[neg] ? 1 : 0);
let mx = 0, my = 0, mouse = 0;

const KD = (e, down) => {
  AC();
  const k = e.key.toLowerCase();
  // Swallow BEFORE the restart check. Behind it, space on the game-over screen
  // both restarted the run and scrolled the page.
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (down && over) return reset();
  KEYS[k] = down;
};

const PT = (e) => {
  AC();
  mx = e.clientX; my = e.clientY;
  if (e.type === 'pointerdown') {
    if (over) return reset();
    mouse = 1;
  }
  if (e.type === 'pointerup') mouse = 0;
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

// ---------------------------------------------------------------------------
// Simulation. The economy still advances on DISTANCE, not wall time, so every
// cost is the same at 1x as at the speed cap - DESIGN.md 7's argument survives
// the change of genre intact. Entities are [x, y, type, phase, boost].
// type 1 = light prism, 2 = dark prism, 3 = mystery sphere.
// ---------------------------------------------------------------------------
const HARD = () => min(1, max(0, (dist - C.HARD_AT) / (C.HARD_TO - C.HARD_AT)));
const isDark = (t) => t === 2 || (t === 1 && bLuck > 0);

const BSUM = C.BW.reduce((a, b) => a + b, 0);
const pickBoost = () => {
  let r = random() * BSUM, i = 0;
  while ((r -= C.BW[i]) >= 0) i++;
  return i;
};

const applyBoost = (b, x, y) => {
  if (b === 0) bSave = C.SAVE_U;
  else if (b === 1) energy = max(energy, C.BAR * C.REFILL);
  else if (b === 2) bSlow = C.SLOW_S;
  else bLuck = C.LUCK_U;
  burst(x, y, 16, OS() * 5);
  sfx(S_BOOST);
};

const step = (dt) => {
  const spd = C.SPEED * min(C.CAP, 1 + C.STEP * dist) * (bSlow > 0 ? C.SLOW_F : 1);
  const dd = spd * dt;                 // track units travelled this frame
  dist += dd;

  // Fire from the keyboard or the left mouse button - one flag either way.
  fire = (KEYS[' '] || mouse) && energy > 0 ? 1 : 0;
  if (bSave <= 0) energy -= dd * C.DRAIN;
  if (fire) energy -= dd * C.BEAM;
  bSave = max(0, bSave - dd);
  bLuck = max(0, bLuck - dd);
  bSlow = max(0, bSlow - dt);
  flash = max(0, flash - dt * 3);
  music(dt);

  // Movement. Keys give a direction; the mouse steers toward the pointer. Both
  // land in the same vx/vy, so nothing downstream knows which was used.
  let ax = AXIS('arrowleft', 'arrowright') + AXIS('a', 'd');
  let ay = AXIS('arrowup', 'arrowdown') + AXIS('w', 's');
  if (!ax && !ay && mouse) { ax = (mx - px) / (W * 0.25); ay = (my - py) / (H * 0.25); }
  const al = hypot(ax, ay);
  if (al > 1) { ax /= al; ay /= al; }
  const sp = C.PSPD * H;
  px = min(W - PAD(), max(PAD(), px + ax * sp * dt));
  py = min(H - PAD(), max(PAD(), py + ay * sp * dt));

  const dx = dd * PPU();               // pixels the world slides left this frame
  const os = OS(), ps = C.PSZ * H;
  const prx = ps * C.PW, pry = ps * C.PH;
  const beamY = py + C.BEAMY * H, beamH = C.BEAMH * H;
  // Each type's own drawn extents, so a hit means the shapes actually met.
  const RX = (t) => (t === 3 ? C.ORB : C.PR) * os;
  const RY = (t) => (t === 3 ? C.ORB : C.PR * C.PRY * C.PCY) * os;

  for (let i = ents.length; i--;) {
    const o = ents[i];
    o[0] -= dx;
    // The beam clears anything ahead of the horn that crosses its band. It
    // destroys rather than collects, so burning a light prism is a real loss.
    if (fire && o[0] > px && abs(o[1] - beamY) < beamH + RY(o[2])) {
      burst(o[0], o[1], 8, os * 4, isDark(o[2]) ? '#7b3ab6' : '#ffe9a0');
      ents.splice(i, 1);
      continue;
    }
    const ex = (o[0] - px) / ((RX(o[2]) + prx) * C.HITR);
    const ey = (o[1] - py) / ((RY(o[2]) + pry) * C.HITR);
    if (ex * ex + ey * ey < 1) {
      if (o[2] === 3) applyBoost(o[4], o[0], o[1]);
      else {
        const dark = isDark(o[2]);
        energy = min(C.BAR, energy + (dark ? C.DARK : C.LIGHT));
        burst(o[0], o[1], 10, os * 4, dark ? '#7b3ab6' : '#ffe9a0');
        sfx(dark ? S_DARK : S_LIGHT);
        if (dark) flash = 1;
      }
      ents.splice(i, 1);
      continue;
    }
    if (o[0] < -os) ents.splice(i, 1);
  }

  for (let i = parts.length; i--;) {
    const p = parts[i];
    p[0] += p[2] * dt - dx;            // particles ride the scroll
    p[1] += p[3] * dt;
    p[3] += C.GRAV * dt;
    if ((p[4] += dt) > p[5]) parts.splice(i, 1);
  }

  // Spawners are distance-driven, same as the economy.
  const h = HARD(), sx = W + os, lo = PAD() + os, hi = H - PAD() - os, sep = C.SEP * H;
  // Find a slot nothing is already sitting in. If the mouth of the field is
  // crowded, skip the spawn rather than stack two objects on one another - the
  // distance marker has already advanced, so it simply does not appear.
  const ry = () => {
    for (let k = 0; k < 8; k++) {
      const y = lo + random() * (hi - lo);
      if (!ents.some((o) => abs(o[0] - sx) < sep && abs(o[1] - y) < sep)) return y;
    }
    return -1;
  };
  const put = (t, b) => { const y = ry(); if (y > 0) ents.push([sx, y, t, random(), b]); };
  while (dist >= nL) { nL += LERP(C.SP_LIGHT, C.SP_LIGHT_HI, h); put(1); }
  while (dist >= nD) { nD += LERP(C.SP_DARK, C.SP_DARK_HI, h);   put(2); }
  while (dist >= nB) { nB += LERP(C.SP_BOOST, C.SP_BOOST_HI, h); put(3, pickBoost()); }

  if (energy <= 0) {
    energy = 0; over = 1;
    seq(S_OVER);
    const sc = dist | 0;
    if (sc > best) { best = sc; try { localStorage[BEST] = best; } catch (e) {} }
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

const horse = (cx, gy, s, ph, u, fly = 0) => {
  const A = PI + C.YAW * PI / 180;
  CO = cos(A); SI = sin(A); SX = cx; SY = gy; SS = s * C.ASC;
  const th = ph * 2 * PI, bd = BODY[u], R = C.LEGR;
  // Ground and flight each have their own amplitude and rate; fly blends between
  // them. Zeroing both in flight left the animal completely static.
  const by = 0.56 + sin(th * LERP(C.BOBR, C.FBOBR, fly)) * LERP(C.BOB, C.FBOB, fly);
  const hb = sin(th * LERP(C.NODR, C.FNODR, fly) + 1) * LERP(C.NOD, C.FNOD, fly);
  const fine = s > C.LOD;

  for (const [side, hind] of LEGS) {                // four legs, two segments each
    const L = C.LEGL;
    const t = th + ((hind ? C.PHH : 0) + (side < 0 ? C.PHS : 0)) * 2 * PI;
    // Gallop and flight are the same rig: blend the hip angle toward a fixed
    // reach and straighten the knee. At fly = 0 this is exactly the old gallop.
    const ga = sin(t) * C.SWING + (hind ? C.HTILT : 0);
    const gb = (1 - cos(t)) * C.FOLD * (hind ? C.HFOLD : -1);
    // The flying pose flutters rather than holding rigid, with the two sides
    // offset so the pair is not in lockstep.
    const fa = (hind ? C.FLYB : C.FLYF) + sin(th * C.FLYR + (side < 0 ? 1.6 : 0)) * C.FLYW;
    const a = LERP(ga, fa, fly);
    const b = LERP(gb, gb * C.FLYK, fly);
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
const LGT = [-0.42, 0.76, -0.5];                  // light direction, unit-ish
const PCOL = [[255, 255, 255], [150, 84, 226]];   // light prism, dark prism

const prism = (cx, cy, s, a, dark) => {
  const co = cos(a), si = sin(a), r = s * C.PR, q = C.PRY, c = PCOL[dark];
  const nl = (2 * q * q + 1) ** 0.5;
  for (let i = 0; i < 8; i++) {
    const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1;
    // Stretching y makes the face normal (sx*q, sy, sz*q). The sign-vector
    // shortcut is only exact for a REGULAR octahedron, and this is a crystal.
    const nx = sx * q * co - sz * q * si, nz = sx * q * si + sz * q * co;
    if (nz * C.PCY >= sy * C.PCZ) continue;                 // faces away from the camera
    g.fillStyle = shade(c, 0.34 + 0.66 * max(0, (nx * LGT[0] + sy * LGT[1] + nz * LGT[2]) / nl));
    g.beginPath();
    g.moveTo(cx + sx * r * co, cy - sx * r * si * C.PCZ);   // (sx, 0, 0)
    g.lineTo(cx,               cy - sy * r * q * C.PCY);    // (0, sy, 0) - stretched
    g.lineTo(cx - sz * r * si, cy - sz * r * co * C.PCZ);   // (0, 0, sz)
    g.fill();
  }
};

// A mystery sphere: a rainbow-rimmed orb with a question mark, per DESIGN.md 8.
const orb = (cx, cy, s) => {
  g.fillStyle = '#0d1b3a';
  g.beginPath(); g.arc(cx, cy, s * C.ORB, 0, 7); g.fill();
  g.lineWidth = s * 0.05;
  g.strokeStyle = RB[(dist * 4 | 0) % 6];
  g.stroke();
  g.fillStyle = '#fff';
  g.font = 'bold ' + s * 0.26 + 'px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', cx, cy);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
};

// The rainbow beam. Six stacked bands leaving the horn, rippling along their
// length so it reads as light being poured rather than a drawn rectangle.
const beam = () => {
  const y0 = py + C.BEAMY * H, hh = C.BEAMH * H, x0 = px + C.PSZ * H * C.BEAMX;
  // One continuous polygon per band, down one edge and back along the other.
  // Drawing it as a row of rects meant every segment sat at its own wave offset,
  // so each boundary showed as a vertical step - the beam looked shredded.
  const n = 6, seg = 20, dx = (W - x0) / seg;
  const wav = (x) => sin(x / W * 9 - dist * 14) * hh * 0.18;
  for (let b = 0; b < n; b++) {
    const yA = -hh + (b * 2 * hh) / n, yB = yA + (2 * hh) / n * 1.08;   // 8% overlap
    g.fillStyle = shade(RBV[b], 0.7 + 0.3 * cos(dist * 12 + b));
    g.globalAlpha = 0.55 + 0.45 * (1 - b / n);
    g.beginPath();
    for (let i = 0; i <= seg; i++) {
      const x = x0 + i * dx, y = y0 + yA + wav(x);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    for (let i = seg; i >= 0; i--) { const x = x0 + i * dx; g.lineTo(x, y0 + yB + wav(x)); }
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

const hud = () => {
  const bw = W - 24;
  g.fillStyle = '#000';
  g.fillRect(12, 12, bw, 14);
  const fw = bw * energy / C.BAR;
  for (let i = 0; i < 6; i++) {
    const x0 = bw / 6 * i;
    if (x0 >= fw) break;
    g.fillStyle = RB[i];
    g.fillRect(12 + x0, 12, min(bw / 6, fw - x0), 14);
  }
  g.fillStyle = '#fff';
  g.font = '16px monospace';
  g.fillText('DISTANCE ' + (dist | 0), 12, 48);
  if (best) { g.fillStyle = '#8a93b8'; g.fillText('BEST ' + best, 12, 68); }

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

  if (flash > 0) {
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
    g.fillText((dist | 0) + ' DISTANCE', 20, H / 2 - 8);
    g.font = '16px monospace';
    g.fillStyle = (dist | 0) >= best && dist >= 1 ? '#ffd60a' : '#8a93b8';
    g.fillText((dist | 0) >= best && dist >= 1 ? 'NEW BEST' : 'BEST ' + best, 20, H / 2 + 14);
    g.fillStyle = '#fff';
    g.fillText('press any key or click to run again', 20, H / 2 + 36);
  }
};

const render = () => {
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  if (fire) beam();
  const s = OS();
  for (const o of ents) {
    if (o[2] === 3) orb(o[0], o[1], s);
    else prism(o[0], o[1], s, dist * C.PSPIN + o[3] * 7, isDark(o[2]) ? 1 : 0);
  }
  // The player: a unicorn in the flying pose, facing the way it travels.
  horse(px, py + C.PSZ * H * 0.45, C.PSZ * H, dist * C.GALLOP, 1, fly);
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
addEventListener('pointerup', PT);
addEventListener('keydown', (e) => KD(e, 1));
addEventListener('keyup', (e) => KD(e, 0));
resize();
reset();
last = 0;
requestAnimationFrame(frame);
