/* ================= 0.50.0-beta: the battle simulator, part 2: the Battle page =================
   Set up a fight (your party; the enemies: made up, your Guests, your servants, or a real NA quest), press Fight, and
   watch it play out: the skills, the five cards and the three picked, the damage on each enemy, the enemies' turn, the
   waves, the result. Play, pause, step through it, go faster, or jump to any moment from the list of what happened.
   The setup is kept in this browser (spirit-origin-list:v1:battle); a fight changes nothing on your list. */
const BT_KEY = "spirit-origin-list:v1:battle";
let btPrefs = (() => { try { const v = JSON.parse(localStorage.getItem(BT_KEY) || "null"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } })();
const btSave = () => { try { localStorage.setItem(BT_KEY, JSON.stringify(btPrefs)); } catch (e) {} };
const BT = {run: null, at: 0, play: false, timer: 0, err: "", quest: null, questBusy: false, questErr: "", war: null, warBusy: false};

/* ---------- the tab ---------- */
TABS.push("battle");
(function () {
  const nav = document.querySelector("nav.tabs"), before = document.getElementById("tab-past");
  const b = document.createElement("button");
  b.className = "tab"; b.setAttribute("role", "tab"); b.id = "tab-battle"; b.dataset.action = "tab"; b.dataset.tab = "battle"; b.setAttribute("aria-selected", "false"); b.textContent = "Battle";
  if (nav) nav.insertBefore(b, before);
  const sec = document.createElement("section");
  sec.id = "view-battle"; sec.setAttribute("aria-labelledby", "tab-battle"); sec.hidden = true; sec.innerHTML = `<div id="battle" class="bt"></div>`;
  const after = document.getElementById("view-versus") || document.getElementById("view-ranking"); if (after) after.after(sec); else document.querySelector(".shell").appendChild(sec);
  if ((location.hash || "").slice(1) === "battle") S.tab = "battle";
})();
// (the footer was drawn before this page existed: it's drawn again with Battle in its list)
if (typeof FOOT_TABS !== "undefined") {
  const i = FOOT_TABS.findIndex((x) => x[0] === "past"); FOOT_TABS.splice(i >= 0 ? i : FOOT_TABS.length, 0, ["battle", "Battle"]);
  try { if (typeof foot !== "undefined" && foot) { foot.innerHTML = footHTML(); renderFoot(); } } catch (e) {}
}

/* ---------- who can fight ---------- */
const BT_PRESETS = {
  farm: {t: "Three waves, like a 90++ quest", w: [[["Lancer", "Spearman", 38000, 7800], ["Lancer", "Spearman", 41000, 7800], ["Archer", "Archer", 36000, 8200]],
    [["Rider", "Knight", 58000, 8800], ["Caster", "Magus", 52000, 8400], ["Rider", "Knight", 61000, 8800]], [["Saber", "Guardian", 310000, 11200, 3, 2], ["Lancer", "Spearman", 62000, 8000], ["Archer", "Archer", 58000, 8200]]]},
  boss: {t: "One big boss", w: [[["Saber", "Heroic Spirit", 1000000, 14500, 3, 2]]]},
  guards: {t: "A boss and two guards", w: [[["Berserker", "Guard", 70000, 9000], ["Caster", "Sorcerer", 420000, 12000, 4, 2], ["Berserker", "Guard", 70000, 9000]]]},
  dummy: {t: "Training dummies", w: [[["Saber", "Dummy", 12000, 900], ["Archer", "Dummy", 12000, 900], ["Lancer", "Dummy", 12000, 900]], [["Rider", "Dummy", 15000, 900], ["Caster", "Dummy", 15000, 900], ["Assassin", "Dummy", 15000, 900]], [["Berserker", "Big dummy", 60000, 1200]]]}
};
const btPreset = (k) => (BT_PRESETS[k] || BT_PRESETS.farm).w.map((w) => w.map(([cls, n, hp, atk, ch, acts]) => ({cls: cls, name: n, attr: "Earth", hp: hp, atk: atk, charge: ch || 3, acts: acts || 1})));
function btSetup() {
  const P = btPrefs;
  if (!Array.isArray(P.party)) P.party = S.servants.filter((s) => !s.wish).slice(0, 3).map((s) => "r:" + s.id).concat(["", "", ""]).slice(0, 6);
  if (!P.np || typeof P.np !== "object") P.np = {};
  if (!["made", "guests", "mine", "quest"].includes(P.src)) P.src = "made";
  if (!Array.isArray(P.made) || !P.made.length) { P.made = btPreset("farm"); P.preset = "farm"; }
  if (!Array.isArray(P.pick)) P.pick = [["", "", ""], ["", "", ""], ["", "", ""]];
  if (![1, 3, 10].includes(num(P.hpMul))) P.hpMul = 3;
  return P;
}
// a fighter from a key: "r:<id>" one of yours (a Guest too), "a:<no>" any NA servant
function btFighter(key, foe) {
  const k = String(key || ""), v = k.slice(2);
  if (k.startsWith("r:")) { const s = S.servants.find((x) => x.id === v); if (!s) return null; const t = btFromServant(s); return foe ? btAsFoe(t, btPrefs.hpMul) : t; }
  if (k.startsWith("a:")) { const t = btFromNA(v, (btPrefs.np || {})[k] || 1); return t ? (foe ? btAsFoe(t, btPrefs.hpMul) : t) : null; }
  return null;
}
function btEnemies() {
  const P = btSetup();
  if (P.src === "made") return P.made.map((w) => w.map(btFromMade)).filter((w) => w.length);
  if (P.src === "quest") return BT.quest && BT.quest.st ? BT.quest.st.map((w) => w.e.map(btFromQuest)).filter((w) => w.length) : [];
  return P.pick.map((w) => w.map((k) => btFighter(k, true)).filter(Boolean)).filter((w) => w.length);
}

/* ---------- a real NA quest's enemies (Atlas Academy; the Story page's chapters, or any quest by its number) ---------- */
function btPhaseSmall(d) {
  const st = (d.stages || []).map((sg) => {
    const all = sg.enemies || [], shift = all.filter((e) => e.deck === "shift");
    const one = (e) => {
      const sv = e.svt || {}, sh = e.enemyScript && Array.isArray(e.enemyScript.shift) ? e.enemyScript.shift : [];
      const td = e.serverMod && num(e.serverMod.tdRate) ? num(e.serverMod.tdRate) / 1000 : 0;
      return {n: liveText(e.name || sv.name), c: liveCls(sv.className), a: ATTR_N[sv.attribute] || "", hp: e.hp | 0, atk: e.atk | 0, f: sv.face || "", ct: e.chargeTurn | 0, td: td,
        bars: shift.filter((x) => sh.includes(x.npcId)).map((x) => x.hp | 0), tr: (e.traits || []).map((t) => t && t.name).filter((t) => t && !TRAIT_SKIP.test(t)).slice(0, 14).map(traitWords)};
    };
    return {w: sg.wave | 0, e: all.filter((e) => e.deck === "enemy").sort((a, b) => (a.deckId | 0) - (b.deckId | 0)).slice(0, 6).map(one)};
  }).filter((x) => x.e.length);
  return {v: 1, n: liveText(d.name || ""), lv: d.recommendLv || "", st: st};
}
async function btLoadQuest(q, ph) {
  const key = "battle:phase:" + q + "-" + ph;
  BT.questBusy = true; BT.questErr = ""; btRender();
  try {
    let d = await kv.get(key);
    if (!d || d.v !== 1) { d = btPhaseSmall(await storyFetch(ATLAS_NICE + "quest/" + q + "/" + ph)); await kv.set(key, d); }
    BT.quest = Object.assign({q: q, ph: ph}, d); btPrefs.quest = {q: q, ph: ph, w: btPrefs.quest && btPrefs.quest.w}; btSave();
    if (!d.st.length) BT.questErr = "This quest has no enemies listed on Atlas Academy.";
  } catch (e) { BT.quest = null; BT.questErr = navigator.onLine === false ? "You're offline: NA's quests come from Atlas Academy." : "Couldn't load that quest from Atlas Academy. Check the number and try again."; }
  finally { BT.questBusy = false; btRender(); }
}
async function btLoadWar(id) {
  BT.warBusy = true; BT.war = null; btRender();
  try { BT.war = await storyWar(id); } catch (e) { BT.war = null; }
  BT.warBusy = false; btRender();
}

/* ---------- the setup ---------- */
const btFace = (src, cls) => src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : CLASS_LOGO[cls] ? `<img class="bt-emb" src="${CLASS_LOGO[cls]}" alt="" loading="lazy">` : `<i class="bt-noface" aria-hidden="true"></i>`;
function btSlotOptions(cur) {
  const mine = S.servants.filter((s) => !s.wish).slice().sort((a, b) => a.name.localeCompare(b.name)), guests = S.servants.filter((s) => s.wish);
  const pop = (typeof NPC_POP !== "undefined" ? NPC_POP : []).map((n) => ATLAS_BY_NO.get(n)).filter(Boolean);
  const o = (v, t) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(t)}</option>`;
  return o("", "Empty") + (mine.length ? `<optgroup label="Your servants">${mine.map((s) => o("r:" + s.id, nmText(s) + " · " + (s.cls || "") + (s.level ? " · Lv " + s.level : ""))).join("")}</optgroup>` : "")
    + (guests.length ? `<optgroup label="Your Guests">${guests.map((s) => o("r:" + s.id, nmText(s) + " · " + (s.cls || ""))).join("")}</optgroup>` : "")
    + `<optgroup label="Borrow a support (max level, skills 10/10/10)">${pop.map((a) => o("a:" + a.no, a.n + " · " + a.c)).join("")}</optgroup>`
    + `<optgroup label="Any NA servant">${ATLAS_S.slice().sort((a, b) => a.n.localeCompare(b.n)).map((a) => o("a:" + a.no, a.n + " · " + a.c)).join("")}</optgroup>`;
}
function btSlotHTML(i, key) {
  const t = key ? btFighter(key) : null, P = btPrefs;
  const meta = t ? [t.cls, "ATK " + fmt(t.atk), "HP " + fmt(t.hp), "NP" + t.npLv, t.custom ? "Custom" : t.support ? "Support" : ""].filter(Boolean).join(" · ") : i < 3 ? "In front" : "Waits behind, steps in when someone falls";
  return `<div class="bt-slot${t ? "" : " empty"}${i < 3 ? " front" : " back"}">
    <span class="bt-face">${t ? btFace(t.face, t.cls) : ""}</span>
    <div class="bt-slot-main"><label class="sr" for="bt-p${i}">${i < 3 ? "Front " + (i + 1) : "Back " + (i - 2)}</label>
      <select id="bt-p${i}" data-bt-slot="${i}">${btSlotOptions(key)}</select>
      <small>${esc(meta)}</small>
      ${key && key.startsWith("a:") ? `<label class="bt-np">NP level <select data-bt-np="${esc(key)}">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${(P.np[key] || 1) === n ? " selected" : ""}>NP${n}</option>`).join("")}</select></label>` : ""}
    </div></div>`;
}
const BT_SRC = [["made", "Made-up enemies"], ["guests", "Your Guests"], ["mine", "Your servants"], ["quest", "An NA quest"]];
function btMadeHTML(P) {
  const clsO = (c) => AFF_CLASSES.map((x) => `<option${x === c ? " selected" : ""}>${x}</option>`).join(""), attO = (a) => NPC_ATTRS.map((x) => `<option${x === a ? " selected" : ""}>${x}</option>`).join("");
  return `<div class="bt-made">
    <label class="bt-preset">Start from <select data-bt-preset>${Object.entries(BT_PRESETS).map(([k, v]) => `<option value="${k}"${P.preset === k ? " selected" : ""}>${esc(v.t)}</option>`).join("")}<option value="own"${P.preset === "own" ? " selected" : ""}>Your own (as below)</option></select></label>
    ${P.made.map((w, wi) => `<fieldset class="bt-wave"><legend>Wave ${wi + 1}${P.made.length > 1 ? ` <button type="button" class="linkish" data-bt-act="wave-del" data-w="${wi}">Remove</button>` : ""}</legend>
      <div class="bt-erows">${w.map((e, ei) => `<div class="bt-erow">
        <input type="text" value="${esc(e.name)}" data-bt-e="${wi}.${ei}.name" aria-label="Wave ${wi + 1}, enemy ${ei + 1}: name" maxlength="40">
        <select data-bt-e="${wi}.${ei}.cls" aria-label="Class">${clsO(e.cls)}</select>
        <select data-bt-e="${wi}.${ei}.attr" aria-label="Attribute">${attO(e.attr)}</select>
        <label><span>HP</span><input type="number" min="1" step="1000" value="${esc(e.hp)}" data-bt-e="${wi}.${ei}.hp" inputmode="numeric"></label>
        <label><span>ATK</span><input type="number" min="0" step="100" value="${esc(e.atk)}" data-bt-e="${wi}.${ei}.atk" inputmode="numeric"></label>
        <label title="Turns until its big attack"><span>Charge</span><input type="number" min="1" max="8" value="${esc(e.charge || 3)}" data-bt-e="${wi}.${ei}.charge" inputmode="numeric"></label>
        <label title="Attacks each turn"><span>Attacks</span><input type="number" min="1" max="3" value="${esc(e.acts || 1)}" data-bt-e="${wi}.${ei}.acts" inputmode="numeric"></label>
        <button type="button" class="bt-x" data-bt-act="enemy-del" data-w="${wi}" data-e="${ei}" aria-label="Remove this enemy" title="Remove">×</button></div>`).join("")}</div>
      ${w.length < 3 ? `<button type="button" class="btn ghost sm" data-bt-act="enemy-add" data-w="${wi}">Add an enemy</button>` : ""}</fieldset>`).join("")}
    ${P.made.length < 3 ? `<button type="button" class="btn ghost sm" data-bt-act="wave-add">Add a wave</button>` : ""}</div>`;
}
function btPickHTML(P, guests) {
  const list = S.servants.filter((s) => guests ? s.wish : !s.wish).slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) return `<p class="tr-none">${guests ? "You have no Guests yet. Add some on the Servants page (Add servant → as a Guest)." : "Your roster is empty."}</p>`;
  const o = (cur) => `<option value="">Nobody</option>` + list.map((s) => `<option value="r:${esc(s.id)}"${"r:" + s.id === cur ? " selected" : ""}>${esc(nmText(s))} · ${esc(s.cls || "")}</option>`).join("");
  return `<div class="bt-pick">${[0, 1, 2].map((wi) => `<fieldset class="bt-wave"><legend>Wave ${wi + 1}</legend><div class="bt-prow">${[0, 1, 2].map((ei) => `<select data-bt-pick="${wi}.${ei}" aria-label="Wave ${wi + 1}, enemy ${ei + 1}">${o((P.pick[wi] || [])[ei] || "")}</select>`).join("")}</div></fieldset>`).join("")}
    <div class="seg bt-hpm" role="group" aria-label="Their HP">${[1, 3, 10].map((m) => `<button type="button" data-bt-hpm="${m}" aria-pressed="${P.hpMul === m}">HP ×${m}</button>`).join("")}</div>
    <p class="bt-note">Servants as enemies use their own skills' damage, their NP every three turns, and the HP you pick (the game's enemy servants have far more than a playable one).</p></div>`;
}
function btQuestHTML(P) {
  const ev = live && live.data ? live.data.ev.filter((x) => x.k === "event" && x.w && x.w.length && x.e > Date.now() / 1000 - 30 * 86400) : [];
  const wid = (P.quest && P.quest.w) || "";
  const fights = BT.war ? fightsOf(BT.war) : [];
  const q = BT.quest;
  return `<div class="bt-quest">
    <div class="bt-qrow"><label>Chapter or event <select data-bt-war><option value="">Pick one…</option>
      <optgroup label="Main story">${STORY_CH.map((c) => `<option value="${c[0]}"${String(c[0]) === String(wid) ? " selected" : ""}>${esc(c[3])}</option>`).join("")}</optgroup>
      ${ev.length ? `<optgroup label="Events on NA">${ev.map((x) => `<option value="${x.w[0]}"${String(x.w[0]) === String(wid) ? " selected" : ""}>${esc(liveText(x.n))}</option>`).join("")}</optgroup>` : ""}</select></label>
    ${BT.warBusy ? `<p class="bt-note">Getting its quests from Atlas Academy…</p>` : fights.length ? `<label>Battle <select data-bt-fight><option value="">Pick one…</option>${fights.map(([qq, ph]) => `<option value="${qq.id}/${ph}"${q && q.q === qq.id && q.ph === ph ? " selected" : ""}>${esc(secLabel(qq))}${qq.pe.length > 1 ? " · battle " + ph : ""}</option>`).join("")}</select></label>` : wid ? `<p class="bt-note">No battles found for it.</p>` : ""}</div>
    <form class="bt-qid" data-bt-qid><label>Or a quest's number <input type="text" inputmode="numeric" placeholder="94086601/3, or a link from Atlas Academy" value="${q ? esc(q.q + "/" + q.ph) : ""}"></label><button type="submit" class="btn sm">Load</button></form>
    ${BT.questBusy ? `<p class="bt-note">Loading the enemies…</p>` : BT.questErr ? `<p class="bt-warn">${esc(BT.questErr)}</p>` : q && q.st && q.st.length ? `<div class="bt-qwaves"><b>${esc(q.n || "Quest " + q.q)}</b>${q.lv ? `<small>Recommended Lv ${esc(q.lv)}</small>` : ""}
      ${q.st.map((w) => `<div class="bt-qw"><span>Wave ${w.w}</span>${w.e.map((e) => `<span class="bt-qe" title="${esc(e.n)}">${btFace(e.f ? aimg(e.f) : "", e.c)}<b>${esc(e.n)}</b><small>${esc(e.c)} · ${fmt(e.hp + e.bars.reduce((a, v) => a + v, 0))} HP${e.bars.length ? " (" + (e.bars.length + 1) + " bars)" : ""}</small></span>`).join("")}</div>`).join("")}</div>`
      : `<p class="bt-note">The enemies come from Atlas Academy's NA data, with their real HP, ATK, classes and charge.</p>`}</div>`;
}
function btSetupHTML() {
  const P = btSetup(), waves = btEnemies();
  const ready = P.party.slice(0, 3).some(Boolean) && waves.length;
  return `<div class="bt-setup">
    <section class="d-sec bt-card"><h3>Your party <small>three in front, three behind</small></h3>
      <div class="bt-slots">${P.party.map((k, i) => btSlotHTML(i, k)).join("")}</div>
      <p class="bt-note">Your servants fight at their levels, skill levels and NP levels on your list, with Fou, their equipped Craft Essence and Append 2 and 3. Custom servants use their own kit from the Workshop.</p></section>
    <section class="d-sec bt-card"><h3>The enemies</h3>
      <div class="seg bt-src" role="group" aria-label="The enemies">${BT_SRC.map(([k, t]) => `<button type="button" data-bt-src="${k}" aria-pressed="${P.src === k}">${t}</button>`).join("")}</div>
      ${P.src === "made" ? btMadeHTML(P) : P.src === "quest" ? btQuestHTML(P) : btPickHTML(P, P.src === "guests")}</section>
    <div class="bt-go">
      <button type="button" class="btn primary bt-fight" data-bt-act="fight"${ready ? "" : " disabled"}>Fight</button>
      <label class="bt-seed">Seed <input type="text" inputmode="numeric" value="${esc(P.seed || "")}" placeholder="new each time" data-bt-seed maxlength="10"></label>
      <span class="bt-note">${ready ? "Auto-battle: they use their skills, NPs and cards on their own." : !P.party.slice(0, 3).some(Boolean) ? "Put someone in front first." : "Add some enemies first."}</span>
    </div></div>`;
}

