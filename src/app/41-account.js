/* ================= 0.26.0: accounts (the hosted site) =================
   The page asks /api/me whether a server is there (Cloudflare Pages with server/ behind it). Without one (the file on
   your computer, or a host with no /api/), nothing here shows and the roster stays in this browser as before.

   Signing in: email + password, Discord or Google (whichever the server has set up). The password never leaves the
   browser: it's turned into a key with PBKDF2-SHA256, 600,000 rounds, salted with the email (pwKey), and only the key
   is sent (server/auth.js explains why). There are no emails, so a new account gets a recovery code, shown once.

   The account window (#acct, the Craft Essence picker's panel) has: sign in / create / forgot; the recovery code; and,
   signed in: name, friend code, sync, who sees the roster, activity, ways to sign in, devices, the app, sign out and
   deleting the account. The button in the header opens it; #account in the address does too. */
const API = {on: false, user: null, prov: {}, checked: false, offline: false};
const ACCT_MSG = {
  signed_in: "Signed in.", new_account: "Welcome! Your account is ready.", linked_discord: "Discord is linked to your account now.",
  linked_google: "Google is linked to your account now.", cancelled: "Sign-in cancelled.", expired: "That sign-in took too long. Try again.",
  failed: "Couldn't sign in that way. Try again in a moment.", signed_out: "Sign in first, then link it.",
  email_has_account: "That email already has an account here. Sign in with its password, then link this from your account.",
  linked_elsewhere: "That account is already linked to another Master here."
};
async function api(method, path, data) {
  const o = {method: method, credentials: "same-origin", headers: {}};
  if (method !== "GET" && method !== "HEAD") o.headers["x-fgi"] = "1";
  if (data instanceof Blob) { o.body = data; o.headers["content-type"] = data.type || "application/octet-stream"; }
  else if (data !== undefined) { o.body = JSON.stringify(data); o.headers["content-type"] = "application/json"; }
  let r;
  try { r = await fetch("/api/" + path, o); } catch (e) { throw {status: 0, error: "offline", message: "No connection to the server right now. Everything stays saved here and syncs later."}; }
  const j = (r.headers.get("content-type") || "").includes("json") ? await r.json().catch(() => null) : null;
  if (!r.ok) {
    if (r.status === 401 && j && j.error === "signed_out" && API.user) acctSignedOut(true);
    throw Object.assign({status: r.status}, j || {error: "http", message: "The server answered " + r.status + ". Try again in a moment."});
  }
  return j;
}
const b64url = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function pwKey(email, pw) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return b64url(await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: enc.encode("fgi-v1:" + String(email).trim().toLowerCase()), iterations: 600000}, k, 256));
}
const fmtCode = (c) => String(c || "").replace(/(\d{3})(\d{3})(\d{3})/, "$1,$2,$3");

/* ---------- start ---------- */
async function acctInit() {
  if (!HOSTED) { API.checked = true; return; }
  const q = new URLSearchParams(location.search), msg = q.get("account");
  if (msg) { q.delete("account"); history.replaceState(history.state, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash); }
  try {
    const j = await api("GET", "me");
    API.on = true; API.checked = true; API.user = j.user; API.prov = j.providers || {};
  } catch (e) {
    API.checked = true;
    // offline: an account this browser was signed in to keeps working here, and syncs when the connection is back
    if (e.status === 0 && syncState().uid) { API.on = true; API.offline = true; API.user = syncState().user || {id: syncState().uid, name: "you"}; }
  }
  acctPaint();
  if (!API.on) return;
  if (msg && ACCT_MSG[msg]) toast(ACCT_MSG[msg]);
  if (API.user) syncStart(msg === "new_account" || msg === "signed_in");
  if (location.hash === "#account" || (msg && msg !== "signed_in")) acctOpen(API.user ? "home" : "signin");
}
window.addEventListener("online", () => { if (API.offline) { API.offline = false; acctInit(); } });

