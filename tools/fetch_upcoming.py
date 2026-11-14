"""Downloads JP's data (in English where Atlas Academy has it) for the servants in data/atlas/upcoming.json: the
servants NA doesn't have yet, whose Past Chaldea page stays locked until NA gets them.

    python3 tools/fetch_upcoming.py

Writes data/atlas/upcoming_servants.json.gz (the Atlas Academy "nice" JP servant, lang=en, without the parts the page
doesn't use) and the costume names into data/atlas/upcoming_costumes.json.gz. Then run tools/gen_atlas.py and tools/build.py.
"""
import gzip, json, os, sys, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLAS = os.path.join(ROOT, "data", "atlas")
API = "https://api.atlasacademy.io/nice/JP/servant/%d?lang=en"
DROP = ["limits", "overwrites", "charaScripts", "svtChange", "valentineScript", "relateQuestIds", "trialQuestIds", "cardDetails", "hitsDistribution",
        "battlePoints", "bondGrowth", "expFeed", "costumeMaterials", "ascensionImage", "traitAdd", "bondGifts", "script", "valentineEquip", "bondEquips"]
def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "fate-grand-index-tools"}), timeout=60) as r: return json.load(r)
        except Exception as e:
            if i == 3: raise
            time.sleep(3 * (i + 1))
up = json.load(open(os.path.join(ATLAS, "upcoming.json"), encoding="utf-8"))["servants"]
out, cos = [], {}
for u in up:
    x = get(API % u["id"])
    if x.get("collectionNo") != u["no"]: sys.exit("%s: JP's number is %s, upcoming.json says %s" % (u["name"], x.get("collectionNo"), u["no"]))
    for k in DROP: x.pop(k, None)
    if x.get("ascensionAdd"): x["ascensionAdd"] = {"individuality": x["ascensionAdd"].get("individuality") or {}}
    out.append(x)
    lore = get(API % u["id"] + "&lore=true")
    c = ((lore.get("profile") or {}).get("costume") or {})
    if c: cos[str(u["id"])] = [[int(k), v.get("id"), v.get("costumeCollectionNo"), v.get("name"), v.get("shortName")] for k, v in c.items()]
    print("got", x["collectionNo"], x["name"])
# (no time in the gzip header: the same data gives the same bytes, so git sees no change; before 14 Nov 2026 every run
# made a commit, one of them straight on main)
def save_gz(name, text):
    with open(os.path.join(ATLAS, name), "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as z: z.write(text.encode("utf-8"))
save_gz("upcoming_servants.json.gz", json.dumps(out, ensure_ascii=False, separators=(",", ":")))
save_gz("upcoming_costumes.json.gz", json.dumps(cos, ensure_ascii=False))
print("wrote", len(out), "servants")
# run by .github/workflows/upcoming.yml
