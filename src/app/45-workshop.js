/* ================= 0.27.0: the Servant Workshop: make a servant of your own =================
   A full-screen window with a live Saint Graph card beside it. Every step starts at what NA's servants of that class
   and rarity usually have (stats, growth curve, deck, Noble Phantasm card, passives), and keeps following the class and
   rarity until you change that part yourself, so a servant can be summoned after any step. Skills and Noble Phantasm
   effects are picked from a list and written the way NA's text reads, with Lv 1 → 10 values the game's way; the ones
   that change NP damage count in the damage calculator. Start from scratch, from any NA servant's kit, from a made-up
   one ("Surprise me") or from a friend's share code. The draft is kept in this browser (spirit-origin-list:v1:workshop)
   until it's summoned or thrown away. Summoning saves one servant (s.custom, s.kit and the usual fields from it), with
   Undo; nothing else on the roster changes. */
const WS_KEY = "spirit-origin-list:v1:workshop";
const WS_STEPS = [
  {k: "start", t: "Start"}, {k: "who", t: "Who they are"}, {k: "stats", t: "Stats & growth"}, {k: "cards", t: "Cards"},
  {k: "np", t: "Noble Phantasm"}, {k: "skills", t: "Skills"}, {k: "ps", t: "Passives"}, {k: "go", t: "Summon"}
];
const W = {open: false, step: 0, k: null, id: null, copy: null, art: null, artNew: [], mode: "", q: "", code: "", sk: 0, add: null, pvLv: null, pvOpen: false, back: null, savedAt: 0, err: "", seen: []};
const NP_RANKS = ["EX", "A++", "A+", "A", "B+", "B", "C+", "C", "D", "E"];
const NP_TYPES = ["Anti-Unit", "Anti-Army", "Anti-Fortress", "Anti-World", "Anti-Country", "Anti-Planet", "Anti-Personnel", "Anti-Team", "Anti-Evil", "Anti-Divine", "Anti-King", "Anti-Dragon", "Barrier", "Fortress"];
const SK_RANKS = ["EX", "A++", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "E"];
const DECKS = ["QAABB", "QQABB", "QQAAB", "QAAAB", "QABBB", "QQQAB"];
const GENDERS = ["Female", "Male", "Unknown"];
const WS_TRAIT_SUGG = ["Humanoid", "Hominidae Servant", "Divine", "Dragon", "King", "Riding", "Weak to Enuma Elish", "Roman", "Fae", "Demonic", "Wild Beast", "Threat to Humanity", "Greek Mythology Male", "Pseudo-Servant", "Super Large"];
const WS_VS = ["Dragon", "Divine", "King", "Demonic", "Evil", "Good", "Male", "Female", "Humanoid", "Roman", "Fae", "Undead", "Threat to Humanity", "Wild Beast", "Riding"].concat(CLASSES, ATTRS);
// classic skills to start from (the values are the usual ones; change anything)
const WS_SK_PRESETS = [
  {name: "Charisma", rank: "B", cd: 7, fx: [{e: "atk", tg: "a", v: [9, 18], d: 3}]},
  {name: "Mana Burst", rank: "A", cd: 7, fx: [{e: "card", tg: "s", card: "Buster", v: [30, 50], d: 1}]},
  {name: "Instinct", rank: "A", cd: 7, fx: [{e: "stars", v: [5, 15]}]},
  {name: "Battle Continuation", rank: "A", cd: 9, fx: [{e: "guts", tg: "s", v: [1000, 2500], d: 5, n: 1}]},
  {name: "Eye of the Mind (True)", rank: "B", cd: 8, fx: [{e: "evade", tg: "s", d: 1, n: 1}, {e: "defup", tg: "s", v: [18, 36], d: 3}]},
  {name: "Golden Rule", rank: "A", cd: 8, fx: [{e: "gain", tg: "s", v: [20, 50], d: 3}]},
  {name: "Mana Charge", rank: "A", cd: 8, fx: [{e: "charge", tg: "s", v: [30, 50]}]},
  {name: "Military Tactics", rank: "B", cd: 8, fx: [{e: "np", tg: "a", v: [8, 16], d: 1}]},
  {name: "Battle Medicine", rank: "A", cd: 7, fx: [{e: "heal", tg: "o", v: [1000, 3000]}, {e: "cleanse", tg: "o"}]},
  {name: "Protection from Arrows", rank: "B", cd: 7, fx: [{e: "evade", tg: "s", d: 5, n: 3}, {e: "defup", tg: "s", v: [10, 20], d: 3}]},
  {name: "Shield of the Oath", rank: "A", cd: 7, fx: [{e: "taunt", tg: "s", d: 1}, {e: "defup", tg: "s", v: [20, 40], d: 1}]},
  {name: "Sage's Counsel", rank: "A", cd: 8, fx: [{e: "charge", tg: "o", v: [20, 30]}, {e: "card", tg: "o", card: "Arts", v: [20, 30], d: 3}]},
  {name: "Hex of Ruin", rank: "B", cd: 7, fx: [{e: "defdown", tg: "E", v: [10, 20], d: 3}]},
  {name: "Divine Blessing", rank: "A", cd: 8, fx: [{e: "invinc", tg: "s", d: 1, n: 1}, {e: "crit", tg: "s", v: [30, 50], d: 3}]}
];
const WS_NAMES = ["Astraea", "Bellatrix", "Caelum", "Dagda", "Eirene", "Fionnuala", "Gwynn", "Hesper", "Isolde", "Jarnsaxa", "Kaede", "Lugh", "Morrighan", "Nemain", "Orielle", "Perun", "Rhiannon", "Sigrun", "Tanith", "Ulrike", "Veles", "Wren", "Ysolde", "Zephyrine", "Aoife", "Branwen", "Ciaran", "Elowen", "Hana", "Ilmatar", "Kalinda", "Lorelei", "Mireille", "Nuada", "Saoirse", "Tamsin"];
const WS_EPI = ["", "", "", " Alter", " (Summer)", " Lily", " of the Silver Lake", " the Unbroken", " of the Last Light", " the Wandering Star", " (Santa)", " of Ten Thousand Swords"];
const WS_NP_A = ["Gate of", "Requiem for", "Spear of", "Crown of", "Garden of", "Last Song of", "Oath of", "Lament of", "Mirror of", "Ninefold", "Hymn of", "Banner of"];
const WS_NP_B = ["the Endless Sky", "Burning Roses", "a Thousand Suns", "the Drowned Moon", "Iron Snow", "the Starless Sea", "the Silver Wolf", "Falling Embers", "the Broken Crown", "the Last Dawn", "Glass Wings"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wsClone = (o) => JSON.parse(JSON.stringify(o));
const five = (a, b) => [0, .25, .5, .75, 1].map((f) => Math.round((a + (b - a) * f) * 10) / 10);

/* ---------- a kit ---------- */
function wsSkill() { return {name: "", rank: "", cd: 7, fx: []}; }
function wsFx(e, tg, card) {
  const def = FX_BY[e] || FX_BY.own, t = def.tgs ? (tg && def.tgs.includes(tg) ? tg : def.tg) : "";
  const f = {e: def.k, tg: t};
  if (def.v) f.v = (t === "s" && def.vs ? def.vs : def.v).slice();
  if (def.d != null) f.d = t === "s" && def.ds != null ? def.ds : def.d;
  if (def.n != null) f.n = def.n;
  if (def.card) f.card = CARDS.includes(card) ? card : "Buster";
  if (def.vsPick) f.vs = "";
  if (def.k === "own") { f.txt = ""; f.l = ""; f.v1 = null; f.v10 = null; f.u = "%"; }
  return f;
}
function wsNpFx(e, card) {
  const f = wsFx(e, null, card), def = FX_BY[f.e];
  f.when = "post"; f.by = def.v ? (f.e === "charge" || f.e === "stars" ? "oc" : "np") : "fix";
  if (def.v) f.vals = five(f.v[0], f.v[1]); delete f.v;
  if (def.k === "own") { f.vals = [null, null, null, null, null]; f.by = "fix"; }
  return f;
}
// the passives a class usually has: those at least 3 in 10 of the class have (up to 3, at least 1)
function wsPsDefault(cls) {
  const all = psFor(cls), size = (naPeers()[cls + "|*"] || []).length || 1;
  const got = all.filter((p) => p.n / size >= 0.3).slice(0, 3);
  return (got.length ? got : all.slice(0, 1)).map((p) => ({name: p.name, rank: p.rank, e: p.e.slice(), ic: p.ic}));
}
function wsBlank(cls, r) {
  cls = cls || "Saber"; r = r || 5;
  const T = typicalOf(cls, r);
  const k = {v: 1, name: "", cls: cls, r: r, attr: T.attr, order: [], moral: [], gender: "Unknown", traits: ["Humanoid"],
    growth: T.growth, hp: T.hp.slice(), atk: T.atk.slice(), feel: {bal: 0, pow: 0}, deck: T.deck,
    np: {name: "", sub: "", rank: "A", type: T.tg === "AoE" ? "Anti-Army" : "Anti-Unit", card: T.card, tg: T.tg, hits: T.tg === "AoE" ? 3 : 5, mode: "std", up: false, dmg: npStdDmg(T.tg, T.card, false), se: null, fx: []},
    sk: [wsSkill(), wsSkill(), wsSkill()], ps: wsPsDefault(cls),
    auto: {stats: true, growth: true, deck: true, card: true, ps: true, attr: true}};
  return k;
}
function wsCopyDefault(k) { return {level: maxLvOf(k.r), np: 1, skills: [10, 10, 10], fouHp: 0, fouAtk: 0, wish: false}; }
// stats from the two sliders: power (weaker … stronger) and balance (more HP … more ATK) around NA's usual numbers
function wsFeelStats(k) {
  const T = typicalOf(k.cls, k.r), f = k.feel || {bal: 0, pow: 0}, pw = 1 + 0.15 * (num(f.pow) || 0), ba = 0.16 * (num(f.bal) || 0);
  k.atk = T.atk.map((v) => Math.round(v * pw * (1 + ba)));
  k.hp = T.hp.map((v) => Math.round(v * pw * (1 - ba)));
}
// the class or rarity changed: every part still at "usual" follows
function wsRetune() {
  const k = W.k, T = typicalOf(k.cls, k.r), A = k.auto || {};
  if (A.stats) wsFeelStats(k);
  if (A.growth) k.growth = T.growth;
  if (A.deck) k.deck = T.deck;
  if (A.attr) k.attr = T.attr;
  if (A.card) { k.np.card = T.card; k.np.tg = T.tg; k.np.type = T.tg === "AoE" ? "Anti-Army" : "Anti-Unit"; k.np.hits = T.tg === "AoE" ? 3 : 5; }
  if (A.ps) k.ps = wsPsDefault(k.cls);
  wsNpDmg();
  if (W.copy && !W.id) W.copy.level = maxLvOf(k.r);
  W.pvLv = null;
}
function wsNpDmg() { const np = W.k.np; if (np.tg === "Support") return; if (np.mode !== "own") np.dmg = npStdDmg(np.tg, np.card, np.mode === "up") || np.dmg; }

/* ---------- starting points ---------- */
function wsRandomKit() {
  const cls = pick(CLASSES.filter((c) => c !== "Beast" && c !== "Shielder")), r = pick([5, 5, 5, 4, 4, 4, 3, 3, 2, 1]);
  const k = wsBlank(cls, r), T = typicalOf(cls, r), peers = peersOf(cls, r).list;
  k.name = pick(WS_NAMES) + pick(WS_EPI);
  k.gender = pick(["Female", "Female", "Male", "Male", "Unknown"]);
  k.traits = ["Humanoid"].concat(Array.from(new Set([pick(WS_TRAIT_SUGG.slice(2)), Math.random() < 0.4 ? pick(WS_TRAIT_SUGG.slice(2)) : ""]))).filter(Boolean);
  k.attr = pick(ATTRS.slice(0, 4)); k.order = [pick(ORDERS)]; k.moral = [pick(["Good", "Good", "Balanced", "Evil", "Evil"])];
  k.feel = {bal: Math.round((Math.random() * 1.4 - 0.7) * 10) / 10, pow: Math.round((Math.random() * 1.2 - 0.5) * 10) / 10}; wsFeelStats(k);
  const curves = countsOf(peers, (x) => growthTypeOf(x.gc)); k.growth = curves.length ? pick(curves.slice(0, 3))[0] : T.growth;
  const decks = countsOf(naPeers()[cls + "|*"] || peers, (x) => x.d); k.deck = decks.length ? pick(decks.slice(0, 3))[0] : T.deck;
  k.np.card = pick(CARDS); k.np.tg = pick(["AoE", "AoE", "Single Target", "Single Target", "Support"]);
  k.np.name = pick(WS_NP_A) + " " + pick(WS_NP_B); k.np.rank = pick(["EX", "A++", "A+", "A", "B+", "B"]);
  k.np.type = k.np.tg === "AoE" ? pick(["Anti-Army", "Anti-Fortress", "Anti-World"]) : k.np.tg === "Support" ? pick(["Barrier", "Anti-Personnel", "Fortress"]) : pick(["Anti-Unit", "Anti-Personnel", "Anti-Divine"]);
  k.np.hits = k.np.tg === "AoE" ? pick([1, 3, 4, 5]) : pick([1, 3, 5, 6, 8]);
  k.np.mode = Math.random() < 0.3 ? "up" : "std"; k.np.up = k.np.mode === "up"; k.np.dmg = npStdDmg(k.np.tg === "Support" ? "AoE" : k.np.tg, k.np.card, k.np.up);
  const npfx = [["defdown", "post"], ["card", "pre"], ["charge", "post"], ["stars", "post"], ["atkdown", "post"], ["np", "pre"]];
  if (k.np.tg === "Support") k.np.fx = [wsNpFx("atk"), wsNpFx("charge"), wsNpFx("defup")].map((f, i) => { f.tg = ["a", "a", "a"][i]; return f; });
  else { const p = pick(npfx), f = wsNpFx(p[0], k.np.card); f.when = p[1]; if (p[0] === "defdown" || p[0] === "atkdown") f.tg = k.np.tg === "AoE" ? "E" : "e"; k.np.fx = [f]; if (Math.random() < 0.35) k.np.se = {vs: pick(WS_VS.slice(0, 8)), vals: SE_STD.slice()}; }
  const sks = WS_SK_PRESETS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  k.sk = sks.map((p) => wsFromPreset(p, k.np.card));
  k.auto = {stats: false, growth: false, deck: false, card: false, ps: true, attr: false};
  k.dice = true;
  return k;
}
function wsFromPreset(p, card) {
  return {name: p.name, rank: p.rank, cd: p.cd, fx: p.fx.map((x) => { const f = wsFx(x.e, x.tg, x.card || card); ["v", "d", "n"].forEach((q) => { if (x[q] != null) f[q] = Array.isArray(x[q]) ? x[q].slice() : x[q]; }); return f; })};
}
// NA's text → the Workshop's effects, as far as the words tell; anything it can't read stays as written
const NA_FX_RULES = [
  [/ignore invincib/i, "pierce"], [/invincib/i, "invinc"], [/\bevade\b|\bevasion\b/i, "evade"], [/\bguts\b/i, "guts"],
  [/target focus|\btaunt/i, "taunt"], [/debuff immunity/i, "immune"], [/remove\w* .*debuffs|remove debuffs/i, "cleanse"],
  [/debuff res/i, "dres"], [/max hp/i, "maxhp"], [/(?:restore|recover)\w* .*\bhp\b/i, "heal"], [/damage cut/i, "cut"], [/damage plus/i, "dp"],
  [/(?:decreas|reduc|drain)\w* .*\bcharge\b|charge by \d/i, "chargedown"],
  [/np gauge each turn|each turn.*\bnp\b|\bnp\b.*each turn/i, "npturn"], [/np gain/i, "gain"], [/np gauge|charge .*\bnp\b/i, "charge"],
  [/stars? each turn/i, "starturn"], [/star drop/i, "drop"], [/star gather|star absorption/i, "gather"], [/c\. stars?\b/i, "stars"],
  [/cooldown/i, "cd"], [/np strength|np damage/i, "np"], [/critical strength|critical damage/i, "crit"],
  [/(?:buster|arts|quick)[^.]*resist/i, "resdown"], [/(?:buster|arts|quick) card effectiveness|(?:buster|arts|quick) (?:card )?(?:up|performance)/i, "card"],
  [/attack strength against|special attack|power against/i, "vs"],
  [/(?:decreas|reduc|lower)\w* .*\bdef\b|\bdef down/i, "defdown"], [/(?:decreas|reduc|lower)\w* .*\batk\b|\batk down/i, "atkdown"],
  [/increas\w* .*\bdef\b|\bdef up/i, "defup"], [/increas\w* .*\batk\b|\batk up/i, "atk"],
  [/\bstun/i, "stun"], [/\bcharm/i, "charm"], [/\bburn/i, "burn"]
];
function naTarget(t, def) {
  const s = t.toLowerCase();
  const tg = /all (?:other )?allies[^.]*except yourself|other allies|allies other than/.test(s) ? "x" : /all allies|party|all members/.test(s) ? "a" : /one ally|an ally/.test(s) ? "o"
    : /all enemies/.test(s) ? "E" : /one enemy|an enemy|target enemy/.test(s) ? "e" : /yourself|\byour\b|\bself\b/.test(s) ? "s" : "";
  return def.tgs ? (def.tgs.includes(tg) ? tg : def.tg) : "";
}
const wordsOf = (t) => String(t || "").toLowerCase().replace(/[^a-z ]+/g, " ").split(" ").filter((w) => w.length > 1 && !["up", "down", "of", "the"].includes(w));
// lines + value rows ([label, v1, v10, unit] or [label, [5 values]]) → effects; leftover rows become values of their own
function naToFx(lines, rows, five) {
  const out = [], used = new Set();
  lines.forEach((line) => {
    const parts = String(line).split(/\s+&\s+/), tail = /( for [^&]+| to [^&]+)$/.exec(line);
    parts.forEach((cl, ci) => {
      const rule = NA_FX_RULES.find((r) => r[0].test(cl));
      if (!rule) { out.push(Object.assign(wsFx("own"), {txt: (cl + (ci < parts.length - 1 && tail ? tail[1] : "")).trim()})); return; }
      const def = FX_BY[rule[1]], f = wsFx(def.k, naTarget(cl + " " + (tail ? tail[1] : line), def));
      const cm = /(buster|arts|quick)/i.exec(cl); if (def.card && cm) f.card = cm[1].charAt(0).toUpperCase() + cm[1].slice(1).toLowerCase();
      const vm = /against \[?([^\]()&]+?)\]?(?:\s*\(|$| for| &)/i.exec(cl); if (def.vsPick && vm) f.vs = vm[1].trim();
      const dm = /\((\d+) times?(?:,\s*(\d+) turns?)?\)|\((\d+) turns?(?:,\s*(\d+) times?)?\)/i.exec(cl);
      if (dm) { if (dm[1]) { f.n = num(dm[1]); f.d = num(dm[2]) || 0; } else { f.d = num(dm[3]); if (dm[4]) f.n = num(dm[4]); } }
      else if (def.d != null) f.d = 0;
      if (def.v) {
        const want = wordsOf(fxLabel(f, f.card)).concat(wordsOf(def.t));
        let bi = -1, best = 0;
        rows.forEach((r, i) => { if (used.has(i)) return; const w = wordsOf(r[0]), sc = w.filter((x) => want.includes(x)).length; if (sc > best) { best = sc; bi = i; } });
        if (bi >= 0) { used.add(bi); const r = rows[bi]; if (five) f.vals = r[1].slice(); else f.v = [r[1], r[2]]; }
        else if (five) f.vals = null;
      }
      out.push(f);
    });
  });
  rows.forEach((r, i) => { if (!used.has(i)) out.push(Object.assign(wsFx("own"), five ? {l: r[0], vals: r[1].slice()} : {l: r[0], v1: r[1], v10: r[2], u: r[3] || ""})); });
  return out;
}
function wsFromNa(no) {
  const x = ATLAS_BY_NO.get(num(no)); if (!x) return null;
  const k = wsBlank(x.c, clamp(x.r || 1, 1, 5)), np = x.np || {}, card = CARD_OF[np.cd] || "Buster";
  k.name = x.n + " (Custom)"; k.attr = x.a || k.attr; k.order = (x.o || []).slice(); k.moral = (x.m || []).slice();
  k.gender = GENDERS.includes(x.g) ? x.g : "Unknown"; k.traits = (x.t || []).filter((t) => t !== "Female" && t !== "Male");
  k.growth = growthTypeOf(x.gc); k.hp = [x.hp[0], x.hp[1]]; k.atk = [x.atk[0], x.atk[1]]; k.feel = null; k.deck = x.d;
  const pc = (v) => { const m = /(-?\d+(?:\.\d+)?)/.exec(String(v || "")); return m ? Number(m[1]) : null; };
  const rows = (np.r || []).map((r) => [r[0], (r[1] || []).slice(0, 5).map(pc)]), oc = (np.o || []).map((r) => [r[0], (r[1] || []).slice(0, 5).map(pc)]);
  const dmgR = rows.find((r) => /^damage/i.test(r[0]) && r[1].every((v) => v != null)), seR = oc.find((r) => /special|extra damage|super/i.test(r[0]) && r[1].every((v) => v != null));
  const tg = /support/i.test(np.tg || "") || !dmgR ? "Support" : /single/i.test(np.tg || "") ? "Single Target" : "AoE";
  const lines = np.e || [], dIdx = lines.findIndex((l) => /\bdeal\w*\b.*damage/i.test(l)), trait = /\[([^\]]{1,40})\]/.exec(lines.concat(np.oc || []).join(" "));
  const std = npStdDmg(tg === "Support" ? "AoE" : tg, card, false), upd = npStdDmg(tg === "Support" ? "AoE" : tg, card, true);
  k.np = {name: np.n || "", sub: np.ru || "", rank: np.k || "", type: np.ty || "", card: card, tg: tg, hits: num(np.h) || 1, mode: "std", up: false, dmg: dmgR ? dmgR[1] : std, se: seR && trait ? {vs: trait[1], vals: seR[1]} : null, fx: []};
  if (dmgR) { k.np.mode = JSON.stringify(dmgR[1]) === JSON.stringify(std) ? "std" : JSON.stringify(dmgR[1]) === JSON.stringify(upd) ? "up" : "own"; k.np.up = k.np.mode === "up" || (std && dmgR[1][0] > std[0]); }
  const pre = lines.filter((l, i) => dIdx >= 0 && i < dIdx), post = lines.filter((l, i) => i > dIdx);
  const npRows = rows.filter((r) => r !== dmgR), ocRows = oc.filter((r) => r !== seR);
  const toNp = (ls, rs, by, when) => naToFx(ls, rs, true).map((f) => { const def = FX_BY[f.e]; const o = Object.assign(f, {when: when, by: f.vals ? by : "fix"}); delete o.v; if (!def.v && f.e !== "own") o.by = "fix"; if (f.e === "own") o.by = o.vals ? by : "fix"; return o; });
  k.np.fx = toNp(pre, [], "np", "pre").concat(toNp(post, npRows, "np", "post"), toNp((np.oc || []).filter((l) => !/special damage|extra damage|super/i.test(l) || !seR), ocRows, "oc", "post"));
  k.sk = [0, 1, 2].map((i) => {
    const s = (x.sk || [])[i]; if (!s) return wsSkill();
    const m = PS_RANK_RE.exec(s.n || "");
    return {name: m ? m[1] : s.n, rank: m ? m[2] : "", cd: num(s.cd) || 7, fx: naToFx(s.e || [], (s.v || []).map((v) => [v[0], v[1], v[2], v[3]]), false)};
  });
  k.ps = (x.ps || []).map((p) => { const m = PS_RANK_RE.exec(p.n || ""); return {name: m ? m[1] : p.n, rank: m ? m[2] : "", e: (p.e || []).slice(), ic: p.ic || ""}; });
  k.auto = {stats: false, growth: false, deck: false, card: false, ps: false, attr: false};
  k.from = x.no;
  return k;
}

