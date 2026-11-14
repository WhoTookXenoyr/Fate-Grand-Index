"""A sanity check for the data jobs (14 Nov 2026): did a download lose anything?

    python3 tools/check_data.py OLD_ATLAS_DATA_JS     # compares with src/data/atlas_data.js; fails if something went

A partial or broken export from Atlas Academy would otherwise turn into a pull request (or a commit on a branch) that
quietly removes servants or Craft Essences from the page. NA doesn't take servants or Craft Essences away, so any that
disappear stop the job instead. (Servants leaving Coming to NA is normal: that's ATLAS_UP, which isn't checked.)
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    t = open(path, encoding="utf-8").read(); out = {}
    for k in ("ATLAS_S", "ATLAS_C"):
        m = re.search(r"^const %s = (.*?);?$" % k, t, re.M)
        if not m: raise SystemExit("%s has no %s" % (path, k))
        out[k] = json.loads(m.group(1).rstrip(";"))
    return out


old, new = load(sys.argv[1]), load(os.path.join(ROOT, "src", "data", "atlas_data.js"))
problems = []
for k, one, many in (("ATLAS_S", "servant", "servants"), ("ATLAS_C", "Craft Essence", "Craft Essences")):
    have = {x["no"] for x in new[k]}
    gone = [x for x in old[k] if x["no"] not in have]
    if gone:
        problems.append("%d %s gone: %s" % (len(gone), one + " is" if len(gone) == 1 else many + " are", ", ".join("%s (No. %d)" % (x.get("n"), x["no"]) for x in gone[:20])))
if problems:
    raise SystemExit("The new data lost things NA still has, so nothing is committed. Is Atlas Academy's export partial? "
                     "Run the job again later.\n- " + "\n- ".join(problems))
print("data check: %d servants (was %d), %d Craft Essences (was %d), none lost"
      % (len(new["ATLAS_S"]), len(old["ATLAS_S"]), len(new["ATLAS_C"]), len(old["ATLAS_C"])))
