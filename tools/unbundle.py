"""One-off: split the built page (dist/Fate_Grand_Index.html, 0.19.0) into a clean source tree under src/.

The legacy build stacked patch scripts on a 0.7.1 page. Here the finished page is the source of truth:
it is cut into the page skeleton, the style sheets and the app script, at the places where each legacy
module was inserted, and every embedded picture becomes a file in src/assets/. tools/build.py puts it
back together, and must give the very same bytes.
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEG = os.path.join(ROOT, "legacy")
SRC = os.path.join(ROOT, "src")
page = open(os.path.join(ROOT, "dist", "Fate_Grand_Index.html")).read()
rd = lambda n: open(os.path.join(LEG, n)).read()

def write(rel, text, binary=False):
    p = os.path.join(SRC, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "wb" if binary else "w") as f: f.write(text)

# ---------------------------------------------------------------- pictures → src/assets
EXT = {"image/webp": "webp", "image/png": "png", "image/x-icon": "ico", "image/jpeg": "jpg", "image/gif": "gif", "image/svg+xml": "svg"}
URI = re.compile(r"data:([a-z]+/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)")
slug = lambda t: re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
def asset_name(text, start):
    pre = text[max(0, start - 400):start]
    if 'rel="icon"' in pre[-120:]: return "favicon"
    if 'class="brand-logo"' in pre[-60:]: return "logo"
    if "GRAIL_IMG.src" in pre[-30:]: return "grail"
    if "const CARD_BACK" in pre[-30:]: return "cardback-servant-5"
    if pre.rstrip().endswith('url("'):
        sel = pre[pre.rfind("}") + 1:].strip()
        return "skill-icons-sprite" if ".ic " in sel or sel.startswith(".ic") else "sparkle" if "art-sheen" in sel else "css-" + slug(sel)[:30]
    m = re.search(r'"([^"]+)":\s*"$', pre) or re.search(r'(\w+):\s*"$', pre)
    if m:
        whole = text[max(0, start - 400000):start]
        maps = list(re.finditer(r"const (\w+) = \{", whole))
        owner = maps[-1].group(1) if maps else "map"
        name = {"CLASS_LOGO": "class-logo", "CLASS_MARK": "class-mark", "CARD_IMG": "card", "CB": "cardback"}.get(owner, slug(owner))
        return name + "-" + slug(m.group(1))
    return None
assets = {}
def lift_assets(text):
    out, last = [], 0
    for m in URI.finditer(text):
        name = asset_name(text, m.start())
        if not name: raise SystemExit("unnamed picture at " + text[max(0, m.start() - 80):m.start()])
        fn = name + "." + EXT[m.group(1)]
        if fn in assets and assets[fn] != m.group(0): raise SystemExit("two different pictures named " + fn)
        assets[fn] = m.group(0)
        out.append(text[last:m.start()] + "@@asset:" + fn + "@@"); last = m.end()
    out.append(text[last:])
    return "".join(out)

# ---------------------------------------------------------------- the three parts of the page
st = page.index("<style>") + len("<style>"); se = page.index("</style>", st)
sc = page.index("<script>", se) + len("<script>"); sce = page.rindex("</script>")
css, js = page[st:se], page[sc:sce]
skeleton = page[:st] + "@@styles@@" + page[se:sc] + "@@app@@" + page[sce:]

# ---------------------------------------------------------------- split by where each legacy module sits
def spans(text, mods):
    """Find each module's text in order; a module later patches touched is found by its first and last lines."""
    found, pos = [], 0
    for name, body in mods:
        i = text.find(body, pos)
        if i >= 0: found.append((i, i + len(body), name)); pos = i + len(body); continue
        head, tail = body[:160], body[-160:]
        i = text.find(head, pos); j = text.find(tail, i + 1) if i >= 0 else -1
        if i < 0 or j < 0: raise SystemExit("can't place " + name)
        found.append((i, j + len(tail), name)); pos = j + len(tail)
        print("  (changed later, placed by its first and last lines)", name)
    return found
