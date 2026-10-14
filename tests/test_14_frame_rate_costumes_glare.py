import os
import sys, tempfile, json, re, time
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
EMPTY = f"{URL}/out/Fate_Grand_Index.html"
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
def atlas(r):
    u = r.request.url
    f = "ph_buff.png" if "BuffIcons" in u else "ph_skill.png" if "SkillIcons" in u else "ph_face.png" if "/Faces/" in u else "ph_graph.png"
    r.fulfill(path=f"{sp}/{f}", content_type="image/png")
def docs(pg):
    v = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')") or '{"servants": []}')["servants"]; return v if isinstance(v, list) else list(v.values())
def doc(pg, sid): return next((d for d in docs(pg) if d.get("id") == sid), None)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
def page(p, w=1360, h=1000, init=""):
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": w, "height": h})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(INIT + init)
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("https://static.atlasacademy.io/**", atlas)
    return ctx, pg
STEPS = """(fps) => { const k = 1000 / fps; const run = document.getAnimations().filter(a => a instanceof CSSAnimation && a.playState === 'running' && !(a.effect.target.closest && a.effect.target.closest('#summon')));
  const bad = run.filter(a => { const t = a.effect.getTiming(), st = a.startTime; const ph = st == null ? 0 : ((st + (t.delay || 0)) % k + k) % k;
    return !String(t.easing).startsWith('steps(') || Math.abs(t.duration / k - Math.round(t.duration / k)) > 1e-6 || (st != null && Math.min(ph, k - ph) > 0.6); });
  return [run.length, bad.length, bad.slice(0, 3).map(a => a.animationName + ' ' + a.effect.getTiming().easing)]; }"""

