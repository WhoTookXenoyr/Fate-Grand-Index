/* ================= 0.25.0: servant icons =================
   The small picture next to a servant's name (the list, the servant page's heading, Parties, Ranking, Versus) used to
   be a crop of the stage picture. For a servant in NA's data it's now the game's own face for the stage marked Icon
   (Atlas Academy's frameless faces), and each servant can show another kind instead (`iconKind` on the servant):
   - face: the frameless face (the default)
   - frame: that face in a frame like the game's servant icons, with the class emblem
   - portrait: the square portrait (stages 1–3; stage 4 uses the third)
   - formation: the tall formation picture, its top half
   - art: the stage picture, as before
   - fan: a picture of your own (fan art), kept like the stage pictures (art.fan)
   Costumes use the costume's face, portrait and formation. A picture that doesn't load falls back to the next one
   (the stage picture, then the class emblem). On a phone, Modern's big picture tiles keep the stage picture. */
const ICON_KINDS = [["face", "Face"], ["frame", "Servant icon"], ["portrait", "Portrait"], ["formation", "Formation"], ["art", "Stage art"], ["fan", "Fan art"]];
const ATLAS_KIND = new Set(["face", "frame", "portrait", "formation"]);
// which stage or costume the icon follows, as [ascension 1–4, costume id or 0]
function iconStage(s, a) {
  const k = iconSlot(s) || "1";
  if (/^[1-4]$/.test(k)) return [Number(k), 0];
  const m = /^c(\d*)$/.exec(k), j = m ? (m[1] ? Number(m[1]) - 1 : 0) : 0;
  const cs = (a.cs || [])[j], id = cs && /CharaGraph\/(\d+)\//.exec(cs);
  return id ? [4, Number(id[1]), j] : [4, 0];
}
function atlasIcon(a, kind, st) {
  const [n, cid, j] = st, id = a.id;
  if (kind === "portrait") return cid ? `Servants/Status/${id}/status_servant_${11 + (j || 0)}.png` : `Servants/Status/${id}/status_servant_${Math.min(3, n)}.png`;
  if (kind === "formation") return cid ? `NarrowFigure/${cid}/${cid}@0.png` : n < 4 ? `NarrowFigure/${id}/${id}@${n - 1}.png` : `NarrowFigure/${id}/${id}_2@0.png`;
  return cid ? `Faces/f_${cid}0.png` : `Faces/f_${id}${n - 1}.png`;
}
const iconKindOf = (s) => ICON_KINDS.some((k) => k[0] === s.iconKind) ? s.iconKind : "face";
const iconHTML00 = iconHTML;
iconHTML = function (s, size) {
  if (!s) return iconHTML00(s, size);
  const kind = iconKindOf(s), sz = size ? " " + size : "";
  const k = iconSlot(s), stageArt = k ? artSrc(artOf(s, k)) : "";
  const tail = [stageArt, CLASS_LOGO[s.cls] || ""].filter(Boolean);
  if (kind === "fan" && artOf(s, "fan")) return `<img class="avatar k-fan${sz}" src="${esc(artSrc(artOf(s, "fan")))}" alt="" data-art="1" data-alt="${esc(tail.join("|"))}" loading="lazy">`;
  const a = ATLAS_KIND.has(kind) || kind === "fan" ? atlasOf(s) : null;
  if (!a || !a.id) return iconHTML00(s, size);
  const st = iconStage(s, a), useKind = kind === "fan" ? "face" : kind, face = aimg(atlasIcon(a, "face", st));
  const src = useKind === "frame" ? face : aimg(atlasIcon(a, useKind, st)), alts = (useKind === "face" || useKind === "frame" ? [] : [face]).concat(tail);
  const img = `<img class="${useKind === "frame" ? "avf-face" : "avatar k-" + useKind + sz}" src="${esc(src)}" alt="" data-alt="${esc(alts.join("|"))}" loading="lazy" decoding="async">`;
  if (useKind !== "frame") return img;
  const r = clamp(num(s.rarity) || a.r || 1, 1, 5);
  return `<span class="avatar k-frame r${r}${sz}" role="img" aria-label="${esc(s.name || a.n)}">${img}${CLASS_LOGO[a.c] ? `<img class="avf-cls" src="${CLASS_LOGO[a.c]}" alt="">` : ""}</span>`;
};
// a picture that doesn't load (offline, or not on NA's server yet): the next one
document.addEventListener("error", (e) => {
  const t = e.target; if (!t || t.tagName !== "IMG" || !t.dataset || !t.dataset.alt) return;
  const [nx, ...rest] = t.dataset.alt.split("|"); t.dataset.alt = rest.join("|");
  if (nx) { if (/^data:/.test(nx)) t.classList.add("logo"); t.src = nx; }
}, true);

