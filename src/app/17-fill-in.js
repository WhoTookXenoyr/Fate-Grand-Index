/* ================= v13: fill in whatever is empty from the NA data ================= */
// Only empty parts are filled: pictures when a servant has none, skill slots with no name and no effect, passive skills
// when there are none, an unset deck, NP name / card / target / table, traits and alignment, class, rarity, the wiki link,
// and HP / ATK when they're blank (worked out for the servant's own level). Anything you typed is left alone.
NICK.push([/\belizabeth\b/g, "elisabeth"], [/\batalanta\b/g, "atalante"], [/\bbeserker\b/g, "berserker"], [/\bberzerker\b/g, "berserker"]);
amCache.clear(); mineCache = null;
const hasArt = (s) => slotsOf(s).some((x) => artOf(s, x.k));
const skillBlank = (k) => !k || typeof k !== "object" || !(String(k.name || "").trim() || String(k.effect || "").trim());
const blankVal = (v) => v == null || (typeof v === "string" && !v.trim());
// HP or ATK at any level: base + (max - base) × the servant's growth curve
function statAt(x, lv, k) {
  const c = ATLAS_CURVES[String(x.gc)], L = clamp(Math.round(lv), 1, 120); if (!c || !c[L - 1] && L !== 1) return null;
  const b = x[k][0], m = x[k][1]; return b + Math.floor((m - b) * c[L - 1] / 1000);
}
function missingOf(s) {
  if (!s) return null;
  const a = atlasOf(s); if (!a) return null;
  const np = a.np || {}, ti = traitInfo(s), lv = num(s.level);
  const m = {
    art: !hasArt(s) && (a.im.length + a.cs.length) > 0,
    sk: [0, 1, 2].filter((i) => skillBlank((s.skillInfo || [])[i]) && a.sk[i]),
    ps: !passivesOf(s).length && a.ps.length > 0,
    deck: deckOf(s).every((c) => !c) && !!a.d,
    npName: blankVal(s.npName) && !!np.n, npCard: !CARDS.includes(s.npCard) && !!CARD_OF[np.cd], npTarget: !TARGETS.includes(s.npTarget) && !!np.tg,
    npTable: !npNorm(s.npTable) && !!np.n,
    attr: !ti.attr && !!a.a, order: !ti.order.length && (a.o || []).length > 0, moral: !ti.moral.length && (a.m || []).length > 0, traits: !ti.traits.length && (a.t || []).length > 0,
    cls: blankVal(s.cls), rarity: !num(s.rarity) && num(s.rarity) !== 0,
    hp: num(s.hp) == null && lv != null, atk: num(s.atk) == null && lv != null,
    url: blankVal(s.url)};
  m.np = m.npName || m.npCard || m.npTarget || m.npTable;
  m.tr = m.attr || m.order || m.moral || m.traits;
  // the wiki link alone isn't worth a reminder, it just comes along with the rest
  if (!(m.art || m.sk.length || m.ps || m.deck || m.np || m.tr || m.cls || m.rarity || m.hp || m.atk)) return null;
  m.all = m.art && m.sk.length === Math.min(3, a.sk.length) && (m.ps || !a.ps.length);
  return {s: s, a: a, m: m};
}
function missingText(m, a) {
  const parts = [m.art ? "pictures" : "", m.sk.length ? (m.sk.length === 3 ? "skills" : "skill " + m.sk.map((i) => i + 1).join(" & ")) : "", m.ps ? "passive skills" : "",
    m.deck ? "deck" : "", m.np ? "NP" : "", m.tr ? "traits" : "", m.cls ? "class" : "", m.rarity ? "rarity" : "", m.hp || m.atk ? "HP and ATK" : ""].filter(Boolean);
  return parts.join(", ").replace(/, ([^,]*)$/, " and $1");
}
const FILL_FIELDS = ["art", "costumeSlots", "skillInfo", "passives", "deck", "npName", "npCard", "npTarget", "npTable", "attr", "lawOrder", "moral", "traits", "traitsSet", "cls", "rarity", "hp", "atk", "url"];
function fillServant(s, a, m) {
  const keep = {}; FILL_FIELDS.forEach((k) => { keep[k] = s[k] === undefined ? undefined : JSON.parse(JSON.stringify(s[k])); });
  const g = atlasToServant(a), ti = traitInfo(s);
  if (m.art) {
    // a servant whose costume slot was removed gets the stage pictures only
    if (s.costumeSlots === 0) { const a = Object.assign({}, g.art); Object.keys(a).forEach((k) => { if (/^c\d*$/.test(k)) delete a[k]; }); s.art = a; }
    else { s.art = g.art; if (g.costumeSlots) s.costumeSlots = g.costumeSlots; else delete s.costumeSlots; }
  }
  if (m.sk.length) { const info = [0, 1, 2].map((i) => (s.skillInfo || [])[i] || {}); m.sk.forEach((i) => { info[i] = g.skillInfo[i]; }); s.skillInfo = info; }
  if (m.ps) s.passives = g.passives;
  if (m.deck) s.deck = g.deck;
  if (m.npName) s.npName = g.npName;
  if (m.npCard) s.npCard = g.npCard;
  if (m.npTarget) s.npTarget = g.npTarget;
  if (m.npTable && g.npTable) s.npTable = g.npTable;
  if (m.tr) {
    // traits count as one set: once any part is yours, the rest has to be yours too
    s.attr = m.attr ? g.attr : (ti.attr || s.attr || null);
    s.lawOrder = m.order ? g.lawOrder : ti.order; s.moral = m.moral ? g.moral : ti.moral; s.traits = m.traits ? g.traits : ti.traits;
    if (!Array.isArray(s.buffs) && ti.buffs.length) s.buffs = ti.buffs;
    s.traitsSet = true;
  }
  if (m.cls) s.cls = a.c;
  if (m.rarity) s.rarity = a.r;
  if (m.hp) { const v = statAt(a, num(s.level), "hp"); if (v != null) s.hp = v; }
  if (m.atk) { const v = statAt(a, num(s.level), "atk"); if (v != null) s.atk = v; }
  if (m.url) s.url = g.url;
  return keep;
}
function restore(s, keep) { Object.keys(keep).forEach((k) => { if (keep[k] === undefined) delete s[k]; else s[k] = keep[k]; }); }
async function fillMany(list) {
  if (S.readOnly || !list.length) return;
  const undo = [];
  for (const x of list) { const keep = fillServant(x.s, x.a, x.m); undo.push([x.s, keep]); await writeDoc("servants", x.s); }
  renderAll(); if (!pcDlg.hidden) pcClose();
  toastAction(list.length === 1 ? list[0].s.name + " is filled in from " + list[0].a.n + "." : plural(list.length, "servant") + " filled in from the NA data.", "Undo", async () => {
    for (const u of undo) { restore(u[0], u[1]); await writeDoc("servants", u[0]); }
    renderAll(); toast("Put back as they were.");
  });
}