with sync_playwright() as p:
    # ================= frame rate and resting =================
    ctx, pg = page(p)
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(2200)
    check("a 0.18+ version in the top-left chip", re.search(r"v0\.(1[89]|[2-9]\d)\.\d+", pg.locator(".masthead .ver-chip").first.inner_text()) is not None)
    r = pg.evaluate(STEPS, 60)
    check(f"60 fps: every running CSS animation steps 1/60 s on the shared clock ({r[0]} running, off: {r[2]})", r[0] > 10 and r[1] == 0)
    pg.click("#fps-btn"); pg.wait_for_timeout(700)
    r = pg.evaluate(STEPS, 30)
    check(f"30 fps: every running CSS animation steps 1/30 s ({r[0]} running, off: {r[2]})", r[0] > 10 and r[1] == 0)
    held = pg.evaluate("document.getAnimations().filter(a => a instanceof CSSAnimation && a.playState === 'paused' && !(a.effect.target.closest && a.effect.target.closest('[data-off]'))).length")
    check(f"nothing is held paused from JavaScript any more ({held})", held == 0)
    pg.evaluate("window.dispatchEvent(new Event('blur'))"); pg.wait_for_timeout(300)
    run = pg.evaluate("document.getAnimations().filter(a => a instanceof CSSAnimation && a.playState === 'running').length")
    check(f"when the window loses focus the background rests ({run} still running)", run == 0)
    pg.evaluate("window.dispatchEvent(new Event('focus'))"); pg.wait_for_timeout(600)
    r = pg.evaluate(STEPS, 30)
    check(f"and wakes up on the same clock when it's back ({r[0]} running, off: {r[2]})", r[0] > 10 and r[1] == 0)
    ctx.close()
    # the canvas follows the same rate: count how often the page canvas changes
    ctx, pg = page(p, init="localStorage.setItem('spirit-origin-list:v1:fps','30');")
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500); pg.keyboard.press("Escape")
    pg.click('#list .row[data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(1500)
    n = pg.evaluate("""() => new Promise(res => { const c = document.getElementById('page-fx'); const x = c.getContext('2d'); let last = '', n = 0, t0 = performance.now();
      const f = () => { const d = x.getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 4097) h = (h * 31 + d[i] + d[i + 3]) | 0; const k = String(h); if (k !== last) { n++; last = k; }
        if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); })""")
    check(f"the background canvas changes at most 30 times a second at 30 fps ({n}/s)", 0 < n <= 31)
    ctx.close()

    # ================= Past Chaldea: Overcharge rows =================
    ctx, pg = page(p)
    pg.goto(SEEDED + "#past"); pg.wait_for_timeout(1800)
    def npt(no):
        pg.evaluate(f"document.querySelector('[data-action=\"pc-open\"][data-no=\"{no}\"]').click()"); pg.wait_for_timeout(300)
        t = pg.evaluate("(() => { const t = document.querySelector('.pc-np'); return t ? t.innerText.replace(/\\s+/g, ' ') : ''; })()")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200); return t
    t = npt(10); check("d'Eon: Charm chance 30% → 70% by Overcharge", "Charm chance 30% 40% 50% 60% 70%" in t)
    t = npt(51); check("Kintoki: Stun chance 50% → 100% by Overcharge", "Stun chance 50% 62.5% 75% 87.5% 100%" in t)
    t = npt(16); check("Arash: extra damage from Overcharge", "Extra damage +0% +200% +400% +600% +800%" in t)
    t = npt(70); check("rows that were there stay (Death chance)", "Death chance 60% 70% 80% 90% 100%" in t)
    ctx.close()

    # ================= Compact: × on the window's corner =================
    ctx, pg = page(p, w=1440, h=950, init="localStorage.setItem('spirit-origin-list:v1:layout','compact');")
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500); pg.keyboard.press("Escape")
    pg.click('#list .row[data-id="space-ereshkigal"]'); pg.wait_for_timeout(900)
    over = pg.evaluate("""() => { const x = document.querySelector('.cmp-x').getBoundingClientRect();
      return [...document.querySelectorAll('#dossier button, #dossier a, #dossier label.btn')].filter(e => { const r = e.getBoundingClientRect(); return r.width && !(r.right <= x.left || r.left >= x.right || r.bottom <= x.top || r.top >= x.bottom); }).map(e => e.textContent.trim()); }""")
    check(f"× covers no button in the window ({over})", pg.locator(".cmp-x").is_visible() and over == [])
    pg.locator(".cmp-x").click(); pg.wait_for_timeout(400)
    check("× closes the window", pg.locator(".cmp-veil").is_hidden() and pg.locator(".cmp-x").is_hidden())
    pg.set_viewport_size({"width": 1000, "height": 760}); pg.click('#list .row[data-id="space-ereshkigal"]'); pg.wait_for_timeout(700)
    over = pg.evaluate("""() => { const x = document.querySelector('.cmp-x').getBoundingClientRect();
      return [...document.querySelectorAll('#dossier button, #dossier a')].filter(e => { const r = e.getBoundingClientRect(); return r.width && !(r.right <= x.left || r.left >= x.right || r.bottom <= x.top || r.top >= x.bottom); }).length; }""")
    check(f"also on a narrower window ({over} covered)", over == 0)
    ctx.close()

    # ================= costumes =================
    ctx, pg = page(p)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500); pg.keyboard.press("Escape")
    pg.click('#list .row[data-id="artoria"]'); pg.wait_for_timeout(800)
    cos = pg.locator('#dossier .cos-cell .cos-x')
    check("an empty costume slot has a × to remove it", cos.count() >= 1)
    before = len([d for d in docs(pg) if d.get("costumeSlots") == 0])
    cos.first.click(); pg.wait_for_timeout(600)
    d = doc(pg, "artoria")
    check("× removes the costume slot (saved as no costume)", d and d.get("costumeSlots") == 0 and pg.locator('#dossier .stage-btn[data-slot="c"]').count() == 0)
    check("+ Add costume is there to bring it back", pg.locator('#dossier [data-action="add-costume"]').count() == 1)
    tb = pg.locator("#toast .toast-btn")
    check(f"the toast offers Undo and every servant ({[tb.nth(i).inner_text() for i in range(tb.count())]})", tb.count() == 2 and tb.nth(0).inner_text() == "Undo" and tb.nth(1).inner_text().startswith("Every servant"))
    tb.nth(0).click(); pg.wait_for_timeout(500)
    d = doc(pg, "artoria")
    check("Undo brings the costume slot back", d and d.get("costumeSlots") != 0 and pg.locator('#dossier .stage-btn[data-slot="c"]').count() == 1)
    pg.locator('#dossier .cos-cell .cos-x').first.click(); pg.wait_for_timeout(500)
    m = re.search(r"\((\d+)\)", pg.locator("#toast .toast-btn").nth(1).inner_text()); n = int(m.group(1)) if m else -1
    pg.locator("#toast .toast-btn").nth(1).click(); pg.wait_for_timeout(700)
    zero = [x["id"] for x in docs(pg) if x.get("costumeSlots") == 0]
    check(f"Every servant clears the empty costume slot from {n} more", n > 2 and len(zero) == n + 1)
    pg.click('#list .row[data-id="ereshkigal"]'); pg.wait_for_timeout(500)
    check("their pages show no costume slot", pg.locator('#dossier .stage-btn[data-slot="c"]').count() == 0)
    pg.locator("#toast .toast-btn").first.click(); pg.wait_for_timeout(600)
    check("one Undo restores all of them", len([x for x in docs(pg) if x.get("costumeSlots") == 0]) == 1)
    pg.click('#list .row[data-id="artoria"]'); pg.wait_for_timeout(500)
    pg.click('#dossier [data-action="add-costume"]'); pg.wait_for_timeout(500)
    check("+ Add costume gives the slot back", doc(pg, "artoria").get("costumeSlots") == 1 and pg.locator('#dossier .stage-btn[data-slot="c"]').count() == 1)
    pg.locator('#dossier .cos-cell .cos-x').first.click(); pg.wait_for_timeout(400)
    pg.reload(); pg.wait_for_timeout(1500); pg.keyboard.press("Escape"); pg.click('#list .row[data-id="artoria"]'); pg.wait_for_timeout(600)
    check("a removed costume stays removed after reload", pg.locator('#dossier .stage-btn[data-slot="c"]').count() == 0)
    # fill-in brings the pictures but not the costume back
    fb = pg.locator('#dossier .fill-one [data-action="fill-one"]')
    if fb.count():
        fb.first.click(); pg.wait_for_timeout(900)
        d = doc(pg, "artoria")
        check("Fill in adds the stage pictures but keeps the costume removed", d.get("costumeSlots") == 0 and any(k in (d.get("art") or {}) for k in "1234") and not any(re.match(r"^c\d*$", k) for k in (d.get("art") or {})))
    else: check("(Fill in offered for this servant)", False)
    # shine
    sh = pg.evaluate("document.querySelector('#dossier .art-frame').dataset.shine")
    check(f"Lv 70 Artoria's picture has the base shine ({sh})", sh == "0")
    pg.click('#list .row[data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(600)
    pg.click('#dossier .fill-one [data-action="fill-one"]'); pg.wait_for_timeout(900)
    sh = pg.evaluate("document.querySelector('#dossier .art-frame').dataset.shine")
    check(f"Lv 100 shines more ({sh})", sh == "2")
    ctx.close()

    # ================= phone: costume × is reachable =================
    ctx, pg = page(p, w=390, h=860)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1400)
    pg.click('#list .row[data-id="ereshkigal"]'); pg.wait_for_timeout(800)
    x = pg.locator('#dossier .cos-x').first
    check("phone: the costume × is visible", x.count() == 1 and x.is_visible())
    ctx.close()

print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
