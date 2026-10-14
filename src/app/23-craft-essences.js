/* ================= 0.18.1 and 0.19.0: 15 fps fixes, favourite Craft Essences, Craft Essences with pictures in parties ================= */

/* ---------- 0.18.1: the gold frame around the servant page follows the page when something above it moves ---------- */
if (window.ResizeObserver) { const ro = new ResizeObserver(() => queueDsFrame()); ro.observe(document.body); const m = document.querySelector(".masthead"); if (m) ro.observe(m); }
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => queueDsFrame());

/* ---------- Craft Essences by name: what you typed is kept, a known name gets its picture and stats ---------- */
const CE_BY_NAME = new Map();
ATLAS_C.forEach((c) => { const k = nname(c.n); [k, k.replace(/^the /, "")].forEach((x) => { if (!CE_BY_NAME.has(x)) CE_BY_NAME.set(x, c); }); });
function ceByName(t) {
  const k = nname(t); if (!k) return null;
  if (CE_BY_NAME.has(k)) return CE_BY_NAME.get(k);
  // "Black Grail (MLB)", "Kaleidoscope mlb", "Chaldea Lunchtime Lv 100" still find their Craft Essence
  const k2 = nname(String(t).replace(/\([^)]*\)/g, " ")).replace(/\b(mlb|lb\d?|max|lv ?\d+|level ?\d+)\b/g, " ").replace(/\s+/g, " ").trim();
  return CE_BY_NAME.get(k2) || CE_BY_NAME.get(k2.replace(/^the /, "")) || null;
}
const ceFace = (c) => c && c.fc ? aimg(c.fc) : "";
const ceStatsText = (c) => [c.hp[1] ? "HP " + fmt(c.hp[1]) : "", c.atk[1] ? "ATK " + fmt(c.atk[1]) : ""].filter(Boolean).join(" · ") || "No stats";

