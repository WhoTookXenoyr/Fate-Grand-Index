"""Builds src/data/atlas_data.js (compact NA servant and Craft Essence catalog) from the Atlas Academy NA exports.

    python3 tools/gen_atlas.py

Reads data/atlas/servants.json and data/atlas/ces.json (or the .json.gz copies kept in the repo):
the Atlas Academy "nice" NA exports of servants and Craft Essences, in English.
Run python3 tools/build.py afterwards to put the new data into the page.
"""
import gzip, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLAS = os.path.join(ROOT, "data", "atlas")
_open = lambda p: open(p, encoding="utf-8") if os.path.exists(p) else gzip.open(p + ".gz", "rt", encoding="utf-8")
S = json.load(_open(os.path.join(ATLAS, "servants.json")))
C = json.load(_open(os.path.join(ATLAS, "ces.json")))
BASE = "https://static.atlasacademy.io/NA/"
def p(url): return url[len(BASE):] if url and url.startswith(BASE) else url

CLS = {"saber": "Saber", "archer": "Archer", "lancer": "Lancer", "rider": "Rider", "caster": "Caster", "assassin": "Assassin", "berserker": "Berserker",
       "shielder": "Shielder", "ruler": "Ruler", "avenger": "Avenger", "moonCancer": "Moon Cancer", "alterEgo": "Alter Ego", "foreigner": "Foreigner",
       "pretender": "Pretender", "beast": "Beast", "beastEresh": "Beast"}
ATTR = {"human": "Man", "earth": "Earth", "sky": "Sky", "star": "Star", "beast": "Beast"}
CARD = {"1": "A", "2": "B", "3": "Q", "arts": "A", "buster": "B", "quick": "Q"}
CARDN = {"A": "Arts", "B": "Buster", "Q": "Quick"}
TRAIT = {"genderMale": "Male", "genderFemale": "Female", "humanoid": "Humanoid", "hominidaeServant": "Hominidae Servant", "divine": "Divine", "divineSpirit": "Divine Spirit",
         "dragon": "Dragon", "king": "King", "riding": "Riding", "arthur": "Arthur", "saberface": "Artoria Face", "knightsOfTheRound": "Round Table Knight", "roman": "Roman",
         "greekMythologyMales": "Greek Mythology Male", "fae": "Fae", "threatToHumanity": "Threat to Humanity", "demonic": "Demonic", "demonicBeastServant": "Demonic Beast Servant",
         "oni": "Oni", "wildbeast": "Wild Beast", "havingAnimalsCharacteristics": "Animal Characteristics Servant", "giant": "Giant", "superGiant": "Super Large",
         "mechanical": "Mechanical", "levitating": "Levitating Servant", "livingHuman": "Living Human", "childServant": "Children Servants",
         "summerModeServant": "Summer Mode Servant", "brynhildsBeloved": "Brynhildr's Beloved", "weakToEnumaElish": "Weak to Enuma Elish",
         "feminineLookingServant": "Feminine Looking", "hasGoddessMetamorphosis": "Goddess Servant", "existenceOutsideTheDomain": "Existence Outside the Domain",
         "genji": "Genji", "associatedToTheArgo": "Argonaut", "lamia": "Lamia", "fairyTaleServant": "Fairy Tale Servant", "valkyrie": "Valkyrie", "shinsengumiServant": "Shinsengumi",
         "groupServant": "Group Servant", "canFlyInSpace": "Can Fly in Space", "illya": "Illya", "nobunaga": "Nobunaga", "sakuraSeries": "Sakura Series", "FSNServant": "FSN Servant",
         "demonBeast": "Demonic Beast", "dragonSlayer": "Dragon Slayer", "moon": "Moon", "bunnyServant": "Bunny", "yuMeiren": "Yu Meiren", "shuten": "Shuten", "ryozanpaku": "Ryozanpaku",
         "genderUnknown": None, "standardClassServant": "Seven Knights Servant"}
ORD = {"alignmentLawful": "Lawful", "alignmentNeutral": "Neutral", "alignmentChaotic": "Chaotic"}
MOR = {"alignmentGood": "Good", "alignmentBalanced": "Balanced", "alignmentEvil": "Evil", "alignmentSummer": "Summer", "alignmentMadness": "Madness", "alignmentBride": "Bride"}
# NA gives a few servants the same name as another one of the same class (or a name the game shows differently)
NAME_FIX = {417: "Space Ereshkigal", 220: "BB (Summer)", 424: "Kishinami Hakuno (Male)", 425: "Kishinami Hakuno (Female)"}
# the game shows Nero (Bride) as Chaotic Bride, but there is no trait for "Bride" in the data
MORAL_FIX = {90: ["Bride"]}
def all_traits(x):
    # traits that change with ascension (Kuonji Alice, Aesc, Hibiki & Chikagi...) only appear per ascension, so all ascensions count
    tr = [t["name"] for t in x["traits"]]
    asc = ((x.get("ascensionAdd") or {}).get("individuality") or {}).get("ascension") or {}
    for k in sorted(asc, key=int):
        if int(k) <= 4:
            for t in asc[k]:
                if t["name"] not in tr: tr.append(t["name"])
    return tr

