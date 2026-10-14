/* ================= v11: more on Home ================= */

/* ---------- find a servant by name, straight from Home ---------- */
const homeHeroHTML10 = homeHeroHTML;
homeHeroHTML = function (own, guests) {
  const names = own.concat(guests).map((s) => `<option value="${esc(s.name)}"></option>`).join("");
  const find = own.length + guests.length ? `<div class="hm-find"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4.5 4.5"/></svg><input id="hm-find" type="search" list="hm-names" placeholder="Find a servant or Guest" aria-label="Find a servant or Guest by name" autocomplete="off" spellcheck="false"><datalist id="hm-names">${names}</datalist></div>` : "";
  return homeHeroHTML10(own, guests).replace(`<div class="hm-actions">`, find + `<div class="hm-actions">`);
};
function homeFind(v, strict) {
  const q = String(v || "").trim().toLowerCase(); if (!q) return false;
  const all = S.servants;
  const s = all.find((x) => String(x.name || "").toLowerCase() === q) || (strict ? null : all.find((x) => String(x.name || "").toLowerCase().startsWith(q)) || all.find((x) => String(x.name || "").toLowerCase().includes(q)));
  if (!s) { if (!strict) toast("Nobody on your list is called “" + String(v).trim() + "”."); return false; }
  if (S.editing) dropFormArt();
  S.tab = "servants"; S.selected = s.id; S.lastSel = s.id; S.editing = null;
  renderChrome(); renderList(); renderDossier(); syncPageTheme(); window.scrollTo({top: 0}); renderHome();
  return true;
}
document.addEventListener("keydown", (e) => { if (e.target && e.target.id === "hm-find" && e.key === "Enter") { e.preventDefault(); homeFind(e.target.value, false); } });
document.addEventListener("input", (e) => { if (e.target && e.target.id === "hm-find" && (!e.inputType || e.inputType === "insertReplacementText")) homeFind(e.target.value, true); });

/* ---------- up against a class: who on your roster hits them hardest ---------- */
const HVS_KEY = "spirit-origin-list:v1:homevs";
let homeVs = (() => { try { const v = localStorage.getItem(HVS_KEY); return AFF_CLASSES.includes(v) ? v : "Berserker"; } catch (e) { return "Berserker"; } })();
function homeVsHTML(own) {
  const e = homeVs, score = new Map(rankRows().map((r) => [r.s.id, r.sc.total]));
  const chips = AFF_CLASSES.map((c) => `<button type="button" class="hv-c${c === e ? " on" : ""}" data-action="home-vs" data-cls="${esc(c)}" aria-pressed="${c === e}" title="${esc(c)}">${CLASS_LOGO[c] ? `<img src="${CLASS_LOGO[c]}" alt="">` : `<span class="mono-tag">${esc(ABBR[c] || c)}</span>`}<span class="vh">${esc(c)}</span></button>`).join("");
  const rows = own.map((s) => ({s: s, out: aff(s.cls, e), inn: aff(e, s.cls), sc: score.get(s.id) || 0}))
    .sort((a, b) => b.out - a.out || a.inn - b.inn || b.sc - a.sc).slice(0, 5);
  const best = rows.length ? rows[0].out : 1;
  const hurt = own.filter((s) => aff(e, s.cls) >= 2).length;
  const tag = (v, word) => `<span class="hv-x ${affCls(v)}" title="${esc(word)}">${affTxt(v)}</span>`;
  const body = rows.length ? `<ol class="hv-list">${rows.map((x) => `<li><button type="button" class="hm-row" data-action="goto" data-id="${esc(x.s.id)}">${miniAva(x.s)}<span class="hm-main"><b>${esc(x.s.name)}</b><small>${esc(x.s.cls || "No class")}${x.inn !== 1 ? ` · takes ${affTxt(x.inn)} from them` : ""}</small></span>${tag(x.out, "Damage dealt to " + e)}</button></li>`).join("")}</ol>` : `<p class="tr-none">Add servants and the best answer to each class shows up here.</p>`;
  const lead = !rows.length ? "" : best >= 2 ? `Your best answers to ${esc(e)} enemies.` : best > 1 ? `Nobody hits ${esc(e)} for double damage; these come closest.` : `Nobody on your roster has the advantage over ${esc(e)}; these are your strongest.`;
  return `<section class="d-sec hm-block hm-b-vs"><h3>Up against <small>pick an enemy class</small></h3>
    <div class="hv-cls" role="group" aria-label="Enemy class">${chips}</div>
    ${lead ? `<p class="hv-lead">${lead}${hurt ? ` <span class="muted">${plural(hurt, "of yours takes", "of yours take")} double damage from them.</span>` : ""}</p>` : ""}${body}</section>`;
}

