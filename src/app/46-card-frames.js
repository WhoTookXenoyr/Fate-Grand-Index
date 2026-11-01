/* ================= 0.28.0: card frames, the game's frames around a servant's or Craft Essence's picture =================
   A Card frame switch (Off / On) on the SERVANTPAGE and in Past Chaldea's windows; each place keeps its own choice
   (spirit-origin-list:v1:cardframe = {mine, pc}, per browser like the theme).
   - Servants get the Saint Graph frame: the class in its diamond, ATK by the ATK plate and HP by the HP plate. On the
     SERVANTPAGE those are what the Stats section shows (Fou and an equipped Craft Essence included); in Past Chaldea
     NA's numbers at the max level.
   - Craft Essences (Past Chaldea) get the open frame with the vines, with their ATK and HP at the max level.
   The frame follows the rarity: gold ★4–5, silver ★3, bronze ★0–2, with that many stars (★0 has none). The overlay
   is added after each render (like the glare) and never saved with the servant. */
const CF_KEY = "spirit-origin-list:v1:cardframe";
const CF_IMG = {
  f: ["@@asset:cardframe-f0.webp@@", "@@asset:cardframe-f1.webp@@", "@@asset:cardframe-f2.webp@@", "@@asset:cardframe-f3.webp@@", "@@asset:cardframe-f4.webp@@", "@@asset:cardframe-f5.webp@@"],
  o: [null, "@@asset:cardframe-o1.webp@@", "@@asset:cardframe-o2.webp@@", "@@asset:cardframe-o3.webp@@", "@@asset:cardframe-o4.webp@@", "@@asset:cardframe-o5.webp@@"]
};
let cfMem = null;
function cfPrefs() {
  if (cfMem) return cfMem;
  try { const d = JSON.parse(localStorage.getItem(CF_KEY) || "null"); cfMem = d && typeof d === "object" && !Array.isArray(d) ? d : {}; } catch (e) { cfMem = {}; }
  return cfMem;
}
function cfOn(where) { return !!cfPrefs()[where]; }
function cfSet(where, on) { cfPrefs()[where] = !!on; try { localStorage.setItem(CF_KEY, JSON.stringify(cfMem)); } catch (e) {} }
const cfStars = (r) => clamp(Math.round(num(r) || 0), 0, 5);
// (no Craft Essence has ★0)
const cfSrc = (st, r) => CF_IMG[st][cfStars(r)] || CF_IMG[st][1];
const cfMetal = (r) => r >= 4 ? "gold" : r === 3 ? "silver" : "bronze";

// what goes on top of the picture: st "f" (a servant's frame, class in the diamond) or "o" (a Craft Essence's)
function cfLayerHTML(st, r, cls, atk, hp) {
  const logo = st === "f" ? CLASS_LOGO[cls] : null;
  return `<img class="cf-img" src="${cfSrc(st, r)}" alt="" aria-hidden="true" draggable="false">`
    + (logo ? `<span class="cf-cls" aria-hidden="true"><img src="${logo}" alt="" draggable="false"></span>` : "")
    + `<span class="cf-n cf-atk" aria-hidden="true">${atk == null ? "" : fmt(atk)}</span><span class="cf-n cf-hp" aria-hidden="true">${hp == null ? "" : fmt(hp)}</span>`
    + `<span class="sr cf-sr">${esc([atk != null ? "ATK " + fmt(atk) : "", hp != null ? "HP " + fmt(hp) : ""].filter(Boolean).join(", "))}</span>`;
}
// puts the frame on (st) or takes it off ("") a picture box: .art-frame on the SERVANTPAGE, .pcd-frame in Past Chaldea
function cfApply(box, st, r, cls, atk, hp) {
  if (!box) return;
  box.querySelectorAll(":scope > .cf-img, :scope > .cf-cls, :scope > .cf-n, :scope > .cf-sr").forEach((e) => e.remove());
  box.classList.remove("cf", "cf-o", "cf-f", "cf-gold", "cf-silver", "cf-bronze");
  if (!st) return;
  box.classList.add("cf", "cf-" + st, "cf-" + cfMetal(cfStars(r)));
  box.insertAdjacentHTML("beforeend", cfLayerHTML(st, r, cls, atk, hp));
}
// the switch: Off / On (with a small picture of the frame this one gets)
function cfPickHTML(where, st, r) {
  const on = cfOn(where), opt = (v, t, tip, thumb) => `<button type="button" class="cf-opt" data-action="cf-set" data-w="${where}" data-v="${v}" aria-pressed="${on === !!v}" title="${tip}">${thumb}<span>${t}</span></button>`;
  return `<div class="cf-pick" role="group" aria-label="Card frame"><span class="cf-lbl">Card frame</span><span class="cf-opts">`
    + opt("", "Off", "Just the picture", `<i class="cf-none" aria-hidden="true"></i>`)
    + opt("1", "On", st === "o" ? "The game's Craft Essence frame, with ATK and HP" : "The game's Saint Graph frame, with the class, ATK and HP", `<img src="${cfSrc(st, r)}" alt="" aria-hidden="true">`)
    + `</span></div>`;
}