/* ---------- the fight, played back ---------- */
const BT_PACE = {start: 300, wave: 900, turn: 700, skill: 800, plan: 900, card: 520, np: 1300, "np-after": 500, "foes-turn": 450, "foe-hit": 520, "foe-np": 1300, fall: 600, guts: 700, bar: 700, burn: 400, swap: 700, stunned: 450, end: 0};
const btWho = (id) => BT.run && BT.run.units.find((u) => u.id === id);
const btName = (id) => { const u = btWho(id); return u ? u.name : "?"; };
function btLine(e) {
  const n = btName, c = (k) => BT_WORD[k] || k;
  switch (e.t) {
    case "start": return "The battle begins.";
    case "wave": return `Wave ${e.n} of ${e.of}.`;
    case "turn": return `Turn ${e.n}.`;
    case "skill": return `${n(e.who)} uses ${e.n}${e.pick && e.pick !== e.who ? " on " + n(e.pick) : ""}.`;
    case "plan": return `Cards: ${e.pick.map((p) => p.np ? n(p.who) + "'s NP" : n(p.who) + " " + c(p.card)).join(", ")}.`;
    case "card": return e.dodged ? `${n(e.to)} avoids ${n(e.who)}'s ${c(e.card)}.` : `${n(e.who)}: ${c(e.card)}${e.crit ? " critical" : ""}, ${fmt(e.dmg)} to ${n(e.to)}.`;
    case "np": return `${n(e.who)}: ${e.n}${e.oc > 1 ? " (Overcharge " + e.oc * 100 + "%)" : ""}${e.hits.length ? ", " + e.hits.map((h) => (h.dodged ? "avoided by " : fmt(h.dmg) + " to ") + n(h.id) + (h.se ? " (super effective)" : "")).join(", ") : ""}.`;
    case "np-after": return `${n(e.who)}'s Noble Phantasm takes effect.`;
    case "foes-turn": return "The enemies' turn.";
    case "foe-hit": return e.dodged ? `${n(e.to)} avoids ${n(e.who)}'s attack.` : `${n(e.who)} hits ${n(e.to)} for ${fmt(e.dmg)}${e.crit ? " (critical)" : ""}.`;
    case "foe-np": return `${n(e.who)} unleashes ${e.n}: ${e.hits.map((h) => (h.dodged ? "avoided by " : fmt(h.dmg) + " to ") + n(h.id)).join(", ") || "no one is hit"}.`;
    case "fall": return `${n(e.who)} falls.`;
    case "guts": return `${n(e.who)} holds on (Guts).`;
    case "bar": return `${n(e.who)} rises again with another HP bar.`;
    case "burn": return `${n(e.who)} takes ${fmt(e.dmg)} from a lasting effect.`;
    case "swap": return `${n(e.in)} steps in for ${n(e.out)}.`;
    case "stunned": return `${n(e.who)} can't move.`;
    case "end": return e.result === "win" ? `Victory in ${e.turns} turns.` : e.result === "lose" ? `Defeat on wave ${e.wave}, turn ${e.turns}.` : `Out of time after ${e.turns} turns.`;
  }
  return "";
}
const BT_BUFF_WORD = {atk: "ATK↑", card: "Card↑", np: "NP↑", crit: "Crit↑", vs: "Special", dp: "Dmg+", pierce: "Pierce", npturn: "NP/turn", gain: "Gain↑", starturn: "Stars/turn", drop: "Stars↑", gather: "Gather↑",
  defup: "DEF↑", cut: "Cut", invinc: "Invincible", evade: "Evade", guts: "Guts", taunt: "Taunt", maxhp: "Max HP↑", immune: "Immune", dres: "Resist↑", regen: "Regen", defdown: "DEF↓", resdown: "Res↓", atkdown: "ATK↓", stun: "Stun", charm: "Charm", burn: "Burn"};
