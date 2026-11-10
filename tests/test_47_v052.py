import os
# 0.52.0-beta: the summoning rite (layers by rarity), power saving and idle rest, Compact opening like Past Chaldea's
# window and beside the sidebar, the story scenes with depth (which scene, the sheets, the camera, flat at rest, the
# way down in Nahui Mictlan), and the account button centred in the folded sidebar.
import sys, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
def page(b, w=1440, h=900, extra="", **kw):
    ctx = b.new_context(viewport={"width": w, "height": h}, **kw); pg = ctx.new_page(); pg.add_init_script(INIT + extra)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    return ctx, pg
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, pg = page(b)
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(1500)

    # ---------- the rite: what each rarity gets ----------
    P = pg.evaluate("[5, 4, 3, 2, 1].map((r) => window.__fgiSummon.plan(r, 's')).concat([5, 4, 3].map((r) => window.__fgiSummon.plan(r, 'c')))")
    check(f"a ★5 servant: five layers, the long rite ({P[0]})", P[0]["layers"] == 5 and 12 <= P[0]["seconds"] <= 16)
    check(f"a ★4 servant: four layers, a little shorter ({P[1]})", P[1]["layers"] == 4 and 8.5 <= P[1]["seconds"] < P[0]["seconds"])
    check(f"a ★3 servant: three layers, brisk ({P[2]})", P[2]["layers"] == 3 and 2 <= P[2]["seconds"] <= 5)
    check(f"★1 and ★2: no rite ({P[3]}, {P[4]})", P[3]["seconds"] == 0 and P[4]["seconds"] == 0)
    check(f"Craft Essences are quicker than servants of their rarity ({[x['seconds'] for x in P[5:]]})", P[5]["seconds"] < P[0]["seconds"] / 2 and P[6]["seconds"] < P[1]["seconds"] / 2 and P[7]["seconds"] <= P[2]["seconds"])
    check(f"rainbow for a ★5 servant, gold for ★4 ({P[0]['tier']}, {P[1]['tier']})", P[0]["tier"] != P[1]["tier"] and P[1]["tier"] != P[2]["tier"])

    # ---------- power saving ----------
    st = pg.evaluate("window.__fgiPower.state()")
    check(f"power saving is on to begin with: the background at half the frame rate ({st})", st["save"] and st["amb"] == max(15, st["fps"] / 2) and not st["idle"])
    pg.goto(SEEDED + "#settings"); pg.wait_for_timeout(900)
    row = pg.locator('[data-action="power"]')
    check("Settings has the switch", row.count() == 2 and pg.locator('[data-action="power"][data-v="1"]').get_attribute("aria-pressed") == "true")
    pg.locator('[data-action="power"][data-v="0"]').click(); pg.wait_for_timeout(400)
    st = pg.evaluate("window.__fgiPower.state()")
    check(f"Off gives the full rate back, and it's kept ({st})", not st["save"] and st["amb"] == st["fps"] and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:power')") == "full")
    pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(400)
    check("Undo turns it back on", pg.evaluate("window.__fgiPower.state().save") and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:power')") is None)
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(1500)
    run0 = pg.evaluate("document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).length")
    pg.evaluate("window.__fgiPower.idleAfter(200)"); pg.wait_for_timeout(500); pg.evaluate("window.__fgiPower.check()"); pg.wait_for_timeout(400)
    run1 = pg.evaluate("document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).length")
    check(f"with no input the looping animations rest ({run0} running → {run1})", run0 > 5 and run1 == 0 and pg.evaluate("window.__fgiPower.state().idle") and pg.evaluate("document.documentElement.classList.contains('idle-rest')"))
    pg.mouse.move(400, 400); pg.wait_for_timeout(500)
    run2 = pg.evaluate("document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getTiming().iterations === Infinity).length")
    check(f"and the first move wakes them ({run2})", run2 >= run0 - 3 and not pg.evaluate("window.__fgiPower.state().idle"))
    pg.evaluate("window.__fgiPower.idleAfter(null)")

    # ---------- story scenes ----------
    L = pg.evaluate("window.__fgiScene.list()")
    acts = sum(len(c["acts"]) for c in L)
    check(f"every chapter has scenes of its own ({len(L)} chapters, {acts} scenes)", len(L) == 29 and acts >= 90 and all(len(c["acts"]) >= 1 for c in L))
    nm = next(c for c in L if c["w"] == 311)
    check(f"Nahui Mictlan goes down, stratum by stratum ({len(nm['acts'])} scenes, {nm['dir']})", nm["dir"] == "down" and len(nm["acts"]) == 8 and "Fourth Underworld" in " ".join(nm["acts"]))
    names = ["Section %d" % (j + 1) for j in range(20)]; names[1] = "Section 2: Golden Sea of Trees"; names[4] = "Section 5: First Underworld, Tlatlauqui"; names[12] = "Act 13: Fourth Underworld, Yayauhqui"
    got = {i: pg.evaluate("([n, i]) => window.__fgiScene.actFor(311, n, i)", [names, i]) for i in (0, 1, 3, 4, 5, 11, 12, 13, 19)}
    check(f"which scene is up follows the sections you've reached, by their names ({got})", got[0] == 0 and got[1] == 1 and got[3] == 1 and got[4] == 2 and got[5] == 2 and got[12] == 5 and got[13] == 5)
    check(f"a scene the data doesn't name goes by how far you are, never past a named one you haven't reached ({got[11]}, {got[19]})", got[11] == 4 and got[19] == 7)
    plain = [pg.evaluate("([n, i]) => window.__fgiScene.actFor(106, n, i)", [["q%d" % j for j in range(20)], i]) for i in (0, 9, 19)]
    check(f"and where the names say nothing, how far through the chapter you are ({plain})", plain[0] == 0 and plain[1] >= 1 and plain[2] == 3)
    pg.evaluate("window.__fgiScene.show(311, 1)"); pg.wait_for_timeout(500)
    pl = pg.evaluate("window.__fgiScene.planes()")
    zs = [x["z"] for x in pl]
    check(f"a scene is sheets one behind the other ({zs})", len(pl) >= 3 and min(zs) < -1300 and max(zs) == 0 and len(set(zs)) >= 3)
    geo = pg.evaluate("(() => { const s = document.querySelector('#story-bg .sc'), c = s.querySelector('.sc-cam'); return [getComputedStyle(s).perspective, getComputedStyle(c).transformStyle, document.querySelectorAll('#story-bg canvas').length]; })()")
    check(f"in real perspective, without a canvas ({geo})", geo[0] == "1000px" and geo[1] == "preserve-3d" and geo[2] == 0)
    box = lambda: pg.evaluate("Array.from(document.querySelectorAll('#story-bg .sc:not(.out) .sc-pl')).map((e) => Math.round(e.getBoundingClientRect().left * 10) / 10)")
    x0 = box(); pg.evaluate("window.__fgiScene.cam(1, 0)"); pg.wait_for_timeout(1700); x1 = box()
    mv = [round(a - b_, 1) for a, b_ in zip(x1, x0)]
    check(f"the camera moves near sheets further than far ones ({mv})", mv[-1] < -20 and abs(mv[-1]) > abs(mv[0]) + 10 and len(set(mv)) >= 3)
    pg.evaluate("window.__fgiScene.cam(0, 0)"); pg.wait_for_timeout(1500)
    check("with the camera home and nothing moving, the sheets lie flat (less work for the graphics card)", pg.evaluate("window.__fgiScene.rest(), window.__fgiScene.flat()") is True and pg.evaluate("getComputedStyle(document.querySelector('#story-bg .sc-cam')).transform") == "none")
    x2 = box()
    check(f"and flat they're where depth had them ({[round(a - b_, 1) for a, b_ in zip(x2, x0)][:4]})", all(abs(a - b_) < 1.5 for a, b_ in zip(x2, x0)))
    pg.evaluate("window.__fgiScene.cam(null)"); pg.mouse.move(1200, 300); pg.wait_for_timeout(500)
    check("the pointer brings depth back", pg.evaluate("window.__fgiScene.flat()") is False)
    pg.evaluate("window.__fgiScene.cam(0, 0)"); pg.wait_for_timeout(300)
    pg.evaluate("window.__fgiScene.go(311, 2)"); pg.wait_for_timeout(250)
    tr = pg.evaluate("Array.from(document.querySelectorAll('#story-bg .sc')).map((e) => e.className)")
    check(f"going down a stratum: the old scene leaves upwards as the new one comes from below ({tr})", len(tr) == 2 and "to-above" in tr[0] and "from-below" in tr[1])
    pg.wait_for_timeout(2600)
    check("and one scene is left afterwards", pg.evaluate("document.querySelectorAll('#story-bg .sc').length") == 1 and pg.evaluate("window.__fgiScene.now().a") == 2)
    pg.evaluate("window.__fgiScene.go(311, 1)"); pg.wait_for_timeout(250)
    tr = pg.evaluate("Array.from(document.querySelectorAll('#story-bg .sc')).map((e) => e.className)")
    check(f"going back up is the other way round ({tr})", "to-below" in tr[0] and "from-above" in tr[1])
    pg.wait_for_timeout(2300)
    pg.evaluate("window.__fgiScene.show(103, 0)"); pg.wait_for_timeout(500)
    fl = pg.evaluate("window.__fgiScene.planes().filter((x) => x.k === 'floor').length")
    check(f"the sea is a floor that runs towards the eye ({fl})", fl >= 1 and pg.evaluate("getComputedStyle(document.querySelector('#story-bg .sc-floor')).transform").startswith("matrix3d"))
    pg.evaluate("window.__fgiScene.show(null)"); pg.wait_for_timeout(300)
    ctx.close()

    # reduced motion: the scene is there, still
    ctx, pg = page(b, reduced_motion="reduce")
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(1300)
    pg.evaluate("window.__fgiScene.show(106, 0)"); pg.wait_for_timeout(300); pg.mouse.move(1300, 200); pg.wait_for_timeout(500)
    pg.evaluate("window.__fgiScene.go(106, 2)"); pg.wait_for_timeout(200)
    rm = pg.evaluate("[document.querySelectorAll('#story-bg .sc:not(.out)').length, document.querySelector('#story-bg').style.getPropertyValue('--cx'), document.querySelectorAll('#story-bg .sc.in').length]")
    check(f"with reduced motion the camera stays home and scenes swap without travelling ({rm})", rm[0] == 1 and rm[1] in ("", "0.0px", "-0.0px") and rm[2] == 0)
    ctx.close()

    # ---------- Compact opens like Past Chaldea's window, beside the sidebar ----------
    ctx, pg = page(b, 1366, 768, extra="localStorage.setItem('spirit-origin-list:v1:layout','compact');")
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    cl = pg.evaluate("(() => { const r = document.querySelector('#list .row[data-id]') || document.querySelector('#list [data-id]'); r.click(); const d = document.getElementById('dossier'); return [d.classList.contains('cmp-drop'), document.querySelectorAll('.cmp-card').length, document.querySelectorAll('.cmp-rise').length, getComputedStyle(d).animationName, d.className, document.documentElement.dataset.layout]; })()")
    check(f"the window drops in, its card and parts after it ({cl})", cl[0] and cl[1] >= 1 and cl[2] >= 2 and cl[3] != "none")
    pg.wait_for_timeout(1300)
    after = pg.evaluate("[document.querySelectorAll('.cmp-drop, .cmp-card, .cmp-rise').length, document.documentElement.classList.contains('cmp-dropping')]")
    check(f"and the classes are gone once it has ({after})", after[0] == 0 and not after[1])
    g = pg.evaluate("(() => { const d = document.getElementById('dossier').getBoundingClientRect(), s = document.querySelector('.side').getBoundingClientRect(); return [Math.round(d.left), Math.round(s.right), Math.round(d.right), innerWidth]; })()")
    check(f"the window is beside the sidebar, not under it ({g})", g[0] >= g[1] and g[2] <= g[3])
    ctx.close()

    # ---------- the folded sidebar: the account button is centred ----------
    ctx, pg = page(b)
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(1300)
    c = pg.evaluate("""(() => { const host = document.querySelector('.side .mast-actions');
      host.insertAdjacentHTML('afterbegin', '<button type="button" id="acct-btn" class="btn acct-btn in"><span class="acct-av">N</span><span class="acct-nm">Noyr</span><i class="sync-dot s-ok"></i></button>');
      document.querySelector('.side').classList.add('has-acct'); document.documentElement.classList.add('side-mini');
      const mid = (e) => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; };
      return [mid(document.querySelector('#acct-btn .acct-av')), mid(document.querySelector('.side-cog')), mid(document.querySelector('.side .tab'))]; })()""")
    check(f"folded, the account's initial sits on the same line as the cog and the icons ({c})", abs(c[0] - c[1]) < 0.6 and abs(c[0] - c[2]) < 0.6)
    ctx.close()

    # ---------- a phone ----------
    ctx, pg = page(b, 390, 844, is_mobile=True, has_touch=True)
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(1300)
    pg.evaluate("window.__fgiScene.show(311, 3)"); pg.wait_for_timeout(500)
    ph = pg.evaluate("[window.__fgiScene.planes().length, document.scrollingElement.scrollWidth <= innerWidth + 1, document.querySelectorAll('#story-bg .sb-parts i').length]")
    check(f"on a phone the scene fits, with a handful of specks ({ph})", ph[0] >= 3 and ph[1] and ph[2] <= 16)
    b.close()
if errs: print("page errors:", errs[:3])
print(f"FAILED {len(fails)}: {fails} errors {errs[:2]}" if fails or errs else "all passed")
sys.exit(1 if fails or errs else 0)
