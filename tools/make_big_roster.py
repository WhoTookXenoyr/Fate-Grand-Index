"""Build tests/fixtures/roster-200.json: 200 real NA servants (190 on the list, 10 Guests) with varied levels, skills,
NP, Bond and Fou, completed from the NA data the way a person would: a spreadsheet import, then "Fill them in".
Used by the speed test (test_23) to time presses on a big list. Run after a build:
    python3 tools/make_big_roster.py
"""
import csv, io, json, os, random, re, sys, functools, http.server, threading, tempfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(7)
s = open(os.path.join(ROOT, "src", "data", "atlas_data.js"), encoding="utf-8").read()
arr = json.loads(re.search(r"const ATLAS_S = (\[.*?\]);\n", s, re.S).group(1))
pool = [x for x in arr if x["c"] not in ("Beast",) and x["r"] >= 1]
pick = random.sample(pool, 200)
CAPS = {0: 65, 1: 60, 2: 65, 3: 70, 4: 80, 5: 90}
rows = []
for i, x in enumerate(pick):
    cap = CAPS.get(x["r"], 90); lv = random.choice([cap, cap, cap, 1 + random.randrange(cap), 100, 100, 110, 120])
    sk = [random.choice([1, 4, 6, 8, 9, 10, 10]) for _ in range(3)]
    rows.append({"Name": x["n"], "Class": x["c"], "Rarity": x["r"], "Level": lv, "NP Level": random.choice([1, 1, 1, 2, 3, 5]),
                 "Skill 1": sk[0], "Skill 2": sk[1], "Skill 3": sk[2], "Bond": random.randrange(0, 16), "Wishlist": "yes" if i >= 190 else ""})
out = io.StringIO(); w = csv.DictWriter(out, fieldnames=list(rows[0].keys())); w.writeheader(); [w.writerow(r) for r in rows]
tmp = tempfile.mkdtemp(); open(os.path.join(tmp, "big.csv"), "w", encoding="utf-8").write(out.getvalue())
site = tempfile.mkdtemp()
html = open(os.path.join(ROOT, "dist", "Fate_Grand_Index.html"), encoding="utf-8").read().replace("const LIVE_DEFAULT = true;", "const LIVE_DEFAULT = false;")
open(os.path.join(site, "app.html"), "w", encoding="utf-8").write(html)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(type("Q", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *a: None}), directory=site))
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1360, "height": 900}, accept_downloads=True); pg = ctx.new_page()
    pg.add_init_script("localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9')")
    pg.route("https://**", lambda r: r.abort()); pg.set_default_timeout(600000)
    pg.goto("http://127.0.0.1:%d/app.html#servants" % srv.server_address[1]); pg.wait_for_timeout(1500)
    pg.set_input_files("#f-import", os.path.join(tmp, "big.csv")); pg.wait_for_timeout(500)
    pg.click('[data-action="import-go"]'); pg.wait_for_timeout(6000)
    n = pg.evaluate("JSON.parse(localStorage.getItem('spirit-origin-list:v1')).servants.length")
    pg.click('[data-action="fill-open"]'); pg.wait_for_timeout(800)
    import time; t0 = time.time()
    pg.evaluate("document.querySelector('[data-action=\"fill-go\"]').click()")
    pg.wait_for_function("!document.querySelector('[data-action=\"fill-go\"]')", timeout=600000, polling=1000)
    print("fill-in took %.1f s" % (time.time() - t0)); pg.wait_for_timeout(3000)
    d = pg.evaluate("JSON.parse(localStorage.getItem('spirit-origin-list:v1'))")
    filled = sum(1 for x in d["servants"] if x.get("skillInfo") and any((y or {}).get("n") or (y or {}).get("name") for y in x["skillInfo"]))
    print(n, "imported;", filled, "with skills filled in")
    b.close()
d = {"servants": d["servants"], "parties": [], "guests": []}
json.dump(d, open(os.path.join(ROOT, "tests", "fixtures", "roster-200.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("wrote tests/fixtures/roster-200.json", os.path.getsize(os.path.join(ROOT, "tests", "fixtures", "roster-200.json")) // 1024, "KB")
