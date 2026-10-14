import json, os, sys, re
sp = sys.argv[1]
src = open(f"{sp}/spirit-origin-list.html").read()

# ---- current data from the online page (incl. your edits) ----
data = {}
for col in ["servants", "parties", "guests"]:
    docs = []
    for fn in os.listdir(f"{sp}/live/{col}"):
        d = json.load(open(f"{sp}/live/{col}/{fn}")); d = dict(d); d["id"] = fn[:-5]; docs.append(d)
    docs.sort(key=lambda d: d.get("order", 1e9))
    data[col] = docs
for s in data["servants"]:
    if s["id"] == "oda-nobunaga" and s.get("level") == 90:
        s["hp"], s["atk"] = 11761, 12641
        s["notes"] = ("Wiki name: Demon King Nobunaga (5-star Avenger). Wiki: ATK 1,953/12,641, HP 1,724/11,761 (Lv1/Lv90); "
                      "Lv90 max values used. NP 300% (NP1) AoE (= Buster values) + Burn; OC extra dmg vs Divine 150-200%.")
seed_js = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")

def cut(text, start, end):
    i = text.index(start); j = text.index(end, i)
    return i, j

# ---- split head / body ----
style_end = src.index("</style>") + len("</style>")
head_part, body_part = src[:style_end], src[style_end:]
head_part = head_part.replace("<style>", "<style>\nhtml, body { margin: 0; }\n.save-note { margin: 0; font-size: 12.5px; color: var(--muted); }\n", 1)

# masthead: add the save note line
body_part = body_part.replace('  <p id="summary" class="summary" hidden></p>',
    '  <p id="save-note" class="save-note"></p>\n  <p id="summary" class="summary" hidden></p>', 1)

# ---- art helpers: images live in this browser ----
body_part = body_part.replace('const artOf = (s, k) => (s && s.art && typeof s.art[k] === "string" && s.art[k]) ? s.art[k] : null;',
    'const artOf = (s, k) => (s && s.art && typeof s.art[k] === "string" && s.art[k] && S.urlCache[s.art[k]]) ? s.art[k] : null;', 1)
body_part = body_part.replace('const artSrc = (id) => S.urlCache[id] || "/_blob/" + id;', 'const artSrc = (id) => S.urlCache[id] || "";', 1)
body_part = body_part.replace('toast("Image storage for this page is full. Remove some images, then try again.");',
    'toast("This browser\'s storage is full. Remove some images or export a backup, then try again.");', 1)

LOCAL = r'''
/* ---------- local storage (this file keeps everything in this browser) ---------- */
const SEED = __SEED__;
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

'''.replace("__SEED__", "__SEED_DATA__")

i, j = cut(body_part, "async function init() {", "/* ---------- ascension art ---------- */")
body_part = body_part[:i] + LOCAL + body_part[j:]

