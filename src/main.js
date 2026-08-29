// js13kGames 2026 - stationary first-person roguelike wave shooter.
//
// Build order (DESIGN.md 15) steps 1-3. Step 2 was the renderer; step 3 is the
// core loop, ugly: camera yaw, ghosts spawning and closing, the puppet firing
// horns, collision, hearts, death, restart. No bind, no minimap, no ghost types,
// no waves, no upgrade cards, no audio - those are steps 5 to 9.
//
// CONVENTIONS, fixed here once because everything downstream depends on them:
//
//   +x right, +y DOWN, +z forward (away from the camera).
//   y-down is not a preference. DESIGN.md 5 specifies `py = y*s + h/2`, and that
//   formula only puts a model the right way up if world y already points down.
//
//   The camera sits at the origin and never translates (DESIGN.md 5). It only
//   rotates: yaw right-positive, pitch up-positive.
//
//   World units are metres. F is the focal length in metres and PX converts
//   metres to pixels, so the same scene frames identically at any window size -
//   that scale factor is the only thing added to the spec's projection.

const { min, max, abs, cos, sin, tan, atan2, hypot, random, PI } = Math;

export const C = {
  // --- Projection ------------------------------------------------------------
  F: 1.2,             // focal length, metres. With ZOOM this sets the field of
                      // view: tan(halfFOV) = W / (2 * PX * F), about 73 degrees
                      // horizontal at 16:9.
  ZOOM: 1,            // metres-to-pixels is ZOOM * screen height
  NEAR: 0.05,         // metres. Anything nearer is dropped rather than clipped.

  // --- Flat shading (DESIGN.md 5: three discrete steps, no gradients) --------
  LGT: [-0.42, -0.80, 0.43],   // above-front-left. -y is up, so this points down.
  T0: 0.18,           // dot thresholds between the three steps
  T1: 0.62,
  STEP: [0.42, 0.70, 1],       // and the three brightnesses they select

  // --- Camera (DESIGN.md 12) -------------------------------------------------
  TURN: 0.0042,       // radians per pixel of drag. THE difficulty knob: slow
                      // turning against 360 degrees of threat is the whole
                      // tension, and fast turning throws it away.
  PITCHMAX: 0.55,     // radians up and down

  // --- The world (DESIGN.md 14: dark field, dark sky, faint horizon) --------
  SKY: '#05060e',
  GND: '#0a0b10',
  HORIZ: '#1b2036',

  // --- The puppet (DESIGN.md 6) ---------------------------------------------
  // The mesh is the unicorn head and neck from the previous game, recovered from
  // git rather than redrawn: it was tuned over many rounds in a purpose-built
  // editor, and none of that work is invalidated by the genre change. Only the
  // body, legs and tail are gone - a puppet is a head and a neck.
  // Pose solved against four things at once rather than set by eye: the horn has
  // to point where the shots go, the neck's arm opening has to sit below the
  // frame so there is no hole to see into, the silhouette has to reach the right
  // side, and half the screen height has to be VISIBLE - measuring the whole
  // bounding box once scored a buried puppet at 60% tall.
  PUP: [0.96, 1.02, 0.7],      // camera-space placement
  PUPS: 2.7,          // scale applied to the model's own units
  PUPA: -0.092,       // yaw. Solved, not chosen: this is the value that puts the
                      // horn's line through the middle of the screen.
  PUPB: -0.2945,      // pitch, solved with it - yaw only moves the crosshair
                      // sideways, and it was 59px high. The pose is otherwise
                      // yours to set from the view a player
                      // sees; the servo below takes care of the aim, so nothing
                      // here has to be traded against it. The editor reads out
                      // where the neck's opening lands, as a warning, not a rule.

  // Group placement. The table is one row per part, but on a real animal the
  // head, its horn and its eyes move together - nudging the head row alone
  // leaves its own horn behind. These are applied on the way out of the table,
  // so one slider moves everything attached. Step 9 needs exactly these handles
  // anyway: recoil offsets the head group, and a blink flattens the eyes.
  HEADO: [0, -0.036, -0.064],  // head group: sideways, up, forward
  HEADS: 1,           // and its scale
  HEADR: [0, 0, 0],   // and its rotation about the joint where it meets the neck:
                      // pitch, yaw, roll. The pivot is derived from the head row
                      // rather than stored, so a retuned neck keeps the joint.
  // Eyes are discs on the flanks of the head, not rows in the table. They were
  // swept boxes, which at this size reads as a rectangular stud rather than an
  // eye. A ten-sided disc is round enough at a few pixels across and is still
  // made of the hard-edged polygons DESIGN.md 5 asks for - no rounded primitive.
  // Placed against the head rather than in model coordinates, so they stay on it
  // when the head is retuned:
  EYES: [0.028, 0.37, 0.78, 0.028, 0.005],
                      // up, how far along the head, how far out as a multiple of
                      // the head's own half-width there, radius, and how far the
                      // disc stands proud
  BODY: [246, 245, 252],       // the unicorn is white
  GOLD: [255, 214, 10],        // the horn. The brightest single thing on screen.
  IRIS: [58, 150, 255],        // blue eyes
  // The mane is placed as ONE thing: where its middle sits along the neck and how
  // much of the neck it covers. It used to be a first position and a last one,
  // which meant moving the mane took two sliders that had to be moved by the same
  // amount in the same direction, and any slip re-spread it instead.
  // The mane sits ON the top face of the neck and nowhere else. The old one was
  // swept from a point 60% of the way out from the neck's axis - inside the neck,
  // not on it - along a crest direction computed from the raw table row rather
  // than the posed one. Rebuilt: every tuft is rooted exactly on the surface the
  // neck actually has, at the width it actually has there.
  MANEN: 5,           // tufts
  MANEC: 0.45,        // where the middle of the mane sits, 0 = base, 1 = poll
  MANEW: 0.7,         // and how much of the neck it covers
  MANEH: 0.09,        // how far each tuft rises off the surface
  MANEB: 0.01,        // and how far it sweeps back while it does. A mane lies
                      // back along the neck; straight up reads as a fin.
  MANER: 0.01,        // tuft thickness - a maximum, clamped to leave a gap
  MANEG: 0.31,        // that clamp, as a fraction of a tuft's own slot
  MANEP: 0.04,        // tip thickness as a fraction of the root. Low is pointy.

  // The rainbow IS the cooldown readout (DESIGN.md 6): fully coloured means the
  // bind is ready, washed out means it is recharging, and there is no bar to
  // draw anywhere. DESIGN.md put that on a casting arm; with the arm gone and
  // the unicorn casting instead, the rainbow it runs on is the MANE.
  SAT0: 0.12,         // how much colour is left at the moment of casting

  // --- The bind (DESIGN.md 6) ------------------------------------------------
  // Centred on the player, not in front of them. Hold to charge, release to cast
  // at whatever radius you have grown.
  BINDCHG: 3,         // seconds to a full charge. It fires ITSELF at that point -
                      // holding longer buys nothing, so the charge is a window,
                      // not a resource you can sit on.
  BINDCD: 9,          // seconds of cooldown a full-strength cast costs. An upgrade
                      // card. You cannot begin a new charge while any is owed.
  BINDR: 9,           // the biggest radius a full charge buys, metres. A card.
  BINDDUR: 3,         // how long a caught ghost is held. A card.
  KTURN: 2.2,         // radians a second of keyboard turn. DESIGN.md 12 calls turn
                      // speed the primary difficulty knob, so this is the same
                      // knob TURN is, in the units a key can be held in.
  ARM: 0.3,           // seconds of holding still before the charge begins. The
                      // start of every press is free for turning, so a drag never
                      // charges by accident.
  ARMPX: 8,           // pixels from where the press landed that make it a turn and
                      // nothing else. Measured as distance from that point, not
                      // distance travelled: a hand shaking in place covers a lot
                      // of the second but goes nowhere, and only going somewhere
                      // means you meant to turn.
  BINDSEG: 44,        // segments in a drawn circle
  EYE: 1.6,           // how high the eye is above the ground the ring lies on
  // The charge is the rainbow lying on the ground, pulsing outward.
  BINDBAND: 10,       // filled bands it is drawn as, all the same width, edge to
                      // edge - so the disc is covered rather than ringed
  BINDA: 0.55,        // the brightest a band gets
  RIMW: 0.35,         // width of the circle marking where the wave will end, metres
  RIMA: 0.85,         // and its brightness at the moment it fires
  RIMFI: 0.35,        // seconds it fades in over. Hung on the charge rather than
                      // on the arming window: the fade is worth having, but only
                      // once there is a charge to announce.
  RIMC: [34, 201, 255],        // cyan - the rainbow's own, so it stays in palette
  BINDWAV: 2.2,       // wave crests across the radius
  BINDPUL: 0.9,       // crests per second, travelling outward
  // And the cast is a wall of it, sweeping out to the radius it caught.
  WALLDUR: 0.45,      // seconds the wall lives
  WALLH: 2.4,         // how tall ONE rainbow stands, metres
  WALLREP: 2,         // how many times it repeats up the wall, so the whole thing
                      // is WALLH * WALLREP tall
  WALLA: 0.9,         // its brightness at the moment of the cast
  EYERB: 9,           // rainbow colours a second the eyes run while charging

  // --- Outline ---------------------------------------------------------------
  // A dark edge on the neck and head only. They are one colour meeting one
  // colour, so without it the joint between them is invisible; the horn, eyes and
  // mane already separate themselves by being a different colour entirely.
  OUTL: 0.0022,       // width, as a fraction of screen height. Thin on purpose.
  OUTA: 0.5,          // and its opacity

  // --- Animation (DESIGN.md 6) ----------------------------------------------
  RECOIL: 0.3,        // metres the puppet kicks back along its OWN axis on firing.
                      // Measured on screen: 0.1 moves the horn tip 5px, 0.3 moves
                      // it 16px, 0.6 moves it 35px.
  RECT: 0.16,         // and the seconds it takes to ease back out
  BLINKD: 0.11,       // how long a blink lasts
  BLINK0: 2,          // and the window between them, seconds. Randomised, because
  BLINK1: 5,          // a blink on a fixed timer reads as a machine.
  BLINKS: 0.05,       // how far the eye closes: its own height, times this

  // --- Horns (DESIGN.md 6: travel time, not hitscan) ------------------------
  FIRE: 1,            // seconds between shots at fire rate level 1. The puppet
                      // fires on its own at this cadence - the trigger is not a
                      // trigger. DESIGN.md 9 makes fire rate an upgrade card, so
                      // this is the slowest the gun ever is, and the pointer is
                      // left free for aiming and, at step 5, the bind.
  HSPD: 26,           // metres per second
  HLIFE: 1.2,         // seconds before it expires
  HHIT: 0.5,          // metres, collision radius against a ghost centre
  HW: 0.035,          // the flying horn's own radius at its base
  HL: 0.3,            // and its length, metres
  HN: 7,              // sides on it. It is a cone - a horn is round - and a box
                      // swept to a point is a pyramid, which is what it was.
  CONV: 9,            // metres. Where a shot goes when nothing is under the
                      // crosshair. The muzzle sits over a metre off the camera
                      // axis - a worn puppet has to sit where a hand is - so a
                      // shot on a fixed direction crosses the crosshair's line at
                      // exactly one range. It aims at the RANGE of whatever is
                      // under the crosshair instead, and this is the fallback.
                      //
                      // The puppet itself does not move to aim. It used to turn
                      // to keep the horn on target, which worked and looked like
                      // the puppet chasing ghosts around the screen.
  AIMR: 0.2,          // how far off the middle of the screen a ghost may be and
                      // still count as the thing you are aiming at, in radians
  MUZZ: 0.9,          // metres. A viewmodel is fake-scaled: at the on-screen size
                      // this puppet wants, its horn tip is two and a half metres
                      // in front of the eye - so a ghost closer than that could
                      // not be shot AT ALL, and ghosts reach you at 1.1m. The
                      // shot starts from the point at THIS depth that projects
                      // exactly where the tip does. Simply scaling the tip toward
                      // the eye does not do that: s = F/(F+z) is a fake
                      // perspective, not a pinhole, so points on a ray through the
                      // origin do NOT share a projection - measured, that put the
                      // spawn 78px inboard of the horn.

  // --- Ghosts (DESIGN.md 7) --------------------------------------------------
  // One generator, parameters per type. Only the Drifter exists at step 3; the
  // other four are the same numbers with different values (step 7).
  ARENA: 16,          // metres. Spawn ring radius.
  GY: 0.15,           // metres below eye level they float
  GBOB: 0.09,         // bob amplitude
  GBOBR: 1.7,         // bob rate
  GCONTACT: 1.1,      // metres. Closer than this and it reaches you.
  GW: 0.82,           // half-width as a fraction of the radius: a shade taller
                      // than wide, like the reference
  GDOME: 12,          // segments in the dome. It is a real arc, not a modulated
                      // circle, so this only controls how round it looks
  SPIKE: 0.3,         // how far a notch cuts up from the tips, as a fraction of
                      // the radius
  SHRUGD: 0.5,        // seconds a Warden shows the ring failing on it
  // DESIGN.md 7: one generator, five parameter rows. Columns are
  //   hp, speed x, damage, cost, unlocks at wave, radius m, wobble, wobble
  //   frequency, wisps, colour
  // Cost and the unlock wave belong to step 8's threat budget and are carried
  // here because they are properties of the type, not of the spawner.
  GSPEED: 1,          // metres a second at speed 1.0x
  TYPES: [
    [3,  1.0, 1, 1,  1, 0.44, 0.05, 3, 5, [214, 222, 240]],   // Drifter, pale white
    [2,  1.8, 1, 2,  3, 0.34, 0.04, 4, 4, [34, 201, 255]],    // Darter, sharp cyan
    [10, 0.5, 3, 5,  5, 0.80, 0.07, 3, 7, [255, 72, 76]],     // Hulk, angry red
    [6,  0.8, 1, 4, 10, 0.56, 0.08, 5, 6, [96, 214, 118]],    // Splitter, sickly green
    [8,  0.7, 2, 6, 20, 0.64, 0.04, 3, 6, [235, 205, 130]],   // Warden, pale gold
  ],
  SPLIT: 3,           // the Splitter's row: dies into two Drifters
  WARDEN: 4,          // the Warden's row: the bind cannot hold it
  SPLITD: 0.5,        // how far apart the two children appear, metres

  // --- Waves (DESIGN.md 8) ----------------------------------------------------
  // One formula, so the whole difficulty curve is tuned from one place. Wave 1 is
  // BUD0, and every wave after adds BUDG.
  BUD0: 6,            // wave 1's threat budget: six Drifters, at a cost of 1 each
  BUDG: 3,            // and what each later wave adds
  WAVEGAP: 2,         // seconds of quiet between a cleared wave and the next
                      // hp, speed, damage, radius, hem wobble, wobble freq, hue
  GFADE: 0.34,        // opacity floor: a nearly-dead ghost is this faint
  GFLASH: 0.11,       // seconds of white on a hit
  XHR: 0.018,         // crosshair arm, as a fraction of the smaller dimension
  XHW: 3.5,           // and its thickness
  XHA: 0.9,           // and its opacity. Gold, like the horn it sits on the line of
  ASSISTR: 1.6,       // aim assist reaches this many of a ghost's radii - wider
                      // than the pick, so it pulls you onto things you are only
                      // near, and stops the moment you are on one
  ASSIST: 3,          // and closes that much of the gap a second
  BARSLW: 3,          // the charging outline, px
  BARSC: '#fff',
  TGTR: 0.9,          // how much of a ghost's own radius counts as "on it". Under
                      // 1, so the crosshair has to be inside the body rather than
                      // anywhere near it
  TGTW: 4,            // the target outline, px. It traces the ghost's own
                      // silhouette rather than circling it, so what is lit up is
                      // the thing you are about to shoot and not a hoop near it

  // --- Player (DESIGN.md 10) -------------------------------------------------
  // --- Minimap (DESIGN.md 11) ------------------------------------------------
  MAPR: 0.1104,       // dish radius as a fraction of screen height. 0.221H
                      // across, back inside 11's roughly a quarter of H cap.
  MAPPAD: 14,         // pixels in from the top-left corner
  MAPZ: 1.06,         // how far past the spawn ring the dish reaches, so a ghost
                      // arriving sits inside the rim rather than on it
  MAPBLIP: 0.07,      // blip radius, as a fraction of the dish
  MAPEW: 3,           // the dish edge, px
  MAPFANW: 2,         // and the two sides of the view fan
  MAPBG: 'rgba(6,8,16,0.72)',
  MAPEDGE: 'rgba(139,147,184,0.6)',
  MAPCONE: 'rgba(255,255,255,0.09)',
  MAPFAN: 'rgba(255,255,255,0.3)',

  // --- HUD -------------------------------------------------------------------
  HUDU: 0.036,        // the unit everything in the HUD is sized off, a fraction
                      // of the smaller screen dimension
  HEARTS2: 2,         // hearts drawn at this multiple of it
  WAVEF: 1.6875,      // the wave counter, as a multiple of the unit
  KILLF: 0.775,       // the kill count, and READY, which matches it
  BARN: 5,            // the rainbow bar is as wide as this many hearts would be,
                      // so it runs out past the left of the three that are there
  BARH: 0.3,          // its height, as a fraction of a heart's
  BARGAP: 0.55,       // and the gap under the hearts, so it does not crowd them
  BARBG: 'rgba(255,255,255,0.1)',

  HEARTS: 3,
  DMGCAP: 3,          // no single contact may take more than this
  SHAKEA: 7,          // px the whole view kicks by at full shake
  HURTD: 0.28,        // seconds of red over the screen when something reaches you
  HURTA: 0.42,        // and how red it gets at the moment of the hit
  HURTC: [255, 40, 60],
  IFRAME: 0.6,        // seconds of grace after a hit, so a clump cannot chain
  SPAWN: 1.5,         // seconds between spawns. Step 8 replaces this with waves.
};

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------
let g = document.getElementById('c').getContext('2d');
export const setCtx = (x) => (g = x);          // test seam; dropped from the app build

