
(function () {
"use strict";
const CAPS = {1: 60, 2: 65, 3: 70, 4: 80, 5: 90};
const CLASSES = ["Saber","Archer","Lancer","Rider","Caster","Assassin","Berserker","Ruler","Avenger","Moon Cancer","Alter Ego","Foreigner","Pretender","Shielder","Beast"];
const ABBR = {Saber:"SAB",Archer:"ARC",Lancer:"LAN",Rider:"RID",Caster:"CAS",Assassin:"ASN",Berserker:"BER",Ruler:"RUL",Avenger:"AVG","Moon Cancer":"MCN","Alter Ego":"AEG",Foreigner:"FOR",Pretender:"PRT",Shielder:"SHI",Beast:"BST"};
const CARDS = ["Buster","Arts","Quick"];
const TARGETS = ["Single Target","AoE","Support"];
const ROLES = ["Main DPS","Sub DPS","NP Battery","Buffer","Debuffer","Healer","Tank","Farmer","Hybrid"];
const UNITS = ["%", "HP", "stars", "turns", "times", "damage"];
const COLS = ["servants","parties","guests"];
const TABS = ["home","servants","parties","ranking","versus"];

const S = {
  servants: [], parties: [], guests: [], loaded: {servants: false, parties: false, guests: false},
  db: null, dbState: "connecting", readOnly: false, downloads: null,
  assets: null, viewStage: {}, uploading: null, urlCache: {}, artConfirm: null,
  tab: "servants", selected: null, editing: null, confirmDel: false, npEdit: null, npVer: {}, npConfirm: null, psEdit: null, skOpen: {}, npGrp: {}, skSet: {}, skMgr: {}, skConfirm: null,
  partyEdit: null, guestEdit: null, importData: null, q: "", cls: "", card: "", sort: "order", newWish: false, justSummoned: null, affEdit: false, affConfirm: false, formArt: null, formArtNew: [], formArtSlot: null, formArtBusy: null, trait: "", dnaMode: "stall", dnaWish: true
};

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v))) ? null : Number(v);
const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("en-US");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isWide = () => window.matchMedia("(min-width: 901px)").matches;
const cardCls = (c) => CARDS.includes(c) ? "c-" + c.toLowerCase() : "";

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 3400);
}

/* ---------- game maths ---------- */
function levelStatus(s) {
  const cap = CAPS[s.rarity]; const lv = num(s.level);
  if (!cap || lv == null) return null;
  if (lv > cap) return {text: "Grailed +" + (lv - cap), kind: "grail"};
  if (lv === cap) return {text: "At max level", kind: "cap"};
  return {text: (cap - lv) + " levels to cap", kind: "below"};
}
function unitSuffix(u) { return u === "%" ? "%" : (u ? " " + u : ""); }
function fmtVal(v, u) { const d = u === "%" ? 1 : 0; const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d); return r.toLocaleString("en-US") + unitSuffix(u); }
// FGO skills move 10% of the Lv1->Lv10 gap per level up to Lv9, then jump to the full value at Lv10.
function skillVal(info, lv) {
  if (!info || num(info.v1) == null || num(info.v10) == null || typeof lv !== "number") return null;
  const v1 = num(info.v1), v10 = num(info.v10);
  return fmtVal(lv >= 10 ? v10 : v1 + (v10 - v1) * (lv - 1) / 10, info.unit);
}
// Cooldown drops by 1 at Lv6 and again at Lv10.
function curCd(info, lv) {
  if (!info || num(info.cd) == null || typeof lv !== "number") return null;
  return num(info.cd) - (lv >= 6 ? 1 : 0) - (lv >= 10 ? 1 : 0);
}
function skillTotal(s) { return (s.skills || []).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0); }
function total(s, k) { const b = num(s[k]); if (b == null) return null; return b + (num(s[k === "hp" ? "fouHp" : "fouAtk"]) || 0); }

/* ---------- storage ---------- */
const queue = {}, dirty = {}, timers = {};
function bodyOf(o) { const c = JSON.parse(JSON.stringify(o)); delete c.id; return c; }
function writeFailed(e) {
  const code = e && e.code;
  if (code === "invalid_argument") { S.readOnly = true; toast("This page is view-only for you, so changes aren't saved."); renderAll(); }
  else if (code === "quota_exceeded") toast("The roster storage is full. Delete something you no longer need, then try again.");
  else if (code === "revoked") { S.dbState = "revoked"; renderAll(); }
  else toast("Couldn't save that change. Check your connection, then try again.");
}
async function putDoc(col, id, data) {
  try { await S.db.collection(col).doc(id).set(data); return true; }
  catch (e) {
    if (e && e.code === "unavailable") {
      await sleep(400 + Math.random() * 700);
      try { await S.db.collection(col).doc(id).set(data); return true; } catch (e2) { writeFailed(e2); return false; }
    }
    writeFailed(e); return false;
  }
}
async function writeDoc(col, obj) {
  if (!S.db || S.readOnly) return false;
  const key = col + "/" + obj.id;
  const q = queue[key] || (queue[key] = {busy: false, next: null});
  q.next = bodyOf(obj);
  if (q.busy) return true;
  q.busy = true; let ok = true;
  while (q.next) { const data = q.next; q.next = null; ok = await putDoc(col, obj.id, data); }
  q.busy = false;
  if (!timers[key]) delete dirty[key];
  return ok;
}
function scheduleWrite(col, obj) {
  const key = col + "/" + obj.id; dirty[key] = obj;
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => { timers[key] = null; writeDoc(col, dirty[key] || obj); }, 500);
}
// a press (not typing) is saved at once, so nothing is waiting to be saved if the page closes right after
function saveNow(col, obj) {
  const key = col + "/" + obj.id;
  clearTimeout(timers[key]); timers[key] = null; dirty[key] = obj;
  return writeDoc(col, obj);
}
async function removeDoc(col, id) {
  try { await S.db.collection(col).doc(id).delete(); return true; } catch (e) { writeFailed(e); return false; }
}
function slug(name, list) {
  let base = String(name || "entry").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "entry";
  let id = base, n = 2; const ids = new Set(list.map((x) => x.id));
  while (ids.has(id)) id = base + "-" + n++;
  return id;
}
const nextOrder = (list) => list.reduce((m, x) => Math.max(m, num(x.order) || 0), 0) + 1;

function listen(col) {
  S.db.collection(col).orderBy("order").onSnapshot((snap) => {
    S[col] = snap.docs.map((d) => {
      const key = col + "/" + d.id;
      return dirty[key] ? dirty[key] : Object.assign({id: d.id}, JSON.parse(JSON.stringify(d.data() || {})));
    });
    S.loaded[col] = true;
    if (col === "servants") fixLawOrder();
    if (col === "servants" || col === "guests") moveGuests();
    if (col === "servants" && S.selected && !S.servants.some((x) => x.id === S.selected) && S.editing !== "new") { S.selected = null; S.editing = null; }
    renderAll();
  }, (err) => {
    if (err && err.code === "revoked") S.dbState = "revoked";
    else toast("Lost the live connection to your roster. Reload the page to reconnect.");
    renderAll();
  });
}


/* ---------- local storage (this file keeps everything in this browser) ---------- */
const SEED = @@seed@@;
const LS_KEY = "spirit-origin-list:v1";
function loadState() {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.servants)) return {servants: d.servants, parties: d.parties || [], guests: d.guests || []}; } } catch (e) {}
  return JSON.parse(JSON.stringify(SEED));
}
const store = loadState();
const listeners = {servants: [], parties: [], guests: []};
function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({servants: store.servants, parties: store.parties, guests: store.guests, savedAt: new Date().toISOString()})); return true; }
  catch (e) { toast("Couldn't save in this browser. Export a backup so nothing is lost."); return false; }
}
function snapshotOf(col) {
  const docs = store[col].slice().sort((a, b) => (num(a.order) ?? 1e9) - (num(b.order) ?? 1e9)).map((d) => { const body = Object.assign({}, d); delete body.id; return {id: d.id, exists: true, data: () => body, metadata: {fromCache: false, hasPendingWrites: false}}; });
  return {docs: docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {fromCache: false, hasPendingWrites: false}};
}
function notify(col) { listeners[col].forEach((fn) => { try { fn(snapshotOf(col)); } catch (e) {} }); }
const localDb = {
  collection(col) {
    const q = {
      orderBy() { return q; },
      onSnapshot(next) { listeners[col].push(next); setTimeout(() => next(snapshotOf(col)), 0); return () => { listeners[col] = listeners[col].filter((f) => f !== next); }; },
      doc(id) { return {
        set: async (body) => { const o = Object.assign({id: id}, JSON.parse(JSON.stringify(body))); const i = store[col].findIndex((x) => x.id === id); if (i >= 0) store[col][i] = o; else store[col].push(o); if (!persist()) throw {code: "quota_exceeded"}; notify(col); },
        delete: async () => { store[col] = store[col].filter((x) => x.id !== id); persist(); notify(col); }
      }; }
    };
    return q;
  }
};
window.addEventListener("storage", (e) => {
  if (e.key !== LS_KEY || !e.newValue) return;
  try { const d = JSON.parse(e.newValue); COLS.forEach((c) => { store[c] = d[c] || []; notify(c); }); } catch (err) {}
});

