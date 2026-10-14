"""Run the browser tests against a fresh build.

    python3 tests/run.py                 build, then run every suite
    python3 tests/run.py craft fill      only the suites whose file name contains "craft" or "fill"
    python3 tests/run.py -j 3            run three suites at the same time (default 2)
    python3 tests/run.py --no-build      test the build that is already there

Needs Playwright for Python with Chromium (pip install playwright; python3 -m playwright install chromium).
Each suite opens the page from build/test-work/ (a copy of the build, the NA data and placeholder pictures for
everything that would come from Atlas Academy, so no test needs the internet) and saves its screenshots there.
"""
import concurrent.futures as cf, os, re, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORK = os.path.join(ROOT, "build", "test-work")


def prepare():
    if os.path.isdir(WORK): shutil.rmtree(WORK)
    os.makedirs(os.path.join(WORK, "out"))
    shutil.copy(os.path.join(ROOT, "dist", "Fate_Grand_Index.html"), os.path.join(WORK, "out", "Fate_Grand_Index.html"))
    shutil.copy(os.path.join(ROOT, "build", "seeded.html"), os.path.join(WORK, "_seeded.html"))
    shutil.copy(os.path.join(ROOT, "src", "data", "atlas_data.js"), os.path.join(WORK, "atlas_data.js"))
    for n in os.listdir(os.path.join(HERE, "fixtures")):
        if n.startswith("ph_"): shutil.copy(os.path.join(HERE, "fixtures", n), WORK)


ERRORS = re.compile(r"^(?:page )?errors:? \[(.+)\]$|^\[.+\]$")


def run(path):
    t = time.time()
    r = subprocess.run([sys.executable, path, WORK], capture_output=True, text=True, cwd=WORK)
    lines = (r.stdout + r.stderr).splitlines()
    passed = sum(l.startswith("PASS ") for l in lines)
    failed = [l[5:] for l in lines if l.startswith("FAIL ")]
    errors = [l for l in r.stdout.splitlines() if ERRORS.match(l.strip())]
    ok = r.returncode == 0 and passed > 0 and not failed and not errors
    return os.path.basename(path), ok, passed, failed, errors, r, time.time() - t


def main():
    args = sys.argv[1:]
    jobs = 2
    if "-j" in args: k = args.index("-j"); jobs = int(args[k + 1]); del args[k:k + 2]
    if "--no-build" in args: args.remove("--no-build")
    else: subprocess.run([sys.executable, os.path.join(ROOT, "tools", "build.py")], check=True)
    suites = sorted(os.path.join(HERE, n) for n in os.listdir(HERE) if n.startswith("test_") and n.endswith(".py"))
    if args: suites = [s for s in suites if any(a in os.path.basename(s) for a in args)]
    if not suites: raise SystemExit("no suite matches " + " ".join(args))
    prepare()
    bad = []
    with cf.ThreadPoolExecutor(jobs) as ex:
        for name, ok, passed, failed, errors, r, secs in ex.map(run, suites):
            print("%s %-44s %3d checks  %4.0fs" % ("ok  " if ok else "FAIL", name, passed + len(failed), secs), flush=True)
            if ok: continue
            bad.append(name)
            for f in failed: print("       ✗ " + f)
            for e in errors: print("       page error: " + e[:300])
            if r.returncode or not passed: print("       " + "\n       ".join((r.stdout + r.stderr).strip().splitlines()[-25:]))
    print("\n%d of %d suites passed" % (len(suites) - len(bad), len(suites)))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