/* ---------- the SERVANTPAGE ---------- */
// ATK and HP as the Stats section shows them
function cfStat(s, k) { const t = total(s, k); if (t == null) return null; const c = typeof favOn === "function" ? favOn(s) : null; return t + ((c && c[k] && c[k][1]) || 0); }
function cfDossier() {
  const d = document.getElementById("dossier"); if (!d || S.editing) return;
  const s = S.servants.find((x) => x.id === shownId()); if (!s) return;
  const side = d.querySelector(".art-side");
  if (side) { const old = side.querySelector(".cf-pick"); if (old) old.remove(); side.insertAdjacentHTML("beforeend", cfPickHTML("mine", "f", s.rarity)); }
  const box = d.querySelector(".art-frame"); if (!box) return;
  // only around a picture (not an empty stage waiting for one)
  cfApply(box, cfOn("mine") && box.querySelector("img[data-art]") && !box.classList.contains("drop") ? "f" : "", s.rarity, s.cls, cfStat(s, "atk"), cfStat(s, "hp"));
}
const renderDossier28 = renderDossier;
renderDossier = function () { const r = renderDossier28.apply(this, arguments); try { cfDossier(); } catch (e) {} return r; };

/* ---------- Past Chaldea's windows: a servant, or a Craft Essence ---------- */
function cfPc() {
  const dlg = document.getElementById("pc-dlg"); if (!pcOpen || !dlg) return;
  const x = (pcOpen.ce ? CE_BY_NO : ATLAS_BY_NO).get(pcOpen.no); if (!x) return;
  const st = pcOpen.ce ? "o" : "f", art = dlg.querySelector(".pcd-art"), box = art && art.querySelector(".pcd-frame"); if (!box) return;
  const old = art.querySelector(".cf-pick"); if (old) old.remove();
  if (!box.querySelector("img")) { cfApply(box, ""); return; }
  art.insertAdjacentHTML("beforeend", cfPickHTML("pc", st, x.r));
  cfApply(box, cfOn("pc") ? st : "", x.r, x.c, (x.atk || [])[1], (x.hp || [])[1]);
}
const pcRenderDetail28 = pcRenderDetail;
pcRenderDetail = function () { const r = pcRenderDetail28.apply(this, arguments); try { cfPc(); } catch (e) {} return r; };

document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="cf-set"]'); if (!b) return;
  e.preventDefault();
  const w = b.dataset.w === "pc" ? "pc" : "mine"; cfSet(w, !!b.dataset.v);
  if (w === "pc") cfPc(); else cfDossier();
  const again = document.querySelector(`.cf-pick [data-action="cf-set"][data-w="${w}"][data-v="${b.dataset.v || ""}"]`); if (again) again.focus({preventScroll: true});
});