/* ---------- a note at the top when servants still need filling in ---------- */
const FILL_KEY = "spirit-origin-list:v1:filldismiss";
const fillNote = document.createElement("div");
fillNote.id = "fill-note"; fillNote.className = "notice fill-note"; fillNote.hidden = true;
(() => { const n = document.getElementById("notice"); if (n && n.parentNode) n.parentNode.insertBefore(fillNote, n.nextSibling); })();
const fillCands = () => S.servants.map(missingOf).filter(Boolean);
function renderFillNote() {
  if (S.dbState !== "ok" || !S.loaded.servants || S.readOnly) { fillNote.hidden = true; return; }
  const all = fillCands(), blank = all;
  const sig = blank.map((x) => x.s.id + ":" + missingText(x.m, x.a)).sort().join("|");
  let dismissed = ""; try { dismissed = localStorage.getItem(FILL_KEY) || ""; } catch (e) {}
  if (!blank.length || sig === dismissed) { fillNote.hidden = true; return; }
  fillNote.hidden = false;
  fillNote.innerHTML = `<p><b>${plural(blank.length, "servant")} on your list ${blank.length === 1 ? "has" : "have"} empty parts</b>: ${esc(blank.slice(0, 6).map((x) => x.s.name).join(", "))}${blank.length > 6 ? "…" : ""}. The NA data can fill in their pictures, skills, passives, deck, NP and traits.</p>
    <button type="button" class="btn primary sm" data-action="fill-open">Fill them in</button><button type="button" class="btn ghost sm" data-action="fill-later">Not now</button>`;
}

