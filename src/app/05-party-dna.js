/* ---------- Party DNA: teams built around off-meta playstyles from your own servants' kits ---------- */
const KIT_LABEL = {invuln: "Invincible", evade: "Evade", guts: "Guts", taunt: "Taunt", defup: "DEF up", dmgcut: "Damage cut", debuffImm: "Debuff immunity", heal: "Heal", regen: "HP regen", np: "NP charge", npTurn: "NP each turn", npgain: "NP gain up", cdr: "Cooldown cut", burn: "Burn", curse: "Curse", poison: "Poison", dot: "Damage over time", enemyDebuff: "Enemy debuff", debuffUp: "Debuff success up", cleanse: "Debuff removal"};
const KIT_RX = [["invuln", /invincib|invulnerab/i], ["evade", /\bevade|evasion/i], ["guts", /\bguts\b/i], ["taunt", /\btaunt|target focus/i], ["defup", /\bdef(?:ense)?\s*(?:up|\+)/i],
  ["dmgcut", /damage (?:cut|reduction)|damage taken (?:down|-)|reduces? damage taken/i], ["debuffImm", /debuff immun/i], ["heal", /\bheal|recovers? .*\bhp\b|\bhp recover/i], ["regen", /\bregen/i],
  ["np", /(?:charges?|gains?)\b.*\bnp\b|\bnp (?:charge|gauge)|\bnp\s*\+\s*\d/i], ["npgain", /np (?:gain|generation)/i], ["cdr", /cooldowns? (?:-|reduc|down)|reduces? .*cooldown|cooldown cut/i],
  ["burn", /\bburn\b/i], ["curse", /\bcurse[sd]?\b/i], ["poison", /\bpoison(?:ed)?\b/i], ["dot", /damage over time|\bdot\b/i], ["enemyDebuff", /\b(?:atk|attack|def|defense|crit\w*) down\b|\bstun\b|\bcharm\b|\bsleep\b|\bseal\b/i]];
