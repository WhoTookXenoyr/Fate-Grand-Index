"""The hosted site in a browser, against a local copy of Cloudflare (tests/api/hosted.py): the app (manifest, service
worker, offline), creating an account with its recovery code, a second device getting the roster, changes and pictures
syncing both ways, combining a browser's roster with the account's, friends (requests, their roster read-only, their
supports in the damage calculator and Versus, activity), a shared link while signed out, and signing out. 0.26.1: a
friend's story position (card, bar, Story page), a friend's servant into your own Guests, Versus picks from the list,
and friends' supports as Worth borrowing on the Story page.

    python3 tests/api/test_hosted_ui.py
"""
import base64, io, json, os, re, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hosted
from test_api import Client, key_of
from playwright.sync_api import sync_playwright

fails, errs = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label, flush=True)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
SYNCST = "JSON.parse(localStorage.getItem('spirit-origin-list:v1:sync') || 'null')"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAGklEQVR42mP8z8DwnwEJMDGgAqwChAwYpgAAnKMDAvgVOy4AAAAASUVORK5CYII=")

def browser_ctx(b, w=1440, h=900, mobile=False, dark=False, roster=None):
    ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, color_scheme="dark" if dark else "light")
    ctx.add_init_script(INIT)
    if roster is not None:
        ctx.add_init_script("try { if (!sessionStorage.getItem('rost')) { localStorage.setItem('spirit-origin-list:v1', %s); sessionStorage.setItem('rost', '1'); } } catch (e) {}" % json.dumps(json.dumps(roster)))
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("CSP: " + m.text) if "Content Security Policy" in m.text else None)
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://static.atlasacademy.io/**", lambda r: r.abort())
    return ctx, pg