def clean(t):
    t = (t or "").replace("\u3000", " ")
    t = re.sub(r"\s*▲", "", t)
    t = re.sub(r"\[/?[a-z]\]", "", t)
    t = re.sub(r"\s+\)", ")", t)
    return re.sub(r"\s+", " ", t).strip()
VERB = r"(?:increase|decrease|apply|inflict|gain|restore|remove|deal|grant|reduce|charge|recover|chance|low chance|high chance|normal chance|change|drain|absorb|nullify|seal|lose|activate|cure|prevent|reveal|turn|extend|shorten|cause|transform|summon|convert|sacrifice|greatly|slightly|significantly|considerably|massively|moderately|tremendously|immensely|consume|set|grants?|heal|revive|draw|swap|copy|reset|deplete|spend|place|make|become|tremendous|absorbs?)"
TGT = re.compile(r"\b(?:to|for|on) (?:yourself|your|all|one|a single|a|an|each|every|other|allies|enemies|party)\b", re.I)
def mask(t):
    # & and + inside "quotes", <notes> and [names] belong to that phrase, so they are hidden while splitting
    out, depth, q = [], 0, False
    for ch in t:
        if ch == '"': q = not q
        elif ch in "<[(": depth += 1
        elif ch in ">])": depth = max(0, depth - 1)
        out.append({"&": "\x01", "+": "\x02"}.get(ch, ch) if (q or depth) else ch)
    return "".join(out)
unmask = lambda t: t.replace("\x01", "&").replace("\x02", "+")
class Suf:
    def __init__(self, start, text): self._s, self._t = start, text
    def start(self): return self._s
    def group(self, i): return self._t
def blank(t):
    out, depth, q = [], 0, False
    for ch in t:
        inside = q or depth
        if ch == '"': q = not q
        elif ch in "<[(": depth += 1
        elif ch in ">])": depth = max(0, depth - 1)
        out.append("\x03" if (inside or ch in '"<[(') else ch)
    return "".join(out)
def suffix_at(g):
    # the target phrase at the end ("for yourself", "to all enemies"), never one inside quotes or brackets
    bl, best = blank(g), None
    for m in re.finditer(r"\s(?:for|to|on) (?:yourself|your|all|one|a single|a|an|each|the|every|other|allies|enemies|party)\b", bl, re.I):
        best = m
    if not best: return None
    return Suf(best.start(), g[best.start() + 1:])
def lines(detail, np=False):
    d = mask(clean(detail))
    if not d: return ([], []) if np else []
    out, oc = [], []
    for g in re.split(r"\s\+\s", d):
        g = g.strip()
        if not g: continue
        m = suffix_at(g); suf = ""
        if m and "&" in g[:m.start()]: suf, g = m.group(1).strip(), g[:m.start()].strip()
        parts = re.split(r"\s&\s(?=" + VERB + r"\b)", g, flags=re.I)
        for x in parts:
            x = unmask(x.strip(" &"))
            if not x: continue
            line = x + (" " + unmask(suf) if suf and not TGT.search(re.sub(r'"[^"]*"|<[^>]*>|\[[^\]]*\]', "", x)) else "")
            line = line[0].upper() + line[1:]
            is_oc = re.search(r"<[^>]*overcharge[^>]*>", line, re.I)
            line = re.sub(r"\s*<[^>]*(?:increases|grows) with overcharge[^>]*>", "", line, flags=re.I).strip()
            (oc if np and is_oc else out).append(line)
    return (out, oc) if np else out

# ---------- numbers ----------
RAW_BUFF = {"regainHp", "addMaxhp", "subMaxhp", "reduceHp", "upFuncHpReduce", "downFuncHpReduce", "subSelfdamage", "addDamage", "addSelfdamage", "guts", "regainStar",
            "upChagetd", "multiattack", "changeCommandCardType", "gutsBeforeFunction"}
NP100_BUFF = {"regainNp"}
SKIP_BUFF = {"addIndividuality", "fieldIndividuality", "upHate", "upHateToGrantState", "subIndividuality", "overwriteClassRelation", "tdTypeChange", "tdTypeChangeArts", "tdTypeChangeBuster", "tdTypeChangeQuick"}
NP100_FUNC = {"gainNp", "lossNp", "gainNpBuffIndividualSum", "gainNpIndividualSum", "gainNpFromTargets", "gainMultiplyNp", "lossMultiplyNp"}
RAW_FUNC = {"gainStar", "lossStar", "gainHp", "lossHp", "lossHpSafe", "delayNpturn", "shortenSkill", "extendSkill", "gainHpFromTargets", "absorbNpturn"}
LABEL = {"gainNp": "NP Charge", "lossNp": "NP Drain", "gainStar": "C. Stars", "lossStar": "C. Stars lost", "gainHp": "HP Recovery", "gainHpPer": "HP Recovery", "lossHp": "HP Loss", "lossHpSafe": "HP Loss",
         "hastenNpturn": "Charge", "delayNpturn": "Charge drain", "shortenSkill": "Cooldown", "instantDeath": "Death chance", "gainNpBuffIndividualSum": "NP Charge", "gainNpIndividualSum": "NP Charge"}