let W, H, PX;
const resize = () => {
  const d = min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  const cv = g.canvas;
  cv.width = W * d; cv.height = H * d;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  g.setTransform(d, 0, 0, d, 0, 0);
  PX = C.ZOOM * H;
};

// ---------------------------------------------------------------------------
// Camera. Origin-fixed; yaw then pitch, world into camera space.
// ---------------------------------------------------------------------------
let yaw = 0, pitch = 0;
let cy = 1, sy = 0, cp = 1, sp = 0;
const aim = () => { cy = cos(yaw); sy = sin(yaw); cp = cos(pitch); sp = sin(pitch); };

// Increasing yaw sends the world left, so the view turns right; increasing pitch
// sends it down, so the view looks up.
export const cam = (p) => {
  const x = p[0] * cy - p[2] * sy;
  const z = p[0] * sy + p[2] * cy;
  return [x, p[1] * cp + z * sp, z * cp - p[1] * sp];
};

// The exact inverse, for turning a camera-space point - the horn's muzzle - back
// into the world it has to fly through.
export const unCam = (p) => {
  const z = p[1] * sp + p[2] * cp;
  return [p[0] * cy + z * sy, p[1] * cp - p[2] * sp, z * cy - p[0] * sy];
};

// DESIGN.md 5: s = f/(f+z), px = x*s + w/2, py = y*s + h/2.
export const proj = (p) => {
  const s = C.F / (C.F + p[2]);
  return [p[0] * s * PX + W / 2, p[1] * s * PX + H / 2];
};