/* ---------- the header button and the footer line ---------- */
function acctBtnHTML() {
  if (!API.on) return "";
  const u = API.user, st = typeof SYNC !== "undefined" ? SYNC.state : "off";
  const dot = u ? `<i class="sync-dot s-${esc(st)}" aria-hidden="true"></i>` : "";
  return u ? `<span class="acct-av" aria-hidden="true">${esc((u.name || "?").slice(0, 1).toUpperCase())}</span><span class="acct-nm">${esc(u.name)}</span>${dot}` : `<span>Sign in</span>`;
}
function acctPaint() {
  let b = document.getElementById("acct-btn");
  if (API.on && !b) {
    const host = document.querySelector(".mast-actions"); if (!host) return;
    host.insertAdjacentHTML("afterbegin", `<button type="button" id="acct-btn" class="btn acct-btn" data-action="acct"></button>`);
    b = document.getElementById("acct-btn");
  }
  if (b) {
    b.hidden = !API.on; b.innerHTML = acctBtnHTML();
    const st = typeof SYNC !== "undefined" ? syncWords() : "";
    b.title = API.user ? "Your account: " + API.user.name + (st ? " · " + st : "") : "Sign in or create an account";
    b.setAttribute("aria-label", b.title);
    b.classList.toggle("in", !!API.user);
  }
  // the footer's list of pages gets Friends once the site has accounts
  if (API.on && typeof foot !== "undefined" && !foot.querySelector('[data-tab="friends"]')) { foot.innerHTML = footHTML(); renderFoot26(); }
  const f = document.querySelector(".sf-acct");
  if (f && API.on) f.innerHTML = API.user ? `<span class="sf-pill on">Account</span> <span>Signed in as <b>${esc(API.user.name)}</b>. ${esc(syncWords())}</span>`
    : `<span class="sf-pill">Local save</span> <span><button type="button" class="linkish" data-action="acct">Sign in</button> to sync your roster to every device and add friends.</span>`;
  appInstallPaint();
  if (!ACCT.root.hidden && ACCT.view === "home") acctRender();
}
const renderFoot26 = renderFoot;
renderFoot = function () { const r = renderFoot26.apply(this, arguments); acctPaint(); return r; };

