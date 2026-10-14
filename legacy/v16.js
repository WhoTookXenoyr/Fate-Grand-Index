/* ================= 0.15.0: HP and ATK follow the level, upgraded skills, the version on show ================= */

/* ---------- traits: Artoria Face by its name; Demonic Beast is its own trait, not Demonic Beast Servant ---------- */
TRAIT_ALIAS["saberface"] = "Artoria Face"; TRAIT_ALIAS["artoria face"] = "Artoria Face";
delete TRAIT_ALIAS["demonic beast"];
NA_TRAITS = null;

/* ---------- the version, top left ---------- */
(function () { const v = document.getElementById("app-ver"); if (v) v.textContent = "v" + APP_VER + " · alpha"; })();

/* ---------- HP and ATK always match the level (for servants matched to the NA list) ---------- */
function syncStats(s) {
  const a = s ? atlasOf(s) : null, lv = s ? num(s.level) : null;
  if (!a || lv == null || lv < 1) return false;
  let ch = false;
  ["hp", "atk"].forEach((k) => { const v = statAt(a, lv, k); if (v != null && num(s[k]) !== v) { s[k] = v; ch = true; } });
  return ch;
}
// the level each servant had when it was last saved, so any save that changes the level brings HP and ATK along
const lvSeen = new Map();
const noteLevels = () => S.servants.forEach((s) => { if (!lvSeen.has(s.id)) lvSeen.set(s.id, num(s.level)); });
const writeDoc16 = writeDoc;
writeDoc = function (col, obj) {
  if (col === "servants" && obj && obj.id) {
    const prev = lvSeen.get(obj.id), lv = num(obj.level);
    if (prev !== undefined && prev !== lv) syncStats(obj);
    lvSeen.set(obj.id, lv);
  }
  return writeDoc16(col, obj);
};
// + and − on the level move HP and ATK straight away, not only once it's saved
const bump16 = bump;
bump = function (f, d) {
  const s = S.servants.find((x) => x.id === shownId());
  bump16(f, d);
  if (f === "level" && s && !S.readOnly && syncStats(s)) { renderSummary(); renderList(); renderDossier(); renderRanking(); }
};
// once: servants saved with HP or ATK that don't match their level are put right, with undo
const SYNC_KEY = "spirit-origin-list:v1:statsync";
let syncChecked = false;
async function syncAllOnce() {
  if (syncChecked || S.dbState !== "ok" || !S.loaded.servants || S.readOnly) return;
  syncChecked = true;
  if (lsGet(SYNC_KEY) === "1") { noteLevels(); return; }
  lsSet(SYNC_KEY, "1");
  const undo = [];
  S.servants.forEach((s) => { const keep = {hp: s.hp, atk: s.atk}; if (syncStats(s)) undo.push([s, keep]); });
  noteLevels();
  if (!undo.length) return;
  for (const u of undo) await writeDoc16("servants", u[0]);
  renderAll();
  toastAction("HP and ATK now match the level for " + plural(undo.length, "servant") + ".", "Undo", async () => {
    for (const u of undo) { Object.keys(u[1]).forEach((k) => { if (u[1][k] === undefined) delete u[0][k]; else u[0][k] = u[1][k]; }); await writeDoc16("servants", u[0]); }
    renderAll(); toast("Put back as they were.");
  });
}
const renderAll16 = renderAll;
renderAll = function () { renderAll16(); if (syncChecked) noteLevels(); else syncAllOnce(); };

