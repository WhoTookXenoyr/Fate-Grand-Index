import os
# 0.24.0: the NP damage calculator under the NP table. Its numbers are checked against the damage formula worked out
# here: ATK × 0.23 × NP% × card × (1 + card up) × class ATK × affinity × attribute × (1 + ATK up + DEF down)
# × (1 + special attack + NP Strength) × Special damage + Damage Plus, with the class passives (from the NA data) and the
# equipped Craft Essence added when that box is ticked. Also: Special damage against a trait, Overcharge that adds to
# the NP's damage, the kill chance for an HP, and the buffs being remembered.
# 0.24.0 fixes: skills and supports. The servant's own skills and up to two supports' (Castoria, Oberon, Koyanskaya of
# Light here) are listed with what they do to NP damage, ticked on, and added up on their own; parts for another card,
# or against a trait the calculator can't know, aren't counted. The earlier checks untick the servant's own skills
# first, so they stay the plain formula.
import sys, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}))"
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
src = open(os.path.join(sp, "atlas_data.js"), encoding="utf-8").read()
def jsconst(name): return json.loads(re.search(r"^const " + name + r" = (.*);$", src, re.M).group(1))
ATLAS = {x["no"]: x for x in jsconst("ATLAS_S")}; CES = {c["no"]: c for c in jsconst("ATLAS_C")}
CU = ATLAS[98]
AFF = {("Berserker", "Saber"): 2, ("Berserker", "Shielder"): 1, ("Saber", "Lancer"): 2, ("Saber", "Archer"): 0.5, ("Pretender", "Lancer"): 1.5}
def formula(atk, mult, card, cls, ecls, attr, eattr, cardup=0, atkup=0, defdown=0, np=0, pow_=0, se=1, dp=0):
    cv = {"Buster": 1.5, "Arts": 1, "Quick": 0.8}[card]; cm = {"Berserker": 1.1, "Archer": 0.95, "Lancer": 1.05, "Caster": 0.9, "Assassin": 0.9}.get(cls, 1)
    win = {("Man", "Sky"), ("Sky", "Earth"), ("Earth", "Man"), ("Star", "Beast"), ("Beast", "Star")}
    at = 1.1 if (attr, eattr) in win else 0.9 if (eattr, attr) in win else 1
    return atk * 0.23 * mult / 100 * cv * (1 + cardup / 100) * cm * AFF.get((cls, ecls), 1) * at * (1 + (atkup + defdown) / 100) * (1 + pow_ / 100 + np / 100) * se + dp
def big(pg): return int(pg.locator("#dossier .npc-big b").inner_text().replace(",", ""))
def setnum(pg, k, v): pg.locator(f'#dossier input[data-npc="{k}"]').fill(str(v)); pg.wait_for_timeout(200)
SUP = "JSON.parse(localStorage.getItem('spirit-origin-list:v1:npcalc') || '{}').sup || []"
def pick_sup(pg, i, key, search=None):
    pg.click(f'#dossier [data-npc-pick="{i}"]'); pg.wait_for_selector(".spk:not([hidden]) [data-spk]", timeout=5000)
    if search: pg.fill(".spk [data-spk-q]", search); pg.wait_for_timeout(400)
    pg.locator(f'.spk [data-spk="{key}"]').first.click(); pg.wait_for_timeout(400)
def untick(pg):
    pg.evaluate("document.querySelectorAll('#dossier input[data-npc-sk]').forEach(c => { if (c.checked) c.click(); })"); pg.wait_for_timeout(300)
