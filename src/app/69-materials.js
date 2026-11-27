/* ================= 0.57.0-beta: Materials =================
   Noyr (25 Nov 2026): "another page to store all class ascension materials, skill materials so I can add how much of
   that material I have and it directly affects the level up plan and other stuff".

   What you have is the list the servant planner and the Event page's calculator have read since 0.22.0/0.24.0
   (evPref.have under EV_KEY, synced as EXTRA_KEYS.event, in backups as settings.have), so nothing moves and what you'd
   typed there is here: keys are item ids, "qp" for QP and "7999" for Holy Grails. This page shows every material NA's
   servants and Class Score use, the way the game sorts them (ATLAS_MATS: [id, name, icon, tier, order]; tier "b", "s",
   "g", or "x" for a servant's own ascension item), and how much is needed against what you have:
   - for your plans (the Planner on servant pages), or for every servant you have to be ascended fully with skills at
     10 (or 9), the plans' append skills and Grails included;
   - and, ticked, for the rest of every Class Score board.
   Its settings are kept with the calculator's (evPref.mat: {to, cs, show}). Typing a number saves it at once and the
   planner, the Event page and Class Score read it from there; Class Score can also take what a sign costs out of it. */
const MAT_SET = (() => { const m = evPref.mat && typeof evPref.mat === "object" ? evPref.mat : {}; return {to: [9, 10, "plan", "none"].includes(m.to) ? m.to : null, cs: !!m.cs, show: ["all", "need", "short"].includes(m.show) ? m.show : "all"}; })();
const matSetSave = () => { evPref.mat = Object.assign({}, MAT_SET); evPrefSave(); };
// until you pick, it counts your plans if you have any, and otherwise every servant with skills to 10
const matTo = () => MAT_SET.to != null ? MAT_SET.to : S.servants.some((s) => s.plan) ? "plan" : 10;
const MAT_CLS = ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker"];
const MT = {q: "", need: null, who: null, was: false, raw: null};
// Sync can bring a newer list from another device into the browser's storage while this page is open; it's read again
// before it's shown or changed, so a number typed here never writes an old copy over one typed on a phone.
try { MT.raw = localStorage.getItem(EV_KEY); } catch (e) {}
function evPrefFresh() {
  let r; try { r = localStorage.getItem(EV_KEY); } catch (e) { return false; }
  if (r === MT.raw) return false;
  MT.raw = r;
  try { const v = JSON.parse(r || "{}"); evPref = v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { evPref = {}; }
  if (!evPref.have || typeof evPref.have !== "object") evPref.have = {};
  if (!evPref.bonus || typeof evPref.bonus !== "object") evPref.bonus = {};
  if (evPref.to !== 9 && evPref.to !== "plan") evPref.to = 10;
  return true;
}
const evPrefSave69 = evPrefSave;
evPrefSave = function () { evPrefSave69(); try { MT.raw = localStorage.getItem(EV_KEY); } catch (e) {} };
if (typeof syncApply === "function") {
  const syncApply69 = syncApply;
  syncApply = function (d) {
    const r = syncApply69.apply(this, arguments);
    if (r === "extras" && d && d.id === "event" && evPrefFresh() && S.tab === "materials") {
      const a = document.activeElement;
      if (!(a && a.matches && a.matches("#materials input"))) setTimeout(matRender, 0);
    }
    return r;
  };
}
// QP's key is "qp" here (Class Score's data calls it item 1); everything else is its item id
const matKey = (id) => id === 1 || id === "1" ? "qp" : String(id);
// what each material is: name and picture
const MAT_INFO = (() => {
  const m = new Map();
  m.set("qp", {k: "qp", n: "QP", ic: QP_IC, t: "q"});
  m.set(String(GRAIL_ID), {k: String(GRAIL_ID), n: "Holy Grail", ic: GRAIL_IC, t: "q"});
  ATLAS_MATS.forEach((x) => m.set(String(x[0]), {k: String(x[0]), n: String(x[1]).trim(), ic: x[2], t: x[3] || "", o: x[4] || x[0]}));
  if (typeof CSB !== "undefined") Object.keys(CSB.items || {}).forEach((id) => { const k = matKey(id); if (!m.has(k)) m.set(k, {k: k, n: CSB.items[id][0], ic: CSB.items[id][1], t: "c", o: num(id)}); });
  return m;
})();
// the page's groups, in the game's order
function matGroups() {
  const all = [...MAT_INFO.values()], by = (t) => all.filter((x) => x.t === t).sort((a, b) => a.o - b.o);
  const gem = (pre) => MAT_CLS.map((c) => all.find((x) => x.n === pre + c) || null);
  return [
    {id: "qp", n: "QP, Grails and Lore", list: [MAT_INFO.get("qp"), MAT_INFO.get(String(GRAIL_ID)), all.find((x) => x.n === "Crystallized Lore")].filter(Boolean)},
    {id: "gems", n: "Gems", grid: [["Gems", gem("Gem of ")], ["Magic Gems", gem("Magic Gem of ")], ["Secret Gems", gem("Secret Gem of ")]]},
    {id: "statues", n: "Pieces and Monuments", grid: [["Pieces", MAT_CLS.map((c) => all.find((x) => x.n === c + " Piece") || null)], ["Monuments", MAT_CLS.map((c) => all.find((x) => x.n.trim() === c + " Monument") || null)]]},
    {id: "b", n: "Bronze materials", tier: "b", list: by("b").filter((x) => !/^Gem of /.test(x.n))},
    {id: "s", n: "Silver materials", tier: "s", list: by("s").filter((x) => !/^Magic Gem of | Piece$/.test(x.n))},
    {id: "g", n: "Gold materials", tier: "g", list: by("g").filter((x) => !/^Secret Gem of | Monument$|^Crystallized Lore$/.test(x.n.trim()))},
    {id: "c", n: "Class Score", list: by("c")},
    {id: "x", n: "Servants' own ascension items", list: by("x"), own: true}
  ];
}

/* ---------- what's needed ---------- */
function matNeeds() {
  const need = new Map(), who = new Map();
  const add = (k, n, w) => { if (!n) return; need.set(k, (need.get(k) || 0) + n); const m = who.get(k) || new Map(); m.set(w, (m.get(w) || 0) + n); who.set(k, m); };
  const fromCost = (c, w) => { c.items.forEach((n, id) => add(String(id), n, w)); add("qp", c.qp, w); add(String(GRAIL_ID), c.grails, w); };
  const to = matTo();
  if (to === "plan") S.servants.forEach((s) => { if (!s.plan) return; const a = atlasOf(s); if (a) fromCost(planCost(s, a, planOf(s, a)), s.name); });
  else if (to === 9 || to === 10) owned().forEach((s) => {
    const a = atlasOf(s); if (!a) return;
    const lv = num(s.level) || 1, p = {lv: Math.max(lv, lvMax(a)), sk: skLevels(s).map((v) => Math.max(v, to)), ap: apLevels(s)};
    fromCost(planCost(s, a, p), s.name);
  });
  if (MAT_SET.cs && typeof CSB !== "undefined") CSB.boards.forEach((b) => {
    const g = CSB_G.get(b.id), set = csSet(b.id), left = [...g.sq.values()].filter((q) => csTakes(q) && !set.has(q.id)).map((q) => q.id);
    csCost(b.id, left).forEach((c) => add(matKey(c[0]), c[1], "Class Score: " + b.n));
  });
  MT.need = need; MT.who = who;
  return need;
}
const matHave = (k) => Math.max(0, num(evPref.have[k]) || 0);
const matNeed = (k) => (MT.need && MT.need.get(k)) || 0;
const matShort = (k) => Math.max(0, matNeed(k) - matHave(k));
const matAmt = (k, n) => k === "qp" ? qpShort(n) : fmt(n);
function matNeedHTML(k) {
  const n = matNeed(k), s = matShort(k);
  if (!n) return `<span class="mt-need none">${matTo() === "none" && !MAT_SET.cs ? "" : "not needed"}</span>`;
  const w = MT.who.get(k), tip = w ? [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map((x) => x[0] + " " + matAmt(k, x[1])).join(" · ") + (w.size > 12 ? " · and " + (w.size - 12) + " more" : "") : "";
  return `<span class="mt-need${s ? " s" : " ok"}" title="${esc(tip)}">need ${matAmt(k, n)} · ${s ? matAmt(k, s) + " short" : "enough"}</span>`;
}
const matShown = (x) => {
  const k = x.k, q = MT.q;
  if (q && x.n.toLowerCase().indexOf(q) < 0) return false;
  if (MAT_SET.show === "need" && !matNeed(k)) return false;
  if (MAT_SET.show === "short" && !matShort(k)) return false;
  return true;
};
const matIn = (x, small) => S.readOnly ? `<b class="mt-hv">${fmt(matHave(x.k))}</b>`
  : `<input class="mt-in${small ? " sm" : ""}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-mat="${esc(x.k)}" value="${evPref.have[x.k] ? fmt(matHave(x.k)) : ""}" placeholder="0" aria-label="${esc(x.n)}: how many you have">`;
const matIc = (x) => x.ic ? `<img src="${esc(aimg(x.ic))}" alt="" loading="lazy" decoding="async">` : `<i class="mt-noic" aria-hidden="true"></i>`;
function matCard(x) {
  const k = x.k;
  return `<div class="mt-card${matShort(k) ? " short" : ""}" data-mk="${esc(k)}" data-n="${esc(x.n.toLowerCase())}"${matShown(x) ? "" : " hidden"}>${matIc(x)}
    <span class="mt-n">${esc(x.n)}</span>${matIn(x)}${matNeedHTML(k)}</div>`;
}
// a class to a column, a kind to a row; on a phone it turns round (a class to a row), so it fits without scrolling.
// Each piece carries both places: --r1/--c1 wide, --r2/--c2 narrow.
function matGridHTML(g) {
  const at = (r1, c1) => `style="--r1:${r1};--c1:${c1};--r2:${c1};--c2:${r1}"`;
  const head = `<span ${at(1, 1)}></span>${MAT_CLS.map((c, i) => `<span class="mt-ch" ${at(1, i + 2)}>${CLASS_LOGO[c] ? `<img src="${CLASS_LOGO[c]}" alt="">` : ""}<b>${c}</b></span>`).join("")}`;
  const rows = g.grid.map((r, j) => `<span class="mt-rh" ${at(j + 2, 1)}>${esc(r[0])}</span>${r[1].map((x, i) => x ? `<div class="mt-cell${matShort(x.k) ? " short" : ""}" ${at(j + 2, i + 2)} data-mk="${esc(x.k)}" data-n="${esc(x.n.toLowerCase())}"${matShown(x) ? "" : " data-dim"} title="${esc(x.n)}">${matIc(x)}${matIn(x, true)}${matNeedHTML(x.k)}</div>` : "").join("")}`).join("");
  return `<div class="mt-scroll"><div class="mt-mx" style="--n:${g.grid.length}">${head}${rows}</div></div>`;
}
function matSecHTML(g) {
  const items = g.list || g.grid.flatMap((r) => r[1]).filter(Boolean);
  // a servant's own items only show when one of your servants needs them or you have some
  const list = g.own ? items.filter((x) => matNeed(x.k) || matHave(x.k)) : items;
  if (!list.length) return "";
  const short = list.filter((x) => matShort(x.k)).length, needed = list.filter((x) => matNeed(x.k)).length;
  const sub = needed ? (short ? `${short} of ${needed} needed are short` : `all ${needed} needed are covered`) : `${list.length}`;
  const vis = g.grid ? true : list.some(matShown);
  return `<section class="d-sec mt-sec" data-g="${g.id}"${vis ? "" : " hidden"}><div class="sec-head"><h3>${g.tier ? `<i class="mt-tier t-${g.tier}" aria-hidden="true"></i>` : ""}${esc(g.n)} <small>${sub}</small></h3></div>
    ${g.grid ? matGridHTML(g) : `<div class="mt-grid">${(g.list ? list : []).map(matCard).join("")}</div>`}</section>`;
}
function matPageHTML() {
  matNeeds();
  const plans = S.servants.filter((s) => s.plan).length, mine = owned().length;
  const all = [...MAT_INFO.values()], shortN = all.filter((x) => matShort(x.k)).length;
  const to = matTo(), opt = (v, t) => `<option value="${v}"${to === v ? " selected" : ""}>${t}</option>`;
  const seg = (v, t) => `<button type="button" class="btn sm${MAT_SET.show === v ? " primary" : " ghost"}" data-action="mt-show" data-v="${v}" aria-pressed="${MAT_SET.show === v}">${t}</button>`;
  return `<section class="d-sec mt-head">
      <p class="mt-lead">How many of each material you have. The Planner on your servants' pages, the Event page's shop calculator and Class Score count from these numbers, and the Planner's <b>Done</b> takes what it used out of them.</p>
      <div class="mt-tools">
        <label class="mt-to">Count what's needed for <select data-mt-to aria-label="Count what's needed for">${opt("plan", `your plans (${plans})`)}${opt(10, `every servant (${mine}): ascended, skills 10/10/10`)}${opt(9, `every servant (${mine}): ascended, skills 9/9/9`)}${opt("none", "nothing")}</select></label>
        <label class="mt-cs"><input type="checkbox" data-mt-cs${MAT_SET.cs ? " checked" : ""}> and the rest of Class Score</label>
        <div class="mt-show" role="group" aria-label="Show">${seg("all", "All")}${seg("need", "Needed")}${seg("short", `Short${shortN ? " (" + shortN + ")" : ""}`)}</div>
        <input class="mt-find" type="search" data-mt-find value="${esc(MT.q)}" placeholder="Find a material" aria-label="Find a material">
      </div>
      ${to === "plan" && !plans ? `<p class="mt-note">No plans yet. Pick targets in the Planner on a servant's page, or count every servant instead.</p>` : ""}
    </section>
    ${matGroups().map(matSecHTML).join("")}
    <p class="mt-empty"${all.some(matShown) ? " hidden" : ""}>Nothing matches. ${MAT_SET.show === "short" ? "You have enough of everything this counts." : ""}</p>
    <p class="mt-foot">Ember EXP, Fou and Servant Coins aren't counted here (coins are kept on each servant). Your numbers sync with your account and go into backups.</p>`;
}
function matRender() {
  const box = document.getElementById("materials"); if (!box) return;
  evPrefFresh();
  const a = document.activeElement, keep = a && a.closest && a.closest("#materials") ? (a.dataset.mat ? `[data-mat="${CSS.escape(a.dataset.mat)}"]` : a.matches("[data-mt-find]") ? "[data-mt-find]" : a.matches("[data-mt-to]") ? "[data-mt-to]" : a.dataset.action ? `[data-action="${a.dataset.action}"]${a.dataset.v ? `[data-v="${a.dataset.v}"]` : ""}` : null) : null;
  const pos = keep === "[data-mt-find]" ? [a.selectionStart, a.selectionEnd] : null;
  box.innerHTML = matPageHTML();
  if (keep) { const el = box.querySelector(keep); if (el) { el.focus({preventScroll: true}); if (pos) try { el.setSelectionRange(pos[0], pos[1]); } catch (e) {} } }
}
// a number changed: its card (and every other box for the same thing) follows without redrawing the page
function matPatch(k) {
  const box = document.getElementById("materials"); if (!box) return;
  box.querySelectorAll(`[data-mk="${CSS.escape(k)}"]`).forEach((c) => {
    c.classList.toggle("short", !!matShort(k));
    const n = c.querySelector(".mt-need"); if (n) n.outerHTML = matNeedHTML(k);
  });
}
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.closest || !t.closest("#materials")) return;
  if (t.dataset.mat != null) {
    if (S.readOnly) return;
    evPrefFresh();
    const k = t.dataset.mat, v = t.value.replace(/[^\d]/g, "").slice(0, 10);
    if (v && Number(v)) evPref.have[k] = Number(v); else delete evPref.have[k];
    evPrefSave(); matPatch(k);
    box2same(t, k, v);
    return;
  }
  if (t.matches("[data-mt-find]")) {
    MT.q = t.value.trim().toLowerCase();
    const box = document.getElementById("materials"); if (!box) return;
    // (cards hide; a cell in the gem tables dims, so the table keeps its shape)
    box.querySelectorAll(".mt-card, .mt-cell").forEach((c) => {
      const x = MAT_INFO.get(c.dataset.mk), on = x ? matShown(x) : true;
      if (c.classList.contains("mt-cell")) c.toggleAttribute("data-dim", !on); else c.hidden = !on;
    });
    box.querySelectorAll(".mt-sec").forEach((s) => { if (!s.querySelector(".mt-mx")) s.hidden = !s.querySelector(".mt-card:not([hidden])"); });
    const em = box.querySelector(".mt-empty"); if (em) em.hidden = !!box.querySelector(".mt-card:not([hidden]), .mt-cell:not([data-dim])");
  }
});
// other boxes for the same thing (the QP box at the top and the one in its group) keep in step
function box2same(t, k, v) { document.querySelectorAll(`#materials input[data-mat="${CSS.escape(k)}"]`).forEach((x) => { if (x !== t) x.value = v ? fmt(Number(v)) : ""; }); }
// numbers show with thousands separators once you leave the box
document.addEventListener("focusout", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("#materials input[data-mat]")) return;
  const k = t.dataset.mat; t.value = evPref.have[k] ? fmt(matHave(k)) : "";
});
document.addEventListener("focusin", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("#materials input[data-mat]")) return;
  const k = t.dataset.mat; t.value = evPref.have[k] ? String(matHave(k)) : "";
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.closest || !t.closest("#materials")) return;
  if (t.matches("[data-mt-to]")) { const v = t.value; MAT_SET.to = v === "plan" || v === "none" ? v : Number(v); matSetSave(); matRender(); return; }
  if (t.matches("[data-mt-cs]")) { MAT_SET.cs = t.checked; matSetSave(); matRender(); }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("#materials [data-action]"); if (!b) return;
  if (b.dataset.action === "mt-show") { MAT_SET.show = b.dataset.v; matSetSave(); matRender(); }
});

