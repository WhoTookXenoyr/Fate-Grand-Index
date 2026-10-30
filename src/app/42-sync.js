/* ================= 0.26.0: sync (signed in on the hosted site) =================
   The roster still lives in this browser first: everything works offline, and nothing waits for the server. Signed in,
   every saved change is also noted (SYNCK's `out`) and sent a moment later; changes made on other devices come in when
   the page opens, when it's looked at again, and every minute and a half while it's open. The server numbers every
   change (server/sync.js), so asking "what's new since number N" is cheap. If the same entry changed on two devices,
   the one saved last wins; a change still waiting to be sent from here is never overwritten by what comes in.

   What syncs: the servants, parties and Guests collections, and the things the page remembers for you (EXTRA_KEYS:
   the progress log, NA matches, tiers, calculator, event and story progress…). Settings that belong to a screen
   (light/dark, fonts, layout, frame rate) stay per device. Uploaded pictures go up once (the server keeps them in R2
   or D1); another device shows them from the server and keeps a copy for offline use.

   The first time a browser syncs with an account: an empty account gets this browser's roster; an empty browser gets
   the account's; when both have one, the account window asks (use the account's, keep this browser's, or combine). */
const SYNCK = "spirit-origin-list:v1:sync";
const EXTRA_KEYS = {log: LOG_KEY, atlaslink: LINK_KEY, tiers: TIER_KEY, rankBase: RB_KEY, npcalc: NPC_KEY, event: EV_KEY, story: STORY_KEY,
  summon: SUM_KEY, traitkeep: TRK_KEY, traitnote: TRN_KEY, filldismiss: FILL_KEY, statsync: SYNC_KEY, affinity: AFF_KEY};
const EXTRA_BY_KEY = new Map(Object.keys(EXTRA_KEYS).map((n) => [EXTRA_KEYS[n], n]));
const SYNC = {state: "off", last: 0, err: "", pics: "", remote: null, timer: 0, pushT: 0, busy: null, again: false};
const stSet = Storage.prototype.setItem, stDel = Storage.prototype.removeItem;
function syncState() { try { return JSON.parse(localStorage.getItem(SYNCK) || "null") || {}; } catch (e) { return {}; } }
function syncSave(st) { try { stSet.call(localStorage, SYNCK, JSON.stringify(st)); } catch (e) {} }
const syncOn = () => !!(API.on && API.user && !API.offline);
let markN = 0;
function syncMark(col, id) {
  if (VIEWING()) return;
  const st = syncState(); if (!st.uid) return;
  (st.out || (st.out = {}))[col + "/" + id] = ++markN + Date.now() * 1000;
  syncSave(st); syncPaint();
  if (syncOn() && st.ready) { clearTimeout(SYNC.pushT); SYNC.pushT = setTimeout(() => syncNow(), 1500); }
}
const VIEWING = () => typeof FV !== "undefined" && !!FV.on;
// every save of the three collections goes through localDb: note it
const localDbCol26 = localDb.collection;
localDb.collection = function (col) {
  const q = localDbCol26.call(localDb, col), doc = q.doc;
  q.doc = (id) => {
    const d = doc(id), set = d.set, del = d.delete;
    d.set = async (b) => { const r = await set(b); syncMark(col, id); return r; };
    d.delete = async () => { const r = await del(); syncMark(col, id); return r; };
    return d;
  };
  return q;
};
// and the remembered things are noted when the page saves them
Storage.prototype.setItem = function (k, v) { stSet.call(this, k, v); if (this === localStorage && EXTRA_BY_KEY.has(k)) syncMark("extras", EXTRA_BY_KEY.get(k)); };
Storage.prototype.removeItem = function (k) { stDel.call(this, k); if (this === localStorage && EXTRA_BY_KEY.has(k)) syncMark("extras", EXTRA_BY_KEY.get(k)); };

function syncWords(long) {
  const st = syncState(), n = Object.keys(st.out || {}).length;
  if (!API.user) return "";
  if (API.offline) return "Offline: changes are saved here and sync when you're back online" + (n ? " (" + plural(n, "change") + " waiting)." : ".");
  if (SYNC.state === "wait") return "Waiting for you to choose how to sync this browser.";
  if (SYNC.state === "busy") return "Syncing…";
  if (SYNC.state === "error") return "Couldn't sync: " + SYNC.err + (n ? " " + plural(n, "change") + " waiting." : "");
  if (n) return plural(n, "change") + " waiting to sync.";
  if (SYNC.last) { const m = Math.round((Date.now() - SYNC.last) / 60000); return "Synced " + (m < 1 ? "just now" : m < 60 ? m + " min ago" : "at " + new Date(SYNC.last).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})) + "."; }
  return long ? "Signed in. Nothing synced yet." : "";
}
function syncPaint() { if (typeof acctPaint === "function") acctPaint(); }

