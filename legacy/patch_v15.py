import sys
sp = sys.argv[1]
src = open(f"{sp}/spirit-origin-list.html").read()
rd = lambda n: open(f"{sp}/{n}").read()
def rep(old, new, count=1):
    global src
    c = src.count(old)
    if c != count: raise SystemExit(f"expected {count} got {c}: {old[:120]!r}")
    src = src.replace(old, new)
rep("</style>", rd("css_v15.css") + "</style>")
# the title takes you Home
rep('''      <h1>Spirit Origin List</h1>''', '''      <h1><a class="home-link" href="#home" data-action="go-home" title="Go to Home">Spirit Origin List</a></h1>''')
# the guide and What's new, next to Fonts
rep('''      <button class="btn ghost" data-action="fonts">Fonts</button>''',
    '''      <button class="btn ghost" data-action="tour" title="A short guide to the page">Guide</button>
      <button class="btn ghost news-btn" data-action="news" title="Every update, newest first">What's new<i class="news-dot" aria-hidden="true" hidden></i></button>
      <button class="btn ghost" data-action="fonts">Fonts</button>''')
# start fresh sits with the rest of your data, under Export
rep('''          <button type="button" role="menuitem" data-action="export-planner">Planner list (.json)<small>A plain servant list other tools can read</small></button>''',
    '''          <button type="button" role="menuitem" data-action="export-planner">Planner list (.json)<small>A plain servant list other tools can read</small></button>
          <button type="button" role="menuitem" class="mi-danger" data-action="sf-open">Start fresh…<small>Empty this browser's list and begin your own</small></button>''')
# grailed: how many grails it took, next to the levels past the cap
rep('''<span class="row-lv">Lv ${esc(s.level ?? "—")}${st && st.kind === "grail" ? `<em>+${num(s.level) - CAPS[s.rarity]}</em>` : ""}''',
    '''<span class="row-lv${st && st.kind === "grail" ? " has-gr" : ""}">Lv ${esc(s.level ?? "—")}${st && st.kind === "grail" ? `<em>+${num(s.level) - CAPS[s.rarity]}<small> · ${plural(st.grails || 0, "grail")}</small></em>` : ""}''')
rep('''${grailed ? `, ${grailed} of them grailed` : ""}''', '''${grailed ? `, ${grailed} of them grailed (${plural(grailTotal(own), "grail")} in all)` : ""}''')
# an empty Chaldea points to Past Chaldea and the guide
rep('''    : "Your Chaldea is empty. Add the servants you own and they'll gather here.";''',
    '''    : "Your Chaldea is empty. Find the servants you own in Past Chaldea, summon them, and they'll gather here.";''')
rep('''        <button type="button" class="btn primary" data-action="tab" data-tab="servants">Open your roster</button>''',
    '''        ${own.length ? `<button type="button" class="btn primary" data-action="tab" data-tab="servants">Open your roster</button>` : `<button type="button" class="btn primary" data-action="tab" data-tab="past">Find them in Past Chaldea</button><button type="button" class="btn" data-action="tour">Guide</button>`}''')
rep("\ninitFonts();\ninit();\n", "\n" + rd("v15.js") + "\n\ninitFonts();\ninit();\n")
open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched v15", len(src))
