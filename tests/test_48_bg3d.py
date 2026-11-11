import os
# 0.53.0-beta: the 3D background (vanta.js on three.js) and the light/dark switch reaching the story scene.
# WebGL here is software (SwiftShader), so the numbers checked are counts and sizes, not speed.
import sys, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
# a test tool's browser starts with the 3D background off (every other suite relies on that); here it's asked for.
# Once only, so that switching it off on Settings survives the page being opened again.
ON = "if (!sessionStorage.getItem('t3d')) { sessionStorage.setItem('t3d', '1'); localStorage.setItem('spirit-origin-list:v1:bg3d', 'on'); }"
GL = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
def page(b, w=1280, h=720, extra="", on=True, **kw):
    ctx = b.new_context(viewport={"width": w, "height": h}, **kw); pg = ctx.new_page(); pg.add_init_script(INIT + (ON if on else "") + extra)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    return ctx, pg
S3 = "(() => { const s = window.__fgi3d.state(); delete s.opts; return s; })()"
def wait3d(pg, cond, ms=9000):
    # (asked on a timer, not on the page's frames: software WebGL makes those few and uneven)
    try: pg.wait_for_function(f"(() => {{ const s = window.__fgi3d.state(); return {cond}; }})()", timeout=ms * 2, polling=150); return True
    except Exception: return False
def theme(pg, to):
    pg.locator('#theme-tgl').click(); pg.wait_for_function(f"document.documentElement.getAttribute('data-theme') === '{to}'", timeout=20000, polling=150)
    pg.wait_for_timeout(1800) # the switch plays a view transition, and the page takes no clicks until it's over
DOM = """(() => { const h = document.getElementById('bg3d'), pb = document.querySelector('.page-bg');
  return {host: !!h, after: !!h && pb.nextElementSibling === h, on: !!h && h.classList.contains('on'), canvases: document.querySelectorAll('#bg3d canvas').length,
    gl: Array.from(document.querySelectorAll('canvas')).filter((c) => c.classList.contains('vanta-canvas')).length, cls: document.documentElement.className,
    circle: (() => { const i = document.querySelector('.idle-bg'); return i ? getComputedStyle(i).visibility : null; })()}; })()"""