/* ---------- applying what comes in ---------- */
const picUrl = (uid, id, t) => "/api/pics/" + uid + "/" + id + (t ? "?t=" + encodeURIComponent(t) : "");
const picIdsOf = (doc) => Object.values((doc && doc.art) || {}).filter((v) => typeof v === "string" && /^img_[a-z0-9]+$/.test(v));
const picQ = new Set(); let picRun = 0;
function picFetchSoon(uid, id) {
  if (S.urlCache[id]) return;
  S.urlCache[id] = picUrl(uid, id);
  picQ.add(uid + "/" + id); if (picRun < 2) picPump();
}
// pictures from the server are copied into this browser for offline use, two at a time
async function picPump() {
  picRun++;
  try {
    while (picQ.size) {
      const k = picQ.values().next().value; picQ.delete(k);
      const [uid, id] = k.split("/");
      try { const r = await fetch(picUrl(uid, id), {credentials: "same-origin"}); if (r.ok) await imgStore.put(id, await r.blob()); } catch (e) {}
    }
  } finally { picRun--; }
}
// one change from the server into this browser's store; returns the collection it touched
function syncApply(d, st, uid) {
  const key = d.col + "/" + d.id;
  if (st.out && st.out[key]) return null; // ours is newer: it's on its way
  if (d.col === "extras") {
    const k = EXTRA_KEYS[d.id]; if (!k) return null;
    const cur = localStorage.getItem(k), v = d.data && typeof d.data.v === "string" ? d.data.v : null;
    if (cur === v) return null;
    try { if (v == null) stDel.call(localStorage, k); else stSet.call(localStorage, k, v); } catch (e) {}
    return "extras";
  }
  if (!COLS.includes(d.col)) return null;
  const list = store[d.col], i = list.findIndex((x) => x.id === d.id);
  if (d.data == null) { if (i < 0) return null; list.splice(i, 1); return d.col; }
  const o = Object.assign({id: d.id}, d.data);
  picIdsOf(o).forEach((id) => picFetchSoon(uid, id));
  if (i >= 0) list[i] = o; else list.push(o);
  return d.col;
}
async function syncPullAll(since) {
  let docs = [], rev = since;
  for (;;) { const j = await api("GET", "sync?since=" + rev); docs = docs.concat(j.docs); rev = j.rev; if (!j.more) break; }
  return {docs: docs, rev: rev};
}
async function syncPull() {
  let st = syncState();
  const got = await syncPullAll(st.rev || 0);
  st = syncState();
  const cols = new Set();
  got.docs.forEach((d) => { const c = syncApply(d, st, st.uid); if (c) cols.add(c); });
  st.rev = Math.max(st.rev || 0, got.rev); syncSave(st);
  if ([...cols].some((c) => COLS.includes(c))) { persist(); COLS.forEach((c) => { if (cols.has(c)) notifySoon(c); }); }
  return cols;
}

