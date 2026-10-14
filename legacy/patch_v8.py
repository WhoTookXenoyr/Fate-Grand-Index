import sys
sp = sys.argv[1]
src = open(f"{sp}/spirit-origin-list.v71.html").read()

def rep(old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        raise SystemExit(f"expected {count} match(es), found {n}: {old[:120]!r}")
    src = src.replace(old, new)

def cut_between(start, end, new):
    global src
    if src.count(start) != 1:
        raise SystemExit(f"start not unique: {start[:80]!r}")
    i = src.index(start); j = src.index(end, i)
    src = src[:i] + new + src[j:]

rd = lambda f: open(f"{sp}/{f}").read()

# ---------------- CSS
rep("</style>", rd("css_v8.css") + "</style>")

# ---------------- HTML
rep('''      <button id="btn-export" class="btn ghost" data-action="export" hidden>Export backup</button>
      <label id="lbl-import" class="btn ghost" hidden>Import backup<input id="f-import" type="file" accept=".json,application/json" hidden></label>''',
    '''      <div class="menu-wrap" id="export-wrap" hidden><button id="btn-export" class="btn ghost" data-action="export-menu" aria-expanded="false" aria-controls="export-menu">Export ▾</button>
        <div id="export-menu" class="pop-menu" role="menu" hidden>
          <button type="button" role="menuitem" data-action="export">Full backup (.json)<small>Everything on this page, images included</small></button>
          <button type="button" role="menuitem" data-action="export-csv">Spreadsheet (.csv)<small>Opens in Excel or Google Sheets</small></button>
          <button type="button" role="menuitem" data-action="export-planner">Planner list (.json)<small>A plain servant list other tools can read</small></button>
        </div></div>
      <label id="lbl-import" class="btn ghost" hidden title="A backup from this page, a spreadsheet (.csv) or a planner's .json export">Import<input id="f-import" type="file" accept=".json,.csv,application/json,text/csv" hidden></label>''')
rep('''      <select id="f-class" aria-label="Filter by class"><option value="">All classes</option></select>''',
    '''      <select id="f-class" aria-label="Filter by class"><option value="">All classes</option></select>
      <select id="f-trait" aria-label="Filter by trait, attribute or alignment"><option value="">All traits</option></select>''')
cut_between('''  <section id="view-ranking"''', '''  <section id="view-guests"''', '''  <section id="view-ranking" class="d-sec" aria-labelledby="tab-ranking" hidden>
    <div class="toolbar">
      <p class="rank-note grow">Score out of 100: stats with Fou and class ATK bonus (35) + skills (30) + NP level (15) + level (10) + rarity (10). Skills count like the game: reaching Lv 6 and Lv 10 is worth more because those steps also shorten the cooldown, and Lv 10 gives the full value. Reaching max level and Lv 100 add a bump. Arrows show moves since you last pressed Mark as seen.</p>
      <div class="rank-tools"><div class="seg" role="group" aria-label="Ranking view"><button data-action="rank-view" data-v="list" aria-pressed="true">List</button><button data-action="rank-view" data-v="tiers" aria-pressed="false">Tier board</button></div><button class="btn sm" data-action="rank-seen">Mark as seen</button></div>
    </div>
    <div id="roi-top" class="roi-top" aria-label="Best upgrades right now"></div>
    <ol id="ranking" class="rank-list" aria-label="Servant ranking"></ol>
    <div id="tierboard" class="tierboard" aria-label="Tier board" hidden></div>
  </section>

''')
rep('''    <div id="parties" class="party-grid"></div>''', '''    <div id="dna"></div>
    <div id="parties" class="party-grid"></div>''')
rep('''<div id="toast" role="status" aria-live="polite"></div>''', '''<div id="tier-menu" class="tier-menu" role="menu" aria-label="Move to tier" hidden></div>
<div id="toast" role="status" aria-live="polite"></div>''')

# ---------------- JS: state and modules
rep('''formArt: null, formArtNew: [], formArtSlot: null, formArtBusy: null''', '''formArt: null, formArtNew: [], formArtSlot: null, formArtBusy: null, trait: "", dnaMode: "stall", dnaWish: true''')
rk = rd("rank_v8.js"); k = rk.index("/* ---------- upgrade value")
cut_between("function scoreOf(s) {", "function rankRows() {", rk[:k])
cut_between("function renderRanking() {", "/* ---------- Noble Phantasm table", rk[k:])
rep("/* ---------- rendering ---------- */", rd("data_v8.js") + rd("traits_v8.js") + rd("autobuff_v81.js") + rd("io_v8.js") + rd("dna_v8.js") + rd("support_v81.js") + "/* ---------- rendering ---------- */")
rep('''  renderRanking();
  renderVersus();
}''', '''  renderRanking();
  renderVersus();
  renderDna();
  fillTraitFilter();
}''')
rep('''  $("#btn-export").hidden = !(ok && S.downloads && S.loaded.servants);''', '''  $("#export-wrap").hidden = !(ok && S.downloads && S.loaded.servants);''')
rep('''  if (S.importData) {
    const d = S.importData;
    n.hidden = false;
    n.innerHTML = `<p>Import''', '''  if (S.importData && S.importData.kind === "planner") {
    const d = S.importData, all = d.updates.map((u) => u.name + " (update)").concat(d.adds.map((a) => a.name + (a.wish ? " (new, wishlist)" : " (new)")));
    n.hidden = false;
    n.innerHTML = `<p>Import ${all.length} servant${all.length === 1 ? "" : "s"} from ${esc(d.source)}? ${d.updates.length} already in your roster get the values the file has (level, NP, skills and so on); ${d.adds.length} are added as new.${d.skipped ? " " + d.skipped + " rows without a name are skipped." : ""} Servants are matched by name.</p>
      <button class="btn primary sm" data-action="import-go">Import</button><button class="btn ghost sm" data-action="import-cancel">Cancel</button>
      <details><summary>See the list</summary><ul>${all.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`;
  } else if (S.importData) {
    const d = S.importData;
    n.hidden = false;
    n.innerHTML = `<p>Import''')
rep('''  const q = S.q.trim().toLowerCase();
  if (q) arr = arr.filter((s) => [s.name, s.npName, s.role, s.cls, s.notes, s.party, s.mates, passivesOf(s).map((x) => x.name).join(" ")].some((v) => String(v || "").toLowerCase().includes(q)));''',
    '''  const q = S.q.trim().toLowerCase();
  if (q) arr = arr.filter((s) => [s.name, s.npName, s.role, s.cls, s.notes, s.party, s.mates, passivesOf(s).map((x) => x.name).join(" "), tagsOf(s).map(tagShort).join(" ")].some((v) => String(v || "").toLowerCase().includes(q)));
  if (S.trait) arr = arr.filter((s) => tagsOf(s).includes(S.trait));''')
rep('''  el.innerHTML = html + wishListHTML(sel);''', '''  el.innerHTML = traitBannerHTML() + html + wishListHTML(sel);''')
rep('''      <div class="stat-grid">${statBox("hp", "HP", hp, num(s.hp), s.fouHp)}${statBox("atk", "ATK", atk, num(s.atk), s.fouAtk)}</div>
    </section>''', '''      <div class="stat-grid">${statBox("hp", "HP", hp, num(s.hp), s.fouHp)}${statBox("atk", "ATK", atk, num(s.atk), s.fouAtk)}</div>
    </section>

    ${traitsSectionHTML(s)}

    ${bestSupportsHTML(s)}''')
rep('''    ${formArtHTML(s)}''', '''    ${formArtHTML(s)}
    ${traitsFieldHTML(s)}''')
rep('''  const wb = document.getElementById("sv-wish"); if (wb && wb.checked) o.wish = true; else delete o.wish;''', '''  const wb = document.getElementById("sv-wish"); if (wb && wb.checked) o.wish = true; else delete o.wish;
  const tf = readTraitsForm(); if (tf) { o.attr = tf.attr || null; o.lawOrder = tf.order; o.moral = tf.moral; o.traits = tf.traits; o.buffs = tf.buffs; o.traitsSet = true; delete o.gender; }''')
rep('''      <section class="vs-panel"><h3 class="vs-h">Class matchup</h3>${vsVerdict(picks)}<div class="vs-scroll">${vsMatchHTML(picks)}</div></section>''',
    '''      <section class="vs-panel"><h3 class="vs-h">Class matchup</h3>${vsVerdict(picks)}<div class="vs-scroll">${vsMatchHTML(picks)}</div></section>
      <section class="vs-panel"><h3 class="vs-h">Trait overlap</h3>${vsTraitsHTML(picks)}</section>''')

# ---------------- interactions
rep('''document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;''', '''document.addEventListener("click", async (e) => {
  const tmn = document.getElementById("tier-menu"); if (tmn && !tmn.hidden && !e.target.closest("#tier-menu") && !e.target.closest(".tier-card")) closeTierMenu();
  const emn = document.getElementById("export-menu"); if (emn && !emn.hidden && !e.target.closest("#export-wrap")) { emn.hidden = true; $("#btn-export").setAttribute("aria-expanded", "false"); }
  const b = e.target.closest("[data-action]");
  if (!b) return;''')
rep('''if (a === "tab") { S.tab = b.dataset.tab; if (S.tab !== "servants" && S.selected && !isWide()) { S.selected = null; renderList(); renderDossier(); } renderChrome(); renderVersus(); window.scrollTo({top: 0}); return; }''',
    '''if (a === "tab") { S.tab = b.dataset.tab; if (S.tab !== "servants" && S.selected && !isWide()) { S.selected = null; renderList(); renderDossier(); } renderChrome(); renderVersus(); renderDna(); window.scrollTo({top: 0}); return; }''')
rep('''  if (a === "goto") { if (S.editing) dropFormArt();''', '''  if (a === "goto") { closeTierMenu(); if (S.editing) dropFormArt();''')
rep('''    S.q = ""; S.cls = ""; S.card = ""; $("#q").value = ""; $("#f-class").value = "";''', '''    S.q = ""; S.cls = ""; S.card = ""; $("#q").value = ""; $("#f-class").value = ""; setTraitFilter("");''')
rep('''  if (a === "fa-pick") {''', '''  if (a === "trait-filter") {
    const tag = b.dataset.tag; if (!tag) return;
    setTraitFilter(tag); S.tab = "servants"; if (S.selected && !isWide()) S.selected = null;
    renderChrome(); renderList(); if (!S.editing) renderDossier();
    const n = S.servants.filter((x) => tagsOf(x).includes(tag)).length;
    toast("Showing the " + n + " servant" + (n === 1 ? "" : "s") + " with " + tagLabel(tag) + "."); return;
  }
  if (a === "trait-clear") { setTraitFilter(""); renderList(); if (!S.editing) renderDossier(); return; }
  if (a === "edit-traits") { const s = curServant(); if (!s || S.readOnly) return; openServantEditor(s.id); const fs = document.getElementById("fs-traits"); if (fs) { fs.scrollIntoView({block: "start"}); const f = fs.querySelector("select, button"); if (f) f.focus({preventScroll: true}); } return; }
  if (a === "tr-toggle") { const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); b.classList.toggle("on", on); refreshTraitLive(); return; }
  if (a === "tr-add") { addTraitFromInput(); return; }
  if (a === "tr-buff-add") { const box = document.getElementById("tr-buffs"); if (!box) return; box.insertAdjacentHTML("beforeend", buffRowHTML({tag: "", what: ""}, readTraitsForm())); const f = box.lastElementChild.querySelector("select"); if (f) f.focus(); return; }
  if (a === "tr-buff-del") { const r = b.closest(".tr-buff"); if (r) r.remove(); refreshTraitLive(); return; }
  if (a === "rank-view") { setRankView(b.dataset.v === "tiers" ? "tiers" : "list"); closeTierMenu(); renderRanking(); return; }
  if (a === "tier-card") { if (tierJustDragged) return; const m = document.getElementById("tier-menu"); if (m && !m.hidden && m.dataset.for === b.dataset.id) { closeTierMenu(); return; } openTierMenu(b); return; }
  if (a === "tier-set") {
    const id = b.dataset.id, k = b.dataset.k || "", s = S.servants.find((x) => x.id === id), r = rankRows().find((x) => x.s.id === id); if (!s || !r) return;
    setTier(id, k); closeTierMenu(); renderRanking();
    const c = document.querySelector('.tier-card[data-id="' + id + '"]'); if (c) c.focus({preventScroll: true});
    toast(k ? s.name + " moved to " + k + "." : s.name + " is back in " + autoTier(r.sc.total) + ", where the score puts them."); return;
  }
  if (a === "export-menu") { const m = $("#export-menu"), open = m.hidden; m.hidden = !open; b.setAttribute("aria-expanded", String(open)); if (open) { const f = m.querySelector("button"); if (f) f.focus(); } return; }
  if (a === "export-csv" || a === "export-planner") { $("#export-menu").hidden = true; $("#btn-export").setAttribute("aria-expanded", "false"); exportFile(a === "export-csv" ? "csv" : "planner"); return; }
  if (a === "dna-mode") { S.dnaMode = b.dataset.v; renderDna(); const nb = document.querySelector('[data-action="dna-mode"][data-v="' + S.dnaMode + '"]'); if (nb) nb.focus(); return; }
  if (a === "dna-save") {
    if (S.readOnly) return;
    const team = (b.dataset.ids || "").split(",").map((id) => S.servants.find((x) => x.id === id)).filter(Boolean); if (!team.length) return;
    const o = {name: (b.dataset.name || "Party DNA team").slice(0, 90), bestFor: b.dataset.why || null, front: [0, 1, 2].map((i) => team[i] ? team[i].name : ""), back: ["", "", ""], ce: [], guest: null, guestCe: null, strategy: null};
    o.id = slug(o.name, S.parties); o.order = nextOrder(S.parties);
    if (await writeDoc("parties", o)) { if (!S.parties.some((x) => x.id === o.id)) S.parties.push(o); renderParties(); toast("Saved as a party. It's in the list below."); }
    return;
  }
  if (a === "fa-pick") {''')
rep('''  if (a === "export") { exportBackup(); return; }''', '''  if (a === "export") { const em = $("#export-menu"); if (em) { em.hidden = true; $("#btn-export").setAttribute("aria-expanded", "false"); } exportBackup(); return; }''')
rep('''document.addEventListener("change", (e) => {
  const t = e.target;
''', '''document.addEventListener("change", (e) => {
  const t = e.target;
  if (t && t.id === "dna-wish") { S.dnaWish = t.checked; renderDna(); const c = document.getElementById("dna-wish"); if (c) c.focus(); return; }
  if (t && (t.id === "sv-attr" || (t.dataset && t.dataset.buffTag != null))) { refreshTraitLive(); return; }
''')
rep('''$("#f-class").addEventListener("change", (e) => { S.cls = e.target.value; renderList(); if (!S.editing) renderDossier(); });''',
    '''$("#f-class").addEventListener("change", (e) => { S.cls = e.target.value; renderList(); if (!S.editing) renderDossier(); });
$("#f-trait").addEventListener("change", (e) => { S.trait = e.target.value; renderList(); if (!S.editing) renderDossier(); });
window.addEventListener("scroll", () => closeTierMenu(), true);
function addTraitFromInput() {
  const inp = document.getElementById("sv-trait-new"), box = document.getElementById("tr-traits"); if (!inp || !box) return;
  const v = normTrait(inp.value).slice(0, 40); if (!v) { inp.focus(); return; }
  let chip = Array.from(box.querySelectorAll(".tr-chip")).find((c) => c.dataset.v.toLowerCase() === v.toLowerCase());
  if (!chip) { box.insertAdjacentHTML("beforeend", trChip("traits", v, true)); chip = box.lastElementChild; }
  chip.setAttribute("aria-pressed", "true"); chip.classList.add("on"); chip.scrollIntoView({block: "nearest"});
  inp.value = ""; inp.focus(); refreshTraitLive();
}''')
rep('''document.addEventListener("keydown", (e) => {
  const t = e.target;
''', '''document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (e.key === "Escape") {
    const tmn = document.getElementById("tier-menu"); if (tmn && !tmn.hidden) { e.preventDefault(); closeTierMenu(true); return; }
    const emn = document.getElementById("export-menu"); if (emn && !emn.hidden) { e.preventDefault(); emn.hidden = true; const eb = $("#btn-export"); eb.setAttribute("aria-expanded", "false"); eb.focus(); return; }
  }
  if (t && t.id === "sv-trait-new" && e.key === "Enter") { e.preventDefault(); addTraitFromInput(); return; }
  if (t && t.dataset && t.dataset.buffWhat != null && e.key === "Enter") { e.preventDefault(); t.blur(); return; }
''')

rep('''document.addEventListener("paste", (e) => {
  const pt = e.target;''', '''document.addEventListener("paste", (e) => {
  const pt = e.target;
  if (pt && pt.id === "tr-paste") {
    e.preventDefault();
    const html = (e.clipboardData && e.clipboardData.getData("text/html")) || "";
    let text = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
    if (!text && html) { try { text = new DOMParser().parseFromString(html, "text/html").body.textContent || ""; } catch (err) {} }
    pt.value = text.replace(/\s+/g, " ").trim().slice(0, 4000);
    applyWikiPaste(parseWikiPaste(text, html)); return;
  }''')
rep('''document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.dataset) return;''', '''let trPasteT = 0, trLiveT = 0;
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.id === "tr-paste") { clearTimeout(trPasteT); trPasteT = setTimeout(() => applyWikiPaste(parseWikiPaste(t.value, "")), 450); return; }
  if (/-s\d-effect$/.test(t.id || "") && document.getElementById("fs-traits")) { clearTimeout(trLiveT); trLiveT = setTimeout(refreshTraitLive, 450); }''')

rep('''    S.loaded[col] = true;
    if (col === "servants" && S.selected''', '''    S.loaded[col] = true;
    if (col === "servants") fixLawOrder();
    if (col === "servants" && S.selected''')

open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched", len(src))