// ---------------------------------------------------------------------------
// Primitives. Each generator pushes convex polygons onto FACES.
//
// Normals are derived, never written down, and then oriented against a point the
// generator knows is inside the solid. Deriving alone is not enough: two of the
// six faces in the first box table were wound the wrong way round and came out
// facing inward, which silently inverted back-face culling. Orienting against an
// interior point makes an outward normal structural rather than something six
// hand-written vertex orders all have to get right.
// ---------------------------------------------------------------------------
export let FACES = [];
// Set around a part to have its faces outlined. A flag rather than a parameter
// because it would otherwise have to be threaded through every generator.
let OUT = 0;
const ID = (x, y, z) => [x, y, z];             // for geometry already in the space it is wanted in

const push = (vs, col, ins) => {
  const [a, b, c] = vs;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const L = hypot(nx, ny, nz) || 1;
  nx /= L; ny /= L; nz /= L;
  let ax = 0, ay = 0, az = 0;
  for (const v of vs) { ax += v[0]; ay += v[1]; az += v[2]; }
  const k = vs.length;
  if ((ax / k - ins[0]) * nx + (ay / k - ins[1]) * ny + (az / k - ins[2]) * nz < 0) {
    nx = -nx; ny = -ny; nz = -nz;
  }
  FACES.push([vs, nx, ny, nz, col, OUT]);
};

// A frame: an origin and three axes already scaled to the half-extents wanted.
// Every primitive takes one, so a part can be leant, twisted or squashed without
// the generator knowing anything about it.
export const frame = (o, r, u, f) => [o, r, u, f];
const at = (M, a, b, c) => [
  M[0][0] + M[1][0] * a + M[2][0] * b + M[3][0] * c,
  M[0][1] + M[1][1] * a + M[2][1] * b + M[3][1] * c,
  M[0][2] + M[1][2] * a + M[2][2] * b + M[3][2] * c,
];

const QUADS = [
  [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]],
  [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]],
  [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]],
  [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]],
  [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
];
export const box = (M, col) => {
  for (const q of QUADS) push(q.map((v) => at(M, v[0], v[1], v[2])), col, M[0]);
};

// A cone: n side triangles to the apex, plus an n-gon base. Radius 1 in the
// frame's r/f plane, base at -1 along u and apex at +1, so the frame's own origin
// is inside it. Taper is the frame's job, not the generator's.
export const cone = (M, n, col, X = ID) => {
  const tip = X(...at(M, 0, 1, 0)), ring = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI;
    ring.push(X(...at(M, cos(a), -1, sin(a))));
  }
  const ins = X(...M[0]);
  for (let i = 0; i < n; i++) push([ring[i], tip, ring[(i + 1) % n]], col, ins);
  push(ring, col, ins);
};

