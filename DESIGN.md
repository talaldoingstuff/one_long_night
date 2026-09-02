# js13kGames 2026 Entry — Design Spec

> **This document supersedes all previous design documents for this project.**
> Any earlier spec, and any gameplay code written against it, is void.
> The project scaffold, build pipeline and size tooling remain valid.
> Everything below the "Constraints" sections describes a different game.

Title: **One Long Night**. It names the arc rather than the mechanic: the sky runs
from early evening at wave 1 to full dark by 30, and a run is one night of it. It
promises nothing the game does not deliver, which ruled out most of the
alternatives - a title claiming ground nothing crosses is contradicted the first
time a ghost reaches you.

Kept out of the game code: it lives in `index.html` and, once there is a start
screen, in one constant beside it.

---

## 1. Hard constraints

Competition rules. Violating any of these disqualifies the entry or drops it from the overall ranking.

| Constraint | Value |
|---|---|
| Zip size | ≤ 13,312 bytes (13 × 1024) |
| Archive contents | `index.html` at top level, playable immediately once unzipped |
| External resources | **None.** No CDN, no font files, no image or audio assets, no analytics, no `fetch` |
| Browsers | Latest Chrome **and** Firefox, **zero console errors** |
| Repo | Must contain full buildable source, not just unzipped output |
| localStorage | All keys namespaced. Never call `localStorage.clear()` — games share an origin |
| Category | One only. **Desktop**, landscape orientation |

### Deadlines

- **September 13** — game final, zip + GitHub repo submitted
- **September 20** — deployed and published on Wavedash. Deployment only; no new features, no bugfixes

---

## 2. Byte budget

```
13,312  total
  -800  Wavedash SDK reserve
-11,750  game
─────────
   762  contingency
```

**Hard ceiling: 11,750 bytes for the game.** `npm run size` must pack and print actual zip bytes against both 13,312 and 11,750 after every build.

The game ceiling was 11,500 until the sky was given its drifting ghosts. That
was a deliberate call rather than a drift: the reserve exists to be spent on
the entry, the 800 bytes for the SDK are still untouched, and 762 bytes of
contingency is a wider margin than most of this file was written under. The
number to defend is 13,312.

### Indicative allocation (post-pack)

| System | Bytes |
|---|---|
| Canvas setup, resize, main loop | 300 |
| Input (aim, fire, hold-bind) | 200 |
| Fake-3D projection + primitive generators | 700 |
| Ghost blob generator + 5 type variants | 300 |
| Ghost movement, damage, death | 250 |
| Puppet arm: mesh, recoil, blink | 450 |
| Casting arm: mesh, rainbow wrap, wave anim | 300 |
| Horn projectiles + collision | 250 |
| Bind AOE: rings, expansion, cooldown | 300 |
| Minimap | 250 |
| HUD (hearts, wave counter) | 250 |
| Wave spawner + threat budget | 200 |
| Upgrade cards + selection UI | 600 |
| Particles + juice | 500 |
| ZzFX + SFX definitions | 1,000 |
| Generative music | 300 |
| DOM/CSS UI (start, game over) | 400 |
| PRNG + misc | 200 |
| **Total** | **~6,750** |

Roughly 4,750 spare against the ceiling.

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

`js13k-vite-plugins` covers most of steps 2–5.

### Code style for minification

