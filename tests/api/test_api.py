"""The /api/ part of the hosted site, against a local copy of Cloudflare (wrangler pages dev, local D1 and R2) and a
stand-in for Discord and Google. Accounts, passwords, recovery codes, sessions, sync, pictures, friends, supports,
activity, shared links, Discord/Google sign-in and deleting an account.

    python3 tests/api/test_api.py            (needs tools/dev/node_modules, see tools/dev/serve.py; or WRANGLER=path)
    python3 tests/api/test_api.py --d1-pics  pictures in the database instead of R2
"""
import base64, hashlib, http.cookiejar, json, os, sys, urllib.error, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hosted

fails = []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label, flush=True)
    if not ok: fails.append(label)

def key_of(email, password):
    # what the page sends: PBKDF2-SHA256, 600,000 rounds, salted with the email (41-account.js)
    k = hashlib.pbkdf2_hmac("sha256", password.encode(), ("fgi-v1:" + email.strip().lower()).encode(), 600000, 32)
    return base64.urlsafe_b64encode(k).decode().rstrip("=")

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None

class Client:
    def __init__(self, base):
        self.base = base; self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.raw = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), NoRedirect)
    def call(self, method, path, data=None, header=True, raw=None, ctype=None, follow=True):
        url = self.base + path
        if raw is not None: body = raw
        else: body = json.dumps(data).encode() if data is not None else None
        h = {"content-type": ctype or "application/json"}
        if header: h["x-fgi"] = "1"
        req = urllib.request.Request(url, data=body, method=method, headers=h)
        try:
            r = (self.op if follow else self.raw).open(req, timeout=30)
            b = r.read(); return r.status, (json.loads(b) if r.headers.get("content-type", "").startswith("application/json") else b), r.headers
        except urllib.error.HTTPError as e:
            b = e.read()
            try: return e.code, json.loads(b), e.headers
            except Exception: return e.code, b, e.headers
    get = lambda self, p, **k: self.call("GET", p, **k)
    post = lambda self, p, d=None, **k: self.call("POST", p, d, **k)
    def oauth(self, p, mode="login"):
        # the browser's round trip: start -> provider -> callback -> back to the page
        s, _, h = self.call("GET", "/api/auth/" + p + ("?mode=link" if mode == "link" else ""), follow=False)
        if s != 302: return "start:" + str(s)
        s, _, h = self.call("GET", h["location"].replace(self.base, ""), follow=False) if h["location"].startswith(self.base) else self._ext(h["location"])
        loc = h["location"]
        s, _, h = self.call("GET", loc.replace(self.base, ""), follow=False)
        return urllib.parse.parse_qs(urllib.parse.urlparse(h.get("location", "")).query).get("account", ["?"])[0]
    def _ext(self, url):
        try: r = self.raw.open(urllib.request.Request(url), timeout=10); return r.status, None, r.headers
        except urllib.error.HTTPError as e: return e.code, None, e.headers

def main():
    d1_pics = "--d1-pics" in sys.argv
    with hosted.server(seeded=True, d1_pics=d1_pics) as (base, mport):
        run(base, mport, d1_pics)
    if fails: print(hosted.server.log[-3000:])
    print("ALL PASSED" if not fails else "FAILED %d: %s" % (len(fails), fails))
    sys.exit(1 if fails else 0)

