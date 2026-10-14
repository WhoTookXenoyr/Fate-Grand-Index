import sys
sp = sys.argv[1]
src = open(f"{sp}/base_v11.html").read()
rd = lambda n: open(f"{sp}/{n}").read()
def rep(old, new, count=1):
    global src
    c = src.count(old)
    if c != count: raise SystemExit(f"expected {count} got {c}: {old[:120]!r}")
    src = src.replace(old, new)
rep("</style>", rd("css_v11.css") + rd("css_v11b.css").replace("__ICON_SPRITE__", rd("up9/icons_sprite.b64").strip()) + "</style>")
# icons on every effect line: skills, passives, the NP table and the NP in Versus
rep('''${info.effect ? `<div class="effect">${linesHTML(info.effect)}</div>` : ""}''', '''${info.effect ? `<div class="effect">${iconLinesHTML(s, info.effect)}</div>` : ""}''')
rep('''${x.effect ? `<div class="effect">${linesHTML(x.effect)}</div>` : ""}''', '''${x.effect ? `<div class="effect">${iconLinesHTML(s, x.effect)}</div>` : ""}''')
rep('''(text ? (multi ? linesHTML(text) : esc(text)) : `<span class="npt-empty">—</span>`)''', '''(text ? (multi ? iconLinesHTML(s, text) : esc(text)) : `<span class="npt-empty">—</span>`)''')
rep('''${V.effect ? `<div class="effect vs-eff">${linesHTML(V.effect)}</div>` : ""}''', '''${V.effect ? `<div class="effect vs-eff">${iconLinesHTML(s, V.effect, true)}</div>` : ""}''')
# motion: the emblem glint as its own layer, faster particle catch-up when frames are spaced out
rep('''<i class="emb-fill"></i>''', '''<i class="emb-fill"><b class="emb-glint"></b></i>''')
rep('''const dt = Math.min(0.05, F.last ? Math.max(0, now - F.last) / 1000 : 0.016);''', '''const dt = Math.min(0.1, F.last ? Math.max(0, now - F.last) / 1000 : 0.016);''')
rep('''${lv === 10 ? skMotes : ""}''', '''${tier === "ex" ? `<i class="sk-ring" aria-hidden="true"><b></b></i>` : ""}${lv === 10 ? skMotes : ""}''')
# frame-rate switch next to the light/dark switch
rep('''      <button id="theme-tgl" class="theme-tgl"''', '''      <button id="fps-btn" class="fps-btn" type="button" data-action="fps" data-fps="60" aria-label="Animations at 60 frames a second. Press to change"><i aria-hidden="true"><s></s><s></s><s></s></i><b>60 fps</b></button>
      <button id="theme-tgl" class="theme-tgl"''')
# the Summoning tab and page
rep('''    <button class="tab" role="tab" id="tab-parties"''', '''    <button class="tab" role="tab" id="tab-summon" data-action="tab" data-tab="summon" aria-selected="false">Summoning</button>
    <button class="tab" role="tab" id="tab-parties"''')
rep('''  <section id="view-parties" class="d-sec"''', '''  <section id="view-summon" aria-labelledby="tab-summon" hidden><div id="summoning" class="smp"></div></section>

  <section id="view-parties" class="d-sec"''')
# Summon buttons move to the Summoning page
rep('''
      ${S.readOnly ? "" : `<button class="btn sm summon-btn" data-action="summon" data-id="${esc(s.id)}" aria-label="Summon ${esc(s.name)}">Summon</button>`}
    </div>`).join("")''', '''
    </div>`).join("")''')
rep('''const head = `<div class="wish-head"><h2>Guests <small>${all.length}</small></h2>${S.readOnly ? "" : `<button class="btn sm" data-action="add-wish">+ Add guest</button>`}</div>`;''',
    '''const head = `<div class="wish-head"><h2>Guests <small>${all.length}</small></h2><span class="wish-tools">${all.length ? `<button class="btn ghost sm" data-action="tab" data-tab="summon">Summoning</button>` : ""}${S.readOnly ? "" : `<button class="btn sm" data-action="add-wish">+ Add guest</button>`}</span></div>`;''')
rep('''then press Summon when one joins you.</p>''', '''then summon them on the Summoning page when one joins you.</p>''')
rep('''<p><b>Guest.</b> Not summoned yet. Add their stage pictures under Ascension art, and press Summon when they join you.</p>${S.readOnly ? "" : `<button class="btn sm summon-btn" data-action="summon" data-id="${esc(s.id)}">Summon</button>`}''',
    '''<p><b>Guest.</b> Not summoned yet. Add their stage pictures under Ascension art, and summon them on the Summoning page when they join you.</p>${S.readOnly ? "" : `<button class="btn sm summon-btn" data-action="to-summon" data-id="${esc(s.id)}">Go to Summoning</button>`}''')
rep('''<button type="button" class="btn" data-action="home-guests">Summon a Guest</button>''', '''<button type="button" class="btn" data-action="tab" data-tab="summon">Summoning</button>''')
mods = "".join(rd(n) for n in sys.argv[2:]) if len(sys.argv) > 2 else rd("v11_motion.js")
mods = mods.replace("__ICON_LIST__", rd("up9/icons_list.js").strip())
rep("\ninitFonts();\ninit();\n", "\n" + mods + "\n\ninitFonts();\ninit();\n")
open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched v11", len(src))
