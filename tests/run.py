"""Run the browser tests against a fresh build.

    python3 tests/run.py                 build, then run every suite
    python3 tests/run.py craft fill      only the suites whose file name contains "craft" or "fill"
    python3 tests/run.py -j 2            run two suites at the same time (default 1; worth it with 4 or more cores)
    python3 tests/run.py --no-build      test the build that is already there
    python3 tests/run.py --retries 0     a suite that fails is not run a second time

Needs Playwright for Python with Chromium, and Pillow: pip install -r tests/requirements.txt; python3 -m playwright install chromium
The suites open the page from build/test-work/ (a copy of the build, the NA data and placeholder pictures), served
over http on a free local port, and save their screenshots there. No suite needs the internet.
"""
import concurrent.futures as cf, functools, http.server, os, re, shutil, signal, subprocess, sys, threading, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORK = os.path.join(ROOT, "build", "test-work")
URL = None
LIVE_ON = "const LIVE_DEFAULT = true;"


def prepare():
    if os.path.isdir(WORK): shutil.rmtree(WORK)
    os.makedirs(os.path.join(WORK, "out"))
    # live NA updates start switched off in the test copies, so no suite calls Atlas Academy unless it turns them on
    # itself (test_17 does, against a local stand-in)
    for src, dst in ((os.path.join(ROOT, "dist", "Fate_Grand_Index.html"), os.path.join(WORK, "out", "Fate_Grand_Index.html")),
                     (os.path.join(ROOT, "build", "seeded.html"), os.path.join(WORK, "_seeded.html"))):
        with open(src, encoding="utf-8", newline="") as f: html = f.read()
        if html.count(LIVE_ON) != 1: raise SystemExit("can't find the live-updates default in " + src)
        with open(dst, "w", encoding="utf-8", newline="") as f: f.write(html.replace(LIVE_ON, LIVE_ON.replace("true", "false")))
    shutil.copy(os.path.join(ROOT, "src", "data", "atlas_data.js"), os.path.join(WORK, "atlas_data.js"))
    for n in os.listdir(os.path.join(HERE, "fixtures")):
        if n.startswith("ph_"): shutil.copy(os.path.join(HERE, "fixtures", n), WORK)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


def serve():
    """Serve build/test-work on a free local port. Over file://, the headless test browser sometimes comes back
    from a reload with localStorage empty (it never did over http), which made the reload checks fail at random.
    test_00 still opens the page as a file, the way people use it."""
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=WORK))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, "http://127.0.0.1:%d" % srv.server_address[1]


ERRORS = re.compile(r"^(?:page )?errors:? \[(.+)\]$|^\[.+\]$")


LIMIT = 8 * 60  # seconds one suite may take before it counts as stuck (the slowest takes about 4 minutes on a busy machine)


def run_once(path):
    t = time.time()
    # each suite's browser profiles go in its own folder under build/, removed with the next run
    tmp = os.path.join(WORK, "profiles", os.path.basename(path)[:-3]); os.makedirs(tmp, exist_ok=True)
    env = dict(os.environ, TMPDIR=tmp, PYTHONDONTWRITEBYTECODE="1", PYTHONUNBUFFERED="1", FGI_URL=URL)
    pr = subprocess.Popen([sys.executable, path, WORK], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                          cwd=WORK, env=env, start_new_session=True)
    try: out, code = pr.communicate(timeout=LIMIT)[0], pr.returncode
    except subprocess.TimeoutExpired:
        try: os.killpg(pr.pid, signal.SIGKILL)  # the suite, its Playwright driver and its browsers
        except ProcessLookupError: pass
        out = pr.communicate()[0] or ""
        last = [l for l in out.splitlines() if l.startswith(("PASS ", "FAIL "))]
        out += "\nstopped: took longer than %d minutes; stuck in the step after %s" % (LIMIT // 60, repr(last[-1][5:]) if last else "the start")
        code = -1
    lines = out.splitlines()
    passed = sum(l.startswith("PASS ") for l in lines)
    failed = [l[5:] for l in lines if l.startswith("FAIL ")]
    errors = [l for l in lines if ERRORS.match(l.strip())]
    ok = code == 0 and passed > 0 and not failed and not errors
    return {"ok": ok, "passed": passed, "failed": failed, "errors": errors, "code": code, "out": out, "secs": time.time() - t}


def run(path, retries):
    """A suite that fails is run once more: these tests click through a real browser with fixed waits, and on a
    busy machine one can miss by a few milliseconds. A pass on the second try is reported as flaky."""
    tries = [run_once(path)]
    while not tries[-1]["ok"] and len(tries) <= retries: tries.append(run_once(path))
    return os.path.basename(path), tries


def report(name, tries):
    r = tries[-1]
    note = "" if len(tries) == 1 else "  (flaky: passed on try %d)" % len(tries) if r["ok"] else "  (failed %d times)" % len(tries)
    print("%s %-44s %3d checks  %4.0fs%s" % ("ok  " if r["ok"] else "FAIL", name, r["passed"] + len(r["failed"]), sum(t["secs"] for t in tries), note), flush=True)
    for t in tries:
        if t["ok"]: continue
        for f in t["failed"]: print("       ✗ " + f)
        for e in t["errors"]: print("       page error: " + e[:300])
        if t["code"] or not t["passed"]: print("       " + "\n       ".join(t["out"].strip().splitlines()[-25:]))


def main():
    args = sys.argv[1:]
    opt = {"-j": 1, "--retries": 1}
    for k in opt:
        if k in args: i = args.index(k); opt[k] = int(args[i + 1]); del args[i:i + 2]
    if "--no-build" in args: args.remove("--no-build")
    else: subprocess.run([sys.executable, os.path.join(ROOT, "tools", "build.py")], check=True)
    suites = sorted(os.path.join(HERE, n) for n in os.listdir(HERE) if n.startswith("test_") and n.endswith(".py"))
    if args: suites = [s for s in suites if any(a in os.path.basename(s) for a in args)]
    if not suites: raise SystemExit("no suite matches " + " ".join(args))
    prepare()
    global URL
    srv, URL = serve()
    bad, flaky = [], []
    with cf.ThreadPoolExecutor(opt["-j"]) as ex:
        futures = [ex.submit(run, s, opt["--retries"]) for s in suites]
        for f in cf.as_completed(futures):
            name, tries = f.result()
            report(name, tries)
            if not tries[-1]["ok"]: bad.append(name)
            elif len(tries) > 1: flaky.append(name)
    srv.shutdown()
    print("\n%d of %d suites passed%s" % (len(suites) - len(bad), len(suites), ", %d of them on a second try: %s" % (len(flaky), ", ".join(flaky)) if flaky else ""))
    if bad: print("failed: " + ", ".join(sorted(bad)))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
