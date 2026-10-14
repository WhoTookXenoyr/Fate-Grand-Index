/* ---------- traits, attribute and alignment ---------- */
const ATTRS = ["Man", "Earth", "Sky", "Star", "Beast"];
const ATTR_LABEL = {Man: "Man (Human)", Earth: "Earth", Sky: "Sky", Star: "Star", Beast: "Beast"};
const ORDERS = ["Lawful", "Neutral", "Chaotic"];
const MORALS = ["Good", "Balanced", "Evil", "Summer", "Madness", "Bride"];
const COMMON_TRAITS = ["Male", "Female", "Humanoid", "Hominidae Servant", "Non-Hominidae Servant", "Divine", "Divine Spirit", "Goddess Servant", "Dragon", "King", "Riding", "Arthur", "Artoria Face", "Round Table Knight", "Roman", "Greek Mythology Male", "Fae", "Threat to Humanity", "Demonic", "Demonic Beast Servant", "Oni", "Wild Beast", "Animal Characteristics Servant", "Giant", "Super Large", "Mechanical", "Levitating Servant", "Seven Knights Servant", "Pseudo-Servant", "Living Human", "Children Servants", "Summer Mode Servant", "Brynhildr's Beloved", "Weak to Enuma Elish", "Enuma Elish Nullification", "Feminine Looking"];
const TRAIT_ALIAS = {"divinity": "Divine", "artoria face": "Artoria Face", "riding servant": "Riding", "non-hominidae": "Non-Hominidae Servant", "pseudo-servants": "Pseudo-Servant", "goddess": "Goddess Servant", "demonic beast": "Demonic Beast Servant", "animal characteristics": "Animal Characteristics Servant", "hominidae": "Hominidae Servant"};
const normTrait = (t) => { const v = String(t || "").replace(/\s+/g, " ").trim(); return TRAIT_ALIAS[v.toLowerCase()] || v; };

