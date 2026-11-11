/* ================= 0.52.0-beta: what a custom skill adds to damage =================
   In the Workshop, under each skill: the damage of the Noble Phantasm and of the servant's own cards without the
   skill and with it, so that "Arts up 30%" reads as numbers. The game's formulas, the same ones the NP calculator
   uses (30-np-calc.js):
     NP    ATK × 0.23 × NP% × card × (1 + card up) × class × (1 + ATK up + DEF down) × (1 + special attack + NP Strength) + Damage Plus
     card  ATK × 0.23 × card × (1 + card up) × class × (1 + ATK up + DEF down) × (1 + special attack + critical up, on a critical)
           × 2 on a critical + Damage Plus
   A card stands for one card on its own (Buster 1.5, Arts 1, Quick 0.8): no first-card bonus, no chain, the average
   roll. "Effective" is against a class the servant beats (× 2, Berserker × 1.5). ATK is the kit's at max level, with
   its passives; no Craft Essence, no other skill. */
const WSD_KIND = {atk: "atk", np: "np", crit: "crit", vs: "pow", dp: "dp", defdown: "atk"};
// what one skill gives this servant at a skill level: {atk, np, crit, pow, dp, card: {Buster, Arts, Quick}} in % (dp in damage)
function wsdBuffs(s, lv) {
  const B = {atk: 0, np: 0, crit: 0, pow: 0, dp: 0, card: {Buster: 0, Arts: 0, Quick: 0}, used: [], left: [], plain: []};
  for (const f of (s && s.fx) || []) {
    const def = FX_BY[f.e]; if (!def) continue;
    const v = def.v && f.v ? num(skVals(num(f.v[0]) || 0, num(f.v[1]) || 0)[clamp(lv, 1, 10) - 1]) || 0 : 0;
    const label = fxLabel(f, W.k.np.card) || def.t, card = CARDS.includes(f.card) ? f.card : "Buster";
    const kind = f.e === "card" || f.e === "resdown" ? "card" : WSD_KIND[f.e];
    // an effect written by hand is read from its words (61-skill-reader.js): never "can't be counted"
    if (f.e === "own") { srInto(B, f, lv); continue; }
    if (!kind) continue;
    if (f.tg === "x") { B.left.push(label + ": it goes to the other allies, not to this servant"); continue; }
    if (!v) continue;
    if (kind === "card") B.card[card] += v; else B[kind] += v;
    B.used.push({t: label, v: v, u: def.u === "damage" ? "" : "%", k: kind, card: kind === "card" ? card : "", note: f.e === "vs" ? "only against " + (String(f.vs || "").trim() || "its trait") : f.e === "crit" ? "on criticals" : ""});
  }
  return B;
}
function wsdBase(k) {
  const pm = [0, 0, 0, 0, 0]; (k.ps || []).forEach((p) => { const v = psValue(p); if (v) pm[v.slot] += v.v; });
  return {atk: num(k.atk && k.atk[1]) || 0, cls: NPC_CLASS_ATK[k.cls] || 1, card: {Buster: pm[0], Arts: pm[1], Quick: pm[2]}, dp: pm[4], eff: k.cls === "Shielder" ? 0 : k.cls === "Berserker" ? 1.5 : 2};
}
const wsdZero = () => ({atk: 0, np: 0, crit: 0, pow: 0, dp: 0, card: {Buster: 0, Arts: 0, Quick: 0}});
function wsdNp(k, npLv, B, eff) {
  const A = wsdBase(k), card = k.np.card, pct = num((k.np.dmg || [])[clamp(npLv, 1, 5) - 1]);
  if (k.np.tg === "Support" || !pct) return null;
  return A.atk * 0.23 * (pct / 100) * (NPC_CARD[card] || 1) * (1 + (A.card[card] + B.card[card]) / 100) * A.cls * (1 + B.atk / 100) * (1 + (B.pow + B.np) / 100) * (eff || 1) + A.dp + B.dp;
}
function wsdCard(k, card, B, crit, eff) {
  const A = wsdBase(k);
  return A.atk * 0.23 * (NPC_CARD[card] || 1) * (1 + (A.card[card] + B.card[card]) / 100) * A.cls * (1 + B.atk / 100) * (1 + (B.pow + (crit ? B.crit : 0)) / 100) * (crit ? 2 : 1) * (eff || 1) + A.dp + B.dp;
}
// the rows for one skill: [{k: "np" | card, t, cells: [{a: without, b: with} | null × 4]}] (hit, critical, effective, effective critical)
function wsdRows(k, si, lv, npLv) {
  const B = wsdBuffs(k.sk[si], lv), Z = wsdZero(), A = wsdBase(k), rows = [];
  const cell = (fn) => { const a = fn(Z), b = fn(B); return a == null ? null : {a: Math.round(a), b: Math.round(b)}; };
  if (wsdNp(k, npLv, Z)) rows.push({k: "np", card: k.np.card, t: k.np.card + " NP", cells: [cell((x) => wsdNp(k, npLv, x)), null, A.eff ? cell((x) => wsdNp(k, npLv, x, A.eff)) : null, null]});
  CARDS.filter((c) => String(k.deck || "").includes(c[0])).forEach((c) => rows.push({k: c, card: c, t: c + " card",
    cells: [cell((x) => wsdCard(k, c, x, false)), cell((x) => wsdCard(k, c, x, true)), A.eff ? cell((x) => wsdCard(k, c, x, false, A.eff)) : null, A.eff ? cell((x) => wsdCard(k, c, x, true, A.eff)) : null]}));
  return {B: B, A: A, rows: rows};
}
function wsSkDmgHTML() {
  const k = W.k, si = W.sk, lv = clamp(W.copy ? num(W.copy.skills[si]) || 10 : 10, 1, 10), npLv = clamp(W.copy ? num(W.copy.np) || 1 : 1, 1, 5);
  const R = wsdRows(k, si, lv, npLv), changed = R.rows.filter((r) => r.cells.some((c) => c && c.b !== c.a));
  const left = R.B.left.length ? `<p class="ws-dmg-left">${R.B.left.map(esc).join(" · ")}</p>` : "";
  if (!k.sk[si].fx.length) return `<p class="muted">Add an effect and its damage shows here.</p>`;
  if (!changed.length) return `<p class="muted">Nothing in this skill changes this servant's own damage.</p>${left}`;
  const c2 = (c) => !c ? `<td class="none">–</td>` : c.b === c.a ? `<td class="same">${fmt(c.a)}</td>` : `<td><span class="was">${fmt(c.a)}</span><b>${fmt(c.b)}</b><i>${c.b > c.a ? "+" : "−"}${fmt(Math.abs(c.b - c.a))}${c.a ? " (" + (c.b > c.a ? "+" : "−") + (Math.abs(c.b - c.a) / c.a * 100).toFixed(1).replace(/\.0$/, "") + "%)" : ""}</i></td>`;
  const used = R.B.used.map((u) => `<li>${esc(u.t)} <b>+${esc(String(Math.round(u.v * 100) / 100))}${u.u}</b>${u.note ? ` <small>${esc(u.note)}</small>` : ""}</li>`).join("");
  return `<ul class="ws-dmg-used">${used}</ul>
    <div class="ws-dmg-scroll"><table class="ws-ntab ws-dmg-t"><thead><tr><th></th><th>Hit</th><th>Critical</th><th>Effective</th><th>Effective critical</th></tr></thead>
    <tbody>${changed.map((r) => `<tr class="c-${r.card.toLowerCase()}" data-k="${r.k}"><th><img src="${CARD_IMG[r.card]}" alt="">${esc(r.t)}${r.k === "np" ? ` <small>NP${npLv}</small>` : ""}</th>${r.cells.map(c2).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="ws-dmg-note">Without the skill, then with it, at skill level ${lv}. ATK ${fmt(R.A.atk)} (max level, with the passives, no Craft Essence), a neutral enemy, the average roll, one card on its own.${R.A.eff ? ` Effective: a class ${esc(k.cls)} beats (× ${R.A.eff}).` : ""}</p>${left}`;
}
WS_LIVE.skdmg = () => wsSkDmgHTML();
// the block goes under the skill's preview
const wsSkillsHTML58 = wsSkillsHTML;
wsSkillsHTML = function () {
  return wsSkillsHTML58.apply(this, arguments) + `<div class="ws-field ws-dmg"><p class="ws-lab">What it adds to damage</p><div data-live="skdmg">${wsSkDmgHTML()}</div></div>`;
};
// for the tests: the numbers behind the table
window.__fgiSkillDmg = (si) => { const lv = clamp(W.copy ? num(W.copy.skills[si]) || 10 : 10, 1, 10), R = wsdRows(W.k, si, lv, clamp(W.copy ? num(W.copy.np) || 1 : 1, 1, 5)); return {atk: R.A.atk, cls: R.A.cls, eff: R.A.eff, base: R.A.card, dp: R.A.dp, buffs: R.B, rows: R.rows, np: W.k.np, lv: lv}; };
