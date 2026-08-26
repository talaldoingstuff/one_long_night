// npm run sdk-cost
//
// DESIGN.md 2 reserves 800 bytes for the Wavedash SDK integration. That was a
// guess. This packs the same source with and without the SDK call sites, through
// the identical pipeline, and prints the measured delta.
//
// Two measurements, because the number that matters is the marginal one:
//   throwaway  - sdk/main.js, a minimal game-shaped shell (what the milestone asked for)
//   real game  - src/main.js with the same call sites grafted onto its game-over path
// The second is the honest reserve: compression context is shared, so bolting the
// SDK onto the real bundle costs less than the same lines cost on their own.
import { build } from 'vite';
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { packConfig } from './config.js';

const ROOT = resolve(import.meta.dirname, '..');
const TMP = join(ROOT, '.sdk-cost');
// Every variant is packed against this one page. It is byte-identical to the
// game's index.html apart from the script path, and it is the same for all four
// builds, so it cancels out of every delta.
const HTML = join(ROOT, 'sdk', 'index.html');

// Delete each marked region, inclusive. The pattern only matches a line whose
// first non-space content is the marker comment itself, so prose that merely
// names the markers (like this paragraph) is never mistaken for a delimiter.
const stripWD = (src) =>
  src.replace(/^[ \t]*\/\/ WD-START[^\n]*\n[\s\S]*?^[ \t]*\/\/ WD-END[^\n]*\n/gm, '');

async function pack(name, mainJs) {
  const root = join(TMP, name);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'main.js'), mainJs);
  copyFileSync(HTML, join(root, 'index.html'));

  const log = console.log;
  console.log = () => {};                       // ECT/advzip chatter, several lines per build
  try {
    await build({ ...packConfig({ root, outDir: join(root, 'dist') }), logLevel: 'silent' });
  } finally {
    console.log = log;
  }
  return statSync(join(root, 'dist', 'index.zip')).size;
}

const row = (label, off, on) => {
  const d = on - off;
  console.log(
    `  ${label.padEnd(22)} ${String(off).padStart(7)} ${String(on).padStart(7)}` +
    `${((d >= 0 ? '+' : '') + d).padStart(9)}`
  );
  return d;
};

rmSync(TMP, { recursive: true, force: true });

// --- throwaway shell -------------------------------------------------------
const shell = readFileSync(join(ROOT, 'sdk', 'main.js'), 'utf8');
const shellOn = await pack('shell-on', shell);
const shellOff = await pack('shell-off', stripWD(shell));

// --- real game -------------------------------------------------------------
// The same call sites grafted on: the SDK block at the tail, and the submit on
// the game-over transition.
const wd = shell.match(/^[ \t]*\/\/ WD-START -[\s\S]*?^[ \t]*\/\/ WD-END -[^\n]*$/m)[0];
const gameOffSrc = readFileSync(join(ROOT, 'src', 'main.js'), 'utf8');
// Anchored on the game-over sound rather than the whole if-block: that is the
// moment the score is final, and it survives edits to everything around it.
// When it does go stale the tool throws, rather than quietly measuring a build
// with no call site in it.
const HOOK = 'seq(S_OVER);';
if (!gameOffSrc.includes(HOOK)) throw new Error('sdk-cost: game-over hook not found in src/main.js');
const gameOnSrc = gameOffSrc.replace(HOOK, HOOK + ' wdSubmit(uni);') + '\n' + wd + '\n';

const gameOff = await pack('game-off', gameOffSrc);
const gameOn = await pack('game-on', gameOnSrc);

console.log('');
console.log('  Wavedash SDK cost  -  measured, packed through the shipping pipeline');
console.log('  ' + '-'.repeat(56));
console.log(`  ${'variant'.padEnd(22)} ${'without'.padStart(7)} ${'with'.padStart(7)}    delta`);
const dShell = row('throwaway shell', shellOff, shellOn);
const dGame = row('real game (src/main)', gameOff, gameOn);
console.log('');
console.log(`  DESIGN.md 2 reserve estimate     800 bytes`);
console.log(`  measured on the real game      ${String(dGame).padStart(5)} bytes`);
console.log(`  reclaimed vs the estimate      ${String(800 - dGame).padStart(5)} bytes`);
console.log('');
console.log('  Budget with the game figure. The shell figure is the same lines packed');
console.log('  without a game to share compression context, so it reads higher.');
console.log('');

writeFileSync(
  join(ROOT, 'sdk', 'measured.json'),
  JSON.stringify(
    {
      shell: { without: shellOff, with: shellOn, delta: dShell },
      game: { without: gameOff, with: gameOn, delta: dGame },
      estimate: 800,
    },
    null,
    2
  ) + '\n'
);

rmSync(TMP, { recursive: true, force: true });
