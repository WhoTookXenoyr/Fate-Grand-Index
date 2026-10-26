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
