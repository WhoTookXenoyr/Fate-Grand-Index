import os
# 0.50.0-beta: the card frame at Lv 100 (rainbow middle edges and a gold aura) and Lv 120 (every gold part rainbow, a
# rainbow aura, the class logo too); Bond 10 (a moving faint rainbow over the SERVANTPAGE with the Bond 10 crystal behind
# it, and rising crystals in the website's background) and Bond 15 (a stronger rainbow, and an intro when the servant
# is opened with a click). The layers don't take clicks, stay under the page's content, come back after a redraw, go
# when the servant drops below the level, and stand still for reduced motion. None of it changes the servant.
import sys, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));localStorage.setItem('spirit-origin-list:v1:statsync','1');localStorage.setItem('spirit-origin-list:v1:cardframe',JSON.stringify({mine:true}))"
KEY = "spirit-origin-list:v1"
ART = "https://static.atlasacademy.io/NA/CharaGraph/1/1a.png"
def page(ctx):
    pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    return pg
def setup(pg, sid, **kw):
    pg.evaluate(f"""(kw) => {{ const d = JSON.parse(localStorage.getItem('{KEY}')), s = d.servants.find((x) => x.id === '{sid}'); Object.assign(s, kw); localStorage.setItem('{KEY}', JSON.stringify(d)); }}""", kw)
    pg.reload(); pg.wait_for_timeout(1300)
def open_(pg, sid): pg.locator(f'#list [data-id="{sid}"]').evaluate("(e) => e.click()"); pg.wait_for_timeout(700)
def frame(pg):
    return pg.evaluate("""() => { const b = document.querySelector('#dossier .art-frame'); if (!b) return null;
      const has = (c) => !!b.querySelector(':scope > ' + c);
      return {cls: Array.from(b.classList).filter((c) => c.startsWith('cf')).sort(), aura: has('.cf-aura'), rb: has('.cf-rb'), rs: has('.cf-rs'), clsrb: !!b.querySelector('.cf-cls .cf-cls-rb'),
        mask: b.querySelector(':scope > .cf-rb') ? getComputedStyle(b.querySelector(':scope > .cf-rb')).webkitMaskImage || getComputedStyle(b.querySelector(':scope > .cf-rb')).maskImage : '',
        pe: Array.from(b.querySelectorAll(':scope > .cf-aura, :scope > .cf-rb, :scope > .cf-rs')).every((e) => getComputedStyle(e).pointerEvents === 'none'),
        anim: Array.from(b.querySelectorAll('.cf-rb i, .cf-aura i')).map((e) => getComputedStyle(e).animationName).join(',')}; }""")