/* ---------- the window ---------- */
const ACCT = {root: document.createElement("div"), view: "signin", busy: false, err: "", code: null, after: null, sessions: null, open: {}};
ACCT.root.className = "acct"; ACCT.root.hidden = true; ACCT.root.setAttribute("role", "dialog"); ACCT.root.setAttribute("aria-modal", "true"); ACCT.root.setAttribute("aria-labelledby", "acct-t");
document.body.appendChild(ACCT.root);
function acctOpen(view) {
  if (!API.on) return;
  ACCT.view = view || (API.user ? "home" : "signin"); ACCT.err = ""; ACCT.back = ACCT.root.hidden ? document.activeElement : ACCT.back;
  ACCT.root.hidden = false; document.documentElement.classList.add("cep-open");
  acctRender(true);
  if (ACCT.view === "home" && API.user && !API.offline) acctSessions();
}
function acctClose() {
  if (ACCT.root.hidden) return;
  if (ACCT.view === "code" && !ACCT.codeOk) { ACCT.err = "Save the recovery code first, then tick the box."; acctRender(); return; }
  ACCT.root.hidden = true; ACCT.root.innerHTML = ""; document.documentElement.classList.remove("cep-open");
  if (location.hash === "#account") history.replaceState(history.state, "", location.pathname + location.search);
  const b = ACCT.back; ACCT.back = null; if (b && b.isConnected && b.focus) b.focus({preventScroll: true});
  const next = ACCT.after; ACCT.after = null; if (next) next();
}
const field = (id, label, type, extra) => `<label class="acct-f" for="${id}"><span>${label}</span><input id="${id}" class="field-input" type="${type}" ${extra || ""}></label>`;
function oauthHTML(mode) {
  const p = API.prov || {}; if (!p.discord && !p.google) return "";
  const q = mode === "link" ? "?mode=link" : "";
  return `<div class="acct-oauth">${p.discord ? `<a class="btn acct-o discord" href="/api/auth/discord${q}"><i aria-hidden="true">${ICON_DISCORD}</i>${mode === "link" ? "Link Discord" : "Continue with Discord"}</a>` : ""}${p.google ? `<a class="btn acct-o google" href="/api/auth/google${q}"><i aria-hidden="true">${ICON_GOOGLE}</i>${mode === "link" ? "Link Google" : "Continue with Google"}</a>` : ""}</div>`;
}
const ICON_DISCORD = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19.6 5.3A16.6 16.6 0 0 0 15.5 4l-.5 1a15.3 15.3 0 0 0-6 0l-.5-1a16.6 16.6 0 0 0-4.1 1.3C1.8 9.2 1.1 13 1.4 16.8a16.7 16.7 0 0 0 5 2.6l1.1-1.7a10.8 10.8 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 11.6 0l.4.3a10.8 10.8 0 0 1-1.7.8l1.1 1.7a16.6 16.6 0 0 0 5-2.6c.4-4.4-.7-8.2-3-11.5ZM8.5 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg>`;
const ICON_GOOGLE = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.4-.2-2.1H12v4h6a5.1 5.1 0 0 1-2.2 3.4v2.7h3.6c2-1.9 3.2-4.7 3.2-8Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"/></svg>`;
const WHAT_KEPT = `<details class="acct-what"><summary>What an account keeps, and where</summary>
  <p>Your name, email, the key your password is turned into (never the password itself), your roster (servants, parties, Guests, the progress log and the other things the page remembers for you), the pictures you upload, your friends and what they see of your activity. It's kept by this site on Cloudflare. Nothing is sold or shown to anyone you haven't made friends with or given your link to.</p>
  <p>Signed in with Discord or Google, the site gets your account's id, name and email from them, nothing else. You can delete your account at any time from this window: everything above goes with it.</p></details>`;
