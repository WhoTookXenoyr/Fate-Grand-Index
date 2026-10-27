/* ================= 0.25.0: servant icons =================
   The small picture next to a servant's name (the list, the servant page's heading, Parties, Ranking, Versus) used to
   be a crop of the stage picture. For a servant in NA's data it's now the game's own picture for the stage or costume
   marked Icon (Atlas Academy's), in the kind picked on the servant page (`iconKind` on the servant):
   - face: the frameless face (the default)
   - frame: that face in a frame like the game's servant icons, with the class emblem
   - portrait: the square portrait (stages 1–3; stage 4 uses the third)
   - formation: the tall formation picture, its top half
   - art: the stage picture, as before
   Fan art (a picture of your own) has its own tile after the costumes (art.fan, 00-core.js's FAN_SLOT); marked Icon,
   it is the icon. A picture that doesn't load falls back to the next one (the stage picture, then the class emblem).
   On a phone, Modern's big picture tiles keep the stage picture.

   Which NA costume a costume slot is (cosMap): the one you picked under the costume's name (`artCos` on the servant,
   {slot: costume id, or 0 for one NA doesn't have}); else the one a picture from NA's data comes from; else the one
   whose NA name is closest to the slot's name (NA's names are in the data as "csn"; "Swimsuit of Perpetual Summer
   Ver.02" finds "Swimsuit of Everlasting Summer Ver. 02", and a version number has to agree); a named slot that
   matches none isn't on NA, so its own picture is the icon; an unnamed slot takes the next costume not yet matched.
   (Until now the second costume slot always meant NA's second costume, so the icons were often another costume's,
   or Stage 4's.) */
