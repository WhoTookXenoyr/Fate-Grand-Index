import os
# 0.56.0-beta: Class Score lights up, and zooms (68-class-score.js). Opening squares sends a beam along each new line,
# from what was open to the sign, in the sign's colour; the sign pops when it arrives. A way of several squares lights
# up in order, a start sign gets its light from the emblem, Open every square fits in under 3 seconds, a redraw midway
# carries on, only transform and opacity move, and nothing runs with reduced motion. Zoom: + and −, Ctrl + wheel,
# pinch, dragging; kept through a redraw, back to 100% on another board. Atlas Academy is stood in for.
import sys, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));localStorage.setItem('spirit-origin-list:v1:statsync','1')"
KEY = "spirit-origin-list:v1"
CB = json.loads(re.search(r"^const ATLAS_CB = (.*?);?$", open(f"{sp}/atlas_data.js", encoding="utf-8").read(), re.M).group(1))
BOARD = {b["id"]: b for b in CB["boards"]}
SQ = lambda bid: {q[0]: q for q in BOARD[bid]["sq"]}
CS = "window.__fgiClassScore"
CARD = {"B": "var(--buster)", "A": "var(--arts)", "Q": "var(--quick)"}
def colour(q):
    if q[3] == "c": return "var(--csx-cs)"
    if q[3] == "p": return CARD.get(CB["sk"][str(q[4])]["c"], "var(--gold)")
    return "var(--gold)"
MS = lambda v: float(v.strip().replace("ms", "") or 0) if v.strip().endswith("ms") else float(v.strip().replace("s", "") or 0) * 1000
# every animation on the page's Class Score: what it changes
PROPS = """[...document.getAnimations()].filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#classscore'))
  .map((a) => { let k = []; try { a.effect.getKeyframes().forEach((f) => { k = k.concat(Object.keys(f)); }); } catch (e) {} return k; }).flat()"""