/* images: IndexedDB in this browser, falling back to localStorage */
const imgStore = {
  _db: null, _bad: false,
  async open() {
    if (this._db || this._bad) return this._db;
    try {
      this._db = await new Promise((res, rej) => { const r = indexedDB.open("spirit-origin-list-images", 1); r.onupgradeneeded = () => r.result.createObjectStore("img"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    } catch (e) { this._bad = true; this._db = null; }
    return this._db;
  },
  async put(id, blob) {
    const db = await this.open();
    if (db) {
      await new Promise((res, rej) => { const t = db.transaction("img", "readwrite"); t.objectStore("img").put(blob, id); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
      return;
    }
    const url = await blobToDataURL(blob);
    try { localStorage.setItem("spirit-origin-list:img:" + id, url); } catch (e) { throw {code: "quota_or_state"}; }
  },
  async del(id) {
    const db = await this.open();
    if (db) { await new Promise((res) => { const t = db.transaction("img", "readwrite"); t.objectStore("img").delete(id); t.oncomplete = () => res(); t.onerror = () => res(); }); return; }
    try { localStorage.removeItem("spirit-origin-list:img:" + id); } catch (e) {}
  },
  async all() {
    const out = {}; const db = await this.open();
    if (db) {
      await new Promise((res) => { const t = db.transaction("img", "readonly"); const rq = t.objectStore("img").openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else res(); }; rq.onerror = () => res(); });
    } else {
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("spirit-origin-list:img:")) out[k.slice(23)] = localStorage.getItem(k); } } catch (e) {}
    }
    return out;
  }
};
function blobToDataURL(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); }); }
const localAssets = {
  async upload(blob) {
    const id = "img_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await imgStore.put(id, blob);
    return {id: id, url: URL.createObjectURL(blob), sizeBytes: blob.size, contentType: blob.type};
  },
  async delete(id) {
    await imgStore.del(id);
    const u = S.urlCache[id]; if (u && u.startsWith("blob:")) URL.revokeObjectURL(u);
    delete S.urlCache[id]; return {deleted: true};
  }
};
const localDownloads = {
  async save(req) {
    const blob = req.data instanceof Blob ? req.data : new Blob([req.data], {type: "application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = req.filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return {status: "saved"};
  }
};
function renderBackupNote() {
  let last = null; try { last = localStorage.getItem(LS_KEY + ":lastBackup"); } catch (e) {}
  const when = last ? new Date(last).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"}) : null;
  $("#save-note").textContent = "Saved in this browser on this computer. " + (when ? "Last backup: " + when + "." : "No backup yet: use Export backup now and then.");
}

async function init() {
  fillClassFilter();
  S.db = localDb; S.dbState = "ok"; S.readOnly = false; S.downloads = localDownloads; S.assets = localAssets;
  try {
    const all = await imgStore.all();
    Object.keys(all).forEach((id) => { const v = all[id]; S.urlCache[id] = typeof v === "string" ? v : URL.createObjectURL(v); });
  } catch (e) {}
  COLS.forEach(listen);
  renderBackupNote();
}

/* ---------- ascension art ---------- */
const SLOTS = [{k: "1", t: "Stage 1"}, {k: "2", t: "Stage 2"}, {k: "3", t: "Stage 3"}, {k: "4", t: "Stage 4"}];
const MAX_COSTUMES = 8;
function costumeCount(s) {
  let n = Math.max(1, num(s && s.costumeSlots) || 1);
  Object.keys((s && s.art) || {}).forEach((k) => { const m = /^c(\d*)$/.exec(k); if (m) n = Math.max(n, m[1] ? Number(m[1]) : 1); });
  return Math.min(MAX_COSTUMES, n);
}
function costumeName(s, k) { const v = s && s.artNames && s.artNames[k]; return typeof v === "string" ? v.trim() : ""; }
function slotsOf(s) {
  const n = costumeCount(s); const out = SLOTS.slice();
  for (let i = 1; i <= n; i++) { const k = i === 1 ? "c" : "c" + i, def = n > 1 ? "Costume " + i : "Costume"; out.push({k: k, t: costumeName(s, k) || def, def: def}); }
  return out;
}
const slotLabel = (s, k) => { const f = slotsOf(s).find((x) => x.k === k); return f ? f.t : "Image"; };
const artOf = (s, k) => (s && s.art && typeof s.art[k] === "string" && s.art[k] && S.urlCache[s.art[k]]) ? s.art[k] : null;
const artSrc = (id) => S.urlCache[id] || "";
function iconSlot(s) {
  if (artOf(s, s.artStage)) return s.artStage;
  const f = slotsOf(s).find((x) => artOf(s, x.k)); return f ? f.k : null;
}
function iconHTML(s, size) {
  const k = iconSlot(s);
  if (k) return `<img class="avatar${size ? " " + size : ""}" src="${esc(artSrc(artOf(s, k)))}" alt="" data-art="1" loading="lazy">`;
  if (CLASS_LOGO[s.cls]) return `<img class="avatar logo${size ? " " + size : ""}" src="${CLASS_LOGO[s.cls]}" alt="${esc(s.cls)}">`;
  return `<span class="mono-tag${size ? " " + size : ""}">${esc(ABBR[s.cls] || "—")}</span>`;
}
function viewSlot(s) { return S.viewStage[s.id] || iconSlot(s) || "1"; }

async function shrink(file) {
  if (/gif|svg/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1100 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5e6 && /png|jpeg|webp/.test(file.type)) { if (bmp.close) bmp.close(); return file; }
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
    const out = await new Promise((r) => c.toBlob(r, "image/webp", 0.9));
    return out && out.size ? out : file;
  } catch (e) { return file; }
}

function uploadFailed(e) {
  const code = e && e.code;
  if (code === "too_large") toast("That image is over 20 MB. Use a smaller one.");
  else if (code === "unsupported_type") toast("Use a PNG, JPG, WebP or GIF image.");
  else if (code === "quota_or_state") toast("This browser's storage is full. Remove some images or export a backup, then try again.");
  else if (code === "rate_limited") toast("Too many uploads at once. Wait a moment, then try again.");
  else if (code === "upstream_auth") toast("Your sign-in expired. Reload the page, then try again.");
  else if (code === "not_granted" || code === "capability_disabled" || code === "capability_removed") { S.assets = null; toast("Images can't be added in this view."); renderDossier(); }
  else toast("Couldn't upload that image. Try again.");
}

async function uploadArt(id, slot, file) {
  if (!S.assets || S.readOnly || !file) return;
  if (!/^image\//.test(file.type || "")) { toast("That file isn't an image."); return; }
  const s = S.servants.find((x) => x.id === id); if (!s) return;
  S.uploading = {id: id, slot: slot}; renderDossier();
  const blob = await shrink(file);
  let r = null;
  try { r = await S.assets.upload(blob, {type: blob.type || file.type}); }
  catch (e) {
    if (e && e.code === "store_unavailable") { await sleep(800); try { r = await S.assets.upload(blob, {type: blob.type || file.type}); } catch (e2) { uploadFailed(e2); } }
    else uploadFailed(e);
  }
  S.uploading = null;
  if (!r) { renderDossier(); return; }
  S.urlCache[r.id] = r.url;
  const cur = S.servants.find((x) => x.id === id) || s;
  const old = artOf(cur, slot);
  cur.art = Object.assign({}, cur.art || {}, {[slot]: r.id});
  if (!artOf(cur, cur.artStage)) cur.artStage = slot;
  S.viewStage[id] = slot;
  const ok = await writeDoc("servants", cur);
  renderList(); renderDossier(); renderParties();
  if (ok && old && old !== r.id) { try { await S.assets.delete(old); } catch (e) {} }
  if (ok) toast(slotLabel(cur, slot) + " image saved.");
}

async function removeArt(id, slot) {
  const s = S.servants.find((x) => x.id === id); const old = artOf(s, slot);
  S.artConfirm = null;
  if (!s || !old) { renderDossier(); return; }
  const art = Object.assign({}, s.art); delete art[slot]; s.art = art;
  if (s.artStage === slot) { const f = slotsOf(s).find((x) => artOf(s, x.k)); s.artStage = f ? f.k : null; }
  const ok = await writeDoc("servants", s);
  renderList(); renderDossier(); renderParties();
  if (ok && S.assets) { try { await S.assets.delete(old); } catch (e) {} }
}

function artHTML(s) {
  const slots = slotsOf(s);
  let slot = viewSlot(s); if (!slots.some((x) => x.k === slot)) slot = "1";
  const id = artOf(s, slot);
  const label = slotLabel(s, slot);
  const canEdit = !!S.assets && !S.readOnly;
  const busy = S.uploading && S.uploading.id === s.id && S.uploading.slot === slot;
  let frame;
  if (busy) frame = `<div class="art-frame drop"><div class="drop-msg"><strong>Uploading ${esc(label)}…</strong></div></div>`;
  else if (id) frame = `<div class="art-frame" data-drop="${esc(slot)}"><img src="${esc(artSrc(id))}" alt="${esc(s.name)}, ${esc(label)}" data-art="1" data-action="art-next" title="Click for the next stage"></div>`;
  else if (canEdit) frame = `<div class="art-frame drop" data-drop="${esc(slot)}"><div class="drop-msg"><strong>Add ${esc(label)} art</strong><span>Copy the image on the wiki and press Ctrl+V here, drop a file, or</span><label class="btn sm file-btn">Choose image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-art-file="${esc(slot)}"></label></div></div>`;
  else frame = `<div class="art-frame"><div class="drop-msg">No ${esc(label)} image yet.</div></div>`;
  const icon = iconSlot(s);
  const n = costumeCount(s);
  let tabs = slots.map((x) => {
    const a = artOf(s, x.k);
    const isIcon = a && x.k === icon;
    return `<button class="stage-btn" data-action="stage" data-slot="${x.k}" aria-pressed="${x.k === slot}" title="${esc(x.t)}" aria-label="${esc(x.t)}${isIcon ? ", shown as icon" : (a ? "" : ", empty")}">${a ? `<img class="thumb${isIcon ? " is-icon" : ""}" src="${esc(artSrc(a))}" alt="" data-art="1" loading="lazy">` : `<i class="thumb"></i>`}<span><b>${esc(x.t)}</b><small class="${isIcon ? "on" : ""}">${isIcon ? "Icon" : (a ? "&nbsp;" : "Empty")}</small></span></button>`;
  }).join("");
  if (canEdit && n < MAX_COSTUMES) tabs += `<button class="stage-btn add" data-action="add-costume" title="${n === 1 ? "Add second costume" : "Add another costume"}" aria-label="${n === 1 ? "Add second costume" : "Add another costume"}"><span class="plus">+</span><span><b>${n === 1 ? "2nd" : "Add"}</b><small>costume</small></span></button>`;
  let actions = "";
  if (canEdit && id && !busy) {
    actions = S.artConfirm === slot
      ? `<div class="confirm"><p>Remove the ${esc(label)} image?</p><button class="btn danger solid sm" data-action="art-remove-go" data-slot="${slot}">Remove</button><button class="btn ghost sm" data-action="art-keep">Keep it</button></div>`
      : `<div class="art-actions"><label class="btn sm file-btn">Replace image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-art-file="${esc(slot)}"></label><button class="btn danger sm" data-action="art-remove" data-slot="${slot}">Remove</button></div>`;
  } else if (canEdit && !id && !busy && n > 1 && slot === "c" + n) {
    actions = `<div class="art-actions"><button class="btn ghost sm" data-action="remove-costume-slot">Remove this costume slot</button></div>`;
  }
  const cur = slots.find((x) => x.k === slot);
  const logo = CLASS_LOGO[s.cls];
  const clsBadge = s.cls ? `<div class="cls-badge${EXTRA_ACC[s.cls] ? " extra" : ""}">${logo ? `<img src="${logo}" alt="">` : `<span class="mono-tag">${esc(ABBR[s.cls] || "—")}</span>`}<span><small>Class</small><b>${esc(s.cls)}</b></span></div>` : "";
  const nameBox = canEdit && !busy && /^c\d*$/.test(slot) ? `<div class="cos-name"><label for="cos-name">Costume name</label><input id="cos-name" type="text" data-costume-name="${esc(slot)}" maxlength="48" autocomplete="off" value="${esc(costumeName(s, slot))}" placeholder="${esc(cur ? cur.def : "Costume")} (type a name)"></div>` : "";
  const st = levelStatus(s);
  return `<section class="d-sec"><h3>Ascension art <small>click a stage to switch the picture, colours and icon</small></h3>
    <div class="scene${st && st.kind === "grail" ? " grailed" : ""}${EXTRA_ACC[s.cls] ? " extra" : ""}${grTier(s)}"${EXTRA_ACC[s.cls] ? ` style="--acc: rgb(${EXTRA_ACC[s.cls].join(",")})"` : ""}><canvas class="scene-fx" id="scene-fx" aria-hidden="true"></canvas>${grTier(s) ? grFX : ""}
      <div class="art">${frame}<div class="art-side"><div class="stage-list" role="group" aria-label="Ascension stages and costumes">${tabs}</div>${clsBadge}${nameBox}${actions}</div></div>
    </div>
    ${canEdit ? `<p class="art-hint">Tip: on the wiki, right-click a stage image, choose Copy image, then come back and press Ctrl+V (Cmd+V on a Mac) to add it to the selected stage.</p>` : ""}
  </section>`;
}

/* ---------- living background: palette from the stage art, effects from rarity, level, grails and class ---------- */
const RM = window.matchMedia("(prefers-reduced-motion: reduce)");
const DEFAULT_PAL = ["#c9b48f", "#a99070", "#e3d6c1"];
const palCache = {};
const hexToRgb = (h) => { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
function extractPalette(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    if (palCache[src]) return resolve(palCache[src]);
    const img = new Image();
    img.onload = () => {
      try {
        const W = 56, H = Math.max(1, Math.round(56 * (img.naturalHeight || 1) / (img.naturalWidth || 1)));
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const cx = cv.getContext("2d", {willReadFrequently: true}); cx.drawImage(img, 0, 0, W, H);
        const d = cx.getImageData(0, 0, W, H).data; const buckets = new Map();
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 200) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
          if (l > 0.93 || l < 0.07) continue;
          const sat = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
          const key = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5);
          const e = buckets.get(key) || {n: 0, r: 0, g: 0, b: 0, s: 0}; e.n++; e.r += r; e.g += g; e.b += b; e.s += sat; buckets.set(key, e);
        }
        const list = Array.from(buckets.values()).map((e) => ({r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, w: e.n * (0.3 + e.s / e.n)})).sort((a, b) => b.w - a.w);
        const picks = [];
        for (const e of list) { if (picks.every((q) => Math.hypot(q.r - e.r, q.g - e.g, q.b - e.b) > 58)) picks.push(e); if (picks.length === 3) break; }
        if (!picks.length) return resolve(null);
        while (picks.length < 3) picks.push(picks[picks.length - 1]);
        const hex = picks.map((q) => "#" + [q.r, q.g, q.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""));
        palCache[src] = hex; resolve(hex);
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.src = src;
  });
}
/* page tones: the stage art's hues, held in a lightness band so text on the page stays readable */
const DARK_Q = window.matchMedia("(prefers-color-scheme: dark)");
const isDark = () => { const t = document.documentElement.getAttribute("data-theme"); return t ? t === "dark" : DARK_Q.matches; };
function rgbToHsl(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb(h, s, l) {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t % 1 + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
const toHex = (c) => "#" + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function toneOf(hex, L, dark, vivid) {
  const hsl = rgbToHsl(hexToRgb(hex));
  const s = vivid ? (hsl[1] < 0.06 ? 0.3 : clamp(hsl[1] * 1.7 + 0.12, dark ? 0.55 : 0.62, dark ? 0.9 : 0.98))
    : (hsl[1] < 0.08 ? hsl[1] : clamp(hsl[1] * 1.25, dark ? 0.3 : 0.4, dark ? 0.7 : 0.85));
  return hslToRgb(hsl[0], s, L);
}
function vividHex(hex) { const hsl = rgbToHsl(hexToRgb(hex)); return toHex(hslToRgb(hsl[0], hsl[1] < 0.06 ? hsl[1] : clamp(hsl[1] * 1.5 + 0.15, 0, 1), clamp(hsl[2], 0.26, 0.66))); }
// Extra classes get a signature accent, richer colours and harder-hitting effects
const EXTRA_ACC = {Ruler: [255, 200, 70], Avenger: [228, 32, 62], "Moon Cancer": [236, 80, 204], "Alter Ego": [64, 222, 255], Foreigner: [70, 230, 210], Pretender: [92, 232, 160], Shielder: [104, 160, 255], Beast: [255, 120, 200]};
const PAGE_L = {light: [0.80, 0.72, 0.86], dark: [0.21, 0.15, 0.27]};
const PAGE_LX = {light: [0.77, 0.70, 0.83], dark: [0.24, 0.16, 0.30]};
let curPal = DEFAULT_PAL, curExtra = null;
function paintPage() {
  const dark = isDark(), x = curExtra, L = (x ? PAGE_LX : PAGE_L)[dark ? "dark" : "light"], r = document.documentElement.style;
  const tones = curPal.map((hx, i) => toneOf(hx, L[i], dark, !!x));
  if (x) { tones[1] = mixC(tones[1], toneOf(toHex(x), L[1], dark, true), 0.45); tones[0] = mixC(tones[0], toneOf(toHex(x), L[0], dark, true), 0.2); }
  tones.forEach((c, i) => r.setProperty("--g" + (i + 1), toHex(c)));
  if (x) r.setProperty("--acc", toHex(dark ? x : mixC(x, [0, 0, 0], 0.15))); else r.removeProperty("--acc");
  PAGE.light = !dark;
  PAGE.hi = dark ? [255, 255, 255] : toneOf(curPal[0], 0.32, false, !!x);
  PAGE.shade = dark ? [8, 5, 14] : toneOf(curPal[1], 0.2, false);
}
DARK_Q.addEventListener("change", paintPage);

let themeKey = "";
async function applyTheme(s) {
  const slot = s ? viewSlot(s) : null; const id = s && slot ? artOf(s, slot) : null;
  const key = (s ? s.id + "|" + s.cls : "") + "|" + (id || "");
  if (key === themeKey) return;
  themeKey = key;
  const raw = (id ? await extractPalette(artSrc(id)) : null) || DEFAULT_PAL;
  if (key !== themeKey) return;
  const x = s ? extraAccOf(s, raw) : null, pal = x ? raw.map(vividHex) : raw;
  const r = document.documentElement.style;
  r.setProperty("--p1", pal[0]); r.setProperty("--p2", pal[1]); r.setProperty("--p3", pal[2]);
  curPal = pal; curExtra = x; const rgb = pal.map(hexToRgb); SCENE.pal = rgb; PAGE.pal = rgb; paintPage();
  const a = document.querySelector(".aura");
  if (a) { a.classList.toggle("beast", !!s && s.cls === "Beast"); a.classList.toggle("foreigner", !!s && s.cls === "Foreigner"); a.classList.toggle("extra", !!x); }
  setEmblem(s, x);
}
// The class emblem drifting large in the page background, cross-fading when the class changes
let embTimer = 0;
function setEmblem(s, x) {
  const emb = document.getElementById("page-emblem"); if (!emb) return;
  const src = s ? CLASS_MARK[s.cls] || "" : "";
  const show = () => {
    emb.classList.toggle("extra", !!x); emb.classList.toggle("beast", !!s && s.cls === "Beast");
    if (src) { emb.style.setProperty("--emb", 'url("' + src + '")'); emb.querySelector("img").src = src; emb.dataset.src = src; emb.classList.add("on"); }
  };
  clearTimeout(embTimer);
  setClassWord(s, x);
  if (!src) { emb.classList.remove("on"); return; }
  if (emb.dataset.src === src) { show(); return; }
  if (emb.classList.contains("on")) { emb.classList.remove("on"); embTimer = setTimeout(show, 420); } else show();
}
// The class name set huge in the top-left of the page, animated in the class's own way
const PC_HI = {Saber: [150, 190, 255], Archer: [255, 178, 90], Lancer: [90, 170, 255], Rider: [255, 150, 70], Caster: [170, 120, 255], Assassin: [150, 130, 190], Berserker: [235, 50, 50]};
let pcCls = "", pcTimer = 0;
function setClassWord(s, x) {
  const box = document.getElementById("page-class"); if (!box) return;
  const cls = s && s.cls ? s.cls : "";
  if (cls === pcCls) return;
  pcCls = cls; clearTimeout(pcTimer);
  const draw = () => {
    if (!cls) { box.innerHTML = ""; return; }
    const kind = KIND[cls] || "motes", hi = x || PC_HI[cls] || [200, 170, 110], letters = cls.toUpperCase().split("");
    const n = letters.length;
    const spans = letters.map((ch, i) => {
      if (ch === " ") return `<span class="sp" style="--i:${i}"> </span>`;
      const j = (i * (n % 7 ? 7 : 3) + 3) % n, dx = ((i * 37) % 11 - 5) * 0.12, dy = ((i * 53) % 9 - 4) * 0.15, rz = ((i * 29) % 13 - 6) * 6;
      return `<span data-c="${esc(ch)}" style="--i:${i};--j:${j};--dx:${dx.toFixed(2)}em;--dy:${dy.toFixed(2)}em;--rz:${rz}deg">${esc(ch)}</span>`;
    }).join("");
    box.innerHTML = `<div class="pc-word${x ? " x" : ""}" data-k="${kind}" style="--n:${n};--hi-rgb:${hi.map((v) => v | 0).join(",")}" lang="en">${spans}</div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => { const w = box.firstElementChild; if (w) w.classList.add("on"); }));
  };
  const old = box.firstElementChild;
  if (old && !RM.matches) { old.classList.add("out"); pcTimer = setTimeout(draw, 340); } else draw();
}

/* one engine, two canvases: the banner behind the art and the whole page behind everything */
const KIND = {Saber: "slash", Archer: "rain", Lancer: "volley", Rider: "charge", Caster: "circle", Assassin: "shade", Berserker: "pulse", Ruler: "beams", Avenger: "embers", "Moon Cancer": "moon", "Alter Ego": "glitch", Foreigner: "abyss", Pretender: "petals", Shielder: "hex", Beast: "rainbow"};
const STAR_COL = {5: [255, 196, 40], 4: [230, 208, 162], 3: [214, 156, 98], 2: [196, 196, 196], 1: [196, 196, 196]};
const FOR_COL = {dark: [[80, 232, 214], [160, 112, 255], [255, 132, 206]], light: [[0, 138, 130], [104, 58, 214], [190, 50, 136]]};
const rnd = (a, b) => a + Math.random() * (b - a);
const rgba = (c, a) => "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
function fxNew(page) { return {page: page, cv: null, cx: null, w: 0, h: 0, key: "", p: null, parts: [], fx: [], waves: [], comets: [], surge: 1, timer: 0, last: 0, pal: DEFAULT_PAL.map(hexToRgb), hi: [255, 255, 255], shade: [8, 5, 14], light: false}; }
const SCENE = fxNew(false), PAGE = fxNew(true);
const GRAIL_IMG = new Image(); GRAIL_IMG.src = "@@asset:grail.webp@@";
const CLASS_LOGO = {"Saber": "@@asset:class-logo-saber.webp@@", "Archer": "@@asset:class-logo-archer.webp@@", "Lancer": "@@asset:class-logo-lancer.webp@@", "Rider": "@@asset:class-logo-rider.webp@@", "Caster": "@@asset:class-logo-caster.webp@@", "Assassin": "@@asset:class-logo-assassin.webp@@", "Berserker": "@@asset:class-logo-berserker.webp@@", "Ruler": "@@asset:class-logo-ruler.webp@@", "Avenger": "@@asset:class-logo-avenger.webp@@", "Moon Cancer": "@@asset:class-logo-moon-cancer.webp@@", "Alter Ego": "@@asset:class-logo-alter-ego.webp@@", "Foreigner": "@@asset:class-logo-foreigner.webp@@", "Pretender": "@@asset:class-logo-pretender.webp@@", "Shielder": "@@asset:class-logo-shielder.webp@@", "Beast": "@@asset:class-logo-beast.webp@@"};
const CLASS_MARK = {"Saber": "@@asset:class-mark-saber.webp@@", "Archer": "@@asset:class-mark-archer.webp@@", "Lancer": "@@asset:class-mark-lancer.webp@@", "Rider": "@@asset:class-mark-rider.webp@@", "Caster": "@@asset:class-mark-caster.webp@@", "Assassin": "@@asset:class-mark-assassin.webp@@", "Berserker": "@@asset:class-mark-berserker.webp@@", "Ruler": "@@asset:class-mark-ruler.webp@@", "Avenger": "@@asset:class-mark-avenger.webp@@", "Moon Cancer": "@@asset:class-mark-moon-cancer.webp@@", "Alter Ego": "@@asset:class-mark-alter-ego.webp@@", "Foreigner": "@@asset:class-mark-foreigner.webp@@", "Pretender": "@@asset:class-mark-pretender.webp@@", "Shielder": "@@asset:class-mark-shielder.webp@@", "Beast": "@@asset:class-mark-beast.webp@@"};
const CARD_IMG = {"Quick": "@@asset:card-quick.webp@@", "Arts": "@@asset:card-arts.webp@@", "Buster": "@@asset:card-buster.webp@@"};
let fxRaf = 0;

function fxParams(s) {
  const cap = CAPS[s.rarity] || 90, lv = clamp(num(s.level) || 1, 1, 120);
  return {rarity: clamp(num(s.rarity) || 0, 0, 5), level: lv, grails: Math.max(0, lv - cap), kind: KIND[s.cls] || "motes", beast: s.cls === "Beast", foreign: s.cls === "Foreigner", pret: s.cls === "Pretender", extra: EXTRA_ACC[s.cls] || null};
}
function fxAttach(s, keepPage) {
  SCENE.cv = document.getElementById("scene-fx"); PAGE.cv = document.getElementById("page-fx");
  for (const F of [SCENE, PAGE]) {
    if (!F.cv) { F.p = null; F.key = ""; continue; }
    F.cx = F.cv.getContext("2d");
    if (!s) { if (F === PAGE && keepPage) continue; F.p = null; F.key = ""; F.cx.setTransform(1, 0, 0, 1, 0, 0); F.cx.clearRect(0, 0, F.cv.width, F.cv.height); continue; }
    const p = fxParams(s), key = s.id + "|" + p.level + "|" + p.rarity + "|" + p.kind;
    if (key !== F.key) { F.key = key; F.p = p; fxSeed(F); }
  }
  if (RM.matches) { requestAnimationFrame((t) => { fxFrame(SCENE, t); fxFrame(PAGE, t); }); return; }
  if (!fxRaf) fxRaf = requestAnimationFrame(fxLoop);
}
function fxLoop(now) {
  fxRaf = 0; let live = false;
  for (const F of [SCENE, PAGE]) {
    if (F.cv && !F.cv.isConnected) { F.cv = null; F.p = null; F.key = ""; }
    if (!F.cv || !F.p) continue;
    live = true;
    if (document.hidden) continue;
    if (F === PAGE && S.selected && !isWide()) continue; // the phone sheet covers the page
    fxFrame(F, now);
  }
  if (live) fxRaf = requestAnimationFrame(fxLoop);
}
window.addEventListener("resize", () => { if (RM.matches) requestAnimationFrame((t) => { fxFrame(SCENE, t); fxFrame(PAGE, t); }); });
function fxSize(F) {
  const c = F.cv, dpr = F.page ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return false;
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  F.cx.setTransform(dpr, 0, 0, dpr, 0, 0); F.w = w; F.h = h; return true;
}
function fxSeed(F) {
  const p = F.p, P = [], pg = F.page, dens = (pg ? 2.4 : 1) * (p.extra ? 1.4 : 1);
  F.fx = []; F.waves = []; F.comets = []; F.surge = rnd(0.4, 1.2); F.timer = rnd(1, 2.5); F.wheel = 0; F.beat = 0; F.bt = 0; F.bi = 0;
  const n = (b) => Math.round(b * dens * (0.55 + p.level / 140));
  for (let i = 0; i < Math.round((10 + p.level / 5) * dens); i++) P.push({t: "mote", x: Math.random(), y: Math.random(), r: rnd(0.8, 2.4), vx: rnd(-0.012, 0.012), vy: rnd(-0.04, -0.01), ph: rnd(0, 6.3)});
  for (let i = 0; i < Math.min(pg ? 80 : 60, p.grails * (pg ? 3 : 2)); i++) P.push({t: "grail", a: rnd(0, 6.3), rad: rnd(0.2, 0.5), sp: rnd(0.08, 0.2) * (Math.random() < 0.5 ? -1 : 1), r: rnd(1.4, 3), ph: rnd(0, 6.3)});
  if (pg) for (let i = 0; i < p.rarity * 3; i++) P.push({t: "rstar", x: Math.random(), y: Math.random(), r: rnd(4, 9), vy: rnd(-0.012, -0.004), rot: rnd(0, 6.3), vr: rnd(-0.25, 0.25), ph: rnd(0, 6.3), i: i % 5});
  const k = p.kind;
  if (k === "volley") for (let i = 0; i < n(12); i++) { const a = rnd(-0.35, -0.05); P.push({t: "jab", x: rnd(-0.3, 1), y: rnd(0, 1.1), a: a, v: rnd(0.9, 1.6), len: rnd(0.08, 0.2)}); }
  if (k === "charge") for (let i = 0; i < n(14); i++) P.push({t: "wind", x: rnd(0, 1.2), y: rnd(0.02, 0.86), v: rnd(1.1, 2), len: rnd(0.1, 0.3), th: rnd(1, 2.4)});
  if (k === "rain") for (let i = 0; i < n(20); i++) P.push({t: "rain", x: Math.random(), y: Math.random(), v: rnd(0.35, 0.7)});
  if (k === "embers") {
    for (let i = 0; i < n(30); i++) P.push({t: "ember", x: Math.random(), y: Math.random(), v: rnd(0.08, 0.22), r: rnd(1, 3.4), ph: rnd(0, 6.3), hot: Math.random() < 0.65});
    const nf = pg ? 16 : 8; for (let i = 0; i < nf; i++) P.push({t: "flame", x: (i + rnd(0.1, 0.9)) / nf, w: rnd(0.035, 0.07) * (pg ? 0.7 : 1.4), h: rnd(0.14, 0.3), ph: rnd(0, 6.3)});
  }
  if (k === "petals") {
    for (let i = 0; i < n(46); i++) P.push({t: "petal", ang: rnd(0, 6.3), rad: rnd(0.1, 0.75), va: rnd(0.35, 0.85) * (Math.random() < 0.8 ? 1 : -1), rot: rnd(0, 6.3), vr: rnd(-2, 2), r: rnd(4, 9), ph: rnd(0, 6.3)});
    for (let i = 0; i < n(16); i++) P.push({t: "fairy", ang: rnd(0, 6.3), rad: rnd(0.08, 0.5), va: rnd(0.6, 1.2), ph: rnd(0, 6.3), r: rnd(1.5, 3.2)});
  }
  if (k === "moon") for (let i = 0; i < n(26); i++) P.push({t: "pix", x: Math.random(), y: Math.random(), v: rnd(0.08, 0.25), s: rnd(2, 5), ph: rnd(0, 6.3)});
  if (k === "shade") for (let i = 0; i < (pg ? 6 : 4); i++) P.push({t: "band", y: rnd(0.06, 0.9), amp: rnd(0.02, 0.05), sp: rnd(0.12, 0.25) * (Math.random() < 0.5 ? -1 : 1), ph: rnd(0, 6.3), th: rnd(0.1, 0.2), a: rnd(0.1, 0.16), wl: rnd(0.25, 0.45)});
  if (k === "abyss") {
    for (let i = 0; i < (pg ? 150 : 70); i++) P.push({t: "astar", a: rnd(0, 6.3), d: Math.sqrt(Math.random()), r: rnd(0.5, 1.8), ph: rnd(0, 6.3)});
    const nT = pg ? 8 : 5;
    for (let i = 0; i < nT; i++) P.push({t: "tendril", bx: (i + 0.5) / nT + rnd(-0.04, 0.04), len: rnd(0.34, 0.64), amp: rnd(0.05, 0.1), ph: rnd(0, 6.3), sp: rnd(0.6, 1.05), w: rnd(5, 9) * (pg ? 1.3 : 1)});
  }
  F.parts = P;
}
function starPath(c, x, y, r, rot) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}
function fxFrame(F, now) {
  if (!F.cv || !F.p || !F.cx || !fxSize(F)) return;
  const c = F.cx, w = F.w, h = F.h, p = F.p, t = now / 1000, pg = F.page, LT = pg && F.light;
  const dt = Math.min(0.1, F.last ? Math.max(0, now - F.last) / 1000 : 0.016); F.last = now;
  const sp = (0.6 + p.level / 110) * (p.extra ? 1.45 : 1), d = dt * sp;
  const hue = (t * 45) % 360, HI = pg ? F.hi : [255, 255, 255], ov = LT ? 0.55 : 1;
  const XA = p.pret ? EXTRA_ACC.Pretender : p.extra;
  const ACC = XA ? (p.beast ? hslToRgb(hue / 360, 0.9, LT ? 0.45 : 0.62) : (LT ? mixC(XA, [0, 0, 0], 0.25) : XA)) : null;
  const pal = ACC && !p.beast && !p.foreign && !p.pret ? F.pal.map((c3, i) => mixC(c3, ACC, i === 0 ? 0.55 : 0.35)) : F.pal;
  const FC = FOR_COL[LT ? "light" : "dark"], DK = !pg && !isDark();
  const col = (i, a, shift) => p.beast ? "hsla(" + ((hue + (shift || 0) + i * 70) % 360) + (LT ? ",80%,42%," : ",90%,66%,") + Math.max(0, a).toFixed(3) + ")"
    : (p.foreign && i > 0) ? rgba(FC[(i - 1) % 3], a) : rgba(i === 0 ? HI : pal[(i - 1) % 3], a);
  const fcx = pg ? w * 0.5 : Math.min(w / 2, 141), fcy = pg ? h * 0.46 : Math.min(h / 2, 190), M = Math.min(w, h);
  c.clearRect(0, 0, w, h);
  c.save();
  const k = p.kind;
  if (k === "slash") {
    if (Math.random() < d * (pg ? 1.6 : 1.1)) F.fx.push({x: Math.random(), y: Math.random(), life: 1, ang: rnd(-0.95, -0.45)});
    F.fx = F.fx.filter((f) => (f.life -= d * 1.4) > 0);
    for (const f of F.fx) { const L = Math.max(w, h) * (pg ? 0.3 : 0.55), x = f.x * w, y = f.y * h, dx = Math.cos(f.ang) * L, dy = Math.sin(f.ang) * L; const g = c.createLinearGradient(x - dx, y - dy, x + dx, y + dy); g.addColorStop(0, col(0, 0)); g.addColorStop(0.5, col(0, 0.7 * f.life)); g.addColorStop(1, col(0, 0)); c.strokeStyle = g; c.lineWidth = 1.5 + 3 * f.life; c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke(); }
  } else if (k === "circle") {
    // Caster: a large magic circle with a turning rune ring
    const R = M * (pg ? 0.5 : 0.64); c.translate(fcx, fcy); c.lineWidth = 1.5; c.strokeStyle = col(0, 0.45);
    c.save(); c.rotate(-t * 0.08);
    c.beginPath(); c.arc(0, 0, R * 1.16, 0, 6.283); c.stroke(); c.beginPath(); c.arc(0, 0, R * 1.04, 0, 6.283); c.stroke();
    c.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283, r0 = R * 1.065, r1 = R * 1.135, ca = Math.cos(a), sa = Math.sin(a); c.beginPath(); if (i % 4 === 0) { c.arc(ca * R * 1.1, sa * R * 1.1, R * 0.018, 0, 6.283); } else { c.moveTo(ca * r0, sa * r0); c.lineTo(ca * r1, sa * r1); if (i % 2) { c.moveTo(ca * r1, sa * r1); c.lineTo(Math.cos(a + 0.05) * r1, Math.sin(a + 0.05) * r1); } } c.stroke(); }
    c.restore();
    c.lineWidth = 1.5; c.rotate(t * 0.18); c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.stroke(); c.beginPath(); c.arc(0, 0, R * 0.84, 0, 6.283); c.stroke();
    for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.84); c.lineTo(Math.cos(a) * R * (i % 3 ? 0.92 : 1), Math.sin(a) * R * (i % 3 ? 0.92 : 1)); c.stroke(); }
    c.rotate(-t * 0.42); c.strokeStyle = col(1, 0.55);
    for (let tri = 0; tri < 2; tri++) { c.beginPath(); for (let i = 0; i < 3; i++) { const a = tri * Math.PI / 3 + i * 2.094 - Math.PI / 2; c.lineTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8); } c.closePath(); c.stroke(); }
    c.rotate(t * 0.7); c.strokeStyle = col(2, 0.5); c.beginPath(); c.arc(0, 0, R * 0.42, 0, 6.283); c.stroke();
    c.beginPath(); for (let i = 0; i < 5; i++) { const a = i * 2 * 2.513 - Math.PI / 2; c.lineTo(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42); } c.closePath(); c.stroke();
  } else if (k === "volley") {
    // Lancer: a barrage of spears driven home, each hit flashing, cracking and throwing sparks
    const UND = DK ? "rgba(25,18,40,0.32)" : null;
    for (const q of F.parts) if (q.t === "jab") {
      q.x += Math.cos(q.a) * q.v * d; q.y += Math.sin(q.a) * q.v * d; if (q.x > 1.2 || q.y < -0.2 || q.y > 1.2) { q.x = rnd(-0.4, -0.05); q.y = rnd(0, 1.1); }
      const x = q.x * w, y = q.y * h, L = q.len * w, g = c.createLinearGradient(x - Math.cos(q.a) * L, y - Math.sin(q.a) * L, x, y);
      g.addColorStop(0, col(0, 0)); g.addColorStop(1, col(0, 0.4)); c.strokeStyle = g; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - Math.cos(q.a) * L, y - Math.sin(q.a) * L); c.lineTo(x, y); c.stroke();
    }
    if (Math.random() < d * (pg ? 3 : 2.6)) F.fx.push({tx: rnd(0.12, 0.92), ty: rnd(0.1, 0.9), a: rnd(-0.55, 0.35) + (Math.random() < 0.25 ? Math.PI : 0), t: 0, sp: null, cr: null});
    const L = Math.max(w, h) * 0.75, len = M * (pg ? 0.26 : 0.5), fly = 0.18;
    F.fx = F.fx.filter((f) => (f.t += dt * sp) < fly + 0.85);
    for (const f of F.fx) {
      const dx = Math.cos(f.a), dy = Math.sin(f.a), nx = -dy, ny = dx, pr = Math.min(1, f.t / fly), e = 1 - Math.pow(1 - pr, 3);
      const tx = f.tx * w, ty = f.ty * h, hx = tx - dx * L * (1 - e), hy = ty - dy * L * (1 - e);
      const fade = f.t < fly ? 1 : Math.max(0, 1 - (f.t - fly) / 0.85), tl = pg ? 16 : 24, tw = pg ? 5 : 8, lw = pg ? 2.6 : 3.6;
      if (UND) { c.strokeStyle = UND.replace("0.32", (0.32 * fade).toFixed(3)); c.lineWidth = lw + 3; c.beginPath(); c.moveTo(hx - dx * len * 0.85, hy - dy * len * 0.85); c.lineTo(hx, hy); c.stroke(); }
      const g = c.createLinearGradient(hx - dx * len, hy - dy * len, hx, hy); g.addColorStop(0, col(0, 0)); g.addColorStop(1, col(0, 0.95 * fade));
      c.strokeStyle = g; c.lineWidth = lw; c.beginPath(); c.moveTo(hx - dx * len, hy - dy * len); c.lineTo(hx, hy); c.stroke();
      c.beginPath(); c.moveTo(hx + dx * tl, hy + dy * tl); c.lineTo(hx + nx * tw, hy + ny * tw); c.lineTo(hx - dx * tl * 0.35, hy - dy * tl * 0.35); c.lineTo(hx - nx * tw, hy - ny * tw); c.closePath();
      if (UND) { c.strokeStyle = UND.replace("0.32", (0.5 * fade).toFixed(3)); c.lineWidth = 2; c.stroke(); }
      c.fillStyle = col(1, fade); c.fill();
      if (pr < 1) { c.strokeStyle = col(0, 0.4); c.lineWidth = 1.2; for (const o of [-1, 1]) { c.beginPath(); c.moveTo(hx - dx * len * 1.6 + nx * o * 10, hy - dy * len * 1.6 + ny * o * 10); c.lineTo(hx - dx * len * 0.25 + nx * o * 10, hy - dy * len * 0.25 + ny * o * 10); c.stroke(); } }
      if (f.t >= fly) {
        const it = (f.t - fly) / 0.85, ix = tx + dx * tl, iy = ty + dy * tl, R0 = M * (pg ? 0.12 : 0.2), rr = R0 * Math.sqrt(it), fl = Math.pow(1 - it, 2);
        const fg = c.createRadialGradient(ix, iy, 0, ix, iy, R0 * 0.7); fg.addColorStop(0, col(0, 0.85 * fl)); fg.addColorStop(1, col(0, 0)); c.fillStyle = fg; c.fillRect(ix - R0, iy - R0, R0 * 2, R0 * 2);
        if (UND) { c.strokeStyle = UND.replace("0.32", (0.3 * (1 - it)).toFixed(3)); c.lineWidth = 5 * (1 - it) + 2; c.beginPath(); c.arc(ix, iy, rr, 0, 6.283); c.stroke(); }
        c.strokeStyle = col(0, 0.8 * (1 - it)); c.lineWidth = 3.5 * (1 - it) + 0.6; c.beginPath(); c.arc(ix, iy, rr, 0, 6.283); c.stroke();
        c.strokeStyle = col(1, 0.6 * (1 - it)); c.lineWidth = 1.5; c.beginPath(); c.arc(ix, iy, rr * 0.6, 0, 6.283); c.stroke();
        if (!f.cr) f.cr = Array.from({length: 5}, () => { const a = rnd(0, 6.283), pts = [[0, 0]]; let r = 0; for (let m = 0; m < 4; m++) { r += rnd(0.04, 0.08); pts.push([Math.cos(a + rnd(-0.35, 0.35)) * r, Math.sin(a + rnd(-0.35, 0.35)) * r]); } return pts; });
        c.strokeStyle = DK ? "rgba(30,20,40," + (0.45 * (1 - it)).toFixed(3) + ")" : col(0, 0.55 * (1 - it)); c.lineWidth = 1.4;
        for (const cr of f.cr) { c.beginPath(); cr.forEach((q, m) => { const X = ix + q[0] * M, Y = iy + q[1] * M; if (m) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.stroke(); }
        if (!f.sp) f.sp = Array.from({length: 14}, () => ({a: f.a + Math.PI + rnd(-1.5, 1.5), v: rnd(0.45, 1.2)}));
        c.fillStyle = col(2, 0.95 * (1 - it));
        for (const q of f.sp) { const dd = rr * 1.6 * q.v; c.beginPath(); c.arc(ix + Math.cos(q.a) * dd, iy + Math.sin(q.a) * dd, 2.4 * (1 - it) + 0.5, 0, 6.283); c.fill(); }
      }
    }
  } else if (k === "charge") {
    // Rider: wind tearing past, a chariot wheel at full spin, hoofbeat dust and comets arcing overhead
    const UND = DK ? "rgba(25,18,40,A)" : null;
    for (const q of F.parts) if (q.t === "wind") {
      q.x -= q.v * d; if (q.x + q.len < 0) { q.x = 1 + rnd(0, 0.3); q.y = rnd(0.02, 0.86); }
      const x0 = q.x * w, x1 = (q.x + q.len) * w, y = q.y * h, g = c.createLinearGradient(x0, y, x1, y);
      g.addColorStop(0, col(0, 0.55)); g.addColorStop(1, col(0, 0)); c.strokeStyle = g; c.lineWidth = q.th; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
    }
    const wx = pg ? w * 0.1 : w * 0.2, wy = pg ? h * 0.86 : h * 0.84, WR = M * (pg ? 0.24 : 0.4);
    F.wheel += dt * sp * 3;
    c.save(); c.translate(wx, wy);
    for (let j = 0; j < 3; j++) { c.strokeStyle = col(0, 0.18 - j * 0.05); c.lineWidth = 6 - j * 1.5; c.beginPath(); c.arc(0, 0, WR * (1.08 + j * 0.06), -Math.PI * 0.95 + F.wheel * 0, -Math.PI * 0.35); c.stroke(); }
    c.rotate(F.wheel);
    if (UND) { c.strokeStyle = UND.replace("A", "0.3"); c.lineWidth = 7; c.beginPath(); c.arc(0, 0, WR, 0, 6.283); c.stroke(); }
    c.strokeStyle = col(0, 0.55); c.lineWidth = 4; c.beginPath(); c.arc(0, 0, WR, 0, 6.283); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.arc(0, 0, WR * 0.86, 0, 6.283); c.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; if (UND) { c.strokeStyle = UND.replace("A", "0.22"); c.lineWidth = 4; c.beginPath(); c.moveTo(Math.cos(a) * WR * 0.16, Math.sin(a) * WR * 0.16); c.lineTo(Math.cos(a) * WR * 0.86, Math.sin(a) * WR * 0.86); c.stroke(); } c.strokeStyle = col(0, 0.5); c.lineWidth = 2; c.beginPath(); c.moveTo(Math.cos(a) * WR * 0.16, Math.sin(a) * WR * 0.16); c.lineTo(Math.cos(a) * WR * 0.86, Math.sin(a) * WR * 0.86); c.stroke(); }
    c.fillStyle = col(1, 0.7); c.beginPath(); c.arc(0, 0, WR * 0.16, 0, 6.283); c.fill();
    c.restore();
    const gy = h * 0.93, off = (t * sp * 320) % 60;
    c.strokeStyle = col(0, 0.3); c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, gy); c.lineTo(w, gy); c.stroke();
    c.strokeStyle = col(0, 0.5); c.lineWidth = 2.4;
    for (let x = -off; x < w; x += 60) { c.beginPath(); c.moveTo(x, gy + 6); c.lineTo(x + 24, gy + 6); c.stroke(); }
    F.beat += dt * sp;
    for (let guard = 0; F.beat >= F.bt && guard < 6; guard++) {
      for (let j = 0; j < (pg ? 4 : 3); j++) F.fx.push({x: rnd(0.12, 0.88), y: rnd(0.84, 0.95), r: rnd(5, 11), life: 1, vx: rnd(-0.4, -0.18)});
      F.bi = (F.bi + 1) % 3; F.bt += F.bi === 0 ? 0.42 : 0.1;
    }
    F.fx = F.fx.filter((f) => (f.life -= dt * 1.1) > 0);
    const dust = DK ? mixC(pal[1], [90, 70, 50], 0.5) : mixC(pal[1], [210, 190, 160], 0.5);
    for (const f of F.fx) { f.x += f.vx * dt; f.r += dt * M * 0.1; c.fillStyle = rgba(dust, 0.42 * f.life); c.beginPath(); c.arc(f.x * w, f.y * h, f.r, 0, 6.283); c.fill(); }
    if (Math.random() < d * (pg ? 1.5 : 1.2)) F.comets.push({x0: rnd(-0.1, 0.35), y0: rnd(0.45, 0.85), x1: rnd(0.7, 1.1), y1: rnd(0.02, 0.35), hy: rnd(0.15, 0.35), t: 0, trail: []});
    F.comets = F.comets.filter((m) => m.t < 1.3);
    for (const m of F.comets) {
      m.t += dt * sp; const u = Math.min(1, m.t), cy = Math.min(m.y0, m.y1) - m.hy;
      const x = ((1 - u) * (1 - u) * m.x0 + 2 * (1 - u) * u * (m.x0 + m.x1) / 2 + u * u * m.x1) * w, y = ((1 - u) * (1 - u) * m.y0 + 2 * (1 - u) * u * cy + u * u * m.y1) * h;
      if (m.t <= 1) m.trail.push([x, y]); if (m.trail.length > 26 || m.t > 1) m.trail.shift();
      for (let i = 1; i < m.trail.length; i++) { const a = i / m.trail.length; if (UND) { c.strokeStyle = UND.replace("A", (0.2 * a).toFixed(3)); c.lineWidth = 4 + 6 * a; c.beginPath(); c.moveTo(m.trail[i - 1][0], m.trail[i - 1][1]); c.lineTo(m.trail[i][0], m.trail[i][1]); c.stroke(); } c.strokeStyle = col(1, 0.45 * a); c.lineWidth = 4 + 8 * a; c.beginPath(); c.moveTo(m.trail[i - 1][0], m.trail[i - 1][1]); c.lineTo(m.trail[i][0], m.trail[i][1]); c.stroke(); c.strokeStyle = col(0, 0.9 * a); c.lineWidth = 1.2 + 3 * a; c.beginPath(); c.moveTo(m.trail[i - 1][0], m.trail[i - 1][1]); c.lineTo(m.trail[i][0], m.trail[i][1]); c.stroke(); }
      if (m.t <= 1) { const g = c.createRadialGradient(x, y, 0, x, y, 20); g.addColorStop(0, col(0, 1)); g.addColorStop(0.4, col(0, 0.55)); g.addColorStop(1, col(0, 0)); c.fillStyle = g; c.fillRect(x - 20, y - 20, 40, 40); if (UND) { c.strokeStyle = UND.replace("A", "0.35"); c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 5, 0, 6.283); c.stroke(); } c.fillStyle = col(0, 1); c.beginPath(); c.arc(x, y, 4.5, 0, 6.283); c.fill(); }
    }
  } else if (k === "shade") {
    // Assassin: slow bands of shadow drifting across, and now and then a blade glint that fades in and out
    const sc = pg ? F.shade : [16, 10, 24];
    for (const q of F.parts) if (q.t === "band") {
      const y0 = q.y * h, A = q.amp * h, T = q.th * h, wl = q.wl * w, off = t * q.sp;
      c.beginPath();
      for (let x = -12; x <= w + 12; x += 12) c.lineTo(x, y0 + Math.sin(x / wl + off + q.ph) * A);
      for (let x = w + 12; x >= -12; x -= 12) c.lineTo(x, y0 + T + Math.sin(x / (wl * 0.8) + off * 1.25 + q.ph + 1.7) * A * 0.8);
      c.closePath();
      const g = c.createLinearGradient(0, y0 - A, 0, y0 + T + A), a = q.a * (LT ? 0.9 : 1.6);
      g.addColorStop(0, rgba(sc, 0)); g.addColorStop(0.5, rgba(sc, a)); g.addColorStop(1, rgba(sc, 0));
      c.fillStyle = g; c.fill();
    }
    F.timer -= dt;
    if (F.timer <= 0 && !F.fx.length) { F.fx.push({x: rnd(0.12, 0.88), y: rnd(0.12, 0.88), ang: rnd(-0.9, -0.4), life: 0}); F.timer = rnd(3.5, 6.5); }
    F.fx = F.fx.filter((f) => (f.life += dt / 1.8) < 1);
    for (const f of F.fx) {
      const e = Math.sin(f.life * Math.PI), L = M * (pg ? 0.16 : 0.24), x = f.x * w, y = f.y * h, dx = Math.cos(f.ang) * L, dy = Math.sin(f.ang) * L;
      const g = c.createLinearGradient(x - dx, y - dy, x + dx, y + dy); g.addColorStop(0, col(0, 0)); g.addColorStop(0.5, col(0, 0.42 * e)); g.addColorStop(1, col(0, 0));
      c.strokeStyle = g; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke();
      const s2 = f.life * 2 - 1, px = x + dx * s2, py = y + dy * s2, gl = c.createRadialGradient(px, py, 0, px, py, 12);
      gl.addColorStop(0, col(0, 0.75 * e)); gl.addColorStop(1, col(0, 0)); c.fillStyle = gl; c.fillRect(px - 12, py - 12, 24, 24);
    }
  } else if (k === "pulse") {
    if (Math.random() < d * 0.9 || !F.fx.length) F.fx.push({r: 0, life: 1});
    F.fx = F.fx.filter((f) => { f.r += d * M * 0.55; f.life -= d * 0.75; return f.life > 0; });
    for (const f of F.fx) { c.strokeStyle = "rgba(196,40,40," + (0.55 * f.life * (LT ? 0.8 : 1)).toFixed(3) + ")"; c.lineWidth = 2 + 6 * f.life; c.beginPath(); c.arc(fcx, fcy, f.r, 0, 6.283); c.stroke(); }
    const g = c.createRadialGradient(fcx, fcy, 0, fcx, fcy, M * 0.7); g.addColorStop(0, "rgba(180,30,30," + ((0.12 + 0.08 * Math.sin(t * 5 * sp)) * ov).toFixed(3) + ")"); g.addColorStop(1, "rgba(180,30,30,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
  } else if (k === "beams") {
    // Ruler: sweeping light, a turning halo and pillars of judgement crashing down
    const A = ACC || [255, 210, 110];
    c.save(); c.translate(w * 0.5, -h * 0.15); c.rotate(Math.sin(t * 0.4) * 0.32);
    for (let i = 0; i < 16; i++) { const a = Math.PI * (0.1 + i / 16 * 0.8); c.fillStyle = rgba(mixC(HI, A, 0.5), (0.08 + 0.07 * Math.sin(t * 1.8 + i)) * (LT ? 0.8 : 1)); c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - 0.035) * h * 2.2, Math.sin(a - 0.035) * h * 2.2); c.lineTo(Math.cos(a + 0.035) * h * 2.2, Math.sin(a + 0.035) * h * 2.2); c.closePath(); c.fill(); }
    c.restore();
    const hx0 = w * 0.5, hy0 = h * (pg ? 0.12 : 0.15), HR = M * (pg ? 0.13 : 0.22);
    c.save(); c.translate(hx0, hy0); c.lineWidth = 2.2;
    for (let j = 0; j < 2; j++) { c.save(); c.rotate((j ? -1 : 1) * t * 0.6); c.strokeStyle = rgba(A, (0.65 - j * 0.2) * ov); c.beginPath(); c.ellipse(0, 0, HR * (1 - j * 0.22), HR * 0.3 * (1 - j * 0.22), 0, 0, 6.283); c.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; c.beginPath(); c.moveTo(Math.cos(a) * HR * (1 - j * 0.22), Math.sin(a) * HR * 0.3 * (1 - j * 0.22)); c.lineTo(Math.cos(a) * HR * (1.12 - j * 0.22), Math.sin(a) * HR * 0.34 * (1 - j * 0.22)); c.stroke(); } c.restore(); }
    c.restore();
    if (Math.random() < d * (pg ? 1.5 : 1.1)) F.fx.push({x: rnd(0.05, 0.95), life: 1, wd: rnd(0.012, 0.04)});
    F.fx = F.fx.filter((f) => (f.life -= dt * 1.15) > 0);
    for (const f of F.fx) {
      const e = f.life, x = f.x * w, ww = f.wd * w, reach = h * Math.min(1, (1 - e) * 4 + 0.15);
      const g = c.createLinearGradient(0, 0, 0, reach); g.addColorStop(0, rgba(A, 0.55 * e * ov)); g.addColorStop(1, rgba(A, 0.08 * e * ov));
      c.fillStyle = g; c.fillRect(x - ww / 2, 0, ww, reach);
      c.fillStyle = rgba(LT ? A : [255, 255, 255], 0.6 * e); c.fillRect(x - 1, 0, 2, reach);
      if (reach >= h * 0.98) { const gg = c.createRadialGradient(x, h, 0, x, h, ww * 3); gg.addColorStop(0, rgba(A, 0.5 * e * ov)); gg.addColorStop(1, rgba(A, 0)); c.fillStyle = gg; c.fillRect(x - ww * 3, h - ww * 3, ww * 6, ww * 3); }
    }
  } else if (k === "embers") {
    // Avenger: a crimson undertow, flames licking up from below and a storm of embers
    const A = ACC || [228, 32, 62];
    const g = c.createLinearGradient(0, h, 0, h * 0.25); g.addColorStop(0, "rgba(60,4,16," + (0.62 * ov).toFixed(3) + ")"); g.addColorStop(1, "rgba(60,4,16,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (!LT) c.globalCompositeOperation = "lighter";
    for (const q of F.parts) if (q.t === "flame") {
      const x = q.x * w, fw = q.w * w, fh = (q.h + 0.07 * Math.sin(t * 3.1 * sp + q.ph) + 0.04 * Math.sin(t * 5.3 * sp + q.ph * 2)) * h, sway = Math.sin(t * 2.2 * sp + q.ph) * fw * 0.7;
      const gg = c.createLinearGradient(0, h, 0, h - fh); gg.addColorStop(0, rgba(A, 0.6 * ov)); gg.addColorStop(0.55, "rgba(255,120,40," + (0.38 * ov).toFixed(3) + ")"); gg.addColorStop(1, "rgba(255,200,80,0)");
      c.fillStyle = gg; c.beginPath(); c.moveTo(x - fw, h + 2); c.quadraticCurveTo(x - fw * 0.9 + sway * 0.3, h - fh * 0.55, x + sway, h - fh); c.quadraticCurveTo(x + fw * 0.9 + sway * 0.3, h - fh * 0.55, x + fw, h + 2); c.closePath(); c.fill();
    }
    c.globalCompositeOperation = "source-over";
  } else if (k === "moon") {
    // Moon Cancer: a huge moon, a digital sea and data falling like rain
    const A = ACC || [236, 80, 204];
    const mx = w * (pg ? 0.84 : 0.8), my = h * (pg ? 0.15 : 0.2), R = M * (pg ? 0.13 : 0.21);
    let g = c.createRadialGradient(mx, my, R * 0.6, mx, my, R * 3); g.addColorStop(0, rgba(mixC([255, 250, 235], A, 0.35), 0.55 * ov)); g.addColorStop(1, rgba(A, 0)); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = rgba([255, 248, 236], LT ? 0.75 : 0.9); c.beginPath(); c.arc(mx, my, R, 0, 6.283); c.fill();
    g = c.createRadialGradient(mx + R * 0.45, my - R * 0.2, 0, mx + R * 0.45, my - R * 0.2, R * 1.05); g.addColorStop(0, rgba(A, 0.55)); g.addColorStop(1, rgba(A, 0)); c.fillStyle = g; c.beginPath(); c.arc(mx, my, R, 0, 6.283); c.fill();
    c.save(); c.translate(mx, my); c.rotate(t * 0.5); c.setLineDash([6, 10]); c.strokeStyle = rgba(A, 0.6 * ov); c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, R * 1.35, 0, 6.283); c.stroke(); c.setLineDash([]); c.restore();
    c.lineWidth = 1.6;
    for (let j = 0; j < 5; j++) { c.strokeStyle = rgba(j % 2 ? A : HI, (0.42 - j * 0.05) * (LT ? 0.9 : 1)); c.beginPath(); for (let x = 0; ; x = Math.min(x + 8, w)) { c.lineTo(x, h * (0.76 + j * 0.05) + Math.sin(x / (34 + j * 6) + t * (1.4 + j * 0.35) * sp) * (5 + j)); if (x >= w) break; } c.stroke(); }
    for (const q of F.parts) if (q.t === "pix") { q.y += q.v * d; if (q.y > 1.02) { q.y = -0.02; q.x = Math.random(); } c.fillStyle = rgba((q.ph > 3 ? A : [120, 230, 255]), (0.35 + 0.3 * Math.sin(t * 3 + q.ph)) * (LT ? 0.85 : 1)); c.fillRect(q.x * w, q.y * h, q.s, q.s); }
  } else if (k === "glitch") {
    // Alter Ego: data tearing apart, split into its colour channels
    const A = ACC || [64, 222, 255], MAG = [255, 60, 180];
    if (Math.random() < d * 6) F.fx.push({y: Math.random(), hh: rnd(0.008, 0.06), x: rnd(-0.1, 0.5), ww: rnd(0.2, 0.8), life: 1, sh: rnd(4, 14)});
    F.fx = F.fx.filter((f) => (f.life -= d * 3.2) > 0);
    for (const f of F.fx) {
      const x = f.x * w, y = f.y * h, ww = f.ww * w, hh = f.hh * h;
      c.fillStyle = rgba(A, 0.42 * f.life * (LT ? 0.8 : 1)); c.fillRect(x - f.sh, y, ww, hh);
      c.fillStyle = rgba(MAG, 0.38 * f.life * (LT ? 0.8 : 1)); c.fillRect(x + f.sh, y + 2, ww, hh);
      c.fillStyle = col(0, 0.5 * f.life); c.fillRect(x, y + hh * 0.45, ww, Math.max(1, hh * 0.12));
      for (let b = 0; b < 3; b++) { c.fillStyle = rgba(b % 2 ? A : MAG, 0.5 * f.life); c.fillRect(x + rnd(0, ww), y + rnd(-hh, hh * 2), rnd(4, 10), rnd(4, 10)); }
    }
    c.fillStyle = col(0, 0.05); for (let y = (t * 40) % 4; y < h; y += 4) c.fillRect(0, y, w, 1);
  } else if (k === "hex") {
    // Shielder: a barrier grid that ripples with each impact
    const S6 = pg ? 44 : 26, hh = S6 * Math.sqrt(3), A = ACC || [104, 160, 255];
    if (Math.random() < d * 0.8 || !F.fx.length) F.fx.push({r: 0, life: 1});
    F.fx = F.fx.filter((f) => { f.r += d * M * 0.6; f.life -= d * 0.55; return f.life > 0; });
    c.lineWidth = 1.1;
    for (let y = -hh, row = 0; y < h + hh; y += hh / 2, row++) for (let x = (row % 2) * S6 * 1.5; x < w + S6 * 3; x += S6 * 3) {
      const dist = Math.hypot(x - fcx, y - fcy); let boost = 0;
      for (const f of F.fx) boost = Math.max(boost, Math.max(0, 1 - Math.abs(dist - f.r) / (S6 * 1.6)) * f.life);
      c.strokeStyle = rgba(mixC(HI, A, 0.3 + 0.5 * boost), 0.1 + 0.1 * Math.max(0, Math.sin(t * 1.5 * sp - (x + y) / 90)) + 0.5 * boost);
      c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.lineTo(x + Math.cos(a) * S6, y + Math.sin(a) * S6); } c.closePath(); c.stroke();
      if (boost > 0.55) { c.fillStyle = rgba(A, 0.12 * boost * ov); c.fill(); }
    }
  } else if (k === "rainbow") {
    // waves step 10 px at a time; the last step always lands on the right edge (0.20.1: they used to stop short and cut down at a slant)
    for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(0, h); for (let x = 0; ; x = Math.min(x + 10, w)) { c.lineTo(x, h * (0.2 + j * 0.15) + Math.sin(x / (70 + j * 20) + t * (0.8 + j * 0.25) * sp) * h * 0.09); if (x >= w) break; } c.lineTo(w, h); c.closePath(); c.fillStyle = "hsla(" + ((hue + j * 72) % 360) + ",92%,62%,0.18)"; c.fill(); }
  } else if (k === "abyss") {
    // Foreigner: an aurora over the void, stars turning around a sealed gate, tendrils reaching up from below
    const ts = t * (p.extra ? 1.35 : 1);
    const gx = pg ? w * 0.5 : (w >= 560 ? 282 + (w - 282) / 2 : fcx), gy = pg ? h * 0.5 : (w >= 560 ? h * 0.72 : fcy), R = M * (pg ? 0.15 : 0.19);
    let g = c.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.8);
    g.addColorStop(0, "rgba(10,4,30," + (0.45 * ov).toFixed(3) + ")"); g.addColorStop(0.55, "rgba(32,12,72," + (0.2 * ov).toFixed(3) + ")"); g.addColorStop(1, "rgba(32,12,72,0)");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      const cc = FC[i % 2], base = h * (0.04 + i * 0.07), H = h * (0.22 + i * 0.05);
      c.beginPath();
      for (let x = -10; x <= w + 10; x += 10) c.lineTo(x, base + Math.sin(x / (w * 0.21) + ts * 0.33 + i * 1.9) * h * 0.035);
      for (let x = w + 10; x >= -10; x -= 10) c.lineTo(x, base + H + Math.sin(x / (w * 0.17) + ts * 0.47 + i) * h * 0.05);
      c.closePath();
      const ga = c.createLinearGradient(0, base - h * 0.04, 0, base + H + h * 0.05);
      ga.addColorStop(0, rgba(cc, 0)); ga.addColorStop(0.3, rgba(cc, 0.36 * ov)); ga.addColorStop(1, rgba(cc, 0));
      c.fillStyle = ga; c.fill();
    }
    if (!LT) c.globalCompositeOperation = "lighter";
    for (let x = 0, step = pg ? 14 : 9; x < w; x += step) {
      const a = 0.1 * Math.sin(x * 0.045 + ts * 1.2) * Math.sin(x * 0.011 - ts * 0.35);
      if (a <= 0.012) continue;
      c.fillStyle = rgba(FC[0], a * ov); c.fillRect(x, h * 0.05 + Math.sin(x / (w * 0.21) + ts * 0.33) * h * 0.035, 2, h * 0.32);
    }
    c.globalCompositeOperation = "source-over";
    const Rm = Math.hypot(w, h) * 0.62;
    for (const q of F.parts) if (q.t === "astar") {
      const a = q.a + ts * 0.03, x = gx + Math.cos(a) * q.d * Rm, y = gy + Math.sin(a) * q.d * Rm * 0.8;
      if (x < -3 || x > w + 3 || y < -3 || y > h + 3) continue;
      const tw = 0.45 + 0.4 * Math.sin(t * 0.8 + q.ph);
      c.fillStyle = q.r > 1.3 ? rgba(FC[q.ph > 3 ? 1 : 0], tw) : col(0, tw * 0.85);
      c.beginPath(); c.arc(x, y, q.r, 0, 6.283); c.fill();
    }
    c.lineCap = "round";
    for (const q of F.parts) if (q.t === "tendril") {
      const N = 22, bx = q.bx * w, L = q.len * h; let px = bx, py = h + 12;
      for (let j = 1; j <= N; j++) {
        const s2 = j / N;
        const x = bx + Math.sin(ts * q.sp + s2 * 3.2 + q.ph) * q.amp * w * s2 + Math.sin(ts * q.sp * 1.7 + s2 * 7 + q.ph) * q.amp * 0.35 * w * s2 * s2, y = h + 12 - s2 * L;
        c.strokeStyle = rgba(mixC(FC[1], FC[0], s2), (0.62 - 0.3 * s2) * ov); c.lineWidth = q.w * (1 - s2 * 0.85);
        c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); px = x; py = y;
      }
      const gt = c.createRadialGradient(px, py, 0, px, py, 9); gt.addColorStop(0, rgba(FC[0], 0.9 * ov)); gt.addColorStop(1, rgba(FC[0], 0)); c.fillStyle = gt; c.fillRect(px - 9, py - 9, 18, 18);
    }
    for (let i = 0; i < 4; i++) { const ph = (ts * 0.2 + i / 4) % 1, rr = R * (2.5 - 1.5 * ph); c.strokeStyle = rgba(FC[i % 2], 0.48 * Math.sin(ph * Math.PI) * ov); c.lineWidth = 1.6; c.beginPath(); c.arc(gx, gy, rr, 0, 6.283); c.stroke(); }
    g = c.createRadialGradient(gx, gy, 0, gx, gy, R * 1.05); g.addColorStop(0, "rgba(6,2,20," + (0.7 * ov).toFixed(3) + ")"); g.addColorStop(0.75, "rgba(20,8,50," + (0.35 * ov).toFixed(3) + ")"); g.addColorStop(1, "rgba(20,8,50,0)");
    c.fillStyle = g; c.beginPath(); c.arc(gx, gy, R * 1.05, 0, 6.283); c.fill();
    c.save(); c.translate(gx, gy);
    c.rotate(ts * 0.12); c.setLineDash([R * 0.2, R * 0.11]); c.strokeStyle = rgba(FC[0], 0.65 * ov); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.stroke();
    c.rotate(-ts * 0.3); c.setLineDash([2, 8]); c.strokeStyle = rgba(FC[1], 0.7 * ov); c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, R * 0.82, 0, 6.283); c.stroke();
    c.setLineDash([]); c.restore();
    const kr = R * 0.34; c.save();
    if (!pg) { c.shadowBlur = 18; c.shadowColor = rgba(FC[0], 0.9); }
    c.fillStyle = "rgba(4,1,14," + (0.85 * ov).toFixed(3) + ")"; c.strokeStyle = rgba(FC[0], 0.65 + 0.25 * Math.sin(t * 1.1)); c.lineWidth = 1.6;
    c.beginPath(); c.arc(gx, gy - kr * 0.35, kr * 0.55, Math.PI * 0.72, Math.PI * 2.28); c.lineTo(gx + kr * 0.42, gy + kr * 1.2); c.lineTo(gx - kr * 0.42, gy + kr * 1.2); c.closePath(); c.fill(); c.stroke();
    c.restore();
  } else if (k === "petals") {
    // Pretender: a petal storm whirling around the servant, with fairy lights darting through it
    const A = ACC || [92, 232, 160], RV = Math.max(w, h) * 0.55, pcx = pg ? fcx : w * 0.55, pcy = pg ? fcy : h * 0.5;
    for (const q of F.parts) if (q.t === "petal") {
      q.ang += q.va * d * 0.6; q.rot += q.vr * d; const rr = q.rad + 0.04 * Math.sin(t * 0.7 + q.ph);
      const x = pcx + Math.cos(q.ang) * rr * RV, y = pcy + Math.sin(q.ang) * rr * RV * 0.62;
      if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
      c.save(); c.translate(x, y); c.rotate(q.rot + q.ang); c.fillStyle = q.r > 6 ? rgba(A, 0.78 * (LT ? 0.9 : 1)) : col(0, 0.75); c.beginPath(); c.ellipse(0, 0, q.r, q.r * 0.45, 0, 0, 6.283); c.fill(); c.strokeStyle = DK || LT ? "rgba(20,40,30,0.35)" : "rgba(255,255,255,0.5)"; c.lineWidth = 0.8; c.stroke(); c.restore();
    }
    for (const q of F.parts) if (q.t === "fairy") {
      q.ang += q.va * d; const x = pcx + Math.cos(q.ang * 1.3) * q.rad * RV, y = pcy + Math.sin(q.ang) * q.rad * RV * 0.55, tw = 0.55 + 0.4 * Math.sin(t * 2.4 + q.ph);
      const g = c.createRadialGradient(x, y, 0, x, y, q.r * 5); g.addColorStop(0, rgba(LT ? A : [240, 255, 230], tw)); g.addColorStop(1, rgba(A, 0)); c.fillStyle = g; c.fillRect(x - q.r * 5, y - q.r * 5, q.r * 10, q.r * 10);
    }
  }
  c.restore();
  // Extra classes: a surge rolls out from the servant every few seconds and the edges flare with it
  if (ACC) {
    F.surge -= dt * (0.8 + p.level / 200);
    if (F.surge <= 0) { F.waves.push({r: 0, life: 1}); F.surge = rnd(2.2, 3.2); }
    F.waves = F.waves.filter((wv) => (wv.life -= dt * 0.85) > 0);
    for (const wv of F.waves) { wv.r += dt * M * (pg ? 0.9 : 1.25); c.strokeStyle = rgba(ACC, 0.55 * wv.life * (LT ? 0.85 : 1)); c.lineWidth = 2 + 7 * wv.life; c.beginPath(); c.arc(fcx, fcy, wv.r, 0, 6.283); c.stroke(); }
    const nw = F.waves.length ? F.waves[F.waves.length - 1].life : 0, ea = (0.12 + 0.22 * nw * nw) * (LT ? 0.7 : 1);
    const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    vg.addColorStop(0, rgba(ACC, 0)); vg.addColorStop(1, rgba(ACC, ea)); c.fillStyle = vg; c.fillRect(0, 0, w, h);
  }
  // grail glow
  if (p.grails) { const g = c.createRadialGradient(fcx, fcy, 0, fcx, fcy, Math.max(w, h) * 0.6); const a = 0.10 + Math.min(0.22, p.grails / 90) + 0.05 * Math.sin(t * 2.2); g.addColorStop(0, "rgba(255,212,110," + a.toFixed(3) + ")"); g.addColorStop(1, "rgba(255,212,110,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h); }
  // particles
  for (const q of F.parts) {
    if (q.t === "mote") { q.x = (q.x + q.vx * d + 1) % 1; q.y += q.vy * d; if (q.y < -0.02) { q.y = 1.02; q.x = Math.random(); } c.fillStyle = col(0, 0.3 + 0.25 * Math.sin(t * 0.9 + q.ph), q.ph * 50); c.beginPath(); c.arc(q.x * w, q.y * h, q.r, 0, 6.283); c.fill(); }
    else if (q.t === "grail") { q.a += q.sp * d; const x = fcx + Math.cos(q.a) * q.rad * M, y = fcy + Math.sin(q.a) * q.rad * M * 0.9, a = 0.45 + 0.55 * Math.abs(Math.sin(t * 2.5 + q.ph)), r = q.r * (0.7 + 0.5 * a); c.fillStyle = "rgba(255,220,120," + a.toFixed(3) + ")"; c.beginPath(); c.moveTo(x, y - r * 2.2); c.lineTo(x + r * 0.5, y - r * 0.5); c.lineTo(x + r * 2.2, y); c.lineTo(x + r * 0.5, y + r * 0.5); c.lineTo(x, y + r * 2.2); c.lineTo(x - r * 0.5, y + r * 0.5); c.lineTo(x - r * 2.2, y); c.lineTo(x - r * 0.5, y - r * 0.5); c.closePath(); c.fill(); }
    else if (q.t === "rstar") {
      q.y += q.vy * dt; q.rot += q.vr * dt; if (q.y < -0.05) { q.y = 1.05; q.x = Math.random(); }
      const a = 0.3 + 0.22 * Math.sin(t * 0.7 + q.ph), x = q.x * w, y = q.y * h;
      c.fillStyle = starLook(p, F, q.i, hue, t, LT).fill(a + (LT ? 0.15 : 0));
      starPath(c, x, y, q.r, q.rot); c.fill();
      if (LT) { c.strokeStyle = "rgba(90,60,10," + (a * 0.6).toFixed(3) + ")"; c.lineWidth = 1; c.stroke(); }
    }
    else if (q.t === "rain") { q.y += q.v * d; q.x -= q.v * d * 0.3; if (q.y > 1.05) { q.y = -0.05; q.x = Math.random() * 1.2; } const x = q.x * w, y = q.y * h; c.strokeStyle = col(0, 0.5); c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.3 * 26, y - 26); c.stroke(); c.fillStyle = col(0, 0.6); c.beginPath(); c.moveTo(x, y + 3); c.lineTo(x - 3, y - 3); c.lineTo(x + 3, y - 2); c.closePath(); c.fill(); }
    else if (q.t === "ember") { q.y -= q.v * d; q.x += Math.sin(t * 1.5 + q.ph) * 0.0012; if (q.y < -0.03) { q.y = 1.03; q.x = Math.random(); } const a = 0.45 + 0.45 * Math.sin(t * 3 + q.ph); c.fillStyle = q.hot ? "rgba(255,140,60," + a.toFixed(3) + ")" : "rgba(120,20,50," + (a * 0.85).toFixed(3) + ")"; c.beginPath(); c.arc(q.x * w, q.y * h, q.r, 0, 6.283); c.fill(); }
  }
  // rarity stars in the banner's corner, like the stars under a card
  if (!pg) {
    const N = p.rarity;
    for (let i = 0; i < N; i++) {
      const R = 13, gap = 34, x = w - 26 - (N - 1 - i) * gap, y = h - 26 - Math.sin(t * 1.2 + i * 0.7) * 3, tw = 0.65 + 0.35 * Math.sin(t * 2 + i * 1.3);
      c.save(); c.shadowBlur = 14 * tw;
      const SL = starLook(p, F, i, hue, t, false); c.shadowColor = SL.glow; c.fillStyle = SL.fill(0.7 + 0.3 * tw); c.shadowBlur = 14 * tw * SL.blur;
      starPath(c, x, y, R * (0.92 + 0.08 * tw) * SL.scale, Math.sin(t * 0.6 + i) * 0.08); c.fill();
      c.lineWidth = 1; c.strokeStyle = "rgba(60,40,10,0.35)"; c.stroke(); c.restore();
    }
    // grailed: the grail floats above the middle star
    if (p.grails > 0 && GRAIL_IMG.complete && GRAIL_IMG.naturalWidth) {
      const gap = 34, mid = (N - 1) / 2, x = N ? w - 26 - (N - 1 - mid) * gap : w - 26, bob = Math.sin(t * 1.2 + Math.floor(mid) * 0.7) * 3;
      const gh = 46, gw = gh * GRAIL_IMG.naturalWidth / GRAIL_IMG.naturalHeight, y = h - 26 - bob - 13 - 7 - gh;
      const halo = c.createRadialGradient(x, y + gh * 0.45, 0, x, y + gh * 0.45, gh * 0.95);
      halo.addColorStop(0, "rgba(255,214,120," + (0.42 + 0.12 * Math.sin(t * 2)).toFixed(3) + ")"); halo.addColorStop(1, "rgba(255,214,120,0)");
      c.fillStyle = halo; c.fillRect(x - gh, y - gh * 0.5, gh * 2, gh * 2);
      c.save(); c.shadowBlur = 10; c.shadowColor = "rgba(255,205,100,0.75)"; c.drawImage(GRAIL_IMG, x - gw / 2, y, gw, gh); c.restore();
    }
  }
}

/* ---------- ranking ---------- */
const CLASS_ATK = {Archer: 0.95, Lancer: 1.05, Caster: 0.9, Assassin: 0.9, Berserker: 1.1, Ruler: 1.1, Avenger: 1.1};
// Skills count like the game: each level moves 10% of the Lv1→Lv10 gap, Lv10 gets the full value, and Lv6 and Lv10 each cut the cooldown by a turn
function skillPower(v) {
  if (typeof v !== "number") return 0;
  const lv = clamp(v, 1, 10);
  return 0.8 * (lv >= 10 ? 1 : (lv - 1) / 10) + 0.2 * ((lv >= 6 ? 0.5 : 0) + (lv >= 10 ? 0.5 : 0));
}
// Level (9 of 100): steady growth, plus a bump for reaching max level and for Lv 100
function levelPart(lv, cap) { return (6.5 * lv / 120 + (cap && lv >= cap ? 2 : 0) + (lv >= 100 ? 1.5 : 0)) * 0.9; }
// Bond (10 of 100, since 0.23.0): each level is worth more than the one before, the way each takes longer to earn.
// Bond 1-5 add 0.3 each, 6-10 add 0.6 each, 11-14 add 1 each, and 14 -> 15 adds the most, 1.5.
const BOND_STEP = [0, 0.3, 0.3, 0.3, 0.3, 0.3, 0.6, 0.6, 0.6, 0.6, 0.6, 1, 1, 1, 1, 1.5];
const bondPart = (b) => BOND_STEP.slice(1, clamp(Math.floor(num(b) || 0), 0, 15) + 1).reduce((a, x) => a + x, 0);
function scoreOf(s, over) {
  over = over || {};
  const atk = total(s, "atk"), hp = total(s, "hp"), mod = CLASS_ATK[s.cls] || 1;
  const missing = atk == null || hp == null;
  const sk = over.skills || s.skills || [], lv = clamp(num(over.level != null ? over.level : s.level) || 1, 1, 120);
  // out of 100: stats 32, skills 27, NP level 13, Bond 10, level 9, rarity 9
  const parts = {
    stats: missing ? 0 : Math.min(1, (atk * mod / 16000) * 0.7 + (hp / 18000) * 0.3) * 32,
    skills: [0, 1, 2].reduce((a, i) => a + skillPower(sk[i]), 0) / 3 * 27,
    np: clamp(num(s.npLevel) || 1, 1, 5) / 5 * 13,
    bond: bondPart(over.bond != null ? over.bond : s.bond),
    level: levelPart(lv, CAPS[s.rarity]),
    rarity: clamp(num(s.rarity) || 0, 0, 5) / 5 * 9
  };
  return {total: parts.stats + parts.skills + parts.np + parts.bond + parts.level + parts.rarity, parts: parts, missing: missing};
}
function rankRows() {
  return owned().map((s) => ({s: s, sc: scoreOf(s)})).sort((a, b) => b.sc.total - a.sc.total || String(a.s.name).localeCompare(String(b.s.name)));
}
const RB_KEY = "spirit-origin-list:v1:rankBase";
function rankBase() { try { return JSON.parse(localStorage.getItem(RB_KEY) || "null"); } catch (e) { return null; } }
function setRankBase(m) { try { localStorage.setItem(RB_KEY, JSON.stringify(m)); } catch (e) {} }
function rankOf(id) { const rows = rankRows(); const i = rows.findIndex((r) => r.s.id === id); return i < 0 ? null : {rank: i + 1, of: rows.length, sc: rows[i].sc}; }
/* ---------- upgrade value: the single next step that lifts the score most ---------- */
const grailNext = (lv) => lv < 90 ? Math.min(90, lv + 5) : Math.min(120, lv + 2);
function roiOf(s) {
  if (!s || s.wish) return null;
  const base = scoreOf(s).total, cap = CAPS[s.rarity] || 90, lv = clamp(num(s.level) || 1, 1, 120), sk = [0, 1, 2].map((i) => (s.skills || [])[i]);
  const opts = [];
  sk.forEach((v, i) => {
    if (typeof v !== "number" || v >= 10) return;
    const n = sk.slice(); n[i] = v + 1;
    opts.push({kind: "skill", i: i, from: v, to: v + 1, gain: scoreOf(s, {skills: n}).total - base, why: v + 1 === 10 ? "full value and a shorter cooldown" : v + 1 === 6 ? "shorter cooldown" : ""});
  });
  if (lv < cap) opts.push({kind: "level", from: lv, to: lv + 1, gain: scoreOf(s, {level: lv + 1}).total - base, why: lv + 1 === cap ? "reaches max level" : ""});
  else if (lv < 120) { const to = grailNext(lv); opts.push({kind: "grail", from: lv, to: to, gain: scoreOf(s, {level: to}).total - base, why: lv < 100 && to >= 100 ? "reaches Lv 100" : to >= 120 ? "reaches Lv 120" : ""}); }
  if (!opts.length) return null;
  opts.sort((a, b) => b.gain - a.gain);
  const best = opts[0];
  best.flag = best.gain >= 2 ? "top" : best.gain >= 1.5 ? "good" : "";
  return best;
}
function roiText(r) {
  const step = r.kind === "skill" ? `Skill ${r.i + 1} ${r.from} → ${r.to}` : r.kind === "level" ? `Lv ${r.from} → ${r.to}` : `Grail: Lv ${r.from} → ${r.to}`;
  return step + (r.why ? ", " + r.why : "");
}

/* ---------- tier board: SS to C by score, with your own placements on top ---------- */
const TIER_KEY = "spirit-origin-list:v1:tiers", RV_KEY = "spirit-origin-list:v1:rankView";
const TIERS = [{k: "SS", min: 75}, {k: "S", min: 62}, {k: "A", min: 50}, {k: "B", min: 40}, {k: "C", min: -Infinity}];
let tierOv = null, tierJustDragged = false, tierDrag = null;
function tierClean(d) { const m = {}; if (d && typeof d === "object") Object.keys(d).forEach((id) => { if (TIERS.some((t) => t.k === d[id]) && /^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(id)) m[id] = d[id]; }); return m; }
function tierOverrides() { if (tierOv) return tierOv; try { tierOv = tierClean(JSON.parse(localStorage.getItem(TIER_KEY) || "null")); } catch (e) { tierOv = {}; } return tierOv; }
function setTierOverrides(m) { tierOv = tierClean(m); try { if (Object.keys(tierOv).length) localStorage.setItem(TIER_KEY, JSON.stringify(tierOv)); else localStorage.removeItem(TIER_KEY); } catch (e) {} }
const autoTier = (sc) => TIERS.find((t) => sc >= t.min).k;
const tierOf = (id, sc) => tierOverrides()[id] || autoTier(sc);
function setTier(id, k) {
  const r = rankRows().find((x) => x.s.id === id); if (!r) return;
  const m = Object.assign({}, tierOverrides());
  if (!k || k === autoTier(r.sc.total)) delete m[id]; else m[id] = k;
  setTierOverrides(m);
}
function rankView() { try { return localStorage.getItem(RV_KEY) === "tiers" ? "tiers" : "list"; } catch (e) { return "list"; } }
function setRankView(v) { try { localStorage.setItem(RV_KEY, v); } catch (e) {} }
const PIN = `<svg class="tc-pin" viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 1.5l4 4-2 1-2.5 2.5.5 3-1.5 1.5-3-3-3.5 3.5-.5-.5L5.5 10l-3-3L4 5.5l3 .5L9.5 3.5z" fill="currentColor"/></svg>`;
function tierBoardHTML(rows) {
  const ov = tierOverrides();
  return TIERS.map((t, i) => {
    const items = rows.filter((r) => tierOf(r.s.id, r.sc.total) === t.k);
    const range = i === 0 ? t.min + "+" : t.min === -Infinity ? "under " + TIERS[i - 1].min : t.min + "–" + TIERS[i - 1].min;
    const cards = items.map((r) => `<button type="button" class="tier-card${ov[r.s.id] ? " pinned" : ""}" data-action="tier-card" data-id="${esc(r.s.id)}" aria-haspopup="menu" aria-label="${esc(r.s.name)}, ${r.sc.total.toFixed(1)}${ov[r.s.id] ? ", placed here by you" : ""}. Press to move">${iconHTML(r.s, "")}<span class="tc-n">${esc(r.s.name)}</span><span class="tc-s">${r.sc.total.toFixed(1)}${ov[r.s.id] ? PIN : ""}</span></button>`).join("");
    return `<section class="tier-row t-${t.k.toLowerCase()}" data-tier-drop="${t.k}" aria-label="Tier ${tierName(t.k)}, score ${range}"><div class="tier-lab"><b>${tierName(t.k)}</b><small>${range}</small></div><div class="tier-cards">${cards || `<span class="tier-empty">Nobody here yet</span>`}</div></section>`;
  }).join("");
}
function renderRoiTop(rows) {
  const box = $("#roi-top"); if (!box) return;
  const flagged = rows.map((r) => ({s: r.s, roi: roiOf(r.s)})).filter((x) => x.roi && x.roi.flag).sort((a, b) => b.roi.gain - a.roi.gain);
  if (!flagged.length) { box.innerHTML = `<p class="roi-none">No servant is one upgrade away from a big jump right now. Skills at 9 or 5, or one level below max, show up here.</p>`; return; }
  const chip = (x) => `<button type="button" class="roi-chip ${x.roi.flag}" data-action="goto" data-id="${esc(x.s.id)}"><b>${esc(x.s.name)}</b><span>${esc(roiText(x.roi))}</span><em>+${x.roi.gain.toFixed(1)}</em></button>`;
  const top = flagged.filter((x) => x.roi.flag === "top"), good = flagged.filter((x) => x.roi.flag === "good");
  box.innerHTML = (top.length ? `<div class="roi-line"><span class="roi-flag top">Highest ROI</span>${top.map(chip).join("")}</div>` : "") + (good.length ? `<div class="roi-line"><span class="roi-flag good">Good value</span>${good.map(chip).join("")}</div>` : "");
}
function renderRanking() {
  const el = $("#ranking"), board = $("#tierboard"); if (!el) return;
  if (S.dbState !== "ok" || !S.loaded.servants) { el.innerHTML = ""; if (board) board.innerHTML = ""; return; }
  const view = rankView();
  document.querySelectorAll('[data-action="rank-view"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === view)));
  const rows = rankRows();
  el.hidden = view !== "list"; if (board) board.hidden = view !== "tiers";
  const seen = document.querySelector('[data-action="rank-seen"]'); if (seen) seen.hidden = view !== "list";
  if (!rows.length) { el.innerHTML = `<li class="list-note"><p>Add servants to see how they rank.</p></li>`; if (board) board.innerHTML = ""; $("#roi-top").innerHTML = ""; return; }
  renderRoiTop(rows);
  if (board && view === "tiers") board.innerHTML = tierBoardHTML(rows) + `<p class="tier-note">Drag a servant to another tier, or press it to pick one. Servants you placed yourself show a pin; press "Back to automatic" to let the score decide again. Score ranges: EX 75+, S 62–75, A 50–62, B 40–50, C under 40.</p>`;
  if (view !== "list") return;
  const cur = {}; rows.forEach((r, i) => { cur[r.s.id] = i + 1; });
  let base = rankBase(); if (!base) { base = cur; setRankBase(cur); }
  el.innerHTML = rows.map((r, i) => {
    const rank = i + 1, prev = base[r.s.id], q = r.sc.parts, roi = roiOf(r.s);
    const mv = prev == null ? `<span class="mv">new</span>` : prev > rank ? `<span class="mv up" title="Up ${prev - rank}">▲${prev - rank}</span>` : prev < rank ? `<span class="mv down" title="Down ${rank - prev}">▼${rank - prev}</span>` : `<span class="mv" title="No change">–</span>`;
    const parts = "Stats " + q.stats.toFixed(1) + " · Skills " + q.skills.toFixed(1) + " · NP " + q.np.toFixed(1) + " · Bond " + (q.bond || 0).toFixed(1) + " · Level " + q.level.toFixed(1) + " · Rarity " + q.rarity.toFixed(1);
    const roiLine = roi ? `<span class="rk-roi${roi.flag ? " " + roi.flag : ""}">${roi.flag === "top" ? "<b>Highest ROI</b> · " : roi.flag === "good" ? "<b>Good value</b> · " : "Next: "}${esc(roiText(roi))} (+${roi.gain.toFixed(1)})</span>` : "";
    return `<li class="rank-row${rank <= 3 ? " top" : ""}${roi && roi.flag ? " has-roi-" + roi.flag : ""}"><span class="rk">${rank}</span>${mv}${iconHTML(r.s, "")}<span class="rk-main"><button class="rk-name" data-action="goto" data-id="${esc(r.s.id)}">${esc(r.s.name)}</button><span class="rk-parts">${r.sc.missing ? "Stats not filled in · " : ""}${parts}</span>${roiLine}</span><span class="rk-bar" title="${esc(r.s.name)}: ${r.sc.total.toFixed(1)} of 100 (${esc(parts)})"><i style="width:${Math.min(100, r.sc.total).toFixed(1)}%"></i></span><b class="rk-score">${r.sc.total.toFixed(1)}</b></li>`;
  }).join("");
}
/* tier menu: press a card to move it with buttons (works with touch and keyboard) */
function closeTierMenu(refocus) {
  const m = document.getElementById("tier-menu"); if (!m || m.hidden) return;
  const id = m.dataset.for; m.hidden = true; m.innerHTML = "";
  if (refocus && id) { const c = document.querySelector('.tier-card[data-id="' + id + '"]'); if (c) c.focus(); }
}
function openTierMenu(card) {
  const m = document.getElementById("tier-menu"), id = card.dataset.id, r = rankRows().find((x) => x.s.id === id); if (!m || !r) return;
  const cur = tierOf(id, r.sc.total), auto = autoTier(r.sc.total), manual = !!tierOverrides()[id];
  m.innerHTML = `<p class="tm-h"><b>${esc(r.s.name)}</b><small>Score ${r.sc.total.toFixed(1)} · by score: ${tierName(auto)}</small></p>
    <div class="tm-tiers" role="group" aria-label="Move to tier">${TIERS.map((t) => `<button type="button" role="menuitemradio" aria-checked="${t.k === cur}" class="t-${t.k.toLowerCase()}" data-action="tier-set" data-id="${esc(id)}" data-k="${t.k}">${tierName(t.k)}</button>`).join("")}</div>
    ${manual ? `<button type="button" role="menuitem" class="btn ghost sm" data-action="tier-set" data-id="${esc(id)}" data-k="">Back to automatic (${tierName(auto)})</button>` : ""}
    <button type="button" role="menuitem" class="btn ghost sm" data-action="goto" data-id="${esc(id)}">Open ${esc(r.s.name)}</button>`;
  m.dataset.for = id; m.hidden = false;
  const cr = card.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let x = clamp(cr.left, 8, innerWidth - mw - 8), y = cr.bottom + 6; if (y + mh > innerHeight - 8) y = Math.max(8, cr.top - mh - 6);
  m.style.left = x + "px"; m.style.top = y + "px";
  const f = m.querySelector('[aria-checked="true"]') || m.querySelector("button"); if (f) f.focus();
}
function startTierDrag(st, x, y) {
  st.on = true; tierJustDragged = true; closeTierMenu();
  const r = st.card.getBoundingClientRect(); st.dx = x - r.left; st.dy = y - r.top;
  const g = st.card.cloneNode(true); g.classList.add("tier-ghost"); g.removeAttribute("data-action"); g.setAttribute("aria-hidden", "true"); g.style.width = r.width + "px";
  document.body.appendChild(g); st.ghost = g; st.card.classList.add("drag-src"); document.body.classList.add("tier-dragging");
  moveTierDrag(st, x, y);
}
function moveTierDrag(st, x, y) {
  st.ghost.style.transform = "translate(" + (x - st.dx) + "px, " + (y - st.dy) + "px)";
  const el = document.elementFromPoint(x, y), z = el && el.closest ? el.closest("[data-tier-drop]") : null;
  if (st.over !== z) { if (st.over) st.over.classList.remove("over"); st.over = z; if (z) z.classList.add("over"); }
  if (y < 56) window.scrollBy(0, -14); else if (y > innerHeight - 56) window.scrollBy(0, 14);
}
function endTierDrag(st, drop) {
  if (st.ghost) st.ghost.remove();
  st.card.classList.remove("drag-src"); document.body.classList.remove("tier-dragging");
  if (st.over) st.over.classList.remove("over");
  setTimeout(() => { tierJustDragged = false; }, 50);
  if (!drop || !st.over) return;
  const k = st.over.dataset.tierDrop, s = S.servants.find((x) => x.id === st.id), r = rankRows().find((x) => x.s.id === st.id);
  setTier(st.id, k); renderRanking();
  if (s && r) toast(s.name + " is in " + tierName(k) + (k === autoTier(r.sc.total) ? " (where the score puts them)." : ". Their score puts them in " + tierName(autoTier(r.sc.total)) + "."));
  const c = document.querySelector('.tier-card[data-id="' + st.id + '"]'); if (c) c.focus({preventScroll: true});
}
document.addEventListener("pointerdown", (e) => {
  const card = e.target.closest && e.target.closest(".tier-card"); if (!card || e.button > 0) return;
  const st = {card: card, id: card.dataset.id, x: e.clientX, y: e.clientY, pid: e.pointerId, type: e.pointerType, on: false, timer: 0, ghost: null, over: null};
  tierDrag = st;
  if (e.pointerType === "touch") st.timer = setTimeout(() => { if (tierDrag === st && !st.on) startTierDrag(st, st.x, st.y); }, 320);
});
document.addEventListener("pointermove", (e) => {
  const st = tierDrag; if (!st || e.pointerId !== st.pid) return;
  if (!st.on) {
    const d = Math.hypot(e.clientX - st.x, e.clientY - st.y);
    if (st.type === "touch") { if (d > 10) { clearTimeout(st.timer); tierDrag = null; } return; }
    if (d < 6) return;
    startTierDrag(st, e.clientX, e.clientY);
  }
  moveTierDrag(st, e.clientX, e.clientY);
});
document.addEventListener("pointerup", (e) => { const st = tierDrag; if (!st || e.pointerId !== st.pid) return; clearTimeout(st.timer); tierDrag = null; if (st.on) endTierDrag(st, true); });
document.addEventListener("pointercancel", (e) => { const st = tierDrag; if (!st || e.pointerId !== st.pid) return; clearTimeout(st.timer); tierDrag = null; if (st.on) endTierDrag(st, false); });
document.addEventListener("touchmove", (e) => { if (tierDrag && tierDrag.on) e.preventDefault(); }, {passive: false});
document.addEventListener("contextmenu", (e) => { if (e.target.closest && e.target.closest(".tier-card")) e.preventDefault(); });

/* ---------- Noble Phantasm table (laid out like the wiki's; every cell is yours to edit) ---------- */
// Standard NP damage steps (NP1 to NP5), used only to pre-fill a table from the NP1 value in your notes.
const NP_STD = [
  {v: 300, card: "Buster", tgt: "AoE", vals: [300, 400, 450, 475, 500]},
  {v: 400, card: "Buster", tgt: "AoE", vals: [400, 500, 550, 575, 600]},
  {v: 450, card: "Arts", tgt: "AoE", vals: [450, 600, 675, 712.5, 750]},
  {v: 600, card: "Buster", tgt: "Single Target", vals: [600, 800, 900, 950, 1000]},
  {v: 800, card: "Buster", tgt: "Single Target", vals: [800, 1000, 1100, 1150, 1200]},
  {v: 1200, card: "Quick", tgt: "Single Target", vals: [1200, 1600, 1800, 1900, 2000]}
];
const NP_CHARGE = ["100%", "200%", "300%", "400%", "500%"];
const NP_TEXT = ["tab", "note", "name", "sub", "card", "base", "rank", "type", "hits", "perHit", "effect", "oc"];
const nfmt = (n) => String(Math.round(n * 100) / 100);
const blankRow = () => ({label: "", vals: ["", "", "", "", ""]});
function npVersion() { return {tab: "", note: "", name: "", sub: "", card: "", base: "", rank: "", type: "", hits: "", perHit: "", effect: "", rows: [], oc: "", ocRows: [], grp: 0}; }
function npDefault(s) {
  const tgt = s.npTarget, card = s.npCard, notes = String(s.notes || "");
  const v = npVersion(); let auto = false;
  v.effect = tgt === "AoE" ? "Deals damage to all enemies." : tgt === "Single Target" ? "Deals damage to one enemy." : "";
  const m = /NP (\d+)%\s*(?:\(NP1\)|at NP1)/.exec(notes);
  const std = m ? NP_STD.find((x) => x.v === Number(m[1]) && x.card === card && x.tgt === tgt) : null;
  v.rows.push({label: tgt === "Support" ? "" : "Damage +", vals: std ? std.vals.map((n) => nfmt(n) + "%") : ["", "", "", "", ""]});
  if (std) auto = true;
  const oc = /\bOC ([^;]+?)(?:;|\.(?=\s|$)|$)/.exec(notes);
  if (oc) {
    const txt = oc[1].trim();
    v.oc = txt.charAt(0).toUpperCase() + txt.slice(1) + (/[.!]$/.test(txt) ? "" : ".");
    const r = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)(%?)/.exec(txt);
    if (r) {
      const lo = Number(r[1]), hi = Number(r[2]);
      let label = txt.replace(r[0], "").replace(/\s+/g, " ").replace(/\s+([,).])/g, "$1").trim();
      label = label.charAt(0).toUpperCase() + label.slice(1);
      v.ocRows.push({label: label, vals: [0, 1, 2, 3, 4].map((i) => nfmt(lo + (hi - lo) * i / 4) + r[3])});
    }
    auto = true;
  }
  if (!v.ocRows.length) v.ocRows.push(blankRow());
  return {v: [v], auto: auto};
}
function npNorm(T) {
  if (!T || typeof T !== "object" || !Array.isArray(T.v)) return null;
  const g = (Array.isArray(T.g) ? T.g : []).filter((x) => x && typeof x === "object")
    .map((x) => ({name: x.name == null ? "" : String(x.name), slots: Array.isArray(x.slots) ? x.slots.filter((k) => typeof k === "string") : []}));
  if (!g.length) g.push({name: "", slots: []});
  const v = T.v.filter((x) => x && typeof x === "object").map((x) => {
    const o = npVersion();
    NP_TEXT.forEach((k) => { o[k] = x[k] == null ? "" : String(x[k]); });
    ["rows", "ocRows"].forEach((k) => { o[k] = Array.isArray(x[k]) ? x[k].filter((r) => r && typeof r === "object").map((r) => ({label: r.label == null ? "" : String(r.label), vals: [0, 1, 2, 3, 4].map((i) => { const c = Array.isArray(r.vals) ? r.vals[i] : ""; return c == null ? "" : String(c); })})) : []; });
    o.grp = clamp(Math.round(num(x.grp) || 0), 0, g.length - 1);
    return o;
  });
  if (!v.length) return null;
  // every form keeps at least one version
  g.forEach((_, gi) => { if (!v.some((x) => x.grp === gi)) { const c = JSON.parse(JSON.stringify(v[0])); c.grp = gi; v.push(c); } });
  return {v: v, g: g};
}
function npTableOf(s) {
  const T = npNorm(s.npTable);
  if (T) { s.npTable = T; return {T: T, auto: false}; }
  const d = npDefault(s); return {T: {v: d.v, g: [{name: "", slots: []}]}, auto: d.auto};
}
function npEnsure(s) { const T = npNorm(s.npTable); s.npTable = T || {v: npDefault(s).v, g: [{name: "", slots: []}]}; return s.npTable; }
// Which form shows: the one you picked, else the one linked to the stage or costume on screen, else the first.
function npGi(s, T) {
  const m = num(S.npGrp[s.id]);
  if (m != null && m >= 0 && m < T.g.length) return m;
  const slot = viewSlot(s), i = T.g.findIndex((x) => x.slots.includes(slot));
  return i >= 0 ? i : 0;
}
const npInGroup = (T, gi) => T.v.map((x, i) => i).filter((i) => T.v[i].grp === gi);
function npVi(s, T) { const list = npInGroup(T, npGi(s, T)), want = num(S.npVer[s.id]); return list.includes(want) ? want : (list.length ? list[0] : 0); }
// The first version's name and card are the servant's own NP name and card, so lists, filters and the edit form stay in step.
function npField(s, V, vi, f) {
  if (vi === 0 && f === "name") return s.npName || "";
  if (vi === 0 && f === "card") return s.npCard || "";
  return V[f] || "";
}
function npTabLabel(V, j) { return V.tab || (V.rank ? "Rank " + V.rank : (j === 0 ? "Main" : "Version " + (j + 1))); }
function npFormLabel(G, gi) { return G.name || (gi === 0 ? "Default" : "Form " + (gi + 1)); }
const curServant = () => S.servants.find((x) => x.id === shownId());
const slotNames = (s, slots) => slots.map((k) => slotLabel(s, k)).join(", ");

function npWrite(path, value) {
  const s = curServant(); if (!s || S.readOnly) return;
  const T = npEnsure(s), vi = npVi(s, T), V = T.v[vi];
  const parts = String(path).split(":"), kind = parts[0];
  if (kind === "target") { s.npTarget = TARGETS.includes(value) ? value : null; }
  else if (kind === "g") { if (parts[1] === "name") T.g[npGi(s, T)].name = value; else return; }
  else if (kind === "f") {
    const f = parts[1]; if (!NP_TEXT.includes(f)) return;
    if (vi === 0 && f === "name") s.npName = value || null;
    else if (vi === 0 && f === "card") s.npCard = CARDS.includes(value) ? value : null;
    else V[f] = value;
  } else if (kind === "r" || kind === "o") {
    const row = (kind === "r" ? V.rows : V.ocRows)[Number(parts[1])]; if (!row) return;
    if (parts[2] === "label") row.label = value; else { const ci = Number(parts[2]); if (ci >= 0 && ci < 5) row.vals[ci] = value; }
  } else return;
  scheduleWrite("servants", s);
  if (path === "f:name" && vi === 0) { renderList(); }
}

// Toggle chips for linking something to stages and costumes
function linkChips(s, slots, action, extra) {
  return `<div class="link-chips" role="group" aria-label="Stages and costumes">${slotsOf(s).map((x) => {
    const on = slots.includes(x.k), a = artOf(s, x.k);
    return `<button type="button" class="chip${on ? " on" : ""}" data-action="${action}" data-slot="${esc(x.k)}"${extra || ""} aria-pressed="${on}">${a ? `<img src="${esc(artSrc(a))}" alt="" data-art="1">` : ""}<span>${esc(x.t)}</span></button>`;
  }).join("")}</div>`;
}

function npSectionHTML(s) {
  const got = npTableOf(s), T = got.T;
  const ed = S.npEdit === s.id && !S.readOnly;
  const gi = npGi(s, T), G = T.g[gi], list = npInGroup(T, gi), vi = npVi(s, T), V = T.v[vi], j = Math.max(0, list.indexOf(vi));
  const card = npField(s, V, vi, "card"), cc = cardCls(card), npl = num(s.npLevel);
  const cell = (path, text, ph, multi) => ed
    ? `<span class="ce${multi ? " multi" : ""}" contenteditable="true" spellcheck="false" data-np="${path}" data-ph="${esc(ph || "")}" aria-label="${esc(ph || "Value")}">${esc(multi ? effectLines(text).join("\n") : text)}</span>`
    : (text ? (multi ? iconLinesHTML(s, text) : esc(text)) : `<span class="npt-empty">—</span>`);
  const forms = T.g.map((x, k) => `<button type="button" role="tab" aria-selected="${k === gi}" data-action="np-form" data-i="${k}"${x.slots.length ? ` title="Follows ${esc(slotNames(s, x.slots))}"` : ""}>${esc(npFormLabel(x, k))}${x.slots.length ? ` <i class="lnk" aria-hidden="true">↔</i>` : ""}</button>`).join("")
    + (ed ? `<button type="button" class="npt-add" data-action="np-form-add" title="Adds a new form, starting as a copy of this one">+ Form</button>` : "");
  const vers = list.map((i, jj) => `<button type="button" role="tab" aria-selected="${i === vi}" data-action="np-ver" data-i="${i}">${esc(npTabLabel(T.v[i], jj))}</button>`).join("")
    + (ed ? `<button type="button" class="npt-add" data-action="np-ver-add" title="Adds a copy of this version">+ Version</button>` : "");
  const showForms = T.g.length > 1 || ed, showVers = list.length > 1 || ed;
  const tools = ed ? `<div class="npt-tools form-tools">
      <div class="f"><label for="np-form">Form name</label><input id="np-form" type="text" data-np-in="g:name" value="${esc(G.name)}" placeholder="${esc(npFormLabel({name: ""}, gi))}" maxlength="40" autocomplete="off"></div>
      ${T.g.length > 1 ? (S.npConfirm === "g" + gi
        ? `<div class="confirm" style="flex-basis:100%"><p>Delete the ${esc(npFormLabel(G, gi))} form and its versions?</p><button type="button" class="btn danger solid sm" data-action="np-form-del-go">Delete</button><button type="button" class="btn ghost sm" data-action="np-ver-keep">Keep it</button></div>`
        : `<button type="button" class="btn danger sm" data-action="np-form-del">Delete this form</button>`) : ""}
      ${gi > 0 || T.g.length > 1 ? `<div class="link-wrap"><span class="lbl">Show this form when I pick</span>${linkChips(s, G.slots, "np-link")}</div>` : `<p class="sk-hint" style="flex-basis:100%">Add a form for NP upgrades tied to a stage or costume (like Ortenaus or Paladin), then link it here.</p>`}
    </div>
    <div class="npt-tools">
      <div class="f"><label for="np-tab">Version tab name</label><input id="np-tab" type="text" data-np-in="f:tab" value="${esc(V.tab)}" placeholder="${esc(npTabLabel(Object.assign({}, V, {tab: ""}), j))}" maxlength="40" autocomplete="off"></div>
      <div class="f"><label for="np-card">Card</label><select id="np-card" data-np-in="f:card">${opt(CARDS, card, "—")}</select></div>
      <div class="f"><label for="np-target">Target</label><select id="np-target" data-np-in="target">${opt(TARGETS, s.npTarget, "—")}</select></div>
      ${list.length > 1 ? (S.npConfirm === vi
        ? `<div class="confirm" style="flex-basis:100%"><p>Delete the ${esc(npTabLabel(V, j))} version of this table?</p><button type="button" class="btn danger solid sm" data-action="np-ver-del-go">Delete</button><button type="button" class="btn ghost sm" data-action="np-ver-keep">Keep it</button></div>`
        : `<button type="button" class="btn danger sm" data-action="np-ver-del">Delete this version</button>`) : ""}
    </div>` : "";
  const rowHTML = (r, ri, kind) => `<tr${kind === "o" ? ' class="oc"' : ""}><th class="lab">${cell(kind + ":" + ri + ":label", r.label, kind === "r" ? "Effect, e.g. Damage +" : "Effect, e.g. Extra damage x")}${ed ? `<button type="button" class="npt-x" data-action="np-row-del" data-kind="${kind}" data-i="${ri}" aria-label="Remove this row">Remove row</button>` : ""}</th>${r.vals.map((v, ci) => `<td${kind === "r" && npl === ci + 1 ? ' class="you"' : ""}>${cell(kind + ":" + ri + ":" + ci, v, "")}</td>`).join("")}</tr>`;
  const showNp = ed || V.rows.some((r) => !npFlat(r));
  const showOc = ed || !!V.oc || V.ocRows.some((r) => r.label || r.vals.some(Boolean));
  const base = CARD_MULT[card] ? `<span>Base Damage: x${CARD_MULT[card]}</span>${ed ? `<small class="npt-auto">from the ${esc(card)} card</small>` : ""}` : ed ? `<span>Base Damage: x</span>${cell("f:base", V.base, "1.0")}` : (V.base ? `Base Damage: x${esc(V.base)}` : `<span>Base Damage: <span class="npt-empty">—</span></span>`);
  return `<section class="d-sec np-sec">
    <div class="sec-head"><h3>Noble Phantasm ${npl ? `<small>your NP${npl} column is underlined</small>` : ""}</h3>${S.readOnly ? "" : `<button type="button" class="btn sm${ed ? " primary" : ""}" data-action="np-edit">${ed ? "Done editing" : "Edit table"}</button>`}</div>
    <div class="npt-box ${cc}"${CARDS.includes(card) ? ` data-atmo="${card.toLowerCase()}"` : ""}>
      ${showForms ? `<div class="npt-tabs npt-forms" role="tablist" aria-label="Noble Phantasm forms">${forms}</div>` : ""}
      ${showVers ? `<div class="npt-tabs npt-vers${showForms ? " sub" : ""}" role="tablist" aria-label="Noble Phantasm versions">${vers}</div>` : ""}
      ${tools}
      ${ed || V.note ? `<div class="npt-note">${cell("f:note", V.note, "Note, e.g. Upgrades after Strengthen 1")}</div>` : ""}
      <div class="npt-title">${npAtmoHTML(card)}<b>${cell("f:name", npField(s, V, vi, "name"), "Noble Phantasm name")}</b>${ed || V.sub ? `<span>${cell("f:sub", V.sub, "Second name or reading")}</span>` : ""}${s.npTarget && !ed ? `<span class="tag">${esc(s.npTarget)}</span>` : ""}</div>
      <div class="npt-scroll"><table class="npt">
        <colgroup><col class="c-lab"><col><col><col><col><col></colgroup>
        <tbody>
          <tr><td class="npt-cardcell" rowspan="4">${CARD_IMG[card] ? `<img class="np-card" src="${CARD_IMG[card]}" alt="${esc(card)} card">` : `<div class="np-emblem" aria-hidden="true"><span>${esc(card || "?")}</span></div>`}<div class="npt-base">${base}</div></td><th>Rank</th><th colspan="4">Noble Phantasm Type</th></tr>
          <tr><td>${cell("f:rank", V.rank, "B+")}</td><td colspan="4">${cell("f:type", V.type, "Anti-Army")}</td></tr>
          <tr><th>Hits</th><th colspan="4">Per Hit Percentage</th></tr>
          <tr><td>${cell("f:hits", V.hits, "5")}</td><td colspan="4">${cell("f:perHit", V.perHit, "6%, 13%, 20%, 26%, 35%")}</td></tr>
          <tr><th class="lab">Effect</th><td colspan="5">${cell("f:effect", V.effect, "What the NP does (Enter starts a new line)", true)}</td></tr>
          ${showNp ? `<tr><th class="lab">NP Level</th>${[1, 2, 3, 4, 5].map((i) => `<th${npl === i ? ' class="you"' : ""}>${i}${npl === i ? "<small>yours</small>" : ""}</th>`).join("")}</tr>${V.rows.map((r, ri) => ed || !npFlat(r) ? rowHTML(r, ri, "r") : "").join("")}` : ""}
          ${ed ? `<tr class="npt-addrow"><td colspan="6"><button type="button" class="btn ghost sm" data-action="np-row-add" data-kind="r">+ Add NP level row</button></td></tr>` : ""}
          ${showOc ? `<tr class="oc"><th class="lab">Overcharge Effect</th><td colspan="5">${cell("f:oc", V.oc, "What overcharging adds (Enter starts a new line)", true)}</td></tr><tr class="oc"><th class="lab">Charge</th>${NP_CHARGE.map((x) => `<th>${x}</th>`).join("")}</tr>${V.ocRows.map((r, ri) => rowHTML(r, ri, "o")).join("")}` : ""}
          ${ed ? `<tr class="npt-addrow"><td colspan="6"><button type="button" class="btn ghost sm" data-action="np-row-add" data-kind="o">+ Add overcharge row</button></td></tr>` : ""}
        </tbody>
      </table></div>
      ${got.auto && !ed ? `<p class="npt-hint">Started from your notes: the damage steps are the standard ones for this NP's NP1 value. Press Edit table to change or add anything.</p>` : ""}
    </div>
  </section>`;
}

/* ---------- skill sets: other skills for a costume, a stage or an NP form ---------- */
function skSets(s) { return s && Array.isArray(s.skillSets) ? s.skillSets.filter((x) => x && typeof x === "object") : []; }
function skSetName(s, k) { if (!k) return s.skillBaseName || "Default"; const x = skSets(s)[k - 1]; return (x && x.name) || "Set " + (k + 1); }
// Which set shows: the tab you picked, else the set linked to the stage or costume on screen, else Default.
function skSetIdx(s) {
  const sets = skSets(s); if (!sets.length) return 0;
  const m = num(S.skSet[s.id]); if (m != null && m >= 0 && m <= sets.length) return m;
  const slot = viewSlot(s), i = sets.findIndex((x) => Array.isArray(x.slots) && x.slots.includes(slot));
  return i >= 0 ? i + 1 : 0;
}
function skInfos(s, k) { if (!k) return s.skillInfo || []; const x = skSets(s)[k - 1]; return x && Array.isArray(x.info) ? x.info : []; }
// Switching the picture by any route hands control back to the picture, except for the switcher that did it.
function setView(s, slot, keep) { S.viewStage[s.id] = slot; if (keep !== "sk") delete S.skSet[s.id]; if (keep !== "np") delete S.npGrp[s.id]; }
// When a tab is picked, show art that matches it (its linked costume, or for Default a stage nothing else claims)
function viewFor(s, slots, claimed) {
  const cur = viewSlot(s);
  if (slots.length) { if (slots.includes(cur)) return null; return slots.find((k) => artOf(s, k)) || null; }
  if (!claimed.includes(cur)) return null;
  const f = slotsOf(s).find((x) => !claimed.includes(x.k) && artOf(s, x.k)); return f ? f.k : null;
}
function skSetsPanelHTML(s) {
  const sets = skSets(s);
  if (!sets.length) return S.readOnly ? "" : `<section class="d-sec sk-ask"><p>Does this servant get a different set of skills in a costume, at a certain stage or after an NP power-up?</p><button type="button" class="btn sm" data-action="sk-sets-on">Yes, add a skill set</button></section>`;
  const ks = [0].concat(sets.map((_, i) => i + 1));
  if (!S.skMgr[s.id]) {
    const pills = ks.map((k) => { const sl = k ? (sets[k - 1].slots || []) : []; return `<span class="sk-pill"><b>${esc(skSetName(s, k))}</b> <small>${k ? (sl.length ? "↔ " + esc(slotNames(s, sl)) : "NP form, picked by hand") : "everything else"}</small></span>`; }).join("");
    return `<section class="d-sec sk-mgr"><div class="sec-head"><h3>Skill sets</h3>${S.readOnly ? "" : `<button type="button" class="btn sm" data-action="sk-mgr">Manage</button>`}</div><div class="sk-pills">${pills}</div></section>`;
  }
  const rows = ks.map((k) => `<li class="sk-row">
      <div class="sk-row-head"><input type="text" class="sk-name" data-skset-name="${k}" value="${esc(k ? (sets[k - 1].name || "") : (s.skillBaseName || ""))}" placeholder="${esc(k ? "Name, e.g. Ortenaus or Super Aoko" : "Default")}" maxlength="40" aria-label="Skill set name" autocomplete="off">
        <button type="button" class="btn sm" data-action="sk-set-edit" data-k="${k}">Edit its skills</button>
        ${k ? (S.skConfirm === k ? `<span class="confirm-inline">Delete this set? <button type="button" class="btn danger solid sm" data-action="sk-set-del-go" data-k="${k}">Delete</button><button type="button" class="btn ghost sm" data-action="sk-set-keep">Keep</button></span>` : `<button type="button" class="btn danger sm" data-action="sk-set-del" data-k="${k}">Delete</button>`) : ""}</div>
      ${k ? `<span class="lbl">Show these skills when I pick</span>${linkChips(s, sets[k - 1].slots || [], "sk-link", ` data-k="${k}"`)}` : `<p class="sk-hint">Used for every stage and costume not linked to another set.</p>`}
    </li>`).join("");
  return `<section class="d-sec sk-mgr open"><div class="sec-head"><h3>Skill sets</h3><div class="deck-tools"><button type="button" class="btn sm" data-action="sk-set-add">+ Add skill set</button><button type="button" class="btn sm primary" data-action="sk-mgr">Done</button></div></div>
    <p class="sk-hint">Link a set to stages or costumes and the skills switch when you pick that picture. Leave a set unlinked for an NP power-up form like Super Aoko, and open it from the tabs above the skills.</p>
    <ol class="sk-list">${rows}</ol></section>`;
}
function skillsSectionHTML(s) {
  const sets = skSets(s), k = skSetIdx(s), infos = skInfos(s, k);
  const ks = [0].concat(sets.map((_, i) => i + 1));
  const tabs = sets.length ? `<div class="sk-tabs" role="tablist" aria-label="Skill sets">${ks.map((j) => `<button type="button" role="tab" aria-selected="${j === k}" data-action="sk-set" data-k="${j}">${esc(skSetName(s, j))}</button>`).join("")}</div>` : "";
  const sl = k ? (sets[k - 1].slots || []) : [];
  const note = sets.length ? (k ? (sl.length ? "Skills for " + slotNames(s, sl) : "Skills for this NP form or state") : "Default skills") : "";
  return `<section class="d-sec"><h3>Skills <small>values at your current skill levels</small></h3>${tabs}${note ? `<p class="sk-note">${esc(note)}</p>` : ""}
      <div class="skills">${[0, 1, 2].map((i) => skillHTML(s, i, infos, k)).join("")}</div>
    </section>`;
}
function skillBlocksHTML(pre, infos) {
  infos = infos || [];
  return [0, 1, 2].map((i) => { const k = infos[i] || {}; const p = pre + "-s" + (i + 1); const rows = scalesOf(k); return `<div class="skill-form form-grid">
      ${fld(p + "-name", "Skill " + (i + 1) + " name", inp(p + "-name", skFormName(k), "text", 'autocomplete="off"'), "wide")}
      ${fld(p + "-rank", "Rank", inp(p + "-rank", skNameRank(k.name, k.rank).rank, "text", 'maxlength="8" placeholder="e.g. A+" autocomplete="off" spellcheck="false"'), "sk-rank-f")}
      ${fld(p + "-effect", "What it does (one effect per line)", `<textarea id="${p}-effect" rows="4">${esc(effectLines(k.effect).join("\n"))}</textarea>`, "full")}
      ${fld(p + "-cd", "Cooldown at Lv 1", inp(p + "-cd", k.cd, "number", 'min="0" max="20"'))}
      <div class="f full"><span class="lbl">Values that change with skill level</span><div class="sc-rows" id="${p}-rows">${(rows.length ? rows : [{}]).map(scaleRowHTML).join("")}</div><button type="button" class="btn sm sc-add" data-action="sc-add" data-target="${p}-rows">+ Add value</button></div>
    </div>`; }).join("");
}
function readSkillBlocks(pre, prev) {
  return [1, 2, 3].map((n) => {
    const p = pre + "-s" + n, scales = readScales(p + "-rows"), first = scales[0] || {}, old = (prev || [])[n - 1] || {};
    const eb = document.getElementById(p + "-effect");
    // the first value is also kept in the old single-value fields, so older copies of this page still show it
    return Object.assign({}, old, {name: val(p + "-name") || null, rank: val(p + "-rank") || null, effect: multiText(eb ? eb.value : "") || null, cd: num(val(p + "-cd")), scales: scales,
      label: first.label || null, v1: first.v1 != null ? first.v1 : null, v10: first.v10 != null ? first.v10 : null, unit: first.unit || null});
  });
}

/* ---------- skill ranks: EX shines in rainbow, A in gold, B in beige ---------- */
// A rank written at the end of a name ("Charisma B", "Mana Burst A (-> ... after Rank Up)") is read out of the name.
const RANK_RE = /^(.*?\S)\s+(EX|[A-E](?:\+{1,3}|-)?)((?:\s*(?:\([^)]*\)|[†‡]))*)\s*$/;
// Notes kept after a name, like "(upgraded)" or a dagger, are shown smaller
const NOTE_RE = /((?:\s*(?:\([^)]*(?:->|→|upgrad|after|rank up|name|wiki|interlude|strengthen)[^)]*\)|[†‡]))+)\s*$/i;
function skNameRank(name, rank) {
  let n = String(name == null ? "" : name).replace(/\s+/g, " ").trim(), r = String(rank == null ? "" : rank).replace(/\s+/g, " ").trim(), note = "";
  if (!n || n.startsWith("(")) return {name: n, rank: r, note: ""};
  if (!r) { const m = RANK_RE.exec(n); if (m) { n = (m[1] + m[3]).trim(); r = m[2]; } }
  const t = NOTE_RE.exec(n); if (t && t.index > 0) { note = t[1].trim(); n = n.slice(0, t.index).trim(); }
  return {name: n, rank: r, note: note};
}
function rankTier(r) {
  const x = String(r || "").trim().toUpperCase();
  if (!x) return "";
  if (x.startsWith("EX")) return "ex";
  if (x[0] === "A") return "a";
  if (x[0] === "B") return "b";
  return "";
}
// Name and rank as styled spans; unnamed placeholders like "(name not shown on wiki)" stay plain
function rankNameHTML(nr, fallback) {
  const unnamed = !nr.name || nr.name.startsWith("(");
  const name = unnamed ? `<span class="sk-un">${esc(nr.name ? nr.name.replace(/^\(|\)$/g, "") : (fallback || "Name not filled in"))}</span>` : `<span class="sk-nm">${esc(nr.name)}</span>`;
  const rank = nr.rank ? ` <span class="sk-rk">${esc(nr.rank)}</span>` : "";
  const spark = nr.rank && rankTier(nr.rank) === "ex" ? `<i class="sk-spark" aria-hidden="true">✦</i>` : "";
  return name + rank + spark + (nr.note ? ` <small class="sk-tail">${esc(nr.note)}</small>` : "");
}

const psTierCls = (x) => { const t = rankTier(skNameRank(x.name, x.rank).rank); return t ? " tier-" + t : ""; };
// In the edit form the rank gets its own box, so a rank read from the name is taken out of the name there
function skFormName(k) {
  const n = String(k.name == null ? "" : k.name);
  if (k.rank || n.trim().startsWith("(")) return n;
  const nr = skNameRank(n, ""); return nr.rank ? (nr.name + (nr.note ? " " + nr.note : "")) : n;
}

/* ---------- class affinity: how hard each class hits every other class ---------- */
const AFF_CLASSES = ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker", "Shielder", "Ruler", "Avenger", "Moon Cancer", "Alter Ego", "Foreigner", "Pretender", "Beast"];
const AFF_KEY = "spirit-origin-list:v1:affinity";
const AFF_STEPS = [2, 1.5, 1, 0.5];
// The standard chart, attacker > defender. Anything not listed is 1x.
const AFF_BASE = (() => {
  const m = {}, set = (a, d, v) => { m[a + ">" + d] = v; };
  const ring = (list) => list.forEach((a, i) => { const d = list[(i + 1) % 3]; set(a, d, 2); set(d, a, 0.5); });
  ring(["Saber", "Lancer", "Archer"]); ring(["Rider", "Caster", "Assassin"]);
  ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin"].forEach((a) => set(a, "Ruler", 0.5));
  AFF_CLASSES.forEach((c) => { if (c !== "Shielder" && c !== "Beast") { set("Berserker", c, 2); set(c, "Berserker", 2); } });
  set("Berserker", "Foreigner", 0.5); set("Berserker", "Pretender", 1.5);
  set("Ruler", "Moon Cancer", 2); set("Ruler", "Avenger", 0.5);
  set("Avenger", "Ruler", 2); set("Avenger", "Moon Cancer", 0.5);
  set("Moon Cancer", "Avenger", 2); set("Moon Cancer", "Ruler", 0.5);
  ["Rider", "Caster", "Assassin"].forEach((d) => { set("Alter Ego", d, 1.5); set("Pretender", d, 0.5); });
  ["Saber", "Archer", "Lancer"].forEach((d) => { set("Alter Ego", d, 0.5); set("Pretender", d, 1.5); });
  set("Alter Ego", "Foreigner", 2); set("Alter Ego", "Pretender", 0.5);
  set("Pretender", "Alter Ego", 2); set("Pretender", "Foreigner", 0.5);
  set("Foreigner", "Foreigner", 2); set("Foreigner", "Pretender", 2); set("Foreigner", "Alter Ego", 0.5);
  // Beast changes from one Beast to the next; this follows Space Ereshkigal's page on the wiki
  ["Ruler", "Moon Cancer", "Alter Ego", "Foreigner", "Pretender"].forEach((d) => { set("Beast", d, 1.5); set(d, "Beast", 0.5); });
  set("Avenger", "Beast", 2); set("Beast", "Avenger", 0.5);
  return m;
})();
const affBase = (a, d) => AFF_BASE[a + ">" + d] || 1;
function affClean(d) {
  const m = {};
  if (d && typeof d === "object") Object.keys(d).forEach((k) => {
    const p = k.split(">"), v = Number(d[k]);
    if (p.length === 2 && AFF_CLASSES.includes(p[0]) && AFF_CLASSES.includes(p[1]) && AFF_STEPS.includes(v) && v !== affBase(p[0], p[1])) m[k] = v;
  });
  return m;
}
let affOv = null;
function affOverrides() {
  if (affOv) return affOv;
  try { affOv = affClean(JSON.parse(localStorage.getItem(AFF_KEY) || "null")); } catch (e) { affOv = {}; }
  return affOv;
}
function setAffOverrides(m) {
  affOv = affClean(m);
  try { if (Object.keys(affOv).length) localStorage.setItem(AFF_KEY, JSON.stringify(affOv)); else localStorage.removeItem(AFF_KEY); } catch (e) {}
}
function aff(a, d) {
  if (!AFF_CLASSES.includes(a) || !AFF_CLASSES.includes(d)) return 1;
  const o = affOverrides()[a + ">" + d];
  return o != null ? o : affBase(a, d);
}
const affTxt = (v) => v === 0.5 ? "½×" : v + "×";
const affWord = (v) => v >= 2 ? "strong" : v > 1 ? "slightly strong" : v < 1 ? "weak" : "neutral";
const affCls = (v) => v >= 2 ? "a2" : v > 1 ? "a15" : v < 1 ? "a05" : "a1";
function affCycle(a, d) {
  const cur = aff(a, d), nx = AFF_STEPS[(AFF_STEPS.indexOf(cur) + 1) % AFF_STEPS.length], m = Object.assign({}, affOverrides());
  m[a + ">" + d] = nx; setAffOverrides(m);
}

/* ---------- Versus: two or three servants side by side ---------- */
const VS_KEY = "spirit-origin-list:v1:vs";
const VS_K = ["A", "B", "C"];
let vsMem = null;
function vsStored() {
  if (vsMem) return vsMem;
  try { const d = JSON.parse(localStorage.getItem(VS_KEY) || "null"); vsMem = Array.isArray(d) ? d.filter((x) => typeof x === "string") : []; } catch (e) { vsMem = []; }
  return vsMem;
}
function vsPicks() {
  const ids = [];
  vsStored().forEach((id) => { if (ids.length < 3 && !ids.includes(id) && S.servants.some((s) => s.id === id)) ids.push(id); });
  for (const id of rankRows().map((r) => r.s.id).concat(S.servants.map((s) => s.id))) { if (ids.length >= 2) break; if (!ids.includes(id)) ids.push(id); }
  return ids;
}
function setVsPicks(ids) { vsMem = ids.slice(0, 3); try { localStorage.setItem(VS_KEY, JSON.stringify(vsMem)); } catch (e) {} }
const vsKey = (i) => `<span class="vs-key k${i + 1}">${VS_K[i]}</span>`;
const statMax = (m) => Math.max(2000, Math.ceil(m / 2000) * 2000);
const VS_METRICS = [
  {k: "hp", t: "HP", sub: "Fou included", get: (s) => total(s, "hp"), max: statMax, f: fmt},
  {k: "atk", t: "ATK", sub: "Fou included", get: (s) => total(s, "atk"), max: statMax, f: fmt},
  {k: "level", t: "Level", sub: "of 120", get: (s) => num(s.level), max: () => 120, f: String},
  {k: "np", t: "NP level", sub: "of 5", get: (s) => num(s.npLevel), max: () => 5, f: (v) => "NP" + v},
  {k: "sk", t: "Skill levels", sub: "of 30", get: (s) => skillTotal(s), max: () => 30, f: String},
  {k: "score", t: "Rank score", sub: "of 100", get: (s) => s.wish ? null : scoreOf(s).total, max: () => 100, f: (v) => v.toFixed(1)}
];

function vsHeroHTML(s, i, ids) {
  const optFor = (x) => `<option value="${esc(x.id)}"${x.id === s.id ? " selected" : ""}${x.id !== s.id && ids.includes(x.id) ? " disabled" : ""}>${esc(x.name)}</option>`;
  const own = owned(), wish = wished();
  const opts = (own.length ? `<optgroup label="Your servants">${own.map(optFor).join("")}</optgroup>` : "") + (wish.length ? `<optgroup label="Guests">${wish.map(optFor).join("")}</optgroup>` : "");
  const k = iconSlot(s), r = clamp(num(s.rarity) || 0, 0, 5), x = EXTRA_ACC[s.cls];
  const art = k ? `<img class="vs-art" src="${esc(artSrc(artOf(s, k)))}" alt="" data-art="1">` : (CLASS_MARK[s.cls] ? `<img class="vs-art mark" src="${CLASS_MARK[s.cls]}" alt="">` : `<span class="vs-art none">${esc(ABBR[s.cls] || "?")}</span>`);
  return `<article class="vs-hero k${i + 1}${x ? " extra" : ""}"${x ? ` style="--acc: rgb(${x.join(",")})"` : ""}>
    <div class="vs-hero-top">${vsKey(i)}<select class="vs-sel" data-vs-pick="${i}" aria-label="Servant ${VS_K[i]}">${opts}</select>${i === 2 ? `<button type="button" class="btn ghost sm vs-x" data-action="vs-del" data-i="2" aria-label="Remove servant C from the comparison">✕</button>` : ""}</div>
    <div class="vs-frame">${art}</div>
    <h3><button type="button" class="vs-name" data-action="goto" data-id="${esc(s.id)}" title="Open ${esc(s.name)}">${esc(s.name)}</button></h3>
    <p class="vs-cls">${CLASS_LOGO[s.cls] ? `<img src="${CLASS_LOGO[s.cls]}" alt="">` : ""}<span>${esc(s.cls || "No class")}</span></p>
    <p class="vs-meta"><span class="stars" aria-label="${r} stars">${"★".repeat(r)}</span><span>Lv ${esc(s.level ?? "—")}</span>${s.npLevel ? `<span>NP${esc(s.npLevel)}</span>` : ""}${s.wish ? `<span class="tag">Guest</span>` : ""}</p>
  </article>`;
}

function vsMatchHTML(picks) {
  const head = picks.map((s, j) => `<th scope="col">${vsKey(j)}<span class="vs-th-n">${esc(s.name)}</span></th>`).join("");
  const rows = picks.map((a, i) => `<tr><th scope="row">${vsKey(i)}<span class="vs-th-n">${esc(a.name)}</span><small>${esc(a.cls || "No class")}</small></th>${picks.map((d, j) => {
    if (i === j) return `<td class="vs-self">—</td>`;
    if (!a.cls || !d.cls) return `<td class="aff-c a1"><b>?</b><small>class not set</small></td>`;
    const v = aff(a.cls, d.cls);
    return `<td class="aff-c ${affCls(v)}" data-tip="${esc(a.name + " (" + a.cls + ") attacking " + d.name + " (" + d.cls + "): " + affTxt(v) + " damage, " + affWord(v))}"><b>${affTxt(v)}</b><small>${affWord(v)}</small></td>`;
  }).join("")}</tr>`).join("");
  return `<table class="vs-match"><caption>Row attacks column. Damage multiplier from class affinity.</caption><thead><tr><td class="vs-corner"><span>Attacker ↓</span><span>Defender →</span></td>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}
function vsVerdict(picks) {
  if (picks.length !== 2) return "";
  const [a, b] = picks; if (!a.cls || !b.cls) return "";
  const ab = aff(a.cls, b.cls), ba = aff(b.cls, a.cls);
  const line = (x, y, v) => `<b>${esc(x.name)}</b> deals <b>${affTxt(v)}</b> damage to ${esc(y.name)}`;
  const lead = ab > ba ? esc(a.name) + " has the class advantage." : ba > ab ? esc(b.name) + " has the class advantage." : "Neither class has the edge.";
  return `<p class="vs-verdict">${lead} ${line(a, b, ab)}; ${line(b, a, ba)}.</p>`;
}

function vsStatsHTML(picks) {
  return `<div class="vs-metrics">${VS_METRICS.map((m) => {
    const vals = picks.map((s) => { const v = m.get(s); return v == null || isNaN(v) ? null : v; });
    const got = vals.filter((v) => v != null), top = got.length ? Math.max(...got) : 0, max = m.max(top);
    const best = got.length > 1 && got.some((v) => v !== top) ? top : null;
    return `<div class="vs-metric"><h4>${m.t} <small>${m.sub}</small></h4><div class="vs-bars">${picks.map((s, i) => {
      const v = vals[i], w = v == null ? 0 : clamp(v / max * 100, 0, 100);
      let tip = s.name + ": " + m.t + " " + (v == null ? (m.k === "score" && s.wish ? "not ranked (wishlist)" : "not filled in") : m.f(v));
      if (v != null && (m.k === "hp" || m.k === "atk")) tip += " (base " + fmt(num(s[m.k])) + " + Fou " + fmt(num(s[m.k === "hp" ? "fouHp" : "fouAtk"]) || 0) + ")";
      return `<div class="vs-bar-row k${i + 1}" data-tip="${esc(tip)}"><span class="vs-bar-n">${vsKey(i)}<span>${esc(s.name)}</span></span><span class="vs-track" aria-hidden="true">${v == null ? "" : `<i class="vs-fill" style="width:${w.toFixed(1)}%"></i>`}</span><span class="vs-val">${v == null ? `<span class="muted">${m.k === "score" && s.wish ? "Not ranked" : "Not filled in"}</span>` : esc(m.f(v))}${best != null && v === best ? `<em class="vs-best">Best</em>` : ""}</span></div>`;
    }).join("")}</div></div>`;
  }).join("")}</div>`;
}

function vsNpHTML(s, i) {
  const T = npTableOf(s).T, vi = npVi(s, T), V = T.v[vi], card = npField(s, V, vi, "card"), name = npField(s, V, vi, "name"), npl = clamp(num(s.npLevel) || 1, 1, 5);
  const row = V.rows.find((r) => /dmg|damage/i.test(r.label) && r.vals.some(Boolean)) || V.rows.find((r) => r.vals.some(Boolean));
  const dmg = row ? row.vals[npl - 1] : "";
  const oc = V.ocRows.find((r) => r.vals.some(Boolean));
  const meta = [s.npTarget, V.rank ? "Rank " + V.rank : "", V.type].filter(Boolean).join(" · ");
  const lab = row && row.label ? row.label.replace(/[\s+]+$/, "") : "Damage";
  return `<article class="vs-col k${i + 1}"><header class="vs-col-h">${vsKey(i)}<b>${esc(s.name)}</b></header>
    <div class="vs-np">${CARD_IMG[card] ? `<img class="vs-np-card" src="${CARD_IMG[card]}" alt="${esc(card)}">` : `<span class="vs-np-card none" title="Card not set">?</span>`}<div><b class="vs-np-name">${esc(name || "NP name not filled in")}</b>${meta ? `<span class="muted">${esc(meta)}</span>` : ""}</div></div>
    <dl class="vs-kv">
      <div><dt>${esc(lab)} at NP${npl}${s.npLevel ? "" : " (NP level not set)"}</dt><dd>${dmg ? esc(dmg) : "—"}</dd></div>
      ${V.hits ? `<div><dt>Hits</dt><dd>${esc(V.hits)}</dd></div>` : ""}
      ${oc ? `<div><dt>Overcharge${oc.label ? ": " + esc(oc.label) : ""}</dt><dd>${esc(oc.vals.filter(Boolean).join(" → "))}</dd></div>` : (V.oc ? `<div><dt>Overcharge</dt><dd class="txt">${esc(effectLines(V.oc)[0] || "")}</dd></div>` : "")}
    </dl>
    ${V.effect ? `<div class="effect vs-eff">${iconLinesHTML(s, V.effect, true)}</div>` : ""}
  </article>`;
}

function vsSkillsHTML(s, i) {
  const infos = skInfos(s, skSetIdx(s));
  const sk = [0, 1, 2].map((j) => {
    const info = infos[j] || {}, nr = skNameRank(info.name, info.rank), lv = (s.skills || [])[j], t = rankTier(nr.rank), cd = curCd(info, lv);
    return `<li class="vs-sk${t ? " tier-" + t : ""}"><span class="vs-sk-n">${rankNameHTML(nr)}</span><span class="vs-sk-lv">Skill ${j + 1} · ${typeof lv === "number" ? "Lv " + lv : "Locked"}${cd != null ? " · cooldown " + cd : ""}</span></li>`;
  }).join("");
  const ps = passivesOf(s);
  const psl = ps.length ? `<ul class="vs-sk-list">${ps.map((x) => { const nr = skNameRank(x.name || "Unnamed passive", x.rank), t = rankTier(nr.rank); return `<li class="vs-sk ps${t ? " tier-" + t : ""}"><span class="vs-sk-n">${rankNameHTML(nr)}</span></li>`; }).join("")}</ul>` : `<p class="d-empty vs-none">No passive skills yet.</p>`;
  const d = deckOf(s), counts = ["Quick", "Arts", "Buster"].map((c) => [c, d.filter((x) => x === c).length]).filter((x) => x[1]);
  const deck = `<div class="vs-deck" role="img" aria-label="Deck: ${esc(d.some(Boolean) ? counts.map((x) => x[1] + " " + x[0]).join(", ") : "not set")}">${d.map((c) => c && CARD_IMG[c] ? `<img src="${CARD_IMG[c]}" alt="">` : `<span class="vs-deck-q">?</span>`).join("")}</div>`;
  return `<article class="vs-col k${i + 1}"><header class="vs-col-h">${vsKey(i)}<b>${esc(s.name)}</b></header>
    <h4 class="vs-sub">Skills</h4><ul class="vs-sk-list">${sk}</ul>
    <h4 class="vs-sub">Passive skills</h4>${psl}
    <h4 class="vs-sub">Deck${counts.length ? ` <small>${counts.map((x) => x[1] + " " + x[0]).join(" · ")}</small>` : ""}</h4>${deck}
  </article>`;
}

function affChartHTML(hl) {
  const ed = !!S.affEdit, ov = affOverrides(), nOv = Object.keys(ov).length;
  const head = AFF_CLASSES.map((d) => `<th scope="col" class="aff-h${hl.includes(d) ? " hl" : ""}">${CLASS_LOGO[d] ? `<img src="${CLASS_LOGO[d]}" alt="">` : ""}<span aria-hidden="true">${esc(ABBR[d])}</span><span class="sr">${esc(d)}</span></th>`).join("");
  const rows = AFF_CLASSES.map((a) => `<tr><th scope="row" class="aff-r${hl.includes(a) ? " hl" : ""}">${CLASS_LOGO[a] ? `<img src="${CLASS_LOGO[a]}" alt="">` : ""}<span>${esc(a)}</span></th>${AFF_CLASSES.map((d) => {
    const v = aff(a, d), changed = ov[a + ">" + d] != null;
    const mark = hl.includes(a) && hl.includes(d) ? " hl2" : (hl.includes(a) || hl.includes(d) ? " hl1" : "");
    const tip = a + " attacking " + d + ": " + affTxt(v) + " damage, " + affWord(v) + (changed ? " (you changed it; standard is " + affTxt(affBase(a, d)) + ")" : "");
    const txt = v === 1 ? "" : affTxt(v);
    return `<td class="aff-c ${affCls(v)}${mark}${changed ? " ov" : ""}" data-tip="${esc(tip)}">${ed ? `<button type="button" class="aff-b" data-action="aff-cycle" data-a="${esc(a)}" data-d="${esc(d)}" aria-label="${esc(tip)}. Press to change">${txt}</button>` : (txt || `<span class="sr">1×</span>`)}</td>`;
  }).join("")}</tr>`).join("");
  const legend = [2, 1.5, 1, 0.5].map((v) => `<span class="aff-key"><i class="aff-sw aff-c ${affCls(v)}" aria-hidden="true">${v === 1 ? "" : affTxt(v)}</i>${affTxt(v)} ${affWord(v)}</span>`).join("");
  const tools = `<div class="deck-tools">${nOv && !S.affConfirm ? `<button type="button" class="btn ghost sm" data-action="aff-reset">Reset chart</button>` : ""}<button type="button" class="btn sm${ed ? " primary" : ""}" data-action="aff-edit">${ed ? "Done" : "Edit chart"}</button></div>`;
  return `<div class="sec-head"><h3 class="vs-h">Class affinity <small>row attacks column</small></h3>${tools}</div>
    ${S.affConfirm ? `<div class="confirm"><p>Put every cell back to the standard chart? Your ${nOv} change${nOv === 1 ? "" : "s"} will be lost.</p><button type="button" class="btn danger solid sm" data-action="aff-reset-go">Reset</button><button type="button" class="btn ghost sm" data-action="aff-keep">Keep my changes</button></div>` : ""}
    <div class="aff-legend">${legend}${hl.length ? `<span class="aff-key"><i class="aff-sw hl-sw" aria-hidden="true"></i>Classes you're comparing</span>` : ""}${nOv ? `<span class="aff-key"><i class="aff-sw ov-sw" aria-hidden="true"></i>Changed by you</span>` : ""}</div>
    <div class="aff-scroll${ed ? " editing" : ""}"><table class="aff"><caption class="sr">Class affinity: the damage multiplier when the row class attacks the column class</caption><thead><tr><td class="aff-corner">Attacker ↓<br>Defender →</td>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="aff-note">${ed ? "Press a cell to change it: 2× → 1.5× → 1× → ½×. " : ""}Beast changes from one Beast to the next; this chart uses Space Ereshkigal's, so change the Beast row and column for another Beast. Your changes stay in this browser and go into your backup.</p>`;
}

function renderVersus() {
  const el = $("#versus"); if (!el || S.tab !== "versus") return;
  hideTip();
  if (S.dbState !== "ok" || !S.loaded.servants) { el.innerHTML = ""; return; }
  const ids = vsPicks(), picks = ids.map((id) => S.servants.find((s) => s.id === id)).filter(Boolean), n = picks.length;
  const hl = Array.from(new Set(picks.map((s) => s.cls).filter((c) => AFF_CLASSES.includes(c))));
  let html;
  if (n < 2) html = `<div class="list-note"><h2>Add another servant to compare</h2><p>Versus puts two or three servants side by side: stats, Noble Phantasms, skills and how their classes match up.</p>${S.readOnly ? "" : `<button class="btn primary" data-action="add-servant">Add servant</button>`}</div>`;
  else {
    const heroes = picks.map((s, i) => (i ? `<div class="vs-mid"><span class="vs-badge" aria-hidden="true">VS</span>${i === 1 ? `<button type="button" class="vs-swap" data-action="vs-swap" aria-label="Swap A and B" title="Swap A and B">⇄</button>` : ""}</div>` : "") + vsHeroHTML(s, i, ids)).join("");
    html = `<div class="toolbar vs-tools"><p class="rank-note grow">Pick two or three servants. Each measure has its own scale, starting at zero.</p>${n < 3 && S.servants.length > 2 ? `<button type="button" class="btn sm" data-action="vs-add3">+ Add a third</button>` : ""}</div>
      <div class="vs-heroes n${n}">${heroes}</div>
      <section class="vs-panel"><h3 class="vs-h">Class matchup</h3>${vsVerdict(picks)}<div class="vs-scroll">${vsMatchHTML(picks)}</div></section>
      <section class="vs-panel"><h3 class="vs-h">Trait overlap</h3>${vsTraitsHTML(picks)}</section>
      <section class="vs-panel"><h3 class="vs-h">Stats</h3>${vsStatsHTML(picks)}</section>
      <section class="vs-panel"><h3 class="vs-h">Noble Phantasm</h3><div class="vs-cols n${n}">${picks.map(vsNpHTML).join("")}</div></section>
      <section class="vs-panel"><h3 class="vs-h">Skills, passives and deck</h3><div class="vs-cols n${n}">${picks.map(vsSkillsHTML).join("")}</div></section>`;
  }
  el.innerHTML = html + `<section class="vs-panel aff-panel${S.affEdit ? " editing" : ""}" aria-label="Class affinity chart">${affChartHTML(hl)}</section>`;
}
function hideTip() { const t = document.getElementById("vs-tip"); if (t && !t.hidden) t.hidden = true; }
function showTip(el) {
  const t = document.getElementById("vs-tip"); if (!t) return;
  t.textContent = el.dataset.tip; t.hidden = false;
  const r = el.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
  let y = r.top - th - 8; if (y < 8) y = r.bottom + 8;
  t.style.left = clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8) + "px"; t.style.top = y + "px";
}
document.addEventListener("mouseover", (e) => { const el = e.target.closest && e.target.closest("#versus [data-tip]"); if (el) showTip(el); else hideTip(); });
document.addEventListener("focusin", (e) => { const el = e.target.closest && e.target.closest("#versus [data-tip]"); if (el) showTip(el); else hideTip(); });
document.addEventListener("focusout", hideTip);
window.addEventListener("scroll", hideTip, true);