const ICON_KINDS = [["face", "Face"], ["frame", "Servant icon"], ["portrait", "Portrait"], ["formation", "Formation"], ["art", "Stage art"]];
const ATLAS_KIND = new Set(["face", "frame", "portrait", "formation"]);
const COS_NUM = {first: "1", "1st": "1", second: "2", "2nd": "2", third: "3", "3rd": "3", fourth: "4", "4th": "4", final: "4"};
const COS_STOP = new Set(["simple", "spiritron", "dress", "the", "of", "a", "an", "and", "ver", "version", "ascension", "costume"]);
const COS_MIN = 0.3;
function cosToks(t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/(\d+)/g, " $1 ").split(/[^a-z0-9]+/)
    .filter(Boolean).map((w) => COS_NUM[w] || (/^\d+$/.test(w) ? String(Number(w)) : w)).filter((w) => !COS_STOP.has(w));
}
function cosScore(A, B) {
  if (!A.length || !B.length) return 0;
  const a = new Set(A), b = new Set(B), nums = (x) => [...x].filter((w) => /^\d+$/.test(w)).sort().join(",");
  let both = 0; a.forEach((w) => { if (b.has(w)) both++; });
  const sc = both / new Set([...a, ...b]).size;
  return nums(a) === nums(b) ? sc : sc * 0.35;
}
const cosIdOf = (p) => { const m = /CharaGraph\/(\d+)\//.exec(String(p || "")); return m ? Number(m[1]) : 0; };
// {costume slot: index into the NA record's costumes, or -1}
function cosMap(s, a) {
  const keys = slotsOf(s).filter((x) => /^c\d*$/.test(x.k)).map((x) => x.k), out = {}, used = new Set();
  const cs = (a && a.cs) || [], names = (a && a.csn) || [], ids = cs.map(cosIdOf), pick = s.artCos || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(out, k), take = (k, j) => { out[k] = j; if (j >= 0) used.add(j); };
  if (!cs.length) { keys.forEach((k) => { out[k] = -1; }); return out; }
  keys.forEach((k) => { if (Object.prototype.hasOwnProperty.call(pick, k)) { const j = num(pick[k]) ? ids.indexOf(num(pick[k])) : -1; take(k, j); } });
  keys.forEach((k) => { if (has(k)) return; const j = ids.indexOf(cosIdOf((s.art || {})[k])); if (j >= 0 && !used.has(j)) take(k, j); });
  const pairs = [];
  keys.forEach((k) => { if (has(k) || !costumeName(s, k)) return; const A = cosToks(costumeName(s, k)); names.forEach((n, j) => { const sc = cosScore(A, cosToks(n)); if (sc >= COS_MIN) pairs.push([sc, k, j]); }); });
  pairs.sort((x, y) => y[0] - x[0]).forEach(([, k, j]) => { if (!has(k) && !used.has(j)) take(k, j); });
  keys.forEach((k) => { if (!has(k) && costumeName(s, k)) out[k] = -1; });
  keys.forEach((k) => { if (!has(k)) take(k, cs.findIndex((p, i) => !used.has(i))); });
  return out;
}
// an icon picked as fan art before it had a tile of its own (0.25.0's first build) is still the fan art
const iconSlot00 = iconSlot;
iconSlot = function (s) { return s && s.iconKind === "fan" && artOf(s, "fan") ? "fan" : iconSlot00(s); };
// which stage or costume the icon follows, as [ascension 1–4, costume id or 0, costume index], or null when the game
// has no picture for it (fan art, or a costume NA doesn't have)
function iconStage(s, a) {
  const k = iconSlot(s) || "1";
  if (/^[1-4]$/.test(k)) return [Number(k), 0];
  if (!/^c\d*$/.test(k)) return null;
  const j = cosMap(s, a)[k], id = j >= 0 ? cosIdOf((a.cs || [])[j]) : 0;
  return id ? [4, id, j] : null;
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
  const kind = iconKindOf(s), sz = size ? " " + size : "", k = iconSlot(s);
  if (k === "fan") return `<img class="avatar k-fan${sz}" src="${esc(artSrc(artOf(s, "fan")))}" alt="" data-art="1" loading="lazy">`;
  const a = ATLAS_KIND.has(kind) ? atlasOf(s) : null, st = a && a.id ? iconStage(s, a) : null;
  if (!st) return iconHTML00(s, size);
  const stageArt = k ? artSrc(artOf(s, k)) : "", tail = [stageArt, CLASS_LOGO[s.cls] || ""].filter(Boolean);
  const face = aimg(atlasIcon(a, "face", st)), src = kind === "frame" ? face : aimg(atlasIcon(a, kind, st));
  const alts = (kind === "face" || kind === "frame" ? [] : [face]).concat(tail);
  const img = `<img class="${kind === "frame" ? "avf-face" : "avatar k-" + kind + sz}" src="${esc(src)}" alt="" data-alt="${esc(alts.join("|"))}" loading="lazy" decoding="async">`;
  if (kind !== "frame") return img;
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
  if (kind === "art" && k !== "fan") return h;
  let src = k ? artSrc(artOf(s, k)) : "", alt = "";
  if (!src) { const a = atlasOf(s), st = a && a.id ? iconStage(s, a) : null; if (st) { src = aimg(atlasIcon(a, "portrait", st)); alt = aimg(atlasIcon(a, "face", st)); } }
  if (!src) return h;
  const tile = `<img class="tile-art" src="${esc(src)}" alt=""${alt ? ` data-alt="${esc(alt)}"` : ` data-art="1"`} loading="lazy">`;
  if (/<span class="avatar k-frame/.test(h)) return h.replace(/(<span class="avatar k-frame[^>]*>[\s\S]*?<\/span>)/, "$1" + tile);
  return /<img class="avatar k-/.test(h) ? h.replace(/(<img class="avatar k-[^>]*>)/, "$1" + tile) : h;
};

