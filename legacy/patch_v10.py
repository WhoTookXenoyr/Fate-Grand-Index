import sys
sp = sys.argv[1]
src = open(f"{sp}/base_v10.html").read()
rd = lambda n: open(f"{sp}/{n}").read()
def rep(old, new, count=1):
    global src
    c = src.count(old)
    if c != count: raise SystemExit(f"expected {count} got {c}: {old[:120]!r}")
    src = src.replace(old, new)
rep("</style>", rd("css_v10.css") + "</style>")
rep('''    <button class="tab" role="tab" id="tab-servants" data-action="tab" data-tab="servants" aria-selected="true">Servants</button>''',
    '''    <button class="tab" role="tab" id="tab-home" data-action="tab" data-tab="home" aria-selected="true">Home</button>
    <button class="tab" role="tab" id="tab-servants" data-action="tab" data-tab="servants" aria-selected="false">Servants</button>''')
rep('''  <section id="view-servants" class="d-sec" aria-labelledby="tab-servants">''',
    '''  <section id="view-home" aria-labelledby="tab-home"><div id="home" class="home"></div></section>

  <section id="view-servants" class="d-sec" aria-labelledby="tab-servants" hidden>''')
rep('''const TABS = ["servants","parties","ranking","versus"];''', '''const TABS = ["home","servants","parties","ranking","versus"];''')
rep("\ninitFonts();\ninit();\n", "\n" + rd("v10.js") + "\n\ninitFonts();\ninit();\n")
open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched v10", len(src))