/* ---------- recent progress: every level, skill, NP and Fou step you save ---------- */
const LOG_KEY = "spirit-origin-list:v1:log";
// the first moments after loading are the page setting itself up, not you
let logSnap = null, logMute = Date.now() + 2500;
function snapOf(s) {
  return {level: num(s.level), np: num(s.npLevel), fouHp: num(s.fouHp) || 0, fouAtk: num(s.fouAtk) || 0, wish: !!s.wish,
    skills: [0, 1, 2].map((i) => { const v = (s.skills || [])[i]; return typeof v === "number" ? v : 0; })};
}
function logInit() { if (!logSnap && S.loaded.servants && S.dbState === "ok") logSnap = new Map(S.servants.map((s) => [s.id, snapOf(s)])); }
function readLog() { try { const v = JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function logChange(s) {
  logInit(); if (!logSnap) return;
  const a = logSnap.get(s.id), b = snapOf(s); logSnap.set(s.id, b);
  if (Date.now() < logMute) return;
  const ev = [];
  if (!a) ev.push({k: b.wish ? "guest" : "new"});
  else if (a.wish && !b.wish) ev.push({k: "summon"});
  else if (!b.wish) {
    if (a.level !== b.level && b.level != null) ev.push({k: "level", from: a.level, to: b.level});
    if (a.np !== b.np && b.np != null) ev.push({k: "np", from: a.np, to: b.np});
    b.skills.forEach((v, i) => { if (v !== a.skills[i]) ev.push({k: "skill", i: i, from: a.skills[i], to: v}); });
    if (a.fouHp !== b.fouHp) ev.push({k: "fouHp", from: a.fouHp, to: b.fouHp});
    if (a.fouAtk !== b.fouAtk) ev.push({k: "fouAtk", from: a.fouAtk, to: b.fouAtk});
  }
  if (!ev.length) return;
  const log = readLog(), now = Date.now();
  ev.forEach((e) => {
    const key = s.id + ":" + e.k + (e.i != null ? e.i : "");
    const prev = log.find((x) => x.key === key);
    // steps on the same thing within a quarter of an hour read as one: Skill 2: Lv 6 → 9
    if (prev && "from" in e && now - prev.t < 15 * 60 * 1000) {
      log.splice(log.indexOf(prev), 1);
      if (prev.from !== e.to) log.unshift(Object.assign(prev, {to: e.to, t: now, name: s.name}));
    } else log.unshift(Object.assign({key: key, id: s.id, name: s.name, t: now}, e));
  });
  if (log.length > 60) log.length = 60;
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) {}
}
const writeDoc10 = writeDoc;
writeDoc = function (col, obj) { if (col === "servants" && obj && obj.id) { try { logChange(obj); } catch (e) {} } return writeDoc10(col, obj); };
// a backup import rewrites everything at once; that isn't progress
document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest('[data-action="import-go"]')) logMute = Date.now() + 8000; }, true);
function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now"; if (m < 60) return m + " min ago";
  const h = Math.round(m / 60); if (h < 24) return h + " h ago";
  const d = Math.round(h / 24); return d === 1 ? "yesterday" : d < 30 ? d + " days ago" : new Date(t).toLocaleDateString(undefined, {day: "numeric", month: "short"});
}
function logText(e, s) {
  const lv = (v) => v ? "Lv " + v : "locked";
  if (e.k === "level") { const cap = s ? CAPS[s.rarity] : null; return (cap && e.to > cap && (e.from || 0) <= cap ? "Grailed: " : "") + "Lv " + (e.from ?? "?") + " → " + e.to; }
  if (e.k === "np") return "NP" + (e.from ?? "?") + " → NP" + e.to;
  if (e.k === "skill") return "Skill " + (e.i + 1) + ": " + lv(e.from) + " → " + lv(e.to);
  if (e.k === "fouHp" || e.k === "fouAtk") { const d = e.to - e.from, w = e.k === "fouHp" ? "HP" : "ATK"; return "Fou " + w + " " + (d >= 0 ? "+" : "−") + fmt(Math.abs(d)) + " (" + fmt(e.to) + ")"; }
  return e.k === "summon" ? "Summoned!" : e.k === "guest" ? "Added as a Guest" : "Joined your roster";
}
function homeLogHTML() {
  const log = readLog().slice(0, 7);
  const body = log.length ? `<ol class="hl-list">${log.map((e) => { const s = S.servants.find((x) => x.id === e.id);
    return `<li class="hl-${esc(e.k)}">${s ? `<button type="button" class="hm-row" data-action="goto" data-id="${esc(s.id)}">` : `<span class="hm-row">`}${s ? miniAva(s) : `<span class="tr-ava"></span>`}<span class="hm-main"><b>${esc(s ? s.name : e.name)}</b><small>${esc(logText(e, s))}</small></span><time class="hl-t" datetime="${new Date(e.t).toISOString()}">${esc(ago(e.t))}</time>${s ? `</button>` : `</span>`}</li>`; }).join("")}</ol>`
    : `<p class="tr-none">Level a skill, feed some Fou or summon a Guest, and it shows up here.</p>`;
  return `<section class="d-sec hm-block hm-b-log"><h3>Recent progress <small>saved in this browser</small></h3>${body}</section>`;
}

