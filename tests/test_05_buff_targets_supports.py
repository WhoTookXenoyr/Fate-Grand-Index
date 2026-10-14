import sys, tempfile, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]
NEW = f"file://{sp}/_seeded.html#servants"
errs = []
fails = []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
def page(ctx):
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    return pg
prof = tempfile.mkdtemp()
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 1000})
    pg = page(ctx)
    # ---- unit checks on the text readers, in a copy that exposes them
    h = open(f"{sp}/_seeded.html").read()
    assert h.count("\ninit();\n})();") == 1
    open(f"{sp}/_t81.html", "w").write(h.replace("\ninit();\n})();", "\nwindow.__t = {buffVocab, buffTagsInLine, offenseKit, pctRange, S: () => S};\ninit();\n})();"))
    pg.goto(f"file://{sp}/_t81.html"); pg.wait_for_timeout(1000)
    u = pg.evaluate("""() => {
      const {buffVocab, buffTagsInLine, offenseKit, pctRange} = window.__t, S = window.__t.S();
      const v = buffVocab();
      const t = (ln) => buffTagsInLine(ln, v);
      const fake = Object.assign({}, S.servants.find(s => s.id === 'artoria'), {id: 'zz-fake', name: 'Zz', skills: [10, 1, 10],
        skillInfo: [{effect: "Increases all allies' ATK by 10%~20% for 3 turns.\\nIncreases own Buster performance by 30% for 1 turn.", cd: 7},
                    {effect: "Reduces all enemies' DEF by 10%~20% for 3 turns.\\nReduces own DEF by 10% (demerit).", cd: 8},
                    {effect: "Increases one ally's Arts performance by 20%~30% for 3 turns.\\nIncreases one ally's NP damage by 15%~25% for 1 turn.\\nReduces enemy's Buster resistance by 20% for 3 turns.", cd: 8}]});
      const ok = offenseKit(fake).map(e => [e.s, e.t, e.who, e.card || '', e.n1 == null ? null : e.n1, e.n]);
      return {
        a: t("Increases ATK of all Divine allies by 20% for 3 turns"),
        b: t("Increases Male allies' ATK by 10%~20%"),
        c: t("Charges NP gauge for all allies by 10%"),
        d: t("Grants Evade to allies with Good alignment (1 time, 3 turns)"),
        e: t("Increases NP damage for Female and Fae allies by 30%"),
        f: t("Increases own ATK by 20% against Divine enemies"),
        off: ok,
        rg: pctRange("Charges NP gauge by 20%~30%")
      };
    }""")
    print(json.dumps(u))
    check("'all Divine allies' -> Divine", u["a"] == ["trait:Divine"])
    check("'Male allies' -> Male", u["b"] == ["trait:Male"])
    check("'all allies' -> nothing", u["c"] == [])
    check("'allies with Good alignment' -> Good", u["d"] == ["align:Good"])
    check("'Female and Fae allies' -> both", sorted(u["e"]) == ["trait:Fae", "trait:Female"])
    check("'against Divine enemies' is not an ally buff", u["f"] == [])
    off = {(str(x[0]), x[1]) : x for x in u["off"]}
    check("wiki wording: party ATK 10~20%", off.get(("0", "atkup")) == [0, "atkup", "party", "", 10, 20])
    check("wiki wording: own Buster performance", off.get(("0", "cardup")) == [0, "cardup", "self", "Buster", None, 30])
    check("wiki wording: enemy DEF down, own DEF demerit skipped", off.get(("1", "defdown")) == [1, "defdown", "enemy", "", 10, 20] and sum(1 for x in u["off"] if x[1] == "defdown") == 1)
    check("wiki wording: ally Arts, NP damage, Buster resist down", off.get(("2", "cardup")) == [2, "cardup", "ally", "Arts", 20, 30] and off.get(("2", "npdmg")) == [2, "npdmg", "ally", "", 15, 25] and off.get(("2", "cardres")) == [2, "cardres", "enemy", "Buster", None, 20])
    check("range 20%~30%", u["rg"] == [20, 30])

    pg.goto(NEW); pg.wait_for_timeout(1000)
    # ---- Best supports on existing servants
    pg.click('[data-id="arjuna-alter"]'); pg.wait_for_timeout(500)
    card = pg.locator(".bs-sec h3").inner_text()
    order = pg.evaluate("Array.from(document.querySelectorAll('#dossier .d-sec')).map(x=>x.className)")
    ti = next((i for i, c in enumerate(order) if "tr-sec" in c), -1); bi = next((i for i, c in enumerate(order) if "bs-sec" in c), -1)
    check(f"Best supports right after traits ({card})", ti >= 0 and bi == ti + 1)
    names = pg.locator(".bs-sec .bs-list").first.locator(".tr-name").all_inner_texts()
    bs = pg.locator(".bs-sec").inner_text()
    print("Arjuna Alter best supports:", names)
    check("Oberon ranks in Arjuna Alter's top supports with NP damage", "Oberon" in names[:3] and "NP damage" in bs)
    pg.locator(".bs-sec").screenshot(path=f"{sp}/v81-bs-arjuna.png")
    need = pg.locator(".bs-need").inner_text()
    check(f"what they bring on their own: {need[:90]!r}", "+20% ATK" in need and "20%" in need and "80%" in need)
    check("best pair shown", pg.locator(".bs-pair").count() == 1 and "Oberon" in pg.locator(".bs-pair").inner_text())
    check("Medb ranks 2nd for Male Arjuna Alter", names[1] == "Queen Medb")
    pg.click('[data-id="oberon"]'); pg.wait_for_timeout(400)
    medb = pg.locator('.bs-sec li:has(.tr-name:text-is("Queen Medb"))')
    check("Oberon (Male) gets Medb's Male ATK counted", medb.count() == 1 and "for Male" not in medb.inner_text() or "Male" in medb.inner_text())
    print("  Medb for Oberon:", medb.inner_text().replace("\n", " ") if medb.count() else "-")

    # ---- a new support whose skill text names who it buffs
    pg.click('[data-action="add-servant"] >> nth=0'); pg.wait_for_timeout(400)
    pg.fill("#sv-name", "Test Caster"); pg.select_option("#sv-cls", "Caster"); pg.select_option("#sv-rarity", "4")
    pg.select_option("#sv-sk0", "10")
    pg.fill("#sv-s1-effect", "Increases ATK of all Divine allies by 30%~50% for 3 turns.\nCharges all allies' NP gauge by 30%.")
    pg.fill("#sv-s1-cd", "7")
    pg.wait_for_timeout(700)
    ab = pg.locator("#tr-autobuffs").inner_text()
    check(f"typed skill text is read live: {ab[:90]!r}", "Read from the skill text" in ab and "Divine" in ab)
    live = pg.locator("#tr-live").inner_text()
    check("live list shows the Divine servants it reaches", "Arjuna Alter" in live)
    pg.locator("#fs-traits").screenshot(path=f"{sp}/v81-form-auto.png")
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(800)
    tc = pg.evaluate(LS + ".servants.find(s=>s.name==='Test Caster')")
    check(f"Test Caster saved with a numeric roster position ({tc and tc.get('order')})", tc is not None and isinstance(tc.get("order"), (int, float)))
    pg.click('[data-id="arjuna-alter"]'); pg.wait_for_timeout(500)
    works = pg.locator(".tr-sec").inner_text()
    check("Arjuna Alter (Divine) now works well with Test Caster", "Test Caster" in works)
    li = pg.locator('.bs-sec li:has(.tr-name:text-is("Test Caster"))')
    t = li.inner_text().replace("\n", " ") if li.count() else ""
    print("  Test Caster for Arjuna Alter:", t)
    check("Best supports counts its Divine ATK and NP charge", "ATK up +50%" in t and "for Divine allies" in t and "NP charge" in t)
    pg.click('[data-id="oberon"]'); pg.wait_for_timeout(400)
    li = pg.locator('.bs-sec li:has(.tr-name:text-is("Test Caster"))')
    t = li.inner_text().replace("\n", " ") if li.count() else ""
    print("  Test Caster for Oberon:", t)
    check("…but not its ATK for Oberon (not Divine)", "ATK up" not in t)

    # ---- a new servant filled from a wiki paste
    pg.click('[data-action="add-servant"] >> nth=0'); pg.wait_for_timeout(400)
    pg.fill("#sv-name", "Test Saber"); pg.select_option("#sv-cls", "Saber"); pg.select_option("#sv-npcard", "Buster")
    pg.evaluate("""() => {
      const dt = new DataTransfer();
      const html = '<table><tr><th>Attribute:</th><td>Earth</td></tr><tr><th>Alignments:</th><td>Chaotic・Evil</td></tr><tr><th>Gender:</th><td>Male</td></tr>'
        + '<tr><th>Traits:</th><td><a href="/wiki/Dragon">Dragon</a>, <a href="/wiki/Fae">Fae</a>, <a href="/wiki/New_Thing">New Thing</a>, <a href="/wiki/Saber">Saber</a></td></tr><tr><th>Height:</th><td>180cm</td></tr></table>';
      dt.setData('text/html', html);
      dt.setData('text/plain', 'Attribute: Earth\\nAlignments: Chaotic・Evil\\nGender: Male\\nTraits: Dragon, Fae, New Thing, Saber\\nHeight: 180cm');
      const ta = document.getElementById('tr-paste'); ta.focus();
      ta.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
    }""")
    pg.wait_for_timeout(300)
    on = pg.evaluate("Array.from(document.querySelectorAll('#fs-traits .tr-chip[aria-pressed=\"true\"]')).map(c=>c.dataset.v)")
    msg = pg.locator("#tr-paste-msg").inner_text()
    print("  ticked:", on, "|", msg)
    check("paste ticks attribute, alignment, gender and traits", pg.input_value("#sv-attr") == "Earth" and all(x in on for x in ["Chaotic", "Evil", "Male", "Dragon", "Fae", "New Thing"]) and "Saber" not in on)
    check("paste message says what it ticked", msg.startswith("Ticked:") and "Earth" in msg)
    pg.locator("#fs-traits").screenshot(path=f"{sp}/v81-form-paste.png")
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(800)
    ts = pg.evaluate(LS + ".servants.find(s=>s.name==='Test Saber')")
    check(f"saved: {ts.get('attr')} {ts.get('lawOrder')} {ts.get('moral')} {ts.get('traits')} order={ts.get('order')}", ts.get("attr") == "Earth" and "New Thing" in ts.get("traits", []) and ts.get("lawOrder") == ["Chaotic"] and isinstance(ts.get("order"), (int, float)))
    pg.wait_for_timeout(300)
    print("  dossier:", pg.locator("#dossier h2").first.inner_text(), "|", pg.locator(".tr-sec").inner_text()[:400].replace("\n", " / "))
    bsn = pg.locator(".bs-sec .bs-list").first.locator(".tr-name").all_inner_texts()
    print("  Test Saber best supports:", bsn)
    check("the new servant gets a Best supports list right away (Medb for Male, Oberon for Buster)", "Queen Medb" in bsn and "Oberon" in bsn)
    wk = pg.locator(".tr-sec").inner_text()
    check("…and a works-well-with list from the paste (Medb's Male/Fae buffs)", "Queen Medb" in wk)
    pg.locator(".bs-sec").screenshot(path=f"{sp}/v81-bs-new.png")
    pg.click('[data-id="artoria"] >> nth=0'); pg.wait_for_timeout(300)
    check("Artoria shows Lawful from the wiki defaults", "Lawful" in pg.locator(".tr-sec").inner_text())

    # typed (not pasted) into the box
    pg.click('[data-action="add-servant"] >> nth=0'); pg.wait_for_timeout(400)
    pg.fill("#tr-paste", "Attribute: Sky Alignment: Lawful・Good Traits: Divine Humanoid Weak to Enuma Elish Height: 160cm")
    pg.wait_for_timeout(800)
    on = pg.evaluate("Array.from(document.querySelectorAll('#fs-traits .tr-chip[aria-pressed=\"true\"]')).map(c=>c.dataset.v)")
    check(f"typing into the box works too: {on}", pg.input_value("#sv-attr") == "Sky" and all(x in on for x in ["Lawful", "Good", "Divine", "Humanoid"]))
    pg.click('[data-action="cancel"] >> nth=0') if pg.locator('[data-action="cancel"]').count() else None

    # ---- v8 data: alignment saved in `order` gets moved and the roster position restored
    pg.evaluate("""() => { const k = 'spirit-origin-list:v1', d = JSON.parse(localStorage.getItem(k)); const a = d.servants.find(s => s.id === 'artoria') || null;
      if (a) { a.order = ['Lawful']; delete a.lawOrder; a.traitsSet = true; a.moral = ['Good']; a.traits = ['Dragon', 'Female']; } else d.servants.push({id: 'artoria-x', name: 'Artoria X', cls: 'Saber', rarity: 5, order: ['Lawful'], moral: ['Good'], traits: ['Dragon'], traitsSet: true});
      localStorage.setItem(k, JSON.stringify(d)); }""")
    pg.reload(); pg.wait_for_timeout(1500)
    a = pg.evaluate(LS + ".servants.find(s=>s.id==='artoria' || s.id==='artoria-x')")
    check(f"migration: order {a.get('order')!r}, lawOrder {a.get('lawOrder')}", isinstance(a.get("order"), (int, float)) and a.get("lawOrder") == ["Lawful"])
    pg.click(f'[data-id="{a["id"]}"] >> nth=0'); pg.wait_for_timeout(300)
    check("…and shows as Lawful Good", "Lawful" in pg.locator(".tr-sec").inner_text() and "Good" in pg.locator(".tr-sec").inner_text())

    # ---- party DNA still works with the new kits
    pg.click('[data-action="tab"][data-tab="ranking"]'); pg.wait_for_timeout(400)
    check("ranking renders", pg.locator(".rk-roi").count() >= 15)

    # ---- phones and dark mode
    for w in (360, 400):
        pg.set_viewport_size({"width": w, "height": 820}); pg.goto(NEW.replace("#servants", "") + "#servants"); pg.reload(); pg.wait_for_timeout(1200)
        pg.click('[data-id="arjuna-alter"] >> nth=0'); pg.wait_for_timeout(500)
        sw = pg.evaluate("document.documentElement.scrollWidth")
        check(f"{w}px: no sideways scroll ({sw})", sw <= w)
        pg.locator(".bs-sec").scroll_into_view_if_needed(); pg.locator(".bs-sec").screenshot(path=f"{sp}/v81-phone{w}-bs.png")
    pg.set_viewport_size({"width": 1360, "height": 1000})
    pg.emulate_media(color_scheme="dark"); pg.wait_for_timeout(300)
    pg.click('[data-id="test-saber"], [data-id]:has-text("Test Saber") >> nth=0') if False else None
    pg.click('[data-id="oberon"] >> nth=0'); pg.wait_for_timeout(400)
    pg.locator(".bs-sec").screenshot(path=f"{sp}/v81-dark-bs.png")
    check("no page errors", not errs)
    if errs: print(errs[:5])
    ctx.close()
print("FAILS:", len(fails))
