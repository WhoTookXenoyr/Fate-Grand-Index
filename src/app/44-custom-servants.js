/* ================= 0.27.0: growth curves for every servant, and servants you make yourself =================
   Growth (the wiki's "Growth Curves"): HP and ATK climb from Lv 1 to the max level along one of six curves, and past
   the max level every servant with that max level follows the same grail curve (five grails from Lv 90 to 100 add about
   1,000 HP and ATK). NA's numbers for the curves are ATLAS_CURVES: per mille of the Lv 1 → max gain at Lv 1 to 120.
   NA doesn't use every curve at every max level, so the missing ones are made here: the same curve's shape stretched to
   that max level, then that max level's grail part.
   Before, only servants matched to NA followed their level; a servant typed in by hand kept whatever HP and ATK were
   typed. Now a hand-made servant can have a growth record ({type, hp: [Lv 1, max], atk: [Lv 1, max]}, set in Edit
   details) and follows its level the same way.
   Custom servants (s.custom, made in the Servant Workshop, 45-workshop.js) keep what they were made from in s.kit and
   never match an NA servant, even with an NA name. calcKitOf(s) is what the damage calculator and the support pickers read:
   the NA record, or the same shape built from the kit (skills with what they do to NP damage, passives, attribute). */

/* ---------- the six curves ---------- */
// ids: NA's curve for max level 60, 65, 70, 80, 90 (★1, ★2 and ★0, ★3, ★4, ★5); 0 where NA has none
const GROWTH = [
  {k: "linear", t: "Linear", d: "An even climb: every level adds the same.", ids: [1, 2, 3, 4, 5]},
  {k: "s", t: "S", d: "Slow at first, fastest in the middle, slow again near the top.", ids: [11, 12, 13, 14, 15]},
  {k: "rs", t: "Reverse S", d: "Quick at first, nearly flat in the middle, quick again near the top.", ids: [6, 7, 8, 9, 10]},
  {k: "ss", t: "Semi S", d: "A gentler S: a soft start and a soft finish.", ids: [0, 27, 28, 29, 30]},
  {k: "srs", t: "Semi Reverse S", d: "A gentler Reverse S: a quick start, a calm middle.", ids: [0, 0, 23, 24, 25]},
  {k: "srsl", t: "Semi Reverse S, then Linear", d: "Reverse S up to halfway, then an even climb.", ids: [0, 0, 0, 0, 35]}
];
const GROWTH_BY = {}; GROWTH.forEach((g) => { GROWTH_BY[g.k] = g; });
const GC_TYPE = {}; GROWTH.forEach((g) => g.ids.forEach((id) => { if (id) GC_TYPE[id] = g.k; }));
const RANK_LV = [60, 65, 70, 80, 90];
const growthRank = (r) => ({0: 2, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5})[num(r)] || 5;
const maxLvOf = (r) => RANK_LV[growthRank(r) - 1];
function synthCurve(g, rank) {
  const from = [5, 4, 3, 2, 1].find((r) => g.ids[r - 1] && ATLAS_CURVES[String(g.ids[r - 1])]);
  const tpl = ATLAS_CURVES[String(g.ids[from - 1])], tm = RANK_LV[from - 1];
  const lin = ATLAS_CURVES[String(GROWTH[0].ids[rank - 1])], M = RANK_LV[rank - 1];
  return lin.map((v, i) => {
    if (i >= M - 1) return v; // 1000 at the max level, then the grail part every servant of this max level shares
    const x = i / (M - 1) * (tm - 1), j = Math.floor(x), f = x - j;
    return Math.round(tpl[j] + (tpl[Math.min(j + 1, tm - 1)] - tpl[j]) * f);
  });
}
// the ATLAS_CURVES key for a curve type at a rarity (made the first time it's needed)
function curveKey(type, r) {
  const g = GROWTH_BY[type] || GROWTH[0], rank = growthRank(r), id = g.ids[rank - 1];
  if (id && ATLAS_CURVES[String(id)]) return String(id);
  const key = "x:" + g.k + ":" + rank;
  if (!ATLAS_CURVES[key]) ATLAS_CURVES[key] = synthCurve(g, rank);
  return key;
}
const growthTypeOf = (gc) => GC_TYPE[num(gc)] || "linear";
// a servant's own growth record, in the shape statAt() reads (null when it has none or it's incomplete)
function growthRec(s) {
  const g = s && s.growth;
  if (!g || typeof g !== "object" || !Array.isArray(g.hp) || !Array.isArray(g.atk)) return null;
  const hp = g.hp.slice(0, 2).map(num), atk = g.atk.slice(0, 2).map(num);
  if (hp.length < 2 || atk.length < 2 || hp.concat(atk).some((v) => v == null || v < 0)) return null;
  return {gc: curveKey(g.type, s.rarity), hp: hp, atk: atk};
}
// a whole curve, for drawing: [[level, hp, atk] …] from Lv 1 to 120
function growthLine(rec) {
  if (!rec) return [];
  const out = [];
  for (let lv = 1; lv <= 120; lv++) out.push([lv, statAt(rec, lv, "hp"), statAt(rec, lv, "atk")]);
  return out;
}

/* ---------- HP and ATK follow the level: NA's numbers, else the servant's own growth ---------- */
const syncStats19 = syncStats;
syncStats = function (s) {
  if (!s || atlasOf(s)) return syncStats19(s);
  const g = growthRec(s), lv = num(s.level);
  if (!g || lv == null || lv < 1) return false;
  let ch = false;
  ["hp", "atk"].forEach((k) => { const v = statAt(g, lv, k); if (v != null && num(s[k]) !== v) { s[k] = v; ch = true; } });
  return ch;
};

/* ---------- custom servants are their own, never an NA servant ---------- */
const atlasOf26 = atlasOf;
atlasOf = function (s) { return s && s.custom ? null : atlasOf26(s); };

