import os
# 0.20.1: the class name only moves and fades (so it never repaints), Beast waves reach the edge,
# and the gold grail outline stays under the Compact ×.
import sys, tempfile, json
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
def page(p, layout="modern", w=1600, h=950):
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": w, "height": h})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(INIT + f"localStorage.setItem('spirit-origin-list:v1:layout','{layout}');")
    pg.route("https://**", lambda r: r.abort())
    return ctx, pg

# what a CSS animation may change and still run on the graphics card without repainting
SMOOTH = {"transform", "opacity", "filter", "offset", "composite", "easing", "computedOffset"}
KEYFRAME_PROPS = """() => { const out = {};
  for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; }
    for (const r of rules) if (r.type === CSSRule.KEYFRAMES_RULE && /^pc[A-Z]/.test(r.name)) {
      const ps = new Set(); for (const k of r.cssRules) for (let i = 0; i < k.style.length; i++) ps.add(k.style[i]); out[r.name] = [...ps]; } }
  return out; }"""
LIVE_PROPS = """() => document.getElementById('page-class').getAnimations({subtree: true}).map(a => a.effect.getKeyframes().flatMap(k => Object.keys(k))).flat()"""
COVER = """() => { const cv = document.querySelector('#dossier .scene canvas.scene-fx'); const c = cv.getContext('2d'); const w = cv.width, h = cv.height;
  const col = (x) => { const d = c.getImageData(x, 0, 1, h).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s / h; };
  return [col(w - 1), col(w - 15), w]; }"""

with sync_playwright() as p:
    # ================= the class name =================
    ctx, pg = page(p)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    kf = pg.evaluate(KEYFRAME_PROPS)
    bad = {n: [x for x in ps if x not in SMOOTH] for n, ps in kf.items()}
    bad = {n: ps for n, ps in bad.items() if ps}
    check(f"every class-name animation ({len(kf)}) only moves and fades: no glow, colour, outline or blur keyframes {bad}", len(kf) >= 30 and not bad)
    check("no blur in any class-name keyframe", not any("blur" in json.dumps(v) for v in pg.evaluate("""() => { const o = []; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (r.type === CSSRule.KEYFRAMES_RULE && /^pc[A-Z]/.test(r.name)) o.push(r.cssText); } catch (e) {} } return o; }""")))
    for sid, name in (("cu-chulainn-alter", "BERSERKER"), ("illya", "CASTER"), ("nitocris-alter", "AVENGER")):
        pg.click(f'#list .row[data-id="{sid}"]'); pg.wait_for_timeout(1600)
        live = set(pg.evaluate(LIVE_PROPS)) - SMOOTH
        word = pg.evaluate("[...document.querySelectorAll('#page-class .pc-word span:not(.sp)')].map(s => s.textContent).join('')")
        glow = pg.evaluate("[...document.querySelectorAll('#page-class .pc-word span:not(.sp)')].map(s => getComputedStyle(s, '::after').content.replace(/\"/g, '')).join('')")
        check(f"{name}: the running animations touch only transform, opacity or filter ({sorted(live)})", word == name and not live)
        check(f"{name}: each letter has its ready-made glow copy ({glow!r})", glow == name)
    ctx.close()

    # ================= Beast waves reach the right edge =================
    for layout in ("modern", "compact"):
        ctx, pg = page(p, layout)
        pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
        pg.click('#list .row[data-id="space-ereshkigal"]'); pg.wait_for_timeout(1800)
        edge, inner, w = pg.evaluate(COVER)
        check(f"{layout}: Space Ereshkigal's waves cover the last pixel column like the rest (edge {edge:.0f} vs inside {inner:.0f}, canvas {w} px)", inner > 20 and edge >= inner * 0.85)
        ctx.close()

    # ================= the grail outline stays under the Compact × =================
    ctx, pg = page(p, "compact")
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.click('#list .row[data-id="space-ereshkigal"]'); pg.wait_for_timeout(1500)
    check("Space Ereshkigal at Lv 100 has the gold outline in Compact", pg.locator(".ds-frame.gr100").is_visible() and pg.locator(".cmp-x").is_visible())
    bb = pg.locator(".cmp-x").bounding_box()
    clip = {"x": bb["x"] + 9, "y": bb["y"] + 9, "width": bb["width"] - 18, "height": bb["height"] - 18}  # a square well inside the round button
    pg.mouse.move(5, 5); pg.wait_for_timeout(200)
    with_frame = pg.screenshot(clip=clip)
    pg.add_style_tag(content=".ds-frame { visibility: hidden !important; }"); pg.wait_for_timeout(200)
    without = pg.screenshot(clip=clip)
    check("nothing of the outline shows on the × (same pixels with the outline hidden)", with_frame == without)
    pg.click(".cmp-x"); pg.wait_for_timeout(500)
    check("the × still closes the window", pg.locator("#dossier.open").count() == 0)
    ctx.close()

    # ================= Modern: the outline is still drawn around the panel =================
    ctx, pg = page(p, "modern")
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.click('#list .row[data-id="space-ereshkigal"]'); pg.wait_for_timeout(1200)
    fr = pg.locator(".ds-frame").bounding_box(); ds = pg.locator("#dossier").bounding_box()
    check(f"Modern: the outline follows the panel ({fr and [round(fr[k]) for k in ('x', 'y', 'width')]} vs {[round(ds[k]) for k in ('x', 'y', 'width')]})",
          fr and all(abs(fr[k] - ds[k]) < 1.5 for k in ("x", "y", "width", "height")))
    ctx.close()

print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
