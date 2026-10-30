/* Accounts and signing in.

   Passwords: the free Workers plan gives a request 10 ms of CPU, too little for a strong password hash on the server.
   So the browser does the slow part, the way Bitwarden does: it turns the password into a 256-bit key with PBKDF2-SHA256
   (600,000 rounds, salted with the email address; 41-account.js), and only that key is sent. The server keeps
   HMAC-SHA256(PEPPER, random salt + key): quick to check, useless without the PEPPER secret (which isn't in the
   database), and a stolen database still leaves 600,000 rounds per guess. No password ever reaches the server.

   No emails: Cloudflare sends email only on the paid plan, so an account gets a recovery code instead (shown once, at
   sign-up and after each use). Discord and Google sign-in work too, and can be linked to an account.

   Sessions: a random 256-bit token in an HttpOnly, SameSite=Lax cookie; the database keeps its sha-256. Every
   request that changes something must carry the X-FGI header, which a page on another site can't add without asking. */
import {fail, json, now, randomToken, randomBytes, b64url, unb64url, sha256hex, hmac, sameBytes, sameText, cookies, setCookie,
  normEmail, okEmail, cleanName, okName, nameKey, clientIp, body, randomId, clean} from "./util.js";

export const SESSION_DAYS = 90;
const COOKIE = "fgi_s", OCOOKIE = "fgi_o";
const DAY = 86400000;

function pepper(env) {
  const p = env.PEPPER;
  if (!p || String(p).length < 16) fail(503, "no_pepper", "Passwords aren't set up on this server yet (the PEPPER secret is missing).");
  return String(p);
}
const keyBytes = (key) => { let b; try { b = unb64url(key); } catch (e) { b = null; } if (!b || b.length !== 32) fail(400, "bad_key", "That password key isn't valid."); return b; };
async function pwHash(env, key) {
  const salt = randomBytes(16), k = keyBytes(key), m = new Uint8Array(48); m.set(salt); m.set(k, 16);
  return "v1$" + b64url(salt) + "$" + b64url(await hmac(pepper(env), m));
}
async function pwCheck(env, stored, key) {
  const [v, s, h] = String(stored || "").split("$");
  if (v !== "v1" || !s || !h) return false;
  let k; try { k = keyBytes(key); } catch (e) { return false; }
  const salt = unb64url(s), m = new Uint8Array(salt.length + 32); m.set(salt); m.set(k, salt.length);
  return sameBytes(await hmac(pepper(env), m), unb64url(h));
}
// recovery codes: 16 characters people can read out, in groups of four
const RC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newRecovery() { const b = randomBytes(16); let s = ""; for (let i = 0; i < 16; i++) s += RC[b[i] % RC.length]; return s.replace(/(.{4})(?=.)/g, "$1-"); }
const rcNorm = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const rcHash = async (env, c) => b64url(await hmac(pepper(env), "rc|" + rcNorm(c)));

// guessing passwords, codes or making many accounts gets slowed down: at most `limit` tries per window
export async function throttle(env, key, limit, windowMs) {
  const t = now();
  // now and then, old counters and ended sessions are cleared away
  if (Math.random() < 0.03) await env.DB.batch([env.DB.prepare("DELETE FROM throttle WHERE until < ?").bind(t), env.DB.prepare("DELETE FROM sessions WHERE expires < ?").bind(t)]);
  const row = await env.DB.prepare("SELECT n, until FROM throttle WHERE k = ?").bind(key).first();
  if (row && row.until > t && row.n >= limit) fail(429, "slow_down", "Too many tries. Wait " + Math.ceil((row.until - t) / 60000) + " minutes and try again.", {retry: Math.ceil((row.until - t) / 1000)});
  if (!row || row.until <= t) await env.DB.prepare("INSERT OR REPLACE INTO throttle (k, n, until) VALUES (?, 1, ?)").bind(key, t + windowMs).run();
  else await env.DB.prepare("UPDATE throttle SET n = n + 1 WHERE k = ?").bind(key).run();
}
const unthrottle = (env, key) => env.DB.prepare("DELETE FROM throttle WHERE k = ?").bind(key).run();

