# One Long Night

![One Long Night](Poster.png)

A **js13kGames 2026** entry, on the theme *Unicorns and Rainbows*. The whole game
is a single HTML file of **12,991 bytes** - no images, no audio files, no fonts,
no network. Everything on screen is drawn from code at runtime.

---

## What is One Long Night?

A stationary first-person roguelike wave shooter.

You stand in an open field with the Alicorn on your right arm and a rainbow bound
around your left. Ghosts converge on you from every direction, one wave after the
next, and **you cannot move**. The horn fires on its own. The rainbow is yours to
time.

Turning is the whole of your movement, which is why the threats come from all
360 degrees and why the minimap is a readout rather than decoration - something
may be closing behind you and nowhere else will say so.

---

## Goal

**Survive as many waves as you can.** That is the entire score - no kill count,
no combo, no multiplier. A wave sends a different number of ghosts every time it
is played, so anything counted per ghost would measure the spawner rather than
you.

A wave ends when its budget is spent and the field is clear. Then you pick one of
three cards, and the next wave is bigger.

You have three hearts, five if you buy both. There is no pause.

---

## How to Play

**Kill the wave, then choose how you get stronger.**

Each wave has a threat budget that grows 13% on the last, and the seconds between
arrivals shrink 4%. So a late wave is not only bigger, it comes at you faster.

Two weapons, and they answer different problems:

**The horn** fires by itself, at whatever rate you have bought. It is single
target and it out-ranges the arena, so nothing is ever too far to shoot - the
only thing between you and a kill is having turned to face it.

**The rainbow** is an area. Hold to charge for three seconds and it fires itself
in a ring centred on you: everything caught takes damage, is held where it
stands, and is thrown back when the hold lets go. It answers crowds, which is the
one thing a single-target horn cannot.

Five kinds of ghost arrive over the run, one new type every five waves, each with
its own speed, health and damage. The last of them has a rule rather than a stat
line, and the game will not tell you what it is - you are meant to see it.

---

## Controls

**Desktop only.** The charge needs a press that stays put, and a resting
fingertip does not, so a touch device gets a sign instead of a game.

| Action | Input |
|---|---|
| Aim and turn | Drag, or `WASD`, or the arrow keys |
| Fire the horn | Automatic |
| Charge the rainbow | Hold click, or hold `Space` |
| Pick a card | Click it, or `1` `2` `3`, or arrows and `Space` |
| Mute | `M`, or the M square |
| Quit to the menu | `Esc`, or the arrow square |

Two things worth knowing, because neither is obvious:

- **The charge fires itself** when it completes. Letting go early does not cast a
  smaller ring - it abandons the charge entirely.
- **Turning is free while charging.** The hold is on the button; your aim is not.

---

## Tips

- **Watch the colour of your shots.** Gold, then orange past 3 damage, then red
  at the top of the card. It is telling you what a shot is worth.
- **The rainbow is not a second gun.** It kills the weakest ghosts and delays
  everything else. Cast it into a crowd, not at a single target.
- **The Splitter dies into two.** A wide ring catches the children before they
  scatter, which is the moment the radius card pays for itself.
- **Something in the late game shrugs the ring off.** Watch what the ring does to
  it, and what it does not - the answer is a different weapon, not a bigger cast.
- **The Hulk is the only thing that hits for the damage cap.** It is also the
  slowest and the easiest to hit. Deal with it early rather than accurately.
- **The Darter crosses the arena in six seconds.** Nothing else is close. It is
  the ghost that punishes a slow turn.
- **Do not spread your cards.** The two horn cards multiply into each other; four
  levels of everything is weaker than nine of two.
- **The minimap is a weapon.** Blips show true bearing including behind you, and
  a held ghost runs the rainbow so you can see what your cast actually caught.

---

## The Size and Byte Budget

```
13,312  the competition limit, 13 x 1024
  -100  reserved for the Wavedash SDK, measured at 28
---------
13,212  the ceiling this game is held to

12,991  what it currently packs to
   221  free
```

Everything is one `index.html`. The build inlines the JS and CSS, minifies with
terser, packs with Roadroller and recompresses the zip with advzip. The packed
file is pure 7-bit ASCII.

`npm run size` prints the count against both limits after every build and refuses
to look healthy when it is not. It also reads the zip's central directory to
assert `index.html` really is at the top level, which is a competition rule and
not something to take on trust.

**No external resources of any kind.** System font stack, no webfont, procedural
audio, and every graphic drawn at runtime - including the title, which is cut
from strokes on a grid rather than set in a typeface, so it renders identically
on every machine.

---

## How to Run the Game

Node 20 or newer.

```sh
npm install

npm run dev      # dev server, play at the URL it prints
npm run build    # writes dist/index.html and dist/index.zip
npm run size     # build, then report bytes against both limits
npm run check    # the full suite: build, 628 checks, both browsers, size
```

`npm run check` is the one that matters. It builds the real file, runs every
check, then loads the **packed** output in headless Firefox and Chrome and
asserts that each of them draws something, is still drawing a second later, and
logged nothing at all. A game that throws no errors and paints a frozen frame
passes a console check and is still broken, so it measures both.

It needs Firefox and Chrome on the machine. Set `FIREFOX=` or `CHROME=` to point
at them if they are somewhere unusual.

---

## A Map of the Repo

```
index.html        the shell: a canvas and a script tag
src/main.js       the entire game, in one file
DESIGN.md         the design spec, and the record of where it was wrong
tests/            the checks
tools/            the build
```

**`src/main.js` is one long file on purpose.** Every byte of module plumbing is a
byte not spent on the game, and at this size a single file is also easier to read
straight through than the same code split six ways. It opens with a `C` object
holding every tunable constant in the game, and the comments carry the reasoning
rather than restating the code - what was tried, what it measured, and why the
number is what it is.

`tests/loop.mjs` is the bulk of the suite. It stubs a canvas, records every
drawing call, drives the real module through real input, and asserts against what
was actually drawn. The rest are focused: `browsers.mjs` runs the shipped file in
two real browsers, `audit.mjs` checks the competition rules, `render.mjs` and
`gate.mjs` cover drawing and the desktop gate, and `playtest.mjs` drives complete
runs to measure difficulty rather than guess at it.

`tools/config.js` is the build configuration, `inline.js` folds everything into
one file, and `size.js` is the byte report.

---

## Licence

Code is free to read and learn from. The game and its art are the author's.