/* ---------- what NA says is typical, by class and rarity ---------- */
let NA_PEERS = null;
function naPeers() {
  if (NA_PEERS) return NA_PEERS;
  NA_PEERS = {};
  const add = (k, x) => { (NA_PEERS[k] = NA_PEERS[k] || []).push(x); };
  ATLAS_S.forEach((x) => { if (!x.hp || !x.atk || !x.r) return; add(x.c + "|" + x.r, x); add("*|" + x.r, x); add(x.c + "|*", x); });
  return NA_PEERS;
}
// the NA servants to compare with: the same class and rarity, or every class at that rarity when there are too few
function peersOf(cls, r) {
  const P = naPeers(), a = P[cls + "|" + r] || [];
  return a.length >= 4 ? {list: a, cls: cls} : {list: P["*|" + r] || [], cls: ""};
}
const median = (a) => { const s = a.filter((v) => v != null).sort((x, y) => x - y), n = s.length; return !n ? null : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const modeOf = (a) => { const m = new Map(); let best = null, bn = 0; a.forEach((v) => { if (v == null) return; const n = (m.get(v) || 0) + 1; m.set(v, n); if (n > bn) { bn = n; best = v; } }); return best; };
// share of the list below v (ties count half), 0 to 1
function pctOf(v, arr) {
  if (v == null || !arr.length) return null;
  let below = 0, eq = 0; arr.forEach((x) => { if (x < v) below++; else if (x === v) eq++; });
  return (below + eq / 2) / arr.length;
}
function typicalOf(cls, r) {
  const peers = peersOf(cls, r).list, byCls = naPeers()[cls + "|*"] || [];
  const md = (f) => Math.round(median(peers.map(f)) || 0);
  const rnd = (v, step) => Math.round(v / step) * step;
  return {
    hp: [rnd(md((x) => x.hp[0]), 1), rnd(md((x) => x.hp[1]), 1)], atk: [rnd(md((x) => x.atk[0]), 1), rnd(md((x) => x.atk[1]), 1)],
    growth: modeOf(peers.map((x) => growthTypeOf(x.gc))) || "linear",
    deck: modeOf((byCls.length ? byCls : peers).map((x) => x.d)) || "QAABB",
    card: CARD_OF[modeOf((byCls.length ? byCls : peers).map((x) => x.np && x.np.cd))] || "Buster",
    tg: modeOf(peers.map((x) => x.np && x.np.tg)) || "AoE",
    attr: modeOf((byCls.length ? byCls : peers).map((x) => x.a)) || "Man"
  };
}
// how many NA servants of a class use each deck / curve: [[value, count] …], most first
function countsOf(list, f) { const m = new Map(); list.forEach((x) => { const v = f(x); if (v != null) m.set(v, (m.get(v) || 0) + 1); }); return Array.from(m.entries()).sort((a, b) => b[1] - a[1]); }

/* ---------- what skills and Noble Phantasms can do ---------- */
// targets: how a line names them (whose, whom) and the label on the button
const FX_TG = {
  s: {pos: "your", obj: "yourself", t: "Yourself"},
  o: {pos: "one ally's", obj: "one ally", t: "One ally"},
  a: {pos: "all allies'", obj: "all allies", t: "All allies"},
  x: {pos: "all other allies'", obj: "all other allies", t: "Other allies"},
  e: {pos: "one enemy's", obj: "one enemy", t: "One enemy"},
  E: {pos: "all enemies'", obj: "all enemies", t: "All enemies"}
};
const ALLY_TG = "soax", FOE_TG = "eE";
const FX_GROUPS = [["up", "Attack"], ["np", "NP & stars"], ["def", "Defence"], ["foe", "Against enemies"], ["etc", "Anything else"]];
// k id · t name · g group · tgs targets it can have (tg the usual one; "" for none) · v [Lv 1, Lv 10] (vs for yourself)
// · u unit · l the value's label · d turns · n times · c what it does to NP damage (the calculator's buff kinds:
// a ATK, c card, n NP Strength, p special attack, d DEF down, r card resistance down, f Damage Plus) · card / vs: picks a
// card / what it works against · line: the sentence (P: pos, obj, card, vs)
const FX = [
  {k: "atk", t: "ATK up", g: "up", tgs: ALLY_TG, tg: "a", v: [10, 20], vs: [20, 30], u: "%", l: "ATK Up", d: 3, c: "a", line: (P) => `Increase ${P.pos} ATK`},
  {k: "card", t: "Card up", g: "up", tgs: ALLY_TG, tg: "s", v: [10, 20], vs: [30, 50], u: "%", l: "{card} Up", d: 3, ds: 1, c: "c", card: true, line: (P) => `Increase ${P.pos} ${P.card} Card effectiveness`},
  {k: "np", t: "NP Strength up", g: "up", tgs: ALLY_TG, tg: "a", v: [10, 20], vs: [20, 30], u: "%", l: "NP Strength Up", d: 3, ds: 1, c: "n", line: (P) => `Increase ${P.pos} NP Strength`},
  {k: "crit", t: "Critical damage up", g: "up", tgs: ALLY_TG, tg: "s", v: [20, 40], vs: [50, 100], u: "%", l: "Critical Damage Up", d: 3, ds: 1, line: (P) => `Increase ${P.pos} Critical Strength`},
  {k: "vs", t: "Special attack vs …", g: "up", tgs: ALLY_TG, tg: "s", v: [30, 50], u: "%", l: "Special Attack Up", d: 3, c: "p", vsPick: true, line: (P) => `Increase ${P.pos} attack strength against [${P.vs || "a trait"}]`},
  {k: "dp", t: "Damage Plus", g: "up", tgs: ALLY_TG, tg: "s", v: [200, 500], u: "damage", l: "Damage Plus", d: 3, c: "f", line: (P) => `Apply Damage Plus to ${P.obj}`},
  {k: "pierce", t: "Ignore Invincible", g: "up", tgs: ALLY_TG, tg: "s", v: null, d: 1, line: (P) => `Grant ${P.obj} Ignore Invincible`},
  {k: "charge", t: "NP Charge", g: "np", tgs: ALLY_TG, tg: "s", v: [10, 20], vs: [30, 50], u: "%", l: "NP Charge", d: 0, line: (P) => `Charge ${P.pos} NP gauge`},
  {k: "npturn", t: "NP each turn", g: "np", tgs: ALLY_TG, tg: "s", v: [5, 10], u: "%", l: "NP per Turn", d: 3, line: (P) => `Charge ${P.pos} NP gauge each turn`},
  {k: "gain", t: "NP Gain up", g: "np", tgs: ALLY_TG, tg: "s", v: [20, 30], vs: [30, 50], u: "%", l: "NP Gain Up", d: 3, line: (P) => `Increase ${P.pos} NP Gain`},
  {k: "stars", t: "Gain C. Stars", g: "np", tgs: "", v: [5, 15], u: "stars", l: "C. Stars", d: 0, line: () => `Gain C. Stars`},
  {k: "starturn", t: "C. Stars each turn", g: "np", tgs: "", v: [3, 5], u: "stars", l: "Stars per Turn", d: 3, line: () => `Gain C. Stars each turn`},
  {k: "drop", t: "Star drop rate up", g: "np", tgs: ALLY_TG, tg: "s", v: [30, 50], u: "%", l: "Star Drop Rate Up", d: 3, line: (P) => `Increase ${P.pos} C. Star Drop Rate`},
  {k: "gather", t: "Star gather up", g: "np", tgs: ALLY_TG, tg: "s", v: [300, 600], u: "%", l: "Star Gather Up", d: 3, line: (P) => `Increase ${P.pos} C. Star Gather Rate`},
  {k: "cd", t: "Skill cooldowns −1", g: "np", tgs: ALLY_TG, tg: "a", v: null, d: 0, line: (P) => `Reduce ${P.pos} skill cooldowns by 1`},
  {k: "defup", t: "DEF up", g: "def", tgs: ALLY_TG, tg: "a", v: [10, 20], vs: [20, 30], u: "%", l: "DEF Up", d: 3, line: (P) => `Increase ${P.pos} DEF`},
  {k: "cut", t: "Damage Cut", g: "def", tgs: ALLY_TG, tg: "a", v: [500, 1000], u: "damage", l: "Damage Cut", d: 3, line: (P) => `Apply Damage Cut to ${P.obj}`},
  {k: "invinc", t: "Invincible", g: "def", tgs: ALLY_TG, tg: "s", v: null, d: 3, n: 1, line: (P) => `Grant ${P.obj} Invincible`},
  {k: "evade", t: "Evade", g: "def", tgs: ALLY_TG, tg: "s", v: null, d: 3, n: 1, line: (P) => `Grant ${P.obj} Evade`},
  {k: "guts", t: "Guts", g: "def", tgs: ALLY_TG, tg: "s", v: [1000, 2500], u: "HP", l: "Guts HP", d: 5, n: 1, line: (P) => `Grant ${P.obj} Guts`},
  {k: "taunt", t: "Taunt", g: "def", tgs: ALLY_TG, tg: "s", v: null, d: 1, line: (P) => `Apply Target Focus to ${P.obj}`},
  {k: "heal", t: "Restore HP", g: "def", tgs: ALLY_TG, tg: "a", v: [1000, 3000], u: "HP", l: "Heal", d: 0, line: (P) => `Restore ${P.pos} HP`},
  {k: "maxhp", t: "Max HP up", g: "def", tgs: ALLY_TG, tg: "a", v: [1000, 2000], u: "HP", l: "Max HP Up", d: 3, line: (P) => `Increase ${P.pos} Max HP`},
  {k: "immune", t: "Debuff Immunity", g: "def", tgs: ALLY_TG, tg: "s", v: null, d: 3, n: 1, line: (P) => `Grant ${P.obj} Debuff Immunity`},
  {k: "cleanse", t: "Remove debuffs", g: "def", tgs: ALLY_TG, tg: "a", v: null, d: 0, line: (P) => `Remove ${P.pos} debuffs`},
  {k: "dres", t: "Debuff Resist up", g: "def", tgs: ALLY_TG, tg: "s", v: [20, 40], u: "%", l: "Debuff Resist Up", d: 3, line: (P) => `Increase ${P.pos} Debuff Resist`},
  {k: "defdown", t: "DEF down", g: "foe", tgs: FOE_TG, tg: "e", v: [10, 20], u: "%", l: "DEF Down", d: 3, c: "d", line: (P) => `Decrease ${P.pos} DEF`},
  {k: "resdown", t: "Card resistance down", g: "foe", tgs: FOE_TG, tg: "e", v: [10, 20], u: "%", l: "{card} Resist Down", d: 3, c: "r", card: true, line: (P) => `Decrease ${P.pos} ${P.card} resistance`},
  {k: "atkdown", t: "ATK down", g: "foe", tgs: FOE_TG, tg: "e", v: [10, 20], u: "%", l: "ATK Down", d: 3, line: (P) => `Decrease ${P.pos} ATK`},
  {k: "chargedown", t: "Charge down", g: "foe", tgs: FOE_TG, tg: "e", v: null, d: 0, line: (P) => `Decrease ${P.pos} Charge by 1`},
  {k: "stun", t: "Stun", g: "foe", tgs: FOE_TG, tg: "e", v: [60, 100], u: "%", l: "Stun Chance", d: 1, line: (P) => `Stun ${P.obj}`},
  {k: "charm", t: "Charm", g: "foe", tgs: FOE_TG, tg: "e", v: [60, 100], u: "%", l: "Charm Chance", d: 1, line: (P) => `Charm ${P.obj}`},
  {k: "burn", t: "Burn", g: "foe", tgs: FOE_TG, tg: "e", v: [500, 1000], u: "damage", l: "Burn Damage", d: 5, line: (P) => `Inflict Burn on ${P.obj}`},
  {k: "own", t: "Write your own", g: "etc", tgs: "", v: null, line: (P) => P.txt}
];
const FX_BY = {}; FX.forEach((f) => { FX_BY[f.k] = f; });
// " (1 time, 3 turns)"
function durText(d, n) {
  const p = [];
  if (num(n) > 0) p.push(n + (num(n) === 1 ? " time" : " times"));
  if (num(d) > 0) p.push(d + (num(d) === 1 ? " turn" : " turns"));
  return p.length ? " (" + p.join(", ") + ")" : "";
}
// one effect, written the way NA's skill text reads
function fxLine(f, dflCard) {
  const def = FX_BY[f && f.e]; if (!def) return "";
  const tg = FX_TG[def.tgs ? (def.tgs.includes(f.tg) ? f.tg : def.tg) : "s"] || FX_TG.s;
  const card = CARDS.includes(f.card) ? f.card : dflCard || "Buster";
  const body = def.line({pos: tg.pos, obj: tg.obj, card: card, vs: String(f.vs || "").trim(), txt: String(f.txt || "").trim()});
  return def.k === "own" ? body : body + durText(f.d, f.n);
}
function fxLabel(f, dflCard) {
  const def = FX_BY[f && f.e]; if (!def) return "";
  if (def.k === "own") return String(f.l || "").trim();
  return String(def.l || def.t).replace("{card}", CARDS.includes(f.card) ? f.card : dflCard || "Buster");
}
// a skill value at Lv 1 to 10, the game's way (10% steps up to Lv 9, the full value at Lv 10)
const skVals = (v1, v10) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => i === 9 ? v10 : Math.round((v1 + (v10 - v1) * i / 10) * 100) / 100);

