/* ---------- support buffs from the wiki: what each one does for the rest of the team (n1 = at skill Lv 1, n = at Lv 10) ---------- */
const KIT_SUPPORT = {
  "artoria": [{s: 0, t: "atkup", who: "party", n1: 9, n: 18, dur: 3, cd: 7, note: "Charisma"}],
  "francis-drake": [{s: 0, t: "atkup", who: "party", n1: 8.5, n: 17, dur: 1, cd: 7}, {s: 0, t: "npdmg", who: "party", n1: 8.5, n: 17, dur: 1, cd: 7}],
  "ereshkigal": [{s: "np", t: "atkup", who: "party", n: 20, dur: 3, note: "allies with Blessing of Kur (her skill 3)"}],
  "lady-avalon": [{s: 0, t: "cardup", card: "Arts", who: "ally", n1: 30, n: 50, dur: 3, cd: 8}, {s: 0, t: "critdmg", who: "ally", n1: 50, n: 100, dur: 1, cd: 8}, {s: 1, t: "atkup", who: "party", n1: 10, n: 20, dur: 3, cd: 8}, {s: 1, t: "ocup", who: "party", n: 1, dur: 3, cd: 8, note: "next NP overcharged one stage"}],
  "larva-tiamat": [{s: 2, t: "npdmg", who: "party", n1: 10, n: 20, dur: 1, cd: 4}, {s: 1, t: "atkup", who: "self", n1: 20, n: 30, dur: 3, cd: 8}, {s: 1, t: "cardup", card: "Buster", who: "self", n1: 20, n: 30, dur: 3, cd: 8}],
  "mysterious-heroine-x-alter": [{s: 2, t: "atkup", who: "party", n1: 10, n: 20, dur: 3, cd: 7}],
  "nitocris-alter": [{s: 2, t: "cardup", card: "Arts", who: "party", n1: 10, n: 20, dur: 3, cd: 7}],
  "oberon": [{s: 0, t: "npdmg", who: "party", n1: 20, n: 30, dur: 3, cd: 7}, {s: 2, t: "cardup", card: "Buster", who: "ally", n1: 30, n: 50, dur: 1, cd: 10}, {s: 2, t: "npdmg", who: "ally", n1: 50, n: 100, dur: 1, cd: 10, note: "NP Damage Up Boost; sleeps them after (demerit)"}],
  "osakabehime": [{s: 0, t: "critdmg", who: "party", n1: 30, n: 50, dur: 3, cd: 7}, {s: 2, t: "defdown", who: "enemy", n1: 20, n: 40, dur: 1, cd: 7}, {s: "np", t: "cardup", card: "Quick", who: "party", n: 30, dur: 3}, {s: "np", t: "cardup", card: "Buster", who: "party", n: 30, dur: 3}],
  "queen-medb": [{s: 1, t: "atkup", who: "party", n1: 10, n: 20, dur: 3, cd: 7}, {s: 1, t: "atkup", who: "party", n1: 10, n: 20, dur: 3, cd: 7, cond: "trait:Male", note: "extra for Male allies"}, {s: 2, t: "defdown", who: "enemy", n1: 20, n: 30, dur: 1, cd: 9}],
  "salter-rider": [{s: 0, t: "cardup", card: "Quick", who: "party", n1: 10, n: 20, dur: 3, cd: 8}],
  "space-ereshkigal": [{s: 0, t: "atkup", who: "party", n1: 10, n: 20, dur: 3, cd: 8}, {s: 0, t: "npdmg", who: "party", n1: 10, n: 20, dur: 3, cd: 8}],
  "space-ishtar": [{s: 0, t: "atkup", who: "others", n1: 10, n: 30, dur: 3, cd: 7}, {s: 0, t: "atkup", who: "self", n1: 10, n: 20, dur: 3, cd: 7}, {s: 1, t: "npdmg", who: "self", n1: 10, n: 20, dur: 3, cd: 7}],
  "tamamo-no-mae": [{s: 0, t: "npdmg", who: "others", n1: 20, n: 30, dur: 3, cd: 7}, {s: 2, t: "cardup", card: "Arts", who: "ally", n1: 30, n: 50, dur: 3, cd: 7}],
  "ivan-the-terrible": [{s: "np", t: "cardres", card: "Buster", who: "enemy", n: 30, dur: 3, note: "after his NP"}]
};
Object.keys(KIT_SUPPORT).forEach((id) => { KIT_DEFAULTS[id] = (KIT_DEFAULTS[id] || []).concat(KIT_SUPPORT[id]); });
[["oberon", 1, 30], ["queen-medb", 0, 20], ["osakabehime", 1, 10]].forEach(([id, slot, n1]) => { const e = (KIT_DEFAULTS[id] || []).find((x) => x.t === "np" && x.s === slot); if (e) e.n1 = n1; });
[["space-ereshkigal", 0, 10], ["space-ereshkigal", 1, 30], ["larva-tiamat", 0, 30]].forEach(([id, slot, n1]) => { const e = (KIT_DEFAULTS[id] || []).find((x) => x.t === "np" && x.s === slot); if (e && e.n1 == null) e.n1 = n1; });
// Oberon's skill 3 taunts the ally while they sleep: a cost, not a help
(KIT_DEFAULTS["oberon"] || []).forEach((e) => { if (e.t === "taunt") e.demerit = true; });
Object.assign(KIT_LABEL, {atkup: "ATK up", cardup: "card up", npdmg: "NP damage up", critdmg: "Crit damage up", defdown: "Enemy DEF down", cardres: "Enemy card resistance down", ocup: "Overcharge up"});
// a support's value at its own current skill level
function valAt(s, e) {
  if (e.n == null) return null;
  if (typeof e.s !== "number" || e.n1 == null) return e.n;
  const lv = (s.skills || [])[e.s]; if (typeof lv !== "number") return null;
  return lv >= 10 ? e.n : e.n1 + (e.n - e.n1) * (lv - 1) / 10;
}
const SUP_TYPES = ["atkup", "cardup", "npdmg", "critdmg", "defdown", "cardres", "ocup", "np", "npTurn", "npgain", "invuln", "evade", "guts", "defup", "dmgcut", "debuffImm", "heal", "regen", "taunt", "cdr"];
const SUP_WHO = ["party", "ally", "others", "enemy"];
const SUP_DEF = ["invuln", "evade", "guts", "defup", "dmgcut", "debuffImm", "heal", "regen"];
const npCardOf = (t) => CARDS.includes(t.npCard) ? t.npCard : null;
// what a servant brings to its own first NP: its own skills and passives (its NP's buffs come after the NP)
function selfOf(t) {
  const card = npCardOf(t), o = {atk: 0, card: 0, npd: 0, chg: 0, known: false};
  kitC(t).forEach((e) => {
    o.known = true;
    if (e.s === "np" || e.demerit || !["self", "party", "ally", "enemy"].includes(e.who) || !condOk(e, t)) return;
    if (e.who === "enemy" && !["defdown", "cardres"].includes(e.t)) return;
    const v = valAt(t, e) || 0;
    if (e.t === "atkup" || e.t === "defdown") o.atk += v;
    else if ((e.t === "cardup" || e.t === "cardres") && card && e.card === card) o.card += v;
    else if (e.t === "npdmg") o.npd += v;
    else if (e.t === "np" && e.who !== "enemy") o.chg += v;
  });
  return o;
}
const dmgMult = (x) => (1 + x.atk / 100) * (1 + x.card / 100) * (1 + x.npd / 100);
// score what one or more supports add on top of what the servant already does: the game multiplies the
// ATK/DEF, card and NP damage brackets, so a bracket the servant already fills is worth less, and NP charge
// only counts in full up to what they still need for their first NP
function scoreAdd(self, add) {
  const gain = (dmgMult({atk: self.atk + add.atk, card: self.card + add.card, npd: self.npd + add.npd}) / dmgMult(self) - 1) * 100;
  const need = Math.max(0, 100 - self.chg), useful = Math.min(add.chg, need), extra = add.chg - useful;
  return {gain: gain, need: need, useful: useful, ready: self.chg + add.chg >= 100,
    value: gain + useful + extra * 0.15 + add.later * 0.3 + add.oc * 12 + add.def * 1.5};
}
// how much one support does for one servant
function supportFor(sup, t, self) {
  const tt = tagsC(t), card = npCardOf(t), wiki = !!KIT_DEFAULTS[defaultKey(sup)];
  const r = {s: sup, atk: 0, card: 0, npd: 0, chg: 0, later: 0, pieces: [], oc: 0, def: 0, fit: []};
  const use = (e, v, half) => {
    const where = e.s === "np" ? "NP" : e.s === "p" ? "passive" : "skill " + (e.s + 1);
    const amt = v != null ? (e.t === "ocup" ? "+" + v + " stage" : e.t === "cdr" ? "−" + v + " turn" : (e.t === "defdown" || e.t === "cardres" ? "−" : "+") + (Math.round(v * 10) / 10) + "%") : "";
    const note = e.src === "text" ? (e.cond ? "for " + e.cond.split("|").map(tagLabel).join(" or ") + " allies" : "") : e.note;
    r.pieces.push(`<b>${esc(e.t === "cardup" || e.t === "cardres" ? (e.card || "Card") + (e.t === "cardres" ? " resistance down" : " up") : (KIT_LABEL[e.t] || e.t))}</b>${amt ? " " + amt : ""} <small>(${where}${e.dur ? ", " + e.dur + " turn" + (e.dur > 1 ? "s" : "") : ""}${note ? ", " + esc(note) : ""}${half ? ", only after their NP, so counted at half" : ""})</small>`);
  };
  kitC(sup).forEach((e) => {
    if (!SUP_TYPES.includes(e.t) || !SUP_WHO.includes(e.who) || e.demerit) return;
    if (e.cond && !e.cond.split("|").some((c) => tt.includes(c))) return;
    if (e.who === "enemy" && !["defdown", "cardres"].includes(e.t)) return;
    if ((e.t === "cardup" || e.t === "cardres") && (!card || e.card !== card)) return;
    const v = valAt(sup, e), half = e.s === "np" && ["atkup", "cardup", "npdmg", "defdown", "cardres", "np"].includes(e.t), w = half ? 0.5 : 1;
    if (e.t === "atkup" || e.t === "defdown") r.atk += (v || 0) * w;
    else if (e.t === "cardup" || e.t === "cardres") r.card += (v || 0) * w;
    else if (e.t === "npdmg") r.npd += (v || 0) * w;
    else if (e.t === "np") { if (half) r.later += v || 0; else r.chg += v || 0; }
    else if (e.t === "npTurn") r.later += (v || 0) * (e.dur || 3);
    else if (e.t === "ocup") r.oc += v || 1;
    else if (SUP_DEF.includes(e.t)) r.def += 1;
    else if (e.t !== "critdmg" && e.t !== "cdr" && e.t !== "npgain") return;
    if (e.t === "cardup" || e.t === "cardres") r.fit.push(card);
    if (e.cond) r.fit.push(e.cond.split("|").filter((c) => tt.includes(c)).map(tagLabel).join("/"));
    use(e, v, half);
  });
  // buff targets you set by hand, for supports the wiki data doesn't cover (lines in the skill text were already counted above)
  const fromText = new Set(); kitC(sup).forEach((e) => { if (e.src === "text" && e.cond) e.cond.split("|").forEach((c) => fromText.add(c)); });
  if (!wiki) traitInfo(sup).buffs.forEach((b) => {
    if (!tt.includes(b.tag) || fromText.has(b.tag)) return;
    const w = b.what || "", nums = (w.match(/(\d+(?:\.\d+)?)\s*%/g) || []).map((x) => parseFloat(x)), v = nums.length ? Math.max(...nums) : null;
    if (/np (?:charge|gauge)|charges?.*\bnp\b/i.test(w)) r.chg += v || 0;
    else if (/np (?:damage|dmg)/i.test(w)) r.npd += v || 0;
    else if (card && new RegExp("\\b" + card + "\\b", "i").test(w)) r.card += v || 0;
    else if (/\b(?:atk|attack)\b/i.test(w)) r.atk += v || 0;
    else r.def += 1;
    r.fit.push(tagLabel(b.tag));
    r.pieces.push(`<b>For ${esc(tagLabel(b.tag))}:</b> ${esc(w)}`);
  });
  r.fit = uniq(r.fit.filter(Boolean));
  Object.assign(r, scoreAdd(self || selfOf(t), r));
  return r;
}
// two supports together: their buffs add up inside each bracket
function pairFor(a, b, self) {
  const add = {}; ["atk", "card", "npd", "chg", "later", "oc", "def"].forEach((k) => { add[k] = a[k] + b[k]; });
  return Object.assign({a: a, b: b}, add, scoreAdd(self, add));
}
const bsPct = (v) => Math.round(v);
function bestSupportsHTML(t) {
  const pool = S.servants.filter((x) => x.id !== t.id), card = npCardOf(t);
  dnaCache = {k: new Map(), t: new Map()};
  let rows, self, pair = null;
  try {
    self = selfOf(t);
    rows = pool.map((x) => supportFor(x, t, self)).filter((r) => r.value > 0.5).sort((a, b) => (a.s.wish ? 1 : 0) - (b.s.wish ? 1 : 0) || b.value - a.value);
    const top = rows.filter((r) => !r.s.wish).slice(0, 8);
    top.forEach((a, i) => top.slice(i + 1).forEach((b) => { const p = pairFor(a, b, self); if (!pair || p.value > pair.value) pair = p; }));
  } finally { dnaCache = null; }
  const own = rows.filter((r) => !r.s.wish).slice(0, 5), wish = rows.filter((r) => r.s.wish).slice(0, 2);
  const nums = (r) => [r.gain > 0.5 ? `<b>+${bsPct(r.gain)}%</b> NP damage` : "", r.chg ? `<b>+${bsPct(r.chg)}%</b> NP charge` : "", r.oc ? `<b>+${r.oc}</b> overcharge` : ""].filter(Boolean).join(" · ");
  const ready = (r) => self.known && r.chg && self.chg < 100 ? (r.ready ? ` <span class="bs-ready" title="Their own charge plus this reaches 100%">NP on turn 1</span>` : "") : "";
  const fit = (r) => r.fit.map((f) => ` <span class="bs-fit">For ${esc(f)}</span>`).join("");
  const line = (r) => `<li>${miniAva(r.s)}<span><span class="bs-top"><button type="button" class="tr-name" data-action="goto" data-id="${esc(r.s.id)}">${esc(r.s.name)}</button>${r.s.wish ? ` <span class="tag">Guest</span>` : ""}${r.s.role ? ` <span class="bs-role">${esc(r.s.role)}</span>` : ""}<span class="bs-nums">${nums(r)}${ready(r)}${fit(r)}</span></span><small>${r.pieces.join(" · ")}</small></span></li>`;
  const own_ = [self.atk ? `+${bsPct(self.atk)}% ATK` : "", self.card && card ? `+${bsPct(self.card)}% ${card}` : "", self.npd ? `+${bsPct(self.npd)}% NP damage` : ""].filter(Boolean).join(", ");
  const need = !self.known ? `<p class="bs-need">${esc(t.name)}'s own skills aren't filled in, so this assumes they bring no buffs or NP charge of their own. Add their skill text for a list that fits them.</p>`
    : `<p class="bs-need">On their own ${esc(t.name)} brings ${own_ || "no damage buffs"} and <b>${bsPct(Math.min(self.chg, 999))}%</b> NP charge${self.chg >= 100 ? ", enough for their NP on turn 1, so NP charge from supports barely counts" : `, so they need <b>${bsPct(100 - self.chg)}%</b> more for their NP on turn 1`}. Supports are ranked on what they add on top of that.</p>`;
  const pairHTML = pair ? `<p class="bs-pair"><span class="lbl">Best pair</span> <b>${esc(pair.a.s.name)}</b> + <b>${esc(pair.b.s.name)}</b> · ${[pair.gain > 0.5 ? `<b>+${bsPct(pair.gain)}%</b> NP damage` : "", pair.chg ? `<b>+${bsPct(pair.chg)}%</b> NP charge` : "", pair.oc ? `<b>+${pair.oc}</b> overcharge` : ""].filter(Boolean).join(" · ")}${self.known && self.chg < 100 ? (pair.ready ? ` <span class="bs-ready">NP on turn 1</span>` : ` <span class="bs-short">${bsPct(100 - self.chg - pair.chg)}% short of NP on turn 1</span>`) : ""}</p>` : "";
  const body = own.length || wish.length ? `${pairHTML}<ol class="tr-people bs-list">${own.map(line).join("")}</ol>${wish.length ? `<h4 class="tr-h">From your Guests</h4><ol class="tr-people bs-list">${wish.map(line).join("")}</ol>` : ""}` : `<p class="tr-none">No support in your roster has buffs that reach ${esc(t.name)} yet.</p>`;
  return `<section class="d-sec bs-sec"><h3>Best supports <small>for ${esc(t.name)}'s NP${card ? " (" + card + ")" : ""}, at your supports' skill levels</small></h3>
    ${card ? "" : `<p class="tr-hint">Set their NP card to count Buster, Arts and Quick buffs too.</p>`}
    ${need}
    ${body}
    <p class="tr-hint">NP damage is how much harder their NP hits with this support than without, using the game's damage formula: ATK and DEF-down, card buffs and NP damage buffs each form their own bracket, and the brackets multiply. Buffs from a support's own NP count at half, since that support has to fire their NP first. Kits come from the wiki where it loaded, otherwise from the skill text you typed.</p>
  </section>`;
}