BLABEL = {"regainNp": "NP per turn", "regainStar": "C. Stars per turn", "regainHp": "HP per turn", "guts": "Guts HP", "upChagetd": "Overcharge", "multiattack": "Hit count", "reduceHp": None}
def unit_of(f):
    ft, b = f["funcType"], (f["buffs"][0]["type"] if f["buffs"] else "")
    if ft.startswith("damageNp"): return "dmg", 10, "%"
    if b in SKIP_BUFF or b.endswith("Function") or b in ("delayFunction", "damageFunction", "deadFunction", "selfturnendFunction", "attackAfterFunction", "attackBeforeFunction", "commandattackAfterFunction", "commandattackBeforeFunction", "gutsFunction", "entryFunction", "commandattackAfterFunctionMainOnly"):
        return None, 0, ""
    if b:
        if b in RAW_BUFF:
            u = "stars" if b == "regainStar" else ("" if b in ("upChagetd", "multiattack", "changeCommandCardType") else "HP" if b in ("regainHp", "addMaxhp", "subMaxhp", "guts") else "damage")
            return "v", 1, u
        if b in NP100_BUFF: return "v", 100, "%"
        if b == "gutsRatio": return "v", 10, "%"
        return "v", 10, "%"
    if ft in NP100_FUNC: return "v", 100, "%"
    if ft in RAW_FUNC: return "v", 1, ("stars" if "Star" in ft else "HP" if "Hp" in ft else "")
    if ft == "gainHpPer": return "v", 10, "%"
    if ft == "instantDeath": return "rate", 10, "%"
    if ft == "hastenNpturn": return None, 0, ""
    return None, 0, ""
def label_of(f):
    ft, b = f["funcType"], (f["buffs"][0] if f["buffs"] else None)
    if b and BLABEL.get(b["type"]): return BLABEL[b["type"]]
    t = (f.get("funcPopupText") or "").replace("\n", " ").strip()
    if ft in LABEL: return LABEL[ft]
    if t and t != "None": return re.sub(r"\s+", " ", t)
    if b: return b["name"]
    return ft
def num(v, div):
    x = v / div
    return int(x) if abs(x - round(x)) < 1e-9 else round(x, 2)
def skill_vals(k):
    rows, seen = [], set()
    for f in k["functions"]:
        sv = f.get("svals") or []
        if len(sv) < 10: continue
        kind, div, unit = unit_of(f)
        if not kind: continue
        key = "Rate" if kind == "rate" else "Value"
        a, b = sv[0].get(key), sv[9].get(key)
        if a is None or b is None or (a == 0 and b == 0): continue
        lab = label_of(f)
        if kind == "v" and sv[0].get("Rate", 1000) < 1000 and sv[0].get("Rate") == sv[9].get("Rate") and sv[0].get("Rate", 0) > 0:
            lab += f" ({num(sv[0]['Rate'], 10)}% chance)"
        if kind == "v" and sv[0].get("Rate") != sv[9].get("Rate") and sv[0].get("Value") == sv[9].get("Value"):
            ra, rb = sv[0].get("Rate"), sv[9].get("Rate")
            if ra and rb: rows.append([lab + " chance", num(ra, 10), num(rb, 10), "%"])
        sig = (lab, a, b)
        if sig in seen: continue
        seen.add(sig)
        rows.append([lab, num(a, div), num(b, div), unit])
    return rows[:6]
# 0.24.0: what a skill does to NP damage, for the damage calculator's supports: [kind, target, cards, 10 values, (whose
# traits it needs)]. Kinds: a ATK, c card, n NP Strength, p special attack, d enemy DEF down, r enemy card resistance
# down, f Damage Plus. Targets: s self, o one ally, a all allies, x allies but the user, e the enemy. Cards: "" (all) or
# some of "QAB". The trait it needs: "@Sky" an attribute, "#Saber" a class, "%Female" a gender, "&Evil" an alignment, else the trait's name;
# "+" in front: the attacker needs it (who the skill picks among your allies), "-": the enemy does; "?hp", "?pick",
# "?field", "?stack", "?cond": it only works some of the time (low HP, a choice, some quests, stacking, a condition).
BUFF_K = {"upAtk": "a", "upCommandall": "c", "upNpdamage": "n", "upDamage": "p", "upDamageIndividuality": "p", "downDefence": "d", "downDefencecommandall": "r", "addDamage": "f"}
TGT_K = {"self": "s", "ptOne": "o", "ptAll": "a", "ptFull": "a", "ptOther": "x", "ptOtherFull": "x", "ptOneOther": "x", "enemy": "e", "enemyAll": "e", "enemyFull": "e"}
CARD_T = {"cardQuick": "Q", "cardArts": "A", "cardBuster": "B"}
CLS_T = {"class" + k[:1].upper() + k[1:]: v for k, v in CLS.items()}
def trait_key(name):
    if name.startswith("attribute"): return "@" + ATTR.get(name[9:].lower(), name[9:])
    if name in CLS_T: return "#" + CLS_T[name]
    if name.startswith("gender"): return "%" + name[6:]
    if name in ORD or name in MOR: return "&" + (ORD.get(name) or MOR.get(name))
    return TRAIT.get(name) or re.sub(r"([a-z])([A-Z])", r"\1 \2", name).capitalize()