/* ---------- Noble Phantasm damage: the usual numbers per card and target (and the upgraded ones) ---------- */
const NP_DMG_STD = {
  AoE: {Buster: [300, 400, 450, 475, 500], Arts: [450, 600, 675, 712.5, 750], Quick: [600, 800, 900, 950, 1000]},
  "Single Target": {Buster: [600, 800, 900, 950, 1000], Arts: [900, 1200, 1350, 1425, 1500], Quick: [1200, 1600, 1800, 1900, 2000]}
};
const NP_UP = {AoE: {Buster: 100, Arts: 150, Quick: 200}, "Single Target": {Buster: 200, Arts: 300, Quick: 400}};
function npStdDmg(tg, card, up) {
  const t = NP_DMG_STD[tg] && NP_DMG_STD[tg][card]; if (!t) return null;
  const add = up ? NP_UP[tg][card] : 0;
  return t.map((v) => v + add);
}
const SE_STD = [150, 162.5, 175, 187.5, 200];
const pctTxt = (v) => (Math.round(Number(v) * 100) / 100).toLocaleString("en-US") + "%";
const valTxt = (v, u) => u === "%" ? pctTxt(v) : fmt(Math.round(Number(v) * 100) / 100) + (u && u !== "damage" ? " " + u : "");

/* ---------- passives: NA's names and lines; the ones that change damage carry their numbers ---------- */
const PS_RANK_RE = /^(.*?\S)\s+(EX|[A-E](?:\+{1,3}|-)?)$/;
let PS_LIB = null;
function psLib() {
  if (PS_LIB) return PS_LIB;
  const by = new Map();
  ATLAS_S.forEach((x) => (x.ps || []).forEach((p) => {
    const m = PS_RANK_RE.exec(p.n || ""), name = m ? m[1] : p.n, rank = m ? m[2] : "";
    if (!name || /^(?:No Effect|\?\?\?)$/.test(name)) return;
    let o = by.get(name); if (!o) { o = {name: name, e: (p.e || []).slice(), ic: p.ic || "", n: 0, cls: {}, ranks: {}}; by.set(name, o); }
    o.n++; o.cls[x.c] = (o.cls[x.c] || 0) + 1; if (rank) o.ranks[rank] = (o.ranks[rank] || 0) + 1;
  }));
  PS_LIB = Array.from(by.values()).filter((o) => !/^No Effect$/.test(o.e.join(""))).sort((a, b) => b.n - a.n);
  return PS_LIB;
}
const PS_CARD_V = {"EX": 12, "A++": 11.5, "A+": 11, "A": 10, "A-": 9.5, "B++": 9.5, "B+": 9, "B": 8, "B-": 7.5, "C++": 7.5, "C+": 7, "C": 6, "C-": 5.5, "D++": 5.5, "D+": 5, "D": 4, "D-": 3.5, "E++": 3.5, "E+": 3, "E": 2, "E-": 1};
const PS_DIV_V = {"EX": 250, "A++": 230, "A+": 210, "A": 200, "A-": 195, "B+": 185, "B": 175, "B-": 170, "C+": 160, "C": 150, "C-": 145, "D+": 135, "D": 125, "D-": 120, "E+": 110, "E": 100, "E-": 95};
// passives that change NP damage: [pm slot (Buster, Arts, Quick, NP, Damage Plus), value table, unit]
const PS_CALC = {"Riding Skill": [2, PS_CARD_V, "%"], "Territory Creation": [1, PS_CARD_V, "%"], "Madness Enhancement": [0, PS_CARD_V, "%"], "Divinity": [4, PS_DIV_V, ""]};
const PS_RANKS = ["EX", "A++", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "E+", "E", "E-"];
function psValue(p) { const c = PS_CALC[p && p.name], v = c && c[1][String(p.rank || "").toUpperCase()]; return c && v != null ? {slot: c[0], v: v, u: c[2]} : null; }
function psLines(p) {
  const lines = (Array.isArray(p.e) ? p.e : String(p.e || "").split("\n")).map((t) => String(t).trim()).filter(Boolean), v = psValue(p);
  if (v && lines.length) lines[0] = lines[0] + " (" + (v.u === "%" ? "+" + v.v + "%" : "+" + v.v) + ")";
  return lines;
}
// the passives NA gives a class most often, each with its most usual rank
function psFor(cls) {
  return psLib().filter((o) => o.cls[cls]).sort((a, b) => b.cls[cls] - a.cls[cls]).slice(0, 8)
    .map((o) => ({name: o.name, rank: Object.keys(o.ranks).sort((a, b) => o.ranks[b] - o.ranks[a])[0] || "", e: o.e.slice(), ic: o.ic, n: o.cls[cls]}));
}

