import sys
sp = sys.argv[1]
src = open(f"{sp}/spirit-origin-list.html").read()
rd = lambda n: open(f"{sp}/{n}").read()
def rep(old, new, count=1):
    global src
    c = src.count(old)
    if c != count: raise SystemExit(f"expected {count} got {c}: {old[:120]!r}")
    src = src.replace(old, new)
ico = rd("up19/favicon_diamond.b64").strip()
rep("<title>Fate/Grand Index</title>", f'<title>Fate/Grand Index</title>\n<link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48" href="data:image/x-icon;base64,{ico}">')
rep('''<span id="app-ver">v0.17.0 · alpha</span>''', '''<span id="app-ver">v0.17.1 · alpha</span>''')
open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched 0.17.1", len(src))
