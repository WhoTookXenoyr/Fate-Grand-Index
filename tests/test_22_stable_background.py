import os
# 0.24.0: on a phone, scrolling up brings the address bar back, which changes only the window's height, many times a
# second. The background used to be sized from that height, so it grew, shrank, cleared and jumped ("resets and jitters
# incessantly"). Now it keeps the tallest height seen at this width, and only a new width changes it.
import sys
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = """localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');
window.__redraws = 0;
document.addEventListener('DOMContentLoaded', () => { new MutationObserver((ms) => ms.forEach((m) => { if (m.target.tagName === 'CANVAS' && m.attributeName === 'width') window.__redraws++; }))
  .observe(document.body, {subtree: true, attributes: true, attributeFilter: ['width']}); });"""
BOXES = """() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
  const o = (s) => { const e = document.querySelector(s); return e ? [e.offsetWidth, e.offsetHeight] : null; };
  return {aura: r('.aura'), a1: o('.aura .a1'), a3: o('.aura .a3'), idle: r('.idle-bg'), circle: o('.ib-circle'), fx: r('#page-fx'), bg: getComputedStyle(document.documentElement).getPropertyValue('--bg-h').trim()}; }"""
ANIMS = """() => document.getAnimations().filter((a) => { const t = a.effect && a.effect.target; return t && t.closest && t.closest('.aura, .idle-bg') && a.playState === 'running'; })
  .map((a) => [a.animationName, Math.round(a.startTime), Math.round(a.currentTime)])"""
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, w, h, mobile in (("phone", 390, 844, True), ("tablet", 820, 1180, True)):
        ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile); pg = ctx.new_page()
        pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.route("https://**", lambda r: r.abort())
        # the frame-rate cap lines every animation up on its clock within the first few seconds; measure after that
        pg.goto(SEEDED + "#home"); pg.wait_for_timeout(3200)
        b0, a0, r0 = pg.evaluate(BOXES), pg.evaluate(ANIMS), pg.evaluate("window.__redraws")
        # the address bar slides in and out: only the height changes, many times
        for i in range(12):
            pg.set_viewport_size({"width": w, "height": h - (56 if i % 2 == 0 else 20 + i)}); pg.wait_for_timeout(40)
        mid = pg.evaluate(BOXES)
        pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(400)
        check(f"{name}: with the bar showing, the background is still full height ({mid['aura']}, --bg-h {mid['bg']})", mid["aura"] == b0["aura"] and mid["a1"] == b0["a1"])
        b1, a1, r1 = pg.evaluate(BOXES), pg.evaluate(ANIMS), pg.evaluate("window.__redraws")
        check(f"{name}: the background keeps its size while only the height changes ({b0} -> {b1})", b0 == b1 and b0["aura"][1] >= h)
        check(f"{name}: no background canvas is cleared and redrawn ({r1 - r0} redraws)", r1 == r0)
        st0 = {(n, s) for n, s, c in a0}; st1 = {(n, s) for n, s, c in a1}
        check(f"{name}: no background animation starts over ({len(a0)} running; same start times: {st0 == st1})", len(a0) > 0 and st0 == st1 and all(c1 >= c0 for (_, _, c0), (_, _, c1) in zip(sorted(a0), sorted(a1))))
        # a taller window (the bar hidden for good) grows the background once
        pg.set_viewport_size({"width": w, "height": h + 60}); pg.wait_for_timeout(300)
        b2 = pg.evaluate(BOXES)
        check(f"{name}: a taller window grows it ({b2['aura']})", b2["aura"][1] == h + 60)
        pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(300)
        check(f"{name}: and shrinking back keeps it ({pg.evaluate(BOXES)['aura']})", pg.evaluate(BOXES)["aura"][1] == h + 60)
        # turning the device: a new width starts over at the new height
        pg.set_viewport_size({"width": h, "height": w}); pg.wait_for_timeout(500)
        b3 = pg.evaluate(BOXES)
        check(f"{name}: turning it sideways sizes the background for the new shape ({b3['aura']})", b3["aura"] == [h, w])
        ctx.close()
    # a desktop window looks the same as before: the background fills the window
    ctx = b.new_context(viewport={"width": 1360, "height": 900}); pg = ctx.new_page(); pg.add_init_script(INIT); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(1500)
    bx = pg.evaluate(BOXES)
    check(f"desktop: the background fills the window ({bx})", bx["aura"] == [1360, 900] and bx["idle"] == [1360, 900] and bx["a1"] == [round(1360 * 0.62)] * 2 and bx["bg"] == "900px")
    b.close()
print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