/* ---------- the Craft Essence picker: search by name or effect, with pictures ---------- */
const cep = document.createElement("div");
cep.className = "cep"; cep.hidden = true; cep.setAttribute("role", "dialog"); cep.setAttribute("aria-modal", "true"); cep.setAttribute("aria-labelledby", "cep-t");
document.body.appendChild(cep);
const CEP = {q: "", r: "", n: 96, cb: null, back: null, title: ""};
function cepList() {
  const q = nname(CEP.q);
  return ATLAS_C.filter((c) => (!CEP.r || c.r === Number(CEP.r)) && (!q || nname(c.n).includes(q) || nname(c.e.join(" ")).includes(q) || nname((c.x || []).join(" ")).includes(q) || String(c.no) === q))
    .sort((a, b) => b.r - a.r || b.no - a.no);
}
function cepCardHTML(c) {
  return `<li><button type="button" class="pc-card is-ce r${c.r}" data-cep="${c.no}" title="${esc((c.x && c.x.length ? c.x : c.e).join("\n"))}" aria-label="${esc(c.n)}, ${c.r} star Craft Essence, ${esc(ceStatsText(c))}">
    <span class="pc-face"><img src="${esc(ceFace(c))}" alt="" loading="lazy" decoding="async"><span class="pc-st">${stars(c.r)}</span></span>
    <span class="pc-n">${esc(c.n)}</span><span class="pc-m">${esc(ceStatsText(c))}</span></button></li>`;
}
function cepGrid() {
  const all = cepList(), list = all.slice(0, CEP.n);
  return `<p class="pc-count">${plural(all.length, "Craft Essence")}</p>${list.length ? `<ul class="pc-grid ce-grid cep-grid">${list.map(cepCardHTML).join("")}</ul>` : `<p class="tr-none">No Craft Essence matches.</p>`}
    ${all.length > list.length ? `<p class="cep-more"><button type="button" class="btn ghost sm" data-cep-more>Show more (${fmt(all.length - list.length)} left)</button></p>` : ""}`;
}
function cepRender(full) {
  if (full) {
    cep.innerHTML = `<div class="cep-veil" data-cep-close></div><div class="cep-panel">
      <header class="cep-head"><h2 id="cep-t">${esc(CEP.title || "Pick a Craft Essence")}</h2><button type="button" class="cep-x" data-cep-close aria-label="Close">×</button></header>
      <div class="cep-tools"><input type="search" class="field-input" data-cep-q placeholder="Search a name or what it does" value="${esc(CEP.q)}" aria-label="Search Craft Essences" autocomplete="off">
        <div class="cep-rs" role="group" aria-label="Rarity">${["", "5", "4", "3", "2", "1"].map((r) => `<button type="button" class="chip" data-cep-r="${r}" aria-pressed="${CEP.r === r}">${r ? r + "★" : "All"}</button>`).join("")}</div></div>
      <div class="cep-body">${cepGrid()}</div></div>`;
  } else {
    const b = cep.querySelector(".cep-body"); if (b) b.innerHTML = cepGrid();
    cep.querySelectorAll("[data-cep-r]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.cepR === CEP.r)));
  }
}
function openCep(title, cb) {
  CEP.cb = cb; CEP.title = title; CEP.n = 96; CEP.back = document.activeElement;
  cepRender(true); cep.hidden = false; document.documentElement.classList.add("cep-open");
  const q = cep.querySelector("[data-cep-q]"); if (q) { q.focus({preventScroll: true}); q.select(); }
}
function closeCep() {
  if (cep.hidden) return;
  cep.hidden = true; document.documentElement.classList.remove("cep-open"); CEP.cb = null;
  const b = CEP.back; CEP.back = null; if (b && b.isConnected && b.focus) b.focus({preventScroll: true});
}
cep.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("[data-cep-close]")) { closeCep(); return; }
  const r = t.closest("[data-cep-r]"); if (r) { CEP.r = r.dataset.cepR; CEP.n = 96; cepRender(false); return; }
  if (t.closest("[data-cep-more]")) { CEP.n += 96; cepRender(false); return; }
  const c = t.closest("[data-cep]");
  if (c) { const ce = CE_BY_NO.get(Number(c.dataset.cep)), cb = CEP.cb; closeCep(); if (ce && cb) cb(ce); }
});
let cepT = 0;
cep.addEventListener("input", (e) => { if (!e.target.matches("[data-cep-q]")) return; CEP.q = e.target.value; clearTimeout(cepT); cepT = setTimeout(() => { CEP.n = 96; cepRender(false); }, 120); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !cep.hidden) { e.preventDefault(); e.stopPropagation(); closeCep(); } }, true);