async function friendCode(env) {
  for (let i = 0; i < 12; i++) {
    const b = randomBytes(4), n = ((b[0] << 24 >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3]) % 900000000 + 100000000, code = String(n);
    if (!(await env.DB.prepare("SELECT 1 FROM users WHERE code = ?").bind(code).first())) return code;
  }
  fail(500, "busy", "Couldn't make a friend code. Try again.");
}
async function freeName(env, wanted) {
  let base = cleanName(wanted).replace(/[^\p{L}\p{N}_.\- ]+/gu, "").trim().slice(0, 16);
  if (base.length < 3) base = "Master";
  for (let i = 0; i < 20; i++) {
    const n = i ? base.slice(0, 16) + String(Math.floor(Math.random() * 9000) + 1000) : base;
    if (!(await env.DB.prepare("SELECT 1 FROM users WHERE name_key = ?").bind(nameKey(n)).first())) return n;
  }
  return "Master" + randomId(6);
}

export async function sessionUser(ctx) {
  if (ctx.user !== undefined) return ctx.user;
  ctx.user = null;
  const tok = cookies(ctx.request)[COOKIE]; if (!tok) return null;
  const id = await sha256hex(tok), t = now();
  const row = await ctx.env.DB.prepare("SELECT s.id AS sid, s.expires, s.seen AS sseen, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?").bind(id).first();
  if (!row || row.expires < t) return null;
  // a session lasts 90 days from its last use; noted at most twice a day
  if (!row.sseen || t - row.sseen > DAY / 2) {
    await ctx.env.DB.batch([ctx.env.DB.prepare("UPDATE sessions SET seen = ?, expires = ? WHERE id = ?").bind(t, t + SESSION_DAYS * DAY, id),
      ctx.env.DB.prepare("UPDATE users SET seen = ? WHERE id = ?").bind(t, row.id)]);
  }
  ctx.sid = id; ctx.user = row; return row;
}
export async function needUser(ctx) { const u = await sessionUser(ctx); if (!u) fail(401, "signed_out", "Sign in first."); return u; }
const secure = (ctx) => new URL(ctx.request.url).protocol === "https:";
async function startSession(ctx, userId) {
  const tok = randomToken(32), t = now();
  await ctx.env.DB.prepare("INSERT INTO sessions (id, user_id, created, seen, expires, agent) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(await sha256hex(tok), userId, t, t, t + SESSION_DAYS * DAY, clean(ctx.request.headers.get("user-agent"), 160)).run();
  return setCookie(COOKIE, tok, {maxAge: SESSION_DAYS * 86400, secure: secure(ctx)});
}
const endCookie = (ctx) => setCookie(COOKIE, "", {maxAge: 0, secure: secure(ctx)});

export function providers(env) {
  return {discord: !!(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET), google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), password: !!(env.PEPPER && String(env.PEPPER).length >= 16), pics: env.PICS ? "r2" : "d1"};
}
export async function me(ctx, u) {
  const idents = (await ctx.env.DB.prepare("SELECT provider, label FROM idents WHERE user_id = ?").bind(u.id).all()).results || [];
  let supports = []; try { supports = JSON.parse(u.supports || "[]"); } catch (e) {}
  return {id: u.id, name: u.name, email: u.email || null, code: u.code, vis: u.vis, share: u.vis === "link" ? u.share : null, feed: !!u.feed,
    supports: supports, idents: idents, hasPassword: !!u.pw, bytes: u.bytes || 0, created: u.created, rev: u.rev};
}