/* ---------- the review list ---------- */
let fillSel = null;
function fillPanelHTML() {
  const all = fillCands(), blank = all.filter((x) => !x.s.wish), part = all.filter((x) => x.s.wish);
  if (!fillSel) { fillSel = new Set(all.map((x) => x.s.id)); }
  const um = unmatched();
  const row = (x) => `<li class="fill-row"><label><input type="checkbox" data-fill="${esc(x.s.id)}"${fillSel.has(x.s.id) ? " checked" : ""}>
      <span class="fill-face"><img src="${esc(aimg(x.a.f))}" alt="" loading="lazy"></span>
      <span class="fill-main"><b>${esc(x.s.name)}${x.s.wish ? ` <small>Guest</small>` : ""}</b><small>as ${esc(x.a.n)} · No. ${x.a.no} · ${esc(x.a.c)} ${"★".repeat(x.a.r)}</small><span class="fill-what">Fills in ${esc(missingText(x.m, x.a))}</span></span></label>
      <button type="button" class="btn ghost sm" data-action="pc-open" data-no="${x.a.no}" title="See the NA data">View</button></li>`;
  const n = all.filter((x) => fillSel.has(x.s.id)).length;
  return `<div class="pcd-panel fill-panel" tabindex="-1">
    <button type="button" class="pcd-x" data-action="pc-close" aria-label="Close">×</button>
    <h2 id="pcd-title" class="pcd-name">Fill in from the NA data</h2>
    <p class="fill-intro">Only the empty parts get filled in: pictures, skills, passive skills, deck, NP, traits, class, rarity and the wiki link when they're blank, and HP / ATK for the level you set. Levels, skill levels, NP level, Fou, notes and everything you typed stay as they are, and you can undo it right after.</p>
    ${blank.length ? `<section class="d-sec"><h3>Your roster <small>${blank.length}</small></h3><ul class="fill-list">${blank.map(row).join("")}</ul></section>` : ""}
    ${part.length ? `<section class="d-sec"><h3>Guests <small>${part.length}</small></h3><ul class="fill-list">${part.map(row).join("")}</ul></section>` : ""}
    ${um.length ? `<p class="fill-um">Couldn't match ${esc(um.map((s) => s.name).join(", "))} to an NA servant. <button type="button" class="linkish" data-action="fill-match">Match them in Past Chaldea</button>, then come back here.</p>` : ""}
    ${!all.length ? `<p class="tr-none">Nothing is empty: every servant on your list is filled in.</p>` : ""}
    <div class="fill-act"><button type="button" class="btn primary" data-action="fill-go"${n ? "" : " disabled"}>Fill in ${plural(n, "servant")}</button><button type="button" class="btn ghost" data-action="pc-close">Cancel</button></div>
  </div>`;
}
const pcRenderDetail12 = pcRenderDetail;
pcRenderDetail = function () {
  if (pcOpen && pcOpen.fill) { const sc = pcDlg.querySelector(".pcd-panel"), top = sc ? sc.scrollTop : 0; pcDlg.innerHTML = fillPanelHTML(); const p2 = pcDlg.querySelector(".pcd-panel"); if (p2) p2.scrollTop = top; return; }
  return pcRenderDetail12();
};
function fillShow() {
  if (pcDlg.hidden) pcBack = document.activeElement;
  fillSel = null; pcOpen = {fill: true};
  pcRenderDetail();
  pcDlg.hidden = false; document.documentElement.classList.add("pcd-on");
  const shell = document.querySelector(".shell"); if (shell) shell.inert = true;
  const x = pcDlg.querySelector(".pcd-x"); if (x) x.focus({preventScroll: true});
}

/* ---------- one servant at a time, from their own page ---------- */
const FILL1_KEY = "spirit-origin-list:v1:filldismiss1";
const fill1Off = () => { try { return new Set(JSON.parse(localStorage.getItem(FILL1_KEY) || "[]")); } catch (e) { return new Set(); } };
const renderDossier12 = renderDossier;
renderDossier = function (force) {
  const r = renderDossier12(force);
  const d = document.getElementById("dossier");
  if (d && !S.editing && !S.readOnly && !d.querySelector("#servant-form")) {
    const x = missingOf(S.servants.find((v) => v.id === shownId()));
    if (x && !d.querySelector(".fill-one") && !fill1Off().has(x.s.id + "|" + missingText(x.m, x.a))) {
      const el = document.createElement("div"); el.className = "fill-one";
      el.innerHTML = `<p>Missing ${esc(missingText(x.m, x.a))}. The NA data for <b>${esc(x.a.n)}</b> has them.</p><button type="button" class="btn sm primary" data-action="fill-one" data-id="${esc(x.s.id)}">Fill in</button><button type="button" class="btn ghost sm" data-action="fill-one-no" data-k="${esc(x.s.id + "|" + missingText(x.m, x.a))}">Not now</button>`;
      const first = d.querySelector(".d-sec"); if (first) first.parentNode.insertBefore(el, first); else d.appendChild(el);
    }
  }
  return r;
};
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action;
  if (a === "fill-open") { fillShow(); return; }
  if (a === "fill-later") { try { localStorage.setItem(FILL_KEY, fillCands().map((x) => x.s.id + ":" + missingText(x.m, x.a)).sort().join("|")); } catch (er) {} renderFillNote(); return; }
  if (a === "fill-go") { const list = fillCands().filter((x) => fillSel && fillSel.has(x.s.id)); fillMany(list); return; }
  if (a === "fill-one") { const x = missingOf(S.servants.find((v) => v.id === b.dataset.id)); if (x) fillMany([x]); return; }
  if (a === "fill-one-no") { const off = fill1Off(); off.add(b.dataset.k); try { localStorage.setItem(FILL1_KEY, JSON.stringify(Array.from(off).slice(-300))); } catch (er) {} const el = b.closest(".fill-one"); if (el) el.remove(); return; }
  if (a === "fill-match") { pcClose(); S.tab = "past"; PC.review = true; PC.all = false; renderChrome(); syncPageTheme(); renderPast(); window.scrollTo({top: 0}); return; }
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset || t.dataset.fill == null || !fillSel) return;
  if (t.checked) fillSel.add(t.dataset.fill); else fillSel.delete(t.dataset.fill);
  const go = pcDlg.querySelector('[data-action="fill-go"]'), n = fillSel.size;
  if (go) { go.disabled = !n; go.textContent = "Fill in " + plural(n, "servant"); }
});
const renderAll13 = renderAll;
renderAll = function () { renderAll13(); renderFillNote(); };


