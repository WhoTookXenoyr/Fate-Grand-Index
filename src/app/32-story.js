/* ================= 0.24.0: the Story page, and a look for each chapter =================
   Pick where you stand in the main story (chapter, section, battle). The page shows each section's battles the way
   the wiki's story pages do (sections with arrows, battles by wave, every enemy's class, attribute and HP), and for
   your next fight: the classes that hit it hardest and the servants on your list (and your Guests) best suited to it,
   worked out with the NP damage calculator. The chapters come from Atlas Academy's NA data while the page is online,
   kept in this browser afterwards (fate-grand-index-cache), so only what NA has released shows up.
   Away from the servant page, the page wears your chapter's colours and a moving backdrop of its own (CSS transforms
   and opacity only), until you turn it off, open an Event page, or move on to the next chapter. */
const STORY_KEY = "spirit-origin-list:v1:story";
const STORY_V = 1, STORY_FRESH = 7 * 86400e3;
const ATLAS_NICE = "https://api.atlasacademy.io/nice/NA/";
const STORY_PARTS = [["1", "Part 1"], ["1.5", "Part 1.5"], ["2", "Part 2"], ["oc", "Ordeal Call"]];
// [war, part, short name, long name, palette (main, second, accent), backdrop]
const STORY_CH = [
  [100, "1", "Fuyuki", "Singularity F: Flame Contaminated City, Fuyuki", ["#d9542b", "#6b2a1a", "#f2b05e"], "embers"],
  [101, "1", "Orleans", "First Singularity: Hundred Years' War of the Evil Dragons, Orleans", ["#3b5ca8", "#b23a2e", "#e8c66a"], "embers"],
  [102, "1", "Septem", "Second Singularity: Eternal Madness Empire, Septem", ["#b3203a", "#e9c46a", "#7a1630"], "petals"],
  [103, "1", "Okeanos", "Third Singularity: Sealed Ends of the Four Seas, Okeanos", ["#1f7fb5", "#0d3c66", "#7fd6e8"], "waves"],
  [104, "1", "London", "Fourth Singularity: The Mist City, London", ["#6e7b85", "#2e3a42", "#c9b27a"], "fog"],
  [105, "1", "E Pluribus Unum", "Fifth Singularity: North American Myth War, E Pluribus Unum", ["#2b4a8c", "#b22234", "#e8e1d0"], "stars"],
  [106, "1", "Camelot", "Sixth Singularity: Divine Realm of the Round Table, Camelot", ["#e8d07a", "#8a6a2a", "#f6f0dc"], "beams"],
  [107, "1", "Babylonia", "Seventh Singularity: Absolute Demonic Front, Babylonia", ["#c2843c", "#5a3a7a", "#e8c48a"], "dust"],
  [108, "1", "Solomon", "Final Singularity: The Grand Temple of Time, Solomon", ["#3a2a6a", "#d4a73a", "#9a7cf0"], "rings"],
  [201, "1.5", "Shinjuku", "Pseudo-Singularity I: Quarantined Territory of Malice, Shinjuku", ["#5a2a8a", "#1a1a2a", "#e04a8a"], "rain"],
  [202, "1.5", "Agartha", "Pseudo-Singularity II: Subterranean World of Folklore, Agartha", ["#2a7a5a", "#7a4a1a", "#d8c08a"], "motes"],
  [203, "1.5", "Shimosa", "Pseudo-Parallel World: The Stage of Carnage, Shimousa", ["#7a1a2a", "#2a1a1a", "#d8a0b0"], "petals"],
  [204, "1.5", "Salem", "Pseudo-Singularity IV: The Forbidden Advent Garden, Salem", ["#5a4a32", "#2a3a2a", "#c0b090"], "fog"],
  [300, "2", "Prologue", "Prologue: Dec 26th, 2019", ["#3a4a6a", "#a0b0c8", "#e8eef6"], "snow"],
  [301, "2", "Anastasia", "Lostbelt No.1: Permafrost Empire, Anastasia", ["#8ab8e0", "#2a4a7a", "#f0f6fc"], "snow"],
  [302, "2", "Götterdämmerung", "Lostbelt No.2: The Eternal Icy Fire Century, Götterdämmerung", ["#c8283c", "#2ec8e0", "#f4e8ea"], "icefire"],
  [303, "2", "SIN", "Lostbelt No.3: The Synchronized Intellect Nation, SIN", ["#c03a2a", "#3a2a22", "#e8c070"], "grid"],
  [304, "2", "Yuga Kshetra", "Lostbelt No.4: Saṃsāra of Genesis and Terminus, Yugakshetra", ["#d07a2a", "#5a2a7a", "#f0d080"], "motes"],
  [305, "2", "Atlantis", "Lostbelt No.5: Ancient Ocean of the Dreadnought Gods, Atlantis", ["#1a6ab0", "#0a2a5a", "#80e0f0"], "waves"],
  [306, "2", "Olympus", "Lostbelt No.5: Interstellar Mountainous City, Olympus", ["#2a9ab0", "#d8dcf0", "#7a5ae0"], "stars"],
  [307, "2", "Heian-kyo", "Naraka Mandala, Heian-kyo", ["#b02a4a", "#2a1a3a", "#f0b0c8"], "petals"],
  [308, "2", "Avalon le Fae", "Lostbelt No.6: Fae Round Table Domain, Avalon le Fae", ["#5ab07a", "#7a3ab0", "#f0d0f0"], "motes"],
  [309, "2", "Tunguska Sanctuary", "Anti-Primate Biosphere, Tunguska Sanctuary", ["#2a2a5a", "#8a2aa0", "#e0d0ff"], "stars"],
  [310, "2", "Traum", "Realm of the Thanatos Impulse, Traum", ["#6a1a3a", "#2a1a2a", "#c08aa0"], "fog"],
  [311, "2", "Nahui Mictlan", "Lostbelt No.7: Golden Sea of Trees, Nahui Mictlān", ["#2a8a4a", "#d0a02a", "#1a3a2a"], "leaves"],
  [400, "oc", "Ordeal Call Prologue", "Ordeal Call Prologue", ["#5a6a8a", "#1a1a2a", "#c0d0f0"], "beams"],
  [402, "oc", "Paper Moon", "Ordeal Call I: Zero Compass Inner Domain, Paper Moon", ["#d8d0b8", "#3a3a5a", "#a0b0d0"], "grid"],
  [403, "oc", "Id", "Ordeal Call II: The Inescapable Gehenna, Id", ["#7a1a1a", "#1a0a0a", "#e05a3a"], "embers"],
  [404, "oc", "Archetype Inception", "Ordeal Call III: Bellum Novae Humanitatis, Archetype Inception", ["#3a6ae0", "#e0e8ff", "#ff5a8a"], "beams"]
].map((c) => ({id: c[0], part: c[1], n: c[2], ln: c[3], pal: c[4], m: c[5]}));
const STORY_BY = new Map(STORY_CH.map((c) => [c.id, c]));
const capUrl = (id) => "https://static.atlasacademy.io/NA/Banner/questboard_cap" + id + ".png";

