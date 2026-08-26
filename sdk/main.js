// THROWAWAY. Not part of the game bundle.
//
// Purpose: measure the real cost of the Wavedash integration so DESIGN.md 2's
// 800-byte reserve can be replaced with a number. This is a minimal game-shaped
// shell (canvas, loop, score, game over) so the compressor has realistic context,
// plus every SDK call site from DESIGN.md 4 wired to dummy values.
//
// tools/sdk-cost.js packs this twice: once as-is, once with everything between
// the WD-START and WD-END markers deleted. The difference is the reserve.

const g = document.getElementById('c').getContext('2d');
let score = 0, t0 = 0, over = 0;

const draw = () => {
  g.fillStyle = '#0a0a14';
  g.fillRect(0, 0, innerWidth, innerHeight);
  g.fillStyle = '#fff';
  g.font = '20px monospace';
  g.fillText(over ? 'OVER ' + score : 'SCORE ' + score, 20, 40);
};

const frame = (t) => {
  requestAnimationFrame(frame);
  if (!over) {
    score = t / 1000 | 0;
    if (t - t0 > 20000) gameOver();
  }
  draw();
};

const gameOver = () => {
  over = 1;
  // WD-START
  wdSubmit(score);
  // WD-END
};

// WD-START ------------------------------------------------------------------
// Every Wavedash call site from DESIGN.md 4. Write-only: nothing is read back,
// nothing is rendered from the SDK.
let wdBoard;

// The typeof guard is mandatory - the zip must be fully playable standalone with
// no Wavedash global present. `typeof X < 'u'` is the golfed !== 'undefined'.
(async () => {
  try {
    if (typeof Wavedash < 'u') {
      Wavedash.init();
      // Cache the id once at startup.
      wdBoard = await Wavedash.getOrCreateLeaderboard('rainbowed', 'Unicorns', 1);
    }
  } catch (e) {}
})();

const wdSubmit = (s) => {
  // try/catch is mandatory: an unhandled rejection is a console error, which
  // breaks a hard competition rule. Never awaited before the results render.
  try { if (wdBoard) Wavedash.uploadLeaderboardScore(wdBoard.id, s, true); } catch (e) {}
  // Personal best lives in namespaced localStorage, not on the leaderboard.
  // Never localStorage.clear() - js13k games share an origin.
  try {
    const k = 'rbwd.best';
    localStorage[k] = Math.max(+localStorage[k] || 0, s);
  } catch (e) {}
};
// WD-END --------------------------------------------------------------------

t0 = 0;
requestAnimationFrame(frame);