/* ---------- email and password ---------- */
export async function signup(ctx) {
  const env = ctx.env, b = await body(ctx.request, 4000);
  const name = cleanName(b.name), email = normEmail(b.email);
  if (!okName(name)) fail(400, "bad_name", "A name is 3–20 letters or digits (spaces, _ . - in between are fine).");
  if (!okEmail(email)) fail(400, "bad_email", "That email address doesn't look right.");
  pepper(env); keyBytes(b.key);
  await throttle(env, "signup:" + clientIp(ctx.request), 6, 3600000);
  if (await env.DB.prepare("SELECT 1 FROM users WHERE name_key = ?").bind(nameKey(name)).first()) fail(409, "name_taken", "Someone already has that name. Try another.");
  if (await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first()) fail(409, "email_taken", "That email already has an account. Sign in instead.");
  const id = randomId(), rc = newRecovery(), t = now();
  await env.DB.prepare("INSERT INTO users (id, name, name_key, email, pw, recovery, code, created, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, name, nameKey(name), email, await pwHash(env, b.key), await rcHash(env, rc), await friendCode(env), t, t).run();
  const ck = await startSession(ctx, id);
  const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  return json({user: await me(ctx, u), recovery: rc}, 200, {"set-cookie": ck});
}
export async function login(ctx) {
  const env = ctx.env, b = await body(ctx.request, 4000), email = normEmail(b.email);
  pepper(env);
  await throttle(env, "login-ip:" + clientIp(ctx.request), 30, 900000);
  await throttle(env, "login:" + email, 10, 900000);
  const u = email ? await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first() : null;
  if (!u || !u.pw || !(await pwCheck(env, u.pw, b.key))) fail(401, "wrong", "That email and password don't match an account.");
  await unthrottle(env, "login:" + email);
  return json({user: await me(ctx, u)}, 200, {"set-cookie": await startSession(ctx, u.id)});
}
export async function logout(ctx) {
  await sessionUser(ctx);
  if (ctx.sid) await ctx.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(ctx.sid).run();
  return json({ok: true}, 200, {"set-cookie": endCookie(ctx)});
}
// a forgotten password: the recovery code sets a new one (and a new code); every other device is signed out
export async function recover(ctx) {
  const env = ctx.env, b = await body(ctx.request, 4000), email = normEmail(b.email);
  pepper(env); keyBytes(b.key);
  await throttle(env, "recover-ip:" + clientIp(ctx.request), 10, 3600000);
  await throttle(env, "recover:" + email, 5, 3600000);
  const u = email ? await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first() : null;
  if (!u || !u.recovery || !sameText(await rcHash(env, b.code), u.recovery)) fail(401, "wrong_code", "That email and recovery code don't match.");
  const rc = newRecovery();
  await env.DB.batch([env.DB.prepare("UPDATE users SET pw = ?, recovery = ? WHERE id = ?").bind(await pwHash(env, b.key), await rcHash(env, rc), u.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id)]);
  await unthrottle(env, "recover:" + email);
  return json({user: await me(ctx, u), recovery: rc}, 200, {"set-cookie": await startSession(ctx, u.id)});
}
// signed in: proves it's really you before something big (a new password, deleting the account)
async function confirmed(ctx, u, b) {
  if (!u.pw) return true; // Discord/Google only: being signed in is the proof
  await throttle(ctx.env, "confirm:" + u.id, 10, 900000);
  if (!(await pwCheck(ctx.env, u.pw, b.key))) fail(401, "wrong", "That password isn't right.");
  return true;
}
// add or change email and password (the key is derived from the new email, so changing the email needs the password too)
export async function setPassword(ctx) {
  const env = ctx.env, u = await needUser(ctx), b = await body(ctx.request, 4000), email = normEmail(b.email);
  if (!okEmail(email)) fail(400, "bad_email", "That email address doesn't look right.");
  keyBytes(b.newKey);
  await confirmed(ctx, u, b);
  if (email !== u.email && await env.DB.prepare("SELECT 1 FROM users WHERE email = ? AND id <> ?").bind(email, u.id).first()) fail(409, "email_taken", "Another account uses that email.");
  const first = !u.pw, rc = first ? newRecovery() : null;
  await env.DB.batch([env.DB.prepare("UPDATE users SET email = ?, pw = ?" + (rc ? ", recovery = ?" : "") + " WHERE id = ?").bind(...[email, await pwHash(env, b.newKey)].concat(rc ? [await rcHash(env, rc)] : []).concat([u.id])),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").bind(u.id, ctx.sid)]);
  const nu = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first();
  return json({user: await me(ctx, nu), recovery: rc});
}
export async function newRecoveryCode(ctx) {
  const env = ctx.env, u = await needUser(ctx), b = await body(ctx.request, 4000);
  if (!u.pw) fail(400, "no_password", "A recovery code is for a password. Add an email and password first.");
  await confirmed(ctx, u, b);
  const rc = newRecovery();
  await env.DB.prepare("UPDATE users SET recovery = ? WHERE id = ?").bind(await rcHash(env, rc), u.id).run();
  return json({recovery: rc});
}
export async function sessions(ctx) {
  const u = await needUser(ctx);
  const rows = (await ctx.env.DB.prepare("SELECT id, created, seen, agent FROM sessions WHERE user_id = ? AND expires > ? ORDER BY seen DESC").bind(u.id, now()).all()).results || [];
  return json({sessions: rows.map((r) => ({here: r.id === ctx.sid, created: r.created, seen: r.seen, agent: r.agent}))});
}
export async function signOutOthers(ctx) {
  const u = await needUser(ctx);
  await ctx.env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").bind(u.id, ctx.sid).run();
  return json({ok: true});
}
export async function unlink(ctx, provider) {
  const u = await needUser(ctx);
  const n = (await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM idents WHERE user_id = ?").bind(u.id).first()).n;
  if (!u.pw && n <= 1) fail(400, "last_way", "That's your only way to sign in. Add an email and password first.");
  await ctx.env.DB.prepare("DELETE FROM idents WHERE user_id = ? AND provider = ?").bind(u.id, provider).run();
  return json({user: await me(ctx, u)});
}
// everything goes: roster, pictures, friends, activity, sessions
export async function deleteAccount(ctx) {
  const env = ctx.env, u = await needUser(ctx), b = await body(ctx.request, 4000);
  if (clean(b.confirm, 20).toUpperCase() !== "DELETE") fail(400, "confirm", "Type DELETE to confirm.");
  await confirmed(ctx, u, b);
  if (env.PICS) {
    let cursor;
    do { const l = await env.PICS.list({prefix: "u/" + u.id + "/", cursor}); if (l.objects.length) await env.PICS.delete(l.objects.map((o) => o.key)); cursor = l.truncated ? l.cursor : null; } while (cursor);
  }
  await env.DB.batch(["DELETE FROM docs WHERE user_id = ?", "DELETE FROM pics WHERE user_id = ?", "DELETE FROM activity WHERE user_id = ?",
    "DELETE FROM friends WHERE a = ? OR b = ?", "DELETE FROM idents WHERE user_id = ?", "DELETE FROM sessions WHERE user_id = ?", "DELETE FROM users WHERE id = ?"]
    .map((sql) => sql.includes("a = ? OR b = ?") ? env.DB.prepare(sql).bind(u.id, u.id) : env.DB.prepare(sql).bind(u.id)));
  return json({ok: true}, 200, {"set-cookie": endCookie(ctx)});
}

/* ---------- Discord and Google ---------- */
const OAUTH = {
  discord: {auth: "https://discord.com/oauth2/authorize", token: "https://discord.com/api/oauth2/token", user: "https://discord.com/api/users/@me", scope: "identify email",
    who: (j) => ({sub: String(j.id), name: j.global_name || j.username, label: j.username, email: j.verified && j.email ? normEmail(j.email) : null})},
  google: {auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", user: "https://openidconnect.googleapis.com/v1/userinfo", scope: "openid email profile",
    who: (j) => ({sub: String(j.sub), name: j.given_name || j.name || "", label: j.email || j.name, email: j.email_verified && j.email ? normEmail(j.email) : null})}
};
function oauthConf(env, p) {
  const c = OAUTH[p]; if (!c) fail(404, "no_provider", "Unknown sign-in.");
  const id = env[p.toUpperCase() + "_CLIENT_ID"], secret = env[p.toUpperCase() + "_CLIENT_SECRET"];
  if (!id || !secret) fail(503, "not_set_up", p === "discord" ? "Discord sign-in isn't set up on this server yet." : "Google sign-in isn't set up on this server yet.");
  // tests point the three addresses at a stand-in (never set on the real site)
  const base = env.OAUTH_MOCK ? String(env.OAUTH_MOCK).replace(/\/$/, "") + "/" + p : null;
  return Object.assign({}, c, {id, secret}, base ? {auth: base + "/authorize", token: base + "/token", user: base + "/user"} : {});
}
const back = (ctx, msg) => new Response(null, {status: 302, headers: {location: new URL("/?" + new URLSearchParams({account: msg}).toString() + "#account", ctx.request.url).toString()}});
export async function oauthStart(ctx, p) {
  const c = oauthConf(ctx.env, p), url = new URL(ctx.request.url), mode = url.searchParams.get("mode") === "link" ? "link" : "login";
  if (mode === "link") await needUser(ctx);
  const state = randomToken(18), verifier = randomToken(32);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const q = new URLSearchParams({client_id: c.id, redirect_uri: url.origin + "/api/auth/" + p + "/callback", response_type: "code", scope: c.scope, state, code_challenge: challenge, code_challenge_method: "S256"});
  if (p === "google") q.set("prompt", "select_account");
  const res = new Response(null, {status: 302, headers: {location: c.auth + "?" + q.toString()}});
  res.headers.append("set-cookie", setCookie(OCOOKIE, [p, state, verifier, mode].join("."), {maxAge: 600, path: "/api/auth/", secure: secure(ctx)}));
  return res;
}
export async function oauthCallback(ctx, p) {
  const env = ctx.env, url = new URL(ctx.request.url), c = oauthConf(env, p);
  const [cp, state, verifier, mode] = String(cookies(ctx.request)[OCOOKIE] || "").split(".");
  const clear = setCookie(OCOOKIE, "", {maxAge: 0, path: "/api/auth/", secure: secure(ctx)});
  const done = (msg, extra) => { const r = back(ctx, msg); r.headers.append("set-cookie", clear); if (extra) r.headers.append("set-cookie", extra); return r; };
  if (url.searchParams.get("error")) return done("cancelled");
  if (cp !== p || !state || !sameText(state, url.searchParams.get("state"))) return done("expired");
  const tr = await fetch(c.token, {method: "POST", headers: {"content-type": "application/x-www-form-urlencoded", accept: "application/json"},
    body: new URLSearchParams({client_id: c.id, client_secret: c.secret, grant_type: "authorization_code", code: url.searchParams.get("code") || "", redirect_uri: url.origin + "/api/auth/" + p + "/callback", code_verifier: verifier})});
  const tj = tr.ok ? await tr.json() : null;
  if (!tj || !tj.access_token) return done("failed");
  const ur = await fetch(c.user, {headers: {authorization: "Bearer " + tj.access_token, accept: "application/json"}});
  const who = ur.ok ? c.who(await ur.json()) : null;
  if (!who || !who.sub || who.sub === "undefined") return done("failed");
  const label = clean(who.label, 80), found = await env.DB.prepare("SELECT user_id FROM idents WHERE provider = ? AND sub = ?").bind(p, who.sub).first();
  const cur = await sessionUser(ctx);
  if (mode === "link") {
    if (!cur) return done("signed_out");
    if (found && found.user_id !== cur.id) return done("linked_elsewhere");
    if (!found) await env.DB.prepare("INSERT INTO idents (provider, sub, user_id, label, created) VALUES (?, ?, ?, ?, ?)").bind(p, who.sub, cur.id, label, now()).run();
    return done("linked_" + p);
  }
  if (found) return done("signed_in", await startSession(ctx, found.user_id));
  // a new account; an email that already has one isn't taken over: sign in there and link this from the account page
  if (who.email && await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(who.email).first()) return done("email_has_account");
  await throttle(env, "signup:" + clientIp(ctx.request), 6, 3600000);
  const id = randomId(), name = await freeName(env, who.name || label || "Master"), t = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, name, name_key, email, code, created, seen) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, name, nameKey(name), who.email, await friendCode(env), t, t),
    env.DB.prepare("INSERT INTO idents (provider, sub, user_id, label, created) VALUES (?, ?, ?, ?, ?)").bind(p, who.sub, id, label, t)]);
  return done("new_account", await startSession(ctx, id));
}
