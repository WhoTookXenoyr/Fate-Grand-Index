/* ================= 0.25.0: five Craft Essences that suit a servant (Past Chaldea) =================
   Nobody publishes which Craft Essences players put on which servant, so the page works it out itself from each Craft
   Essence's effects at max limit break (only the parts that always work: nothing for events only, nothing on a
   condition, no Bond, Valentine, EXP or drop-up Craft Essences):
   - a servant whose NP does damage gets the Craft Essences that make its first NP hit hardest, soonest: NP Strength,
     its NP card's effectiveness and ATK multiply like they do in the damage formula (with the CE's own ATK), and NP
     charged at the start counts for a lot (100% means the NP is there on turn 1). AoE servants also value NP Gain
     (the refund for the next wave); single-target ones critical damage and stars.
   - a support servant (its NP doesn't do damage) gets NP at the start, NP Gain and NP each turn, so its skills and NP
     come round more often. */
const CE_OK_KIND = new Set(["N", "R", "E", "C"]);
const CE_CARD = {Buster: "B", Arts: "A", Quick: "Q"};
const ceFxCache = new Map();
// what a Craft Essence always gives its holder, from its max limit break text
function ceFx(c, cls) {
  const key = c.no + "|" + (cls || ""); if (ceFxCache.has(key)) return ceFxCache.get(key);
  const F = {start: 0, np: 0, card: {B: 0, A: 0, Q: 0}, atk: 0, gain: 0, turn: 0, crit: 0, stars: 0, sgen: 0, dp: 0};
  (c.x && c.x.length ? c.x : c.e).forEach((line) => {
    let l = String(line || "");
    if (/\[Event Only\]|Friend Points|EXP|Bond gained|QP|drops?\b|only if|when equipped|equipped with this/i.test(l)) return;
    const cm = /if equipped by \[([^\]]+)\] class(?: \[[^\]]*\])?/i.exec(l);
    if (cm) { if (!cls || nname(cm[1]) !== nname(cls)) return; l = l.replace(cm[0], ""); }
    l = l.replace(/\[(MAX|Demerit)\]/gi, "").replace(/for yourself|to yourself/gi, "").trim();
    // "Increase Buster Card effectiveness & NP Strength by 10%": a value goes to every stat named since the last one
    let pending = [];
    l.split(/\s+(?:&|\+)\s+/).forEach((seg) => {
      const v = /\b(?:by|at|of)\s+(\d+(?:\.\d+)?)%/i.exec(seg), n = /\b(?:gain|Plus)\s+(\d+(?:\.\d+)?)\b/i.exec(seg);
      pending.push(seg);
      if (!v && !n) return;
      const val = Number((v || n)[1]), segs = pending; pending = [];
      segs.forEach((s) => {
        if (/\bwhen\b|\bwhile\b|\bif\b|chance|against|Special Attack|for \d+ turns? only/i.test(s)) return;
        if (/begin (?:the )?battle with/i.test(s) && /NP/.test(s)) F.start += val;
        else if (/NP gauge/i.test(s) && /each turn|every turn|per turn/i.test(s)) F.turn += val;
        else if (/NP (?:Strength|damage)/i.test(s)) F.np += val;
        else if (/NP Gain|NP generation/i.test(s)) F.gain += val;
        else if (/Critical (?:Strength|damage)/i.test(s) && !/(?:Buster|Arts|Quick) Card Critical/i.test(s)) F.crit += val;
        else if (/(?:Buster|Arts|Quick)(?: Card)? (?:effectiveness|performance)/i.test(s)) (s.match(/Buster|Arts|Quick/gi) || []).forEach((k) => { F.card[CE_CARD[k[0].toUpperCase() + k.slice(1).toLowerCase()]] += val; });
        else if (/\bATK\b/.test(s) && !/Strength/i.test(s)) F.atk += val;
        else if (/C\. Stars? each turn|Stars? (?:each|every|per) turn/i.test(s)) F.stars += val;
        else if (/Star Drop Rate/i.test(s)) F.sgen += val;
        else if (/Damage Plus/i.test(s)) F.dp += val;
      });
    });
  });
  ceFxCache.set(key, F); return F;
}
function ceWhy(F, card) {
  const w = [];
  if (F.start) w.push("NP " + Math.min(100, F.start) + "% at the start");
  if (F.turn) w.push("NP +" + F.turn + "% each turn");
  if (F.np) w.push("NP Strength +" + F.np + "%");
  if (card && F.card[card]) w.push({B: "Buster", A: "Arts", Q: "Quick"}[card] + " +" + F.card[card] + "%");
  if (F.atk) w.push("ATK +" + F.atk + "%");
  if (F.gain) w.push("NP Gain +" + F.gain + "%");
  if (F.crit) w.push("crits +" + F.crit + "%");
  if (F.stars) w.push(F.stars + " stars a turn");
  if (F.dp) w.push("Damage Plus " + fmt(F.dp));
  return w;
}
const ceSuggestCache = new Map();
function ceSuggest(a, n) {
  n = n || 5; if (!a) return [];
  if (ceSuggestCache.has(a.no)) return ceSuggestCache.get(a.no).slice(0, n);
  const np = a.np || {}, card = np.cd || "", dmg = np.tg && np.tg !== "Support" && (np.r || []).some((r) => /^\s*damage/i.test(r[0]));
  const aoe = np.tg === "AoE", svAtk = (a.atk && (a.atk[1] || a.atk[0])) || 10000;
  const rows = [];
  ATLAS_C.forEach((c) => {
    if (!CE_OK_KIND.has(c.f)) return;
    const F = ceFx(c, a.c), ceAtk = (c.atk && c.atk[1]) || 0, start = Math.min(100, F.start);
    let sc;
    if (dmg) {
      const mult = (1 + F.card[card] / 100) * (1 + F.atk / 100) * (1 + F.np / 100) * (1 + ceAtk / svAtk);
      const soon = 1 + start / 100 * 0.9 + Math.min(F.turn, 20) / 100 * 1.5;
      sc = mult * soon + (aoe ? F.gain / 100 * 0.8 : F.crit / 100 * 0.35 + F.stars / 40) + F.dp / 4000;
    } else {
      sc = 1 + start / 100 * 1.2 + F.gain / 100 * 1.6 + F.turn / 100 * 4 + (F.card[card] || 0) / 400 + F.stars / 60 + ((c.hp && c.hp[1]) || 0) / 20000;
    }
    const why = ceWhy(F, card);
    if (why.length) rows.push({c: c, sc: sc, why: why, sig: why.join("|")});
  });
  // the best first; Craft Essences that do exactly the same count once (the gacha one, else the newest)
  const kindRank = {N: 0, R: 1, E: 2, C: 3};
  rows.sort((x, y) => y.sc - x.sc || kindRank[x.c.f] - kindRank[y.c.f] || y.c.no - x.c.no);
  const seen = new Set(), out = [];
  for (const r of rows) { if (seen.has(r.sig)) continue; seen.add(r.sig); out.push(r); if (out.length >= 12) break; }
  ceSuggestCache.set(a.no, out);
  return out.slice(0, n);
}
function ceSuggestHTML(a, s) {
  const list = ceSuggest(a, 5); if (!list.length) return "";
  const np = a.np || {}, dmg = np.tg && np.tg !== "Support";
  const add = s && !S.readOnly && favOf(s).some((v) => v == null);
  return `<section class="d-sec ces-sec"><div class="sec-head"><h3>Craft Essences that suit ${esc(a.n)}</h3></div>
    <ol class="ces-list">${list.map((r, i) => `<li class="ces-row"><span class="ces-n">${i + 1}</span>
      <button type="button" class="ces-ce r${r.c.r}" data-action="ce-open" data-no="${r.c.no}" data-from="${a.no}" title="${esc((r.c.x && r.c.x.length ? r.c.x : r.c.e).join("\n"))}"><img src="${esc(ceFace(r.c))}" alt="" loading="lazy" decoding="async"><span><b>${esc(r.c.n)}</b><small>${r.why.map(esc).join(" · ")}</small></span></button>
      ${add && !favOf(s).includes(r.c.no) ? `<button type="button" class="btn ghost sm ces-fav" data-action="ces-fav" data-id="${esc(s.id)}" data-no="${r.c.no}" title="Keep it in ${esc(s.name)}'s favourite Craft Essences">+ Favourite</button>` : ""}</li>`).join("")}</ol>
    <p class="ces-note">Worked out by this page from what each Craft Essence always does at max limit break, for ${dmg ? (np.tg === "AoE" ? "an AoE" : "a single-target") + " " + esc({B: "Buster", A: "Arts", Q: "Quick"}[np.cd] || "") + " NP: its first NP's damage, and how soon it's ready" : "a support: NP at the start, NP Gain and NP each turn"}. Players' own picks aren't published anywhere, so this isn't a usage chart.</p></section>`;
}
// in Past Chaldea, under the skills; a Craft Essence opened from here has a way back to the servant
const pcDetailHTML25 = pcDetailHTML;
pcDetailHTML = function (x) {
  const html = pcDetailHTML25(x), mine = mineMap().get(x.no), extra = ceSuggestHTML(x, mine && !mine.wish ? mine : null);
  return extra ? html.replace(/(<section class="d-sec"><h3>Skills<\/h3>)/, extra + "$1") : html;
};
const ceDetailHTML25 = ceDetailHTML;
ceDetailHTML = function (c) {
  const html = ceDetailHTML25(c), from = pcOpen && pcOpen.from ? ATLAS_BY_NO.get(pcOpen.from) : null;
  return from ? html.replace('<div class="pcd-top">', `<p class="pcd-back"><button type="button" class="btn ghost sm" data-action="pc-open" data-no="${from.no}">← ${esc(from.n)}</button></p><div class="pcd-top">`) : html;
};
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="ce-open"][data-from], [data-action="ces-fav"]'); if (!b) return;
  if (b.dataset.action === "ce-open") { setTimeout(() => { if (pcOpen && pcOpen.ce) { pcOpen.from = num(b.dataset.from); pcRenderDetail(); } }, 0); return; }
  e.preventDefault(); e.stopPropagation();
  const s = S.servants.find((x) => x.id === b.dataset.id), no = num(b.dataset.no); if (!s || S.readOnly || !CE_BY_NO.has(no)) return;
  const fav = favOf(s), i = fav.findIndex((v) => v == null); if (i < 0) { toast(s.name + " already has five favourite Craft Essences."); return; }
  fav[i] = no; s.favCe = fav; scheduleWrite("servants", s); pcRenderDetail(); renderDossier();
  toastAction(CE_BY_NO.get(no).n + " is one of " + s.name + "'s favourite Craft Essences now.", "Undo", () => { const f2 = favOf(s); const j = f2.indexOf(no); if (j >= 0) { f2[j] = null; s.favCe = f2; scheduleWrite("servants", s); pcRenderDetail(); renderDossier(); } });
}, true);
