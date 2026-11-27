/* ================= 0.28.0: card frames, the game's frames around a servant's or Craft Essence's picture =================
   A Card frame switch (Off / On) on the SERVANTPAGE and in Past Chaldea's windows; each place keeps its own choice
   (spirit-origin-list:v1:cardframe = {mine, pc}, per browser like the theme).
   - Servants get the Saint Graph frame: the class in its diamond, ATK and HP under the swords. On the SERVANTPAGE those
     are what the Stats section shows (Fou and an equipped Craft Essence included); in Past Chaldea NA's numbers at the
     max level.
   - Craft Essences (Past Chaldea) get the open frame with the vines, with their ATK and HP at the max level.
   The frame's metal follows the game: bronze ★0–2, silver ★3, gold ★4–5, and grails upgrade it the way NA's grail
   table says (Atlas Academy's export/NA/NiceSvtGrailCost.json): ★1–2 turn silver with the first grail and gold with
   the third, ★3 gold with the second. The stars stay the servant's own. Past Lv 100 the game uses a gold-and-red
   frame; until we have that picture they keep the gold one (the box gets cf-red, ready for it). ★0 (black, then
   gold-and-black in the game) keeps its bronze frame. The gold ★1–3 and silver ★1–2 frames are put together from the
   frames we have: the frame's top is redrawn without stars (from the starless ★0 frame, recoloured) and the stars of
   the frame with that many are laid on (see the 0.28.0 notes). The overlay is added after each render (like the
   glare) and never saved with the servant. */
const CF_KEY = "spirit-origin-list:v1:cardframe";
// Saint Graph frames by metal and stars; Craft Essence frames by rarity
const CF_F = {
  bronze: ["@@asset:cardframe-f0.webp@@", "@@asset:cardframe-f1.webp@@", "@@asset:cardframe-f2.webp@@"],
  silver: [null, "@@asset:cardframe-fs1.webp@@", "@@asset:cardframe-fs2.webp@@", "@@asset:cardframe-f3.webp@@"],
  gold: [null, "@@asset:cardframe-fg1.webp@@", "@@asset:cardframe-fg2.webp@@", "@@asset:cardframe-fg3.webp@@", "@@asset:cardframe-f4.webp@@", "@@asset:cardframe-f5.webp@@"]
};
const CF_O = [null, "@@asset:cardframe-o1.webp@@", "@@asset:cardframe-o2.webp@@", "@@asset:cardframe-o3.webp@@", "@@asset:cardframe-o4.webp@@", "@@asset:cardframe-o5.webp@@"];
/* 0.58.0: the game's own star row and class emblem on a servant's frame, from Atlas Academy's JP assets (the
   CharaGraphOption bundle; Noyr asked for the card's pieces, 27 Nov 2026): the game puts a star row (rarity{★}_{n}) and
   a class emblem in the frame's metal (class{1 bronze, 2 silver, 3 gold}_{class id}) on the frame. So a servant's frame here is the frame without
   stars (cardframe-f0 bronze; s0 and g0 are silver and gold with the bronze frame's starless top recoloured), with the
   game's stars on top:
   - n is 0 as summoned, 1 once grailed past its own level cap (the cup), 2 at Lv 100, 3 at Lv 120 (rays); a ★0's rows
     start at 1 (as in the game, and Chaldea's report: e.g. rarity0_1);
   - 0 is 200 × 60, 1 and 2 are 200 × 52, the Lv 120 row is 350 × 52 (cf-st-a, -b, -c in 29-card-frames.css); a ★0's
     crest hangs from the frame's top edge (cf-st0).
   The emblem replaces the gold badge (CLASS_LOGO, recoloured by filters for silver and bronze) where the game has one.
   Both come from static.atlasacademy.io; when one can't be loaded (offline, say), the frame goes back to the one with
   its stars drawn in (CF_F) and the badge, so a card never shows without stars. Past Chaldea's servants get it too
   (no grails there, so the plain row). */