SKIP = {"offset", "computedOffset", "easing", "composite"}

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#classscore"); pg.wait_for_timeout(1800)
    roster = json.dumps(pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants"), sort_keys=True)
    s1 = SQ(1)

    # ---------- a start sign: its light comes from the emblem ----------
    start = [q[0] for q in BOARD[1]["sq"] if q[7]][0]
    pg.evaluate(f"document.querySelector('.csx-sq[data-sq=\"{start}\"]').click()"); pg.wait_for_timeout(100)
    pg.evaluate("document.querySelector('[data-action=\"csx-open\"]').click()"); pg.wait_for_timeout(60)
    st = pg.evaluate(f"""(() => {{ const q = document.querySelector('.csx-sq[data-sq="{start}"]'), bm = document.querySelectorAll('.csx-anim .csx-beam');
      return {{beams: bm.length, trail: document.querySelectorAll('.csx-anim .cb-t').length, c1: bm[0] && bm[0].style.getPropertyValue('--c1'), pop: q.classList.contains('pop'),
        cover: !!q.querySelector('.csx-cover'), on: q.classList.contains('on'), emb: document.querySelector('.csx-emblem').classList.contains('flash'), rings: document.querySelectorAll('.csx-ring').length,
        sparks: document.querySelectorAll('.csx-spk').length}}; }})()""")
    check(f"a start sign: one beam, out of the emblem, in the sign's colour, leaving no line behind ({st})",
          st["beams"] == 1 and st["trail"] == 0 and st["c1"] == colour(s1[start]) and st["emb"])
    check("it's open at once (the page and what's kept), and pops when the beam arrives, with rings and sparks", st["on"] and st["pop"] and st["cover"] and st["rings"] == 2 and st["sparks"] == 6
          and start in pg.evaluate(f"{CS}.open(1)"))
    props = set(pg.evaluate(PROPS)) - SKIP
    check(f"only transform and opacity move ({sorted(props)})", props and props <= {"transform", "opacity"})
    pg.wait_for_timeout(1500)
    st = pg.evaluate("[document.querySelectorAll('.csx-anim').length, document.querySelectorAll('.csx-cover').length, document.querySelectorAll('#classscore .pop').length, document.querySelectorAll('line.wait').length]")
    check(f"when it's over, nothing of it is left ({st})", st == [0, 0, 0, 0])

    # ---------- a way of several squares: one after another ----------
    far = [q[0] for q in BOARD[1]["sq"] if q[3] == "p"][-1]
    pg.evaluate(f"document.querySelector('.csx-sq[data-sq=\"{far}\"]').click()"); pg.wait_for_timeout(100)
    path = pg.evaluate(f"{CS}.path(1, {far})")
    before = set(pg.evaluate(f"{CS}.open(1)"))
    pg.evaluate("document.querySelector('[data-action=\"csx-path\"]').click()"); pg.wait_for_timeout(60)
    st = pg.evaluate("""(() => ({
      pops: [...document.querySelectorAll('.csx-sq.pop')].map((q) => [Number(q.dataset.sq), q.style.getPropertyValue('--d')]),
      beams: [...document.querySelectorAll('.csx-anim .csx-beam')].map((x) => [x.style.getPropertyValue('--c1'), x.style.getPropertyValue('--d'), !!x.querySelector('.cb-t')]),
      wait: document.querySelectorAll('.csx-lines line.on.wait').length, on: document.querySelectorAll('.csx-lines line.on').length,
      up: document.querySelectorAll('.csx-fx li.up').length, grow: document.querySelectorAll('.csx-tab.grow').length }))()""")
    d = {i: MS(v) for i, v in st["pops"]}
    order = [d.get(i) for i in path]
    check(f"Open the way here: every square on the way pops ({len(d)} of {len(path)})", set(d) == set(path))
    check(f"one after another, nearest first ({[round(x) for x in order]})", all(order[i] <= order[i + 1] for i in range(len(order) - 1)) and order[-1] > order[0])
    newl = [l for l in BOARD[1]["ln"] if not (l[0] in before and l[1] in before)]
    trail = [x for x in st["beams"] if x[2]]
    check(f"a beam for each new line ({len(trail)} of {len(st['beams'])}; a start sign's comes from the emblem and leaves none), each line drawn closed until its beam has passed ({st['wait']})",
          len(st["beams"]) >= len(path) and len(st["beams"]) - len(trail) <= 1 and st["wait"] == len(trail) and st["on"] >= st["wait"])
    cols = {x[0] for x in st["beams"]}
    want = {colour(s1[i]) for i in path}
    check(f"colourful: the beams take their signs' colours ({sorted(cols)})", want <= cols | {"var(--gold)"} and len(cols) >= 2)
    check(f"what went up lights up in What it adds ({st['up']}), and the board's bar grows ({st['grow']})", st["up"] >= 1 and st["grow"] == 1)
    # a redraw midway carries on instead of starting again
    pg.wait_for_timeout(250)
    pg.evaluate(f"document.querySelector('.csx-sq[data-sq=\"{path[0]}\"]').click()"); pg.wait_for_timeout(30)
    neg = pg.evaluate("[...document.querySelectorAll('.csx-anim .csx-beam')].map((x) => x.style.getPropertyValue('--d'))")
    check(f"a redraw midway (picking a sign) carries on where it was: the first beams are past their start ({neg[:3]})", any(MS(v) < 0 for v in neg))
    pg.wait_for_timeout(4200)
    check("and ends with the lines open", pg.locator(".csx-lines line.wait").count() == 0 and pg.locator(".csx-anim").count() == 0 and far in pg.evaluate(f"{CS}.open(1)"))

    # ---------- Undo and closing don't light anything ----------
    pg.evaluate(f"document.querySelector('.csx-sq[data-sq=\"{far}\"]').click()"); pg.wait_for_timeout(80)
    pg.evaluate("document.querySelector('[data-action=\"csx-close\"]').click()"); pg.wait_for_timeout(60)
    check("closing a sign draws nothing", pg.locator(".csx-anim").count() == 0 and pg.locator("#classscore .pop").count() == 0)

    # ---------- every square: under 3 seconds, lighter ----------
    pg.evaluate("document.querySelector('.csx-tab[data-b=\"8\"]').click()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('[data-action=\"csx-all\"]').click()"); pg.wait_for_timeout(80)
    st = pg.evaluate("""(() => ({pops: [...document.querySelectorAll('.csx-sq.pop')].map((q) => q.style.getPropertyValue('--d')), sparks: document.querySelectorAll('.csx-spk').length,
      rings: document.querySelectorAll('.csx-ring').length, beams: document.querySelectorAll('.csx-beam').length}))()""")
    last = max(MS(v) for v in st["pops"])
    check(f"Open every square: all 72 light up, the last within 3 s ({last:.0f} ms)", len(st["pops"]) == 72 and last <= 2700)
    check(f"with one ring each and no sparks, to stay light ({st['rings']} rings, {st['sparks']} sparks, {st['beams']} beams)", st["rings"] == 72 and st["sparks"] == 0 and st["beams"] >= 72)
    pg.wait_for_timeout(4200)
    check("a full board's emblem stays lit", pg.locator(".csx-map.full").count() == 1 and pg.locator(".csx-anim").count() == 0)
    pg.screenshot(path=f"{sp}/../t56-full.png")

    # ---------- zoom ----------
    pg.evaluate("document.querySelector('.csx-tab[data-b=\"1\"]').click()"); pg.wait_for_timeout(200)
    z0 = pg.evaluate("(() => { const w = document.querySelector('.csx-map-wrap'), m = w.querySelector('.csx-map'), q = document.querySelector('.csx-sq').getBoundingClientRect(); return {wh: w.clientHeight, ww: w.clientWidth, mw: m.offsetWidth, sq: q.width}; })()")
    check(f"at 100%: the map fills its frame, − and the % are off ({z0})", abs(z0["mw"] - z0["ww"]) <= 2 and pg.locator('.csx-zoom [data-z="out"]').is_disabled() and pg.locator(".csx-zl").inner_text() == "100%")
    pg.click('.csx-zoom [data-z="in"]'); pg.wait_for_timeout(120)
    z1 = pg.evaluate("(() => { const w = document.querySelector('.csx-map-wrap'), m = w.querySelector('.csx-map'), q = document.querySelector('.csx-sq').getBoundingClientRect(); return {wh: w.clientHeight, ww: w.clientWidth, mw: m.offsetWidth, sq: q.width, sl: w.scrollLeft, st: w.scrollTop}; })()")
    check(f"+ zooms to 150%: the map grows inside a frame of the same height, its signs with it ({z1})",
          pg.locator(".csx-zl").inner_text() == "150%" and abs(z1["mw"] - 1.5 * z0["mw"]) <= 3 and abs(z1["wh"] - z0["wh"]) <= 2 and abs(z1["sq"] - 1.5 * z0["sq"]) <= 2)
    check(f"around the middle ({z1['sl']:.0f}, {z1['st']:.0f})", abs(z1["sl"] - (z1["mw"] - z1["ww"]) / 2) <= 4 and z1["st"] > 0)
    # a redraw keeps it
    pg.evaluate(f"document.querySelector('.csx-sq[data-sq=\"{start}\"]').click()"); pg.wait_for_timeout(120)
    z2 = pg.evaluate("(() => { const w = document.querySelector('.csx-map-wrap'); return [w.scrollLeft, w.scrollTop, w.clientHeight]; })()")
    check(f"picking a sign keeps the zoom and where the map was ({z2})", pg.locator(".csx-zl").inner_text() == "150%" and abs(z2[0] - z1["sl"]) <= 2 and abs(z2[1] - z1["st"]) <= 2 and abs(z2[2] - z1["wh"]) <= 2)
    # Ctrl + wheel, around the pointer
    q = pg.locator(f'.csx-sq[data-sq="{start}"]').bounding_box(); cx, cy = q["x"] + q["width"] / 2, q["y"] + q["height"] / 2
    pg.mouse.move(cx, cy); pg.keyboard.down("Control"); pg.mouse.wheel(0, -100); pg.keyboard.up("Control"); pg.wait_for_timeout(150)
    q2 = pg.locator(f'.csx-sq[data-sq="{start}"]').bounding_box()
    zl = int(pg.locator(".csx-zl").inner_text().rstrip("%"))
    check(f"Ctrl + wheel zooms in ({zl}%), keeping the sign under the pointer where it was ({q2['x'] + q2['width'] / 2 - cx:.1f}, {q2['y'] + q2['height'] / 2 - cy:.1f})",
          zl > 150 and abs(q2["x"] + q2["width"] / 2 - cx) <= 3 and abs(q2["y"] + q2["height"] / 2 - cy) <= 3)
    y0 = pg.evaluate("scrollY"); pg.mouse.wheel(0, 200); pg.wait_for_timeout(150)
    check("a plain wheel doesn't zoom", int(pg.locator(".csx-zl").inner_text().rstrip("%")) == zl)
    # dragging moves the map and doesn't pick a sign
    sel0 = pg.evaluate("[...document.querySelectorAll('.csx-sq.sel')].map((q) => q.dataset.sq)")
    w = pg.locator(".csx-map-wrap").bounding_box(); s0 = pg.evaluate("[document.querySelector('.csx-map-wrap').scrollLeft, document.querySelector('.csx-map-wrap').scrollTop]")
    # (from a sign in sight, near the frame's middle)
    q = pg.evaluate("""(() => { const w = document.querySelector('.csx-map-wrap').getBoundingClientRect(), mx = w.left + w.width / 2, my = w.top + w.height / 2;
      let best = null; document.querySelectorAll('.csx-sq').forEach((q) => { const r = q.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, d = Math.hypot(x - mx, y - my);
        if (!best || d < best.d) best = {d: d, x: x, y: y}; }); return best; })()""")
    pg.mouse.move(q["x"], q["y"]); pg.mouse.down(); pg.mouse.move(q["x"] + 80, q["y"] + 50, steps=10); pg.mouse.up(); pg.wait_for_timeout(120)
    s1_ = pg.evaluate("[document.querySelector('.csx-map-wrap').scrollLeft, document.querySelector('.csx-map-wrap').scrollTop]")
    check(f"dragging with the mouse moves the map ({s0} → {s1_}) and doesn't pick the sign it started on",
          s1_[0] < s0[0] - 40 and s1_[1] < s0[1] - 20 and pg.evaluate("[...document.querySelectorAll('.csx-sq.sel')].map((q) => q.dataset.sq)") == sel0)
    pg.screenshot(path=f"{sp}/../t56-zoom.png")
    pg.click('.csx-zoom .csx-zl'); pg.wait_for_timeout(120)
    z3 = pg.evaluate("(() => { const w = document.querySelector('.csx-map-wrap'), m = w.querySelector('.csx-map'); return [w.style.height, w.scrollTop, Math.abs(m.offsetWidth - w.clientWidth) <= 2, w.classList.contains('zoomed')]; })()")
    check(f"the % goes back to the whole board ({z3})", pg.locator(".csx-zl").inner_text() == "100%" and z3 == ["", 0, True, False])
    pg.click('.csx-zoom [data-z="in"]'); pg.click('.csx-zoom [data-z="in"]'); pg.click('.csx-zoom [data-z="in"]'); pg.wait_for_timeout(100)
    check("it stops at 300%", pg.locator(".csx-zl").inner_text() == "300%" and pg.locator('.csx-zoom [data-z="in"]').is_disabled())
    pg.evaluate("document.querySelector('.csx-tab[data-b=\"2\"]').click()"); pg.wait_for_timeout(200)
    check("another board starts at 100%", pg.locator(".csx-zl").inner_text() == "100%" and pg.locator(".csx-map-wrap.zoomed").count() == 0)
    check("the roster is untouched", json.dumps(pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants"), sort_keys=True) == roster)
    ctx.close()

    # ---------- reduced motion: signs just open ----------
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#classscore"); pg.wait_for_timeout(1500)
    pg.evaluate(f"document.querySelector('.csx-sq[data-sq=\"{far}\"]').click()"); pg.wait_for_timeout(80)
    pg.evaluate("document.querySelector('[data-action=\"csx-path\"]').click()"); pg.wait_for_timeout(60)
    check("with reduced motion, the way opens with nothing drawn", pg.locator(".csx-anim").count() == 0 and pg.locator("#classscore .pop").count() == 0
          and pg.locator(".csx-lines line.wait").count() == 0 and far in pg.evaluate(f"{CS}.open(1)"))
    ctx.close()

    # ---------- a phone: a pinch zooms ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, color_scheme="dark")
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#classscore"); pg.wait_for_timeout(1800)
    w = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
    zb = pg.locator(".csx-zoom").bounding_box(); wb = pg.locator(".csx-map-box").bounding_box()
    check(f"phone: no sideways scrolling ({w}); the zoom buttons sit in the map's corner and are big enough to tap ({zb['height']:.0f}px)",
          w[0] <= w[1] + 1 and zb["x"] + zb["width"] <= wb["x"] + wb["width"] + 1 and zb["y"] + zb["height"] <= wb["y"] + wb["height"] + 1 and zb["height"] >= 40)
    pinch = """(() => { const w = document.querySelector('.csx-map-wrap'), r = w.getBoundingClientRect(), t = w.querySelector('.csx-sq');
      const mk = (id, x, y) => new Touch({identifier: id, target: t, clientX: x, clientY: y});
      const ev = (type, a, b) => t.dispatchEvent(new TouchEvent(type, {touches: [a, b], targetTouches: [a, b], changedTouches: [a, b], bubbles: true, cancelable: true}));
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      ev('touchstart', mk(1, cx - 40, cy), mk(2, cx + 40, cy));
      const ok = !ev('touchmove', mk(1, cx - 80, cy), mk(2, cx + 80, cy));
      t.dispatchEvent(new TouchEvent('touchend', {touches: [], changedTouches: [mk(1, cx - 80, cy)], bubbles: true}));
      return ok; })()"""
    stopped = pg.evaluate(pinch); pg.wait_for_timeout(120)
    check(f"pinching out zooms the map (to {pg.locator('.csx-zl').inner_text()}) and not the page ({stopped})", pg.locator(".csx-zl").inner_text() == "200%" and stopped)
    pg.screenshot(path=f"{sp}/../t56-phone.png")
    ctx.close()
    b.close()
if errs: check("no page errors: " + "; ".join(errs[:3]), False)
print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
