"""Checks that the third-party code inlined into the page is exactly the published release (14 Nov 2026, security review).

    python3 tools/check_vendor.py

src/vendor/ holds three.js and vanta.js (about 750 KB) that tools/build.py puts into the page as they are. This
downloads the same versions from npm (`npm pack`, which needs node and the internet) and compares every file byte for
byte, so an accidental edit, or a changed file slipped into a pull request, fails the tests. To update a library, change
its version here and in src/vendor/README.md, and copy the new files in.
"""
import os, subprocess, sys, tarfile, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, "src", "vendor")
# package@version: its files, as (path in the package, file in src/vendor)
PACKAGES = {
    "three@0.134.0": [("package/build/three.min.js", "three.min.js")],
    "vanta@0.5.24": [("package/dist/vanta.%s.min.js" % k, "vanta.%s.min.js" % k) for k in ("birds", "cells", "clouds", "dots", "fog", "globe", "net", "waves")],
}

expected = {f for files in PACKAGES.values() for _, f in files}
have = {f for f in os.listdir(VENDOR) if f.endswith(".js")}
problems = ["%s is in src/vendor but not listed here" % f for f in sorted(have - expected)]
problems += ["%s is listed here but missing from src/vendor" % f for f in sorted(expected - have)]
with tempfile.TemporaryDirectory() as tmp:
    for pkg, files in PACKAGES.items():
        name = subprocess.run(["npm", "pack", pkg, "--silent", "--pack-destination", tmp], capture_output=True, text=True, check=True).stdout.strip().splitlines()[-1]
        with tarfile.open(os.path.join(tmp, name)) as t:
            for inner, mine in files:
                if mine not in have: continue
                theirs = t.extractfile(inner).read()
                ours = open(os.path.join(VENDOR, mine), "rb").read()
                print("%-22s %s" % (mine, "same as %s" % pkg if ours == theirs else "DIFFERENT from %s" % pkg))
                if ours != theirs: problems.append("%s differs from %s's %s" % (mine, pkg, inner))
if problems:
    sys.exit("src/vendor doesn't match the published releases:\n- " + "\n- ".join(problems))
print("all %d files match the published releases" % len(expected))
