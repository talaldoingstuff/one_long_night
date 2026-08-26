# Rainbowed — js13kGames 2026

Rainbow ribbon converts wild horses into unicorns while fighting an energy clock.

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
| Category | One only (Desktop **or** Mobile). Targeting Mobile, portrait |

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

### Indicative per-system allocation (post-pack)

| System | Bytes |
|---|---|
| Canvas setup, resize, main loop | 300 |
| Pointer input (lane + tier) | 150 |
| Fake-3D projection + primitive generators | 700 |
| Rainbow ribbon (player) | 250 |
| Horse/unicorn mesh + gallop rig | 1,300 |
| Lane grid, rails, shadows | 300 |
| Spawner + conversion | 250 |
| Herd (massed, capped render) | 150 |
| Prisms (light + dark) | 300 |
| Boosters | 400 |
| Energy system + HUD | 300 |
| Procedural generation + PRNG | 400 |
| Particles + juice | 500 |
| ZzFX + SFX definitions | 1,000 |
| Generative music | 300 |
| DOM/CSS UI (start, game over) | 500 |
| **Total** | **~7,100** |

Leaves roughly 4,400 spare against the 11,500 ceiling.

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

You are a rainbow. You drift forward, rippling, losing strength as you go. Prisms restore you. Dark prisms drain you faster. Your purpose is to touch wild galloping horses and turn them into unicorns. The more unicorns, the higher the score. Run out of energy and the run ends.

### Camera

Elevated reverse-chase, angled down roughly 40°. The ribbon travels *toward* the camera. Depth reads as **vertical screen position**, not scale — this is what keeps the six-lane grid and the herd legible in portrait.

### Screen depth ordering (far → near)

1. **Herd band** — captured unicorns, massed at the horizon
2. **Gap** — must stay clear
3. **Player ribbon** — fixed depth, deep in scene, centre of the six-lane grid
4. **Play field** — horses, prisms, boosters travelling away from camera
5. **Spawn edge** — bottom of screen, objects at maximum size

Objects spawn near-camera at maximum size and **shrink as they approach the player**. This builds a natural difficulty gradient into the perspective itself: maximum warning time at maximum size, commitment as the target gets smaller.

### Track: six lanes, two tiers

- **Lower tier**: 3 lanes. Horses spawn here **only**. Dark prisms skew here.
- **Upper tier**: 3 lanes. No horses ever. Light prisms skew here.

This single spawn rule creates the game's core rhythm: **descend to score, ascend to survive.**

### Rendering the tiers

- Ground plane: filled trapezoid, 3 lane centre lines
- Upper tier: **3 rail lines only**, not a filled plane. At this camera angle a second plane sits almost exactly on the ground plane and reads as one surface
- **Every raised object drops a shadow ellipse onto its ground lane.** ~30 bytes, and it is the single most important depth cue in the game
- Tier gap must be visibly wider than a lane width or the rail sets blur together mid-field

### The herd

A single massed group at the far end, spanning the full track width, **ignoring the lane grid**.

- Not path-following. No indexing into the ribbon's position history. Just a count, rendered as N sprites scattered in a fixed zone with deterministic jitter from index
- **Render cap: 20–30.** Past that it's a smear. Let the counter carry the rest, or thicken rows rather than widening
- On conversion, the new unicorn **arcs from the interception point up into the herd over ~0.4s**. This is the score-feedback moment — it lands where the player is looking, at the moment they earned it

---

## 6. Controls

Single continuous pointer. Touch (or click) anywhere and hold:

- **X position** → lane (three zones)
- **Y position** → tier (above or below a screen midline)

Release holds the last slot. Mouse and touch are one code path — no branching, ~150 bytes.

Tier changes **arc over ~0.2s with a few particles**, never snap. At this depth a vertical jump is small on screen and will read as a teleport otherwise.

Optional keyboard arrows as an alternative, ~60 bytes.

**Test on a real phone early.** Thumb occlusion at the spawn edge is the risk; it should be tolerable because the critical read is mid-screen, but devtools emulation will not tell you.

---

## 7. Economy and tuning

### Energy is denominated in distance, not time

Critical. If energy drained per second while spawns were spaced per distance, the game would get *easier* as it sped up. Measuring the bar in track units makes the economy completely speed-invariant, and speed does the one thing it should: compress reaction time.

