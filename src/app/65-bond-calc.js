/* ================= 0.54.0-beta: the bond calculator =================
   On a servant's page, under Progress: how many runs of a quest (and how much AP) to the next Bond level, Bond 10 or
   Bond 15. NA's bond tables come with the servant data (ATLAS_BOND; each servant's "bg"). The quest's bond and AP can
   be typed, or loaded from Atlas Academy (a chapter or event's free quests, or any quest by its number).
   Per run, the way GamePress lays it out: the quest's bond × (1 + 20% in the front line; + 4% for everyone when a
   support stands in the front line) × (1 + the Bond CEs' and the event's % added together) + the flat bonuses
   (Heroic Portraits and the like), doubled with Stargazer's Teapot. It's an estimate: the game rounds along the way.
   Kept apart from the roster: spirit-origin-list:v1:bondcalc = {rem: {servant id: [Bond level, points still needed]},
   goal: {servant id: level}, base, ap, front, sup, ce, flat, ev, tea, q: the quest loaded}. Syncs like the rest. */
const BC_KEY = "spirit-origin-list:v1:bondcalc";
const BC_OPEN = {};
const BC = {war: null, warId: 0, warBusy: false, busy: false, err: ""};
let bcRaw, bcObj = {}; // (bcRaw starts unset, so the first read sets up rem and goal even with nothing kept)
function bcState() {
  const r = lsGet(BC_KEY);
  if (r !== bcRaw) {
    bcRaw = r;
    try { const v = JSON.parse(r || "{}"); bcObj = v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { bcObj = {}; }
    ["rem", "goal"].forEach((k) => { if (!bcObj[k] || typeof bcObj[k] !== "object" || Array.isArray(bcObj[k])) bcObj[k] = {}; });
  }
  return bcObj;
}
const bcSave = () => { bcRaw = JSON.stringify(bcObj); lsSet(BC_KEY, bcRaw); };
if (typeof EXTRA_KEYS !== "undefined") { EXTRA_KEYS.bondcalc = BC_KEY; EXTRA_BY_KEY.set(BC_KEY, "bondcalc"); }
// the total bond to reach each level, 1 to 15 (cumulative), or null for a hand-made servant
function bcTable(s) {
  const a = atlasOf(s); if (!a || a.bg == null || typeof ATLAS_BOND === "undefined") return null;
  const t = ATLAS_BOND[a.bg]; return Array.isArray(t) && t.length >= 15 ? t : null;
}
const bcAt = (t, lv) => lv <= 0 ? 0 : t[Math.min(lv, 15) - 1];
// bond per run
function bcPerRun(st) {
  const base = clamp(num(st.base) || 0, 0, 1e6); if (!base) return 0;
  const pos = (st.front === false ? 0 : 0.2) + (st.sup ? 0.04 : 0);
  const pct = (clamp(num(st.ce) || 0, 0, 1000) + clamp(num(st.ev) || 0, 0, 1000)) / 100;
  return Math.floor((base * (1 + pos) * (1 + pct) + clamp(num(st.flat) || 0, 0, 1e5)) * (st.tea ? 2 : 1));
}
// how far it is from where the servant is now to a level
function bcNeed(s, t, goal) {
  const b = clamp(Math.floor(num(s.bond) || 0), 0, 15); if (goal <= b) return 0;
  const st = bcState(), r = st.rem[s.id], rem = Array.isArray(r) && num(r[0]) === b && num(r[1]) > 0 ? Math.min(num(r[1]), bcAt(t, b + 1) - bcAt(t, b)) : null;
  return (rem != null ? rem : bcAt(t, b + 1) - bcAt(t, b)) + bcAt(t, goal) - bcAt(t, b + 1);
}
function bcGoal(s) {
  const b = clamp(Math.floor(num(s.bond) || 0), 0, 15), g = num(bcState().goal[s.id]);
  return g > b && g <= 15 ? g : b < 10 ? 10 : 15;
}
const bcDays = (ap) => ap / 288;
function bcDaysText(ap) {
  const d = bcDays(ap);
  return d < 1 ? "less than a day of AP" : d < 1.5 ? "about a day of AP" : "about " + fmt(Math.round(d)) + " days of AP";
}

/* ---------- the block ---------- */
function bcSumText(s, t) {
  const b = clamp(Math.floor(num(s.bond) || 0), 0, 15), st = bcState(), per = bcPerRun(st);
  if (b >= 15) return "Bond 15: nothing left to earn";
  const g = bcGoal(s), need = bcNeed(s, t, g);
  return per ? "Bond " + g + " in " + fmt(Math.ceil(need / per)) + " runs" : fmt(need) + " points to Bond " + g;
}
function bcQuestHTML(st) {
  const ev = typeof live !== "undefined" && live && live.data ? live.data.ev.filter((x) => x.k === "event" && x.w && x.w.length && x.e > Date.now() / 1000 - 30 * 86400) : [];
  const free = BC.war ? BC.war.q : [];
  const q = st.q && typeof st.q === "object" ? st.q : null;
  return `<div class="bc-quest">
    <label class="npc-f"><span>Chapter or event</span><select data-bc-war><option value="">Pick one…</option>
      ${typeof STORY_CH !== "undefined" ? `<optgroup label="Main story">${STORY_CH.map((c) => `<option value="${c.id}"${c.id === BC.warId ? " selected" : ""}>${esc(c.ln)}</option>`).join("")}</optgroup>` : ""}
      ${ev.length ? `<optgroup label="Events on NA">${ev.map((x) => `<option value="${x.w[0]}"${x.w[0] === BC.warId ? " selected" : ""}>${esc(liveText(x.n))}</option>`).join("")}</optgroup>` : ""}</select></label>
    ${BC.warBusy ? `<p class="bc-note">Getting its free quests from Atlas Academy…</p>` : free.length ? `<label class="npc-f"><span>Free quest</span><select data-bc-free><option value="">Pick one…</option>${free.map((f) => `<option value="${f.id}/${f.ph}"${q && q.q === f.id ? " selected" : ""}>${esc((f.sp ? f.sp + ": " : "") + f.n + (f.ap ? " (" + f.ap + " AP)" : ""))}</option>`).join("")}</select></label>` : BC.warId ? `<p class="bc-note">No free quests found in it.</p>` : ""}
    <form class="bc-qid" data-bc-qid><label class="npc-f"><span>Or a quest's number</span><span class="npc-in"><input type="text" inputmode="numeric" placeholder="94086601, or a link from Atlas Academy" value="${q ? esc(String(q.q)) : ""}"></span></label><button type="submit" class="btn sm">Load</button></form>
    ${BC.busy ? `<p class="bc-note">Loading the quest…</p>` : BC.err ? `<p class="bc-warn">${esc(BC.err)}</p>` : q && q.n ? `<p class="bc-note">From <b>${esc(q.n)}</b>: ${fmt(q.bond)} bond${q.ap ? ", " + q.ap + " AP" : ""} a run.</p>` : ""}</div>`;
}
function bcBodyHTML(s, t) {
  const st = bcState(), b = clamp(Math.floor(num(s.bond) || 0), 0, 15);
  if (b >= 15) return `<p class="bc-note">${esc(nmText(s))} is at Bond 15, the highest there is.</p>`;
  const r = st.rem[s.id], rem = Array.isArray(r) && num(r[0]) === b ? num(r[1]) || "" : "", step = bcAt(t, b + 1) - bcAt(t, b), g = bcGoal(s);
  const nf = (k, label, unit, ph) => `<label class="npc-f"><span>${label}</span><span class="npc-in"><input type="number" min="0" step="1" inputmode="numeric" data-bc="${k}" value="${esc(String(st[k] != null && st[k] !== "" ? st[k] : ""))}" placeholder="${esc(ph || "0")}">${unit ? `<i>${unit}</i>` : ""}</span></label>`;
  return `<div class="npc-grid bc-grid">
      <label class="npc-f"><span>Still needed for Bond ${b + 1}</span><span class="npc-in"><input type="number" min="0" step="1" inputmode="numeric" data-bc="rem" value="${esc(String(rem))}" placeholder="${fmt(step)}"></span></label>
      <label class="npc-f"><span>Goal</span><select data-bc="goal">${Array.from({length: 15 - b}, (_, i) => b + 1 + i).map((n) => `<option value="${n}"${n === g ? " selected" : ""}>Bond ${n}</option>`).join("")}</select></label>
    </div>
    <p class="bc-hint">The game shows what's still needed on the servant's Bond screen. Left empty: from the start of Bond ${b}.</p>
    <h5 class="npc-th">The quest</h5>
    ${bcQuestHTML(st)}
    <div class="npc-grid bc-grid">${nf("base", "Bond a run (the quest's)", "", "0")}${nf("ap", "AP a run", "", "optional")}</div>
    <h5 class="npc-th">Bonuses</h5>
    <div class="npc-grid bc-grid">
      <label class="npc-f"><span>Where they stand</span><select data-bc="front"><option value="1"${st.front === false ? "" : " selected"}>Front line (+20%)</option><option value="0"${st.front === false ? " selected" : ""}>Back line</option></select></label>
      ${nf("ce", "Bond CEs in the party", "%")}${nf("ev", "Event bonus", "%")}${nf("flat", "Flat bonuses", "", "0")}
    </div>
    <label class="npc-chk"><input type="checkbox" data-bc="sup"${st.sup ? " checked" : ""}> A support in the front line (+4% for everyone)</label>
    <label class="npc-chk"><input type="checkbox" data-bc="tea"${st.tea ? " checked" : ""}> Stargazer's Teapot (doubles it)</label>
    <div class="bc-out" data-bc-o="out">${bcOutHTML(s, t)}</div>`;
}
function bcOutHTML(s, t) {
  const st = bcState(), b = clamp(Math.floor(num(s.bond) || 0), 0, 15), per = bcPerRun(st), ap = clamp(num(st.ap) || 0, 0, 200), g = bcGoal(s);
  const need = bcNeed(s, t, g), runs = per ? Math.ceil(need / per) : 0;
  const big = per ? `<div class="bc-big"><b>${fmt(runs)}</b><span>${runs === 1 ? "run" : "runs"} to Bond ${g}${ap ? `, ${fmt(runs * ap)} AP (${bcDaysText(runs * ap)})` : ""}</span></div>`
    : `<div class="bc-big"><b>${fmt(need)}</b><span>bond points to Bond ${g}. Add the quest's bond to see the runs.</span></div>`;
  const how = per ? `<p class="bc-how">${fmt(per)} bond a run: ${fmt(num(st.base))} × ${(1 + (st.front === false ? 0 : 0.2) + (st.sup ? 0.04 : 0)).toFixed(2)}${(num(st.ce) || 0) + (num(st.ev) || 0) ? " × " + (1 + ((num(st.ce) || 0) + (num(st.ev) || 0)) / 100).toFixed(2) : ""}${num(st.flat) ? " + " + fmt(num(st.flat)) : ""}${st.tea ? ", doubled" : ""}.</p>` : "";
  const rows = Array.from({length: 15 - b}, (_, i) => b + 1 + i).filter((n) => n === b + 1 || n === 5 || n === 10 || n >= 11 || n === g);
  const tab = `<table class="bc-tab"><thead><tr><th>Bond</th><th>Points</th>${per ? "<th>Runs</th>" : ""}${per && ap ? "<th>AP</th>" : ""}</tr></thead><tbody>${rows.map((n) => {
    const p = bcNeed(s, t, n), r = per ? Math.ceil(p / per) : 0;
    return `<tr${n === g ? ' class="on"' : ""}><th>${n}</th><td>${fmt(p)}</td>${per ? `<td>${fmt(r)}</td>` : ""}${per && ap ? `<td>${fmt(r * ap)}</td>` : ""}</tr>`;
  }).join("")}</tbody></table>`;
  return big + how + tab + `<p class="bc-foot">NA's bond table for ${esc(nmText(s))}: ${fmt(bcAt(t, 10))} points to Bond 10, ${fmt(bcAt(t, 15))} to Bond 15. The game rounds along the way, so a run can come out a point or two apart.</p>`;
}
function bcHTML(s) {
  const t = bcTable(s); if (!t) return "";
  const open = !!BC_OPEN[s.id];
  return `<details class="bc" data-bc-for="${esc(s.id)}"${open ? " open" : ""}><summary><span class="npc-h">Bond calculator</span><span class="npc-sum" data-bc-o="sum">${esc(bcSumText(s, t))}</span></summary>${open ? bcBodyHTML(s, t) : ""}</details>`;
}
function bcPaint(box, whole) {
  const s = S.servants.find((x) => x.id === box.dataset.bcFor), t = s && bcTable(s); if (!t) return;
  const sum = box.querySelector('[data-bc-o="sum"]'); if (sum) sum.textContent = bcSumText(s, t);
  if (!box.open) return;
  if (whole || !box.querySelector('[data-bc-o="out"]')) {
    const a = document.activeElement, k = a && box.contains(a) && a.dataset ? Object.keys(a.dataset).find((x) => x.startsWith("bc")) : null, kv0 = k ? a.dataset[k] : null;
    box.innerHTML = box.querySelector("summary").outerHTML + bcBodyHTML(s, t);
    if (k) { const f = box.querySelector(`[data-${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}="${kv0}"]`); if (f) f.focus({preventScroll: true}); }
  } else box.querySelector('[data-bc-o="out"]').innerHTML = bcOutHTML(s, t);
}
const renderDossier65 = renderDossier;
renderDossier = function (force) {
  const r = renderDossier65.apply(this, arguments);
  try {
    const d = document.getElementById("dossier");
    if (d && !S.editing && !d.querySelector("#servant-form") && !d.querySelector(".bc")) {
      const s = S.servants.find((v) => v.id === shownId()), row = d.querySelector(".lv-row");
      const sec = row && row.closest(".d-sec");
      if (s && !s.wish && sec) sec.insertAdjacentHTML("beforeend", bcHTML(s));
    }
  } catch (e) { console.error(e); }
  return r;
};
const typingInDossier65 = typingInDossier;
typingInDossier = function () {
  const a = document.activeElement;
  return typingInDossier65() || !!(a && a.matches && a.matches("#dossier .bc input"));
};
document.addEventListener("toggle", (e) => {
  const d = e.target; if (!d || !d.matches || !d.matches("details.bc")) return;
  BC_OPEN[d.dataset.bcFor] = d.open; if (d.open) bcPaint(d, true);
}, true);
function bcSet(t) {
  const box = t.closest(".bc"), s = box && S.servants.find((x) => x.id === box.dataset.bcFor); if (!s) return;
  const st = bcState(), k = t.dataset.bc, b = clamp(Math.floor(num(s.bond) || 0), 0, 15);
  if (k === "rem") { const v = num(t.value); if (v > 0) st.rem[s.id] = [b, Math.round(v)]; else delete st.rem[s.id]; }
  else if (k === "goal") st.goal[s.id] = num(t.value) || undefined;
  else if (k === "front") st.front = t.value !== "0";
  else if (k === "sup" || k === "tea") st[k] = t.checked;
  else { const v = num(t.value); st[k] = v > 0 ? v : undefined; }
  bcSave(); bcPaint(box, k === "goal" || k === "front");
}
document.addEventListener("input", (e) => { const t = e.target; if (t && t.dataset && t.dataset.bc != null && t.tagName === "INPUT" && t.type !== "checkbox" && t.closest("#dossier .bc")) bcSet(t); });
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset || !t.closest || !t.closest("#dossier .bc")) return;
  if (t.dataset.bc != null && (t.tagName === "SELECT" || t.type === "checkbox")) bcSet(t);
  else if (t.dataset.bcWar != null) { BC.warId = num(t.value) || 0; BC.war = null; if (BC.warId) bcLoadWar(BC.warId); else bcRepaint(); }
  else if (t.dataset.bcFree != null && t.value) { const m = /^(\d+)\/(\d+)$/.exec(t.value); if (m) bcLoadQuest(num(m[1]), num(m[2])); }
});
document.addEventListener("submit", (e) => {
  const f = e.target; if (!f || !f.matches || !f.matches("#dossier form[data-bc-qid]")) return;
  e.preventDefault();
  const v = f.querySelector("input").value, m = /quest\/(\d+)(?:\/(\d+))?/.exec(v) || /(\d{5,})(?:\D+(\d+))?/.exec(v);
  if (m) bcLoadQuest(num(m[1]), num(m[2]) || 0); else { BC.err = "That doesn't look like a quest number (like 94086601)."; bcRepaint(); }
});
const bcRepaint = () => document.querySelectorAll("#dossier details.bc").forEach((d) => bcPaint(d, true));