/* ---------- Summoning, in short ---------- */
function homeSummonHTML(guests) {
  const f5 = smFeat(5);
  const ban = f5 ? `<button type="button" class="hm-row" data-action="tab" data-tab="summon">${miniAva(f5)}<span class="hm-main"><b>${esc(f5.name)} <span class="hs-up">rate-up</span></b><small>${SM.got ? "Came on summon " + SM.got + " of this banner" : SM.n ? SM.n + " of " + SM_PITY + " summons toward the guarantee" : "★5 · " + SM_FEAT[5] + "% each summon"}</small></span><span class="hs-sq">${SQ_SVG}${fmt(SM.sq)}</span></button>`
    : `<p class="tr-none">No rate-up yet. Feature a ★5 on the Summoning page for a banner with the 330-summon guarantee.</p>`;
  const g = guests.slice(0, 8);
  return `<section class="d-sec hm-block hm-b-sum"><h3>Summoning <small>${guests.length ? plural(guests.length, "Guest") + " waiting" : "nobody waiting"}</small></h3>
    ${ban}
    ${g.length ? `<div class="hs-guests">${g.map((s) => `<button type="button" class="hs-g" data-action="to-summon" data-id="${esc(s.id)}" title="${esc(s.name)}">${miniAva(s)}<span>${esc(s.name)}</span></button>`).join("")}</div>` : ""}
    <div><button type="button" class="btn sm summon-btn" data-action="tab" data-tab="summon">Go to Summoning</button>${!guests.length && !S.readOnly ? ` <button type="button" class="btn ghost sm" data-action="add-wish">+ Add guest</button>` : ""}</div>
  </section>`;
}

