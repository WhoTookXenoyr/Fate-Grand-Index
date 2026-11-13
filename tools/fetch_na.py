"""Downloads Atlas Academy's NA data again when it has changed (0.53.0-beta).

    python3 tools/fetch_na.py            # only when NA's data changed since data/atlas/na_info.json
    python3 tools/fetch_na.py --force    # anyway
    python3 tools/fetch_na.py --summary OLD_ATLAS_DATA_JS   # after gen_atlas.py: what changed on the page, into na_summary.md

Writes, in data/atlas/:
- servants.json.gz   the "nice" NA servant export, without the parts tools/gen_atlas.py never reads (its output is the
                     same either way; checked on 13 Nov 2026), so the repo grows less with every update
- ces.json.gz        the "nice" NA Craft Essence export
- costumes.json.gz   costume names from each servant's lore; only servants with a costume it doesn't have yet are asked
- na_info.json       Atlas Academy's info.json for NA at the time, so the next run knows whether anything changed
- upcoming.json      servants NA has now are taken off it: from here on they're ordinary NA servants
and, beside the repo's root, na_summary.md: what changed, in a few lines, for the commit and the pull request.

Then run tools/gen_atlas.py and tools/build.py. .github/workflows/na-data.yml does all three every four hours and
opens a pull request when the page's data changed. This computer's shell may not reach Atlas Academy; GitHub's can.
Prints "changed=true" or "changed=false" last (and writes it to $GITHUB_OUTPUT when there is one).
"""
import gzip, json, os, sys, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLAS = os.path.join(ROOT, "data", "atlas")
EXPORT = "https://api.atlasacademy.io/export/NA/"
LORE = "https://api.atlasacademy.io/nice/NA/servant/%d?lore=true"
# the same parts tools/fetch_upcoming.py leaves out of JP's servants
DROP = ["limits", "overwrites", "charaScripts", "svtChange", "valentineScript", "relateQuestIds", "trialQuestIds", "cardDetails", "hitsDistribution",
        "battlePoints", "bondGrowth", "expFeed", "costumeMaterials", "ascensionImage", "traitAdd", "bondGifts", "script", "valentineEquip", "bondEquips"]
_open = lambda p: open(p, encoding="utf-8") if os.path.exists(p) else gzip.open(p + ".gz", "rt", encoding="utf-8")


def get(url):
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "fate-grand-index-tools"}), timeout=180) as r:
                return json.load(r)
        except Exception as e:
            if i == 4: raise
            print("retrying", url, e); time.sleep(5 * (i + 1))


def out(changed):
    print("changed=" + ("true" if changed else "false"))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f: f.write("changed=%s\n" % ("true" if changed else "false"))


