// npm run size - the byte counter. Reports the packed zip against both ceilings
// from DESIGN.md 2 and refuses to look healthy when it isn't.
import { readFileSync, statSync, existsSync } from 'node:fs';

export const ZIP_LIMIT = 13312;   // competition hard limit, 13 * 1024
// The competition limit less the reserve, and nothing else held back. It was
// 11,500 and then 12,450, and both were a number kept for work that had not been
// specified yet and then defended after that work had shipped - a contingency
// only ever spent by finding out it was never needed is not a margin.
export const GAME_LIMIT = 13212;  // hard ceiling for the game itself

// DESIGN.md 2 reserves 100 bytes for the Wavedash SDK, down from an 800-byte
// guess, and it is now the ONLY thing held back. Build-order step 4 measured it:
// the platform INJECTS the SDK before the game's code runs, so nothing is bundled
// and the only thing in the zip is one guarded call. A throwaway build with and
// without it differed by 28 bytes. 100 is that with room for a second call site.
export const SDK_RESERVE = 100;
const measured = 28;

const bar = (n, limit, width = 34) => {
  const f = Math.max(0, Math.min(1, n / limit));
  const on = Math.round(f * width);
  return '[' + '#'.repeat(on) + '.'.repeat(width - on) + ']';
};

// Read the zip's central directory well enough to list entry names, so we can
// assert index.html sits at the top level (competition rule, DESIGN.md 1).
function zipEntries(buf) {
  const names = [];
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) !== 0x06054b50) continue;
    let off = buf.readUInt32LE(i + 16);
    const count = buf.readUInt16LE(i + 10);
    for (let k = 0; k < count; k++) {
      if (buf.readUInt32LE(off) !== 0x02014b50) break;
      const nLen = buf.readUInt16LE(off + 28);
      const eLen = buf.readUInt16LE(off + 30);
      const cLen = buf.readUInt16LE(off + 32);
      names.push(buf.toString('utf8', off + 46, off + 46 + nLen));
      off += 46 + nLen + eLen + cLen;
    }
    break;
  }
  return names;
}

export function report(zipPath = 'dist/index.zip', htmlPath = 'dist/index.html') {
  if (!existsSync(zipPath)) {
    console.error(`\n  no zip at ${zipPath} - run the build first\n`);
    process.exit(1);
  }
  const buf = readFileSync(zipPath);
  const zip = buf.length;
  const html = existsSync(htmlPath) ? statSync(htmlPath).size : 0;
  const entries = zipEntries(buf);
  const rows = [
    ['zip', zip, ZIP_LIMIT, 'competition limit'],
    ['game', zip, GAME_LIMIT, 'hard ceiling, DESIGN.md 2'],
  ];

  console.log('');
  console.log('  pack report');
  console.log('  ' + '-'.repeat(60));
  console.log(`  index.html (uncompressed)   ${String(html).padStart(6)} bytes`);
  console.log('');
  for (const [label, n, limit, note] of rows) {
    const pct = (n / limit * 100).toFixed(1);
    const mark = n <= limit ? 'OK  ' : 'OVER';
    console.log(
      `  ${mark} ${label.padEnd(5)} ${String(n).padStart(6)} / ${limit}  ${bar(n, limit)} ${pct.padStart(5)}%  ${note}`
    );
  }
  console.log('');
  console.log(`  headroom to ${GAME_LIMIT} (game)  ${String(GAME_LIMIT - zip).padStart(6)} bytes`);
  console.log(`  headroom to ${ZIP_LIMIT} (total) ${String(ZIP_LIMIT - zip).padStart(6)} bytes`);
  console.log(
    `  the ${ZIP_LIMIT - GAME_LIMIT} between them is the Wavedash reserve ` +
    `(${measured === null ? 'DESIGN.md estimate' : 'measured at ' + measured})`
  );
  console.log('');
  console.log(`  zip contents: ${entries.join(', ') || '(unreadable)'}`);
  if (!entries.includes('index.html')) {
    console.log('  !! index.html is not at the top level of the zip - competition rule violated');
  }
  console.log('');

  if (zip > ZIP_LIMIT) process.exit(1);
  return zip;
}

report();
