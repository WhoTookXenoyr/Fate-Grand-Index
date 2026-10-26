import os
# 0.24.0: Modern and Compact differ on a phone. Modern: picture tiles two to a row (three on a tablet), and a bar of
# section shortcuts on the servant page that follows the scroll. Compact: one-line rows (about twice as many on
# screen), the picture small beside the name, and long sections folded (tap to open, remembered). Touch: bigger
# targets, and a sideways swipe on the servant's picture or name goes to the next or previous servant.
import sys
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
def init(layout): return f"localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({{anim:false}}));if(!localStorage.getItem('spirit-origin-list:v1:layout'))localStorage.setItem('spirit-origin-list:v1:layout','{layout}')"
def page(b, layout, w=390, h=844, touch=True):
    ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=touch, has_touch=touch); pg = ctx.new_page(); pg.add_init_script(init(layout))
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    return ctx, pg
COLS = "getComputedStyle(document.getElementById('list')).gridTemplateColumns.split(' ').filter(Boolean).length"
ON_SCREEN = "(() => { document.getElementById('list').scrollIntoView(); return [...document.querySelectorAll('#list > .row')].filter(r => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }).length; })()"
SWIPE = """([sel, dx]) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 20;
  el.dispatchEvent(new PointerEvent('pointerdown', {pointerType: 'touch', clientX: x, clientY: y, bubbles: true}));
  el.dispatchEvent(new PointerEvent('pointerup', {pointerType: 'touch', clientX: x + dx, clientY: y + 6, bubbles: true})); }"""
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- Modern ----------
    ctx, pg = page(b, "modern")
    check(f"Modern on a phone: the roster is tiles, two to a row ({pg.evaluate(COLS)})", pg.evaluate(COLS) == 2)
    tile = pg.evaluate("(() => { const r = document.querySelector('#list > .row'), a = r.querySelector('.avatar, .mono-tag'); return [r.getBoundingClientRect().width, a.getBoundingClientRect().width]; })()")
    check(f"each tile is mostly its picture ({tile})", abs(tile[0] - tile[1]) < 4)
    n_modern = pg.evaluate(ON_SCREEN)
    pg.click('#list [data-id="oberon"]'); pg.wait_for_timeout(1000)
    jumps = pg.evaluate("[...document.querySelectorAll('#dossier .ds-jump button')].map(b => b.textContent)")
    check(f"the servant page has section shortcuts ({jumps})", jumps[:4] == ["Progress", "Planner", "NP", "Skills"] and "Traits" in jumps)
    pg.click('#dossier .ds-jump [data-k="Skills"]'); pg.wait_for_timeout(1200)
    pos = pg.evaluate("(() => { const d = document.getElementById('dossier'), s = d.querySelector('[data-jump=\"Skills\"]'), n = d.querySelector('.ds-jump'); return [s.getBoundingClientRect().top, n.getBoundingClientRect().top, n.getBoundingClientRect().bottom, d.scrollTop]; })()")
    check(f"Skills jumps to the skills, just under the bar, which stays at the top ({pos})", pos[3] > 200 and -2 <= pos[1] <= 2 and pos[2] - 2 <= pos[0] <= pos[2] + 70)
    check("the bar marks the section you're on", pg.evaluate("document.querySelector('#dossier .ds-jump button.on') && document.querySelector('#dossier .ds-jump button.on').textContent") == "Skills")
    wide = pg.evaluate("[document.getElementById('dossier').scrollWidth, document.getElementById('dossier').clientWidth]")
    check(f"no sideways scroll on the servant page ({wide})", wide[0] <= wide[1] + 1)
    fill = pg.evaluate("(() => { const r = document.getElementById('dossier').getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; })()")
    check(f"the servant page fills the whole screen, to the bottom edge ({fill})", fill[0] <= 0 and fill[1] >= fill[2])
    check(f"touch makes the + and − bigger ({pg.evaluate('matchMedia(\"(pointer: coarse)\").matches')})", pg.evaluate("document.querySelector('#dossier .stepper button').getBoundingClientRect().width") >= 39)
    # a swipe on the picture or the name: the next servant, then back
    order = pg.evaluate("[...document.querySelectorAll('#list > .row')].map(r => r.dataset.id)")
    i = order.index("oberon")
    pg.evaluate("document.getElementById('dossier').scrollTop = 0"); pg.wait_for_timeout(200)
    pg.evaluate(SWIPE, ["#dossier .d-head", -120]); pg.wait_for_timeout(800)
    nxt = pg.evaluate("document.querySelector('#dossier .d-head h2').textContent")
    want = pg.evaluate(f"document.querySelector('#list [data-id=\"{order[i + 1]}\"] .row-name').textContent")
    check(f"swiping left opens the next servant on the list ({nxt} / {want})", nxt == want)
    pg.evaluate(SWIPE, ["#dossier .d-head", 120]); pg.wait_for_timeout(800)
    check("swiping right goes back", pg.evaluate("document.querySelector('#dossier .d-head h2').textContent") == "Oberon")
    pg.evaluate(SWIPE, ["#dossier .d-head", -30]); pg.wait_for_timeout(500)
    check("a small drag doesn't count", pg.evaluate("document.querySelector('#dossier .d-head h2').textContent") == "Oberon")
    ctx.close()

    # ---------- Compact ----------
    ctx, pg = page(b, "compact")
    check(f"Compact on a phone: one column of rows ({pg.evaluate(COLS)})", pg.evaluate(COLS) <= 1 or pg.evaluate("getComputedStyle(document.getElementById('list')).display") == "flex")
    h = pg.evaluate("document.querySelector('#list > .row').getBoundingClientRect().height")
    n_compact = pg.evaluate(ON_SCREEN)
    check(f"each row is one line ({h:.0f} px), so far more fit on screen ({n_compact} against Modern's {n_modern})", h <= 52 and n_compact >= 2 * n_modern)
    pg.click('#list [data-id="oberon"]'); pg.wait_for_timeout(1000)
    top = pg.evaluate("(() => { const t = document.querySelector('#dossier .cmp-top'); if (!t) return null; const l = t.querySelector('.cmp-l').getBoundingClientRect(), r = t.querySelector('.cmp-r').getBoundingClientRect(); return [l.width, r.left > l.right - 1, Math.abs(l.top - r.top) < 30]; })()")
    check(f"the picture sits small beside the name ({top})", top and top[0] < 160 and top[1] and top[2])
    check("no section shortcuts in Compact", pg.locator("#dossier .ds-jump").count() == 0)
    folded = pg.evaluate("[...document.querySelectorAll('#dossier .d-sec.fold')].map(s => s.dataset.fold)")
    check(f"long sections start folded ({folded})", "team" in folded and "notes" in folded and "passive skills" in folded and "skills" not in folded)
    notes = pg.locator('#dossier .d-sec[data-fold="notes"]')
    check("a folded section shows only its heading", notes.locator(".notes").is_hidden())
    notes.locator("h3").click(); pg.wait_for_timeout(300)
    check("tapping the heading opens it", notes.locator(".notes").is_visible() and notes.locator("h3").get_attribute("aria-expanded") == "true")
    sk = pg.locator('#dossier .d-sec[data-fold="skills"]')
    sk.locator("h3").click(); pg.wait_for_timeout(300)
    check("and folds an open one", "fold" in (sk.get_attribute("class") or ""))
    pg.reload(); pg.wait_for_timeout(1500); pg.click('#list [data-id="oberon"]'); pg.wait_for_timeout(1000)
    st = pg.evaluate("[document.querySelector('#dossier .d-sec[data-fold=\"notes\"]').classList.contains('fold'), document.querySelector('#dossier .d-sec[data-fold=\"skills\"]').classList.contains('fold')]")
    check(f"what you opened and folded is remembered ({st})", st == [False, True])
    wide = pg.evaluate("[document.getElementById('dossier').scrollWidth, document.getElementById('dossier').clientWidth]")
    check(f"no sideways scroll in Compact either ({wide})", wide[0] <= wide[1] + 1)
    ctx.close()

    # ---------- a tablet in portrait ----------
    ctx, pg = page(b, "modern", 820, 1180)
    check(f"on a tablet Modern has three tiles to a row ({pg.evaluate(COLS)})", pg.evaluate(COLS) == 3)
    ctx.close()
    # ---------- a computer: as before ----------
    ctx, pg = page(b, "modern", 1360, 900, False)
    check("on a computer the roster is the list it was", pg.evaluate("getComputedStyle(document.getElementById('list')).display") == "flex")
    pg.click('#list [data-id="oberon"]'); pg.wait_for_timeout(800)
    check("and the servant page has no shortcut bar", pg.locator("#dossier .ds-jump").count() == 0)
    art = pg.evaluate("(() => { const f = document.querySelector('#dossier .art-frame').getBoundingClientRect(), c = document.querySelector('#dossier .stage-btn').getBoundingClientRect(); return [Math.round(f.width), Math.round(c.width)]; })()")
    check(f"Modern on a computer: a bigger picture, small stage cards ({art})", art[0] >= 270 and art[1] <= 90)
    ctx.close(); b.close()
print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