def save_gz(name, data, **kw):
    # (no time in the gzip header: the same data gives the same bytes, so git sees no change)
    with open(os.path.join(ATLAS, name), "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as z:
        z.write(json.dumps(data, **(kw or {"ensure_ascii": False, "separators": (",", ":")})).encode("utf-8"))


def page_data(path):
    import re
    t = open(path, encoding="utf-8").read(); out = {}
    for m in re.finditer(r"^const (ATLAS_(?:S|C|UP)) = (.*?);?$", t, re.M): out[m.group(1)] = json.loads(m.group(2).rstrip(";"))
    return out


def summary(old_path):
    """What changed on the page between two src/data/atlas_data.js: written over the download's own lines in na_summary.md."""
    a, b = page_data(old_path), page_data(os.path.join(ROOT, "src", "data", "atlas_data.js"))
    oa = {x["no"]: x for x in a.get("ATLAS_S", [])}
    up_was = {x["no"] for x in a.get("ATLAS_UP", [])}
    sp = os.path.join(ROOT, "na_summary.md")
    was = open(sp, encoding="utf-8").read() if os.path.exists(sp) else "NA's game data.\n"
    head = was.split("\n")[0]
    lines = [head, ""]
    out_now = [x for x in b["ATLAS_S"] if x["no"] not in oa and x["no"] in up_was]
    new = [x for x in b["ATLAS_S"] if x["no"] not in oa and x["no"] not in up_was]
    if out_now: lines.append("- **Out on NA now**, so their pages use NA's own text: " + ", ".join("%s (No. %d)" % (x["n"], x["no"]) for x in out_now))
    if new: lines.append("- **New servants:** " + ", ".join("%s (No. %d)" % (x["n"], x["no"]) for x in new))
    ch = []
    for x in b["ATLAS_S"]:
        y = oa.get(x["no"])
        if not y or y == x: continue
        bits = []
        for i, (s1, s2) in enumerate(zip(y.get("sk") or [], x.get("sk") or [])):
            if s1.get("n") != s2.get("n"): bits.append("skill %d %s → %s" % (i + 1, s1.get("n"), s2.get("n")))
            elif s1 != s2: bits.append("skill %d" % (i + 1))
        n1, n2 = y.get("np") or {}, x.get("np") or {}
        if (n1.get("n"), n1.get("k")) != (n2.get("n"), n2.get("k")): bits.append("NP %s %s → %s %s" % (n1.get("n"), n1.get("k"), n2.get("n"), n2.get("k")))
        elif n1 != n2: bits.append("NP")
        if y.get("t") != x.get("t"): bits.append("traits")
        if not bits: bits.append("details")
        ch.append("%s (%s)" % (x["n"], ", ".join(bits)))
    if ch: lines.append("- **Changed** (Strengthening Quests and the like): " + "; ".join(ch[:40]) + ("; and %d more" % (len(ch) - 40) if len(ch) > 40 else ""))
    oc = {x["no"] for x in a.get("ATLAS_C", [])}
    nc = [x for x in b.get("ATLAS_C", []) if x["no"] not in oc]
    if nc: lines.append("- **New Craft Essences:** %d (%s)" % (len(nc), ", ".join(x["n"] for x in nc[:12]) + (", …" if len(nc) > 12 else "")))
    cos = [l for l in was.split("\n") if l.startswith("- **New costumes:**")]
    lines += cos
    if len(lines) == 2: lines.append("- Nothing the page shows changed.")
    open(os.path.join(ROOT, "na_summary.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("\n".join(lines))


if "--summary" in sys.argv:
    summary(sys.argv[sys.argv.index("--summary") + 1]); sys.exit(0)


info_path = os.path.join(ATLAS, "na_info.json")
info = get(EXPORT + "info.json")
old_info = json.load(open(info_path)) if os.path.exists(info_path) else {}
if "--force" not in sys.argv and old_info.get("hash") == info.get("hash") and old_info.get("timestamp") == info.get("timestamp"):
    print("NA's data hasn't changed since", time.strftime("%d %b %Y %H:%M UTC", time.gmtime(info.get("timestamp") or 0)))
    out(False); sys.exit(0)

old_s = json.load(_open(os.path.join(ATLAS, "servants.json")))
old_c = json.load(_open(os.path.join(ATLAS, "ces.json")))
costumes = json.load(_open(os.path.join(ATLAS, "costumes.json")))

servants = get(EXPORT + "nice_servant.json")
for x in servants:
    for k in DROP: x.pop(k, None)
    if x.get("ascensionAdd"): x["ascensionAdd"] = {"individuality": x["ascensionAdd"].get("individuality") or {}}
ces = get(EXPORT + "nice_equip.json")
print("servants", len(servants), "Craft Essences", len(ces))

# costume names: the export has each costume's picture (extraAssets.charaGraph.costume, keyed by its battleCharaId) but
# not its name, which is in the servant's lore
new_cos = []
for x in servants:
    ids = set(((x.get("extraAssets") or {}).get("charaGraph") or {}).get("costume") or {})
    known = {str(c[0]) for c in costumes.get(str(x["id"]), [])}
    if ids and not ids <= known:
        c = (get(LORE % x["id"]).get("profile") or {}).get("costume") or {}
        costumes[str(x["id"])] = [[int(k), v.get("id"), v.get("costumeCollectionNo"), v.get("name"), v.get("shortName")] for k, v in c.items()]
        new_cos += ["%s (%s)" % (v.get("name"), x["name"]) for k, v in c.items() if k not in known]

# what changed, in a few lines
sig = lambda x: json.dumps([x.get("skills"), x.get("noblePhantasms"), x.get("classPassive"), x.get("appendPassive"), x.get("ascensionMaterials"),
                            x.get("skillMaterials"), x.get("appendSkillMaterials"), x.get("atkMax"), x.get("hpMax"), x.get("traits")], sort_keys=True)
o_no = {x.get("collectionNo"): x for x in old_s if x.get("collectionNo")}
new_svt = [x for x in servants if x.get("collectionNo") and x["collectionNo"] not in o_no and x.get("type") in ("normal", "heroine")]
changed_svt = [x for x in servants if x.get("collectionNo") in o_no and sig(x) != sig(o_no[x["collectionNo"]])]
o_ce = {x.get("collectionNo") for x in old_c if x.get("collectionNo")}
new_ce = [x for x in ces if x.get("collectionNo") and x["collectionNo"] not in o_ce]

up_path = os.path.join(ATLAS, "upcoming.json")
released = []
if os.path.exists(up_path):
    up = json.load(open(up_path, encoding="utf-8"))
    na_nos = {x.get("collectionNo") for x in servants if x.get("collectionNo")}
    released = [u for u in up.get("servants", []) if u["no"] in na_nos]
    if released:
        up["servants"] = [u for u in up["servants"] if u["no"] not in na_nos]
        # (in its own layout: one servant to a line)
        rest = {k: v for k, v in up.items() if k != "servants"}
        body = ",\n".join("  %s: %s" % (json.dumps(k), json.dumps(v, ensure_ascii=False)) for k, v in rest.items())
        rows = ",\n".join("    " + json.dumps(u, ensure_ascii=False) for u in up["servants"])
        with open(up_path, "w", encoding="utf-8") as f: f.write("{\n" + body + (",\n" if body else "") + '  "servants": [' + ("\n" + rows + "\n  " if rows else "") + "]\n}\n")

save_gz("servants.json.gz", servants)
save_gz("ces.json.gz", ces)
save_gz("costumes.json.gz", costumes, ensure_ascii=False)
with open(info_path, "w") as f: json.dump(info, f, indent=2); f.write("\n")

when = time.strftime("%d %b %Y %H:%M UTC", time.gmtime(info.get("timestamp") or 0))
lines = ["NA's game data as Atlas Academy had it on %s." % when, ""]
if released: lines.append("- **Out on NA now** (their pages use NA's data from here on): " + ", ".join("%s (No. %d)" % (u["name"], u["no"]) for u in released))
if new_svt: lines.append("- **New servants:** " + ", ".join("%s (No. %d)" % (x["name"], x["collectionNo"]) for x in new_svt))
if changed_svt: lines.append("- **Servants whose skills, NP, stats or materials changed** (Strengthening Quests and the like): " + ", ".join(x["name"] for x in changed_svt[:30]) + (" and %d more" % (len(changed_svt) - 30) if len(changed_svt) > 30 else ""))
if new_ce: lines.append("- **New Craft Essences:** %d (%s)" % (len(new_ce), ", ".join(x["name"] for x in new_ce[:12]) + (", …" if len(new_ce) > 12 else "")))
if new_cos: lines.append("- **New costumes:** " + ", ".join(new_cos))
if len(lines) == 2: lines.append("- Nothing the page shows changed.")
open(os.path.join(ROOT, "na_summary.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines))
out(True)
