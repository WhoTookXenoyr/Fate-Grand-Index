/* ---------- spreadsheets and other planners: CSV out and in, plus any JSON list of servants ---------- */
const PL_KEYS = {
  name: ["name", "servant", "servantname", "character", "charactername", "unit", "unitname", "title"],
  cls: ["class", "cls", "servantclass", "classname", "classtype"],
  rarity: ["rarity", "stars", "star", "rare", "grade"],
  level: ["level", "lv", "lvl", "currentlevel", "servantlevel", "curlevel", "nowlevel"],
  npLevel: ["np", "nplevel", "nplv", "npl", "noblephantasm", "noblephantasmlevel", "npRank", "treasuredevice", "treasuredevicelevel", "tdlevel", "tdlv", "td"],
  s1: ["skill1", "s1", "skill1level", "skilllevel1", "sk1", "active1", "skill1lv", "skilla"],
  s2: ["skill2", "s2", "skill2level", "skilllevel2", "sk2", "active2", "skill2lv", "skillb"],
  s3: ["skill3", "s3", "skill3level", "skilllevel3", "sk3", "active3", "skill3lv", "skillc"],
  skills: ["skills", "skilllevels", "skilllv", "activeskills", "skilllist"],
  hp: ["hp", "basehp", "maxhp", "currenthp"], atk: ["atk", "attack", "baseatk", "maxatk", "currentatk"],
  fouHp: ["fouhp", "hpfou", "foushp", "hpfous", "fou_hp"], fouAtk: ["fouatk", "atkfou", "fousatk", "atkfous", "fou_atk"],
  npCard: ["npcard", "card", "nptype", "npcolor", "npcolour", "cardtype"], npTarget: ["nptarget", "target", "nprange"],
  role: ["role"], notes: ["notes", "note", "comment", "comments", "memo"],
  attr: ["attribute", "attr"], align: ["alignment", "align", "alignments"], traits: ["traits", "trait", "tags"],
  wish: ["wishlist", "wish", "wanted", "notsummoned"], owned: ["owned", "have", "summoned", "inroster"]
};
const plKey = (k) => String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const PL_LOOKUP = {}; Object.keys(PL_KEYS).forEach((f) => PL_KEYS[f].forEach((a) => { PL_LOOKUP[plKey(a)] = f; }));
const CLASS_NORM = {}; CLASSES.forEach((c) => { CLASS_NORM[plKey(c)] = c; }); Object.assign(CLASS_NORM, {alterego: "Alter Ego", mooncancer: "Moon Cancer", shielder: "Shielder", shielding: "Shielder", avenger: "Avenger", foreigner: "Foreigner", pretender: "Pretender", beast: "Beast", saber: "Saber", archer: "Archer", lancer: "Lancer", rider: "Rider", caster: "Caster", assassin: "Assassin", berserker: "Berserker", ruler: "Ruler"});
const truthy = (v) => v === true || /^(y|yes|true|1|x|✓|ja|wish|wishlist)$/i.test(String(v == null ? "" : v).trim());
const falsy = (v) => v === false || /^(n|no|false|0|nee)$/i.test(String(v == null ? "" : v).trim());
function plInt(v, lo, hi) { const m = /-?\d+(?:\.\d+)?/.exec(String(v == null ? "" : v)); if (!m) return null; const n = Math.round(Number(m[0])); return clamp(n, lo, hi); }
function plRarity(v) { const t = String(v == null ? "" : v).trim().toUpperCase(); const map = {SSR: 5, SR: 4, R: 3, UC: 2, C: 1}; if (map[t]) return map[t]; const stars = (t.match(/★/g) || []).length; if (stars) return clamp(stars, 1, 5); return plInt(t, 0, 5); }
function plSkill(v) { if (v == null || v === "") return undefined; if (/lock|^-$|^—$/i.test(String(v))) return "Locked"; const n = plInt(v, 0, 10); return n == null ? undefined : (n < 1 ? "Locked" : n); }
function plCard(v) { const t = plKey(v); return t.startsWith("b") ? "Buster" : t.startsWith("a") ? "Arts" : t.startsWith("q") ? "Quick" : null; }
function plTarget(v) { const t = plKey(v); return /aoe|all|area|multi/.test(t) ? "AoE" : /single|st$|^st|one/.test(t) ? "Single Target" : /support|buff|heal|none|nodamage/.test(t) ? "Support" : null; }
// one planner row → the fields this page uses (only the ones the file actually had)
function plMap(row) {
  const o = {}, raw = {};
  Object.keys(row || {}).forEach((k) => { const f = PL_LOOKUP[plKey(k)]; if (f && raw[f] == null) raw[f] = row[k]; });
  ["servant", "info", "base", "data", "detail"].forEach((k) => { const v = row && row[k]; if (v && typeof v === "object" && !Array.isArray(v)) Object.keys(v).forEach((kk) => { const f = PL_LOOKUP[plKey(kk)]; if (f && raw[f] == null) raw[f] = v[kk]; }); });
  if (raw.name == null || !String(typeof raw.name === "object" ? "" : raw.name).trim()) return null;
  o.name = String(raw.name).replace(/\s+/g, " ").trim().slice(0, 120);
  if (raw.cls != null) { const c = CLASS_NORM[plKey(raw.cls)]; if (c) o.cls = c; }
  if (raw.rarity != null) { const r = plRarity(raw.rarity); if (r) o.rarity = r; }
  if (raw.level != null) { const l = plInt(raw.level, 1, 120); if (l != null) o.level = l; }
  if (raw.npLevel != null) { const n = plInt(raw.npLevel, 1, 5); if (n != null) o.npLevel = n; }
  let sk = [undefined, undefined, undefined];
  if (raw.skills != null) {
    const v = raw.skills;
    if (Array.isArray(v)) sk = [0, 1, 2].map((i) => { const x = v[i]; return plSkill(x && typeof x === "object" ? (x.level ?? x.lv ?? x.lvl) : x); });
    else if (typeof v === "object") sk = [0, 1, 2].map((i) => plSkill(v[i + 1] ?? v["s" + (i + 1)] ?? v["skill" + (i + 1)]));
    else sk = String(v).split(/[\/|,;\s]+/).filter(Boolean).slice(0, 3).map(plSkill).concat([undefined, undefined, undefined]).slice(0, 3);
  }
  ["s1", "s2", "s3"].forEach((k, i) => { if (raw[k] != null) { const v = plSkill(raw[k]); if (v !== undefined) sk[i] = v; } });
  if (sk.some((v) => v !== undefined)) o.skills = sk;
  ["hp", "atk"].forEach((k) => { if (raw[k] != null) { const v = plInt(raw[k], 0, 99999); if (v != null) o[k] = v; } });
  ["fouHp", "fouAtk"].forEach((k) => { if (raw[k] != null) { const v = plInt(raw[k], 0, 3000); if (v != null) o[k] = v; } });
  if (raw.npCard != null) { const c = plCard(raw.npCard); if (c) o.npCard = c; }
  if (raw.npTarget != null) { const t = plTarget(raw.npTarget); if (t) o.npTarget = t; }
  if (raw.role != null && ROLES.includes(String(raw.role).trim())) o.role = String(raw.role).trim();
  if (raw.notes != null && String(raw.notes).trim()) o.notes = String(raw.notes).trim().slice(0, 4000);
  if (raw.attr != null) { const a = ATTRS.find((x) => plKey(x) === plKey(raw.attr) || (plKey(raw.attr) === "human" && x === "Man")); if (a) o.attr = a; }
  if (raw.align != null) { const w = String(raw.align).split(/[\s·・,\/|&]+/).map((x) => x.trim()).filter(Boolean); const ord = w.filter((x) => ORDERS.includes(x)), mor = w.filter((x) => MORALS.includes(x)); if (ord.length) o.lawOrder = uniq(ord); if (mor.length) o.moral = uniq(mor); }
  if (raw.traits != null) { const t = (Array.isArray(raw.traits) ? raw.traits : String(raw.traits).split(/[;,|]+/)).map((x) => normTrait(x)).filter(Boolean); if (t.length) o.traits = uniq(t); }
  if (o.attr || o.lawOrder || o.moral || o.traits) o.traitsSet = true;
  if (raw.wish != null) o.wish = truthy(raw.wish); else if (raw.owned != null && falsy(raw.owned)) o.wish = true; else if (raw.owned != null && truthy(raw.owned)) o.wish = false;
  return o;
}
/* CSV: commas or semicolons (Dutch Excel saves with semicolons), quoted cells, line breaks inside quotes */
function csvParse(text) {
  const t = String(text || "").replace(/^﻿/, ""); let first = t.split(/\r?\n/, 1)[0] || "";
  let body = t; if (/^sep=.$/i.test(first.trim())) { body = t.slice(t.indexOf("\n") + 1); first = body.split(/\r?\n/, 1)[0] || ""; }
  const counts = [",", ";", "\t"].map((d) => [d, (first.match(new RegExp(d === "\t" ? "\\t" : d, "g")) || []).length]).sort((a, b) => b[1] - a[1]);
  const D = counts[0][1] ? counts[0][0] : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) { if (c === '"') { if (body[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === D) { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && body[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((x) => String(x).trim()));
  if (clean.length < 2) return [];
  const head = clean[0].map((h) => String(h).trim());
  return clean.slice(1).map((r) => { const o = {}; head.forEach((h, i) => { if (h) o[h] = r[i] == null ? "" : String(r[i]).trim(); }); return o; });
}
// finds the list of servants inside any JSON layout
function plFindList(d) {
  const nameOk = (x) => x && typeof x === "object" && !Array.isArray(x) && plMap(x);
  const good = (arr) => Array.isArray(arr) && arr.length && arr.filter(nameOk).length >= Math.max(1, arr.length * 0.5);
  if (good(d)) return d;
  const seen = new Set(), queue = [d];
  while (queue.length) {
    const v = queue.shift(); if (!v || typeof v !== "object" || seen.has(v)) continue; seen.add(v);
    for (const k of Object.keys(v)) {
      const x = v[k];
      if (good(x)) return x;
      if (x && typeof x === "object" && !Array.isArray(x)) { const vals = Object.values(x); if (vals.length > 1 && good(vals)) return vals; queue.push(x); }
      else if (Array.isArray(x)) x.forEach((y) => { if (y && typeof y === "object") queue.push(y); });
    }
  }
  return null;
}
function plannerFromText(text, filename, parsed) {
  let rows = null, source = /\.csv$/i.test(filename || "") ? "a spreadsheet (CSV)" : "a planner file";
  if (parsed != null) { const list = plFindList(parsed); if (list) rows = list; if (parsed && parsed.app === "spirit-origin-list-planner") source = "a planner list from this page"; }
  else rows = csvParse(text);
  if (!rows || !rows.length) return null;
  const mapped = rows.map(plMap), ok = mapped.filter(Boolean);
  return ok.length ? {rows: ok, skipped: mapped.length - ok.length, source: source + (filename ? " (" + filename + ")" : "")} : null;
}
function plannerPlan(pl) {
  const byName = {}; S.servants.forEach((s) => { byName[normName(s.name)] = s; byName[normName(s.id)] = byName[normName(s.id)] || s; });
  const updates = [], adds = [], seen = new Set();
  pl.rows.forEach((r) => {
    const key = normName(r.name); if (!key || seen.has(key)) return; seen.add(key);
    const s = byName[key];
    if (s) updates.push({id: s.id, name: s.name, patch: r}); else adds.push(r);
  });
  return {kind: "planner", source: pl.source, skipped: pl.skipped, updates: updates, adds: adds};
}
async function applyPlanner(d) {
  let n = 0;
  for (const u of d.updates) {
    const s = S.servants.find((x) => x.id === u.id); if (!s) continue;
    const o = Object.assign({}, s), p = Object.assign({}, u.patch); delete p.name;
    if (p.skills) { const cur = Array.isArray(s.skills) ? s.skills.slice(0, 3) : [1, 1, 1]; o.skills = [0, 1, 2].map((i) => p.skills[i] !== undefined ? p.skills[i] : (cur[i] !== undefined ? cur[i] : 1)); delete p.skills; }
    if (p.wish === false) { delete o.wish; delete p.wish; } else if (p.wish !== true) delete p.wish;
    Object.assign(o, p);
    if (await putDoc("servants", o.id, bodyOf(o))) n++; else return n;
  }
  for (const a of d.adds) {
    const o = Object.assign({rarity: 5, level: 1, skills: [1, 1, 1], skillInfo: [{}, {}, {}]}, a);
    if (o.skills) o.skills = [0, 1, 2].map((i) => o.skills[i] !== undefined ? o.skills[i] : 1);
    if (o.wish !== true) delete o.wish;
    o.id = slug(o.name, S.servants); o.order = nextOrder(S.servants) + n;
    S.servants.push(o);
    if (await putDoc("servants", o.id, bodyOf(o))) n++; else return n;
  }
  return n;
}
/* exports */
const CSV_COLS = [["Name", (s) => s.name], ["Class", (s) => s.cls], ["Rarity", (s) => s.rarity], ["Level", (s) => s.level], ["NP Level", (s) => s.npLevel],
  ["Skill 1", (s) => (s.skills || [])[0]], ["Skill 2", (s) => (s.skills || [])[1]], ["Skill 3", (s) => (s.skills || [])[2]],
  ["HP", (s) => s.hp], ["ATK", (s) => s.atk], ["Fou HP", (s) => s.fouHp], ["Fou ATK", (s) => s.fouAtk], ["NP Card", (s) => s.npCard], ["NP Target", (s) => s.npTarget], ["Role", (s) => s.role],
  ["Attribute", (s) => traitInfo(s).attr], ["Alignment", (s) => { const t = traitInfo(s); return t.order.concat(t.moral).join(" "); }], ["Traits", (s) => traitInfo(s).traits.join("; ")],
  ["Wishlist", (s) => s.wish ? "yes" : "no"], ["Notes", (s) => s.notes]];
function servantsCSV() {
  const D = (1.5).toLocaleString().includes(",") ? ";" : ",";
  const cell = (v) => { const t = v == null ? "" : String(v); return /[",;\t\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  return "﻿" + [CSV_COLS.map((c) => cell(c[0])).join(D)].concat(S.servants.map((s) => CSV_COLS.map((c) => cell(c[1](s))).join(D))).join("\r\n") + "\r\n";
}
function plannerJSON() {
  return JSON.stringify({app: "spirit-origin-list-planner", version: 1, exportedAt: new Date().toISOString(), servants: S.servants.map((s) => {
    const t = traitInfo(s);
    return {name: s.name, class: s.cls || null, rarity: num(s.rarity), level: num(s.level), npLevel: num(s.npLevel), skills: [0, 1, 2].map((i) => { const v = (s.skills || [])[i]; return typeof v === "number" ? v : null; }),
      hp: num(s.hp), atk: num(s.atk), fouHp: num(s.fouHp) || 0, fouAtk: num(s.fouAtk) || 0, npCard: s.npCard || null, npTarget: s.npTarget || null,
      attribute: t.attr || null, alignment: t.order.concat(t.moral).join(" ") || null, traits: t.traits, wishlist: !!s.wish};
  })}, null, 1);
}
async function exportFile(kind) {
  if (!S.downloads) return;
  const day = new Date().toISOString().slice(0, 10);
  const req = kind === "csv" ? {filename: "spirit-origin-list-" + day + ".csv", data: new Blob([servantsCSV()], {type: "text/csv;charset=utf-8"})}
    : {filename: "spirit-origin-list-planner-" + day + ".json", data: new Blob([plannerJSON()], {type: "application/json"})};
  try { const r = await S.downloads.save(req); if (r && r.status === "saved") toast(kind === "csv" ? "Spreadsheet saved to your downloads." : "Planner list saved to your downloads."); }
  catch (e) { if (e && e.code === "declined") return; toast("This view can't save files."); }
}

