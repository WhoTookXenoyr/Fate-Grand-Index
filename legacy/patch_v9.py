import sys
sp = sys.argv[1]
src = open(f"{sp}/base_v9.html").read()
rd = lambda n: open(f"{sp}/{n}").read()

def rep(old, new, count=1):
    global src
    c = src.count(old)
    if c != count:
        raise SystemExit(f"expected {count} got {c}: {old[:120]!r}")
    src = src.replace(old, new)

# ---- styles, and the saved theme applied before anything paints
rep("</style>", rd("css_v9.css") + "</style>")
rep("<style>", '<script>try{var t=localStorage.getItem("spirit-origin-list:v1:theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>\n<style>')

# ---- light/dark switch in the top right
rep('''<input id="f-import" type="file" accept=".json,.csv,application/json,text/csv" hidden></label>
    </div>''', '''<input id="f-import" type="file" accept=".json,.csv,application/json,text/csv" hidden></label>
      <button id="theme-tgl" class="theme-tgl" type="button" data-action="theme" aria-pressed="false" aria-label="Switch to dark mode" title="Switch to dark mode"><span class="tt-track" aria-hidden="true"><i class="tt-star s1"></i><i class="tt-star s2"></i><i class="tt-star s3"></i><i class="tt-cloud"></i></span><span class="tt-knob" aria-hidden="true"><i class="tt-crater c1"></i><i class="tt-crater c2"></i></span></button>
    </div>''')

# ---- the Guests tab goes; the wishlist becomes Guests
rep('''    <button class="tab" role="tab" id="tab-guests" data-action="tab" data-tab="guests" aria-selected="false">Guests</button>\n''', "")
rep('''const TABS = ["servants","parties","guests","ranking","versus"];''', '''const TABS = ["servants","parties","ranking","versus"];''')
rep('''<optgroup label="Want to summon">''', '''<optgroup label="Guests">''')
rep('''<span class="tag">Wishlist</span>''', '''<span class="tag">Guest</span>''', 4)
rep('''${s.wish ? " · wishlist" : ""}''', '''${s.wish ? " · guest" : ""}''')
rep(''' or wishlist" : ""} applies Burn, Curse or Poison to enemies yet. Add servants who do (the wishlist counts)''', ''' or Guests" : ""} applies Burn, Curse or Poison to enemies yet. Add servants who do (Guests count)''')
rep(''' or wishlist" : ""} yet. Add some (the wishlist works)''', ''' or Guests" : ""} yet. Add some (Guests count too)''')
rep('''> Include wishlist</label>''', '''> Include Guests</label>''')
rep('''<h4 class="tr-h">From your wishlist</h4>''', '''<h4 class="tr-h">From your Guests</h4>''')
rep('''" (new, wishlist)"''', '''" (new, Guest)"''')
rep('''<b>${nw}</b> on your wishlist</span>''', '''<b>${nw}</b> in Guests</span>''')
rep('''<h2>Want to summon <small>''', '''<h2>Guests <small>''')
rep('''+ Add to wishlist</button>''', '''+ Add guest</button>''')
rep('''aria-label="Want to summon"''', '''aria-label="Guests"''', 2)
rep('''Servants you're hoping to summon go here. Fill them in like any servant, stage pictures included, then press Summon when they join you.''',
    '''The supports you borrow from friends, and the servants you hope to summon. Fill them in like any servant, stage pictures included, then press Summon when one joins you.''')