def skill_buffs(k):
    out = []
    for f in k["functions"]:
        if not f.get("buffs"): continue
        b, g = f["buffs"][0], TGT_K.get(f["funcTargetType"])
        kk = BUFF_K.get(b["type"])
        if not kk or not g: continue
        # DEF down on your own side is a drawback, and buffs only count on your side
        if (kk in "dr") != (g == "e"): continue
        sv = f.get("svals") or []
        if len(sv) < 10: continue
        vals = [num(s.get("Value") or 0, 1 if kk == "f" else 10) for s in sv[:10]]
        if not any(vals): continue
        ind = [t["name"] for t in (b.get("ckSelfIndv") or []) + (b.get("ckOpIndv") or [])]
        cards = "".join(c for c in "QAB" if any(CARD_T.get(t) == c for t in ind))
        row = [kk, g, cards, vals]
        need = [("+" + trait_key(t["name"])) for t in (f.get("functvals") or []) if t.get("name") and t["name"] not in CARD_T]
        need += [("-" + trait_key(t["name"])) for t in (b.get("ckOpIndv") or []) if t.get("name") and t["name"] not in CARD_T]
        # parts that only work some of the time ("?"): with low HP, one of a choice, on some quests, stacking, or a
        # condition on the holder; the calculator doesn't count these on its own
        sc, s0 = b.get("script") or {}, sv[0]
        if "HP_LOWER" in sc or "HP_HIGHER" in sc or any(k.startswith("RatioHP") for k in s0): need = ["?hp"]
        elif "ActSelectIndex" in s0 or "ActSet" in s0: need = ["?pick"]
        elif f.get("funcquestTvals"): need = ["?field"]
        elif any(k.startswith("ParamAdd") for k in s0): need = ["?stack"]
        elif "INDIVIDUALITIE" in sc or "checkIndvType" in sc: need = ["?cond"]
        if need: row.append(need[0])
        out.append(row)
    return out
def pick(items, key="num"):
    best = {}
    for k in items:
        n = k[key]
        if n not in best or k.get("priority", 0) > best[n].get("priority", 0): best[n] = k
    return [best[n] for n in sorted(best)]
def np_table(n):
    fs = n["functions"]
    rows, ocr = [], []
    for f in fs:
        kind, div, unit = unit_of(f)
        sv = f.get("svals") or []
        if len(sv) < 5: continue
        ocs = [(f.get("svals" + (str(i) if i > 1 else "")) or [{}])[0] for i in range(1, 6)]
        key = "Rate" if kind == "rate" else "Value"
        if kind:
            lv = [x.get(key) for x in sv[:5]]
            oc = [o.get(key) for o in ocs]
            fmt = (lambda v: f"{num(v, div)}%" if unit == "%" else f"{num(v, div)}" + (f" {unit}" if unit else ""))
            lab = "Damage" if kind == "dmg" else label_of(f)
            lv_ok = all(v is not None for v in lv) and not all(v == 0 for v in lv)
            oc_ok = all(v is not None for v in oc) and len(set(oc)) > 1
            if lv_ok and len(set(lv)) > 1: rows.append([lab, [fmt(v) for v in lv]])
            elif oc_ok:
                # damage that only Overcharge adds (Arash's Stella) reads as extra damage on top
                if kind == "dmg" and all(v == 0 for v in lv): ocr.append(["Extra damage", ["+" + fmt(v) for v in oc]])
                else: ocr.append([lab, [fmt(v) for v in oc]])
            elif lv_ok: rows.append([lab, [fmt(v) for v in lv]])
            # special damage multipliers grow with Overcharge
            if kind == "dmg":
                corr = [o.get("Correction") for o in ocs]
                if all(c is not None for c in corr) and len(set(corr)) > 1: ocr.append(["Special damage", [f"{num(c, 10)}%" for c in corr]])
        # the chance to land a debuff (Stun, Charm, Burn...) can grow with NP level or Overcharge
        if key != "Rate" and f.get("buffs"):
            nm = (f["buffs"][0].get("name") or "").strip()
            if nm and f["funcType"].startswith("addState"):
                rl, ro = [x.get("Rate") for x in sv[:5]], [o.get("Rate") for o in ocs]
                if all(v is not None for v in rl) and len(set(rl)) > 1: rows.append([nm + " chance", [f"{num(v, 10)}%" for v in rl]])
                elif all(v is not None for v in ro) and len(set(ro)) > 1: ocr.append([nm + " chance", [f"{num(v, 10)}%" for v in ro]])
                cnt, ur = [o.get("Count") for o in ocs], [o.get("UseRate") for o in ocs]
                if all(v is not None and v > 0 for v in cnt) and len(set(cnt)) > 1: ocr.append([nm + " (times)", [str(v) for v in cnt]])
                if all(v is not None for v in ur) and len(set(ur)) > 1: ocr.append([nm + " trigger chance", [f"{num(v, 10)}%" for v in ur]])
        # Charge decrease and similar effects without a buff: only their chance grows with Overcharge
        if not f.get("buffs") and key != "Rate" and kind != "dmg":
            ro = [o.get("Rate") for o in ocs]
            if all(v is not None for v in ro) and len(set(ro)) > 1 and f["funcType"] != "displayBuffstring":
                lab2 = "Charge decrease chance" if f["funcType"] in ("lossNp", "delayNpturn") else label_of(f) + " chance"
                ocr.append([lab2, [f"{num(v, 10)}%" for v in ro]])
        # damage that grows as your HP drops: Overcharge raises the most it can add
        if f["funcType"] == "damageNpHpratioLow":
            tg = [o.get("Target") for o in ocs]
            if all(v is not None for v in tg) and len(set(tg)) > 1: ocr.append(["Low-HP bonus (max)", [f"+{num(v, 10)}%" for v in tg]])
    dedup = lambda rr: [r for i, r in enumerate(rr) if r not in rr[:i]]
    return dedup(rows)[:6], dedup(ocr)[:4]
