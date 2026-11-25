"""A sanity check for the data jobs (14 Nov 2026): did a download lose anything?

    python3 tools/check_data.py OLD_ATLAS_DATA_JS     # compares with src/data/atlas_data.js; fails if something went

A partial or broken export from Atlas Academy would otherwise turn into a pull request (or a commit on a branch) that
quietly removes servants, Craft Essences or Command Codes from the page. NA doesn't take any of them away, so any that
disappear stop the job instead. (Servants leaving Coming to NA is normal: that's ATLAS_UP, which isn't checked.)
It also stops the job when the bond tables or Command Codes are missing, or when the data points anywhere but
https://static.atlasacademy.io/ (22 Nov 2026).
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    t = open(path, encoding="utf-8").read(); out = {}
    for k in ("ATLAS_S", "ATLAS_C", "ATLAS_CC"):
        m = re.search(r"^const %s = (.*?);?$" % k, t, re.M)
        if not m and k == "ATLAS_CC": continue  # (0.54.0 on)
        if not m: raise SystemExit("%s has no %s" % (path, k))
        out[k] = json.loads(m.group(1).rstrip(";"))
    return out


old, new = load(sys.argv[1]), load(os.path.join(ROOT, "src", "data", "atlas_data.js"))
text = open(os.path.join(ROOT, "src", "data", "atlas_data.js"), encoding="utf-8").read()
problems = []
for k, one, many in (("ATLAS_S", "servant", "servants"), ("ATLAS_C", "Craft Essence", "Craft Essences"), ("ATLAS_CC", "Command Code", "Command Codes")):
    if k not in old: continue
    have = {x["no"] for x in new.get(k, [])}
    gone = [x for x in old[k] if x["no"] not in have]
    if gone:
        problems.append("%d %s gone: %s" % (len(gone), one + " is" if len(gone) == 1 else many + " are", ", ".join("%s (No. %d)" % (x.get("n"), x["no"]) for x in gone[:20])))
# 0.54.0's data is there: the bond calculator and the Command Codes page are empty without it (22 Nov 2026)
for k, what in (("ATLAS_BOND", "bond tables"), ("ATLAS_CC", "Command Codes")):
    m = re.search(r"^const %s = (.*?);?$" % k, text, re.M)
    if not m or not json.loads(m.group(1).rstrip(";")):
        problems.append("no %s (%s is %s)" % (what, k, "missing" if not m else "empty"))
if problems:
    raise SystemExit("The new data lost things NA still has, so nothing is committed. Is Atlas Academy's export partial? "
                     "Run the job again later.\n- " + "\n- ".join(problems))
# every address in the data must be Atlas Academy's: the data pull requests merge themselves, so a tampered export
# could otherwise make every visitor's browser load pictures from somewhere else (from the daily security log, 22 Nov 2026)
# (0.54.1: the upcoming servants' kits, which only the server has, count too: the owner's page shows them)
UPJS = os.path.join(ROOT, "server", "upcoming_data.js")
scan = text + (open(UPJS, encoding="utf-8").read() if os.path.exists(UPJS) else "")
foreign = sorted({u for u in re.findall(r"(?:https?:)?//[^\s\"'\\)<>]+", scan) if not u.startswith("https://static.atlasacademy.io/")})
if foreign:
    raise SystemExit("The new data points the page at %d address%s off https://static.atlasacademy.io/, so nothing is committed. "
                     "Check Atlas Academy's export before running the job again.\n- %s" % (len(foreign), "" if len(foreign) == 1 else "es", "\n- ".join(foreign[:10])))
print("data check: %d servants (was %d), %d Craft Essences (was %d), %d Command Codes (was %d), none lost"
      % (len(new["ATLAS_S"]), len(old["ATLAS_S"]), len(new["ATLAS_C"]), len(old["ATLAS_C"]), len(new.get("ATLAS_CC", [])), len(old.get("ATLAS_CC", []))))