// A box swept between two points with independent half-extents at each end. Taper
// one end and it is a cone; taper it almost to nothing and it is a horn. This is
// the primitive the recovered part table is expressed in, so it comes back with
// it. T maps the model's own space into the space the faces are wanted in.
//
// u is the lateral axis with the part's direction projected out of it. Building
// the cross-section from dy and dz alone was fine while every part lay in the
// sagittal plane, but a part leaning sideways then came out sheared, with side
// normals wrong for both shading and culling.
export const swept = (T, ax, ay, az, bx, by, bz, w0, h0, w1, h1, col, roll = 0) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = hypot(dx, dy, dz) || 1;
  const px = dx / L, py = dy / L, pz = dz / L;
  let ux = 1 - px * px, uy = -px * py, uz = -px * pz;
  const uL = hypot(ux, uy, uz) || 1;
  ux /= uL; uy /= uL; uz /= uL;
  let vx = py * uz - pz * uy, vy = pz * ux - px * uz, vz = px * uy - py * ux;
  // Roll twists the cross-section about the part's own axis. Without it the frame
  // is derived entirely from the direction, so a rolled part moves but never
  // turns - the head would lean while staying resolutely upright.
  if (roll) {
    const c2 = cos(roll), s2 = sin(roll);
    const tx = ux * c2 + vx * s2, ty = uy * c2 + vy * s2, tz = uz * c2 + vz * s2;
    vx = vx * c2 - ux * s2; vy = vy * c2 - uy * s2; vz = vz * c2 - uz * s2;
    ux = tx; uy = ty; uz = tz;
  }
  const V = (x, y, z, su, sv, w, h) => T(x + su * w * ux + sv * h * vx,
                                         y + su * w * uy + sv * h * vy,
                                         z + su * w * uz + sv * h * vz);
  const A = (su, sv) => V(ax, ay, az, su, sv, w0, h0);
  const B = (su, sv) => V(bx, by, bz, su, sv, w1, h1);
  const ins = T((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  push([A(1, 1), A(1, -1), B(1, -1), B(1, 1)], col, ins);
  push([A(-1, 1), B(-1, 1), B(-1, -1), A(-1, -1)], col, ins);
  push([A(1, 1), B(1, 1), B(-1, 1), A(-1, 1)], col, ins);
  push([A(1, -1), A(-1, -1), B(-1, -1), B(1, -1)], col, ins);
  push([A(1, 1), A(-1, 1), A(-1, -1), A(1, -1)], col, ins);
  push([B(1, 1), B(1, -1), B(-1, -1), B(-1, 1)], col, ins);
};

// ---------------------------------------------------------------------------
// Draw. Painter's algorithm: cull what faces away, sort far to near, fill flat.
// ---------------------------------------------------------------------------
export const shade = (col, nx, ny, nz, k2 = 1) => {
  const d = nx * C.LGT[0] + ny * C.LGT[1] + nz * C.LGT[2];
  const k = C.STEP[d > C.T1 ? 2 : d > C.T0 ? 1 : 0] * k2;
  return 'rgb(' + (col[0] * k | 0) + ',' + (col[1] * k | 0) + ',' + (col[2] * k | 0) + ')';
};

// `world` false means the faces are already in camera space - the viewmodel,
// which is fixed to the camera and so is lit in camera space too. Lighting it in
// world space would make the puppet's own shading swing every time you turned,
// which is exactly the flicker DESIGN.md 6 wants avoided on the best-lit object
// in the game.
export const flush = (world = 1) => {
  const draw = [];
  for (const f of FACES) {
    const vs = world ? f[0].map(cam) : f[0];
    let near = 0, z = 0;
    for (const v of vs) { if (v[2] < C.NEAR) near = 1; z += v[2]; }
    if (near) continue;
    // Cull back faces: the camera sits at the origin, so any vertex doubles as
    // the view vector to the face.
    const n = world ? cam([f[1], f[2], f[3]]) : [f[1], f[2], f[3]];
    if (n[0] * vs[0][0] + n[1] * vs[0][1] + n[2] * vs[0][2] >= 0) continue;
    draw.push([z / vs.length, vs, shade(f[4], f[1], f[2], f[3]), f[5]]);
  }
  // DESIGN.md 5 says the viewmodel is not depth sorted - meaning not sorted
  // against the world, which it never is: it is drawn afterwards, on top. Its own
  // parts still have to occlude each other, or the horn draws through the head.
  draw.sort((a, b) => b[0] - a[0]);
  g.lineWidth = C.OUTL * H;
  g.strokeStyle = 'rgba(0,0,0,' + C.OUTA + ')';
  for (const d of draw) {
    g.fillStyle = d[2];
    g.beginPath();
    for (const v of d[1]) {
      const p = proj(v);
      g.lineTo(p[0], p[1]);
    }
    g.closePath();
    g.fill();
    if (d[3]) g.stroke();
  }
  FACES = [];
  return draw.length;
};

const RBV = [[255, 59, 107], [255, 149, 0], [255, 214, 10], [58, 211, 95], [34, 201, 255], [180, 92, 255]];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
// ghost: [x, y, z, hp, maxhp, flash, phase, type]
// horn:  [x, y, z, dx, dy, dz, life]
let ghosts, horns, hearts, kills, over, fireT, spawnT, inv, clock, last, shake,
    rec, blink, nextB, bindT, bindC, charging, wallT, wallR, wave, budget, waveT, hurtT;

const reset = () => {
  ghosts = []; horns = [];
  hearts = C.HEARTS; kills = 0; over = 0;
  wave = 1; budget = budgetFor(1); waveT = 0;
  fireT = 0; spawnT = 0.6; inv = 0; clock = 0; shake = 0; hurtT = 0;
  rec = 0; blink = 0; nextB = C.BLINK0; bindT = 0; bindC = 0; charging = 0;
  wallT = 0; wallR = 0;
  yaw = 0; pitch = 0; aim();
};

// ---------------------------------------------------------------------------
// Input (DESIGN.md 12). One pointer path for mouse and touch.
//
// The puppet fires by itself, so a press is not a trigger. Dragging aims; a press
// restarts a finished run; and the whole hold gesture is left for the bind at
// step 5, which no longer has to share the button with a shot.
// ---------------------------------------------------------------------------
let down = 0, lx = 0, ly = 0, auto = 1, armT = -1, ax = 0, ay = 0;

// Where the puppet is pointing: the straight line from the base of the horn to
// its tip, carried on out into the world. The crosshair sits on it and the shots
// follow it, so what you are aiming at is what the horn is aiming at - the camera
// axis is not involved.
const aimRay = () => {
  const q = eff(2);
  const b = T(q[0], q[1], q[2]), t = T(q[3], q[4], q[5]);
  const d = [t[0] - b[0], t[1] - b[1], t[2] - b[2]];
  const L = hypot(d[0], d[1], d[2]) || 1;
  return [t, [d[0] / L, d[1] / L, d[2] / L]];
};

// How far along that line the thing you are aiming at sits. Anything within AIMR
// of the line counts; the closest to it wins.
const targetRange = () => {
  const [o, u] = aimRay();
  let r = C.CONV, bd = C.AIMR;
  for (const g2 of ghosts) {
    const c = cam([g2[0], g2[1], g2[2]]);
    const w = [c[0] - o[0], c[1] - o[1], c[2] - o[2]];
    const t = w[0] * u[0] + w[1] * u[1] + w[2] * u[2];
    if (t < C.NEAR) continue;
    const off = hypot(w[0] - u[0] * t, w[1] - u[1] * t, w[2] - u[2] * t) / t;
    if (off < bd) { bd = off; r = t; }
  }
  return r;
};

// The point the crosshair marks and the shots converge on.
const aimAt = () => {
  const [o, u] = aimRay(), r = targetRange();
  return [o[0] + u[0] * r, o[1] + u[1] * r, o[2] + u[2] * r];
};

// DESIGN.md 6's balance rule: cooldown scales with r squared, not r. Area grows
// quadratically, so a linear price makes the biggest bind always the best one and
// there is never a reason to cast a small quick one.
// The charge is a clock: BINDCHG seconds to grow the ring from nothing to BINDR,
// and the radius is just how far through that you are. It is what the floor shows
// while charging; the cast itself is always at BINDR, because letting go early
// fires nothing at all.
const bindR = () => C.BINDR * min(1, bindC / C.BINDCHG);

// Only ever reached by holding all the way to BINDCHG, so there is one radius and
// one price. DESIGN.md 6's cooldown-scales-with-r-squared rule priced a radius the
// player chose; nothing chooses one any more, so there is nothing left for it to
// price. It belongs back here the moment a card makes the radius variable again.
const cast = () => {
  const r = C.BINDR;
  charging = 0;
  bindC = 0;
  armT = -1;                                     // one press, one cast
  bindT = C.BINDCD;
  wallT = C.WALLDUR; wallR = r;                  // the wall sweeps to what it caught
  for (const o of ghosts) {
    // Distance on the ground, not through the air: the ring is a circle on the
    // floor and a ghost's float height must not decide whether it is inside.
    if (hypot(o[0], o[2]) > r) continue;
    // DESIGN.md 7: the Warden is immune, and has to be SEEN shrugging it off, so
    // the rule is learned by watching rather than by being told. A negative hold
    // is that: same slot, so nothing else has to know about it, and it cannot be
    // mistaken for being held because held is strictly positive.
    o[8] = o[7] === C.WARDEN ? -C.SHRUGD : C.BINDDUR;
  }
};

const fire = () => {
  if (over || fireT > 0) return;
  fireT = C.FIRE;
  // From where the horn tip is SEEN to be, toward whatever is under the
  // crosshair. The puppet is posed, not aimed - so the shot's direction is the
  // player's, while its origin is the horn's.
  const q = eff(2);
  const c = T(q[3], q[4], q[5]);                 // the horn tip, camera space
  const k = (C.F / (C.F + c[2])) / (C.F / (C.F + C.MUZZ));
  const o = unCam(c[2] > C.MUZZ ? [c[0] * k, c[1] * k, C.MUZZ] : c);
  const p = unCam(aimAt());
  const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const L = hypot(d[0], d[1], d[2]) || 1;
  horns.push([o[0], o[1], o[2], d[0] / L * C.HSPD, d[1] / L * C.HSPD, d[2] / L * C.HSPD, C.HLIFE]);
  // After the shot, so it leaves from the un-kicked muzzle. The blink goes with
  // the kick - a thing that recoils screws its eyes up - and pushes the idle
  // timer back, so a shot is never followed by a second blink a moment later.
  rec = 1;
  blink = C.BLINKD;
  nextB = C.BLINK0 + random() * (C.BLINK1 - C.BLINK0);
};

// One pointer has to carry turning and binding both, and the two are told apart
// by WHEN you move, not whether you do.
//
// The first ARM seconds of a press are an arming window. Move more than ARMPX in
// it and the press is a turn and only ever a turn - which is what a player who
// just wants to look around does, so looking around never charges. Hold still
// through it and the bind starts, and from that moment moving is free again: you
// can turn all you like while it charges, which is the whole point of a bind
// centred on you.
//
// armT is the clock, and -1 means this press is disqualified.
const onDown = (e) => {
  down = 1; lx = e.clientX; ly = e.clientY;
  if (over) { reset(); return; }
  armT = 0; ax = e.clientX; ay = e.clientY;
};
const onMove = (e) => {
  if (!down) return;
  const dx = e.clientX - lx, dy = e.clientY - ly;
  // Only while arming. Once it is charging, this is just aiming.
  if (!charging && hypot(e.clientX - ax, e.clientY - ay) > C.ARMPX) armT = -1;
  yaw += dx * C.TURN;
  pitch = min(C.PITCHMAX, max(-C.PITCHMAX, pitch - dy * C.TURN));
  lx = e.clientX; ly = e.clientY;
  aim();
};
// Letting go early abandons the charge rather than casting a smaller one: the
// trigger is the only thing that fires it.
const onUp = () => { down = 0; charging = 0; bindC = 0; armT = -1; };

// Keyboard. DESIGN.md 12 specifies pointer only; this is an addition rather than
// a replacement, and every path below ends in the same state the pointer sets.
//
// WASD and the arrows turn. They are read as held rather than as events, in
// step(), so the turn rate is KTURN a second regardless of how fast the OS
// decides to repeat a key.
const KEYS = {};
const TURNK = {
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
};

// Space is the bind, and it skips the arming window. That window exists only
// because one pointer has to carry turning and binding both; a key that does
// nothing else has nothing to be told apart from, so there is nothing to wait
// for. Setting armT to ARM rather than charging directly means the rest -
// starting the moment a cooldown ends, and one press one cast - is the same
// machinery the pointer uses, already written and already tested.
const onKey = (e) => {
  const d = e.type === 'keydown';
  if (d && KEYS[e.code]) return;                 // ignore the OS repeating it
  if (!TURNK[e.code] && e.code !== 'Space') return;
  KEYS[e.code] = d ? 1 : 0;
  e.preventDefault();                            // or space scrolls the page
  if (e.code !== 'Space') return;
  if (!d) { charging = 0; bindC = 0; armT = -1; return; }
  if (over) { reset(); return; }
  if (bindT <= 0) armT = C.ARM;
};

// ---------------------------------------------------------------------------
// The puppet (DESIGN.md 6). The recovered head-and-neck mesh, placed in CAMERA
// space: it is worn, not placed in the world.
//
// The table is the old rig's, verbatim. Each row is a swept box from one point to
// another with half-extents at each end, then a material:
//   [ax, ay, az,  bx, by, bz,  w0, h0,  w1, h1,  material]
// Model space is the rig's own: +y UP, the animal facing +z. The new world is
// y-down, so T flips y.
//
// One number IS changed from the recovered table: the neck ran from x=.025 to
// x=.075 while the head, horn and both eyes sit on x=.1. The old game viewed the
// animal side-on, where a lateral offset is a depth offset and invisible. Worn on
// an arm and seen from behind, it put the whole neck - and the mane that reads its
// position out of this row - down one side of the head. The neck is on the
// sagittal plane now.
//
// The horn is re-angled for the same class of reason. On the side-on animal it
// rose 74 degrees from the muzzle line, which is what a unicorn horn does when it
// is scenery. Here it is the barrel: it has to point where the shots go, and
// pitching the whole puppet 66 degrees to achieve that buried the head below the
// frame. It now leaves the forehead at 15 degrees, the same length as before.
// ---------------------------------------------------------------------------
export const PARTS = [
  [0.1, 0.11, 0.2, 0.088, 0.27, 0.364, 0.075, 0.115, 0.05, 0.085, 0],    // neck
  [0.076, 0.33, 0.346, 0.1, 0.324, 0.7, 0.06, 0.104, 0.06, 0.04, 0],     // head
  [0.1, 0.336, 0.42, 0.1, 0.548, 1, 0.03, 0.03, 0.002, 0.002, 1],        // horn
];
const MAT = [C.BODY, C.GOLD];

// A part's endpoints with its group offsets folded in. Everything that draws or
// aims reads the table through this, so the head, horn and eyes cannot drift
// apart, and the horn a shot leaves along is the horn that gets drawn.
// The head group's rotation, applied to a direction. Kept separate from the point
// version so the eyes can push out along the head's rotated flank instead of along
// model x, which is where they would stay if only positions were rotated.
const hrot = (a, b, c) => {
  const [rx, ry, rz] = C.HEADR;
  const cx = cos(rx), sx = sin(rx), cw = cos(ry), sw = sin(ry), cz = cos(rz), sz = sin(rz);
  const a2 = a * cw + c * sw, c2 = c * cw - a * sw;    // yaw, about up
  const b2 = b * cx - c2 * sx, c3 = c2 * cx + b * sx;  // pitch, about the flank
  return [a2 * cz - b2 * sz, a2 * sz + b2 * cz, c3];   // roll, about the muzzle
};
// And to a point: scaled and rotated about the joint, then moved.
const hmap = (x, y, z) => {
  const P0 = PARTS[1], k = C.HEADS;
  const v = hrot((x - P0[0]) * k, (y - P0[1]) * k, (z - P0[2]) * k);
  return [P0[0] + v[0] + C.HEADO[0], P0[1] + v[1] + C.HEADO[1], P0[2] + v[2] + C.HEADO[2]];
};

export const eff = (i) => {
  const q = PARTS[i].slice();
  if (i) {                                       // head, horn and eyes ride together
    const a = hmap(q[0], q[1], q[2]), b = hmap(q[3], q[4], q[5]);
    q[0] = a[0]; q[1] = a[1]; q[2] = a[2];
    q[3] = b[0]; q[4] = b[1]; q[5] = b[2];
    for (const k of [6, 7, 8, 9]) q[k] *= C.HEADS;
  }
  return q;
};
// The neck's base: where the forearm enters, and so what the puppet pivots about.
const PIV = [PARTS[0][0], PARTS[0][1], PARTS[0][2]];

// Model space into camera space. A rigid placement plus a uniform scale, so
// normals stay normals and push() can go on deriving them from the geometry.
const T = (x, y, z) => {
  const s = C.PUPS, ca = cos(C.PUPA), sa = sin(C.PUPA), cb = cos(C.PUPB), sb = sin(C.PUPB);
  const a = (x - PIV[0]) * s, b = -(y - PIV[1]) * s, c = (z - PIV[2]) * s;
  const a2 = a * ca + c * sa, c2 = c * ca - a * sa;
  // Recoil, back along the puppet's own axis rather than straight at the camera:
  // (sa, -ca*sb, ca*cb) is where its nose points once the pose has been applied.
  // Squared, so it snaps back and then eases the last of the way out.
  const k = rec * rec * C.RECOIL;
  return [C.PUP[0] + a2 - k * sa,
          C.PUP[1] + b * cb - c2 * sb + k * ca * sb,
          C.PUP[2] + c2 * cb + b * sb - k * ca * cb];
};

// Charging, the eyes and the horn run the rainbow. It eases in over the charge,
// so the colour arriving in them is also the clock: full rainbow is the moment it
// goes. Both share it, because they are the two things on the puppet the player
// is already looking at - the horn is where the crosshair sits.
const charged = (base) => {
  const k = charging ? min(1, bindC / C.BINDCHG) : 0;
  return k ? mix(base, RBV[(clock * C.EYERB | 0) % 6], k) : base;
};

// The head lies in the sagittal plane, so its own lateral axis is exactly x and
// an eye is a shallow disc pushed out along it.
const eyes = () => {
  const q = eff(1), t = C.EYES[1];
  const ax = q[0] + (q[3] - q[0]) * t + hrot(0, C.EYES[0], 0)[0];
  const u0 = hrot(0, C.EYES[0], 0);              // "up" is the head's up, not the world's
  const ay = q[1] + (q[4] - q[1]) * t + u0[1];
  const az = q[2] + (q[5] - q[2]) * t + u0[2];
  const hw = q[6] + (q[8] - q[6]) * t;           // the head's half-width there
  const r = C.EYES[3] * C.HEADS, d = C.EYES[4] * C.HEADS;
  // Out along the head's OWN flank, which is only model x while the group is
  // unrotated. The up and forward axes of the disc follow the head too.
  const fl = hrot(1, 0, 0), up = hrot(0, 1, 0), fw = hrot(0, 0, 1);
  // A blink is the eye's own height going to almost nothing and back. Shaped with
  // a sine so it closes and opens rather than switching.
  const bk = blink > 0 ? 1 - (1 - C.BLINKS) * sin(PI * blink / C.BLINKD) : 1;
  const ic = charged(C.IRIS);
  for (const sx of [1, -1]) {
    const o = hw * C.EYES[2] * C.HEADS + d / 2;
    cone(frame([ax + sx * fl[0] * o, ay + sx * fl[1] * o, az + sx * fl[2] * o],
               [up[0] * r * bk, up[1] * r * bk, up[2] * r * bk],
               [sx * fl[0] * d / 2, sx * fl[1] * d / 2, sx * fl[2] * d / 2],
               [fw[0] * r, fw[1] * r, fw[2] * r]), 10, ic, T);
  }
};

// The mane: a row of tufts standing on the neck's top face.
//
// Rooted on the surface, not near it. swept() builds its cross-section from u,
// the lateral axis, and v = p x u - so for a neck in the sagittal plane v IS the
// direction straight out of its top face, and the row's own half-height at that
// point is exactly how far out the surface is. Reading both off the POSED neck
// means the mane follows it: retune the neck, lean it, scale it, and the mane
// stays welded to the top of it.
const mane = () => {
  const nk = eff(0);
  const dx = nk[3] - nk[0], dy = nk[4] - nk[1], dz = nk[5] - nk[2];
  const L = hypot(dx, dy, dz) || 1;
  const py = dy / L, pz = dz / L;
  // Normalised in its own plane. Built from components already divided by the 3D
  // length it came out short whenever the neck leaned sideways, and every root
  // sank a fraction into the surface it was supposed to be standing on.
  const pL = hypot(dy, dz) || 1;
  const uy = dz / pL, uz = -dy / pL;             // straight up out of the top face
  const span = C.MANEN > 1 ? (C.MANEW / (C.MANEN - 1)) * L : 1;
  const r = min(C.MANER, span * C.MANEG);
  // Washed by how far the bind has recharged: full colour ready, drained grey
  // the moment it is cast. This is the cooldown readout.
  const k = C.SAT0 + (1 - C.SAT0) * (1 - bindT / C.BINDCD);
  for (let i = 0; i < C.MANEN; i++) {
    const t = C.MANEC + (C.MANEN < 2 ? 0 : C.MANEW * (i / (C.MANEN - 1) - 0.5));
    const h = nk[7] + (nk[9] - nk[7]) * t;       // the neck's half-height here
    const ax = nk[0] + dx * t, ay = nk[1] + dy * t, az = nk[2] + dz * t;
    const ry = ay + uy * h, rz = az + uz * h;    // the root, on the surface
    swept(T, ax, ry, rz,
          ax, ry + uy * C.MANEH - py * C.MANEB, rz + uz * C.MANEH - pz * C.MANEB,
          r, r, r * C.MANEP, r * C.MANEP, wash(RBV[1 + (i % 5)], k));
  }
};

const mix = (a, b, k) =>
  [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// Wash a colour toward its own brightness. At k = 1 it is itself; at 0 it is the
// grey it would be in a photograph. This is the whole cooldown readout.
const wash = (c, k) => {
  const l = (c[0] + c[1] + c[2]) / 3;
  return [l + (c[0] - l) * k, l + (c[1] - l) * k, l + (c[2] - l) * k];
};

const puppet = () => {
  for (let i = 0; i < PARTS.length; i++) {
    const q = eff(i);
    OUT = i < 2;                                 // neck and head carry the outline
    // The horn is the last part, and the only one that takes the charge colour.
    swept(T, q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8], q[9],
          i === 2 ? charged(C.GOLD) : MAT[q[10]], i ? C.HEADR[2] : 0);
  }
  OUT = 0;
  eyes();
  flush(0);
  // The mane goes over the top, in its own pass. It sits ON the neck's surface,
  // so depth sorting puts half of every tuft behind the neck it is standing on -
  // correct, and unreadable. Painting it after the body it belongs to is the same
  // trick DESIGN.md 5 uses for the viewmodel against the world.
  mane();
  flush(0);
};

// ---------------------------------------------------------------------------
// Ghosts (DESIGN.md 7). Not solid geometry: a blob outline with a sine-deformed
// hem and two eye voids, drawn additively so overlap needs no depth sorting.
// The eyes are HOLES in the same path rather than dark fills - additive blending
// cannot darken anything, so a drawn eye would glow instead of reading as a void.
// ---------------------------------------------------------------------------
// Slot 7 is the type, and every number about a ghost is read from its row.
const TY = (o) => C.TYPES[o[7]];

const born = (x, z, k) =>
  ghosts.push([x, C.GY, z, C.TYPES[k][0], C.TYPES[k][0], 0, random() * 9, k, 0]);

const spawn = (k) => {
  const a = random() * 2 * PI;
  born(cos(a) * C.ARENA, sin(a) * C.ARENA, k);
};

const budgetFor = (w) => C.BUD0 + C.BUDG * (w - 1);

// DESIGN.md 8: the spawner buys randomly from what is currently unlocked until
// the budget is spent. The wave number gates the LIST, never the amount - so a
// late wave with a big budget still buys Drifters, it just buys more of
// everything. Returns -1 when there is nothing left it can afford, which is what
// "spent" means when the cheapest thing still costs something.
const buy = () => {
  const list = [];
  for (let k = 0; k < C.TYPES.length; k++)
    if (C.TYPES[k][4] <= wave && C.TYPES[k][3] <= budget) list.push(k);
  return list.length ? list[random() * list.length | 0] : -1;
};

const ghostAt = (o) => {
  const t = TY(o);
  const c = cam([o[0], o[1] + sin(clock * C.GBOBR + o[6]) * C.GBOB, o[2]]);
  if (c[2] < C.NEAR) return null;
  const s = C.F / (C.F + c[2]);
  return { c, s, px: c[0] * s * PX + W / 2, py: c[1] * s * PX + H / 2, r: t[5] * s * PX, t };
};

const drawGhost = (o, target) => {
  const v = ghostAt(o);
  if (!v) return;
  const t = v.t;
  // Opacity is the health bar (DESIGN.md 7): a nearly-dead ghost is visibly faint.
  const k = C.GFADE + (1 - C.GFADE) * (o[3] / o[4]);
  const hit = o[5] > 0;
  // A hit reads at full strength whatever the fade says. Opacity is the health
  // bar (7), so a nearly-dead ghost is faint - and the flash confirming you hit it
  // was fading with it, exactly when it matters most.
  g.globalAlpha = hit ? 1 : min(1, k * 0.85);
  g.fillStyle = hit ? '#fff' : 'rgb(' + t[9] + ')';
  // A dome with teeth, built as an outline rather than as a modulated circle.
  // Deforming a circle can only ever make a lumpy circle: the dome and the teeth
  // are different KINDS of edge, so they are drawn as different edges.
  //
  //   arc across the top, straight down each side, zigzag along the bottom.
  //
  // The wobble stays, but only on the dome - it is what keeps the thing amorphous
  // (DESIGN.md 7) while the hem stays crisp.
  const r = v.r * (1 + t[6] * sin(clock * 2.2 + o[6]));
  const w = r * C.GW;
  const dy = v.py - r + w;                        // the dome's centre
  const hy = v.py + r;                            // the tooth tips
  const ny = hy - r * C.SPIKE;                    // and the notches between them
  const bp = [];                                  // the body outline, kept for stroking
  g.beginPath();
  for (let i = 0; i <= C.GDOME; i++) {
    // PI to 2PI, so it runs left, over the top, to right. y is down, so sin is
    // negative across that span and the arc is the upper half.
    const a = PI * (1 + i / C.GDOME);
    const q = 1 + t[6] * sin(a * t[7] + clock * 2.2 + o[6]);
    bp.push([v.px + cos(a) * w * q, dy + sin(a) * w * q]);
  }
  // Down the right side to the first tip, then t[8] tips and the notches between
  // them, ending on the left side. closePath takes it back up to the dome.
  const n = 2 * (t[8] - 1);
  for (let i = 0; i <= n; i++) bp.push([v.px + w - (i / n) * 2 * w, i % 2 ? ny : hy]);
  bp.push(bp[0]);
  for (const q of bp) g.lineTo(q[0], q[1]);
  g.closePath();
  // The target outline goes on here, while the path is still just the body: the
  // eye voids are subpaths of the same path, and stroking after they are added
  // would draw rings round the eyes too. Stroked before the fill, so the fill
  // covers its inner half and what is left is a line hugging the silhouette.
  // Held, it wears the rainbow instead: the same outline, walked around the body
  // rather than held at one colour, so what the bind has caught is unmistakable
  // and is the same language the floor and the wall speak.
  if (o[8] > 0) {
    g.lineWidth = C.TGTW;
    for (let i = 1; i < bp.length; i++) {
      g.strokeStyle = css(bow((i - 1) / (bp.length - 1)), 1);
      g.beginPath();
      g.moveTo(bp[i - 1][0], bp[i - 1][1]);
      g.lineTo(bp[i][0], bp[i][1]);
      g.stroke();
    }
    g.beginPath();                                // the fill path, rebuilt
    for (const q of bp) g.lineTo(q[0], q[1]);
    g.closePath();
  } else if (target === o) {
    g.strokeStyle = css(C.GOLD, 1);
    g.lineWidth = C.TGTW;
    g.stroke();
  }
  // Round, large and set wide and high, per the reference. They were ellipses
  // stretched 1.5x vertically, which read as a squint rather than a void.
  const er = v.r * 0.2, ey = v.py - v.r * 0.24;
  for (const ex of [-0.34, 0.34]) {                // eye voids, wound as holes
    g.moveTo(v.px + ex * v.r + er, ey);
    for (let i = 0; i <= 9; i++) {
      const a = (i / 9) * 2 * PI;
      g.lineTo(v.px + ex * v.r + cos(a) * er, ey + sin(a) * er);
    }
  }
  g.fill('evenodd');
  // The bind arriving and failing: a ring of the Warden's own colour pushing out
  // past it and fading. Under lighter, so it reads as light coming off it.
  if (o[8] < 0) {
    const q = 1 + o[8] / C.SHRUGD;
    g.strokeStyle = 'rgb(' + t[9] + ')';
    g.globalAlpha = 1 - q;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(v.px, v.py, v.r * (1.1 + q), 0, 7);
    g.stroke();
  }
  g.globalAlpha = 1;
};

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
const step = (dt) => {
  clock += dt;
  if (over) return;
  fireT = max(0, fireT - dt);
  rec = max(0, rec - dt / C.RECT);
  bindT = max(0, bindT - dt);
  wallT = max(0, wallT - dt);
  let kx = 0, ky = 0;
  for (const c in TURNK) if (KEYS[c]) { kx += TURNK[c][0]; ky += TURNK[c][1]; }
  if (kx || ky) {
    yaw += kx * C.KTURN * dt;
    pitch = min(C.PITCHMAX, max(-C.PITCHMAX, pitch + ky * C.KTURN * dt));
    aim();
  }
  assist(dt);
  // It lets go by itself at BINDCHG. Waiting for the player to release would let
  // them hold a full ring indefinitely and pick their moment for free.
  if (charging && (bindC += dt) >= C.BINDCHG) cast();
  // Arming runs after that, so the frame which finishes arming does not also
  // charge - the charge starts from zero on the next one.
  if (armT >= 0 && !charging) {
    armT += dt;
    // Held through a cooldown, it begins the moment the bind is ready again.
    if (armT >= C.ARM && bindT <= 0) charging = 1;
  }
  blink = max(0, blink - dt);
  nextB -= dt;
  if (nextB <= 0) { blink = C.BLINKD; nextB = C.BLINK0 + random() * (C.BLINK1 - C.BLINK0); }
  inv = max(0, inv - dt);
  shake = max(0, shake - dt * 4);
  hurtT = max(0, hurtT - dt);
  if (auto && !fireT) fire();                     // it fires on its own, at FIRE

  spawnT -= dt;
  if (spawnT <= 0) {
    const k = buy();
    if (k >= 0) { spawnT = C.SPAWN; budget -= C.TYPES[k][3]; spawn(k); }
  }
  // A wave is over when its budget is spent AND the field is clear - so the
  // Splitter's free children, which nothing paid for, still have to be dealt with
  // before the next wave starts.
  if (budget <= 0 && !ghosts.length && !waveT) waveT = C.WAVEGAP;
  if (waveT && !(waveT = max(0, waveT - dt))) {
    wave++; budget = budgetFor(wave); spawnT = 0;
  }

  for (let i = horns.length; i--;) {
    const h = horns[i];
    h[0] += h[3] * dt; h[1] += h[4] * dt; h[2] += h[5] * dt;
    h[6] -= dt;
    if (h[6] <= 0) { horns.splice(i, 1); continue; }
    for (let j = ghosts.length; j--;) {
      const o = ghosts[j];
      if (hypot(o[0] - h[0], o[1] - h[1], o[2] - h[2]) > C.HHIT + TY(o)[5]) continue;
      o[3]--; o[5] = C.GFLASH;
      horns.splice(i, 1);
      if (o[3] <= 0) {
        ghosts.splice(j, 1); kills++;
        // DESIGN.md 7: a Splitter dies into two Drifters, which is what makes a
        // wide bind worth having - you can hold the children before they scatter.
        // Placed across the line to the player, so both keep the range the parent
        // had rather than one being handed a head start.
        if (o[7] === C.SPLIT) {
          const d = hypot(o[0], o[2]) || 1;
          for (const sx of [-1, 1])
            born(o[0] - o[2] / d * sx * C.SPLITD, o[2] + o[0] / d * sx * C.SPLITD, 0);
        }
      }
      break;
    }
  }

  for (let i = ghosts.length; i--;) {
    const o = ghosts[i];
    o[5] = max(0, o[5] - dt);
    if (o[8] > 0) { o[8] -= dt; continue; }      // held: it neither moves nor reaches you
    if (o[8] < 0) o[8] = min(0, o[8] + dt);      // shrugging it off, and still coming
    const d = hypot(o[0], o[2]) || 1;
    if (d < C.GCONTACT) {                         // reached you: hits and is gone
      ghosts.splice(i, 1);
      if (!inv) {
        hearts -= min(C.DMGCAP, TY(o)[2]);
        inv = C.IFRAME; shake = 1; hurtT = C.HURTD;
        if (hearts <= 0) { hearts = 0; over = 1; }
      }
      continue;
    }
    const v = C.GSPEED * TY(o)[1] * dt / d;
    o[0] -= o[0] * v; o[2] -= o[2] * v;
  }
};

// The minimap. DESIGN.md 11 calls it a primary display rather than decoration,
// and it earns that: with threats on every bearing and no way to move, something
// may only ever be perceivable here.
//
// Heading-up, not north-up. 11 asks for a view cone, a player dot and blips at
// true bearing, and heading-up gives all three while making a bearing readable
// without arithmetic - a blip left of the dot is a threat on your left, and you
// drag that way. North-up would leave the player subtracting two angles under
// pressure. The cone still earns its place either way: it is exactly the slice of
// the map that is on screen, so a blip outside it is the one that reaches you
// without ever being seen.
const minimap = () => {
  const r = C.MAPR * H, ox = C.MAPPAD + r, oy = C.MAPPAD + r;
  const reach = C.ARENA * C.MAPZ, k = r / reach;
  const dish = (rad) => { g.beginPath(); g.arc(ox, oy, rad, 0, 2 * PI); };

  dish(r);
  g.fillStyle = C.MAPBG;
  g.fill();

  // The cone is the real one: its half-angle comes from the same W, PX and F the
  // projection uses, so it stays honest if any of them change.
  const hf = atan2(W / 2, PX * C.F);
  const fan = () => {
    g.beginPath();
    g.moveTo(ox, oy);
    g.arc(ox, oy, r, -PI / 2 - hf, -PI / 2 + hf);
    g.closePath();
  };
  fan();
  g.fillStyle = C.MAPCONE;
  g.fill();
  fan();                                         // and its two sides, drawn
  g.strokeStyle = C.MAPFAN;
  g.lineWidth = C.MAPFANW;
  g.stroke();

  // The bind, as the circle it actually is - which is the whole reason 6 says the
  // map is where it reads. On the floor you see an arc sweeping away from you; a
  // ring around a dot is the shape you are actually casting.
  if (charging) {
    dish(bindR() * k);
    g.fillStyle = css(RBV[2], 0.22);
    g.fill();
    dish(C.BINDR * k);
    g.strokeStyle = css(C.RIMC, 0.8);
    g.lineWidth = 1.5;
    g.stroke();
  }

  for (const o of ghosts) {
    // Yaw only. cam() would do this but would also apply pitch, and looking up
    // must not squash the map.
    const bx = o[0] * cy - o[2] * sy, bz = o[0] * sy + o[2] * cy;
    // Clamped to the rim rather than dropped, so a ghost that has not finished
    // arriving is still a bearing you can react to.
    const d = hypot(bx, bz), c = min(1, reach / (d || 1)) * k;
    g.beginPath();
    g.arc(ox + bx * c, oy - bz * c, C.MAPBLIP * r, 0, 2 * PI);
    // A blip is too small to carry a rainbow around itself, so a held one runs
    // through it in time instead - the same cycle the horn and the eyes use.
    g.fillStyle = o[8] > 0 ? css(RBV[(clock * C.EYERB | 0) % 6], 1) : 'rgb(' + TY(o)[9] + ')';
    g.fill();
  }

  // You are the horn: the dot takes the same colour it does, gold at rest and
  // running the rainbow while the bind charges. Two readouts of one state, and
  // the map is the one you can see without looking away from a threat.
  g.beginPath();
  g.arc(ox, oy, C.MAPBLIP * r * 0.8, 0, 2 * PI);
  g.fillStyle = css(charged(C.GOLD), 1);
  g.fill();

  dish(r);
  g.strokeStyle = C.MAPEDGE;
  g.lineWidth = C.MAPEW;
  g.stroke();
};

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const hud = () => {
  const u = min(W, H) * C.HUDU, hu = u * C.HEARTS2;
  if (over) return overScreen(u);
  for (let i = 0; i < C.HEARTS; i++) {            // hearts, top-right
    g.fillStyle = i < hearts ? '#ff3b6b' : '#2a2136';
    g.beginPath();
    const x = W - 16 - hu - i * (hu * 1.35), y = 18;
    g.moveTo(x + hu / 2, y + hu);
    g.lineTo(x, y + hu * 0.38);
    g.lineTo(x + hu * 0.25, y);
    g.lineTo(x + hu / 2, y + hu * 0.26);
    g.lineTo(x + hu * 0.75, y);
    g.lineTo(x + hu, y + hu * 0.38);
    g.fill();
  }

  // The rainbow bar under them: how much of the bind is back. DESIGN.md 11 says
  // no cooldown bar, because the arm's saturation was to carry it - but that arm
  // was cut, and the mane it moved to is a small thing on a puppet you are not
  // looking at while something is closing. This says the same thing where the
  // hearts already have your eye.
  // 1.35 is the heart pitch used above, so BARN of 5 is exactly the width five
  // hearts would occupy - which puts its left end well past the three there are.
  const bw = hu * (1 + (C.BARN - 1) * 1.35), bh = hu * C.BARH;
  const bx = W - 16 - bw, by = 18 + hu + hu * C.BARGAP;
  g.fillStyle = C.BARBG;
  g.fillRect(bx, by, bw, bh);
  // The fill is only ever the passive refill: how much of the bind is back.
  // Charging is a different thing being answered and it was borrowing the same
  // gesture, so a charge and a recharge looked identical.
  const fill = 1 - bindT / C.BINDCD;
  for (let i = 0; i < 6; i++) {                   // in rainbow, left to right
    const a = bw * i / 6, b = min(bw * fill, bw * (i + 1) / 6);
    if (b <= a) break;
    g.fillStyle = css(RBV[i], charging ? 1 : 0.85);
    g.fillRect(bx + a, by, b - a, bh);
  }

  // Charging draws the bar's own outline, laid down left to right as it fills.
  // One continuous line: in along the top to the left corner, down the left edge,
  // back out along the bottom. It is the outline rather than another fill, so it
  // cannot be read as the level underneath it.
  //
  // There is no closing right edge, because there is no frame to draw it on: cast()
  // fires inside step(), before render(), so the frame where f would reach 1 is the
  // frame charging is already over. The last drawn one is 99.4% across, and a
  // right edge that can never be seen is just bytes.
  if (charging) {
    const f = min(1, bindC / C.BINDCHG), e = bx + bw * f;
    g.strokeStyle = C.BARSC;
    g.lineWidth = C.BARSLW;
    g.beginPath();
    g.moveTo(e, by);
    g.lineTo(bx, by);
    g.lineTo(bx, by + bh);
    g.lineTo(e, by + bh);
    g.stroke();
  }

  minimap();

  // READY under the bar, in the bind's own cyan - the colour the rim and the
  // held blips already use, so it says which thing is ready without a word more.
  // Right-aligned to the same edge the bar and the hearts end on, so the whole
  // corner reads as one column.
  if (!charging && bindT <= 0) {
    g.fillStyle = css(C.RIMC, 1);
    g.textAlign = 'right';
    g.font = (u * C.KILLF | 0) + 'px monospace';
    g.fillText('READY', W - 16, by + bh + u * C.KILLF * 1.3);
  }

  // Wave above, kills below it, both on the centre line. The wave takes the
  // horn's gold, which is now also the map dot - one colour for the thing the
  // run is counted in.
  g.textAlign = 'center';
  g.fillStyle = css(C.GOLD, 1);
  g.font = (u * C.WAVEF | 0) + 'px monospace';
  g.fillText('WAVE ' + wave, W / 2, 18 + u * C.WAVEF);
  g.fillStyle = '#8b93b8';
  g.font = (u * C.KILLF | 0) + 'px monospace';
  g.fillText('KILLS ' + kills, W / 2, 18 + u * (C.WAVEF + C.KILLF * 1.15));
  g.textAlign = 'left';

  const a = proj(aimAt());                        // crosshair, on the horn's line
  g.strokeStyle = css(C.GOLD, C.XHA);             // the horn's own colour
  g.lineWidth = C.XHW;
  const c = min(W, H) * C.XHR;
  g.beginPath();
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    g.moveTo(a[0] + dx * c, a[1] + dy * c);
    g.lineTo(a[0] + dx * c * 2.2, a[1] + dy * c * 2.2);
  }
  g.stroke();
};