/* ---------- 0.19.0: five favourite Craft Essences on every servant; the one you pick adds its HP and ATK ---------- */
const FAV_N = 5;
const favOf = (s) => { const a = Array.isArray(s.favCe) ? s.favCe.slice(0, FAV_N) : []; while (a.length < FAV_N) a.push(null); return a.map((v) => (v != null && CE_BY_NO.has(Number(v)) ? Number(v) : null)); };
function favOn(s) { const i = num(s.favCeOn); if (i == null || i < 0 || i >= FAV_N) return null; const no = favOf(s)[i]; return no != null ? CE_BY_NO.get(no) : null; }
function favHTML(s) {
  const fav = favOf(s), on = num(s.favCeOn), edit = !S.readOnly;
  const cells = fav.map((no, i) => {
    const c = no != null ? CE_BY_NO.get(no) : null;
    if (!c) return edit ? `<button type="button" class="fce-card empty" data-action="fce-add" data-i="${i}" aria-label="Add favourite Craft Essence ${i + 1}"><span class="fce-plus" aria-hidden="true">+</span><span class="fce-n">Add</span></button>` : `<span class="fce-card empty" aria-hidden="true"></span>`;
    const isOn = on === i;
    return `<span class="fce-cell"><button type="button" class="fce-card r${c.r}${isOn ? " on" : ""}" data-action="fce-on" data-i="${i}" aria-pressed="${isOn}" title="${esc(c.n + "\n" + ceStatsText(c) + "\n" + (c.x && c.x.length ? c.x : c.e).join("\n"))}" aria-label="${esc(c.n)}, ${esc(ceStatsText(c))}. ${isOn ? "Equipped, press to take it off" : "Press to equip"}"${S.readOnly ? " disabled" : ""}>
      <span class="fce-img"><img src="${esc(ceFace(c))}" alt="" loading="lazy" decoding="async"></span><span class="fce-n">${esc(c.n)}</span>${isOn ? `<span class="fce-tag">Equipped</span>` : ""}</button>${edit ? `<button type="button" class="fce-x" data-action="fce-del" data-i="${i}" title="Remove from favourites" aria-label="Remove ${esc(c.n)} from favourites">×</button>` : ""}</span>`;
  }).join("");
  return `<div class="fce" role="group" aria-labelledby="fce-h-${esc(s.id)}"><p class="fce-h" id="fce-h-${esc(s.id)}"><b>Favourite Craft Essences</b> <small>${fav.some((v) => v != null) ? "pick one to add its HP and ATK (at its max level)" : "keep up to five here; the one you pick adds its HP and ATK"}</small></p><div class="fce-row">${cells}</div></div>`;
}
function applyFavStats(d, s) {
  const grid = d.querySelector(".stat-grid"); if (!grid) return;
  const sec = grid.closest("section");
  if (sec && !sec.querySelector(".fce")) grid.insertAdjacentHTML("afterend", favHTML(s));
  const c = favOn(s); if (!c) return;
  const h = sec && sec.querySelector("h3 small"); if (h) h.textContent = h.textContent.replace("Fou included", "Fou and Craft Essence included");
  const boxes = grid.querySelectorAll(".stat");
  [["hp", 0], ["atk", 1]].forEach(([k, i]) => {
    const box = boxes[i], add = c[k][1] || 0, t = total(s, k); if (!box || t == null || !add) return;
    const v = box.querySelector(".v"); if (v) v.textContent = fmt(t + add);
    const sub = box.querySelector(".sub"); if (sub && !sub.querySelector(".ce-add")) sub.insertAdjacentHTML("beforeend", ` <span class="ce-add">+ CE ${fmt(add)}</span>`);
  });
}
function setFav(s, fn, msg, undoable) {
  const before = {favCe: s.favCe === undefined ? undefined : (s.favCe || []).slice(), favCeOn: s.favCeOn === undefined ? undefined : s.favCeOn};
  fn(); scheduleWrite("servants", s); renderDossier(true);
  if (msg && undoable) toastAction(msg, "Undo", () => { ["favCe", "favCeOn"].forEach((k) => { if (before[k] === undefined) delete s[k]; else s[k] = before[k]; }); scheduleWrite("servants", s); renderDossier(true); });
  else if (msg) toast(msg);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action^="fce-"]'); if (!b) return;
  const s = S.servants.find((x) => x.id === shownId()); if (!s || S.readOnly) return;
  e.preventDefault(); e.stopPropagation();
  const i = Number(b.dataset.i), a = b.dataset.action;
  if (a === "fce-add") {
    openCep("Favourite Craft Essence " + (i + 1) + " for " + s.name, (c) => setFav(s, () => { const f = favOf(s); f[i] = c.no; s.favCe = f; }, c.n + " is a favourite of " + s.name + ". Press it to equip it.", false));
  } else if (a === "fce-on") {
    const on = num(s.favCeOn) === i, c = CE_BY_NO.get(favOf(s)[i]); if (!c) return;
    setFav(s, () => { if (on) delete s.favCeOn; else s.favCeOn = i; }, on ? c.n + " taken off." : c.n + " equipped: " + ceStatsText(c) + " added.", false);
  } else if (a === "fce-del") {
    const c = CE_BY_NO.get(favOf(s)[i]);
    setFav(s, () => { const f = favOf(s); f[i] = null; s.favCe = f; if (num(s.favCeOn) === i) delete s.favCeOn; }, (c ? c.n : "Craft Essence") + " removed from favourites.", true);
  }
}, true);

