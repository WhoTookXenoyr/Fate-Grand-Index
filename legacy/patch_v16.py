import sys
sp = sys.argv[1]
src = open(f"{sp}/spirit-origin-list.html").read()
rd = lambda n: open(f"{sp}/{n}").read()
def rep(old, new, count=1):
    global src
    c = src.count(old)
    if c != count: raise SystemExit(f"expected {count} got {c}: {old[:120]!r}")
    src = src.replace(old, new)
rep("</style>", rd("css_v16.css") + "</style>")
# the version, top left; press it for What's new
rep('''      <p class="eyebrow">Fate/Grand Order · Personal archive</p>''',
    '''      <p class="eyebrow">Fate/Grand Order · Personal archive <button type="button" class="ver-chip" data-action="news" title="What's new in this version"><span id="app-ver">v0.15.0 · alpha</span></button></p>''')
# the trait is called Artoria Face
n = src.count('"Saberface"')
if n < 3: raise SystemExit(f"Saberface: {n}")
src = src.replace('"Saberface"', '"Artoria Face"')
# "Increase C. Star Drop Rate" is one line: C. is short for Critical Stars, not the end of a sentence
rep('''if (/\\b(?:vs|Lv|approx|No|St|Dr|Mr|Ms|Jr|etc)\\.$/i.test(tail)) continue;''', '''if (/\\b(?:vs|Lv|approx|No|St|Dr|Mr|Ms|Jr|etc|C)\\.$/i.test(tail)) continue;''')
rep("\ninitFonts();\ninit();\n", "\n" + rd("v16.js") + "\n\ninitFonts();\ninit();\n")
open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched 0.15.0", len(src), "Saberface renamed", n)