/* ---------- a kit (what the Workshop edits) → the servant's own fields ---------- */
const DAMAGE_WORDS = {AoE: ["Deal damage to all enemies", "Deal heavy damage to all enemies"], "Single Target": ["Deal heavy damage to one enemy", "Deal severe damage to one enemy"]};
function kitNpLines(np) {
  const card = CARDS.includes(np.card) ? np.card : "Buster", pre = [], post = [], oc = [], rows = [], ocRows = [];
  (np.fx || []).forEach((f) => {
    const line = fxLine(f, card), def = FX_BY[f.e]; if (!def) return;
    const byOc = f.by === "oc";
    if (line) (byOc ? oc : f.when === "pre" ? pre : post).push(line + (f.when === "pre" && !byOc && np.tg !== "Support" ? " before damage" : ""));
    const vals = Array.isArray(f.vals) ? f.vals.slice(0, 5).map(num) : [], lab = fxLabel(f, card);
    if ((def.v || (def.k === "own" && lab)) && f.by !== "fix" && vals.length === 5 && vals.every((v) => v != null)) (byOc ? ocRows : rows).push({label: lab || "Value", vals: vals.map((v) => valTxt(v, def.u))});
  });
  const dmg = np.tg !== "Support" && Array.isArray(np.dmg) && np.dmg.length === 5 && np.dmg.every((v) => num(v) != null);
  const se = dmg && np.se && String(np.se.vs || "").trim() ? np.se : null;
  const main = [];
  if (dmg) main.push(DAMAGE_WORDS[np.tg === "Single Target" ? "Single Target" : "AoE"][np.up ? 1 : 0] + (se ? ", with extra damage against [" + String(se.vs).trim() + "]" : ""));
  if (dmg) rows.unshift({label: "Damage", vals: np.dmg.map((v) => pctTxt(v))});
  if (se) { oc.unshift("Extra damage against [" + String(se.vs).trim() + "] grows with Overcharge"); ocRows.unshift({label: "Special damage", vals: (Array.isArray(se.vals) && se.vals.length === 5 ? se.vals : SE_STD).map((v) => pctTxt(v))}); }
  return {effect: pre.concat(main, post), oc: oc, rows: rows, ocRows: ocRows};
}
function kitDerive(k) {
  const card = CARDS.includes(k.np && k.np.card) ? k.np.card : "Buster", np = k.np || {};
  const skillInfo = [0, 1, 2].map((i) => {
    const sk = (k.sk || [])[i] || {}, fx = (sk.fx || []).filter((f) => FX_BY[f.e]);
    const scales = fx.filter((f) => FX_BY[f.e].v && Array.isArray(f.v) && num(f.v[0]) != null && num(f.v[1]) != null)
      .map((f) => ({label: fxLabel(f, card), v1: num(f.v[0]), v10: num(f.v[1]), unit: FX_BY[f.e].u === "damage" ? "damage" : FX_BY[f.e].u || null}));
    const own = fx.filter((f) => f.e === "own" && String(f.l || "").trim() && num(f.v1) != null && num(f.v10) != null).map((f) => ({label: String(f.l).trim(), v1: num(f.v1), v10: num(f.v10), unit: f.u || null}));
    const sc = scales.concat(own), first = sc[0] || {};
    return {name: String(sk.name || "").trim() || null, rank: String(sk.rank || "").trim() || null, effect: fx.map((f) => fxLine(f, card)).filter(Boolean).join("\n") || null,
      cd: num(sk.cd), scales: sc, label: first.label || null, v1: first.v1 != null ? first.v1 : null, v10: first.v10 != null ? first.v10 : null, unit: first.unit || null};
  });
  const passives = (k.ps || []).filter((p) => p && String(p.name || "").trim()).map((p) => ({name: String(p.name).trim() + (p.rank ? " " + p.rank : ""), effect: psLines(p).join("\n") || null}));
  const L = kitNpLines(np), npName = String(np.name || "").trim();
  const o = {
    cls: k.cls || null, rarity: clamp(num(k.r) || 5, 1, 5), attr: k.attr || null,
    lawOrder: (k.order || []).filter((v) => ORDERS.includes(v)), moral: (k.moral || []).filter((v) => MORALS.includes(v)),
    traits: Array.from(new Set((k.gender && k.gender !== "Unknown" ? [k.gender] : []).concat((k.traits || []).map(normTrait).filter(Boolean)))), traitsSet: true,
    deck: String(k.deck || "QAABB").split("").map((c) => CARD_OF[c] || ""), skillInfo: skillInfo, passives: passives,
    npName: npName || null, npCard: card, npTarget: np.tg || "AoE",
    growth: {type: GROWTH_BY[k.growth] ? k.growth : "linear", hp: (k.hp || []).slice(0, 2).map(num), atk: (k.atk || []).slice(0, 2).map(num)}
  };
  o.npTable = {g: [{name: "", slots: []}], v: [{tab: "", note: "", name: npName, sub: String(np.sub || "").trim(), card: card, base: "", rank: String(np.rank || "").trim(), type: String(np.type || "").trim(),
    hits: np.tg === "Support" ? "" : String(clamp(num(np.hits) || 1, 1, 15)), perHit: "", effect: L.effect.join("\n"), oc: L.oc.join("\n"), rows: L.rows, ocRows: L.ocRows, grp: 0}]};
  return o;
}
// the custom servant in the NA record's shape, for the damage calculator and the support pickers
const KIT_CACHE = new WeakMap();
function customKit(s) {
  if (!s || !s.custom || !s.kit || typeof s.kit !== "object") return null;
  const hit = KIT_CACHE.get(s.kit); if (hit && hit.s === s) return hit.a;
  // (with anything changed on their page since the Workshop last saved them)
  const k = kitNow(s) || s.kit, card = CARDS.includes(k.np && k.np.card) ? k.np.card : "Buster", pm = [0, 0, 0, 0, 0];
  (k.ps || []).forEach((p) => { const v = psValue(p); if (v) pm[v.slot] += v.v; });
  const t = (s.traits || []).slice(), g = t.includes("Female") ? "Female" : t.includes("Male") ? "Male" : "Unknown";
  const a = {n: s.name, c: s.cls, r: num(s.rarity) || 5, a: s.attr || "", g: g, o: (s.lawOrder || []).slice(), m: (s.moral || []).slice(), t: t, pm: pm, custom: true,
    d: String(k.deck || ""), np: {n: (k.np || {}).name || "", tg: (k.np || {}).tg || "", cd: card.charAt(0)},
    sk: [0, 1, 2].map((i) => {
      const sk = (k.sk || [])[i] || {};
      const b = (sk.fx || []).map((f) => {
        const def = FX_BY[f.e]; if (!def || !def.c || !def.v || !Array.isArray(f.v)) return null;
        const v1 = num(f.v[0]), v10 = num(f.v[1]); if (v1 == null || v10 == null) return null;
        const tg = def.tgs.includes(f.tg) ? f.tg : def.tg, row = [def.c, tg === "E" ? "e" : tg, def.card ? (CARDS.includes(f.card) ? f.card : card).charAt(0) : "", skVals(v1, v10)];
        if (def.vsPick) row.push(vsNeed(f.vs));
        return row;
      }).filter(Boolean);
      return {n: [sk.name, sk.rank].filter(Boolean).join(" ") || "Skill " + (i + 1), ic: "", b: b};
    })};
  KIT_CACHE.set(s.kit, {s: s, a: a});
  return a;
}
// what a "special attack against …" works against, in the calculator's words: a class, an attribute, else a trait it can't check
function vsNeed(vs) {
  const v = String(vs || "").trim(); if (!v) return "?cond";
  const c = CLASSES.find((x) => x.toLowerCase() === v.toLowerCase()); if (c) return "-#" + c;
  const at = ATTRS.find((x) => x.toLowerCase() === v.toLowerCase()); if (at) return "-@" + at;
  return "-" + v;
}
function calcKitOf(s) { return atlasOf(s) || customKit(s); }

