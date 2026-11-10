/* ================= 0.52.0-beta: Compact opens the way Past Chaldea's window does =================
   In the Compact layout a servant's page is a window over the list. It used to fade in over a fifth of a second;
   now it opens like a servant's window in Past Chaldea: the page behind dims, the window drops in, the picture lands
   like a card and the lines beside it rise in one after another (the same keyframes: uiFade, uiDrop, uiCard,
   uiViewIn in 32-ui.css). On a phone the Compact page is a sheet, and its picture and lines arrive the same way.

   The classes go on the parts that are there when it opens, not on the window as a rule for whatever is inside it:
   the page redraws itself while it's open (a + pressed, a picture arriving), and what's drawn later must not play
   the entrance again. The gold frame of a Lv 100 servant is placed from the window's box, so it waits until the
   window has landed. */
let cmpDropT = 0, cmpWasOpen = false;
function cmpDropEnd() {
  clearTimeout(cmpDropT); cmpDropT = 0;
  document.querySelectorAll(".cmp-drop, .cmp-card, .cmp-rise").forEach((el) => { el.classList.remove("cmp-drop", "cmp-card", "cmp-rise"); el.style.removeProperty("--cd"); });
  if (document.documentElement.classList.contains("cmp-dropping")) { document.documentElement.classList.remove("cmp-dropping"); if (typeof queueDsFrame === "function") queueDsFrame(); }
}
function cmpDropSync() {
  const d = document.getElementById("dossier"); if (!d) return;
  const open = pageLayout === "compact" && S.tab === "servants" && !!S.selected && d.classList.contains("open") && !S.editing;
  if (open && !cmpWasOpen && !RM.matches && d.querySelector(".cmp-top")) {
    cmpDropEnd();
    d.classList.add("cmp-drop"); cmpVeil.classList.add("cmp-drop"); cmpX.classList.add("cmp-drop");
    const card = d.querySelector(".cmp-l"); if (card) card.classList.add("cmp-card");
    let i = 0;
    d.querySelectorAll(".cmp-r > *").forEach((el) => { el.classList.add("cmp-rise"); el.style.setProperty("--cd", (0.18 + Math.min(i++, 3) * 0.04).toFixed(2) + "s"); });
    Array.from(d.children).forEach((el) => { if (!el.classList.contains("cmp-top")) { el.classList.add("cmp-rise"); el.style.setProperty("--cd", ".3s"); } });
    document.documentElement.classList.add("cmp-dropping");
    cmpDropT = setTimeout(cmpDropEnd, 900);
  }
  if (!open && cmpWasOpen) cmpDropEnd();
  cmpWasOpen = open;
}
const renderDossier56 = renderDossier;
renderDossier = function () { const r = renderDossier56.apply(this, arguments); cmpDropSync(); return r; };
const renderChrome56 = renderChrome;
renderChrome = function () { const r = renderChrome56.apply(this, arguments); cmpDropSync(); return r; };
