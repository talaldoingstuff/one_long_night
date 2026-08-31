// The rule is zero console errors in Chrome AND Firefox, so this runs the
// SHIPPED file in both and says whether either of them complained.
//
// No automation library. A tiny server puts a reporter script in front of
// dist/index.html - Roadroller emits no <head> to hang one off, so it simply
// goes first, which is also the only way to be watching before a line of the
// game runs - then the page plays itself for eleven seconds and posts back what
// it saw. Everything a driver would have been used for, the page does itself.
//
// It also answers two questions a console cannot: whether anything was drawn at
// all, and whether it is still moving a second later. A game that throws nothing
// and paints a frozen frame passes a console check and is still broken.
//
// Needs `npm run build` first - dist/ is not tracked.
import { createServer } from 'node:http';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url);
let DIST;
try { DIST = readFileSync(new URL('./dist/index.html', ROOT), 'utf8'); }
catch { console.log('  no dist/index.html - run `npm run build` first'); process.exit(1); }

// Where the browsers are. The Windows paths first, then the bare names for
// anywhere else; whichever exists is what gets driven.
const CANDIDATES = [
  ['Firefox', ['C:/Program Files/Mozilla Firefox/firefox.exe',
               'C:/Program Files (x86)/Mozilla Firefox/firefox.exe', 'firefox'],
   (profile) => ['--headless', '--no-remote', '--profile', profile]],
  ['Chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe',
              'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'google-chrome'],
   (profile) => ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + profile]],
];

const REPORTER = `(() => {
  const bad = [];
  const note = (k, m) => bad.push(k + ': ' + m);
  addEventListener('error', (e) => note('window.error',
    (e.message || e.type) + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?')), true);
  addEventListener('unhandledrejection', (e) => note('unhandledrejection', e.reason));
  for (const k of ['error', 'warn']) {
    const orig = console[k].bind(console);
    console[k] = (...a) => { note('console.' + k, a.map(String).join(' ')); orig(...a); };
  }
  addEventListener('load', () => {
    const down = (x, y) => dispatchEvent(new PointerEvent('pointerdown',
      { clientX: x, clientY: y, bubbles: true, pointerId: 1 }));
    const move = (x, y) => dispatchEvent(new PointerEvent('pointermove',
      { clientX: x, clientY: y, bubbles: true, pointerId: 1 }));
    const up = () => dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    const key = (t, code) => dispatchEvent(new KeyboardEvent(t, { code, key: code, bubbles: true }));
    const hash = () => {
      const cv = document.getElementById('c');
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let h = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4 * 97) {
        if (d[i] > 40 || d[i+1] > 40 || d[i+2] > 60) lit++;
        h = (h * 31 + d[i] + d[i+1] * 7) >>> 0;
      }
      return [h, lit, cv.width + 'x' + cv.height];
    };
    let s = 0, first = null, moved = 0, lit = 0, size = 'none';
    const iv = setInterval(() => {
      s++;
      // Through the title, through the how-to, then played: clicks, drags, a
      // turn on the keyboard, a held charge, and the mute key.
      if (s === 3 || s === 6) { down(400, 300); up(); }
      if (s > 10 && s < 70 && s % 5 === 0) { down(300 + s * 3, 240); move(320 + s * 3, 250); up(); }
      if (s === 25) key('keydown', 'KeyD');
      if (s === 33) key('keyup', 'KeyD');
      if (s === 40) key('keydown', 'ArrowLeft');
      if (s === 48) key('keyup', 'ArrowLeft');
      if (s === 55) key('keydown', 'Space');
      if (s === 75) key('keyup', 'Space');
      if (s === 80) { key('keydown', 'KeyM'); key('keyup', 'KeyM'); }
      try {
        if (s === 30) first = hash()[0];
        if (s === 90) { const [h, l, z] = hash(); moved = h !== first ? 1 : 0; lit = l; size = z; }
      } catch (e) { note('canvas', e.message); }
      if (s >= 110) {
        clearInterval(iv);
        try { navigator.sendBeacon('/report', JSON.stringify(
          { bad, ua: navigator.userAgent, size, lit, moved })); } catch (e) {}
      }
    }, 100);
  });
})();`;

const page = '<script>' + REPORTER + '</script>' + DIST;

const which = (paths) => paths.find((p) => { try { readFileSync(p); return true; } catch { return p.indexOf('/') < 0; } });

const run = (name, exe, args) => new Promise((done) => {
  let got = null;
  const srv = createServer((req, res) => {
    if (req.url === '/report') {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => { got = b; res.writeHead(204); res.end(); });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
    res.end(page);
  });
  srv.listen(0, () => {
    const port = srv.address().port;
    const profile = join(tmpdir(), 'oln-' + name + '-' + Date.now());
    mkdirSync(profile, { recursive: true });
    const child = spawn(exe, [...args(profile), 'http://localhost:' + port + '/'],
                        { stdio: 'ignore' });
    const finish = (result) => {
      clearInterval(poll); clearTimeout(bail);
      try { child.kill(); } catch {}
      srv.close();
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
      done(result);
    };
    const poll = setInterval(() => got && finish(JSON.parse(got)), 200);
    const bail = setTimeout(() => finish(null), 90000);
  });
});

let bad = 0, ran = 0;
for (const [name, paths, args] of CANDIDATES) {
  const exe = which(paths);
  if (!exe) { console.log('SKIP  ' + name.padEnd(9) + ' not installed'); continue; }
  const r = await run(name, exe, args);
  ran++;
  if (!r) { console.log('FAIL  ' + name.padEnd(9) + ' no report came back in 90s'); bad++; continue; }
  const ok = r.bad.length === 0 && r.moved && r.lit > 0;
  if (!ok) bad++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name.padEnd(9) +
    r.size + ', ' + r.lit + ' lit samples, ' + (r.moved ? 'animating' : 'FROZEN') +
    (r.bad.length ? '  ' + r.bad.length + ' PROBLEM(S)' : ', nothing on the console'));
  r.bad.forEach((b) => console.log('        ' + b));
  console.log('        ' + r.ua);
}
console.log('');
console.log(bad ? '  ' + bad + ' of ' + ran + ' browser(s) reported a problem'
                : '  the shipped file runs clean in ' + ran + ' browser(s)');
process.exit(bad ? 1 : 0);
