/* ================= 0.26.0: friends (signed in on the hosted site) =================
   The Friends tab: your friend code, adding a friend by code or name, requests, your friends (open a roster, see their
   supports, compare in Versus, remove), your own supports (up to 10 servants you lend, like the game's support list)
   and what friends have been up to.

   Looking at someone's roster (FV): their servants, parties and Guests take the place of yours on every tab, read-only,
   with a bar on top to go back. Your own list is untouched meanwhile (changes that sync in wait until you're back).
   A shared link (?roster=…) opens the same way, signed in or not.

   Friends' servants elsewhere: the damage calculator's support picker gets a "Friends' supports" group (keys
   f:<friend>:<servant>), and Versus can put a friend's servant next to yours. FSV keeps every friend servant loaded. */
const FR = {loaded: false, busy: false, friends: [], incoming: [], outgoing: [], feed: [], err: "", sup: null, rm: null, t: 0};
const FV = {on: false, user: null, token: null, back: null, pend: new Set()};
const FSV = new Map(); // "f:<friend id>:<servant id>" -> the servant, with .fr = {id, name}
let FSUP = []; // [{user, supports: [servant]}] for the calculator

/* ---------- the tab ---------- */
// only on the hosted site: the file people open from their computer has no accounts, so no Friends tab
if (HOSTED) TABS.push("friends");
if (HOSTED) (function () {
  const nav = document.querySelector(".tabs"), past = document.getElementById("tab-past");
  const b = document.createElement("button");
  b.className = "tab"; b.setAttribute("role", "tab"); b.id = "tab-friends"; b.dataset.action = "tab"; b.dataset.tab = "friends"; b.setAttribute("aria-selected", "false"); b.textContent = "Friends"; b.hidden = true;
  if (nav) nav.insertBefore(b, past ? past.nextSibling : null);
  const sec = document.createElement("section");
  sec.id = "view-friends"; sec.setAttribute("aria-labelledby", "tab-friends"); sec.hidden = true; sec.innerHTML = `<div id="friends" class="frp"></div>`;
  const after = document.getElementById("view-past"); if (after) after.after(sec);
  if ((location.hash || "").slice(1) === "friends") S.tab = "friends";
})();
const renderChrome26f = renderChrome;
renderChrome = function () {
  const r = renderChrome26f.apply(this, arguments);
  const b = document.getElementById("tab-friends"); if (b) b.hidden = !API.on;
  const v = document.getElementById("view-friends"); if (v) v.hidden = S.tab !== "friends";
  if (S.tab === "friends" && !API.on && API.checked) { S.tab = "home"; renderChrome26f.apply(this, arguments); }
  if (FV.on) { const ex = document.getElementById("export-wrap"); if (ex) ex.hidden = true; const im = document.getElementById("lbl-import"); if (im) im.hidden = true; }
  renderFriends();
  fvBar();
  return r;
};
const acctPaint26f = acctPaint;
acctPaint = function () { const r = acctPaint26f.apply(this, arguments); const b = document.getElementById("tab-friends"); if (b) b.hidden = !API.on; if (S.tab === "friends") renderFriends(); return r; };
if (HOSTED && typeof FOOT_TABS !== "undefined") FOOT_TABS.push(["friends", "Friends"]);