const CF_AA = "https://static.atlasacademy.io/JP/CharaGraphOption/";
const CF_BARE = {bronze: "@@asset:cardframe-f0.webp@@", silver: "@@asset:cardframe-s0.webp@@", gold: "@@asset:cardframe-g0.webp@@"};
const CF_METAL_N = {bronze: 1, silver: 2, gold: 3};
// the game's class ids for the emblems (the ones with all three metals)
const CF_CLS_ID = {Saber: 1, Archer: 2, Lancer: 3, Rider: 4, Caster: 5, Assassin: 6, Berserker: 7, Shielder: 8, Ruler: 9, "Alter Ego": 10, Avenger: 11, "Moon Cancer": 23, Foreigner: 25, Pretender: 28, Beast: 33};
function cfStarsOf(k, g, L) {
  let n = L >= 120 ? 3 : L >= 100 ? 2 : g > 0 ? 1 : 0;
  if (k === 0) n += 1;
  return {k: k, n: n, w: n === 0 ? "a" : n >= (k === 0 ? 4 : 3) ? "c" : "b"};
}
// NA's grail table: the level each rarity reaches without grails, and the levels each grail adds after that
const CF_BASE = [65, 60, 65, 70, 80, 90];
const CF_ADD = [
  [5, 10, 15, 20, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55],
  [10, 15, 20, 25, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60],
  [5, 10, 15, 20, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55],
  [5, 10, 15, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50],
  [5, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40],
  [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]
];
// from which grail the frame turns silver, gold, gold-and-red (0: it already is / never)
const CF_STEP = [[0, 0, 0], [1, 3, 11], [1, 3, 11], [0, 2, 10], [0, 0, 8], [0, 0, 6]];
let cfMem = null;
function cfPrefs() {
  if (cfMem) return cfMem;
  try { const d = JSON.parse(localStorage.getItem(CF_KEY) || "null"); cfMem = d && typeof d === "object" && !Array.isArray(d) ? d : {}; } catch (e) { cfMem = {}; }
  return cfMem;
}
function cfOn(where) { return !!cfPrefs()[where]; }
function cfSet(where, on) { cfPrefs()[where] = !!on; try { localStorage.setItem(CF_KEY, JSON.stringify(cfMem)); } catch (e) {} }
const cfStars = (r) => clamp(Math.round(num(r) || 0), 0, 5);
// how many grails a level takes, by NA's table
function cfGrails(r, lv) {
  const add = CF_ADD[r], base = CF_BASE[r], L = num(lv) || 0; let g = 0;
  while (g < add.length && base + (g ? add[g - 1] : 0) < L) g++;
  return g;
}
// a servant's frame: {st, src, metal, red}; a Craft Essence's: {st: "o", src, metal}
function cfFrame(r, lv) {
  const k = cfStars(r), g = lv == null ? 0 : cfGrails(k, lv), [sv, gd, rd] = CF_STEP[k];
  let metal = k >= 4 ? "gold" : k === 3 ? "silver" : "bronze";
  if (k > 0 && g) { if (gd && g >= gd) metal = "gold"; else if (sv && g >= sv) metal = "silver"; }
  // 0.50.0: Lv 100 and Lv 120 (lvl): the side edges, then every gold part, turn rainbow, with an aura around the card
  const L = num(lv) || 0;
  return {st: "f", metal: metal, red: !!(rd && g >= rd), lvl: L >= 120 ? 120 : L >= 100 ? 100 : 0, src: CF_F[metal][k] || CF_F.bronze[k],
    bare: CF_BARE[metal], stars: cfStarsOf(k, g, L)};
}
function cfFrameCe(r) { const k = clamp(cfStars(r), 1, 5); return {st: "o", metal: k >= 4 ? "gold" : k === 3 ? "silver" : "bronze", red: false, lvl: 0, src: CF_O[k]}; }