/* ---------- Edit details: how a hand-made servant grows ---------- */
// (a servant matched to NA follows NA's numbers; the box says so, live, as the name is typed)
const growthHint = `HP and ATK at Lv 1 and at the max level are on the servant's wiki page under Stats, and the growth curve too.`;
function growthFieldHTML(s) {
  const g = (s && s.growth) || {}, hp = Array.isArray(g.hp) ? g.hp : [], atk = Array.isArray(g.atk) ? g.atk : [];
  const opts = GROWTH.map((x) => `<option value="${x.k}"${(g.type || "") === x.k ? " selected" : ""}>${esc(x.t)}</option>`).join("");
  return `<fieldset id="fs-growth" class="fs-growth"><legend>Growth</legend>
    <p class="gr-status" id="gr-status" aria-live="polite"></p>
    <div class="form-grid gr-grid" id="gr-grid">
      ${fld("gr-type", "Growth curve", `<select id="gr-type"><option value="">Not set</option>${opts}</select>`, "full")}
      ${fld("gr-hp1", "HP at Lv 1", inp("gr-hp1", hp[0], "number", 'min="0" inputmode="numeric"'))}
      ${fld("gr-hpm", "HP at max level", inp("gr-hpm", hp[1], "number", 'min="0" inputmode="numeric"'))}
      ${fld("gr-atk1", "ATK at Lv 1", inp("gr-atk1", atk[0], "number", 'min="0" inputmode="numeric"'))}
      ${fld("gr-atkm", "ATK at max level", inp("gr-atkm", atk[1], "number", 'min="0" inputmode="numeric"'))}
      <div class="f full gr-viz" id="gr-viz" aria-hidden="true"></div>
    </div>
    <p class="gr-hint muted">${growthHint} With all four numbers and a curve, HP and ATK above follow the level by themselves, grails included.</p>
  </fieldset>`;
}
function readGrowthForm() {
  const t = val("gr-type"), n = (id) => num(val(id));
  const hp = [n("gr-hp1"), n("gr-hpm")], atk = [n("gr-atk1"), n("gr-atkm")];
  if (!t && hp.concat(atk).every((v) => v == null)) return null;
  return {type: GROWTH_BY[t] ? t : "linear", hp: hp, atk: atk};
}
// the servant the form describes right now (for the NA check and the numbers)
function formGuess() {
  const base = S.editing && S.editing !== "new" ? S.servants.find((x) => x.id === S.editing) : null;
  return {id: base ? base.id : "", name: val("sv-name"), cls: val("sv-cls") || null, rarity: num(val("sv-rarity")) || 5, level: num(val("sv-level")), custom: !!(base && base.custom), growth: readGrowthForm()};
}
function syncGrowthForm(from) {
  const st = document.getElementById("gr-status"), grid = document.getElementById("gr-grid"); if (!st || !grid) return;
  const s = formGuess();
  // an NA match by the link you picked, the servant's own NA number, or the name
  const base = S.editing && S.editing !== "new" ? S.servants.find((x) => x.id === S.editing) : null;
  const a = s.custom ? null : (base && normName(base.name) === normName(s.name) ? atlasOf(base) : s.name ? autoMatch({name: s.name, cls: s.cls, rarity: s.rarity}) : null);
  grid.hidden = !!a; document.querySelector("#fs-growth .gr-hint").hidden = !!a;
  const h = document.getElementById("sv-hp"), k = document.getElementById("sv-atk");
  const follow = (on) => { [h, k].forEach((x) => { if (x) { x.readOnly = on; x.classList.toggle("gr-auto", on); } }); };
  const lv = s.level != null ? clamp(Math.round(s.level), 1, 120) : null;
  if (a) {
    st.innerHTML = `<b>Follows NA.</b> ${esc(s.name)} matches NA's <b>${esc(a.n)}</b>, so HP and ATK follow the level by themselves.`;
    // a new servant starts with NA's numbers for its level (one you have keeps yours until its level changes)
    if (!base && lv) { if (h) h.value = statAt(a, lv, "hp"); if (k) k.value = statAt(a, lv, "atk"); }
    follow(false); drawGrowthViz(null); return;
  }
  const rec = s.growth ? growthRec({growth: s.growth, rarity: s.rarity}) : null, M = maxLvOf(s.rarity);
  if (!rec) { st.innerHTML = s.name ? `<b>${esc(s.name)}</b> isn't in NA's data. Fill in how they grow and HP and ATK follow the level.` : `Not in NA's data? Fill in how the servant grows and HP and ATK follow the level.`; follow(false); drawGrowthViz(null); return; }
  const L = lv || 1, hp = statAt(rec, L, "hp"), atk = statAt(rec, L, "atk");
  st.innerHTML = `At <b>Lv ${L}</b>: HP <b>${fmt(hp)}</b>, ATK <b>${fmt(atk)}</b>${L > M ? ` <span class="gr-grail">grailed past Lv ${M}</span>` : ""}. Base HP and ATK above follow this.`;
  // the stats above take these numbers (they're what a save keeps anyway)
  if (h) h.value = hp; if (k) k.value = atk; follow(true);
  drawGrowthViz(rec, L, M);
}
// a small chart in the form: the HP and ATK lines, the max level and where the level is now
function growthSvg(rec, lv, M, o) {
  o = o || {};
  const W = o.w || 320, H = o.h || 96, P = o.pad || 6, line = growthLine(rec); if (!line.length) return "";
  const top = Math.max(1, ...line.map((r) => Math.max(r[1], r[2])));
  const X = (l) => P + (l - 1) / 119 * (W - 2 * P), Y = (v) => H - P - v / top * (H - 2 * P);
  const path = (i) => "M" + line.map((r) => X(r[0]).toFixed(1) + " " + Y(r[i]).toFixed(1)).join("L");
  const g = `<rect class="gv-grail" x="${X(M).toFixed(1)}" y="${P}" width="${(X(120) - X(M)).toFixed(1)}" height="${H - 2 * P}"/>`;
  const cur = lv ? `<line class="gv-cur" x1="${X(lv).toFixed(1)}" x2="${X(lv).toFixed(1)}" y1="${P}" y2="${H - P}"/><circle class="gv-dot hp" cx="${X(lv).toFixed(1)}" cy="${Y(statAt(rec, lv, "hp")).toFixed(1)}" r="3"/><circle class="gv-dot atk" cx="${X(lv).toFixed(1)}" cy="${Y(statAt(rec, lv, "atk")).toFixed(1)}" r="3"/>` : "";
  return `<svg class="gv" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" focusable="false">${g}<line class="gv-max" x1="${X(M).toFixed(1)}" x2="${X(M).toFixed(1)}" y1="${P}" y2="${H - P}"/><path class="gv-l hp" d="${path(1)}"/><path class="gv-l atk" d="${path(2)}"/>${cur}</svg>`;
}
function drawGrowthViz(rec, lv, M) {
  const v = document.getElementById("gr-viz"); if (!v) return;
  v.innerHTML = rec ? growthSvg(rec, lv, M) + `<span class="gv-key"><i class="hp"></i>HP <i class="atk"></i>ATK <i class="gr"></i>grails, Lv ${M}–120</span>` : "";
}
const servantForm26 = servantForm;
servantForm = function (s) {
  let h = servantForm26.apply(this, arguments);
  // custom servants are made in the Workshop: their skills, NP and growth are best changed there
  if (s && s.custom) h = h.replace(/(<fieldset><legend>Basics<\/legend>)/, `<div class="ws-formnote"><p><b>Made in the Servant Workshop.</b> What you change here goes into the Workshop too. Skills, the Noble Phantasm, cards and growth have more options there.</p><button type="button" class="btn sm" data-action="ws-open" data-id="${esc(s.id)}">Open in the Workshop</button></div>$1`);
  return h.replace(/(<fieldset><legend>Noble Phantasm<\/legend>)/, growthFieldHTML(s) + "$1");
};
const readServantForm26 = readServantForm;
readServantForm = function (base) {
  const o = readServantForm26.apply(this, arguments);
  if (!document.getElementById("fs-growth")) return o;
  const g = readGrowthForm(), grid = document.getElementById("gr-grid");
  if (grid && grid.hidden) {
    // follows NA: nothing of its own to keep; a new servant takes NA's HP and ATK for its level
    const a = !base ? atlasOf(o) : null; if (a && o.level != null) { o.hp = statAt(a, o.level, "hp"); o.atk = statAt(a, o.level, "atk"); }
    return o;
  }
  if (g) o.growth = g; else delete o.growth;
  const rec = growthRec(o); if (rec && o.level != null) { o.hp = statAt(rec, o.level, "hp"); o.atk = statAt(rec, o.level, "atk"); }
  return o;
};
const openServantEditor26 = openServantEditor;
openServantEditor = function () { const r = openServantEditor26.apply(this, arguments); syncGrowthForm("open"); return r; };
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.closest || !t.closest("#servant-form")) return;
  if (/^(?:gr-|sv-name$|sv-cls$|sv-rarity$|sv-level$)/.test(t.id || "")) syncGrowthForm("");
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.closest || !t.closest("#servant-form")) return;
  if (/^(?:gr-|sv-cls$|sv-rarity$)/.test(t.id || "")) syncGrowthForm("");
});

