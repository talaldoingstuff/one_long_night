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

// Where the browsers are. Installed paths for the three platforms first, then
// the bare names to try on PATH. FIREFOX= and CHROME= in the environment beat
// all of it, which is the answer for anywhere this list does not know about.
const CANDIDATES = [
  ['Firefox', process.env.FIREFOX, [
    'C:/Program Files/Mozilla Firefox/firefox.exe',
    'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
    '/Applications/Firefox.app/Contents/MacOS/firefox',
    '/usr/bin/firefox', '/usr/local/bin/firefox', '/snap/bin/firefox',
    'firefox', 'firefox-esr'],
   (profile) => ['--headless', '--no-remote', '--profile', profile]],
  ['Chrome', process.env.CHROME, [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'],
   (profile) => ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + profile]],
];

const REPORTER = `(() => {
  const bad = [];
  const note = (k, m) => bad.push(k + ': ' + m);
  addEventListener('error', (e) => note('window.error',
    (e.message || e.type) + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?')), true);
  addEventListener('unhandledrejection', (e) => note('unhandledrejection', e.reason));
  // error and warn are what the rule is about. log, info and debug are caught
  // too and reported separately: a dev server's HMR client chatters on those,
  // and the only way to say the SHIPPED file is silent is to listen to them.
  const said = [];
  for (const k of ['error', 'warn']) {
    const orig = console[k].bind(console);
    console[k] = (...a) => { note('console.' + k, a.map(String).join(' ')); orig(...a); };
  }
  for (const k of ['log', 'info', 'debug']) {
    const orig = console[k].bind(console);
    console[k] = (...a) => { said.push('console.' + k + ': ' + a.map(String).join(' ')); orig(...a); };
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
          { bad, said, ua: navigator.userAgent, size, lit, moved })); } catch (e) {}
      }
    }, 100);
  });
})();`;

const page = '<script>' + REPORTER + '</script>' + DIST;

// An installed path is proved by reading it. A bare name cannot be proved from
// here, so it is handed to spawn and the ENOENT is caught below - which is what
// turns "not installed" into a message instead of a stack trace.
const onDisk = (p) => { try { readFileSync(p); return true; } catch { return false; } };
const which = (env, paths) => env || paths.find(onDisk) || paths.filter((p) => !p.includes('/'));

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
    // A name that is not on PATH makes spawn emit 'error', and with no listener
    // that is an unhandled exception which takes the whole run down before the
    // second browser is ever tried.
    const names = Array.isArray(exe) ? exe : [exe];
    let child = null, idx = 0;
    const finish = (result) => {
      clearInterval(poll); clearTimeout(bail);
      try { child && child.kill(); } catch {}
      srv.close();
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
      done(result);
    };
    const tryNext = () => {
      if (idx >= names.length) return finish({ missing: names.join(' / ') });
      child = spawn(names[idx++], [...args(profile), 'http://localhost:' + port + '/'],
                    { stdio: 'ignore' });
      child.on('error', () => tryNext());
    };
    tryNext();
    const poll = setInterval(() => got && finish(JSON.parse(got)), 200);
    const bail = setTimeout(() => finish(null), 90000);
  });
});

// The rule names BOTH browsers, so a run that could only open one has not
// checked it. Anything short of two passes is a failure with a reason, never a
// quiet green.
let bad = 0, ran = 0;
for (const [name, env, paths, args] of CANDIDATES) {
  const r = await run(name, which(env, paths), args);
  if (r && r.missing) {
    console.log('FAIL  ' + name.padEnd(9) + 'NOT INSTALLED where this can find it - tried ' +
      r.missing + '. Point at it with ' + name.toUpperCase() + '=/path/to/binary');
    bad++; continue;
  }
  ran++;
  if (!r) { console.log('FAIL  ' + name.padEnd(9) + ' no report came back in 90s'); bad++; continue; }
  const ok = r.bad.length === 0 && r.moved && r.lit > 0;
  if (!ok) bad++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name.padEnd(9) +
    r.size + ', ' + r.lit + ' lit samples, ' + (r.moved ? 'animating' : 'FROZEN') +
    (r.bad.length ? '  ' + r.bad.length + ' PROBLEM(S)'
      : r.said.length ? ', no errors but ' + r.said.length + ' log line(s)'
      : ', console completely silent'));
  r.bad.forEach((b) => console.log('        ' + b));
  r.said.forEach((b) => console.log('        (log) ' + b));
  console.log('        ' + r.ua);
}
console.log('');
console.log(bad ? '  ' + bad + ' of ' + CANDIDATES.length + ' browser(s) failed or could not be run'
                : '  the shipped file runs clean in all ' + ran + ' browser(s) the rule names');
process.exit(bad ? 1 : 0);