def target(n):
    fl = n.get("effectFlags") or []
    return "AoE" if "attackEnemyAll" in fl else "Single Target" if "attackEnemyOne" in fl else "Support"

def icon_key(u):
    m = re.search(r"/(BuffIcons/bufficon_|SkillIcons/skill_)(\w+)\.png$", u or "")
    return ("B:" if m.group(1).startswith("Buff") else "K:") + m.group(2) if m else ""
# every skill and buff icon in both files, named after the effect it shows most often
import collections
ICN = collections.defaultdict(collections.Counter)
def walk_icons(k):
    names = []
    for f in k.get("functions", []):
        for b in f.get("buffs", []):
            if b.get("icon"): ICN[icon_key(b["icon"])][b.get("name", "").strip()] += 1
            names.append(b.get("name", "").strip())
        if f.get("funcPopupIcon"): ICN[icon_key(f["funcPopupIcon"])][(f.get("funcPopupText") or "").replace("\n", " ").strip()] += 1
        if not f.get("buffs"): names.append((f.get("funcPopupText") or "").replace("\n", " ").strip())
    if k.get("icon"):
        for n in names[:1] or [k.get("name", "")]: ICN[icon_key(k["icon"])][n] += 1
for x in S:
    for k in x["skills"] + x.get("classPassive", []) + x.get("extraPassive", []): walk_icons(k)
    for n in x["noblePhantasms"]:
        for f in n.get("functions", []):
            for b in f.get("buffs", []):
                if b.get("icon"): ICN[icon_key(b["icon"])][b.get("name", "").strip()] += 1
for c in C:
    for k in c["skills"]: walk_icons(k)
def walk_any(o):
    # anything else that carries a skill or buff icon (append passives, NP popups and so on)
    if isinstance(o, dict):
        for kk in ("icon", "funcPopupIcon"):
            v = o.get(kk)
            if isinstance(v, str) and ("BuffIcons" in v or "SkillIcons" in v):
                key = icon_key(v); nm = (o.get("funcPopupText") if kk == "funcPopupIcon" else o.get("name")) or ""
                if key and not ICN[key]: ICN[key][str(nm).replace("\n", " ").strip()] += 1
        for v in o.values(): walk_any(v)
    elif isinstance(o, list):
        for v in o: walk_any(v)
walk_any(S); walk_any(C)
icons = []
for key, cnt in ICN.items():
    if not key: continue
    names = [n for n, _ in cnt.most_common() if n and n != "None"]
    if not names: names = ["Skill icon" if key.startswith("K:") else "Buff icon"]
    icons.append([key, names[0], " ".join(dict.fromkeys(names[1:8]))])
icons.sort(key=lambda r: (r[0][0] != "B", int(re.sub(r"\D", "", r[0]) or 0)))

out = []
# ascension and skill materials (0.22.0, for the event shop calculator): items get a number in ATLAS_MATS, and each
# servant lists, per ascension (4) and per skill level-up (9), the flat pairs [material number, amount, ...]
MATS = {}
APPENDS, APPEND_IX = [], {}
def mats(levels):
    rows = []
    for lv in levels:
        row = []
        for it in (lv or {}).get("items", []):
            i = it["item"]
            if i["id"] not in MATS: MATS[i["id"]] = [i["id"], i["name"], p(i.get("icon", ""))]
            row += [i["id"], it["amount"]]
        rows.append(row)
    return rows