At base speed, 1 unit ≈ 1 second, so all time-based intuitions still translate.

### Constants

| Constant | Value |
|---|---|
| Bar capacity | 10 units |
| Drain | 1 per unit travelled |
| Light prism | +3 |
| Dark prism | −2 |
| Horse conversion | 0 energy |
| Light prism spacing | every 2.5 units |
| Dark prism spacing | every 4 units |
| Horse spacing | every 5 units |
| Booster spacing | every 15 units |
| Speed scaling | linear, +5% per unicorn |
| Speed cap | 3× base (~40 unicorns) |

### Why these numbers

Catching every light prism yields +3 per 2.5 units against a drain of 2.5 — a slow surplus for perfect play. Sustainable but never comfortable.

Chasing a horse pulls you off the prism line and costs roughly one prism. **Every horse costs about three seconds of life.** From a full bar, about three greedy chases before a recovery lap is mandatory. This is the sentence the whole game runs on.

### Speed scaling must be linear, not compounding

`speed = base × (1 + 0.05n)`, capped at 3×.

Compounding at 1.05^n reaches 2× at 14 unicorns, 4.3× at 30, 11.5× at 50 — the game destroys itself inside two minutes. Past the 3× cap, escalate via **dark-prism ratio and spawn density** instead. Difficulty shifts from reflex to decision-making, which is a better late game and costs nothing.

### First tuning question to playtest

Conversion currently grants **0 energy**, keeping score and survival as fully separate currencies — you always trade life for points, never get both. If runs feel too punishing, `+1` halves the cost of a horse and makes aggression viable.

**Build this as a flippable constant.**

---

## 8. Boosters

Auto-activate on touch. No held-item slot — the control scheme has no spare gesture. Pickups spawn marked with a question mark.

| Booster | Effect |
|---|---|
| Energy saver | 5s with no energy drain |
| Refill | Fully recovers the energy bar |
| Time slow | 5s slowdown, useful in advanced stages |
| Bad luck | All light prisms become dark for a brief period |

### Balance notes

- **Refill is by far the strongest** — worth up to 10 units. Make it the rarest. Consider capping at 75% rather than full so it rescues without erasing a bad position
- **Time slow is the safest** under the distance model — it buys pure reaction time and grants zero energy, so it cannot unbalance the economy
- Revisit all four after the core loop is playable

### Do not add

Shields (removes the clock), magnets (removes the lane decision), extra lives (removes the stakes).

---

## 9. Audio

- **SFX**: ZzFX, ~1KB. Parameter arrays, no sample data
- **Music**: generative, not tracked. Pick notes from a scale, schedule with ZzFX on a timer, shift key as speed increases. ~300 bytes versus 1,500–2,500 for ZzFXM, and it *reacts* to gameplay

---

## 10. Build order

19 days from August 25. Milestones, not a rigid schedule.

1. **Days 1–4** — scaffold, pack pipeline, `npm run size`. Core loop running: ribbon moves, lanes work, horses spawn and convert, energy drains. Ugly is fine.
2. **Day 4** — first full pack + measure. Also: build a throwaway with every Wavedash call site, pack with and without, measure the real SDK reserve. Replace the 800-byte estimate with the measured number.
3. **Days 5–10** — feel pass. Juice, tier-change arc, conversion arc, particles, audio, the spectrum look.
4. **Day 10** — Wavedash deploy dry-run with whatever exists. Find CLI and publishing friction now, not after the freeze.
5. **Days 11–16** — boosters, difficulty curve, real-phone touch testing, herd cap tuning.
6. **Days 17–19** — Firefox pass, console-error hunt, repo cleanup with a real README and working build, submit.
7. **Sept 13–20** — publish to Wavedash on the frozen build. Store page and metadata only.

### Store page

Wavedash listing art, screenshots, and description are **platform metadata, not inside the 13KB**. This is the one place a normal 2D art pipeline is useful. Prepare it during the build, not on September 19.

---

## 11. Open questions

- Wavedash global name: `Wavedash` vs `WavedashJS`
- `uploadLeaderboardScore` third-argument semantics
- Cloud save: currently out. Only worth ~250 bytes if progression spans sessions, which it does not
- Confirm with js13k organisers that a feature-gated SDK global does not count as an external resource for the overall ranking (the rules explicitly invite the question)