def rows(pg): return pg.locator("#list .row").count()
FX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fixtures", "story")
def story_fx(route):
    u = route.request.url
    m = re.search(r"/nice/NA/war/(\d+)", u); f = f"{FX}/war-{m.group(1)}.json" if m else ""
    if not m:
        m = re.search(r"/nice/NA/quest/(\d+)/(\d+)", u); f = f"{FX}/quest-{m.group(1)}-{m.group(2)}.json" if m else ""
    if f and os.path.exists(f): route.fulfill(path=f, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"})
    else: route.fulfill(status=404, body="{}", headers={"Access-Control-Allow-Origin": "*"})
def sign_in(pg, email, pw):
    pg.click("#acct-btn"); pg.wait_for_selector("#acct-email")
    pg.fill("#acct-email", email); pg.fill("#acct-pw", pw); pg.click('.acct-form button[type="submit"]')

def run(base):
    with sync_playwright() as p:
        b = p.chromium.launch()
        c1, a = browser_ctx(b)
        a.goto(base + "/#servants"); a.wait_for_timeout(2500)
        n0 = rows(a)
        check(f"the hosted page links the app's manifest and registers the service worker", a.locator('link[rel="manifest"]').count() == 1 and a.evaluate("navigator.serviceWorker.getRegistration().then(r => !!r)"))
        csp = a.evaluate("fetch('/').then(r => r.headers.get('content-security-policy') || '')")
        check("the page runs only its own two scripts (Content-Security-Policy)", "script-src 'sha256-" in csp and "unsafe-inline' https://fonts" in csp and csp.count("'sha256-") == 2)
        check("there's a Sign in button and a Friends tab", a.locator("#acct-btn").inner_text().strip() == "Sign in" and a.locator("#tab-friends").is_visible())
        a.click("#tab-friends"); a.wait_for_timeout(400)
        check("signed out, Friends asks you to sign in", "needs an account" in a.locator("#friends").inner_text())
        # ---------- a new account ----------
        a.click("#acct-btn"); a.wait_for_selector('[data-action="acct-view"][data-v="signup"]')
        a.click('[data-action="acct-view"][data-v="signup"]')
        a.fill("#acct-name", "Noyr"); a.fill("#acct-email", "noyr@example.test"); a.fill("#acct-pw", "short")
        a.click('.acct-form button[type="submit"]'); a.wait_for_timeout(300)
        check("a short password is turned down before anything is sent", a.locator("#acct-code").count() == 0 and a.evaluate("!document.getElementById('acct-pw').checkValidity()") and a.locator("#acct-email").input_value() == "noyr@example.test")
        a.fill("#acct-pw", "correct horse battery"); a.click('.acct-form button[type="submit"]')
        a.wait_for_selector("#acct-code", timeout=20000)
        code = a.locator("#acct-code").inner_text()
        check(f"after creating the account, its recovery code ({code})", len(code) == 19 and code.count("-") == 3)
        a.keyboard.press("Escape"); a.wait_for_timeout(200)
        check("the window doesn't close before the code is saved", a.locator("#acct-code").count() == 1 and "Save the recovery code" in a.locator(".acct-err").inner_text())
        a.check("[data-acct-codeok]"); a.click('[data-action="acct-code-done"]'); a.wait_for_timeout(5000)
        st = a.evaluate(SYNCST)
        check(f"then this browser's roster goes up to the account ({st and st.get('rev')} changes)", st and st["ready"] and not st["out"] and st["rev"] >= n0)
        check("the window shows the account: name, friend code, sync", "Noyr" in a.locator(".acct-me").inner_text() and "Synced" in a.locator(".acct-sync").inner_text())
        check("the line under the header says it's synced", "synced to Noyr's account" in a.locator("#save-note").inner_text())
        a.click(".acct [data-acct-close].cep-x"); a.wait_for_timeout(300)
        check("and the footer too", "Signed in as" in a.locator(".sf-acct").inner_text() and a.locator('.site-foot [data-tab="friends"]').count() == 1)
        # ---------- a second device ----------
        c2, d = browser_ctx(b, 390, 844, True, True, roster={"servants": [], "parties": [], "guests": []})
        d.goto(base + "/#servants"); d.wait_for_timeout(2500)
        check("a new phone starts empty", rows(d) == 0)
        sign_in(d, "noyr@example.test", "correct horse battery"); d.wait_for_timeout(7000)
        check(f"signing in brings the roster over ({rows(d)} of {n0})", rows(d) == n0)
        check("and the window closes", d.locator(".acct").first.is_hidden())
        # a change there comes here
        a.click("#tab-servants"); a.wait_for_timeout(400)
        d.click('#list [data-id="artoria"]'); d.wait_for_timeout(700)
        before = next(x for x in a.evaluate(LS)["servants"] if x["id"] == "artoria").get("npTable")
        d.locator('#dossier [data-action="npup"]').click(); d.wait_for_timeout(3500)
        a.click("#acct-btn"); a.wait_for_selector('[data-action="sync-now"]'); a.click('[data-action="sync-now"]'); a.wait_for_timeout(2500)
        after = next(x for x in a.evaluate(LS)["servants"] if x["id"] == "artoria").get("npTable")
        check("a change on the phone shows up on the computer (Artoria's NP version)", after and before != after)
        a.click(".acct [data-acct-close].cep-x"); a.wait_for_timeout(200)
        # a picture goes up, and the phone shows it from the server
        a.click('#list [data-id="artoria"]'); a.wait_for_timeout(600)
        a.click('#dossier [data-action="stage"][data-slot="fan"]'); a.wait_for_timeout(400)
        tmp = os.path.join(tempfile.mkdtemp(), "fan.png"); open(tmp, "wb").write(PNG)
        a.set_input_files('#dossier input[data-art-file="fan"]', tmp); a.wait_for_timeout(3500)
        st = a.evaluate(SYNCST); pic = next(x for x in a.evaluate(LS)["servants"] if x["id"] == "artoria").get("art", {}).get("fan")
        check(f"an uploaded picture syncs up ({pic})", pic and st["up"].get(pic) == 1)
        d.evaluate("window.dispatchEvent(new Event('focus'))"); d.wait_for_timeout(500)
        d.goto(base + "/#servants"); d.wait_for_timeout(5000)
        d.click('#list [data-id="artoria"]'); d.wait_for_timeout(600)
        d.click('#dossier [data-action="stage"][data-slot="fan"]'); d.wait_for_timeout(1200)
        src = d.locator("#dossier .art-frame img").first.get_attribute("src") if d.locator("#dossier .art-frame img").count() else ""
        check(f"and the phone shows it ({src[:40]})", src.startswith("/api/pics/") or src.startswith("blob:"))
        # ---------- a browser with a roster of its own: combine ----------
        own = {"servants": [{"id": "only-here", "name": "Only Here", "cls": "Saber", "rarity": 3, "level": 50, "order": 1}], "parties": [], "guests": []}
        c3, g = browser_ctx(b, roster=own)
        g.goto(base + "/#servants"); g.wait_for_timeout(2500)
        sign_in(g, "noyr@example.test", "correct horse battery"); g.wait_for_selector('[data-action="sync-take"]', timeout=20000)
        check("a browser with a different roster is asked what to do", "both have a roster" in g.locator(".acct-body").inner_text())
        g.check('input[name="sync-use"][value="both"]'); g.uncheck("[data-sync-backup]"); g.click('[data-action="sync-take"]'); g.wait_for_timeout(6000)
        check(f"combining keeps both ({rows(g)} = {n0} + 1)", rows(g) == n0 + 1)
        a.click("#acct-btn"); a.wait_for_selector('[data-action="sync-now"]'); a.click('[data-action="sync-now"]'); a.wait_for_timeout(2500); a.click(".acct [data-acct-close].cep-x")
        check("and the other devices get the extra servant", rows(a) == n0 + 1)
        # ---------- friends ----------
        B = Client(base)
        s, r, _ = B.post("/api/auth/signup", {"name": "Bazett", "email": "bazett@example.test", "key": key_of("bazett@example.test", "fragarach!!")})
        bcode = r["user"]["code"]
        sv = lambda n, no, cls, **k: dict({"name": n, "cls": cls, "rarity": 5, "level": 90, "npLevel": 2, "skills": [10, 10, 10], "atlas": no, "order": no}, **k)
        B.post("/api/sync", {"first": True, "changes": [{"col": "servants", "id": "skadi", "data": sv("Scathach-Skadi", 215, "Caster")}, {"col": "servants", "id": "castoria", "data": sv("Altria Caster", 284, "Caster")}, {"col": "servants", "id": "melusine", "data": sv("Melusine", 312, "Lancer")}]})
        B.post("/api/account", {"supports": ["skadi", "castoria"]})
        a.click("#tab-friends"); a.wait_for_timeout(1200)
        a.fill("[data-fr-add] input", bcode[:3] + "," + bcode[3:6] + "," + bcode[6:]); a.click("[data-fr-add] button"); a.wait_for_timeout(1500)
        check("a friend request by friend code", "Asked" in a.locator("#friends").inner_text())
        B.post("/api/friends", {"to": "Noyr"})
        a.click('[data-action="fr-reload"]'); a.wait_for_timeout(1500)
        check("accepted on their side: a friend", a.locator('#friends [data-action="fv-open"]').count() == 1)
        a.click('[data-action="fr-sup"]'); a.wait_for_timeout(1200)
        check("their supports open in the card", a.locator(".fr-sups .fr-sv").count() == 2)
        a.click('[data-action="fv-open"]'); a.wait_for_timeout(1500)
        check(f"their roster opens read-only ({rows(a)} servants)", rows(a) == 3 and a.locator("#fv-bar").is_visible() and a.locator('[data-action="add-servant"]').first.is_hidden())
        a.click('#fv-bar [data-action="fv-close"]'); a.wait_for_timeout(1200); a.click("#tab-servants"); a.wait_for_timeout(500)
        check("and Back to yours brings yours back", rows(a) == n0 + 1 and a.locator("#fv-bar").count() == 0)
        a.click("#tab-versus"); a.wait_for_timeout(800); a.click('[data-action="vs-friend"]'); a.wait_for_selector(".spk:not([hidden]) [data-spk]", timeout=8000)
        groups = a.evaluate("[...document.querySelectorAll('.spk-g h3')].map(h => h.firstChild.textContent.trim())")
        check(f"Versus offers the friend's servants ({groups})", groups == ["Bazett's supports", "Bazett's roster"])
        a.locator('.spk [data-spk^="f:"]').first.click(); a.wait_for_timeout(900)
        check("and puts one next to yours", a.locator(".vs-hero").count() == 2 and a.locator(".vs-hero .fr-tag").count() == 1)
        a.click("#tab-servants"); a.wait_for_timeout(400); a.click('#list [data-id="cu-chulainn-alter"]'); a.wait_for_timeout(800)
        a.evaluate("(() => { const d = document.querySelector('#dossier details.npc'); if (d && !d.open) d.querySelector('summary').click(); })()"); a.wait_for_timeout(300)
        a.click('#dossier [data-npc-pick="0"]'); a.wait_for_selector(".spk:not([hidden]) [data-spk]", timeout=5000)
        groups = a.evaluate("[...document.querySelectorAll('.spk-g h3')].map(h => h.firstChild.textContent.trim())")
        check(f"the damage calculator can borrow friends' supports ({groups[:3]})", "Friends' supports" in groups)
        a.locator('.spk [data-spk^="f:"]').first.click(); a.wait_for_timeout(600)
        check("picked: the support is the friend's servant", "Bazett" in a.locator('#dossier [data-npc-pick="0"]').inner_text())
        # ---------- 0.26.1: a friend's story, their servants into your Guests, Versus from the list ----------
        B.post("/api/sync", {"changes": [{"col": "extras", "id": "story", "data": {"v": json.dumps({"pos": {"w": 101, "q": 0, "ph": 0}, "theme": True, "part": "1"})}}]})
        a.click("#tab-friends"); a.wait_for_timeout(400); a.click('[data-action="fr-reload"]'); a.wait_for_timeout(1500)
        card = a.locator(".fr-card").first.inner_text().replace("\n", " ")
        check(f"a friend's card says where they are in the story ({card[:90]})", "Story: Orleans" in card)
        a.click('[data-action="fv-open"]'); a.wait_for_timeout(1500)
        check("so does the bar while you look at their roster", "Story: Orleans" in a.locator("#fv-bar").inner_text())
        a.click('#fv-bar [data-tab="story"]'); a.wait_for_timeout(1500)
        check("and the Story page shows their place, read-only", "Bazett is at Orleans" in a.locator("#story .st-pos").inner_text() and a.locator('#story [data-action="st-here"]').count() == 0)
        a.click("#tab-servants"); a.wait_for_timeout(500); a.click('#list [data-id="melusine"]'); a.wait_for_timeout(800)
        check("a friend's servant can go into your own Guests", "Add to my Guests" in a.locator("#dossier .fv-guest").inner_text())
        a.click('#dossier .fv-guest [data-action="fr-guest"]'); a.wait_for_timeout(1200)
        mel = [x for x in a.evaluate(LS)["servants"] if x.get("atlas") == 312]
        check(f"with their levels, into your list while you keep looking at theirs ({[(x['name'], x.get('wish'), x.get('level'), x.get('notes')) for x in mel]}, {rows(a)} shown)",
              len(mel) == 1 and mel[0]["wish"] and mel[0]["level"] == 90 and "Bazett's support" in mel[0]["notes"] and rows(a) == 3 and "In your Guests" in a.locator("#dossier .fv-guest").inner_text())
        a.click('#fv-bar [data-action="fv-close"]'); a.wait_for_timeout(1500)
        check("back to yours: the new Guest is there, and your own story wasn't touched", a.locator('#list .wish-pick').filter(has_text="Mélusine").count() == 1 and a.evaluate("localStorage.getItem('spirit-origin-list:v1:story')") is None)
        a.click("#tab-versus"); a.wait_for_timeout(1000)
        fopt = a.evaluate("(() => { const cur = [...document.querySelectorAll('.vs-sel')].map(s => s.value); const o = [...document.querySelectorAll('[data-vs-pick=\"0\"] option[value^=\"f:\"]')].find(o => !cur.includes(o.value)); return o ? o.value : null; })()")
        a.select_option('[data-vs-pick="0"]', fopt); a.wait_for_timeout(800)
        check(f"Versus: a friend's servant picked from the list at the top is taken ({fopt})", fopt and a.locator(".vs-hero .fr-tag").count() == 2 and a.evaluate("document.querySelector('[data-vs-pick=\"0\"]').value") == fopt)
        a.route("https://api.atlasacademy.io/**", story_fx)
        a.evaluate("localStorage.setItem('spirit-origin-list:v1:story', JSON.stringify({pos: {w: 100, q: 1000010, ph: 1}, theme: true, part: '1'}))")
        a.reload(); a.wait_for_timeout(3000); a.click("#tab-story"); a.wait_for_timeout(2500)
        borrow = a.locator("#story .st-borrow").inner_text() if a.locator("#story .st-borrow").count() else ""
        check(f"the Story page's Worth borrowing counts friends' supports ({borrow[:110]})", "Bazett's support" in borrow and "Scathach-Skadi" in borrow)
        a.click("#tab-versus"); a.wait_for_timeout(2500)
        check("and a friend's servant picked in Versus is still there after a reload", a.locator(".vs-hero .fr-tag").count() >= 1)
        B.post("/api/sync", {"changes": [{"col": "servants", "id": "melusine", "data": sv("Melusine", 312, "Lancer", level=100)}]})
        a.click("#tab-friends"); a.wait_for_timeout(400); a.click('[data-action="fr-reload"]'); a.wait_for_timeout(1500)
        check("what friends are up to: Bazett grailed Melusine", "Bazett grailed Melusine to Lv 100" in a.locator(".fr-feed").inner_text())
        # ---------- a shared link, signed out ----------
        s, r, _ = B.post("/api/account", {"vis": "link"})
        c4, z = browser_ctx(b, 390, 844, True)
        z.goto(base + "/?roster=" + r["user"]["share"] + "#servants"); z.wait_for_timeout(3500)
        check(f"a shared link opens the roster for anyone ({rows(z)})", rows(z) == 3 and "shared link" in z.locator("#fv-bar").inner_text())
        # ---------- offline, and signing out ----------
        a.click("#tab-servants"); a.wait_for_timeout(500)
        c1.set_offline(True); a.reload(); a.wait_for_timeout(3000)
        check(f"offline, the app still opens with the roster ({rows(a)})", a.title() == "Fate/Grand Index" and rows(a) == n0 + 2)
        c1.set_offline(False); a.reload(); a.wait_for_timeout(3000)
        a.click("#acct-btn"); a.wait_for_selector('[data-action="acct-signout"]'); a.click('[data-action="acct-signout"]'); a.wait_for_timeout(1500)
        check("signed out: the roster stays in the browser", rows(a) == n0 + 2 and a.locator("#acct-btn").inner_text().strip() == "Sign in")
        check(f"no errors on any page ({errs[:2]})", not errs)
        b.close()

if __name__ == "__main__":
    with hosted.server(seeded=True) as (base, mport): run(base)
    if fails: print(hosted.server.log[-2500:])
    print("ALL PASSED" if not fails else "FAILED %d: %s" % (len(fails), fails))
    sys.exit(1 if fails else 0)
