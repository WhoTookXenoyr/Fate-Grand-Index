/* ================= 0.28.0: one servant to a file and back =================
   Export on the SERVANTPAGE saves that one servant, with their uploaded pictures, as a small .json file
   (<name>.servant.json: a backup with kind "servant" and one entry). Import, the same button as for backups, adds it
   to any copy of the page: the offline file, another browser, or the website (where it syncs like anything else).
   Pictures get new IDs here, so nothing already here is touched. A servant whose ID is already on the list is added
   as a copy unless Replace is picked, and the import can be undone like any other. */
const SV1_KIND = "servant";
const SV1_PIC = /^img_[a-z0-9]+$/;
// one picture as a data: URL, from this browser's store or wherever it's shown from (an account's picture)
async function sv1Pic(id) {
  try { const b = typeof imgGet === "function" ? await imgGet(id) : null; if (b) return await blobToDataURL(b); } catch (e) {}
  try { const all = await imgStore.all(), v = all[id]; if (v) return typeof v === "string" ? v : await blobToDataURL(v); } catch (e) {}
  const u = S.urlCache[id]; if (!u) return null; if (/^data:image\//.test(u)) return u;
  try { return await blobToDataURL(await (await fetch(u)).blob()); } catch (e) { return null; }
}
async function exportServant(id) {
  const s = S.servants.find((x) => x.id === id); if (!s || !S.downloads) return;
  const images = {};
  for (const v of Object.values(s.art || {})) if (typeof v === "string" && SV1_PIC.test(v) && !images[v]) { const d = await sv1Pic(v); if (d) images[v] = d; }
  const data = JSON.stringify({app: "spirit-origin-list", version: 1, kind: SV1_KIND, exportedAt: new Date().toISOString(), appVersion: APP_VER, servants: [s], parties: [], guests: [], images: images});
  const name = String(s.name || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "servant";
  await S.downloads.save({filename: name + ".servant.json", data: data});
  const n = Object.keys(images).length;
  toast(s.name + " saved to your downloads" + (n ? " with " + plural(n, "picture") : "") + ". Add them anywhere with Import.");
}

/* ---------- Import: a .servant.json gets its own preview ---------- */
const sv1Ok = (d) => d && typeof d === "object" && d.kind === SV1_KIND && Array.isArray(d.servants) && d.servants.length === 1 && d.servants[0] && typeof d.servants[0] === "object" && String(d.servants[0].name || "").trim();
const readImport28 = readImport;
readImport = function (file) {
  const fr = new FileReader();
  fr.onload = () => {
    let d = null; try { d = JSON.parse(String(fr.result || "")); } catch (e) {}
    if (!sv1Ok(d)) { readImport28(file); return; }
    const s = d.servants[0], images = d.images && typeof d.images === "object" ? d.images : {};
    // (servants/parties/guests filled in so anything that reads a backup's preview finds what it expects)
    S.importData = {kind: SV1_KIND, s: s, images: images, servants: [s], parties: [], guests: [], changed: [], when: Date.parse(d.exportedAt) || 0,
      clash: S.servants.find((x) => x.id === s.id) || null, twin: S.servants.find((x) => x.id !== s.id && normName(x.name) === normName(s.name)) || null, mode: ""};
    renderChrome(); window.scrollTo({top: 0});
  };
  fr.readAsText(file);
};
function sv1NoticeHTML(d) {
  const s = d.s, r = clamp(Math.round(num(s.rarity) || 0), 0, 5), pics = Object.values(s.art || {}).filter((v) => typeof v === "string" && (d.images[v] || /^https?:\/\//.test(v))).length;
  const what = [s.custom ? "Custom servant" : s.wish ? "Guest" : "", [s.cls, r ? "★" + r : ""].filter(Boolean).join(" "), s.level ? "Lv " + s.level : "", pics ? plural(pics, "picture") : ""].filter(Boolean).join(" · ");
  const made = d.when ? " Exported " + dayStr(d.when) + "." : "";
  const c = d.clash;
  return `<p>Add <b>${esc(s.name)}</b> from this file? <span class="muted">${esc(what)}.</span>${made}${c
      ? ` <b>${esc(c.name === s.name ? "You already have this servant" : "This file's servant has the same ID as your " + c.name)}</b>${c.level ? " (Lv " + esc(c.level) + ")" : ""}: Add as a copy keeps both, Replace puts the file's version in its place.`
      : d.twin ? ` You already have a ${esc(d.twin.name)}; this adds a second one.` : ""} You can undo it afterwards.</p>
    ${c ? `<button class="btn primary sm" data-action="import-go" data-mode="copy">Add as a copy</button><button class="btn sm" data-action="import-go" data-mode="replace">Replace yours</button>`
      : `<button class="btn primary sm" data-action="import-go" data-mode="add">Add ${esc(s.name)}</button>`}<button class="btn ghost sm" data-action="import-cancel">Cancel</button>`;
}
const renderChrome28 = renderChrome;
renderChrome = function () {
  const r = renderChrome28.apply(this, arguments);
  const d = S.importData, n = document.getElementById("notice");
  if (d && d.kind === SV1_KIND && n) { n.hidden = false; n.innerHTML = sv1NoticeHTML(d); }
  return r;
};
// which button was pressed (the click itself runs the import)
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="import-go"][data-mode]');
  if (b && S.importData && S.importData.kind === SV1_KIND) S.importData.mode = b.dataset.mode;
}, true);
const runImport28 = runImport;
runImport = async function () {
  const d = S.importData; if (!d || d.kind !== SV1_KIND) return runImport28.apply(this, arguments);
  S.importData = null; S.importUndo = null; renderChrome();
  const snap = importSnap(); importBusy = true;
  try { await sv1Import(d, snap); } finally { importBusy = false; }
};
async function sv1Import(d, snap) {
  const src = d.s, replace = d.mode === "replace" && d.clash && S.servants.some((x) => x.id === d.clash.id);
  const okId = typeof src.id === "string" && /^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(src.id) && !/^\.\.?$/.test(src.id);
  const id = replace ? d.clash.id : okId && !S.servants.some((x) => x.id === src.id) ? src.id : slug(src.name, S.servants);
  // pictures: stored here under new IDs
  const map = {}; let imgs = 0;
  for (const [old, url] of Object.entries(d.images || {})) {
    if (!SV1_PIC.test(old) || typeof url !== "string" || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(url)) continue;
    try { const blob = dataUrlToBlob(url); const up = await (S.assets || localAssets).upload(blob); S.urlCache[up.id] = up.url; map[old] = up.id; imgs++; } catch (e) {}
  }
  const o = JSON.parse(JSON.stringify(src)); o.id = id;
  const art = {};
  Object.entries(o.art && typeof o.art === "object" ? o.art : {}).forEach(([k, v]) => {
    if (map[v]) art[k] = map[v];
    else if (typeof v === "string" && /^https:\/\//.test(v)) { art[k] = v; if (!S.urlCache[v]) S.urlCache[v] = v; }
  });
  o.art = art; if (o.artStage && !art[o.artStage]) o.artStage = Object.keys(art)[0] || null;
  o.order = replace ? d.clash.order : nextOrder(S.servants);
  if (!(await putDoc("servants", id, bodyOf(o)))) { if (imgs) Object.values(map).forEach((pid) => (S.assets || localAssets).delete(pid).catch(() => {})); return; }
  S.tab = "servants"; S.selected = id; S.lastSel = id; S.editing = null;
  importDone(snap, (replace ? "Replaced " : "Added ") + o.name + (imgs ? " with " + plural(imgs, "picture") : "") + ".");
  renderAll();
}

/* ---------- Export on the SERVANTPAGE ---------- */
const renderDossier28f = renderDossier;
renderDossier = function () {
  const r = renderDossier28f.apply(this, arguments);
  try {
    const d = document.getElementById("dossier"), s = d && !S.editing && !S.readOnly && S.downloads ? S.servants.find((x) => x.id === shownId()) : null;
    const acts = s && d.querySelector(".d-head-actions");
    if (acts && !acts.querySelector('[data-action="sv-export"]')) acts.insertAdjacentHTML("beforeend", `<button class="btn sm" data-action="sv-export" data-id="${esc(s.id)}" title="Save ${esc(s.name)} as a file you can add with Import in another browser, the offline file or the website">Export</button>`);
  } catch (e) {}
  return r;
};
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="sv-export"]'); if (!b) return;
  e.preventDefault(); exportServant(b.dataset.id);
});
