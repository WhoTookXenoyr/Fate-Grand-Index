/* ================= v11: skill icons on every effect line ================= */
const ICON_COLS = 13, ICON_ROWS = 12;
const ICON_LIST = [["Artsdamageup","Arts damage up"],["Artsdmgboostup","Arts damage boost up"],["Artsdown","Arts down"],["Artsmini","Arts card"],["Artsresistdown","Arts resistance down"],["Artsresistup","Arts resistance up"],["Artsupstatus","Arts up"],["Attackdown","ATK down"],["Avoid","Evade"],["Bondbronze","Bond (bronze)"],["BondExp","Bond points up"],["Bondgold","Bond (gold)"],["Bondsilver","Bond (silver)"],["BuffBlock","Buff block"],["Buffregen","Buff every turn"],["BuffRemoval","Remove buffs"],["BuffWhenDefeat","Buff when defeated"],["Burn","Burn"],["Burnup","Burn damage up"],["Busterall","All cards Buster"],["Busterdamageup","Buster damage up"],["Busterdmgboostup","Buster damage boost up"],["Busterdown","Buster down"],["Bustermini","Buster card"],["Busterresistdown","Buster resistance down"],["Busterupstatus","Buster up"],["Changeclass","Class change"],["Charmstatus","Charm"],["ClassOverwriteAdvantageSaber","Class affinity change"],["Commandcardsseal","Command card seal"],["Convertantipurgedefense","Anti-Purge Defense"],["Critattackresdown","Crit attack resist down"],["Critchanceresdown","Crit chance resist down"],["Critchanceresup","Crit chance resist up"],["Critchndown","Crit chance down"],["Critchnup","Crit chance up"],["Critdamageresup","Crit damage resist up"],["Critdmgdown","Crit damage down"],["Critdmgresdown","Crit damage resist down"],["Critdmgup","Crit damage up"],["Criticalchanceresup","Crit rate resist up"],["Curse","Curse"],["CurseDmgUp","Curse damage up"],["Cursetoheal","Curse turns to heal"],["Damageabsorptionup","Damage absorb"],["DeathEvasion","Death evade"],["Debuffatk","Debuff on attack"],["Debuffatkonself","Debuff on attack (self)"],["Debuffimmune","Debuff immunity"],["Debuffregen","Debuff every turn"],["DebuffWhenDefeat","Debuff when defeated"],["Defenseup","DEF up"],["DelayedBuff","Delayed buff"],["DelayedDebuff","Delayed debuff"],["Desireforavenge","Vengeance"],["DmgResistDown","DEF down"],["DmgResistUp","Damage cut"],["Enemyfocus","Taunt"],["Eternalsleep","Eternal Sleep"],["Extraattackall","All cards Extra"],["Extraattackup","Extra Attack up"],["Extramini","Extra card"],["Facelessmoon","Faceless Moon"],["Forestfield","Forest field"],["GainStars","Gain stars"],["Grailbuff","Grail"],["GutsHpUp","Guts"],["Hitcountup","Hit count up"],["HpDrainEffect","HP drain"],["Hpregen","Heal / HP regen"],["Ignoredebuffres","Ignore debuff resist"],["Ignoredefense","Ignore DEF"],["Instakillimmunity","Instant-kill immunity"],["Instapowerdown","Death chance down"],["Instapowerup","Death chance up"],["Instaresistdown","Death resist down"],["Instaresistup","Death resist up"],["Invincible","Invincible"],["Livingflame","Living flame"],["Losestars","Lose stars"],["Magicbulleteffect","Magic bullet"],["Markofsin","Mark of sin"],["Maxhpdown","Max HP down"],["Maxhpup","Max HP up"],["Npcardtypechange","NP card type change"],["NpCharge","NP charge"],["Npchargedown","NP gain down"],["NpChargeDrain","NP drain"],["Npchargeup","NP gain up"],["NPCounter","NP counter"],["Npdamageresup","NP damage resist up"],["Npdamagetypechange","NP damage type change"],["Npdamageupboost","NP damage up boost"],["Npdefbuff","Buff when NP is used"],["Npgainturn","NP every turn"],["NPGainUpDmg","NP gain when hit up"],["NPIconMini","Noble Phantasm"],["NpMultiplyUpEffect","NP gain multiplier"],["NPOvercharge","Overcharge up"],["Nppowerdown","NP damage down"],["Nppowerup","NP damage up"],["Npseal","NP seal"],["Orderchangeeffect","Order change"],["Orderchangeseal","Order change seal"],["Pastalterationicon","Past alteration"],["Permartsup","Arts up (permanent)"],["Permquickup","Quick up (permanent)"],["Pig","Pig"],["Poison","Poison"],["Poisonup","Poison damage up"],["Powerdown","Damage down"],["Powerup","ATK / power up"],["Quickabsorpt","Quick star absorb"],["Quickall","All cards Quick"],["Quickcriticaldamageup","Quick crit damage up"],["Quickdamageup","Quick damage up"],["Quickdmgboostup","Quick damage boost up"],["Quickdown","Quick down"],["Quickmini","Quick card"],["Quickresistup","Quick resistance up"],["Quickseal","Quick seal"],["Quickupstatus","Quick up"],["Removaldebuffsuccessratedown","Debuff removal down"],["Removalresistdown","Removal resist down"],["Removalresistup","Debuff / removal resist up"],["Removedebuff","Remove debuffs"],["Resistancedown","Debuff resist down"],["RobinSubstitutionEffect","Substitute"],["Romantrait","Roman"],["S417_BattlePointGauge","Battle points"],["Sealattack","Attack seal"],["SkillIconMini","Skill"],["Skillrankup","Skill charge up"],["Skillreloading","Cooldown reduction"],["Skillseal","Skill seal"],["Sleep","Sleep"],["Specialinvincible","Special invincible"],["Specialinvinciblepierce","Ignore invincible"],["Specialpowerup","Special attack up"],["Stargaindown","Star drop down"],["Stargainturn","Stars every turn"],["Stargainup","Star drop up"],["Starrateresdown","Star gather down"],["Starrateresup","Star gather up"],["Startnp","Start with NP"],["Statusup","Debuff success up"],["Stunstatus","Stun"],["Sunlightfield","Sunlight field"],["Surehit","Sure hit"],["Tauntdown","Taunt down"],["Underworldprotecc","Underworld protection"],["Unknowngender","Unknown gender"],["Watersidefield","Waterside field"]];
const ICON_IDX = {}; ICON_LIST.forEach((x, i) => { ICON_IDX[x[0]] = i; });
// icons straight from the game's data (filled in by Past Chaldea): "B:300" is buff icon 300, "K:00300" skill icon 00300
const GAME_ICONS = new Map();
const GAME_ICON_BASE = "https://static.atlasacademy.io/NA/";
const gameIconUrl = (k) => GAME_ICON_BASE + (k[0] === "B" ? "BuffIcons/bufficon_" : "SkillIcons/skill_") + k.slice(2) + ".png";
const iconKnown = (k) => !!k && (ICON_IDX[k] != null || GAME_ICONS.has(k));
const ICON_LABEL = (k) => ICON_IDX[k] != null ? ICON_LIST[ICON_IDX[k]][1] : GAME_ICONS.has(k) ? GAME_ICONS.get(k)[0] : k;
function iconStyle(k) {
  const i = ICON_IDX[k]; if (i == null) return "";
  const c = i % ICON_COLS, r = Math.floor(i / ICON_COLS);
  return `background-position:${(c / (ICON_COLS - 1) * 100).toFixed(4)}% ${(r / (ICON_ROWS - 1) * 100).toFixed(4)}%`;
}
const icHTML = (k, cls) => ICON_IDX[k] != null ? `<i class="ic${cls ? " " + cls : ""}" style="${iconStyle(k)}" aria-hidden="true"></i>`
  : GAME_ICONS.has(k) ? `<img class="ic gi${cls ? " " + cls : ""}" src="${gameIconUrl(k)}" alt="" loading="lazy" decoding="async">` : "";
