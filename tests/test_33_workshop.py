import os
# 0.27.0: growth curves (every curve at every rarity, NA's numbers kept), HP and ATK following the level for a servant
# typed in by hand (Edit details → Growth), and the Servant Workshop: starting points (scratch, an NA servant, Surprise
# me, a share code), parts that follow the class until changed, effects and their text, the NP, the draft, summoning
# with Undo, the custom servant on its page, in the damage calculator, in the Workshop again, and Versus with any NA
# servant. Phone layout at the end.
import sys, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));localStorage.setItem('spirit-origin-list:v1:statsync','1')"
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
WSK = "JSON.parse(localStorage.getItem('spirit-origin-list:v1:workshop') || 'null')"
def page(b, w=1440, h=900, dark=False):
    ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme="dark" if dark else "light")
    try: ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=URL if URL.startswith("http") else None)
    except Exception: pass
    pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    return ctx, pg
def sv(pg, pred):
    return next((x for x in pg.evaluate(LS)["servants"] if pred(x)), None)
def typ(pg, sel, v):
    pg.evaluate("([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); }", [sel, v])
def K(pg):
    # the draft is saved a moment after each change
    pg.wait_for_timeout(450); return pg.evaluate(WSK)["k"]
def quiet(pg): pg.evaluate("document.getElementById('toast').classList.remove('show', 'has-btn')")
def go(pg, i): pg.click(f".ws-rail [data-i='{i}']"); pg.wait_for_timeout(250)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, pg = page(b)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)

    # ---------- the curves ----------
    # NA's own curves give NA's numbers, and the made-up ones climb from 0 to 1000 at the max level, then the grails
    # (the curve maths is checked through what Edit details and the Workshop show, and in tests/test_33's curve check below)

    # ---------- Edit details: growth for a servant NA doesn't have ----------
    pg.click('#view-servants .toolbar [data-action="add-servant"]'); pg.wait_for_timeout(400)
    check("Add servant has a Growth box", pg.locator("#fs-growth").count() == 1)
    typ(pg, "#sv-name", "Hilda of Nowhere"); typ(pg, "#sv-cls", "Saber"); typ(pg, "#sv-rarity", "4"); typ(pg, "#sv-level", "80")
    st = pg.locator("#gr-status").inner_text()
    check(f"a name NA doesn't know asks how they grow ({st[:70]})", "isn't in NA's data" in st and pg.locator("#gr-grid").is_visible())
    typ(pg, "#gr-type", "s"); typ(pg, "#gr-hp1", "1800"); typ(pg, "#gr-hpm", "11000"); typ(pg, "#gr-atk1", "1500"); typ(pg, "#gr-atkm", "9000")
    hp, atk = pg.input_value("#sv-hp"), pg.input_value("#sv-atk")
    check(f"at the max level (80 for ★4) HP and ATK are the max numbers ({hp}, {atk})", hp == "11000" and atk == "9000")
    check("and the stats above follow the growth (read-only while they do)", pg.evaluate("document.getElementById('sv-hp').readOnly") is True)
    check("a small chart of the curve is drawn", pg.locator("#gr-viz svg .gv-l.hp").count() == 1)
    typ(pg, "#sv-level", "20")
    hp20 = int(pg.input_value("#sv-hp"))
    # an S curve starts slow: at Lv 20 of 80 it's well under a straight line
    check(f"Lv 20 on an S curve sits below a straight line ({hp20} < {1800 + (11000 - 1800) * 19 // 79})", 1800 < hp20 < 1800 + (11000 - 1800) * 19 // 79 - 300)
    typ(pg, "#sv-level", "100")
    hp100 = int(pg.input_value("#sv-hp"))
    check(f"grails past Lv 80 keep climbing ({hp100})", hp100 > 11000 and "grailed past Lv 80" in pg.locator("#gr-status").inner_text())
    typ(pg, "#sv-name", "Altria Pendragon")
    st = pg.locator("#gr-status").inner_text()
    check(f"an NA name says it follows NA instead ({st[:60]})", "Follows NA" in st and not pg.locator("#gr-grid").is_visible())
    typ(pg, "#sv-name", "Hilda of Nowhere"); typ(pg, "#sv-level", "60")
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(700)
    h = sv(pg, lambda x: x["name"] == "Hilda of Nowhere")
    check(f"saved with its growth and the HP for Lv 60 ({h and h.get('growth')}, {h and h.get('hp')})", h and h.get("growth", {}).get("type") == "s" and h["growth"]["hp"] == [1800, 11000] and 1800 < h["hp"] < 11000)
    hp60 = h["hp"]
    quiet(pg)
    pg.click('#dossier [data-action="bump"][data-f="level"][data-d="1"]'); pg.wait_for_timeout(900)
    h2 = sv(pg, lambda x: x["name"] == "Hilda of Nowhere")
    check(f"+ on the level moves HP along the curve ({hp60} → {h2['hp']} at Lv {h2['level']})", h2["level"] == 61 and h2["hp"] > hp60)

    # ---------- the Workshop: from scratch ----------
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(400)
    check("Create opens the Servant Workshop", pg.locator("#ws:not([hidden]) .ws-tiles .ws-tile").count() == 4)
    check("the page behind it is out of reach while it's open", pg.evaluate("document.querySelector('.shell').inert") is True)
    pg.click('[data-ws="blank"]'); pg.wait_for_timeout(200)
    pg.click('[data-ws="blank-cls"][data-v="Caster"]'); pg.click('[data-ws="blank-go"][data-r="4"]'); pg.wait_for_timeout(400)
    k = K(pg)
    check(f"a ★4 Caster starts with NA's usual deck, NP card and passives ({k['deck']}, {k['np']['card']}, {[x['name'] for x in k['ps']]})",
          k["deck"] == "QAAAB" and k["np"]["card"] == "Arts" and "Territory Creation" in [x["name"] for x in k["ps"]])
    check("the card shows them", pg.locator("#ws-pv .ws-card").count() == 1 and "Caster" in pg.locator("#ws-pv .ws-cmeta").inner_text())
    pg.click('[data-ws="cls"][data-v="Berserker"]'); pg.wait_for_timeout(300)
    k = K(pg)
    check(f"switching to Berserker brings the usual Berserker parts ({k['deck']}, {[x['name'] for x in k['ps']]})", k["deck"] == "QABBB" and "Madness Enhancement" in [x["name"] for x in k["ps"]])
    typ(pg, "#ws-name", "Ysolde the Unbroken"); pg.wait_for_timeout(450)
    check("the name shows on the card and as the title", pg.locator("#ws-pv .ws-cname").inner_text() == "Ysolde the Unbroken" and pg.locator("#ws-title").inner_text() == "Ysolde the Unbroken")
    go(pg, 2)
    check("Stats shows the usual numbers, the six curves and the chart", pg.locator(".ws-curve").count() == 6 and pg.locator(".ws-chart svg .ln.hp").count() == 1)
    check("and how they measure up against NA (ATK, HP, NP damage)", pg.locator(".ws-step .ws-meter").count() == 3 and "Berserker" in pg.locator(".ws-step .ws-mp").first.inner_text())
    atk0 = K(pg)["atk"][1]
    pg.evaluate("() => { const r = document.querySelector('[data-ws-feel=\"pow\"]'); r.value = '1'; r.dispatchEvent(new Event('input', {bubbles: true})); }"); pg.wait_for_timeout(450)
    atk1 = K(pg)["atk"][1]
    check(f"Stronger raises the numbers ({atk0} → {atk1})", atk1 > atk0)
    typ(pg, '[data-wk="atk.1"]', "12345"); pg.wait_for_timeout(450)
    check("typing a number keeps it (and the card follows)", K(pg)["atk"][1] == 12345)
    pg.click('[data-ws="set"][data-p="growth"][data-v="rs"]'); pg.wait_for_timeout(300)
    check("a curve can be picked", K(pg)["growth"] == "rs" and pg.locator('[data-p="growth"][data-v="rs"][aria-pressed="true"]').count() == 1)
    # look at Lv 100 on the chart by dragging
    pg.evaluate("document.querySelector('.ws-chart').scrollIntoView({block: 'center'})"); pg.wait_for_timeout(100)
    box = pg.locator(".ws-chart svg").bounding_box()
    pg.mouse.click(box["x"] + box["width"] * (46 + (100 - 1) / 119 * 582) / 640, box["y"] + box["height"] / 2); pg.wait_for_timeout(300)
    lvt = pg.locator("#ws-pv .ws-lvtag").inner_text()
    check(f"clicking the chart puts the card at that level ({lvt})", re.search(r"Lv 1(?:00|01|99)", lvt) is not None or "Lv 100" in lvt)
    go(pg, 3)
    pg.click('[data-ws="set"][data-p="np.card"][data-v="Buster"]'); pg.click('[data-ws="set"][data-p="np.tg"][data-v="Single Target"]'); pg.wait_for_timeout(300)
    np_ = K(pg)["np"]
    check(f"a single-target Buster NP starts at 600% … 1000% ({np_['dmg']})", np_["dmg"] == [600, 800, 900, 950, 1000])
    go(pg, 4)
    pg.click('[data-ws="set"][data-p="np.mode"][data-v="up"]'); pg.wait_for_timeout(250)
    check("Upgraded is the stronger table", K(pg)["np"]["dmg"] == [800, 1000, 1100, 1150, 1200])
    typ(pg, '[data-wk="np.name"]', "Lament of Iron Snow")
    pg.check("[data-ws-se]"); pg.wait_for_timeout(250); typ(pg, '[data-wk="np.se.vs"]', "Dragon")
    pg.click('[data-ws="fx-add"][data-w="np"]'); pg.wait_for_timeout(250)
    check("Add an effect opens the list of effects", pg.locator(".ws-pal [data-ws='fx-pick']").count() > 25)
    typ(pg, "[data-ws-palq]", "def down"); pg.wait_for_timeout(150)
    check("and it can be searched", pg.locator(".ws-pal [data-ws='fx-pick'][data-e='defdown']").count() == 1 and pg.locator(".ws-pal [data-ws='fx-pick'][data-e='heal']").count() == 0)
    pg.click(".ws-pal [data-ws='fx-pick'][data-e='defdown']"); pg.wait_for_timeout(300)
    pv = pg.locator(".ws-nppv").inner_text()
    check(f"the NP reads like NA's text ({pv[:120]!r})", "Deal severe damage to one enemy, with extra damage against [Dragon]" in pv and "Decrease one enemy's DEF (3 turns)" in pv)
    check("with its damage and special damage tables", "800%" in pv and "Special damage" in pv and "150%" in pv)
    go(pg, 5)
    pg.click('[data-ws="sk-preset"][data-i="0"][data-j="0"]'); pg.wait_for_timeout(250)
    pg.click('[data-ws="fx-add"][data-w="sk"]'); pg.wait_for_timeout(200); pg.click(".ws-pal [data-ws='fx-pick'][data-e='card']"); pg.wait_for_timeout(250)
    sk = K(pg)["sk"][0]
    check(f"a classic skill and an added effect ({sk['name']} {sk['rank']}: {[f['e'] for f in sk['fx']]})", sk["name"] == "Charisma" and [f["e"] for f in sk["fx"]] == ["atk", "card"])
    card_fx = sk["fx"][1]
    check(f"Card up for yourself starts at 30% → 50% for 1 turn on the NP's card ({card_fx})", card_fx["tg"] == "s" and card_fx["v"] == [30, 50] and card_fx["d"] == 1 and card_fx["card"] == "Buster")
    pg.locator('.ws-fx').nth(1).locator('[data-ws="set"][data-v="a"]').click(); pg.wait_for_timeout(250)
    card_fx = K(pg)["sk"][0]["fx"][1]
    check(f"for all allies it moves to the party numbers ({card_fx['v']}, {card_fx['d']} turns)", card_fx["v"] == [10, 20] and card_fx["d"] == 3)
    skpv = pg.locator(".ws-skpv").inner_text()
    check(f"the skill shows as it will on their page ({skpv[:90]!r})", "Charisma" in skpv and "Increase all allies' ATK (3 turns)" in skpv and "Increase all allies' Buster Card effectiveness (3 turns)" in skpv)
    pg.click('[data-ws="sk-tab"][data-i="1"]'); pg.wait_for_timeout(200); pg.click('[data-ws="sk-preset"][data-i="1"][data-j="6"]')
    pg.click('[data-ws="sk-tab"][data-i="2"]'); pg.wait_for_timeout(200); pg.click('[data-ws="sk-preset"][data-i="2"][data-j="3"]'); pg.wait_for_timeout(300)
    go(pg, 6)
    pg.fill("#ws-psq", "Divinity"); pg.wait_for_timeout(250)
    pg.locator('[data-ws="ps-add"][data-v="Divinity"]').first.click(); pg.wait_for_timeout(250)
    ps = K(pg)["ps"]
    check(f"an NA passive can be added by name ({[x['name'] + ' ' + x['rank'] for x in ps]})", any(x["name"] == "Divinity" for x in ps))
    check("passives that change NP damage say so", pg.locator(".ws-psv").count() >= 1)
    go(pg, 7)
    check("Summon lists what's done", pg.locator(".ws-checks li.ok").count() == 5)
    # the draft survives a reload, and the Workshop offers to go on with it
    pg.reload(); pg.wait_for_timeout(1300)
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(300)
    check("after a reload the draft is offered", "Ysolde the Unbroken" in pg.locator(".ws-draft").inner_text())
    pg.click('[data-ws="draft-go"]'); pg.wait_for_timeout(300)
    check("and Continue brings it back", pg.locator("#ws-title").inner_text() == "Ysolde the Unbroken")
    go(pg, 7)
    pg.locator('[data-wc="level"]').evaluate("(e) => { e.value = '70'; e.dispatchEvent(new Event('input', {bubbles: true})); }")
    pg.click('[data-ws="copy"][data-p="np"][data-v="2"]'); pg.wait_for_timeout(200)
    n0 = len(pg.evaluate(LS)["servants"])
    pg.click('[data-ws="save"]'); pg.wait_for_timeout(900)
    y = sv(pg, lambda x: x["name"] == "Ysolde the Unbroken")
    check("Summon saves one servant", y is not None and len(pg.evaluate(LS)["servants"]) == n0 + 1)
    check(f"made in the Workshop, with what it was made from ({y and sorted(y.keys())[:6]})", y and y.get("custom") is True and y.get("kit", {}).get("cls") == "Berserker")
    check(f"at the level and NP level asked for ({y['level']}, NP{y['npLevel']})", y["level"] == 70 and y["npLevel"] == 2 and not y.get("wish"))
    check(f"with the usual fields filled in from the kit (deck {y['deck']}, {y['npName']}, {y['npCard']} {y['npTarget']})", y["deck"] == ["Quick", "Arts", "Buster", "Buster", "Buster"] and y["npName"] == "Lament of Iron Snow" and y["npCard"] == "Buster" and y["npTarget"] == "Single Target")
    check(f"skills with names, lines and Lv 1 → 10 values ({y['skillInfo'][0]['name']}, {y['skillInfo'][0]['scales'][:1]})", y["skillInfo"][0]["name"] == "Charisma" and y["skillInfo"][0]["scales"][0]["v1"] == 9 and y["skillInfo"][0]["scales"][0]["v10"] == 18)
    check("and HP and ATK for Lv 70 from its growth", y["growth"]["type"] == "rs" and y["atk"] < 12345 and y["growth"]["atk"][1] == 12345)
    check("the Workshop closes and their page opens", pg.locator("#ws").is_hidden() and pg.locator("#dossier .d-head h2").inner_text() == "Ysolde the Unbroken")
    check("the draft is gone once they're summoned", pg.evaluate(WSK) is None)
    head = pg.locator("#dossier .d-head").inner_text()
    check(f"their page says Custom and has a Workshop button ({head!r})", "Custom" in head and pg.locator('#dossier .d-head [data-action="ws-open"]').count() == 1)
    pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(700)
    check("Undo takes them away again", sv(pg, lambda x: x["name"] == "Ysolde the Unbroken") is None)
    # once more, for keeps (a new draft from Surprise me, then a name of our own)
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(300)
    pg.click('[data-ws="dice"]'); pg.wait_for_timeout(400)
    rk = K(pg)
    check(f"Surprise me makes a whole servant ({rk['name']}, {rk['cls']} ★{rk['r']}, {rk['np']['name']})", rk["name"] and rk["np"]["name"] and all(len(s["fx"]) for s in rk["sk"]) and pg.locator(".ws-checks li.ok").count() >= 4)
    go(pg, 1); typ(pg, "#ws-name", "Wren of Glass"); pg.click('[data-ws="cls"][data-v="Rider"]'); pg.click('[data-ws="set"][data-p="r"][data-v="5"]'); pg.wait_for_timeout(200)
    go(pg, 5); pg.evaluate("document.querySelectorAll('.ws-presets').forEach((d) => { d.open = true; })"); pg.click('[data-ws="sk-preset"][data-i="0"][data-j="1"]'); pg.wait_for_timeout(200)
    go(pg, 3); pg.click('[data-ws="set"][data-p="np.card"][data-v="Buster"]'); pg.click('[data-ws="set"][data-p="np.tg"][data-v="AoE"]'); pg.wait_for_timeout(200)
    go(pg, 6)
    if not any(x["name"] == "Riding Skill" for x in K(pg)["ps"]): pg.locator('[data-ws="ps-add"][data-v="Riding Skill"]').first.click(); pg.wait_for_timeout(200)
    go(pg, 7); quiet(pg)
    pg.click('[data-ws="save"]'); pg.wait_for_timeout(900); quiet(pg)
    wren = sv(pg, lambda x: x["name"] == "Wren of Glass")
    check("a servant from Surprise me can be renamed and summoned", wren is not None and wren["cls"] == "Rider" and wren["rarity"] == 5)

    # ---------- the custom servant on its page ----------
    check("NA's Fill in doesn't offer to change a custom servant", pg.locator("#dossier .fill-one").count() == 0)
    pg.evaluate("() => { const d = document.querySelector('#dossier [data-npc-for]'); d.open = true; d.dispatchEvent(new Event('toggle')); }"); pg.wait_for_timeout(500)
    npc = pg.locator("#dossier .npc").inner_text()
    check(f"the damage calculator uses their own skills ({re.search(r'own skills[\\s\\S]{0,80}', npc).group(0)!r})" if "own skills" in npc else "the damage calculator uses their own skills", "Mana Burst A" in npc and "Buster +50%" in npc)
    check("and passives that add to NP damage", "(passives)" in npc)
    lv0, atk0 = wren["level"], wren["atk"]
    pg.click('#dossier [data-action="bump"][data-f="level"][data-d="-1"]'); pg.wait_for_timeout(900)
    w2 = sv(pg, lambda x: x["name"] == "Wren of Glass")
    check(f"− on the level brings ATK down along their curve ({atk0} → {w2['atk']})", w2["level"] < lv0 and w2["atk"] < atk0)
    # back into the Workshop
    pg.click('#dossier .d-head [data-action="ws-open"]'); pg.wait_for_timeout(400)
    check("Workshop opens them as they are", pg.locator("#ws-title").inner_text() == "Wren of Glass" and pg.locator('.ws-rail [aria-current="step"]').inner_text().strip().endswith("Who they are"))
    go(pg, 5); typ(pg, '[data-wk="sk.0.name"]', "Mana Overflow"); pg.wait_for_timeout(200)
    go(pg, 7)
    check("editing has no 'your copy' part (their levels stay)", pg.locator(".ws-copy").count() == 0 and "Save changes" in pg.locator('[data-ws="save"]').inner_text())
    pg.click('[data-ws="save"]'); pg.wait_for_timeout(800)
    w3 = sv(pg, lambda x: x["id"] == wren["id"])
    check(f"Save changes keeps the same servant and level ({w3['skillInfo'][0]['name']}, Lv {w3['level']})", w3["skillInfo"][0]["name"] == "Mana Overflow" and w3["level"] == w2["level"])
    pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(700)
    check("and Undo puts the old skill name back", sv(pg, lambda x: x["id"] == wren["id"])["skillInfo"][0]["name"] == "Mana Burst")
    quiet(pg)
    # the form for a custom servant points to the Workshop
    pg.click('#dossier [data-action="edit"]'); pg.wait_for_timeout(400)
    check("Edit details says to use the Workshop for skills, NP and growth", pg.locator("#servant-form .ws-formnote [data-action='ws-open']").count() == 1)
    pg.click('#servant-form [data-action="cancel-edit"]'); pg.wait_for_timeout(300)

    # ---------- share codes ----------
    pg.click('#dossier .d-head [data-action="ws-open"]'); pg.wait_for_timeout(300); go(pg, 7)
    pg.click('[data-ws="share"]'); pg.wait_for_timeout(500)
    code = pg.evaluate("navigator.clipboard.readText().catch(() => '')") or (pg.locator(".ws-codeout").input_value() if pg.locator(".ws-codeout").count() else "")
    check(f"Copy a share code gives a short code ({code[:12]}…, {len(code)} characters)", code.startswith("FGI") and len(code) < 2400)
    pg.click('[data-ws="close"]'); pg.wait_for_timeout(200)
    pg.evaluate("localStorage.removeItem('spirit-origin-list:v1:workshop')")
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(300)
    pg.click('[data-ws="code"]'); pg.wait_for_timeout(200)
    pg.fill("#ws-code", "nonsense"); pg.click('[data-ws="code-go"]'); pg.wait_for_timeout(300)
    check("a code that isn't one says so", "doesn't look like a Workshop share code" in pg.locator(".ws-pane").inner_text())
    pg.fill("#ws-code", "Here you go: " + code + " !"); pg.click('[data-ws="code-go"]'); pg.wait_for_timeout(500)
    k = K(pg)
    check(f"a pasted code opens the same servant ({k['name']}, {k['sk'][0]['name']})", k["name"] == "Wren of Glass" and k["sk"][0]["name"] == "Mana Burst" and k["cls"] == "Rider")
    pg.click('[data-ws="close"]'); pg.wait_for_timeout(200)
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(200)
    pg.click('[data-ws="draft-drop"]'); pg.wait_for_timeout(300)
    check("Throw it away clears the draft", pg.evaluate(WSK) is None and pg.locator(".ws-draft").count() == 0)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("Escape closes the Workshop", pg.locator("#ws").is_hidden() and pg.evaluate("document.querySelector('.shell').inert") is False)

    # ---------- from an NA servant: Past Chaldea's Remix ----------
    pg.click("#tab-past"); pg.wait_for_timeout(600)
    pg.fill('[data-pc-q="q"]', "Morgan"); pg.wait_for_timeout(400)
    pg.locator('.pc-card[aria-label^="Morgan,"]').first.click(); pg.wait_for_timeout(600)
    check("Past Chaldea's servant window has Remix in the Workshop", pg.locator('#pc-dlg [data-action="ws-remix"]').count() == 1)
    pg.click('#pc-dlg [data-action="ws-remix"]'); pg.wait_for_timeout(500)
    check("Remix opens the Workshop with that servant", pg.locator("#pc-dlg").is_hidden() and pg.locator("#ws-title").inner_text() == "Morgan (Custom)")
    # the Workshop's own search finds every NA servant, yours too
    go(pg, 0); pg.click('[data-ws="na"]'); pg.wait_for_timeout(200)
    pg.fill("#ws-naq", "altria pendragon saber"); pg.wait_for_timeout(300)
    pg.locator('[data-ws="from-na"][title="Altria Pendragon"]').first.click(); pg.wait_for_timeout(300)
    k = K(pg)
    check(f"Remix starts from NA's kit ({k['name']}, {k['np']['name']} {k['np']['dmg']})", k["name"] == "Altria Pendragon (Custom)" and k["np"]["name"] == "Excalibur" and k["np"]["dmg"][0] == 400)
    fx0 = k["sk"][0]["fx"][0]
    check(f"NA's skill text is read into effects (Charisma B: {fx0})", k["sk"][0]["name"] == "Charisma" and fx0["e"] == "atk" and fx0["tg"] == "a" and fx0["v"] == [9, 18] and fx0["d"] == 3)
    dc = k["sk"][1]
    check(f"two effects on one line become two ({[f['e'] for f in dc['fx']][:3]})", [f["e"] for f in dc["fx"]][:2] == ["card", "np"] and dc["fx"][0]["card"] == "Buster")
    check("its stats and curve are NA's", k["atk"] == [1734, 11221] and k["growth"] == "linear")
    pg.click('[data-ws="close"]'); pg.wait_for_timeout(200)

    # ---------- Versus with any NA servant ----------
    pg.click("#tab-versus"); pg.wait_for_timeout(500)
    check("Versus has Compare with an NA servant", pg.locator('#versus [data-action="vs-na"]').count() == 1)
    pg.click('#versus [data-action="vs-na"]'); pg.wait_for_timeout(400)
    pg.fill(".spk [data-spk-q]", "Morgan"); pg.wait_for_timeout(300)
    pg.locator('.spk [data-spk^="na:"]').first.click(); pg.wait_for_timeout(600)
    heroes = pg.locator("#versus .vs-hero h3").all_inner_texts()
    check(f"the NA servant stands next to yours ({heroes})", len(heroes) == 2 and heroes[1].startswith("Morgan"))
    check("marked NA", pg.locator("#versus .vs-hero.k2 .na-tag").count() == 1)
    pg.reload(); pg.wait_for_timeout(1400)
    heroes = pg.locator("#versus .vs-hero h3").all_inner_texts()
    check(f"and still there after a reload ({heroes})", any(h.startswith("Morgan") for h in heroes))
    check("no NA servant was added to the roster", sv(pg, lambda x: str(x.get("id", "")).startswith("na:")) is None and sv(pg, lambda x: x["name"] == "Morgan" and not x.get("wish")) is None)

    # ---------- phone ----------
    ctx3, ph = page(b, 390, 844)
    ph.goto(SEEDED + "#servants"); ph.wait_for_timeout(1300)
    ph.click('#view-servants .toolbar [data-action="ws-new"]'); ph.wait_for_timeout(300)
    ph.click('[data-ws="dice"]'); ph.wait_for_timeout(500)
    for i in range(1, 8):
        ph.click(f".ws-rail [data-i='{i}']"); ph.wait_for_timeout(250)
        over = ph.evaluate("(() => { const m = document.querySelector('.ws-main'); return [m.scrollWidth - m.clientWidth, document.documentElement.scrollWidth - innerWidth]; })()")
        if over[0] > 1 or over[1] > 1: check(f"phone: step {i} fits the width ({over})", False); break
    else: check("phone: every step fits the width", True)
    ph.click('[data-ws="pv"]'); ph.wait_for_timeout(450)
    check("phone: Card shows the card as a sheet", ph.locator("#ws-pv.open .ws-card").is_visible())
    ph.screenshot(path=f"{sp}/out/ws-phone.png")
    ctx3.close()

    pg.screenshot(path=f"{sp}/out/ws-versus.png")
    check(f"no script errors ({errs[:3]})", not errs)
    b.close()
print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
