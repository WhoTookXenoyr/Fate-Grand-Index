import os
# 0.27.1: a servant made in the Workshop and then changed in Edit details (or the passive editor on their page) keeps
# those changes: they go into the Workshop's copy (s.kit) on every save, so the Workshop opens what their page shows and
# a later Workshop save doesn't put the old skills back. A save that changes nothing leaves that copy alone. The form's
# "Open in the Workshop" button brings what's typed along (as an unsaved Workshop draft) instead of dropping it.
import sys, json
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
EFF = ["Increase your own Buster performance for 3 turns.", "Increase your own Quick performance for 3 turns.", "Increase party's NP damage except for yourself for 3 turns.", "Charge your own NP gauge.", "Charge party's NP gauge except for yourself."]
def typ(pg, sel, v):
    pg.evaluate("([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); }", [sel, v])
def quiet(pg): pg.evaluate("document.getElementById('toast').classList.remove('show', 'has-btn')")
def go(pg, i): pg.click(f".ws-rail [data-i='{i}']"); pg.wait_for_timeout(250)
def get(pg, sid): return next(x for x in pg.evaluate(LS)["servants"] if x["id"] == sid)
def same(a, b): return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
def made(pg):
    # a new servant from Surprise me, summoned
    pg.evaluate("localStorage.removeItem('spirit-origin-list:v1:workshop')")
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(400)
    pg.click('[data-ws="dice"]'); pg.wait_for_timeout(500)
    go(pg, 7); pg.click('[data-ws="save"]'); pg.wait_for_timeout(1000); quiet(pg)
    return [x for x in pg.evaluate(LS)["servants"] if x.get("custom")][-1]
def skill1(pg):
    # skill 1 as in Noyr's screenshot: five lines, one value (Buster+ 10 → 20 %)
    typ(pg, "#sv-s1-name", "Havoc of Resonance"); typ(pg, "#sv-s1-rank", "EX"); typ(pg, "#sv-s1-effect", "\n".join(EFF)); typ(pg, "#sv-s1-cd", "10")
    rows = pg.locator("#sv-s1-rows .sc-row").count()
    for k in range(rows - 1, 0, -1): pg.locator("#sv-s1-rows .sc-row").nth(k).locator('[data-action="sc-del"]').click()
    r0 = "#sv-s1-rows .sc-row >> nth=0 >> "
    pg.fill(r0 + "[data-sc=label]", "Buster+"); pg.fill(r0 + "[data-sc=v1]", "10"); pg.fill(r0 + "[data-sc=v10]", "20"); pg.fill(r0 + "[data-sc=unit]", "%")