const DOT_TYPES = ["burn", "curse", "poison", "dot"];
function whoOf(ln, type) {
  if (/\b(?:party|all allies|team|allies)\b/i.test(ln)) return "party";
  if (/\b(?:one ally|an ally|ally)\b/i.test(ln)) return "ally";
  if (/\b(?:enem|foe|target)/i.test(ln) || DOT_TYPES.includes(type) || type === "enemyDebuff") return /\b(?:own|self)\b/i.test(ln) ? "self" : "enemy";
  return "self";
}
function durOf(ln) { const m = /\((\d+)\s*t\)|(\d+)\s*(?:t\b|turns?)/i.exec(ln); return m ? Number(m[1] || m[2]) : null; }
// "10%~20%", "10~20%", "10%-20%": the Lv 1 and Lv 10 values
function pctRange(ln) { const m = /(\d+(?:\.\d+)?)\s*%?\s*[~～–—-]\s*(\d+(?:\.\d+)?)\s*%/.exec(ln); return m && Number(m[2]) > Number(m[1]) ? [Number(m[1]), Number(m[2])] : null; }
function amtOf(ln, type) { if (type !== "np" && type !== "npTurn" && !DOT_TYPES.includes(type)) return null; const m = DOT_TYPES.includes(type) ? /(\d[\d,]*)\s*(?:dmg|damage)?/i.exec(ln) : /(\d+(?:\.\d+)?)\s*%/.exec(ln); return m ? Number(String(m[1]).replace(/,/g, "")) : null; }
// what the servant's own typed skill, NP and passive text says
function textKit(s) {
  const out = [], infos = s.skillInfo || [];
  const add = (text, slot, cd, info) => effectLines(text).forEach((ln) => KIT_RX.forEach(([type, rx]) => { if (rx.test(ln)) { const t = type === "np" && /each turn|every turn|per turn/i.test(ln) ? "npTurn" : type, e = {s: slot, t: t, who: whoOf(ln, t), dur: durOf(ln), n: amtOf(ln, t), cd: cd, src: "text", ln: ln, note: ln.length > 80 ? ln.slice(0, 77) + "…" : ln}; const rg = (t === "np" || t === "npTurn") && pctRange(ln); if (rg) { e.n1 = rg[0]; e.n = rg[1]; } else if (t === "np" && e.n == null && info) { const row = rowFor(info, "np"); if (row) { e.n = num(row.v10); if (num(row.v1) != null) e.n1 = num(row.v1); } } out.push(e); } }));
  [0, 1, 2].forEach((i) => { const k = infos[i] || {}; add(k.effect, i, num(k.cd), k); });
  const T = npTableOf(s).T, V = T.v[0]; if (V) { add(V.effect, "np"); add(V.oc, "np"); }
  passivesOf(s).forEach((p) => add(p.effect, "p"));
  return out;
}
// a skill's value row for a kind of effect, by its label
const NP_ROW = /charge|gauge|\bnp\s*\+/i;
function rowFor(info, t) {
  const rows = scalesOf(info || {}).filter((r) => num(r.v10) != null), rx = t === "np" ? NP_ROW : OFF_LABEL[t];
  return rx ? rows.find((r) => rx.test(String(r.label || "")) && !/\bgain\b/i.test(String(r.label || ""))) || null : null;
}
// which kinds of effect in a line are only named in its "(demerit)" part
function demeritTypes(ln) {
  const parts = String(ln).split(/;|,\s+|\.\s+/), bad = new Set(), good = new Set(), rxs = KIT_RX.concat(OFF_RX);
  parts.forEach((c) => rxs.forEach(([t, rx]) => { if (rx.test(c)) (/\bdemerit\b/i.test(c) ? bad : good).add(t); }));
  good.forEach((t) => bad.delete(t)); return bad;
}
function kitOf(s) {
  const key = defaultKey(s), infos = s.skillInfo || [];
  const wiki = (KIT_DEFAULTS[key] || []).map((e) => {
    const o = Object.assign({src: "wiki"}, e);
    // values from your skill's value row: the Lv 1 value when the wiki entry only has Lv 10, or both when it has none
    if (typeof o.s === "number" && o.n != null && o.n1 == null) { const row = scalesOf(infos[o.s] || {}).find((r) => num(r.v10) === o.n && num(r.v1) != null && (o.t !== "np" || NP_ROW.test(String(r.label || "")))); if (row) o.n1 = num(row.v1); }
    else if (typeof o.s === "number" && o.n == null) { const row = rowFor(infos[o.s], o.t); if (row) { o.n = num(row.v10); if (num(row.v1) != null) o.n1 = num(row.v1); } }
    return o;
  });
  // the wiki data here covers what servants do for others; their own ATK, card and NP damage buffs come from your skill text
  const OFF_T = ["atkup", "cardup", "npdmg", "defdown", "cardres"], have = new Set(wiki.map((e) => e.s + "|" + e.t));
  let txt = wiki.length ? offenseKit(s).filter((e) => OFF_T.includes(e.t) && !have.has(e.s + "|" + e.t))
      .concat(textKit(s).filter((e) => e.t === "np" && typeof e.s === "number" && !have.has(e.s + "|np") && !have.has(e.s + "|npTurn")))
    : textKit(s).concat(offenseKit(s));
  // a line that names who it's for ("ATK up for Divine allies") only counts for those allies
  if (txt.length) { const vocab = buffVocab(); txt = txt.map((e) => { const tags = e.ln && e.who !== "enemy" ? buffTagsInLine(e.ln, vocab) : []; const o = tags.length ? Object.assign({}, e, {cond: tags.join("|"), who: e.who === "self" ? "party" : e.who}) : e; return e.ln && /\bdemerit\b/i.test(e.ln) && demeritTypes(e.ln).has(e.t) ? Object.assign({}, o, {demerit: true}) : o; }); }
  return wiki.concat(txt).map((e) => {
    if (typeof e.s !== "number") return Object.assign({}, e, {cdNow: null, on: true});
    const lv = (s.skills || [])[e.s];
    if (typeof lv !== "number") return Object.assign({}, e, {cdNow: null, on: false});
    const info = (s.skillInfo || [])[e.s] || {}, base = num(info.cd) != null ? num(info.cd) : num(e.cd);
    return Object.assign({}, e, {cdNow: Math.max(1, (base != null ? base : 7) - (lv >= 6 ? 1 : 0) - (lv >= 10 ? 1 : 0)), on: true, cdGuess: base == null});
  }).filter((e) => e.on);
}
const kitSource = (s) => KIT_DEFAULTS[defaultKey(s)] ? "wiki" : (textKit(s).length ? "text" : "none");
const DEF_W = {invuln: 1, evade: 0.85, guts: 0.5, defup: 0.35, dmgcut: 0.3, debuffImm: 0.15};
const chanceOf = (e) => { const m = /(\d+)%\s*chance/i.exec(e.note || ""); return m ? Number(m[1]) / 100 : 1; };
// how often an effect is up: skills by duration over cooldown, the NP assuming one about every 4 turns, passives always
function upOf(e, cdRate) {
  if (e.s === "p") return 1;
  if (e.s === "np") return Math.min(1, (e.dur || 1) / 4);
  const cd = (e.cdNow || 7) / (1 + (cdRate || 0));
  return Math.min(1, (e.dur || 1) / Math.max(1, cd));
}
const perTurn = (e, cdRate) => e.s === "p" ? 1 : e.s === "np" ? 0.25 : 1 / Math.max(1, (e.cdNow || 7) / (1 + (cdRate || 0)));
let dnaCache = null;
const kitC = (s) => { if (!dnaCache) return kitOf(s); if (!dnaCache.k.has(s.id)) dnaCache.k.set(s.id, kitOf(s)); return dnaCache.k.get(s.id); };
const tagsC = (s) => { if (!dnaCache) return tagsOf(s); if (!dnaCache.t.has(s.id)) dnaCache.t.set(s.id, tagsOf(s)); return dnaCache.t.get(s.id); };
function condOk(e, member) { if (!e.cond) return true; const tags = tagsC(member); return e.cond.split("|").some((c) => tags.includes(c)); }
function dnaPool() { return S.servants.filter((s) => S.dnaWish !== false || !s.wish); }
function cdRates(team, kits) {
  const rate = team.map(() => 0);
  team.forEach((m, i) => kits[i].filter((e) => e.t === "cdr").forEach((e) => {
    const r = (e.n || 1) * perTurn(e, 0);
    if (e.who === "self") rate[i] += r / Math.max(1, (e.cdNow || 7));
    else if (e.who === "party") team.forEach((_, j) => { rate[j] += r / 7; });
    else team.forEach((_, j) => { if (j !== i) rate[j] += r / 7 / Math.max(1, team.length - 1); });
  }));
  return rate;
}
// one team's defense cover, sustain and NP per turn, member by member
function stallEval(team) {
  const kits = team.map(kitC), rate = cdRates(team, kits);
  const parts = team.map(() => []), npT = team.map(() => 0), sus = team.map(() => 0), pieces = [];
  const def = team.map(() => []);
  team.forEach((m, i) => kits[i].forEach((e) => {
    const u = upOf(e, rate[i]) * chanceOf(e), w = DEF_W[e.t];
    const targets = e.who === "self" ? [i] : e.who === "party" ? team.map((_, j) => j) : e.who === "ally" ? [-1] : [];
    if (w) {
      if (e.who === "ally") pieces.push({m: m, e: e, u: u, ally: true}); else { targets.forEach((j) => { if (condOk(e, team[j])) def[j].push(w * u); }); pieces.push({m: m, e: e, u: u}); }
    }
    if (e.t === "taunt") { team.forEach((_, j) => { if (j !== i) def[j].push(0.6 * u); }); pieces.push({m: m, e: e, u: u}); }
    if (e.t === "heal" || e.t === "regen") { const r = e.t === "regen" ? u : perTurn(e, rate[i]); (e.who === "self" ? [i] : team.map((_, j) => j)).forEach((j) => { sus[j] += r; }); pieces.push({m: m, e: e, u: u}); }
    if (e.t === "np" && e.n) { const r = e.n * perTurn(e, rate[i]); if (e.who === "self") npT[i] += r; else if (e.who === "party") team.forEach((_, j) => { if (condOk(e, team[j])) npT[j] += r; }); else team.forEach((_, j) => { if (j !== i) npT[j] += r / Math.max(1, team.length - 1); }); }
    if (e.t === "npTurn" && e.n) { const r = e.n * (e.s === "p" ? 1 : u); if (e.who === "party") team.forEach((_, j) => { npT[j] += r; }); else npT[i] += r; }
  }));
  // single-target defensive help goes to whoever is least covered
  pieces.filter((p) => p.ally).forEach((p) => {
    const cover = def.map((d) => 1 - d.reduce((a, x) => a * (1 - x), 1));
    let j = -1, lo = 2; team.forEach((x, k) => { if (x !== p.m && cover[k] < lo) { lo = cover[k]; j = k; } });
    if (j >= 0) def[j].push(DEF_W[p.e.t] * p.u);
  });
  const cover = def.map((d) => 1 - d.reduce((a, x) => a * (1 - x), 1));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const score = 0.6 * avg(cover) + 0.2 * Math.min(1, avg(sus) * 2) + 0.2 * Math.min(1, avg(npT) / 25);
  return {team: team, cover: cover, npT: npT, sus: sus, score: score, pieces: pieces, rate: rate};
}
function bestStall(pool) {
  const list = pool.filter((s) => kitC(s).length);
  const out = [];
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) for (let c = b + 1; c < list.length; c++) out.push(stallEval([list[a], list[b], list[c]]));
  out.sort((x, y) => y.score - x.score);
  const picks = [], used = new Map();
  for (const t of out) { if (picks.length >= 3) break; const overlap = t.team.filter((m) => used.has(m.id)).length; if (picks.length && overlap > 1) continue; picks.push(t); t.team.forEach((m) => used.set(m.id, 1)); }
  return picks;
}
function dotOf(s) {
  const k = kitC(s), dots = k.filter((e) => DOT_TYPES.includes(e.t) && e.who === "enemy");
  return {s: s, dots: dots, amp: k.filter((e) => e.t === "debuffUp" || (e.t === "np" && e.who !== "self" && e.n)), score: dots.reduce((a, e) => a + upOf(e, 0) * ((e.n || 1000) / 1000), 0)};
}
function bestDot(pool) {
  const all = pool.map(dotOf), dealers = all.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  const team = dealers.slice(0, 3);
  if (team.length < 3) all.filter((x) => !team.includes(x) && x.amp.length).sort((a, b) => b.amp.length - a.amp.length || b.amp.reduce((s, e) => s + (e.n || 0), 0) - a.amp.reduce((s, e) => s + (e.n || 0), 0)).slice(0, 3 - team.length).forEach((x) => team.push(x));
  return {team: team, dealers: dealers};
}
function soloOf(s) {
  const k = kitC(s), mine = k.filter((e) => e.who === "self" || e.who === "party" || e.who === "ally");
  const def = mine.filter((e) => DEF_W[e.t]).map((e) => DEF_W[e.t] * upOf(e, 0) * chanceOf(e)), cover = 1 - def.reduce((a, x) => a * (1 - x), 1);
  const sus = mine.filter((e) => e.t === "heal" || e.t === "regen").reduce((a, e) => a + (e.t === "regen" ? upOf(e, 0) : perTurn(e, 0)), 0);
  const npT = mine.filter((e) => (e.t === "np" || e.t === "npTurn") && e.n).reduce((a, e) => a + (e.t === "npTurn" ? e.n * (e.s === "p" ? 1 : upOf(e, 0)) : e.n * perTurn(e, 0)), 0);
  const has = (t) => mine.some((e) => e.t === t);
  const ce = [];
  if (!has("guts")) ce.push("Guts");
  if (!has("invuln") && !has("evade")) ce.push("Invincible or Evade");
  if (npT < 8) ce.push("NP charge at battle start");
  if (!has("debuffImm")) ce.push("Debuff immunity");
  if (sus < 0.15) ce.push("HP regen");
  const used = []; S.parties.forEach((p) => (p.front || []).concat(p.back || []).forEach((n, i) => { const c = (p.ce || [])[i]; if (n === s.name && c && !used.includes(c)) used.push(c); }));
  return {s: s, cover: cover, sus: sus, npT: npT, ce: ce, used: used, k: k, score: 0.55 * cover + 0.25 * Math.min(1, sus * 2) + 0.2 * Math.min(1, npT / 20)};
}
const pct = (v) => Math.round(v * 100) + "%";
function dnaMember(s) { return `<span class="dna-m">${miniAva(s)}<span><button type="button" class="tr-name" data-action="goto" data-id="${esc(s.id)}">${esc(s.name)}</button>${cuTag(s)}<small>${esc(s.cls || "")}${s.wish ? " · guest" : ""}</small></span></span>`; }
function pieceText(p) {
  const e = p.e, where = e.s === "np" ? "NP" : e.s === "p" ? "passive" : "skill " + (e.s + 1), who = e.who === "party" ? "party" : e.who === "ally" ? "one ally" : e.who === "enemy" ? "enemies" : "self";
  const often = e.s === "np" ? "on NP" : e.s === "p" ? "always" : (e.dur ? e.dur + " turn" + (e.dur > 1 ? "s" : "") + " every " : "every ") + Math.max(1, Math.round((e.cdNow || 7) / (1 + (p.rate || 0)))) + " turns";
  return `<b>${esc(KIT_LABEL[e.t] || e.t)}</b> (${who}) · ${esc(p.m.name)} ${where}, ${often}${e.note ? ` <small>${esc(e.note)}</small>` : ""}${e.src === "text" ? ` <small class="dna-src">from your text</small>` : ""}`;
}
const barRow = (label, v, txt) => `<div class="dna-bar"><span class="dna-bl">${label}</span><span class="dna-tr" aria-hidden="true"><i style="width:${Math.round(clamp(v, 0, 1) * 100)}%"></i></span><b>${txt}</b></div>`;
function dnaSaveBtn(team, name, why) { return S.readOnly ? "" : `<button type="button" class="btn sm" data-action="dna-save" data-ids="${esc(team.map((m) => m.id).join(","))}" data-name="${esc(name)}" data-why="${esc(why)}">Save as party</button>`; }
function dnaBody() {
  const pool = dnaPool(), mode = S.dnaMode || "stall";
  const skipped = pool.filter((s) => kitSource(s) === "none");
  const skipNote = skipped.length ? `<p class="dna-skip">Left out (no skill effects filled in): ${skipped.map((s) => esc(s.name)).join(", ")}.</p>` : "";
  if (mode === "stall") {
    const best = bestStall(pool);
    if (!best.length) return `<p class="tr-none">Not enough servants with kit data yet. Fill in skill effects in Edit details.</p>` + skipNote;
    return best.map((t, i) => {
      const names = t.team.map((m) => m.name).join(", "), avgCover = t.cover.reduce((a, x) => a + x, 0) / 3, avgNp = t.npT.reduce((a, x) => a + x, 0) / 3;
      const pieces = t.pieces.filter((p) => DEF_W[p.e.t] || p.e.t === "taunt" || p.e.t === "heal" || p.e.t === "regen").map((p) => `<li>${pieceText(Object.assign({rate: t.rate[t.team.indexOf(p.m)]}, p))}</li>`).join("");
      return `<article class="dna-team">
        <header><h3>${i === 0 ? "Best stall trio" : "Option " + (i + 1)}</h3><span class="dna-score">${pct(avgCover)} defense cover</span></header>
        <div class="dna-members">${t.team.map(dnaMember).join("")}</div>
        <div class="dna-cols"><div><h4 class="tr-h">Defense cover <small>share of turns with Invincible, Evade, Guts, DEF or a taunt on them</small></h4>${t.team.map((m, j) => barRow(esc(m.name), t.cover[j], pct(t.cover[j]))).join("")}</div>
        <div><h4 class="tr-h">NP each turn <small>from skills, passives and allies</small></h4>${t.team.map((m, j) => barRow(esc(m.name), t.npT[j] / 30, t.npT[j].toFixed(1) + "%")).join("")}<p class="dna-line">${avgNp > 0 ? `About ${Math.max(1, Math.ceil(100 / Math.max(1, avgNp)))} turns to an NP on average without card gains.` : "No steady NP charge in this team."}</p></div></div>
        <details class="dna-more"><summary>What keeps them alive</summary><ul>${pieces || "<li>Nothing defensive found.</li>"}</ul></details>
        <footer>${dnaSaveBtn(t.team, "Stall trio: " + names, "Party DNA · stall trio, about " + pct(avgCover) + " defense cover")}</footer>
      </article>`;
    }).join("") + skipNote;
  }
  if (mode === "dot") {
    const r = bestDot(pool);
    if (!r.dealers.length) return `<p class="tr-none">No one in your roster${S.dnaWish !== false ? " or Guests" : ""} applies Burn, Curse or Poison to enemies yet. Add servants who do (Guests count) and type the effect into their skills or NP, and a team shows up here.</p>` + skipNote;
    const tick = r.team.reduce((a, x) => a + x.dots.reduce((b, e) => b + (e.n || 0) * upOf(e, 0), 0), 0);
    const lines = r.team.map((x) => x.dots.length ? x.dots.map((e) => `<li>${pieceText({m: x.s, e: e, u: upOf(e, 0)})}</li>`).join("") : x.amp.map((e) => `<li>${pieceText({m: x.s, e: e, u: 1})} <small>(support)</small></li>`).join("")).join("");
    return `<article class="dna-team">
      <header><h3>Debuff stacking</h3><span class="dna-score">${r.dealers.length} damage-over-time source${r.dealers.length === 1 ? "" : "s"}</span></header>
      <div class="dna-members">${r.team.map((x) => dnaMember(x.s)).join("")}</div>
      ${tick ? `<p class="dna-line">About <b>${fmt(Math.round(tick))}</b> tick damage a turn on average, counting each effect's uptime.</p>` : ""}
      <ul class="dna-list">${lines}</ul>
      ${r.dealers.length < 3 ? `<p class="dna-line muted">Your roster only has ${r.dealers.length} servant${r.dealers.length === 1 ? "" : "s"} who apply damage over time, so the rest are supports that help them stack it or fire their NP sooner.</p>` : ""}
      <footer>${dnaSaveBtn(r.team.map((x) => x.s), "Debuff stack: " + r.team.map((x) => x.s.name).join(", "), "Party DNA · Burn, Curse and Poison stacking")}</footer>
    </article>` + skipNote;
  }
  const cands = pool.filter((s) => clamp(num(s.rarity) || 0, 0, 5) <= 3 && clamp(num(s.rarity) || 0, 0, 5) >= 1).map(soloOf).sort((a, b) => b.score - a.score);
  if (!cands.length) return `<p class="tr-none">No 1–3★ servants in your roster${S.dnaWish !== false ? " or Guests" : ""} yet. Add some (Guests count too), fill in their skills, and they'll be ranked here for solo runs with the CE type each one needs.</p>`;
  const known = cands.filter((x) => kitSource(x.s) !== "none"), blank = cands.filter((x) => kitSource(x.s) === "none");
  return known.map((x, i) => `<article class="dna-team solo">
      <header><h3>${i === 0 ? "Best solo pick" : "#" + (i + 1)}</h3><span class="dna-score">${"★".repeat(clamp(num(x.s.rarity) || 0, 0, 5))}</span></header>
      <div class="dna-members">${dnaMember(x.s)}</div>
      ${barRow("Defense cover", x.cover, pct(x.cover))}${barRow("Healing", Math.min(1, x.sus * 2), x.sus ? "yes" : "none")}${barRow("NP each turn", x.npT / 30, x.npT.toFixed(1) + "%")}
      <p class="dna-line"><b>Craft Essence to look for:</b> ${x.ce.length ? x.ce.map(esc).join(", ") : "anything that raises damage, the kit covers the rest"}.${x.used.length ? ` You've used: ${x.used.map(esc).join(", ")}.` : ""}</p>
    </article>`).join("") + (blank.length ? `<article class="dna-team solo blank"><header><h3>Not ranked yet</h3></header><div class="dna-members">${blank.map((x) => dnaMember(x.s)).join("")}</div><p class="dna-line">Fill in what their skills, NP and passives do (Edit details) and they'll be ranked here with the Craft Essence type each one needs.</p></article>` : "");
}
function dnaBodyCached() { dnaCache = {k: new Map(), t: new Map()}; try { return dnaBody(); } finally { dnaCache = null; } }
function renderDna() {
  const el = document.getElementById("dna"); if (!el || S.tab !== "parties") return;
  if (S.dbState !== "ok" || !S.loaded.servants) { el.innerHTML = ""; return; }
  const mode = S.dnaMode || "stall", seg = (v, t) => `<button type="button" data-action="dna-mode" data-v="${v}" aria-pressed="${mode === v}">${t}</button>`;
  el.innerHTML = `<section class="dna-box" aria-labelledby="dna-h">
    <div class="dna-head"><div><h2 id="dna-h">Party DNA</h2><p>Teams built from your servants' own kits for off-meta playstyles. Numbers are estimates from durations and cooldowns at your skill levels.</p></div>
      <div class="dna-tools"><div class="seg" role="group" aria-label="Playstyle">${seg("dot", "Debuff stacking")}${seg("stall", "Stall trio")}${seg("solo", "1–3★ solo")}</div>
      <label class="dna-wish"><input type="checkbox" id="dna-wish"${S.dnaWish !== false ? " checked" : ""}> Include Guests</label></div></div>
    <div class="dna-body">${dnaBodyCached()}</div>
    <p class="dna-note">Kits come from the fandom wiki for the servants it loaded for, and from the skill, NP and passive text you typed for everyone else. Chance-based effects count at their chance, an NP is assumed about every 4 turns, and enemy turns aren't simulated.</p>
  </section>`;
}

