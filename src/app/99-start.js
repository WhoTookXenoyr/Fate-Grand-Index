// Where the page is scrolled when it opens (0.23.1):
// - While the page builds itself, the browser's scroll anchoring followed the footer down as the views filled in, so a
//   reload on a phone ended at the bottom. Anchoring is off until the page has settled.
// - The browser's own restore gave up on a reload (the page wasn't built yet when it tried), so the page keeps its
//   scroll position for this browser tab itself and puts it back once it has settled.
// - Opened fresh on a tab's address (a bookmark, a link, a restored tab), the browser scrolled to the element with that
//   id (<div id="home"> while Home was still empty); that start now goes to the top.
// A scroll of your own is never undone.
(function () {
  const root = document.documentElement, KEY = "spirit-origin-list:v1:scroll";
  root.style.overflowAnchor = "none";
  try { history.scrollRestoration = "manual"; } catch (e) {}
  window.addEventListener("pagehide", () => { try { sessionStorage.setItem(KEY, JSON.stringify({h: location.hash, y: Math.round(window.scrollY)})); } catch (e) {} });
  let nav = null, saved = null; try { nav = performance.getEntriesByType("navigation")[0]; } catch (e) {}
  const again = nav && (nav.type === "reload" || nav.type === "back_forward");
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) {}
  const y = again && saved && saved.h === location.hash ? Math.max(0, Number(saved.y) || 0) : 0;
  let own = false; const mine = () => { own = true; };
  ["wheel", "touchstart", "keydown", "mousedown"].forEach((t) => window.addEventListener(t, mine, {once: true, passive: true, capture: true}));
  const put = () => { if (!own && Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y); };
  if (y || location.hash) put();
  window.addEventListener("load", () => {
    if (y || location.hash) { put(); setTimeout(put, 0); setTimeout(put, 250); }
    setTimeout(() => { if (y || location.hash) put(); root.style.overflowAnchor = ""; }, 600);
  }, {once: true});
})();
initFonts();
init();
})();
