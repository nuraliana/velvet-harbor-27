// shots.js — fixed scenes for screenshots: ?shot=editor shows the page
// with the demo cover; ?shot=cover shows the cover alone.
// `size` picks the export ratio, `grade` the colour grade,
// `title`/`subtitle` the words. window.__shotReady is set once painted.
export function runShot(shot, query, load) {
  if (shot === 'cover' || shot === 'cover-square') document.body.classList.add('shot-cover');
  if (shot === 'cover-square') document.body.classList.add('shot-square');
  load();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