/* ---------- 0.19.0: parties pick Craft Essences with pictures ---------- */
const CE_FIELDS = ["pt-ce0", "pt-ce1", "pt-ce2", "pt-ce3", "pt-ce4", "pt-ce5", "pt-gce"];
function cePickBtn(inp) {
  const c = ceByName(inp.value), f = ceFace(c);
  return `<button type="button" class="ce-pick${c ? " has" : ""}" data-ce-for="${inp.id}" title="${c ? esc(c.n + " · " + ceStatsText(c)) : "Pick a Craft Essence"}" aria-label="${c ? "Change the Craft Essence, now " + esc(c.n) : "Pick a Craft Essence"}">${c ? `<img src="${esc(f)}" alt="" loading="lazy" decoding="async">` : `<span aria-hidden="true">+</span>`}</button>`;
}
function decoratePartyForm() {
  const form = document.getElementById("party-form"); if (!form) return;
  CE_FIELDS.forEach((id) => {
    const inp = document.getElementById(id); if (!inp || inp.closest(".ce-in")) return;
    const wrap = document.createElement("span"); wrap.className = "ce-in";
    inp.before(wrap); wrap.append(inp); wrap.insertAdjacentHTML("afterbegin", cePickBtn(inp));
    inp.setAttribute("placeholder", "Optional: pick or type");
  });
}
function refreshPick(inp) { const w = inp.closest(".ce-in"); if (!w) return; const old = w.querySelector(".ce-pick"); if (old) old.outerHTML = cePickBtn(inp); }
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-ce-for]"); if (!b) return;
  e.preventDefault();
  const inp = document.getElementById(b.dataset.ceFor); if (!inp) return;
  const lab = document.querySelector(`label[for="${inp.id}"]`), slot = inp.closest(".slot-row"), who = slot && slot.querySelector("select") ? slot.querySelector("select").value : "";
  openCep(who ? "Craft Essence for " + who : (lab ? lab.textContent.trim() : "Craft Essence"), (c) => { inp.value = c.n; refreshPick(inp); inp.dispatchEvent(new Event("input", {bubbles: true})); inp.focus({preventScroll: true}); });
});
document.addEventListener("input", (e) => { const t = e.target; if (t && CE_FIELDS.includes(t.id)) refreshPick(t); });
// the Craft Essence on a party card wears its picture
function decorateParties() {
  document.querySelectorAll("#parties .fc-ce:not(.none):not([data-ce-done])").forEach((el) => {
    el.dataset.ceDone = "1"; const c = ceByName(el.textContent); if (!c) return;
    el.classList.add("has-img"); el.style.setProperty("--ce-img", `url("${ceFace(c)}")`); el.title = c.n + " · " + ceStatsText(c);
  });
  document.querySelectorAll("#parties .fc-gplate .gce:not([data-ce-done])").forEach((el) => {
    el.dataset.ceDone = "1"; const c = ceByName(el.textContent); if (!c) return;
    el.insertAdjacentHTML("afterbegin", `<img class="gce-img" src="${esc(ceFace(c))}" alt="" loading="lazy" decoding="async">`); el.title = c.n + " · " + ceStatsText(c);
  });
}
const renderParties19 = renderParties;
renderParties = function () { const r = renderParties19.apply(this, arguments); decorateParties(); decoratePartyForm(); return r; };

const renderDossier20 = renderDossier;
renderDossier = function (force) {
  const r = renderDossier20(force);
  const d = document.getElementById("dossier");
  const s = d && !S.editing ? S.servants.find((v) => v.id === shownId()) : null;
  if (s && !d.querySelector("#servant-form")) applyFavStats(d, s);
  return r;
};
