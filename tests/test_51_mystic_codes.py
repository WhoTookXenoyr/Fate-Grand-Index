import os
# 0.53.0-beta: Mystic Codes. NA's 23, from Atlas Academy's data (checked against it when they were put in); a page that
# lists and sorts them; the equipped one counted in the NP calculator, the Workshop's damage block and the Battle
# simulator, where the Master uses its skills.
import sys, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));"
MCK = "JSON.parse(localStorage.getItem('spirit-origin-list:v1:mc') || '{}')"
def typ(pg, sel, v):
    pg.evaluate("([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); }", [sel, v])
def big(pg): return int(pg.locator("#dossier .npc-big b").inner_text().replace(",", ""))
def table(pg):
    return pg.evaluate("""(() => { const o = {}; document.querySelectorAll('.ws-dmg-t tbody tr').forEach((tr) => { o[tr.dataset.k] = Array.from(tr.querySelectorAll('td')).map((td) => {
      const n = (s) => Number(String(s).replace(/[^0-9]/g, '')); if (td.classList.contains('none')) return null; if (td.classList.contains('same')) return [n(td.textContent), n(td.textContent)];
      return [n(td.querySelector('.was').textContent), n(td.querySelector('b').textContent)]; }); }); return o; })()""")
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))

    # ---------- the data ----------
    pg.goto(SEEDED + "#mystic"); pg.wait_for_timeout(1500)
    L = pg.evaluate("window.__fgiMc.list()")
    check(f"NA's 23 Mystic Codes, three skills each ({len(L)})", len(L) == 23 and all(len(m["sk"]) == 3 for m in L) and L[0]["n"] == "Chaldea" and L[-1]["n"] == "Misaki High School Uniform")
    t = pg.evaluate("window.__fgiMc.text(1, 1, 10).concat(window.__fgiMc.text(1, 1, 1), window.__fgiMc.text(1, 1, 5))")
    check(f"values grow with the level like a skill's: Instant Enhancement {t}", t == ["ATK +50% for one ally (1 turn)", "ATK +30% for one ally (1 turn)", "ATK +38% for one ally (1 turn)"])
    tt = pg.evaluate("window.__fgiMc.text(50, 0, 10).concat(window.__fgiMc.text(30, 1, 10), window.__fgiMc.text(340, 2, 10), window.__fgiMc.text(190, 1, 10))")
    check(f"cards, NP charge, all allies, times ({tt})", tt == ["Buster +60% for one ally (1 turn)", "NP +20% for one ally", "+15 stars", "NP +5% for all allies", "Invincible for one ally (2 times, 1 turn)"])
    nice = [{"id": 999, "name": "Mystic Code: Test Coat", "skills": [{"name": "A", "detail": "Increase all allies' ATK (1 turn) ", "icon": "https://x/SkillIcons/skill_00300.png", "coolDown": [12, 12, 12, 12, 12, 11, 11, 11, 11, 10],
             "functions": [{"funcType": "addStateShort", "funcTargetType": "ptAll", "buffs": [{"type": "upAtk", "ckSelfIndv": [], "ckOpIndv": []}], "svals": [{"Value": 200, "Turn": 1, "Count": -1}] + [{}] * 8 + [{"Value": 300, "Turn": 1, "Count": -1}]},
                           {"funcType": "gainNp", "funcTargetType": "ptOne", "buffs": [], "svals": [{"Value": 1000}] + [{}] * 8 + [{"Value": 1000}]}]}]}]
    c = pg.evaluate("(d) => window.__fgiMc.fromNice(d)", nice)
    check(f"a newer list from NA is read the same way ({c})", c == [[999, "Test Coat", [["A", "Increase all allies' ATK (1 turn)", 300, 12, 10, [["atk", "a", 20, 30, 1, 0], ["charge", "o", 10, 10, 0, 0]]]]]])

    # ---------- the page ----------
    check("Mystic Codes is a page in the sidebar", pg.locator("#tab-mystic").count() == 1 and pg.locator("#tab-mystic").get_attribute("aria-selected") == "true" and pg.locator(".mc-card").count() == 23)
    check("nothing equipped to begin with", "Nothing equipped" in pg.locator(".mc-eq").inner_text() and pg.evaluate(MCK) == {})
    pg.select_option("[data-mc-sort]", "charge"); pg.wait_for_timeout(300)
    best = pg.locator(".mc-best").inner_text(); first = pg.locator(".mc-card h3").first.inner_text()
    check(f"sorted by NP charge, Mage's Association Uniform comes first ({best})", first == "Mage's Association Uniform" and "Mage's Association Uniform (+20%)" in best and "Summer Streetwear (+20%)" in best)
    pg.select_option("[data-mc-sort]", "gain"); pg.wait_for_timeout(300)
    best = pg.locator(".mc-best").inner_text()
    check(f"sorted by NP Gain: A Fragment of 2004 (+50%), then True Ether (+40%) ({best})", best.startswith("Most NP Gain at Lv 10: A Fragment of 2004 (+50%), then Chaldea Uniform - True Ether (+40%)") and pg.locator(".mc-card").first.locator(".mc-sum .key").inner_text() == "NP Gain +50%")
    pg.select_option("[data-mc-lv]", "1"); pg.wait_for_timeout(300)
    check("at Lv 1 the numbers are Lv 1's", "A Fragment of 2004 (+30%)" in pg.locator(".mc-best").inner_text() and pg.evaluate(MCK)["lv"] == 1)
    pg.select_option("[data-mc-lv]", "10"); pg.wait_for_timeout(200)
    cds = pg.locator('.mc-card[data-mc="1"] .mc-skn small').all_inner_texts()
    check(f"cooldowns at Lv 10 ({cds})", cds == ["cooldown 7", "cooldown 13", "cooldown 13"])
    pg.locator('.mc-card[data-mc="1"] [data-mc-eq]').click(); pg.wait_for_timeout(300)
    check("Equip keeps it and says so", pg.evaluate(MCK).get("id") == 1 and "Equipped: Chaldea" in pg.locator(".mc-eq").inner_text() and pg.locator('.mc-card[data-mc="1"]').get_attribute("class") == "mc-card on")
    pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(300)
    check("Undo takes it off again", pg.evaluate(MCK).get("id") is None)
    pg.locator('.mc-card[data-mc="1"] [data-mc-eq]').click(); pg.wait_for_timeout(300)
    pics = pg.evaluate("Array.from(document.querySelectorAll('.mc-card[data-mc=\"1\"] img')).map((i) => i.getAttribute('src'))")
    check(f"pictures from NA's files ({pics[:2]})", pics[0].endswith("Items/masterequip00002.png") and pics[1].endswith("SkillIcons/skill_00600.png"))
    pg.locator('[data-mc-g="m"]').click(); pg.wait_for_timeout(200)
    check("the male Master's outfit", pg.locator('.mc-card[data-mc="1"] img').first.get_attribute("src").endswith("masterequip00001.png"))

    # ---------- the NP calculator on a servant's page: Chaldea's Instant Enhancement, ATK +50% ----------
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.click('#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(800)
    pg.locator("#dossier details.npc").scroll_into_view_if_needed()
    pg.evaluate("(() => { const d = document.querySelector('#dossier details.npc'); if (d && !d.open) d.querySelector('summary').click(); })()"); pg.wait_for_timeout(400)
    blk = pg.locator("#dossier .npc-who.mc")
    check("the calculator has the Mystic Code with its damage skill, ticked", blk.count() == 1 and blk.locator("select[data-npc-mc]").input_value() == "1" and blk.locator("input[data-npc-sk]").count() == 1 and blk.locator("input[data-npc-sk]").is_checked() and "ATK +50%" in blk.inner_text())
    pg.evaluate("document.querySelectorAll('#dossier input[data-npc-sk]').forEach(c => { if (c.checked && !c.dataset.npcSk.startsWith('mc:')) c.click(); })"); pg.wait_for_timeout(300)
    with_ = big(pg)
    blk.locator("input[data-npc-sk]").click(); pg.wait_for_timeout(300)
    without = big(pg)
    check(f"ticked off, the damage is a third lower: ATK +50% ({without} → {with_}, × {with_ / without:.3f})", 1.48 <= with_ / without <= 1.501)
    blk.locator("input[data-npc-sk]").click(); pg.wait_for_timeout(300)
    pg.select_option("#dossier select[data-npc-mc]", "50"); pg.wait_for_timeout(400)
    blk = pg.locator("#dossier .npc-who.mc")
    check(f"another one picked here is equipped everywhere: Anniversary Blonde, Buster +60% ({blk.inner_text()[:80]})", pg.evaluate(MCK)["id"] == 50 and "Buster +60%" in blk.inner_text())
    pg.select_option("#dossier select[data-npc-mclv]", "1"); pg.wait_for_timeout(300)
    check("its level too (Lv 1: Buster +40%)", "Buster +40%" in pg.locator("#dossier .npc-who.mc").inner_text() and pg.evaluate(MCK)["lv"] == 1)
    pg.select_option("#dossier select[data-npc-mclv]", "10"); pg.select_option("#dossier select[data-npc-mc]", "0"); pg.wait_for_timeout(300)
    check("None takes it off: the plain number again", big(pg) == without and pg.evaluate(MCK).get("id") is None)

    # ---------- the Workshop: the damage under a skill ----------
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(400)
    pg.click('[data-ws="blank"]'); pg.wait_for_timeout(200)
    pg.click('[data-ws="blank-cls"][data-v="Caster"]'); pg.click('[data-ws="blank-go"][data-r="5"]'); pg.wait_for_timeout(400)
    typ(pg, "#ws-name", "Orielle of the Last Light")
    pg.click(".ws-rail [data-i='2']"); pg.wait_for_timeout(200); typ(pg, '[data-wk="atk.1"]', "11000"); pg.wait_for_timeout(300)
    pg.click(".ws-rail [data-i='5']"); pg.wait_for_timeout(300)
    check("an empty skill: the block says what to do, and offers a Mystic Code", "Add an effect" in pg.locator(".ws-dmg").inner_text() and pg.locator(".ws-dmg select[data-wsd-mc]").count() == 1)
    pg.select_option(".ws-dmg select[data-wsd-mc]", "110"); pg.wait_for_timeout(400)
    used = pg.locator(".ws-dmg-used li").all_inner_texts(); T = table(pg)
    check(f"Chaldea Uniform - Arctic counted: ATK +40% and NP Strength +20% ({used})", len(used) == 2 and all(u.startswith("MC") for u in used) and "+40%" in used[0] and "+20%" in used[1])
    check(f"cards × 1.4, the NP × 1.4 × 1.2 ({T.get('Arts')}, {T.get('np')})", abs(T["Arts"][0][1] / T["Arts"][0][0] - 1.4) < 0.002 and abs(T["np"][0][1] / T["np"][0][0] - 1.68) < 0.003 and "Mystic Code" in pg.locator(".ws-dmg-note").inner_text())
    pg.select_option(".ws-dmg select[data-wsd-mc]", "0"); pg.wait_for_timeout(300)

    # ---------- the Battle simulator: the Master uses its skills ----------
    r = pg.evaluate("""() => { const B = window.__fgiBattle, mine = B.servants().filter((s) => !s.wish).slice(0, 3).map((s) => B.fromServant(s));
      const waves = [[B.made({cls: 'Lancer', name: 'A', hp: 15000, atk: 3000})], [B.made({cls: 'Saber', name: 'Boss', hp: 260000, atk: 5000, charge: 3})]];
      const plain = B.run({party: mine, waves: waves}, 777), mc = B.run({party: mine, waves: waves, mc: window.__fgiMc.battle(110, 10)}, 777), ch = B.run({party: mine, waves: waves, mc: window.__fgiMc.battle(30, 10)}, 777);
      const master = (R) => R.units.find((u) => u.side === 'master');
      const uses = (R) => R.events.filter((e) => e.t === 'skill' && master(R) && e.who === master(R).id).map((e) => e.n);
      return {plainMaster: !!master(plain), allies: mc.units.filter((u) => u.side === 'ally').length, uses: uses(mc), chUses: uses(ch), result: mc.result, turnsPlain: plain.turns, turnsMc: mc.turns,
        sameAllies: plain.units.filter((u) => u.side === 'ally').length}; }""")
    check(f"without a Mystic Code there's no Master ({r['plainMaster']})", not r["plainMaster"] and r["sameAllies"] == r["allies"] == 3)
    check(f"with Arctic the Master uses its skills ({r['uses']})", "Illusionary Buff" in r["uses"] and r["result"] == "win")
    check(f"with Mage's Association it charges an NP ({r['chUses']})", "Spiritron Transfer" in r["chUses"])
    # (a fresh tab: the Workshop above is still open as a window over the page)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    pg.goto(SEEDED + "#battle"); pg.wait_for_timeout(1500)
    sec = pg.locator("#battle .bt-mc")
    check("the Battle page has a Mystic Code row", sec.count() == 1 and sec.locator("select[data-bt-mc]").input_value() == "0")
    pg.select_option("#battle select[data-bt-mc]", "110"); pg.wait_for_timeout(400)
    check("picked there, it's equipped", pg.evaluate(MCK)["id"] == 110 and "Master uses them" in pg.locator("#battle .bt-mc").inner_text())
    pg.evaluate("document.querySelector('#battle [data-bt-seed]').value = '4242'; document.querySelector('#battle [data-bt-seed]').dispatchEvent(new Event('input', {bubbles: true}))")
    pg.click('#battle [data-bt-act="fight"]'); pg.wait_for_timeout(1500)
    pg.evaluate("(() => { const b = document.querySelector('#battle [data-bt-act=\"stop\"], #battle [data-bt-act=\"end\"], #battle [data-bt-act=\"skip\"]'); if (b) b.click(); })()"); pg.wait_for_timeout(500)
    log = pg.evaluate("Array.from(document.querySelectorAll('#battle [data-bt-log] li')).map((l) => l.textContent)")
    m = [l for l in log if l.startswith("Master uses")]
    check(f"in the fight's log: “{m[0] if m else '—'}”", len(m) >= 1)
    b.close()
if errs: print("page errors:", errs[:3])
print(f"FAILED {len(fails)}: {fails} errors {errs[:2]}" if fails or errs else "all passed")
sys.exit(1 if fails or errs else 0)