/* ---------- the page in the sidebar, before Class Score ---------- */
TABS.push("materials");
UI_IC.materials = '<path d="M12 3.5l7 4v9l-7 4-7-4v-9z"/><path d="M5 7.5l7 4 7-4M12 11.5v9"/>';
(function () {
  const nav = document.querySelector("nav.tabs"), before = document.getElementById("tab-classscore") || document.getElementById("tab-past");
  const b = document.createElement("button");
  b.className = "tab"; b.setAttribute("role", "tab"); b.id = "tab-materials"; b.dataset.action = "tab"; b.dataset.tab = "materials"; b.setAttribute("aria-selected", "false");
  b.innerHTML = `<i class="tab-ic">${uiIcon("materials")}</i><span class="tab-t">Materials</span>`; b.title = "Materials";
  if (nav) nav.insertBefore(b, before && before.parentNode === nav ? before : null);
  const sec = document.createElement("section");
  sec.id = "view-materials"; sec.setAttribute("aria-labelledby", "tab-materials"); sec.hidden = true; sec.innerHTML = `<div id="materials" class="mt"></div>`;
  const after = document.getElementById("view-classscore") || document.getElementById("view-battle"); if (after) after.before(sec); else document.querySelector(".shell").appendChild(sec);
  if ((location.hash || "").slice(1) === "materials") S.tab = "materials";
})();
if (typeof FOOT_TABS !== "undefined") {
  const i = FOOT_TABS.findIndex((x) => x[0] === "classscore"); FOOT_TABS.splice(i >= 0 ? i : FOOT_TABS.length, 0, ["materials", "Materials"]);
  try { if (typeof foot !== "undefined" && foot) { foot.innerHTML = footHTML(); renderFoot(); } } catch (e) {}
}
const renderAll69 = renderAll;
renderAll = function () { const r = renderAll69.apply(this, arguments); try { if (S.tab === "materials" && !(document.activeElement && document.activeElement.matches && document.activeElement.matches("#materials input"))) matRender(); } catch (e) { console.error(e); } return r; };
const renderChrome69 = renderChrome;
// (drawn again each time you come to it: the Planner, the Event page or Class Score may have changed the numbers)
renderChrome = function () { const r = renderChrome69.apply(this, arguments); try { const on = S.tab === "materials", b = document.getElementById("materials"); if (on && b && (!MT.was || !b.childElementCount)) matRender(); MT.was = on; } catch (e) { console.error(e); } return r; };
window.__fgiMaterials = {info: () => [...MAT_INFO.values()], groups: () => matGroups().map((g) => ({id: g.id, n: g.n, items: (g.list || g.grid.flatMap((r) => r[1])).filter(Boolean).map((x) => x.k)})),
  needs: () => Object.fromEntries(matNeeds()), have: () => Object.assign({}, evPref.have), set: () => Object.assign({}, MAT_SET),
  // a plan of skills 10/10/10 for one servant (and none for the rest), a number put in by hand, and a copy arriving by sync
  planSkills10: () => {
    const s = S.servants.find((x) => !x.wish && atlasOf(x) && skLevels(x).every((v) => v >= 1 && v < 9)); if (!s) return null; const a = atlasOf(s);
    S.servants.forEach((x) => { if (x !== s) delete x.plan; }); s.plan = {lv: num(s.level) || 1, sk: [10, 10, 10], ap: apLevels(s)};
    return {id: s.id, name: s.name, sk: skLevels(s), ms: a.ms, qs: a.qs};
  },
  put: (k, v) => { evPref.have[k] = v; evPrefSave(); },
  pull: (raw) => syncApply({col: "extras", id: "event", data: {v: raw}}, {out: {}}, "u")};