// Read from each servant's page on the fandom wiki (Kashin Koji and C.I.E.L wouldn't load, so they start empty)
const TRAIT_DEFAULTS = {
  "arjuna-alter": {gender: "Male", attr: "Sky", lawOrder: ["Lawful"], moral: ["Good", "Evil"], traits: ["Divine", "Divine Spirit", "Hominidae Servant", "Humanoid", "Weak to Enuma Elish"]},
  "artoria": {gender: "Female", attr: "Earth", lawOrder: ["Lawful"], moral: ["Good"], traits: ["Arthur", "Artoria Face", "Dragon", "Hominidae Servant", "Humanoid", "King", "Riding", "Round Table Knight", "Seven Knights Servant", "Weak to Enuma Elish"]},
  "cu-chulainn-alter": {gender: "Male", attr: "Earth", lawOrder: ["Chaotic"], moral: ["Evil"], traits: ["Brynhildr's Beloved", "Divine", "Humanoid", "Weak to Enuma Elish"]},
  "ereshkigal": {gender: "Female", attr: "Earth", lawOrder: ["Chaotic"], moral: ["Evil"], traits: ["Divine", "Humanoid", "King", "Pseudo-Servant", "Weak to Enuma Elish"]},
  "francis-drake": {gender: "Female", attr: "Star", lawOrder: ["Chaotic"], moral: ["Evil"], traits: ["Enuma Elish Nullification", "Hominidae Servant", "Humanoid", "Riding", "Seven Knights Servant"]},
  "illya": {gender: "Female", attr: "Man", lawOrder: ["Neutral"], moral: ["Good"], traits: ["Children Servants", "Humanoid", "Living Human", "Pseudo-Servant", "Weak to Enuma Elish"]},
  "ivan-the-terrible": {gender: "Male", attr: "Man", lawOrder: ["Lawful", "Chaotic"], moral: ["Evil"], traits: ["Animal Characteristics Servant", "Giant", "Hominidae Servant", "Humanoid", "King", "Riding", "Seven Knights Servant", "Weak to Enuma Elish", "Wild Beast"]},
  "lady-avalon": {gender: "Female", attr: "Earth", lawOrder: ["Chaotic"], moral: ["Good"], traits: ["Hominidae Servant", "Humanoid", "Round Table Knight", "Summer Mode Servant", "Weak to Enuma Elish"]},
  "larva-tiamat": {gender: "Female", attr: "Star", lawOrder: ["Chaotic"], moral: ["Evil"], traits: ["Animal Characteristics Servant", "Demonic Beast Servant", "Divine", "Divine Spirit", "Dragon", "Enuma Elish Nullification", "Goddess Servant", "Levitating Servant", "Non-Hominidae Servant", "Super Large"]},
  "miyamoto-musashi": {gender: "Female", attr: "Man", lawOrder: ["Chaotic"], moral: ["Good"], traits: ["Hominidae Servant", "Humanoid", "Weak to Enuma Elish"]},
  "mysterious-heroine-x-alter": {gender: "Female", attr: "Star", lawOrder: ["Neutral"], moral: ["Evil"], traits: ["Arthur", "Dragon", "Humanoid", "King", "Artoria Face"]},
  "nitocris-alter": {gender: "Female", attr: "Sky", lawOrder: ["Chaotic"], moral: ["Evil"], traits: ["Divine", "Divine Spirit", "Hominidae Servant", "Humanoid", "King", "Levitating Servant", "Weak to Enuma Elish"],
    buffs: [{tag: "align:Good", what: "60% Evade, debuff and Instant-Kill immunity for 3 turns (skill 3). Her skill 2 makes the party Good for 1 turn."}]},
  "oberon": {gender: "Male", attr: "Earth", lawOrder: ["Chaotic"], moral: ["Evil"], traits: ["Dragon", "Enuma Elish Nullification", "Fae", "Humanoid", "King", "Non-Hominidae Servant", "Riding", "Threat to Humanity"]},
  "oda-nobunaga": {gender: "", attr: "Earth", lawOrder: ["Chaotic"], moral: ["Balanced"], traits: ["Feminine Looking", "Hominidae Servant", "Humanoid", "King", "Weak to Enuma Elish"]},
  "osakabehime": {gender: "Female", attr: "Earth", lawOrder: ["Chaotic"], moral: ["Balanced"], traits: ["Divine", "Hominidae Servant", "Humanoid", "Seven Knights Servant", "Weak to Enuma Elish"]},
  "queen-medb": {gender: "Female", attr: "Earth", lawOrder: ["Chaotic"], moral: ["Evil"], traits: ["Hominidae Servant", "Humanoid", "King", "Riding", "Seven Knights Servant", "Weak to Enuma Elish"],
    buffs: [{tag: "trait:Male", what: "ATK +10–20% for 3 turns (Discipline of the Queen)"}, {tag: "trait:Male", what: "NP charge 20–30% (Queen's Substance)"}, {tag: "trait:Fae", what: "NP charge 20–30% (Queen's Substance)"}]},
  "salter-rider": {gender: "Female", attr: "Man", lawOrder: ["Lawful"], moral: ["Evil"], traits: ["Artoria", "Dragon", "Humanoid", "King", "Riding", "Artoria Face", "Weak to Enuma Elish"]},
  "space-ereshkigal": {gender: "Female", attr: "Beast", lawOrder: ["Chaotic"], moral: ["Good"], traits: ["Divine", "Enuma Elish Nullification", "Humanoid", "King", "Spaceflight-able Servant"]},
  "space-ishtar": {gender: "Female", attr: "Star", lawOrder: ["Lawful"], moral: ["Evil"], traits: ["Divine", "Divine Spirit", "Humanoid"]},
  "tamamo-no-mae": {gender: "Female", attr: "Sky", lawOrder: ["Neutral"], moral: ["Evil"], traits: ["Animal Characteristics Servant", "Demonic Beast Servant", "Divine", "Divine Spirit", "Goddess Servant", "Humanoid", "Non-Hominidae Servant", "Seven Knights Servant", "Weak to Enuma Elish"]}
};

