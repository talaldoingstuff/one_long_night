// js13kGames 2026 - stationary first-person roguelike wave shooter.
//
// Build order (DESIGN.md 15) steps 1-2 only: the scaffold is already proven, and
// this is the renderer. Fake-3D projection, primitive generators, flat 3-step
// shading, demonstrated with a single box. No gameplay yet - deliberately.
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

const { min, max, cos, sin, hypot, PI } = Math;

export const C = {
  // --- Projection ------------------------------------------------------------
  F: 1.2,             // focal length, metres. With ZOOM this sets the field of
                      // view: tan(halfFOV) = W / (2 * PX * F), about 73 degrees
                      // horizontal at 16:9.
  ZOOM: 1,            // metres-to-pixels is ZOOM * screen height
  NEAR: 0.05,         // metres. Anything nearer is dropped rather than clipped;
                      // the viewmodel arms will need real clipping, the world
                      // never will, because nothing ever gets close to the eye.

  // --- Flat shading (DESIGN.md 5: three discrete steps, no gradients) --------
  LGT: [-0.42, -0.80, 0.43],   // above-front-left. -y is up, so this points down.
  T0: 0.18,           // dot thresholds between the three steps
  T1: 0.62,
  STEP: [0.42, 0.70, 1],       // and the three brightnesses they select

  // --- Camera ----------------------------------------------------------------
  // DESIGN.md 12 calls turn speed the primary difficulty knob, so it exists from
  // the first commit even though nothing reads it yet.
  TURN: 0.0032,       // radians per pixel of pointer drag
  PITCHMAX: 0.6,      // radians, up and down

  // --- The demonstration box -------------------------------------------------
  BOXZ: 3.2,          // metres ahead
  BOXR: 0.55,         // half-extent, metres
  BOXC: [190, 196, 224],
  SPINY: 0.42,        // radians per second
  SPINX: 0.17,

  BG: '#07070f',
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

// Rotating a world point into camera space. Increasing yaw sends the world left,
// so the view turns right; increasing pitch sends it down, so the view looks up.
export const cam = (p) => {
  const x = p[0] * cy - p[2] * sy;
  const z = p[0] * sy + p[2] * cy;
  return [x, p[1] * cp + z * sp, z * cp - p[1] * sp];
};

// DESIGN.md 5: s = f/(f+z), px = x*s + w/2, py = y*s + h/2.
export const proj = (p) => {
  const s = C.F / (C.F + p[2]);
  return [p[0] * s * PX + W / 2, p[1] * s * PX + H / 2];
};

// ---------------------------------------------------------------------------
// Primitives. Each generator pushes convex polygons in WORLD space onto FACES.
//
// Normals are derived, never written down, and then oriented against a point the
// generator knows is inside the solid. Deriving alone is not enough: two of the
// six faces in the first box table were wound the wrong way round and came out
// facing inward, which silently inverted back-face culling. Orienting against an
// interior point makes an outward normal structural rather than something six
// hand-written vertex orders all have to get right.
// ---------------------------------------------------------------------------
export let FACES = [];

const push = (vs, col, ins) => {
  const [a, b, c] = vs;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const L = hypot(nx, ny, nz) || 1;
  nx /= L; ny /= L; nz /= L;
  let cx = 0, cy2 = 0, cz = 0;
  for (const v of vs) { cx += v[0]; cy2 += v[1]; cz += v[2]; }
  const k = vs.length;
  if ((cx / k - ins[0]) * nx + (cy2 / k - ins[1]) * ny + (cz / k - ins[2]) * nz < 0) {
    nx = -nx; ny = -ny; nz = -nz;
  }
  FACES.push([vs, nx, ny, nz, col]);
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

// Six quads, wound counter-clockwise seen from outside.
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
// is inside it. Taper is the frame's job, not the generator's - a squashed frame
// gives a wedge, an offset one gives a horn.
export const cone = (M, n, col) => {
  const tip = at(M, 0, 1, 0), ring = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI;
    ring.push(at(M, cos(a), -1, sin(a)));
  }
  for (let i = 0; i < n; i++) push([ring[i], tip, ring[(i + 1) % n]], col, M[0]);
  push(ring, col, M[0]);
};

// ---------------------------------------------------------------------------
// Draw. Painter's algorithm: cull what faces away, sort far to near, fill flat.
// ---------------------------------------------------------------------------
export const shade = (col, nx, ny, nz) => {
  const d = nx * C.LGT[0] + ny * C.LGT[1] + nz * C.LGT[2];
  const k = C.STEP[d > C.T1 ? 2 : d > C.T0 ? 1 : 0];
  return 'rgb(' + (col[0] * k | 0) + ',' + (col[1] * k | 0) + ',' + (col[2] * k | 0) + ')';
};

export const flush = () => {
  const draw = [];
  for (const f of FACES) {
    const vs = f[0].map(cam);
    let near = 0, z = 0;
    for (const v of vs) { if (v[2] < C.NEAR) near = 1; z += v[2]; }
    if (near) continue;                          // wholly or partly too close
    // Cull back faces: the camera sits at the origin, so any vertex doubles as
    // the view vector to the face.
    const n = cam([f[1], f[2], f[3]]);
    if (n[0] * vs[0][0] + n[1] * vs[0][1] + n[2] * vs[0][2] >= 0) continue;
    draw.push([z / vs.length, vs, shade(f[4], f[1], f[2], f[3])]);
  }
  draw.sort((a, b) => b[0] - a[0]);              // far to near
  for (const d of draw) {
    g.fillStyle = d[2];
    g.beginPath();
    for (const v of d[1]) {
      const p = proj(v);
      g.lineTo(p[0], p[1]);
    }
    g.fill();
  }
  FACES = [];
  return draw.length;
};

// ---------------------------------------------------------------------------
// The one box, step 2's proof. It turns on two axes so every face takes its turn
// facing the light, which is the only way to see that the three shading steps
// are steps and not a gradient.
// ---------------------------------------------------------------------------
let spin = 0, drawn = 0;

const scene = () => {
  const a = spin * C.SPINY, b = spin * C.SPINX;
  const ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
  const r = C.BOXR;
  box(frame(
    [0, 0, C.BOXZ],
    [ca * r, 0, -sa * r],
    [sa * sb * r, cb * r, ca * sb * r],
    [sa * cb * r, -sb * r, ca * cb * r],
  ), C.BOXC);
};

const frameLoop = (t) => {
  const dt = min(0.05, (t - last) / 1000) || 0;
  last = t;
  spin += dt;
  aim();
  g.fillStyle = C.BG;
  g.fillRect(0, 0, W, H);
  scene();
  drawn = flush();
  requestAnimationFrame(frameLoop);
};

let last = 0;
export const dbg = () => ({ W, H, PX, yaw, pitch, spin, drawn });
export const setSpin = (v) => { spin = v; };
export const look = (y, p) => { yaw = y; pitch = p; aim(); };

addEventListener('resize', resize);
resize();
aim();
requestAnimationFrame(frameLoop);
