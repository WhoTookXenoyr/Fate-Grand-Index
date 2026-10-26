import os
# 0.24.0: a party as a picture. Each party has "Share image"; the picture is a 2400x1400 PNG with the party's members,
# it can be saved, copied and drawn light or dark, and art from a site that doesn't allow it in a picture (no CORS)
# is swapped for class emblems instead of breaking the save.
import sys
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}))"
SIZE = "(() => { const i = document.getElementById('pimg-img'); return i && i.complete ? [i.naturalWidth, i.naturalHeight] : null; })()"
with sync_playwright() as p:
    b = p.chromium.launch()
    for cors in (True, False):
        ctx = b.new_context(viewport={"width": 1360, "height": 900}, accept_downloads=True); pg = ctx.new_page(); pg.add_init_script(INIT)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        # (a fulfilled response gets CORS headers by default; another origin stands for "not allowed")
        hdr = {"Access-Control-Allow-Origin": "*"} if cors else {"Access-Control-Allow-Origin": "https://elsewhere.example"}
        def art(route, h=hdr): route.fulfill(path=f"{sp}/ph_art.png", content_type="image/png", headers=h)
        pg.route("https://static.atlasacademy.io/**", lambda r: art(r))
        pg.route("https://fonts.**", lambda r: r.abort())
        pg.goto(SEEDED + "#parties"); pg.wait_for_timeout(1800)
        tag = "with CORS" if cors else "without CORS"
        n_btn, n_party = pg.locator('#parties [data-action="party-img"]').count(), pg.locator("#parties article.party").count()
        if cors: check(f"every party has Share image ({n_btn} of {n_party})", n_btn == n_party and n_party > 0)
        pg.locator('#parties [data-action="party-img"]').first.click()
        pg.wait_for_function("document.getElementById('pimg-img').src.startsWith('blob:') && document.getElementById('pimg-wait').hidden", timeout=20000)
        pg.wait_for_timeout(300)
        check(f"{tag}: the picture is drawn at 2400x1400 ({pg.evaluate(SIZE)})", pg.evaluate(SIZE) == [2400, 1400])
        msg = pg.locator("#pimg-msg").inner_text()
        if cors: check(f"with CORS the art is used (no note: {msg!r})", msg == "")
        else: check(f"without CORS emblems stand in and it says so ({msg!r})", "emblems" in msg)
        with pg.expect_download() as dl: pg.click('[data-action="pimg-save"]')
        path = dl.value.path(); head = open(path, "rb").read(8)
        check(f"{tag}: Save PNG downloads a PNG ({dl.value.suggested_filename})", head == b"\x89PNG\r\n\x1a\n" and dl.value.suggested_filename.startswith("party-") and dl.value.suggested_filename.endswith(".png"))
        if cors:
            src0 = pg.evaluate("document.getElementById('pimg-img').src")
            pg.click('[data-action="pimg-theme"][data-v="dark"]')
            pg.wait_for_function(f"document.getElementById('pimg-img').src !== {src0!r} && document.getElementById('pimg-wait').hidden", timeout=20000)
            # the corner of a dark picture is dark
            dark = pg.evaluate("""async () => { const i = document.getElementById('pimg-img'); const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d'); x.drawImage(i, 0, 0, 4, 4, 0, 0, 4, 4); const d = x.getImageData(0, 0, 1, 1).data; return d[0] + d[1] + d[2]; }""")
            check(f"Dark draws it on the dark colours (corner {dark})", dark < 150 and pg.get_attribute('[data-action="pimg-theme"][data-v="dark"]', "aria-pressed") == "true")
            ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=URL)
            pg.click('[data-action="pimg-copy"]'); pg.wait_for_timeout(600)
            m = pg.locator("#pimg-msg").inner_text()
            check(f"Copy puts it on the clipboard or says it can't ({m!r})", m.startswith("Copied") or "won't copy" in m)
            pg.click('[data-action="pimg-close"]'); pg.wait_for_timeout(300)
            check("Close closes it", not pg.evaluate("document.getElementById('party-img-dlg').open"))
        ctx.close()
    # a phone: the dialog fits
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#parties"); pg.wait_for_timeout(1500)
    pg.locator('#parties [data-action="party-img"]').first.click()
    pg.wait_for_function("document.getElementById('pimg-img').src.startsWith('blob:')", timeout=20000); pg.wait_for_timeout(300)
    r = pg.evaluate("(() => { const r = document.querySelector('#party-img-dlg').getBoundingClientRect(); return [r.left, r.right, innerWidth]; })()")
    check(f"on a phone the dialog fits the screen ({r})", r[0] >= 0 and r[1] <= r[2])
    ctx.close(); b.close()
print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