// Nothing of the run is left on screen: no ghosts, no puppet, no HUD. Three lines
// stacked down the middle, and the score is waves rather than kills because
// DESIGN.md 10 scores it that way and kills are only the tiebreaker.
const overScreen = (u) => {
  g.fillStyle = '#000c';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.fillStyle = css(C.GOLD, 1);
  g.font = (u * 2 | 0) + 'px monospace';
  // The wave you died ON is not one you survived: reaching wave 2 and dying there
  // is one wave cleared, and dying in wave 1 is none.
  g.fillText('WAVES SURVIVED ' + (wave - 1), W / 2, H / 2 - u * 1.6);
  g.fillStyle = '#fff';
  g.font = (u * 1.2 | 0) + 'px monospace';
  g.fillText('KILLS ' + kills, W / 2, H / 2);
  g.fillStyle = '#8b93b8';
  g.font = (u * 0.8 | 0) + 'px monospace';
  g.fillText('CLICK ANYWHERE TO PLAY AGAIN', W / 2, H / 2 + u * 1.8);
  g.textAlign = 'left';
};

// The one ghost nearest the middle of the screen, so the player can tell what
// they are aimed at (DESIGN.md 7).
// Aim assist. The crosshair cannot move: it sits on the horn's line, and the
// puppet is a viewmodel in camera space, so proj(aimAt()) is the same screen
// point whatever the camera does. So the assist turns the CAMERA until the ghost
// arrives under it - the unicorn's pose is untouched, which is also what keeps it
// honest, since the horn still points exactly where the shots go.
//
// Converting a screen gap into a turn: for a point at camera depth z, a small yaw
// dth moves it -z*dth in camera x, and x reaches the screen multiplied by s*PX.
// So dth = -dpx / (z*s*PX), and pitch is the same with the sign the other way.
const assist = (dt) => {
  const a = proj(aimAt());
  let bx = 0, by = 0, bd = 1, bz = 0, bs = 0;
  for (const o of ghosts) {
    const v = ghostAt(o);
    if (!v) continue;
    const d = hypot(v.px - a[0], v.py - a[1]) / (v.r * C.ASSISTR);
    if (d < bd) { bd = d; bx = a[0] - v.px; by = a[1] - v.py; bz = v.c[2]; bs = v.s; }
  }
  if (!bz) return;
  const k = min(1, C.ASSIST * dt) / (bz * bs * PX);
  yaw -= bx * k;
  pitch = min(C.PITCHMAX, max(-C.PITCHMAX, pitch + by * k));
  aim();
};