with sync_playwright() as p:
    b = p.chromium.launch(args=GL)

    # ---------- the usual background ----------
    ctx, pg = page(b, color_scheme="dark", extra="localStorage.setItem('spirit-origin-list:v1:theme','dark');")
    pg.goto(SEEDED + "#home")
    ok = wait3d(pg, "s.kind === 'globe' && s.frames > 2", 20000)
    st = pg.evaluate(S3); d = pg.evaluate(DOM)
    check(f"the 3D background is on to begin with: the globe ({st})", ok and st["on"] and st["pick"] == "globe" and st["lib"] == 1 and not st["dead"])
    check(f"one WebGL canvas, right after the page's own background ({d})", d["host"] and d["after"] and d["canvases"] == 1 and d["gl"] == 1 and "bg3d-on" in d["cls"] and "bg3d-story" not in d["cls"])
    px = st["size"][0] * st["size"][1]
    check(f"it's drawn at about a megapixel at most, not at the screen's size times its pixel ratio ({st['size']})", 2e5 < px <= 1.06e6)
    check(f"the summoning circle steps aside for it ({d['circle']})", d["circle"] in ("hidden", None))
    amb = pg.evaluate("window.__fgiPower.state().amb")
    f0 = pg.evaluate("window.__fgi3d.state().frames"); pg.wait_for_timeout(2000); f1 = pg.evaluate("window.__fgi3d.state().frames")
    check(f"it keeps drawing, and never faster than the background's frame rate ({f1 - f0} frames in 2 s, {amb} a second allowed)", 1 <= f1 - f0 <= amb * 2 + 3)

    # ---------- it rests with the page ----------
    pg.evaluate("window.__fgiPower.idleAfter(200)"); pg.wait_for_timeout(500); pg.evaluate("window.__fgiPower.check()")
    ok = wait3d(pg, "s.asleep", 4000)
    f0 = pg.evaluate("window.__fgi3d.state().frames"); pg.wait_for_timeout(1200); f1 = pg.evaluate("window.__fgi3d.state().frames")
    check(f"with no input it stops drawing ({f1 - f0} frames in 1.2 s)", ok and f1 == f0)
    pg.mouse.move(300, 300)
    ok = wait3d(pg, f"!s.asleep && s.frames > {f1}", 6000)
    check("and the first move wakes it", ok)
    pg.evaluate("window.__fgiPower.idleAfter(null)")

    # ---------- Settings ----------
    pg.goto(SEEDED + "#settings"); wait3d(pg, "s.kind === 'globe'", 20000)
    check("Settings has the switch, the effect and the quality", pg.locator('[data-action="bg3d"]').count() == 2 and pg.locator('[data-action="bg3d-fx"]').count() == 6 and pg.locator('[data-action="bg3d-q"]').count() == 2
          and pg.locator('[data-action="bg3d"][data-v="1"]').get_attribute("aria-pressed") == "true" and pg.locator('[data-action="bg3d-fx"][data-v="globe"]').get_attribute("aria-pressed") == "true"
          and pg.locator('[data-action="bg3d-q"][data-v="light"]').get_attribute("aria-pressed") == "true")
    pg.locator('[data-action="bg3d-fx"][data-v="fog"]').click()
    ok = wait3d(pg, "s.kind === 'fog' && s.frames > 0", 12000); st = pg.evaluate(S3); d = pg.evaluate(DOM)
    check(f"another effect takes the globe's place, and it's kept ({st['kind']}, {st['size']}, {d['gl']} canvas)", ok and d["gl"] == 1 and st["size"][0] * st["size"][1] <= 0.53e6 and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:bg3d-fx')") == "fog")
    small = st["size"][0] * st["size"][1]
    pg.locator('[data-action="bg3d-q"][data-v="full"]').click()
    ok = wait3d(pg, f"s.kind === 'fog' && s.full && s.size && s.size[0] * s.size[1] > {small * 1.5}", 12000); st = pg.evaluate(S3)
    check(f"Full draws more pixels ({small} → {st['size']})", ok and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:bg3d-q')") == "full" and pg.evaluate("document.querySelectorAll('canvas.vanta-canvas').length") == 1)
    pg.locator('[data-action="bg3d-q"][data-v="light"]').click(); wait3d(pg, f"s.size && s.size[0] * s.size[1] <= {small * 1.1}", 12000)
    pg.locator('[data-action="bg3d"][data-v="0"]').click()
    ok = wait3d(pg, "!s.on && !s.kind", 6000); d = pg.evaluate(DOM)
    check(f"Off takes the canvas away and gives the drawn background back ({d})", ok and d["gl"] == 0 and "bg3d-on" not in d["cls"] and d["circle"] != "hidden" and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:bg3d')") == "off")
    pg.locator("#toast .toast-btn").click()
    ok = wait3d(pg, "s.on && s.kind === 'fog'", 12000)
    check("Undo turns it back on", ok and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:bg3d')") == "on")
    pg.locator('[data-action="bg3d-fx"][data-v="globe"]').click(); wait3d(pg, "s.kind === 'globe'", 12000)
    check("the globe is the one that isn't stored", pg.evaluate("localStorage.getItem('spirit-origin-list:v1:bg3d-fx')") is None)

    # ---------- the light/dark switch ----------
    o0 = pg.evaluate("window.__fgi3d.state().opts.color")
    theme(pg, 'light')
    ok = wait3d(pg, f"s.kind === 'globe' && s.opts.color !== {o0}", 6000)
    check("the 3D picture takes the light theme's colours", ok and pg.evaluate("document.querySelectorAll('canvas.vanta-canvas').length") == 1)
    theme(pg, 'dark')
    ok = wait3d(pg, f"s.opts.color === {o0}", 6000)
    check("and the dark ones again", ok)

    # ---------- story scenes ----------
    pg.goto(SEEDED + "#home"); wait3d(pg, "s.kind === 'globe'", 20000)
    K = pg.evaluate("window.__fgiScene.list().map((c) => c.acts.map((n, a) => window.__fgi3d.kindOf(c.w, a)))")
    flat = [k for row in K for k in row]
    check(f"every scene gets one of the effects ({ {k: flat.count(k) for k in sorted(set(flat))} })", len(flat) >= 90 and set(flat) <= {"waves", "fog", "clouds", "net", "cells", "globe"} and flat.count("waves") >= 8 and flat.count("net") >= 8 and flat.count("fog") >= 30)
    pg.evaluate("window.__fgiScene.show(103, 0)")
    ok = wait3d(pg, "s.kind === 'waves' && s.sea && s.frames > 0", 15000); d = pg.evaluate(DOM)
    sc = pg.evaluate("""(() => { const bg = document.getElementById('story-bg'), s = bg.querySelector('.sc:not(.out)'), f = s.querySelector('.sc-ff');
      return {sky: getComputedStyle(s).backgroundImage, floor: f ? getComputedStyle(f).visibility : null, sheets: s.querySelectorAll('canvas.sc-pl').length, host: document.getElementById('bg3d').style.background.slice(0, 16),
        order: !!(document.getElementById('bg3d').compareDocumentPosition(bg) & Node.DOCUMENT_POSITION_FOLLOWING)}; })()""")
    check(f"the open sea: a 3D sea under the scene's waterline ({pg.evaluate(S3)['kind']}, {d['cls']})", ok and "bg3d-sea" in d["cls"] and "bg3d-story" in d["cls"] and d["gl"] == 1)
    check(f"the drawn sky and floor make way, the drawn landmarks stay in front ({sc})", sc["sky"] == "none" and sc["floor"] == "hidden" and sc["sheets"] >= 2 and sc["host"].startswith("linear-gradient") and sc["order"])
    w = pg.evaluate("window.__fgi3d.want()")
    check(f"the waterline is where the scene's water begins ({w['sea']})", 0.6 < w["sea"]["line"] < 0.95)
    pg.evaluate("window.__fgiScene.show(108, 0)")
    ok = wait3d(pg, "s.kind === 'net' && !s.sea && s.frames > 0", 15000); d = pg.evaluate(DOM)
    check(f"the Temple of Time: a net of stars, and the sea's flags are gone ({d['cls']})", ok and "bg3d-sea" not in d["cls"] and "bg3d-story" in d["cls"] and d["gl"] == 1)
    pg.evaluate("window.__fgiScene.show(104, 0)")
    ok = wait3d(pg, "s.kind === 'fog' && s.frames > 0", 15000)
    check("the Mist City: haze", ok and pg.evaluate("document.querySelectorAll('canvas.vanta-canvas').length") == 1)
    # the same effect for the next scene: its colours change, the canvas stays
    cv = pg.evaluate("(() => { const c = document.querySelector('canvas.vanta-canvas'); c.dataset.mark = '1'; return window.__fgi3d.state().opts.baseColor; })()")
    pg.evaluate("window.__fgiScene.show(104, 1)")
    ok = wait3d(pg, f"s.kind === 'fog' && s.opts.baseColor !== {cv}", 8000)
    check("the next scene with the same effect only changes its colours (the same canvas)", ok and pg.evaluate("(document.querySelector('canvas.vanta-canvas') || {dataset: {}}).dataset.mark") == "1")

    # ---------- the story scene follows the light/dark switch (it used to draw the theme just left) ----------
    pg.goto(SEEDED + "#settings"); pg.wait_for_timeout(1500)
    pg.evaluate("window.__fgiScene.show(100, 0)")
    wait3d(pg, "s.kind === 'fog' && window.__fgiScene.now().w === 100 && s.opts.baseColor === parseInt(window.__fgi3d.want().opts.baseColor.slice(1), 16)", 15000); pg.wait_for_timeout(300)
    T = "(() => { const bg = document.getElementById('story-bg'); return {theme: document.documentElement.getAttribute('data-theme'), lt: bg.classList.contains('lt'), sky: document.getElementById('bg3d').style.background}; })()"
    t0 = pg.evaluate(T)
    theme(pg, 'light')
    t1 = pg.evaluate(T)
    check(f"dark → light: the scene is drawn light ({t0['lt']} → {t1['lt']})", t0["theme"] == "dark" and not t0["lt"] and t1["lt"] and t1["sky"] != t0["sky"])
    theme(pg, 'dark')
    try: pg.wait_for_function(f"document.getElementById('bg3d').style.background === {json.dumps(t0['sky'])}", timeout=8000, polling=150)
    except Exception: pass
    t2 = pg.evaluate(T)
    check(f"light → dark: and dark again ({t2['lt']}, {t2['sky'][:60]} / {t0['sky'][:60]})", not t2["lt"] and t2["sky"] == t0["sky"])
    ctx.close()

    # the same with the 3D background off: the drawn sky itself has to change
    ctx, pg = page(b, on=False, color_scheme="dark", extra="localStorage.setItem('spirit-origin-list:v1:theme','dark');")
    pg.goto(SEEDED + "#settings"); pg.wait_for_timeout(1500)
    check("a test tool's browser starts without it, and Settings shows Off", pg.evaluate("navigator.webdriver && !window.__fgi3d.state().on") and pg.locator('[data-action="bg3d"][data-v="0"]').get_attribute("aria-pressed") == "true")
    check("switched off, the libraries never run", pg.evaluate("typeof window.THREE === 'undefined' && typeof window.VANTA === 'undefined' && window.__fgi3d.state().lib === 0"))
    pg.evaluate("window.__fgiScene.show(100, 0)"); pg.wait_for_timeout(900)
    T2 = "(() => { const bg = document.getElementById('story-bg'), s = bg.querySelector('.sc:not(.out)'); return {lt: bg.classList.contains('lt'), sky: getComputedStyle(s).backgroundImage}; })()"
    a0 = pg.evaluate(T2)
    theme(pg, 'light')
    a1 = pg.evaluate(T2)
    theme(pg, 'dark')
    a2 = pg.evaluate(T2)
    check(f"the drawn scene follows the switch both ways ({a0['sky'][:40]} → {a1['sky'][:40]})", not a0["lt"] and a1["lt"] and a1["sky"] != a0["sky"] and not a2["lt"] and a2["sky"] == a0["sky"])
    ctx.close()

    # ---------- reduced motion, and a browser without WebGL: the drawn background, no errors ----------
    ctx, pg = page(b, reduced_motion="reduce")
    pg.goto(SEEDED + "#settings"); pg.wait_for_timeout(2000)
    st = pg.evaluate(S3); note = pg.locator(".bg3d-note").first
    check(f"reduce motion: no 3D picture, and Settings says why ({st})", st["kind"] is None and st["lib"] == 0 and pg.evaluate("document.querySelectorAll('canvas.vanta-canvas').length") == 0 and note.is_visible() and "motion" in note.inner_text())
    ctx.close()
    ctx, pg = page(b, extra="const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t) { return /webgl/.test(t) ? null : gc.apply(this, arguments); };")
    pg.goto(SEEDED + "#settings"); pg.wait_for_timeout(2000)
    st = pg.evaluate(S3); d = pg.evaluate(DOM)
    check(f"no WebGL: the drawn background stays, and Settings says why ({st['dead']}, {st['kind']}, {d})", st["kind"] is None and "WebGL" in st["dead"] and d["gl"] == 0 and "bg3d-on" not in d["cls"] and pg.locator(".bg3d-note").first.is_visible())
    ctx.close()

    # ---------- a phone ----------
    ctx, pg = page(b, 390, 844, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg.goto(SEEDED + "#home")
    ok = wait3d(pg, "s.kind === 'globe' && s.frames > 0", 20000); st = pg.evaluate(S3)
    check(f"a phone draws it smaller still ({st['size']})", ok and st["size"][0] * st["size"][1] <= 0.64e6)
    ctx.close()
    b.close()
if errs: print("page errors:", errs[:3])
print(f"FAILED {len(fails)}: {fails} errors {errs[:2]}" if fails or errs else "all passed")
sys.exit(1 if fails or errs else 0)
