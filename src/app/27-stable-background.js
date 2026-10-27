/* ---------- the background's height ignores a phone's address bar (0.24.0) ----------
   --bg-h is the tallest the window has been at its current width. A phone's address bar sliding in or out only changes
   the height, so the background (17-stable-background.css) keeps its size; turning the phone changes the width and
   starts over. The first value also counts the "large viewport" (100lvh), the height with the bar hidden. */
const bgSize = {w: 0, h: 0};
function bgLarge() {
  try {
    const p = document.createElement("div"); p.style.cssText = "position:fixed;top:0;left:0;width:1px;height:100vh;height:100lvh;visibility:hidden;pointer-events:none";
    document.body.appendChild(p); const h = p.offsetHeight; p.remove(); return h || 0;
  } catch (e) { return 0; }
}
function syncBgHeight() {
  const w = window.innerWidth, h = window.innerHeight;
  if (w !== bgSize.w) { bgSize.w = w; bgSize.h = Math.max(h, bgLarge()); }
  else if (h > bgSize.h) bgSize.h = h;
  else return;
  document.documentElement.style.setProperty("--bg-h", bgSize.h + "px");
}
syncBgHeight();
window.addEventListener("resize", syncBgHeight);

/* ---------- big screens: the interface grows with the screen (0.24.0, 18-ui-scale.css) ----------
   The page was made for about 1700 wide; above that it's zoomed by width/1700, unless the window is short for its
   width (an ultrawide screen): then by height/840, in steps of 1/40. Phones, tablets and anything up to 1700 wide stay
   at 1. 0.25.0: the height counts from 840, not 960, because the browser's own bars and the taskbar take about 140 of
   a screen's height: a 1080p screen (or a 4K one at 200%, which is the same size to a page) is zoomed 1.125, like the
   full-screen 1080p it was made to look like, where it used to stay at 1. */
function syncUiZoom() {
  const w = window.innerWidth, h = window.innerHeight;
  const z = w <= 900 ? 1 : Math.round(clamp(Math.min(w / 1700, h / 840), 1, 2.5) * 40) / 40;
  if (z === UI_Z && document.documentElement.style.getPropertyValue("--ui-z")) return;
  UI_Z = z; document.documentElement.style.setProperty("--ui-z", String(z));
  if (typeof queueDsFrame === "function") queueDsFrame();
}
syncUiZoom();
window.addEventListener("resize", syncUiZoom);
