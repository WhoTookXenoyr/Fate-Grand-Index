"""Build Fate/Grand Index from src/ into one self-contained HTML file.

    python3 tools/build.py            writes dist/Fate_Grand_Index.html (empty roster, the file people use)
                                      and build/seeded.html (sample roster from tests/fixtures, for tests)
    python3 tools/build.py --check    builds in memory and fails if dist/ is not what src/ gives

How src/ fits together:
  src/page.html      the page; @@styles@@ and @@app@@ mark where the style sheets and the script go
  src/styles/*.css   joined in name order
  src/app/*.js       joined in name order (each file is one part of a single script, not a module of its own)
  @@asset:NAME@@     replaced by src/assets/NAME as a data: URL, so the page needs no other files
  @@include:PATH@@   replaced by the text of src/PATH (generated data, e.g. data/atlas_data.js)
  @@seed@@           the roster the page starts with when nothing is saved yet

Python 3 standard library only. Node is used for a syntax check when it is installed.
"""
import base64, json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist", "Fate_Grand_Index.html")
SEEDED = os.path.join(ROOT, "build", "seeded.html")
SAMPLE = os.path.join(ROOT, "tests", "fixtures", "sample-roster.json")
EMPTY = {"servants": [], "parties": [], "guests": []}
MIME = {"webp": "image/webp", "png": "image/png", "ico": "image/x-icon", "jpg": "image/jpeg", "gif": "image/gif", "svg": "image/svg+xml"}


def read(*p):
    with open(os.path.join(SRC, *p), encoding="utf-8", newline="") as f: return f.read()


def joined(folder, ext):
    names = sorted(n for n in os.listdir(os.path.join(SRC, folder)) if n.endswith(ext))
    return "".join(read(folder, n) for n in names)


def data_url(name):
    ext = name.rsplit(".", 1)[-1]
    with open(os.path.join(SRC, "assets", name), "rb") as f:
        return "data:%s;base64,%s" % (MIME[ext], base64.b64encode(f.read()).decode("ascii"))


def seed_js(data):
    # same form the page has always used: compact JSON, safe inside <script>
    return json.dumps(data, ensure_ascii=False).replace("</", "<\\/")


def page(seed):
    styles, app = joined("styles", ".css"), joined("app", ".js")
    used = set()
    def asset(m): used.add(m.group(1)); return data_url(m.group(1))
    def include(m): return read(*m.group(1).split("/")).rstrip("\n")
    styles = re.sub(r"@@asset:([\w.-]+)@@", asset, styles)
    app = re.sub(r"@@asset:([\w.-]+)@@", asset, app)
    app = re.sub(r"@@include:([\w./-]+)@@", include, app)
    if app.count("@@seed@@") != 1: raise SystemExit("src/app must have exactly one @@seed@@")
    app = app.replace("@@seed@@", seed_js(seed))
    html = re.sub(r"@@asset:([\w.-]+)@@", asset, read("page.html"))
    for token, part in (("@@styles@@", styles), ("@@app@@", app)):
        if html.count(token) != 1: raise SystemExit("src/page.html must have exactly one " + token)
        html = html.replace(token, part)
    unused = set(os.listdir(os.path.join(SRC, "assets"))) - used
    if unused: print("note: pictures nobody uses:", ", ".join(sorted(unused)))
    return html, app


def syntax_check(app):
    node = shutil.which("node")
    if not node: print("note: node not found, skipped the syntax check"); return
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f: f.write(app)
    try:
        r = subprocess.run([node, "--check", f.name], capture_output=True, text=True)
        if r.returncode: raise SystemExit("syntax error in src/app:\n" + r.stderr)
    finally: os.unlink(f.name)


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f: f.write(text)


def main():
    check = "--check" in sys.argv[1:]
    html, app = page(EMPTY)
    syntax_check(app)
    if check:
        with open(DIST, encoding="utf-8", newline="") as f:
            if f.read() != html: raise SystemExit("dist/Fate_Grand_Index.html is out of date: run python3 tools/build.py and commit it")
        print("dist/Fate_Grand_Index.html matches src/")
        return
    write(DIST, html)
    with open(SAMPLE, encoding="utf-8") as f: sample = json.load(f)
    write(SEEDED, page(sample)[0])
    print("built dist/Fate_Grand_Index.html (%s bytes) and build/seeded.html" % format(len(html.encode()), ","))


if __name__ == "__main__":
    main()
