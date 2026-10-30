/* ================= 0.25.0: a backdrop of a servant's own =================
   Every servant's page wears their class's backdrop (Beast: the rainbow waves made for Space Ereshkigal). A servant
   listed in OWN_BG gets one of their own instead: the class canvas switches to another of its existing looks, and a
   layer of CSS (transforms and opacity only, so the graphics card stays calm) adds the rest on top.
   - Sodom's Beast/Draco (No. 377), the Beast of Revelation: a great rose window in crimson and gold turning slowly
     behind her golden cup, a crimson glow, stars falling from heaven, and Nero's rose petals drifting down. (A first
     try with fire and explosions looked too much like the Avenger backdrop.) The canvas keeps only its quiet motes,
     tinted gold, and the page itself takes a crimson tint (in place of the Beast's pink). Her art panel on the
     SERVANTPAGE gets the golden cup too, in its empty corner, with a small rose window turning behind it.
   - U-Olga Marie isn't on NA yet; when NA's data has her, her collection number and a look of her own go here. */
const OWN_BG = {
  377: {kind: "motes", acc: [232, 184, 74], page: [196, 22, 52], m: "revelation", n: {star: 14, petal: 18}}
};
function ownBg(s) { const a = s ? atlasOf(s) : null; return a ? OWN_BG[a.no] || null : null; }
const fxParams25 = fxParams;
fxParams = function (s) {
  const p = fxParams25(s), o = ownBg(s);
  if (o) { p.kind = o.kind; p.beast = false; p.foreign = false; p.pret = false; p.extra = o.acc; p.own = o.m; }
  return p;
};
// the page's colours lean to the servant's own accent
const extraAccOf25 = extraAccOf;
extraAccOf = function (s, raw) { const o = ownBg(s); return o && o.page ? o.page : extraAccOf25(s, raw); };
function ownBgHTML(o) {
  let seed = 9001; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647, h = [];
  const v = (k, val) => "--" + k + ":" + val;
  if (o.m === "revelation") h.push(`<i class="ob-glow"></i><i class="ob-rose"></i><i class="ob-rose r2"></i><i class="ob-cup"></i>`);
  for (let i = 0; i < (o.n.star || 0); i++) h.push(`<i class="ob-star" style="${[v("x", (8 + r() * 104).toFixed(1) + "%"), v("s", (0.6 + r() * 0.9).toFixed(2)), v("d", (3.5 + r() * 4).toFixed(2) + "s"), v("dl", (-r() * 8).toFixed(2) + "s")].join(";")}"></i>`);
  for (let i = 0; i < (o.n.petal || 0); i++) h.push(`<i class="ob-petal k${1 + (i % 3)}" style="${[v("x", (r() * 100).toFixed(1) + "%"), v("s", (0.6 + r() * 0.9).toFixed(2)), v("d", (9 + r() * 10).toFixed(2) + "s"), v("dl", (-r() * 19).toFixed(2) + "s"), v("r", Math.round(r() * 360) + "deg"), v("sw", ((r() - 0.5) * 26).toFixed(1) + "vw")].join(";")}"></i>`);
  return h.join("");
}
// the servant page's art panel: a layer between its class canvas and the pictures
const OWN_SCENE = {revelation: `<div class="os-at"><i class="os-glow"></i><i class="os-rose"></i><i class="os-cup"></i></div>`};
const artHTML25o = artHTML;
artHTML = function (s) {
  const h = artHTML25o(s), o = ownBg(s), x = o && OWN_SCENE[o.m];
  return x ? h.replace('<canvas class="scene-fx" id="scene-fx" aria-hidden="true"></canvas>', (c) => c + `<div class="own-scene" data-m="${o.m}" aria-hidden="true">${x}</div>`) : h;
};
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