/* ---------- sending ---------- */
function syncChange(key) {
  const i = key.indexOf("/"), col = key.slice(0, i), id = key.slice(i + 1);
  if (col === "extras") { const k = EXTRA_KEYS[id], v = k ? localStorage.getItem(k) : null; return {col: col, id: id, data: v == null ? null : {v: v}}; }
  const d = (store[col] || []).find((x) => x.id === id);
  return {col: col, id: id, data: d ? bodyOf(d) : null};
}
async function syncPush() {
  let st = syncState();
  const keys = Object.keys(st.out || {}); if (!keys.length) return;
  const first = !st.pushed;
  for (let i = 0; i < keys.length;) {
    const part = [], marks = {}; let size = 0;
    while (i < keys.length && part.length < 60) {
      const ch = syncChange(keys[i]), n = JSON.stringify(ch).length;
      if (part.length && size + n > 900000) break;
      part.push(ch); marks[keys[i]] = st.out[keys[i]]; size += n; i++;
    }
    const r = await api("POST", "sync", {changes: part, first: first});
    st = syncState();
    // a change noted again while this was on its way stays waiting
    Object.keys(marks).forEach((k) => { if (st.out && st.out[k] === marks[k]) delete st.out[k]; });
    if (r.rev === (st.rev || 0) + part.length) st.rev = r.rev;
    st.pushed = true; syncSave(st);
  }
}
// uploaded pictures the account doesn't have yet go up (one at a time; a picture too big to sync stays on this device)
async function syncPics() {
  let st = syncState(); const up = st.up || {}, big = st.big || {};
  const want = new Set(); COLS.forEach((c) => store[c].forEach((d) => picIdsOf(d).forEach((id) => want.add(id))));
  const todo = [...want].filter((id) => !up[id] && !big[id] && /^(blob|data):/.test(S.urlCache[id] || ""));
  let done = 0;
  for (const id of todo) {
    const blob = await imgGet(id); if (!blob) continue;
    SYNC.pics = "Uploading pictures: " + (done + 1) + " of " + todo.length + "…"; syncPaint();
    try { await api("PUT", "pics/" + id, blob); st = syncState(); (st.up || (st.up = {}))[id] = 1; syncSave(st); done++; }
    catch (e) {
      if (e.status === 413 || e.status === 415) { st = syncState(); (st.big || (st.big = {}))[id] = 1; syncSave(st); continue; }
      if (e.status === 507) { SYNC.pics = e.message; syncPaint(); return; }
      throw e;
    }
  }
  const nBig = Object.keys(syncState().big || {}).length;
  SYNC.pics = nBig ? plural(nBig, "picture") + " too big to sync: " + (nBig === 1 ? "it stays" : "they stay") + " on this device." : "";
}
async function imgGet(id) {
  const v = S.urlCache[id];
  try {
    const db = await imgStore.open();
    if (db) { const b = await new Promise((res) => { const t = db.transaction("img", "readonly"), rq = t.objectStore("img").get(id); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }); if (b) return typeof b === "string" ? (await fetch(b)).blob() : b; }
    if (v && /^(blob|data):/.test(v)) return (await fetch(v)).blob();
  } catch (e) {}
  return null;
}
// a picture removed or replaced here is removed from the account too
const assetDel26 = localAssets.delete;
localAssets.delete = async function (id) {
  const r = await assetDel26.call(localAssets, id);
  const st = syncState();
  if (st.up && st.up[id]) { delete st.up[id]; syncSave(st); if (syncOn()) api("DELETE", "pics/" + id).catch(() => { const s2 = syncState(); (s2.del || (s2.del = {}))[id] = 1; syncSave(s2); }); else { (st.del || (st.del = {}))[id] = 1; syncSave(st); } }
  return r;
};

/* ---------- when ---------- */
async function syncNow(loud) {
  if (!syncOn() || VIEWING()) return;
  const st0 = syncState(); if (!st0.ready) return;
  if (SYNC.busy) { SYNC.again = true; return SYNC.busy; }
  SYNC.state = "busy"; syncPaint();
  SYNC.busy = (async () => {
    try {
      const del = Object.keys(st0.del || {});
      for (const id of del) { await api("DELETE", "pics/" + id); const s2 = syncState(); delete s2.del[id]; syncSave(s2); }
      await syncPush();
      const cols = await syncPull();
      await syncPics();
      SYNC.state = "idle"; SYNC.err = ""; SYNC.last = Date.now();
      if (loud) toast(cols.size ? "Synced: changes from your other devices are here." : "Synced.");
    } catch (e) {
      if (e.status === 0) { API.offline = true; SYNC.state = "idle"; }
      else if (e.status === 401) SYNC.state = "off";
      else { SYNC.state = "error"; SYNC.err = e.message || "the server didn't answer."; }
      if (loud) toast(syncWords());
    } finally {
      SYNC.busy = null; syncPaint();
      if (SYNC.again) { SYNC.again = false; setTimeout(() => syncNow(), 300); }
    }
  })();
  return SYNC.busy;
}
let syncLastLook = 0;
function syncLook() { if (document.visibilityState !== "visible" || Date.now() - syncLastLook < 20000) return; syncLastLook = Date.now(); syncNow(); }
document.addEventListener("visibilitychange", syncLook);
window.addEventListener("focus", syncLook);
window.addEventListener("online", () => { if (API.user) { API.offline = false; syncNow(); } });
window.addEventListener("pagehide", () => {
  // a change made just before leaving: send it now (keepalive lets it finish after the page is gone)
  const st = syncState(), keys = Object.keys(st.out || {});
  if (!syncOn() || !st.ready || !keys.length || keys.length > 40) return;
  try { fetch("/api/sync", {method: "POST", keepalive: true, credentials: "same-origin", headers: {"content-type": "application/json", "x-fgi": "1"}, body: JSON.stringify({changes: keys.map(syncChange)})}); } catch (e) {}
});
function syncStop() { clearInterval(SYNC.timer); SYNC.timer = 0; SYNC.state = "off"; syncPaint(); }

