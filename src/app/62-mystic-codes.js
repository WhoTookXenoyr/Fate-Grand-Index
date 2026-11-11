/* ================= 0.53.0-beta: Mystic Codes =================
   Jordan (Noyr's tester) asked for every Master equipment, to see which gives the most NP gain and NP charge, and Noyr
   for them to count in the damage numbers. Here:
   - NA's Mystic Codes (MC_NA, from Atlas Academy's nice_mystic_code.json; when the page is online it looks again once
     a week and keeps a newer list in this browser), each with its three skills, as [kind, target, Lv 1, Lv 10, turns,
     times, what it's limited to]. Values grow like a servant skill's (skVals); cooldowns drop by 1 at Lv 6 and Lv 10.
   - a page, Mystic Codes: all of them at the level you pick, sorted by NP charge, NP Gain, NP Strength, ATK, a card
     type or critical damage, with an Equip button. Kept: spirit-origin-list:v1:mc = {id, lv, g}.
   - the equipped one counts where damage is worked out: the NP calculator on a servant's page (its skills listed with
     tick boxes, like a support's), the damage under a skill in the Workshop, and the Battle simulator (the Master uses
     its skills: charges before the servants act, buffs on whoever is about to use their NP, Evade and the like when
     the enemy is about to strike). */
const MC_KEY = "spirit-origin-list:v1:mc";
const MC_NA = [[1,"Chaldea",[["First Aid","Greatly restore one ally's HP",600,9,7,[["heal","o",1000,3000,0,0]]],["Instant Enhancement","Significantly increase one ally's ATK (1 turn)",300,15,13,[["atk","o",30,50,1,0]]],["Emergency Evade","Apply Evade for one ally (1 turn)",402,15,13,[["evade","o",0,0,1,0]]]]],[20,"Chaldea Combat Uniform",[["Buff All Allies","Increase all allies' ATK (1 turn)",300,12,10,[["atk","a",20,30,1,0]]],["Gandr","Inflict Stun to one enemy (1 turn)",508,15,13,[["stun","e",0,0,1,0]]],["Order Change","Switch one active member with a sub-member",704,15,13,[["swap","w",1,1,0,0]]]]],[30,"Mage's Association Uniform",[["Cure-All","Restore all allies' HP",600,12,10,[["heal","a",800,2800,0,0]]],["Spiritron Transfer","Increase NP Gauge for one ally",601,15,13,[["charge","o",20,20,0,0]]],["Command Shuffle","Redistribute Command Cards",703,15,13,[["shuffle","s",1,1,0,0]]]]],[40,"Atlas Institute Uniform",[["Dust of Osiris","Apply Invincible to one ally (1 turn)",403,15,13,[["invinc","o",0,0,1,0]]],["Rain of Isis","Remove one ally's Debuffs",608,15,13,[["cleanse","o",0,0,0,0]]],["Eyes of Medjed","Reduce one ally's skill cooldown by 2",609,15,13,[["cd","o",2,2,0,0]]]]],[50,"Anniversary Blonde",[["Mana Burst","Significantly increase one ally's Buster Card effectiveness (1 turn)",306,15,13,[["card","o",40,60,1,0,"cardBuster"]]],["Confident in Victory","Gain large amounts of C. Stars",603,12,10,[["stars","a",0,0,0,0],["stars","s",10,20,0,0]]],["Knight's Oath","Apply Guts to one ally (1 time, 1 turn)",404,15,13,[["guts","o",2000,4000,1,1]]]]],[60,"Royal Brand",[["Reaction Reinforcement ","Increase one ally's Quick Card effectiveness (1 turn)",304,15,13,[["card","o",30,50,1,0,"cardQuick"]]],["Iron Devotion","Increase one ally's C. Star Gather Rate (1 turn)",311,12,10,[["gather","o",500,1000,1,0]]],["Inescapable","Apply Sure Hit to one ally (1 turn)",310,10,8,[["surehit","o",0,0,1,0]]]]],[70,"Brilliant Summer",[["Rumble Party","Increase Quick Card effectiveness for all allies (1 turn)",304,15,13,[["card","a",20,30,1,0,"cardQuick"]]],["Deadly Trident","Apply Ignore Invincible for a single ally (1 turn)",312,12,10,[["pierce","o",0,0,1,0]]],["Beach House Shower","Restore HP & increase NP Gauge for a single ally",600,12,10,[["heal","o",1000,3000,0,0],["charge","o",10,10,0,0]]]]],[80,"Memories of the Lunar Sea",[["Spiritron Boost","Increase an ally's Arts Card effectiveness (1 turn)",305,15,13,[["card","o",30,50,1,0,"cardArts"]]],["Stepping Stone to Ultimate Victory","Increase an ally's Critical Star drop rate (1 turn)",604,12,10,[["drop","o",50,100,1,0]]],["Punishment","Apply Nullify Buff to a single enemy (1 time)",521,15,13,[["immune","e",0,0,0,1,"buffPositiveEffect"]]]]],[90,"Memories of the Far Side of the Moon",[["Spiritron Boost (All)","Increase all allies' Arts Card effectiveness (1 turn)",305,15,13,[["card","a",20,30,1,0,"cardArts"]]],["Stepping Stone To Survival","Apply Debuff Immune (1 time) for one ally",411,12,10,[["immune","o",0,0,0,1,"buffNegativeEffect"]]],["Dial Down","Decrease one enemy's Charge by 1",513,15,13,[["chargedown","e",1,1,0,0]]]]],[100,"A Fragment of 2004",[["Code: F","Increase NP Strength (1 turn) for one ally",302,12,10,[["np","o",30,50,1,0]]],["Code: U","Increase Buster Card C. Star Gather Rate (1 turn) for one ally",308,12,10,[["gather","o",5000,10000,1,0,"cardBuster"]]],["Code: H","Increase NP Gain (1 turn) for one ally",602,12,10,[["gain","o",30,50,1,0]]]]],[110,"Chaldea Uniform - Arctic",[["Purifying Recovery","Restore HP & remove DEF Debuffs for one ally",600,12,10,[["heal","o",1000,3000,0,0],["cleanse","o",0,0,0,0]]],["Illusionary Buff","Increase ATK (1 turn) & increase NP Strength (1 turn) for one ally",300,15,13,[["atk","o",20,40,1,0],["np","o",10,20,1,0]]],["Predictive Evasion","Apply Evade to one ally (1 time, 3 turns)",402,12,10,[["evade","o",0,0,3,1]]]]],[120,"Tropical Summer",[["Blue Splash","Increase Arts Card effectiveness (1 turn) & NP Strength (1 turn) for a single ally",305,15,13,[["card","o",20,30,1,0,"cardArts"],["np","o",10,20,1,0]]],["Surprise Water","Increase a single ally's Arts Card's C. Star Gather Rate (1 turn)",309,12,10,[["gather","o",5000,10000,1,0,"cardArts"]]],["Safety Oil","Increase Buff Removal Resist (1 turn) & NP Gauge for a single ally",416,12,10,[["bufres","o",50,100,1,0,"buffPositiveEffect,buffIncreaseDamage,buffIncreaseDefence,buffAtkUp,buffDefUp,buffCritDamageUp,buffEvade,buffEvadeAndInvincible,buffGuts,buffNpDamageUp,buffCritRateUp,buffSureHit"],["charge","o",10,10,0,0]]]]],[130,"Splendid New Year",[["First Shine","Increase all allies' NP Strength (1 turn)",302,12,10,[["np","a",25,35,1,0]]],["Little Gift","Increase NP Gauge + gain C. Stars for one ally",601,12,10,[["charge","o",10,10,0,0],["stars","a",0,0,0,0],["stars","s",5,15,0,0]]],["Osechi Package","Increase Max HP (1 turn) for one ally",412,10,8,[["maxhp","o",1000,3000,1,0]]]]],[150,"Captain Chaldea",[["Overcharger","Increase NP Strength (1 turn) & remove ATK Debuff for one ally",302,15,13,[["np","o",30,50,1,0],["cleanse","o",0,0,0,0]]],["Star Blaster","Increase Critical Strength (1 turn) for one ally",303,12,10,[["crit","o",30,50,1,0]]],["Escape Pod","Apply Evade (1 time, 3 turns) & restore HP for one ally",402,15,13,[["evade","o",0,0,3,1],["heal","o",1000,3000,0,0]]]]],[160,"Chaldea Uniform - True Ether",[["All-out Charge","Increase Buster Card effectiveness (1 turn) for all allies",306,15,13,[["card","a",25,35,1,0,"cardBuster"]]],["Triple Restoration","Restore HP each turn for one ally (3 turns)",606,12,10,[["regen","o",1000,2000,3,0]]],["Mana Conversion","Increase NP Gauge & NP Gain (1 turn) for one ally",601,12,10,[["charge","o",10,10,0,0],["gain","o",20,40,1,0]]]]],[170,"Chaldea Pathfinder",[["Orienting","Increase Quick Card effectiveness (1 turn) & increase NP Strength (1 turn) for a single ally",304,15,13,[["card","o",20,30,1,0,"cardQuick"],["np","o",10,20,1,0]]],["Campfire","Increase Critical Strength (1 turn) for all allies",303,12,10,[["crit","a",20,30,1,0]]],["Survival Kit","Remove Poison, Curse, Burn & increase NP Gauge for a single ally",608,12,10,[["cleanse","o",0,0,0,0],["charge","o",10,10,0,0]]]]],[190,"Halloween Royalty",[["Brilliant Escort","Increase Buster Card effectiveness (1 turn) & NP Strength (1 turn) for a single ally",306,15,13,[["card","o",20,30,1,0,"cardBuster"],["np","o",10,20,1,0]]],["Pure Coordination","Apply Invincible to one ally (2 times, 1 turn)",403,12,10,[["invinc","o",0,0,1,2]]],["Blessed Regenerate","Remove Incapacitate/Seal & increase NP Gauge for a single ally",608,12,10,[["cleanse","o",0,0,0,0],["charge","o",10,10,0,0]]]]],[210,"Chaldea Uniform - Decisive Battle",[["Decisive Battle Power-Up","Increase ATK (1 turn) & increase NP Strength (1 turn) for all allies",300,15,13,[["atk","a",10,20,1,0],["np","a",10,20,1,0]]],["Front Line Recovery","Restore HP & remove ATK Debuffs for a single ally",600,12,10,[["heal","o",1000,3000,0,0],["cleanse","o",0,0,0,0]]],["Order Change","Switch one active member with a sub-member",704,15,13,[["swap","w",1,1,0,0]]]]],[240,"Souya High School Uniform",[["Premium Curry Bread","Increase Buster Card effectiveness (1 turn) & restore HP for one ally",306,15,13,[["card","o",30,50,1,0,"cardBuster"],["heal","o",1000,2000,0,0]]],["Seeing Borders","Decrease Death resistance (1 turn) for one enemy + Gain C. Stars",514,12,10,[["deathdown","e",30,50,1,0],["stars","a",0,0,0,0],["stars","s",5,15,0,0]]],["Sunset Classroom","Remove all Mental Debuff Effects & increase NP Gauge for a single ally",608,12,10,[["cleanse","o",0,0,0,0],["charge","o",10,10,0,0]]]]],[260,"New Year's Wardrobe",[["Let No Disaster Befall You","Increase NP Strength (1 turn) & NP gain (1 turn) for all allies",302,12,10,[["np","a",15,25,1,0],["gain","a",10,20,1,0]]],["May Your Wishes Come True","Increase Overcharge level by 1 (1 turn) & increase NP Gauge for one ally",313,12,10,[["oc","o",1,1,1,0],["charge","o",10,10,0,0]]],["Live in Good Health","Apply Debuff Immune (1 time, 3 turns) for one ally + Gain C. Stars",411,12,10,[["immune","o",0,0,3,1,"buffNegativeEffect"],["stars","a",0,0,0,0],["stars","s",5,15,0,0]]]]],[330,"Summer Streetwear",[["Sky Blue","Increase Arts Card effectiveness (1 turn) & Critical Strength (1 turn) for one ally",305,12,10,[["card","o",20,30,1,0,"cardArts"],["crit","o",20,30,1,0]]],["Wind Green","Apply Evade (1 time, 3 turns) & increase NP Gauge for one ally",402,15,13,[["evade","o",0,0,3,1],["charge","o",10,10,0,0]]],["Lightning Yellow","Increase Arts Card's C. Star Gather Rate (1 turn) & NP Gauge for one ally",309,15,13,[["gather","o",5000,10000,1,0,"cardArts"],["charge","o",10,10,0,0]]]]],[340,"White Christmas",[["Holy Shine","Increase NP Strength (1 turn) & NP Gain (1 turn) for a single ally",302,15,13,[["np","o",30,50,1,0],["gain","o",20,30,1,0]]],["Powder Snow","Restore HP & remove Poison, Curse, Burn for a single ally",600,12,10,[["heal","o",1000,3000,0,0],["cleanse","o",0,0,0,0]]],["Little Present","Gain C. Stars + Slightly increase NP Gauge for all allies",603,9,7,[["stars","a",0,0,0,0],["stars","s",5,15,0,0],["charge","a",5,5,0,0]]]]],[360,"Misaki High School Uniform",[["Assemble","Increase Arts Card effectiveness (1 turn) & Buster Card effectiveness (1 turn) for all allies",315,15,13,[["card","a",10,20,1,0,"cardArts"],["card","a",10,20,1,0,"cardBuster"]]],["Go For It","Increase C. Star Gather Rate (1 turn) + Gain C. Stars for a single ally",311,15,13,[["gather","o",500,1000,1,0],["stars","a",0,0,0,0],["stars","s",5,15,0,0]]],["Never Give Up","Apply Guts (1 time, 1 turn) & increase NP Gauge for a single ally",404,15,13,[["guts","o",1000,2000,1,1],["charge","o",10,10,0,0]]]]]];
const MC_CARD = {cardBuster: "Buster", cardArts: "Arts", cardQuick: "Quick"};
// [id, name, [[skill, text, icon, cd Lv 1, cd Lv 10, [[kind, target, v1, v10, turns, times, limit]]] × 3]] → objects
function mcNorm(raw) {
  return (raw || []).map((m) => ({id: m[0], n: String(m[1]).replace(/^Mystic Code: /, "").trim(), sk: (m[2] || []).map((s) => ({n: String(s[0]).trim(), t: String(s[1]).trim(), ic: num(s[2]) || 0, cd: [num(s[3]) || 0, num(s[4]) || 0],
    fx: (s[5] || []).filter((f) => !(f[0] === "stars" && !f[2] && !f[3])).map((f) => ({k: f[0] === "immune" && f[1] === "e" ? "nullbuff" : f[0], tg: f[1], v1: num(f[2]) || 0, v10: num(f[3]) || 0, d: num(f[4]) || 0, n: num(f[5]) || 0,
      card: MC_CARD[String(f[6] || "").split(",")[0]] || ""}))}))})).filter((m) => m.id && m.sk.length);
}
let MC_LIST = mcNorm(MC_NA);
let mcPrefs = (() => { try { const v = JSON.parse(lsGet(MC_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
const mcSave = () => lsSet(MC_KEY, JSON.stringify(mcPrefs));
const mcLv = () => clamp(num(mcPrefs.lv) || 10, 1, 10);
const mcById = (id) => MC_LIST.find((m) => m.id === num(id)) || null;
const mcOn = () => mcById(mcPrefs.id);
function mcSet(o) { Object.assign(mcPrefs, o); if (!mcById(mcPrefs.id)) delete mcPrefs.id; mcSave(); mcChanged(); }
const MC_IMG = "https://static.atlasacademy.io/NA/";
const mcPic = (m, g) => MC_IMG + "Items/masterequip" + String(m.id === 1 ? (g === "m" ? 1 : 2) : m.id + (g === "m" ? 1 : 2)).padStart(5, "0") + ".png";
const mcSkPic = (ic) => MC_IMG + "SkillIcons/skill_" + String(ic).padStart(5, "0") + ".png";
const mcG = () => mcPrefs.g === "m" ? "m" : "f";
const mcVal = (f, lv) => num(skVals(f.v1, f.v10)[clamp(lv, 1, 10) - 1]) || 0;
const mcCd = (sk, lv) => Math.max(1, sk.cd[0] - (lv >= 10 ? 2 : lv >= 6 ? 1 : 0));

/* ---------- what a skill does, in words and numbers ---------- */
const MC_TG = {o: "one ally", a: "all allies", s: "", e: "one enemy", w: ""};
function mcFxText(f, lv) {
  const v = mcVal(f, lv), p = (x) => String(Math.round(x * 100) / 100), F = (x) => fmt(Math.round(x));
  const t = {atk: "ATK +" + p(v) + "%", card: (f.card || "Card") + " +" + p(v) + "%", np: "NP Strength +" + p(v) + "%", crit: "Critical damage +" + p(v) + "%", gain: "NP Gain +" + p(v) + "%",
    charge: "NP +" + p(v) + "%", heal: "Restores " + F(v) + " HP", regen: F(v) + " HP each turn", maxhp: "Max HP +" + F(v), guts: "Guts with " + F(v) + " HP", stars: "+" + p(v) + " stars",
    gather: (f.card ? f.card + " card " : "") + "star gather +" + p(v) + "%", drop: "Star drop +" + p(v) + "%", evade: "Evade", invinc: "Invincible", surehit: "Sure Hit", pierce: "Ignore Invincible",
    stun: "Stun", swap: "Order Change", shuffle: "New command cards", cleanse: "Removes debuffs", cd: "Skill cooldowns −" + p(v), chargedown: "Enemy charge −" + p(v), oc: "Overcharge +" + p(v) + " level",
    deathdown: "Death resist −" + p(v) + "%", bufres: "Buff removal resist +" + p(v) + "%", nullbuff: "Removes a buff", immune: "Debuff Immune"}[f.k] || f.k;
  const last = [f.n ? f.n + (f.n === 1 ? " time" : " times") : "", f.d ? f.d + (f.d === 1 ? " turn" : " turns") : ""].filter(Boolean).join(", ");
  return t + (MC_TG[f.tg] ? " for " + MC_TG[f.tg] : "") + (last ? " (" + last + ")" : "");
}
// what one servant can get from it at a level: the numbers the page sorts by
function mcTot(m, lv) {
  const T = {charge: 0, gain: 0, np: 0, atk: 0, Buster: 0, Arts: 0, Quick: 0, crit: 0, chargeAll: 0};
  m.sk.forEach((sk) => sk.fx.forEach((f) => {
    if (!["o", "a", "s"].includes(f.tg)) return;
    const v = mcVal(f, lv);
    if (f.k === "charge") { T.charge += v; if (f.tg === "a") T.chargeAll += v; }
    else if (f.k === "card" && f.card) T[f.card] += v;
    else if (["gain", "np", "atk", "crit"].includes(f.k)) T[f.k] += v;
  }));
  return T;
}
const MC_SORT = [["", "Release order"], ["charge", "NP charge"], ["gain", "NP Gain"], ["np", "NP Strength"], ["atk", "ATK"], ["Buster", "Buster"], ["Arts", "Arts"], ["Quick", "Quick"], ["crit", "Critical damage"]];
const MC_SORT_T = {charge: "NP charge", gain: "NP Gain", np: "NP Strength", atk: "ATK", Buster: "Buster", Arts: "Arts", Quick: "Quick", crit: "Critical damage"};

/* ---------- the page ---------- */
TABS.push("mystic");
UI_IC.mystic = '<path d="M8 4.5h8l1.5 3.5-2 1.5V20h-7V9.5l-2-1.5z"/><path d="M10 4.5c.4 1.4 1.1 2 2 2s1.6-.6 2-2"/><path d="M12 12.5v4"/>';
(function () {
  const nav = document.querySelector("nav.tabs"), before = document.getElementById("tab-past");
  const b = document.createElement("button");
  b.className = "tab"; b.setAttribute("role", "tab"); b.id = "tab-mystic"; b.dataset.action = "tab"; b.dataset.tab = "mystic"; b.setAttribute("aria-selected", "false");
  b.innerHTML = `<i class="tab-ic">${uiIcon("mystic")}</i><span class="tab-t">Mystic Codes</span>`; b.title = "Mystic Codes";
  if (nav) nav.insertBefore(b, before && before.parentNode === nav ? before : null);
  const sec = document.createElement("section");
  sec.id = "view-mystic"; sec.setAttribute("aria-labelledby", "tab-mystic"); sec.hidden = true; sec.innerHTML = `<div id="mystic" class="mc"></div>`;
  const after = document.getElementById("view-battle") || document.getElementById("view-versus"); if (after) after.after(sec); else document.querySelector(".shell").appendChild(sec);
  if ((location.hash || "").slice(1) === "mystic") S.tab = "mystic";
})();
if (typeof FOOT_TABS !== "undefined") {
  const i = FOOT_TABS.findIndex((x) => x[0] === "past"); FOOT_TABS.splice(i >= 0 ? i : FOOT_TABS.length, 0, ["mystic", "Mystic Codes"]);
  try { if (typeof foot !== "undefined" && foot) { foot.innerHTML = footHTML(); renderFoot(); } } catch (e) {}
}
function mcCardHTML(m, lv, key) {
  const T = mcTot(m, lv), on = mcPrefs.id === m.id, p = (x) => String(Math.round(x * 100) / 100);
  const chips = [["charge", T.charge ? "NP +" + p(T.charge) + "%" + (T.chargeAll && T.chargeAll === T.charge ? " (all allies)" : "") : ""], ["gain", T.gain ? "NP Gain +" + p(T.gain) + "%" : ""], ["np", T.np ? "NP Strength +" + p(T.np) + "%" : ""],
    ["atk", T.atk ? "ATK +" + p(T.atk) + "%" : ""], ["Buster", T.Buster ? "Buster +" + p(T.Buster) + "%" : ""], ["Arts", T.Arts ? "Arts +" + p(T.Arts) + "%" : ""], ["Quick", T.Quick ? "Quick +" + p(T.Quick) + "%" : ""],
    ["crit", T.crit ? "Critical +" + p(T.crit) + "%" : ""]].filter((c) => c[1]);
  return `<li class="mc-card${on ? " on" : ""}" data-mc="${m.id}">
    <div class="mc-top"><img class="mc-pic" src="${esc(mcPic(m, mcG()))}" alt="" loading="lazy" width="64" height="64">
      <div class="mc-name"><h3>${esc(m.n)}</h3>${chips.length ? `<p class="mc-sum">${chips.map((c) => `<span class="${c[0] === key ? "key" : ""}">${esc(c[1])}</span>`).join("")}</p>` : `<p class="mc-sum none">Nothing for damage or NP</p>`}</div>
      <button type="button" class="btn sm${on ? " primary" : ""}" data-mc-eq="${on ? 0 : m.id}" aria-pressed="${on}">${on ? "Equipped" : "Equip"}</button></div>
    <ol class="mc-sks">${m.sk.map((sk) => `<li><img class="mc-skic" src="${esc(mcSkPic(sk.ic))}" alt="" loading="lazy" width="36" height="36"><div>
      <p class="mc-skn"><b>${esc(sk.n)}</b> <small>cooldown ${mcCd(sk, lv)}</small></p><p class="mc-skt">${esc(sk.t)}</p>
      <p class="mc-skv">${sk.fx.map((f) => `<span>${esc(mcFxText(f, lv))}</span>`).join("")}</p></div></li>`).join("")}</ol></li>`;
}
function mcPageHTML() {
  const lv = mcLv(), key = MC_SORT.some((s) => s[0] === mcPrefs.sort) ? mcPrefs.sort || "" : "", eq = mcOn();
  const list = MC_LIST.slice().sort((a, b) => key ? (mcTot(b, lv)[key] - mcTot(a, lv)[key]) || a.id - b.id : a.id - b.id);
  const top = key ? list.filter((m) => mcTot(m, lv)[key] > 0) : [];
  const best = key ? (top.length ? `<p class="mc-best">Most ${esc(MC_SORT_T[key])} at Lv ${lv}: ${top.slice(0, 3).map((m, i) => `<b>${esc(m.n)}</b> (+${Math.round(mcTot(m, lv)[key] * 100) / 100}%${key === "charge" && mcTot(m, lv).chargeAll === mcTot(m, lv).charge ? ", to all allies" : ""})`).join(", then ")}.${key === "charge" ? " Charge counts what one servant can get from all three skills." : ""}</p>` : `<p class="mc-best">No Mystic Code gives ${esc(MC_SORT_T[key])}.</p>`) : "";
  return `<section class="d-sec mc-head">
      <p class="mc-lead">All ${MC_LIST.length} of NA's Master outfits and their three skills, at the level you pick. The one you equip counts in the NP calculator on a servant's page, in the damage under a skill in the Workshop, and in the Battle simulator.</p>
      <div class="mc-ctl">
        <label class="mc-f"><span>Level</span><select data-mc-lv>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => `<option value="${i}"${i === lv ? " selected" : ""}>Lv ${i}</option>`).join("")}</select></label>
        <label class="mc-f"><span>Sort by</span><select data-mc-sort>${MC_SORT.map((s) => `<option value="${s[0]}"${s[0] === key ? " selected" : ""}>${esc(s[1])}</option>`).join("")}</select></label>
        <div class="seg sm" role="group" aria-label="Master"><button type="button" data-mc-g="f" aria-pressed="${mcG() === "f"}">Female</button><button type="button" data-mc-g="m" aria-pressed="${mcG() === "m"}">Male</button></div>
      </div>
      <p class="mc-eq">${eq ? `Equipped: <b>${esc(eq.n)}</b>, Lv ${lv}. <button type="button" class="linkish" data-mc-eq="0">Take it off</button>` : "Nothing equipped: the calculators count no Mystic Code."}</p>
      ${best}</section>
    <ol class="mc-grid">${list.map((m) => mcCardHTML(m, lv, key)).join("")}</ol>`;
}
function mcRender() { const box = document.getElementById("mystic"); if (box) box.innerHTML = mcPageHTML(); }
const renderAll62 = renderAll;
renderAll = function () { const r = renderAll62.apply(this, arguments); try { if (S.tab === "mystic") mcRender(); } catch (e) { console.error(e); } return r; };
const renderChrome62 = renderChrome;
renderChrome = function () { const r = renderChrome62.apply(this, arguments); try { if (S.tab === "mystic") { const b = document.getElementById("mystic"); if (b && !b.childElementCount) mcRender(); mcFetch(); } } catch (e) { console.error(e); } return r; };
// anything that shows the equipped one is drawn again
function mcChanged() {
  if (S.tab === "mystic") mcRender();
  document.querySelectorAll(".npc[data-npc-for]").forEach((box) => { try { npcPaint(box, true); } catch (e) {} });
  if (typeof W !== "undefined" && W && W.k) { const el = document.querySelector('[data-live="skdmg"]'); if (el) el.innerHTML = wsSkDmgHTML(); }
  if (S.tab === "battle" && typeof BT !== "undefined" && !BT.run) { try { btRender(); } catch (e) {} }
}
document.addEventListener("click", (e) => {
  const t = e.target.closest && e.target.closest("[data-mc-eq], [data-mc-g]"); if (!t) return;
  if (t.dataset.mcEq != null) {
    const id = num(t.dataset.mcEq), was = mcPrefs.id;
    mcSet({id: id || undefined});
    const m = mcById(id);
    toastAction(m ? m.n + " is equipped: it counts in the NP calculator, the Workshop and Battle." : "No Mystic Code equipped.", "Undo", () => mcSet({id: was}));
  } else mcSet({g: t.dataset.mcG === "m" ? "m" : "f"});
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.dataset.mcLv != null || t.dataset.npcMclv != null || t.dataset.btMclv != null || t.dataset.wsdMclv != null) mcSet({lv: clamp(num(t.value) || 10, 1, 10)});
  else if (t.dataset.mcSort != null) { mcPrefs.sort = t.value || undefined; mcSave(); mcRender(); }
  else if (t.dataset.npcMc != null || t.dataset.btMc != null || t.dataset.wsdMc != null) mcSet({id: num(t.value) || undefined});
});
// a select of every Mystic Code and one of the level, for the calculators
function mcPickHTML(attr, cls) {
  const eq = mcOn(), lv = mcLv();
  return `<label class="${cls} mc-pick"><span>Mystic Code</span><select data-${attr}>${[`<option value="0"${eq ? "" : " selected"}>None</option>`].concat(MC_LIST.map((m) => `<option value="${m.id}"${eq && eq.id === m.id ? " selected" : ""}>${esc(m.n)}</option>`)).join("")}</select></label>`
    + (eq ? `<label class="${cls} mc-picklv"><span>Lv</span><select data-${attr}lv>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => `<option value="${i}"${i === lv ? " selected" : ""}>${i}</option>`).join("")}</select></label>` : "");
}

/* ---------- the NP calculator on a servant's page ---------- */
const MC_NPC = {atk: "a", card: "c", np: "n"};
// its skills in the calculator's own form: [field, target, card letter, values Lv 1–10]
function mcNpcSkills(m) {
  return m.sk.map((sk, i) => ({i: i, n: sk.n, ic: sk.ic, fx: sk.fx.filter((f) => MC_NPC[f.k] && ["o", "a"].includes(f.tg)).map((f) => [MC_NPC[f.k], f.tg, f.card ? f.card.charAt(0) : "", skVals(f.v1, f.v10)])})).filter((x) => x.fx.length);
}
const npcTeam62 = npcTeam;
npcTeam = function (s, np, I) {
  const T = npcTeam62.apply(this, arguments), m = mcOn(); if (!m) return T;
  const me = calcKitOf(s), lv = mcLv();
  mcNpcSkills(m).forEach((k) => { if (!npcIsOn("mc:" + m.id + "|" + k.i)) return; k.fx.forEach((b) => { const x = npcFx(b, lv, np, me, I); if (x.ok) T[NPC_FIELD[b[0]]] += x.v; }); });
  return T;
};
const npcTeamHTML62 = npcTeamHTML;
npcTeamHTML = function (s, np, I) {
  const h = npcTeamHTML62.apply(this, arguments), m = mcOn(), me = calcKitOf(s), lv = mcLv();
  let list = "";
  if (m) {
    const ks = mcNpcSkills(m);
    list = ks.length ? `<div class="npc-sks">${ks.map((k) => { const key = "mc:" + m.id + "|" + k.i, on = npcIsOn(key);
      return `<label class="npc-sk${on ? "" : " off"}"><input type="checkbox" data-npc-sk="${esc(key)}"${on ? " checked" : ""}><img class="npc-ic mc-ic" src="${esc(mcSkPic(k.ic))}" alt="" loading="lazy"><span class="npc-skm"><b>${esc(k.n)}</b><span>${k.fx.map((b) => npcFxText(b, lv, np, me, I)).join("")}</span></span><i class="npc-lv">Lv ${lv}</i></label>`; }).join("")}</div>`
      : `<p class="npc-none">None of ${esc(m.n)}'s skills change NP damage.</p>`;
  }
  return h + `<div class="npc-who mc"><div class="npc-wh">${m ? `<img class="npc-face" src="${esc(mcPic(m, mcG()))}" alt="" loading="lazy">` : ""}${mcPickHTML("npc-mc", "npc-f")}</div>${list}</div>`;
};

/* ---------- the Workshop: the damage under a skill (61-skill-reader.js) ---------- */
// its damage buffs into the Workshop's {atk, np, crit, pow, dp, card, used}
function mcDmgInto(B) {
  const m = mcOn(); if (!m) return;
  const lv = mcLv();
  m.sk.forEach((sk) => sk.fx.forEach((f) => {
    if (!["o", "a"].includes(f.tg) || !["atk", "card", "np", "crit"].includes(f.k)) return;
    const v = mcVal(f, lv);
    if (f.k === "card") B.card[f.card] += v; else B[f.k] += v;
    B.used.push({t: (f.k === "card" ? f.card + " up" : {atk: "ATK up", np: "NP Strength up", crit: "Critical damage up"}[f.k]), v: v, u: "%", k: f.k, card: f.card || "", mc: sk.n, note: f.k === "crit" ? "on criticals" : ""});
  }));
}

/* ---------- the Battle simulator: the Master ---------- */
const MC_BT = {atk: "atk", card: "card", np: "np", crit: "crit", charge: "charge", gain: "gain", heal: "heal", regen: "regen", maxhp: "maxhp", guts: "guts", evade: "evade", invinc: "invinc",
  stars: "stars", gather: "gather", drop: "drop", cleanse: "cleanse", cd: "cd", stun: "stun", chargedown: "chargedown", pierce: "pierce", oc: "oc", surehit: "surehit"};
function mcBattle(m, lv) {
  return {name: "Master", mc: m.n, face: mcPic(m, mcG()), sk: m.sk.map((sk) => ({n: sk.n, ic: "", cd: sk.cd[0], lv: lv, lines: [sk.t],
    fx: sk.fx.filter((f) => MC_BT[f.k]).map((f) => ({k: MC_BT[f.k], tg: f.k === "stars" ? "s" : f.tg, v: f.k === "stun" ? skVals(100, 100) : skVals(f.v1, f.v10), d: f.d || (["charge", "heal", "stars", "cleanse", "cd", "chargedown"].includes(f.k) ? 0 : 1),
      n: f.n || 0, card: f.card ? BT_LETTER[f.card] : "", vs: "", p: 1, txt: sk.t}))}))};
}
const btBattle62 = btBattle;
btBattle = function (setup, seed) {
  const m = mcOn();
  if (m && setup && !setup.mc && !setup.noMc) setup = Object.assign({}, setup, {mc: mcBattle(m, mcLv())});
  return btBattle62.call(this, setup, seed);
};
const btSetupHTML62 = btSetupHTML;
btSetupHTML = function () {
  const h = btSetupHTML62.apply(this, arguments), m = mcOn(), at = '<section class="d-sec bt-card"><h3>The enemies</h3>';
  const sec = `<section class="d-sec bt-card bt-mc"><h3>Mystic Code <small>the Master's three skills</small></h3><div class="bt-mcrow">${m ? `<img class="mc-pic sm" src="${esc(mcPic(m, mcG()))}" alt="" width="44" height="44">` : ""}${mcPickHTML("bt-mc", "mc-f")}</div>
    <p class="bt-note">${m ? `The Master uses them on their own: NP charge before the servants act, the buffs on whoever is about to use their NP, Evade, Invincible or Guts when the enemy is about to strike.` : `None: the party fights without the Master's skills.`}</p></section>`;
  return h.includes(at) ? h.replace(at, sec + at) : h;
};

/* ---------- a newer list from NA, once a week when online ---------- */
const MC_SVALS = {gainNp: 100};
const MC_BUFF = {upAtk: "atk", upCommandall: "card", upNpdamage: "np", upCriticaldamage: "crit", upDropnp: "gain", upStarweight: "gather", upCriticalpoint: "drop", avoidance: "evade", invincible: "invinc", guts: "guts",
  breakAvoidance: "surehit", pierceInvincible: "pierce", donotAct: "stun", avoidState: "immune", upToleranceSubstate: "bufres", addMaxhp: "maxhp", regainHp: "regen", upNonresistInstantdeath: "deathdown", upChagetd: "oc"};
const MC_FUNC = {gainHp: "heal", gainNp: "charge", gainStar: "stars", subState: "cleanse", shortenSkill: "cd", replaceMember: "swap", cardReset: "shuffle", delayNpturn: "chargedown"};
const MC_TGT = {ptOne: "o", ptAll: "a", self: "s", enemy: "e", ptselectOneSub: "w"};
// Atlas's nice_mystic_code.json → the compact form of MC_NA (the same conversion that made MC_NA)
function mcFromNice(d) {
  return (Array.isArray(d) ? d : []).map((m) => [m.id, String(m.name || "").replace(/^Mystic Code: /, ""), (m.skills || []).map((s) => [s.name, String(s.detail || "").trim(), Number((/skill_0*(\d+)/.exec(s.icon || "") || [])[1] || 0),
    (s.coolDown || [])[0], (s.coolDown || [])[(s.coolDown || []).length - 1], (s.functions || []).map((f) => {
      const b = (f.buffs || [])[0], code = b ? MC_BUFF[b.type] : MC_FUNC[f.funcType]; if (!code) return null;
      const sc = b ? (["guts", "maxhp", "regen", "oc"].includes(code) ? 1 : 10) : MC_SVALS[f.funcType] || 1, v = f.svals || [], a = v[0] || {}, z = v[v.length - 1] || {};
      const r = [code, MC_TGT[f.funcTargetType] || f.funcTargetType, (a.Value || 0) / sc, (z.Value || 0) / sc, a.Turn > 0 ? a.Turn : 0, a.Count > 0 ? a.Count : 0];
      const ex = b ? (b.ckSelfIndv || []).concat(b.ckOpIndv || []).map((x) => x.name).join(",") : ""; if (ex) r.push(ex);
      return r;
    }).filter(Boolean)])]);
}
let mcFetching = false;
async function mcFetch() {
  if (mcFetching || typeof liveOn !== "function" || !liveOn() || !navigator.onLine) return;
  const kept = await kv.get("mystic-codes").catch(() => null);
  if (kept && Array.isArray(kept.list) && kept.list.length >= MC_NA.length && MC_LIST.length < kept.list.length) { MC_LIST = mcNorm(kept.list); if (S.tab === "mystic") mcRender(); }
  if (kept && Date.now() - (kept.at || 0) < 7 * 86400e3) return;
  mcFetching = true;
  try {
    const r = await fetch(LIVE_API + "nice_mystic_code.json", {cache: "no-cache"}); if (!r.ok) throw new Error(r.status);
    const list = mcFromNice(await r.json());
    if (list.length >= MC_NA.length) { await kv.set("mystic-codes", {at: Date.now(), list: list}); MC_LIST = mcNorm(list); if (S.tab === "mystic") mcRender(); }
  } catch (e) { /* offline or Atlas down: the list in the page stands */ }
  finally { mcFetching = false; }
}
// for the tests
window.__fgiMc = {list: () => MC_LIST, tot: (id, lv) => mcTot(mcById(id), lv || mcLv()), prefs: () => mcPrefs, set: (o) => mcSet(o), fromNice: mcFromNice, battle: (id, lv) => mcBattle(mcById(id), lv || 10), text: (id, i, lv) => mcById(id).sk[i].fx.map((f) => mcFxText(f, lv || 10))};