async function frLoad(quiet) {
  if (!API.user || API.offline || FR.busy) return;
  FR.busy = true;
  try {
    const [l, f] = await Promise.all([api("GET", "friends"), api("GET", "feed")]);
    Object.assign(FR, {friends: l.friends, incoming: l.incoming, outgoing: l.outgoing, feed: f.items, loaded: true, err: ""});
  } catch (e) { if (!quiet) FR.err = e.message || ""; }
  FR.busy = false; FR.t = Date.now();
  renderFriends(); frBadge();
}
function frBadge() { const b = document.getElementById("tab-friends"); if (b) b.classList.toggle("has-req", FR.incoming.length > 0); }
const frAgo = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
function feedLine(it) {
  const d = it.data || {}, who = `<b>${esc(it.user.name)}</b>`, sv = `<b>${esc(d.name || "a servant")}</b>`;
  return {summoned: `${who} summoned ${sv}${d.rarity ? " " + "★".repeat(clamp(d.rarity, 1, 5)) : ""}`, grail: `${who} grailed ${sv} to Lv ${d.to}`,
    maxlevel: `${who} got ${sv} to max level (Lv ${d.to})`, np: `${who} raised ${sv} to NP${d.to}`, skills: `${who} maxed ${sv}'s skills`,
    bond: `${who} reached Bond ${d.to} with ${sv}`}[it.kind] || `${who} did something with ${sv}`;
}
function svFace(s) { const a = s ? atlasOf(s) : null; return a && a.f ? aimg(a.f) : ""; }
function frFaceHTML(s, cls) {
  const f = svFace(s), logo = s && CLASS_LOGO[s.cls];
  return f ? `<img class="${cls || "fr-face"}" src="${esc(f)}" alt="" loading="lazy"${logo ? ` data-alt="${esc(logo)}"` : ""}>` : `<i class="${cls || "fr-face"} none" aria-hidden="true">${esc((s && s.cls ? s.cls : "?").slice(0, 1))}</i>`;
}
function supStats(s) { return ["Lv " + (s.level ?? "—"), s.npLevel ? "NP" + s.npLevel : "", Array.isArray(s.skills) ? s.skills.slice(0, 3).map((v) => v ?? "–").join("/") : ""].filter(Boolean).join(" · "); }
function renderFriends() {
  const el = document.getElementById("friends"); if (!el) return;
  if (S.tab !== "friends") { if (el.firstChild) el.innerHTML = ""; return; }
  if (!API.on) { el.innerHTML = ""; return; }
  const u = API.user;
  if (!u) {
    el.innerHTML = `<div class="fr-cta"><h2>Friends</h2><p>Add friends with their friend code, look at each other's rosters, borrow each other's supports in the damage calculator and compare servants in Versus. It needs an account, which also syncs your roster to every device.</p>
      <button type="button" class="btn primary" data-action="acct">Sign in or create an account</button></div>`;
    return;
  }
  if (!FR.loaded && !FR.busy) frLoad();
  if (FV.on) { el.innerHTML = `<div class="fr-cta"><p>You're looking at <b>${esc(FV.user.name)}</b>'s roster.</p><button type="button" class="btn primary" data-action="fv-close">Back to yours</button></div>`; return; }
  const mine = (u.supports || []).map((id) => S.servants.find((x) => x.id === id)).filter(Boolean);
  const card = (f, kind) => {
    const open = FR.sup && FR.sup.id === f.id, rm = FR.rm === f.id;
    const acts = kind === "in" ? `<button type="button" class="btn primary sm" data-action="fr-accept" data-id="${f.id}">Accept</button><button type="button" class="btn ghost sm" data-action="fr-remove" data-id="${f.id}">Decline</button>`
      : kind === "out" ? `<span class="fr-wait">Asked</span><button type="button" class="btn ghost sm" data-action="fr-remove" data-id="${f.id}">Cancel</button>`
      : `${f.vis === "private" ? `<span class="fr-wait" title="${esc(f.name)} keeps their roster to themselves">Private roster</span>` : `<button type="button" class="btn sm" data-action="fv-open" data-id="${f.id}" data-name="${esc(f.name)}">Roster</button>`}
         <button type="button" class="btn sm" data-action="fr-sup" data-id="${f.id}" aria-expanded="${open}">${f.supports ? "Supports " + f.supports : "No supports"}</button>
         ${rm ? `<span class="fr-rm">Remove ${esc(f.name)}? <button type="button" class="btn danger solid sm" data-action="fr-remove" data-id="${f.id}">Remove</button><button type="button" class="btn ghost sm" data-action="fr-rm-no">Keep</button></span>`
           : `<button type="button" class="btn ghost sm fr-x" data-action="fr-rm-ask" data-id="${f.id}" aria-label="Remove ${esc(f.name)} from your friends">Remove</button>`}`;
    const sup = open ? `<div class="fr-sups">${FR.sup.list ? (FR.sup.list.length ? FR.sup.list.map((s) => `<div class="fr-sv">${frFaceHTML(s)}<span><b>${esc(s.name)}</b><small>${esc(s.cls || "")} · ${esc(supStats(s))}</small></span>
        <button type="button" class="btn ghost sm" data-action="fr-vs" data-k="${esc(s.id)}">Versus</button></div>`).join("") : `<p class="muted">${esc(f.name)} hasn't picked supports yet.</p>`) : `<p class="muted">Loading…</p>`}</div>` : "";
    return `<li class="fr-card"><span class="acct-av" aria-hidden="true">${esc(f.name.slice(0, 1).toUpperCase())}</span><div class="fr-who"><b>${esc(f.name)}</b><small>${fmtCode(f.code)}${f.seen && kind === "friend" ? " · seen " + frAgo(f.seen) : ""}</small></div><div class="fr-acts">${acts}</div>${sup}</li>`;
  };
  el.innerHTML = `<div class="fr-grid">
    <div class="fr-col">
      <section class="fr-box fr-me"><h2>Friends</h2>
        <p class="fr-code">Your friend code <b>${fmtCode(u.code)}</b> <button type="button" class="linkish" data-action="acct-copy-code">Copy</button></p>
        <form class="fr-add" data-fr-add><input class="field-input" type="text" name="to" placeholder="A friend code (123,456,789) or a name" aria-label="Friend code or name" autocomplete="off" required><button type="submit" class="btn primary">Add friend</button></form>
        ${FR.err ? `<p class="acct-err" role="alert">${esc(FR.err)}</p>` : ""}
        <p class="acct-note">Your roster: <b>${{private: "only you", friends: "your friends can look", link: "friends and anyone with your link can look"}[u.vis] || ""}</b>. <button type="button" class="linkish" data-action="acct">Change</button></p></section>
      ${FR.incoming.length ? `<section class="fr-box"><h3>Asking to be your friend</h3><ul class="fr-list">${FR.incoming.map((f) => card(f, "in")).join("")}</ul></section>` : ""}
      <section class="fr-box"><h3>Your friends <small>${FR.friends.length}</small></h3>${FR.friends.length ? `<ul class="fr-list">${FR.friends.map((f) => card(f, "friend")).join("")}</ul>` : `<p class="muted">${FR.loaded ? "No friends yet. Send them your friend code, or add theirs above." : "Loading…"}</p>`}</section>
      ${FR.outgoing.length ? `<section class="fr-box"><h3>Waiting for an answer</h3><ul class="fr-list">${FR.outgoing.map((f) => card(f, "out")).join("")}</ul></section>` : ""}
    </div>
    <div class="fr-col">
      <section class="fr-box"><h3>Your supports <small>${mine.length} of 10</small></h3><p class="acct-note">Friends can borrow these in the damage calculator and compare them in Versus, whoever can see your roster.</p>
        <ul class="fr-mysup">${mine.map((s) => `<li>${frFaceHTML(s)}<span><b>${esc(s.name)}</b><small>${esc(supStats(s))}</small></span><button type="button" class="fr-unsup" data-action="fr-unsup" data-id="${esc(s.id)}" aria-label="Stop lending ${esc(s.name)}">×</button></li>`).join("")}</ul>
        ${mine.length < 10 && S.servants.some((x) => !x.wish) ? `<button type="button" class="btn sm" data-action="fr-addsup">+ Add a support</button>` : ""}</section>
      <section class="fr-box"><h3>What your friends are up to</h3>${FR.feed.length ? `<ul class="fr-feed">${FR.feed.map((it) => `<li>${frFaceHTML({atlas: it.data && it.data.atlas, name: it.data && it.data.name, cls: it.data && it.data.cls})}<p>${feedLine(it)}<small>${frAgo(it.at)}</small></p></li>`).join("")}</ul>`
        : `<p class="muted">${FR.loaded ? "Nothing yet. When friends summon, grail or max out a servant, it shows here." : "Loading…"}</p>`}
        <p class="acct-note"><button type="button" class="linkish" data-action="fr-reload">Refresh</button></p></section>
    </div></div>`;
}
function frMySupports(ids) {
  return api("POST", "account", {supports: ids}).then((j) => { API.user = j.user; renderFriends(); }).catch((e) => toast(e.message || "Couldn't save that."));
}
document.addEventListener("submit", async (e) => {
  const f = e.target.closest && e.target.closest("[data-fr-add]"); if (!f) return;
  e.preventDefault();
  const v = f.querySelector("input").value.trim(); if (!v) return;
  try {
    const j = await api("POST", "friends", {to: v});
    toast(j.state === "friends" ? "You and " + j.friend.name + " are friends now." : "Asked " + j.friend.name + ". They'll see it on their Friends tab.");
    FR.err = ""; await frLoad(true); frSupLoad();
  } catch (er) { FR.err = er.message || "Couldn't add that friend."; renderFriends(); }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action, id = b.dataset.id;
  if (!/^(fr-|fv-)|^acct-copy-code$/.test(a)) return;
  if (a === "acct-copy-code") { try { await navigator.clipboard.writeText(fmtCode(API.user.code)); toast("Friend code copied."); } catch (er) { toast("Your friend code is " + fmtCode(API.user.code) + "."); } return; }
  if (a === "fr-reload") { await frLoad(); return; }
  if (a === "fr-accept") { try { await api("POST", "friends/" + id + "/accept"); toast("Friends now."); await frLoad(true); frSupLoad(); } catch (er) { toast(er.message); } return; }
  if (a === "fr-rm-ask") { FR.rm = id; renderFriends(); return; }
  if (a === "fr-rm-no") { FR.rm = null; renderFriends(); return; }
  if (a === "fr-remove") { FR.rm = null; try { await api("POST", "friends/" + id + "/remove"); await frLoad(true); frSupLoad(); } catch (er) { toast(er.message); } return; }
  if (a === "fr-sup") {
    if (FR.sup && FR.sup.id === id) { FR.sup = null; renderFriends(); return; }
    FR.sup = {id: id, list: null}; renderFriends();
    try { const j = await api("GET", "u/" + id); const f = fsvAdd(j.user, j.supports); if (FR.sup && FR.sup.id === id) { FR.sup.list = f; renderFriends(); } } catch (er) { FR.sup = null; renderFriends(); toast(er.message); }
    return;
  }
  if (a === "fr-vs") { const key = "f:" + FR.sup.id + ":" + b.dataset.k; vsWithFriend(key); return; }
  if (a === "fr-unsup") { frMySupports((API.user.supports || []).filter((x) => x !== id)); return; }
  if (a === "fr-addsup") {
    const have = new Set(API.user.supports || []);
    const list = S.servants.filter((x) => !x.wish && !have.has(x.id)).slice().sort((x, y) => x.name.localeCompare(y.name))
      .map((s) => ({key: "r:" + s.id, n: s.name, a: atlasOf(s), s: s, g: "Your servants", m: supStats(s)}));
    openSpk("Lend a support to your friends", "", (key) => { if (key && key.startsWith("r:")) frMySupports(Array.from(have).concat([key.slice(2)]).slice(0, 10)); }, list);
    return;
  }
  if (a === "fv-open") { fvOpen({id: id, name: b.dataset.name}); return; }
  if (a === "fv-close") { fvClose(); return; }
});

