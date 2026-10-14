import sys, tempfile, base64
from playwright.sync_api import sync_playwright
sp = sys.argv[1]
NEW = f"file://{sp}/_seeded.html#servants"
errs = []
def check(label, ok): print(("PASS " if ok else "FAIL ") + label)
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
COUNT = """() => new Promise((res) => { const r = indexedDB.open('spirit-origin-list-images', 1); r.onsuccess = () => { const t = r.result.transaction('img', 'readonly').objectStore('img').count(); t.onsuccess = () => res(t.result); t.onerror = () => res(-1); }; r.onerror = () => res(-1); })"""
red = base64.b64encode(open(f"{sp}/ph_red.png", "rb").read()).decode()
FAKE = """async ([kind, sel, b64]) => {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const dt = new DataTransfer(); dt.items.add(new File([u], 'x.png', {type: 'image/png'}));
  const el = document.querySelector(sel);
  if (kind === 'paste') el.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
  else { el.dispatchEvent(new DragEvent('dragover', {dataTransfer: dt, bubbles: true, cancelable: true})); el.dispatchEvent(new DragEvent('drop', {dataTransfer: dt, bubbles: true, cancelable: true})); }
}"""
with sync_playwright() as p:
    prof = tempfile.mkdtemp()
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 1000})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.goto(NEW); pg.wait_for_timeout(900)
    n0 = pg.evaluate(COUNT)
    pg.click('[data-action="add-wish"]'); pg.wait_for_timeout(400)
    check("form has 5 stage picture boxes", pg.locator("#fs-art .fa-tile").count() == 5)
    pg.fill("#sv-name", "Morgan"); pg.select_option("#sv-cls", "Berserker")
    pg.set_input_files('input[data-form-art="1"]', f"{sp}/ph_purple.png"); pg.wait_for_timeout(700)
    pg.set_input_files('input[data-form-art="c"]', f"{sp}/ph_blue.png"); pg.wait_for_timeout(700)
    pg.click('#fs-art .fa-tile[data-slot="2"] .fa-t'); pg.wait_for_timeout(100)
    pg.evaluate(FAKE, ["paste", "#fs-art .fa-tile[data-slot='2']", red]); pg.wait_for_timeout(800)
    pg.evaluate(FAKE, ["drop", "#fs-art .fa-tile[data-slot='3']", red]); pg.wait_for_timeout(800)
    check(f"choose, paste and drop fill the boxes ({pg.locator('#fs-art img.fa-pic').count()})", pg.locator("#fs-art img.fa-pic").count() == 4)
    pg.locator("#fs-art").screenshot(path=f"{sp}/v71-form-art.png")
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(800)
    st = pg.evaluate(LS + ".servants.find(s=>s.id==='morgan')")
    check(f"wishlist servant saved with art {sorted((st.get('art') or {}).keys())}, stage {st.get('artStage')}", sorted(st["art"].keys()) == ["1", "2", "3", "c"] and st.get("wish") is True and st.get("artStage") == "1")
    check("wishlist row shows the stage picture", pg.locator('.wish-pick[data-id="morgan"] img.avatar[data-art]').count() == 1)
    check("dossier shows the picture", pg.locator('#dossier .art-frame img[data-art]').count() == 1)
    n1 = pg.evaluate(COUNT); check(f"4 images stored ({n0} -> {n1})", n1 - n0 == 4)
    pg.screenshot(path=f"{sp}/v71-wish-dossier.png")
    # edit: remove stage 2, keep the rest
    pg.click('[data-action="edit"]'); pg.wait_for_timeout(400)
    check("edit form shows existing pictures", pg.locator("#fs-art img.fa-pic").count() == 4)
    pg.click('[data-action="fa-clear"][data-slot="2"]'); pg.wait_for_timeout(200)
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(900)
    st = pg.evaluate(LS + ".servants.find(s=>s.id==='morgan')")
    n2 = pg.evaluate(COUNT)
    check(f"removed picture is gone from the servant and storage {sorted(st['art'].keys())} ({n1} -> {n2})", sorted(st["art"].keys()) == ["1", "3", "c"] and n2 == n1 - 1)
    # cancel throws away pictures that were never saved
    pg.click('[data-action="edit"]'); pg.wait_for_timeout(400)
    pg.set_input_files('input[data-form-art="4"]', f"{sp}/ph_red.png"); pg.wait_for_timeout(700)
    n3 = pg.evaluate(COUNT)
    pg.click('[data-action="cancel-edit"]'); pg.wait_for_timeout(700)
    n4 = pg.evaluate(COUNT)
    check(f"cancel discards the unsaved picture ({n3} -> {n4})", n3 == n2 + 1 and n4 == n2 and "4" not in pg.evaluate(LS + ".servants.find(s=>s.id==='morgan')")["art"])
    # owned servants get the same boxes
    pg.click('[data-id="artoria"]'); pg.wait_for_timeout(300); pg.click('[data-action="edit"]'); pg.wait_for_timeout(300)
    check("owned servants' form has the boxes too", pg.locator("#fs-art .fa-tile").count() == 5)
    pg.click('[data-action="cancel-edit"]'); pg.wait_for_timeout(300)
    # summon shows the art on the card
    pg.click("#tab-summon"); pg.wait_for_timeout(600); pg.click('.smg [data-action="summon"][data-id="morgan"]'); pg.wait_for_timeout(300); pg.keyboard.press("Escape"); pg.wait_for_timeout(1500)
    check("summon card shows the stage picture", pg.locator(".s2-front img.s2-art:not(.mark)").count() == 1)
    pg.screenshot(path=f"{sp}/v71-summon.png")
    pg.click(".sm-done"); pg.wait_for_timeout(800)
    st = pg.evaluate(LS + ".servants.find(s=>s.id==='morgan')")
    check("summoned with pictures kept", "wish" not in st and sorted(st["art"].keys()) == ["1", "3", "c"])
    pg.reload(); pg.wait_for_timeout(1000); pg.click('[data-id="morgan"]'); pg.wait_for_timeout(500)
    check("pictures still there after reload", pg.locator('#dossier .art-frame img[data-art]:not(.broken)').count() == 1)
    ctx.close()
    for w in (360, 400):
        ctx = p.chromium.launch_persistent_context(prof, viewport={"width": w, "height": 820})
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        pg.goto(NEW); pg.wait_for_timeout(800)
        pg.click('[data-action="add-wish"]'); pg.wait_for_timeout(400)
        pg.set_input_files('input[data-form-art="1"]', f"{sp}/ph_purple.png"); pg.wait_for_timeout(700)
        pg.locator("#fs-art").scroll_into_view_if_needed(); pg.wait_for_timeout(200)
        sw = pg.evaluate("[document.documentElement.scrollWidth, document.getElementById('dossier').scrollWidth, document.getElementById('dossier').clientWidth]")
        check(f"phone {w}: no sideways scroll {sw}", sw[0] <= w and sw[1] <= sw[2])
        pg.screenshot(path=f"{sp}/v71-phone{w}.png")
        pg.click('[data-action="cancel-edit"]'); pg.wait_for_timeout(300)
        ctx.close()
print("page errors:", errs)
