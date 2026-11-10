/* ================= 0.53.0-beta: the page's colours: Chaldea blue, or black and cream =================
   A friend of Noyr's didn't care for the dark blue of dark mode and suggested true black (AMOLED) with cream white
   for light mode. It's a choice on Settings so the two can be compared: spirit-origin-list:v1:palette = "mono".
   The colours themselves are variables in 39-palette.css (html[data-pal="mono"]); page.html sets the attribute before
   the first paint. What's here: the switch, and the page's own background, which paintPage works out from a servant's
   or a chapter's colours and writes on the page itself. In black and cream it stays black in dark mode (a black pixel
   is a pixel switched off, which is the point of it) and cream with a tenth of that colour in light mode. */
const PAL_KEY = "spirit-origin-list:v1:palette";
let palMono = lsGet(PAL_KEY) === "mono";
const PAL_CREAM = ["#f3ecdd", "#ece3cf", "#faf5ea"];
const paintPage60 = paintPage;
paintPage = function () {
  const r = paintPage60.apply(this, arguments);
  if (palMono) {
    try {
      const st = document.documentElement.style, dark = isDark();
      [1, 2, 3].forEach((i) => { const c = st.getPropertyValue("--g" + i).trim(); st.setProperty("--g" + i, dark ? "#000000" : /^#[0-9a-f]{6}$/i.test(c) ? scMix(PAL_CREAM[i - 1], c, 0.1) : PAL_CREAM[i - 1]); });
    } catch (e) {}
  }
  return r;
};
function palPaint() { document.querySelectorAll('[data-action="palette"]').forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.v === "mono") === palMono))); }
function setPalette(mono, quiet) {
  palMono = !!mono;
  try { if (palMono) localStorage.setItem(PAL_KEY, "mono"); else localStorage.removeItem(PAL_KEY); } catch (e) {}
  if (palMono) document.documentElement.setAttribute("data-pal", "mono"); else document.documentElement.removeAttribute("data-pal");
  // everything drawn in the page's colours is drawn again, as it is after the light/dark switch
  paintPage(); palPaint();
  try { if (typeof drawIdleWords === "function") drawIdleWords(); document.dispatchEvent(new CustomEvent("fgi-theme", {detail: isDark() ? "dark" : "light"})); } catch (e) {}
  if (!quiet) toastAction(palMono ? "Black and cream: true black in dark mode, cream white in light mode." : "Chaldea blue is back.", "Undo", () => setPalette(!palMono, true));
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="palette"]'); if (!b) return;
  const mono = b.dataset.v === "mono"; if (mono !== palMono) setPalette(mono);
});
const renderSettings60 = typeof renderSettings === "function" ? renderSettings : null;
if (renderSettings60) renderSettings = function () { const r = renderSettings60.apply(this, arguments); palPaint(); return r; };
// (the attribute is on the page already when the key was stored; this covers a page whose first script didn't run)
if (palMono !== (document.documentElement.getAttribute("data-pal") === "mono")) { if (palMono) document.documentElement.setAttribute("data-pal", "mono"); else document.documentElement.removeAttribute("data-pal"); }
if (palMono) paintPage();
palPaint();
window.__fgiPalette = {mono: () => palMono, set: (m) => setPalette(!!m, true)};
