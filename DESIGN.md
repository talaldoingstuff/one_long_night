# Rainbowed — js13kGames 2026

You are a flying unicorn. Fire a rainbow beam, gather prisms, outrun an energy clock.

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

### Indicative per-system allocation (post-pack)

| System | Bytes |
|---|---|
| Canvas setup, resize, main loop | 300 |
| Keyboard + mouse input | 150 |
| Solid primitives: box/cone generator | 700 |
| Rainbow beam | 250 |
| Unicorn model, gallop + flight rig | 1,300 |
| Solid renderer: cull, depth sort, quantised shading | 400 |
| Scrolling field + spawner | 150 |
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

You are a unicorn flying across a scrolling world, held toward the left of the
screen while the level comes at you from the right. Prisms restore your energy,
dark prisms drain it. You can fire a rainbow beam from your horn, which destroys
whatever it touches - but firing costs energy, so every shot is paid for out of
the same bar keeping you alive. Run out and the run ends.

Why the unicorn fires the beam is still open. What matters mechanically is that
it costs, and that it *destroys* rather than collects - so burning a light prism
out of the air is a real loss, not a shortcut.

### Camera

None. Play is flat: screen x and screen y, nothing else. There is no depth ramp,
no lane grid, no horizon, no vanishing point.

The 3D lives **inside each object**. Prisms are octahedra; the unicorn is built
from boxes and cones. Both go through a face-level painter's algorithm - faces
gathered in world space, back-face culled, sorted far-to-near, and shaded by
`dot(normal, light)` quantised to exactly three hard steps. Solid objects on a
flat field.

### Screen layout

- **Left** - the unicorn, free to move anywhere, starting 16% across
- **Right** - where prisms, dark prisms and mystery spheres enter
- The world slides right to left at the run speed; the unicorn's own movement is
  independent of it

### Object foreshortening

A solid's own length maps to screen-y at `PCD`, not at a true camera pitch. At a
real 40 degrees an animal's body spread as much vertical screen space as its
height, which put the rump above the head and drove the front hooves through the
floor. Objects are compressed for the same reason the old track was.

## 6. Controls

Desktop first, because that is the category.

- **Arrows or WASD** - fly. Both write the same velocity, so there is one
  movement path downstream
- **Space** - fire the beam
- **Mouse** - steering follows the pointer while a button is held; **left click**
  fires. Same velocity, same fire flag, no second code path
- Arrows and Space are swallowed, so the page cannot scroll under the game
- Any key or click restarts after a run ends

Diagonal input is normalised, so two axes are not faster than one.

### Mobile is possible, but is not the entry

Category is a submission choice, not a capability claim - the game may still run
on a phone. Landscape touch would need pointer-follow movement (which the mouse
path already is) plus a second simultaneous pointer to fire: roughly 150 bytes.
What it actually costs is device testing. Orientation cannot be locked outside
fullscreen, only detected and prompted for.

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
| Light prism spacing | every 2.5 units |
| Dark prism spacing | every 4 units |
| Beam | −0.55 per unit while firing |
| Mystery sphere spacing | every 15 units |
| Speed scaling | linear, per unit travelled |
| Speed cap | 3× base (~60 units) |

### Why these numbers

Catching every light prism yields +3 per 2.5 units against a drain of 2.5 — a slow surplus for perfect play. Sustainable but never comfortable.

Firing costs 0.55 a unit on top of the 1 you are already paying, so holding the
beam is 55% more expensive than simply flying. Burning a dark prism out of the
air is cheaper than eating one (−2) as long as you do not hold the trigger for
more than about 3.6 units. Burning a *light* prism costs you the shot **and** the
+3 you would have collected.

**The beam is never free and never neutral.** That is the sentence the whole game
runs on now.

### Speed scaling must be linear, not compounding

`speed = base × (1 + 0.05n)`, capped at 3×.

Compounding at 1.05^n reaches 2× at 14 unicorns, 4.3× at 30, 11.5× at 50 — the game destroys itself inside two minutes. Past the 3× cap, escalate via **dark-prism ratio and spawn density** instead. Difficulty shifts from reflex to decision-making, which is a better late game and costs nothing.

### First tuning question to playtest

Why the unicorn fires at all is unresolved. Right now the beam only destroys, so
it is purely defensive — a way to clear a dark prism you cannot dodge. If that
proves too passive, the options are: make some objects *only* destructible by
beam, or have destroyed objects drop something. Either changes what the energy
buys.

**`BEAM` is a flippable constant.** So is `CONVERT`'s replacement, whatever the
beam ends up rewarding.

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

Shields (removes the clock), magnets (removes the dodging), extra lives (removes the stakes).

---

## 9. Audio

- **SFX**: ZzFX, ~1KB. Parameter arrays, no sample data
- **Music**: generative, not tracked. Pick notes from a scale, schedule with ZzFX on a timer, shift key as speed increases. ~300 bytes versus 1,500–2,500 for ZzFXM, and it *reacts* to gameplay

---

## 10. Build order

Sessions, not calendar days — the schedule below is order, not dates.

1. **Done** — scaffold, pack pipeline, `npm run size`, measured Wavedash reserve
   (147 bytes, not the 800 estimated)
2. **Done** — audio: ZzFX, six SFX, generative music on a developed motif,
   separate master/music/sfx buses
3. **Done** — solid renderer, unicorn model with gallop and flight rigs,
   octahedral prisms, and the editors that drive them
4. **Done** — the genre change: 2D landscape play, keyboard and mouse, scrolling
   field, rainbow beam
5. **Next** — obstacles and gated sections; decide what the beam is *for*
6. Then — environment pass, difficulty curve against the new economy
7. Then — Firefox pass, console-error hunt, README, submit
8. Finally — publish to Wavedash on the frozen build

### Still outstanding

- Real-device check. Landscape on a phone is not the entry, but §1's
  zero-console-errors rule spans every browser the game loads in
- §11's two Wavedash questions, which gate turning the measured 147 bytes into
  real code

### Store page

Wavedash listing art, screenshots, and description are **platform metadata, not inside the 13KB**. This is the one place a normal 2D art pipeline is useful. Prepare it during the build, not on September 19.

---

## 11. Open questions

- Wavedash global name: `Wavedash` vs `WavedashJS`
- `uploadLeaderboardScore` third-argument semantics
- Cloud save: currently out. Only worth ~250 bytes if progression spans sessions, which it does not
- Confirm with js13k organisers that a feature-gated SDK global does not count as an external resource for the overall ranking (the rules explicitly invite the question)