/* offensive buffs read from typed skill text, for servants the wiki data doesn't cover.
   Reads both "ATK up 20%" and the wiki's wording, "Increases all allies' ATK by 10%~20% for 3 turns." */
const OFF_RX = [
  ["npdmg", /\b(?:np|noble phantasm)\s*(?:damage|dmg|strength|power)\b(?!\s*(?:down|-))/i],
  ["critdmg", /\bcrit(?:ical)?\s*(?:damage|dmg|strength)\b(?!\s*(?:down|-))/i],
  ["defdown", /\bdef(?:ense)?\s*(?:down|-\s*\d)|\b(?:reduc|decreas|lower)\w*\b[^.;]*?\b(?:enem|target|foe)\w*\W+(?:\w+\W+){0,2}?def(?:ense)?\b/i],
  ["cardres", /\b(buster|arts|quick)\b(?:\s+card)?\s*resist(?:ance)?\s*down|\b(?:reduc|decreas|lower)\w*\b[^.;]*?\b(buster|arts|quick)\b(?:\s+card)?\s*resist/i],
  ["cardup", /\b(buster|arts|quick)\b(?:\s+card)?\s*(?:(?:performance|effectiveness)(?!\s*down)|up\b|\+)/i],
  ["atkup", /\b(?:atk|attack)\s*(?:up\b|\+)|\bincreas\w*\b[^.;]*?\b(?:atk|attack)\b(?!\s+(?:against|vs\b|versus))/i],
  ["ocup", /overcharge(?:d)?\b.*\b(?:\+\s*1|one|1)\s*stage|overcharge(?:d)? by 1\b/i]];
