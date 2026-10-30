"""Runs the hosted site for a test: a local copy of Cloudflare (wrangler pages dev, with its own empty D1 database and R2
bucket in a temporary folder) and the Discord/Google stand-in. Used by test_api.py and test_hosted_ui.py.

    with hosted.server(seeded=True) as (base, mock_port): ...
"""
import contextlib, os, shutil, socket, subprocess, sys, tempfile, time, urllib.error, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, "tools", "dev"))
import oauth_mock, serve

def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

@contextlib.contextmanager
def server(seeded=True, d1_pics=False):
    mport, port = free_port(), free_port()
    mock = oauth_mock.start(mport)
    state = tempfile.mkdtemp(prefix="fgi-hosted-")
    env = dict(os.environ, WRANGLER_SEND_METRICS="false", NO_PROXY="127.0.0.1,localhost", no_proxy="127.0.0.1,localhost")
    cmd = serve.command(port=port, seeded=seeded, d1_pics=d1_pics, mock_oauth="http://127.0.0.1:%d" % mport, state=state)
    log = open(os.path.join(state, "wrangler.log"), "w")
    proc = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    base = "http://127.0.0.1:%d" % port
    ok = False
    try:
        for _ in range(120):
            if proc.poll() is not None: break
            try: urllib.request.urlopen(base + "/api/me", timeout=2); ok = True; break
            except urllib.error.HTTPError: ok = True; break
            except Exception: time.sleep(0.5)
        if not ok: raise SystemExit("the local Cloudflare didn't start:\n" + open(os.path.join(state, "wrangler.log")).read()[-3000:])
        yield base, mport
    finally:
        proc.terminate()
        try: proc.wait(10)
        except Exception: proc.kill()
        mock.shutdown()
        server.log = open(os.path.join(state, "wrangler.log")).read()
        shutil.rmtree(state, ignore_errors=True)
server.log = ""