def bond(pg):
    return pg.evaluate("""() => { const d = document.getElementById('dossier'), v = d.querySelector(':scope > .bd-veil'), bg = document.getElementById('bond-bg');
      return {cls: ['bd10', 'bd15'].filter((c) => d.classList.contains(c)), veil: !!v, crystal: !!(v && v.querySelector('.bd-cr svg')), gems: v ? v.querySelectorAll('.bd-cr svg path, .bd-cr svg polygon').length : 0,
        vpe: v ? getComputedStyle(v).pointerEvents : '', vz: v ? getComputedStyle(v).zIndex : '', bg: bg ? Array.from(bg.classList).filter((c) => c !== 'bond-bg').sort() : null,
        bgpe: bg ? getComputedStyle(bg).pointerEvents : '', rb: v ? getComputedStyle(v.querySelector('.bd-rb')).animationName : ''}; }""")
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = page(ctx)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    sid = pg.evaluate(f"(() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')); return d.servants.find((x) => !x.wish && x.rarity === 5).id; }})()")

    # ================= card frames =================
    setup(pg, sid, art={"1": ART}, artStage="1", level=90, bond=5); open_(pg, sid)
    f = frame(pg)
    check(f"Lv 90: the gold frame, no aura and no rainbow ({f['cls']})", "cf-gold" in f["cls"] and "cf-l100" not in f["cls"] and not f["aura"] and not f["rb"])
    setup(pg, sid, level=100); open_(pg, sid)
    f = frame(pg)
    check(f"Lv 100: rainbow middle edges and a gold aura ({f['cls']})", "cf-l100" in f["cls"] and f["aura"] and f["rb"] and f["rs"] and not f["clsrb"])
    check(f"the rainbow only on the edges' mask ({f['mask'][:60]})", "url(" in f["mask"])
    check("they let clicks through to the picture", f["pe"])
    check(f"and they move: the aura breathes, the rainbow flows ({f['anim']})", "cfAura" in f["anim"] and "cfFlow" in f["anim"])
    ov = pg.evaluate("getComputedStyle(document.querySelector('#dossier .art-frame')).overflow")
    check(f"the aura reaches outside the card ({ov})", ov == "visible")
    m100 = f["mask"]
    setup(pg, sid, level=120); open_(pg, sid)
    f = frame(pg)
    check(f"Lv 120: every gold part rainbow, a rainbow aura, the class logo too ({f['cls']})", "cf-l120" in f["cls"] and "cf-l100" not in f["cls"] and f["aura"] and f["rb"] and f["clsrb"])
    check("with its own mask (all the gold, not just the edges)", f["mask"] != m100 and "url(" in f["mask"])
    pg.click('#dossier [data-action="bump"][data-f="level"][data-d="-1"]'); pg.wait_for_timeout(900)
    f = frame(pg)
    check(f"down to 119: back to the Lv 100 look ({f['cls']})", "cf-l100" in f["cls"] and not f["clsrb"])
    # Craft Essences and Past Chaldea's window: NA's servants don't get it there
    pg.click('#dossier .cf-pick [data-action="cf-set"][data-w="mine"][data-v=""]'); pg.wait_for_timeout(400)
    f = frame(pg)
    check("Card frame Off takes it all away", not f["cls"] and not f["aura"] and not f["rb"])
    pg.click('#dossier .cf-pick [data-action="cf-set"][data-w="mine"][data-v="1"]'); pg.wait_for_timeout(400)

    # ================= Bond =================
    setup(pg, sid, level=90, bond=9); open_(pg, sid)
    o = bond(pg)
    check(f"Bond 9: nothing ({o})", not o["cls"] and not o["veil"] and (o["bg"] is None or "on" not in o["bg"]))
    setup(pg, sid, bond=10); open_(pg, sid)
    o = bond(pg)
    check(f"Bond 10: the page takes the rainbow and the crystal ({o['cls']})", o["cls"] == ["bd10"] and o["veil"] and o["crystal"] and o["gems"] >= 9)
    check(f"behind the page's content, not taking clicks ({o['vz']}, {o['vpe']})", o["vz"] == "-1" and o["vpe"] == "none")
    check(f"the rainbow moves ({o['rb']})", o["rb"] not in ("", "none"))
    check(f"the website's background gets the rising crystals ({o['bg']})", o["bg"] == ["on", "t10"] and o["bgpe"] == "none")
    a10 = pg.evaluate("getComputedStyle(document.querySelector('#dossier .bd-veil')).getPropertyValue('--a').trim()")
    pg.click('#dossier [data-action="bump"][data-f="level"][data-d="-1"]'); pg.wait_for_timeout(800)
    check("a redraw keeps it", bond(pg)["veil"] and pg.locator("#dossier > .bd-veil").count() == 1)
    vt = pg.evaluate("document.querySelector('#dossier .bd-veil').getBoundingClientRect().top - document.getElementById('dossier').getBoundingClientRect().top")
    pg.evaluate("document.getElementById('dossier').scrollTop = 700"); pg.wait_for_timeout(300)
    vt2 = pg.evaluate("document.querySelector('#dossier .bd-veil').getBoundingClientRect().top - document.getElementById('dossier').getBoundingClientRect().top")
    check(f"it stays with the page as it scrolls ({vt:.0f} → {vt2:.0f})", abs(vt - vt2) < 4)
    pg.evaluate("document.getElementById('dossier').scrollTop = 0")
    # leaving the page takes the background layer away; coming back brings it
    pg.click('[data-action="tab"][data-tab="parties"]'); pg.wait_for_timeout(600)
    o = bond(pg)
    check(f"another page: the background layer goes ({o['bg']})", o["bg"] is None or "on" not in o["bg"])
    pg.click('[data-action="tab"][data-tab="servants"]'); pg.wait_for_timeout(700)
    check("and comes back with the page", "on" in (bond(pg)["bg"] or []))

    setup(pg, sid, bond=15)
    pg.locator(f'#list [data-id="{sid}"]').evaluate("(e) => e.click()"); pg.wait_for_timeout(150)
    intro = pg.evaluate("(() => { const e = document.querySelector('.bd-intro'); return e ? {gems: e.querySelectorAll('.bdi-g').length, pe: getComputedStyle(e).pointerEvents, t: e.querySelector('.bdi-t').textContent, enter: document.getElementById('dossier').classList.contains('bd-enter')} : null; })()")
    check(f"Bond 15, opened with a click: the intro plays ({intro})", intro and intro["gems"] == 9 and intro["t"] == "Bond 15" and intro["enter"])
    check("and doesn't take clicks", intro and intro["pe"] == "none")
    pg.wait_for_timeout(2100)
    check("then it's gone by itself", pg.locator(".bd-intro").count() == 0 and not pg.evaluate("document.getElementById('dossier').classList.contains('bd-enter')"))
    o = bond(pg)
    a15 = pg.evaluate("getComputedStyle(document.querySelector('#dossier .bd-veil')).getPropertyValue('--a').trim()")
    check(f"Bond 15: a stronger rainbow than Bond 10 ({a10} → {a15})", o["cls"] == ["bd15"] and float(a15) > float(a10))
    check(f"its background has more crystals ({o['bg']})", o["bg"] == ["on", "t15"])
    pg.click('#dossier [data-action="bump"][data-f="level"][data-d="1"]'); pg.wait_for_timeout(700)
    check("a redraw doesn't play the intro again", pg.locator(".bd-intro").count() == 0)
    sel = pg.evaluate(f"(() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')); const s = d.servants.find((x) => x.id === '{sid}'); return [s.bond, s.level]; }})()")
    check(f"none of it changed the servant beyond the + and − ({sel})", sel[0] == 15)
    # another servant below Bond 10 takes it all away
    other = pg.evaluate(f"(() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')); return d.servants.find((x) => !x.wish && x.id !== '{sid}' && !(x.bond >= 10)).id; }})()")
    open_(pg, other)
    o = bond(pg)
    check(f"another servant below Bond 10: no veil, no background ({o})", not o["cls"] and not o["veil"] and (o["bg"] is None or "on" not in o["bg"]))
    ctx.close()

    # ================= reduced motion =================
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    pg = page(ctx); pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1300)
    setup(pg, sid, bond=15, level=120, art={"1": ART}, artStage="1")
    pg.locator(f'#list [data-id="{sid}"]').evaluate("(e) => e.click()"); pg.wait_for_timeout(300)
    check("reduced motion: no intro", pg.locator(".bd-intro").count() == 0)
    o, f = bond(pg), frame(pg)
    check(f"and the rainbows stand still ({o['rb']}, {f['anim']})", o["rb"] == "none" and all(a == "none" for a in f["anim"].split(",")))
    check("but they're still there", o["veil"] and f["rb"] and f["aura"])
    ctx.close()
    b.close()
if errs: check("no page errors: " + "; ".join(errs[:3]), False)
print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