// which of the skill's value rows belongs to each kind of buff
const OFF_LABEL = {npdmg: /\b(?:np|noble)/i, critdmg: /crit/i, defdown: /\bdef/i, cardres: /resist/i, cardup: /buster|arts|quick|card|performance/i, atkup: /\b(?:atk|attack)\b/i};
function offenseKit(s) {
  const out = [], infos = s.skillInfo || [];
  const scan = (text, slot, info) => effectLines(text).forEach((ln) => {
    const who = /\b(?:party|all allies|team)\b/i.test(ln) ? (/except self|other allies|excluding self/i.test(ln) ? "others" : "party") : /\b(?:one ally|an ally|ally)\b/i.test(ln) ? "ally" : /\b(?:enem|foe)/i.test(ln) ? "enemy" : "self";
    OFF_RX.forEach(([t, rx]) => {
      const m = rx.exec(ln); if (!m) return;
      if ((t === "defdown" || t === "cardres") && /\b(?:own|self|demerit)\b/i.test(ln) && !/\b(?:enem|target|foe)/i.test(ln)) return; // a demerit on themselves
      // a buff never goes to the enemy: "ATK up vs debuffed enemies" is the servant's own buff
      const e = {s: slot, t: t, who: t === "defdown" || t === "cardres" ? "enemy" : who === "enemy" ? "self" : who, dur: durOf(ln), src: "text", ln: ln};
      if (t === "cardup" || t === "cardres") { const c = m[1] || m[2]; e.card = c[0].toUpperCase() + c.slice(1).toLowerCase(); }
      const rows = info ? scalesOf(info).filter((r) => num(r.v10) != null) : [];
      const row = rows.find((r) => rx.test(String(r.label || ""))) || rows.find((r) => OFF_LABEL[t] && OFF_LABEL[t].test(String(r.label || "")));
      const rg = pctRange(ln);
      if (row) { e.n = num(row.v10); if (num(row.v1) != null) e.n1 = num(row.v1); }
      else if (rg) { e.n1 = rg[0]; e.n = rg[1]; }
      else { const p = /(\d+(?:\.\d+)?)\s*%/.exec(ln); if (p) e.n = Number(p[1]); }
      if (t === "ocup") { e.n = 1; delete e.n1; }
      if (info && num(info.cd) != null) e.cd = num(info.cd);
      out.push(e);
    });
  });
  [0, 1, 2].forEach((i) => { const k = infos[i] || {}; scan(k.effect, i, k); });
  const T = npTableOf(s).T, V = T.v[0]; if (V) { scan(V.effect, "np", null); scan(V.oc, "np", null); }
  passivesOf(s).forEach((p) => scan(p.effect, "p", null));
  return out;
}