function btUnitHTML(u, st, e) {
  if (!st) return "";
  const act = e && (e.who === u.id), hit = e && ((e.to === u.id) || (e.hits || []).some((h) => h.id === u.id));
  const dmg = e && e.to === u.id && e.dmg != null ? e.dmg : e && e.hits ? ((e.hits.find((h) => h.id === u.id) || {}).dmg) : null;
  const dodged = e && ((e.to === u.id && e.dodged) || (e.hits || []).some((h) => h.id === u.id && h.dodged));
  const hpPct = clamp(st.hp / (st.max || 1) * 100, 0, 100);
  const buffs = st.buffs.map((b) => b.split(":")[0]).filter((v, i, a) => a.indexOf(v) === i).map((b) => `<i class="bt-bf${BT_DEBUFF.has(b) ? " de" : ""}">${esc(BT_BUFF_WORD[b] || b)}</i>`).join("");
  return `<div class="bt-u ${u.side}${st.alive ? "" : " gone"}${act ? " act" : ""}${hit ? " hit" : ""}${st.stun ? " stun" : ""}" data-u="${u.id}">
    <span class="bt-uf">${btFace(u.face, u.cls)}${CLASS_LOGO[u.cls] ? `<img class="bt-ucls" src="${CLASS_LOGO[u.cls]}" alt="" loading="lazy">` : ""}${dmg != null && hit ? `<b class="bt-pop${dodged ? " miss" : ""}">${dodged ? "Miss" : fmt(dmg)}</b>` : ""}</span>
    <span class="bt-un">${esc(u.name)}</span>
    <span class="bt-hp" role="img" aria-label="HP ${fmt(st.hp)} of ${fmt(st.max)}"><i style="transform:scaleX(${(hpPct / 100).toFixed(3)})"></i></span>
    <span class="bt-hpn">${fmt(st.hp)}${st.bars ? ` <small>+${st.bars} bar${st.bars > 1 ? "s" : ""}</small>` : ""}</span>
    ${u.side === "ally" ? `<span class="bt-npg${st.np >= 100 ? " full" : ""}" role="img" aria-label="NP ${st.np}%"><i style="transform:scaleX(${(clamp(st.np, 0, 100) / 100).toFixed(3)})"></i><b>${st.np}%</b></span>`
      : `<span class="bt-ch" aria-label="Charge ${st.charge} of ${st.chargeMax}">${Array.from({length: st.chargeMax}, (x, i) => `<i class="${i < st.charge ? "on" : ""}"></i>`).join("")}</span>`}
    <span class="bt-bfs">${buffs}</span></div>`;
}
// the moment to show: the event's snapshot, and which wave's enemies are in it
function btViewHTML() {
  const R = BT.run, e = R.events[BT.at], s = e.s, byId = new Map(s.u.map((x) => [x.id, x]));
  const front = s.u.filter((x) => x.front);
  const allies = R.units.filter((u) => u.side === "ally" && byId.has(u.id) && front.includes(byId.get(u.id)));
  const back = R.units.filter((u) => u.side === "ally" && byId.has(u.id) && !front.includes(byId.get(u.id)) && byId.get(u.id).alive);
  const foes = R.units.filter((u) => u.side === "foe" && byId.has(u.id));
  // the cards: the hand of the turn, with the three picked
  let plan = null; for (let i = BT.at; i >= 0; i--) { const x = R.events[i]; if (x.t === "plan") { plan = x; break; } if (x.t === "turn") break; }
  const used = new Set(), at = plan ? R.events.indexOf(plan) : -1;
  if (plan) for (let i = at + 1; i <= BT.at; i++) { const x = R.events[i]; if (x.t === "card" || x.t === "np") used.add(i); }
  const hand = plan ? plan.hand.map((c, i) => { const p = plan.pick.findIndex((x) => !x.np && x.h === i); const u = btWho(c.who);
    return `<span class="bt-cd ${c.card}${p >= 0 ? " pick" : ""}${c.crit ? " crit" : ""}" title="${esc((u ? u.name : "") + ": " + BT_WORD[c.card])}">${u ? btFace(u.face, u.cls) : ""}<b>${BT_WORD[c.card]}</b>${p >= 0 ? `<i>${p + 1}</i>` : ""}</span>`; }).join("")
    + plan.pick.map((x, i) => x.np ? `<span class="bt-cd np pick"><b>NP</b><small>${esc(btName(x.who))}</small><i>${i + 1}</i></span>` : "").join("") : "";
  const res = R.result, done = BT.at >= R.events.length - 1;
  return `<div class="bt-run">
    <div class="bt-bar">
      <div class="bt-where"><b>${done ? (res === "win" ? "Victory" : res === "lose" ? "Defeat" : "Out of time") : "Turn " + (s.turn || 1)}</b><span>Wave ${s.wave || 1} of ${R.waves}${s.stars ? ` · ${s.stars} stars` : ""}</span></div>
      <div class="bt-ctl" role="group" aria-label="Playback">
        <button type="button" class="btn sm" data-bt-act="first" title="From the start" aria-label="From the start">⏮</button>
        <button type="button" class="btn sm" data-bt-act="prev" title="One step back" aria-label="One step back">◀</button>
        <button type="button" class="btn sm primary" data-bt-act="play" aria-pressed="${BT.play}">${BT.play ? "Pause" : done ? "Again" : "Play"}</button>
        <button type="button" class="btn sm" data-bt-act="next" title="One step on" aria-label="One step on">▶</button>
        <button type="button" class="btn sm" data-bt-act="last" title="To the end" aria-label="To the end">⏭</button>
        <span class="seg bt-speed" role="group" aria-label="Speed">${[1, 2, 4].map((v) => `<button type="button" data-bt-speed="${v}" aria-pressed="${(btPrefs.speed || 1) === v}">${v}×</button>`).join("")}</span>
      </div>
      <div class="bt-acts"><button type="button" class="btn ghost sm" data-bt-act="again">New seed</button><button type="button" class="btn ghost sm" data-bt-act="setup">Change the setup</button></div>
    </div>
    <p class="bt-say" aria-live="polite">${esc(btLine(e))}</p>
    <div class="bt-stage">
      <div class="bt-row foes">${foes.map((u) => btUnitHTML(u, byId.get(u.id), e)).join("")}</div>
      <div class="bt-hand">${hand}</div>
      <div class="bt-row allies">${allies.map((u) => btUnitHTML(u, byId.get(u.id), e)).join("")}</div>
      ${back.length ? `<div class="bt-back"><span>Behind</span>${back.map((u) => `<span class="bt-bk" title="${esc(u.name)}">${btFace(u.face, u.cls)}</span>`).join("")}</div>` : ""}
    </div>
    ${done ? btSummaryHTML() : ""}
    <details class="bt-log"${btPrefs.log ? " open" : ""} data-bt-log><summary>What happened <small>${R.events.length} steps, seed ${esc(R.seed)}</small></summary>
      <ol>${R.events.map((x, i) => x.t === "plan" || x.t === "foes-turn" ? "" : `<li class="${i === BT.at ? "cur" : i > BT.at ? "later" : ""} t-${x.t}"><button type="button" class="linkish" data-bt-at="${i}">${esc(btLine(x))}</button></li>`).join("")}</ol></details>
  </div>`;
}
function btSummaryHTML() {
  const R = BT.run, al = R.units.filter((u) => u.side === "ally"), top = al.slice().sort((a, b) => b.stat.dmg - a.stat.dmg)[0];
  const head = R.result === "win" ? `Victory in ${R.turns} turn${R.turns === 1 ? "" : "s"}` : R.result === "lose" ? `Defeat on wave ${R.wave} of ${R.waves}, turn ${R.turns}` : `Out of time after ${R.turns} turns, on wave ${R.wave} of ${R.waves}`;
  return `<section class="d-sec bt-sum ${R.result}"><h3>${esc(head)}</h3>
    ${top && top.stat.dmg ? `<p>Most damage: <b>${esc(top.name)}</b>, ${fmt(top.stat.dmg)}.</p>` : ""}
    <div class="bt-tbw"><table class="bt-tb"><thead><tr><th>Servant</th><th class="n">Damage</th><th class="n">NPs</th><th class="n">Cards</th><th class="n">Skills</th><th class="n">Defeated</th><th class="n">Taken</th></tr></thead>
      <tbody>${al.map((u) => `<tr><td>${esc(u.name)}</td><td class="n">${fmt(u.stat.dmg)}</td><td class="n">${u.stat.nps}</td><td class="n">${u.stat.cards}</td><td class="n">${u.stat.skills}</td><td class="n">${u.stat.kills}</td><td class="n">${fmt(u.stat.taken)}</td></tr>`).join("")}</tbody></table></div>
    <p class="bt-note">The page doesn't have each servant's own NP gain and hit counts, so it uses the usual ones for the class and card: a fight here is close to the game, not the same. Effects that trigger later (“apply a state that …”) aren't worked out.</p></section>`;
}