/* ---------- upgraded skills: a switch next to the name ---------- */
// every version of a skill, oldest first (Rank Up quests, interludes and the story upgrade some skills, a few twice or more)
const skVersions = (a, i) => { const k = a && a.sk && a.sk[i]; return k && k.u ? k.u.concat([k]) : null; };
// a skill's name and rank as a key: "A" and "A+" are different versions, so the rank keeps its + and -
const skKey = (name, rank) => { const nr = skNameRank(name, rank); return nname(nr.name) + "|" + String(nr.rank || "").toUpperCase().replace(/\s+/g, ""); };
const effKey = (e) => nname(Array.isArray(e) ? e.join(" ") : e);
// which NA version a skill is: the one last switched to while its name still fits, else by name and rank,
// and by its effect text when two versions share both (Tamamo's Fox's Wedding EX)
function versionIdx(vs, info) {
  if (!vs || !info || !String(info.name || "").trim()) return -1;
  const key = skKey(info.name, info.rank), hits = vs.map((v, i) => skKey(v.n, "") === key ? i : -1).filter((i) => i >= 0), up = num(info.upv);
  if (up != null && vs[up] && (hits.includes(up) || !hits.length)) return up;
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) { const ek = effKey(info.effect), m = hits.find((i) => effKey(vs[i].e) === ek); return m != null ? m : hits[hits.length - 1]; }
  return -1;
}
// a name that isn't one of the NA versions (typed from the wiki, say): "upgraded" means the newest,
// "… (→ … after Rank Up)" the one before the upgrade, anything else the newest
const guessIdx = (vs, info) => {
  if (!vs || !info || !String(info.name || "").trim()) return -1;
  const i = versionIdx(vs, info); if (i >= 0) return i;
  const t = String(info.name);
  return /upgraded/i.test(t) ? vs.length - 1 : /→|->|\bafter\b/i.test(t) ? 0 : vs.length - 1;
};
const upLabel = (n, i) => i === n - 1 ? "Upgraded" : i === 0 ? (n === 2 ? "Before upgrade" : "Original") : "Upgrade " + i;
function upSwitchHTML(n, i, attrs) {
  const two = n === 2, last = i === n - 1, next = (i + 1) % n, label = upLabel(n, i);
  const dots = n > 2 ? Array.from({length: n}, (_, j) => `<circle class="upsw-d" cx="${(12 + j * 20 / (n - 1)).toFixed(2)}" cy="12" r="2.2"/>`).join("") : "";
  const tip = two ? (last ? "Upgraded skill. Press for the skill before its upgrade" : "The skill before its upgrade. Press for the upgraded one") : label + ", " + (i + 1) + " of " + n + ". Press for " + (next ? upLabel(n, next).toLowerCase() : "the original");
  return `<button type="button" class="upsw${last ? " on" : ""}"${two ? ` role="switch" aria-checked="${last}"` : ""} ${attrs} data-v="${next}" style="--p:${n > 1 ? (i / (n - 1)).toFixed(3) : 0}" title="${esc(tip)}" aria-label="${esc(two ? "Upgraded skill" : "Skill version: " + label + ", " + (i + 1) + " of " + n)}">
    <svg class="upsw-s" viewBox="0 0 44 24" width="40" height="22" aria-hidden="true" focusable="false"><rect class="upsw-t" x="1" y="1" width="42" height="22" rx="11"/>${dots}<g class="upsw-k"><circle cx="12" cy="12" r="8.5"/><path class="upsw-a" d="M8.4 13.8 12 10.2l3.6 3.6"/></g></svg><span class="upsw-l">${esc(label)}</span></button>`;
}
// a version from the NA data, in the shape the page keeps skills in
function skFromAtlas(v, cur) {
  const sc = (v.v || []).map((r) => ({label: r[0], v1: r[1], v10: r[2], unit: r[3] || null})), f = sc[0] || {};
  return Object.assign({}, cur || {}, {name: v.n, rank: null, effect: (v.e || []).join("\n") || null, cd: v.cd != null ? v.cd : null, scales: sc,
    label: f.label || null, v1: f.v1 != null ? f.v1 : null, v10: f.v10 != null ? f.v10 : null, unit: f.unit || null});
}
function switchSkill(s, i, v) {
  const a = atlasOf(s), vs = skVersions(a, i); if (!vs || !vs[v] || S.readOnly) return;
  const k = skSetIdx(s), sets = skSets(s), src = k ? ((sets[k - 1] || {}).info || []) : (s.skillInfo || []);
  const arr = [0, 1, 2].map((j) => src[j] || {}), cur = arr[i], ci = guessIdx(vs, cur);
  // whatever was there is kept per version, so flipping back brings your own text back too
  const keep = s.skUpKeep && typeof s.skUpKeep === "object" ? s.skUpKeep : {}, kk = k + ":" + i, box = keep[kk] || (keep[kk] = {});
  if (ci >= 0) box[ci] = JSON.parse(JSON.stringify(cur));
  arr[i] = box[v] ? JSON.parse(JSON.stringify(box[v])) : skFromAtlas(vs[v], cur);
  arr[i].upv = v;
  s.skUpKeep = keep;
  if (k) { sets[k - 1] = Object.assign({}, sets[k - 1], {info: arr}); s.skillSets = sets; } else s.skillInfo = arr;
  renderList(); renderDossier(true); renderRanking();
  scheduleWrite("servants", s);
  const b = document.querySelector(`#dossier [data-action="skup"][data-i="${i}"]`); if (b) b.focus({preventScroll: true});
}
const renderDossier16 = renderDossier;
renderDossier = function (force) {
  const r = renderDossier16(force);
  const d = document.getElementById("dossier");
  if (d && !S.editing && !S.readOnly && !d.querySelector("#servant-form")) {
    const s = S.servants.find((v) => v.id === shownId()), a = s ? atlasOf(s) : null;
    if (a && a.sk.some((k) => k.u)) {
      const infos = skInfos(s, skSetIdx(s));
      d.querySelectorAll(".skills > article.skill").forEach((art, i) => {
        if (i > 2 || art.querySelector(".upsw")) return;
        const vs = skVersions(a, i), vi = guessIdx(vs, (infos || [])[i]); if (vi < 0) return;
        const h = art.querySelector("header h4"); if (h) h.insertAdjacentHTML("beforeend", upSwitchHTML(vs.length, vi, `data-action="skup" data-i="${i}"`));
      });
    }
  }
  return r;
};
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="skup"], [data-action="pc-skup"]'); if (!b) return;
  const i = Number(b.dataset.i), v = Number(b.dataset.v);
  if (b.dataset.action === "skup") { const s = S.servants.find((x) => x.id === shownId()); if (s) switchSkill(s, i, v); return; }
  // Past Chaldea: only what's on screen changes
  if (!pcOpen || pcOpen.no == null || pcOpen.ce || pcOpen.v15) return;
  const x = ATLAS_BY_NO.get(pcOpen.no); if (!x || !x.sk[i]) return;
  pcOpen.skv = Object.assign({}, pcOpen.skv, {[i]: v});
  const art = b.closest("article.skill"); if (!art) return;
  const t = document.createElement("div"); t.innerHTML = pcSkillHTML(x.sk[i], i); art.replaceWith(t.firstElementChild);
  const nb = pcDlg.querySelector(`[data-action="pc-skup"][data-i="${i}"]`); if (nb) nb.focus({preventScroll: true});
});