/* ---------- the choice, on the servant page under the stages ---------- */
function iconPickHTML(s) {
  if (S.readOnly) return "";
  const k = iconSlot(s), head = `<div class="ick-row" role="group" aria-label="Icon next to the name"><span class="ick-l">Icon</span>`;
  if (k === "fan") return head + `<p class="ick-note">Your fan art is the icon. Click a stage or costume to use one of the game's pictures instead.</p></div>`;
  const a = atlasOf(s), kind = iconKindOf(s), st = a && a.id ? iconStage(s, a) : null;
  const note = !st && a && a.id && k && /^c\d*$/.test(k) ? `<p class="ick-note">${(a.cs || []).length ? "This costume's own picture is the icon: it isn't one of NA's costumes." : esc(s.name) + " has no costumes in NA's data, so this costume's own picture is the icon."}</p>` : "";
  const opts = ICON_KINDS.filter(([key]) => ATLAS_KIND.has(key) ? !!st : !!k);
  if (opts.length < 2) return note ? head + note + "</div>" : "";
  const prev = (key) => key === "art" ? `<img src="${esc(artSrc(artOf(s, k)))}" alt="">` : `<img class="ick-${key}" src="${esc(aimg(atlasIcon(a, key === "frame" ? "face" : key, st)))}" alt="">`;
  return head + opts.map(([key, t]) => `<button type="button" class="ick${key === "frame" ? " is-frame r" + clamp(num(s.rarity) || 1, 1, 5) : ""}" data-action="icon-kind" data-k="${key}" aria-pressed="${kind === key}">${prev(key)}<span>${t}</span></button>`).join("") + note + "</div>";
}
// under a costume's name: which of NA's costumes it is
function cosPickHTML(s, k) {
  const a = atlasOf(s); if (!a || !a.id || !(a.cs || []).length || S.readOnly || !S.assets) return "";
  const j = cosMap(s, a)[k], mine = !!s.artCos && Object.prototype.hasOwnProperty.call(s.artCos, k), names = a.csn || [];
  const how = mine ? `You picked it. <button type="button" class="linkish" data-action="cos-auto" data-k="${esc(k)}">Match by itself again</button>` : j >= 0 ? "Found by itself from the costume's name. Pick another if it's wrong." : "None of these matches the costume's name. Pick it if NA has it.";
  const btn = (i) => { const id = cosIdOf(a.cs[i]), n = names[i] || "Costume " + (i + 1);
    return `<button type="button" class="ick cpk" data-action="cos-pick" data-k="${esc(k)}" data-cos="${id}" aria-pressed="${j === i}" title="${esc(n)}"><img src="${esc(aimg("Faces/f_" + id + "0.png"))}" alt="" loading="lazy"><span>${esc(n.replace(/^(Simple|Glasses) Spiritron Dress: /, ""))}</span></button>`; };
  return `<div class="ick-row cpk-row" role="group" aria-label="Which of NA's costumes this is"><span class="ick-l">In the game</span>
    ${a.cs.map((p, i) => btn(i)).join("")}<button type="button" class="ick cpk" data-action="cos-pick" data-k="${esc(k)}" data-cos="0" aria-pressed="${j < 0}"><i class="ick-plus" aria-hidden="true">–</i><span>Not on NA</span></button>
    <p class="ick-note">${how}</p></div>`;
}
const artHTML25 = artHTML;
artHTML = function (s) {
  let h = artHTML25(s); const pick = iconPickHTML(s), slot = viewSlot(s), cos = /^c\d*$/.test(slot) ? cosPickHTML(s, slot) : "";
  if (cos) h = h.replace(/(<div class="cos-name">[\s\S]*?<\/div>)/, "$1" + cos);
  return pick ? h.replace(/(<div class="stage-list"[^>]*>[\s\S]*?<\/div>)/, "$1" + pick) : h;
};
function iconRedraw(s) { renderList(); renderDossier(); renderParties(); if (typeof renderRanking === "function") renderRanking(); scheduleWrite("servants", s); }
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="icon-kind"], [data-action="cos-pick"], [data-action="cos-auto"]'); if (!b) return;
  const s = S.servants.find((x) => x.id === shownId()); if (!s || S.readOnly) return;
  const focus = (sel) => { const nb = document.querySelector(sel); if (nb) nb.focus({preventScroll: true}); };
  if (b.dataset.action === "icon-kind") {
    const k = b.dataset.k; if (k === "face") delete s.iconKind; else s.iconKind = k;
    iconRedraw(s); focus(`#dossier [data-action="icon-kind"][data-k="${k}"]`); return;
  }
  const k = b.dataset.k, was = s.artCos ? Object.assign({}, s.artCos) : null;
  const put = (v) => { if (v && Object.keys(v).length) s.artCos = v; else delete s.artCos; };
  if (b.dataset.action === "cos-auto") { const v = Object.assign({}, s.artCos); delete v[k]; put(v); iconRedraw(s); toast("It's matched by itself again."); return; }
  const id = num(b.dataset.cos) || 0, a = atlasOf(s), i = a ? (a.cs || []).map(cosIdOf).indexOf(id) : -1;
  put(Object.assign({}, s.artCos, {[k]: id})); iconRedraw(s); focus(`#dossier [data-action="cos-pick"][data-k="${k}"][data-cos="${id}"]`);
  toastAction(slotLabel(s, k) + (id ? " is " + ((a.csn || [])[i] || "that costume") + " in the game now." : " is a costume NA doesn't have now."), "Undo", () => { put(was); iconRedraw(s); });
});
// clicking a stage or costume makes it the icon; an icon left on fan art by the first 0.25.0 build lets go too
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="stage"]'); if (!b) return;
  const s = S.servants.find((x) => x.id === shownId()); if (!s || S.readOnly || s.iconKind !== "fan") return;
  delete s.iconKind; if (b.dataset.slot === "fan" && artOf(s, "fan")) s.artStage = "fan"; scheduleWrite("servants", s);
}, true);