const ICAUTO_KEY = "spirit-origin-list:v1:icauto";
let iconAuto = (() => { try { return localStorage.getItem(ICAUTO_KEY) !== "off"; } catch (e) { return true; } })();
// the line's own words are its name, so the same line keeps its icon wherever it shows up for that servant
const lnKey = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").replace(/[\s.!?;:,]+$/, "").trim().slice(0, 160);

/* ---------- a best guess from the words in the line ---------- */
// Each rule finds where an effect is named; the effect named first in the line wins, and ties go to the more specific rule.
const IC_DOWN = /\b(?:decreas|reduc|lower|drain|weaken|minus)|\bdown\b|(?:^|\s)[-−]\s?\d/;
const IC_UP = /\b(?:increas|up\b|boost|amplif|raise)/;
const CARD_IC = {
  buster: {up: "Busterupstatus", down: "Busterdown", dmg: "Busterdamageup", boost: "Busterdmgboostup", resDown: "Busterresistdown", resUp: "DmgResistUp"},
  arts: {up: "Artsupstatus", down: "Artsdown", dmg: "Artsdamageup", boost: "Artsdmgboostup", resDown: "Artsresistdown", resUp: "Artsresistup"},
  quick: {up: "Quickupstatus", down: "Quickdown", dmg: "Quickdamageup", boost: "Quickdmgboostup", resDown: "DmgResistDown", resUp: "Quickresistup"},
};
const ICON_RULES = [
  [/^deals? (?:[\w-]+ ){0,4}damage\b/, "NPIconMini"],
  [/skill (?:cool ?downs?|cd|charge time)|cool ?downs?|\bcd\b|skill reload/, "Skillreloading"],
  [/(?:np|noble phantasm) overcharge|overcharge/, "NPOvercharge"],
  [/np damage up boost|np boost/, "Npdamageupboost"],
  [/np (?:damage|dmg) (?:res|resist)/, "Npdamageresup"],
  [/(?:np|noble phantasm) (?:card )?type|card type/, "Npcardtypechange"],
  [/(?:np|noble phantasm) (?:damage|dmg|strength|power)/, (c) => IC_DOWN.test(c) ? "Nppowerdown" : "Nppowerup"],
  [/(?:charges?[^,;.]{0,24})?\bnp\b[^,;.]{0,24}?(?:(?:each|every|per) turn|\/ ?(?:turn|t)\b)|(?:each|every) turn[^,;.]{0,20}\bnp\b/, "Npgainturn"],
  [/np (?:gain|generation|gen)\b[^,;.]{0,24}(?:when (?:hit|damaged|attacked)|taking damage)|np gain when hit|np you gain when damaged/, "NPGainUpDmg"],
  [/(?:decreas|reduc)\w* (?:your |own )?np\b(?! gain| strength| damage)/, "NpChargeDrain"],
  [/np (?:gain|generation|gen|rate)\b|np gain/, (c) => IC_DOWN.test(c) ? "Npchargedown" : "Npchargeup"],
  [/enem\w*'?s?'? (?:np|charge)|drains? [^,;.]{0,16}\bnp\b|(?:np|charge) (?:gauge |bar )?[-−]\s?\d|(?:decreas|reduc|lower)\w* [^,;.]{0,24}charge/, "NpChargeDrain"],
  [/charges?[^,;.]{0,24}\bnp\b|\bnp (?:gauge|charge|\+\s?\d|\d+\s?%)|\+\s?\d+\s?% np|np \d+-\d+%|start\w* with[^,;.]{0,12}np/, (c) => /start\w* (?:with|the battle)/.test(c) ? "Startnp" : "NpCharge"],
  [/\bnp seal|seals? [^,;.]{0,16}\bnp\b/, "Npseal"],
  [/skill seal|seals? [^,;.]{0,16}skills?/, "Skillseal"],
  [/quick seal|seals? [^,;.]{0,16}quick/, "Quickseal"],
  [/(?:command )?card seal|seals? [^,;.]{0,16}cards?/, "Commandcardsseal"],
  [/attack seal|seals? [^,;.]{0,16}attack/, "Sealattack"],
  [/(?:ignore|pierce)\w* invinc|invincible pierce/, "Specialinvinciblepierce"],
  [/special invinc/, "Specialinvincible"],
  [/invinc/, "Invincible"],
  [/death evasion|evade death/, "DeathEvasion"],
  [/\bevade|\bevasion|\bdodge/, "Avoid"],
  [/\bguts\b/, "GutsHpUp"],
  [/\btaunt|target focus/, (c) => IC_DOWN.test(c) ? "Tauntdown" : "Enemyfocus"],
  [/insta[- ]?kill immun|instant[- ]?(?:kill|death) immun|death immun/, "Instakillimmunity"],
  [/debuff[- ]?immun|immun\w* (?:to )?(?:[\w]+ )?debuffs?|debuff block/, "Debuffimmune"],
  [/charm immun|immun\w* to charm|mental (?:debuff )?immun/, "Debuffimmune"],
  [/buff block|nullify buff/, "BuffBlock"],
  [/ignore debuff res/, "Ignoredebuffres"],
  [/(?:buff[- ]?)?removal res\w*/, (c) => IC_DOWN.test(c) ? "Removalresistdown" : "Removalresistup"],
  [/debuff res\w*|resist\w* (?:to )?debuffs?|mental debuff res/, (c) => IC_DOWN.test(c) ? "Resistancedown" : "Removalresistup"],
  [/debuff (?:success|chance|rate)|success rate/, "Statusup"],
  [/remov\w*[^,;.]{0,20}debuffs?|cleans\w*|debuffs? (?:removed|cleared)/, "Removedebuff"],
  [/remov\w*[^,;.]{0,20}\bbuffs?\b|\bbuff remov/, "BuffRemoval"],
  [/buff[^,;.]{0,12}(?:each|every) turn/, "Buffregen"],
  [/max(?:imum)? hp/, (c) => IC_DOWN.test(c) ? "Maxhpdown" : "Maxhpup"],
  [/insta[- ]?kill|instant[- ]?(?:kill|death)|\bdeath\b/, (c) => /res/.test(c) ? (IC_DOWN.test(c) ? "Instaresistdown" : "Instaresistup") : (IC_DOWN.test(c) ? "Instapowerdown" : "Instapowerup")],
  [/curse[^,;.]{0,10}(?:to|into) heal/, "Cursetoheal"],
  [/\bburn/, (c) => /burn\w* (?:damage|dmg)|(?:increas|amplif)\w* [^,;.]{0,12}burn/.test(c) ? "Burnup" : "Burn"],
  [/\bcurse/, (c) => /curse\w* (?:damage|dmg)|(?:increas|amplif)\w* [^,;.]{0,12}curse/.test(c) ? "CurseDmgUp" : "Curse"],
  [/\bpoison/, (c) => /poison\w* (?:damage|dmg)|(?:increas|amplif)\w* [^,;.]{0,12}poison/.test(c) ? "Poisonup" : "Poison"],
  [/\bpig\b/, "Pig"],
  [/\bstun|paraly|petrif|\bfreeze|\bpermafrost|\bbound\b/, "Stunstatus"],
  [/\bcharm|\bconfus/, "Charmstatus"],
  [/\bterror|\bfear\b|immobili[sz]/, "Stunstatus"],
  [/eternal sleep/, "Eternalsleep"],
  [/\bsleep/, "Sleep"],
  [/sure[- ]?hit/, "Surehit"],
  [/ignore\w* (?:def|defen[cs]e)|pierce (?:def|defen[cs]e)|def-ignoring/, "Ignoredefense"],
  [/crit\w* (?:attack )?(?:damage|dmg|strength|power)/, (c) => /res/.test(c) ? (IC_DOWN.test(c) ? "Critdmgresdown" : "Critdamageresup") : /quick/.test(c) ? "Quickcriticaldamageup" : (IC_DOWN.test(c) ? "Critdmgdown" : "Critdmgup")],
  [/crit\w* (?:rate|chance)/, (c) => /res/.test(c) ? (IC_DOWN.test(c) ? "Critchanceresdown" : "Critchanceresup") : (IC_DOWN.test(c) ? "Critchndown" : "Critchnup")],
  [/(?:gains? |gets? |generates? )?(?:\d+ )?(?:crit\w* )?stars?[^,;.]{0,12}(?:(?:each|every|per) turn|\/ ?turn)/, "Stargainturn"],
  [/(?:crit\w* )?star (?:gather|absorp\w*|absorb|weight|concentrat\w*)|(?:gather|absorb)\w* [^,;.]{0,12}stars/, (c) => /quick/.test(c) ? "Quickabsorpt" : (IC_DOWN.test(c) ? "Starrateresdown" : "Starrateresup")],
  [/(?:crit\w* )?star (?:drop|gen\w*|rate)/, (c) => IC_DOWN.test(c) ? "Stargaindown" : "Stargainup"],
  [/(?:los\w*|remov\w*|decreas\w*|reduc\w*) [^,;]{0,12}stars/, "Losestars"],
  [/(?:gain\w*|gets?|obtain\w*|generat\w*) [^,;]{0,32}stars\b|\+\s?\d+ (?:crit\w* )?stars|\d+ crit\w* stars/, "GainStars"],
  [/all (?:command )?cards?[^,;.]{0,14}(?:buster|arts|quick|extra)|(?:buster|arts|quick)[^,;.]{0,6} for all cards/, (c) => /quick/.test(c) ? "Quickall" : /extra/.test(c) ? "Extraattackall" : "Busterall"],
  [/\b(?:buster|arts|quick)\b/, (c, m) => {
    const t = CARD_IC[m[0]] || CARD_IC.buster, rest = c.slice(c.indexOf(m[0]));
    if (/\bseal/.test(rest)) return m[0] === "quick" ? "Quickseal" : "Commandcardsseal";
    if (/res\w*/.test(rest) && !/debuff/.test(rest)) return IC_DOWN.test(c) ? t.resDown : t.resUp;
    if (/crit/.test(rest)) return m[0] === "quick" ? "Quickcriticaldamageup" : "Critdmgup";
    if (/\bstars?\b|absorp/.test(rest)) return m[0] === "quick" ? "Quickabsorpt" : "Starrateresup";
    if (/permanent/.test(rest) && m[0] !== "buster") return m[0] === "quick" ? "Permquickup" : "Permartsup";
    if (/(?:damage|dmg)/.test(rest)) return /boost/.test(rest) ? t.boost : t.dmg;
    return IC_DOWN.test(c) ? t.down : t.up;
  }],
  [/extra (?:attack|card)/, "Extraattackup"],
  [/hit count|hits? (?:up|\+)|double [^,;.]{0,10}hits?/, "Hitcountup"],
  [/damage absorb|absorbs? damage/, "Damageabsorptionup"],
  [/(?:damage|dmg) (?:taken|received)|(?:damage|dmg) cut|damage reduction|(?:reduc|decreas)\w* [^,;.]{0,12}(?:damage|dmg) (?:taken|received)/, (c) => /\b(?:increas|up\b)/.test(c) && !/(?:reduc|decreas|cut)/.test(c) ? "DmgResistDown" : "DmgResistUp"],
  [/\bdef\b|defen[cs]e/, (c) => IC_DOWN.test(c) ? "DmgResistDown" : "Defenseup"],
  [/(?:damage|dmg|attack|atk|strength|power)(?: up)?(?: \+?\d+%?)? (?:against|vs\.?|versus|to (?:enemies with|\[))|special (?:attack|damage)|bonus damage (?:against|vs)/, "Specialpowerup"],
  [/\b(?:attack|atk)\b/, (c) => IC_DOWN.test(c) ? "Attackdown" : "Powerup"],
  [/(?:damage|dmg|strength|power)\b/, (c) => IC_DOWN.test(c) && !/(?:taken|received)/.test(c) ? "Powerdown" : "Powerup"],
  [/\bheal\w*|\bhp (?:regen|recover)\w*|\b(?:recover|restore|regen)\w*(?: [\w.'’]+){0,3} hp\b/, "Hpregen"],
  [/(?:decreas|reduc|los)\w* (?:your |own |their )?hp\b|absorb\w* hp/, "HpDrainEffect"],
  [/drain\w* hp|hp drain/, "HpDrainEffect"],
  [/delayed (?:debuff|[^,;.]{0,12}(?:sleep|stun|curse))/, "DelayedDebuff"],
  [/delayed/, "DelayedBuff"],
  [/class (?:affinity|advantage)|affinity|advantage against/, "ClassOverwriteAdvantageSaber"],
  [/class change|chang\w* [^,;.]{0,10}class/, "Changeclass"],
  [/order change/, "Orderchangeeffect"],
  [/sunlight/, "Sunlightfield"], [/waterside|water ?side|near water/, "Watersidefield"], [/forest/, "Forestfield"],
  [/when defeated|upon defeat|on death|when (?:this unit )?dies/, (c) => /debuff|enem/.test(c) ? "DebuffWhenDefeat" : "BuffWhenDefeat"],
  [/mark of sin/, "Markofsin"], [/living flame/, "Livingflame"], [/faceless moon/, "Facelessmoon"], [/vengeance|desire for reveng/, "Desireforavenge"],
  [/anti-?purge/, "Convertantipurgedefense"], [/magic bullet/, "Magicbulleteffect"], [/underworld/, "Underworldprotecc"], [/substitut/, "RobinSubstitutionEffect"],
  [/\bbond\b/, "BondExp"],
];
const IC_SEP = /[,;&]|\s\+\s|\s(?:and|then)\s|\.\s|:\s/g;
function clauseAt(t, i, j) {
  let a = 0, b = t.length, m; IC_SEP.lastIndex = 0;
  while ((m = IC_SEP.exec(t))) { if (m.index + m[0].length <= i) a = m.index + m[0].length; else if (m.index >= j) { b = m.index; break; } }
  return t.slice(a, b);
}
function iconMatches(line) {
  const t = String(line || "").toLowerCase().replace(/\s+/g, " ");
  const hits = [];
  ICON_RULES.forEach((r, order) => {
    const re = new RegExp(r[0].source, "g"); let m;
    while ((m = re.exec(t))) {
      const c = clauseAt(t, m.index, m.index + m[0].length);
      const k = typeof r[1] === "function" ? r[1](c, m) : r[1];
      if (k && ICON_IDX[k] != null) hits.push({at: m.index, order, k});
      if (!m[0].length) re.lastIndex++;
    }
  });
  hits.sort((a, b) => a.at - b.at || a.order - b.order);
  const seen = new Set(), out = [];
  hits.forEach((h) => { if (!seen.has(h.k)) { seen.add(h.k); out.push(h.k); } });
  return out;
}
const guessCache = new Map();
function guessIcon(line) {
  const k = lnKey(line); if (guessCache.has(k)) return guessCache.get(k);
  const g = iconMatches(line)[0] || ""; if (guessCache.size > 2000) guessCache.clear(); guessCache.set(k, g); return g;
}
// what a line shows: your pick, nothing if you chose no icon, else the guess (when guessing is on)
function lineIcon(s, line) {
  const k = lnKey(line), mine = s && s.lineIcons && typeof s.lineIcons === "object" ? s.lineIcons[k] : undefined;
  if (mine === "none") return {k: "", how: "none"};
  if (mine && iconKnown(mine)) return {k: mine, how: "mine"};
  const g = iconAuto ? guessIcon(line) : "";
  return {k: g, how: g ? "auto" : "empty"};
}
function iconLinesHTML(s, text, view) {
  const can = !view && !S.readOnly && s && S.servants.some((x) => x.id === s.id);
  return effectLines(text).map((l) => {
    const ic = lineIcon(s, l), k = lnKey(l);
    if (!can) return ic.k ? `<span class="ln ln-i">${icHTML(ic.k)}<span class="ln-t">${esc(l)}</span></span>` : `<span class="ln">${esc(l)}</span>`;
    const lab = ic.k ? "Icon: " + ICON_LABEL(ic.k) + (ic.how === "auto" ? " (guessed)" : "") + ". Press to change" : "Add an icon to this line";
    return `<span class="ln ln-i"><button type="button" class="ln-ic ${ic.how}" data-action="ln-icon" data-sid="${esc(s.id)}" data-k="${esc(k)}" title="${esc(lab)}" aria-label="${esc(lab)}">${ic.k ? icHTML(ic.k) : `<i class="ic-add" aria-hidden="true"></i>`}</button><span class="ln-t">${esc(l)}</span></span>`;
  }).join("");
}

/* ---------- the icon picker ---------- */
const icPick = document.createElement("div");
icPick.id = "ic-pick"; icPick.className = "ic-pick"; icPick.hidden = true;
icPick.setAttribute("role", "dialog"); icPick.setAttribute("aria-label", "Choose an icon for this line");
icPick.innerHTML = `<div class="ic-head"><b>Icon for this line</b><button type="button" class="ic-x" data-ic-close aria-label="Close">×</button></div>
  <p class="ic-line"></p>
  <div class="ic-sugg-wrap"><span class="ic-lbl">Suggested</span><div class="ic-sugg"></div></div>
  <div class="ic-tools"><input type="search" class="ic-q" placeholder="Search, e.g. NP, Buster, heal" aria-label="Search icons" autocomplete="off"><button type="button" class="btn ghost sm" data-ic="auto">Automatic</button><button type="button" class="btn ghost sm" data-ic="none">No icon</button></div>
  <div class="ic-groups" role="listbox" aria-label="All icons"></div>
  <p class="ic-empty" hidden>No icon matches that.</p>
  <label class="ic-auto"><input type="checkbox" class="ic-auto-in"${iconAuto ? " checked" : ""}> Guess icons for lines I haven't set</label>`;
document.body.appendChild(icPick);
let icFor = null, icBuilt = 0;
const icQ = icPick.querySelector(".ic-q");
// the grid is drawn the first time it opens, so the game's icons (added later on) are in it too
function icBuild() {
  if (icBuilt === 1 + GAME_ICONS.size) return;
  icBuilt = 1 + GAME_ICONS.size;
  const btn = (k, label, q) => `<button type="button" role="option" data-ic="${esc(k)}" title="${esc(label)}" aria-label="${esc(label)}" data-q="${esc((label + " " + q + " " + k).toLowerCase())}">${icHTML(k)}</button>`;
  const game = Array.from(GAME_ICONS.entries()), buff = game.filter((x) => x[0][0] === "B"), skill = game.filter((x) => x[0][0] === "K");
  const group = (cls, title, list) => list.length ? `<section class="ic-gr ${cls}"><p class="ic-gh">${title} <small>${list.length}</small></p><div class="ic-grid ${cls}">${list.join("")}</div></section>` : "";
  icPick.querySelector(".ic-groups").innerHTML = group("ig-set", "Your icon set", ICON_LIST.map((x) => btn(x[0], x[1], "")))
    + group("ig-buff", "Buff icons from the game", buff.map((x) => btn(x[0], x[1][0], x[1][1] || "")))
    + group("ig-skill", "Skill icons from the game", skill.map((x) => btn(x[0], x[1][0], x[1][1] || "")));
}
function icFilter() {
  const q = icQ.value.trim().toLowerCase(); let n = 0;
  icPick.querySelectorAll(".ic-gr").forEach((gr) => {
    let m = 0;
    gr.querySelectorAll("button").forEach((b) => { const on = !q || q.split(/\s+/).every((w) => b.dataset.q.includes(w)); b.hidden = !on; if (on) m++; });
    gr.hidden = !m; n += m;
  });
  icPick.querySelector(".ic-empty").hidden = n > 0;
}
icQ.addEventListener("input", icFilter);
function placePick(anchor) {
  if (window.matchMedia("(max-width: 640px)").matches) { icPick.classList.add("sheet"); icPick.style.left = icPick.style.top = ""; return; }
  icPick.classList.remove("sheet");
  const r = anchor.getBoundingClientRect(), w = icPick.offsetWidth, h = icPick.offsetHeight;
  let x = r.left - 8, y = r.bottom + 6;
  x = clamp(x, 8, window.innerWidth - w - 8);
  if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 6);
  icPick.style.left = x + "px"; icPick.style.top = y + "px";
}
function openPick(btn) {
  const s = S.servants.find((x) => x.id === btn.dataset.sid); if (!s) return;
  const lnEl = btn.closest(".ln"), text = lnEl ? lnEl.querySelector(".ln-t").textContent : "";
  icFor = {sid: s.id, k: btn.dataset.k, btn, text};
  const cur = lineIcon(s, text), mine = s.lineIcons && s.lineIcons[btn.dataset.k];
  icPick.querySelector(".ic-line").textContent = text;
  const sug = iconMatches(text).slice(0, 6);
  icPick.querySelector(".ic-sugg-wrap").hidden = !sug.length;
  icPick.querySelector(".ic-sugg").innerHTML = sug.map((k) => `<button type="button" data-ic="${k}" title="${esc(ICON_LABEL(k))}" aria-pressed="${cur.k === k}">${icHTML(k)}<span>${esc(ICON_LABEL(k))}</span></button>`).join("");
  icBuild();
  icPick.querySelectorAll(".ic-grid button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.ic === cur.k && cur.how === "mine")));
  icPick.querySelector('[data-ic="auto"]').setAttribute("aria-pressed", String(!mine));
  icPick.querySelector('[data-ic="auto"]').textContent = iconAuto && guessIcon(text) ? "Automatic: " + ICON_LABEL(guessIcon(text)) : "Automatic";
  icPick.querySelector('[data-ic="none"]').setAttribute("aria-pressed", String(mine === "none"));
  icQ.value = ""; icFilter();
  icPick.hidden = false; placePick(btn);
  const g = icPick.querySelector(".ic-groups"), sel = g.querySelector('[aria-selected="true"]');
  g.scrollTop = sel ? Math.max(0, sel.getBoundingClientRect().top - g.getBoundingClientRect().top + g.scrollTop - 40) : 0;
  btn.setAttribute("aria-expanded", "true");
  (window.matchMedia("(pointer: coarse)").matches ? icPick.querySelector(".ic-x") : icQ).focus({preventScroll: true});
}
function closePick(back) {
  if (icPick.hidden) return;
  icPick.hidden = true;
  const f = icFor; icFor = null;
  if (f && f.btn) { f.btn.removeAttribute("aria-expanded"); if (back && f.btn.isConnected) f.btn.focus({preventScroll: true}); }
}
function refreshLineIcons(s, k) {
  document.querySelectorAll(`.ln-ic[data-sid="${CSS.escape(s.id)}"][data-k="${CSS.escape(k)}"]`).forEach((b) => {
    const text = b.parentNode.querySelector(".ln-t").textContent, ic = lineIcon(s, text);
    const lab = ic.k ? "Icon: " + ICON_LABEL(ic.k) + (ic.how === "auto" ? " (guessed)" : "") + ". Press to change" : "Add an icon to this line";
    b.className = "ln-ic " + ic.how; b.title = lab; b.setAttribute("aria-label", lab);
    b.innerHTML = ic.k ? icHTML(ic.k) : `<i class="ic-add" aria-hidden="true"></i>`;
  });
}
function setLineIcon(choice) {
  if (!icFor || S.readOnly) return;
  const s = S.servants.find((x) => x.id === icFor.sid); if (!s) return;
  const map = s.lineIcons && typeof s.lineIcons === "object" ? Object.assign({}, s.lineIcons) : {};
  if (choice === "auto") delete map[icFor.k]; else map[icFor.k] = choice;
  if (Object.keys(map).length) s.lineIcons = map; else delete s.lineIcons;
  scheduleWrite("servants", s);
  refreshLineIcons(s, icFor.k);
  closePick(true);
}
icPick.addEventListener("click", (e) => {
  if (e.target.closest("[data-ic-close]")) { closePick(true); return; }
  const b = e.target.closest("[data-ic]"); if (b) setLineIcon(b.dataset.ic);
});
icPick.querySelector(".ic-auto-in").addEventListener("change", (e) => {
  iconAuto = e.target.checked; try { localStorage.setItem(ICAUTO_KEY, iconAuto ? "on" : "off"); } catch (er) {}
  closePick(true); renderDossier(true); if (typeof renderVersus === "function") renderVersus();
  toast(iconAuto ? "Lines you haven't set get a guessed icon." : "Only the icons you picked are shown.");
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="ln-icon"]');
  if (b) { e.preventDefault(); e.stopPropagation(); if (icFor && icFor.btn === b && !icPick.hidden) closePick(true); else openPick(b); return; }
  if (!icPick.hidden && !e.target.closest("#ic-pick")) closePick(false);
}, true);
window.addEventListener("keydown", (e) => {
  if (icPick.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePick(true); return; }
  if (e.key === "Enter" && e.target === icQ) { e.preventDefault(); const f = icPick.querySelector(".ic-grid button:not([hidden])"); if (f) setLineIcon(f.dataset.ic); }
}, true);
window.addEventListener("resize", () => { if (!icPick.hidden && icFor && icFor.btn.isConnected) placePick(icFor.btn); });
// the picker follows its line while the page scrolls, and steps aside once the line is out of sight
let icScrollRaf = 0;
document.addEventListener("scroll", (e) => {
  if (icPick.hidden || icPick.classList.contains("sheet") || icScrollRaf || (e.target && e.target.closest && e.target.closest("#ic-pick"))) return;
  icScrollRaf = requestAnimationFrame(() => {
    icScrollRaf = 0; if (icPick.hidden || !icFor) return;
    const b = icFor.btn; if (!b.isConnected) { closePick(false); return; }
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) closePick(false); else placePick(b);
  });
}, true);
