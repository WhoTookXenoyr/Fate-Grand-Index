/* ================= 0.53.0-beta: skills written by hand are read, and the whole deck is shown =================
   Noyr: a skill he writes himself ("Grants 1 Waterside Battlefield Buster+") got "written by hand, so it can't be
   counted" under it, and no damage. That line is gone. An effect written by hand is read from its words:

   - what it is: Buster / Arts / Quick up, ATK up, NP Strength up, critical damage up, special attack against a trait,
     Damage Plus, enemy DEF down, card resistance down, or plain "damage up" (counted like a special attack that always
     applies). "Buster+", "Buster up", "Buster performance", "boosts Buster cards" all read as Buster up.
   - how much: a number in the words ("by 30%", "20% → 30%", "+500 damage"); else the effect's own Lv 1 → Lv 10 boxes;
     else what the game usually gives for that kind of effect at that skill level. The last one is an estimate and the
     page says so, with the number it took, so it can be corrected by writing the number.
   - words that don't touch damage (NP Gain, stars, healing, Evade …) are named as such. Words it finds nothing in are
     shown as "no damage effect found in these words", with what to write.
   A condition in the words ("on a Waterside field", "50% chance", "when HP is low") is counted as met, and said.

   The damage block shows the whole deck, card by card, with what the skill gives each of them, the Extra attack and
   the Noble Phantasm; the table under it has every row, changed or not; and "All skills together" adds the three up. */
const SR_LABEL = {atk: "ATK up", np: "NP Strength up", crit: "Critical damage up", pow: "Special attack", dmg: "Damage up", dp: "Damage Plus", def: "Enemy DEF down"};
// what the game usually gives [Lv 1, Lv 10]: to yourself, and to the party
const SR_TYPICAL = {atk: [[20, 30], [10, 20]], card: [[30, 50], [10, 20]], np: [[20, 30], [10, 20]], crit: [[50, 100], [20, 40]], pow: [[30, 50], [30, 50]], dmg: [[20, 30], [10, 20]], dp: [[200, 500], [200, 500]], def: [[10, 20], [10, 20]], res: [[10, 20], [10, 20]]};
const SR_UTIL = [[/\bnp\b[^.]*\b(?:gain|generation|refund)|\bnp gain/, "NP Gain"], [/\bnp\b[^.]*\b(?:gauge|charge)|charge\w* [^.]*\bnp\b|\bgauge\b/, "NP charge"], [/overcharge/, "Overcharge"], [/\bstars?\b/, "Critical Stars"],
  [/critical (?:rate|chance)|crit (?:rate|chance)/, "critical rate"], [/\bheal|\bhp\b|\bregen/, "HP"], [/invinc/, "Invincible"], [/\bevade|\bevasion|\bdodge/, "Evade"], [/\bguts\b/, "Guts"], [/sure ?hit/, "Sure Hit"],
  [/ignore def/, "Ignore DEF (only matters against a DEF buff)"], [/\bdef(?:en[cs]e)?\b/, "DEF"], [/debuff|immun|cleanse|remove/, "debuffs"], [/cooldown/, "cooldowns"], [/taunt|target focus/, "Target Focus"],
  [/stun|charm|sleep|seal|poison|curse|burn|death/, "a status on the enemy"], [/\batk\b|\battack\b/, "enemy ATK"]];