import collections as _co
_eg = _co.Counter(json.dumps(x.get("expGrowth") or []) for x in S if x["type"] in ("normal", "heroine") and x["collectionNo"])
EXPS = [json.loads(_eg.most_common(1)[0][0])]; EXP_IX = {_eg.most_common(1)[0][0]: 0}
for x in S:
    if x["type"] not in ("normal", "heroine") or x["className"] not in CLS or not x["collectionNo"]: continue
    tr = all_traits(x)
    traits = []
    for t in tr:
        v = TRAIT.get(t)
        if v and v not in traits: traits.append(v)
    # the game marks Hominidae Servants; everyone else is Non-Hominidae (Larva/Tiamat as much as Space Ishtar)
    if "hominidaeServant" not in tr: traits.append("Non-Hominidae Servant")
    g = "Male" if "genderMale" in tr else "Female" if "genderFemale" in tr else "Unknown"
    hg, ag = x["hpGrowth"], x["atkGrowth"]
    at = lambda arr, lv: arr[lv - 1] if len(arr) >= lv else None
    sk = []
    one = lambda k: {"n": k["name"], "e": lines(k["detail"]), "cd": (k.get("coolDown") or [None])[0], "v": skill_vals(k), "ic": icon_key(k.get("icon"))}
    slots = [k for k in x["skills"] if k["num"] in (1, 2, 3)]
    for k in pick(slots):
        o = one(k); o["up"] = 1 if k.get("strengthStatus") == 99 else 0
        bf = skill_buffs(k)
        if bf: o["b"] = bf
        # skills a Rank Up quest, an interlude or the story upgrades: every version, oldest first ("u" holds the ones before this)
        same = [c for c in slots if c["num"] == k["num"]]
        chain = sorted(same, key=lambda c: c.get("priority", 0)) if any(c.get("strengthStatus") in (1, 2, 99) or c.get("condQuestId") for c in same) else []
        if len(chain) > 1 and chain[-1]["id"] == k["id"]: o["u"] = [one(c) for c in chain[:-1]]
        sk.append(o)
    ps = [{"n": c["name"], "e": lines(c["detail"]), "ic": icon_key(c.get("icon"))} for c in x["classPassive"] if c.get("name")]
    nps = [n for n in x["noblePhantasms"] if n.get("functions")]
    npo = None
    def np_obj(n):
        e, oc = lines(n["detail"], True)
        rows, ocr = np_table(n)
        dist = n.get("npDistribution") or []
        return {"n": n["name"], "k": n.get("rank", ""), "ty": n.get("type", ""), "cd": CARD.get(str(n["card"]), ""), "tg": target(n), "h": len(dist),
                "ph": ", ".join(f"{v}%" for v in dist), "e": e, "oc": oc, "r": rows, "o": ocr, "ru": (n.get("ruby") or "").strip(), "up": 1 if n.get("strengthStatus") == 99 else 0}
    if nps:
        main = [n for n in nps if n.get("npNum", 1) in (1, 2)]
        n = max(main or nps, key=lambda n: (n.get("priority", 0), n["id"]))
        npo = np_obj(n)
        # an NP that a Rank Up quest, an interlude or the story upgrades: every version, oldest first (hidden "???" names and repeats left out)
        same = [v for v in nps if v.get("npNum", 1) == n.get("npNum", 1) and v["name"].strip() != "???"]
        if any(v.get("strengthStatus") in (1, 2, 99) or (v.get("condQuestId") or 0) >= 90000000 for v in same):
            best = {}
            for v in same:
                k = (v["name"], v.get("rank", ""), v.get("strengthStatus") == 99, (v.get("condQuestId") or 0) >= 90000000)
                if k not in best or (v.get("priority", 0), v["id"]) > (best[k].get("priority", 0), best[k]["id"]): best[k] = v
            chain = sorted(best.values(), key=lambda v: (v.get("priority", 0), v["id"]))
            if len(chain) > 1 and chain[-1]["id"] == n["id"]: npo["u"] = [np_obj(v) for v in chain[:-1]]
    ea = x["extraAssets"]
    cg = ea.get("charaGraph", {}) or {}
    asc = cg.get("ascension", {}) or {}
    cos = cg.get("costume", {}) or {}
    face = ((ea.get("faces", {}) or {}).get("ascension", {}) or {})
    rec = {"no": x["collectionNo"], "id": x["id"], "n": NAME_FIX.get(x["collectionNo"], x["name"]), "c": CLS[x["className"]], "r": x["rarity"], "a": ATTR.get(x["attribute"], ""), "g": g,
           "o": [v for k, v in ORD.items() if k in tr], "m": MORAL_FIX.get(x["collectionNo"]) or [v for k, v in MOR.items() if k in tr], "t": traits,
           "d": "".join(CARD.get(str(c), "?") for c in x["cards"]), "lv": x["lvMax"],
           "hp": [x["hpBase"], x["hpMax"], at(hg, 100), at(hg, 120)], "atk": [x["atkBase"], x["atkMax"], at(ag, 100), at(ag, 120)],
           "sk": sk, "ps": ps, "np": npo,
           "im": [p(asc[k]) for k in sorted(asc, key=int)], "cs": [p(cos[k]) for k in sorted(cos, key=int)],
           "f": p(face.get("1") or next(iter(face.values()), "")), "sa": x.get("starAbsorb"), "sg": x.get("starGen"), "dt": x.get("instantDeathChance"), "gc": x.get("growthCurve")}
    if x["type"] == "heroine": rec["h"] = 1
    am, sm = x.get("ascensionMaterials") or {}, x.get("skillMaterials") or {}
    rec["ma"] = mats([am.get(str(k)) for k in range(4)]); rec["ms"] = mats([sm.get(str(k)) for k in range(1, 10)])
    # 0.24.0: QP per ascension and skill level, append skills (the same few for everyone, kept once in ATLAS_APPENDS), their
    # materials and QP, and the servant's coins (how many a summon gives, and the coin's picture)
    pm = x.get("appendSkillMaterials") or {}
    rec["mp"] = mats([pm.get(str(k)) for k in range(1, 10)])
    rec["qa"] = [(am.get(str(k)) or {}).get("qp", 0) for k in range(4)]
    rec["qs"] = [(sm.get(str(k)) or {}).get("qp", 0) for k in range(1, 10)]
    rec["qp"] = [(pm.get(str(k)) or {}).get("qp", 0) for k in range(1, 10)]
    aps = []
    for a in sorted(x.get("appendPassive") or [], key=lambda a: a.get("num", 0)):
        o = one(a["skill"]); o.pop("cd", None)
        key = json.dumps(o, sort_keys=True, ensure_ascii=False)
        if key not in APPEND_IX: APPEND_IX[key] = len(APPENDS); APPENDS.append(o)
        aps.append(APPEND_IX[key])
    rec["ap"] = aps
    coin = x.get("coin") or {}
    if coin.get("item"): rec["cn"] = coin.get("summonNum", 0); rec["ci"] = p(coin["item"].get("icon", ""))
    # what the class passives add to damage for yourself, always on: Buster, Arts and Quick up (%), NP Strength up (%)
    # and Damage Plus (flat), for the NP damage calculator
    pm = [0, 0, 0, 0, 0]
    for c in x["classPassive"]:
        for fn in c.get("functions") or []:
            if fn.get("funcTargetType") != "self" or not fn.get("buffs") or not fn.get("svals"): continue
            b, v = fn["buffs"][0], fn["svals"][0].get("Value", 0)
            if b.get("ckOpIndv"): continue
            if b["type"] == "upCommandall":
                for tr in b.get("ckSelfIndv") or []:
                    k = {4002: 0, 4001: 1, 4003: 2}.get(tr["id"])
                    if k is not None: pm[k] += v / 10
            elif b["type"] == "upNpdamage" and not b.get("ckSelfIndv"): pm[3] += v / 10
            elif b["type"] == "addDamage" and not b.get("ckSelfIndv"): pm[4] += v
    if any(pm): rec["pm"] = [int(v) if float(v).is_integer() else v for v in pm]
    # EXP to reach each level (nearly everyone shares one table; the few others are kept once in ATLAS_EXP)
    eg = x.get("expGrowth") or []
    if eg:
        key = json.dumps(eg)
        if key not in EXP_IX: EXP_IX[key] = len(EXPS); EXPS.append(eg)
        if EXP_IX[key]: rec["xg"] = EXP_IX[key]
    out.append(rec)