/* ---------- drawing and playing ---------- */
function btRender() {
  const box = document.getElementById("battle"); if (!box) return;
  const keepLog = box.querySelector("[data-bt-log]"), logOpen = keepLog ? keepLog.open : !!btPrefs.log, logScroll = keepLog ? keepLog.querySelector("ol").scrollTop : 0;
  box.innerHTML = BT.run ? btViewHTML() : btSetupHTML(); BT.sig = btSig();
  const lg = box.querySelector("[data-bt-log]"); if (lg) { lg.open = logOpen; const ol = lg.querySelector("ol"); ol.scrollTop = logScroll; const cur = ol.querySelector(".cur"); if (cur && BT.play) cur.scrollIntoView({block: "nearest"}); }
}
function btStop() { BT.play = false; clearTimeout(BT.timer); }
function btTick() {
  clearTimeout(BT.timer);
  if (!BT.play || !BT.run) return;
  if (BT.at >= BT.run.events.length - 1) { BT.play = false; btRender(); return; }
  BT.at += 1; btRender();
  const e = BT.run.events[BT.at], wait = (BT_PACE[e.t] != null ? BT_PACE[e.t] : 500) / (btPrefs.speed || 1);
  BT.timer = setTimeout(btTick, BT_RM2.matches ? Math.max(wait, 400) : wait);
}
const BT_RM2 = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : {matches: false};
function btFight(seedIn) {
  const P = btSetup();
  const party = P.party.map((k) => k ? btFighter(k) : null), waves = btEnemies();
  if (!party.slice(0, 3).some(Boolean) || !waves.length) return;
  const seed = num(seedIn != null ? seedIn : P.seed) || Math.floor(Math.random() * 1e9) + 1;
  try { BT.run = btBattle({party: party, waves: waves}, seed); BT.at = 0; BT.play = true; BT.err = ""; }
  catch (e) { BT.run = null; BT.err = String(e && e.message || e); toast("The fight couldn't be worked out: " + BT.err); }
  btRender(); if (BT.run) { const v = document.getElementById("view-battle"); if (v) v.scrollIntoView({block: "start"}); btTick(); }
}