// what goes on top of the picture
function cfLayerHTML(fr, cls, atk, hp) {
  const logo = fr.st === "f" ? CLASS_LOGO[cls] : null, lv = fr.st === "f" ? fr.lvl || 0 : 0;
  // 0.58.0: the game's star row over a frame without stars, and its emblem for the class (both fall back, see above)
  const st = fr.st === "f" && fr.stars && fr.bare ? fr.stars : null, id = logo ? CF_CLS_ID[cls] : 0;
  const emb = id ? CF_AA + "class" + CF_METAL_N[fr.metal] + "_" + id + ".png" : logo;
  // Lv 100+: an aura around the card (behind it) and the rainbow, laid over the frame where its gold is (cf-rb);
  // at Lv 120 the class in the diamond turns rainbow too
  return (lv ? `<span class="cf-aura" aria-hidden="true"><i></i><i></i></span>` : "")
    + (st ? `<img class="cf-img" src="${fr.bare}" data-fb="${fr.src}" alt="" aria-hidden="true" draggable="false">`
      + `<img class="cf-st cf-st-${st.w}${st.k === 0 ? " cf-st0" : ""}" src="${CF_AA}rarity${st.k}_${st.n}.png" alt="" aria-hidden="true" draggable="false">`
      : `<img class="cf-img" src="${fr.src}" alt="" aria-hidden="true" draggable="false">`)
    + (lv ? `<span class="cf-rb" aria-hidden="true"><i></i></span><span class="cf-rs" aria-hidden="true"><i></i></span>` : "")
    + (logo ? `<span class="cf-cls${id ? " aa" : ""}" aria-hidden="true"><img src="${emb}"${id ? ` data-fb="${logo}"` : ""} alt="" draggable="false">${lv >= 120 ? `<span class="cf-cls-rb" style="--cf-m: url('${emb}')"><i></i></span>` : ""}</span>` : "")
    + `<span class="cf-n cf-atk" aria-hidden="true">${atk == null ? "" : fmt(atk)}</span><span class="cf-n cf-hp" aria-hidden="true">${hp == null ? "" : fmt(hp)}</span>`
    + `<span class="sr cf-sr">${esc([atk != null ? "ATK " + fmt(atk) : "", hp != null ? "HP " + fmt(hp) : ""].filter(Boolean).join(", "))}</span>`;
}
// puts a frame on (fr) or takes it off (null) a picture box: .art-frame on the SERVANTPAGE, .pcd-frame in Past Chaldea
function cfApply(box, fr, cls, atk, hp) {
  if (!box) return;
  box.querySelectorAll(":scope > .cf-img, :scope > .cf-st, :scope > .cf-cls, :scope > .cf-n, :scope > .cf-sr, :scope > .cf-aura, :scope > .cf-rb, :scope > .cf-rs").forEach((e) => e.remove());
  box.classList.remove("cf", "cf-o", "cf-f", "cf-gold", "cf-silver", "cf-bronze", "cf-red", "cf-l100", "cf-l120");
  if (!fr) return;
  box.classList.add("cf", "cf-" + fr.st, "cf-" + fr.metal); if (fr.red) box.classList.add("cf-red");
  if (fr.st === "f" && fr.lvl) box.classList.add("cf-l" + fr.lvl);
  box.insertAdjacentHTML("beforeend", cfLayerHTML(fr, cls, atk, hp));
}
// the switch: Off / On (with a small picture of the frame this one gets)
function cfPickHTML(where, fr) {
  const on = cfOn(where), opt = (v, t, tip, thumb) => `<button type="button" class="cf-opt" data-action="cf-set" data-w="${where}" data-v="${v}" aria-pressed="${on === !!v}" title="${tip}">${thumb}<span>${t}</span></button>`;
  return `<div class="cf-pick" role="group" aria-label="Card frame"><span class="cf-lbl">Card frame</span><span class="cf-opts">`
    + opt("", "Off", "Just the picture", `<i class="cf-none" aria-hidden="true"></i>`)
    + opt("1", "On", fr.st === "o" ? "The game's Craft Essence frame, with ATK and HP" : "The game's Saint Graph frame, with the class, ATK and HP", `<img src="${fr.src}" alt="" aria-hidden="true">`)
    + `</span></div>`;
}