out.sort(key=lambda r: r["no"])
MAT_LIST = sorted(MATS.values(), key=lambda m: m[0]); MAT_IX = {m[0]: k for k, m in enumerate(MAT_LIST)}
for r in out:
    for key in ("ma", "ms", "mp"): r[key] = [[MAT_IX[v] if k % 2 == 0 else v for k, v in enumerate(row)] for row in r[key]]

FLAG = {"normal": "N", "svtEquipEvent": "E", "svtEquipEventReward": "R", "svtEquipFriendShip": "B", "svtEquipChocolate": "V", "svtEquipCampaign": "C", "svtEquipExp": "X", "svtEquipManaExchange": "M", "unknown": "U"}
id2no = {x["id"]: x["collectionNo"] for x in S}
ces = []
for c in C:
    if not c.get("collectionNo"): continue
    sks = sorted(c["skills"], key=lambda k: (k["num"], k.get("priority", 0)))
    base = [k for k in sks if k.get("condLimitCount", 0) == 0]
    mx = [k for k in sks if k.get("condLimitCount", 0) == 4]
    by = lambda arr: [clean(k["detail"]) for k in pick(arr)]
    eb, em = by(base), by(mx)
    cg = ((c["extraAssets"].get("charaGraph") or {}).get("equip") or {})
    fc = ((c["extraAssets"].get("faces") or {}).get("equip") or {})
    rec = {"no": c["collectionNo"], "n": c["name"], "r": c["rarity"], "f": FLAG.get(c["flag"], "U"), "e": eb,
           "hp": [c["hpBase"], c["hpMax"]], "atk": [c["atkBase"], c["atkMax"]], "im": p(next(iter(cg.values()), "")), "fc": p(next(iter(fc.values()), ""))}
    if em and em != eb: rec["x"] = em
    if c.get("bondEquipOwner"): rec["b"] = id2no.get(c["bondEquipOwner"])
    ces.append(rec)