def open_calc(pg):
    pg.locator("#dossier details.npc").scroll_into_view_if_needed()
    pg.evaluate("(() => { const d = document.querySelector('#dossier details.npc'); if (d && !d.open) d.querySelector('summary').click(); })()"); pg.wait_for_timeout(300)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1360, "height": 900}); pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.click('#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(800)
    check("the NP section has a damage calculator", pg.locator("#dossier .np-sec details.npc").count() == 1)
    open_calc(pg)
    cu = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "cu-chulainn-alter")
    atk = cu["atk"] + (cu.get("fouAtk") or 0)
    # Cu Alter's own table (from his notes) says 600% at NP1; his passives give Buster +6% and Damage Plus 150
    want = formula(atk, 600, "Buster", "Berserker", "Saber", CU["a"], "Earth", cardup=CU["pm"][0], dp=CU["pm"][4])
    check(f"no buffs, against a Saber: {big(pg):,} (formula {want:,.0f})", abs(big(pg) - want) < 1.5)
    auto = pg.locator('#dossier [data-npc-o="auto"]').inner_text()
    check(f"it says what the passives add ({auto!r})", "Buster +6%" in auto and "Damage Plus 150" in auto)
    setnum(pg, "atk", 20); setnum(pg, "np", 30); setnum(pg, "def", 10); setnum(pg, "card", 15); setnum(pg, "pow", 25)
    want = formula(atk, 600, "Buster", "Berserker", "Saber", CU["a"], "Earth", cardup=15 + CU["pm"][0], atkup=20, defdown=10, np=30, pow_=25, dp=CU["pm"][4])
    check(f"with ATK +20%, DEF down 10%, Buster +15%, NP +30%, special attack +25%: {big(pg):,} (formula {want:,.0f})", abs(big(pg) - want) < 1.5)
    pg.select_option('#dossier select[data-npc="ecls"]', "Shielder"); pg.wait_for_timeout(300)
    want_sh = formula(atk, 600, "Buster", "Berserker", "Shielder", CU["a"], "Earth", cardup=15 + CU["pm"][0], atkup=20, defdown=10, np=30, pow_=25, dp=CU["pm"][4])
    check(f"against a Shielder (neutral): {big(pg):,} (formula {want_sh:,.0f})", abs(big(pg) - want_sh) < 1.5)
    pg.select_option('#dossier select[data-npc="eattr"]', "Man"); pg.wait_for_timeout(300)
    want_m = formula(atk, 600, "Buster", "Berserker", "Shielder", CU["a"], "Man", cardup=15 + CU["pm"][0], atkup=20, defdown=10, np=30, pow_=25, dp=CU["pm"][4])
    check(f"Earth against Man is 1.1x: {big(pg):,} (formula {want_m:,.0f})", abs(big(pg) - want_m) < 1.5 and CU["a"] == "Earth")
    pg.select_option('#dossier select[data-npc="lv"]', "3"); pg.wait_for_timeout(300)
    want3 = formula(atk, 900, "Buster", "Berserker", "Shielder", CU["a"], "Man", cardup=15 + CU["pm"][0], atkup=20, defdown=10, np=30, pow_=25, dp=CU["pm"][4])
    check(f"NP3 uses the table's 900%: {big(pg):,} (formula {want3:,.0f})", abs(big(pg) - want3) < 1.5)
    pg.uncheck('#dossier input[data-npc="auto"]'); pg.wait_for_timeout(300)
    want_off = formula(atk, 900, "Buster", "Berserker", "Shielder", CU["a"], "Man", cardup=15, atkup=20, defdown=10, np=30, pow_=25)
    check(f"unticking 'what's always on' takes the passives out: {big(pg):,} (formula {want_off:,.0f})", abs(big(pg) - want_off) < 1.5)
    pg.check('#dossier input[data-npc="auto"]'); pg.wait_for_timeout(300)
    # every class at once
    cells = pg.evaluate("[...document.querySelectorAll('#dossier .npc-c')].map(c => [c.querySelector('i').textContent, c.className])")
    check(f"it shows the damage against every class ({len(cells)}), the picked one marked", len(cells) >= 14 and sum(1 for c in cells if " on" in c[1]) == 1)
    # the chance to kill
    lo = want3 * 0.9; hi = want3 * 1.099; hp = round(want3 * 1.0)
    setnum(pg, "hp", hp)
    k = pg.locator("#dossier .npc-kill").inner_text()
    exp_k = round((1.099 - (hp - CU["pm"][4]) / ((want3 - CU["pm"][4]))) / 0.199 * 100)
    check(f"an HP inside the range gives a kill chance ({k!r}, about {exp_k}%)", "of the time" in k and abs(int(re.search(r"(\d+)%", k).group(1)) - exp_k) <= 1)
    setnum(pg, "hp", int(lo * 0.5)); k1 = pg.locator("#dossier .npc-kill").inner_text()
    setnum(pg, "hp", int(hi * 2)); k2 = pg.locator("#dossier .npc-kill").inner_text()
    check(f"below the lowest roll it always kills, above the highest it never does ({k1!r}, {k2!r})", "every time" in k1 and "Leaves it at" in k2)
    # remembered for next time (the enemy and buffs; the NP level stays with the page)
    pg.reload(); pg.wait_for_timeout(1500); pg.click('#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(800); open_calc(pg)
    kept = pg.evaluate("[...document.querySelectorAll('#dossier [data-npc]')].filter(e => e.tagName !== 'DETAILS').map(e => [e.dataset.npc, e.type === 'checkbox' ? e.checked : e.value])")
    kd = dict(kept)
    check(f"the enemy and the buffs are remembered ({kd})", kd.get("ecls") == "Shielder" and kd.get("eattr") == "Man" and kd.get("atk") == "20" and kd.get("np") == "30" and kd.get("auto") is True)
    for k in ("atk", "np", "def", "card", "pow", "hp"): setnum(pg, k, "")
    pg.select_option('#dossier select[data-npc="ecls"]', "Lancer"); pg.select_option('#dossier select[data-npc="eattr"]', "Earth"); pg.wait_for_timeout(200)

    # Special damage against a trait, an Overcharge that adds damage, and the equipped Craft Essence
    data = pg.evaluate(LS)
    ar = next(x for x in data["servants"] if x["id"] == "artoria")
    ar["npTable"] = {"g": [{"name": "", "slots": []}], "v": [{"name": "Test Blade", "card": "Buster", "effect": "Deal heavy damage to all enemies", "oc": "Deal heavy Special Attack damage to all [Dragon] enemies",
        "rows": [{"label": "Damage", "vals": ["300%", "400%", "450%", "475%", "500%"]}], "ocRows": [{"label": "Special damage", "vals": ["150%", "162.5%", "175%", "187.5%", "200%"]}], "grp": 0}]}
    ar["favCe"] = [48]; ar["favCeOn"] = 0
    dr = next(x for x in data["servants"] if x["id"] == "oberon")
    dr["npTable"] = {"g": [{"name": "", "slots": []}], "v": [{"name": "Test Star", "card": "Buster", "effect": "Deal damage", "oc": "Deal more damage",
        "rows": [{"label": "Damage", "vals": ["800%", "1000%", "1100%", "1150%", "1200%"]}], "ocRows": [{"label": "Extra damage", "vals": ["+0%", "+200%", "+400%", "+600%", "+800%"]}], "grp": 0}]}
    pg.evaluate("(d) => localStorage.setItem('spirit-origin-list:v1', JSON.stringify(d))", data); pg.reload(); pg.wait_for_timeout(1500)
    pg.click('#list [data-id="artoria"]'); pg.wait_for_timeout(800); open_calc(pg); untick(pg)
    a2 = ATLAS[2]; ce = CES[48]
    a_atk = ar["atk"] + (ar.get("fouAtk") or 0) + ce["atk"][1]
    base = dict(cardup=a2.get("pm", [0, 0, 0])[0], np=80)
    foot = pg.locator('#dossier [data-npc-o="foot"]').inner_text()
    check(f"the equipped Craft Essence's ATK is in ({foot[:60]!r})", f"{a_atk:,}" in foot and ce["n"] in foot)
    auto = pg.locator('#dossier [data-npc-o="auto"]').inner_text()
    check(f"and its NP Strength +80% is added ({auto!r})", "NP Strength +80%" in auto)
    want = formula(a_atk, 300, "Buster", "Saber", "Lancer", a2["a"], "Earth", **base)
    check(f"Artoria with The Black Grail against a Lancer: {big(pg):,} (formula {want:,.0f})", abs(big(pg) - want) < 1.5)
    lab = pg.locator("#dossier .npc-chk").first.inner_text()
    check(f"the NP's trait is offered ({lab!r})", "Dragon" in lab and "150%" in lab)
    pg.check('#dossier input[data-npc="se"]'); pg.select_option('#dossier select[data-npc="oc"]', "3"); pg.wait_for_timeout(300)
    want = formula(a_atk, 300, "Buster", "Saber", "Lancer", a2["a"], "Earth", se=1.75, **base)
    check(f"against a Dragon at 300% Overcharge it's 1.75x: {big(pg):,} (formula {want:,.0f})", abs(big(pg) - want) < 1.5)
    pg.uncheck('#dossier input[data-npc="se"]'); pg.wait_for_timeout(200)
    pg.click('#list [data-id="oberon"]'); pg.wait_for_timeout(800); open_calc(pg); untick(pg)
    ob = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "oberon"); o_atk = ob["atk"] + (ob.get("fouAtk") or 0)
    pg.select_option('#dossier select[data-npc="lv"]', "1"); pg.select_option('#dossier select[data-npc="oc"]', "2"); pg.wait_for_timeout(300)
    OB = next(x for x in ATLAS.values() if x["n"].startswith("Oberon"))
    want = formula(o_atk, 1000, "Buster", "Pretender", "Lancer", OB["a"], "Earth", cardup=(OB.get("pm") or [0])[0], np=(OB.get("pm") or [0, 0, 0, 0])[3], dp=(OB.get("pm") or [0] * 5)[4])
    check(f"an Overcharge row of +% adds to the NP's damage (800% + 200%): {big(pg):,} (formula {want:,.0f})", abs(big(pg) - want) < 1.5)

    # ---------- skills and supports, added up on their own ----------
    pg.click('#list [data-id="artoria"]'); pg.wait_for_timeout(800); open_calc(pg)
    pg.select_option('#dossier select[data-npc="oc"]', "1"); pg.wait_for_timeout(200)
    lv = [x or 10 for x in (ar.get("skills") or [10, 10, 10])]
    own = pg.evaluate("[...document.querySelectorAll('#dossier .npc-who:not(.sup) .npc-sk')].map(l => [l.querySelector('b').textContent, l.querySelector('input').checked, l.querySelector('.npc-lv').textContent])")
    check(f"Artoria's own skills that change NP damage are listed at her levels ({own})", [o[0] for o in own] == ["Charisma B", "Dragon's Core B"] and own[1][2] == f"Lv {lv[1]}")
    pg.evaluate("document.querySelectorAll('#dossier .npc-who:not(.sup) input[data-npc-sk]').forEach(c => { if (!c.checked) c.click(); })"); pg.wait_for_timeout(300)
    sk = a2["sk"]; ch, dc_c, dc_n = sk[0]["b"][0][3][lv[0] - 1], sk[1]["b"][0][3][lv[1] - 1], sk[1]["b"][1][3][lv[1] - 1]
    want = formula(a_atk, 300, "Buster", "Saber", "Lancer", a2["a"], "Earth", cardup=base["cardup"] + dc_c, atkup=ch, np=80 + dc_n)
    check(f"ticked, they're added: Charisma ATK +{ch}%, Dragon's Core Buster +{dc_c}% and NP +{dc_n}%: {big(pg):,} (formula {want:,.0f})", abs(big(pg) - want) < 1.5)
    # 0.25.0: the support boxes open a big picker with pictures and a search
    pg.click('#dossier [data-npc-pick="0"]'); pg.wait_for_selector(".spk:not([hidden]) [data-spk]", timeout=5000)
    box = pg.evaluate("(() => { const p = document.querySelector('.spk .cep-panel').getBoundingClientRect(); return [Math.round(p.width), Math.round(p.height), document.activeElement && document.activeElement.matches('[data-spk-q]')]; })()")
    groups = pg.evaluate("[...document.querySelectorAll('.spk .spk-g h3')].map(h => h.firstChild.textContent.trim())")
    check(f"the support picker is a big window with the search box ready ({box}) and groups ({groups})", box[0] >= 800 and box[1] >= 500 and box[2] and groups[:2] == ["Your Guests", "Often borrowed"] and groups[-1] == "Every NA servant")
    pg.fill(".spk [data-spk-q]", "castoria"); pg.wait_for_timeout(400)
    found = pg.evaluate("[...document.querySelectorAll('.spk [data-spk]')].map(b => b.dataset.spk)")
    check(f"a nickname finds her: 'castoria' ({found[:4]})", "a:284" in found)
    pg.click('.spk [data-spk-c="Caster"]'); pg.wait_for_timeout(300)
    cls = pg.evaluate("[...document.querySelectorAll('.spk [data-spk] .pc-m')].map(m => m.textContent.split(' · ')[0])")
    check(f"the class buttons narrow it down ({set(cls)})", cls and set(cls) == {"Caster"})
    pg.locator('.spk [data-spk="a:284"]').first.click(); pg.wait_for_timeout(400)
    check("picking closes it and fills Support 1", pg.locator(".spk").is_hidden() and pg.evaluate(SUP) == ["a:284"] and "Altria Caster" in pg.locator('#dossier [data-npc-pick="0"]').inner_text())
    pick_sup(pg, 1, "a:316", "oberon")
    sups = pg.evaluate("[...document.querySelectorAll('#dossier .npc-who.sup')].map(w => [...w.querySelectorAll('.npc-sk')].map(l => [l.querySelector('b').textContent, [...l.querySelectorAll('.npc-fx')].map(f => [f.textContent, f.className])]))")
    check(f"Castoria and Oberon as supports, with their skills at Lv 10 ({[[s[0] for s in w] for w in sups]})", [s[0] for s in sups[0]] == ["Charisma of Hope B", "Sword of Selection EX"] and [s[0] for s in sups[1]] == ["Evening Shroud EX", "Ending of Dreams EX"])
    arts = sups[0][1][1]
    check(f"Castoria's Arts up doesn't count for a Buster NP, and her damage against Threat to Humanity can't be told here ({arts})", " no" in arts[0][1] and "maybe" in arts[1][1] and "vs Threat to Humanity" in arts[1][0])
    want = formula(a_atk, 300, "Buster", "Saber", "Lancer", a2["a"], "Earth", cardup=base["cardup"] + dc_c + 50, atkup=ch + 20, np=80 + dc_n + 30)
    check(f"with them: ATK +20%, NP +30%, Buster +50% more: {big(pg):,} (formula {want:,.0f})", abs(big(pg) - want) < 1.5)
    tsum = pg.locator('#dossier [data-npc-o="tsum"]').inner_text()
    check(f"the total is spelled out ({tsum!r})", f"ATK +{ch + 20:g}%" in tsum and f"Buster +{dc_c + 50}%" in tsum and f"NP Strength +{dc_n + 30}%" in tsum)
    pg.locator('#dossier .npc-who.sup').nth(1).locator('input[data-npc-sk]').nth(1).click(); pg.wait_for_timeout(300)
    want_u = formula(a_atk, 300, "Buster", "Saber", "Lancer", a2["a"], "Earth", cardup=base["cardup"] + dc_c, atkup=ch + 20, np=80 + dc_n + 30)
    check(f"unticking Oberon's Buster up takes it out: {big(pg):,} (formula {want_u:,.0f})", abs(big(pg) - want_u) < 1.5)
    pg.reload(); pg.wait_for_timeout(1500); pg.click('#list [data-id="artoria"]'); pg.wait_for_timeout(800); open_calc(pg)
    kept = pg.evaluate("[JSON.parse(localStorage.getItem('spirit-origin-list:v1:npcalc') || '{}').sup || [], [...document.querySelectorAll('#dossier .npc-who.sup input[data-npc-sk]')].map(c => c.checked)]")
    check(f"the supports and what's ticked are remembered ({kept})", kept[0] == ["a:284", "a:316"] and kept[1] == [True, True, True, False] and abs(big(pg) - want_u) < 1.5)
    # Koyanskaya of Light: special attack against Man counts once the enemy is Man
    pick_sup(pg, 0, "a:314", "koyanskaya of light")
    k_earth = big(pg)
    want_k = formula(a_atk, 300, "Buster", "Saber", "Lancer", a2["a"], "Earth", cardup=base["cardup"] + dc_c + 50, atkup=ch, np=80 + dc_n + 30)
    check(f"Koyanskaya of Light instead of Castoria: her Buster up counts, her damage against Man doesn't against an Earth enemy: {k_earth:,} (formula {want_k:,.0f})", abs(k_earth - want_k) < 1.5)
    pg.select_option('#dossier select[data-npc="eattr"]', "Man"); pg.wait_for_timeout(400)
    want_m = formula(a_atk, 300, "Buster", "Saber", "Lancer", a2["a"], "Man", cardup=base["cardup"] + dc_c + 50, atkup=ch, np=80 + dc_n + 30, pow_=50)
    check(f"against a Man enemy it does (special attack +50%): {big(pg):,} (formula {want_m:,.0f})", abs(big(pg) - want_m) < 1.5)
    pg.click('#dossier [data-npc-unpick="0"]'); pg.wait_for_timeout(300); pg.click('#dossier [data-npc-unpick="0"]'); pg.wait_for_timeout(300)
    check(f"× takes a support away ({pg.evaluate(SUP)})", pg.evaluate(SUP) == [] and pg.locator("#dossier [data-npc-unpick]").count() == 0)

    # a phone: no sideways scroll
    ctx.close()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.click('#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(900); open_calc(pg)
    wide = pg.evaluate("(() => { const d = document.querySelector('#dossier'); return [d.scrollWidth, d.clientWidth]; })()")
    check(f"on a phone the calculator fits ({wide})", wide[0] <= wide[1] + 1)
    ctx.close(); b.close()
print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
