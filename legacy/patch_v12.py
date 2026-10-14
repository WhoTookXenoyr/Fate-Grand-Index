import sys
sp = sys.argv[1]
src = open(f"{sp}/base_v12.html").read()
rd = lambda n: open(f"{sp}/{n}").read()
def rep(old, new, count=1):
    global src
    c = src.count(old)
    if c != count: raise SystemExit(f"expected {count} got {c}: {old[:120]!r}")
    src = src.replace(old, new)
rep("</style>", rd("css_v12.css") + "</style>")
rep('''<button class="tab" role="tab" id="tab-versus" data-action="tab" data-tab="versus" aria-selected="false">Versus</button>''',
    '''<button class="tab" role="tab" id="tab-versus" data-action="tab" data-tab="versus" aria-selected="false">Versus</button>
    <button class="tab" role="tab" id="tab-past" data-action="tab" data-tab="past" aria-selected="false">Past Chaldea</button>''')
rep('''  <section id="view-versus" class="d-sec" aria-labelledby="tab-versus" hidden>
    <div id="versus" class="vs"></div>
  </section>''', '''  <section id="view-versus" class="d-sec" aria-labelledby="tab-versus" hidden>
    <div id="versus" class="vs"></div>
  </section>

  <section id="view-past" aria-labelledby="tab-past" hidden><div id="past" class="pc"></div></section>''')
# a value that stays the same at every level doesn't need "→ the same at Lv 10"
rep('''${v10 && lv !== 10 ? ` <span class="muted">→ ${v10} at Lv 10</span>` : ""}</dd>''', '''${v10 && lv !== 10 && v10 !== val ? ` <span class="muted">→ ${v10} at Lv 10</span>` : ""}</dd>''')
# stage art from Atlas Academy is on another site: ask for it with CORS so its colours can be read for the page palette
rep('''    img.onerror = () => resolve(null);
    img.src = src;''', '''    img.onerror = () => resolve(null);
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.src = src;''')
mods = rd("v12_past.js").replace("__ATLAS_DATA__", rd("atlas_data.js").strip()) + rd("v12_summon.js") + rd("v12_home.js") + rd("v13_fill.js")
rep("\ninitFonts();\ninit();\n", "\n" + mods + "\n\ninitFonts();\ninit();\n")
open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched v12", len(src))