rep('''No wishlist servants match these filters.''', '''No Guests match these filters.''')
rep('''Your wishlist is below.''', '''Your Guests are below.''')
rep('''<b>On your wishlist.</b> Not summoned yet. Add their stage pictures under Ascension art.''', '''<b>Guest.</b> Not summoned yet. Add their stage pictures under Ascension art, and press Summon when they join you.''')
rep('''(s.wish ? "Wishlist" : "New servant")''', '''(s.wish ? "Guest" : "New servant")''')
rep('''"Add to your wishlist"''', '''"Add a guest"''')
rep('''Not summoned yet (keep on my wishlist)''', '''Not summoned yet (keep in Guests)''')
rep('''"Add to wishlist"''', '''"Add to Guests"''', 2)
rep('''" added to your wishlist."''', '''" added to Guests."''')
rep('''      ${fld("pt-guest", "Guest support", sel("pt-guest", gnames, p.guest, "None"))}''', '''      ${fld("pt-guest", "Guest support", guestSelectHTML(p))}''')
rep('''    if (col === "servants") fixLawOrder();''', '''    if (col === "servants") fixLawOrder();
    if (col === "servants" || col === "guests") moveGuests();''')

# ---- page theme only while a servant is picked; deselect on desktop
rep('''renderChrome(); renderVersus(); renderDna(); window.scrollTo({top: 0}); return; }''', '''renderChrome(); renderVersus(); renderDna(); syncPageTheme(); window.scrollTo({top: 0}); return; }''')
rep('''    S.selected = b.dataset.id; renderList(); renderDossier();''', '''    S.selected = b.dataset.id; S.lastSel = S.selected; renderList(); renderDossier();''')
rep('''  if (a === "close") { if (S.editing) dropFormArt(); S.selected = null; S.editing = null; renderList(); renderDossier(); return; }''',
    '''  if (a === "close") { if (S.editing) dropFormArt(); S.selected = null; S.editing = null; renderList(); renderDossier(); return; }
  if (a === "theme") { toggleTheme(b); return; }
  if (a === "goal-clear") { const s = S.servants.find((x) => x.id === shownId()); if (s && !S.readOnly) { delete s.goal; scheduleWrite("servants", s); renderDossier(); } return; }''')
rep('''  if (e.key === "Escape" && S.selected && !isWide() && !S.editing) {''', '''  if (e.key === "Escape" && S.selected && !S.editing && !document.querySelector("dialog[open]")) {''')

# ---- stats: Fou tiers, Fou up to 3,000, the goal from Guests
rep('''`<span class="v">${fmt(v)}</span><span class="sub">base ${fmt(base)} + Fou ''', '''`<span class="v${fouTier(fou)}"${fouTier(fou) ? ` title="${FOU_NAME[fouTier(fou)]}"` : ""}>${fmt(v)}</span><span class="sub">base ${fmt(base)} + Fou ''')
rep('''type="number" min="0" max="2000" step="10" value="${num(fou) || 0}"''', '''type="number" min="0" max="3000" step="10" value="${num(fou) || 0}"''')
rep('''inp("sv-fouhp", s.fouHp, "number", 'min="0" max="2000"')''', '''inp("sv-fouhp", s.fouHp, "number", 'min="0" max="3000"')''')
rep('''inp("sv-fouatk", s.fouAtk, "number", 'min="0" max="2000"')''', '''inp("sv-fouatk", s.fouAtk, "number", 'min="0" max="3000"')''')
rep('''clamp(Math.round(num(t.value) || 0), 0, 2000);''', '''clamp(Math.round(num(t.value) || 0), 0, 3000);''')
rep('''const v = plInt(raw[k], 0, 2000);''', '''const v = plInt(raw[k], 0, 3000);''')
rep('''<div class="stat-grid">${statBox("hp", "HP", hp, num(s.hp), s.fouHp)}${statBox("atk", "ATK", atk, num(s.atk), s.fouAtk)}</div>''',
    '''<div class="stat-grid">${statBox("hp", "HP", hp, num(s.hp), s.fouHp)}${statBox("atk", "ATK", atk, num(s.atk), s.fouAtk)}</div>${goalHTML(s)}''')