/* ---------- quests from Atlas Academy ---------- */
// a chapter or event's free quests: [{id, n, sp, ap, ph (its last phase)}]
async function bcLoadWar(id) {
  BC.warBusy = true; bcRepaint();
  try {
    const key = "bond:war:" + id;
    let w = await kv.get(key).catch(() => null);
    if (!w || w.v !== 1 || Date.now() - (w.at || 0) > 7 * 86400e3) {
      const d = await storyFetch(ATLAS_NICE + "war/" + id), q = [];
      (d.spots || []).forEach((sp) => (sp.quests || []).forEach((x) => {
        if (x.type !== "free" || !(x.phases || []).length) return;
        q.push({id: x.id, n: liveText(x.name || ""), sp: liveText(sp.name || x.spotName || ""), ap: x.consumeType === "ap" || x.consumeType == null ? x.consume | 0 : 0, ph: Math.max.apply(null, x.phases)});
      }));
      w = {v: 1, at: Date.now(), q: q}; await kv.set(key, w).catch(() => {});
    }
    if (BC.warId === id) BC.war = w;
  } catch (e) { BC.war = {q: []}; BC.err = navigator.onLine === false ? "You're offline: NA's quests come from Atlas Academy." : "Couldn't get that chapter's quests from Atlas Academy. Try again in a moment."; }
  BC.warBusy = false; bcRepaint();
}
async function bcLoadQuest(q, ph) {
  BC.busy = true; BC.err = ""; bcRepaint();
  try {
    if (!ph) { const d0 = await storyFetch(ATLAS_NICE + "quest/" + q); ph = Math.max.apply(null, (d0.phases || [1]).concat([1])); }
    const key = "bond:phase:" + q + "-" + ph;
    let d = await kv.get(key).catch(() => null);
    if (!d || d.v !== 1) {
      const x = await storyFetch(ATLAS_NICE + "quest/" + q + "/" + ph);
      d = {v: 1, n: liveText(x.name || ""), bond: x.bond | 0, ap: x.consumeType === "ap" || x.consumeType == null ? x.consume | 0 : 0};
      await kv.set(key, d).catch(() => {});
    }
    const st = bcState();
    st.q = {q: q, ph: ph, n: d.n, bond: d.bond, ap: d.ap};
    if (d.bond) st.base = d.bond; if (d.ap) st.ap = d.ap;
    bcSave();
    if (!d.bond) BC.err = "Atlas Academy lists no bond for that quest.";
  } catch (e) { BC.err = navigator.onLine === false ? "You're offline: NA's quests come from Atlas Academy." : "Couldn't load that quest from Atlas Academy. Check the number and try again."; }
  BC.busy = false; bcRepaint();
}
// for the tests
window.__fgiBond = {table: (id) => bcTable(S.servants.find((s) => s.id === id)), need: (id, g) => { const s = S.servants.find((x) => x.id === id); return bcNeed(s, bcTable(s), g); }, perRun: (o) => bcPerRun(o || bcState()), state: () => bcState()};