ces.sort(key=lambda r: r["no"])
# HP and ATK at any level follow one of a few shared curves: stat = base + floor((max - base) * curve[lv] / 1000)
CURVES = {}
for x in S:
    if not x["collectionNo"] or x["type"] not in ("normal", "heroine"): continue
    c, a = x.get("growthCurve"), x["atkGrowth"]
    if c in CURVES and len(CURVES[c]) >= len(a): continue
    if x["atkMax"] == x["atkBase"]: continue
    CURVES[c] = [round((v - x["atkBase"]) * 1000 / (x["atkMax"] - x["atkBase"])) for v in a]
for x in S:
    if not x["collectionNo"] or x["type"] not in ("normal", "heroine"): continue
    k = CURVES[x["growthCurve"]]
    for arr, b, m in ((x["atkGrowth"], x["atkBase"], x["atkMax"]), (x["hpGrowth"], x["hpBase"], x["hpMax"])):
        for i, v in enumerate(arr):
            assert b + (m - b) * k[i] // 1000 == v, (x["name"], i)
js = "const ATLAS_CURVES = %s;\n" % json.dumps({str(k): v for k, v in CURVES.items()}, separators=(",", ":"))
js += "const ATLAS_IMG = %s;\nconst ATLAS_S = %s;\nconst ATLAS_C = %s;\nconst ATLAS_ICONS = %s;\n" % (json.dumps(BASE), json.dumps(out, ensure_ascii=False, separators=(",", ":")), json.dumps(ces, ensure_ascii=False, separators=(",", ":")), json.dumps(icons, ensure_ascii=False, separators=(",", ":")))
js += "const ATLAS_MATS = %s;\n" % json.dumps(MAT_LIST, ensure_ascii=False, separators=(",", ":"))
js += "const ATLAS_APPENDS = %s;\n" % json.dumps(APPENDS, ensure_ascii=False, separators=(",", ":"))
js += "const ATLAS_EXP = %s;\n" % json.dumps(EXPS, separators=(",", ":"))
# QP per grail by rarity, and how far each grail raises the level cap ([qp, addLvMax] for grail 1, 2, ...), from Atlas
# Academy's NiceSvtGrailCost (NA, Oct 2026); each grail past Lv 100 also costs 30 of the servant's coins
GRAIL = {
  0: [(600000, 5), (800000, 10), (1000000, 15), (2000000, 20), (3000000, 25)] + [(q, 25 + 2 * i) for i, q in enumerate([4000000, 5000000, 6000000, 7000000, 8000000] + [9000000] * 10, 1)],
  1: [(400000, 10), (600000, 15), (800000, 20), (1000000, 25), (2000000, 30)] + [(q, 30 + 2 * i) for i, q in enumerate([3000000, 4000000, 5000000, 6000000, 7000000] + [8000000] * 10, 1)],
  2: [(600000, 5), (800000, 10), (1000000, 15), (2000000, 20), (3000000, 25)] + [(q, 25 + 2 * i) for i, q in enumerate([4000000, 5000000, 6000000, 7000000, 8000000] + [9000000] * 10, 1)],
  3: [(1000000, 5), (2000000, 10), (3000000, 15), (4000000, 20)] + [(q, 20 + 2 * i) for i, q in enumerate([5000000, 6000000, 7000000, 8000000, 9000000] + [10000000] * 10, 1)],
  4: [(4000000, 5), (5000000, 10)] + [(q, 10 + 2 * i) for i, q in enumerate([6000000, 7000000, 8000000, 9000000, 10000000] + [12000000] * 10, 1)],
  5: [(q, 2 * i) for i, q in enumerate([9000000, 10000000, 11000000, 12000000, 13000000] + [15000000] * 10, 1)]}
js += "const ATLAS_GRAIL = %s;\n" % json.dumps({str(k): [list(t) for t in v] for k, v in GRAIL.items()}, separators=(",", ":"))
with open(os.path.join(ROOT, "src", "data", "atlas_data.js"), "w", encoding="utf-8") as f: f.write(js.strip() + "\n")
print("servants", len(out), "ces", len(ces), "icons", len(icons), "bytes", len(js.encode()))