// phone tiles (Modern): the big picture stays the stage picture (fan art when that's the icon; the 256-pixel
// portrait when there's no stage picture, sharper than the face blown up)
const rosterRowHTML25 = rosterRowHTML;
rosterRowHTML = function (s, sel) {
  const h = rosterRowHTML25(s, sel), k = iconSlot(s), kind = iconKindOf(s);
  if (kind === "art") return h;
  let src = kind === "fan" && artOf(s, "fan") ? artSrc(artOf(s, "fan")) : k ? artSrc(artOf(s, k)) : "";
  let alt = "";
  if (!src) { const a = atlasOf(s); if (a && a.id) { const st = iconStage(s, a); src = aimg(atlasIcon(a, "portrait", st)); alt = aimg(atlasIcon(a, "face", st)); } }
  if (!src) return h;
  const tile = `<img class="tile-art" src="${esc(src)}" alt=""${alt ? ` data-alt="${esc(alt)}"` : ` data-art="1"`} loading="lazy">`;
  if (/<span class="avatar k-frame/.test(h)) return h.replace(/(<span class="avatar k-frame[^>]*>[\s\S]*?<\/span>)/, "$1" + tile);
  return /<img class="avatar k-/.test(h) ? h.replace(/(<img class="avatar k-[^>]*>)/, "$1" + tile) : h;
};

/* ---------- the choice, on the servant page under the stages ---------- */
function iconPickHTML(s) {
  if (S.readOnly) return "";
  const a = atlasOf(s), kind = iconKindOf(s), st = a && a.id ? iconStage(s, a) : null, k = iconSlot(s);
  const opts = ICON_KINDS.filter(([key]) => ATLAS_KIND.has(key) ? !!st : key === "art" ? !!k : true);
  if (opts.length < 2 && !S.assets) return "";
  const prev = (key) => {
    if (key === "fan") return artOf(s, "fan") ? `<img src="${esc(artSrc(artOf(s, "fan")))}" alt="">` : `<i class="ick-plus" aria-hidden="true">+</i>`;
    if (key === "art") return `<img src="${esc(artSrc(artOf(s, k)))}" alt="">`;
    return `<img class="ick-${key}" src="${esc(aimg(atlasIcon(a, key === "frame" ? "face" : key, st)))}" alt="">`;
  };
  const fanBtn = (key, t) => !artOf(s, "fan") && S.assets
    ? `<label class="ick" title="Use a picture of your own (fan art) as ${esc(s.name)}'s icon">${prev(key)}<span>${t}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-icon-fan></label>`
    : artOf(s, "fan") ? `<button type="button" class="ick" data-action="icon-kind" data-k="fan" aria-pressed="${kind === "fan"}">${prev(key)}<span>${t}</span></button>` : "";
  return `<div class="ick-row" role="group" aria-label="Icon next to the name"><span class="ick-l">Icon</span>
    ${opts.map(([key, t]) => key === "fan" ? fanBtn(key, t) : `<button type="button" class="ick${key === "frame" ? " is-frame r" + clamp(num(s.rarity) || 1, 1, 5) : ""}" data-action="icon-kind" data-k="${key}" aria-pressed="${kind === key || (kind === "fan" && !artOf(s, "fan") && key === "face")}">${prev(key)}<span>${t}</span></button>`).join("")}
    ${artOf(s, "fan") && S.assets ? `<span class="ick-fan-acts"><label class="linkish">Change fan art<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-icon-fan></label> · <button type="button" class="linkish" data-action="icon-fan-del">Remove</button></span>` : ""}</div>`;
}
const artHTML25 = artHTML;
artHTML = function (s) {
  const h = artHTML25(s), pick = iconPickHTML(s);
  return pick ? h.replace(/(<div class="stage-list"[^>]*>[\s\S]*?<\/div>)/, "$1" + pick) : h;
};
function iconRedraw(s) { renderList(); renderDossier(); renderParties(); if (typeof renderRanking === "function") renderRanking(); scheduleWrite("servants", s); }
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="icon-kind"], [data-action="icon-fan-del"]'); if (!b) return;
  const s = S.servants.find((x) => x.id === shownId()); if (!s || S.readOnly) return;
  if (b.dataset.action === "icon-kind") {
    const k = b.dataset.k; if (k === "face") delete s.iconKind; else s.iconKind = k;
    iconRedraw(s);
    const nb = document.querySelector(`#dossier [data-action="icon-kind"][data-k="${k}"]`); if (nb) nb.focus({preventScroll: true});
    return;
  }
  const old = artOf(s, "fan"); if (!old) return;
  const art = Object.assign({}, s.art); delete art.fan; s.art = art; if (s.iconKind === "fan") delete s.iconKind;
  iconRedraw(s); toast("Fan art removed; the face is the icon again.");
  if (S.assets) { try { S.assets.delete(old); } catch (er) {} }
});
// fan art: kept like a stage picture (art.fan), and made the icon
document.addEventListener("change", async (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("input[data-icon-fan]")) return;
  const f = t.files && t.files[0], id = shownId(); t.value = ""; if (!f || !id) return;
  const s = S.servants.find((x) => x.id === id); if (!s) return;
  const stage = s.artStage, view = S.viewStage[id];
  await uploadArt(id, "fan", f);
  const cur = S.servants.find((x) => x.id === id); if (!cur || !artOf(cur, "fan")) return;
  // uploading puts the picture in front; the stage picture and the stage on show stay as they were
  cur.artStage = stage && artOf(cur, stage) ? stage : (slotsOf(cur).find((x) => artOf(cur, x.k)) || {}).k || null;
  if (view) S.viewStage[id] = view; else delete S.viewStage[id];
  cur.iconKind = "fan"; iconRedraw(cur); toast("Fan art saved: it's " + cur.name + "'s icon now.");
});