def run(base, mport, d1_pics):
    A, B, C, anon = Client(base), Client(base), Client(base), Client(base)
    s, r, _ = anon.get("/api/me")
    check(f"signed out: no user, and which sign-ins are set up ({r.get('providers')})", s == 200 and r["user"] is None and r["providers"]["password"] and r["providers"]["discord"] and r["providers"]["google"] and r["providers"]["pics"] == ("d1" if d1_pics else "r2"))
    s, r, _ = anon.post("/api/auth/signup", {"name": "Noyr", "email": "noyr@example.test", "key": key_of("noyr@example.test", "correct horse battery")}, header=False)
    check(f"a change without the X-FGI header is refused ({s})", s == 403 and r["error"] == "no_header")
    s, r, _ = anon.post("/api/auth/signup", {"name": "No", "email": "noyr@example.test", "key": key_of("noyr@example.test", "x" * 12)})
    check(f"a name needs 3+ characters ({s} {r.get('error')})", s == 400 and r["error"] == "bad_name")
    s, r, _ = anon.post("/api/auth/signup", {"name": "Noyr", "email": "noyr@example.test", "key": "short"})
    check("a key that isn't 32 bytes is refused", s == 400 and r["error"] == "bad_key")
    s, r, h = A.post("/api/auth/signup", {"name": "Noyr", "email": "Noyr@Example.test ", "key": key_of("noyr@example.test", "correct horse battery")})
    rc = r.get("recovery", "")
    check(f"sign-up: an account, a recovery code ({rc}) and a session cookie", s == 200 and len(rc) == 19 and r["user"]["name"] == "Noyr" and r["user"]["email"] == "noyr@example.test" and len(r["user"]["code"]) == 9 and "fgi_s=" in (h.get("set-cookie") or "") and "HttpOnly" in h.get("set-cookie"))
    check("the cookie is HttpOnly and SameSite=Lax", "SameSite=Lax" in h.get("set-cookie"))
    a_code = r["user"]["code"]; a_id = r["user"]["id"]
    s, r, _ = B.post("/api/auth/signup", {"name": "noyr", "email": "other@example.test", "key": key_of("other@example.test", "another password")})
    check("names are unique whatever the case", s == 409 and r["error"] == "name_taken")
    s, r, _ = B.post("/api/auth/signup", {"name": "Bazett", "email": "NOYR@example.test", "key": key_of("noyr@example.test", "another password")})
    check("one account per email", s == 409 and r["error"] == "email_taken")
    s, r, _ = B.post("/api/auth/signup", {"name": "Bazett", "email": "bazett@example.test", "key": key_of("bazett@example.test", "fragarach!!")})
    b_id, b_code = r["user"]["id"], r["user"]["code"]
    s, r, _ = A.get("/api/me")
    check("signed in: /api/me knows who", r["user"] and r["user"]["id"] == a_id and r["user"]["hasPassword"] is True)
    s, r, h = A.post("/api/auth/logout")
    s, r, _ = A.get("/api/me")
    check("signing out ends the session", r["user"] is None)
    s, r, _ = A.post("/api/auth/login", {"email": "noyr@example.test", "key": key_of("noyr@example.test", "wrong")})
    check(f"a wrong password says so without telling which part ({r.get('message')})", s == 401 and r["error"] == "wrong")
    s, r, _ = A.post("/api/auth/login", {"email": "NOYR@example.test", "key": key_of("noyr@example.test", "correct horse battery")})
    check("the right one signs in (email in any case)", s == 200 and r["user"]["id"] == a_id)
    # guessing is slowed down
    for i in range(10): s, r, _ = anon.post("/api/auth/login", {"email": "bazett@example.test", "key": key_of("bazett@example.test", "guess%d" % i)})
    s, r, _ = anon.post("/api/auth/login", {"email": "bazett@example.test", "key": key_of("bazett@example.test", "fragarach!!")})
    check(f"after 10 wrong tries, even the right password waits ({s} {r.get('message')})", s == 429 and r["error"] == "slow_down")
    # recovery code
    C2 = Client(base)
    s, r, _ = C2.post("/api/auth/recover", {"email": "noyr@example.test", "code": "AAAA-BBBB-CCCC-DDDD", "key": key_of("noyr@example.test", "new password 1")})
    check("a wrong recovery code is refused", s == 401)
    s, r, _ = C2.post("/api/auth/recover", {"email": "noyr@example.test", "code": rc.lower().replace("-", " "), "key": key_of("noyr@example.test", "new password 1")})
    rc2 = r.get("recovery")
    check(f"the recovery code sets a new password and gives a new code ({rc2})", s == 200 and rc2 and rc2 != rc)
    s, r, _ = A.get("/api/me")
    check("and every other device is signed out", r["user"] is None)
    s, r, _ = C2.post("/api/auth/recover", {"email": "noyr@example.test", "code": rc, "key": key_of("noyr@example.test", "new password 2")})
    check("the old code works only once", s == 401)
    s, r, _ = A.post("/api/auth/login", {"email": "noyr@example.test", "key": key_of("noyr@example.test", "new password 1")})
    check("the new password works", s == 200)

    # ---------- sync ----------
    sv = lambda i, **k: dict({"name": "Servant %d" % i, "cls": "Saber", "rarity": 5, "level": 80, "npLevel": 1, "skills": [6, 6, 6], "order": i, "atlas": 2}, **k)
    s, r, _ = A.post("/api/sync", {"first": True, "changes": [{"col": "servants", "id": "s%d" % i, "data": sv(i)} for i in range(1, 4)] + [{"col": "parties", "id": "p1", "data": {"name": "Farm", "order": 1}}, {"col": "extras", "id": "log", "data": {"v": [1, 2]}}]})
    check(f"sending five changes numbers them ({r.get('revs')})", s == 200 and r["revs"] == [1, 2, 3, 4, 5] and r["rev"] == 5)
    s, r, _ = A.post("/api/sync", {"changes": [{"col": "secrets", "id": "x", "data": {}}]})
    check("only the roster's collections", s == 400)
    s, r, _ = C2.get("/api/sync?since=0")
    check(f"another device gets all of it ({len(r.get('docs', []))} docs, rev {r.get('rev')})", s == 200 and len(r["docs"]) == 5 and r["rev"] == 5 and r["docs"][0]["data"]["name"] == "Servant 1" and r["more"] is False)
    s, r, _ = C2.post("/api/sync", {"changes": [{"col": "servants", "id": "s2", "data": sv(2, level=90)}, {"col": "servants", "id": "s3", "data": None}]})
    s, r, _ = A.get("/api/sync?since=5")
    got = {d["id"]: d["data"] for d in r["docs"]}
    check(f"and only what changed comes back: s2 levelled, s3 deleted ({got})", set(got) == {"s2", "s3"} and got["s2"]["level"] == 90 and got["s3"] is None and r["rev"] == 7)
    s, r, _ = anon.get("/api/sync?since=0")
    check("signed out: no roster", s == 401)
    s, r, _ = A.post("/api/sync", {"changes": [{"col": "servants", "id": "big", "data": {"x": "y" * 310000}}]})
    check("an entry over 300 KB is refused", s == 413)

    # ---------- pictures ----------
    png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
    s, r, _ = A.call("PUT", "/api/pics/img_abc123", raw=png, ctype="image/png")
    check(f"a picture uploads ({s} {r})", s == 200 and r["size"] == len(png))
    s, r, _ = A.call("PUT", "/api/pics/img_abc124", raw=b"<svg/>", ctype="image/svg+xml")
    check("only real picture types", s == 415)
    s, r, _ = A.get("/api/pics/%s/img_abc123" % a_id)
    check("and comes back to you", s == 200 and r == png)
    s, r, _ = B.get("/api/pics/%s/img_abc123" % a_id)
    check("not to someone who isn't a friend", s == 404)
    s, r, _ = A.get("/api/pics")
    check(f"your pictures and the space used ({r})", r["ids"] == ["img_abc123"] and r["bytes"] == len(png))

    # ---------- friends ----------
    s, r, _ = B.post("/api/friends", {"to": a_code[:3] + "," + a_code[3:6] + "," + a_code[6:]})
    check(f"a friend request by friend code, written the game's way ({r})", s == 200 and r["state"] == "asked" and r["friend"]["name"] == "Noyr")
    s, r, _ = A.get("/api/friends")
    check("it shows up as incoming", len(r["incoming"]) == 1 and r["incoming"][0]["id"] == b_id and not r["friends"])
    s, r, _ = B.get("/api/u/%s/roster" % a_id)
    check("before accepting, the roster stays closed", s == 404)
    s, r, _ = A.post("/api/friends/%s/accept" % b_id)
    s, r, _ = B.get("/api/friends")
    check("accepted: friends both ways", len(r["friends"]) == 1 and r["friends"][0]["name"] == "Noyr")
    s, r, _ = B.get("/api/u/%s/roster" % a_id)
    check(f"a friend opens the roster ({len(r.get('docs', []))} docs, no extras)", s == 200 and len(r["docs"]) == 3 and all(d["col"] != "extras" for d in r["docs"]))
    s, r, _ = B.get("/api/pics/%s/img_abc123" % a_id)
    check("and its pictures", s == 200)
    # 0.26.1: where a friend is in the story, from what their page remembers (only the position)
    check("no story position yet", r is not None and B.get("/api/u/%s/roster" % a_id)[1].get("story") is None)
    A.post("/api/sync", {"changes": [{"col": "extras", "id": "story", "data": {"v": json.dumps({"pos": {"w": 305, "q": 3000501, "ph": 2}, "theme": True, "part": "2"})}}]})
    s, r, h = B.get("/api/u/%s/roster" % a_id)
    check(f"the roster comes with where they are in the story ({r.get('story')}), and still no extras", r.get("story") == {"w": 305, "q": 3000501, "ph": 2} and len(r["docs"]) == 3)
    check(f"answers say HTTPS only and don't let content types be guessed ({h.get('strict-transport-security')})", h.get("strict-transport-security", "").startswith("max-age=31536000") and h.get("x-content-type-options") == "nosniff")
    s, r, _ = B.get("/api/friends")
    check(f"and so does the friends list ({r['friends'][0].get('story')})", r["friends"][0].get("story") == {"w": 305, "q": 3000501, "ph": 2})
    s, r, _ = A.post("/api/account", {"supports": ["s1", "s2", "nope"], "vis": "private"})
    check("supports and who sees the roster are saved", r["user"]["supports"] == ["s1", "s2", "nope"] and r["user"]["vis"] == "private")
    s, r, _ = B.get("/api/u/%s/roster" % a_id)
    check("private: friends can't open the roster", s == 404)
    s, r, _ = B.get("/api/friends")
    check("nor see where they are in the story", "story" not in r["friends"][0])
    s, r, _ = B.get("/api/u/%s" % a_id)
    check(f"but see the profile and the supports ({[x['id'] for x in r.get('supports', [])]})", s == 200 and r["user"]["roster"] is False and [x["id"] for x in r["supports"]] == ["s1", "s2"] and r["supports"][1]["data"]["level"] == 90)
    s, r, _ = B.get("/api/friends/supports")
    check("the calculator's list of friends' supports", s == 200 and r["friends"][0]["user"]["name"] == "Noyr" and len(r["friends"][0]["supports"]) == 2)
    s, r, _ = A.post("/api/account", {"vis": "link"})
    tok = r["user"]["share"]
    check(f"a link to share ({tok})", tok and len(tok) >= 20)
    s, r, _ = anon.get("/api/share/" + tok)
    check("the link says whose roster it is", s == 200 and r["user"]["name"] == "Noyr")
    s, r, _ = anon.get("/api/u/%s/roster?t=%s" % (a_id, tok))
    check("and opens it for anyone with the link", s == 200 and len(r["docs"]) == 3)
    s, r, _ = anon.get("/api/u/%s/roster?t=wrong%s" % (a_id, tok))
    check("not with a wrong token", s == 404)
    s, r, _ = A.post("/api/account", {"vis": "link", "newLink": True})
    s, r2, _ = anon.get("/api/u/%s/roster?t=%s" % (a_id, tok))
    check("a new link turns the old one off", r["user"]["share"] != tok and s == 404)
    s, r, _ = A.post("/api/account", {"vis": "friends"})

    # ---------- activity ----------
    A.post("/api/sync", {"changes": [{"col": "servants", "id": "s1", "data": sv(1, level=92, npLevel=2, skills=[10, 10, 10])}, {"col": "servants", "id": "s9", "data": sv(9, name="Tamamo")}]})
    s, r, _ = B.get("/api/feed")
    kinds = sorted(i["kind"] for i in r.get("items", []))
    check(f"friends see what happened: max level (from before), summoned, grailed, NP up, skills maxed ({kinds})", s == 200 and kinds == ["grail", "maxlevel", "np", "skills", "summoned"] and all(i["user"]["name"] == "Noyr" for i in r["items"]))
    A.post("/api/account", {"feed": False})
    A.post("/api/sync", {"changes": [{"col": "servants", "id": "s10", "data": sv(10)}]})
    s, r, _ = B.get("/api/feed")
    check("with activity turned off, nothing shows", r["items"] == [])
    A.post("/api/account", {"feed": True})
    s, r, _ = A.get("/api/feed")
    check("you don't see your own", r["items"] == [])
    s, r, _ = B.post("/api/friends/%s/remove" % a_id)
    s, r, _ = B.get("/api/u/%s/roster" % a_id)
    s2, r2, _ = B.get("/api/feed")
    check("unfriended: roster and activity are gone", s == 404 and r2["items"] == [])
    s, r, _ = B.post("/api/friends", {"to": "noyr"})
    s, r, _ = A.post("/api/friends", {"to": "Bazett"})
    check("asking someone who asked you makes you friends", r["state"] == "friends")
    s, r, _ = A.post("/api/friends", {"to": "nobody-at-all"})
    check("an unknown name says so", s == 404)

    # ---------- Discord and Google ----------
    D = Client(base)
    urllib.request.urlopen("http://127.0.0.1:%d/control?p=discord&sub=777&name=Rin%%20Tohsaka&email=rin@example.test&verified=1" % mport)
    res = D.oauth("discord")
    s, r, _ = D.get("/api/me")
    check(f"Discord sign-in makes a new account ({res}, {r['user'] and r['user']['name']})", res == "new_account" and r["user"]["name"] == "Rin Tohsaka" and r["user"]["hasPassword"] is False and r["user"]["idents"][0]["provider"] == "discord")
    d_id = r["user"]["id"]
    D2 = Client(base)
    res = D2.oauth("discord"); s, r, _ = D2.get("/api/me")
    check("the next time, the same account", res == "signed_in" and r["user"]["id"] == d_id)
    urllib.request.urlopen("http://127.0.0.1:%d/control?p=google&sub=g-55&name=Rin&email=rin2@example.test&verified=1" % mport)
    res = D.oauth("google", mode="link"); s, r, _ = D.get("/api/me")
    check(f"Google linked to it ({res})", res == "linked_google" and sorted(i["provider"] for i in r["user"]["idents"]) == ["discord", "google"])
    G = Client(base)
    urllib.request.urlopen("http://127.0.0.1:%d/control?p=google&sub=g-99&name=Imposter&email=noyr@example.test&verified=1" % mport)
    res = G.oauth("google"); s, r, _ = G.get("/api/me")
    check(f"an email that already has an account isn't taken over ({res})", res == "email_has_account" and r["user"] is None)
    s, r, _ = D.post("/api/account/unlink/discord")
    s, r, _ = D.post("/api/account/unlink/google")
    check("the last way to sign in can't be unlinked", s == 400 and r["error"] == "last_way")
    s, r, _ = D.post("/api/account/password", {"email": "rin@example.test", "newKey": key_of("rin@example.test", "gem magecraft")})
    check(f"a Discord account adds an email and password, and gets a recovery code ({r.get('recovery')})", s == 200 and r["user"]["hasPassword"] and r.get("recovery"))
    s, r, _ = D.post("/api/account/password", {"email": "rin3@example.test", "key": key_of("rin@example.test", "nope"), "newKey": key_of("rin3@example.test", "gem magecraft")})
    check("changing it needs the current password", s == 401)
    s, r, _ = D.post("/api/account/password", {"email": "rin3@example.test", "key": key_of("rin@example.test", "gem magecraft"), "newKey": key_of("rin3@example.test", "gem magecraft")})
    s2, r2, _ = Client(base).post("/api/auth/login", {"email": "rin3@example.test", "key": key_of("rin3@example.test", "gem magecraft")})
    check("with it, the email changes (and the password still works there)", s == 200 and s2 == 200)
    s, r, _ = D.get("/api/account/sessions")
    check(f"the devices signed in ({len(r.get('sessions', []))}, this one marked)", s == 200 and sum(1 for x in r["sessions"] if x["here"]) == 1)
    s, r, _ = D2.get("/api/me")
    check("changing the password signs out the other devices", r["user"] is None)

    # ---------- deleting ----------
    s, r, _ = A.post("/api/account/delete", {"confirm": "nope", "key": key_of("noyr@example.test", "new password 1")})
    check("deleting needs DELETE typed", s == 400)
    s, r, _ = A.post("/api/account/delete", {"confirm": "DELETE", "key": key_of("noyr@example.test", "wrong")})
    check("and the password", s == 401)
    s, r, _ = A.post("/api/account/delete", {"confirm": "delete", "key": key_of("noyr@example.test", "new password 1")})
    check("then the account is gone", s == 200)
    s, r, _ = A.get("/api/me"); s2, r2, _ = B.get("/api/friends"); s3, _, _ = B.get("/api/pics/%s/img_abc123" % a_id)
    check("with its session, friendships and pictures", r["user"] is None and not r2["friends"] and s3 == 404)
    s, r, _ = Client(base).post("/api/auth/login", {"email": "noyr@example.test", "key": key_of("noyr@example.test", "new password 1")})
    check("and it can't sign in any more", s == 401)

if __name__ == "__main__":
    main()