/* ---------- Master records ---------- */
function recordsOf(own) {
  const lv = own.map((s) => num(s.level) || 0), maxLv = lv.length ? Math.max(...lv) : 0;
  const grailed = own.filter((s) => { const st = levelStatus(s); return st && st.kind === "grail"; }).length;
  const at100 = own.filter((s) => (num(s.level) || 0) >= 100).length;
  const tri = own.reduce((m, s) => Math.max(m, (s.skills || []).filter((v) => v === 10).length), 0);
  const tens = own.reduce((a, s) => a + (s.skills || []).filter((v) => v === 10).length, 0);
  const np = own.reduce((m, s) => Math.max(m, num(s.npLevel) || 0), 0);
  const fou = own.reduce((m, s) => Math.max(m, Math.min(num(s.fouHp) || 0, num(s.fouAtk) || 0)), 0);
  const base = ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker"], have = new Set(own.map((s) => s.cls));
  const baseN = base.filter((c) => have.has(c)).length, extraN = CLASSES.filter((c) => !base.includes(c) && have.has(c)).length;
  return [
    {ic: "Grailbuff", t: "First Grail", d: "A servant past their level cap", v: Math.min(grailed, 1), of: 1, show: grailed ? plural(grailed, "servant") + " grailed" : "None yet"},
    {ic: "Specialpowerup", t: "Lv 100", d: "A servant at Lv 100", v: Math.min(maxLv, 100), of: 100, show: "Highest Lv " + maxLv},
    {ic: "Npdamageupboost", t: "Lv 120", d: "A servant at Lv 120", v: Math.min(maxLv, 120), of: 120, show: "Highest Lv " + maxLv},
    {ic: "Stargainup", t: "Grail Five", d: "Five servants at Lv 100 or higher", v: Math.min(at100, 5), of: 5},
    {ic: "Skillreloading", t: "10 / 10 / 10", d: "All three skills of one servant at Lv 10", v: tri, of: 3, show: tri ? "Best: " + tri + " of 3" : "None yet"},
    {ic: "Buffregen", t: "Skill Ten", d: "Ten skills at Lv 10", v: Math.min(tens, 10), of: 10},
    {ic: "NPOvercharge", t: "NP5", d: "A servant at NP5", v: Math.min(np, 5), of: 5, show: np ? "Highest NP" + np : "None yet"},
    {ic: "Maxhpup", t: "Silver Fou", d: "1,000 Fou on both HP and ATK of one servant", v: Math.min(fou, 1000), of: 1000},
    {ic: "Defenseup", t: "Gold Fou", d: "2,000 Fou on both HP and ATK of one servant", v: Math.min(fou, 2000), of: 2000},
    {ic: "ClassOverwriteAdvantageSaber", t: "Seven Knights", d: "A servant in each of the seven base classes", v: baseN, of: 7},
    {ic: "Changeclass", t: "Extra Classes", d: "Servants in five different extra classes", v: Math.min(extraN, 5), of: 5},
    {ic: "BondExp", t: "Full Chaldea", d: "25 servants on your roster", v: Math.min(own.length, 25), of: 25},
  ];
}
function homeRecordsHTML(own) {
  const R = recordsOf(own), n = R.filter((r) => r.v >= r.of).length;
  return `<section class="d-sec hm-block hm-b-rec"><h3>Master records <small>${n} of ${R.length} earned</small></h3>
    <ul class="rec-list">${R.map((r) => { const done = r.v >= r.of, p = Math.round(r.v / r.of * 100);
      return `<li class="rec${done ? " done" : ""}" title="${esc(r.d)}"><span class="rec-m" style="--p:${p}">${icHTML(r.ic)}</span><b>${esc(r.t)}</b><small>${done ? "Earned" : esc(r.show || fmt(r.v) + " of " + fmt(r.of))}</small><span class="vh">${esc(r.d)}</span></li>`; }).join("")}</ul>
  </section>`;
}

/* ---------- Home, put together ---------- */
renderHome = function () {
  const el = document.getElementById("home"); if (!el) return;
  if (S.tab !== "home") { if (el.firstChild) el.innerHTML = ""; return; }
  const a = document.activeElement; if (a && a.id === "hm-find" && el.contains(a) && a.value) return;
  if (S.dbState !== "ok" || !S.loaded.servants) { el.innerHTML = `<div class="skeleton" style="height:340px"></div>`; return; }
  logInit();
  const own = owned(), guests = wished();
  el.innerHTML = homeHeroHTML(own, guests) + `<div class="hm-grid">${homeNextHTML(own)}${homeRosterHTML(own)}${homeVsHTML(own)}${homeLogHTML()}${homeSummonHTML(guests)}${homePartiesHTML()}${homeRecordsHTML(own)}</div>`;
  if (!homeDealt) {
    const fan = el.querySelector(".hm-fan");
    if (fan) { if (RM.matches) fan.classList.add("dealt"); else requestAnimationFrame(() => requestAnimationFrame(() => fan.classList.add("deal"))); homeDealt = true; }
  }
};
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="home-vs"]'); if (!b) return;
  homeVs = AFF_CLASSES.includes(b.dataset.cls) ? b.dataset.cls : homeVs;
  try { localStorage.setItem(HVS_KEY, homeVs); } catch (er) {}
  const old = document.querySelector(".hm-b-vs"); if (!old) return;
  const tmp = document.createElement("div"); tmp.innerHTML = homeVsHTML(owned()); old.replaceWith(tmp.firstElementChild);
  const nb = document.querySelector(`.hm-b-vs [data-cls="${CSS.escape(homeVs)}"]`); if (nb) nb.focus({preventScroll: true});
});
// the times in Recent progress stay fresh while Home is open
setInterval(() => { if (S.tab === "home" && !document.hidden) document.querySelectorAll(".hl-t").forEach((t) => { const d = Date.parse(t.getAttribute("datetime")); if (d) t.textContent = ago(d); }); }, 60000);
const renderAll11 = renderAll;
renderAll = function () { renderAll11(); logInit(); };
