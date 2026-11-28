import os
# 0.58.0-beta: the game's own star row and class emblem on servant card frames (46-card-frames.js). The frame under them
# has no stars (cardframe-f0, -s0, -g0); the row is Atlas Academy's CharaGraphOption rarity{★}_{n} (n: 0 as summoned,
# 1 grailed, 2 at Lv 100, 3 at Lv 120; a ★0's start at 1), the emblem class{1 bronze, 2 silver, 3 gold}_{class id} in the
# frame's metal. When Atlas can't be reached, the frame with its stars drawn in and the old badge come back.
import sys, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));localStorage.setItem('spirit-origin-list:v1:statsync','1');localStorage.setItem('spirit-origin-list:v1:cardframe',JSON.stringify({mine:true,pc:true}))"
KEY = "spirit-origin-list:v1"
ART = "https://static.atlasacademy.io/NA/CharaGraph/1/1a.png"
AA = "https://static.atlasacademy.io/JP/CharaGraphOption/"
CLS_ID = {"Saber": 1, "Archer": 2, "Lancer": 3, "Rider": 4, "Caster": 5, "Assassin": 6, "Berserker": 7, "Shielder": 8, "Ruler": 9,
          "Alter Ego": 10, "Avenger": 11, "Moon Cancer": 23, "Foreigner": 25, "Pretender": 28, "Beast": 33}
asked = []
def page(ctx, offline=False):
    pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    def aa(r):
        u = r.request.url
        if "CharaGraphOption" in u:
            asked.append(u)
            return r.abort() if offline else r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png")
        r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in u else 'ph_face.png'}", content_type="image/png")
    pg.route("https://static.atlasacademy.io/**", aa)
    return pg
def card(pg, box="#dossier .art-frame"):
    return pg.evaluate("""(sel) => { const b = document.querySelector(sel); if (!b) return null;
      const f = b.querySelector(':scope > .cf-img'), s = b.querySelector(':scope > .cf-st'), c = b.querySelector(':scope > .cf-cls'), i = c && c.querySelector('img');
      const rb = c && c.querySelector('.cf-cls-rb');
      return {cls: Array.from(b.classList).filter((x) => x.startsWith('cf')).sort(), src: f && f.getAttribute('src'), fb: f && f.dataset.fb || null,
        st: s ? s.getAttribute('src') : null, w: s ? Array.from(s.classList).filter((x) => /^cf-st-/.test(x)) : [], loaded: s ? s.complete && s.naturalWidth > 0 : null,
        emb: i ? i.getAttribute('src') : null, aa: !!(c && c.classList.contains('aa')), embFb: i && i.dataset.fb || null,
        filter: i ? getComputedStyle(i).filter : null, mask: rb ? rb.style.getPropertyValue('--cf-m') : null,
        top: s ? Math.round((s.getBoundingClientRect().top - b.getBoundingClientRect().top) / b.getBoundingClientRect().width * 512) : null}; }""", box)
