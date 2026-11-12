import os
# 0.53.0-beta: a 3D background for every class (63-class-bg.js), and the servant's colours tinting the page again
# (60-palette.js). WebGL here is software (SwiftShader), so what's checked is which effect runs, that it draws, and its
# colours; not speed.
import sys, json, struct, zlib
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
# a red picture for a servant (made here, so the suite needs nothing beyond the standard library)
def png(path, w, h, rgb):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
RED = os.path.join(sp, "t52_red.png"); png(RED, 64, 90, (176, 22, 32))
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
ON = "if (!sessionStorage.getItem('t3d')) { sessionStorage.setItem('t3d', '1'); localStorage.setItem('spirit-origin-list:v1:bg3d', 'on'); }"
GL = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
def page(b, w=1280, h=720, extra="", **kw):
    ctx = b.new_context(viewport={"width": w, "height": h}, **kw); pg = ctx.new_page(); pg.add_init_script(INIT + ON + extra)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    return ctx, pg
S3 = "(() => { const s = window.__fgi3d.state(); delete s.opts; return s; })()"
def wait3d(pg, cond, ms=9000):
    try: pg.wait_for_function(f"(() => {{ const s = window.__fgi3d.state(); return {cond}; }})()", timeout=ms * 2, polling=150); return True
    except Exception: return False
def awake(pg): pg.mouse.move(640, 200); pg.mouse.move(660, 220)
def theme(pg, to):
    pg.locator('#theme-tgl').click(); pg.wait_for_function(f"document.documentElement.getAttribute('data-theme') === '{to}'", timeout=20000, polling=150)
    pg.wait_for_timeout(2200) # the view transition, then the page's colours ease over
def rgb(c):
    c = c.strip()
    if c.startswith("#"): return [int(c[i:i + 2], 16) for i in (1, 3, 5)]
    return [int(float(x)) for x in c[c.index("(") + 1:c.index(")")].split(",")[:3]]