/* ---------- the page's buttons and fields ---------- */
document.addEventListener("click", (e) => {
  const box = document.getElementById("battle"); if (!box || !box.contains(e.target)) return;
  const b = e.target.closest("[data-bt-act], [data-bt-src], [data-bt-hpm], [data-bt-speed], [data-bt-at]"); if (!b) return;
  const P = btSetup();
  if (b.dataset.btSrc) { P.src = b.dataset.btSrc; btSave(); if (P.src === "quest" && P.quest && !BT.quest && P.quest.q) btLoadQuest(P.quest.q, P.quest.ph); if (P.src === "quest" && P.quest && P.quest.w && !BT.war) btLoadWar(P.quest.w); btRender(); return; }
  if (b.dataset.btHpm) { P.hpMul = num(b.dataset.btHpm); btSave(); btRender(); return; }
  if (b.dataset.btSpeed) { btPrefs.speed = num(b.dataset.btSpeed); btSave(); btRender(); if (BT.play) btTick(); return; }
  if (b.dataset.btAt) { btStop(); BT.at = num(b.dataset.btAt); btRender(); return; }
  const a = b.dataset.btAct;
  if (a === "fight") btFight();
  else if (a === "again") { btStop(); btFight(Math.floor(Math.random() * 1e9) + 1); }
  else if (a === "setup") { btStop(); BT.run = null; btRender(); }
  else if (a === "play") { if (BT.play) { btStop(); btRender(); } else { if (BT.at >= BT.run.events.length - 1) BT.at = 0; BT.play = true; btRender(); btTick(); } }
  else if (a === "first") { btStop(); BT.at = 0; btRender(); }
  else if (a === "last") { btStop(); BT.at = BT.run.events.length - 1; btRender(); }
  else if (a === "prev") { btStop(); BT.at = Math.max(0, BT.at - 1); btRender(); }
  else if (a === "next") { btStop(); BT.at = Math.min(BT.run.events.length - 1, BT.at + 1); btRender(); }
  else if (a === "wave-add") { P.made.push([{cls: "Saber", name: "Enemy", attr: "Earth", hp: 50000, atk: 8000, charge: 3, acts: 1}]); P.preset = "own"; btSave(); btRender(); }
  else if (a === "wave-del") { P.made.splice(num(b.dataset.w), 1); P.preset = "own"; btSave(); btRender(); }
  else if (a === "enemy-add") { const w = P.made[num(b.dataset.w)]; if (w && w.length < 3) w.push({cls: "Saber", name: "Enemy", attr: "Earth", hp: 50000, atk: 8000, charge: 3, acts: 1}); P.preset = "own"; btSave(); btRender(); }
  else if (a === "enemy-del") { const w = P.made[num(b.dataset.w)]; if (w) { w.splice(num(b.dataset.e), 1); if (!w.length) P.made.splice(num(b.dataset.w), 1); } if (!P.made.length) P.made = btPreset("farm"); P.preset = "own"; btSave(); btRender(); }
});
document.addEventListener("change", (e) => {
  const box = document.getElementById("battle"); if (!box || !box.contains(e.target)) return;
  const t = e.target, P = btSetup();
  if (t.dataset.btSlot != null) { P.party[num(t.dataset.btSlot)] = t.value; btSave(); btRender(); const n = document.getElementById("bt-p" + t.dataset.btSlot); if (n) n.focus(); }
  else if (t.dataset.btNp) { P.np[t.dataset.btNp] = num(t.value) || 1; btSave(); btRender(); }
  else if (t.dataset.btPreset != null) { if (t.value !== "own") { P.made = btPreset(t.value); P.preset = t.value; btSave(); btRender(); } }
  else if (t.dataset.btPick) { const [wi, ei] = t.dataset.btPick.split(".").map(num); P.pick[wi] = P.pick[wi] || ["", "", ""]; P.pick[wi][ei] = t.value; btSave(); btRender(); }
  else if (t.dataset.btE) { const [wi, ei, f] = t.dataset.btE.split("."), x = P.made[num(wi)] && P.made[num(wi)][num(ei)]; if (x) { x[f] = ["hp", "atk", "charge", "acts"].includes(f) ? num(t.value) : t.value; P.preset = "own"; btSave(); } }
  else if (t.dataset.btWar != null) { P.quest = Object.assign({}, P.quest || {}, {w: t.value}); btSave(); if (t.value) btLoadWar(num(t.value)); else { BT.war = null; btRender(); } }
  else if (t.dataset.btFight != null) { const [q, ph] = t.value.split("/").map(num); if (q) btLoadQuest(q, ph || 1); }
  else if (t.dataset.btSeed != null) { P.seed = t.value.replace(/\D/g, "").slice(0, 10); btSave(); }
});
document.addEventListener("submit", (e) => {
  const f = e.target.closest && e.target.closest("[data-bt-qid]"); if (!f) return;
  e.preventDefault();
  const v = f.querySelector("input").value, m = /quest\/(\d+)(?:\/(\d+))?/.exec(v) || /(\d{5,})(?:\D+(\d+))?/.exec(v);
  if (m) btLoadQuest(num(m[1]), num(m[2]) || 1); else { BT.questErr = "That doesn't look like a quest number (like 94086601, or 94086601/3 for its third battle)."; btRender(); }
});
document.addEventListener("toggle", (e) => { if (e.target.matches && e.target.matches("[data-bt-log]")) { btPrefs.log = e.target.open; btSave(); } }, true);
// keys while the fight plays: space plays and pauses, the arrows step
document.addEventListener("keydown", (e) => {
  if (S.tab !== "battle" || !BT.run || e.altKey || e.ctrlKey || e.metaKey || e.target.closest("input, select, textarea, [contenteditable]")) return;
  // not while a window is open over the page, and Space keeps pressing whatever button has the focus
  const sh = document.querySelector(".shell"); if (sh && sh.inert) return;
  if (e.key === " " && e.target.closest("button, a, summary, [role='button']")) return;
  if (e.key === " ") { e.preventDefault(); document.querySelector('#battle [data-bt-act="play"]').click(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); document.querySelector('#battle [data-bt-act="next"]').click(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); document.querySelector('#battle [data-bt-act="prev"]').click(); }
});

/* ---------- the page is drawn when it's opened ---------- */
const renderAll49b = renderAll;
renderAll = function () { const r = renderAll49b.apply(this, arguments); try { if (S.tab === "battle") btOpen(); } catch (e) {} return r; };
const renderChrome49b = renderChrome;
renderChrome = function () { const r = renderChrome49b.apply(this, arguments); try { if (S.tab === "battle") btOpen(); else if (BT.play) { btStop(); } } catch (e) {} return r; };
function btOpen() {
  const box = document.getElementById("battle"); if (!box) return;
  const P = btSetup();
  if (P.src === "quest" && P.quest && P.quest.q && !BT.quest && !BT.questBusy && !BT.questErr) btLoadQuest(P.quest.q, P.quest.ph || 1);
  if (P.src === "quest" && P.quest && P.quest.w && !BT.war && !BT.warBusy) btLoadWar(num(P.quest.w));
  // (drawn again when the roster changed since: a servant added elsewhere can join the party right away)
  if (!box.childElementCount || (!BT.run && btSig() !== BT.sig)) btRender();
}
const btSig = () => S.servants.map((s) => s.id + ":" + s.name + ":" + (s.wish ? 1 : 0) + ":" + (s.level || "")).join("|");
