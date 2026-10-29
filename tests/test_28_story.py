import os
# 0.24.0: the Story page. Chapters by part, a chapter's sections with arrows, each battle's enemies by wave (break bars
# and reinforcements included), "I'm here", the next fight's best classes and servants, "Cleared it" moving on (into
# the next chapter at the end), and the chapter's look on the other pages: its colours, its backdrop and its plate by
# the logo, gone on the servant page and when turned off. Atlas Academy is stood in for by tests/fixtures/story.
import sys, re, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "story")
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}))"
STK = "JSON.parse(localStorage.getItem('spirit-origin-list:v1:story') || '{}')"
DOWN = set()
def atlas(route):
    u = route.request.url
    m = re.search(r"/nice/NA/war/(\d+)", u)
    f = f"{FX}/war-{m.group(1)}.json" if m else ""
    if not m:
        m = re.search(r"/nice/NA/quest/(\d+)/(\d+)", u); f = f"{FX}/quest-{m.group(1)}-{m.group(2)}.json" if m else ""
    if any(k in u for k in DOWN): route.fulfill(status=503, body="{}", headers={"Access-Control-Allow-Origin": "*"}); return
    if f and os.path.exists(f): route.fulfill(path=f, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"})
    else: route.fulfill(status=404, body="{}", headers={"Access-Control-Allow-Origin": "*"})
def page(ctx):
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://api.atlasacademy.io/**", atlas)
    # BB Dubai, Kingprotea (Alter) and Kishinami Hakuno have no enemy picture on Atlas Academy; NA has no plate for Archetype Inception
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="") if ("Enemys/9945" in r.request.url or "_closed" in r.request.url) else r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    pg.route("https://fonts.**", lambda r: r.abort())
    return pg