G = "[1,2,3].map(i => getComputedStyle(document.documentElement).getPropertyValue('--g' + i).trim())"
lum = lambda c: (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
# one servant of each class in the seeded list, and the effect it should get
OPEN = [("cu-chulainn-alter", "frenzy"), ("miyamoto-musashi", "blades"), ("ereshkigal", "thrust"), ("ivan-the-terrible", "birds"), ("illya", "magecraft"),
        ("kashin-koji", "fog"), ("nitocris-alter", "flames"), ("mysterious-executor-c-i-e-l", "dots"), ("larva-tiamat", "datasea"), ("lady-avalon", "net"), ("space-ereshkigal", "speresh")]
with sync_playwright() as p:
    b = p.chromium.launch(args=GL)

    # ---------- which class gets what ----------
    ctx, pg = page(b, color_scheme="dark", extra="localStorage.setItem('spirit-origin-list:v1:theme','dark');")
    pg.goto(SEEDED + "#servants")
    wait3d(pg, "s.kind === 'globe' && s.frames > 0", 20000)
    keys = pg.evaluate("""(() => { const k = window.__fgiCls.key; return [k({cls: 'Beast', name: 'Draco'}), k({cls: 'Beast', name: "Sodom's Beast/Draco"}), k({cls: 'Beast', name: 'Space Ereshkigal'}),
      k({cls: 'Beast', name: 'Speresh'}), k({cls: 'Beast', name: 'Tiamat'}), k({cls: 'Ruler', name: 'Jeanne'}), k({cls: 'Shielder', name: 'Mash'}), k({cls: 'Foreigner', name: 'Abigail'}), k({cls: 'Saber', name: 'x'}), k({cls: 'Nobody', name: 'x'})]; })()""")
    check(f"Draco and Space Ereshkigal have their own; other Beasts the Beast's; every class its own ({keys})",
          keys == ["Draco", "Draco", "Speresh", "Speresh", "Beast", "Ruler", "Shielder", "Foreigner", "Saber", ""])
    themes = pg.evaluate("window.__fgiCls.themes()")
    check(f"all 15 classes, Draco and Space Ereshkigal have a background ({len(themes)})", len(themes) == 17 and len({t["k"] for t in themes.values()}) == 17)
    seen = []
    for sid, kind in OPEN:
        awake(pg); pg.click(f'#list [data-id="{sid}"]')
        ok = wait3d(pg, f"s.kind === '{kind}' && s.frames > 0", 12000)
        seen.append((sid, pg.evaluate("window.__fgi3d.state().kind"), ok))
    check(f"opening a servant gives the page their class's background ({seen})", all(x[2] for x in seen))
    check("Space Ereshkigal gets hers, not the Beast's", seen[-1][1] == "speresh")
    AURA = "(() => { const a = document.querySelector('.aura'); return [document.documentElement.classList.contains('bg3d-cls'), a ? getComputedStyle(a).display : null]; })()"
    au = pg.evaluate(AURA)
    check(f"while a class's background shows, the aura isn't drawn over it ({au})", au[0] and au[1] in ("none", None))
    pg.wait_for_timeout(2200)
    g = [rgb(c) for c in pg.evaluate(G)]; o = pg.evaluate("window.__fgiCls.theme().opts"); c1, c3 = rgb(o["color"]), rgb(o["color3"])
    check(f"a Beast without a picture of yours: the page stays black, and the background keeps her own pink and pale blue ({g}, {c1}, {c3})",
          all(max(c) <= 2 for c in g) and not pg.evaluate("document.documentElement.classList.contains('pal-own')") and c1[0] > c1[1] + 80 and c3[2] > c3[0])

    # ---------- every effect starts and draws ----------
    bad = []
    for k, t in themes.items():
        awake(pg); pg.evaluate(f"window.__fgiCls.force({json.dumps(k)})")
        ok = wait3d(pg, f"s.kind === '{t['k']}' && !s.asleep", 12000)
        f0 = pg.evaluate("window.__fgi3d.state().frames"); awake(pg); pg.wait_for_timeout(900)
        f1 = pg.evaluate("window.__fgi3d.state().frames")
        if not ok or f1 <= f0: bad.append((k, pg.evaluate(S3)["kind"], f1 - f0))
    pg.evaluate("window.__fgiCls.force('')")
    check(f"all 17 start and draw in this browser, none falling back to haze ({bad or 'all drew'})", not bad)
    sizes = {}
    for k in ["Avenger", "Saber", "Draco"]:
        pg.evaluate(f"window.__fgiCls.force('{k}')"); wait3d(pg, f"s.kind === '{themes[k]['k']}'", 12000); s = pg.evaluate(S3)["size"]; sizes[k] = s[0] * s[1]
    pg.evaluate("window.__fgiCls.force('')")
    check(f"each drawn at its own size: the shaders under 0.5 MP, the 3D ones under 1 MP ({sizes})", sizes["Avenger"] <= 0.42e6 and sizes["Draco"] <= 0.42e6 and sizes["Saber"] <= 0.95e6)

    # ---------- leaving the servant ----------
    pg.goto(SEEDED + "#home"); ok = wait3d(pg, "s.kind === 'globe'", 12000)
    pg.wait_for_timeout(600); au = pg.evaluate(AURA)
    check(f"on another page it's the usual effect again, and the aura is back ({au})", ok and not au[0] and au[1] not in ("none",))
    pg.goto(SEEDED + "#servants"); awake(pg); pg.click('#list [data-id="miyamoto-musashi"]'); ok = wait3d(pg, "s.kind === 'blades'", 12000)
    check("and back on a servant, their class's", ok)

    # ---------- Settings ----------
    pg.goto(SEEDED + "#settings"); pg.wait_for_timeout(1200)
    on = pg.locator('[data-action="bg3d-cls"][data-v="1"]'); off = pg.locator('[data-action="bg3d-cls"][data-v="0"]')
    check("Settings has Class backgrounds, On to begin with", on.count() == 1 and off.count() == 1 and on.get_attribute("aria-pressed") == "true")
    off.click(); pg.wait_for_timeout(300)
    check("Off is kept", pg.evaluate("localStorage.getItem('spirit-origin-list:v1:bg3d-cls')") == "off" and off.get_attribute("aria-pressed") == "true")
    pg.goto(SEEDED + "#servants"); awake(pg); pg.click('#list [data-id="miyamoto-musashi"]'); pg.wait_for_timeout(1500)
    ok = wait3d(pg, "s.kind === 'globe'", 12000)
    check(f"with it off, a servant's page has the usual effect ({pg.evaluate(S3)['kind']})", ok and pg.evaluate("window.__fgiCls.theme()") is None)
    pg.goto(SEEDED + "#settings"); pg.wait_for_timeout(1200); pg.locator('[data-action="bg3d-cls"][data-v="1"]').click(); pg.wait_for_timeout(300)
    check("On clears the key", pg.evaluate("localStorage.getItem('spirit-origin-list:v1:bg3d-cls')") is None)

    # ---------- the servant's picture: the page and the class background take its colours ----------
    pg.goto(SEEDED + "#servants"); awake(pg); pg.click('#list [data-id="miyamoto-musashi"]'); wait3d(pg, "s.kind === 'blades'", 12000); pg.wait_for_timeout(2200)
    g0 = [rgb(c) for c in pg.evaluate(G)]; c0 = rgb(pg.evaluate("window.__fgiCls.theme().opts.color"))
    check(f"a servant without a picture of yours: the page is black ({g0})", all(max(c) <= 2 for c in g0))
    pg.click('[data-action="edit"]'); pg.wait_for_timeout(500)
    pg.set_input_files('input[data-form-art="1"]', RED); pg.wait_for_timeout(600)
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(600)
    pg.wait_for_function("document.documentElement.classList.contains('pal-own')", timeout=15000, polling=150); pg.wait_for_timeout(2200)
    g1 = [rgb(c) for c in pg.evaluate(G)]; c1 = rgb(pg.evaluate("window.__fgiCls.theme().opts.color"))
    check(f"with a red picture, the page is red in dark mode (Noyr's report; {g1})", all(c[0] > c[1] + 25 and c[0] > c[2] + 15 for c in g1) and lum(g1[0]) < 0.25)
    check(f"and Saber's blue blades lean red ({c0} → {c1})", c1[0] - c1[2] > c0[0] - c0[2] + 40)
    # (the switch is on Settings)
    pg.goto(SEEDED + "#settings"); pg.wait_for_timeout(1200); theme(pg, "light")
    pg.goto(SEEDED + "#servants"); awake(pg); pg.click('#list [data-id="miyamoto-musashi"]')
    pg.wait_for_function("document.documentElement.classList.contains('pal-own')", timeout=15000, polling=150); pg.wait_for_timeout(2200)
    g2 = [rgb(c) for c in pg.evaluate(G)]; bg2 = rgb(pg.evaluate("window.__fgiCls.theme().opts.backgroundColor"))
    check(f"in light mode the page is a light red ({g2})", all(c[0] > c[1] + 15 and lum(c) > 0.6 for c in g2))
    ok = wait3d(pg, "s.kind === 'blades'", 12000)
    check(f"and the class background turns light too ({bg2})", ok and lum(bg2) > 0.75)
    pg.goto(SEEDED + "#home")
    # (the colours ease over 1.6 s; with software WebGL busy the page's frames, and so the easing, can lag a lot)
    for _ in range(40):
        g3 = [rgb(c) for c in pg.evaluate(G)]
        if all(lum(c) > 0.85 and abs(c[0] - c[1]) < 22 for c in g3): break
        pg.wait_for_timeout(500)
    dbg = pg.evaluate("[location.hash, document.documentElement.classList.contains('pal-own'), document.documentElement.style.getPropertyValue('--g1')]")
    check(f"with no servant on show, it's cream again ({g3}, {dbg})", all(lum(c) > 0.85 and abs(c[0] - c[1]) < 22 for c in g3))
    ctx.close()

    # ---------- a phone ----------
    ctx, pg = page(b, 390, 844, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg.goto(SEEDED + "#servants"); wait3d(pg, "s.frames > 0", 20000)
    pg.evaluate("window.__fgiCls.force('Speresh')"); pg.locator('#list [data-id="space-ereshkigal"]').tap(); pg.wait_for_timeout(1500)
    st = pg.evaluate(S3)
    check(f"a phone draws them smaller still ({st['kind']}, {st['size']}; the servant sheet covers it: {st['asleep']})", st["kind"] in ("speresh", None) and (not st["size"] or st["size"][0] * st["size"][1] <= 0.3e6))
    ctx.close()
    b.close()
if errs: print("page errors:", errs[:3])
print(f"FAILED {len(fails)}: {fails} errors {errs[:2]}" if fails or errs else "all passed")
sys.exit(1 if fails or errs else 0)