/* ---------- a kit that came from anywhere (a share code, an old draft): only what the Workshop knows, in range ---------- */
function wsClean(k0) {
  const k = k0 && typeof k0 === "object" ? k0 : {}, str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]+/g, " ").slice(0, n || 80);
  const nn = (v, a, b, d) => { const x = num(v); return x == null ? d : clamp(x, a, b); };
  const cls = CLASSES.includes(k.cls) ? k.cls : "Saber", r = clamp(Math.round(num(k.r) || 5), 1, 5), b = wsBlank(cls, r);
  const fx = (f, np) => {
    if (!f || !FX_BY[f.e]) return null;
    const def = FX_BY[f.e], o = np ? wsNpFx(def.k, f.card) : wsFx(def.k, f.tg, f.card);
    if (def.tgs) o.tg = def.tgs.includes(f.tg) ? f.tg : def.tg;
    if (!np && def.v && Array.isArray(f.v)) o.v = [nn(f.v[0], -1e6, 1e6, def.v[0]), nn(f.v[1], -1e6, 1e6, def.v[1])];
    if (np) { o.when = f.when === "pre" ? "pre" : "post"; o.by = ["np", "oc", "fix"].includes(f.by) ? f.by : o.by; o.vals = Array.isArray(f.vals) ? [0, 1, 2, 3, 4].map((i) => nn(f.vals[i], -1e6, 1e6, null)) : (o.vals || null); }
    if (def.d != null || f.d != null) o.d = nn(f.d, 0, 99, def.d || 0);
    if (def.n != null || f.n != null) { const t = nn(f.n, 0, 99, def.n || 0); if (t) o.n = t; else delete o.n; }
    if (def.card) o.card = CARDS.includes(f.card) ? f.card : "Buster";
    if (def.vsPick) o.vs = str(f.vs, 40);
    if (def.k === "own") { o.txt = str(f.txt, 200); o.l = str(f.l, 40); if (!np) { o.v1 = nn(f.v1, -1e6, 1e6, null); o.v10 = nn(f.v10, -1e6, 1e6, null); o.u = UNITS.concat([""]).includes(f.u) ? f.u : ""; } }
    return o;
  };
  const np = k.np && typeof k.np === "object" ? k.np : {};
  const o = {v: 1, name: str(k.name, 80), cls: cls, r: r, attr: ATTRS.includes(k.attr) ? k.attr : b.attr,
    order: (Array.isArray(k.order) ? k.order : []).filter((v) => ORDERS.includes(v)), moral: (Array.isArray(k.moral) ? k.moral : []).filter((v) => MORALS.includes(v)),
    gender: GENDERS.includes(k.gender) ? k.gender : "Unknown", traits: Array.from(new Set((Array.isArray(k.traits) ? k.traits : []).map((t) => normTrait(str(t, 40))).filter(Boolean))).slice(0, 30),
    growth: GROWTH_BY[k.growth] ? k.growth : b.growth,
    hp: [nn((k.hp || [])[0], 0, 99999, b.hp[0]), nn((k.hp || [])[1], 0, 99999, b.hp[1])], atk: [nn((k.atk || [])[0], 0, 99999, b.atk[0]), nn((k.atk || [])[1], 0, 99999, b.atk[1])],
    feel: k.feel && typeof k.feel === "object" ? {bal: nn(k.feel.bal, -1, 1, 0), pow: nn(k.feel.pow, -1, 1, 0)} : null,
    deck: DECKS.includes(k.deck) ? k.deck : b.deck,
    np: {name: str(np.name, 80), sub: str(np.sub, 80), rank: str(np.rank, 8), type: str(np.type, 40), card: CARDS.includes(np.card) ? np.card : b.np.card,
      tg: ["AoE", "Single Target", "Support"].includes(np.tg) ? np.tg : b.np.tg, hits: nn(np.hits, 1, 15, 1), mode: ["std", "up", "own"].includes(np.mode) ? np.mode : "std", up: !!np.up,
      dmg: Array.isArray(np.dmg) ? [0, 1, 2, 3, 4].map((i) => nn(np.dmg[i], 0, 1e5, 0)) : b.np.dmg,
      se: np.se && typeof np.se === "object" ? {vs: str(np.se.vs, 40), vals: Array.isArray(np.se.vals) ? [0, 1, 2, 3, 4].map((i) => nn(np.se.vals[i], 0, 1e4, SE_STD[i])) : SE_STD.slice()} : null,
      fx: (Array.isArray(np.fx) ? np.fx : []).slice(0, 10).map((f) => fx(f, true)).filter(Boolean)},
    sk: [0, 1, 2].map((i) => { const s = (Array.isArray(k.sk) ? k.sk : [])[i] || {}; return {name: str(s.name, 60), rank: str(s.rank, 8), cd: nn(s.cd, 1, 20, 7), fx: (Array.isArray(s.fx) ? s.fx : []).slice(0, 10).map((f) => fx(f, false)).filter(Boolean)}; }),
    ps: (Array.isArray(k.ps) ? k.ps : []).slice(0, 8).filter((p) => p && str(p.name).trim()).map((p) => ({name: str(p.name, 60), rank: str(p.rank, 8), e: (Array.isArray(p.e) ? p.e : String(p.e || "").split("\n")).map((t) => str(t, 200)).filter(Boolean).slice(0, 6), ic: /^K:\d{1,6}$/.test(p.ic || "") ? p.ic : ""})),
    auto: Object.assign({stats: false, growth: false, deck: false, card: false, ps: false, attr: false}, k.auto && typeof k.auto === "object" ? Object.fromEntries(Object.entries(k.auto).map((e) => [e[0], !!e[1]])) : {})};
  if (num(k.from)) o.from = num(k.from);
  return o;
}