# the tones are set on the page's own style (getComputedStyle would catch them halfway through their 1.6 s fade)
G1 = "document.documentElement.style.getPropertyValue('--g1').trim()"
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1360, "height": 900}); pg = page(ctx)
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(1400)
    g1_default = pg.evaluate(G1)
    pg.click("#tab-story"); pg.wait_for_timeout(800)
    chips = pg.evaluate("[...document.querySelectorAll('#story .st-ch > b')].map(e => e.textContent)")
    check(f"the Story tab lists Part 1's chapters ({chips})", chips[:2] == ["Fuyuki", "Orleans"] and chips[-1] == "Solomon" and len(chips) == 9)
    pg.click('#story [data-action="st-part"][data-k="2"]'); pg.wait_for_timeout(300)
    p2 = pg.evaluate("[...document.querySelectorAll('#story .st-ch > b')].map(e => e.textContent)")
    plates = pg.evaluate("Object.fromEntries([...document.querySelectorAll('#story .st-ch')].map(b => { const i = b.querySelector('img.st-cap'); return [b.dataset.w, i ? i.getAttribute('src').split('/').pop() : '']; }))")
    check(f"each chapter is its own plate, and from Lostbelt No.3 on the plates are the right ones ({plates})", plates.get("302") == "questboard_cap302.png" and plates.get("305") == "questboard_cap307.png" and plates.get("306") == "questboard_cap308.png" and plates.get("307") == "questboard_cap309.png" and plates.get("308") == "questboard_cap312.png" and plates.get("309") == "questboard_cap313.png" and plates.get("310") == "questboard_cap315.png" and plates.get("311") == "questboard_cap317.png")
    chip = pg.evaluate("(() => { const b = document.querySelector('#story .st-ch[data-w=\"306\"]'), cs = getComputedStyle(b), p = b.querySelector('.st-plate').getBoundingClientRect(); return [cs.backgroundColor, cs.borderTopWidth, Math.round(p.width), Math.round(p.height)]; })()")
    check(f"with nothing around it, and big enough to read ({chip})", chip[0] in ("rgba(0, 0, 0, 0)", "transparent") and chip[1] == "0px" and chip[2] >= 240 and chip[3] >= 70)
    check(f"Part 2 runs from the Prologue to Nahui Mictlan ({len(p2)} chapters)", "Götterdämmerung" in p2 and p2[-1] == "Nahui Mictlan" and "Traum" in p2)
    pg.click('#story [data-action="st-part"][data-k="oc"]'); pg.wait_for_timeout(300)
    oc = pg.evaluate("[...document.querySelectorAll('#story .st-ch > b')].map(e => e.textContent)")
    check(f"Ordeal Call has what NA released, up to Archetype Inception ({oc})", oc[-1] == "Archetype Inception" and "Paper Moon" in oc)
    check("with nothing picked, it asks where you are", "Pick the chapter" in pg.locator("#story .st-pos").inner_text())
    pg.click('#story [data-action="st-part"][data-k="1"]'); pg.wait_for_timeout(300)
    pg.click('#story [data-action="st-ch"][data-w="100"]'); pg.wait_for_selector("#story .st-secs", timeout=10000); pg.wait_for_timeout(800)
    secs = pg.evaluate("[...document.querySelectorAll('#story .st-sec')].map(e => e.textContent)")
    check(f"Fuyuki's main-story sections, in order, without its free quest ({secs})", secs == ["Prologue", "1", "2", "10"])
    check("the chapter's title plate and name are shown", "Fuyuki" in pg.locator("#story .st-title h3").inner_text() and pg.locator("#story .st-title img.st-cap").count() == 1)
    check("the left arrow is off on the first section", pg.locator('#story [data-action="st-sec"][data-d="-1"]').is_disabled())
    pg.click('#story [data-action="st-sec"][data-d="1"]'); pg.wait_for_timeout(700)
    OPEN = "#story .st-row.open .st-row-n b"
    check(f"› opens the next section ({pg.locator(OPEN).inner_text()!r})", pg.locator(OPEN).inner_text() == "Burning City" and pg.locator("#story .st-row.open").count() == 1)
    pg.click('#story [data-action="st-sec"][data-d="1"]'); pg.wait_for_timeout(500)
    check("a section without battles says so", "Story only" in pg.locator("#story .st-fight").inner_text())
    pg.click('#story [data-action="st-sec"][data-d="-1"]'); pg.wait_for_timeout(500)
    check("‹ goes back", pg.locator(OPEN).inner_text() == "Burning City")
    pg.click('#story [data-action="st-q"][data-q="1000010"]'); pg.wait_for_timeout(700)
    check("the last section turns the right arrow off", pg.locator('#story [data-action="st-sec"][data-d="1"]').is_disabled())
    bats = pg.evaluate("[...document.querySelectorAll('#story .st-bat')].map(e => e.textContent)")
    check(f"a section shows its battles ({bats})", bats == ["Battle 1", "Battle 2", "Battle 3"])
    w = pg.evaluate("[...document.querySelectorAll('#story .st-wave')].map(w => w.querySelectorAll('.st-en').length)")
    check(f"battle 1 lists its waves and enemies ({w})", w == [3, 2])
    pg.click('#story [data-action="st-ph"][data-ph="3"]'); pg.wait_for_timeout(800)
    boss = pg.locator("#story .st-en.boss").first.inner_text()
    check(f"the boss shows all three HP bars ({' '.join(boss.split())!r})", "22,416" in boss and "40,000" in boss and "60,000" in boss and "3 bars" in boss)
    check("its traits and charge", "Dragon" in boss and "charge 4" in boss)
    check("a reinforcement is marked as arriving later", "arrives later" in pg.locator("#story .st-en.rein").inner_text())
    check("the battle's field is named", "Field City" in pg.locator("#story .st-fld").inner_text())

    # ---------- I'm here, and the next fight ----------
    pg.click('#story [data-action="st-here"]'); pg.wait_for_timeout(1200)
    st = pg.evaluate(STK)
    check(f"I'm here saves where you are ({st.get('pos')})", st.get("pos") == {"w": 100, "q": 1000010, "ph": 3})
    nx = pg.locator("#story .st-next")
    check("the next fight is shown above the chapters", nx.count() == 1 and "Facing the Greater Grail" in nx.inner_text() and "battle 3 of 3" in nx.inner_text())
    cls = pg.evaluate("[...document.querySelectorAll('#story .st-ccard b')].map(e => e.textContent)")
    check(f"the best classes against a Saber come first ({cls})", cls[0] in ("Archer", "Berserker", "Pretender") and "Archer" in cls[:3])
    best = pg.evaluate("[...document.querySelectorAll('#story .st-best .st-sv')].map(e => [e.dataset.id, parseInt(e.querySelector('.st-sv-n b').textContent)])")
    check(f"servants from your list are ranked by how much of the fight one NP a wave takes ({best})", len(best) >= 3 and [x[1] for x in best] == sorted([x[1] for x in best], reverse=True))
    pg.locator("#story .st-best .st-sv").first.click(); pg.wait_for_timeout(800)
    check("a pick opens that servant", pg.evaluate("location.hash") == "#servants" and pg.locator("#dossier .d-head h2").count() == 1)

    # ---------- the chapter's look ----------
    check("on the servant page the chapter's look steps aside", not pg.evaluate("document.documentElement.classList.contains('story-on')"))
    pg.click("#tab-home"); pg.wait_for_timeout(1000)
    on = pg.evaluate("document.documentElement.classList.contains('story-on')")
    bg = pg.evaluate("(() => { const b = document.getElementById('story-bg'); return b ? [b.dataset.m, b.classList.contains('on'), b.style.getPropertyValue('--c1'), b.children.length] : null; })()")
    check(f"on Home the page wears Fuyuki's look ({bg})", on and bg and bg[0] == "embers" and bg[1] and bg[2] == "#d9542b" and bg[3] >= 10)
    check(f"and its colours ({pg.evaluate(G1)} vs {g1_default})", pg.evaluate(G1) != g1_default)
    plate = pg.evaluate("(() => { const p = document.getElementById('story-plate'); return p && !p.hidden ? p.querySelector('img').getAttribute('src') : null; })()")
    check(f"its plate sits next to the logo ({plate})", plate and plate.endswith("questboard_cap100.png"))
    anims = pg.evaluate("(() => { const i = document.querySelector('#story-bg i'); const cs = getComputedStyle(i); return [cs.animationName, getComputedStyle(document.getElementById('story-bg')).position]; })()")
    check(f"the backdrop moves with CSS only ({anims})", anims[0] == "sb-rise" and anims[1] == "fixed")
    pg.click("#story-plate"); pg.wait_for_timeout(600)
    check("the plate opens the Story page", pg.evaluate("location.hash") == "#story")
    pg.uncheck("#story input[data-st-theme]"); pg.wait_for_timeout(700)
    check(f"turning the look off takes it all away ({pg.evaluate(G1)})", not pg.evaluate("document.documentElement.classList.contains('story-on')") and pg.evaluate(G1) == g1_default and pg.evaluate("document.getElementById('story-plate').hidden"))
    pg.check("#story input[data-st-theme]"); pg.wait_for_timeout(700)
    check("and back on", pg.evaluate("document.documentElement.classList.contains('story-on')"))

    # ---------- Cleared it: on to the next fight, and the next chapter ----------
    pg.click('#story [data-action="st-ch"][data-w="100"]'); pg.wait_for_timeout(600)
    pg.click('#story [data-action="st-next"]'); pg.wait_for_timeout(1500)
    st = pg.evaluate(STK)
    check(f"clearing Fuyuki's last fight moves you to Orleans ({st.get('pos')})", st.get("pos", {}).get("w") == 101 and st.get("pos", {}).get("q") == 1001001)
    check("the page opens Orleans", "Orleans" in pg.locator("#story .st-title h3").inner_text())
    plate = pg.evaluate("document.querySelector('#story-plate img').getAttribute('src')")
    check(f"and the look follows ({plate})", plate.endswith("questboard_cap101.png") and pg.evaluate("document.getElementById('story-bg').style.getPropertyValue('--c1')") == "#3b5ca8")
    pg.reload(); pg.wait_for_timeout(1500)
    check(f"after a reload you're still there ({pg.locator('#story .st-pos').inner_text()!r})", "Orleans" in pg.locator("#story .st-pos").inner_text())

    # ---------- Götterdämmerung: red and cyan, fire and ice; and when Atlas doesn't answer ----------
    DOWN.add("/war/302")
    pg.click('#story [data-action="st-part"][data-k="2"]'); pg.wait_for_timeout(300)
    pg.click('#story [data-action="st-ch"][data-w="302"]'); pg.wait_for_timeout(1500)
    check("when Atlas Academy doesn't answer it says so, with Try again", "didn't answer" in pg.locator("#story .st-msg").inner_text())
    DOWN.clear()
    pg.click('#story [data-action="st-retry"]'); pg.wait_for_timeout(1500)
    check("Try again loads it", "Götterdämmerung" in pg.locator("#story .st-title h3").inner_text())
    pg.click('#story [data-action="st-here"]'); pg.wait_for_timeout(1200)
    bg = pg.evaluate("(() => { const b = document.getElementById('story-bg'); return [b.dataset.m, b.style.getPropertyValue('--c1'), b.style.getPropertyValue('--c2'), b.querySelectorAll('i.k1').length, b.querySelectorAll('i.k2').length]; })()")
    check(f"Götterdämmerung is red and cyan, with embers and snow ({bg})", bg[0] == "icefire" and bg[1] == "#c8283c" and bg[2] == "#2ec8e0" and bg[3] > 5 and bg[4] > 5)

    # ---------- Nahui Mictlan: the game's order, labels with parts, side battles left out ----------
    pg.click('#story [data-action="st-ch"][data-w="311"]'); pg.wait_for_selector("#story .st-secs", timeout=10000); pg.wait_for_timeout(800)
    secs = pg.evaluate("[...document.querySelectorAll('#story .st-sec')].map(e => e.textContent)")
    check(f"sections in the game's order (one without a priority after the section before it), a section in two parts as 4-1 and 4-2, no Decisive Battles ({secs})", secs == ["Prologue-1", "Prologue-2", "1", "Fragment of a Dream", "2", "4-1", "4-2", "Act II", "Epilogue"])
    rows = pg.evaluate("[...document.querySelectorAll('#story .st-row .st-row-k')].map(e => e.textContent)")
    check(f"each row names its section ({rows})", rows == ["Prologue-1", "Prologue-2", "Section 1", "", "Section 2", "Section 4-1", "Section 4-2", "Act II", "Epilogue"])
    check(f"the count leaves the side battles out ({pg.locator('#story .st-title p').inner_text()!r})", pg.locator("#story .st-title p").inner_text() == "9 sections · 6 battles")
    pg.evaluate("window.scrollTo(0, 0)")
    pg.click('#story .st-sec[data-q="3000710"]'); pg.wait_for_timeout(600)
    last = None
    for i in range(20):  # until the smooth scroll settles
        pg.wait_for_timeout(200); y = pg.evaluate("scrollY")
        if y == last: break
        last = y
    pos = pg.evaluate("(() => { const r = document.querySelector('#story .st-row.open'), s = document.querySelector('#story .st-strip').getBoundingClientRect(); return [r.dataset.q, Math.round(r.getBoundingClientRect().top), Math.round(s.top), Math.round(s.bottom), scrollY]; })()")
    check(f"a section in the strip opens its row and brings it up, under the strip that stays on top ({pos})", pos[0] == "3000710" and pos[4] > 0 and abs(pos[2]) <= 2 and pos[3] - 4 <= pos[1] <= pos[3] + 30)
    pg.wait_for_timeout(800)
    faces = pg.evaluate("[...document.querySelectorAll('#story .st-row.open .st-en')].map(li => { const i = li.querySelector('.st-fwrap img:not(.fb)'), fb = li.querySelector('.st-fwrap .fb'); return [li.querySelector('b').textContent, i && !i.classList.contains('bad') ? i.getAttribute('src').split('/').pop() : '', fb ? getComputedStyle(fb).display : '']; })")
    check(f"no enemy without a picture: the playable servant's face, else the class emblem ({faces})", faces[0][1] == "f_23006000.png" and faces[1][1] == "" and faces[1][2] == "block" and faces[2][1] in ("f_23007000.png", "f_23008000.png"))
    tr = pg.evaluate("document.querySelector('#story .st-row.open .st-en .st-tr').textContent")
    check(f"traits without the noise (alignments, star counts) ({tr!r})", tr == "DemonicGiant")
    hd = pg.locator('#story .st-row[data-q="3000710"] .st-row-h')
    hd.click(); pg.wait_for_timeout(400)
    check("its heading folds it", pg.locator("#story .st-row.open").count() == 0 and hd.get_attribute("aria-expanded") == "false")
    hd.click(); pg.wait_for_timeout(400)
    check("and opens it again", pg.locator('#story .st-row.open').get_attribute("data-q") == "3000710")
    pg.locator('#story .st-row[data-q="3000720"] .st-row-h').click(); pg.wait_for_timeout(600)
    check("another row's heading opens that one instead", pg.locator('#story .st-row.open').get_attribute("data-q") == "3000720" and pg.locator("#story .st-row.open .st-bat").count() == 2)
    # Archetype Inception: no plate on NA yet, so one is drawn
    pg.click('#story [data-action="st-part"][data-k="oc"]'); pg.wait_for_timeout(300)
    ai = pg.evaluate("(() => { const b = document.querySelector('#story .st-ch[data-w=\"404\"]'), p = b.querySelector('.st-plate'); return [p.classList.contains('drawn'), !!p.querySelector('img'), p.querySelector('.st-txt').innerText.replace(/\\s+/g, ' ')]; })()")
    check(f"Archetype Inception's plate is drawn in its colours ({ai})", ai[0] and not ai[1] and "archetype inception" in ai[2].lower() and "ordeal call iii" in ai[2].lower())
    pg.click('#story [data-action="st-ch"][data-w="404"]'); pg.wait_for_timeout(1200)
    check("on its page too, not NA's closed placeholder", pg.locator("#story .st-title .st-plate.drawn").count() == 1 and pg.locator("#story .st-title img").count() == 0)
    ctx.close()

    # ---------- a phone ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = page(ctx)
    pg.goto(SEEDED + "#story"); pg.wait_for_timeout(1300)
    pg.click('#story [data-action="st-ch"][data-w="100"]'); pg.wait_for_selector("#story .st-secs", timeout=10000)
    pg.click('#story [data-action="st-q"][data-q="1000010"]'); pg.wait_for_timeout(800); pg.click('#story [data-action="st-ph"][data-ph="3"]'); pg.wait_for_timeout(800)
    pg.click('#story [data-action="st-here"]'); pg.wait_for_timeout(1200)
    wide = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
    check(f"on a phone the Story page doesn't scroll sideways ({wide})", wide[0] <= wide[1])
    ctx.close(); b.close()
print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