- One module, no build-time abstraction layers
- Plain functions and object literals over classes (class method names don't mangle by default)
- Arrays over objects for hot data — `[x,y,z,hp]` beats `{x,y,z,hp}` after compression
- Destructure `Math` once; alias `document`, `canvas.getContext`
- Everything procedural. A seeded PRNG is ~50 bytes and replaces every asset file

---

## 4. Wavedash integration

**Write-only. Nothing is read back, nothing is rendered from the SDK.**

The SDK is injected by the platform as a host global — it is **not** bundled. Do not ship `@wvdsh/sdk-js`.

```js
// at startup
typeof Wavedash<'u' && Wavedash.init()

// once at startup, cache the id
board = await Wavedash.getOrCreateLeaderboard(...)

// at game over — fire and forget, do NOT await before showing results
try { Wavedash.uploadLeaderboardScore(board.id, score, true) } catch(e){}
```

- The `typeof` guard is mandatory. The zip must be fully playable standalone with no Wavedash global present
- `try/catch` is mandatory — an unhandled promise rejection is a console error, which breaks a hard competition rule
- Never `await` the upload before rendering the game-over screen
- Personal best lives in namespaced `localStorage`

**Verify before writing the guard:** global name (`Wavedash` vs `WavedashJS`), and the third argument to `uploadLeaderboardScore` (appears to be force / only-if-better). Test locally with `wavedash dev`.

---

## 5. The game

### Premise

You stand in an open field wearing a unicorn hand puppet on your right arm and a rainbow bound around your left. Ghosts converge on you from every direction. The puppet fires horns. The rainbow binds. You cannot move.

**Genre:** stationary first-person roguelike wave shooter.

### Orientation

**Landscape.** Full 360° turning. This is a change from earlier portrait planning — do not carry portrait assumptions forward.

### Camera

First person, eye level, looking forward. Fixed position — the camera rotates but never translates.

This is the core technical reason for the design: **every hard-to-render object is gone.** No small distant creatures, no quadruped rigs, no facet shading at 20px. The only detailed geometry sits an arm's length from the camera at a fixed distance and angle, where detail is affordable.

### Renderer

Canvas2D with painter's-algorithm fake-3D. **No WebGL.**

- Project vertices manually: `s = f/(f+z); px = x*s + w/2; py = y*s + h/2`
- Sort per-part back-to-front, fill as 2D polygons
- Flat shading: face normal dotted with a fixed light direction, **quantised to 3 discrete steps**. No gradients, no smooth shading
- Anything that **emits** rather than reflects skips the lamp and draws at full brightness on every face. The horn in flight is the one that does: lit, its turned-away sides took the bottom step and read as dark olive, which is most of what you see of a 0.3m cone crossing the screen at 26 m/s
- A horn in flight also carries an **additive radial glow**: one gradient at its screen point, radius in METRES so it shrinks with depth like everything else. Drawn under `lighter` after the world and before the viewmodel, so it adds light rather than painting a disc over the ground, and the puppet still occludes a horn just leaving the muzzle
- The dots a dying ghost throws off carry the same glow, one gradient each. Theirs runs from an **inner circle** rather than from the centre, so each dot keeps its own radius as a solid core and only the halo is added outside it - a gradient run from the centre leaves the dot soft, and a burst of soft dots is a smudge rather than a spray. Brightness is the **hold**, not the reach: full alpha carries to 0.35 of the way out before it starts to fall, which burns nearly 3x the area of the core without the dot getting any bigger. At the 260 cap the whole pass measured about 0.8ms a frame against 0.14 for flat discs - the worst case the cap allows, and still under 6% of a 16.7ms budget
- **Hard polygon edges only.** No rounded primitives, no capsules, no anti-aliased blobs for solid geometry
- Viewmodel (both arms) draws last, on top, with no depth sorting at all
- Ghosts use additive blending, which is order-independent — they skip depth sorting entirely

---

## 6. The two arms

### Right arm — unicorn puppet

A unicorn head and neck worn over the forearm. **Drawn, not modelled** (changed 2026-08-31): a flat 3/4 low-poly sprite painted straight in screen space, 344 vertices over 38 paths, viewed from behind-right so it faces away to the front-left. It was a mesh of swept boxes until the rebrand; going flat cost nothing in the read and gave back 259 bytes, because a viewmodel that never moves against the camera was paying for a transform, a projection and a depth sort it never used.

The model is four packed strings - vertices on a 0..93 grid, per-path lengths, per-path colours, and **what each path IS**: body, mane, horn or eye. That last one is what lets the drawing keep carrying state rather than being a picture: the mane still washes toward grey with the cooldown, and the horn and eye still run the rainbow while a charge builds.

Because the horn is art now rather than geometry, the line it aims along is **stated** (`_AIMO`, `_AIMD`) rather than derived from it. Those two constants are exactly what the solved 3D pose resolved to, so the crosshair lands where it always did. Nothing keeps the drawing and the aim together except a check that the drawn horn passes through the crosshair - which is why that check exists.

- **Fires horns.** Infinite ammo, gated by fire rate only
- Horns are projectiles with travel time, not hitscan
- Occupies the bottom-right of the frame. It is the largest and best-lit object in the game — spend detail here
- The horn is the brightest single element on screen (amber)

**Animations:**
- **Recoil** — offset the whole sprite back along the horn's own axis on fire, ease out over `_RECT`
- **Blink** — collapse the eye path's Y about its own centre on a randomised timer

### Left arm — ~~casting arm~~ **cut**

There is no second arm. It was to be a forearm wrapped in rainbow bands, palm
open, bottom-left, carrying the cooldown in its saturation. The unicorn casts
instead, and **the cooldown lives on its mane** - the same idea in a place that
already existed, for none of the bytes a second limb would have cost. Fifteen of
the sprite's paths are mane, and `wash()` drains them toward grey against
`bindT`: fully coloured means ready, washed means recharging.

`tests/loop.mjs` asserts the arm is gone from the source rather than merely
off-screen, by name - CAST, CASTL, CASTR, SLEEVE, PALM, WRAPT, BANDN - so this
section cannot quietly come back.

### Bind — the AOE

**Centred on the player, not in front of them.** This is critical to get right.

- Hold to charge. The radius expands the longer you hold
- Releasing casts at the current radius
- Bound ghosts are held in place for a duration
- All ghost types are held equally, **except the Warden, which is immune**

**Rendering in first person:** a circle centred on the camera projects with its near half behind the viewer, off-screen. What the player sees is an **arc sweeping outward toward the horizon** as the radius grows. Draw as concentric ellipses whose centre lies below the bottom of the viewport, clipped to the screen.

- Solid inner ring = current radius
- Dashed outer ring = the maximum currently affordable (scales with bind-radius upgrades, giving free feedback on that card)
- **The minimap is where the actual circle reads.** Draw it there as a real circle around the player dot

**Balance rule: cooldown must scale with r², not r.** Area grows quadratically, so a linear cost makes max-charge always optimal and kills the short tactical bind.

---

## 7. Ghosts

No anatomy. A ghost is a blob outline with a sine-deformed wavy hem and two dark eye voids. Amorphousness is the point — every imperfection that would break a creature model reads as correct here.

All five types are the **same generator with different parameters**: size, hue, wobble amplitude, wobble frequency, wisp count.

| Type | HP | Speed | Damage | Cost | Unlocks | Hue |
|---|---|---|---|---|---|---|
| Drifter | 3 | 1.0× | 1 | 1 | wave 1 | pale white |
| Darter | 2 | 1.8× | 1 | 2 | wave 5 | sharp cyan |
| Hulk | 10 | 0.5× | 3 | 5 | wave 10 | angry red |
| Splitter | 6 | 0.8× | 1 | 4 | wave 15 | sickly green |
| Warden | 8 | 0.7× | 2 | 6 | wave 20 | near black |

The HP, speed, damage and cost columns above are the ORIGINAL design and were
superseded by the balance pass — they made the cheapest ghost the best value on
both hp and damage, so the budget measured roughly the opposite of threat. The
shipped numbers live in `_TYPES` and the checks retype them.

The **Unlocks** column IS current, and a check holds it there: one new type
every five waves, all five met by wave 20. The Warden's hue is corrected above
too — it is near black, which is why its minimap blip needs a white ring.

**Splitter** — on death, breaks into two Drifters. Reuses the Drifter entirely. Makes a large bind valuable, since you can hold the children before they scatter.

**Warden** — immune to bind. One boolean. It must visibly shrug off the ring so the player learns the rule without being told. This is a mechanical shift at wave 20 rather than just larger numbers.

### Behaviour

Ghosts spawn at the edge of the arena at a random bearing and drift straight toward the player. On reaching the player they deal their damage and are removed.

### Feedback

- **Flash white on hit**
- **Opacity drops a step per HP lost** — a nearly-dead Hulk is visibly faint
- **No health bars.** Bars over 360° of enemies would be unreadable clutter
- **Ghost under the crosshair is outlined in white** to confirm the target

---

## 8. Waves and spawning

### Threat budget

Each wave has a budget. The spawner buys ghost types randomly from those currently unlocked until the budget is spent.

- Costs are in the table above
- Budget grows per wave by a single formula — tune the whole difficulty curve from that one place
- **Unlock gating applies to the buy list, not the budget.** Wave number decides what is *available*; budget decides how much

No wave is hand-authored. Composition varies every run.

### Between waves

Three upgrade cards are offered. Pick one.

---

## 9. Upgrade cards

| Card | Effect | Cap |
|---|---|---|
| Fire rate | Horns per second | — |
| Horn damage | Damage per horn | — |
| Bind radius | Max affordable radius | — |
| Bind cooldown | Recharge speed | — |
| Bind duration | How long ghosts stay held | — |
| Extra heart | +1 max heart | 2 |
| Regen | Health restored between waves | 2 |

**Regen** starts at +1 by default. Two cards raise it to +2 then +3. Always capped by max hearts.

- Regen is the strongest card in the pool — sustain compounds across a long run in a way fire rate does not. **Weight it rarer in the draw**, or every player takes it twice immediately and the rest of the pool goes unread
- **Once a card hits its cap it drops out of the pool.** One line, and it prevents dead draws late in a run
- Fire rate and horn damage are distinct because ghost HP varies: fire rate answers swarms, damage answers tanks

---

## 10. Player state

- **3 hearts** to start, max 5 with both Extra Heart cards
- Damage is per-ghost-contact, values in the ghost table
- **Cap all damage at 3.** A larger hit takes most of a run's health from a single mistake
- Score = waves survived, plus ghosts killed as a tiebreaker

---

## 11. HUD

- **Minimap, top-left.** Circular. Shows: view cone, player dot, ghost blips at true bearing including behind, and the current bind circle. This is a **primary display**, not decoration — a threat may only be perceivable here. Do not shrink it for tidiness, but it should not exceed roughly a quarter of the screen height
- **Hearts, top-right.** Filled and empty states
- **Wave counter**, small
- No cooldown bar — the unicorn's mane carries that, washing toward grey as the bind recharges (6 above)

---

## 12. Controls

| Action | Input |
|---|---|
| Aim / turn | Drag (pointer X → yaw, pointer Y → pitch) |
| Fire horn | Tap / click |
| Bind | Hold, release to cast at current radius |

One code path for mouse and touch via Pointer Events. No gestures to learn.

**Turn speed is the primary difficulty knob** — slow turning plus 360° threats is the tension; fast turning trivialises it. Make it a tunable constant from day one.

---

## 13. Audio

- **SFX:** ZzFX, ~1KB. Parameter arrays, no sample data
- **Music:** generative. Pick notes from a scale, schedule with ZzFX on a timer, shift key as waves escalate. ~300 bytes vs 1,500–2,500 for a tracker
- **Directional cue for off-screen ghosts is required.** With 360° threats and no movement, being hit by something you never had a chance to perceive is the main way this design feels unfair. Pan a spawn sound to the ghost's bearing

---

## 14. Visual direction

Saturated emissive spectrum on near-black.

- Dark field, dark sky, faint horizon
- Ghosts are desaturated and translucent — the rainbow and the horn are the only strongly chromatic things in the world, except the Hulk's red
- Flat shading, hard edges, three value steps
- Colour via `hsl(h,100%,50%)` — the whole spectrum from one variable, near-free for a rainbow theme

---

## 15. Build order

Milestones, not a rigid schedule.

1. **Scaffold + pipeline + `npm run size`.** Must work before any game code exists
2. **Renderer.** Fake-3D projection, primitive generators, flat 3-step shading. Prove it with one box before anything else
3. **Core loop, ugly.** Camera yaw, ghost spawn and approach, puppet fires horns, collision, hearts, death, restart
4. **Measure the Wavedash reserve.** Throwaway build with every SDK call site, packed with and without. Replace the 800-byte estimate with a measured number
5. **Bind system.** Charge, expanding rings, cooldown, r² cost, held ghosts
6. **Minimap.** Bearings, blips, bind circle
7. **Ghost types.** All five, via generator parameters
8. **Waves + threat budget + upgrade cards**
9. **Feel pass.** Recoil, blink, cast wave, arm saturation, particles, audio, directional cue
10. **Ship pass.** Firefox, console-error hunt, repo cleanup, README, submit

### Store page

Wavedash listing art, screenshots and description are **platform metadata, not inside the 13KB**. Prepare during the build, not on September 19.

---

## 16. Checks

`tests/` — plain Node, no framework, no dependencies. Every one of them drives the
real module rather than a copy of it, which is why they cannot drift from what
ships.

```
node tests/loop.mjs        the suite: 506 checks over the whole game
node tests/render.mjs      the projection and the primitives
node tests/audit.mjs       every config key referenced, nothing left from the old game
node tests/api.mjs         every browser call exists; the competition rules
node --experimental-vm-modules tests/edcheck.mjs    the editors parse, resolve and RUN
node tests/browsers.mjs    the shipped file, run in Chrome and Firefox

npm run check              all of the above, building first, in one command
```

Every one of them **exits non-zero when it fails**, which is what makes `npm run
check` mean anything. They did not until 2026-09-01: all five printed FAIL and
exited 0, so a hundred failing assertions and a clean run were the same thing to
anything that was not a person reading the output.

`api.mjs` and `browsers.mjs` read `dist/index.html`, so both need `npm run build`
first — `dist/` is not tracked.

`browsers.mjs` is the competition's zero-console-errors rule, checked rather than
assumed. It needs no automation library: a tiny server puts a reporter in front
of the shipped file, the page plays itself for eleven seconds — title, how-to,
clicks, drags, a keyboard turn, a held charge, mute — and posts back everything
`console.error`, `console.warn`, `window.onerror` and `unhandledrejection` saw.
It also samples the canvas twice a second apart, because a game that throws
nothing and paints a frozen frame passes a console check and is still broken.

Measurement probes, which answer a question rather than assert:
`playtest.mjs` (how far a run gets, several player profiles - slow, minutes),
`sheet.mjs` (the roster and the threat budget), `peak.mjs` and `noise.mjs` (audio
headroom), `mus.mjs` (what the music plays), `assist.mjs` and `stutter.mjs` (aim),
`sep.mjs`, `count.mjs` and `uniform.mjs` (spawn bearings), `score.mjs`,
`iframe.mjs`.

The rest of `tests/` is one-offs from earlier stages, kept because they record how
a number was arrived at. Some are stale against the current code.

---

## 17. Open items

**Status, 2026-09-01.** Build order steps 1-9 are complete, and with them the
unicorn rebrand, the Firefox pass, and a round of input and audio tuning.
**10,733 of the 11,500 game ceiling, so 767 bytes free**, with the 800-byte
Wavedash reserve and the 1,012 contingency untouched - more room than before
the rebrand, because replacing the 3D puppet gave back more than the sprite
costs. Repo at github.com/talaldoingstuff/one_long_night, private until
submission. Checks: 507 + 24 pass, plus the shipped file running clean in
Chrome and Firefox.

Figures in this document are the ones that were true when they were written and
some of them will not be by the time they are read; `node tools/size.js` and the
five commands in 16 are the current answer.

**The jam theme is "Unicorns and Rainbows".**

What remains is step 10, the ship pass, plus the unicorn rebrand.

### Blocked on answers only the user has

- Wavedash global name (`Wavedash` or `WavedashJS`) and the third argument to
  `uploadLeaderboardScore`. Deferred: the user is handing over the SDK docs and
  the answer comes out of those. Ships in the **September 13** zip, not the 20th
- ~~The 2026 jam theme.~~ **Answered: "Unicorns and Rainbows".** The unicorn and
  the rainbow that is both weapon and cooldown readout are the theme itself, not
  flavour over a wave shooter, so nothing has to be added to be on it
- ~~Repo visibility.~~ **Settled:** private through the build, flipped to public
  immediately before submission
- Confirm with the organisers that a feature-gated SDK global does not count as
  an external resource for the overall ranking (the rules invite the question)

### Remaining work, in the order recommended

1. ~~**Unicorn rebrand.**~~ **Done.** The 3D swept-box puppet is replaced by a
   flat 3/4 low-poly sprite (6 above). It reads better, and it *gained* 259
   bytes rather than spending any. Its pose still wants a last look on a real
   screen - `tools/unicorn-2d.html` drives the shipped constants directly
2. ~~**Firefox smoke test.**~~ and 3. ~~**console-error hunt.**~~ **Both done,
   and they are a check rather than an afternoon:** `node tests/browsers.mjs`
   runs the shipped file in Firefox and Chrome and reports every console level,
   not only the ones that fail. Both come back completely silent, drawing, and
   still animating a second later
4. **README.** The repo has none, and it goes public at submission
5. **Store page metadata** - listing art, screenshots, description. Platform
   metadata, not inside the 13KB, and 15 says prepare it during the build

`browsers.mjs` knows the install paths for Windows, macOS and Linux and falls
back to PATH; `FIREFOX=` and `CHROME=` in the environment beat all of it. A
browser it cannot open is a **failure with an instruction**, not a skip - the
rule names both, so checking one is not checking. It used to crash on an
unhandled ENOENT and never reach the second browser.

### The four flagged items, ruled on 2026-08-31

- ~~`RAINBOW RADIUS`~~ **fixed.** It compounded at 1.2 from 9m, so the ladder ran
  9, 10.8, 12.96, 15.55, 18.66 inside a 16m arena: the fourth card already caught
  anything off the spawn ring and the fifth spent one of only three between-wave
  offers on 3.11m of empty space outside the arena. The growth is metres added
  rather than a factor now - 1.5 a level, so 9, 10.5, 12, 13.5, 15. Ghosts arrive
  on a ring at a constant speed, so the number caught goes with r rather than r
  squared and even steps in metres are even value four times over; the ground
  covered still escalates, 11.4 points of the arena for the first card and 16.7
  for the last. 15 leaves the spawn ring a sanctuary about a second wide, so a
  maxed bind clears the floor without being a literal screen clear. Every level
  above the base is weaker than it was, so no wave that survived can destabilise
- A waves-only leaderboard has no tiebreak. **Won't fix** - fine as it is
- `THREAT LEVEL` displays a cosmetic `max(budget, wave + 5)` rather than the real
  budget. **Works as intended:** it exists so the early waves read as escalating,
  and it does not drive what those waves actually spend
- ~~Keyboard median 13 waves against a mouse's 28.~~ **Fixed by playing it.** The
  simulation had said 3.5 rad/s was fine and 2.04 was not, so `_KTURN` sat at
  3.14; played on a keyboard that is too fast to land on anything. It is 2.6 now
  - half a turn in 1.21s. The reason a simulated player never saw it: holding a
  key sweeps 3 degrees a frame at 3.14 and the aim assist can only answer with
  0.2 to 0.9 of one, so the assist has under a quarter of the authority while a
  key is down. A mouse stops moving and hands it all of it, which is why the
  mouse felt right at every value and the keyboard did not

Mobile is out of scope unless revisited: the entry category is Desktop, landscape.