rowsOf = lambda s: [(r["label"], r["v1"], r["v10"], r["unit"]) for r in s.get("scales") or []]
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)

    # ---------- saved in Edit details ----------
    c = made(pg); sid = c["id"]
    pg.click('#dossier [data-action="bump"][data-f="level"][data-d="-1"]'); pg.wait_for_timeout(900)
    check("a level change leaves the Workshop's copy alone", same(get(pg, sid)["kit"], c["kit"]))
    pg.click('#dossier [data-action="edit"]'); pg.wait_for_timeout(500)
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(900); quiet(pg)
    check("Edit details saved with nothing changed leaves it alone too", same(get(pg, sid)["kit"], c["kit"]))
    # one line added to skill 3 keeps its Workshop effects (so they still count in the damage calculator)
    pg.click('#dossier [data-action="edit"]'); pg.wait_for_timeout(500)
    typ(pg, "#sv-s3-effect", pg.input_value("#sv-s3-effect") + "\nGain 5 C. Stars, but only on Tuesdays.")
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(900); quiet(pg)
    old3, new3 = c["kit"]["sk"][2]["fx"], get(pg, sid)["kit"]["sk"][2]["fx"]
    check(f"a line added to a skill keeps its effects ({[f['e'] for f in old3]} → {[f['e'] for f in new3]})", new3[:len(old3)] == old3 and len(new3) == len(old3) + 1 and new3[-1]["e"] == "own" and new3[-1]["txt"] == "Gain 5 C. Stars, but only on Tuesdays.")
    # skill 1 typed in by hand, skill 2 only renamed, a new NP name, a value with a unit the Workshop doesn't list
    pg.click('#dossier [data-action="edit"]'); pg.wait_for_timeout(500)
    skill1(pg)
    pg.click('#sv-s1-rows ~ [data-action="sc-add"]'); r1 = "#sv-s1-rows .sc-row >> nth=1 >> "
    pg.fill(r1 + "[data-sc=label]", "Hits"); pg.fill(r1 + "[data-sc=v1]", "2"); pg.fill(r1 + "[data-sc=v10]", "4"); pg.fill(r1 + "[data-sc=unit]", "hits")
    typ(pg, "#sv-s2-name", "Renamed Skill"); typ(pg, "#sv-npname", "Tide of Embers")
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(900); quiet(pg)
    c2 = get(pg, sid); s1, k1, k2 = c2["skillInfo"][0], c2["kit"]["sk"][0], c2["kit"]["sk"][1]
    check("Edit details keeps what was typed", s1["name"] == "Havoc of Resonance" and s1["effect"].split("\n") == EFF and rowsOf(s1) == [("Buster+", 10, 20, "%"), ("Hits", 2, 4, "hits")])
    check(f"the Workshop's copy has the same skill ({k1['name']} {k1['rank']}, cooldown {k1['cd']})", k1["name"] == "Havoc of Resonance" and k1["rank"] == "EX" and k1["cd"] == 10 and [f.get("txt") for f in k1["fx"] if f.get("txt")] == EFF)
    check("with its values and their units", [(f["l"], f["v1"], f["v10"], f["u"]) for f in k1["fx"] if f.get("l")] == [("Buster+", 10, 20, "%"), ("Hits", 2, 4, "hits")])
    check("a skill only renamed keeps its effects", k2["name"] == "Renamed Skill" and k2["fx"] == c["kit"]["sk"][1]["fx"])
    check("the NP name is in the copy and their NP table", c2["kit"]["np"]["name"] == "Tide of Embers" and c2["npTable"]["v"][0]["name"] == "Tide of Embers")
    # the Workshop opens what the page shows, and its save keeps it
    pg.click('#dossier .d-head [data-action="ws-open"]'); pg.wait_for_timeout(500)
    go(pg, 5)
    check("the Workshop shows the skill typed in Edit details", "Havoc of Resonance EX" in pg.locator('.ws-sktabs [data-i="0"]').inner_text())
    txts = pg.evaluate("Array.from(document.querySelectorAll('[data-wk$=\".txt\"]')).map((e) => e.value)")
    check("its lines as Write your own effects", [t for t in txts if t] == EFF)
    check("and the unit it doesn't list", "hits" in pg.evaluate("Array.from(document.querySelectorAll('select[data-wk$=\".u\"]')).map((e) => e.value)"))
    go(pg, 1); typ(pg, "#ws-name", c["name"] + " II"); pg.wait_for_timeout(300)
    go(pg, 7); pg.click('[data-ws="save"]'); pg.wait_for_timeout(1000); quiet(pg)
    c3 = get(pg, sid); s1 = c3["skillInfo"][0]
    check(f"a Workshop save keeps skill 1 as typed ({s1['name']}, {rowsOf(s1)})", s1["name"] == "Havoc of Resonance" and s1["rank"] == "EX" and s1["effect"].split("\n") == EFF and rowsOf(s1) == [("Buster+", 10, 20, "%"), ("Hits", 2, 4, "hits")])
    check("and skill 2's name, the NP name and the new name", c3["name"] == c["name"] + " II" and c3["skillInfo"][1]["name"] == "Renamed Skill" and c3["npName"] == "Tide of Embers")

    # ---------- the form's "Open in the Workshop" ----------
    c = made(pg); sid = c["id"]
    pg.click('#dossier [data-action="edit"]'); pg.wait_for_timeout(500)
    check("Edit details for a Workshop servant has the Workshop button", pg.locator("#servant-form .ws-formnote [data-action='ws-open']").count() == 1)
    skill1(pg)
    pg.click('#servant-form [data-action="ws-open"]'); pg.wait_for_timeout(600)
    check("it brings what was typed along", "came along" in pg.inner_text("#toast"))
    go(pg, 5)
    check("the Workshop shows skill 1 as typed", "Havoc of Resonance EX" in pg.locator('.ws-sktabs [data-i="0"]').inner_text())
    check("nothing is saved yet", same(get(pg, sid)["kit"], c["kit"]) and get(pg, sid)["skillInfo"][0]["name"] != "Havoc of Resonance")
    pg.wait_for_timeout(700)
    dr = pg.evaluate(WSK)
    check("the Workshop's draft holds it", bool(dr) and dr.get("id") == sid and dr["k"]["sk"][0]["name"] == "Havoc of Resonance")
    # closed without saving, then more typed in the form: the draft and the new typing go together
    pg.click(".ws-x"); pg.wait_for_timeout(400); quiet(pg)
    pg.click('#dossier [data-action="edit"]'); pg.wait_for_timeout(500)
    typ(pg, "#sv-s2-name", "Second Wind")
    pg.click('#servant-form [data-action="ws-open"]'); pg.wait_for_timeout(600)
    check("a draft and what's typed go together", "Picked up your changes here" in pg.inner_text("#toast"))
    go(pg, 5)
    check("skill 1 from the draft, skill 2 from the form", "Havoc of Resonance" in pg.locator('.ws-sktabs [data-i="0"]').inner_text() and "Second Wind" in pg.locator('.ws-sktabs [data-i="1"]').inner_text())
    go(pg, 7); pg.click('[data-ws="save"]'); pg.wait_for_timeout(1000); quiet(pg)
    c6 = get(pg, sid); s1 = c6["skillInfo"][0]
    check(f"Save changes keeps both ({s1['name']} {s1['rank']}, cooldown {s1['cd']}, {rowsOf(s1)})", s1["name"] == "Havoc of Resonance" and s1["rank"] == "EX" and s1["cd"] == 10 and s1["effect"].split("\n") == EFF and rowsOf(s1) == [("Buster+", 10, 20, "%")] and c6["skillInfo"][1]["name"] == "Second Wind")
    check("and the draft is gone", pg.evaluate(WSK) is None)
    # with nothing typed it opens as usual
    pg.click('#dossier [data-action="edit"]'); pg.wait_for_timeout(500)
    pg.click('#servant-form [data-action="ws-open"]'); pg.wait_for_timeout(1200)
    check("with nothing typed it starts no draft", "came along" not in pg.inner_text("#toast") and pg.evaluate(WSK) is None)
    pg.click(".ws-x"); pg.wait_for_timeout(300)

    # ---------- passives changed on their page ----------
    pg.click('#dossier [data-action="ps-add"]'); pg.wait_for_timeout(400)
    n = pg.evaluate("document.querySelectorAll('#dossier .ps-row').length")
    for f, v in (("name", "Riding"), ("rank", "B")):
        pg.evaluate(f"""() => {{ const e = document.querySelector('#dossier [data-ps="{n - 1}:{f}"]'); e.textContent = '{v}'; e.dispatchEvent(new Event('input', {{bubbles: true}})); e.dispatchEvent(new FocusEvent('focusout', {{bubbles: true}})); }}""")
        pg.wait_for_timeout(300)
    if pg.locator('#dossier [data-action="ps-edit"]').count(): pg.click('#dossier [data-action="ps-edit"]'); pg.wait_for_timeout(600)
    check("a passive added on their page is in the Workshop's copy", any(p["name"] == "Riding" and p["rank"] == "B" for p in get(pg, sid)["kit"]["ps"]))

    check(f"no script errors ({errs[:3]})", not errs)
    b.close()
print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
