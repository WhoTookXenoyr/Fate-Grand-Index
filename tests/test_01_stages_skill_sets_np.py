import os
import sys, tempfile
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
NEW = f"{URL}/_seeded.html#servants"
errs = []
prof = tempfile.mkdtemp()
def page(ctx):
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    return pg
def check(label, ok): print(("PASS " if ok else "FAIL ") + label)
STORE = "JSON.parse(localStorage.getItem('spirit-origin-list:v1')).servants.find(s=>s.id==='%s')"
SID = "lady-avalon"
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 1100})
    pg = page(ctx); pg.goto(NEW); pg.wait_for_timeout(1000)
    def up(sid, slot, f):
        pg.click(f'[data-id="{sid}"]'); pg.wait_for_timeout(150)
        pg.click(f'[data-action="stage"][data-slot="{slot}"]'); pg.wait_for_timeout(150)
        pg.set_input_files(f'input[data-art-file="{slot}"]', f"{sp}/{f}.png"); pg.wait_for_timeout(600)
    up(SID, "1", "ph_purple"); up(SID, "c", "ph_blue"); up("artoria", "1", "ph_red")
    pg.click(f'[data-id="{SID}"]'); pg.wait_for_timeout(300)
    pg.click('[data-action="stage"][data-slot="c"]'); pg.wait_for_timeout(300)
    pg.fill("#cos-name", "Ortenaus"); pg.press("#cos-name", "Enter"); pg.wait_for_timeout(400)
    # ---- class logo + badge
    check("class badge with logo under the stage pictures", pg.locator(".scene .cls-badge img").count() == 1 and pg.locator(".scene .cls-badge b").inner_text() == "Pretender")
    check("extra-class banner", pg.evaluate("document.querySelector('.scene').classList.contains('extra')"))
    check(f"logos in roster rows without art: {pg.locator('#list img.avatar.logo').count()}", pg.locator("#list img.avatar.logo").count() >= 15)
    # ---- skill sets
    base1 = pg.locator("article.skill h4").first.inner_text()
    pg.click('[data-action="sk-sets-on"]'); pg.wait_for_timeout(400)
    check("new set auto-linked to the costume on screen", pg.locator('[data-action="sk-link"][aria-pressed="true"]').count() == 1)
    pg.fill('[data-skset-name="1"]', "Ortenaus set"); pg.press('[data-skset-name="1"]', "Enter"); pg.wait_for_timeout(300)
    pg.click('[data-action="sk-set-edit"][data-k="1"]'); pg.wait_for_timeout(400)
    for i, nm in enumerate(["Shield of Chaldea", "Ortenaus Guard", "Obscurant Wall"]):
        pg.fill(f"#ss1-s{i+1}-name", nm)
    pg.fill("#ss1-s1-cd", "7"); pg.fill("#ss1-s1-rows .sc-row >> nth=0 >> [data-sc=label]", "DEF +"); pg.fill("#ss1-s1-rows .sc-row >> nth=0 >> [data-sc=v1]", "15"); pg.fill("#ss1-s1-rows .sc-row >> nth=0 >> [data-sc=v10]", "30"); pg.fill("#ss1-s1-rows .sc-row >> nth=0 >> [data-sc=unit]", "%")
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(600)
    # costume on screen -> the linked set's skills
    first_on_costume = pg.locator("article.skill h4").first.inner_text()
    check(f"costume shows its own skills ({first_on_costume!r})", first_on_costume == "Shield of Chaldea")
    pg.click('[data-action="stage"][data-slot="1"]'); pg.wait_for_timeout(400)
    check(f"stage 1 shows default skills ({pg.locator('article.skill h4').first.inner_text()!r})", pg.locator("article.skill h4").first.inner_text() == base1)
    pg.click('[data-action="sk-set"][data-k="1"]'); pg.wait_for_timeout(500)
    check("picking the set's tab switches the picture to its costume", pg.locator('.stage-btn[data-slot="c"][aria-pressed="true"]').count() == 1)
    pg.click('[data-action="sk-set"][data-k="0"]'); pg.wait_for_timeout(500)
    check("Default tab goes back to a stage", pg.locator('.stage-btn[data-slot="1"][aria-pressed="true"]').count() == 1)
    # an unlinked NP-form set
    pg.click('[data-action="sk-mgr"]'); pg.wait_for_timeout(200)
    if pg.locator('[data-action="sk-set-add"]').count() == 0: pg.click('[data-action="sk-mgr"]'); pg.wait_for_timeout(200)
    pg.click('[data-action="sk-set-add"]'); pg.wait_for_timeout(300)
    pg.fill('[data-skset-name="2"]', "Super form"); pg.press('[data-skset-name="2"]', "Enter"); pg.wait_for_timeout(300)
    pg.click('[data-action="sk-set"][data-k="2"]'); pg.wait_for_timeout(300)
    check("NP-form set opens from its tab without changing the picture", pg.locator('.stage-btn[data-slot="1"][aria-pressed="true"]').count() == 1 and pg.locator(".sk-note").inner_text().startswith("Skills for this NP form"))
    pg.locator(".sk-mgr").screenshot(path=f"{sp}/v6-skillsets-mgr.png")
    pg.locator(".sk-tabs").evaluate("e => e.closest('section').scrollIntoView()"); pg.wait_for_timeout(200)
    pg.locator(".sk-tabs").evaluate("e => e.closest('section')").__class__  # noop
    pg.screenshot(path=f"{sp}/v6-skills.png")
    # ---- NP forms
    pg.click('[data-action="stage"][data-slot="c"]'); pg.wait_for_timeout(300)
    pg.click('[data-action="np-edit"]'); pg.wait_for_timeout(300)
    pg.click('[data-action="np-form-add"]'); pg.wait_for_timeout(400)
    check("new NP form auto-linked to the costume", pg.locator('[data-action="np-link"][aria-pressed="true"]').count() == 1)
    pg.fill("#np-form", "Paladin"); pg.wait_for_timeout(100)
    pg.click('[data-np="f:name"]'); pg.keyboard.press("Control+A"); pg.keyboard.type("Lord Camelot")
    pg.click('[data-action="np-ver-add"]'); pg.wait_for_timeout(300)
    pg.fill("#np-tab", "Lord Chaldeas"); pg.wait_for_timeout(100)
    pg.click('[data-np="f:name"]'); pg.keyboard.press("Control+A"); pg.keyboard.type("Lord Chaldeas")
    pg.wait_for_timeout(800)
    pg.locator(".np-sec").screenshot(path=f"{sp}/v6-np-edit.png")
    pg.click('[data-action="np-edit"]'); pg.wait_for_timeout(300)
    forms = pg.locator(".npt-forms button").all_inner_texts(); vers = pg.locator(".npt-vers button").all_inner_texts()
    check(f"two bars: forms {forms} / versions {vers}", len(forms) == 2 and "Paladin" in forms[1] and len(vers) == 2)
    pg.locator(".np-sec").screenshot(path=f"{sp}/v6-np-view.png")
    pg.click('[data-action="stage"][data-slot="1"]'); pg.wait_for_timeout(400)
    check(f"stage 1 shows the default NP ({pg.locator('.npt-title b').inner_text()!r})", pg.locator('.npt-forms [aria-selected="true"]').inner_text().startswith("Default"))
    pg.click('[data-action="np-form"][data-i="1"]'); pg.wait_for_timeout(400)
    check("picking the Paladin form switches the picture to its costume", pg.locator('.stage-btn[data-slot="c"][aria-pressed="true"]').count() == 1)
    pg.reload(); pg.wait_for_timeout(1200); pg.click(f'[data-id="{SID}"]'); pg.wait_for_timeout(400)
    st = pg.evaluate(STORE % SID)
    check(f"saved: {len(st['skillSets'])} skill sets, NP forms {[g['name'] for g in st['npTable']['g']]}, base skill kept",
          len(st["skillSets"]) == 2 and st["skillSets"][0]["info"][0]["name"] == "Shield of Chaldea" and [g["name"] for g in st["npTable"]["g"]] == ["", "Paladin"] and st["skillInfo"][0]["name"].strip("()") == base1)
    # ---- parties show logos
    pg.click('[data-action="tab"][data-tab="parties"]'); pg.wait_for_timeout(500)
    check(f"party cards use class logos ({pg.locator('.fc-logo').count()})", pg.locator(".fc-logo").count() >= 50)
    pg.locator(".party").first.screenshot(path=f"{sp}/v6-party.png")
    pg.click('[data-action="tab"][data-tab="servants"]'); pg.wait_for_timeout(300)
    # ---- every class: banner + page
    classes = ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker", "Ruler", "Avenger", "Moon Cancer", "Alter Ego", "Foreigner", "Pretender", "Shielder", "Beast"]
    shots = []
    for cl in classes:
        pg.evaluate("(cl) => { const k='spirit-origin-list:v1', d=JSON.parse(localStorage.getItem(k)); d.servants.find(x=>x.id==='artoria').cls=cl; localStorage.setItem(k, JSON.stringify(d)); }", cl)
        pg.reload(); pg.wait_for_timeout(700); pg.click('[data-id="artoria"]'); pg.wait_for_timeout(1700)
        drawn = pg.evaluate("(() => { const out=[]; for (const id of ['scene-fx','page-fx']) { const c=document.getElementById(id); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<d.length;i+=16) if (d[i]>0) n++; out.push(n); } return out; })()")
        f = f"{sp}/v6-cls-{cl.replace(' ', '')}.png"; pg.screenshot(path=f, clip={"x": 0, "y": 0, "width": 1360, "height": 1000}); shots.append((cl, f))
        if min(drawn) < 200: print("FAIL", cl, "not drawing", drawn)
    sheet = Image.new("RGB", (5 * 454, 3 * 350), "white"); dr = ImageDraw.Draw(sheet)
    for i, (cl, f) in enumerate(shots):
        im = Image.open(f).convert("RGB").resize((454, 334)); sheet.paste(im, ((i % 5) * 454, (i // 5) * 350)); dr.text(((i % 5) * 454 + 6, (i // 5) * 350 + 336), cl, fill="black")
    sheet.save(f"{sp}/v6-classes.png")
    ctx.close()
    # ---- dark + phones
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 1000}, color_scheme="dark")
    pg = page(ctx); pg.goto(NEW); pg.wait_for_timeout(900)
    for cl in ["Avenger", "Ruler"]:
        pg.evaluate("(cl) => { const k='spirit-origin-list:v1', d=JSON.parse(localStorage.getItem(k)); d.servants.find(x=>x.id==='artoria').cls=cl; localStorage.setItem(k, JSON.stringify(d)); }", cl)
        pg.reload(); pg.wait_for_timeout(700); pg.click('[data-id="artoria"]'); pg.wait_for_timeout(1800)
        pg.screenshot(path=f"{sp}/v6-dark-{cl}.png")
    ctx.close()
    for wdt in (360, 400):
        ctx = p.chromium.launch_persistent_context(prof, viewport={"width": wdt, "height": 860})
        pg = page(ctx); pg.goto(NEW); pg.wait_for_timeout(900)
        pg.click(f'[data-id="{SID}"]'); pg.wait_for_timeout(1200)
        sw = [pg.evaluate("document.documentElement.scrollWidth")]
        pg.click('[data-action="sk-mgr"]'); pg.wait_for_timeout(300); pg.locator(".sk-mgr").scroll_into_view_if_needed()
        sw.append(pg.evaluate("document.documentElement.scrollWidth")); pg.screenshot(path=f"{sp}/v6-phone{wdt}-mgr.png")
        pg.click('[data-action="np-edit"]'); pg.wait_for_timeout(300); pg.locator(".npt-tools").first.scroll_into_view_if_needed()
        sw.append(pg.evaluate("document.documentElement.scrollWidth")); pg.screenshot(path=f"{sp}/v6-phone{wdt}-np.png")
        pg.locator(".cls-badge").scroll_into_view_if_needed(); pg.screenshot(path=f"{sp}/v6-phone{wdt}-badge.png")
        check(f"phone {wdt}: no sideways scroll {sw}", max(sw) <= wdt)
        ctx.close()
print("page errors:", errs)