/* ---------- the SERVANTPAGE ---------- */
// ATK and HP as the Stats section shows them
function cfStat(s, k) { const t = total(s, k); if (t == null) return null; const c = typeof favOn === "function" ? favOn(s) : null; return t + ((c && c[k] && c[k][1]) || 0); }
function cfDossier() {
  const d = document.getElementById("dossier"); if (!d || S.editing) return;
  const s = S.servants.find((x) => x.id === shownId()); if (!s) return;
  const fr = cfFrame(s.rarity, s.level), side = d.querySelector(".art-side");
  if (side) { const old = side.querySelector(".cf-pick"); if (old) old.remove(); side.insertAdjacentHTML("beforeend", cfPickHTML("mine", fr)); }
  const box = d.querySelector(".art-frame"); if (!box) return;
  // only around a picture (not an empty stage waiting for one)
  cfApply(box, cfOn("mine") && box.querySelector("img[data-art]") && !box.classList.contains("drop") ? fr : null, s.cls, cfStat(s, "atk"), cfStat(s, "hp"));
}
const renderDossier28 = renderDossier;
renderDossier = function () { const r = renderDossier28.apply(this, arguments); try { cfDossier(); } catch (e) {} return r; };

/* ---------- Past Chaldea's windows: a servant, or a Craft Essence ---------- */
function cfPc() {
  const dlg = document.getElementById("pc-dlg"); if (!pcOpen || !dlg) return;
  const x = (pcOpen.ce ? CE_BY_NO : ATLAS_BY_NO).get(pcOpen.no); if (!x) return;
  const fr = pcOpen.ce ? cfFrameCe(x.r) : cfFrame(x.r, null), art = dlg.querySelector(".pcd-art"), box = art && art.querySelector(".pcd-frame"); if (!box) return;
  const old = art.querySelector(".cf-pick"); if (old) old.remove();
  if (!box.querySelector("img")) { cfApply(box, null); return; }
  art.insertAdjacentHTML("beforeend", cfPickHTML("pc", fr));
  cfApply(box, cfOn("pc") ? fr : null, x.c, (x.atk || [])[1], (x.hp || [])[1]);
}
const pcRenderDetail28 = pcRenderDetail;
pcRenderDetail = function () { const r = pcRenderDetail28.apply(this, arguments); try { cfPc(); } catch (e) {} return r; };

// 0.58.0: a star row or emblem that can't be loaded: the frame with its stars drawn in, and the badge
document.addEventListener("error", (e) => {
  const t = e.target; if (!t || t.tagName !== "IMG") return;
  if (t.classList.contains("cf-st")) {
    const box = t.parentNode, f = box && box.querySelector(":scope > .cf-img[data-fb]");
    t.remove(); if (f) { f.src = f.dataset.fb; f.removeAttribute("data-fb"); }
    return;
  }
  const c = t.dataset.fb && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains("cf-cls") ? t.parentNode : null;
  if (c) {
    const fb = t.dataset.fb; t.removeAttribute("data-fb"); c.classList.remove("aa"); t.src = fb;
    const rb = c.querySelector(".cf-cls-rb"); if (rb) rb.style.setProperty("--cf-m", "url('" + fb + "')");
  }
}, true);

document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="cf-set"]'); if (!b) return;
  e.preventDefault();
  const w = b.dataset.w === "pc" ? "pc" : "mine"; cfSet(w, !!b.dataset.v);
  if (w === "pc") cfPc(); else cfDossier();
  const again = document.querySelector(`.cf-pick [data-action="cf-set"][data-w="${w}"][data-v="${b.dataset.v || ""}"]`); if (again) again.focus({preventScroll: true});
});