const srCap = (c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
// the words → clauses; "Buster & Arts" stays one thing
function srClauses(txt) {
  const t = String(txt || "").replace(/\s+/g, " ").trim()
    .replace(/\b(buster|arts|quick)\s*(?:&|and|,|\/)\s*(?=(?:buster|arts|quick)\b)/gi, "$1/");
  return t.split(/\s*(?:&|;|\s\+\s(?!\d)|\band\b|\.\s|\n|,\s*(?=(?:and\s+)?(?:increase|decrease|reduce|grant|gain|apply|charge|deal|restore|remove|inflict|boost|raise|lower)))\s*/i).map((x) => x.trim()).filter(Boolean);
}
// the number in a clause: [Lv 1, Lv 10], or null
function srVals(cl, flat) {
  const c = String(cl).replace(/\d+(?:\.\d+)?\s*%\s*chance/gi, " ");
  let m = /(\d+(?:\.\d+)?)\s*%?\s*(?:-|–|—|~|→|->|\bto\b)\s*(\d+(?:\.\d+)?)\s*%/.exec(c);
  if (m) return [Number(m[1]), Number(m[2])];
  m = /(\d+(?:\.\d+)?)\s*%/.exec(c);
  if (m) return [Number(m[1]), Number(m[1])];
  if (flat) {
    m = /(\d{2,6})\s*(?:-|–|—|~|→|->|\bto\b)\s*(\d{2,6})/.exec(c); if (m) return [Number(m[1]), Number(m[2])];
    m = /(\d{2,6})(?!\s*(?:%|turns?|times?))/.exec(c); if (m) return [Number(m[1]), Number(m[1])];
  }
  return null;
}
// one clause → {k, card, cards, vs, label, util, why} (k: atk, card, np, crit, pow, dmg, dp, def, res; or util / none)
function srKind(cl) {
  const c = " " + cl.toLowerCase() + " ";
  const cards = Array.from(new Set((c.match(/\b(buster|arts|quick)\b/g) || []).map(srCap)));
  const down = /\b(?:down|decreas\w*|reduc\w*|lower\w*|weaken\w*|shred\w*)\b|[a-z]\s?-(?=[\s\d)])/.test(c);
  const foe = /\benem|\bfoe|\btarget\b|\bopponent/.test(c);
  const upish = /\bup\b|\+|increas|boost|rais|enhanc|amplif|buff|strengthen|more\b|bonus|grant|gain|appl/.test(c);
  if (/ignore def/.test(c)) return {k: "util", label: "Ignore DEF (only matters against a DEF buff)"};
  if (/\bdef(?:en[cs]e)?\b/.test(c) && down && !/\batk\b|\battack\b/.test(c)) return {k: "def", label: SR_LABEL.def};
  if (cards.length && /resist/.test(c) && (down || foe)) return {k: "res", cards: cards, label: cards.join(" & ") + " resistance down"};
  if (/crit/.test(c)) { if (/damage|strength|power|\bup\b|\+|boost/.test(c) && !/rate|chance|\bstars?\b/.test(c)) return {k: "crit", label: SR_LABEL.crit}; return {k: "util", label: /\bstars?\b/.test(c) ? "Critical Stars" : "critical rate"}; }
  if (/\b(?:np|noble phantasm)\b/.test(c) && !/gain|gauge|charge|generat|regen|refund|overcharge|seal/.test(c) && /strength|damage|power|\bup\b|\+|boost|increas|enhanc/.test(c)) return {k: "np", label: SR_LABEL.np};
  if (/\bagainst\b|\bvs\.?\s|special attack|super ?effective|power mod|damage (?:to|against)\b/.test(c)) {
    const b = /\[([^\]]{1,40})\]/.exec(cl) || /(?:against|vs\.?|damage to)\s+(?:all |the |an? )?([a-z][a-z' -]{1,30}?)(?:\s+(?:enem\w*|foes?|targets?|servants?|class\w*|trait\w*)\b|\s*\(|\s+by\b|\s+for\b|\s+[+\d]|,|$)/i.exec(cl);
    const vs = b ? b[1].trim() : "";
    return {k: "pow", vs: vs, label: "Special attack" + (vs ? " against " + vs : "")};
  }
  if (/damage plus|flat damage|divinity|\b(?:extra|additional|bonus)\b[^%]*\bdamage\b|\+\s*\d{2,}\s*(?:flat\s*)?damage|damage (?:by|\+|of)\s*\d{2,}(?!\s*%|\d)/.test(c) && !/%/.test(c)) return {k: "dp", label: SR_LABEL.dp};
  if (cards.length && !/\bstars?\b|gather|absor|resist|\bnp gain|gauge/.test(c)) return {k: "card", cards: cards, label: cards.join(" & ") + " up"};
  if (/\batk\b|\battack\b/.test(c) && !(down && foe) && !down) return {k: "atk", label: SR_LABEL.atk};
  if (/\bdamage\b|\bpower\b|\bmight\b/.test(c) && upish && !down && !/\bcut\b|taken|received|\breduc/.test(c)) return {k: "dmg", label: SR_LABEL.dmg};
  const u = SR_UTIL.find((r) => r[0].test(c));
  return u ? {k: "util", label: u[1]} : {k: "none"};
}
// a hand-written effect at a skill level → [{k, card, v, v1, v10, label, src: "text" | "values" | "typical", notes: []}]
function srRead(f, lv) {
  const txt = String((f && f.txt) || "").trim(), name = String((f && f.l) || "").trim();
  const src = txt || name; if (!src) return [];
  const all = " " + src.toLowerCase() + " ";
  const others = /other allies|allies except|except (?:your)?self|all allies other than/.test(all), party = /all allies|\bparty\b|every ally|allies'/.test(all);
  const chance = /(\d+(?:\.\d+)?)\s*%\s*chance/i.exec(src);
  const cond = /\bif\b|\bwhen\b|\bwhile\b|\bfield\b|battlefield|\bonly\b|\bduring\b|\bon (?:a|the)\b/i.test(src);
  const stack = /\b(?:grants?|gains?|appl(?:y|ies)|adds?|stacks?)\s+(\d)\s+(?!turns?\b|times?\b)/i.exec(src), n = stack ? clamp(Number(stack[1]), 1, 9) : 1;
  const out = [];
  let cls = srClauses(src).map((cl) => Object.assign(srKind(cl), {cl: cl}));
  // a part that only says when ("When on a Burning field, …") is a condition, not an effect
  cls = cls.filter((x) => !(/^(?:when|if|while|during|on|in|at|after|before|once)\b/i.test(x.cl) && (x.k === "util" || x.k === "none")) || cls.length === 1);
  // nothing in the sentence, but the value's name says it ("Buster Up" with the boxes filled)
  if (!cls.some((x) => x.k !== "none" && x.k !== "util") && name && txt) { const k2 = Object.assign(srKind(name), {cl: name}); if (k2.k !== "none" && k2.k !== "util") cls = [k2].concat(cls.filter((x) => x.k === "util")); }
  const counted = cls.filter((x) => x.k !== "none" && x.k !== "util");
  const own = num(f.v1) != null && num(f.v10) != null ? [num(f.v1), num(f.v10)] : null;
  const needs = counted.filter((x) => !srVals(x.cl, x.k === "dp")).length;
  counted.forEach((x) => {
    const flat = x.k === "dp", notes = [];
    let pair = srVals(x.cl, flat), from = "text";
    // the Lv 1 → Lv 10 boxes are this effect's number when the words carry none (and only one part needs one)
    if (!pair && own && needs === 1 && (flat ? f.u !== "%" : (f.u || "%") === "%")) { pair = own; from = "values"; }
    // (several stacks of an unnamed amount: each one the smaller, party-sized amount)
    if (!pair) { pair = SR_TYPICAL[x.k][party || others || n > 1 ? 1 : 0]; from = "typical"; }
    let v = num(skVals(pair[0], pair[1])[clamp(lv, 1, 10) - 1]) || 0;
    if (n > 1) { v *= n; notes.push("× " + n + " stacks"); }
    if (chance) notes.push("works " + chance[1] + "% of the time: counted as if it does");
    else if (cond) notes.push("counted as if its condition is met");
    if (x.k === "pow") notes.push("only against " + (x.vs || "its target"));
    if (x.k === "crit") notes.push("on criticals");
    (x.cards || [""]).forEach((card) => out.push({k: x.k, card: card, v: v, v1: pair[0] * n, v10: pair[1] * n, label: x.cards ? card + (x.k === "res" ? " resistance down" : " up") : x.label, src: from, notes: notes.slice(), others: others, u: flat ? "" : "%"}));
  });
  cls.filter((x) => x.k === "util").forEach((x) => out.push({k: "util", label: x.label}));
  if (!out.length) out.push({k: "none", label: src});
  return out;
}
// … into the buffs of 58-workshop-damage.js
function srInto(B, f, lv) {
  srRead(f, lv).forEach((r) => {
    if (r.k === "util") { B.plain.push(r.label); return; }
    if (r.k === "none") { B.left.push("“" + (r.label.length > 60 ? r.label.slice(0, 57) + "…" : r.label) + "”: no damage effect found in these words. Write what it raises, like “Buster up 30%”, “ATK +20%”, “NP damage up” or “damage against [Dragon] +50%”"); return; }
    if (r.others) { B.left.push(r.label + ": it goes to the other allies, not to this servant"); return; }
    if (r.k === "card" || r.k === "res") B.card[r.card] += r.v;
    else if (r.k === "def") B.atk += r.v;
    else if (r.k === "dmg") B.pow += r.v;
    else B[r.k] += r.v;
    B.used.push({t: r.label, v: r.v, u: r.u, k: r.k === "res" ? "card" : r.k === "def" ? "atk" : r.k === "dmg" ? "pow" : r.k, card: r.card || "", read: true, est: r.src === "typical", range: r.v1 === r.v10 ? "" : r.v1 + r.u + " → " + r.v10 + r.u,
      note: r.notes.join("; ")});
  });
}

/* ---------- the block under a skill: read as …, the deck, the table ---------- */
let WSD_ALL = false; // the three skills together
function wsdSum(k, lv3) {
  const B = wsdBuffs({fx: []}, 10);
  k.sk.forEach((s, i) => { const b = wsdBuffs(s, lv3[i]); ["atk", "np", "crit", "pow", "dp"].forEach((q) => { B[q] += b[q]; }); CARDS.forEach((c) => { B.card[c] += b.card[c]; });
    b.used.forEach((u) => B.used.push(Object.assign({}, u, {sk: i + 1}))); b.left.forEach((x) => B.left.push(x)); b.plain.forEach((x) => { if (!B.plain.includes(x)) B.plain.push(x); }); });
  return B;
}
// the Extra attack: the card after three of this servant's cards (× 2; no card buff touches it)
function wsdExtra(k, B, crit, eff) {
  const A = wsdBase(k);
  return A.atk * 0.23 * 1 * 2 * A.cls * (1 + B.atk / 100) * (1 + B.pow / 100) * (eff || 1) + A.dp + B.dp;
}
wsSkDmgHTML = function () {
  const k = W.k, si = W.sk, lv3 = [0, 1, 2].map((i) => clamp(W.copy ? num(W.copy.skills[i]) || 10 : 10, 1, 10)), lv = lv3[si], npLv = clamp(W.copy ? num(W.copy.np) || 1 : 1, 1, 5);
  const A = wsdBase(k), Z = wsdZero(), B = WSD_ALL ? wsdSum(k, lv3) : wsdBuffs(k.sk[si], lv);
  // the equipped Mystic Code's damage skills, on top (62-mystic-codes.js)
  if (typeof mcDmgInto === "function") mcDmgInto(B);
  const tabs = `<div class="ws-dmg-bar"><div class="seg sm ws-dmg-scope" role="group" aria-label="Which skills"><button type="button" data-wsd="one" aria-pressed="${!WSD_ALL}">This skill</button><button type="button" data-wsd="all" aria-pressed="${WSD_ALL}">All skills together</button></div>${typeof mcPickHTML === "function" ? `<div class="ws-dmg-mc">${mcPickHTML("wsd-mc", "ws-mini")}</div>` : ""}</div>`;
  if (!WSD_ALL && !k.sk[si].fx.length && !(typeof mcOn === "function" && mcOn())) return tabs + `<p class="muted">Add an effect and its damage shows here.</p>`;
  const val = (u) => (u.v >= 0 ? "+" : "−") + String(Math.round(Math.abs(u.v) * 100) / 100) + u.u;
  const used = B.used.map((u) => `<li class="${u.est ? "est" : ""}${u.read ? " read" : ""}${u.mc ? " mc" : ""}">${u.sk ? `<span class="n">S${u.sk}</span>` : ""}${u.mc ? `<span class="n">MC</span>` : ""}${esc(u.t)} <b>${esc(val(u))}</b>${u.est ? ` <small class="assumed">estimate: no number written, so the usual ${esc(u.range || val(u))} for this kind of effect</small>` : ""}${u.note ? ` <small>${esc(u.note)}</small>` : ""}</li>`).join("");
  const plain = B.plain.length ? `<p class="ws-dmg-left">Also in ${WSD_ALL ? "these skills" : "this skill"}, without a hand in damage: ${B.plain.map(esc).join(", ")}.</p>` : "";
  const left = B.left.length ? `<p class="ws-dmg-left warn">${B.left.map(esc).join(" · ")}</p>` : "";
  // the deck, card by card
  const chips = (card, np, extra) => {
    const c = [];
    if (card && B.card[card]) c.push(card + " +" + Math.round(B.card[card] * 100) / 100 + "%");
    if (B.atk) c.push("ATK +" + Math.round(B.atk * 100) / 100 + "%");
    if (np && B.np) c.push("NP +" + Math.round(B.np * 100) / 100 + "%");
    if (B.pow) c.push("special +" + Math.round(B.pow * 100) / 100 + "%");
    if (!np && B.crit) c.push("critical +" + Math.round(B.crit * 100) / 100 + "%");
    if (B.dp) c.push("+" + fmt(B.dp) + " flat");
    return c;
  };
  const tile = (cls, img, name, a, b, ch, sub) => `<li class="ws-dk c-${cls}${b !== a ? " hit" : ""}"><span class="ws-dk-card">${img ? `<img src="${img}" alt="">` : `<i>EX</i>`}<b>${esc(name)}</b></span>
    <span class="ws-dk-num">${b !== a ? `<s>${fmt(a)}</s> <strong>${fmt(b)}</strong> <em>${b > a ? "+" : "−"}${(Math.abs(b - a) / Math.max(1, a) * 100).toFixed(1).replace(/\.0$/, "")}%</em>` : `<strong>${fmt(a)}</strong> <em class="same">unchanged</em>`}</span>
    <span class="ws-dk-buffs">${ch.length ? ch.map((x) => `<i>${esc(x)}</i>`).join("") : `<i class="none">${esc(sub || "nothing here touches it")}</i>`}</span></li>`;
  const letters = String(k.deck || "").toUpperCase().split("").map((l) => ({Q: "Quick", A: "Arts", B: "Buster"})[l]).filter(Boolean);
  const r = Math.round;
  const deck = letters.map((c) => tile(c.toLowerCase(), CARD_IMG[c], c, r(wsdCard(k, c, Z, false)), r(wsdCard(k, c, B, false)), chips(c, false)));
  deck.push(tile("extra", "", "Extra", r(wsdExtra(k, Z)), r(wsdExtra(k, B)), chips("", false).filter((x) => !/^critical/.test(x)), "card buffs don't reach the Extra attack"));
  const np0 = wsdNp(k, npLv, Z);
  if (np0) deck.push(tile(k.np.card.toLowerCase() + " np", CARD_IMG[k.np.card], "NP" + npLv, r(np0), r(wsdNp(k, npLv, B)), chips(k.np.card, true)));
  // the table: every row
  const cell = (fn) => { const a = fn(Z), b = fn(B); return a == null ? null : {a: r(a), b: r(b)}; };
  const rows = [];
  if (np0) rows.push({k: "np", card: k.np.card, t: k.np.card + " NP", cells: [cell((x) => wsdNp(k, npLv, x)), null, A.eff ? cell((x) => wsdNp(k, npLv, x, A.eff)) : null, null]});
  CARDS.filter((c) => letters.includes(c)).forEach((c) => rows.push({k: c, card: c, t: c + " card", cells: [cell((x) => wsdCard(k, c, x, false)), cell((x) => wsdCard(k, c, x, true)), A.eff ? cell((x) => wsdCard(k, c, x, false, A.eff)) : null, A.eff ? cell((x) => wsdCard(k, c, x, true, A.eff)) : null]}));
  rows.push({k: "extra", card: "Extra", t: "Extra attack", cells: [cell((x) => wsdExtra(k, x)), null, A.eff ? cell((x) => wsdExtra(k, x, false, A.eff)) : null, null]});
  const c2 = (c) => !c ? `<td class="none">–</td>` : c.b === c.a ? `<td class="same">${fmt(c.a)}</td>` : `<td><span class="was">${fmt(c.a)}</span><b>${fmt(c.b)}</b><i>${c.b > c.a ? "+" : "−"}${fmt(Math.abs(c.b - c.a))}${c.a ? " (" + (c.b > c.a ? "+" : "−") + (Math.abs(c.b - c.a) / c.a * 100).toFixed(1).replace(/\.0$/, "") + "%)" : ""}</i></td>`;
  const any = rows.some((x) => x.cells.some((c) => c && c.b !== c.a));
  return `${tabs}
    ${used ? `<p class="ws-dmg-h">Counted</p><ul class="ws-dmg-used">${used}</ul>` : `<p class="muted">${WSD_ALL ? "Nothing in these skills" : "Nothing in this skill"} changes this servant's own damage.</p>`}
    <p class="ws-dmg-h">The deck <small>${esc(String(k.deck || ""))}, one card on its own, a normal hit</small></p>
    <ul class="ws-deck">${deck.join("")}</ul>
    <div class="ws-dmg-scroll"><table class="ws-ntab ws-dmg-t"><thead><tr><th></th><th>Hit</th><th>Critical</th><th>Effective</th><th>Effective critical</th></tr></thead>
    <tbody>${rows.map((x) => `<tr class="c-${x.card.toLowerCase()}" data-k="${x.k}"><th>${CARD_IMG[x.card] ? `<img src="${CARD_IMG[x.card]}" alt="">` : ""}${esc(x.t)}${x.k === "np" ? ` <small>NP${npLv}</small>` : ""}</th>${x.cells.map(c2).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="ws-dmg-note">Without ${WSD_ALL ? "the skills" : "the skill"}, then with ${WSD_ALL ? "them" : "it"}${typeof mcOn === "function" && mcOn() ? " and the Mystic Code's (" + esc(mcOn().n) + ", Lv " + mcLv() + ")" : ""}, at skill level ${WSD_ALL ? lv3.join(" / ") : lv}. ATK ${fmt(A.atk)} (max level, with the passives, no Craft Essence), a neutral enemy, the average roll, one card on its own. The Extra attack is the one after three of this servant's cards (× 2).${A.eff ? ` Effective: a class ${esc(k.cls)} beats (× ${A.eff}).` : ""}${any ? "" : ""}</p>${plain}${left}`;
};
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-wsd]"); if (!b) return;
  WSD_ALL = b.dataset.wsd === "all";
  const el = b.closest('[data-live="skdmg"]'); if (el) el.innerHTML = wsSkDmgHTML();
});
/* ---------- under the hand-written effect itself: what it was read as ---------- */
function srLineHTML(f, lv) {
  const R = srRead(f, lv); if (!R.length) return "";
  const parts = R.map((r) => r.k === "util" ? `${esc(r.label)} (no damage)` : r.k === "none" ? `<span class="warn">no damage effect found</span>` : `<b>${esc(r.label)} ${r.v1 === r.v10 ? esc(r.v1 + r.u) : esc(r.v1 + r.u + " → " + r.v10 + r.u)}</b>${r.src === "typical" ? ` <span class="assumed">estimate</span>` : ""}`);
  return `<p class="ws-read">Read as: ${parts.join(", ")}</p>`;
}
WS_LIVE.srline = (d) => { try { const m = /^sk\.(\d)\.fx\.(\d+)$/.exec(d.p || ""); if (!m) return ""; const f = W.k.sk[m[1]].fx[m[2]]; return f && f.e === "own" ? srLineHTML(f, clamp(W.copy ? num(W.copy.skills[m[1]]) || 10 : 10, 1, 10)) : ""; } catch (e) { return ""; } };
// for the tests
window.__fgiSkillRead = (txt, o) => srRead(Object.assign({e: "own", txt: txt}, o || {}), (o && o.lv) || 10);
const fgiSkillDmg61 = window.__fgiSkillDmg;
window.__fgiSkillDmg = (si, all) => { const o = fgiSkillDmg61(si); if (all) { const lv3 = [0, 1, 2].map((i) => clamp(W.copy ? num(W.copy.skills[i]) || 10 : 10, 1, 10)); o.buffs = wsdSum(W.k, lv3); } o.extra = (B) => wsdExtra(W.k, B || o.buffs); return o; };
