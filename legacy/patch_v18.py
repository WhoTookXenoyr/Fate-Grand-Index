import sys
sp = sys.argv[1]
src = open(f"{sp}/spirit-origin-list.html").read()
rd = lambda n: open(f"{sp}/{n}").read()
def rep(old, new, count=1):
    global src
    c = src.count(old)
    if c != count: raise SystemExit(f"expected {count} got {c}: {old[:120]!r}")
    src = src.replace(old, new)
rep("</style>", rd("css_v18.css") + "</style>")
rep("<title>Spirit Origin List</title>", "<title>Fate/Grand Index</title>")
logo = rd("up18/logo.b64").strip()
rep('''      <h1><a class="home-link" href="#home" data-action="go-home" title="Go to Home">Spirit Origin List</a></h1>''',
    f'''      <h1 class="brand"><a class="home-link" href="#home" data-action="go-home" title="Go to Home"><img class="brand-logo" src="{logo}" alt="Fate/Grand Index" width="220" height="88"></a></h1>''')
rep('''<p class="eyebrow">Fate/Grand Order · Personal archive <button''', '''<p class="eyebrow">Fate/Grand Order · Index &amp; Spirit Origin List <button''')
rep('''sample: "Spirit Origin List"}''', '''sample: "Fate/Grand Index"}''')
rep('''<span id="app-ver">v0.15.0 · alpha</span>''', '''<span id="app-ver">v0.17.0 · alpha</span>''')
rep("\ninitFonts();\ninit();\n", "\n" + rd("v18.js") + "\n\ninitFonts();\ninit();\n")
open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched 0.17.0", len(src))