def cut(text, found, core_names, ext):
    parts, last, n = [], 0, 0
    def gap(t):
        nonlocal n
        # blank lines and a call or two between two modules belong with the module before them
        if parts and len(t) < 200: parts[-1] = (parts[-1][0], parts[-1][1] + t)
        else: parts.append((core_names[n] if n < len(core_names) else "core-%d" % n, t)); n += 1
    for i, j, name in sorted(found):
        if i > last: gap(text[last:i])
        parts.append((name, text[i:j])); last = j
    if last < len(text):
        # what follows the last module is the start-up call and the end of the one big function
        if ext == "js": parts.append(("start", text[last:]))
        else: gap(text[last:])
    return parts

CSS_MODS = [("rankings-traits", rd("css_v8.css")), ("living-background-light-dark", rd("css_v9.css")), ("home", rd("css_v10.css")),
    ("motion-summoning", rd("css_v11.css")), ("skill-icons", rd("css_v11b.css").replace("__ICON_SPRITE__", rd("up9/icons_sprite.b64").strip())),
    ("past-chaldea", rd("css_v12.css")), ("guide-news-quick-set", rd("css_v15.css")), ("version-upgraded-skills", rd("css_v16.css")),
    ("stars-glare-compact-summoning", rd("css_v17.css")), ("brand-compact-window-footer", rd("css_v18.css")),
    ("glare-costumes-toasts", rd("css_v19.css")), ("craft-essences", rd("css_v20.css"))]
JS_MODS = [("traits-data", rd("data_v8.js")), ("traits-ui", rd("traits_v8.js")), ("buff-targets", rd("autobuff_v81.js")), ("csv-and-planners", rd("io_v8.js")),
    ("party-dna", rd("dna_v8.js")), ("support-buffs", rd("support_v81.js")),
    ("living-background-light-dark", rd("v9.js").replace("__CARD_BACK__", rd("up9/cardback.b64").strip())), ("home", rd("v10.js")),
    ("motion", rd("v11_motion.js")), ("skill-icons", rd("v11_icons.js").replace("__ICON_LIST__", rd("up9/icons_list.js").strip())),
    ("summoning", rd("v11_summon.js")), ("home-more", rd("v11_home.js")),
    ("past-chaldea", rd("v12_past.js").replace("__ATLAS_DATA__", rd("atlas_data.js").strip())), ("summoning-past-chaldea", rd("v12_summon.js")),
    ("home-daily-servant", rd("v12_home.js")), ("fill-in", rd("v13_fill.js")), ("guide-news-fresh-start", rd("v15.js")),
    ("stats-follow-level-upgraded-skills", rd("v16.js")), ("summoning-bond-compact-np-upgrades", rd("v17.js")),
    ("brand-compact-window-footer", rd("v18.js")), ("frame-rate-costumes-glare", rd("v19.js")), ("craft-essences", rd("v20.js"))]

print("styles:")
css_parts = cut(css, spans(css, CSS_MODS), ["base"], "css")
print("app:")
js_parts = cut(js, spans(js, JS_MODS), ["core", "core-rendering-forms-events"], "js")

# the NA data is generated: it lives in its own file and comes back in through @@include@@
atlas = rd("atlas_data.js").strip()
for k, (name, body) in enumerate(js_parts):
    if atlas in body: js_parts[k] = (name, body.replace(atlas, "@@include:data/atlas_data.js@@")); break
else: raise SystemExit("NA data not found")
write("data/atlas_data.js", atlas + "\n")
# the sample roster is only for tests; the shipped page starts empty
EMPTY = json.dumps({"servants": [], "parties": [], "guests": []})
for k, (name, body) in enumerate(js_parts):
    if "const SEED = " + EMPTY + ";" in body: js_parts[k] = (name, body.replace("const SEED = " + EMPTY + ";", "const SEED = @@seed@@;")); break
else: raise SystemExit("seed not found")

skeleton = lift_assets(skeleton)
css_parts = [(n, lift_assets(b)) for n, b in css_parts]
js_parts = [(n, lift_assets(b)) for n, b in js_parts]

write("page.html", skeleton)
for k, (n, b) in enumerate(css_parts): write("styles/%02d-%s.css" % (k, n), b)
for k, (n, b) in enumerate(js_parts): write("app/%02d-%s.js" % (k, n), b)
for fn, uri in assets.items():
    m = URI.match(uri); write("assets/" + fn, base64.b64decode(m.group(2)), binary=True)
print(len(css_parts), "style sheets,", len(js_parts), "app files,", len(assets), "pictures")