/* ---------- friends' servants: the calculator and Versus ---------- */
function fsvAdd(user, docs, token) {
  return (docs || []).map((d) => {
    const s = Object.assign({}, d.data, {id: "f:" + user.id + ":" + d.id, fr: {id: user.id, name: user.name}});
    picIdsOf(s).forEach((pid) => { if (!S.urlCache[pid]) S.urlCache[pid] = picUrl(user.id, pid, token); });
    FSV.set(s.id, s); return s;
  });
}
async function frSupLoad() {
  if (!API.user || API.offline) return;
  try { const j = await api("GET", "friends/supports"); FSUP = j.friends.map((f) => ({user: f.user, supports: fsvAdd(f.user, f.supports)})); } catch (e) {}
}
const npcSrc26 = npcSrc;
npcSrc = function (key) {
  const k = String(key || "");
  if (k.startsWith("f:")) { const s = FSV.get(k); return s ? {key: k, n: s.name + " (" + s.fr.name + ")", a: atlasOf(s), lv: skLevels(s)} : null; }
  return npcSrc26(key);
};
const spkAll26 = spkAll;
spkAll = function () {
  const out = spkAll26.apply(this, arguments);
  if (SPK.list || !FSUP.length) return out;
  const fr = [];
  FSUP.forEach((f) => f.supports.forEach((s) => fr.push({key: s.id, n: s.name, a: atlasOf(s), s: s, g: "Friends' supports", m: f.user.name + " · " + supStats(s)})));
  const i = out.findIndex((x) => x.g === "Often borrowed");
  return i < 0 ? fr.concat(out) : out.slice(0, i).concat(fr, out.slice(i));
};
const spkBody26 = spkBody;
spkBody = function () {
  // the picker's fixed groups, with the friends' first after your Guests
  if (SPK.list || !FSUP.length) return spkBody26.apply(this, arguments);
  const keep = SPK.list; SPK.list = spkAll(); try { return spkBody26.apply(this, arguments); } finally { SPK.list = keep; }
};
// Versus: a friend's servant can stand next to yours
const vsPicks26 = vsPicks;
vsPicks = function () {
  const mine = vsPicks26.apply(this, arguments), stored = vsStored().filter((id) => FSV.has(id));
  if (!stored.length) return mine;
  const ids = [];
  vsStored().forEach((id) => { if (ids.length < 3 && !ids.includes(id) && (FSV.has(id) || S.servants.some((s) => s.id === id))) ids.push(id); });
  mine.forEach((id) => { if (ids.length < 2 && !ids.includes(id)) ids.push(id); });
  return ids;
};
const vsFind = (id) => S.servants.find((s) => s.id === id) || FSV.get(id) || null;
const vsHeroHTML26 = vsHeroHTML;
vsHeroHTML = function (s, i, ids) {
  // friends' servants lent to the page for this drawing aren't yours: out of "Your servants", into a group per friend
  let h = vsHeroHTML26.apply(this, arguments).replace(/<option value="f:[^"]*"[^>]*>[^<]*<\/option>/g, "").replace(/<optgroup label="[^"]*"><\/optgroup>/g, "");
  const fr = Array.from(FSV.values());
  if (fr.length) {
    const opt = (x) => `<option value="${esc(x.id)}"${x.id === s.id ? " selected" : ""}${x.id !== s.id && ids.includes(x.id) ? " disabled" : ""}>${esc(x.name)}</option>`;
    const by = new Map(); fr.forEach((x) => { if (!by.has(x.fr.name)) by.set(x.fr.name, []); by.get(x.fr.name).push(x); });
    const groups = Array.from(by.keys()).map((n) => `<optgroup label="${esc(n)}'s">${by.get(n).map(opt).join("")}</optgroup>`).join("");
    h = h.replace(/(<select class="vs-sel"[^>]*>[\s\S]*?)(<\/select>)/, "$1" + groups + "$2");
  }
  if (s.fr) h = h.replace(/<button type="button" class="vs-name" data-action="goto"[^>]*>([\s\S]*?)<\/button>/, `<span class="vs-name">$1</span>`).replace(/(<p class="vs-meta">)/, `$1<span class="tag fr-tag">${esc(s.fr.name)}'s</span>`);
  return h;
};
const renderVersus26 = renderVersus;
renderVersus = function () {
  if (!Array.from(vsPicks()).some((id) => FSV.has(id))) { const r = renderVersus26.apply(this, arguments); vsFriendBtn(); return r; }
  // the same page, with friends' servants found too
  const keep = S.servants;
  S.servants = keep.concat(Array.from(FSV.values()).filter((x) => vsPicks().includes(x.id)));
  try { renderVersus26.apply(this, arguments); } finally { S.servants = keep; }
  vsFriendBtn();
};
function vsFriendBtn() {
  const t = document.querySelector("#versus .vs-tools"); if (!t || !API.user || FV.on || t.querySelector("[data-action='vs-friend']")) return;
  if (!FR.friends.length && !FSUP.length) return;
  t.insertAdjacentHTML("beforeend", `<button type="button" class="btn sm" data-action="vs-friend">Compare with a friend's servant</button>`);
}
function vsWithFriend(key) {
  const ids = vsPicks26(), a = ids[0] && !FSV.has(ids[0]) ? ids[0] : (S.servants.find((s) => !s.wish) || {}).id;
  setVsPicks([a, key].filter(Boolean));
  S.tab = "versus"; try { history.pushState({tab: "versus"}, "", "#versus"); } catch (e) {}
  renderChrome(); renderVersus(); window.scrollTo({top: 0});
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest && e.target.closest('[data-action="vs-friend"]'); if (!b) return;
  if (!FR.loaded) await frLoad(true);
  b.disabled = true;
  // friends' supports, and the whole roster of friends who let you look
  await frSupLoad();
  const list = [];
  FSUP.forEach((f) => f.supports.forEach((s) => list.push({key: s.id, n: s.name, a: atlasOf(s), s: s, g: f.user.name + "'s supports", m: supStats(s)})));
  const open = FR.friends.filter((f) => f.vis !== "private").slice(0, 12);
  await Promise.all(open.map(async (f) => {
    try { const j = await api("GET", "u/" + f.id + "/roster"); fsvAdd(f, j.docs.filter((d) => d.col === "servants")).filter((s) => !s.wish).forEach((s) => { if (!list.some((x) => x.key === s.id)) list.push({key: s.id, n: s.name, a: atlasOf(s), s: s, g: f.name + "'s roster", m: supStats(s)}); }); } catch (er) {}
  }));
  b.disabled = false;
  if (!list.length) { toast("Your friends haven't shared any servants yet: no supports, and their rosters are private."); return; }
  openSpk("Compare with a friend's servant", "", (key) => { if (key) vsWithFriend(key); }, list);
});