def set_sv(pg, sid, r, lv, cls=None):
    pg.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')), s = d.servants.find((x) => x.id === '{sid}'); s.rarity = {r}; s.level = {lv};
      {f"s.cls = {json.dumps(cls)};" if cls else ""} localStorage.setItem('{KEY}', JSON.stringify(d)); }}""")
    pg.reload(); pg.wait_for_timeout(1300); pg.click(f'#list [data-id="{sid}"]'); pg.wait_for_timeout(700)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = page(ctx)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    sid, cls = pg.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')), s = d.servants.find((x) => !x.wish && x.rarity === 5);
      s.art = {{"1": "{ART}"}}; s.artStage = "1"; localStorage.setItem('{KEY}', JSON.stringify(d)); return [s.id, s.cls]; }}""")
    set_sv(pg, sid, 5, 90)
    cid = CLS_ID[cls]
    c = card(pg)
    check(f"a ★5 at its cap: the frame without stars, the frame with them kept to fall back on ({c['cls']})", c["cls"] == ["cf", "cf-f", "cf-gold"] and c["src"] and c["fb"] and c["src"] != c["fb"])
    check(f"the game's star row on top: rarity5_0, placed for a 200 × 60 row ({c['st']}, {c['w']})", c["st"] == AA + "rarity5_0.png" and c["w"] == ["cf-st-a"] and c["loaded"])
    # 0.60.1: 6 px above the frame's top, so its stars (from the sprite's 9th row) start just inside the card
    check(f"the row sits over the frame's top, its stars inside the card ({c['top']} px of 512)", c["top"] is not None and -7 <= c["top"] <= -5)
    check(f"the game's emblem for {cls} in gold, with the badge kept to fall back on ({c['emb']})", c["emb"] == f"{AA}class3_{cid}.png" and c["aa"] and c["embFb"] and c["embFb"].startswith("data:image/"))
    check(f"no recolouring filter on the game's emblem ({c['filter']})", c["filter"] in (None, "none"))
    # n: 0 as summoned, 1 grailed (past the rarity's cap), 2 at Lv 100, 3 at Lv 120; ★0 counts from 1; metal follows grails
    for r, lv, want, w, metal in ((5, 92, "rarity5_1", "b", "gold"), (5, 100, "rarity5_2", "b", "gold"), (5, 120, "rarity5_3", "c", "gold"),
                                  (4, 80, "rarity4_0", "a", "gold"), (4, 81, "rarity4_1", "b", "gold"),
                                  (3, 70, "rarity3_0", "a", "silver"), (3, 75, "rarity3_1", "b", "silver"),
                                  (2, 65, "rarity2_0", "a", "bronze"), (1, 80, "rarity1_1", "b", "gold"), (1, 100, "rarity1_2", "b", "gold"),
                                  (0, 65, "rarity0_1", "b", "bronze"), (0, 70, "rarity0_2", "b", "bronze"), (0, 100, "rarity0_3", "b", "bronze"), (0, 120, "rarity0_4", "c", "bronze")):
        set_sv(pg, sid, r, lv)
        c = card(pg); m = {"bronze": 1, "silver": 2, "gold": 3}[metal]
        check(f"★{r} at Lv {lv}: {want} ({w}), the {metal} emblem ({(c['st'] or '').split('/')[-1]}, {c['w']}, {(c['emb'] or '')[-16:]})",
              c["st"] == f"{AA}{want}.png" and c["w"] == [f"cf-st-{w}"] and f"cf-{metal}" in c["cls"] and c["emb"] == f"{AA}class{m}_{cid}.png")
    c = card(pg)
    check(f"at Lv 120 the emblem's rainbow is cut to the game's emblem ({c['mask']})", c["mask"] == f"url('{AA}class1_{cid}.png')")
    check(f"a ★0's crest hangs from the frame's top edge ({c['top']} px)", c["top"] == 0 and pg.locator("#dossier .art-frame > .cf-st.cf-st0").count() == 1)
    # (0.60.1) the 52-tall rows hang 1 px over the top, with their stars level with the plain row's
    set_sv(pg, sid, 5, 92)
    c = card(pg)
    check(f"a grailed row sits 1 px over the top ({c['top']} px)", c["top"] == -1)
    for k, n in (("Shielder", 8), ("Moon Cancer", 23), ("Beast", 33)):
        set_sv(pg, sid, 4, 80, k)
        c = card(pg)
        check(f"{k}: the game's class {n} ({(c['emb'] or '')[-14:]})", c["emb"] == f"{AA}class3_{n}.png")
    set_sv(pg, sid, 5, 90, cls)
    pg.locator("#dossier .art-frame").scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    pg.locator("#dossier .art-frame").screenshot(path=f"{sp}/out/cf58-card.png")
    # the switch's little picture is the frame with its stars drawn in (one image, no request)
    check("the Card frame switch's picture is the frame with its stars drawn in", pg.evaluate("document.querySelector('#dossier .cf-pick .cf-opt[data-v=\"1\"] img').getAttribute('src')") == card(pg)["fb"])

    # ---------- Past Chaldea: NA's numbers at the max level, so the plain row ----------
    pg.evaluate("location.hash = '#past'"); pg.wait_for_timeout(1200)
    pg.locator('#view-past [data-action="pc-open"]').first.click(); pg.wait_for_timeout(800)
    c = card(pg, "#pc-dlg .pcd-frame")
    check(f"Past Chaldea: the plain row and the emblem there too ({(c['st'] or '').split('/')[-1]}, {(c['emb'] or '')[-14:]})", c and c["st"] and c["st"].startswith(AA + "rarity") and c["st"].endswith("_0.png") and c["emb"] and c["emb"].startswith(AA + "class"))
    pg.click('#pc-dlg [data-action="pc-close"]'); pg.wait_for_timeout(300)
    # Craft Essences keep their own frame: no row, no emblem
    pg.click('#view-past [data-action="pc-view"][data-v="ces"], #view-past [data-action="pc-view"]:not([data-v="servants"])'); pg.wait_for_timeout(800)
    pg.locator('#view-past [data-action="ce-open"]').first.click(); pg.wait_for_timeout(700)
    c = card(pg, "#pc-dlg .pcd-art.is-ce .pcd-frame")
    check(f"a Craft Essence keeps its open frame, without the game's row ({c and c['cls']})", bool(c) and "cf-o" in c["cls"] and c["st"] is None and c["fb"] is None)
    pg.close()

    # ---------- Atlas can't be reached: the frame with its stars, and the badge ----------
    n0 = len(asked)
    off = page(ctx, offline=True)
    off.goto(SEEDED + "#servants"); off.wait_for_timeout(1500)
    off.click(f'#list [data-id="{sid}"]'); off.wait_for_timeout(1500)
    c = card(off)
    check(f"it asked for the row and the emblem ({len(asked) - n0} requests)", len(asked) > n0)
    check(f"offline: no row left on the card, the frame with its stars drawn in instead ({c['st']}, {c['src'][:30] if c['src'] else None})", c["st"] is None and c["src"] and c["src"].startswith("data:image/") and c["fb"] is None)
    check(f"and the old gold badge in the diamond ({(c['emb'] or '')[:22]}, aa: {c['aa']})", c["emb"] and c["emb"].startswith("data:image/") and not c["aa"])
    set_sv(off, sid, 3, 70)
    c = card(off)
    check(f"a silver one offline: the badge gets its silver filter back ({c['filter']})", c["st"] is None and not c["aa"] and "grayscale" in (c["filter"] or ""))
    set_sv(off, sid, 5, 120)
    off.wait_for_timeout(800)
    c = card(off)
    check(f"at Lv 120 offline: the emblem's rainbow is cut to the badge ({(c['mask'] or '')[:22]})", c["mask"] and c["mask"].startswith("url('data:image/"))
    off.locator("#dossier .art-frame").scroll_into_view_if_needed(); off.wait_for_timeout(300)
    off.locator("#dossier .art-frame").screenshot(path=f"{sp}/out/cf58-offline.png")
    check(f"no script errors ({errs[:3]})", not errs)
    b.close()
print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