/* ---------- the first time this browser syncs with an account ---------- */
async function syncStart(fresh) {
  const u = API.user; if (!u) return;
  let st = syncState();
  if (st.uid !== u.id) { st = {uid: u.id, rev: 0, out: {}, up: {}, ready: false}; }
  st.user = {id: u.id, name: u.name}; syncSave(st);
  if (!SYNC.timer) SYNC.timer = setInterval(() => { if (document.visibilityState === "visible") syncNow(); }, 90000);
  if (API.offline) { SYNC.state = "idle"; syncPaint(); return; }
  if (!st.ready) return syncFirst();
  return syncNow(fresh);
}
const localCount = () => COLS.reduce((n, c) => n + store[c].length, 0);
const remoteCount = (docs) => docs.filter((d) => d.data != null && COLS.includes(d.col)).length;
function syncMarkAll(st, remoteDocs) {
  st.out = st.out || {};
  COLS.forEach((c) => store[c].forEach((d) => { st.out[c + "/" + d.id] = ++markN; }));
  Object.keys(EXTRA_KEYS).forEach((n) => { if (localStorage.getItem(EXTRA_KEYS[n]) != null) st.out["extras/" + n] = ++markN; });
  (remoteDocs || []).forEach((d) => { if (d.data != null && !st.out[d.col + "/" + d.id]) st.out[d.col + "/" + d.id] = ++markN; }); // only on the account: deleted there
}
async function syncFirst() {
  SYNC.state = "busy"; syncPaint();
  let got;
  try { got = await syncPullAll(0); } catch (e) { SYNC.state = "error"; SYNC.err = e.message || ""; syncPaint(); return; }
  const st = syncState(), rN = remoteCount(got.docs), lN = localCount();
  if (!rN) {
    // an empty account: this browser's roster goes up
    syncMarkAll(st, []); st.rev = got.rev; st.ready = true; st.pushed = false; syncSave(st);
    await syncNow();
    if (lN) toast("Your roster is in your account now. Sign in on another device to have it there too.");
    return;
  }
  if (!lN) return syncTake(got, "account");
  SYNC.remote = got; SYNC.state = "wait"; syncPaint();
  if (ACCT.root.hidden || ACCT.view !== "code") acctOpen("merge"); else ACCT.afterCode = () => acctOpen("merge");
}
// use: "account" (this browser takes the account's), "browser" (the account takes this browser's), "both" (everything;
// where both have the same entry, the account's version)
function syncTake(got, use) {
  const st = syncState(), remote = got.docs.filter((d) => d.data != null), has = new Set(remote.map((d) => d.col + "/" + d.id));
  st.out = {}; st.rev = got.rev; st.ready = true; st.pushed = use !== "browser" ? true : false;
  let extras = false;
  if (use === "account") {
    COLS.forEach((c) => { store[c] = []; });
    remote.forEach((d) => { const c = syncApply(d, st, st.uid); if (c === "extras") extras = true; });
  } else if (use === "browser") {
    syncMarkAll(st, got.docs);
  } else {
    remote.forEach((d) => { const c = syncApply(d, st, st.uid); if (c === "extras") extras = true; });
    COLS.forEach((c) => store[c].forEach((d) => { if (!has.has(c + "/" + d.id)) st.out[c + "/" + d.id] = ++markN; }));
    Object.keys(EXTRA_KEYS).forEach((n) => { if (!has.has("extras/" + n) && localStorage.getItem(EXTRA_KEYS[n]) != null) st.out["extras/" + n] = ++markN; });
  }
  syncSave(st); persist(); COLS.forEach(notifySoon);
  SYNC.remote = null; SYNC.state = "idle";
  // the remembered things are read when the page starts, so the page starts again once with them
  if (extras && use !== "browser") { try { sessionStorage.setItem("fgi-synced", "1"); } catch (e) {} setTimeout(() => location.reload(), 60); return; }
  syncNow();
  toast(use === "account" ? "Your account's roster is here." : use === "browser" ? "This browser's roster is going to your account." : "Combined: this browser and your account have the same roster now.");
}
(function () { try { if (sessionStorage.getItem("fgi-synced")) { sessionStorage.removeItem("fgi-synced"); setTimeout(() => toast("Your account's roster is here."), 600); } } catch (e) {} })();
function syncMergeHTML() {
  const got = SYNC.remote; if (!got) return `<p class="acct-lead">Nothing to choose any more.</p>`;
  const cnt = (list) => { const n = (c) => list.filter((d) => d.col === c && d.data != null && (c !== "servants" || !d.data.wish)).length;
    return plural(n("servants"), "servant") + ", " + plural(n("parties"), "party", "parties") + ", " + plural(list.filter((d) => d.col === "servants" && d.data && d.data.wish).length + n("guests"), "Guest"); };
  const mine = cnt(COLS.reduce((a, c) => a.concat(store[c].map((d) => ({col: c, data: d}))), []));
  const opt = (k, t, d) => `<label class="acct-radio"><input type="radio" name="sync-use" value="${k}"${k === "account" ? " checked" : ""}><span><b>${t}</b><small>${d}</small></span></label>`;
  return `<p class="acct-lead">This browser and your account both have a roster. Which one should this browser sync?</p>
    <ul class="sync-two"><li><b>Your account</b>${esc(cnt(got.docs))}</li><li><b>This browser</b>${esc(mine)}</li></ul>
    <div class="acct-vis" role="radiogroup" aria-label="Which roster">${opt("account", "Use my account's roster", "This browser's list is replaced by the account's.")}${opt("browser", "Keep this browser's roster", "The account's list is replaced by this one, on every device.")}${opt("both", "Combine them", "Everything from both. Where both have the same entry, the account's version stays.")}</div>
    <label class="acct-chk"><input type="checkbox" data-sync-backup checked> Download a backup of this browser's list first</label>
    <div class="acct-acts"><button type="button" class="btn primary" data-action="sync-take">Sync</button><button type="button" class="linkish" data-acct-close>Not now</button></div>
    <p class="acct-note">Until you choose, nothing is synced from this browser.</p>`;
}
ACCT.root.addEventListener("click", async (e) => {
  const b = e.target.closest && e.target.closest('[data-action="sync-take"]'); if (!b || !SYNC.remote) return;
  const use = (ACCT.root.querySelector('input[name="sync-use"]:checked') || {}).value || "account";
  const bk = ACCT.root.querySelector("[data-sync-backup]");
  b.disabled = true;
  if (bk && bk.checked) { try { await exportBackup(); } catch (er) {} }
  const got = SYNC.remote; ACCT.view = "home"; acctClose();
  syncTake(got, use);
});
// Start fresh while signed in empties the account too (the dialog says so), or the next sync would bring it all back
const freshHTML26 = freshHTML;
freshHTML = function () {
  const h = freshHTML26.apply(this, arguments);
  if (!syncOn() || !syncState().ready) return h;
  return h.replace("<b>in this browser</b>", "<b>in this browser and in your account</b> (so on every device you sync)").replace("Delete everything in this browser", "Delete everything here and in my account");
};
const startFresh26 = startFresh;
startFresh = async function (prefs) {
  const st = syncState();
  if (syncOn() && st.ready) {
    try {
      const ch = [];
      COLS.forEach((c) => store[c].forEach((d) => ch.push({col: c, id: d.id, data: null})));
      Object.keys(EXTRA_KEYS).forEach((n) => ch.push({col: "extras", id: n, data: null}));
      for (let i = 0; i < ch.length; i += 60) await api("POST", "sync", {changes: ch.slice(i, i + 60), first: true});
    } catch (e) { toast("Couldn't empty your account (" + (e.message || "no connection") + "). Nothing was deleted."); return; }
  }
  return startFresh26.apply(this, arguments);
};

// the line under the header says where the roster is kept
const renderBackupNote26 = renderBackupNote;
renderBackupNote = function () {
  const r = renderBackupNote26.apply(this, arguments);
  const el = document.getElementById("save-note");
  if (el && API.user) el.textContent = "Saved in this browser and synced to " + API.user.name + "'s account. " + syncWords();
  return r;
};
const syncPaint26 = syncPaint;
syncPaint = function () { syncPaint26(); try { renderBackupNote(); } catch (e) {} };
