/* ================= 0.50.0-beta: the battle simulator, part 1: the engine =================
   A fight is worked out turn by turn the way the game does it, as closely as the page's data allows, and written down
   as a list of events (each with a snapshot of both sides) that the Battle page plays back (49b-battle-ui.js).
   - Your side: up to three in front and three behind, who step in when someone falls. Your servants and Guests (NA's
     data for them, or a custom servant's own kit from the Workshop), or any NA servant borrowed as a support.
   - The other side: waves of enemies. Made-up ones, your Guests or servants, or the enemies of a real NA quest.
   - Each turn: skills, then five cards dealt from the front three's decks (15 cards, shuffled, three turns to a
     shuffle), three picked (Noble Phantasms first when the gauge is full), then the enemies act.
   - Skills are read into one set of effects, the same ones the Workshop uses (ATK up, card up, NP charge, Invincible,
     DEF down …): a custom servant's kit as it is, an NA servant's from the words of its skills.
   - Damage, NP gain and stars use the game's formulas. What the page doesn't know (each servant's own NP gain and hit
     counts) uses the usual values for the class and the card.
   - The choices (which skills, which cards) are made by `BT_AUTO`, the auto-battle. A play-it-yourself mode only needs
     another set of choices with the same two questions. A seed makes every fight repeatable. */

/* ---------- the game's numbers ---------- */
const BT_CARD = {B: [1.5, 1.8, 2.1], A: [1, 1.2, 1.4], Q: [0.8, 0.96, 1.12], E: [1, 1, 1]};
const BT_NP_CARD = {B: 1.5, A: 1, Q: 0.8};
const BT_GAIN = {A: [3, 4.5, 6], Q: [1, 1.5, 2], B: [0, 0, 0], E: [1, 1, 1]};
const BT_GAIN_NP = {A: 3, Q: 1, B: 0};
const BT_STAR = {Q: [0.8, 1.3, 1.8], A: [0, 0, 0], B: [0.1, 0.15, 0.2], E: [1, 1, 1]};
const BT_HITS = {Q: 4, A: 3, B: 2, E: 5};
// NP gained per hit, in %, the usual for each class (the page doesn't have each servant's own)
const BT_NPRATE = {Saber: 0.84, Archer: 0.78, Lancer: 0.8, Rider: 0.86, Caster: 0.8, Assassin: 0.84, Berserker: 1.02, Shielder: 0.84, Ruler: 0.76, Avenger: 0.78,
  "Moon Cancer": 0.8, "Alter Ego": 0.82, Foreigner: 0.8, Pretender: 0.8, Beast: 0.8};
// how much NP a hit on an enemy of each class gives (the game's server rate)
const BT_TDRATE = {Rider: 1.1, Caster: 1.2, Assassin: 0.9, Berserker: 0.8, "Moon Cancer": 1.2};
const BT_LETTER = {Buster: "B", Arts: "A", Quick: "Q", B: "B", A: "A", Q: "Q"};
const BT_WORD = {B: "Buster", A: "Arts", Q: "Quick", E: "Extra"};
const BT_MAX_TURNS = 40;
// effects that help (buffs) and ones that hurt (debuffs); immediate ones aren't kept on anyone
const BT_NOW = new Set(["charge", "stars", "heal", "cleanse", "cd", "chargedown", "drain"]);
const BT_DEBUFF = new Set(["defdown", "resdown", "atkdown", "stun", "charm", "burn"]);

