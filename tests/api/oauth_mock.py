"""A stand-in for Discord's and Google's sign-in, for the API tests (OAUTH_MOCK points the server here).

GET  /control?p=discord&sub=1&name=Rin&email=rin@x.test&verified=1   who the next sign-in will be
GET  /<p>/authorize?...&state=..&code_challenge=..                   sends the browser back with a code
POST /<p>/token                                                       code + verifier + secret -> access token
GET  /<p>/user                                                        the account, shaped like the real one
"""
import base64, hashlib, json, secrets, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, urlencode

NEXT = {"discord": {"sub": "1001", "name": "Rin", "email": "rin@example.test", "verified": "1"}, "google": {"sub": "g-2002", "name": "Sakura", "email": "sakura@example.test", "verified": "1"}}
CODES, TOKENS = {}, {}
SECRETS = {"discord": "dev-discord-secret", "google": "dev-google-secret"}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, obj=None, headers=None):
        b = json.dumps(obj).encode() if obj is not None else b""
        self.send_response(code)
        for k, v in (headers or {}).items(): self.send_header(k, v)
        if obj is not None: self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}; parts = u.path.strip("/").split("/")
        if parts[0] == "control":
            NEXT[q.pop("p")] = q; return self.send(200, {"ok": True})
        p = parts[0]
        if len(parts) == 2 and parts[1] == "authorize":
            if q.get("client_id") != "dev-" + p: return self.send(400, {"error": "client"})
            code = secrets.token_urlsafe(12); CODES[code] = {"p": p, "who": dict(NEXT[p]), "challenge": q.get("code_challenge"), "redirect": q.get("redirect_uri")}
            if q.get("deny"): return self.send(302, None, {"location": q["redirect_uri"] + "?" + urlencode({"error": "access_denied", "state": q.get("state", "")})})
            return self.send(302, None, {"location": q["redirect_uri"] + "?" + urlencode({"code": code, "state": q.get("state", "")})})
        if len(parts) == 2 and parts[1] == "user":
            tok = (self.headers.get("authorization") or "").replace("Bearer ", "")
            t = TOKENS.get(tok)
            if not t or t["p"] != p: return self.send(401, {"error": "token"})
            w = t["who"]
            if p == "discord": return self.send(200, {"id": w["sub"], "username": w["name"].lower(), "global_name": w["name"], "email": w.get("email"), "verified": w.get("verified") == "1"})
            return self.send(200, {"sub": w["sub"], "name": w["name"], "given_name": w["name"], "email": w.get("email"), "email_verified": w.get("verified") == "1"})
        self.send(404, {"error": "nf"})
    def do_POST(self):
        p = self.path.strip("/").split("/")[0]
        n = int(self.headers.get("content-length") or 0); f = {k: v[0] for k, v in parse_qs(self.rfile.read(n).decode()).items()}
        c = CODES.pop(f.get("code", ""), None)
        if not c or c["p"] != p or f.get("client_secret") != SECRETS[p] or f.get("redirect_uri") != c["redirect"]: return self.send(400, {"error": "invalid_grant"})
        ch = base64.urlsafe_b64encode(hashlib.sha256(f.get("code_verifier", "").encode()).digest()).decode().rstrip("=")
        if ch != c["challenge"]: return self.send(400, {"error": "pkce"})
        tok = secrets.token_urlsafe(16); TOKENS[tok] = {"p": p, "who": c["who"]}
        self.send(200, {"access_token": tok, "token_type": "Bearer"})

def start(port):
    s = ThreadingHTTPServer(("127.0.0.1", port), H)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s

if __name__ == "__main__":
    start(int(sys.argv[1]) if len(sys.argv) > 1 else 8799); threading.Event().wait()