/* ---------- looking at someone's roster ---------- */
const notify26 = notify;
notify = function (col) { if (FV.on) { FV.pend.add(col); return; } return notify26(col); };
async function fvOpen(user, token) {
  let j;
  try { j = await api("GET", "u/" + user.id + "/roster" + (token ? "?t=" + encodeURIComponent(token) : "")); }
  catch (e) { toast(e.message || "That roster can't be opened."); return; }
  if (!FV.on) FV.back = {tab: S.tab, sel: S.selected};
  FV.on = true; FV.user = user; FV.token = token || null;
  const by = {servants: [], parties: [], guests: []};
  j.docs.forEach((d) => {
    if (!by[d.col]) return;
    const o = Object.assign({}, d.data, {id: d.id});
    picIdsOf(o).forEach((pid) => { if (!S.urlCache[pid]) S.urlCache[pid] = picUrl(user.id, pid, token); });
    by[d.col].push(o);
  });
  COLS.forEach((c) => { S[c] = by[c].sort((x, y) => (num(x.order) ?? 1e9) - (num(y.order) ?? 1e9)); S.loaded[c] = true; });
  S.readOnly = true; S.selected = null; S.editing = null; S.partyEdit = null; S.guestEdit = null;
  S.tab = "servants";
  try { history.pushState({tab: "servants"}, "", "#servants"); } catch (e) {}
  renderAll(); window.scrollTo({top: 0});
  toast("This is " + user.name + "'s roster: look around, nothing here can be changed.");
}
function fvClose() {
  if (!FV.on) return;
  FV.on = false; S.readOnly = false;
  const back = FV.back || {tab: "friends"}; FV.back = null; FV.pend.clear();
  COLS.forEach((c) => notify26(c));
  S.selected = back.sel || null; S.tab = FV.token && !API.user ? "servants" : back.tab === "servants" ? "friends" : back.tab || "friends";
  if (FV.token) { const q = new URLSearchParams(location.search); q.delete("roster"); history.replaceState(history.state, "", location.pathname + (q.toString() ? "?" + q : "") + "#" + S.tab); }
  FV.token = null; FV.user = null;
  renderAll(); syncNow();
}
function fvBar() {
  let bar = document.getElementById("fv-bar");
  if (!FV.on) { if (bar) bar.remove(); document.documentElement.classList.remove("fv-on"); return; }
  if (!bar) {
    const head = document.querySelector(".masthead"); if (!head) return;
    head.insertAdjacentHTML("afterend", `<div id="fv-bar" class="fv-bar" role="status"></div>`); bar = document.getElementById("fv-bar");
  }
  document.documentElement.classList.add("fv-on");
  const html = `<p>Looking at <b>${esc(FV.user.name)}</b>'s roster${FV.token ? " (a shared link)" : ""}. Read-only.</p><button type="button" class="btn primary sm" data-action="fv-close">${API.user || !FV.token ? "Back to yours" : "Close"}</button>`;
  if (bar.innerHTML !== html) bar.innerHTML = html;
}
// a shared link: ?roster=<token>
async function fvFromLink() {
  const tok = new URLSearchParams(location.search).get("roster"); if (!tok || !API.on) return;
  try { const j = await api("GET", "share/" + encodeURIComponent(tok)); fvOpen(j.user, tok); }
  catch (e) { toast(e.message || "That link doesn't work any more."); }
}
const acctInit26 = acctInit;
acctInit = async function () {
  await acctInit26.apply(this, arguments);
  if (!API.on) return;
  fvFromLink();
  if (API.user) { frSupLoad(); frLoad(true); setInterval(() => { if (document.visibilityState === "visible" && S.tab === "friends") frLoad(true); }, 120000); }
};
const acctSignedIn26 = acctSignedIn;
acctSignedIn = function () { const r = acctSignedIn26.apply(this, arguments); FR.loaded = false; frSupLoad(); frLoad(true); return r; };
const acctSignedOut26 = acctSignedOut;
acctSignedOut = function () { if (FV.on && !FV.token) fvClose(); FSV.clear(); FSUP = []; Object.assign(FR, {loaded: false, friends: [], incoming: [], outgoing: [], feed: [], sup: null}); return acctSignedOut26.apply(this, arguments); };

// start: ask whether a server is there (nothing happens on the file people open from their computer)
acctInit();