/* ---------- share codes: a kit as text to paste anywhere (packed small when the browser can) ---------- */
const b64e = (bytes) => { let t = ""; bytes.forEach((c) => { t += String.fromCharCode(c); }); return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const b64d = (s) => { const t = atob(String(s).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(t, (c) => c.charCodeAt(0)); };
async function packBytes(bytes, how) {
  const cs = how === "c" ? new CompressionStream("deflate-raw") : new DecompressionStream("deflate-raw");
  const out = new Response(new Blob([bytes]).stream().pipeThrough(cs));
  return new Uint8Array(await out.arrayBuffer());
}
async function wsCodeOf(k) {
  const c = wsClone(k); delete c.auto; delete c.feel;
  const bytes = new TextEncoder().encode(JSON.stringify({fgi: 1, k: c}));
  if (typeof CompressionStream === "function") { try { return "FGI2." + b64e(await packBytes(bytes, "c")); } catch (e) {} }
  return "FGI1." + b64e(bytes);
}
async function wsReadCode(text) {
  const m = /FGI([12])\.([A-Za-z0-9_-]+)/.exec(String(text || "").replace(/\s+/g, ""));
  if (!m) return null;
  try {
    let bytes = b64d(m[2]);
    if (m[1] === "2") { if (typeof DecompressionStream !== "function") return null; bytes = await packBytes(bytes, "d"); }
    const j = JSON.parse(new TextDecoder().decode(bytes));
    return j && j.fgi === 1 && j.k ? wsClean(j.k) : null;
  } catch (e) { return null; }
}

/* ---------- the draft ---------- */
function wsDraft() { try { const d = JSON.parse(localStorage.getItem(WS_KEY) || "null"); return d && d.k ? d : null; } catch (e) { return null; } }
let wsSaveT = 0;
// nav: only moving between steps, which keeps a draft of a new servant but doesn't start one for a servant you have
function wsSaveSoon(nav) {
  if (nav && W.id && !W.dirty) return;
  if (!nav) { W.dirty = true; if (W.k) delete W.k.dice; }
  clearTimeout(wsSaveT);
  wsSaveT = setTimeout(() => {
    if (!W.k) return;
    try { localStorage.setItem(WS_KEY, JSON.stringify({k: W.k, step: W.step, id: W.id, copy: W.copy, art: W.art, artNew: W.artNew, sk: W.sk, seen: W.seen, t: Date.now()})); W.savedAt = Date.now(); } catch (e) {}
    const el = document.getElementById("ws-saved"); if (el) { el.textContent = "Draft saved"; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  }, 350);
}
function wsDropDraft() {
  try { localStorage.removeItem(WS_KEY); } catch (e) {}
  wsFreeArt(W.artNew);
}
// pictures uploaded for a draft that never became a servant
function wsFreeArt(ids) {
  if (!S.assets || !ids || !ids.length) return;
  const used = new Set(); S.servants.forEach((x) => Object.values(x.art || {}).forEach((v) => used.add(v)));
  ids.forEach((id) => { if (!used.has(id)) Promise.resolve().then(() => S.assets.delete(id)).catch(() => {}); });
}

/* ---------- opening and closing ---------- */
const ws = document.createElement("div");
ws.id = "ws"; ws.className = "ws"; ws.hidden = true; ws.setAttribute("role", "dialog"); ws.setAttribute("aria-modal", "true"); ws.setAttribute("aria-labelledby", "ws-title");
document.body.appendChild(ws);
function wsOpen(opts) {
  opts = opts || {};
  if (S.readOnly) { toast("This page is view-only for you."); return; }
  W.back = document.activeElement; W.add = null; W.mode = ""; W.q = ""; W.code = ""; W.err = ""; W.pvOpen = false; W.dirty = false;
  const d = wsDraft();
  if (opts.id) {
    const s = S.servants.find((x) => x.id === opts.id); if (!s) return;
    if (d && d.id === s.id) { wsLoad(d); toast("Picked up your changes where you left off."); }
    else { W.k = wsClean(s.kit || {}); W.k.name = s.name; W.id = s.id; W.copy = null; W.art = null; W.artNew = []; W.step = 1; W.sk = 0; W.seen = WS_STEPS.map((x, i) => i); }
  } else if (opts.no) { W.k = wsFromNa(opts.no); W.id = null; W.copy = wsCopyDefault(W.k); W.art = null; W.artNew = []; W.step = 1; W.sk = 0; W.seen = WS_STEPS.map((x, i) => i); }
  else if (d && !d.id) { wsLoad(d); W.step = 0; }
  else { W.k = null; W.id = null; W.copy = null; W.art = null; W.artNew = []; W.step = 0; W.sk = 0; }
  W.open = true; W.pvLv = null;
  ws.hidden = false; document.documentElement.classList.add("ws-on");
  const sh = document.querySelector(".shell"); if (sh) sh.inert = true;
  wsRender(true);
  if (opts.no) wsSaveSoon();
  const f = ws.querySelector(W.step === 1 ? "#ws-name" : ".ws-step [data-ws], .ws-step input") || ws.querySelector(".ws-x"); if (f) f.focus({preventScroll: true});
}
function wsLoad(d) {
  W.k = wsClean(d.k); if (d.k && d.k.feel === null) W.k.feel = null;
  W.id = d.id && S.servants.some((x) => x.id === d.id) ? d.id : null;
  W.copy = d.copy && typeof d.copy === "object" ? Object.assign(wsCopyDefault(W.k), d.copy) : (W.id ? null : wsCopyDefault(W.k));
  W.art = typeof d.art === "string" ? d.art : null; W.artNew = Array.isArray(d.artNew) ? d.artNew.filter((x) => typeof x === "string") : [];
  W.step = clamp(num(d.step) || 1, 0, WS_STEPS.length - 1); W.sk = clamp(num(d.sk) || 0, 0, 2);
  W.seen = Array.isArray(d.seen) ? d.seen.filter((x) => typeof x === "number") : [];
  W.dirty = true;
}
function wsClose() {
  if (!W.open) return;
  W.open = false; W.add = null; ws.hidden = true; ws.innerHTML = ""; document.documentElement.classList.remove("ws-on");
  const sh = document.querySelector(".shell"); if (sh) sh.inert = false;
  const b = W.back; W.back = null; if (b && b.isConnected && b.focus) b.focus({preventScroll: true});
}
function wsBegin(k, step, all) {
  if (W.k && !W.id && W.artNew.length) wsFreeArt(W.artNew);
  W.k = k; W.id = null; W.copy = wsCopyDefault(k); W.art = null; W.artNew = []; W.sk = 0; W.mode = ""; W.pvLv = null;
  W.seen = all ? WS_STEPS.map((x, i) => i) : [0];
  wsGo(step == null ? 1 : step);
}
function wsGo(i) {
  W.step = clamp(i, 0, WS_STEPS.length - 1); W.add = null; W.err = ""; W.q = ""; W.mode = "";
  if (!W.seen.includes(W.step)) W.seen.push(W.step);
  if (W.step > 0 && !W.k) W.k = wsBlank(), W.copy = wsCopyDefault(W.k);
  wsRender(true);
  const m = ws.querySelector(".ws-main"); if (m) m.scrollTop = 0;
  const h = ws.querySelector(".ws-step h3"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({preventScroll: true}); }
  wsSaveSoon(true);
}

/* ---------- drawing ---------- */
const stepDone = (k, i) => {
  if (!k || !W.seen.includes(i)) return false;
  const st = WS_STEPS[i].k;
  if (st === "who") return !!k.name.trim();
  if (st === "stats") return k.hp[1] > 0 && k.atk[1] > 0;
  if (st === "cards") return DECKS.includes(k.deck);
  if (st === "np") return !!k.np.name.trim();
  if (st === "skills") return k.sk.filter((s) => s.fx.length).length === 3;
  if (st === "ps") return k.ps.length > 0;
  return false;
};
function wsRender(full) {
  if (!W.open) return;
  const fk = wsFocusKey();
  const k = W.k, st = WS_STEPS[W.step].k, nm = k && k.name.trim();
  ws.innerHTML = `<div class="ws-veil" aria-hidden="true"></div>
    <div class="ws-frame${k ? " has-k" : ""}" data-step="${st}" tabindex="-1">
      <header class="ws-top">
        <div class="ws-brand"><p class="eyebrow">Servant Workshop</p><h2 id="ws-title">${esc(nm || (W.id ? "Your servant" : "A new servant"))}</h2></div>
        <span class="ws-saved" id="ws-saved" aria-live="polite">${W.savedAt ? "Draft saved" : ""}</span>
        <button type="button" class="ws-x" data-ws="close" aria-label="Close the Workshop (your draft is kept)">×</button>
      </header>
      <nav class="ws-rail" aria-label="Steps"><ol>${WS_STEPS.map((x, i) => `<li><button type="button" data-ws="go" data-i="${i}"${i === W.step ? ' aria-current="step"' : ""}${i > 0 && !k ? " disabled" : ""} class="${stepDone(k, i) ? "done" : ""}"><span class="ws-n">${stepDone(k, i) ? "✓" : i + 1}</span><span class="ws-t">${esc(x.t)}</span></button></li>`).join("")}</ol></nav>
      <main class="ws-main"><section class="ws-step ws-s-${st}" id="ws-step">${wsStepHTML(st)}</section></main>
      ${k ? `<aside class="ws-pv${W.pvOpen ? " open" : ""}" id="ws-pv" aria-label="Preview">${wsCardHTML()}</aside>` : ""}
      <footer class="ws-foot">
        ${W.step > 0 ? `<button type="button" class="btn ghost" data-ws="go" data-i="${W.step - 1}">← Back</button>` : `<span></span>`}
        ${k ? `<button type="button" class="btn ghost ws-pvbtn" data-ws="pv" aria-expanded="${W.pvOpen}">${W.pvOpen ? "Hide card" : "Card"}</button>` : ""}
        <span class="ws-prog" aria-hidden="true"><i style="transform:scaleX(${(W.step / (WS_STEPS.length - 1)).toFixed(3)})"></i></span>
        ${st === "go" || !k ? `<span></span>` : `<button type="button" class="btn primary" data-ws="go" data-i="${W.step + 1}">${esc(WS_STEPS[W.step + 1].t)} →</button>`}
      </footer>
      ${W.add ? wsPaletteHTML() : ""}
    </div>`;
  wsAfter();
  wsRefocus(fk);
}
function wsRenderStep() {
  const el = document.getElementById("ws-step"); if (!el) { wsRender(); return; }
  el.innerHTML = wsStepHTML(WS_STEPS[W.step].k); wsAfter();
}
// the level on the card moved: the numbers, the level tag and the chart follow (the slider itself stays put)
function wsLvLive() {
  if (!W.k) return;
  const pv = document.getElementById("ws-pv"), lv = wsPvLv(), M = maxLvOf(W.k.r), rec = wsRec();
  if (pv) {
    const st = pv.querySelectorAll(".ws-cstats b"); if (st.length === 2 && rec) { st[0].textContent = fmt(statAt(rec, lv, "hp")); st[1].textContent = fmt(statAt(rec, lv, "atk")); }
    const tag = pv.querySelector(".ws-lvtag"); if (tag) tag.innerHTML = "Lv " + lv + (lv > M ? ` <img src="@@asset:grail.webp@@" alt="" class="ws-grail">` : "");
    const r = pv.querySelector("[data-ws-lv]"); if (r) { if (num(r.value) !== lv) r.value = lv; r.style.setProperty("--p", ((lv - 1) / 119 * 100).toFixed(2) + "%"); r.setAttribute("aria-valuetext", "Level " + lv + (lv > M ? ", grailed" : "")); }
  }
  const c = ws.querySelector('[data-live="chart"]'); if (c) c.innerHTML = wsChartHTML();
}
function wsFocusKey() { const a = document.activeElement; if (!a || !ws.contains(a)) return null; return a.getAttribute("data-fk") || (a.id ? "#" + a.id : null); }
function wsRefocus(key) {
  // whatever had focus was drawn again: the same control, else the window itself (so keys still reach it)
  if (!key) { if (!ws.contains(document.activeElement)) { const f = ws.querySelector(".ws-frame"); if (f) f.focus({preventScroll: true}); } return; }
  const el = key[0] === "#" ? ws.querySelector(key) : ws.querySelector(`[data-fk="${CSS.escape(key)}"]`);
  if (el) el.focus({preventScroll: true});
}
// the live parts: the card, the title, the step marks and whatever the step shows that follows what you type
function wsLive() {
  if (!W.open || !W.k) return;
  const t = document.getElementById("ws-title"); if (t) t.textContent = W.k.name.trim() || (W.id ? "Your servant" : "A new servant");
  const pv = document.getElementById("ws-pv"); if (pv) pv.innerHTML = wsCardHTML();
  ws.querySelectorAll(".ws-rail button[data-i]").forEach((b) => { const i = num(b.dataset.i), d = stepDone(W.k, i); b.classList.toggle("done", d); const n = b.querySelector(".ws-n"); if (n) n.textContent = d ? "✓" : i + 1; });
  ws.querySelectorAll("[data-live]").forEach((el) => { const f = WS_LIVE[el.dataset.live]; if (f) el.innerHTML = f(el.dataset); });
  wsAfter();
}
function wsAfter() {
  // the chart: drag (or click) to look at a level (on the box around it, which stays while the chart is redrawn)
  const c = ws.querySelector(".ws-chart");
  if (c && !c._ws) { c._ws = 1; c.addEventListener("pointerdown", wsChartDown); }
}

/* ---------- the card ---------- */
const RTIER = (r) => r >= 4 ? "gold" : r === 3 ? "silver" : "bronze";
function wsPvLv() { return clamp(Math.round(num(W.pvLv) || (W.copy ? num(W.copy.level) : null) || maxLvOf(W.k.r)), 1, 120); }
function wsRec() { return growthRec({growth: {type: W.k.growth, hp: W.k.hp, atk: W.k.atk}, rarity: W.k.r}); }
function wsCardHTML() {
  const k = W.k, r = k.r, lv = wsPvLv(), M = maxLvOf(r), rec = wsRec(), hp = rec ? statAt(rec, lv, "hp") : null, atk = rec ? statAt(rec, lv, "atk") : null;
  const art = W.art ? artSrc(W.art) : (W.id ? (() => { const s = S.servants.find((x) => x.id === W.id), sl = s && iconSlot(s); return sl ? artSrc(artOf(s, sl)) : ""; })() : "");
  const np = k.np, dmg = np.tg !== "Support" && np.dmg ? np.dmg[0] : null, x = EXTRA_ACC[k.cls];
  const sks = k.sk.map((s, i) => { const nm = [s.name, s.rank].filter(Boolean).join(" "); return `<li${s.fx.length ? "" : ' class="empty"'}>${s.fx.length ? icHTML(guessIcon(fxLine(s.fx[0], np.card)) || "") : `<i class="ws-dot" aria-hidden="true"></i>`}<span>${esc(nm || "Skill " + (i + 1))}</span>${s.fx.length ? `<small>CD ${clamp(num(s.cd) || 7, 1, 20) - 2}–${clamp(num(s.cd) || 7, 1, 20)}</small>` : ""}</li>`; }).join("");
  const grails = lv > M ? Math.min(10, lv > 100 ? 5 + Math.ceil((lv - 100) / 2) : Math.ceil((lv - M) / (M >= 90 ? 2 : 5))) : 0;
  return `<div class="ws-card ${RTIER(r)} r${r}${x ? " extra" : ""}"${x ? ` style="--acc: rgb(${x.join(",")})"` : ""}>
    <div class="ws-card-art">
      ${art ? `<img class="ws-art" src="${esc(art)}" alt="" data-art="1">` : CLASS_MARK[k.cls] ? `<img class="ws-art mark" src="${CLASS_MARK[k.cls]}" alt="">` : ""}
      <i class="ws-shine" aria-hidden="true"></i>
      ${CLASS_LOGO[k.cls] ? `<img class="ws-cls" src="${CLASS_LOGO[k.cls]}" alt="${esc(k.cls)}">` : ""}
      <span class="ws-stars" aria-label="${r} stars">${"★".repeat(r)}</span>
      <span class="ws-lvtag">Lv ${lv}${grails ? ` <img src="@@asset:grail.webp@@" alt="" class="ws-grail">` : ""}</span>
    </div>
    <div class="ws-card-body">
      <h3 class="ws-cname">${esc(k.name.trim() || "Nameless")}</h3>
      <p class="ws-cmeta">${esc(k.cls)} · ${esc(ATTR_LABEL[k.attr] || k.attr)}${k.order.length || k.moral.length ? " · " + esc(k.order.concat(k.moral).join(" ")) : ""}</p>
      <div class="ws-cstats"><div><span>HP</span><b>${fmt(hp)}</b></div><div><span>ATK</span><b>${fmt(atk)}</b></div></div>
      <label class="ws-lvrange"><span class="sr">Level on the card</span><input type="range" min="1" max="120" value="${lv}" data-ws-lv style="--m:${((M - 1) / 119 * 100).toFixed(2)}%;--p:${((lv - 1) / 119 * 100).toFixed(2)}%" aria-label="Level on the card" aria-valuetext="Level ${lv}${lv > M ? ", grailed" : ""}"></label>
      <div class="ws-cdeck" aria-label="Deck ${esc(k.deck)}">${k.deck.split("").map((c) => `<img src="${CARD_IMG[CARD_OF[c]]}" alt="">`).join("")}</div>
      <div class="ws-cnp"><img src="${CARD_IMG[np.card]}" alt="${esc(np.card)}"><div><b>${esc(np.name.trim() || "Noble Phantasm")}</b><small>${esc([np.rank, np.tg === "Support" ? "Support" : np.tg, dmg ? pctTxt(dmg) + " at NP1" : ""].filter(Boolean).join(" · "))}</small></div></div>
      <ol class="ws-csk">${sks}</ol>
      ${wsPowerHTML(true)}
    </div>
  </div>`;
}
// how they compare with NA: max ATK, max HP and NP1 damage (no buffs, a neutral enemy), against the same class and rarity
function wsPower() {
  const k = W.k, P = peersOf(k.cls, k.r), list = P.list, who = (P.cls ? "★" + k.r + " " + P.cls + "s" : "★" + k.r + " servants");
  const out = [{k: "atk", t: "ATK", v: k.atk[1], arr: list.map((x) => x.atk[1]), who: who, names: list.map((x) => x.n)}, {k: "hp", t: "HP", v: k.hp[1], arr: list.map((x) => x.hp[1]), who: who, names: list.map((x) => x.n)}];
  if (k.np.tg !== "Support" && k.np.dmg) {
    const pm = [0, 0, 0, 0, 0]; k.ps.forEach((p) => { const v = psValue(p); if (v) pm[v.slot] += v.v; });
    const slot = {Buster: 0, Arts: 1, Quick: 2};
    const dmgOf = (atk, pct, card, cls, pmx) => Math.round(atk * 0.23 * pct / 100 * (NPC_CARD[card] || 1) * (1 + ((pmx || [])[slot[card]] || 0) / 100) * (NPC_CLASS_ATK[cls] || 1) * (1 + ((pmx || [])[3] || 0) / 100) + ((pmx || [])[4] || 0));
    const same = (x) => x.np && x.np.tg === k.np.tg && (x.np.r || []).some((r) => /^damage/i.test(r[0]));
    let peers = list.filter(same); let pw = who;
    if (peers.length < 4) { peers = (naPeers()["*|" + k.r] || []).filter(same); pw = "★" + k.r + " servants"; }
    const npc = (x) => { const r = x.np.r.find((q) => /^damage/i.test(q[0])), m = /(\d+(?:\.\d+)?)/.exec(String(r[1][0])); return m ? dmgOf(x.atk[1], Number(m[1]), CARD_OF[x.np.cd], x.c, x.pm) : null; };
    const arr = peers.map(npc), ok = arr.map((v, i) => v != null ? i : -1).filter((i) => i >= 0);
    out.push({k: "np", t: "NP1 damage", v: dmgOf(k.atk[1], k.np.dmg[0], k.np.card, k.cls, pm), arr: ok.map((i) => arr[i]), who: pw + " with " + (k.np.tg === "AoE" ? "AoE" : "single-target") + " NPs", names: ok.map((i) => peers[i].n)});
  }
  return out;
}
function pctWords(p) { return p == null ? "" : p >= 0.97 ? "Stronger than all but a few" : p <= 0.03 ? "Weaker than nearly all" : "Higher than " + Math.round(p * 100) + "%"; }
function wsPowerHTML(small) {
  return `<div class="ws-power${small ? " sm" : ""}">${wsPower().map((m) => {
    const p = pctOf(m.v, m.arr), lo = Math.min(m.v, ...m.arr), hi = Math.max(m.v, ...m.arr), X = (v) => hi > lo ? (v - lo) / (hi - lo) * 100 : 50;
    const ticks = small ? "" : m.arr.map((v, i) => `<i style="left:${X(v).toFixed(1)}%" title="${esc(m.names[i] + ": " + fmt(v))}"></i>`).join("");
    return `<div class="ws-meter k-${m.k}"><div class="ws-mh"><span>${esc(m.t)}${small ? "" : " at max level"}</span><b>${fmt(m.v)}</b></div>
      <div class="ws-strip" role="img" aria-label="${esc(m.t + ": " + pctWords(p) + " of " + m.who)}">${ticks}<span class="ws-bar" style="transform:scaleX(${(X(m.v) / 100).toFixed(3)})"></span><b class="you" style="left:${X(m.v).toFixed(1)}%"></b></div>
      ${small ? "" : `<p class="ws-mp">${esc(pctWords(p))} of ${esc(m.who)} (${m.arr.length})</p>`}</div>`;
  }).join("")}</div>`;
}

/* ---------- the steps ---------- */
function wsStepHTML(st) {
  if (st === "start") return wsStartHTML();
  return ({who: wsWhoHTML, stats: wsStatsHTML, cards: wsCardsHTML, np: wsNpHTML, skills: wsSkillsHTML, ps: wsPsHTML, go: wsGoHTML})[st]();
}
const seg = (path, opts, cur, label, cls) => `<div class="ws-seg${cls ? " " + cls : ""}" role="group" aria-label="${esc(label)}">${opts.map((o) => { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return `<button type="button" data-ws="set" data-p="${path}" data-v="${esc(v)}" aria-pressed="${String(v) === String(cur)}" data-fk="${esc(path + "=" + v)}">${t}</button>`; }).join("")}</div>`;
const togs = (path, opts, cur, label) => `<div class="ws-seg multi" role="group" aria-label="${esc(label)}">${opts.map((v) => `<button type="button" data-ws="tog" data-p="${path}" data-v="${esc(v)}" aria-pressed="${(cur || []).includes(v)}" data-fk="${esc(path + "~" + v)}">${esc(v)}</button>`).join("")}</div>`;
const autoTag = (on, what) => on ? `<span class="ws-auto" title="Follows the class and rarity until you change it">usual for ${esc(what)}</span>` : "";
function wsStartHTML() {
  const d = wsDraft(), cur = W.k;
  const tile = (act, ic, t, p) => `<button type="button" class="ws-tile${W.mode === act ? " on" : ""}" data-ws="${act}" aria-expanded="${W.mode === act}"><span class="ws-tic" aria-hidden="true">${ic}</span><b>${t}</b><span>${p}</span></button>`;
  let more = "";
  if (W.mode === "na") {
    const q = nick(W.q), words = q.split(" ").filter(Boolean);
    const hits = ATLAS_S.filter((x) => !words.length || words.every((w) => (" " + NICK_N.get(x.no) + " " + nname(x.c) + " ").includes(w))).slice(0, words.length ? 30 : 18);
    more = `<div class="ws-pane"><label class="ws-lab" for="ws-naq">Find an NA servant</label><input id="ws-naq" type="search" class="field-input" data-ws-q value="${esc(W.q)}" placeholder="Name or class: Castoria, Skadi, Berserker…" autocomplete="off">
      <ul class="pc-grid ws-nagrid">${hits.map((x) => `<li><button type="button" class="pc-card r${clamp(x.r || 1, 1, 5)}" data-ws="from-na" data-no="${x.no}" title="${esc(x.n)}" aria-label="${esc(x.n)}, ${esc(x.c)}"><span class="pc-face">${x.f ? `<img src="${esc(aimg(x.f))}" alt="" loading="lazy">` : ""}${CLASS_LOGO[x.c] ? `<img class="pc-cls" src="${CLASS_LOGO[x.c]}" alt="">` : ""}</span><span class="pc-n">${esc(x.n)}</span><span class="pc-m">${esc(x.c)} · ${"★".repeat(x.r || 0)}</span></button></li>`).join("")}</ul>
      ${hits.length ? "" : `<p class="tr-none">No NA servant matches that.</p>`}</div>`;
  } else if (W.mode === "code") {
    more = `<div class="ws-pane"><label class="ws-lab" for="ws-code">Paste the share code</label><textarea id="ws-code" rows="3" data-ws-code placeholder="FGI2.…" spellcheck="false">${esc(W.code)}</textarea>
      <div class="ws-row"><button type="button" class="btn primary" data-ws="code-go">Open it</button>${W.err ? `<p class="form-error">${esc(W.err)}</p>` : ""}</div></div>`;
  } else if (W.mode === "blank") {
    more = `<div class="ws-pane"><p class="ws-lab">Pick a class, then a rarity (both can change later)</p>${wsClassGrid(W.blankCls || "Saber", "blank-cls")}
      <div class="ws-row">${[5, 4, 3, 2, 1].map((r) => `<button type="button" class="ws-rar" data-ws="blank-go" data-r="${r}"><span class="stars">${"★".repeat(r)}</span><small>max Lv ${maxLvOf(r)}</small></button>`).join("")}</div></div>`;
  }
  const cont = d && d.k ? `<div class="ws-draft"><p><b>Your draft:</b> ${esc((d.k.name || "").trim() || "a servant with no name yet")}${d.k.cls ? " · " + esc(d.k.cls) + " " + "★".repeat(clamp(num(d.k.r) || 0, 0, 5)) : ""}${d.id ? " (changes to a servant you have)" : ""}</p><span><button type="button" class="btn primary sm" data-ws="draft-go">Continue</button><button type="button" class="btn ghost sm" data-ws="draft-drop">Throw it away</button></span></div>` : "";
  return `<div class="ws-hero"><h3>Make a servant of your own</h3><p>Each step starts at what NA's servants of the class and rarity usually have, so you can summon them after any step. The card on the side shows them as you go.</p></div>
    ${cont}
    <div class="ws-tiles">
      ${tile("blank", "＋", "From scratch", "Pick a class and rarity. Stats, cards and passives start at the usual ones.")}
      ${tile("na", "⟳", "From a real servant", "Start from any NA servant's kit and make it your own.")}
      ${tile("dice", "⚄", "Surprise me", "A whole servant made up on the spot: name, NP, skills and all.")}
      ${tile("code", "⌘", "From a share code", "A friend made one? Paste their code here.")}
    </div>${more}`;
}
function wsClassGrid(cur, act) {
  return `<div class="ws-classes" role="group" aria-label="Class">${CLASSES.map((c) => `<button type="button" class="ws-clsb" data-ws="${act}" data-v="${esc(c)}" aria-pressed="${c === cur}" data-fk="${esc(act + "=" + c)}">${CLASS_LOGO[c] ? `<img src="${CLASS_LOGO[c]}" alt="">` : ""}<span>${esc(c)}</span></button>`).join("")}</div>`;
}
function wsWhoHTML() {
  const k = W.k, T = typicalOf(k.cls, k.r), trs = Array.from(new Set(COMMON_TRAITS.concat(Array.from(naTraits())))).sort();
  const sugg = WS_TRAIT_SUGG.filter((t) => !k.traits.includes(t)).slice(0, 9);
  return `<h3>Who they are</h3>
    <div class="ws-namebox"><label class="ws-lab" for="ws-name">Name</label><div class="ws-row"><input id="ws-name" class="ws-bigname" type="text" data-wk="name" value="${esc(k.name)}" maxlength="80" placeholder="Their true name" autocomplete="off" spellcheck="false"><button type="button" class="btn ghost ws-dice" data-ws="dice-name" title="A random name" aria-label="A random name">⚄</button></div>${W.err ? `<p class="form-error">${esc(W.err)}</p>` : ""}</div>
    <div class="ws-field"><p class="ws-lab">Class</p>${wsClassGrid(k.cls, "cls")}</div>
    <div class="ws-field"><p class="ws-lab">Rarity <small class="muted">sets the max level, and the NA servants they're measured against</small></p><div class="ws-row ws-rars">${[1, 2, 3, 4, 5].map((r) => `<button type="button" class="ws-rar${r === k.r ? " on" : ""}" data-ws="set" data-p="r" data-v="${r}" data-t="num" aria-pressed="${r === k.r}" data-fk="r=${r}"><span class="stars">${"★".repeat(r)}</span><small>max Lv ${maxLvOf(r)}</small></button>`).join("")}</div></div>
    <div class="ws-grid2">
      <div class="ws-field"><p class="ws-lab">Attribute ${autoTag(k.auto.attr, k.cls + "s")}</p>${seg("attr", ATTRS.map((a) => [a, esc(a) + (a === T.attr ? `<i class="ws-usual" title="Most ${esc(k.cls)}s"></i>` : "")]), k.attr, "Attribute")}</div>
      <div class="ws-field"><p class="ws-lab">Gender</p>${seg("gender", GENDERS, k.gender, "Gender")}</div>
      <div class="ws-field"><p class="ws-lab">Alignment</p>${togs("order", ORDERS, k.order, "Order")}${togs("moral", MORALS, k.moral, "Morality")}</div>
      <div class="ws-field"><p class="ws-lab">Traits <small class="muted">what "special attack against …" looks for</small></p>
        <div class="ws-chips">${k.traits.map((t, i) => `<span class="ws-chip">${esc(t)}<button type="button" data-ws="trait-del" data-i="${i}" aria-label="Remove ${esc(t)}">×</button></span>`).join("") || `<span class="muted">None yet</span>`}</div>
        <div class="ws-row"><input id="ws-trait" type="text" list="ws-traits" placeholder="Add a trait" autocomplete="off"><button type="button" class="btn sm" data-ws="trait-add">Add</button></div>
        <datalist id="ws-traits">${trs.map((t) => `<option value="${esc(t)}"></option>`).join("")}</datalist>
        ${sugg.length ? `<div class="ws-sugg">${sugg.map((t) => `<button type="button" class="chip" data-ws="trait-quick" data-v="${esc(t)}">+ ${esc(t)}</button>`).join("")}</div>` : ""}</div>
    </div>
    ${W.id ? `<p class="ws-note">Their pictures stay on their page: change them under Ascension art there.</p>` : `<div class="ws-field"><p class="ws-lab">Picture <small class="muted">optional; more stages and costumes can go on their page later</small></p>
      <label class="ws-drop${W.art ? " has" : ""}">${W.art ? `<img src="${esc(artSrc(W.art))}" alt="">` : `<span>${S.assets ? "Drop a picture here or press to choose one" : "Pictures can't be added in this view"}</span>`}<input type="file" accept="image/*" data-ws-file${S.assets ? "" : " disabled"}></label>
      ${W.art ? `<button type="button" class="btn ghost sm" data-ws="art-del">Remove picture</button>` : ""}</div>`}`;
}
function wsStatsHTML() {
  const k = W.k, T = typicalOf(k.cls, k.r), P = peersOf(k.cls, k.r), who = P.cls ? "★" + k.r + " " + P.cls : "★" + k.r;
  const curves = countsOf(P.list, (x) => growthTypeOf(x.gc)), cnt = (t) => (curves.find((c) => c[0] === t) || [0, 0])[1];
  const f = k.feel, M = maxLvOf(k.r);
  const box = (path, lab) => `<label class="ws-num"><span>${lab}</span><input type="number" min="0" max="99999" inputmode="numeric" data-wk="${path}" data-t="num" value="${esc(num(path.split(".").reduce((o, p) => o[p], k)))}"></label>`;
  return `<h3>Stats & growth</h3>
    <p class="ws-lede">A usual ${esc(who)} has <b>${fmt(T.hp[0])} → ${fmt(T.hp[1])} HP</b> and <b>${fmt(T.atk[0])} → ${fmt(T.atk[1])} ATK</b> from Lv 1 to Lv ${M}. ${k.auto.stats ? autoTag(true, who + "s") : `<button type="button" class="linkish" data-ws="stats-usual">Go back to the usual numbers</button>`}</p>
    <div class="ws-feel">
      <label class="ws-slider"><span class="ws-sl-l">Weaker</span><input type="range" min="-1" max="1" step="0.1" value="${f ? f.pow : 0}" data-ws-feel="pow" aria-label="Overall strength"><span class="ws-sl-r">Stronger</span></label>
      <label class="ws-slider"><span class="ws-sl-l">More HP</span><input type="range" min="-1" max="1" step="0.1" value="${f ? f.bal : 0}" data-ws-feel="bal" aria-label="HP or ATK"><span class="ws-sl-r">More ATK</span></label>
      ${f ? "" : `<p class="ws-note">You typed your own numbers; moving a slider starts again from the usual ones.</p>`}
    </div>
    <div class="ws-nums">${box("hp.0", "HP at Lv 1")}${box("hp.1", "HP at Lv " + M)}${box("atk.0", "ATK at Lv 1")}${box("atk.1", "ATK at Lv " + M)}</div>
    <div data-live="meters">${wsPowerHTML(false)}</div>
    <div class="ws-field"><p class="ws-lab">Growth curve ${autoTag(k.auto.growth, who + "s")} <small class="muted">how HP and ATK climb from Lv 1 to ${M}; grails past that are the same for everyone</small></p>
      <div class="ws-curves" role="group" aria-label="Growth curve">${GROWTH.map((g) => `<button type="button" class="ws-curve" data-ws="set" data-p="growth" data-v="${g.k}" aria-pressed="${k.growth === g.k}" data-fk="growth=${g.k}">${wsCurveSvg(g.k, k.r)}<b>${esc(g.t)}</b><span>${esc(g.d)}</span><small>${cnt(g.k) ? cnt(g.k) + " of " + P.list.length + " " + esc(who) + "s" : "&nbsp;"}</small></button>`).join("")}</div></div>
    <div class="ws-chart" data-live="chart">${wsChartHTML()}</div>`;
}
function wsCurveSvg(type, r) {
  const c = ATLAS_CURVES[curveKey(type, r)], M = maxLvOf(r), W0 = 84, H0 = 40;
  const pts = []; for (let l = 1; l <= M; l += Math.max(1, Math.round(M / 30))) pts.push([l, c[l - 1]]); pts.push([M, 1000]);
  return `<svg viewBox="0 0 ${W0} ${H0}" class="ws-csvg" aria-hidden="true" focusable="false"><path d="M${pts.map((p) => ((p[0] - 1) / (M - 1) * (W0 - 4) + 2).toFixed(1) + " " + (H0 - 2 - p[1] / 1000 * (H0 - 4)).toFixed(1)).join("L")}"/></svg>`;
}
function wsChartHTML() {
  const k = W.k, rec = wsRec(), M = maxLvOf(k.r), lv = wsPvLv(); if (!rec) return "";
  const T = typicalOf(k.cls, k.r), trec = growthRec({growth: {type: k.growth, hp: T.hp, atk: T.atk}, rarity: k.r});
  const Wd = 640, H = 230, L = 46, R = 12, Tp = 14, B = 28, line = growthLine(rec), tl = growthLine(trec);
  const top = Math.max(...line.map((r) => Math.max(r[1], r[2])), ...tl.map((r) => Math.max(r[1], r[2]))) * 1.04;
  const X = (l) => L + (l - 1) / 119 * (Wd - L - R), Y = (v) => H - B - v / top * (H - Tp - B);
  const path = (ln, i) => "M" + ln.map((r) => X(r[0]).toFixed(1) + " " + Y(r[i]).toFixed(1)).join("L");
  const step = [500, 1000, 2000, 2500, 5000, 10000].find((x) => top / x <= 5) || 20000;
  const grid = Array.from({length: Math.floor(top / step)}, (_, i) => (i + 1) * step).map((v) => { return `<line class="g" x1="${L}" x2="${Wd - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="gy" x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}">${fmt(v)}</text>`; }).join("");
  const xs = [1, M, 100, 120].filter((v, i, a) => a.indexOf(v) === i).map((l) => `<text class="gx" x="${X(l).toFixed(1)}" y="${H - 8}">${l === 1 ? "Lv 1" : l}</text>`).join("");
  const hp = statAt(rec, lv, "hp"), atk = statAt(rec, lv, "atk");
  return `<svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="HP and ATK from Lv 1 to 120. At Lv ${lv}: HP ${fmt(hp)}, ATK ${fmt(atk)}." focusable="false">
      <rect class="grz" x="${X(M).toFixed(1)}" y="${Tp}" width="${(X(120) - X(M)).toFixed(1)}" height="${H - Tp - B}"/><text class="grt" x="${((X(M) + X(120)) / 2).toFixed(1)}" y="${Tp + 14}">grails</text>
      ${grid}${xs}
      <path class="ty hp" d="${path(tl, 1)}"/><path class="ty atk" d="${path(tl, 2)}"/>
      <path class="ln hp" d="${path(line, 1)}"/><path class="ln atk" d="${path(line, 2)}"/>
      <line class="cur" x1="${X(lv).toFixed(1)}" x2="${X(lv).toFixed(1)}" y1="${Tp}" y2="${H - B}"/>
      <circle class="dot hp" cx="${X(lv).toFixed(1)}" cy="${Y(hp).toFixed(1)}" r="4.5"/><circle class="dot atk" cx="${X(lv).toFixed(1)}" cy="${Y(atk).toFixed(1)}" r="4.5"/>
      <rect class="hit" x="${L}" y="0" width="${Wd - L - R}" height="${H}"/>
    </svg>
    <p class="ws-ckey"><span><i class="hp"></i>HP <b>${fmt(hp)}</b></span><span><i class="atk"></i>ATK <b>${fmt(atk)}</b></span><span class="muted">at Lv ${lv}${lv > M ? " (grailed)" : ""} · dashed: a usual ${esc(k.cls)} · drag across to look at any level</span></p>`;
}
function wsChartDown(e) {
  const box = e.currentTarget; if (!e.target.closest || !e.target.closest("svg")) return;
  const move = (ev) => {
    const svg = box.querySelector("svg"); if (!svg) return;
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, x = (ev.clientX - r.left) / r.width * vb.width;
    W.pvLv = clamp(Math.round((x - 46) / (vb.width - 58) * 119 + 1), 1, 120); wsLvLive();
  };
  e.preventDefault();
  try { box.setPointerCapture(e.pointerId); } catch (er) {}
  move(e);
  const up = () => { box.removeEventListener("pointermove", move); box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up); };
  box.addEventListener("pointermove", move); box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
}
function wsCardsHTML() {
  const k = W.k, list = naPeers()[k.cls + "|*"] || [], decks = countsOf(list, (x) => x.d), dn = (d) => (decks.find((x) => x[0] === d) || [0, 0])[1];
  const cards = countsOf(list, (x) => CARD_OF[x.np && x.np.cd]), cn = (c) => (cards.find((x) => x[0] === c) || [0, 0])[1];
  return `<h3>Command cards</h3>
    <div class="ws-field"><p class="ws-lab">Deck ${autoTag(k.auto.deck, k.cls + "s")} <small class="muted">the five cards they bring to every turn</small></p>
      <div class="ws-decks" role="group" aria-label="Deck">${DECKS.map((d) => `<button type="button" class="ws-deck" data-ws="set" data-p="deck" data-v="${d}" aria-pressed="${k.deck === d}" data-fk="deck=${d}"><span class="ws-dcards">${d.split("").map((c) => `<img src="${CARD_IMG[CARD_OF[c]]}" alt="">`).join("")}</span><b>${["Quick", "Arts", "Buster"].map((c) => { const n = d.split("").filter((x) => CARD_OF[x] === c).length; return n + " " + c; }).join(" · ")}</b><small>${dn(d) ? dn(d) + " of " + list.length + " " + esc(k.cls) + "s" : "&nbsp;"}</small></button>`).join("")}</div></div>
    <div class="ws-field"><p class="ws-lab">Noble Phantasm card ${autoTag(k.auto.card, k.cls + "s")}</p>
      <div class="ws-npcards" role="group" aria-label="Noble Phantasm card">${CARDS.map((c) => `<button type="button" class="ws-npcard c-${c.toLowerCase()}" data-ws="set" data-p="np.card" data-v="${c}" aria-pressed="${k.np.card === c}" data-fk="np.card=${c}"><img src="${CARD_IMG[c]}" alt=""><b>${c}</b><small>${cn(c) ? cn(c) + " " + esc(k.cls) + "s" : "&nbsp;"}</small></button>`).join("")}</div></div>
    <div class="ws-field"><p class="ws-lab">Who the Noble Phantasm hits</p>${seg("np.tg", [["AoE", "All enemies"], ["Single Target", "One enemy"], ["Support", "Nobody: it's a support NP"]], k.np.tg, "Noble Phantasm target", "big")}</div>
    <p class="ws-note">Damage follows the card and the target: ${k.np.tg === "Support" ? "a support NP deals none." : `${esc(k.np.card)} ${k.np.tg === "AoE" ? "AoE" : "single-target"} starts at ${pctTxt((npStdDmg(k.np.tg, k.np.card, false) || [0])[0])} at NP1. Change it on the next step.`}</p>`;
}
function wsNpHTML() {
  const k = W.k, np = k.np, sup = np.tg === "Support";
  return `<h3>Noble Phantasm</h3>
    <div class="ws-grid2">
      <label class="ws-f"><span class="ws-lab">Name</span><div class="ws-row"><input type="text" data-wk="np.name" value="${esc(np.name)}" maxlength="80" placeholder="e.g. ${esc(WS_NP_A[0] + " " + WS_NP_B[0])}" autocomplete="off"><button type="button" class="btn ghost ws-dice" data-ws="dice-np" title="A random name" aria-label="A random NP name">⚄</button></div></label>
      <label class="ws-f"><span class="ws-lab">Second name or reading <small class="muted">optional</small></span><input type="text" data-wk="np.sub" value="${esc(np.sub)}" maxlength="80" autocomplete="off"></label>
    </div>
    <div class="ws-grid3">
      <div class="ws-field"><p class="ws-lab">Rank</p>${seg("np.rank", NP_RANKS, np.rank, "Rank", "wrap")}</div>
      <label class="ws-f"><span class="ws-lab">Type</span><select data-wk="np.type">${NP_TYPES.concat(np.type && !NP_TYPES.includes(np.type) ? [np.type] : []).map((t) => `<option${t === np.type ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
      ${sup ? "" : `<label class="ws-f"><span class="ws-lab">Hits</span><input type="number" min="1" max="15" data-wk="np.hits" data-t="num" value="${esc(np.hits)}"></label>`}
    </div>
    <p class="ws-note ws-npnote">${esc(np.card)} card · ${sup ? "a support Noble Phantasm" : np.tg === "AoE" ? "hits all enemies" : "hits one enemy"} <button type="button" class="linkish" data-ws="go" data-i="3">change on Cards</button></p>
    ${sup ? "" : `<div class="ws-field"><p class="ws-lab">Damage by NP level</p>
      ${seg("np.mode", [["std", "Standard"], ["up", "Upgraded"], ["own", "My own numbers"]], np.mode, "Damage numbers")}
      <div class="ws-five">${[0, 1, 2, 3, 4].map((i) => `<label><span>NP${i + 1}</span><input type="number" min="0" max="99999" step="0.5" data-wk="np.dmg.${i}" data-t="num" value="${esc(np.dmg[i])}"><i>%</i></label>`).join("")}</div>
      <label class="chk ws-chk"><input type="checkbox" data-ws-se${np.se ? " checked" : ""}> Extra damage against a trait (grows with Overcharge)</label>
      ${np.se ? `<div class="ws-se"><label class="ws-mini wide"><span>Against</span><input type="text" list="ws-vs" data-wk="np.se.vs" value="${esc(np.se.vs)}" placeholder="Dragon, Divine, Saber…" autocomplete="off"></label>
        <div class="ws-five">${[0, 1, 2, 3, 4].map((i) => `<label><span>${(i + 1) * 100}%</span><input type="number" min="100" max="9999" step="0.5" data-wk="np.se.vals.${i}" data-t="num" value="${esc(np.se.vals[i])}"><i>%</i></label>`).join("")}</div></div>` : ""}
    </div>`}
    <div class="ws-field"><p class="ws-lab">${sup ? "What it does" : "What else it does"}</p>
      <ol class="ws-fxs">${np.fx.map((f, i) => wsFxRowHTML(f, "np", 0, i)).join("")}</ol>
      <button type="button" class="btn ws-addfx" data-ws="fx-add" data-w="np">+ Add an effect</button></div>
    <datalist id="ws-vs">${WS_VS.map((v) => `<option value="${esc(v)}"></option>`).join("")}</datalist>
    <div class="ws-field"><p class="ws-lab">On their page it reads</p><div class="ws-nppv" data-live="nppv">${wsNpPvHTML()}</div></div>`;
}
function wsNpPvHTML() {
  const d = kitDerive(W.k), V = d.npTable.v[0], card = V.card;
  const tr = (r, oc) => `<tr${oc ? ' class="oc"' : ""}><th>${esc(r.label)}</th>${r.vals.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`;
  return `<div class="ws-npt c-${card.toLowerCase()}"><div class="ws-npt-h"><img src="${CARD_IMG[card]}" alt=""><div><b>${esc(V.name || "Noble Phantasm")}</b><small>${esc([V.sub, V.rank && "Rank " + V.rank, V.type, W.k.np.tg === "Support" ? "" : V.hits + (V.hits === "1" ? " hit" : " hits")].filter(Boolean).join(" · "))}</small></div></div>
    <div class="effect">${iconLinesHTML({id: "ws-preview"}, V.effect, true) || `<span class="muted">No effects yet.</span>`}</div>
    ${V.rows.length ? `<table class="ws-ntab"><thead><tr><th></th>${[1, 2, 3, 4, 5].map((i) => `<th>NP${i}</th>`).join("")}</tr></thead><tbody>${V.rows.map((r) => tr(r)).join("")}</tbody></table>` : ""}
    ${V.oc ? `<div class="effect oc">${iconLinesHTML({id: "ws-preview"}, V.oc, true)}</div>` : ""}
    ${V.ocRows.length ? `<table class="ws-ntab oc"><thead><tr><th>Overcharge</th>${[1, 2, 3, 4, 5].map((i) => `<th>${i * 100}%</th>`).join("")}</tr></thead><tbody>${V.ocRows.map((r) => tr(r, true)).join("")}</tbody></table>` : ""}</div>`;
}
// one effect, with what can be set on it
function wsFxRowHTML(f, w, si, i) {
  const def = FX_BY[f.e] || FX_BY.own, base = w === "np" ? "np.fx." + i : "sk." + si + ".fx." + i, card = W.k.np.card;
  const line = fxLine(f, card), unit = def.u === "damage" ? "" : def.u === "%" ? "%" : def.u ? " " + def.u : "";
  const ctl = [];
  if (def.tgs) ctl.push(seg(base + ".tg", def.tgs.split("").map((t) => [t, esc(FX_TG[t].t)]), f.tg, "Who it's for", "sm"));
  if (def.card) ctl.push(seg(base + ".card", CARDS, f.card, "Card", "sm"));
  if (def.vsPick) ctl.push(`<label class="ws-mini wide"><span>Against</span><input type="text" list="ws-vs" data-wk="${base}.vs" value="${esc(f.vs || "")}" placeholder="Dragon, Saber, Earth…" autocomplete="off"></label>`);
  if (def.k === "own") ctl.push(`<label class="ws-mini wide"><span>It reads</span><input type="text" data-wk="${base}.txt" value="${esc(f.txt || "")}" maxlength="200" placeholder="Increase your … (3 turns)" autocomplete="off"></label><label class="ws-mini"><span>Value's name</span><input type="text" data-wk="${base}.l" value="${esc(f.l || "")}" maxlength="40" placeholder="optional" autocomplete="off"></label>`);
  if (w === "sk" && def.v) ctl.push(`<span class="ws-lv1">${wsNumIn(base + ".v.0", f.v[0], "Lv 1")}<span class="ws-arrow" aria-hidden="true">→</span>${wsNumIn(base + ".v.1", f.v[1], "Lv 10")}<span class="ws-unit">${esc(unit.trim())}</span></span>`);
  if (w === "sk" && def.k === "own") ctl.push(`<span class="ws-lv1">${wsNumIn(base + ".v1", f.v1, "Lv 1")}<span class="ws-arrow" aria-hidden="true">→</span>${wsNumIn(base + ".v10", f.v10, "Lv 10")}<select data-wk="${base}.u" aria-label="Unit">${["", "%", "HP", "stars", "turns", "times", "damage"].map((u) => `<option value="${u}"${(f.u || "") === u ? " selected" : ""}>${u || "no unit"}</option>`).join("")}</select></span>`);
  if (w === "np") {
    ctl.push(seg(base + ".when", [["pre", "Before damage"], ["post", "After damage"]], f.when, "When", "sm"));
    if (def.v || def.k === "own") ctl.push(seg(base + ".by", [["np", "Grows with NP level"], ["oc", "Grows with Overcharge"], ["fix", "Always the same"]], f.by, "What it grows with", "sm"));
    if ((def.v || def.k === "own") && f.by !== "fix") ctl.push(`<div class="ws-five sm">${[0, 1, 2, 3, 4].map((j) => `<label><span>${f.by === "oc" ? (j + 1) * 100 + "%" : "NP" + (j + 1)}</span><input type="number" step="0.5" data-wk="${base}.vals.${j}" data-t="num" value="${esc((f.vals || [])[j] ?? "")}"><i>${esc(unit.trim())}</i></label>`).join("")}</div>`);
  }
  if (def.d != null && def.d !== 0 || num(f.d) > 0) ctl.push(wsNumIn(base + ".d", f.d, "Turns", "0", "20"));
  if (def.n != null) ctl.push(wsNumIn(base + ".n", f.n, "Times", "0", "20"));
  return `<li class="ws-fx"><span class="ws-fx-ic" data-live="fxic" data-p="${base}">${icHTML(guessIcon(line)) || `<i class="ws-dot"></i>`}</span>
    <div class="ws-fx-main"><div class="ws-fx-top"><button type="button" class="ws-fx-name" data-ws="fx-change" data-w="${w}" data-si="${si}" data-i="${i}" title="Change the effect">${esc(def.t)} ▾</button><span class="ws-fx-line" data-live="fxline" data-p="${base}">${esc(line)}</span></div>
      <div class="ws-fx-ctl">${ctl.join("")}</div></div>
    <span class="ws-fx-ord"><button type="button" data-ws="fx-up" data-w="${w}" data-si="${si}" data-i="${i}" aria-label="Move up"${i ? "" : " disabled"}>↑</button><button type="button" class="ws-fx-x" data-ws="fx-del" data-w="${w}" data-si="${si}" data-i="${i}" aria-label="Remove ${esc(def.t)}">×</button></span></li>`;
}
const wsNumIn = (path, v, lab, min, max) => `<label class="ws-mini"><span>${lab}</span><input type="number" step="any" data-wk="${path}" data-t="num" value="${esc(v ?? "")}"${min != null ? ` min="${min}"` : ""}${max != null ? ` max="${max}"` : ""}></label>`;
function wsSkillsHTML() {
  const k = W.k, i = W.sk, s = k.sk[i];
  const tabs = k.sk.map((x, j) => `<button type="button" role="tab" data-ws="sk-tab" data-i="${j}" aria-selected="${j === i}" data-fk="sk-tab=${j}"><small>Skill ${j + 1}</small><b>${esc([x.name, x.rank].filter(Boolean).join(" ") || "Not made yet")}</b>${x.fx.length ? `<i class="ws-fxn">${x.fx.length}</i>` : ""}</button>`).join("");
  const cd = clamp(num(s.cd) || 7, 1, 20);
  return `<h3>Skills</h3>
    <div class="ws-sktabs" role="tablist" aria-label="Skills">${tabs}</div>
    <div class="ws-grid3 ws-skhead">
      <label class="ws-f wide"><span class="ws-lab">Name</span><input type="text" data-wk="sk.${i}.name" value="${esc(s.name)}" maxlength="60" placeholder="e.g. Charisma" autocomplete="off"></label>
      <label class="ws-f"><span class="ws-lab">Rank</span><input type="text" list="ws-skranks" data-wk="sk.${i}.rank" value="${esc(s.rank)}" maxlength="8" placeholder="A+" autocomplete="off" spellcheck="false"></label>
      <div class="ws-field"><p class="ws-lab">Cooldown <small class="muted">at Lv 1 → 6 → 10: ${cd} → ${Math.max(0, cd - 1)} → ${Math.max(0, cd - 2)}</small></p>${seg("sk." + i + ".cd", [5, 6, 7, 8, 9, 10], cd, "Cooldown", "sm")}</div>
    </div>
    <datalist id="ws-skranks">${SK_RANKS.map((r) => `<option value="${r}"></option>`).join("")}</datalist>
    <ol class="ws-fxs">${s.fx.map((f, j) => wsFxRowHTML(f, "sk", i, j)).join("")}</ol>
    <div class="ws-row"><button type="button" class="btn ws-addfx" data-ws="fx-add" data-w="sk" data-si="${i}">+ Add an effect</button>${s.fx.length ? "" : `<span class="muted">or start from a classic:</span>`}</div>
    ${s.fx.length ? `<details class="ws-presets"><summary>Start this skill from a classic</summary>${wsPresetsHTML(i)}</details>` : wsPresetsHTML(i)}
    <datalist id="ws-vs">${WS_VS.map((v) => `<option value="${esc(v)}"></option>`).join("")}</datalist>
    <div class="ws-field"><p class="ws-lab">On their page it reads <small class="muted">at skill level ${W.copy ? W.copy.skills[i] : 10}</small></p><div class="skills ws-skpv" data-live="skpv">${wsSkPvHTML()}</div></div>`;
}
function wsPresetsHTML(i) {
  return `<div class="ws-presets-l">${WS_SK_PRESETS.map((p, j) => `<button type="button" class="ws-preset" data-ws="sk-preset" data-i="${i}" data-j="${j}"><b>${esc(p.name)} ${esc(p.rank)}</b><small>${esc(p.fx.map((x) => FX_BY[x.e].t).join(" + "))}</small></button>`).join("")}</div>`;
}
function wsTemp() {
  const d = kitDerive(W.k), c = W.copy || {skills: [10, 10, 10]};
  return Object.assign({id: "ws-preview", name: W.k.name, skills: c.skills.slice(), level: wsPvLv()}, d);
}
function wsSkPvHTML() {
  const t = wsTemp();
  return skillHTML(t, W.sk, t.skillInfo, 0).replace(/<button type="button" class="lv-toggle"[\s\S]*?<\/button>/, "");
}
function wsPsHTML() {
  const k = W.k, mine = new Set(k.ps.map((p) => p.name)), sugg = psFor(k.cls).filter((p) => !mine.has(p.name));
  const q = nname(W.q), found = q ? psLib().filter((p) => nname(p.name).includes(q) && !mine.has(p.name)).slice(0, 12) : [];
  const row = (p, i) => { const v = psValue(p); return `<li class="ws-ps">${p.ic && GAME_ICONS.has(p.ic) ? icHTML(p.ic, "ws-psic") : icHTML(guessIcon((p.e || [])[0] || "") || "", "ws-psic") || `<i class="ws-dot"></i>`}
    <div class="ws-ps-m"><div class="ws-row"><b>${esc(p.name)}</b><select data-wk="ps.${i}.rank" aria-label="${esc(p.name)} rank">${[""].concat(PS_RANKS).map((r) => `<option value="${r}"${(p.rank || "") === r ? " selected" : ""}>${r || "no rank"}</option>`).join("")}</select>${v ? `<span class="ws-psv">${v.u === "%" ? "+" + v.v + "%" : "+" + v.v} counted in NP damage</span>` : ""}</div>
      <p>${esc(psLines(p).join(" · ") || "No effect text")}</p></div>
    <button type="button" class="ws-fx-x" data-ws="ps-del" data-i="${i}" aria-label="Remove ${esc(p.name)}">×</button></li>`; };
  return `<h3>Passive skills</h3>
    <p class="ws-lede">Class skills that are always on. ${k.auto.ps ? autoTag(true, k.cls + "s") : ""}</p>
    <ol class="ws-pss">${k.ps.map(row).join("") || `<li class="muted">None yet.</li>`}</ol>
    ${sugg.length ? `<div class="ws-field"><p class="ws-lab">Usual for ${esc(k.cls)}s</p><div class="ws-sugg">${sugg.map((p) => `<button type="button" class="chip" data-ws="ps-add" data-v="${esc(p.name)}" data-r="${esc(p.rank)}" title="${esc(p.e.join(" · "))}">+ ${esc(p.name)} ${esc(p.rank)} <small>${p.n}</small></button>`).join("")}</div></div>` : ""}
    <div class="ws-field"><label class="ws-lab" for="ws-psq">Any passive from NA</label><input id="ws-psq" type="search" data-ws-q value="${esc(W.q)}" placeholder="Divinity, Riding, Self-Restoration…" autocomplete="off">
      ${found.length ? `<div class="ws-sugg">${found.map((p) => `<button type="button" class="chip" data-ws="ps-add" data-v="${esc(p.name)}" data-r="${esc(Object.keys(p.ranks).sort((a, b) => p.ranks[b] - p.ranks[a])[0] || "")}" title="${esc(p.e.join(" · "))}">+ ${esc(p.name)}</button>`).join("")}</div>` : q ? `<p class="muted">No NA passive by that name. Make your own below.</p>` : ""}</div>
    <details class="ws-own"${q && !found.length ? " open" : ""}><summary>Make your own passive</summary>
      <div class="ws-grid2"><label class="ws-f"><span class="ws-lab">Name</span><input id="ws-psn" type="text" maxlength="60" value="${esc(W.q)}" autocomplete="off"></label><label class="ws-f"><span class="ws-lab">Rank</span><input id="ws-psr" type="text" maxlength="8" list="ws-skranks" autocomplete="off"></label></div>
      <label class="ws-f"><span class="ws-lab">What it does</span><input id="ws-pse" type="text" maxlength="200" placeholder="Increase your Critical Strength" autocomplete="off"></label>
      <datalist id="ws-skranks">${SK_RANKS.map((r) => `<option value="${r}"></option>`).join("")}</datalist>
      <button type="button" class="btn sm" data-ws="ps-own">Add it</button></details>`;
}
function wsGoHTML() {
  const k = W.k, c = W.copy, M = maxLvOf(k.r), nm = k.name.trim();
  const checks = [
    [!!nm, nm ? "Named " + nm : "No name yet", 1],
    [true, k.cls + ", " + "★".repeat(k.r) + ", " + GROWTH_BY[k.growth].t + " growth", 2],
    [!!k.np.name.trim(), k.np.name.trim() ? "Noble Phantasm: " + k.np.name.trim() : "Their Noble Phantasm has no name", 4],
    [k.sk.every((s) => s.fx.length), k.sk.filter((s) => s.fx.length).length + " of 3 skills do something", 5],
    [k.ps.length > 0, k.ps.length ? k.ps.length + " passive" + (k.ps.length === 1 ? "" : "s") : "No passives", 6]
  ];
  return `<h3>${W.id ? "Save " + esc(nm || "them") : "Ready to summon " + esc(nm || "them")}</h3>
    <ul class="ws-checks">${checks.map((x) => `<li class="${x[0] ? "ok" : "todo"}"><span aria-hidden="true">${x[0] ? "✓" : "!"}</span>${esc(x[1])}${x[0] ? "" : ` <button type="button" class="linkish" data-ws="go" data-i="${x[2]}">fix</button>`}</li>`).join("")}</ul>
    <div class="ws-field"><p class="ws-lab">Against NA's servants</p><div data-live="meters">${wsPowerHTML(false)}</div></div>
    ${W.id ? "" : `<fieldset class="ws-copy"><legend>Your copy</legend>
      <div class="ws-grid2">
        <label class="ws-f"><span class="ws-lab">Level <output data-live="lvout">${c.level}</output></span><input type="range" min="1" max="120" data-wc="level" value="${c.level}" style="--m:${((M - 1) / 119 * 100).toFixed(2)}%"></label>
        <div class="ws-field"><p class="ws-lab">NP level</p><div class="ws-seg" role="group" aria-label="NP level">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-ws="copy" data-p="np" data-v="${n}" aria-pressed="${c.np === n}" data-fk="cnp=${n}">NP${n}</button>`).join("")}</div></div>
        <div class="ws-field"><p class="ws-lab">Skill levels</p><div class="ws-row">${[0, 1, 2].map((i) => `<select data-wc="skills.${i}" aria-label="Skill ${i + 1} level">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => `<option${c.skills[i] === v ? " selected" : ""}>${v}</option>`).join("")}</select>`).join("")}</div></div>
        <div class="ws-field"><p class="ws-lab">Fou</p><div class="ws-row"><label class="ws-mini"><span>HP</span><input type="number" min="0" max="2000" step="10" data-wc="fouHp" value="${c.fouHp}"></label><label class="ws-mini"><span>ATK</span><input type="number" min="0" max="2000" step="10" data-wc="fouAtk" value="${c.fouAtk}"></label></div></div>
      </div>
      <div class="ws-field"><p class="ws-lab">Where they go</p>${`<div class="ws-seg big" role="group" aria-label="Where they go"><button type="button" data-ws="copy" data-p="wish" data-v="0" aria-pressed="${!c.wish}">Summon them to my roster</button><button type="button" data-ws="copy" data-p="wish" data-v="1" aria-pressed="${!!c.wish}">Keep them in Guests</button></div>`}</div>
    </fieldset>`}
    <div class="ws-go">
      <button type="button" class="btn primary ws-summon" data-ws="save">${W.id ? "Save changes" : c.wish ? "Add " + esc(nm || "them") + " to Guests" : "Summon " + esc(nm || "them")}</button>
      <button type="button" class="btn" data-ws="save-vs">${W.id ? "Save and compare" : "Summon and compare"} with an NA servant</button>
      <button type="button" class="btn ghost" data-ws="share">Copy a share code</button>
      ${k.dice && !W.id ? `<button type="button" class="btn ghost" data-ws="dice" title="Throw this one away and make up another">⚄ Roll again</button>` : ""}
    </div>
    ${W.err ? `<p class="form-error">${esc(W.err)}</p>` : ""}
    <p class="ws-note">${W.id ? "Their level, Bond, pictures and notes stay as they are." : "Change anything later: open them in the Workshop from their page."} A share code holds everything above but the picture; a friend opens it with From a share code.</p>`;
}
// the effect list to pick from
function wsPaletteBody() {
  const q = nname(W.add.q || ""), ok = (f) => !q || nname(f.t + " " + (f.l || "") + " " + f.g).includes(q) || (f.k === "own");
  const groups = FX_GROUPS.map((g) => { const list = FX.filter((f) => f.g === g[0] && ok(f)); return list.length ? `<section><h4>${esc(g[1])}</h4><div class="ws-pal-g">${list.map((f) => { const sample = f.line({pos: "your", obj: "yourself", card: W.k.np.card, vs: "Dragon", txt: ""}) || ""; return `<button type="button" data-ws="fx-pick" data-e="${f.k}">${icHTML(guessIcon(sample)) || `<i class="ws-dot"></i>`}<span>${esc(f.t)}</span></button>`; }).join("")}</div></section>` : ""; }).join("");
  return groups;
}
function wsPaletteHTML() {
  return `<div class="ws-pal" role="dialog" aria-modal="true" aria-label="Pick an effect"><div class="ws-pal-veil" data-ws="pal-close"></div><div class="ws-pal-p">
    <header><b>${W.add.i != null ? "Change the effect" : "Add an effect"}</b><button type="button" class="ws-x" data-ws="pal-close" aria-label="Close">×</button></header>
    <input type="search" class="field-input" data-ws-palq value="${esc(W.add.q || "")}" placeholder="Search: ATK, NP, heal, stun…" autocomplete="off" aria-label="Search effects">
    <div class="ws-pal-b">${wsPaletteBody()}</div></div></div>`;
}
const WS_LIVE = {
  meters: () => wsPowerHTML(false),
  chart: () => wsChartHTML(),
  nppv: () => wsNpPvHTML(),
  skpv: () => wsSkPvHTML(),
  lvout: () => String(W.copy ? W.copy.level : ""),
  fxline: (d) => { const f = wsAt(d.p); return f ? esc(fxLine(f, W.k.np.card)) : ""; },
  fxic: (d) => { const f = wsAt(d.p); return f ? icHTML(guessIcon(fxLine(f, W.k.np.card))) || `<i class="ws-dot"></i>` : ""; }
};

/* ---------- changing the kit ---------- */
function wsAt(path) { return String(path).split(".").reduce((o, p) => (o == null ? o : o[p]), W.k); }
function wsSet(path, v) {
  const ps = String(path).split("."), last = ps.pop(), o = ps.reduce((x, p) => (x == null ? x : x[p]), W.k);
  if (o != null) o[last] = v;
}
// what a change means beyond itself: parts stop following the class once you set them
function wsChanged(path) {
  const k = W.k, A = k.auto;
  if (/^(?:hp|atk)\./.test(path)) { A.stats = false; k.feel = null; }
  if (path === "growth") A.growth = false;
  if (path === "deck") A.deck = false;
  if (path === "attr") A.attr = false;
  if (path === "np.card" || path === "np.tg") {
    A.card = false;
    if (path === "np.tg") { k.np.type = k.np.tg === "AoE" ? "Anti-Army" : k.np.tg === "Support" ? "Barrier" : "Anti-Unit"; k.np.hits = k.np.tg === "AoE" ? 3 : 5; if (k.np.tg === "Support") k.np.se = null; else if (!k.np.dmg || k.np.mode === "own") k.np.mode = "std"; }
    wsNpDmg();
  }
  if (path === "np.mode") { k.np.up = k.np.mode === "up"; wsNpDmg(); }
  if (/^np\.dmg\./.test(path)) { k.np.mode = "own"; }
  if (path === "cls" || path === "r") wsRetune();
  if (/^ps\./.test(path)) A.ps = false;
  wsSaveSoon();
}
function wsVal(el) {
  if (el.dataset.t === "num") { const v = el.value.trim(); return v === "" ? null : num(v); }
  return el.value;
}
ws.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.wk != null) {
    const p = t.dataset.wk; wsSet(p, wsVal(t)); wsChanged(p);
    // a change that moves numbers elsewhere on the step draws the step again; anything typed only refreshes what follows it
    wsLive();
    if (/^np\.dmg\./.test(p)) { const s = ws.querySelector('[data-p="np.mode"][data-v="own"]'); if (s && s.getAttribute("aria-pressed") !== "true") ws.querySelectorAll('[data-p="np.mode"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === "own"))); }
    if (/^(?:hp|atk)\./.test(p)) { ws.querySelectorAll("[data-ws-feel]").forEach((r) => { r.value = 0; }); }
    return;
  }
  if (t.dataset.wsFeel != null) {
    const k = W.k; if (!k.feel) k.feel = {bal: 0, pow: 0};
    k.feel[t.dataset.wsFeel] = num(t.value) || 0; k.auto.stats = false; wsFeelStats(k);
    ws.querySelectorAll(".ws-nums input[data-wk]").forEach((i) => { i.value = wsAt(i.dataset.wk); });
    wsLive(); wsSaveSoon(); return;
  }
  if (t.dataset.wsLv != null) { W.pvLv = num(t.value); wsLvLive(); return; }
  if (t.dataset.wc != null) {
    const p = t.dataset.wc, v = num(t.value); if (v == null) return;
    if (p.startsWith("skills.")) W.copy.skills[num(p.split(".")[1])] = clamp(v, 1, 10);
    else W.copy[p] = p === "level" ? clamp(Math.round(v), 1, 120) : clamp(v, 0, 2000);
    if (p === "level") W.pvLv = null;
    wsLive(); wsSaveSoon(); return;
  }
  if (t.dataset.wsQ != null) { W.q = t.value; const pos = t.selectionStart; wsRenderStep(); const n = ws.querySelector("[data-ws-q]"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} } return; }
  if (t.dataset.wsPalq != null) { W.add.q = t.value; const b = ws.querySelector(".ws-pal-b"); if (b) b.innerHTML = wsPaletteBody(); return; }
  if (t.dataset.wsCode != null) { W.code = t.value; return; }
});
ws.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.wsSe != null) { W.k.np.se = t.checked ? {vs: "", vals: SE_STD.slice()} : null; wsSaveSoon(); wsRender(); return; }
  if (t.dataset.wsFile != null && t.files && t.files[0]) { wsUpload(t.files[0]); t.value = ""; return; }
  if (t.dataset.wk === "np.type" || /\.rank$|\.u$/.test(t.dataset.wk || "")) { wsLive(); return; }
});
ws.addEventListener("dragover", (e) => { const d = e.target.closest && e.target.closest(".ws-drop"); if (d) { e.preventDefault(); d.classList.add("over"); } });
ws.addEventListener("dragleave", (e) => { const d = e.target.closest && e.target.closest(".ws-drop"); if (d) d.classList.remove("over"); });
ws.addEventListener("drop", (e) => { const d = e.target.closest && e.target.closest(".ws-drop"); if (!d) return; e.preventDefault(); d.classList.remove("over"); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) wsUpload(f); });
async function wsUpload(file) {
  if (!S.assets || S.readOnly) { toast("Pictures can't be added in this view."); return; }
  if (!/^image\//.test(file.type || "")) { toast("That file isn't an image."); return; }
  const blob = await shrink(file);
  let r = null;
  try { r = await S.assets.upload(blob, {type: blob.type || file.type}); } catch (e) { uploadFailed(e); return; }
  if (!r) return;
  S.urlCache[r.id] = r.url;
  if (W.art && W.artNew.includes(W.art)) { const old = W.art; W.artNew = W.artNew.filter((x) => x !== old); wsFreeArt([old]); }
  W.art = r.id; W.artNew.push(r.id); wsSaveSoon(); wsRender();
}
document.addEventListener("keydown", (e) => {
  if (!W.open || e.key !== "Escape" || !spk.hidden) return;
  e.preventDefault(); if (W.add) { W.add = null; wsRender(); } else if (W.pvOpen) { W.pvOpen = false; wsRender(); } else wsClose();
});
ws.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "ws-trait") { e.preventDefault(); wsAddTrait(e.target.value); return; }
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.wsPalq != null) { const b = ws.querySelector(".ws-pal [data-ws='fx-pick']"); if (b) b.click(); e.preventDefault(); }
});
function wsAddTrait(v) {
  const t = normTrait(v); if (!t) return;
  if (t === "Female" || t === "Male") { W.k.gender = t; } else if (!W.k.traits.includes(t)) W.k.traits.push(t);
  wsSaveSoon(); wsRender(); const i = document.getElementById("ws-trait"); if (i) i.focus();
}
ws.addEventListener("click", async (e) => {
  const b = e.target.closest && e.target.closest("[data-ws]"); if (!b || !ws.contains(b) || b.disabled) return;
  const a = b.dataset.ws, k = W.k;
  if (a === "close") { wsClose(); return; }
  if (a === "go") { const i = num(b.dataset.i); if (i === 1 && !k) return; wsGo(i); return; }
  if (a === "pv") { W.pvOpen = !W.pvOpen; wsRender(); return; }
  if (a === "blank" || a === "na" || a === "code") { W.mode = W.mode === a ? "" : a; W.q = ""; W.err = ""; wsRender(); const f = ws.querySelector(a === "na" ? "#ws-naq" : a === "code" ? "#ws-code" : ".ws-pane button"); if (f) f.focus(); return; }
  if (a === "blank-cls") { ws.querySelectorAll('[data-ws="blank-cls"]').forEach((x) => x.setAttribute("aria-pressed", String(x === b))); W.blankCls = b.dataset.v; return; }
  if (a === "blank-go") { const k2 = wsBlank(W.blankCls || "Saber", num(b.dataset.r)); W.blankCls = null; wsBegin(k2); return; }
  if (a === "dice") { const k2 = wsRandomKit(); wsBegin(k2, 7, true); ws.querySelector(".ws-card") && ws.querySelector(".ws-card").classList.add("roll"); toast("Meet " + k2.name + ". Roll again from Start, or change anything."); return; }
  if (a === "from-na") { const k2 = wsFromNa(b.dataset.no); if (k2) wsBegin(k2, 1, true); return; }
  if (a === "code-go") { const k2 = await wsReadCode(W.code); if (!k2) { W.err = "That doesn't look like a Workshop share code. It starts with FGI and a number."; wsRender(); return; } wsBegin(k2, 7, true); toast((k2.name || "Their servant") + " is in your Workshop. Summon them on this step."); return; }
  if (a === "draft-go") { const d = wsDraft(); if (d) { wsLoad(d); wsGo(Math.max(1, W.step)); } return; }
  if (a === "draft-drop") { const d = wsDraft(); if (d) { W.artNew = Array.isArray(d.artNew) ? d.artNew : []; wsDropDraft(); } W.k = null; W.id = null; W.art = null; W.artNew = []; wsRender(); toast("Draft thrown away."); return; }
  if (!k) return;
  if (a === "cls") { k.cls = b.dataset.v; wsChanged("cls"); wsRender(); return; }
  if (a === "set") {
    const p = b.dataset.p, v = b.dataset.t === "num" ? num(b.dataset.v) : (/\.cd$|\.hits$/.test(p) ? num(b.dataset.v) : b.dataset.v);
    wsSet(p, v);
    if (/\.tg$/.test(p) && /^(?:sk|np)\./.test(p)) { const f = wsAt(p.replace(/\.tg$/, "")), def = FX_BY[f.e]; if (def && def.v && !/^np\./.test(p)) { const was = f.v; const want = (v === "s" && def.vs ? def.vs : def.v); if (JSON.stringify(was) === JSON.stringify(def.v) || JSON.stringify(was) === JSON.stringify(def.vs)) f.v = want.slice(); } if (def && def.ds != null && f.d === (v === "s" ? def.d : def.ds)) f.d = v === "s" ? def.ds : def.d; }
    wsChanged(p); wsRender(); return;
  }
  if (a === "tog") { const p = b.dataset.p, arr = wsAt(p) || [], v = b.dataset.v, i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); wsSet(p, arr); wsChanged(p); wsRender(); return; }
  if (a === "dice-name") { k.name = pick(WS_NAMES) + pick(WS_EPI); wsChanged("name"); wsRender(); return; }
  if (a === "dice-np") { k.np.name = pick(WS_NP_A) + " " + pick(WS_NP_B); wsChanged("np.name"); wsRender(); return; }
  if (a === "trait-add") { const i = document.getElementById("ws-trait"); if (i) wsAddTrait(i.value); return; }
  if (a === "trait-quick") { wsAddTrait(b.dataset.v); return; }
  if (a === "trait-del") { k.traits.splice(num(b.dataset.i), 1); wsSaveSoon(); wsRender(); return; }
  if (a === "art-del") { const old = W.art; W.art = null; if (old && W.artNew.includes(old)) { W.artNew = W.artNew.filter((x) => x !== old); wsFreeArt([old]); } wsSaveSoon(); wsRender(); return; }
  if (a === "stats-usual") { k.auto.stats = true; k.feel = {bal: 0, pow: 0}; wsFeelStats(k); wsSaveSoon(); wsRender(); return; }
  if (a === "sk-tab") { W.sk = num(b.dataset.i); wsRender(); return; }
  if (a === "sk-preset") { const i = num(b.dataset.i), p = WS_SK_PRESETS[num(b.dataset.j)]; k.sk[i] = wsFromPreset(p, k.np.card); wsSaveSoon(); wsRender(); return; }
  if (a === "fx-add" || a === "fx-change") { W.add = {w: b.dataset.w, si: num(b.dataset.si) || 0, i: a === "fx-change" ? num(b.dataset.i) : null, q: ""}; wsRender(); const q = ws.querySelector("[data-ws-palq]"); if (q) q.focus(); return; }
  if (a === "pal-close") { W.add = null; wsRender(); return; }
  if (a === "fx-pick") {
    const A = W.add, list = A.w === "np" ? k.np.fx : k.sk[A.si].fx, old = A.i != null ? list[A.i] : null;
    const f = A.w === "np" ? wsNpFx(b.dataset.e, k.np.card) : wsFx(b.dataset.e, old && old.tg, k.np.card);
    if (old && A.w === "np") { f.when = old.when; }
    if (A.w === "np" && FX_BY[f.e].tgs.includes("E") && k.np.tg === "AoE") f.tg = "E";
    if (A.i != null) list[A.i] = f; else list.push(f);
    W.add = null; wsSaveSoon(); wsRender();
    const rows = ws.querySelectorAll(".ws-fx"), row = rows[A.i != null ? A.i : rows.length - 1]; if (row) { const n = row.querySelector("input, .ws-fx-name"); if (n) n.focus({preventScroll: false}); }
    return;
  }
  if (a === "fx-del" || a === "fx-up") {
    const list = b.dataset.w === "np" ? k.np.fx : k.sk[num(b.dataset.si)].fx, i = num(b.dataset.i);
    if (a === "fx-del") list.splice(i, 1); else if (i > 0) { const t = list[i]; list[i] = list[i - 1]; list[i - 1] = t; }
    wsSaveSoon(); wsRender(); return;
  }
  if (a === "ps-add") { const p = psLib().find((x) => x.name === b.dataset.v); if (p) { k.ps.push({name: p.name, rank: b.dataset.r || "", e: p.e.slice(), ic: p.ic}); k.auto.ps = false; W.q = ""; wsSaveSoon(); wsRender(); } return; }
  if (a === "ps-del") { k.ps.splice(num(b.dataset.i), 1); k.auto.ps = false; wsSaveSoon(); wsRender(); return; }
  if (a === "ps-own") { const n = (document.getElementById("ws-psn") || {}).value || "", r = (document.getElementById("ws-psr") || {}).value || "", t = (document.getElementById("ws-pse") || {}).value || ""; if (!n.trim()) { toast("Give the passive a name."); return; } k.ps.push({name: n.trim().slice(0, 60), rank: r.trim().slice(0, 8), e: t.trim() ? [t.trim().slice(0, 200)] : [], ic: ""}); k.auto.ps = false; W.q = ""; wsSaveSoon(); wsRender(); return; }
  if (a === "copy") { const p = b.dataset.p; if (p === "np") W.copy.np = num(b.dataset.v); if (p === "wish") W.copy.wish = b.dataset.v === "1"; wsSaveSoon(); wsRender(); return; }
  if (a === "share") { const code = await wsCodeOf(k); try { await navigator.clipboard.writeText(code); toast("Share code copied. A friend pastes it in the Workshop under From a share code."); } catch (er) { wsShowCode(code); } return; }
  if (a === "save" || a === "save-vs") { await wsSave(a === "save-vs"); return; }
});
function wsShowCode(code) {
  const box = document.createElement("textarea"); box.className = "ws-codeout"; box.readOnly = true; box.value = code; box.rows = 3; box.setAttribute("aria-label", "Share code");
  const go = ws.querySelector(".ws-go"); if (go) { const old = ws.querySelector(".ws-codeout"); if (old) old.remove(); go.after(box); box.focus(); box.select(); }
  toast("Copy the share code from the box.");
}

/* ---------- summoning: one servant saved, with Undo ---------- */
async function wsSave(thenVs) {
  const k = wsClean(W.k), nm = k.name.trim();
  if (!nm) { W.err = "Give them a name first."; wsGo(1); const n = document.getElementById("ws-name"); if (n) n.focus(); return; }
  k.name = nm;
  const base = W.id ? S.servants.find((x) => x.id === W.id) : null, prev = base ? wsClone(base) : null;
  const d = kitDerive(k), o = Object.assign({}, base || {}, d, {name: nm, custom: true, kit: k});
  delete o.atlas; delete o.skUpKeep;
  if (!base) {
    const c = W.copy || wsCopyDefault(k);
    Object.assign(o, {id: slug(nm, S.servants), order: nextOrder(S.servants), level: clamp(c.level, 1, 120), npLevel: clamp(c.np, 1, 5), skills: c.skills.slice(0, 3).map((v) => clamp(num(v) || 1, 1, 10)), fouHp: num(c.fouHp) || 0, fouAtk: num(c.fouAtk) || 0, bond: 0});
    if (c.wish) o.wish = true; else delete o.wish;
    if (W.art) { o.art = {"1": W.art}; o.artStage = "1"; }
  }
  const rec = growthRec(o); if (rec && num(o.level)) { o.hp = statAt(rec, o.level, "hp"); o.atk = statAt(rec, o.level, "atk"); }
  // a share code of someone else's servant keeps where it came from out of yours
  if (o.kit.from && !ATLAS_BY_NO.has(o.kit.from)) delete o.kit.from;
  const ok = await writeDoc("servants", o); if (!ok) { W.err = "Couldn't save. Check your connection, then try again."; wsRender(); return; }
  const i = S.servants.findIndex((x) => x.id === o.id); if (i >= 0) S.servants[i] = o; else S.servants.push(o);
  try { localStorage.removeItem(WS_KEY); } catch (e) {}
  W.artNew = [];
  wsClose();
  if (!base && !o.wish && SM.anim !== false) { try { await playSummon(o); } catch (e) {} }
  S.tab = "servants"; S.selected = o.id; S.lastSel = o.id; S.editing = null; if (!base && !o.wish) { S.justSummoned = o.id; setTimeout(() => { if (S.justSummoned === o.id) S.justSummoned = null; }, 3200); }
  try { history.pushState({tab: "servants"}, "", "#servants"); } catch (e) {}
  renderAll(); syncPageTheme(); window.scrollTo({top: 0});
  const undo = async () => {
    if (prev) { const ok2 = await writeDoc("servants", prev); if (ok2) { const j = S.servants.findIndex((x) => x.id === prev.id); if (j >= 0) S.servants[j] = prev; renderAll(); toast("Put back as they were."); } }
    else { const ok2 = await removeDoc("servants", o.id); if (ok2) { if (S.selected === o.id) S.selected = null; renderAll(); toast(nm + " is gone again. Your draft wasn't kept."); } }
  };
  if (thenVs) { pickNaFor(o.id, "Compare " + nm + " with an NA servant"); return; }
  toastAction(base ? "Saved " + nm + "." : o.wish ? nm + " is in your Guests." : nm + " joined your roster!", "Undo", undo);
}

/* ---------- ways in ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="ws-new"], [data-action="ws-open"], [data-action="ws-remix"]'); if (!b) return;
  e.preventDefault();
  if (b.dataset.action === "ws-open") { if (S.editing) { dropFormArt(); S.editing = null; renderDossier(true); } wsOpen({id: b.dataset.id}); return; }
  if (b.dataset.action === "ws-remix") { if (typeof pcClose === "function") pcClose(); wsOpen({no: num(b.dataset.no)}); return; }
  wsOpen({});
});
// the Servants page's toolbar, the empty roster, and Past Chaldea's servant window
(function () {
  const add = document.querySelector('#view-servants .toolbar [data-action="add-servant"]');
  if (add) add.insertAdjacentHTML("beforebegin", `<button class="btn edit-only ws-newbtn" data-action="ws-new" title="Make a servant of your own in the Servant Workshop" aria-label="Create your own servant"><span aria-hidden="true">✦</span> Create</button>`);
})();
const renderList27 = renderList;
renderList = function () {
  const r = renderList27.apply(this, arguments);
  const n = document.querySelector('#list .list-note [data-action="add-servant"]');
  if (n && !S.readOnly && !n.parentNode.querySelector('[data-action="ws-new"]')) n.insertAdjacentHTML("afterend", ` <button class="btn" data-action="ws-new">Create your own</button>`);
  return r;
};
const pcRenderDetail27 = pcRenderDetail;
pcRenderDetail = function () {
  const r = pcRenderDetail27.apply(this, arguments);
  if (pcOpen && pcOpen.no != null && !pcOpen.ce && !S.readOnly) {
    const at = pcDlg.querySelector('[data-action="pc-add"], [data-action="pc-summon"]');
    if (at && !pcDlg.querySelector('[data-action="ws-remix"]')) at.parentNode.insertAdjacentHTML("beforeend", `<button type="button" class="btn ghost sm ws-remix" data-action="ws-remix" data-no="${pcOpen.no}" title="Make your own servant from this kit in the Servant Workshop">Remix in the Workshop</button>`);
  }
  return r;
};
// Home: next to Add a servant
const renderHome27 = renderHome;
renderHome = function () {
  const r = renderHome27.apply(this, arguments);
  const a = document.querySelector('#home .hm-actions [data-action="home-add"]');
  if (a && !S.readOnly && !a.parentNode.querySelector('[data-action="ws-new"]')) a.insertAdjacentHTML("afterend", `<button type="button" class="btn ghost" data-action="ws-new">Create your own</button>`);
  return r;
};