EXPORT = r'''async function exportBackup() {
  const ids = new Set();
  S.servants.forEach((s) => Object.values(s.art || {}).forEach((id) => { if (typeof id === "string") ids.add(id); }));
  const images = {};
  try { const all = await imgStore.all(); for (const id of ids) { const v = all[id]; if (v) images[id] = typeof v === "string" ? v : await blobToDataURL(v); } } catch (e) {}
  const data = JSON.stringify({app: "spirit-origin-list", version: 1, exportedAt: new Date().toISOString(), servants: S.servants, parties: S.parties, guests: S.guests, images: images, settings: {fonts: fontPrefs(), affinity: affOverrides(), tiers: tierOverrides()}}, null, 1);
  await localDownloads.save({filename: "spirit-origin-list-backup-" + new Date().toISOString().slice(0, 10) + ".json", data: data});
  try { localStorage.setItem(LS_KEY + ":lastBackup", new Date().toISOString()); } catch (e) {}
  renderBackupNote();
  toast("Backup saved to your downloads" + (Object.keys(images).length ? ", with " + Object.keys(images).length + " images." : "."));
}

function readImport(file) {
  const fr = new FileReader();
  fr.onload = () => {
    const text = String(fr.result || ""), isCsv = /\.csv$/i.test(file.name || "") || /^\uFEFF?[^{\[]/.test(text.trim());
    let parsed = null;
    if (!isCsv) { try { parsed = JSON.parse(text); } catch (e) { parsed = null; } }
    const ours = parsed && Array.isArray(parsed.servants) && (parsed.app === "spirit-origin-list" || parsed.servants.some((x) => x && typeof x === "object" && ("cls" in x || "skillInfo" in x || "npTable" in x)));
    if (!ours) {
      const pl = plannerFromText(text, file.name, isCsv ? null : parsed);
      if (pl) { S.importData = plannerPlan(pl); renderChrome(); window.scrollTo({top: 0}); return; }
      toast(isCsv ? "That spreadsheet needs a Name column (and ideally Level, NP Level and Skill 1–3)." : "Couldn't find any servants in that file. Use a backup from this page, a CSV with a Name column, or a planner's JSON export.");
      return;
    }
    try {
      const d = parsed;
      const arr = (k) => Array.isArray(d[k]) ? d[k].filter((x) => x && typeof x === "object" && x.name) : [];
      const data = {servants: arr("servants"), parties: arr("parties"), guests: arr("guests"), images: (d.images && typeof d.images === "object") ? d.images : {}, settings: (d.settings && typeof d.settings === "object") ? d.settings : null};
      if (!data.servants.length && !data.parties.length && !data.guests.length) { toast("That file has no servants, parties or guests in it."); return; }
      S.importData = data; renderChrome();
    } catch (e) { toast("That file isn't a backup from this page. Pick the .json file from Export backup."); }
  };
  fr.readAsText(file);
}

async function runImport() {
  const d = S.importData; S.importData = null; renderChrome();
  if (d && d.kind === "planner") { const n = await applyPlanner(d); toast("Imported " + n + " servant" + (n === 1 ? "" : "s") + " from " + d.source + "."); return; }
  let imgs = 0;
  for (const id of Object.keys(d.images || {})) {
    const url = d.images[id];
    if (typeof url !== "string" || !url.startsWith("data:image/") || !/^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(id)) continue;
    try { const blob = await (await fetch(url)).blob(); await imgStore.put(id, blob); S.urlCache[id] = URL.createObjectURL(blob); imgs++; } catch (e) {}
  }
  let n = 0;
  for (const col of COLS) {
    for (const item of d[col]) {
      const id = item.id && /^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(item.id) && !/^\.\.?$/.test(item.id) ? item.id : slug(item.name, S[col]);
      const o = Object.assign({}, item, {id: id});
      if (col === "servants" && o.art && typeof o.art === "object") { const art = {}; Object.keys(o.art).forEach((k) => { if (S.urlCache[o.art[k]]) art[k] = o.art[k]; }); o.art = art; }
      if (num(o.order) == null) o.order = nextOrder(S[col]) + n;
      if (await putDoc(col, id, bodyOf(o))) n++; else return;
    }
  }
  if (d.settings && d.settings.fonts && typeof d.settings.fonts === "object") {
    const cur = fontPrefs(), nf = d.settings.fonts;
    FONT_ROLES.forEach((x) => { if (validFamily(nf[x.k])) cur[x.k] = nf[x.k]; });
    if (Array.isArray(nf.added)) cur.added = Array.from(new Set(nf.added.filter(validFamily).concat(cur.added))).slice(0, 30);
    setFontPrefs(cur); initFonts();
  }
  if (d.settings && d.settings.affinity && typeof d.settings.affinity === "object") { setAffOverrides(d.settings.affinity); renderVersus(); }
  if (d.settings && d.settings.tiers && typeof d.settings.tiers === "object") { setTierOverrides(Object.assign({}, tierOverrides(), d.settings.tiers)); renderRanking(); }
  toast("Imported " + n + " entries" + (imgs ? " and " + imgs + " images." : "."));
}

'''
i, j = cut(body_part, "async function exportBackup() {", 'document.addEventListener("click"')
body_part = body_part[:i] + EXPORT + body_part[j:]

doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       + head_part + '\n</head>\n<body>\n' + body_part.strip() + '\n</body>\n</html>\n')
os.makedirs(f"{sp}/out", exist_ok=True)
assert doc.count("__SEED_DATA__") == 1
# the file you share starts empty; a copy with the sample roster is kept here for the tests
EMPTY = json.dumps({"servants": [], "parties": [], "guests": []})
out = f"{sp}/out/Fate_Grand_Index.html"
open(out, "w").write(doc.replace("__SEED_DATA__", EMPTY))
open(f"{sp}/_seeded.html", "w").write(doc.replace("__SEED_DATA__", seed_js))
print("written", out, len(doc), "bytes (empty) + _seeded.html for tests")