function acctBody() {
  const v = ACCT.view, u = API.user, err = ACCT.err ? `<p class="acct-err" role="alert">${esc(ACCT.err)}</p>` : "", busy = ACCT.busy ? " disabled" : "";
  const pwOk = API.prov.password !== false;
  if (v === "signin" || v === "signup") {
    const up = v === "signup";
    return `<p class="acct-lead">${up ? "An account keeps your roster in sync on every device, and lets you add friends." : "Sign in to sync your roster to every device and to see your friends."}</p>
      ${oauthHTML("login")}
      ${pwOk ? `${API.prov.discord || API.prov.google ? `<p class="acct-or"><span>or with email</span></p>` : ""}
      <div class="seg acct-seg" role="group" aria-label="Sign in or create an account"><button type="button" data-action="acct-view" data-v="signin" aria-pressed="${!up}">Sign in</button><button type="button" data-action="acct-view" data-v="signup" aria-pressed="${up}">Create an account</button></div>
      <form class="acct-form" data-acct-form="${v}" autocomplete="on">
        ${up ? field("acct-name", "Name your friends see <small>3–20 letters or digits</small>", "text", 'autocomplete="nickname" maxlength="20" required') : ""}
        ${field("acct-email", "Email", "email", 'autocomplete="email" required')}
        ${field("acct-pw", up ? "Password <small>10 characters or more</small>" : "Password", "password", `autocomplete="${up ? "new-password" : "current-password"}" minlength="${up ? 10 : 1}" required`)}
        <label class="acct-chk"><input type="checkbox" data-acct-show> Show the password</label>
        ${err}
        <div class="acct-acts"><button type="submit" class="btn primary"${busy}>${ACCT.busy ? (up ? "Creating your account…" : "Signing in…") : up ? "Create my account" : "Sign in"}</button>
        ${up ? "" : `<button type="button" class="linkish" data-action="acct-view" data-v="recover">Forgot your password?</button>`}</div>
        ${up ? `<p class="acct-note">No emails are sent: you get a recovery code instead, for a forgotten password.</p>` : ""}
      </form>` : err}
      ${WHAT_KEPT}`;
  }
  if (v === "recover") return `<p class="acct-lead">With the recovery code you got when you made your account, you can set a new password. Every device that's signed in gets signed out, and you get a new code.</p>
      <form class="acct-form" data-acct-form="recover">
        ${field("acct-email", "Email", "email", 'autocomplete="email" required')}
        ${field("acct-rc", "Recovery code", "text", 'autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" required')}
        ${field("acct-pw", "New password <small>10 characters or more</small>", "password", 'autocomplete="new-password" minlength="10" required')}
        ${err}<div class="acct-acts"><button type="submit" class="btn primary"${busy}>${ACCT.busy ? "Setting it…" : "Set the new password"}</button><button type="button" class="linkish" data-action="acct-view" data-v="signin">Back to signing in</button></div>
      </form>
      <p class="acct-note">No code? Signed up with Discord or Google too? Sign in with those instead. Otherwise the password can't be recovered: no one, not even the site, can see it.</p>`;
  if (v === "code") return `<p class="acct-lead"><b>Your recovery code.</b> Keep it somewhere safe (a password manager, a note on your phone). If you forget your password, it's the only way back into the account. It's shown this once.</p>
      <p class="acct-code"><code id="acct-code">${esc(ACCT.code)}</code></p>
      <div class="acct-acts"><button type="button" class="btn sm" data-action="acct-copy" data-copy="${esc(ACCT.code)}">Copy</button><button type="button" class="btn sm" data-action="acct-code-file">Save as a text file</button></div>
      <label class="acct-chk"><input type="checkbox" data-acct-codeok${ACCT.codeOk ? " checked" : ""}> I've saved my recovery code</label>
      ${err}<div class="acct-acts"><button type="button" class="btn primary" data-action="acct-code-done"${ACCT.codeOk ? "" : " disabled"}>Continue</button></div>`;
  if (v === "merge") return syncMergeHTML();
  if (!u) return "";
  return acctHomeHTML(u);
}
function acctHomeHTML(u) {
  const err = ACCT.err ? `<p class="acct-err" role="alert">${esc(ACCT.err)}</p>` : "", O = ACCT.open, prov = API.prov || {};
  const has = (p) => (u.idents || []).some((i) => i.provider === p), lab = (p) => ((u.idents || []).find((i) => i.provider === p) || {}).label || "";
  const visOpt = (k, t, d) => `<label class="acct-radio"><input type="radio" name="acct-vis" value="${k}"${u.vis === k ? " checked" : ""}><span><b>${t}</b><small>${d}</small></span></label>`;
  const link = u.vis === "link" && u.share ? location.origin + location.pathname + "?roster=" + u.share : "";
  const ways = [];
  ways.push(`<li><b>Email and password</b> ${u.hasPassword ? `<span>${esc(u.email || "")}</span> <button type="button" class="linkish" data-action="acct-toggle" data-k="pw">Change</button>` : `<button type="button" class="linkish" data-action="acct-toggle" data-k="pw">Add an email and password</button>`}</li>`);
  ["discord", "google"].forEach((p) => {
    if (!prov[p] && !has(p)) return;
    const name = p === "discord" ? "Discord" : "Google";
    ways.push(`<li><b>${name}</b> ${has(p) ? `<span>${esc(lab(p))}</span> <button type="button" class="linkish" data-action="acct-unlink" data-p="${p}">Unlink</button>` : `<a class="linkish" href="/api/auth/${p}?mode=link">Link ${name}</a>`}</li>`);
  });
  const pwForm = O.pw ? `<form class="acct-form acct-inline" data-acct-form="password">
      ${u.hasPassword ? field("acct-cur", "Current password", "password", 'autocomplete="current-password" required') : ""}
      ${field("acct-email", "Email", "email", `autocomplete="email" required value="${esc(u.email || "")}"`)}
      ${field("acct-pw", (u.hasPassword ? "New password" : "Password") + " <small>10 characters or more</small>", "password", 'autocomplete="new-password" minlength="10" required')}
      <div class="acct-acts"><button type="submit" class="btn primary sm"${ACCT.busy ? " disabled" : ""}>${ACCT.busy ? "Saving…" : "Save"}</button><button type="button" class="linkish" data-action="acct-toggle" data-k="pw">Cancel</button></div>
      <p class="acct-note">Your other devices get signed out.</p></form>` : "";
  const ses = ACCT.sessions;
  return `<section class="acct-sec acct-me">
      <div class="acct-id"><span class="acct-av big" aria-hidden="true">${esc(u.name.slice(0, 1).toUpperCase())}</span>
        <div>${O.name ? `<form class="acct-namef" data-acct-form="name"><input id="acct-name" class="field-input" value="${esc(u.name)}" maxlength="20" aria-label="Your name"><button type="submit" class="btn sm primary">Save</button><button type="button" class="linkish" data-action="acct-toggle" data-k="name">Cancel</button></form>`
          : `<h3>${esc(u.name)} <button type="button" class="linkish" data-action="acct-toggle" data-k="name">Rename</button></h3>`}
        <p>Friend code <b class="acct-fc">${fmtCode(u.code)}</b> <button type="button" class="linkish" data-action="acct-copy" data-copy="${esc(fmtCode(u.code))}">Copy</button></p></div></div>
      ${err}
    </section>
    <section class="acct-sec"><h4>Sync</h4><p class="acct-sync">${esc(syncWords(true))}</p>
      <div class="acct-acts">${SYNC.state === "wait" ? `<button type="button" class="btn primary sm" data-action="acct-view" data-v="merge">Choose how to sync this browser</button>` : ""}<button type="button" class="btn sm" data-action="sync-now"${SYNC.state === "busy" || API.offline ? " disabled" : ""}>Sync now</button>${SYNC.pics ? `<span class="acct-note">${esc(SYNC.pics)}</span>` : ""}</div></section>
    <section class="acct-sec"><h4>Who can see your roster</h4>
      <div class="acct-vis" role="radiogroup" aria-label="Who can see your roster">${visOpt("private", "Only me", "Friends still see your supports.")}${visOpt("friends", "My friends", "Friends can open your roster to look (not change).")}${visOpt("link", "Friends, and anyone with my link", "For sharing outside the site, e.g. in a Discord chat.")}</div>
      ${link ? `<div class="acct-link"><input class="field-input" readonly value="${esc(link)}" aria-label="Your roster's link"><button type="button" class="btn sm" data-action="acct-copy" data-copy="${esc(link)}">Copy</button><button type="button" class="linkish" data-action="acct-newlink">New link</button></div><p class="acct-note">A new link turns the old one off.</p>` : ""}
      <label class="acct-chk"><input type="checkbox" data-acct-feed${u.feed ? " checked" : ""}> Show my friends what I summon, grail and max out</label></section>
    <section class="acct-sec"><h4>Ways to sign in</h4><ul class="acct-ways">${ways.join("")}</ul>${pwForm}
      ${u.hasPassword ? (O.rc ? `<form class="acct-form acct-inline" data-acct-form="recovery">${field("acct-cur", "Password", "password", 'autocomplete="current-password" required')}<div class="acct-acts"><button type="submit" class="btn sm primary">Make a new recovery code</button><button type="button" class="linkish" data-action="acct-toggle" data-k="rc">Cancel</button></div><p class="acct-note">The old code stops working.</p></form>`
        : `<p class="acct-note">Lost your recovery code? <button type="button" class="linkish" data-action="acct-toggle" data-k="rc">Make a new one</button></p>`) : ""}</section>
    <section class="acct-sec"><h4>Signed in on</h4>${ses ? `<ul class="acct-devs">${ses.map((x) => `<li>${esc(devName(x.agent))}${x.here ? " <b>(this one)</b>" : ""}<small>last used ${esc(dayStr(new Date(x.seen || x.created).toISOString()))}</small></li>`).join("")}</ul>
      ${ses.length > 1 ? `<button type="button" class="btn sm" data-action="acct-endothers">Sign out everywhere else</button>` : ""}` : `<p class="acct-note">…</p>`}</section>
    <section class="acct-sec"><h4>The app</h4><p class="acct-note">${APP.installed ? "You're using the installed app." : "Install Fate/Grand Index as an app: it opens from your home screen or apps list and works offline."}</p><div data-app-install-slot="btn sm">${appInstallHTML("btn sm")}</div></section>
    <section class="acct-sec acct-out"><button type="button" class="btn" data-action="acct-signout">Sign out</button><p class="acct-note">Your roster stays in this browser after signing out.</p></section>
    <section class="acct-sec acct-danger">${O.del ? `<form class="acct-form acct-inline" data-acct-form="delete"><p><b>Delete your account?</b> Your roster, uploaded pictures, friends and activity are removed from the server for good. This browser keeps its copy of the roster.</p>
        ${u.hasPassword ? field("acct-cur", "Password", "password", 'autocomplete="current-password" required') : ""}${field("acct-del", "Type DELETE to confirm", "text", 'autocomplete="off" required')}
        <div class="acct-acts"><button type="submit" class="btn danger solid sm">Delete my account</button><button type="button" class="linkish" data-action="acct-toggle" data-k="del">Cancel</button></div></form>`
      : `<button type="button" class="linkish acct-del" data-action="acct-toggle" data-k="del">Delete my account…</button>`}</section>`;
}
function devName(ua) {
  const s = String(ua || "");
  const os = /iPhone/.test(s) ? "iPhone" : /iPad/.test(s) ? "iPad" : /Android/.test(s) ? "Android" : /Windows/.test(s) ? "Windows" : /Mac OS X/.test(s) ? "Mac" : /Linux/.test(s) ? "Linux" : "A device";
  const br = /Edg\//.test(s) ? "Edge" : /OPR\//.test(s) ? "Opera" : /Firefox\//.test(s) ? "Firefox" : /Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "";
  return os + (br ? " · " + br : "");
}
function acctRender(full) {
  if (ACCT.root.hidden) return;
  const t = {signin: "Sign in", signup: "Create an account", recover: "Forgot your password", code: "Your recovery code", merge: "Sync this browser", home: "Your account"}[ACCT.view] || "Your account";
  const keep = !full && ACCT.root.querySelector(".acct-body");
  const st = keep ? keep.scrollTop : 0, act = document.activeElement && document.activeElement.id;
  // what was typed stays typed when the window redraws (an error, a busy button)
  const typed = {}; ACCT.root.querySelectorAll("input[id]").forEach((i) => { if (i.type !== "checkbox" && i.type !== "radio" && !i.readOnly && (!full || i.id === "acct-email")) typed[i.id] = i.value; });
  ACCT.root.innerHTML = `<div class="cep-veil" data-acct-close></div><div class="cep-panel acct-panel">
    <header class="cep-head"><h2 id="acct-t">${t}</h2><button type="button" class="cep-x" data-acct-close aria-label="Close">×</button></header>
    <div class="cep-body acct-body">${acctBody()}</div></div>`;
  Object.keys(typed).forEach((id) => { const i = document.getElementById(id); if (i && ACCT.root.contains(i) && typed[id]) i.value = typed[id]; });
  const b = ACCT.root.querySelector(".acct-body"); if (b) b.scrollTop = st;
  const f = (act && document.getElementById(act)) || (full && ACCT.root.querySelector("input:not([type=checkbox]):not([type=radio]):not([readonly]), .acct-panel button.btn"));
  if (f && f.focus) f.focus({preventScroll: true});
}
function acctErr(e) { ACCT.busy = false; ACCT.err = (e && e.message) || "Something went wrong. Try again."; acctRender(); }
async function acctSignedIn(j, fresh) {
  API.user = j.user; ACCT.busy = false; ACCT.err = ""; ACCT.open = {};
  acctPaint();
  if (j.recovery) { ACCT.code = j.recovery; ACCT.codeOk = false; ACCT.view = "code"; acctRender(true); ACCT.afterCode = () => syncStart(true); return; }
  syncStart(fresh !== false);
}
function acctSignedOut(expired) {
  API.user = null; syncStop(); acctPaint();
  if (expired) toast("You were signed out (on another device, or the session ran out). Sign in again to sync.");
  if (!ACCT.root.hidden) { ACCT.view = "signin"; acctRender(true); }
}
async function acctSessions() {
  try { const j = await api("GET", "account/sessions"); ACCT.sessions = j.sessions; if (ACCT.view === "home") acctRender(); } catch (e) {}
}

