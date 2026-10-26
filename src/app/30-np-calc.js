/* ================= 0.24.0: NP damage calculator =================
   Under the NP table on the servant page. It uses the NP version on screen (its Damage row, and an Overcharge row of
   Special damage, or of Extra damage with a +), the servant's ATK with Fou and the equipped Craft Essence, and the
   game's damage formula:
     ATK × 0.23 × NP% × card × (1 + card up) × class ATK × class affinity × attribute × random (0.9 to 1.099)
       × (1 + ATK up − DEF up) × (1 + special attack + NP Strength) × Special damage  + Damage Plus
   Buffs and the enemy are kept in this browser for next time (spirit-origin-list:v1:npcalc). */
const NPC_KEY = "spirit-origin-list:v1:npcalc";
const NPC_CARD = {Buster: 1.5, Arts: 1, Quick: 0.8};
const NPC_CLASS_ATK = {Archer: 0.95, Lancer: 1.05, Caster: 0.9, Assassin: 0.9, Berserker: 1.1, Ruler: 1.1, Avenger: 1.1};
const NPC_ATTRS = ["Man", "Earth", "Sky", "Star", "Beast"];
// Man beats Sky, Sky beats Earth, Earth beats Man (1.1 one way, 0.9 the other); Star and Beast beat each other
const NPC_ATTR_WIN = {"Man>Sky": 1, "Sky>Earth": 1, "Earth>Man": 1, "Star>Beast": 1, "Beast>Star": 1};
const npcAttr = (a, d) => NPC_ATTR_WIN[a + ">" + d] ? 1.1 : NPC_ATTR_WIN[d + ">" + a] ? 0.9 : 1;
const NPC_BUFFS = [["atk", "ATK up"], ["def", "Enemy DEF down"], ["card", "card up"], ["np", "NP Strength up"], ["pow", "Special attack up"], ["dp", "Damage Plus"]];
let npcPrefs = (() => { try { const v = JSON.parse(lsGet(NPC_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
const npcSave = () => lsSet(NPC_KEY, JSON.stringify(npcPrefs));
const NPC_OPEN = {}, NPC_LV = {}, NPC_OC = {};

const npcPct = (x) => { const m = /(-?\d+(?:\.\d+)?)\s*%/.exec(String(x == null ? "" : x)); return m ? Number(m[1]) : null; };
// what the NP on screen does: its damage by NP level, and what Overcharge adds
function npcNp(s) {
  const T = npTableOf(s).T, vi = npVi(s, T), V = T.v[vi]; if (!V) return null;
  const card = npField(s, V, vi, "card");
  const dmg = V.rows.find((r) => /^\s*damage\b/i.test(r.label) && r.vals.some((v) => npcPct(v) != null));
  if (!dmg) return {card: card, none: true};
  const se = V.rows.concat(V.ocRows).find((r) => /special (?:attack|damage)|super.?effective|extra damage/i.test(r.label) && r.vals.some((v) => npcPct(v) != null));
  const add = se && r0(se).every((v) => /^\s*\+/.test(v)), byOc = se && V.ocRows.includes(se);
  const tr = /\[([^\]]{1,40})\]/.exec(String(V.oc || "") + " " + String(V.effect || ""));
  return {card: card, dmg: dmg.vals.map(npcPct), se: se ? {vals: se.vals.map(npcPct), add: add, byOc: byOc, trait: tr ? tr[1] : ""} : null, name: npField(s, V, vi, "name")};
}
const r0 = (r) => r.vals.filter((v) => String(v).trim());
// what the class passives and the equipped Craft Essence add, always on
function npcAuto(s) {
  const a = atlasOf(s), pm = (a && a.pm) || [0, 0, 0, 0, 0], out = {card: {Buster: pm[0], Arts: pm[1], Quick: pm[2]}, np: pm[3], dp: pm[4], atk: 0, ce: null, from: []};
  const c = typeof favOn === "function" ? favOn(s) : null;
  if (c) {
    out.ce = c;
    const line = String(((c.x && c.x.length ? c.x : c.e) || [])[0] || "");
    // only what a CE always gives its holder: not for allies, on a condition or growing per turn
    if (!/all allies|only if|if equipped|\bwhen\b|\[Event Only\]/i.test(line)) {
      // clause by clause: "NP Strength by 80% & lose 500 HP per turn" keeps the 80%, "by 5% per turn (up to 50%)" doesn't count
      const rxNp = /NP (?:Strength|damage) by (\d+(?:\.\d+)?)%/i, rxAtk = /\bATK by (\d+(?:\.\d+)?)%/i, rxCard = /((?:Buster|Arts|Quick)(?:\s*(?:&|and)\s*(?:Buster|Arts|Quick))*)(?:\s+Card)?\s+effectiveness by (\d+(?:\.\d+)?)%/gi;
      line.split(/(?<!\b(?:Buster|Arts|Quick))\s&\s(?=[A-Za-z]+(?:\s[A-Za-z.]+)*\sby\s|lose|begin|gain)/).forEach((cl) => {
        if (/per turn|each turn|up to|against|\bfor \d+ turns?/i.test(cl)) return;
        let m;
        if ((m = rxNp.exec(cl))) { out.np += Number(m[1]); out.from.push("NP Strength +" + m[1] + "%"); }
        if ((m = rxAtk.exec(cl))) { out.atk += Number(m[1]); out.from.push("ATK +" + m[1] + "%"); }
        rxCard.lastIndex = 0;
        while ((m = rxCard.exec(cl))) { const v = m[2]; m[1].split(/\s*(?:&|and)\s*/).forEach((k) => { const kk = k.charAt(0).toUpperCase() + k.slice(1).toLowerCase(); out.card[kk] += Number(v); out.from.push(kk + " +" + v + "%"); }); }
      });
    }
  }
  return out;
}
function npcInputs(s, np) {
  const P = npcPrefs, lv = clamp(num(NPC_LV[s.id]) || num(s.npLevel) || 1, 1, 5), oc = clamp(num(NPC_OC[s.id]) || 1, 1, 5);
  const ecls = AFF_CLASSES.includes(P.ecls) ? P.ecls : "Saber", eattr = NPC_ATTRS.includes(P.eattr) ? P.eattr : "Earth";
  const b = (k) => num(P[k]) || 0;
  return {lv: lv, oc: oc, ecls: ecls, eattr: eattr, se: !!P.se, hp: num(P.hp), auto: P.auto !== false, atk: b("atk"), def: b("def"), card: b("card"), np: b("np"), pow: b("pow"), dp: b("dp")};
}
function npcBaseAtk(s) {
  const t = total(s, "atk"); if (t == null) return null;
  const c = typeof favOn === "function" ? favOn(s) : null;
  return t + (c && c.atk ? (c.atk[1] || 0) : 0);
}
function npcCalc(s, np, I, ecls) {
  const atk = npcBaseAtk(s); if (atk == null || !np || np.none) return null;
  const A = I.auto ? npcAuto(s) : {card: {Buster: 0, Arts: 0, Quick: 0}, np: 0, dp: 0, atk: 0};
  let mult = np.dmg[I.lv - 1]; if (mult == null) mult = np.dmg.find((v) => v != null); if (mult == null) return null;
  let se = 1;
  if (np.se) {
    const v = np.se.vals[(np.se.byOc ? I.oc : I.lv) - 1];
    if (v != null) { if (np.se.add) mult += v; else if (I.se) se = v / 100; }
  }
  const atkA = atlasOf(s), myAttr = (atkA && atkA.a) || s.attr || "";
  const cardMod = clamp((I.card + (A.card[np.card] || 0)) / 100, -1, 4);
  const atkMod = clamp((I.atk + A.atk + I.def) / 100, -1, 4);
  const npMod = clamp((I.np + A.np) / 100, -1, 5), pow = clamp(I.pow / 100, 0, 10);
  const base = atk * 0.23 * (mult / 100) * (NPC_CARD[np.card] || 1) * (1 + cardMod) * (NPC_CLASS_ATK[s.cls] || 1) * aff(s.cls, ecls || I.ecls)
    * npcAttr(myAttr, I.eattr) * (1 + atkMod) * (1 + pow + npMod) * se;
  const dp = I.dp + A.dp;
  return {min: base * 0.9 + dp, avg: base + dp, max: base * 1.099 + dp, base: base, dp: dp, mult: mult, se: se, atk: atk};
}
// the chance one NP takes off at least hp: the random roll is even between 0.9 and 1.099
function npcKill(r, hp) {
  if (!hp || !r || r.base <= 0) return null;
  const need = (hp - r.dp) / r.base;
  return need <= 0.9 ? 1 : need > 1.099 ? 0 : (1.099 - need) / 0.199;
}

function npcHTML(s) {
  const np = npcNp(s);
  if (!np) return "";
  const I = npcInputs(s, np), open = !!NPC_OPEN[s.id], card = np.card || "card";
  const sel = (k, opts, v, label) => `<label class="npc-f"><span>${label}</span><select data-npc="${k}">${opts.map((o) => `<option value="${esc(o[0])}"${String(o[0]) === String(v) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select></label>`;
  const inp = (k, label, unit) => `<label class="npc-f npc-b"><span>${label}</span><span class="npc-in"><input type="number" step="1" inputmode="decimal" data-npc="${k}" value="${I[k] || ""}" placeholder="0" aria-label="${esc(label)}">${unit ? `<i>${unit}</i>` : ""}</span></label>`;
  const body = np.none ? `<p class="tr-none">This NP has no Damage row, so there's nothing to work out. If it does damage, add a "Damage" row to the NP table with its % for each NP level.</p>`
    : npcBaseAtk(s) == null ? `<p class="tr-none">Fill in ${esc(s.name)}'s ATK first (Fill in from NA, or Edit details).</p>`
    : `<div class="npc-grid">
        ${sel("lv", [1, 2, 3, 4, 5].map((n) => [n, "NP" + n + (n === num(s.npLevel) ? " (yours)" : "")]), I.lv, "NP level")}
        ${sel("oc", [1, 2, 3, 4, 5].map((n) => [n, n * 100 + "%"]), I.oc, "Overcharge")}
        ${sel("ecls", AFF_CLASSES.map((c) => [c, c]), I.ecls, "Enemy class")}
        ${sel("eattr", NPC_ATTRS.map((c) => [c, c]), I.eattr, "Enemy attribute")}
        <label class="npc-f"><span>Enemy HP</span><span class="npc-in"><input type="number" min="0" step="1" inputmode="numeric" data-npc="hp" value="${I.hp || ""}" placeholder="optional" aria-label="Enemy HP"></span></label>
      </div>
      ${np.se && !np.se.add ? `<label class="npc-chk"><input type="checkbox" data-npc="se"${I.se ? " checked" : ""}> The enemy is <b>${esc(np.se.trait || "the NP's target trait")}</b> <span data-npc-o="se">(Special damage ${fmtVal(np.se.vals[(np.se.byOc ? I.oc : I.lv) - 1] || 100, "%")})</span></label>` : ""}
      <div class="npc-grid npc-buffs">${NPC_BUFFS.map(([k, t]) => inp(k, k === "card" ? (np.card || "Card") + " up" : t, k === "dp" ? "" : "%")).join("")}</div>
      <label class="npc-chk"><input type="checkbox" data-npc="auto"${I.auto ? " checked" : ""}> Add what's always on: <span data-npc-o="auto">${esc(npcAutoText(s, np))}</span></label>
      <div class="npc-out" data-npc-o="out"></div>
      <div class="npc-cls" data-npc-o="cls"></div>
      <p class="npc-foot" data-npc-o="foot"></p>`;
  return `<details class="npc" data-npc-for="${esc(s.id)}"${open ? " open" : ""}><summary><span class="npc-h">Damage calculator</span><span class="npc-sum" data-npc-o="sum">${np.none ? "no damage row" : "what this NP does to an enemy"}</span></summary>${body}</details>`;
}
function npcAutoText(s, np) {
  const A = npcAuto(s), bits = [];
  const cu = A.card[np.card] || 0; if (cu) bits.push(np.card + " +" + cu + "%");
  if (A.np) bits.push("NP Strength +" + A.np + "%"); if (A.atk) bits.push("ATK +" + A.atk + "%"); if (A.dp) bits.push("Damage Plus " + A.dp);
  return bits.length ? bits.join(", ") + (A.ce && A.from.length ? " (passives and " + A.ce.n + ")" : " (passives)") : "nothing from passives" + (A.ce ? " or " + A.ce.n : "");
}
function npcPaint(box) {
  const s = S.servants.find((x) => x.id === box.dataset.npcFor); if (!s) return;
  const np = npcNp(s); if (!np || np.none || npcBaseAtk(s) == null) return;
  const I = npcInputs(s, np), r = npcCalc(s, np, I);
  const o = (k) => box.querySelector(`[data-npc-o="${k}"]`);
  if (!r) return;
  const k = npcKill(r, I.hp);
  const kill = k == null ? "" : k >= 1 ? `<span class="npc-kill yes">Kills it every time</span>` : k <= 0 ? `<span class="npc-kill no">Leaves it at ${fmt(Math.round(I.hp - r.max))} HP or more</span>` : `<span class="npc-kill maybe">Kills it ${Math.round(k * 100)}% of the time</span>`;
  if (o("out")) o("out").innerHTML = `<div class="npc-big"><b>${fmt(Math.round(r.avg))}</b><span>about, against ${esc(I.ecls)} (${esc(I.eattr)})</span></div>
    <div class="npc-range"><span>${fmt(Math.round(r.min))}</span><i aria-hidden="true"><b style="--k:${k == null ? 0.5 : clamp(1 - k, 0, 1)}"></b></i><span>${fmt(Math.round(r.max))}</span></div>${kill}`;
  if (o("cls")) o("cls").innerHTML = `<p>Against every class (${esc(I.eattr)}, same buffs):</p><div class="npc-cg">${AFF_CLASSES.map((c) => { const v = npcCalc(s, np, I, c); const f = aff(s.cls, c); return `<span class="npc-c ${affCls(f)}${c === I.ecls ? " on" : ""}" title="${esc(c)}: ${affTxt(f)}"><i>${esc(ABBR[c] || c.slice(0, 3))}</i><b>${v ? qpShort(Math.round(v.avg)) : "—"}</b></span>`; }).join("")}</div>`;
  if (o("sum")) o("sum").textContent = `NP${I.lv}${np.se && np.se.byOc ? " OC " + I.oc * 100 + "%" : ""} vs ${I.ecls}: about ${fmt(Math.round(r.avg))}`;
  if (o("se") && np.se) o("se").textContent = `(Special damage ${fmtVal(np.se.vals[(np.se.byOc ? I.oc : I.lv) - 1] || 100, "%")})`;
  if (o("foot")) o("foot").textContent = `ATK ${fmt(r.atk)} (with Fou${typeof favOn === "function" && favOn(s) ? " and " + favOn(s).n : ""}) · ${np.card || "no card set"} · NP ${fmtVal(r.mult, "%")}${r.se !== 1 ? " · ×" + r.se : ""}. Random roll 0.9 to 1.099; class ATK, affinity and attribute included.`;
}

const renderDossier24n = renderDossier;
renderDossier = function (force) {
  const r = renderDossier24n(force);
  const d = document.getElementById("dossier");
  if (d && !S.editing && !d.querySelector("#servant-form")) {
    const s = S.servants.find((v) => v.id === shownId()), sec = d.querySelector(".np-sec");
    if (s && sec && S.npEdit !== s.id && !sec.querySelector(".npc")) {
      sec.insertAdjacentHTML("beforeend", npcHTML(s));
      const box = sec.querySelector(".npc"); if (box && box.open) npcPaint(box);
    }
  }
  return r;
};
const typingInDossier24n = typingInDossier;
typingInDossier = function () {
  const a = document.activeElement;
  return typingInDossier24n() || !!(a && a.closest && a.closest(".npc") && a.matches && a.matches("input[data-npc]"));
};
function npcSet(t) {
  const box = t.closest(".npc"); if (!box) return;
  const k = t.dataset.npc, id = box.dataset.npcFor;
  if (k === "lv") NPC_LV[id] = Number(t.value);
  else if (k === "oc") NPC_OC[id] = Number(t.value);
  else if (k === "se" || k === "auto") npcPrefs[k] = t.checked;
  else if (k === "ecls" || k === "eattr") npcPrefs[k] = t.value;
  else { const v = num(t.value); if (v == null || v === 0) delete npcPrefs[k]; else npcPrefs[k] = clamp(v, k === "hp" || k === "dp" ? 0 : -100, k === "hp" ? 1e9 : k === "dp" ? 1e5 : 1000); }
  npcSave(); npcPaint(box);
}
document.addEventListener("input", (e) => { const t = e.target; if (t && t.dataset && t.dataset.npc != null && t.tagName === "INPUT" && t.type !== "checkbox") npcSet(t); });
document.addEventListener("change", (e) => { const t = e.target; if (t && t.dataset && t.dataset.npc != null && (t.tagName === "SELECT" || t.type === "checkbox")) npcSet(t); });
document.addEventListener("toggle", (e) => {
  const d = e.target; if (!d || !d.matches || !d.matches("details.npc")) return;
  NPC_OPEN[d.dataset.npcFor] = d.open; if (d.open) npcPaint(d);
}, true);