// What each kit brings, read from the wiki. s = skill slot (0-2), "np" or "p" (passive); cd = cooldown at Lv 1 when the wiki gave it
const KIT_DEFAULTS = {
  "arjuna-alter": [{s: 1, t: "np", who: "self", n: 30, cd: 7}, {s: 2, t: "guts", who: "self", dur: 3, cd: 9}, {s: 2, t: "regen", who: "self", dur: 3, cd: 9}, {s: "np", t: "enemyDebuff", who: "enemy", dur: 3, note: "Buster resistance down"}],
  "artoria": [{s: 2, t: "np", who: "self", n: 30, cd: 7}],
  "cu-chulainn-alter": [{s: 0, t: "enemyDebuff", who: "enemy", dur: 3, cd: 8, note: "ATK and crit chance down"}, {s: 1, t: "evade", who: "self", dur: 3, cd: 7, note: "2 attacks"}, {s: 1, t: "defup", who: "self", dur: 3, cd: 7}, {s: 2, t: "guts", who: "self", dur: 5, cd: 9}],
  "ereshkigal": [{s: 0, t: "invuln", who: "self", dur: 1, cd: 8}, {s: 0, t: "debuffImm", who: "self", dur: 1, cd: 8}, {s: 1, t: "np", who: "self", cd: 8, note: "amount not given on the wiki page"}, {s: 2, t: "defup", who: "party", dur: 3, cd: 8}, {s: 2, t: "npgain", who: "party", dur: 3, cd: 8}],
  "francis-drake": [{s: 1, t: "npgain", who: "self", dur: 3, cd: 8}, {s: 2, t: "np", who: "self", n: 50, cd: 8}],
  "illya": [{s: 1, t: "invuln", who: "self", dur: 1, cd: 8}, {s: 1, t: "npgain", who: "self", dur: 3, cd: 8}, {s: 2, t: "guts", who: "ally", dur: 3, cd: 8, note: "70% chance"}, {s: 2, t: "debuffImm", who: "ally", dur: 3, cd: 8}, {s: 2, t: "heal", who: "ally", cd: 8}, {s: "p", t: "npTurn", who: "self", n: 3}],
  "ivan-the-terrible": [{s: 0, t: "np", who: "self", n: 30, cd: 7}, {s: 0, t: "npgain", who: "self", dur: 3, cd: 7}, {s: 2, t: "invuln", who: "self", dur: 1, cd: 8}, {s: 2, t: "enemyDebuff", who: "enemy", dur: 3, cd: 8, note: "ATK down and buff removal"}],
  "lady-avalon": [{s: 1, t: "np", who: "party", n: 20, cd: 8}, {s: 2, t: "invuln", who: "party", dur: 1, cd: 10}, {s: 2, t: "np", who: "self", n: 20, cd: 10, note: "per enemy"}, {s: "p", t: "npTurn", who: "self", n: 5}, {s: "np", t: "npTurn", who: "party", n: 5, dur: 3, note: "5–10% a turn for 3 turns"}],
  "larva-tiamat": [{s: 0, t: "np", who: "self", n: 50, cd: 8}, {s: 0, t: "enemyDebuff", who: "enemy", dur: 1, cd: 8, note: "crit chance down, heal block"}, {s: 1, t: "curse", who: "enemy", dur: 3, cd: 8, n: 2000, note: "Curse on all enemies for 3 turns, curse damage +2,000"}, {s: 1, t: "enemyDebuff", who: "enemy", dur: 1, cd: 8, note: "60% Stun"}, {s: 2, t: "heal", who: "party", cd: 4}, {s: 2, t: "np", who: "party", n: 10, cd: 4}, {s: "p", t: "dmgcut", who: "self", note: "takes 500 less damage"}, {s: "p", t: "npTurn", who: "self", n: 5}],
  "miyamoto-musashi": [{s: 2, t: "invuln", who: "self", dur: 1, cd: 8}],
  "mysterious-heroine-x-alter": [{s: 0, t: "heal", who: "self", cd: 7}, {s: 0, t: "regen", who: "self", dur: 3, cd: 7}],
  "nitocris-alter": [{s: 0, t: "regen", who: "self", dur: 3, cd: 8}, {s: 1, t: "np", who: "self", n: 100, cd: 9, note: "50–100%"}, {s: 2, t: "evade", who: "party", dur: 3, cd: 7, cond: "align:Good", note: "60% chance, Good allies"}, {s: 2, t: "debuffImm", who: "party", dur: 3, cd: 7, cond: "align:Good"}, {s: "p", t: "npTurn", who: "self", n: 3.5}],
  "oberon": [{s: 0, t: "np", who: "party", n: 20, cd: 7}, {s: 1, t: "np", who: "ally", n: 50, cd: 8}, {s: 2, t: "taunt", who: "ally", dur: 3, cd: 10, note: "after Eternal Sleep (demerit)"}, {s: "np", t: "enemyDebuff", who: "enemy", dur: 1, note: "Sleep"}, {s: "p", t: "debuffUp", who: "party", note: "Debuff success +10%"}],
  "oda-nobunaga": [{s: 1, t: "invuln", who: "self", dur: 1, cd: 8}, {s: 2, t: "npTurn", who: "self", n: 20, dur: 3, cd: 7}, {s: "np", t: "burn", who: "enemy", dur: 5, n: 1000, note: "Burn on all enemies, 1,000 a turn for 5 turns"}, {s: "p", t: "npTurn", who: "self", n: 3.3}],
  "osakabehime": [{s: 0, t: "defup", who: "self", dur: 3, cd: 7}, {s: 1, t: "np", who: "ally", n: 20, cd: 7}, {s: 2, t: "enemyDebuff", who: "enemy", dur: 1, cd: 7, note: "DEF down and buff removal"}, {s: "np", t: "defup", who: "party", dur: 3}],
  "queen-medb": [{s: 0, t: "debuffImm", who: "self", dur: 3, cd: 8}, {s: 0, t: "regen", who: "self", dur: 3, cd: 8}, {s: 0, t: "npTurn", who: "self", n: 10, dur: 3, cd: 8}, {s: 0, t: "np", who: "party", n: 30, cd: 8, cond: "trait:Male|trait:Fae", note: "Male or Fae allies"}, {s: 1, t: "heal", who: "self", cd: 7}, {s: 2, t: "enemyDebuff", who: "enemy", dur: 1, cd: 9, note: "Charm (Male), DEF down"}],
  "salter-rider": [{s: 1, t: "cdr", who: "ally", n: 1, cd: 8}],
  "space-ereshkigal": [{s: 0, t: "np", who: "party", n: 20, cd: 8}, {s: 1, t: "np", who: "self", n: 50, cd: 9}, {s: 2, t: "invuln", who: "self", dur: 3, cd: 9, note: "2 attacks"}, {s: 2, t: "guts", who: "self", dur: 3, cd: 9}, {s: 2, t: "heal", who: "self", cd: 9}, {s: 2, t: "cdr", who: "self", n: 2, cd: 9}, {s: "p", t: "debuffImm", who: "self", note: "3 times"}],
  "space-ishtar": [{s: 1, t: "invuln", who: "self", dur: 3, cd: 7, note: "1 attack"}, {s: 2, t: "np", who: "self", n: 50, cd: 8}, {s: "p", t: "npTurn", who: "self", n: 3.5}],
  "tamamo-no-mae": [{s: 0, t: "enemyDebuff", who: "enemy", cd: 7, note: "NP gauge −1"}, {s: 1, t: "defup", who: "self", dur: 3, cd: 7}, {s: 2, t: "heal", who: "ally", cd: 7}, {s: "np", t: "cdr", who: "party", n: 1}, {s: "np", t: "heal", who: "party"}]
};
const normName = (n) => String(n || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
const DEFAULT_BY_NAME = {};
Object.keys(TRAIT_DEFAULTS).forEach((id) => { DEFAULT_BY_NAME[normName(id)] = id; });
function defaultKey(s) { if (!s) return null; if (TRAIT_DEFAULTS[s.id] || KIT_DEFAULTS[s.id]) return s.id; return DEFAULT_BY_NAME[normName(s.id)] || DEFAULT_BY_NAME[normName(s.name)] || null; }

