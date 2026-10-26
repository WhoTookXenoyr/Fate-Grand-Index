/* ================= 0.24.0: Modern and Compact that differ on a phone, and touch that just works =================
   On a phone (900 px and narrower) the two layouts now do different jobs:
   - Modern: the roster as picture tiles, two (or three on a tablet) to a row, and the servant page with a bar of
     section shortcuts that stays at the top while you scroll.
   - Compact: the roster as dense one-line rows (twice as many on screen), and the servant page with the picture
     small beside the name and its long sections folded; tap a heading to open or fold it (remembered here).
   On anything touch (phones and tablets, in either layout): bigger tap targets, no hover-only movement, and a
   sideways swipe on the servant's picture or name goes to the next or previous servant on your list. */
const FOLD_KEY = "spirit-origin-list:v1:folds";
const FOLD_DEFAULT = new Set(["deck", "traits &", "best supports", "passive skills", "team", "notes"]);
let folds = (() => { try { const v = JSON.parse(lsGet(FOLD_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
const phoneish = () => !isWide();
const secKey = (sec) => {
  const h = sec.querySelector(":scope > h3, :scope > .sec-head > h3"); if (!h) return "";
  const t = Array.from(h.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").trim().toLowerCase();
  return t.split(/\s+/).slice(0, 2).join(" ");
};
const isFolded = (k) => Object.prototype.hasOwnProperty.call(folds, k) ? !!folds[k] : FOLD_DEFAULT.has(k);
const JUMPS = [["Progress", (d) => { const b = d.querySelector('[data-action="bump"][data-f="level"]'); return b && b.closest(".d-sec"); }], ["Planner", (d) => d.querySelector(".pl-sec")],
  ["NP", (d) => d.querySelector(".np-sec")], ["Skills", (d) => { const s = d.querySelector(".skills"); return s && s.closest(".d-sec"); }], ["Appends", (d) => d.querySelector(".ap-sec")],
  ["Traits", (d) => d.querySelector(".tr-sec")], ["Team", (d) => Array.from(d.querySelectorAll(".d-sec")).find((x) => secKey(x) === "team")]];
function phoneDossier(d) {
  if (!phoneish() || !d.classList.contains("open") || d.querySelector("#servant-form")) return;
  if (pageLayout === "compact") {
    d.querySelectorAll(".d-sec").forEach((sec) => {
      if (sec.classList.contains("pl-sec") || sec.closest(".cmp-top")) return;
      const k = secKey(sec); if (!k) return;
      sec.classList.add("foldable"); sec.dataset.fold = k; sec.classList.toggle("fold", isFolded(k));
      const h = sec.querySelector(":scope > h3, :scope > .sec-head > h3");
      if (h && !h.hasAttribute("role")) { h.setAttribute("role", "button"); h.tabIndex = 0; }
      if (h) h.setAttribute("aria-expanded", String(!isFolded(k)));
    });
  } else if (!d.querySelector(".ds-jump")) {
    const items = JUMPS.map(([t, f]) => [t, f(d)]).filter((x) => x[1]);
    if (items.length < 3) return;
    items.forEach(([t, el]) => { el.dataset.jump = t; });
    const nav = document.createElement("nav"); nav.className = "ds-jump"; nav.setAttribute("aria-label", "Jump to a section");
    nav.innerHTML = items.map(([t]) => `<button type="button" data-action="ds-jump" data-k="${esc(t)}">${esc(t)}</button>`).join("");
    const head = d.querySelector(":scope > .d-head") || d.querySelector(".cmp-top");
    if (head) head.insertAdjacentElement("afterend", nav); else d.prepend(nav);
  }
}
const renderDossier24t = renderDossier;
renderDossier = function (force) {
  const r = renderDossier24t(force);
  const d = document.getElementById("dossier"); if (d && !S.editing) phoneDossier(d);
  return r;
};
function foldToggle(sec) {
  const k = sec.dataset.fold; if (!k) return;
  const now = !sec.classList.contains("fold");
  sec.classList.toggle("fold", now); folds[k] = now; lsSet(FOLD_KEY, JSON.stringify(folds));
  const h = sec.querySelector(":scope > h3, :scope > .sec-head > h3"); if (h) h.setAttribute("aria-expanded", String(!now));
}
document.addEventListener("click", (e) => {
  const j = e.target.closest && e.target.closest('[data-action="ds-jump"]');
  if (j) {
    const d = document.getElementById("dossier"), el = d && d.querySelector(`[data-jump="${CSS.escape(j.dataset.k)}"]`);
    if (el) el.scrollIntoView({behavior: RM.matches ? "auto" : "smooth", block: "start"});
    return;
  }
  const h = e.target.closest && e.target.closest("#dossier .d-sec.foldable > h3, #dossier .d-sec.foldable > .sec-head > h3");
  if (h && !e.target.closest("button, a, input, select, label")) foldToggle(h.closest(".d-sec"));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const h = e.target.closest && e.target.closest("#dossier .d-sec.foldable > h3, #dossier .d-sec.foldable > .sec-head > h3");
  if (h && e.target === h) { e.preventDefault(); foldToggle(h.closest(".d-sec")); }
});
// the jump bar marks the section you're reading
let jumpRaf = 0;
document.addEventListener("scroll", (e) => {
  const d = e.target; if (!d || d.id !== "dossier" || jumpRaf) return;
  jumpRaf = requestAnimationFrame(() => {
    jumpRaf = 0; const nav = d.querySelector(".ds-jump"); if (!nav) return;
    const top = d.getBoundingClientRect().top + nav.offsetHeight + 24; let cur = "";
    d.querySelectorAll("[data-jump]").forEach((el) => { if (el.getBoundingClientRect().top <= top) cur = el.dataset.jump; });
    nav.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.k === cur));
  });
}, true);

/* ---------- swipe to the next servant ---------- */
let swipe = null;
const SWIPE_ZONE = "#dossier .d-head, #dossier .scene, #dossier .cmp-l, #dossier .art";
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch" || isWide() && !matchMedia("(pointer: coarse)").matches) return;
  const z = e.target.closest && e.target.closest(SWIPE_ZONE); if (!z || e.target.closest("input, select, textarea, [contenteditable], .npt-scroll")) { swipe = null; return; }
  swipe = {x: e.clientX, y: e.clientY, t: Date.now()};
}, {passive: true});
document.addEventListener("pointerup", (e) => {
  const s = swipe; swipe = null; if (!s || e.pointerType !== "touch") return;
  const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (Date.now() - s.t > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
  swipeTo(dx < 0 ? 1 : -1);
}, {passive: true});
document.addEventListener("pointercancel", () => { swipe = null; }, {passive: true});
function swipeTo(step) {
  if (S.editing || !S.selected) return;
  const cur = S.servants.find((x) => x.id === S.selected); if (!cur) return;
  const list = cur.wish ? filtered(wished()) : filtered(); const i = list.findIndex((x) => x.id === S.selected);
  if (i < 0 || !list[i + step]) { toast(step > 0 ? "That's the last servant on your list." : "That's the first servant on your list."); return; }
  S.selected = list[i + step].id; S.lastSel = S.selected;
  renderList(); renderDossier(true);
  const d = document.getElementById("dossier");
  if (d) { d.scrollTop = 0; d.classList.remove("sw-l", "sw-r"); void d.offsetWidth; d.classList.add(step > 0 ? "sw-l" : "sw-r"); setTimeout(() => d.classList.remove("sw-l", "sw-r"), 400); }
  syncPageTheme();
}
