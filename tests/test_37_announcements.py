import os
# 0.28.0: announcements at the top of Home. The 100 million downloads stream (7 Nov 2026, 20:00 JST): a countdown in the
# reader's own time, On now while it's on, then that it has aired (with the wording after it), gone after 21 Nov.
# Hide (with Undo) is remembered. Shown with live updates off too.
import sys, datetime
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9')"
UTC = datetime.timezone.utc
T = lambda *a: datetime.datetime(*a, tzinfo=UTC)
def page(b, when, w=1440, fixed=True, tz="Europe/Amsterdam"):
    ctx = b.new_context(viewport={"width": w, "height": 900}, timezone_id=tz)
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    if fixed: pg.clock.set_fixed_time(when)
    else: pg.clock.install(time=when)
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(1500)
    return ctx, pg
txt = lambda pg, sel: pg.locator(sel).first.inner_text() if pg.locator(sel).count() else ""
def secs(t):
    d, _, hms = t.rpartition(" "); h, m, s = (int(x) for x in hms.split(":"))
    return (int(d.rstrip("d")) if d else 0) * 86400 + h * 3600 + m * 60 + s
LEFT = 5 * 86400 + 19 * 3600 + 13 * 60 + 53   # from 1 Nov 15:46:07 UTC to 7 Nov 11:00 UTC
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- before the stream ----------
    ctx, pg = page(b, T(2026, 11, 1, 15, 45, 57), fixed=False)
    pg.clock.pause_at(T(2026, 11, 1, 15, 46, 7)); pg.wait_for_timeout(300)
    check("Home shows the announcement under the greeting (live updates are off)", pg.locator("#home .hm-hero + .an-list .an").count() == 1)
    check("about the 100 million downloads", "100 million downloads" in txt(pg, ".an-title") and "Japanese, English, Simplified Chinese, Traditional Chinese and Korean" in txt(pg, ".an-body"))
    cd0 = txt(pg, ".an-cd")
    check(f"a countdown to the stream ({cd0})", secs(cd0) in (LEFT, LEFT + 1))
    pg.clock.run_for(3000); pg.wait_for_timeout(200)
    check(f"that moves every second ({txt(pg, '.an-cd')})", secs(txt(pg, ".an-cd")) == secs(cd0) - 3)
    when = txt(pg, ".an-when")
    check(f"in your own time, with JST and NA's ({when!r})", "Sat 7 Nov, 12:00 your time" in when and "20:00 JST" in when and "03:00 in NA" in when)
    w = pg.locator(".an-watch")
    check("Watch on YouTube opens FGO's channel's live page in a new tab", w.get_attribute("href") == "https://www.youtube.com/channel/UCXBgKqFxSjKADEuMLkc1Bpg/live" and w.get_attribute("target") == "_blank")
    check("the official announcement is linked", pg.locator('.an-links a[href="https://news.fate-go.jp/2026/10/1031nico/"]').count() == 1)
    check("and the stream's name and where it's shown", "Worldwide Simultaneous Stream SP" in txt(pg, ".an-show") and "YouTube Live, Niconico Live and X" in txt(pg, ".an-show"))
    # the countdown login bonus, on every server: NA's seven days, today marked (1 Nov 15:46 UTC is 1 Nov in NA, day 1 runs to 20:00 PST)
    days = pg.locator(".an-days li")
    check(f"every server's countdown login bonus, NA's days ({days.count()} days)", "Countdown login bonus" in txt(pg, ".an-bh") and "every server" in txt(pg, ".an-bh").lower() and "NA's days, until 7 Nov, 19:59 PST" in txt(pg, ".an-bh") and days.count() == 7)
    check(f"today is marked ({txt(pg, '.an-days li.today')!r})", pg.locator(".an-days li.today").count() == 1 and "10 Golden Fruit" in txt(pg, ".an-days li.today") and "Sun 1 Nov" in txt(pg, ".an-days li.today"))
    check(f"with when a new day starts, in NA and your time, and JP's ({txt(pg, '.an-bonus .an-note')!r})", "20:00 PST (05:00 your time)" in txt(pg, ".an-bonus .an-note") and "9 hours earlier, at 04:00 JST" in txt(pg, ".an-bonus .an-note"))
    check("and both login bonus announcements are linked (NA and JP)", pg.locator('.an-links a[href="https://webview.fate-go.us/iframe/2026/1031_100million_cd/"]').count() == 1 and pg.locator('.an-links a[href="https://news.fate-go.jp/2026/10/100mdl/"]').count() == 1)
    # Hide, Undo, and Hide remembered
    pg.click('.an [data-action="an-hide"]'); pg.wait_for_timeout(300)
    check("Hide puts it away", pg.locator(".an").count() == 0 and pg.evaluate("JSON.parse(localStorage.getItem('spirit-origin-list:v1:announce'))") == ["100mdl-2026"])
    pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(300)
    check("Undo brings it back", pg.locator(".an").count() == 1 and pg.evaluate("JSON.parse(localStorage.getItem('spirit-origin-list:v1:announce'))") == [])
    pg.click('.an [data-action="an-hide"]'); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_timeout(1500)
    check("hidden stays hidden after a reload", pg.locator(".an").count() == 0)
    ctx.close()
    # ---------- a stream that starts while Home is open ----------
    ctx, pg = page(b, T(2026, 11, 7, 10, 59, 48), fixed=False)
    pg.clock.pause_at(T(2026, 11, 7, 10, 59, 58)); pg.wait_for_timeout(200)
    check(f"seconds before: {txt(pg, '.an-cd')}", secs(txt(pg, ".an-cd")) in (2, 3))
    pg.clock.run_for(3000); pg.wait_for_timeout(300)
    check("when it starts the card says On now and Watch now", "on now" in txt(pg, ".an-stream").lower() and txt(pg, ".an-watch").startswith("Watch now"))
    ctx.close()
    # ---------- a new login bonus day starts while Home is open ----------
    ctx, pg = page(b, T(2026, 11, 2, 3, 59, 48), fixed=False)
    pg.clock.pause_at(T(2026, 11, 2, 3, 59, 58)); pg.wait_for_timeout(200)
    before = txt(pg, ".an-days li.today")
    pg.clock.run_for(3000); pg.wait_for_timeout(300)
    after = txt(pg, ".an-days li.today")
    check(f"at 20:00 PST the next day is today ({before.splitlines()[-1]!r} → {after.splitlines()[-1]!r})", "Golden Fruit" in before and "Star Fou ★3 (HP)" in after and pg.locator(".an-days li.past").count() == 1)
    ctx.close()
    # ---------- after ----------
    ctx, pg = page(b, T(2026, 11, 9, 9, 0))
    check("after the stream: it has aired, in the past tense", "has aired" in txt(pg, ".an-stream").lower() and "was revealed on 7 November" in txt(pg, ".an-body") and pg.locator(".an-bonus").count() == 0)
    ctx.close()
    for t, label in ((T(2026, 11, 21, 0, 1), "gone after 21 November"), (T(2026, 10, 30, 12, 0), "not there before it was announced")):
        ctx, pg = page(b, t)
        check(label, pg.locator(".an").count() == 0)
        ctx.close()
    # ---------- elsewhere in the world, and on a phone ----------
    ctx, pg = page(b, T(2026, 11, 2, 0, 0), tz="America/New_York")
    check(f"New York sees its own time ({txt(pg, '.an-when').splitlines()[0]!r})", txt(pg, ".an-when").startswith("Sat 7 Nov, 06:00 your time"))
    ctx.close()
    ctx, pg = page(b, T(2026, 11, 2, 0, 0), w=390)
    over = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(f"phone: the card fits ({over}px sideways)", pg.locator(".an").count() == 1 and over <= 1)
    pg.locator(".an-list").screenshot(path=f"{sp}/out/an-phone.png")
    ctx.close()
    check(f"no script errors ({errs[:3]})", not errs)
    b.close()
print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