const ST = (() => {
  let v = {}; try { v = JSON.parse(lsGet(STORY_KEY) || "{}") || {}; } catch (e) { v = {}; }
  const pos = v.pos && STORY_BY.has(num(v.pos.w)) ? {w: num(v.pos.w), q: num(v.pos.q) || 0, ph: num(v.pos.ph) || 0} : null;
  return {pos: pos, theme: v.theme !== false, part: v.part || (pos ? STORY_BY.get(pos.w).part : "1"), view: pos ? {w: pos.w, q: pos.q, ph: pos.ph} : null,
    wars: {}, phases: {}, busy: new Set(), err: {}};
})();
const storySave = () => lsSet(STORY_KEY, JSON.stringify({pos: ST.pos, theme: ST.theme, part: ST.part}));

/* ---------- Atlas Academy's data, made small and kept ---------- */
const ATTR_N = {human: "Man", earth: "Earth", sky: "Sky", star: "Star", beast: "Beast"};
const TRAIT_SKIP = /^(canBeInBattle|notBasedOnServant|basedOnServant|attribute|class|gender|unknown|normalAttack|cardQuick|cardArts|cardBuster|hominidaeServant$|humanoid$|living)/;
const traitWords = (t) => String(t || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (m) => m.toUpperCase());
function storyWarSmall(w) {
  const qs = [];
  (w.spots || []).forEach((sp) => (sp.quests || []).forEach((q) => {
    if (q.type !== "main") return;
    qs.push({id: q.id, n: liveText(q.name), c: q.chapterId | 0, sub: q.chapterSubId | 0, str: liveText(q.chapterSubStr || ""), pe: (q.phasesWithEnemies || []).slice(), ph: (q.phases || []).slice(),
      lv: q.recommendLv == null ? "" : String(q.recommendLv), ap: q.consume | 0, sp: liveText(sp.name || q.spotName || ""), pr: q.priority | 0});
  }));
  qs.sort((a, b) => a.c - b.c || a.sub - b.sub || b.pr - a.pr || a.id - b.id);
  return {v: STORY_V, at: Date.now(), id: w.id, n: liveText(w.longName || w.name), b: w.banner || "", q: qs};
}
function storyPhaseSmall(d) {
  const st = (d.stages || []).map((sg) => {
    const all = sg.enemies || [], shift = all.filter((e) => e.deck === "shift"), used = new Set();
    const one = (e) => {
      const sh = e.enemyScript && Array.isArray(e.enemyScript.shift) ? e.enemyScript.shift : [];
      const bars = shift.filter((x) => sh.includes(x.npcId)).map((x) => { used.add(x); return x.hp | 0; });
      const sv = e.svt || {};
      return {n: liveText(e.name || sv.name), c: liveCls(sv.className), a: ATTR_N[sv.attribute] || "", hp: e.hp | 0, bars: bars, f: sv.face || "", lv: e.lv | 0, ct: e.chargeTurn | 0, role: e.roleType || "",
        tr: (e.traits || []).map((t) => t && t.name).filter((t) => t && !TRAIT_SKIP.test(t)).slice(0, 14).map(traitWords)};
    };
    const out = all.filter((e) => e.deck === "enemy").sort((a, b) => (a.deckId | 0) - (b.deckId | 0)).map(one);
    const left = shift.filter((x) => !used.has(x));
    if (left.length && out.length) { const big = out.reduce((m, e) => e.hp > m.hp ? e : m, out[0]); big.bars = big.bars.concat(left.map((x) => x.hp | 0)); }
    return {w: sg.wave | 0, e: out, call: all.filter((e) => e.deck === "call").map(one)};
  }).filter((x) => x.e.length || x.call.length);
  return {v: STORY_V, at: Date.now(), cls: (d.className || []).map(liveCls), fld: (d.individuality || []).map((t) => t && t.name).filter(Boolean).map(traitWords), st: st};
}
async function storyFetch(url) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 40000);
  try { const r = await fetch(url, {signal: ac.signal}); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function storyLoad(kind, key, url, small) {
  const box = kind === "war" ? ST.wars : ST.phases, k = "story:" + kind + ":" + key;
  if (box[key] && Date.now() - box[key].at < STORY_FRESH) return box[key];
  if (ST.busy.has(k)) return box[key] || null;
  if (ST.err[k]) return box[key] || null; // failed once: only Try again asks again (no loop of retries)
  if (!box[key]) { const c = await kv.get(k); if (c && c.v === STORY_V) { box[key] = c; if (Date.now() - c.at < STORY_FRESH) return c; } }
  ST.busy.add(k);
  try { const d = small(await storyFetch(url)); box[key] = d; delete ST.err[k]; await kv.set(k, d); return d; }
  catch (e) { if (!box[key]) ST.err[k] = navigator.onLine === false ? "offline" : "failed"; return box[key] || null; }
  finally { ST.busy.delete(k); }
}
const storyWar = (id) => storyLoad("war", String(id), ATLAS_NICE + "war/" + id, storyWarSmall);
const storyPhase = (q, ph) => storyLoad("phase", q + "-" + ph, ATLAS_NICE + "quest/" + q + "/" + ph, storyPhaseSmall);

/* ---------- where you are, and what comes next ---------- */
function secLabel(q, i) {
  const base = (x, j) => x.str || (x.sub ? "Section " + x.sub : (j === 0 && /prologue/i.test(x.n) ? "Prologue" : "Section " + (j + 1)));
  // two "Prologue" sections (Götterdämmerung has them) become Prologue 1 and Prologue 2
  const war = ST.wars[q.w] || Object.values(ST.wars).find((w) => w.q.includes(q)), b = base(q, i);
  if (!war) return b;
  const same = war.q.filter((x, j) => base(x, j) === b);
  return same.length > 1 ? b + " " + (same.indexOf(q) + 1) : b;
}
// every fight of a chapter in order: [quest, phase]
function fightsOf(war) { const out = []; (war ? war.q : []).forEach((q) => (q.pe.length ? q.pe : []).forEach((p) => out.push([q, p]))); return out; }
function nextChapter(id) { const i = STORY_CH.findIndex((c) => c.id === id); return i >= 0 && i + 1 < STORY_CH.length ? STORY_CH[i + 1] : null; }

/* ---------- what beats the next fight ---------- */
const STORY_CLASSES = AFF_CLASSES.filter((c) => c !== "Beast");
function fightEnemies(ph) { return ph ? ph.st.flatMap((w) => w.e.map((e) => Object.assign({}, e, {w: w.w, tot: e.hp + e.bars.reduce((a, v) => a + v, 0)}))) : []; }
function classAdvice(ph) {
  const es = fightEnemies(ph), W = es.reduce((a, e) => a + e.tot, 0) || 1;
  return STORY_CLASSES.map((c) => {
    const off = es.reduce((a, e) => a + e.tot * aff(c, e.c), 0) / W, inc = es.reduce((a, e) => a + e.tot * aff(e.c, c), 0) / W;
    const strong = es.filter((e) => aff(c, e.c) > 1).reduce((a, e) => a + e.tot, 0) / W;
    return {c: c, off: off, inc: inc, strong: strong, sc: off / Math.sqrt(Math.max(0.5, inc))};
  }).sort((a, b) => b.sc - a.sc || a.c.localeCompare(b.c));
}
const traitHit = (np, e) => { if (!np || !np.se || np.se.add || !np.se.trait) return false; const t = nname(np.se.trait); return e.tr.some((x) => { const y = nname(x); return y === t || y.includes(t) || t.includes(y); }); };
function servantFight(s, ph) {
  const np = npcNp(s); if (!np || np.none || npcBaseAtk(s) == null) return null;
  const a = atlasOf(s), tgt = s.npTarget || (a && a.np && a.np.tg) || "", aoe = /aoe/i.test(tgt);
  if (/support/i.test(tgt)) return null;
  let removed = 0, total = 0, boss = null;
  ph.st.forEach((w) => {
    const es = w.e.map((e) => Object.assign({}, e, {tot: e.hp + e.bars.reduce((x, v) => x + v, 0)})); if (!es.length) return;
    const wt = es.reduce((x, e) => x + e.tot, 0); total += wt;
    const dm = es.map((e) => { const I = {lv: clamp(num(s.npLevel) || 1, 1, 5), oc: 1, se: traitHit(np, e), auto: true, atk: 0, def: 0, card: 0, np: 0, pow: 0, dp: 0, ecls: e.c, eattr: e.a};
      const r = npcCalc(s, np, I, AFF_CLASSES.includes(e.c) ? e.c : "Shielder"); return r ? r.avg : 0; });
    if (aoe) removed += es.reduce((x, e, i) => x + Math.min(e.tot, dm[i]), 0);
    else removed += Math.max.apply(null, es.map((e, i) => Math.min(e.tot, dm[i])));
    es.forEach((e, i) => { if (!boss || e.tot > boss.e.tot) boss = {e: e, dmg: dm[i]}; });
  });
  if (!total) return null;
  return {s: s, aoe: aoe, frac: removed / total, boss: boss, rank: (rankOf(s.id) || {sc: {total: 0}}).sc.total};
}
function servantAdvice(ph) {
  return S.servants.map((s) => servantFight(s, ph)).filter(Boolean).sort((a, b) => b.frac - a.frac || b.rank - a.rank).slice(0, 6);
}

/* ---------- the page ---------- */
TABS.push("story");
(function () { if ((location.hash || "").slice(1) === "story") S.tab = "story"; })();
const enemyIcon = (e) => e.f ? `<img class="st-face" src="${esc(e.f)}" alt="" loading="lazy" decoding="async">` : `<i class="st-face none" aria-hidden="true"></i>`;
const clsChip = (c) => CLASS_LOGO[c] ? `<img class="st-cls" src="${CLASS_LOGO[c]}" alt="${esc(c)}" title="${esc(c)}">` : `<span class="st-cls t" title="${esc(c || "Unknown class")}">${esc(ABBR[c] || (c || "?").slice(0, 3).toUpperCase())}</span>`;
function waveHTML(w, ph) {
  return `<div class="st-wave"><h5>Wave ${w.w || "?"}${w.call.length ? ` <small>+ ${plural(w.call.length, "reinforcement")}</small>` : ""}</h5><ul class="st-enemies">${w.e.concat(w.call.map((x) => Object.assign({}, x, {rein: true}))).map((e) => `
    <li class="st-en${/^(servant|danger|boss)$/.test(e.role) || e.bars.length ? " boss" : ""}${e.rein ? " rein" : ""}">${enemyIcon(e)}${clsChip(e.c)}
      <div class="st-en-m"><b>${esc(e.n)}</b><span>${esc([e.c, e.a, e.lv ? "Lv " + e.lv : ""].filter(Boolean).join(" · "))}${e.ct ? ` · charge ${e.ct}` : ""}${e.rein ? " · arrives later" : ""}</span>
        ${e.tr.length ? `<span class="st-tr">${e.tr.slice(0, 6).map((t) => `<i>${esc(t)}</i>`).join("")}</span>` : ""}</div>
      <div class="st-hp"><b>${fmt(e.hp)}</b>${e.bars.length ? `<span>${e.bars.map((h) => "+ " + fmt(h)).join(" ")}</span>` : ""}<small>HP${e.bars.length ? " · " + (e.bars.length + 1) + " bars" : ""}</small></div></li>`).join("")}</ul></div>`;
}
function adviceHTML(ph, q, p, war) {
  if (!ph) return "";
  const cls = classAdvice(ph).slice(0, 4), sv = servantAdvice(ph), mine = new Set(sv.map((x) => x.s.id));
  const topCls = new Set(cls.slice(0, 3).map((x) => x.c));
  const borrow = S.guests.filter((g) => topCls.has(g.cls)).slice(0, 4);
  const pct = (v) => Math.round(v * 100) + "%";
  return `<section class="st-next" aria-labelledby="st-next-h"><header><p class="st-k">Your next fight</p><h3 id="st-next-h">${esc(secLabel(q, war.q.indexOf(q)))} · ${esc(q.n)} <small>battle ${q.pe.indexOf(p) + 1} of ${q.pe.length}</small></h3></header>
    <div class="st-cls-row">${cls.map((x) => `<div class="st-ccard${x.off > 1.2 ? " good" : ""}">${clsChip(x.c)}<div><b>${esc(x.c)}</b><span>${x.strong ? `strong against ${pct(x.strong)} of the HP` : "no advantage"}; takes ${x.inc > 1.2 ? "<em>more</em>" : x.inc < 0.9 ? "less" : "normal"} damage</span></div></div>`).join("")}</div>
    ${sv.length ? `<h4 class="st-sub">Best from your list</h4><ol class="st-best">${sv.map((x, i) => `<li><button type="button" class="st-sv" data-action="goto" data-id="${esc(x.s.id)}">${iconHTML(x.s, "sm")}
        <span class="st-sv-m"><b>${esc(x.s.name)}</b>${x.s.wish ? `<i class="tag">Guest</i>` : ""}<span>${esc(x.s.cls || "")} · ${x.aoe ? "AoE" : "single target"} NP${num(x.s.npLevel) || 1}</span></span>
        <span class="st-sv-n"><b>${pct(Math.min(1, x.frac))}</b><small>of the fight's HP with one NP a wave</small>${x.boss ? `<small>≈ ${fmt(Math.round(x.boss.dmg))} on ${esc(x.boss.e.n)} (${fmt(x.boss.e.tot)} HP)</small>` : ""}</span></button></li>`).join("")}</ol>`
      : `<p class="tr-none">No servant on your list has ATK and an NP Damage row filled in yet, so there's nothing to compare. Fill in from NA on the servant page.</p>`}
    ${borrow.length ? `<p class="st-borrow">Worth borrowing: ${borrow.map((g) => `<b>${esc(g.name)}</b> <small>(${esc(g.cls)})</small>`).join(", ")}</p>` : ""}
    <p class="st-note">One NP a wave with no buffs, against each enemy's class and attribute, with class passives and your equipped Craft Essence. Buffs and the order you fire NPs in change it.</p></section>`;
}
function storyHTML() {
  const parts = `<div class="seg st-parts" role="tablist" aria-label="Story parts">${STORY_PARTS.map(([k, t]) => `<button type="button" role="tab" data-action="st-part" data-k="${k}" aria-selected="${ST.part === k}">${t}</button>`).join("")}</div>`;
  const chips = STORY_CH.filter((c) => c.part === ST.part).map((c) => `<button type="button" class="st-ch${ST.view && ST.view.w === c.id ? " on" : ""}${ST.pos && ST.pos.w === c.id ? " here" : ""}" data-action="st-ch" data-w="${c.id}" style="--c1:${c.pal[0]};--c2:${c.pal[1]};--c3:${c.pal[2]}">
      <img class="st-cap" src="${esc(capUrl(c.id))}" alt="" loading="lazy" decoding="async"><b>${esc(c.n)}</b>${ST.pos && ST.pos.w === c.id ? `<small>You're here</small>` : ""}</button>`).join("");
  const posLine = ST.pos ? (() => { const c = STORY_BY.get(ST.pos.w), w = ST.wars[ST.pos.w], q = w && w.q.find((x) => x.id === ST.pos.q); return `You're at <b>${esc(c.n)}</b>${q ? ` · ${esc(secLabel(q, w.q.indexOf(q)))}, battle ${Math.max(1, q.pe.indexOf(ST.pos.ph) + 1)}` : ""}.`; })() : "Pick the chapter you're on, then the section and battle you've reached.";
  const head = `<header class="st-head"><div><h2>Story</h2><p class="st-pos">${posLine}</p></div>
    <label class="st-theme"><input type="checkbox" data-st-theme${ST.theme ? " checked" : ""}> Chapter look on the other pages</label></header>`;
  let body = "";
  const v = ST.view;
  if (v) {
    const c = STORY_BY.get(v.w), war = ST.wars[v.w], k = "story:war:" + v.w;
    if (!war) body = ST.err[k] ? `<div class="st-msg"><p>${ST.err[k] === "offline" ? "You're offline, and this chapter isn't saved in this browser yet." : "Atlas Academy didn't answer for this chapter."}</p><button type="button" class="btn sm" data-action="st-retry">Try again</button></div>` : `<div class="skeleton" style="height:260px"></div>`;
    else if (!war.q.length) body = `<p class="tr-none">${esc(c.n)} has no story sections in NA's data yet.</p>`;
    else {
      const qi = Math.max(0, war.q.findIndex((x) => x.id === v.q)), q = war.q[qi], here = ST.pos && ST.pos.w === v.w;
      const posQi = here ? war.q.findIndex((x) => x.id === ST.pos.q) : -1;
      const strip = `<div class="st-strip"><button type="button" class="st-arrow" data-action="st-sec" data-d="-1" aria-label="Previous section"${qi ? "" : " disabled"}>‹</button>
        <div class="st-secs" role="tablist" aria-label="Sections">${war.q.map((x, i) => `<button type="button" role="tab" class="st-sec${i === qi ? " on" : ""}${here && i < posQi ? " done" : ""}${here && i === posQi ? " here" : ""}" data-action="st-q" data-q="${x.id}" aria-selected="${i === qi}" title="${esc(x.n)}">${esc(secLabel(x, i).replace(/^Section /, ""))}</button>`).join("")}</div>
        <button type="button" class="st-arrow" data-action="st-sec" data-d="1" aria-label="Next section"${qi < war.q.length - 1 ? "" : " disabled"}>›</button></div>`;
      const pIdx = Math.max(0, q.pe.indexOf(v.ph));
      const ph = q.pe.length ? ST.phases[q.id + "-" + q.pe[pIdx]] : null, pk = "story:phase:" + q.id + "-" + q.pe[pIdx];
      const battles = q.pe.length ? `<div class="st-bats" role="tablist" aria-label="Battles">${q.pe.map((p, i) => `<button type="button" role="tab" class="st-bat${i === pIdx ? " on" : ""}${here && ST.pos.q === q.id && p === ST.pos.ph ? " here" : ""}" data-action="st-ph" data-ph="${p}" aria-selected="${i === pIdx}">Battle ${i + 1}</button>`).join("")}</div>` : "";
      const isHere = here && ST.pos.q === q.id && q.pe[pIdx] === ST.pos.ph;
      const fight = !q.pe.length ? `<p class="tr-none">Story only: no battles in this section.</p>`
        : ph ? `${ph.fld.length ? `<p class="st-fld">Field: ${ph.fld.map(esc).join(", ")}</p>` : ""}${ph.st.map((w) => waveHTML(w, ph)).join("") || `<p class="tr-none">No enemies listed for this battle.</p>`}`
        : ST.err[pk] ? `<div class="st-msg"><p>Couldn't load this battle's enemies.</p><button type="button" class="btn sm" data-action="st-retry">Try again</button></div>` : `<div class="skeleton" style="height:180px"></div>`;
      body = `<div class="st-chapter" style="--c1:${c.pal[0]};--c2:${c.pal[1]};--c3:${c.pal[2]}">
        <div class="st-title"><img class="st-cap big" src="${esc(war.b || capUrl(c.id))}" alt=""><div><h3>${esc(war.n || c.ln)}</h3><p>${plural(war.q.length, "section")} · ${plural(fightsOf(war).length, "battle")}</p></div></div>
        ${strip}
        <article class="st-q"><header><div><p class="st-k">${esc(secLabel(q, qi))}${q.sp ? " · " + esc(q.sp) : ""}</p><h4>${esc(q.n)}</h4></div>
          <dl class="st-qm">${q.lv ? `<div><dt>Rec. Lv</dt><dd>${esc(q.lv)}</dd></div>` : ""}${q.ap ? `<div><dt>AP</dt><dd>${q.ap}</dd></div>` : ""}<div><dt>Battles</dt><dd>${q.pe.length}</dd></div></dl></header>
          ${battles}
          ${q.pe.length ? `<div class="st-here-row">${isHere ? `<span class="st-here-tag">You're here</span><button type="button" class="btn sm primary" data-action="st-next">Cleared it: next fight</button>` : `<button type="button" class="btn sm" data-action="st-here">I'm here</button>`}</div>` : ""}
          <div class="st-fight">${fight}</div></article></div>`;
    }
  }
  // the next fight, wherever you're browsing
  let next = "";
  if (ST.pos) {
    const war = ST.wars[ST.pos.w], q = war && war.q.find((x) => x.id === ST.pos.q), ph = q ? ST.phases[q.id + "-" + ST.pos.ph] : null;
    if (q && ph) next = adviceHTML(ph, q, ST.pos.ph, war);
  }
  return head + next + `<nav class="st-nav" aria-label="Chapters">${parts}<div class="st-chips">${chips}</div></nav>` + body;
}
function renderStory() {
  const el = document.getElementById("story"); if (!el) return;
  if (S.tab !== "story") { if (el.firstChild) el.innerHTML = ""; return; }
  const sx = el.querySelector(".st-secs"), keep = sx ? sx.scrollLeft : null;
  el.innerHTML = storyHTML();
  const ns = el.querySelector(".st-secs");
  if (ns) { if (keep != null) ns.scrollLeft = keep; const on = ns.querySelector(".st-sec.on"); if (on && keep == null) ns.scrollLeft = on.offsetLeft - ns.clientWidth / 2 + on.offsetWidth / 2; }
  storyNeed();
}
// load what the page shows: the chapter you're browsing and its battle, and your own next fight
let storyNeedBusy = false;
async function storyNeed() {
  if (storyNeedBusy) return; storyNeedBusy = true;
  let changed = false;
  try {
    const want = [];
    if (ST.view) want.push(ST.view);
    if (ST.pos && (!ST.view || ST.pos.w !== ST.view.w || ST.pos.q !== ST.view.q || ST.pos.ph !== ST.view.ph)) want.push(ST.pos);
    for (const v of want) {
      const had = !!ST.wars[v.w], hadErr = !!ST.err["story:war:" + v.w], war = await storyWar(v.w); if (!had && war) changed = true;
      if (!war) { if (!hadErr && ST.err["story:war:" + v.w]) changed = true; continue; }
      let q = war.q.find((x) => x.id === v.q);
      if (!q && war.q.length) { q = war.q.find((x) => x.pe.length) || war.q[0]; v.q = q.id; v.ph = q.pe[0] || 0; changed = true; }
      if (q && q.pe.length && !q.pe.includes(v.ph)) { v.ph = q.pe[0]; changed = true; }
      if (q && q.pe.length) { const k = q.id + "-" + v.ph, had2 = !!ST.phases[k], hadE = !!ST.err["story:phase:" + k]; const ph = await storyPhase(q.id, v.ph); if ((ph && !had2) || (!ph && !hadE && ST.err["story:phase:" + k])) changed = true; }
    }
  } finally { storyNeedBusy = false; }
  if (changed && ST.pos) storySave();
  if (changed) { if (S.tab === "story") renderStory(); storyPaint(); }
}
function storySetPos(w, q, ph) {
  const was = ST.pos ? ST.pos.w : 0;
  ST.pos = {w: w, q: q, ph: ph}; storySave();
  if (was !== w) storyRepaint(); else storyPaint();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action; if (!/^st-/.test(a)) return;
  const v = ST.view, war = v ? ST.wars[v.w] : null;
  if (a === "st-part") { ST.part = b.dataset.k; storySave(); renderStory(); return; }
  if (a === "st-ch") { const w = num(b.dataset.w); ST.view = ST.pos && ST.pos.w === w ? {w: w, q: ST.pos.q, ph: ST.pos.ph} : {w: w, q: 0, ph: 0}; renderStory(); return; }
  if (a === "st-retry") { Object.keys(ST.err).forEach((k) => delete ST.err[k]); renderStory(); return; }
  if (!v || !war) return;
  const qi = Math.max(0, war.q.findIndex((x) => x.id === v.q));
  if (a === "st-sec" || a === "st-q") {
    const nq = a === "st-q" ? war.q.find((x) => x.id === num(b.dataset.q)) : war.q[clamp(qi + Number(b.dataset.d), 0, war.q.length - 1)];
    if (nq) { ST.view = {w: v.w, q: nq.id, ph: nq.pe[0] || 0}; renderStory(); const nb = document.querySelector(a === "st-q" ? `#story [data-action="st-q"][data-q="${nq.id}"]` : `#story [data-action="st-sec"][data-d="${b.dataset.d}"]`); if (nb && !nb.disabled) nb.focus({preventScroll: true}); }
    return;
  }
  if (a === "st-ph") { ST.view = {w: v.w, q: v.q, ph: num(b.dataset.ph)}; renderStory(); return; }
  if (a === "st-here") { storySetPos(v.w, v.q, v.ph); renderStory(); toast("Story position set: " + STORY_BY.get(v.w).n + "."); return; }
  if (a === "st-next") {
    const all = fightsOf(war), i = all.findIndex(([q, p]) => q.id === ST.pos.q && p === ST.pos.ph);
    if (i >= 0 && i + 1 < all.length) { const [q, p] = all[i + 1]; storySetPos(v.w, q.id, p); ST.view = {w: v.w, q: q.id, ph: p}; renderStory(); return; }
    const nc = nextChapter(v.w);
    if (nc) { storySetPos(nc.id, 0, 0); ST.view = {w: nc.id, q: 0, ph: 0}; ST.part = nc.part; storySave(); renderStory(); toast(STORY_BY.get(v.w).n + " cleared. On to " + nc.n + "!"); }
    else toast("That's the last chapter NA has. Well done, Master.");
  }
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("input[data-st-theme]")) return;
  ST.theme = t.checked; storySave(); storyRepaint();
});
document.addEventListener("error", (e) => { const t = e.target; if (t && t.classList && (t.classList.contains("st-cap") || t.classList.contains("st-face") || t.classList.contains("story-plate"))) t.classList.add("bad"); }, true);
const renderChrome24s = renderChrome;
renderChrome = function () {
  const r = renderChrome24s.apply(this, arguments);
  const v = document.getElementById("view-story"); if (v) v.hidden = S.tab !== "story";
  renderStory(); storyPaint();
  return r;
};
const renderAll24s = renderAll;
renderAll = function () { const r = renderAll24s.apply(this, arguments); renderStory(); return r; };

