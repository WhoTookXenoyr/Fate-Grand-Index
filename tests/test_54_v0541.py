import os
# 0.54.1-beta: security fixes from the daily security check (23–25 Nov 2026).
# - Coming to NA: the page has only the upcoming servants' cards; their kits are the server's (server/upcoming_data.js,
#   GET /api/upcoming, owner only). Checked here in the built files; the server's side is tests/api/test_hosted_owner.py.
# - The database's new column (users.docs_bytes, schema step 2) counts a roster the way server/sync.js does, for the
#   rosters already there (run here on SQLite, which D1 is).
# - Every route that changes something on the server has a limit (a throttle, a quota, a password check), or is on a
#   short list of ones that don't need one. A new route without one fails here (the friends and sync findings).
# The limits themselves are tests/api/test_hosted_limits.py.
import sys, json, re, sqlite3
sp = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
read = lambda *p: open(os.path.join(ROOT, *p), encoding="utf-8").read()

# ---------- Coming to NA: cards in the page, kits on the server ----------
data = open(os.path.join(sp, "atlas_data.js"), encoding="utf-8").read()
cards = json.loads(re.search(r"^const ATLAS_UP = (.*?);?$", data, re.M).group(1))
srv = read("server", "upcoming_data.js")
kits = json.loads(re.search(r"^export const UPCOMING = (.*?);?$", srv, re.M).group(1))
check(f"the page's ATLAS_UP has only what a card shows ({sorted({k for c in cards for k in c})})", cards and all(set(c) <= {"no", "id", "n", "c", "r", "f", "im", "up"} and len(c.get("im", [])) <= 1 for c in cards))
check(f"the server has the same servants in full ({[x['no'] for x in kits]})", [x["no"] for x in kits] == [c["no"] for c in cards] and all(x.get("sk") and x.get("np") for x in kits))
words = sorted({s["n"] for x in kits for s in x["sk"]} | {n["n"] for x in kits for n in (x["np"] if isinstance(x["np"], list) else [x["np"]]) if isinstance(n, dict) and n.get("n")})
for f in (("site", "index.html"), ("dist", "Fate_Grand_Index.html"), ("build", "seeded.html")):
    t = read(*f); hits = [w for w in words if w in t]
    check(f"{'/'.join(f)}: none of their skill or NP names ({len(words)} looked for; found {hits[:3]})", not hits)
site = os.listdir(os.path.join(ROOT, "site"))
check(f"and the site's files don't include the server's data ({site})", not any("upcoming" in x for x in site))
check("the data jobs commit the server's kits with the page", all("server/upcoming_data.js" in read(".github", "workflows", w) for w in ("na-data.yml", "upcoming.yml")))
check("the data check looks at the server's kits too (addresses off Atlas Academy)", "upcoming_data.js" in read("tools", "check_data.py"))

# ---------- the database's new column ----------
sch = read("server", "schema.js")
block = lambda name: re.findall(r"`([^`]*)`", re.search(r"const %s = \[(.*?)\n\];" % name, sch, re.S).group(1))
db = sqlite3.connect(":memory:")
for q in block("V1"): db.execute(q)
docs = [("u1", "servants", "s1", '{"name":"Mash","notes":"先輩 ✦ 🛡"}'), ("u1", "extras", "log", '{"v":"' + "x" * 900 + '"}'),
        ("u1", "servants", "gone", None), ("u2", "parties", "p1", '{"name":"Farm"}')]
for u in ("u1", "u2", "u3"):
    db.execute("INSERT INTO users (id, name, name_key, code, created) VALUES (?, ?, ?, ?, 0)", (u, u, u, u + "000"))
for i, d in enumerate(docs): db.execute("INSERT INTO docs (user_id, col, id, rev, data) VALUES (?, ?, ?, ?, ?)", d[:3] + (i + 1, d[3]))
for q in block("V2"): db.execute(q)
got = dict(db.execute("SELECT id, docs_bytes FROM users"))
want = {u: sum(64 + len(d[2]) + (len(d[3]) if d[3] else 0) for d in docs if d[0] == u) for u in ("u1", "u2", "u3")}
check(f"step 2 counts the rosters already there like sync.js does: 64 + id + text, a deleted one 64 + id ({got} vs {want})", got == want)
check("SCHEMA_VERSION is 2, with two steps", "SCHEMA_VERSION = 2" in sch and "const STEPS = [V1, V2]" in sch)
sync = read("server", "sync.js")
check("sync.js counts characters the way SQLite's LENGTH does (an emoji is one)", "SURROGATES" in sync and "LENGTH(id) + COALESCE(LENGTH(data), 0)" in sync)

# ---------- every route that changes something has a limit ----------
app = read("server", "app.js")
mods = dict(re.findall(r'import \* as (\w+) from "\./(\w+)\.js"', app))
routes = re.findall(r'\["(POST|PUT|DELETE)", /\^(.*?)\$/, (.*?)\],?\n', app)
# these change only the account's own row or a link, and can't fill or guess anything: no limit needed
NONE_NEEDED = {"auth.logout", "auth.signOutOthers", "auth.unlink", "fr.accept", "fr.remove", "sync.delPic", "fr.saveAccount"}
LIMIT = re.compile(r"\bthrottle\(|\bconfirmed\(|\bquota\(|\bdocQuota\(")
def body_of(mod, fn):
    src = read("server", mods[mod] + ".js")
    m = re.search(r"export async function %s\(.*?\n}\n" % fn, src, re.S)
    return m.group(0) if m else ""
seen, bare = [], []
for method, path, h in routes:
    m = re.search(r"\b(\w+)\.(\w+)\b", h); name = m.group(0) if m else h
    seen.append(name)
    if name in NONE_NEEDED: continue
    if not LIMIT.search(body_of(m.group(1), m.group(2))): bare.append(method + " /api/" + path.replace("\\", "") + " (" + name + ")")
check(f"every route that changes something has a limit, or is on the short list ({len(routes)} routes; without one: {bare})", len(routes) >= 15 and not bare)
check("POST /api/friends and POST /api/sync are throttled", "fr.request" in seen and "sync.push" in seen and "throttle(" in body_of("fr", "request") and "throttle(" in body_of("sync", "push"))
check("the short list names only routes that exist", NONE_NEEDED <= set(seen))

print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
