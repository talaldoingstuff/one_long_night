# Rainbowed — js13kGames 2026

You are a flying unicorn. Channel a rainbow beam to cut a path through what is
coming at you, and survive as long as you can.

---

## 1. Hard constraints

These are competition rules. Violating any of them disqualifies the entry or drops it from the overall ranking.

| Constraint | Value |
|---|---|
| Zip size | ≤ 13,312 bytes (13 × 1024) |
| Archive contents | `index.html` at top level, playable immediately once unzipped |
| External resources | **None.** No CDN, no font files, no image or audio assets, no analytics, no `fetch` |
| Browsers | Latest Chrome **and** Firefox, **zero console errors** |
| Repo | Must contain full buildable source, not just unzipped output |
| localStorage | All keys namespaced. Never call `localStorage.clear()` — games share an origin |
| Category | One only (Desktop **or** Mobile). Targeting **Desktop, landscape** |

### Deadlines

- **September 13** — game final, zip + GitHub repo submitted
- **September 20** — deployed and published on Wavedash. Deployment only; no new features, no bugfixes

---

## 2. Byte budget

```
13,312  total
  -800  Wavedash SDK reserve
-11,500  game
─────────
 1,012  contingency
```

**Hard ceiling: 11,500 bytes for the game.** A `npm run size` script must print bytes against 13,312 after every build. When the game hits 11,500, it is full.

### What the reserve actually costs

Measured, not estimated: the SDK block is **158 bytes** packed (`sdk/measured.json`),
against the 800 originally set aside. The difference is banked as contingency, not
spent.

### Where it stands

**8,144 bytes**, 3,356 free against the 11,500 ceiling. Everything below is built:
canvas and loop, keyboard and mouse, the box/cone solid generator and its
painter's-algorithm renderer, the unicorn and its flight rig, the rainbow beam
with prism reflection, plated blocks and gates, the spawner and its separation
rules, four boosters, the energy bar and HUD, particles, ZzFX with three sounds,
generative music, and the backdrop.

### The backdrop

A daylight sky ramp with three mountain ranges parallaxing behind the field, at
0.10, 0.24 and 0.48 of the world's own scroll. Each range is a ground line with
overlapping triangular peaks on a fixed lattice, so a peak keeps its height as it
travels. Distance reads as paleness: the layers fade toward a warm grey rather
than toward the sky, because fading brown toward blue desaturates it through grey
and stops it being a mountain.

---

## 3. Build pipeline

```
Vite (dev)
  ↓
esbuild        bundle + minify to one ESM file
  ↓
Terser         mangle.properties with a regex scope (e.g. names matching /^_/)
  ↓
inline         everything into a single index.html — no separate JS/CSS
  ↓
Roadroller     only if JS exceeds ~8KB; test both ways
  ↓
ECT -9 -zip    or advzip — recompresses harder than any system archiver
```

`js13k-vite-plugins` covers most of steps 2–5. Do not hand-roll unless it fails.

### Code style for minification

