/* ================= 0.25.0: a backdrop of a servant's own =================
   Every servant's page wears their class's backdrop (Beast: the rainbow waves made for Space Ereshkigal). A servant
   listed in OWN_BG gets one of their own instead: the class canvas switches to another of its existing looks, and a
   layer of CSS (transforms and opacity only, so the graphics card stays calm) adds the rest on top.
   - Sodom's Beast/Draco (No. 377): blazing fire from below with embers (the canvas), explosions bursting here and
     there, and red petals blowing through.
   - U-Olga Marie isn't on NA yet; when NA's data has her, her collection number and a look of her own go here. */
const OWN_BG = {
  377: {kind: "embers", acc: [255, 84, 36], m: "inferno", n: {flame: 9, boom: 6, petal: 26}}
};
function ownBg(s) { const a = s ? atlasOf(s) : null; return a ? OWN_BG[a.no] || null : null; }
const fxParams25 = fxParams;
fxParams = function (s) {
  const p = fxParams25(s), o = ownBg(s);
  if (o) { p.kind = o.kind; p.beast = false; p.foreign = false; p.pret = false; p.extra = o.acc; p.own = o.m; }
  return p;
};
function ownBgHTML(o) {
  let seed = 9001; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647, h = [];
  const v = (k, val) => "--" + k + ":" + val;
  for (let i = 0; i < o.n.flame; i++) h.push(`<i class="ob-flame" style="${[v("x", ((i + 0.5) / o.n.flame * 100 + (r() - 0.5) * 6).toFixed(1) + "%"), v("s", (0.75 + r() * 0.7).toFixed(2)), v("d", (1.6 + r() * 1.4).toFixed(2) + "s"), v("dl", (-r() * 3).toFixed(2) + "s")].join(";")}"></i>`);
  for (let i = 0; i < o.n.boom; i++) h.push(`<i class="ob-boom" style="${[v("x", (8 + r() * 84).toFixed(1) + "%"), v("y", (10 + r() * 62).toFixed(1) + "%"), v("s", (0.6 + r() * 0.9).toFixed(2)), v("d", (4.5 + r() * 4).toFixed(2) + "s"), v("dl", (-r() * 8).toFixed(2) + "s")].join(";")}"><b></b></i>`);
  for (let i = 0; i < o.n.petal; i++) h.push(`<i class="ob-petal k${1 + (i % 3)}" style="${[v("x", (r() * 100).toFixed(1) + "%"), v("s", (0.6 + r() * 0.9).toFixed(2)), v("d", (8 + r() * 10).toFixed(2) + "s"), v("dl", (-r() * 18).toFixed(2) + "s"), v("r", Math.round(r() * 360) + "deg"), v("sw", ((r() - 0.5) * 30).toFixed(1) + "vw")].join(";")}"></i>`);
  return h.join("");
}
let ownBgKey = "";
function ownBgPaint() {
  const s = S.servants.find((x) => x.id === shownId()) || null, o = ownBg(s);
  const on = !!(o && PAGE.p && PAGE.p.own === o.m && !document.documentElement.classList.contains("story-on") && S.tab !== "event");
  let el = document.getElementById("own-bg");
  if (on && !el) { const pb = document.querySelector(".page-bg"); if (!pb) return; pb.insertAdjacentHTML("afterend", `<div id="own-bg" class="own-bg" aria-hidden="true"></div>`); el = document.getElementById("own-bg"); }
  if (!el) return;
  if (on && ownBgKey !== o.m) { ownBgKey = o.m; el.dataset.m = o.m; el.innerHTML = ownBgHTML(o); }
  el.classList.toggle("on", on); el.classList.toggle("lt", !isDark());
}
const syncPageTheme25o = syncPageTheme;
syncPageTheme = function () { const r = syncPageTheme25o.apply(this, arguments); ownBgPaint(); return r; };
const renderChrome25o = renderChrome;
renderChrome = function () { const r = renderChrome25o.apply(this, arguments); ownBgPaint(); return r; };
DARK_Q.addEventListener("change", ownBgPaint);
document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest('[data-action="theme"]')) setTimeout(ownBgPaint, 0); });
// the servant page attaches the class canvas itself when it draws
const renderDossier25o = renderDossier;
renderDossier = function () { const r = renderDossier25o.apply(this, arguments); ownBgPaint(); return r; };