/* ---------- a seeded random number (the same seed plays the same fight) ---------- */
function btRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- reading an NA servant's skills into effects ---------- */
// [effect, how the line reads, the value's label]; the first that fits wins, so the order matters
const BT_READ = [
  ["pierce", /ignore invincib|sure hit/i, null],
  ["npturn", /np gauge each turn|np (?:gauge )?(?:charge )?each turn|charge .*np gauge each turn/i, /np per turn/i],
  ["starturn", /c\. stars each turn|stars each turn/i, /stars per turn/i],
  ["regen", /(?:recover|restore) .*hp each turn|hp (?:regen|recovery) each turn/i, /hp per turn/i],
  ["charge", /(?:increase|charge) .*np gauge|np gauge .*increase/i, /^np charge/i],
  ["drain", /(?:decrease|reduce|drain) .*np gauge/i, null],
  ["gain", /np gain/i, /np gain up/i],
  ["stars", /gain .*c\. stars|gain .*critical stars/i, /^c\. stars$/i],
  ["drop", /c\. star drop rate|star generation/i, /drop rate up/i],
  ["gather", /star gather|gather rate/i, /gather up/i],
  ["cd", /cooldown/i, null],
  ["vs", /(?:attack strength|strength|atk|damage) against \[|special attack/i, /str up vs|strength up vs|special attack/i],
  ["crit", /increase .*critical (?:strength|damage)/i, /critical (?:up|str up|damage)/i],
  ["card", /increase .*(?:buster|arts|quick)(?: card)? (?:card )?effectiveness|increase .*(?:buster|arts|quick) card performance/i, /(?:buster|arts|quick) up/i],
  ["np", /increase .*np (?:strength|damage)/i, /np strength up/i],
  ["dp", /damage plus|atk plus/i, /damage plus|atk plus/i],
  ["invinc", /invincib/i, null],
  ["evade", /evade|evasion/i, null],
  ["guts", /guts/i, /guts hp/i],
  ["taunt", /taunt|target focus/i, null],
  ["cut", /damage cut|reduce damage (?:taken|received)/i, /damage cut/i],
  ["maxhp", /max hp/i, /max hp/i],
  ["heal", /(?:recover|restore|heal) .*hp|hp recovery/i, /hp recovery|heal/i],
  ["immune", /debuff immunity/i, null],
  ["cleanse", /remove .*debuff/i, null],
  ["dres", /increase .*debuff resist/i, /debuff resist up/i],
  ["defdown", /decrease .*\bdef\b/i, /def down/i],
  ["resdown", /decrease .*(?:buster|arts|quick).* resist/i, /resist down/i],
  ["atkdown", /decrease .*\batk\b/i, /atk down/i],
  ["chargedown", /decrease .*charge|charge drain|reduce .*charge/i, null],
  ["stun", /stun|paraly|sleep|pigify|petrif/i, /chance/i],
  ["charm", /charm/i, /chance/i],
  ["burn", /burn|poison|curse/i, /burn|poison|curse/i],
  ["defup", /increase .*\bdef\b/i, /^def up/i],
  ["atk", /increase .*\batk\b/i, /^atk up/i]
];
function btTarget(line, k) {
  const l = line.toLowerCase();
  if (/all allies except yourself|all other allies|allies \(excluding yourself\)|other party members/.test(l)) return "x";
  if (/all allies|party|all servants on your side/.test(l)) return "a";
  if (/a single ally|one ally|an ally/.test(l)) return "o";
  if (/all enemies/.test(l)) return "E";
  if (/a single enemy|one enemy|an enemy|the enemy/.test(l)) return "e";
  return BT_DEBUFF.has(k) || k === "chargedown" || k === "drain" ? "e" : "s";
}
function btTurns(line) {
  const m = /\((?:(\d+) times?)?(?:,\s*)?(?:(\d+) turns?)?\)/i.exec(line);
  return m ? {d: num(m[2]) || 0, n: num(m[1]) || 0} : {d: 0, n: 0};
}
// a line can hold several effects for the same targets: "Increase ATK (3 turns) & NP Gauge for all allies" is two.
// Each part gets the line's verb and its targets. A state that does something later ("Apply a state that …") isn't
// worked out here.
const BT_TAIL = /\s(?:for|to)\s(?:yourself|all allies(?:\s(?:except|excluding) yourself)?|all other allies|allies \(excluding yourself\)|a single ally|one ally|an ally|all enemies|a single enemy|one enemy|an enemy|the enemy|party)\b.*$/i;
const BT_VERB = /^((?:greatly |slightly |significantly |highly |high chance to |low chance to |chance to )?(?:increase|decrease|apply|inflict|grant|gain|reduce|restore|recover|remove|charge))\s/i;
function btClauses(line) {
  const l = String(line || "").trim();
  if (!l || /^apply a state|^grant a state|["“”]/i.test(l)) return [];
  // each part with its own targets ("Increase ATK for all allies (3 turns) & Charge NP Gauge for all allies"), or the
  // targets and turns of the part after it ("Increase ATK & DEF for all allies (3 turns)"), and the verb before it
  const TURN = /\s*\((?:\d+ times?)?(?:,\s*)?(?:\d+ turns?)?\)\s*$/i;
  const parts = l.split(/\s&\s/).map((p) => { const m = BT_TAIL.exec(p); return {body: m ? p.slice(0, m.index) : p, tail: m ? m[0] : ""}; });
  for (let i = parts.length - 2; i >= 0; i--) {
    if (!parts[i].tail) parts[i].tail = parts[i + 1].tail;
    const tn = TURN.exec(parts[i + 1].body + parts[i + 1].tail);
    if (tn && !/\(\d+ (?:times?|turns?)/i.test(parts[i].body + parts[i].tail)) parts[i].tail += tn[0].replace(/^\s*/, " ");
  }
  let verb = "";
  return parts.map((p) => { const vm = BT_VERB.exec(p.body + " "); if (vm) verb = vm[1]; else if (verb) p.body = verb + " " + p.body; return (p.body + p.tail).replace(/\s+/g, " ").trim(); });
}
// a part that takes something away isn't the same effect as one that gives it ("disable HP recovery" isn't a heal)
const BT_GIVE = new Set(["heal", "regen", "atk", "defup", "card", "np", "crit", "gain", "drop", "gather", "charge", "dres", "maxhp", "npturn", "starturn"]);
const btCardIn = (line) => { const m = /\b(Buster|Arts|Quick)\b/.exec(line); return m ? BT_LETTER[m[1]] : ""; };
const btVsIn = (line) => { const m = /\[([^\]]{1,40})\]/.exec(line); return m ? m[1] : ""; };
// one line of an NA skill; `rows` are its value rows ([label, Lv 1, Lv 10, unit]), each used once
function btReadLine(line, rows) {
  const r = BT_READ.find((x) => x[1].test(line)); if (!r) return null;
  const k = r[0]; if (BT_GIVE.has(k) && /\b(?:decrease|reduce|disable|lose|drain|block|seal)\b/i.test(line)) return null;
  const t = btTurns(line), def = FX_BY[k === "regen" ? "heal" : k] || {};
  let v = null;
  if (r[2]) { const i = rows.findIndex((x) => x && r[2].test(x[0])); if (i >= 0) { const x = rows[i]; rows[i] = null; v = skVals(num(x[1]) || 0, num(x[2]) || 0); } }
  if (v == null && def.v) v = skVals(def.v[0], def.v[1]);
  if (k === "stars" && v == null) v = skVals(10, 20);
  const chance = /(\d+)% chance/i.exec(line);
  // ("2 times" with no turns lasts until it's used)
  return {k: k, tg: btTarget(line, k), v: v, d: t.d || (t.n || BT_NOW.has(k) ? 0 : def.d || 1), n: t.n || (["invinc", "evade", "guts"].includes(k) ? 1 : 0),
    card: k === "card" || k === "resdown" ? btCardIn(line) || "B" : "", vs: k === "vs" ? btVsIn(line) : "", p: chance ? num(chance[1]) / 100 : 1, txt: line};
}
function btSkillNA(sk, lv) {
  const rows = (sk.v || []).slice(), fx = (sk.e || []).flatMap(btClauses).map((l) => btReadLine(l, rows)).filter(Boolean);
  return {n: sk.n || "Skill", ic: sk.ic || "", cd: clamp(num(sk.cd) || 7, 1, 12), lv: clamp(num(lv) || 10, 1, 10), fx: fx, lines: sk.e || []};
}
// an NA Noble Phantasm: its damage by NP level, what Overcharge adds, and its other effects
const btPct = (v) => { const m = /(-?\d+(?:\.\d+)?)/.exec(String(v == null ? "" : v)); return m ? Number(m[1]) : null; };
function btNpNA(np) {
  if (!np) return null;
  const card = BT_LETTER[np.k] || "B", tg = np.tg === "Support" ? "S" : np.tg === "Single Target" ? "ST" : "AoE";
  const dmgRow = (np.r || []).find((r) => /^damage$/i.test(r[0]));
  const rows = (np.r || []).filter((r) => r !== dmgRow).map((r) => ["np", r[0], (r[1] || []).map(btPct)]).concat((np.o || []).map((r) => ["oc", r[0], (r[1] || []).map(btPct)]));
  const seRow = rows.find((r) => /special damage|super.?effective/i.test(r[1]));
  const ocText = (np.oc || []).join(" ");
  const fx = [], lines = [];
  // each line, with its values by NP level or by Overcharge
  const dmgAt = (np.e || []).findIndex((x) => /deal .*damage/i.test(x) && !/damage plus/i.test(x));
  (np.e || []).map((l, i) => [l, "np", i]).concat((np.oc || []).map((l) => [l, "oc", 99])).flatMap(([l, from, i]) => /deal .*damage/i.test(l) && !/damage plus/i.test(l) ? [] : btClauses(l).map((c) => [c, from, i])).forEach(([l, from, i]) => {
    const r = BT_READ.find((x) => x[1].test(l)); if (!r) { lines.push(l); return; }
    const k = r[0]; if (BT_GIVE.has(k) && /\b(?:decrease|reduce|disable|lose|drain|block|seal)\b/i.test(l)) return;
    const t = btTurns(l);
    let vals = null, by = from;
    if (r[2]) { const j = rows.findIndex((x) => x && x[0] !== "used" && r[2].test(x[1])); if (j >= 0) { vals = rows[j][2]; by = rows[j][0]; rows[j] = ["used"]; } }
    const def = FX_BY[k] || {};
    if (!vals) { const v = def.vs || def.v; vals = v ? [v[0], v[0], v[0], v[0], v[0]] : [0, 0, 0, 0, 0]; by = "fix"; }
    fx.push({k: k, tg: btTarget(l, k), vals: vals, by: by, when: from === "np" && dmgAt >= 0 && i < dmgAt ? "pre" : "post", d: t.d || (t.n || BT_NOW.has(k) ? 0 : def.d || 1), n: t.n || (["invinc", "evade", "guts"].includes(k) ? 1 : 0),
      card: k === "card" || k === "resdown" ? btCardIn(l) || card : "", vs: k === "vs" ? btVsIn(l) : "", p: 1, txt: l});
  });
  return {n: np.n || "Noble Phantasm", card: card, tg: tg, hits: clamp(num(np.h) || (tg === "S" ? 0 : 3), 0, 15), mult: dmgRow ? (dmgRow[1] || []).map(btPct) : null,
    se: seRow && seRow[0] !== "used" ? {vals: seRow[2], byOc: seRow[0] === "oc", vs: btVsIn(ocText) || btVsIn((np.e || []).join(" "))} : null, fx: fx, lines: lines};
}

/* ---------- a custom servant's kit, as it is ---------- */
// an effect written by hand, read from its words (61-skill-reader.js): the parts that change damage fight too (0.54.0)
const BT_SR = {atk: "atk", card: "card", np: "np", crit: "crit", pow: "vs", dmg: "vs", dp: "dp", def: "defdown", res: "resdown"};
function btOwnFx(f) {
  if (typeof srRead !== "function") return [];
  const t = btTurns(String(f.txt || ""));
  return srRead(f, 10).filter((r) => BT_SR[r.k] && !r.others).map((r) => {
    const foe = r.k === "def" || r.k === "res", all = /all allies|\bparty\b|every ally/i.test(String(f.txt || ""));
    return {k: BT_SR[r.k], tg: foe ? (/all enemies/i.test(String(f.txt || "")) ? "E" : "e") : all ? "a" : "s", v: skVals(r.v1, r.v10), d: t.d || 3, n: t.n || 0,
      card: r.card ? BT_LETTER[r.card] || "" : "", vs: r.k === "pow" ? (/against (.+)$/.exec(r.label) || [])[1] || "" : "", p: 1, txt: String(f.txt || f.l || "")};
  });
}
function btSkillKit(sk, lv) {
  const own = (sk.fx || []).filter((f) => f.e === "own").flatMap(btOwnFx);
  const fx = own.concat((sk.fx || []).filter((f) => FX_BY[f.e] && f.e !== "own").map((f) => {
    const def = FX_BY[f.e], tg = def.tgs ? (def.tgs.includes(f.tg) ? f.tg : def.tg) : "s";
    const v = def.v ? skVals(num((f.v || [])[0]) != null ? num(f.v[0]) : def.v[0], num((f.v || [])[1]) != null ? num(f.v[1]) : def.v[1]) : null;
    return {k: f.e, tg: tg === "" ? "s" : tg, v: v, d: num(f.d) != null ? num(f.d) : def.d || 0, n: num(f.n) || def.n || 0, card: f.card ? BT_LETTER[f.card] || "" : "", vs: f.vs || "", p: f.e === "stun" || f.e === "charm" ? null : 1, txt: fxLine(f)};
  }));
  return {n: [sk.name, sk.rank].filter(Boolean).join(" ") || "Skill", ic: "", cd: clamp(num(sk.cd) || 7, 1, 20), lv: clamp(num(lv) || 10, 1, 10), fx: fx, lines: (sk.fx || []).map((f) => fxLine(f)).filter(Boolean)};
}
function btNpKit(np) {
  const card = BT_LETTER[np.card] || "B", tg = np.tg === "Support" ? "S" : np.tg === "Single Target" ? "ST" : "AoE";
  const fx = (np.fx || []).filter((f) => FX_BY[f.e] && f.e !== "own").map((f) => {
    const def = FX_BY[f.e], t = def.tgs ? (def.tgs.includes(f.tg) ? f.tg : def.tg) : "s", vals = (f.vals || []).map(num);
    const v0 = def.vs || def.v;
    return {k: f.e, tg: t || "s", vals: vals.length === 5 && vals.every((x) => x != null) ? vals : v0 ? [v0[0], v0[0], v0[0], v0[0], v0[0]] : [0, 0, 0, 0, 0], by: f.by === "oc" ? "oc" : f.by === "fix" ? "fix" : "np",
      when: f.when === "pre" ? "pre" : "post", d: num(f.d) != null ? num(f.d) : def.d || 0, n: num(f.n) || def.n || 0, card: f.card ? BT_LETTER[f.card] || card : card, vs: f.vs || "", p: 1, txt: fxLine(f, np.card)};
  });
  const se = tg !== "S" && np.se && String(np.se.vs || "").trim() ? {vals: (np.se.vals || []).map(num), byOc: true, vs: String(np.se.vs).trim()} : null;
  return {n: np.name || "Noble Phantasm", card: card, tg: tg, hits: clamp(num(np.hits) || 1, tg === "S" ? 0 : 1, 15), mult: tg === "S" ? null : (np.dmg || []).map(num), se: se, fx: fx, lines: []};
}

/* ---------- who fights: one template per fighter ---------- */
// the start of a battle's NP from a Craft Essence ("Begin battle with NP Gauge at 50%") and Append 2
function btCeStart(c) {
  const l = String(((c && (c.x && c.x.length ? c.x : c.e)) || [])[0] || "");
  const m = /(?:begin|start)[^.]*?battle with (?:your )?np gauge (?:charged )?(?:at |by |to )?(\d+)%|np gauge (?:charged )?by (\d+)% at (?:the )?start/i.exec(l);
  return m ? num(m[1] || m[2]) || 0 : 0;
}
function btBlankSkills() { return [0, 1, 2].map(() => null); }
// one of your servants or Guests: NA's data for them (at their levels), a custom one's kit, or what's filled in
function btFromServant(s, opts) {
  opts = opts || {};
  const a = atlasOf(s), k = s.custom ? kitNow(s) : null, lv = skLevels(s), ap = typeof apLevels === "function" ? apLevels(s) : [0, 0, 0, 0, 0];
  const c = typeof favOn === "function" ? favOn(s) : null;
  const hp = (total(s, "hp") || (a && a.hp ? a.hp[1] : 10000)) + (c && c.hp ? c.hp[1] || 0 : 0), atk = (total(s, "atk") || (a && a.atk ? a.atk[1] : 9000)) + (c && c.atk ? c.atk[1] || 0 : 0);
  let sk = btBlankSkills(), np = null, deck = "", attr = s.attr || "", traits = (s.traits || []).slice(), pm = [0, 0, 0, 0, 0];
  if (k) {
    sk = [0, 1, 2].map((i) => (k.sk || [])[i] && (k.sk[i].fx || []).length ? btSkillKit(k.sk[i], lv[i]) : null);
    np = btNpKit(k.np || {}); deck = String(k.deck || "QAABB"); attr = k.attr || attr;
    (k.ps || []).forEach((p) => { const v = typeof psValue === "function" ? psValue(p) : null; if (v) pm[v.slot] += v.v; });
  } else if (a) {
    sk = (a.sk || []).slice(0, 3).map((x, i) => x ? btSkillNA(x, lv[i] || 10) : null);
    np = btNpNA(a.np); deck = a.d || "QAABB"; attr = a.a || attr; traits = (a.t || []).concat(a.g ? [a.g] : []); pm = (a.pm || pm).slice();
  } else {
    const card = BT_LETTER[s.npCard] || "B", tg = s.npTarget === "Support" ? "S" : s.npTarget === "Single Target" ? "ST" : "AoE";
    const std = typeof npStdDmg === "function" ? npStdDmg(tg === "ST" ? "Single Target" : "AoE", BT_WORD[card], false) : null;
    np = {n: s.npName || "Noble Phantasm", card: card, tg: tg, hits: 3, mult: tg === "S" ? null : std || [300, 400, 450, 475, 500], se: null, fx: [], lines: []};
    deck = (Array.isArray(s.deck) ? s.deck.map((x) => BT_LETTER[x] || "").join("") : "") || "QAABB";
  }
  const start = btCeStart(c) + (ap[1] ? [10, 11, 12, 13, 14, 15, 16, 17, 18, 20][ap[1] - 1] : 0);
  return {key: opts.key || "r:" + s.id, name: nmText(s), cls: s.cls || (a && a.c) || "Saber", attr: attr, traits: traits, face: btFaceOf(s, a), hp: Math.round(hp), atk: Math.round(atk),
    deck: btDeck(deck), npLv: clamp(num(s.npLevel) || 1, 1, 5), np: np, sk: sk, pm: pm, npStart: start, servant: true, custom: !!s.custom,
    rate: BT_NPRATE[s.cls] || 0.8, sg: a ? (a.sg || 100) / 10 : 10, sa: a ? a.sa || 100 : 100, ce: c ? c.n : "", apVs: ap[2] ? btApVs(a, ap[2]) : null};
}
// Append 3: ATK against one class, from Lv 1 (20%) to Lv 10 (30%)
function btApVs(a, lv) {
  const k = a && a.ap && ATLAS_APPENDS[a.ap[2]]; if (!k) return null;
  const m = /\[([^\]]+)\]/.exec((k.e || [])[0] || ""), v = k.v && k.v[0]; if (!m || !v) return null;
  return {cls: m[1], v: lv >= 10 ? v[2] : v[1] + (v[2] - v[1]) * (lv - 1) / 10};
}
// any NA servant, borrowed: at its max level and its skills at 10, with the NP level picked
function btFromNA(no, npLv) {
  const a = ATLAS_BY_NO.get(num(no)); if (!a) return null;
  return {key: "a:" + a.no, name: a.n, cls: a.c, attr: a.a || "", traits: (a.t || []).concat(a.g ? [a.g] : []), face: a.f ? aimg(a.f) : "", hp: (a.hp || [])[1] || 12000, atk: (a.atk || [])[1] || 10000,
    deck: btDeck(a.d || "QAABB"), npLv: clamp(num(npLv) || 1, 1, 5), np: btNpNA(a.np), sk: (a.sk || []).slice(0, 3).map((x) => x ? btSkillNA(x, 10) : null), pm: (a.pm || [0, 0, 0, 0, 0]).slice(),
    npStart: 0, servant: true, support: true, rate: BT_NPRATE[a.c] || 0.8, sg: (a.sg || 100) / 10, sa: a.sa || 100, ce: "", apVs: null};
}
function btFaceOf(s, a) {
  try { const ic = typeof iconSlot === "function" ? iconSlot(s) : null, id = ic && artOf(s, ic); if (id) return artSrc(id); } catch (e) {}
  return a && a.f ? aimg(a.f) : "";
}
const btDeck = (d) => { const x = String(d || "").toUpperCase().replace(/[^QAB]/g, "").slice(0, 5); return (x.length === 5 ? x : "QAABB").split(""); };
// an enemy made up on the page
function btFromMade(e) {
  const cls = AFF_CLASSES.includes(e.cls) ? e.cls : "Saber";
  return {key: "m:" + (e.name || cls), name: String(e.name || cls).slice(0, 40) || cls, cls: cls, attr: NPC_ATTRS.includes(e.attr) ? e.attr : "Earth", traits: [], face: "", hp: clamp(num(e.hp) || 30000, 1, 1e9), atk: clamp(num(e.atk) != null ? num(e.atk) : 8000, 0, 1e6),
    deck: ["Q", "A", "B"], npLv: 1, np: null, sk: btBlankSkills(), pm: [0, 0, 0, 0, 0], npStart: 0, servant: false, charge: clamp(num(e.charge) || 3, 1, 8), acts: clamp(num(e.acts) || 1, 1, 3), npMul: 3, npAoe: e.aoe !== false,
    bars: (e.bars || []).map(num).filter((v) => v > 0), td: BT_TDRATE[cls] || 1};
}
// a servant as an enemy: its own kit, its charge filled by turns like the game's servant enemies
function btAsFoe(t, hpMul) {
  return Object.assign({}, t, {key: "f" + t.key, hp: Math.round(t.hp * (num(hpMul) || 1)), charge: 3, acts: 1, foeServant: true, td: BT_TDRATE[t.cls] || 1});
}
// an enemy of an NA quest (Atlas Academy's quest data, made small in 49b)
function btFromQuest(e) {
  const cls = AFF_CLASSES.includes(e.c) ? e.c : "Saber";
  return {key: "q:" + e.n, name: e.n, cls: cls, attr: e.a || "Earth", traits: e.tr || [], face: e.f ? aimg(e.f) : "", hp: Math.max(1, e.hp | 0), atk: Math.max(0, e.atk | 0),
    deck: ["Q", "A", "B"], npLv: 1, np: null, sk: btBlankSkills(), pm: [0, 0, 0, 0, 0], npStart: 0, servant: false, charge: clamp(e.ct || 3, 1, 8), acts: e.acts || 1, npMul: 3, npAoe: true,
    bars: (e.bars || []).filter((v) => v > 0), td: e.td || BT_TDRATE[cls] || 1};
}

/* ---------- a fight ---------- */
let btUid = 0;
function btUnit(t, side) {
  return {id: "u" + (++btUid), t: t, side: side, name: t.name, cls: t.cls, hp: t.hp, max: t.hp, atk: t.atk, np: side === "ally" ? clamp(t.npStart || 0, 0, 300) : 0,
    charge: 0, chargeMax: t.charge || 3, bars: (t.bars || []).slice(), buffs: [], cd: [0, 0, 0], alive: true, stun: 0, stat: {dmg: 0, nps: 0, taken: 0, kills: 0, cards: 0, skills: 0}};
}
// what a fighter's buffs add up to, for one kind of effect (and a card, and who they're up against)
function btMod(u, k, card, foe) {
  let v = 0;
  u.buffs.forEach((b) => {
    if (b.k !== k) return;
    if (b.card && card && b.card !== card) return;
    if (b.vs && foe && !btVsOk(b.vs, foe)) return;
    if (b.vs && !foe) return;
    v += b.v;
  });
  return v;
}
// "ATK against [Rider]", "[Divine]", "[Male]": the class, the attribute or one of the traits
function btVsOk(vs, foe) {
  const w = String(vs).toLowerCase().replace(/\s+/g, " ").trim();
  if (!w) return false;
  if (String(foe.cls).toLowerCase() === w || String(foe.t.attr).toLowerCase() === w) return true;
  return (foe.t.traits || []).some((x) => { const t = String(x).toLowerCase(); return t === w || t.replace(/ servant$/, "") === w; });
}
const btHas = (u, k) => u.buffs.some((b) => b.k === k);
function btTakeOne(u, k) {
  const b = u.buffs.find((x) => x.k === k); if (!b) return false;
  if (b.n) { b.n -= 1; if (b.n <= 0) u.buffs.splice(u.buffs.indexOf(b), 1); }
  return true;
}

function btBattle(setup, seed) {
  btUid = 0;
  const rng = btRng(seed), R = (a, b) => a + (b - a) * rng();
  const B = {seed: seed, turn: 0, wave: 0, waves: setup.waves.map((w) => w.map((t) => btUnit(t, "foe"))), allies: setup.party.slice(0, 3).filter(Boolean).map((t) => btUnit(t, "ally")),
    back: setup.party.slice(3).filter(Boolean).map((t) => btUnit(t, "ally")), foes: [], stars: 0, deck: [], hand: [], ev: [], over: false, result: "", target: null};
  const all = B.allies.concat(B.back);
  // the Master, with the Mystic Code's three skills (0.54.0); not a fighter: no HP, never targeted, not in the snapshots
  const M = setup.mc && setup.mc.sk ? {id: btUid++, side: "ally", master: true, name: setup.mc.name || "Master", cls: "", alive: true, stun: 0, cd: [0, 0, 0], buffs: [], hp: 1, max: 1, np: 0,
    t: {sk: setup.mc.sk, face: setup.mc.face || "", hp: 0}, stat: {dmg: 0, nps: 0, taken: 0, kills: 0, cards: 0, skills: 0}, chargeMax: 0} : null;
  B.master = M;
  B.everyone = () => all.concat(...B.waves);
  const snap = () => ({turn: B.turn, wave: B.wave, stars: Math.floor(B.stars), u: B.allies.concat(B.back, B.foes).map((u) => ({id: u.id, hp: Math.max(0, Math.round(u.hp)), max: u.max, np: Math.floor(u.np), charge: u.charge,
    chargeMax: u.chargeMax, bars: u.bars.length, alive: u.alive, stun: u.stun > 0, buffs: u.buffs.map((b) => b.k + (b.card ? ":" + b.card : "")).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10), front: B.allies.includes(u) || B.foes.includes(u)}))});
  const emit = (t, d) => { B.ev.push(Object.assign({t: t}, d || {}, {s: snap()})); };

  /* effects */
  const others = (u) => (u.side === "ally" ? B.allies : B.foes).filter((x) => x.alive && x !== u);
  const team = (u) => (u.side === "ally" ? B.allies : B.foes).filter((x) => x.alive);
  const foesOf = (u) => (u.side === "ally" ? B.foes : B.allies).filter((x) => x.alive);
  function targets(u, fx, pick) {
    const tg = fx.tg || "s";
    if (tg === "s") return [u];
    if (tg === "a") return team(u);
    if (tg === "x") return others(u);
    if (tg === "o") return [pick && pick.alive && pick.side === u.side ? pick : u];
    if (tg === "E") return foesOf(u);
    const f = foesOf(u); return f.length ? [pick && pick.alive && pick.side !== u.side ? pick : (u.side === "ally" && B.target && B.target.alive ? B.target : f[0])] : [];
  }
  function apply(u, fx, v, pick, from) {
    const ts = targets(u, fx, pick), done = [];
    ts.forEach((t) => {
      if (fx.p != null && fx.p < 1 && rng() > fx.p) { done.push({id: t.id, miss: true}); return; }
      if (BT_DEBUFF.has(fx.k) && t.side !== u.side) {
        if (btTakeOne(t, "immune")) { done.push({id: t.id, blocked: true}); return; }
        if ((fx.k === "stun" || fx.k === "charm") && rng() > clamp((v || 80) / 100 - btMod(t, "dres") / 100, 0, 1)) { done.push({id: t.id, miss: true}); return; }
      }
      switch (fx.k) {
        case "charge": t.np = clamp(t.np + (v || 0), 0, t.side === "ally" ? 300 : 300); break;
        case "drain": if (t.side === "foe") t.charge = Math.max(0, t.charge - 1); else t.np = Math.max(0, t.np - (v || 0)); break;
        case "stars": B.stars = Math.min(50, B.stars + (v || 0)); break;
        case "heal": t.hp = Math.min(t.max, t.hp + (v || 0)); break;
        case "cleanse": t.buffs = t.buffs.filter((b) => !BT_DEBUFF.has(b.k)); t.stun = 0; break;
        case "cd": t.cd = t.cd.map((c) => Math.max(0, c - clamp(Math.round(v || 1), 1, 3))); break;
        case "chargedown": t.charge = Math.max(0, t.charge - 1); break;
        case "maxhp": t.max += v || 0; t.hp += v || 0; t.buffs.push({k: "maxhp", v: v || 0, d: fx.d || 3, n: 0}); break;
        case "stun": case "charm": t.stun = Math.max(t.stun, fx.d || 1); t.buffs.push({k: fx.k, v: 0, d: fx.d || 1, n: 0}); break;
        // (a buff that only counts its uses, "1 time", stays until it's used)
        default: t.buffs.push({k: fx.k, v: v || 0, d: fx.d || 0, n: fx.n || 0, keep: !(fx.d > 0) && fx.n > 0, card: fx.card || "", vs: fx.vs || "", from: from});
      }
      done.push({id: t.id});
    });
    return done;
  }
  function useSkill(u, i, pick) {
    const sk = u.t.sk[i]; if (!sk || u.cd[i] > 0 || !u.alive || u.stun > 0) return false;
    const fx = sk.fx.map((f) => ({k: f.k, to: apply(u, f, f.v ? f.v[sk.lv - 1] : null, pick, sk.n)}));
    u.cd[i] = Math.max(1, sk.cd - (sk.lv >= 10 ? 2 : sk.lv >= 6 ? 1 : 0)); u.stat.skills++;
    emit("skill", {who: u.id, i: i, n: sk.n, fx: fx, pick: pick ? pick.id : null});
    return true;
  }

  /* damage */
  const clsAtk = (c) => NPC_CLASS_ATK[c] || 1;
  // one hit's damage from u to t; card is B/A/Q/E, pos 0–2, np: the NP's multiplier (%) or null
  function dmgOf(u, t, card, pos, opts) {
    const o = opts || {}, base = o.np ? BT_NP_CARD[card] : BT_CARD[card][pos];
    const cardUp = (btMod(u, "card", card) + (u.t.pm[{B: 0, A: 1, Q: 2}[card]] || 0) - btMod(t, "resdown", card)) / 100;
    const first = !o.np && card !== "E" && o.first === "B" ? 0.5 : 0;
    const atkUp = (btMod(u, "atk") - btMod(u, "atkdown") - btMod(t, "defup") + btMod(t, "defdown")) / 100 + (u.t.apVs && String(t.cls) === u.t.apVs.cls ? u.t.apVs.v / 100 : 0);
    const pow = (btMod(u, "vs", "", t) + (o.np ? btMod(u, "np") + (u.t.pm[3] || 0) : 0) + (o.crit ? btMod(u, "crit", card) : 0)) / 100;
    let d = u.atk * 0.23 * (o.np ? o.np / 100 : 1) * (base * (1 + clamp(cardUp, -1, 4)) + first) * clsAtk(u.cls) * aff(u.cls, t.cls) * npcAttr(u.t.attr, t.t.attr)
      * (o.rand != null ? o.rand : 1) * Math.max(0.001, 1 + clamp(atkUp, -1, 4)) * Math.max(0.001, 1 + clamp(pow, -1, 10)) * (o.crit ? 2 : 1) * (o.se || 1);
    if (card === "E") d *= o.ex || 2;
    if (o.busterChain && !o.np) d += u.atk * 0.2;
    d += btMod(u, "dp") + (u.t.pm[4] || 0) - btMod(t, "cut");
    return Math.max(0, d);
  }
  function hit(u, t, total, nh) {
    // the damage lands over the card's hits; whoever is invincible or evades takes none (unless it's ignored)
    if (t.side === "ally" || t.side === "foe") {
      if (!btHas(u, "pierce") && (btTakeOne(t, "invinc") || btTakeOne(t, "evade"))) return {dmg: 0, dodged: true};
    }
    const dmg = Math.round(total);
    t.hp -= dmg; u.stat.dmg += dmg; t.stat.taken += dmg;
    return {dmg: dmg};
  }
  function fall(t, by) {
    if (t.hp > 0 || !t.alive) return false;
    if (t.bars.length) { t.max = t.bars.shift(); t.hp = t.max; t.charge = 0; emit("bar", {who: t.id}); return false; }
    const g = t.buffs.find((b) => b.k === "guts");
    if (g) { t.hp = Math.max(1, g.v || 1000); btTakeOne(t, "guts"); emit("guts", {who: t.id}); return false; }
    t.alive = false; t.hp = 0; if (by) by.stat.kills++;
    emit("fall", {who: t.id, by: by ? by.id : null});
    return true;
  }
  const npGain = (u, t, card, pos, opts) => {
    const o = opts || {}, v = o.np ? BT_GAIN_NP[card] : BT_GAIN[card][pos];
    const cardUp = (btMod(u, "card", card) + (u.t.pm[{B: 0, A: 1, Q: 2}[card]] || 0)) / 100;
    return u.t.rate * (v * (1 + clamp(cardUp, -1, 4)) + (!o.np && card !== "E" && o.first === "A" ? 1 : 0)) * (t.t.td || BT_TDRATE[t.cls] || 1) * (1 + btMod(u, "gain") / 100) * (o.crit ? 2 : 1);
  };
  const starsOf = (u, card, pos, opts) => {
    const o = opts || {}, base = o.np ? (BT_STAR[card] || [0])[0] : BT_STAR[card][pos];
    return clamp(u.t.sg / 100 + base + (!o.np && card !== "E" && o.first === "Q" ? 0.2 : 0) + btMod(u, "drop") / 100 + (o.crit ? 0.2 : 0), 0, 3);
  };

  /* a Noble Phantasm */
  function useNp(u, chainAt, firstCard, ocBonus) {
    const np = u.t.np; if (!np || u.np < 100 || !u.alive || u.stun > 0) return;
    const oc = clamp(1 + (u.np >= 300 ? 2 : u.np >= 200 ? 1 : 0) + (ocBonus || 0) + Math.round(btMod(u, "oc")), 1, 5), lvl = u.npLv;
    u.np = 0; u.stat.nps++;
    const val = (f) => { const vs = f.vals || [0]; return f.by === "oc" ? vs[oc - 1] : f.by === "fix" ? vs[0] : vs[lvl - 1]; };
    const pre = np.fx.filter((f) => f.when === "pre").map((f) => ({k: f.k, to: apply(u, f, val(f), null, np.n)}));
    const hits = [];
    if (np.mult && np.tg !== "S") {
      const ts = np.tg === "AoE" ? foesOf(u) : [B.target && B.target.alive && u.side === "ally" ? B.target : foesOf(u)[0]].filter(Boolean);
      const mult = np.mult[lvl - 1] || np.mult.find((v) => v != null) || 0;
      ts.forEach((t) => {
        const se = np.se && btVsOk(np.se.vs, t) ? (np.se.vals[(np.se.byOc ? oc : lvl) - 1] || 150) / 100 : 1;
        const d = dmgOf(u, t, np.card, chainAt, {np: mult, rand: R(0.9, 1.099), se: se});
        const h = hit(u, t, d);
        if (u.side === "ally" && !h.dodged) { u.np = clamp(u.np + npGain(u, t, np.card, 0, {np: true}) * Math.max(1, np.hits), 0, 300); B.stars = Math.min(50, B.stars + starsOf(u, np.card, 0, {np: true}) * Math.max(1, np.hits)); }
        hits.push({id: t.id, dmg: h.dmg, dodged: !!h.dodged, se: se > 1});
      });
    }
    emit("np", {who: u.id, n: np.n, card: np.card, oc: oc, pre: pre, hits: hits});
    hits.forEach((h) => { const t = B.everyone().find((x) => x.id === h.id); if (t) fall(t, u); });
    const post = np.fx.filter((f) => f.when !== "pre").map((f) => ({k: f.k, to: apply(u, f, val(f), null, np.n)}));
    if (post.length) emit("np-after", {who: u.id, fx: post});
  }

  /* one card */
  function useCard(c, pos, chain) {
    const u = c.u; if (!u.alive || u.stun > 0) return;
    let t = B.target && B.target.alive ? B.target : foesOf(u)[0]; if (!t) return;
    const card = c.card, crit = card !== "E" && c.crit;
    const opts = {first: chain.first, crit: crit, rand: R(0.9, 1.099), busterChain: chain.color === "B" && card !== "E", ex: chain.color && chain.color !== "mix" ? 3.5 : 2};
    const d = dmgOf(u, t, card, Math.min(pos, 2), opts), h = hit(u, t, d);
    let gain = 0, stars = 0;
    if (!h.dodged) {
      const nh = BT_HITS[card];
      gain = npGain(u, t, card, Math.min(pos, 2), opts) * nh; stars = starsOf(u, card, Math.min(pos, 2), opts) * nh;
      u.np = clamp(u.np + gain, 0, 300); B.stars = Math.min(50, B.stars + stars);
    }
    u.stat.cards++;
    emit("card", {who: u.id, card: card, pos: pos, to: t.id, dmg: h.dmg, crit: !!crit, dodged: !!h.dodged, gain: Math.round(gain * 10) / 10});
    fall(t, u);
  }

  /* the enemies' turn */
  function foeAct(f) {
    if (!f.alive) return;
    if (f.stun > 0) { emit("stunned", {who: f.id}); return; }
    const ally = B.allies.filter((x) => x.alive); if (!ally.length) return;
    const pickTarget = () => { const tt = ally.filter((x) => x.alive && btHas(x, "taunt")); const pool = (tt.length ? tt : ally).filter((x) => x.alive); return pool[Math.floor(rng() * pool.length)]; };
    // a full charge (or a full gauge, for a servant): the big attack
    if (f.charge >= f.chargeMax) {
      f.charge = 0;
      const np = f.t.np, ts = !np ? (f.t.npAoe ? ally.slice() : [pickTarget()]) : np.tg === "AoE" ? ally.slice() : np.tg === "ST" ? [pickTarget()] : [];
      const hits = [];
      if (np && np.tg !== "S") np.fx.filter((x) => x.when === "pre").forEach((x) => apply(f, x, (x.vals || [0])[0], null, np.n));
      ts.filter(Boolean).forEach((t) => {
        if (!t.alive) return;
        const d = np && np.mult ? dmgOf(f, t, np.card, 0, {np: np.mult[f.t.npLv - 1] || np.mult[0] || 300, rand: R(0.9, 1.099)}) : dmgOf(f, t, ["Q", "A", "B"][Math.floor(rng() * 3)], 0, {rand: R(0.9, 1.099)}) * f.t.npMul;
        const h = hit(f, t, d); if (!h.dodged) t.np = clamp(t.np + 3 * (1 + btMod(t, "gain") / 100), 0, 300);
        hits.push({id: t.id, dmg: h.dmg, dodged: !!h.dodged});
      });
      if (np && np.tg === "S") np.fx.forEach((x) => apply(f, x, (x.vals || [0])[0], null, np.n));
      emit("foe-np", {who: f.id, n: np ? np.n : "Charge attack", hits: hits});
      hits.forEach((h) => { const t = B.allies.find((x) => x.id === h.id); if (t) fall(t, f); });
      return;
    }
    for (let a = 0; a < (f.t.acts || 1); a++) {
      const t = pickTarget(); if (!t) break;
      const card = f.t.servant ? f.t.deck[Math.floor(rng() * 5)] : ["Q", "A", "B"][Math.floor(rng() * 3)], crit = rng() < 0.08;
      const h = hit(f, t, dmgOf(f, t, card, 0, {rand: R(0.9, 1.099), crit: crit}));
      if (!h.dodged) t.np = clamp(t.np + 3 * (1 + btMod(t, "gain") / 100) * (t.t.servant ? 1 : 0), 0, 300);
      emit("foe-hit", {who: f.id, to: t.id, card: card, dmg: h.dmg, crit: crit, dodged: !!h.dodged});
      fall(t, f);
      if (!B.allies.some((x) => x.alive)) break;
    }
    f.charge = Math.min(f.chargeMax, f.charge + 1);
  }

  /* turns */
  function deal() {
    const front = B.allies.filter((x) => x.alive);
    if (B.deck.length < 5) { B.deck = []; front.forEach((u) => u.t.deck.forEach((c) => B.deck.push({u: u, card: c}))); for (let i = B.deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [B.deck[i], B.deck[j]] = [B.deck[j], B.deck[i]]; } }
    B.hand = B.deck.splice(0, 5).filter((c) => c.u.alive);
    // the stars go to the cards: more to servants who gather them, ten per cent of a critical each
    const w = B.hand.map((c) => (c.u.t.sa || 100) * (1 + btMod(c.u, "gather") / 100) * (0.5 + rng()));
    B.hand.forEach((c) => { c.stars = 0; });
    for (let s = 0; s < Math.floor(B.stars); s++) { const sum = w.reduce((a, b) => a + b, 0) || 1; let r = rng() * sum, i = 0; while (i < w.length - 1 && r > w[i]) { r -= w[i]; i++; } if (B.hand[i] && B.hand[i].stars < 10) B.hand[i].stars++; }
    B.hand.forEach((c) => { c.crit = rng() < c.stars / 10; });
    B.stars = 0;
  }
  function nextWave() {
    B.wave += 1; B.foes = B.waves[B.wave - 1] || []; B.target = null;
    emit("wave", {n: B.wave, of: B.waves.length});
  }
  function turnStart() {
    B.turn += 1;
    B.allies.concat(B.foes).forEach((u) => {
      if (!u.alive) return;
      u.buffs.forEach((b) => {
        if (b.k === "npturn" && u.side === "ally") u.np = clamp(u.np + b.v, 0, 300);
        if (b.k === "starturn") B.stars = Math.min(50, B.stars + b.v);
        if (b.k === "regen") u.hp = Math.min(u.max, u.hp + b.v);
      });
    });
    emit("turn", {n: B.turn});
    deal();
  }
  function turnEnd() {
    B.allies.concat(B.foes).forEach((u) => {
      if (!u.alive) return;
      const burn = u.buffs.filter((b) => b.k === "burn").reduce((a, b) => a + b.v, 0);
      if (burn) { u.hp -= burn; emit("burn", {who: u.id, dmg: Math.round(burn)}); fall(u, null); }
      // buffs count down at the end of the turn ("3 turns": this one and the next two)
      u.buffs.forEach((b) => { if (b.d > 0) b.d -= 1; });
      u.buffs = u.buffs.filter((b) => b.d > 0 || b.keep);
      if (u.stun > 0) u.stun -= 1;
      u.cd = u.cd.map((c) => Math.max(0, c - 1));
      if (M && u === B.allies.concat(B.foes).find((x) => x.alive)) M.cd = M.cd.map((c) => Math.max(0, c - 1));
    });
    // the fallen leave the front; whoever waits behind steps in
    for (let i = 0; i < B.allies.length; i++) if (!B.allies[i].alive && B.back.length) { const n = B.back.shift(); emit("swap", {out: B.allies[i].id, in: n.id}); B.allies[i] = n; }
  }

  emit("start", {party: B.allies.concat(B.back).map((u) => u.id), waves: B.waves.map((w) => w.map((u) => u.id))});
  nextWave();
  const AI = setup.ai || BT_AUTO;
  while (!B.over) {
    turnStart();
    if (M) btMasterSkills(B, M, useSkill, 0);
    AI.skills(B, {use: useSkill, mod: btMod});
    if (M) btMasterSkills(B, M, useSkill, 1);
    if (!B.foes.some((x) => x.alive)) { if (B.wave >= B.waves.length) { B.over = true; B.result = "win"; break; } nextWave(); continue; }
    const plan = AI.cards(B, {dmgOf: dmgOf, npGain: npGain});
    emit("plan", {hand: B.hand.map((c) => ({who: c.u.id, card: c.card, crit: !!c.crit})), pick: plan.map((p) => p.np ? {who: p.u.id, np: true} : {who: p.u.id, card: p.card, h: B.hand.indexOf(p)}), target: B.target ? B.target.id : null});
    const colors = plan.map((p) => p.np ? p.u.t.np.card : p.card);
    const chain = {first: colors[0], color: plan.length === 3 && colors.every((c) => c === colors[0]) ? colors[0] : plan.length === 3 ? "mix" : ""};
    // an Arts chain gives everyone in it 20% NP (once each), a Quick chain 10 stars
    if (chain.color === "A") Array.from(new Set(plan.map((p) => p.u))).forEach((u) => { if (u.alive) u.np = clamp(u.np + 20, 0, 300); });
    if (chain.color === "Q") B.stars = Math.min(50, B.stars + 10);
    let npAt = 0;
    plan.forEach((p, pos) => {
      if (!B.foes.some((x) => x.alive)) return;
      if (B.target && !B.target.alive) B.target = BT_AUTO.target(B);
      if (p.np) { useNp(p.u, pos, chain.first, npAt); npAt++; }
      else useCard(p, pos, chain);
    });
    // three cards from one servant: an Extra attack
    if (plan.length === 3 && plan.every((p) => p.u === plan[0].u) && plan[0].u.alive && B.foes.some((x) => x.alive)) {
      if (B.target && !B.target.alive) B.target = BT_AUTO.target(B);
      useCard({u: plan[0].u, card: "E", crit: false}, 3, chain);
    }
    if (!B.foes.some((x) => x.alive)) {
      turnEnd();
      if (B.wave >= B.waves.length) { B.over = true; B.result = "win"; break; }
      nextWave(); continue;
    }
    emit("foes-turn", {});
    B.foes.forEach((f) => { if (B.allies.some((x) => x.alive)) foeAct(f); });
    turnEnd();
    if (!B.allies.some((x) => x.alive)) { B.over = true; B.result = "lose"; break; }
    if (B.turn >= BT_MAX_TURNS) { B.over = true; B.result = "time"; break; }
  }
  emit("end", {result: B.result, turns: B.turn, wave: B.wave});
  return {events: B.ev, result: B.result, turns: B.turn, wave: B.wave, waves: B.waves.length, units: B.everyone().concat(M ? [M] : []).map((u) => ({id: u.id, side: u.master ? "master" : u.side, name: u.name, cls: u.cls, face: u.t.face, max: u.t.hp, stat: u.stat, t: u.t, chargeMax: u.chargeMax})), seed: seed};
}
// the Master's turn: charges first (pass 0, before the servants decide), the rest after them (pass 1)
function btMasterSkills(B, M, cast, pass) {
  const allies = B.allies.filter((x) => x.alive), foes = B.foes.filter((x) => x.alive); if (!allies.length) return;
  const last = B.wave >= B.waves.length, hot = foes.filter((f) => f.charge >= f.chargeMax);
  const danger = hot.length > 0 || allies.some((x) => x.hp < x.max * 0.4);
  const nukers = allies.filter((x) => x.t.np && x.t.np.mult);
  const nuker = nukers.slice().sort((x, y) => (y.np >= 100) - (x.np >= 100) || y.atk * (y.t.np.mult[y.t.npLv - 1] || 0) - x.atk * (x.t.np.mult[x.t.npLv - 1] || 0))[0] || null;
  M.t.sk.forEach((sk, i) => {
    if (!sk || M.cd[i] > 0 || !sk.fx.length) return;
    const ks = sk.fx.map((f) => f.k), ch = sk.fx.find((f) => f.k === "charge");
    if ((pass === 0) !== !!ch) return;
    let use = false, pick = null;
    if (ch) {
      const v = ch.v ? ch.v[sk.lv - 1] : 0;
      if (ch.tg === "o") { const c = nukers.filter((x) => x.np < 100).sort((a, b) => b.np - a.np); pick = c.find((x) => x.np + v >= 100) || (last ? c[0] : null) || null; use = !!pick; }
      else use = allies.some((x) => x.np < 100 && x.np + v >= 100) || (last && allies.some((x) => x.np < 100));
    } else {
      const willNp = allies.filter((x) => x.np >= 100 && x.t.np && x.t.np.mult);
      const help = ks.some((k) => ["atk", "card", "np", "crit", "oc", "pierce"].includes(k));
      if (help && willNp.length) {
        const cf = sk.fx.find((f) => f.k === "card");
        pick = (cf && willNp.find((x) => x.t.np.card === cf.card)) || willNp.find((x) => x === nuker) || willNp[0];
        use = !cf || pick.t.np.card === cf.card || sk.fx.some((f) => f.k !== "card" && ["atk", "np", "oc"].includes(f.k));
      }
      if (!use && ks.some((k) => ["evade", "invinc", "guts", "maxhp", "immune"].includes(k)) && danger) { use = true; pick = allies.slice().sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; }
      if (!use && ks.includes("heal") && allies.some((x) => x.hp < x.max * 0.6)) { use = true; pick = allies.slice().sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; }
      if (!use && ks.includes("cleanse") && allies.some((x) => x.buffs.some((b) => BT_DEBUFF.has(b.k)))) { use = true; pick = allies.find((x) => x.buffs.some((b) => BT_DEBUFF.has(b.k))); }
      if (!use && (ks.includes("stun") || ks.includes("chargedown")) && hot.length) { use = true; pick = hot[0]; }
      if (!use && ks.includes("cd")) { const w = allies.filter((x) => x.cd.some((c) => c > 1)).sort((a, b) => b.cd.reduce((s, c) => s + c, 0) - a.cd.reduce((s, c) => s + c, 0))[0]; if (w) { use = true; pick = w; } }
      if (!use && ks.every((k) => ["stars", "gather", "drop", "gain", "regen"].includes(k))) { use = true; pick = nuker || allies[0]; }
    }
    if (use) cast(M, i, pick);
  });
}

/* ---------- the auto-battle: which skills, which target, which cards ---------- */
const BT_HELP = new Set(["atk", "card", "np", "crit", "vs", "dp", "pierce", "defdown", "resdown"]);
const BT_GUARD = new Set(["invinc", "evade", "defup", "cut", "taunt", "guts", "heal", "maxhp", "immune", "dres", "atkdown", "chargedown", "stun", "charm", "cleanse"]);
const BT_AUTO = {
  // the enemy that's about to use its big attack first, if any; else the one with the least HP left
  target(B) {
    const f = B.foes.filter((x) => x.alive); if (!f.length) return null;
    const hot = f.filter((x) => x.charge >= x.chargeMax);
    return (hot.length ? hot : f).slice().sort((a, b) => (a.hp + a.bars.reduce((s, v) => s + v, 0)) - (b.hp + b.bars.reduce((s, v) => s + v, 0)))[0];
  },
  // who hits hardest with their NP
  nuker(B) {
    const a = B.allies.filter((x) => x.alive && x.t.np && x.t.np.mult);
    return a.slice().sort((x, y) => (y.atk * (y.t.np.mult[y.t.npLv - 1] || 0) * (BT_NP_CARD[y.t.np.card] || 1)) - (x.atk * (x.t.np.mult[x.t.npLv - 1] || 0) * (BT_NP_CARD[x.t.np.card] || 1)))[0] || null;
  },
  skills(B, api) {
    B.target = BT_AUTO.target(B);
    const allies = () => B.allies.filter((x) => x.alive), danger = B.foes.some((f) => f.alive && f.charge >= f.chargeMax - 0) || allies().some((x) => x.hp < x.max * 0.4);
    const last = B.wave >= B.waves.length;
    // the skills that charge NP first (they decide who can use their NP this turn), then the rest
    for (let pass = 0; pass < 2; pass++) {
      allies().forEach((u) => (u.t.sk || []).forEach((sk, i) => {
        if (!sk || u.cd[i] > 0 || u.stun > 0) return;
        const ks = sk.fx.map((f) => f.k), charges = ks.includes("charge");
        if (pass === 0 && !charges) return;
        if (pass === 1 && charges) return;
        const nk = BT_AUTO.nuker(B);
        let pick = null, use = false;
        if (charges) {
          const f = sk.fx.find((x) => x.k === "charge"), v = f.v ? f.v[sk.lv - 1] : 0;
          if (f.tg === "o") { const cand = allies().filter((x) => x.t.np && x.t.np.mult && x.np < 100).sort((a, b) => b.np - a.np); pick = cand.find((x) => x.np + v >= 100) || cand[0] || null; use = !!pick; }
          else { const who = f.tg === "s" ? [u] : allies(); use = who.some((x) => x.np < 100 && x.np + v >= 100) || who.some((x) => x.np < 100) && (last || B.turn === 1); }
        } else {
          const willNp = allies().some((x) => x.np >= 100 && x.t.np && x.t.np.mult);
          const help = ks.some((k) => BT_HELP.has(k)), guard = ks.some((k) => BT_GUARD.has(k)), other = !help && !guard;
          if (help && (willNp || (last && B.foes.filter((x) => x.alive).length === 1))) use = true;
          if (guard && danger) use = true;
          if (ks.includes("heal") && allies().some((x) => x.hp < x.max * 0.6)) use = true;
          if (ks.includes("cleanse") && allies().some((x) => x.buffs.some((b) => BT_DEBUFF.has(b.k)))) use = true;
          if (other || ks.every((k) => ["gain", "stars", "starturn", "drop", "gather", "npturn", "regen", "cd"].includes(k))) use = true;
          if (sk.fx.some((f) => f.tg === "o")) pick = nk && sk.fx.some((f) => BT_HELP.has(f.k)) ? nk : allies().slice().sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
        }
        if (use) api.use(u, i, pick);
      }));
    }
  },
  // NPs first (support ones before damage), then the face cards that do the most, with a bonus for chains
  cards(B, api) {
    const nps = B.allies.filter((u) => u.alive && u.stun <= 0 && u.t.np && u.np >= 100).sort((a, b) => (a.t.np.tg === "S" ? 0 : 1) - (b.t.np.tg === "S" ? 0 : 1)).slice(0, 3);
    const plan = nps.map((u) => ({u: u, np: true}));
    const n = 3 - plan.length; if (!n) return plan;
    const hand = B.hand.filter((c) => c.u.alive && c.u.stun <= 0), t = B.target || BT_AUTO.target(B);
    if (!t) return plan;
    let best = null, bestS = -1;
    const perm = (arr, k, pre, out) => { if (pre.length === k) { out.push(pre.slice()); return; } arr.forEach((x, i) => { if (pre.includes(x)) return; pre.push(x); perm(arr, k, pre, out); pre.pop(); }); return out; };
    const tries = perm(hand, Math.min(n, hand.length), [], []);
    tries.forEach((cs) => {
      const all = plan.concat(cs), colors = all.map((p) => p.np ? p.u.t.np.card : p.card), first = colors[0];
      const mono = all.length === 3 && colors.every((c) => c === colors[0]);
      let s = 0;
      cs.forEach((c, j) => {
        const pos = plan.length + j;
        s += api.dmgOf(c.u, t, c.card, Math.min(pos, 2), {first: first, crit: c.crit, busterChain: mono && colors[0] === "B"});
        const g = api.npGain(c.u, t, c.card, Math.min(pos, 2), {first: first, crit: c.crit}) * BT_HITS[c.card];
        if (c.u.t.np && c.u.np < 100) s += g * (c.u.atk * 0.6);
      });
      if (mono && colors[0] === "A") s += all.reduce((a, p) => a + (p.u.np < 100 ? 20 * p.u.atk * 0.6 : 0), 0);
      if (mono && colors[0] === "Q") s += 2500;
      if (all.length === 3 && all.every((p) => p.u === all[0].u)) s += api.dmgOf(all[0].u, t, "E", 0, {ex: mono ? 3.5 : 2});
      if (s > bestS) { bestS = s; best = cs; }
    });
    return plan.concat(best || []);
  }
};

// for the tests: the engine on its own, without the page around it (it changes nothing on its own)
try { Object.defineProperty(window, "__fgiBattle", {value: Object.freeze({run: btBattle, fromServant: btFromServant, fromNA: btFromNA, made: btFromMade, asFoe: btAsFoe, read: (line, rows) => btClauses(line).map((l) => btReadLine(l, (rows || []).slice())).filter(Boolean), skill: btSkillNA, servants: () => JSON.parse(JSON.stringify(S.servants))}), configurable: true}); } catch (e) {}