/* ---------- the chapter's look on the rest of the page ---------- */
const storyOn = () => !!(ST.theme && ST.pos && STORY_BY.has(ST.pos.w)) && !pageActive() && S.tab !== "event";
function storyBgHTML(c) {
  let seed = c.id * 7919 + 17; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const n = {embers: 22, snow: 26, icefire: 28, petals: 18, leaves: 18, stars: 36, motes: 20, dust: 26, rain: 30, fog: 6, waves: 4, beams: 7, rings: 4, grid: 3}[c.m] || 18;
  let h = "";
  for (let i = 0; i < n; i++) {
    const x = (r() * 100).toFixed(1), y = (r() * 100).toFixed(1), s = (0.55 + r() * 0.9).toFixed(2), d = (c.m === "rain" ? 0.9 + r() * 0.8 : c.m === "stars" ? 2.5 + r() * 4 : 9 + r() * 14).toFixed(1);
    const dl = (-r() * 20).toFixed(1), k = c.m === "icefire" ? (i % 2 ? 2 : 1) : 1 + (i % 3), rz = Math.round(r() * 360), sw = ((r() - 0.5) * 12).toFixed(1);
    h += `<i class="k${k}" style="--x:${x}%;--y:${y}%;--s:${s};--d:${d}s;--dl:${dl}s;--r:${rz}deg;--sw:${sw}vw;--i:${i}"></i>`;
  }
  return h;
}
let storyBgKey = "";
function storyPaint() {
  const on = storyOn(), c = on ? STORY_BY.get(ST.pos.w) : null;
  document.documentElement.classList.toggle("story-on", !!c);
  // the backdrop
  let bg = document.getElementById("story-bg");
  if (c && !bg) { const pb = document.querySelector(".page-bg"); if (pb) { pb.insertAdjacentHTML("afterend", `<div id="story-bg" class="story-bg" aria-hidden="true"></div>`); bg = document.getElementById("story-bg"); } }
  if (bg) {
    if (c && storyBgKey !== String(c.id)) { storyBgKey = String(c.id); bg.dataset.m = c.m; bg.style.cssText = `--c1:${c.pal[0]};--c2:${c.pal[1]};--c3:${c.pal[2]}`; bg.innerHTML = storyBgHTML(c); }
    bg.classList.toggle("on", !!c); bg.classList.toggle("lt", !isDark());
  }
  // the chapter's plate next to the logo
  const brand = document.querySelector(".masthead .brand");
  let plate = document.getElementById("story-plate");
  if (c && brand) {
    if (!plate) { brand.insertAdjacentHTML("beforeend", `<button type="button" id="story-plate" class="story-plate-btn" data-action="tab" data-tab="story"><img class="story-plate" alt=""></button>`); plate = document.getElementById("story-plate"); }
    const img = plate.querySelector("img"), war = ST.wars[c.id], src = (war && war.b) || capUrl(c.id);
    if (img.getAttribute("src") !== src) { img.classList.remove("bad"); img.src = src; }
    img.alt = c.n; plate.title = "Story: " + c.n + ". Open the Story page"; plate.hidden = false;
  } else if (plate) plate.hidden = true;
  // the page's colours
  if (c) {
    const key = c.id + "|" + isDark();
    if (curPal !== c.pal || storyPalKey !== key) { storyPalKey = key; curPal = c.pal; curExtra = null; PAGE.pal = c.pal.map(hexToRgb); paintPage(); }
    const idle = document.getElementById("idle-bg"); if (idle) idle.classList.remove("on");
  } else if (storyPalKey) {
    // it was on (an Event page opened, or the look was turned off): the page's own colours come back
    storyPalKey = ""; themeKey9 = ""; syncPageTheme();
  }
}
let storyPalKey = "";
// turning the look on or off, or a new chapter: the page's own theme is worked out again first
function storyRepaint() { storyPalKey = ""; themeKey9 = ""; syncPageTheme(); setTimeout(storyPaint, 0); }
const applyTheme24s = applyTheme;
applyTheme = async function (s) { const r = await applyTheme24s(s); storyPaint(); return r; };
DARK_Q.addEventListener("change", () => { storyPalKey = ""; storyPaint(); });
// the theme toggle switches light/dark on the page itself
document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest('[data-action="theme"]')) setTimeout(() => { storyPalKey = ""; storyPaint(); }, 0); });
storyPaint();
if (ST.pos) storyWar(ST.pos.w).then((w) => { if (w) storyPaint(); });