/* ---------- what the window does ---------- */
ACCT.root.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.closest("[data-acct-close]")) { acctClose(); return; }
  const b = t.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action;
  if (a === "acct-view") { ACCT.view = b.dataset.v; ACCT.err = ""; acctRender(true); return; }
  if (a === "acct-toggle") { ACCT.open[b.dataset.k] = !ACCT.open[b.dataset.k]; ACCT.err = ""; acctRender(); const i = ACCT.root.querySelector(".acct-inline input, .acct-namef input"); if (i && ACCT.open[b.dataset.k]) i.focus(); return; }
  if (a === "acct-copy") { try { await navigator.clipboard.writeText(b.dataset.copy); toast("Copied."); } catch (er) { toast("Select it and copy it by hand."); } return; }
  if (a === "acct-code-file") { S.downloads.save({filename: "fate-grand-index-recovery-code.txt", data: new Blob(["Fate/Grand Index recovery code for " + (API.user ? API.user.name + " (" + (API.user.email || "") + ")" : "your account") + ":\n\n" + ACCT.code + "\n\nKeep it safe. It sets a new password if you forget yours (" + location.origin + ").\n"], {type: "text/plain"})}); return; }
  if (a === "acct-code-done") { if (!ACCT.codeOk) return; ACCT.code = null; const go = ACCT.afterCode; ACCT.afterCode = null; ACCT.view = "home"; acctRender(true); if (go) go(); acctSessions(); return; }
  if (a === "sync-now") { syncNow(true); return; }
  if (a === "acct-newlink") { try { const j = await api("POST", "account", {vis: "link", newLink: true}); API.user = j.user; acctRender(); toast("New link made; the old one doesn't work any more."); } catch (er) { acctErr(er); } return; }
  if (a === "acct-unlink") {
    const p = b.dataset.p;
    try { const j = await api("POST", "account/unlink/" + p); API.user = j.user; acctRender(); toast((p === "discord" ? "Discord" : "Google") + " is unlinked."); } catch (er) { acctErr(er); }
    return;
  }
  if (a === "acct-endothers") { try { await api("POST", "account/sessions/end-others"); toast("Signed out everywhere else."); acctSessions(); } catch (er) { acctErr(er); } return; }
  if (a === "acct-signout") {
    try { await api("POST", "auth/logout"); } catch (er) {}
    acctSignedOut(false); acctClose(); toast("Signed out. Your roster stays in this browser.");
    return;
  }
});
ACCT.root.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.matches("[data-acct-show]")) { ACCT.root.querySelectorAll('input[id="acct-pw"]').forEach((i) => { i.type = t.checked ? "text" : "password"; }); return; }
  if (t.matches("[data-acct-codeok]")) { ACCT.codeOk = t.checked; ACCT.err = ""; const d = ACCT.root.querySelector('[data-action="acct-code-done"]'); if (d) d.disabled = !t.checked; return; }
  if (t.name === "acct-vis") { try { const j = await api("POST", "account", {vis: t.value}); API.user = j.user; acctRender(); } catch (er) { acctErr(er); } return; }
  if (t.matches("[data-acct-feed]")) { try { const j = await api("POST", "account", {feed: t.checked}); API.user = j.user; toast(t.checked ? "Friends see what you summon, grail and max out." : "Your activity is hidden from friends now."); } catch (er) { acctErr(er); } return; }
});
ACCT.root.addEventListener("submit", async (e) => {
  const f = e.target.closest("[data-acct-form]"); if (!f) return;
  e.preventDefault(); if (ACCT.busy) return;
  const kind = f.dataset.acctForm, val = (id) => { const i = f.querySelector("#" + id); return i ? i.value : ""; };
  const email = val("acct-email").trim(), pw = val("acct-pw");
  ACCT.err = "";
  try {
    if (kind === "signup") {
      if (pw.length < 10) { ACCT.err = "The password needs 10 characters or more."; acctRender(); return; }
      ACCT.busy = true; acctRender();
      const j = await api("POST", "auth/signup", {name: val("acct-name").trim(), email: email, key: await pwKey(email, pw)});
      toast("Welcome, " + j.user.name + "! Your account is ready.");
      return acctSignedIn(j, true);
    }
    if (kind === "signin") {
      ACCT.busy = true; acctRender();
      const j = await api("POST", "auth/login", {email: email, key: await pwKey(email, pw)});
      ACCT.busy = false; ACCT.view = "home"; acctClose();
      acctSignedIn(j, true);
      toast("Signed in as " + j.user.name + ".");
      return;
    }
    if (kind === "recover") {
      if (pw.length < 10) { ACCT.err = "The new password needs 10 characters or more."; acctRender(); return; }
      ACCT.busy = true; acctRender();
      const j = await api("POST", "auth/recover", {email: email, code: val("acct-rc"), key: await pwKey(email, pw)});
      toast("New password set. Here's your new recovery code.");
      return acctSignedIn(j, true);
    }
    const u = API.user; if (!u) return;
    if (kind === "name") { const j = await api("POST", "account", {name: val("acct-name").trim()}); API.user = j.user; ACCT.open.name = false; acctPaint(); acctRender(); toast("Renamed to " + j.user.name + "."); return; }
    if (kind === "password") {
      if (pw.length < 10) { ACCT.err = "The password needs 10 characters or more."; acctRender(); return; }
      ACCT.busy = true; acctRender();
      const body = {email: email, newKey: await pwKey(email, pw)};
      if (u.hasPassword) body.key = await pwKey(u.email, val("acct-cur"));
      const j = await api("POST", "account/password", body);
      API.user = j.user; ACCT.busy = false; ACCT.open.pw = false;
      if (j.recovery) { ACCT.code = j.recovery; ACCT.codeOk = false; ACCT.view = "code"; acctRender(true); return; }
      acctRender(); toast("Saved. Your other devices are signed out."); acctSessions(); return;
    }
    if (kind === "recovery") {
      ACCT.busy = true; acctRender();
      const j = await api("POST", "account/recovery", {key: await pwKey(u.email, val("acct-cur"))});
      ACCT.busy = false; ACCT.open.rc = false; ACCT.code = j.recovery; ACCT.codeOk = false; ACCT.view = "code"; acctRender(true); return;
    }
    if (kind === "delete") {
      ACCT.busy = true; acctRender();
      const body = {confirm: val("acct-del")};
      if (u.hasPassword) body.key = await pwKey(u.email, val("acct-cur"));
      await api("POST", "account/delete", body);
      ACCT.busy = false; ACCT.open = {}; acctSignedOut(false); acctClose();
      toast("Your account is deleted. This browser still has your roster.");
      return;
    }
  } catch (er) { acctErr(er); }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="acct"]'); if (!b) return;
  e.preventDefault(); acctOpen();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ACCT.root.hidden) { e.preventDefault(); e.stopPropagation(); acctClose(); } }, true);
window.addEventListener("hashchange", () => { if (location.hash === "#account" && API.on && ACCT.root.hidden) acctOpen(); });