/* ---------- Versus: any NA servant can stand next to yours ---------- */
// at NA's max level, NP1 and skills at 10 (how most people raise them), never saved anywhere
const VNA = new Map();
const isNaId = (id) => /^na:\d+$/.test(String(id || ""));
function vnaGet(id) {
  if (!isNaId(id)) return null;
  if (VNA.has(id)) return VNA.get(id);
  const x = ATLAS_BY_NO.get(num(String(id).slice(3))); if (!x) return null;
  const o = atlasToServant(x); o.id = id; o.wish = false; o.na = x.no; o.order = 1e9;
  VNA.set(id, o); return o;
}
const vsKnown26 = vsKnown;
vsKnown = (id) => vsKnown26(id) || !!vnaGet(id);
const vsPicks27 = vsPicks;
vsPicks = function () {
  const st = vsStored(); if (!st.some(isNaId)) return vsPicks27.apply(this, arguments);
  const ids = [], known = (id) => isNaId(id) ? !!vnaGet(id) : (S.servants.some((s) => s.id === id) || (typeof FSV !== "undefined" && FSV.has(id)));
  st.forEach((id) => { if (ids.length < 3 && !ids.includes(id) && known(id)) ids.push(id); });
  vsPicks27.apply(this, arguments).forEach((id) => { if (ids.length < 2 && !ids.includes(id)) ids.push(id); });
  return ids;
};
const vsHeroHTML27 = vsHeroHTML;
vsHeroHTML = function (s, i, ids) {
  let h = vsHeroHTML27.apply(this, arguments).replace(/<option value="na:[^"]*"[^>]*>[^<]*<\/option>/g, "").replace(/<optgroup label="[^"]*"><\/optgroup>/g, "");
  const na = ids.filter(isNaId).map(vnaGet).filter(Boolean);
  if (na.length) h = h.replace(/(<select class="vs-sel"[^>]*>[\s\S]*?)(<\/select>)/, "$1" + `<optgroup label="NA servants">${na.map((x) => `<option value="${esc(x.id)}"${x.id === s.id ? " selected" : ""}${x.id !== s.id && ids.includes(x.id) ? " disabled" : ""}>${esc(x.name)}</option>`).join("")}</optgroup>` + "$2");
  if (s.na) h = h.replace(/<button type="button" class="vs-name" data-action="goto"[^>]*>([\s\S]*?)<\/button>/, `<button type="button" class="vs-name" data-action="ws-pc" data-no="${s.na}" title="Open in Past Chaldea">$1</button>`)
    .replace(/(<p class="vs-meta">)/, `$1<span class="tag na-tag">NA</span>`);
  if (s.custom) h = h.replace(/(<p class="vs-meta">)/, `$1<span class="tag ws-tag">Custom</span>`);
  return h;
};
const renderVersus27 = renderVersus;
renderVersus = function () {
  const na = Array.from(vsPicks()).filter(isNaId).map(vnaGet).filter(Boolean);
  if (!na.length) { const r = renderVersus27.apply(this, arguments); vsNaBtn(); return r; }
  const keep = S.servants; S.servants = keep.concat(na);
  try { renderVersus27.apply(this, arguments); } finally { S.servants = keep; }
  vsNaBtn();
};
function vsNaBtn() {
  const t = document.querySelector("#versus .vs-tools"); if (!t || t.querySelector("[data-action='vs-na']")) return;
  t.insertAdjacentHTML("beforeend", `<button type="button" class="btn sm" data-action="vs-na">Compare with an NA servant</button>`);
}
function vsWith(a, key) {
  setVsPicks([a, key].filter(Boolean));
  S.tab = "versus"; try { history.pushState({tab: "versus"}, "", "#versus"); } catch (e) {}
  renderChrome(); renderVersus(); window.scrollTo({top: 0});
}
function naPickList() { return ATLAS_S.slice().sort((a, b) => a.n.localeCompare(b.n)).map((a) => ({key: "na:" + a.no, n: a.n, a: a, g: "Every NA servant", m: "Lv " + a.lv + " · NP1 · skills 10/10/10"})); }
// pick an NA servant to stand next to `mine` (or Versus's first pick)
function pickNaFor(mine, title) {
  const cur = vsPicks(), a = mine || (cur[0] && !isNaId(cur[0]) ? cur[0] : (S.servants.find((s) => !s.wish) || S.servants[0] || {}).id);
  openSpk(title || "Compare with an NA servant", "", (key) => { if (key) vsWith(a, key); }, naPickList());
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="vs-na"], [data-action="ws-pc"]'); if (!b) return;
  if (b.dataset.action === "vs-na") { pickNaFor(null); return; }
  const no = num(b.dataset.no); if (no && ATLAS_BY_NO.has(no)) pcShow(no);
});

/* ---------- the servant page: custom servants say so, and open in the Workshop ---------- */
const renderDossier26 = renderDossier;
renderDossier = function (force) {
  const r = renderDossier26.apply(this, arguments);
  const d = document.getElementById("dossier"), s = d && !S.editing ? S.servants.find((v) => v.id === shownId()) : null;
  if (s && s.custom && !d.querySelector("#servant-form")) {
    const meta = d.querySelector(".d-head .d-meta"); if (meta && !meta.querySelector(".ws-tag")) meta.insertAdjacentHTML("beforeend", `<span class="tag ws-tag" title="Made in the Servant Workshop">Custom</span>`);
    const acts = d.querySelector(".d-head-actions"); if (acts && !S.readOnly && !acts.querySelector('[data-action="ws-open"]')) acts.insertAdjacentHTML("afterbegin", `<button class="btn sm ws-open" data-action="ws-open" data-id="${esc(s.id)}" title="Change skills, Noble Phantasm, cards and growth">Workshop</button>`);
  }
  return r;
};
