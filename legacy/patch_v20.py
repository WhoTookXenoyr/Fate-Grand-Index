import sys
sp = sys.argv[1]
src = open(f"{sp}/spirit-origin-list.html").read()
rd = lambda n: open(f"{sp}/{n}").read()
def rep(old, new, count=1):
    global src
    c = src.count(old)
    if c != count: raise SystemExit(f"expected {count} got {c}: {old[:120]!r}")
    src = src.replace(old, new)
rep("</style>", rd("css_v19.css") + "</style>")
rep('''<span id="app-ver">v0.17.1 · alpha</span>''', '''<span id="app-ver">v0.18.0 · alpha</span>''')
rep("\ninitFonts();\ninit();\n", "\n" + rd("v19.js") + "\n\ninitFonts();\ninit();\n")
open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched 0.18.0", len(src))