const underCrosshair = () => {
  const a = proj(aimAt());
  let best = null, bd = 1;
  for (const o of ghosts) {
    const v = ghostAt(o);
    if (!v) continue;
    // Measured in the ghost's OWN radius rather than in pixels, so the crosshair
    // has to be ON the thing. It used to start from a flat 9% of the screen and
    // then add the radius on top, which at range is metres of slack: a ghost lit
    // up while the crosshair was plainly beside it. Normalising also settles
    // overlaps sensibly - the one you are most centred on wins, not the biggest.
    const d = hypot(v.px - a[0], v.py - a[1]) / (v.r * C.TGTR);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
};

// The bind, drawn.
//
// DESIGN.md 6 suggests concentric white ellipses centred below the viewport.
// That is the trick for when you have no projection; there is one here, so the
// real ground circle is projected instead - which behaves correctly under pitch
// and yaw for free, and its near half falls behind the camera by itself rather
// than having to be clipped away.
//
// What is drawn on those circles is the rainbow, which is the one thing carried
// over from the previous game: faded bands lying on the floor while you charge,
// and a wall of it standing up and sweeping out when you let go.
const css = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';

// A point on the circle of radius r, h metres above the ground, projected. Null
// when it is behind the eye. y is down, so up is minus.
const gpt = (a, r, h) => {
  const c = cam([cos(a) * r, C.EYE - h, sin(a) * r]);
  return c[2] < C.NEAR ? null : proj(c);
};

// One band of the ground rainbow: the ring of floor between r0 and r1, filled.
// Built as a strip of quads rather than a stroked circle, for two reasons. A
// stroke has a width in PIXELS, so under perspective the near arc came out fat
// and the far arc thin off the same radius - and between the strokes the bare
// floor showed through. A quad has a width in METRES and its neighbours share
// their edges, so the bands are all one size and the disc is covered.
//
// Sharing an edge is only seamless because this is drawn additively: two
// antialiased half-covered edges sum to exactly one whole. Under source-over the
// same seam would show as a lighter line.
const band = (r0, r1, col, a) => {
  g.fillStyle = css(col, a);
  for (let i = 0; i < C.BINDSEG; i++) {
    const a0 = (i / C.BINDSEG) * 2 * PI, a1 = ((i + 1) / C.BINDSEG) * 2 * PI;
    const q = [gpt(a0, r0, 0), gpt(a1, r0, 0), gpt(a1, r1, 0), gpt(a0, r1, 0)];
    if (!q[0] || !q[1] || !q[2] || !q[3]) continue;
    g.beginPath();
    for (const t of q) g.lineTo(t[0], t[1]);
    g.fill();
  }
};

// Where along the rainbow a fraction of the radius sits. The six colours are
// stops, not slots, so any number of bands still reads as one rainbow instead of
// repeating the palette however many times it happens to divide.
const bow = (f) => {
  const x = max(0, min(0.999, f)) * (RBV.length - 1);
  return mix(RBV[x | 0], RBV[(x | 0) + 1], x - (x | 0));
};

// Where the wave will end, drawn the whole time it charges. Coloured around its
// circumference rather than across its width, so it reads as a rainbow ring
// rather than one more band of the floor - and it brightens as the trigger comes
// up, so the floor flooding out to meet a ring that is getting louder is the
// whole readout of when it will go.
const rim = (r, a) => {
  if (a < 0.01) return;                          // nothing to see, and 44 quads to skip
  const w = C.RIMW / 2;
  g.fillStyle = css(C.RIMC, a);
  for (let i = 0; i < C.BINDSEG; i++) {
    const a0 = (i / C.BINDSEG) * 2 * PI, a1 = ((i + 1) / C.BINDSEG) * 2 * PI;
    const q = [gpt(a0, r - w, 0), gpt(a1, r - w, 0), gpt(a1, r + w, 0), gpt(a0, r + w, 0)];
    if (!q[0] || !q[1] || !q[2] || !q[3]) continue;
    g.beginPath();
    for (const t of q) g.lineTo(t[0], t[1]);
    g.fill();
  }
};

// The charge: the rainbow faded across the floor out to what you have grown, with
// a crest travelling outward through it so the whole disc pulses rather than
// blinking as one.
const groundBow = (r) => {
  if (r < 0.05) return;
  for (let b = 0; b < C.BINDBAND; b++) {
    const f = b / C.BINDBAND, f1 = (b + 1) / C.BINDBAND, m = (f + f1) / 2;
    const w = 0.5 + 0.5 * sin(2 * PI * (m * C.BINDWAV - clock * C.BINDPUL));
    band(r * f, r * f1, bow(m), C.BINDA * w);
  }
};

// The cast: that same rainbow standing up as a wall and sweeping out to the
// radius it caught. Red along the floor, violet at the top - the rainbow on its
// edge. It is drawn over the ghosts rather than sorted among them: it lasts
// WALLDUR and is additive, so it brightens what it passes instead of hiding it.
const bindWall = () => {
  const u = 1 - wallT / C.WALLDUR;               // 0 at the cast, 1 as it dies
  const r = wallR * u ** 0.55;                   // out fast, then easing into place
  const a = C.WALLA * (1 - u) ** 0.9;
  const n = 6 * C.WALLREP;                       // the same rainbow stacked, WALLREP times
  for (let i = 0; i < C.BINDSEG; i++) {
    const a0 = (i / C.BINDSEG) * 2 * PI, a1 = ((i + 1) / C.BINDSEG) * 2 * PI;
    for (let b = 0; b < n; b++) {
      const h0 = C.WALLH * b / 6, h1 = C.WALLH * (b + 1) / 6;
      const q = [gpt(a0, r, h0), gpt(a1, r, h0), gpt(a1, r, h1), gpt(a0, r, h1)];
      if (!q[0] || !q[1] || !q[2] || !q[3]) continue;
      g.fillStyle = css(RBV[b % 6], a * (1 - b / (n + 2)));
      g.beginPath();
      for (const t of q) g.lineTo(t[0], t[1]);
      g.fill();
    }
  }
};

const render = () => {
  // On the over screen there is nothing to draw but the screen itself - no sky,
  // no ghosts, no puppet. Everything below assumes a run in progress.
  if (over) return hud();

  // Being hit kicks the whole view, not just the horizon line. It was a jitter
  // applied to hy alone, which moved the join between sky and ground while every
  // ghost standing on it held perfectly still.
  const m = C.SHAKEA;
  g.save();
  if (shake) g.translate((random() - 0.5) * shake * m, (random() - 0.5) * shake * m);

  // Sky, ground, and the horizon between them. Every horizontal direction shares
  // the same vanishing height, so the horizon is one straight line whose only
  // input is pitch. Overdrawn by the kick, so the shake cannot expose an edge.
  const hy = H / 2 + tan(pitch) * C.F * PX;
  g.fillStyle = C.SKY;
  g.fillRect(-m, -m, W + 2 * m, H + 2 * m);
  g.fillStyle = C.GND;
  g.fillRect(-m, hy, W + 2 * m, H - hy + m);
  g.fillStyle = C.HORIZ;
  g.fillRect(-m, hy - 1, W + 2 * m, 2);

  const target = underCrosshair();
  g.globalCompositeOperation = 'lighter';
  // Nothing is drawn until the bind is genuinely charging: the rim and the floor
  // arrive together. The rim used to fade in across the arming window as a "keep
  // holding" cue, which was worth it at ARM 1s and is not at 0.3s - every press
  // that turned out to be a turn flashed it first, and a ring appearing while you
  // rotate reads as the bind going off early.
  if (charging) {
    groundBow(bindR());
    // Two ramps in one: a quick fade in over RIMFI so it arrives rather than
    // appears, then the slow brightening across the whole charge that says how
    // close the trigger is.
    rim(C.BINDR, C.RIMA * (0.35 + 0.65 * bindC / C.BINDCHG) * min(1, bindC / C.RIMFI));
  }
  for (const o of ghosts) drawGhost(o, target);
  if (wallT > 0) bindWall();
  g.globalCompositeOperation = 'source-over';

  // A horn in flight is a cone, apex forward, built in the world and put through
  // the same pipeline as everything else. It was a swept box tapered to a point,
  // which is a pyramid; a horn is round.
  for (const h of horns) {
    const L = hypot(h[3], h[4], h[5]) || 1;
    const px = h[3] / L, py = h[4] / L, pz = h[5] / L;
    // Any two axes across the flight direction. Same construction swept() uses,
    // so a horn flying straight up does not collapse its own cross-section.
    let ux = 1 - px * px, uy = -px * py, uz = -px * pz;
    const uL = hypot(ux, uy, uz) || 1;
    ux /= uL; uy /= uL; uz /= uL;
    const vx = py * uz - pz * uy, vy = pz * ux - px * uz, vz = px * uy - py * ux;
    const r = C.HW, k = C.HL / 2;
    cone(frame([h[0] - px * k, h[1] - py * k, h[2] - pz * k],
               [ux * r, uy * r, uz * r],
               [px * k, py * k, pz * k],
               [vx * r, vy * r, vz * r]), C.HN, C.GOLD);
  }
  flush();

  puppet();                                       // viewmodel last, on top
  g.restore();

  // The screen goes red for HURTD. Over the world and under the HUD, and outside
  // the shake - a flash that moved with the kick would read as an object.
  if (hurtT > 0) {
    g.fillStyle = css(C.HURTC, C.HURTA * hurtT / C.HURTD);
    g.fillRect(0, 0, W, H);
  }
  hud();
};

const loop = (t) => {
  const dt = min(0.05, (t - last) / 1000) || 0;
  last = t;
  step(dt);
  render();
  requestAnimationFrame(loop);
};

// ---------------------------------------------------------------------------
export const dbg = () => ({ W, H, PX, yaw, pitch, ghosts, horns, hearts, kills, over, clock });
export const look = (y, p) => { yaw = y; pitch = p; aim(); };
export const place = (gs) => { ghosts = gs; };
export const restart = reset;
// Test and editor seams. Dropped from the app build, so they cost nothing.
export const drawPuppet = () => puppet();
// What a pose has to satisfy, measured rather than eyeballed: how far the horn
// points from the line a shot to a 10m target takes, and where the neck's arm
// opening lands relative to the bottom of the frame.
export const aimPoint = () => proj(aimAt());   // editor and tests
// A world point r metres along the aim ray. Tests place targets with it, because
// "look at the ghost" no longer means "aim at it" - the horn aims, not the camera.
export const aimWorld = (r) => {
  const [o, u] = aimRay();
  return unCam([o[0] + u[0] * r, o[1] + u[1] * r, o[2] + u[2] * r]);
};
export const poseCheck = () => {
  const q = eff(2), b = T(q[0], q[1], q[2]), t = T(q[3], q[4], q[5]);
  const d = [t[0] - b[0], t[1] - b[1], t[2] - b[2]], dl = hypot(d[0], d[1], d[2]);
  const w = [-t[0], -t[1], 10 - t[2]], wl = hypot(w[0], w[1], w[2]);
  const k = eff(0);
  const capY = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([su, sv]) => {
    const P2 = T(k[0] + su * k[6], k[1], k[2] + sv * k[7]);
    return P2[1] * (C.F / (C.F + P2[2])) * PX + H / 2;
  });
  return {
    aim: Math.acos(max(-1, min(1, (d[0] * w[0] + d[1] * w[1] + d[2] * w[2]) / (dl * wl)))) * 180 / PI,
    cap: min(...capY) - H,
    // Where the horn tip lands on screen, through the real transform rather than
    // a rebuilt copy of it.
    tip: proj(t),
  };
};
export const setFire = (v) => { auto = v; };   // editor: stop it firing to look at it
export const anim = () => ({ rec, blink, nextB, bindT, bindC, charging, wallT, wallR, armT,
                             wave, budget, waveT, hurtT, shake,
                             bindR: bindR() });
export const bindInfo = () => ({ ready: bindT <= 0, cd: bindT });
export const setBind = (v) => { bindT = v; };  // editor: scrub the cooldown readout
// test seam: start a run at a given wave, to reach an unlock without playing to it
export const setWave = (w) => { wave = w; budget = budgetFor(w); waveT = 0; spawnT = 0; };

addEventListener('resize', resize);
addEventListener('pointerdown', onDown);
addEventListener('pointermove', onMove);
addEventListener('pointerup', onUp);
addEventListener('pointercancel', onUp);
addEventListener('keydown', onKey);
addEventListener('keyup', onKey);

resize();
reset();
last = 0;
requestAnimationFrame(loop);