# ---- skills: colour by level, Lv 10 celebration
rep('''  return `<article class="skill${tier ? " tier-" + tier : ""}">
    <header><span class="slot">Skill ${i + 1}</span><h4>${rankNameHTML(nr)}</h4><span class="lvl">${typeof lv === "number" ? "Lv " + lv : "Locked"}</span></header>''',
    '''  const party = celebrating(s, i);
  return `<article class="skill${tier ? " tier-" + tier : ""}${lv === 10 ? " sk-max" : ""}${party ? " sk-celebrate" : ""}" style="--sk-p:${typeof lv === "number" ? lv / 10 : 0}">
    ${lv === 10 ? skMotes : ""}${party ? skBurstHTML() : ""}
    <header><span class="slot">Skill ${i + 1}</span><h4>${rankNameHTML(nr)}</h4>${lv === 10 ? `<span class="lvl lv-max"><i class="lv-rays" aria-hidden="true"></i>Lv 10</span>` : `<span class="lvl">${typeof lv === "number" ? "Lv " + lv : "Locked"}</span>`}</header>''')
rep('''    s.skills[i] = v;
  }''', '''    if (v === 10 && s.skills[i] !== 10) S.skCeleb = {id: s.id, i: i, until: Date.now() + 2000};
    s.skills[i] = v;
  }''')
rep('''typeof v === "number" && v === 10 ? `<span class="status grail">Maxed</span>`''', '''typeof v === "number" && v === 10 ? `<span class="status grail${celebrating(s, i) ? " pop" : ""}">Maxed</span>`''')
rep('''return typeof v === "number" ? `<span class="pip${v === 10 ? " max" : ""}">${v}</span>`''', '''return typeof v === "number" ? `<span class="pip${v === 10 ? " max" : ""}${skTierOf(s, i) ? " t-" + skTierOf(s, i) : ""}" style="--sk-p:${v / 10}">${v}</span>`''')

# ---- grails
rep('''  return `<button class="row${sel === s.id ? " is-sel" : ""}${S.justSummoned === s.id ? " fresh" : ""}" data-action="select" data-id="${esc(s.id)}" aria-pressed="${sel === s.id}">
      ${iconHTML(s, "")}''', '''  return `<button class="row${sel === s.id ? " is-sel" : ""}${S.justSummoned === s.id ? " fresh" : ""}${grTier(s)}" data-action="select" data-id="${esc(s.id)}" aria-pressed="${sel === s.id}">
      ${grTier(s) ? grFX : ""}${iconHTML(s, "")}''')
rep('''<div class="scene${st && st.kind === "grail" ? " grailed" : ""}${EXTRA_ACC[s.cls] ? " extra" : ""}"''', '''<div class="scene${st && st.kind === "grail" ? " grailed" : ""}${EXTRA_ACC[s.cls] ? " extra" : ""}${grTier(s)}"''')
rep('''<canvas class="scene-fx" id="scene-fx" aria-hidden="true"></canvas>''', '''<canvas class="scene-fx" id="scene-fx" aria-hidden="true"></canvas>${grTier(s) ? grFX : ""}''')

# ---- command cards
rep('''face = img ? `<img class="cmd-img" src="${CARD_IMG[c]}" alt="">` : `<span class="cmd-face">${c ? esc(c) : "?"}</span>`;''',
    '''face = (img ? `<img class="cmd-img" src="${CARD_IMG[c]}" alt="">` : `<span class="cmd-face">${c ? esc(c) : "?"}</span>`) + (c ? `<i class="cmd-glare" aria-hidden="true"></i>` : "");''')

# ---- Noble Phantasm atmosphere
rep('''<div class="npt-box ${cc}">''', '''<div class="npt-box ${cc}"${CARDS.includes(card) ? ` data-atmo="${card.toLowerCase()}"` : ""}>''')
rep('''<div class="npt-title"><b>${cell("f:name"''', '''<div class="npt-title">${npAtmoHTML(card)}<b>${cell("f:name"''')

# ---- the v9 module, last, so everything it wraps already exists
js = rd("v9.js").replace("__CARD_BACK__", rd("up9/cardback.b64").strip())
rep("\ninitFonts();\ninit();\n", "\n" + js + "\ncardMasks(); syncThemeBtn();\n\ninitFonts();\ninit();\n")

open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched v9", len(src))
