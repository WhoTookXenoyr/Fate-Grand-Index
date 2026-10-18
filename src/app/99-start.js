

initFonts();
init();
// Opening the page on a tab's address (a bookmark, a link, a restored tab) made the browser scroll to the element with
// that id: <div id="home"> while Home was still empty, then down with the footer as Home filled in (0.23.1). A reload or
// Back/Forward keeps the browser's own scroll position, and a scroll of your own is never undone.
(function () {
  let nav = null; try { nav = performance.getEntriesByType("navigation")[0]; } catch (e) {}
  if (!location.hash || (nav && (nav.type === "reload" || nav.type === "back_forward"))) return;
  let own = false; const mine = () => { own = true; };
  ["wheel", "touchstart", "keydown", "mousedown"].forEach((t) => window.addEventListener(t, mine, {once: true, passive: true, capture: true}));
  const top = () => { if (!own && window.scrollY) window.scrollTo(0, 0); };
  top(); window.addEventListener("load", () => { top(); setTimeout(top, 0); setTimeout(top, 250); }, {once: true});
})();
})();