- One module, no build-time abstraction layers
- Plain functions and object literals over classes (class method names don't mangle by default)
- Arrays over objects for hot data — `[x,y,z,vx]` beats `{x,y,z,vx}` after compression
- Destructure `Math` once; alias `document`, `canvas.getContext`
- Everything procedural: geometry, textures, levels, audio. A seeded PRNG is ~50 bytes and replaces every asset file

---

## 4. Wavedash integration

**Write-only. Nothing is read back, nothing is rendered from the SDK.**

The SDK is injected by the platform as a host global — it is **not** bundled. Do not `npm install @wvdsh/sdk-js` into the shipped bundle (types only, if at all).

```js
// at startup
typeof Wavedash<'u' && Wavedash.init()

// once at startup, cache the id
board = await Wavedash.getOrCreateLeaderboard(...)

// at game over — fire and forget, do NOT await before showing results
try { Wavedash.uploadLeaderboardScore(board.id, score, true) } catch(e){}
```

### Rules for this integration

- The `typeof` guard is mandatory. The zip must be fully playable standalone with no Wavedash global present
- `try/catch` is mandatory — an unhandled promise rejection is a console error, which breaks a hard competition rule
- Never `await` the upload before rendering the game-over screen
- Personal best lives in namespaced `localStorage`, not on the leaderboard

### To verify before writing the guard

1. Global name: docs show `Wavedash.init()`, the developers page shows `WavedashJS.getUser()`. Confirm which is current.
2. Third argument to `uploadLeaderboardScore` — appears to be a force / only-if-better flag. Determines whether personal-best filtering happens client- or server-side.

Test locally with `wavedash dev`, which provides a sandbox SDK offline.

---

## 5. The game

### Premise

You are a unicorn flying across a scrolling world, held toward the left of the
screen while the level comes at you from the right. You channel a rainbow beam
from your horn. The beam is the whole game: it is the only way to clear the
blocks in your path and the only way to open the gates, and it is paid for out of
a bar that takes real time to refill.

### What is out there

| Thing | What it does |
|---|---|
| **Reflector prism** | Turns the beam 90 degrees. Its outgoing direction sweeps a full circle every 2.7s, so the same prism aims somewhere different a moment later. No collision - it passes behind you |
| **Rainbow sphere** | +2 bars. Concentric rainbow rings |
| **Mystery sphere** | One of four boosters, named on screen when you take it. Same size as a rainbow sphere, told apart by being a dark orb marked `?` |
| **Block** | Solid. Shoves you when you touch it. Two beam hits to destroy |
| **Spiked block** | The same, but fatal on contact, and three hits |
| **Gate** | A full column that blocks you, with a rainbow panel set into it. Touch the panel with the beam and the gate dissolves. It does not kill you - being shoved into the left edge does |

Blocks and gates are the same material: plated, nailed, with two plates crossed
inside. Gates are that material in dark green, stacked.

### How a run ends

Two ways, and only two. A spike on contact, or being pinned against the left edge
with nowhere left to be pushed. An empty bar never kills you directly - it just
means the next gate is a wall.

### Camera

None. Play is flat: screen x and screen y, nothing else. No depth ramp, no lane
grid, no horizon, no vanishing point.

The 3D lives **inside each object**. Prisms are octahedra; the unicorn is built
from boxes and cones. Both go through a face-level painter's algorithm - faces
gathered in world space, back-face culled, sorted far-to-near, and shaded by
`dot(normal, light)` quantised to exactly three hard steps.

### Screen layout

- **Left** - the unicorn, free to move anywhere, starting 16% across
- **Right** - where everything enters
- The world slides right to left; the unicorn's own movement is independent of it

### Object foreshortening

A solid's own length maps to screen-y at `PCD`, not at a true camera pitch. At a
real 40 degrees an animal's body spread as much vertical screen space as its
height, which put the rump above the head and drove the front hooves through the
floor.

## 6. Controls

Desktop first, because that is the category.

- **Arrows or WASD** - fly. Both write the same velocity, so there is one
  movement path downstream
- **Space** - channel the beam. It is held, not tapped, and it costs a bar a
  second. Run the bar to nothing and the beam cuts out until half a bar is
  back, so an empty bar is a silence rather than a stutter
- **Mouse** - steering follows the pointer while a button is held; **left click**
  fires. Same velocity, same fire flag, no second code path
- Arrows and Space are swallowed, so the page cannot scroll under the game
- Any key or click restarts after a run ends
- The score is time survived, shown as `mm:ss.mmm`

Diagonal input is normalised, so two axes are not faster than one.

### Mobile is possible, but is not the entry

Category is a submission choice, not a capability claim - the game may still run
on a phone. Landscape touch would need pointer-follow movement (which the mouse
path already is) plus a second simultaneous pointer to fire: roughly 150 bytes.
What it actually costs is device testing. Orientation cannot be locked outside
fullscreen, only detected and prompted for.

## 7. Economy and tuning

### Everything is denominated in SECONDS

This took three attempts, and both wrong answers are worth keeping, because each
looks correct until you push it.

**Charge per unit of track, demand per unit of track.** Speed-invariant, and it
was the original design: a prism every N units against a beam costing X a unit
means nothing revalues as the run speeds up. What it cannot do is stay legible.
A second of beam costs three times as much at the speed cap as at base, so "how
long can I hold this" has no answer.

**Charge per second, demand per distance.** Legible - a bar is a second - but it
inverts. Demand is spaced by distance, so at the cap you meet three times as many
rainbow spheres per second while a second of beam still costs one bar. Income
scales with speed; cost does not. Measured: from the speed cap onward, collecting
perfectly paid *more* than holding the trigger cost, so the bar stopped
constraining anything exactly where the game should bite hardest.

There is no third option that keeps both. **The whole run is on the clock.**
Spawn intervals, the difficulty ramp, the speed ramp and every booster window are
seconds. `dist` survives only where it genuinely tracks ground covered: the
gallop phase and the rainbow's shimmer.

### BEAMC is the ceiling on what the game may ask for

One second of beam per second is all a player can physically supply. So the block
arrival rate cannot outrun `BEAMC`, which pins `SP_OBST_HI` near the time it
takes to clear one block - and that in turn pins the speed cap, because once the
arrival rate is fixed in seconds, a faster scroll empties the screen rather than
filling it. One line sets the late game.

### Constants

| Constant | Value | |
|---|---|---|
| Bar capacity | 7 bars | one bar = one second of beam |
| Beam | -1 bar/s | while channelling |
| Passive trickle | +0.167 bar/s | a bar every 6s |
| Rainbow sphere | +2 bars | every 6.4s, flat for the whole run |
| Reload lockout | 0.5 bars | run dry and the beam stays out until this is back |
| Beam damage | 1 hit / 0.5s | 2 hits a plain block, 3 a spiked one |
| Speed | 1 to 1.4x | over 66s, linear, per second |
| Blocks | every 2.08s to 1.4s | 30% to 54% spiked, 1.0x to 1.25x size |
| Prisms | every 2.8s to 2.1s | |
| Escalation | 66s to 159s | begins where the speed cap lands |

### Why these numbers

Income if you collect perfectly is **0.48 bars/s against a beam costing 1.00/s**.
Deliberately under: catching everything still does not pay for holding the
trigger, so the beam is never free and never neutral. A held trigger empties a
full bar in **13 seconds**, and that number is the same in minute one and minute
three - which is the entire point of a single denomination.

The forced duty cycle - the fraction of time you would need to be firing to
destroy every block - is **55% early and 91% late**. Late, clearing everything
costs 0.91/s against 0.48/s of income, so you cannot. You choose which fights to
take. That is the decision-making late game, and it is now arithmetic rather than
an aspiration.

### Escalation is spawn rate and block size, not speed

Speed stops at 1.4x because of the argument above. Blocks get more frequent
(2.08s to 1.4s), more often spiked (30% to 54%), and **bigger** (1.25x). Size is
the one lever `BEAMC` does not cap: a wider block is harder to fly around but
still takes the same number of hits, so it adds pressure without adding energy
demand. Blocks cover 5.1% of the screen early and 8.4% late.

Checked, not assumed: a full-size block at its worst height still leaves 117px of
slot for an 82px unicorn, and two of them can never share a column - the
separation rule would need them 277px apart inside a 210px band of spawn heights.

### Spawn separation

Separation uses each object's real half-extents, not centre distance. A gate
reserves a corridor at **every** height, plus a run-up during which nothing else
spawns at all: a gate arrives into an already-populated lane, so its approach can
only be cleared before it, never after. Verified over 900s of driven play - 318
gates, nothing overlapping, 239px clear around every one.

## 8. Boosters

Auto-activate on touch. No held-item slot - the control scheme has no spare
gesture. Pickups arrive as dark spheres marked with a question mark, and the one
you took names itself on screen as it floats away.

| Booster | Effect | Weight |
|---|---|---|
| **FULL CHARGE** | Refills the bar | 2 |
| **SLOW TIME** | 5s at 0.55x speed | 3 |
| **PATH CLEARED** | Removes every block on screen | 2 |
| **BAD LUCK** | 8s with every block spiked | 1 |

Bad luck is the rarest and is the only one that reads in red. Slow time is the
safest under a per-second economy: it buys reaction time and grants no charge, so
it cannot touch the bar's arithmetic either way.

### Do not add

Shields (removes the stakes), magnets (removes the dodging), extra lives (removes
the stakes again).

## 9. Audio

- **SFX**: ZzFX, ~1KB. Parameter arrays, no sample data
- **Music**: generative, not tracked. Notes picked from a scale and scheduled
  with ZzFX on a timer, developing a motif over an 8-bar progression rather than
  looping. The key climbs as the run goes on; the **tempo does not** - a tempo
  that accelerated with the run was built and rejected as stressful. Bass, hat
  and melody only. ~300 bytes versus 1,500-2,500 for ZzFXM

---

## 10. Build order

Sessions, not calendar days - the schedule below is order, not dates.

1. **Done** - scaffold, pack pipeline, `npm run size`, measured Wavedash reserve
   (158 bytes, not the 800 estimated)
2. **Done** - audio: ZzFX, SFX, generative music on a developed motif, separate
   master/music/sfx buses
3. **Done** - solid renderer, unicorn model and flight rig, octahedral prisms,
   and the editors that drive them
4. **Done** - the genre change: 2D landscape play, keyboard and mouse, scrolling
   field, rainbow beam
5. **Done** - obstacles, gates, the reflecting ray, and what the beam is *for*
6. **Done** - the economy: one denomination, the difficulty curve against it,
   spawn separation, the time gauge
7. **Done** - environment: sky, three parallax ranges, outlined HUD text
8. **Next** - whatever the remaining 3,356 bytes are best spent on
9. Then - Firefox pass, console-error hunt, README, submit
10. Finally - publish to Wavedash on the frozen build

### Still outstanding

- Real-device check. Landscape on a phone is not the entry, but section 1's
  zero-console-errors rule spans every browser the game loads in
- Section 11's two Wavedash questions, which gate turning the measured 158 bytes
  into real code
- Gate panels spawn at a random height with no guarantee a prism can reach them,
  so a gate's solvability is currently luck. It has not bitten yet because the
  panel tolerance is generous, but it is a real hole

### Store page

Wavedash listing art, screenshots, and description are **platform metadata, not
inside the 13KB**. This is the one place a normal 2D art pipeline is useful.
Prepare it during the build, not on September 19.

---

## 11. Open questions

- Wavedash global name: `Wavedash` vs `WavedashJS`
- `uploadLeaderboardScore` third-argument semantics
- The score is now a **time in seconds**, not a distance. Higher is still better
  (longer survival), so the leaderboard's sort direction is unchanged - but it
  is a float now, and whether the board wants integers needs checking before the
  guard is written
- Cloud save: currently out. Only worth ~250 bytes if progression spans sessions, which it does not
- Confirm with js13k organisers that a feature-gated SDK global does not count as an external resource for the overall ranking (the rules explicitly invite the question)
