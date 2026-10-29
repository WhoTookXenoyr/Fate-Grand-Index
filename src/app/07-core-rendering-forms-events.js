/* ---------- rendering ---------- */
function renderAll() {
  renderChrome(); renderSummary(); renderList();
  if (!S.editing) renderDossier();
  if (!S.partyEdit) renderParties();
  if (!S.guestEdit) renderGuests();
  renderRanking();
  renderVersus();
  renderDna();
  fillTraitFilter();
}

function renderChrome() {
  const ok = S.dbState === "ok";
  const canEdit = ok && !S.readOnly;
  document.querySelectorAll(".edit-only").forEach((b) => { b.hidden = !canEdit; });
  $("#export-wrap").hidden = !(ok && S.downloads && S.loaded.servants);
  $("#lbl-import").hidden = !canEdit;
  TABS.forEach((t) => {
    $("#view-" + t).hidden = S.tab !== t;
    $("#tab-" + t).setAttribute("aria-selected", String(S.tab === t));
  });
  const n = $("#notice");
  if (S.importData && S.importData.kind === "planner") {
    const d = S.importData, all = d.updates.map((u) => u.name + " (update)").concat(d.adds.map((a) => a.name + (a.wish ? " (new, Guest)" : " (new)")));
    n.hidden = false;
    n.innerHTML = `<p>Import ${all.length} servant${all.length === 1 ? "" : "s"} from ${esc(d.source)}? ${d.updates.length} already in your roster get the values the file has (level, NP, skills and so on); ${d.adds.length} are added as new.${d.skipped ? " " + d.skipped + " rows without a name are skipped." : ""} Servants are matched by name.</p>
      <button class="btn primary sm" data-action="import-go">Import</button><button class="btn ghost sm" data-action="import-cancel">Cancel</button>
      <details><summary>See the list</summary><ul>${all.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`;
  } else if (S.importData) {
    const d = S.importData, ch = d.changed || [], made = d.when ? " (made " + dayStr(d.when) + ")" : "";
    n.hidden = false;
    n.innerHTML = `<p>Import ${d.servants.length} servants, ${d.parties.length} parties and ${d.guests.length} guests from this backup${made}? Entries with the same ID are replaced; everything else stays.${ch.length
        ? ` <b>${plural(ch.length, "entry", "entries")} already on your list ${ch.length === 1 ? "gets" : "get"} the backup's values instead.</b>` : ""}${d.older && ch.length
        ? ` This backup is older than your list's last change (${dayStr(d.saved)}), so newer progress on ${ch.length === 1 ? "it" : "those"} would be replaced.` : ""} You can undo the import afterwards.</p>
      <button class="btn primary sm" data-action="import-go">Import</button><button class="btn ghost sm" data-action="import-cancel">Cancel</button>${ch.length
        ? `<details><summary>See what changes</summary><ul>${ch.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}`;
  } else if (S.importUndo) {
    const u = S.importUndo;
    n.hidden = false;
    n.innerHTML = `<p>${esc(u.msg)} Undo puts your list back the way it was before this import${u.later ? ", along with anything you changed after it" : ""}.</p>
      <button class="btn primary sm" data-action="import-undo">Undo import</button><button class="btn ghost sm" data-action="import-keep">Keep it</button>`;
  } else if (S.dbState === "missing") {
    n.hidden = false;
    n.innerHTML = `<p>Your roster is saved with this page on claude.ai. Open the page from its claude.ai link while signed in to load and edit it.</p>`;
  } else if (S.dbState === "revoked") {
    n.hidden = false;
    n.innerHTML = `<p>This view lost access to the roster. Reload the page to try again.</p>`;
  } else if (S.readOnly && ok) {
    n.hidden = false;
    n.innerHTML = `<p>You can view this roster, but only its owner can change it.</p>`;
  } else { n.hidden = true; n.innerHTML = ""; }
}

function renderSummary() {
  const el = $("#summary");
  const ss = owned(), nw = wished().length;
  if (S.dbState !== "ok" || !S.loaded.servants || !S.servants.length) { el.hidden = true; el.innerHTML = ""; return; }
  const lv = ss.map((s) => num(s.level)).filter((v) => v != null);
  const avg = lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 0;
  const grailed = ss.filter((s) => CAPS[s.rarity] && num(s.level) > CAPS[s.rarity]).length;
  const prog = ss.length ? ss.reduce((a, s) => a + skillTotal(s), 0) / (ss.length * 30) : 0;
  const cards = CARDS.map((c) => `<span class="sum-card">${CARD_IMG[c] ? `<img class="seg-card" src="${CARD_IMG[c]}" alt="">` : `<i class="dot ${cardCls(c)}"></i>`}${c} <b>${ss.filter((s) => s.npCard === c).length}</b></span>`).join("");
  el.hidden = false;
  el.innerHTML = `<span><b>${ss.length}</b> servants</span><span>average level <b>${avg.toFixed(1)}</b></span><span><b>${grailed}</b> grailed</span><span>skills at <b>${Math.round(prog * 100)}%</b> of max</span>${cards}${nw ? `<span><b>${nw}</b> in Guests</span>` : ""}`;
}

function fillClassFilter() {
  $("#f-class").insertAdjacentHTML("beforeend", CLASSES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join(""));
  document.querySelectorAll("img[data-card-img]").forEach((im) => { im.src = CARD_IMG[im.dataset.cardImg] || ""; });
}

function filtered(src) {
  let arr = (src || owned()).slice();
  const q = S.q.trim().toLowerCase();
  if (q) arr = arr.filter((s) => [s.name, s.npName, s.role, s.cls, s.notes, s.party, s.mates, passivesOf(s).map((x) => x.name).join(" "), tagsOf(s).map(tagShort).join(" ")].some((v) => String(v || "").toLowerCase().includes(q)));
  if (S.trait) arr = arr.filter((s) => tagsOf(s).includes(S.trait));
  if (S.cls) arr = arr.filter((s) => s.cls === S.cls);
  if (S.card) arr = arr.filter((s) => s.npCard === S.card);
  const by = {
    name: (a, b) => String(a.name).localeCompare(String(b.name)),
    level: (a, b) => (num(b.level) || 0) - (num(a.level) || 0),
    atk: (a, b) => (total(b, "atk") || 0) - (total(a, "atk") || 0),
    hp: (a, b) => (total(b, "hp") || 0) - (total(a, "hp") || 0),
    skills: (a, b) => skillTotal(b) - skillTotal(a)
  };
  if (by[S.sort]) arr.sort(by[S.sort]);
  return arr;
}

function shownId() {
  if (S.selected) return S.selected;
  if (isWide() && S.editing !== "new") { const f = filtered(); return f.length ? f[0].id : null; }
  return null;
}

function cardLetter(c) { if (CARDS.includes(c) && CARD_IMG[c]) return `<img class="card-mini" src="${CARD_IMG[c]}" alt="${esc(c)} NP" title="${esc(c)} NP">`; return CARDS.includes(c) ? `<span class="card-letter ${cardCls(c)}" title="${esc(c)} NP">${c[0]}</span>` : `<span class="card-letter" title="NP card not set">?</span>`; }
function cardChip(c) { return CARDS.includes(c) ? `<span class="card-chip ${cardCls(c)}"><i class="dot ${cardCls(c)}"></i>${esc(c)}</span>` : `<span class="tag">Card not set</span>`; }

const owned = () => S.servants.filter((s) => !s.wish);
const wished = () => S.servants.filter((s) => s.wish);
function rosterRowHTML(s, sel) {
  const st = levelStatus(s);
  const pips = [0, 1, 2].map((i) => { const v = (s.skills || [])[i]; return typeof v === "number" ? `<span class="pip${v === 10 ? " max" : ""}${skTierOf(s, i) ? " t-" + skTierOf(s, i) : ""}" style="--sk-p:${v / 10}">${v}</span>` : `<span class="pip locked" title="Locked">–</span>`; }).join("");
  return `<button class="row${sel === s.id ? " is-sel" : ""}${S.justSummoned === s.id ? " fresh" : ""}${grTier(s)}" data-action="select" data-id="${esc(s.id)}" aria-pressed="${sel === s.id}">
      ${grTier(s) ? grFX : ""}${iconHTML(s, "")}
      <span class="row-main"><span class="row-name">${esc(s.name)}</span><span class="row-meta">${esc(s.cls || "No class")}<span class="row-r"> · <span class="stars" aria-label="${num(s.rarity) || 0} stars">${"★".repeat(clamp(num(s.rarity) || 0, 0, 5))}</span></span>${s.npLevel ? " · NP" + esc(s.npLevel) : ""}</span></span>
      <span class="row-side"><span class="row-lv${st && st.kind === "grail" ? " has-gr" : ""}">Lv ${esc(s.level ?? "—")}${st && st.kind === "grail" ? `<em>+${num(s.level) - CAPS[s.rarity]}<small> · ${plural(st.grails || 0, "grail")}</small></em>` : ""}</span><span class="pips" aria-label="Skill levels">${pips}</span>${cardLetter(s.npCard)}</span>
    </button>`;
}
function wishListHTML(sel) {
  const all = wished(), list = filtered(all);
  const head = `<div class="wish-head"><h2>Guests <small>${all.length}</small></h2><span class="wish-tools">${all.length ? `<button class="btn ghost sm" data-action="tab" data-tab="summon">Summoning</button>` : ""}${S.readOnly ? "" : `<button class="btn sm" data-action="add-wish">+ Add guest</button>`}</span></div>`;
  if (!all.length) return `<section class="wish" aria-label="Guests">${head}<p class="wish-empty">The supports you borrow from friends, and the servants you hope to summon. Fill them in like any servant, stage pictures included, then summon them on the Summoning page when one joins you.</p></section>`;
  const rows = list.length ? list.map((s) => `<div class="wish-row">
      <button class="row wish-pick${sel === s.id ? " is-sel" : ""}" data-action="select" data-id="${esc(s.id)}" aria-pressed="${sel === s.id}">${iconHTML(s, "")}<span class="row-main"><span class="row-name">${esc(s.name)}</span><span class="row-meta">${esc(s.cls || "No class")} · <span class="stars" aria-label="${num(s.rarity) || 0} stars">${"★".repeat(clamp(num(s.rarity) || 0, 0, 5))}</span></span></span></button>
    </div>`).join("") : `<p class="wish-empty">No Guests match these filters.</p>`;
  return `<section class="wish" aria-label="Guests">${head}<div class="wish-list">${rows}</div></section>`;
}
function renderList() {
  const el = $("#list");
  if (S.dbState === "missing" || S.dbState === "revoked") { el.innerHTML = ""; return; }
  if (S.dbState !== "ok" || !S.loaded.servants) { el.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>`; return; }
  if (!S.servants.length) {
    el.innerHTML = `<div class="list-note"><h2>No servants yet</h2><p>Add each servant you own with their level, NP level and skill levels. Their stats, skills and team notes show up here.</p>${S.readOnly ? "" : `<button class="btn primary" data-action="add-servant">Add your first servant</button>`}</div>` + wishListHTML(null);
    return;
  }
  const arr = filtered(), sel = shownId();
  let html;
  if (!owned().length) html = `<div class="list-note"><h2>No servants summoned yet</h2><p>Your Guests are below. Press Summon on a servant when they join you.</p>${S.readOnly ? "" : `<button class="btn primary" data-action="add-servant">Add a servant</button>`}</div>`;
  else if (!arr.length) html = `<div class="list-note"><p>No servants match these filters.</p><button class="btn sm" data-action="clear-filters">Clear filters</button></div>`;
  else html = arr.map((s) => rosterRowHTML(s, sel)).join("");
  el.innerHTML = traitBannerHTML() + html + wishListHTML(sel);
}

/* ---------- summoning: a circle, three rings of light, a pillar, then the Saint Graph card turns over ---------- */
function summonTier(r) { return r >= 5 ? "gold5" : r === 4 ? "gold" : r === 3 ? "silver" : "bronze"; }
const SUMMON_COL = {gold5: [255, 214, 120], gold: [255, 206, 110], silver: [214, 226, 245], bronze: [222, 160, 110]};
function playSummon(s) {
  return new Promise((resolve) => {
    const ov = document.getElementById("summon"); if (!ov) { resolve(); return; }
    const r = clamp(num(s.rarity) || 0, 0, 5), tier = summonTier(r), k = iconSlot(s), art = k ? artSrc(artOf(s, k)) : "", logo = CLASS_LOGO[s.cls] || "";
    ov.innerHTML = `<canvas class="sm-cv" aria-hidden="true"></canvas>
      <div class="sm-stage">
        <div class="sm-card" aria-hidden="true"><div class="sm-spin">
          <div class="sm-face sm-back">${logo ? `<img src="${logo}" alt="">` : `<span class="sm-q">?</span>`}</div>
          <div class="sm-face sm-front">${art ? `<img class="sm-art" src="${esc(art)}" alt="">` : (CLASS_MARK[s.cls] ? `<img class="sm-art mark" src="${CLASS_MARK[s.cls]}" alt="">` : "")}
            <div class="sm-plate">${logo ? `<img src="${logo}" alt="">` : ""}<span class="sm-stars">${"★".repeat(r)}</span></div></div>
        </div></div>
        <div class="sm-info" role="status" aria-live="polite"><p class="sm-kicker">Summoned</p><h2>${esc(s.name)}</h2><p class="sm-sub">${esc(s.cls || "")}${r ? " · " + "★".repeat(r) : ""}</p><button type="button" class="btn primary sm-done">Continue</button></div>
      </div>
      <button type="button" class="btn ghost sm sm-skip">Skip</button>`;
    ov.dataset.tier = tier; ov.className = "summon"; ov.hidden = false;
    const shell = document.querySelector(".shell"); if (shell) shell.inert = true;
    const cv = ov.querySelector(".sm-cv"), cx = cv.getContext("2d"), col = SUMMON_COL[tier], t0 = performance.now(), parts = [];
    let raf = 0, done = false, ended = false; const timers = [], still = RM.matches;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const size = () => { const d = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); };
    size(); window.addEventListener("resize", size);
    for (let i = 0; i < 140; i++) parts.push({a: rnd(0, 6.283), d: rnd(0.4, 1.4), s: rnd(0.4, 1), r: rnd(0.8, 2.4), ph: rnd(0, 6.3)});
    const sparks = [];
    const frame = (now) => {
      const t = (now - t0) / 1000, w = innerWidth, h = innerHeight, cxp = w / 2, cy = h * 0.66, R = Math.min(w, h) * 0.36, sq = 0.34;
      cx.clearRect(0, 0, w, h);
      const bg = cx.createRadialGradient(cxp, cy, 0, cxp, cy, Math.max(w, h)); bg.addColorStop(0, "rgba(14,26,58,0.96)"); bg.addColorStop(1, "rgba(2,4,12,0.98)"); cx.fillStyle = bg; cx.fillRect(0, 0, w, h);
      const spin = t < 1.2 ? t * 0.5 : 0.6 + (t - 1.2) * (t < 2.5 ? 2.4 : 0.8);
      const draw = Math.min(1, t / 1.0), glow = t < 2.4 ? 1 : Math.max(0.35, 1 - (t - 2.4) * 0.4);
      const CY = [140, 220, 255];
      // the summoning circle on the floor
      cx.save(); cx.translate(cxp, cy); cx.scale(1, sq); cx.shadowBlur = 18; cx.shadowColor = rgba(CY, 0.9);
      cx.strokeStyle = rgba(CY, 0.85 * glow); cx.lineWidth = 3;
      cx.beginPath(); cx.arc(0, 0, R, spin, spin + draw * 6.283); cx.stroke();
      cx.lineWidth = 1.6; cx.beginPath(); cx.arc(0, 0, R * 0.88, -spin, -spin + draw * 6.283); cx.stroke();
      cx.beginPath(); cx.arc(0, 0, R * 0.52, spin * 1.5, spin * 1.5 + draw * 6.283); cx.stroke();
      if (draw > 0.3) {
        cx.rotate(spin); cx.globalAlpha = Math.min(1, (draw - 0.3) / 0.5) * glow;
        for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; cx.beginPath(); cx.moveTo(Math.cos(a) * R * 0.89, Math.sin(a) * R * 0.89); cx.lineTo(Math.cos(a) * R * (i % 4 ? 0.95 : 0.99), Math.sin(a) * R * (i % 4 ? 0.95 : 0.99)); cx.stroke(); }
        for (let tri = 0; tri < 2; tri++) { cx.beginPath(); for (let i = 0; i < 3; i++) { const a = tri * Math.PI / 3 + i * 2.094 - Math.PI / 2; cx.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86); } cx.closePath(); cx.stroke(); }
        cx.globalAlpha = 1;
      }
      cx.restore();
      // energy gathering
      if (t > 0.6 && t < 2.6) for (const q of parts) {
        const f = Math.min(1, Math.max(0, (t - 0.6) / 1.9)), d = q.d * (1 - f * q.s), a = q.a + t * 1.6 * q.s;
        const x = cxp + Math.cos(a) * d * R, y = cy - (1 - d) * R * 0.5 + Math.sin(a) * d * R * sq;
        cx.fillStyle = rgba(t > 1.4 ? col : CY, 0.5 + 0.4 * Math.sin(t * 6 + q.ph)); cx.beginPath(); cx.arc(x, y, q.r, 0, 6.283); cx.fill();
      }
      // three rings of light rising, turning and closing in
      if (t > 1.1 && t < 2.65) {
        const p = (t - 1.1) / 1.55;
        for (let i = 0; i < 3; i++) {
          const rr = R * (1.05 - 0.28 * i) * (1 - 0.85 * p), yy = cy - R * (0.15 + 0.55 * p) - i * R * 0.1 * (1 - p), tilt = Math.sin(t * 3 + i * 2.1) * 0.35;
          cx.save(); cx.translate(cxp, yy); cx.rotate(tilt); cx.scale(1, 0.3); cx.shadowBlur = 24; cx.shadowColor = rgba(col, 1);
          cx.strokeStyle = rgba(i === 1 ? [255, 255, 255] : col, 0.9); cx.lineWidth = 4 - i; cx.beginPath(); cx.arc(0, 0, Math.max(2, rr), 0, 6.283); cx.stroke(); cx.restore();
        }
      }
      // the pillar of light
      if (t > 2.4) {
        const p = Math.min(1, (t - 2.4) / 0.35), fade = t < 3.4 ? 1 : Math.max(0.45, 1 - (t - 3.4) * 0.5), pw = R * (0.25 + 0.4 * p);
        const pc = tier === "gold5" ? hslToRgb(((t * 0.3) % 1), 0.85, 0.72) : col;
        const g = cx.createLinearGradient(cxp - pw, 0, cxp + pw, 0); g.addColorStop(0, rgba(pc, 0)); g.addColorStop(0.5, rgba(pc, 0.75 * fade)); g.addColorStop(1, rgba(pc, 0));
        cx.fillStyle = g; cx.fillRect(cxp - pw, 0, pw * 2, cy + R * sq);
        const g2 = cx.createLinearGradient(cxp - pw * 0.25, 0, cxp + pw * 0.25, 0); g2.addColorStop(0, "rgba(255,255,255,0)"); g2.addColorStop(0.5, "rgba(255,255,255," + (0.9 * fade).toFixed(3) + ")"); g2.addColorStop(1, "rgba(255,255,255,0)");
        cx.fillStyle = g2; cx.fillRect(cxp - pw * 0.25, 0, pw * 0.5, cy + R * sq);
        if (sparks.length < 160 && t < 3.2) for (let i = 0; i < 6; i++) sparks.push({x: cxp + rnd(-pw, pw) * 0.5, y: cy - rnd(0, R), vx: rnd(-160, 160), vy: rnd(-260, -40), life: 1, c: tier === "gold5" ? hslToRgb(Math.random(), 0.9, 0.7) : col});
      }
      for (const q of sparks) { q.x += q.vx * 0.016; q.y += q.vy * 0.016; q.vy += 240 * 0.016; q.life -= 0.012; if (q.life > 0) { cx.fillStyle = rgba(q.c, q.life); cx.beginPath(); cx.arc(q.x, q.y, 2.2 * q.life + 0.5, 0, 6.283); cx.fill(); } }
      // flash
      if (t > 2.3 && t < 3.0) { const f = 1 - Math.abs(t - 2.5) / 0.5; cx.fillStyle = "rgba(255,255,255," + Math.max(0, f * 0.85).toFixed(3) + ")"; cx.fillRect(0, 0, w, h); }
      if (!done && !still) raf = requestAnimationFrame(frame);
    };
    const reveal = () => { if (!ov.classList.contains("card")) ov.classList.add("now"); ov.classList.add("card", "flip", "info"); const b = ov.querySelector(".sm-done"); if (b) b.focus(); ended = true; };
    const close = () => {
      if (done) return; done = true; cancelAnimationFrame(raf); timers.forEach(clearTimeout); window.removeEventListener("resize", size); document.removeEventListener("keydown", onKey, true);
      if (shell) shell.inert = false;
      ov.classList.add("out"); setTimeout(() => { ov.hidden = true; ov.innerHTML = ""; ov.className = "summon"; resolve(); }, 320);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (ended) close(); else reveal(); } };
    document.addEventListener("keydown", onKey, true);
    ov.querySelector(".sm-skip").addEventListener("click", () => { if (ended) close(); else reveal(); });
    ov.querySelector(".sm-done").addEventListener("click", close);
    ov.addEventListener("click", (e) => { if (ended && e.target === ov.querySelector(".sm-cv")) close(); });
    if (RM.matches) { reveal(); frame(t0 + 3600); return; }
    raf = requestAnimationFrame(frame);
    ov.querySelector(".sm-skip").focus();
    at(2600, () => ov.classList.add("card"));
    at(3700, () => ov.classList.add("flip"));
    at(4500, reveal);
  });
}
async function summonServant(id) {
  const s = S.servants.find((x) => x.id === id); if (!s || !s.wish || S.readOnly) return;
  await playSummon(s);
  const cur = S.servants.find((x) => x.id === id) || s;
  if (S.editing) dropFormArt();
  delete cur.wish; S.tab = "servants"; S.selected = id; S.editing = null; S.justSummoned = id;
  await writeDoc("servants", cur); renderAll(); window.scrollTo({top: 0});
  toast(cur.name + " joined your roster!");
  setTimeout(() => { if (S.justSummoned === id) { S.justSummoned = null; } }, 3200);
}

function stepper(label, field, value, extra) {
  return `<div class="step"><span class="step-k">${label}</span>
    <div class="stepper">${S.readOnly ? "" : `<button data-action="bump" data-f="${field}" data-d="-1" aria-label="Lower ${label}">−</button>`}<output>${value}</output>${S.readOnly ? "" : `<button data-action="bump" data-f="${field}" data-d="1" aria-label="Raise ${label}">+</button>`}</div>
    ${extra || ""}</div>`;
}

/* ---------- effect text: one effect per line ---------- */
// Keeps your own line breaks and treats " // " as one; text without any breaks starts each sentence on a new line.
function sentenceSplit(s) {
  const out = []; let start = 0, m; const re = /[.!?]\)?\s+(?=[A-Z[(])/g;
  while ((m = re.exec(s))) {
    const tail = s.slice(Math.max(start, m.index - 7), m.index + 1);
    if (/\b(?:vs|Lv|approx|No|St|Dr|Mr|Ms|Jr|etc|C)\.$/i.test(tail)) continue;
    out.push(s.slice(start, m.index + m[0].trimEnd().length)); start = m.index + m[0].length;
  }
  out.push(s.slice(start)); return out;
}
function effectLines(t) {
  const s = String(t == null ? "" : t).replace(/\r\n?/g, "\n").replace(/ /g, " ").trim();
  if (!s) return [];
  let lines = s.split(/\n|\s+\/\/\s+/);
  if (lines.length === 1) lines = sentenceSplit(s);
  return lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}
const linesHTML = (t) => effectLines(t).map((l) => `<span class="ln">${esc(l)}</span>`).join("");
const multiText = (t) => String(t == null ? "" : t).replace(/\r\n?/g, "\n").replace(/ /g, " ").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");

/* ---------- skills: any number of values that change with level ---------- */
function scalesOf(info) {
  if (!info || typeof info !== "object") return [];
  const ok = (r) => r && typeof r === "object" && (r.label || num(r.v1) != null || num(r.v10) != null);
  if (Array.isArray(info.scales)) return info.scales.filter(ok);
  return ok(info) ? [{label: info.label, v1: info.v1, v10: info.v10, unit: info.unit}] : [];
}
function scaleAt(r, L) { const v1 = num(r.v1), v10 = num(r.v10); return L >= 10 ? v10 : v1 + (v10 - v1) * (L - 1) / 10; }
function skillLevelTable(info, lv) {
  const rows = scalesOf(info).filter((r) => num(r.v1) != null && num(r.v10) != null);
  const cd = num(info.cd);
  const short = (v, u) => { const d = u === "%" ? 1 : 0, f = Math.pow(10, d); return (Math.round(v * f) / f).toLocaleString("en-US") + (u === "%" ? "%" : ""); };
  const you = (L) => lv === L ? ' class="you"' : "";
  const L10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const head = `<tr><th class="lab">Level</th>${L10.map((L) => `<th${you(L)}>${L}</th>`).join("")}</tr>`;
  const body = rows.map((r) => `<tr><th class="lab">${esc(r.label || "Value")}${r.unit && r.unit !== "%" && !String(r.label || "").toLowerCase().includes(String(r.unit).toLowerCase()) ? ` <small>${esc(r.unit)}</small>` : ""}</th>${L10.map((L) => `<td${you(L)}>${short(scaleAt(r, L), r.unit)}</td>`).join("")}</tr>`).join("");
  const seg = (a, b) => typeof lv === "number" && lv >= a && lv <= b ? ' class="you"' : "";
  const cdRow = cd != null ? `<tr><th class="lab">Cooldown</th><td colspan="5"${seg(1, 5)}>${cd}</td><td colspan="4"${seg(6, 9)}>${cd - 1}</td><td${seg(10, 10)}>${cd - 2}</td></tr>` : "";
  return `<div class="lv-scroll"><table class="lv-table"><tbody>${head}${body}${cdRow}</tbody></table></div>`;
}
function skillHTML(s, i, infos, set) {
  const info = (infos || s.skillInfo || [])[i] || {};
  const lv = (s.skills || [])[i];
  const nr = skNameRank(info.name, info.rank), tier = rankTier(nr.rank);
  const rows = scalesOf(info);
  const cd = curCd(info, lv);
  const nums = rows.map((r) => {
    const val = skillVal(r, lv), v10 = num(r.v10) != null ? fmtVal(num(r.v10), r.unit) : null;
    return `<div><dt>${esc(r.label || "Value")}</dt><dd>${val != null ? val : (typeof lv === "number" ? "—" : "Locked")}${v10 && lv !== 10 && v10 !== val ? ` <span class="muted">→ ${v10} at Lv 10</span>` : ""}</dd></div>`;
  });
  if (num(info.cd) != null) nums.push(`<div><dt>Cooldown</dt><dd>${cd != null ? cd + " turns" : num(info.cd) + " turns at Lv 1"}</dd></div>`);
  const key = s.id + ":" + (set || 0) + ":" + i, open = !!S.skOpen[key];
  const canTable = rows.some((r) => num(r.v1) != null && num(r.v10) != null) || num(info.cd) != null;
  const party = celebrating(s, i);
  return `<article class="skill${tier ? " tier-" + tier : ""}${lv === 10 ? " sk-max" : ""}${party ? " sk-celebrate" : ""}" style="--sk-p:${typeof lv === "number" ? lv / 10 : 0}">
    ${tier === "ex" ? `<i class="sk-ring" aria-hidden="true"><b></b></i>` : ""}${lv === 10 ? skMotes : ""}${party ? skBurstHTML() : ""}
    <header><span class="slot">Skill ${i + 1}</span><h4>${rankNameHTML(nr)}</h4>${lv === 10 ? `<span class="lvl lv-max"><i class="lv-rays" aria-hidden="true"></i>Lv 10</span>` : `<span class="lvl">${typeof lv === "number" ? "Lv " + lv : "Locked"}</span>`}</header>
    ${info.effect ? `<div class="effect">${iconLinesHTML(s, info.effect)}</div>` : ""}
    ${nums.length ? `<dl class="skill-nums">${nums.join("")}</dl>` : ""}
    ${canTable ? `<button type="button" class="lv-toggle" data-action="sk-levels" data-i="${i}" data-k="${set || 0}" aria-expanded="${open}">${open ? "Hide levels ▴" : "All levels ▾"}</button>${open ? skillLevelTable(info, lv) : ""}` : ""}
  </article>`;
}
function scaleRowHTML(r) {
  r = r || {};
  return `<div class="sc-row">
    <label class="sc-label">Effect<input type="text" data-sc="label" value="${esc(r.label ?? "")}" placeholder="e.g. Quick +" autocomplete="off"></label>
    <label>Lv 1<input type="number" step="any" data-sc="v1" value="${esc(r.v1 ?? "")}"></label>
    <label>Lv 10<input type="number" step="any" data-sc="v10" value="${esc(r.v10 ?? "")}"></label>
    <label>Unit<input type="text" data-sc="unit" list="unit-list" value="${esc(r.unit ?? "")}" placeholder="%" autocomplete="off"></label>
    <button type="button" class="btn ghost sm" data-action="sc-del" aria-label="Remove this value">Remove</button>
  </div>`;
}
function readScales(boxId) {
  return Array.from(document.querySelectorAll("#" + boxId + " .sc-row")).map((row) => {
    const g = (k) => { const e = row.querySelector('[data-sc="' + k + '"]'); return e ? e.value.trim() : ""; };
    return {label: g("label") || null, v1: num(g("v1")), v10: num(g("v10")), unit: g("unit") || null};
  }).filter((r) => r.label || r.v1 != null || r.v10 != null);
}

/* ---------- passive skills (as many as you like) ---------- */
function passivesOf(s) { return Array.isArray(s.passives) ? s.passives.filter((x) => x && typeof x === "object") : []; }
function passivesHTML(s) {
  const list = passivesOf(s), ed = S.psEdit === s.id && !S.readOnly;
  const ce = (path, text, ph, multi) => `<span class="ce${multi ? " multi" : ""}" contenteditable="true" spellcheck="false" data-ps="${path}" data-ph="${esc(ph)}" aria-label="${esc(ph)}">${esc(multi ? effectLines(text).join("\n") : (text || ""))}</span>`;
  const rows = list.map((x, i) => ed
    ? `<li class="ps-row editing"><span class="ps-n">${i + 1}</span><div class="ps-main">
        <div class="ps-name">${ce(i + ":name", x.name, "Passive skill name")}${ce(i + ":rank", x.rank, "Rank")}</div>
        ${ce(i + ":effect", x.effect, "What it does (Enter starts a new line)", true)}
        <div class="ps-tools"><button type="button" class="btn ghost sm" data-action="ps-move" data-i="${i}" data-d="-1"${i === 0 ? " disabled" : ""}>Move up</button><button type="button" class="btn ghost sm" data-action="ps-move" data-i="${i}" data-d="1"${i === list.length - 1 ? " disabled" : ""}>Move down</button><button type="button" class="btn danger sm" data-action="ps-del" data-i="${i}">Remove</button></div>
      </div></li>`
    : `<li class="ps-row${psTierCls(x)}"><span class="ps-n">${i + 1}</span><div class="ps-main"><p class="ps-name">${rankNameHTML(skNameRank(x.name || "Unnamed passive", x.rank))}</p>${x.effect ? `<div class="effect">${iconLinesHTML(s, x.effect)}</div>` : ""}</div></li>`).join("");
  return `<section class="d-sec ps-sec">
    <div class="sec-head"><h3>Passive skills${list.length ? ` <small>${list.length}</small>` : ""}</h3>${S.readOnly || !list.length ? "" : `<button type="button" class="btn sm${ed ? " primary" : ""}" data-action="ps-edit">${ed ? "Done editing" : "Edit passives"}</button>`}</div>
    ${list.length ? `<ol class="ps-list">${rows}</ol>` : `<p class="d-empty">No passive skills yet.</p>`}
    ${S.readOnly ? "" : `<div><button type="button" class="btn sm" data-action="ps-add">+ Add passive skill</button></div>`}
  </section>`;
}
function psWrite(path, value) {
  const s = curServant(); if (!s || S.readOnly) return;
  const parts = String(path).split(":"), i = Number(parts[0]), f = parts[1];
  const list = passivesOf(s); if (!list[i] || !["name", "rank", "effect"].includes(f)) return;
  list[i][f] = value; s.passives = list; scheduleWrite("servants", s);
}

/* ---------- deck: five command cards ---------- */
const DECK_NEXT = {"": "Quick", Quick: "Arts", Arts: "Buster", Buster: "Quick"};
function deckOf(s) { const d = Array.isArray(s.deck) ? s.deck : []; return [0, 1, 2, 3, 4].map((i) => CARDS.includes(d[i]) ? d[i] : ""); }
function deckHTML(s) {
  const d = deckOf(s), can = !S.readOnly, set = d.filter(Boolean);
  const counts = ["Quick", "Arts", "Buster"].map((c) => [c, d.filter((x) => x === c).length]).filter((x) => x[1]);
  const card = (c, i) => {
    const img = c && CARD_IMG[c], cls = "cmd" + (c ? " " + cardCls(c) + (img ? " has-img" : "") : " empty"), face = (img ? `<img class="cmd-img" src="${CARD_IMG[c]}" alt="">` : `<span class="cmd-face">${c ? esc(c) : "?"}</span>`) + (c ? `<i class="cmd-glare" aria-hidden="true"></i>` : "");
    return can ? `<button type="button" class="${cls}" data-action="deck" data-i="${i}" aria-label="Card ${i + 1}: ${c || "not set"}. Click to change">${face}</button>`
      : `<span class="${cls}" role="img" aria-label="Card ${i + 1}: ${c || "not set"}">${face}</span>`;
  };
  return `<section class="d-sec deck-sec">
    <div class="sec-head"><h3>Deck <small>${set.length ? counts.map((x) => x[1] + " " + x[0]).join(" · ") : (can ? "click a card to set it" : "not set")}</small></h3>${can && set.length ? `<div class="deck-tools"><button type="button" class="btn ghost sm" data-action="deck-sort">Sort Q · A · B</button><button type="button" class="btn ghost sm" data-action="deck-clear">Clear</button></div>` : ""}</div>
    <div class="deck" role="group" aria-label="Command cards">${d.map(card).join("")}</div>
  </section>`;
}

function typingInDossier() {
  const a = document.activeElement;
  return !!(a && a.closest && a.closest("#dossier") && (a.isContentEditable || (a.matches && a.matches("input[data-np-in], input[data-costume-name], input[data-skset-name]"))));
}
function renderDossier(force) {
  if (!force && typingInDossier()) return;
  const el = $("#dossier");
  const id = shownId();
  const s = S.servants.find((x) => x.id === id);
  el.classList.toggle("open", !!S.selected);
  if (!s) { el.innerHTML = ""; fxAttach(null, S.servants.length > 0); if (!S.servants.length) applyTheme(null); return; }
  const st = levelStatus(s);
  const hp = total(s, "hp"), atk = total(s, "atk");
  const statBox = (k, label, v, base, fou) => `<div class="stat"><span class="k">${label}</span>${v == null ? `<span class="v"><span class="missing-val">Not filled in</span></span>` : `<span class="v${fouTier(fou)}"${fouTier(fou) ? ` title="${FOU_NAME[fouTier(fou)]}"` : ""}>${fmt(v)}</span><span class="sub">base ${fmt(base)} + Fou ${S.readOnly ? fmt(num(fou) || 0) : `<input class="fou-in" id="fou-${k}" type="number" min="0" max="3000" step="10" value="${num(fou) || 0}" aria-label="Fou ${label}">`}</span>`}</div>`;
  const rk = rankOf(s.id);
  el.innerHTML = `
    <button class="btn ghost sm d-back" data-action="close">← Roster</button>
    <header class="d-head">
      ${iconHTML(s, "lg")}
      <div><h2>${esc(s.name)}</h2>
        <p class="d-meta"><span>${esc(s.cls || "No class")}</span><span class="stars">${"★".repeat(clamp(num(s.rarity) || 0, 0, 5))}</span>${s.role ? `<span class="tag">${esc(s.role)}</span>` : ""}${rk ? `<button class="tag rank-chip" data-action="tab" data-tab="ranking" title="Open the ranking">Rank #${rk.rank} of ${rk.of} · ${rk.sc.total.toFixed(1)}</button>` : ""}</p></div>
      <div class="d-head-actions"><button class="btn sm" data-action="vs-add" data-id="${esc(s.id)}" title="Compare in the Versus tab">Compare</button>${S.readOnly ? "" : `<button class="btn sm" data-action="edit">Edit details</button>`}</div>
    </header>
    ${s.wish ? `<div class="wish-banner"><p><b>Guest.</b> Not summoned yet. Add their stage pictures under Ascension art, and summon them on the Summoning page when they join you.</p>${S.readOnly ? "" : `<button class="btn sm summon-btn" data-action="to-summon" data-id="${esc(s.id)}">Go to Summoning</button>`}</div>` : ""}

    ${artHTML(s)}

    ${deckHTML(s)}

    <section class="d-sec"><h3>Progress</h3>
      <div class="steps three lv-row">
        ${stepper("Level", "level", esc(s.level ?? "—"), st ? `<span class="status ${st.kind}">${st.text}</span>` : "")}
        ${stepper("NP level", "np", s.npLevel ? "NP" + esc(s.npLevel) : "—", s.npLevel ? "" : `<span class="status">Not set</span>`)}
        ${stepper("Bond", "bond", esc(num(s.bond) || 0), bondGems(s) + bondNote(s))}
      </div>
      <div class="steps three">
        ${[0, 1, 2].map((i) => { const v = (s.skills || [])[i]; return stepper("Skill " + (i + 1), "sk" + i, typeof v === "number" ? v : "Locked", typeof v === "number" && v === 10 ? `<span class="status grail${celebrating(s, i) ? " pop" : ""}">Maxed</span>` : (typeof v === "number" ? `<span class="status">${10 - v} to max</span>` : `<span class="status">Unlock with + </span>`)); }).join("")}
      </div>
    </section>

    <section class="d-sec"><h3>Stats <small>at Lv ${esc(s.level ?? "—")}, Fou included</small></h3>
      <div class="stat-grid">${statBox("hp", "HP", hp, num(s.hp), s.fouHp)}${statBox("atk", "ATK", atk, num(s.atk), s.fouAtk)}</div>${goalHTML(s)}
    </section>

    ${traitsSectionHTML(s)}

    ${bestSupportsHTML(s)}

    ${npSectionHTML(s)}

    ${skSetsPanelHTML(s)}

    ${skillsSectionHTML(s)}

    ${passivesHTML(s)}

    <section class="d-sec"><h3>Team</h3>
      <dl class="kv">
        <dt>Best party</dt><dd>${esc(s.party || "—")}</dd>
        <dt>Teammates</dt><dd>${esc(s.mates || "—")}</dd>
        <dt>Guest picks</dt><dd>${esc(s.guests || "—")}</dd>
      </dl>
    </section>

    <section class="d-sec"><h3>Notes</h3>
      <p class="notes">${esc(s.notes || "No notes yet.")}</p>
      ${s.url && /^https:\/\//.test(s.url) ? `<a class="wiki" href="${esc(s.url)}" target="_blank" rel="noopener">Open wiki page ↗</a>` : ""}
    </section>`;
  fxAttach(s); applyTheme(s);
}

/* ---------- forms ---------- */
function opt(list, val, blank) {
  return (blank != null ? `<option value="">${esc(blank)}</option>` : "") + list.map((o) => { const v = typeof o === "object" ? o.v : o; const t = typeof o === "object" ? o.t : o; return `<option value="${esc(v)}"${String(v) === String(val ?? "") ? " selected" : ""}>${esc(t)}</option>`; }).join("");
}
const fld = (id, label, control, cls) => `<div class="f${cls ? " " + cls : ""}"><label for="${id}">${label}</label>${control}</div>`;
const inp = (id, val, type, attrs) => `<input id="${id}" type="${type || "text"}" value="${esc(val ?? "")}" ${attrs || ""}>`;
const area = (id, val) => `<textarea id="${id}">${esc(val ?? "")}</textarea>`;
const sel = (id, list, val, blank) => `<select id="${id}">${opt(list, val, blank)}</select>`;
const val = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ""; };

/* ---------- stage images right in the add/edit form (wishlist servants too) ---------- */
const FORM_SLOTS = [{k: "1", t: "Stage 1"}, {k: "2", t: "Stage 2"}, {k: "3", t: "Stage 3"}, {k: "4", t: "Stage 4"}, {k: "c", t: "Costume"}];
function formArtTile(s, x) {
  const id = S.formArt && S.formArt[x.k], busy = S.formArtBusy === x.k, name = x.k === "c" ? (costumeName(s || {}, "c") || "Costume") : x.t;
  const pic = busy ? `<span class="fa-pic fa-plus">Saving…</span>` : id ? `<img class="fa-pic" src="${esc(artSrc(id))}" alt="${esc(name)}" data-art="1">` : `<span class="fa-pic fa-plus" aria-hidden="true">+</span>`;
  return `<div class="fa-tile${id ? " has" : ""}${S.formArtSlot === x.k ? " on" : ""}" data-action="fa-pick" data-slot="${x.k}" data-fa-drop="${x.k}">
    ${pic}<span class="fa-t">${esc(name)}</span>
    <span class="fa-btns"><label class="btn sm file-btn">${id ? "Replace" : "Choose"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-form-art="${x.k}" aria-label="${esc(name)} image"></label>${id ? `<button type="button" class="btn ghost sm" data-action="fa-clear" data-slot="${x.k}" aria-label="Remove the ${esc(name)} image">Remove</button>` : ""}</span>
  </div>`;
}
function formArtHTML(s) {
  if (!S.assets || S.readOnly || !S.formArt) return "";
  return `<fieldset id="fs-art"><legend>Stage images</legend>
    <p class="fa-hint">Choose a picture for each stage, drop one on a box, or click a box and press Ctrl+V (Cmd+V on a Mac) to paste an image you copied from the wiki. More costumes can be added on the servant's page.</p>
    <div class="fa-grid">${FORM_SLOTS.map((x) => formArtTile(s, x)).join("")}</div></fieldset>`;
}
function renderFormArt() {
  const g = document.querySelector("#fs-art .fa-grid"); if (!g) return;
  const s = S.editing === "new" ? null : S.servants.find((x) => x.id === S.editing);
  g.innerHTML = FORM_SLOTS.map((x) => formArtTile(s, x)).join("");
}
function startFormArt(s) {
  dropFormArt();
  S.formArt = {}; S.formArtNew = []; S.formArtSlot = null; S.formArtBusy = null;
  if (s) FORM_SLOTS.forEach((x) => { const a = artOf(s, x.k); if (a) S.formArt[x.k] = a; });
}
// Pictures picked in a form that was never saved are removed again
function dropFormArt() {
  const used = new Set(); S.servants.forEach((s) => Object.values(s.art || {}).forEach((id) => used.add(id)));
  (S.formArtNew || []).forEach((id) => { if (!used.has(id) && S.assets) Promise.resolve().then(() => S.assets.delete(id)).catch(() => {}); });
  S.formArt = null; S.formArtNew = []; S.formArtSlot = null; S.formArtBusy = null;
}
async function formArtUpload(slot, file) {
  if (!S.assets || S.readOnly || !file || !S.formArt) return;
  if (!/^image\//.test(file.type || "")) { toast("That file isn't an image."); return; }
  S.formArtBusy = slot; S.formArtSlot = slot; renderFormArt();
  const blob = await shrink(file);
  let r = null;
  try { r = await S.assets.upload(blob, {type: blob.type || file.type}); }
  catch (e) {
    if (e && e.code === "store_unavailable") { await sleep(800); try { r = await S.assets.upload(blob, {type: blob.type || file.type}); } catch (e2) { uploadFailed(e2); } }
    else uploadFailed(e);
  }
  S.formArtBusy = null;
  if (!S.formArt) { if (r) Promise.resolve().then(() => S.assets.delete(r.id)).catch(() => {}); return; }
  if (r) {
    S.urlCache[r.id] = r.url;
    const prev = S.formArt[slot];
    if (prev && S.formArtNew.includes(prev)) { S.formArtNew = S.formArtNew.filter((x) => x !== prev); Promise.resolve().then(() => S.assets.delete(prev)).catch(() => {}); }
    S.formArt[slot] = r.id; S.formArtNew.push(r.id);
  }
  renderFormArt();
  if (r) { const f = FORM_SLOTS.find((x) => x.k === slot); toast((f ? f.t : "Image") + " picture added. It's saved when you save the form."); }
}
// Folds the form's pictures into the servant; returns the old pictures that were replaced or removed
function applyFormArt(o, base) {
  if (!S.formArt) return [];
  const art = Object.assign({}, (base && base.art) || {}), gone = [];
  FORM_SLOTS.forEach((x) => {
    const v = S.formArt[x.k], old = art[x.k];
    if (v) { if (old && old !== v) gone.push(old); art[x.k] = v; }
    else if (old && artOf(base, x.k)) { gone.push(old); delete art[x.k]; }
  });
  o.art = art;
  if (!artOf(o, o.artStage)) { const f = slotsOf(o).find((x) => artOf(o, x.k)); o.artStage = f ? f.k : null; }
  return gone;
}

function servantForm(s) {
  const isNew = !s;
  s = s || {rarity: 5, level: 1, skills: [1, 1, 1], skillInfo: [{}, {}, {}], wish: !!S.newWish};
  const skillLv = [1,2,3,4,5,6,7,8,9,10,"Locked"];
  const skills = s.skills || [1, 1, 1];
  const infos = s.skillInfo || [{}, {}, {}];
  const skillBlocks = skillBlocksHTML("sv", infos);
  const sets = skSets(s);
  return `<form class="form" id="servant-form" novalidate>
    <header class="d-head" style="grid-template-columns:minmax(0,1fr)"><div><p class="eyebrow">${isNew ? (s.wish ? "Guest" : "New servant") : "Editing"}</p><h2>${esc(isNew ? (s.wish ? "Add a guest" : "Add a servant") : s.name)}</h2></div></header>
    <fieldset><legend>Basics</legend><div class="form-grid">
      ${fld("sv-name", "Name", inp("sv-name", s.name, "text", 'required autocomplete="off"'), "full")}
      ${fld("sv-cls", "Class", sel("sv-cls", CLASSES, s.cls, "Choose…"))}
      ${fld("sv-rarity", "Rarity", sel("sv-rarity", [5,4,3,2,1].map((r) => ({v: r, t: r + "★"})), s.rarity))}
      ${fld("sv-level", "Level", inp("sv-level", s.level, "number", 'min="1" max="120"'))}
      ${fld("sv-np", "NP level", sel("sv-np", [1,2,3,4,5], s.npLevel, "Not set"))}
      ${fld("sv-role", "Role", sel("sv-role", ROLES, s.role, "—"))}
      <div class="f full"><label class="chk" for="sv-wish"><input type="checkbox" id="sv-wish"${s.wish ? " checked" : ""}> Not summoned yet (keep in Guests)</label></div>
    </div></fieldset>
    ${formArtHTML(s)}
    ${traitsFieldHTML(s)}
    <fieldset><legend>Skill levels</legend><div class="form-grid">
      ${[0,1,2].map((i) => fld("sv-sk" + i, "Skill " + (i + 1), sel("sv-sk" + i, skillLv, skills[i]))).join("")}
    </div></fieldset>
    <fieldset><legend>Stats at current level</legend><div class="form-grid">
      ${fld("sv-hp", "Base HP (no Fou)", inp("sv-hp", s.hp, "number", 'min="0"'))}
      ${fld("sv-fouhp", "Fou HP", inp("sv-fouhp", s.fouHp, "number", 'min="0" max="3000"'))}
      ${fld("sv-atk", "Base ATK (no Fou)", inp("sv-atk", s.atk, "number", 'min="0"'))}
      ${fld("sv-fouatk", "Fou ATK", inp("sv-fouatk", s.fouAtk, "number", 'min="0" max="3000"'))}
    </div></fieldset>
    <fieldset><legend>Noble Phantasm</legend><div class="form-grid">
      ${fld("sv-npname", "NP name", inp("sv-npname", s.npName), "full")}
      ${fld("sv-npcard", "Card", sel("sv-npcard", CARDS, s.npCard, "—"))}
      ${fld("sv-nptarget", "Target", sel("sv-nptarget", TARGETS, s.npTarget, "—"))}
    </div></fieldset>
    <fieldset id="fs-skset-0"><legend>Skills${sets.length ? " · " + esc(skSetName(s, 0)) + " set" : ""}</legend><datalist id="unit-list">${UNITS.map((u) => `<option value="${esc(u)}"></option>`).join("")}</datalist>${skillBlocks}</fieldset>
    ${sets.map((x, i) => `<fieldset id="fs-skset-${i + 1}"><legend>Skills · ${esc(skSetName(s, i + 1))} set${(x.slots || []).length ? " (" + esc(slotNames(s, x.slots)) + ")" : ""}</legend>${skillBlocksHTML("ss" + (i + 1), x.info)}</fieldset>`).join("")}
    <fieldset><legend>Team</legend><div class="form-grid">
      ${fld("sv-party", "Best party", inp("sv-party", s.party), "full")}
      ${fld("sv-mates", "Teammates from your roster", area("sv-mates", s.mates), "full")}
      ${fld("sv-guests", "Guest picks", area("sv-guests", s.guests), "full")}
    </div></fieldset>
    <fieldset><legend>Notes</legend><div class="form-grid">
      ${fld("sv-notes", "Notes", area("sv-notes", s.notes), "full")}
      ${fld("sv-url", "Wiki link", inp("sv-url", s.url, "url", 'placeholder="https://fategrandorder.fandom.com/wiki/…"'), "full")}
    </div></fieldset>
    <p class="form-error" id="sv-error" hidden></p>
    <div class="form-actions">
      <button class="btn primary" type="submit">${isNew ? (s.wish ? "Add to Guests" : "Add to roster") : "Save changes"}</button>
      <button class="btn ghost" type="button" data-action="cancel-edit">Cancel</button>
      <span class="spacer"></span>
      ${isNew ? "" : `<button class="btn danger" type="button" data-action="ask-delete">Delete servant</button>`}
    </div>
    <div id="sv-confirm"></div>
  </form>`;
}

function readServantForm(base) {
  const o = Object.assign({}, base || {});
  o.name = val("sv-name"); o.cls = val("sv-cls") || null; o.rarity = num(val("sv-rarity")) || 5;
  o.level = num(val("sv-level")); o.npLevel = num(val("sv-np")); o.role = val("sv-role") || null;
  o.skills = [0, 1, 2].map((i) => { const v = val("sv-sk" + i); return v === "Locked" ? "Locked" : (num(v) || 1); });
  o.hp = num(val("sv-hp")); o.fouHp = num(val("sv-fouhp")); o.atk = num(val("sv-atk")); o.fouAtk = num(val("sv-fouatk"));
  o.npName = val("sv-npname") || null; o.npCard = val("sv-npcard") || null; o.npTarget = val("sv-nptarget") || null;
  o.skillInfo = readSkillBlocks("sv", base && base.skillInfo);
  if (base && skSets(base).length) o.skillSets = skSets(base).map((x, i) => document.getElementById("fs-skset-" + (i + 1)) ? Object.assign({}, x, {info: readSkillBlocks("ss" + (i + 1), x.info)}) : x);
  o.party = val("sv-party") || null; o.mates = val("sv-mates") || null; o.guests = val("sv-guests") || null;
  o.notes = val("sv-notes") || null; o.url = val("sv-url") || null;
  const wb = document.getElementById("sv-wish"); if (wb && wb.checked) o.wish = true; else delete o.wish;
  const tf = readTraitsForm(); if (tf) { o.attr = tf.attr || null; o.lawOrder = tf.order; o.moral = tf.moral; o.traits = tf.traits; o.buffs = tf.buffs; o.traitsSet = true; delete o.gender; }
  if (o.level != null) o.level = clamp(Math.round(o.level), 1, 120);
  return o;
}

function openServantEditor(id) {
  startFormArt(id ? S.servants.find((x) => x.id === id) : null);
  S.editing = id || "new"; S.confirmDel = false;
  if (id) S.selected = id;
  const el = $("#dossier");
  el.classList.add("open");
  el.innerHTML = servantForm(id ? S.servants.find((x) => x.id === id) : null);
  renderList();
  el.scrollTop = 0;
  const first = document.getElementById("sv-name"); if (first && !id) first.focus();
}

async function submitServant() {
  const err = $("#sv-error");
  const base = S.editing === "new" ? null : S.servants.find((x) => x.id === S.editing);
  const o = readServantForm(base);
  if (!o.name) { err.textContent = "Give the servant a name before saving."; err.hidden = false; document.getElementById("sv-name").focus(); return; }
  if (!base) { o.id = slug(o.name, S.servants); o.order = nextOrder(S.servants); }
  const goneArt = applyFormArt(o, base);
  const ok = await writeDoc("servants", o);
  if (!ok) return;
  S.formArtNew = []; S.formArt = null;
  if (goneArt.length && S.assets) {
    const used = new Set(); S.servants.concat([o]).forEach((x) => Object.values(x.art || {}).forEach((v) => used.add(v)));
    goneArt.forEach((id) => { if (!used.has(id)) Promise.resolve().then(() => S.assets.delete(id)).catch(() => {}); });
  }
  const summoned = !!(base && base.wish && !o.wish);
  if (summoned) await playSummon(o);
  S.selected = o.id; S.editing = null;
  if (summoned) { S.tab = "servants"; S.justSummoned = o.id; setTimeout(() => { if (S.justSummoned === o.id) S.justSummoned = null; }, 3200); }
  const i = S.servants.findIndex((x) => x.id === o.id);
  if (i >= 0) S.servants[i] = o; else S.servants.push(o);
  toast(summoned ? o.name + " joined your roster!" : base ? "Saved." : o.name + (o.wish ? " added to Guests." : " added to your roster."));
  renderAll();
}

const COST = {5: 16, 4: 12, 3: 7, 2: 4, 1: 3};
const POS = ["LEADER", "2nd", "3rd", "4th", "5th", "6th"];
const FRONT_LBL = ["Leader", "2nd", "3rd"], BACK_LBL = ["4th", "5th", "6th"];

function partyForm(p) {
  const isNew = !p; p = p || {front: ["", "", ""], back: ["", "", ""], ce: []};
  const names = owned().map((s) => s.name);
  const gnames = S.guests.map((g) => g.name);
  const f = p.front || [], b = p.back || [], ce = Array.isArray(p.ce) ? p.ce : [];
  const slot = (id, label, v, i) => `<div class="slot-row">${fld(id, label, sel(id, names, v, "Empty"))}${fld("pt-ce" + i, "Craft Essence", inp("pt-ce" + i, ce[i], "text", 'placeholder="Optional" autocomplete="off"'))}</div>`;
  return `<form class="party form" id="party-form" novalidate>
    <div class="form-grid">
      ${fld("pt-name", "Party name", inp("pt-name", p.name), "full")}
      ${fld("pt-for", "Best for", inp("pt-for", p.bestFor), "full")}
    </div>
    <fieldset><legend>Starting members</legend><p class="muted" style="margin:0;font-size:13px">Leave one slot empty: the guest support goes there.</p>${[0, 1, 2].map((i) => slot("pt-f" + i, FRONT_LBL[i], f[i], i)).join("")}</fieldset>
    <fieldset><legend>Sub members</legend>${[0, 1, 2].map((i) => slot("pt-b" + i, BACK_LBL[i], b[i], 3 + i)).join("")}</fieldset>
    <fieldset><legend>Support</legend><div class="slot-row">
      ${fld("pt-guest", "Guest support", guestSelectHTML(p))}
      ${fld("pt-gce", "Guest's Craft Essence", inp("pt-gce", p.guestCe, "text", 'placeholder="Optional" autocomplete="off"'))}
    </div></fieldset>
    <div class="form-grid">${fld("pt-strategy", "Strategy", area("pt-strategy", p.strategy), "full")}</div>
    <p class="form-error" id="pt-error" hidden></p>
    <div class="form-actions">
      <button class="btn primary" type="submit">${isNew ? "Add party" : "Save party"}</button>
      <button class="btn ghost" type="button" data-action="cancel-party">Cancel</button>
      <span class="spacer"></span>
      ${isNew ? "" : `<button class="btn danger" type="button" data-action="ask-delete-party">Delete</button>`}
    </div>
    <div id="pt-confirm"></div>
  </form>`;
}

async function submitParty() {
  const err = $("#pt-error");
  const base = S.partyEdit === "new" ? null : S.parties.find((x) => x.id === S.partyEdit);
  const o = Object.assign({}, base || {});
  o.name = val("pt-name"); o.bestFor = val("pt-for") || null;
  o.front = [0, 1, 2].map((i) => val("pt-f" + i)); o.back = [0, 1, 2].map((i) => val("pt-b" + i));
  o.ce = [0, 1, 2, 3, 4, 5].map((i) => val("pt-ce" + i));
  o.guest = val("pt-guest") || null; o.guestCe = val("pt-gce") || null; o.strategy = val("pt-strategy") || null;
  const members = o.front.concat(o.back).filter(Boolean);
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  if (!o.name) { fail("Give the party a name before saving."); return; }
  if (new Set(members).size !== members.length) { fail("A servant can only be in a party once. Remove the duplicate, then save."); return; }
  if (o.guest && o.front.every(Boolean)) { fail("Leave one starting slot empty for the guest support, or set Guest support to None."); return; }
  if (!base) { o.id = slug(o.name, S.parties); o.order = nextOrder(S.parties); }
  const ok = await writeDoc("parties", o);
  if (!ok) return;
  S.partyEdit = null;
  const i = S.parties.findIndex((x) => x.id === o.id); if (i >= 0) S.parties[i] = o; else S.parties.push(o);
  toast("Party saved."); renderParties();
}

function memberCard(name, i, ce) {
  const pos = POS[i], pc = i === 0 ? "lead" : i < 3 ? "start" : "sub";
  const badge = `<span class="fc-pos ${pc}">${pos}</span>`;
  if (!name) return `<div class="fc empty">${badge}<span class="fc-empty-t">Empty</span></div>`;
  const s = S.servants.find((x) => x.name === name);
  if (!s) return `<div class="fc missing"><span class="fc-in">${badge}<b>${esc(name)}</b><small>Not in your roster</small></span></div>`;
  const r = clamp(num(s.rarity) || 0, 0, 5), metal = r >= 4 ? "gold" : r === 3 ? "silver" : "bronze";
  const k = iconSlot(s), st = levelStatus(s);
  const art = k ? `<img src="${esc(artSrc(artOf(s, k)))}" alt="" data-art="1" loading="lazy">` : (CLASS_LOGO[s.cls] ? `<img class="fc-biglogo" src="${CLASS_LOGO[s.cls]}" alt="">` : `<span class="fc-mono">${esc(ABBR[s.cls] || "—")}</span>`);
  return `<button type="button" class="fc ${metal}" data-action="goto" data-id="${esc(s.id)}" title="Open ${esc(s.name)}" aria-label="${esc(pos)}: ${esc(s.name)}, level ${esc(s.level ?? "not set")}. Open details">
    <span class="fc-in">
      <span class="fc-art">${art}<span class="fc-name">${esc(s.name)}</span></span>
      <span class="fc-cls">${CLASS_LOGO[s.cls] ? `<img class="fc-logo" src="${CLASS_LOGO[s.cls]}" alt="">` : `<span class="fc-gem"><i><b>${esc(ABBR[s.cls] || "—")}</b></i></span>`}<small>${esc(s.cls || "")}</small></span>
      ${badge}
      <span class="fc-ce${ce ? "" : " none"}"><span>${ce ? esc(ce) : "No Craft Essence"}</span></span>
      <span class="fc-stats">
        <span class="fc-top"><span class="fc-lv${st && st.kind === "grail" ? " grail" : ""}"><small>Lv.</small>${esc(s.level ?? "—")}</span><span class="fc-stars" aria-label="${r} stars">${"★".repeat(r)}</span></span>
        <span class="fc-k">HP</span><span class="fc-v">${fmt(total(s, "hp"))}</span>
        <span class="fc-k">ATK</span><span class="fc-v">${fmt(total(s, "atk"))}</span>
        <span class="fc-k">COST</span><span class="fc-v">${COST[r] != null ? COST[r] : "—"}</span>
      </span>
    </span>
  </button>`;
}
function supportCard(p) {
  const g = S.guests.find((x) => x.name === p.guest), own = S.servants.find((x) => x.name === p.guest);
  const k = own ? iconSlot(own) : null;
  return `<div class="fc support" role="group" aria-label="Support: ${esc(p.guest)}"><span class="fc-in">
    ${k ? `<img class="fc-ghost" src="${esc(artSrc(artOf(own, k)))}" alt="" data-art="1" loading="lazy">` : ""}
    <span class="fc-sup" aria-hidden="true">SUPPORT</span>
    <span class="fc-gplate"><b>${esc(p.guest)}</b>${g && g.cls ? `<small>${esc(g.cls)}</small>` : ""}${p.guestCe ? `<small class="gce">${esc(p.guestCe)}</small>` : ""}</span>
  </span></div>`;
}

function renderParties() {
  const el = $("#parties");
  if (S.dbState !== "ok") { el.innerHTML = ""; return; }
  if (!S.loaded.parties) { el.innerHTML = `<div class="skeleton" style="height:320px"></div>`; return; }
  let html = "";
  if (S.partyEdit === "new") html += partyForm(null);
  if (!S.parties.length && S.partyEdit !== "new") {
    el.innerHTML = `<div class="list-note"><h2>No parties yet</h2><p>Save teams you like to use: three starting members (one slot for the guest support) and three sub members.</p>${S.readOnly ? "" : `<button class="btn primary" data-action="add-party">Add a party</button>`}</div>`;
    return;
  }
  html += S.parties.map((p) => {
    if (S.partyEdit === p.id) return partyForm(p);
    const byName = (n) => S.servants.find((s) => s.name === n);
    const ce = Array.isArray(p.ce) ? p.ce : [];
    const front = [0, 1, 2].map((i) => (p.front || [])[i] || "");
    const gi = p.guest ? front.findIndex((n) => !n) : -1;
    const start = front.map((n, i) => i === gi ? supportCard(p) : memberCard(n, i, ce[i]));
    if (p.guest && gi < 0) start.push(supportCard(p));
    const sub = [0, 1, 2].map((i) => memberCard((p.back || [])[i] || "", 3 + i, ce[3 + i]));
    const own = front.concat(p.back || []).map(byName).filter(Boolean);
    const sum = (k) => { const vals = own.map((s) => total(s, k)); return vals.some((v) => v != null) ? vals.reduce((a, v) => a + (v || 0), 0) : null; };
    const cost = own.reduce((a, s) => a + (COST[clamp(num(s.rarity) || 0, 0, 5)] || 0), 0);
    const gaps = own.some((s) => total(s, "atk") == null);
    return `<article class="party">
      <header><div><h3>${esc(p.name)}</h3>${p.bestFor ? `<p class="for">${esc(p.bestFor)}</p>` : ""}</div><div class="party-acts"><button class="btn sm ghost" type="button" data-action="party-img" data-id="${esc(p.id)}" title="Make a picture of this party to save or share">Share image</button>${S.readOnly ? "" : `<button class="btn sm" data-action="edit-party" data-id="${esc(p.id)}">Edit party</button>`}</div></header>
      <div class="formation">
        <section class="f-group start" aria-label="Starting members"><h4><b>Starting</b> Member</h4><div class="f-cards${start.length > 3 ? " four" : ""}">${start.join("")}</div></section>
        <section class="f-group sub" aria-label="Sub members"><h4><b>Sub</b> Member</h4><div class="f-cards">${sub.join("")}</div></section>
      </div>
      <dl class="party-tot"><div><dt>Total ATK</dt><dd>${fmt(sum("atk"))}</dd></div><div><dt>Total HP</dt><dd>${fmt(sum("hp"))}</dd></div><div><dt>Servant cost</dt><dd>${cost}</dd></div>${gaps ? `<div><dt>&nbsp;</dt><dd class="muted" style="font-family:var(--f-body);font-weight:400;font-size:12.5px">Some stats not filled in</dd></div>` : ""}</dl>
      ${p.strategy ? `<p class="strategy">${esc(p.strategy)}</p>` : ""}
    </article>`;
  }).join("");
  el.innerHTML = html;
}

function guestForm(g) {
  const isNew = !g; g = g || {};
  return `<form class="guest form" id="guest-form" novalidate>
    <div class="form-grid">
      ${fld("gs-name", "Guest servant", inp("gs-name", g.name), "full")}
      ${fld("gs-cls", "Class", sel("gs-cls", CLASSES, g.cls, "—"))}
      ${fld("gs-pair", "Best paired with", sel("gs-pair", owned().map((s) => s.name), g.pairedWith, "—"), "wide")}
      ${fld("gs-also", "Also good with", inp("gs-also", g.alsoGood), "full")}
      ${fld("gs-why", "Why it works", area("gs-why", g.why), "full")}
    </div>
    <p class="form-error" id="gs-error" hidden></p>
    <div class="form-actions">
      <button class="btn primary" type="submit">${isNew ? "Add guest" : "Save guest"}</button>
      <button class="btn ghost" type="button" data-action="cancel-guest">Cancel</button>
      <span class="spacer"></span>
      ${isNew ? "" : `<button class="btn danger" type="button" data-action="ask-delete-guest">Delete</button>`}
    </div>
    <div id="gs-confirm"></div>
  </form>`;
}

async function submitGuest() {
  const err = $("#gs-error");
  const base = S.guestEdit === "new" ? null : S.guests.find((x) => x.id === S.guestEdit);
  const o = Object.assign({}, base || {});
  o.name = val("gs-name"); o.cls = val("gs-cls") || null; o.pairedWith = val("gs-pair") || null; o.alsoGood = val("gs-also") || null; o.why = val("gs-why") || null;
  if (!o.name) { err.textContent = "Give the guest a name before saving."; err.hidden = false; return; }
  if (!base) { o.id = slug(o.name, S.guests); o.order = nextOrder(S.guests); }
  const ok = await writeDoc("guests", o);
  if (!ok) return;
  S.guestEdit = null;
  const i = S.guests.findIndex((x) => x.id === o.id); if (i >= 0) S.guests[i] = o; else S.guests.push(o);
  toast("Guest saved."); renderGuests();
}

function renderGuests() {
  const el = $("#guests");
  if (S.dbState !== "ok") { el.innerHTML = ""; return; }
  if (!S.loaded.guests) { el.innerHTML = `<div class="skeleton" style="height:160px"></div>`; return; }
  let html = "";
  if (S.guestEdit === "new") html += guestForm(null);
  if (!S.guests.length && S.guestEdit !== "new") {
    el.innerHTML = `<div class="list-note"><h2>No guests yet</h2><p>List the support servants you like to borrow and which of your servants they pair with.</p>${S.readOnly ? "" : `<button class="btn primary" data-action="add-guest">Add a guest</button>`}</div>`;
    return;
  }
  html += S.guests.map((g) => {
    if (S.guestEdit === g.id) return guestForm(g);
    return `<article class="guest">
      <div class="guest-head">${CLASS_LOGO[g.cls] ? `<img class="mono-logo" src="${CLASS_LOGO[g.cls]}" alt="">` : `<span class="mono-tag">${esc(ABBR[g.cls] || "—")}</span>`}<div><h3>${esc(g.name)}</h3><span class="muted" style="font-size:13px">${esc(g.cls || "")}</span></div></div>
      <dl class="kv"><dt>Best with</dt><dd>${esc(g.pairedWith || "—")}</dd><dt>Also good with</dt><dd>${esc(g.alsoGood || "—")}</dd></dl>
      ${g.why ? `<p class="why">${esc(g.why)}</p>` : ""}
      ${S.readOnly ? "" : `<footer><button class="btn sm" data-action="edit-guest" data-id="${esc(g.id)}">Edit</button></footer>`}
    </article>`;
  }).join("");
  el.innerHTML = html;
}

/* ---------- fonts: any Google Font, chosen per part of the page ---------- */
const FONT_KEY = "spirit-origin-list:v1:fonts";
const FONT_DEFAULT = {display: "Bricolage Grotesque", body: "Albert Sans", data: "IBM Plex Mono"};
const FONT_ROLES = [
  {k: "display", t: "Headings", v: "--f-display", fb: '"Albert Sans", system-ui, sans-serif', sample: "Fate/Grand Index"},
  {k: "body", t: "Body text", v: "--f-body", fb: 'system-ui, -apple-system, "Segoe UI", sans-serif', sample: "Ignores Invincible and raises her own Buster for one turn."},
  {k: "data", t: "Numbers and labels", v: "--f-data", fb: 'ui-monospace, "SFMono-Regular", Menlo, monospace', sample: "HP 13,896 · ATK 12,265 · NP2 · Lv 92"}
];
const FONT_SUGGEST = ["Bricolage Grotesque", "Albert Sans", "IBM Plex Mono", "Cinzel", "Cormorant Garamond", "Playfair Display", "EB Garamond", "Marcellus", "Spectral", "Lora", "Shippori Mincho", "Zen Old Mincho", "Noto Serif JP", "Inter", "DM Sans", "Outfit", "Manrope", "Space Grotesk", "JetBrains Mono", "Space Mono", "DM Mono", "Fira Code"];
const FONT_BUILTIN = new Set(Object.values(FONT_DEFAULT));
const validFamily = (n) => typeof n === "string" && /^[A-Za-z0-9][A-Za-z0-9 ]{0,58}[A-Za-z0-9]$/.test(n);
function fontPrefs() {
  const out = Object.assign({added: []}, FONT_DEFAULT);
  try {
    const d = JSON.parse(localStorage.getItem(FONT_KEY) || "null");
    if (d && typeof d === "object") {
      FONT_ROLES.forEach((x) => { if (validFamily(d[x.k])) out[x.k] = d[x.k]; });
      if (Array.isArray(d.added)) out.added = d.added.filter(validFamily).slice(0, 30);
    }
  } catch (e) {}
  return out;
}
function setFontPrefs(f) { try { localStorage.setItem(FONT_KEY, JSON.stringify({display: f.display, body: f.body, data: f.data, added: f.added || []})); } catch (e) {} }
const fontLoads = {};
// Tries the name as typed, then in Title Case; resolves with the family name Google accepted, or null.
function loadFont(fam) {
  if (FONT_BUILTIN.has(fam)) return Promise.resolve(fam);
  if (fontLoads[fam]) return fontLoads[fam];
  const names = [fam]; const tc = fam.replace(/\b[a-z]/g, (m) => m.toUpperCase()); if (tc !== fam) names.push(tc);
  const tries = []; names.forEach((n) => [":wght@400;500;600;700", ":wght@400;700", ""].forEach((w) => tries.push({n: n, w: w})));
  const pr = new Promise((res) => {
    let i = 0;
    const next = () => {
      if (i >= tries.length) { delete fontLoads[fam]; res(null); return; }
      const t = tries[i++], l = document.createElement("link");
      l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=" + t.n.replace(/ /g, "+") + t.w + "&display=swap";
      let done = false;
      const timer = setTimeout(() => fail(), 9000);
      const fail = () => { if (done) return; done = true; clearTimeout(timer); l.remove(); next(); };
      l.onload = () => { if (done) return; done = true; clearTimeout(timer); res(t.n); };
      l.onerror = fail;
      document.head.appendChild(l);
    };
    next();
  });
  fontLoads[fam] = pr; return pr;
}
function applyFonts(f) {
  const r = document.documentElement.style;
  FONT_ROLES.forEach((x) => { const n = f[x.k]; if (!n || n === FONT_DEFAULT[x.k]) r.removeProperty(x.v); else r.setProperty(x.v, '"' + n + '", ' + x.fb); });
}
function initFonts() {
  const f = fontPrefs(); applyFonts(f);
  FONT_ROLES.forEach((x) => { if (!FONT_BUILTIN.has(f[x.k])) loadFont(f[x.k]); });
}
function setFontRole(k, n) {
  if (!validFamily(n) || !FONT_ROLES.some((x) => x.k === k)) return;
  const f = fontPrefs(); f[k] = n; setFontPrefs(f); applyFonts(f); renderFontDlg();
  loadFont(n).then((got) => {
    if (!got) { toast("Couldn't load " + n + " from Google Fonts, so a fallback font shows for now."); return; }
    if (got !== n) { const g = fontPrefs(); FONT_ROLES.forEach((x) => { if (g[x.k] === n) g[x.k] = got; }); setFontPrefs(g); applyFonts(g); renderFontDlg(); }
  });
}
function fontFromInput(raw) {
  let v = String(raw || "").trim();
  const m = /fonts\.google\.com\/specimen\/([^/?#]+)/i.exec(v) || /[?&]family=([^:&;]+)/i.exec(v);
  if (m) { try { v = decodeURIComponent(m[1]); } catch (e) { v = m[1]; } v = v.replace(/\+/g, " "); }
  v = v.replace(/\s+/g, " ").trim();
  return validFamily(v) ? v : null;
}
async function fontAdd() {
  const box = $("#font-new"), msg = $("#font-msg");
  const name = fontFromInput(box.value);
  if (!name) { msg.textContent = "Type a font name like Cinzel or Playfair Display, or paste its fonts.google.com link."; msg.className = "font-msg bad"; return; }
  msg.textContent = "Looking for " + name + " on Google Fonts…"; msg.className = "font-msg";
  const got = await loadFont(name);
  if (!got) { msg.textContent = "Couldn't load " + name + ". Check the spelling on fonts.google.com and that you're online."; msg.className = "font-msg bad"; return; }
  const f = fontPrefs(); f.added = [got].concat(f.added.filter((x) => x !== got)).slice(0, 30); setFontPrefs(f);
  box.value = ""; msg.textContent = got + " added. Use it for headings, body text or numbers below."; msg.className = "font-msg";
  renderFontDlg();
}
function renderFontDlg() {
  const f = fontPrefs();
  f.added.forEach((n) => { loadFont(n); });
  const o = (n, cur) => `<option value="${esc(n)}"${n === cur ? " selected" : ""}>${esc(n)}${n === FONT_DEFAULT.display || n === FONT_DEFAULT.body || n === FONT_DEFAULT.data ? " (original)" : ""}</option>`;
  const options = (cur) => {
    const sug = FONT_SUGGEST.filter((n) => !f.added.includes(n));
    const extra = !f.added.includes(cur) && !FONT_SUGGEST.includes(cur) ? o(cur, cur) : "";
    return extra + (f.added.length ? `<optgroup label="Your fonts">${f.added.map((n) => o(n, cur)).join("")}</optgroup>` : "") + `<optgroup label="Suggestions">${sug.map((n) => o(n, cur)).join("")}</optgroup>`;
  };
  $("#font-roles").innerHTML = FONT_ROLES.map((x) => `<div class="font-role"><label for="font-${x.k}">${x.t}</label><select id="font-${x.k}" data-font-role="${x.k}">${options(f[x.k])}</select><p class="font-sample" style="font-family:'${esc(f[x.k])}', ${esc(x.fb)}">${esc(x.sample)}</p></div>`).join("");
  $("#font-mine").innerHTML = f.added.length ? `<h3 class="font-h">Your fonts</h3>` + f.added.map((n) => `<div class="font-chip"><span class="nm" style="font-family:'${esc(n)}', system-ui">${esc(n)}</span><span class="use">${FONT_ROLES.map((x) => `<button type="button" class="btn sm${f[x.k] === n ? " primary" : ""}" data-action="font-use" data-role="${x.k}" data-name="${esc(n)}" aria-pressed="${f[x.k] === n}">${x.t}</button>`).join("")}<button type="button" class="btn ghost sm" data-action="font-del" data-name="${esc(n)}" aria-label="Remove ${esc(n)}">Remove</button></span></div>`).join("") : "";
}
function openFonts() {
  const d = $("#font-dlg"); renderFontDlg(); $("#font-msg").textContent = "";
  if (typeof d.showModal === "function") { if (!d.open) d.showModal(); } else d.setAttribute("open", "");
}

/* ---------- interactions ---------- */
function bump(f, d) {
  const s = S.servants.find((x) => x.id === shownId());
  if (!s || S.readOnly) return;
  if (f === "level") s.level = clamp((num(s.level) || 1) + d, 1, 120);
  else if (f === "np") s.npLevel = clamp((num(s.npLevel) || 0) + d, 1, 5);
  else if (f.startsWith("sk")) {
    const i = Number(f.slice(2));
    if (!Array.isArray(s.skills)) s.skills = [1, 1, 1];
    let v = s.skills[i];
    if (typeof v !== "number") v = d > 0 ? 1 : "Locked";
    else { v += d; if (v < 1) v = "Locked"; if (v > 10) v = 10; }
    if (v === 10 && s.skills[i] !== 10) S.skCeleb = {id: s.id, i: i, until: Date.now() + 2000};
    s.skills[i] = v;
  }
  renderSummary(); renderList(); renderDossier(); renderRanking();
  scheduleWrite("servants", s);
}

function confirmBox(target, text, yesAction) {
  $(target).innerHTML = `<div class="confirm"><p>${esc(text)}</p><button class="btn danger solid sm" type="button" data-action="${yesAction}">Delete</button><button class="btn ghost sm" type="button" data-action="keep">Keep it</button></div>`;
}

async function exportBackup() {
  const ids = new Set();
  S.servants.forEach((s) => Object.values(s.art || {}).forEach((id) => { if (typeof id === "string") ids.add(id); }));
  const images = {};
  try { const all = await imgStore.all(); for (const id of ids) { const v = all[id]; if (v) images[id] = typeof v === "string" ? v : await blobToDataURL(v); } } catch (e) {}
  const data = JSON.stringify({app: "spirit-origin-list", version: 1, exportedAt: new Date().toISOString(), servants: S.servants, parties: S.parties, guests: S.guests, images: images, settings: {fonts: fontPrefs(), affinity: affOverrides(), tiers: tierOverrides(), have: evPref.have}}, null, 1);
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
      data.when = Date.parse(d.exportedAt) || 0;
      try { data.saved = Date.parse(JSON.parse(localStorage.getItem(LS_KEY) || "{}").savedAt) || 0; } catch (e) { data.saved = 0; }
      data.older = !!(data.when && data.saved && data.when < data.saved);
      data.changed = [];
      COLS.forEach((col) => data[col].forEach((x) => {
        const cur = x.id && S[col].find((y) => y.id === x.id); if (!cur) return;
        const a = Object.assign({}, cur), b2 = Object.assign({}, x); delete a.id; delete b2.id;
        if (stableJSON(a) !== stableJSON(b2)) data.changed.push(x.name + (col === "parties" ? " (party)" : col === "guests" ? " (guest)" : ""));
      }));
      S.importData = data; renderChrome();
    } catch (e) { toast("That file isn't a backup from this page. Pick the .json file from Export backup."); }
  };
  fr.readAsText(file);
}

async function runImport() {
  const d = S.importData; S.importData = null; S.importUndo = null; renderChrome();
  if (!d) return;
  const snap = importSnap();
  importBusy = true;
  try {
    if (d.kind === "planner") {
      const n = await applyPlanner(d);
      importDone(snap, "Imported " + plural(n, "servant") + " from " + d.source + ".");
      return;
    }
    await importBackup(d, snap);
  } finally { importBusy = false; }
}
async function importBackup(d, snap) {
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
      if (await putDoc(col, id, bodyOf(o))) n++; else { if (n) importDone(snap, "Only " + plural(n, "entry", "entries") + " could be imported before saving stopped."); return; }
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
  // 0.24.0: the materials you have (Event calculator and Planner); the backup's counts win for what it lists
  if (d.settings && d.settings.have && typeof d.settings.have === "object") {
    Object.keys(d.settings.have).forEach((k) => { const v = num(d.settings.have[k]); if (/^[\w]{1,24}$/.test(k) && v != null && v >= 0) evPref.have[k] = Math.min(Math.round(v), 9999999999); });
    evPrefSave();
  }
  importDone(snap, "Imported " + plural(n, "entry", "entries") + (imgs ? " and " + plural(imgs, "image") : "") + ".");
}

/* ---------- undoing an import (0.23.1) ---------- */
// An import replaces entries that share an ID, so an older backup can wipe newer progress. Before every import the
// list, the settings a backup carries and the pictures already here are kept in memory; "Undo import" puts them back.
let importBusy = false;
function stableJSON(v) {
  if (Array.isArray(v)) return "[" + v.map(stableJSON).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + stableJSON(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
function dayStr(t) { return new Date(t).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"}); }
function importSnap() {
  Object.keys(timers).forEach((k) => { if (timers[k]) { clearTimeout(timers[k]); timers[k] = null; const o = dirty[k]; if (o) writeDoc(k.split("/")[0], o); } });
  let tiers = null, aff = null, fonts = null, have = null;
  try { tiers = JSON.parse(JSON.stringify(tierOverrides())); aff = JSON.parse(JSON.stringify(affOverrides())); fonts = JSON.parse(JSON.stringify(fontPrefs())); have = JSON.parse(JSON.stringify(evPref.have)); } catch (e) {}
  return {cols: JSON.parse(JSON.stringify({servants: store.servants, parties: store.parties, guests: store.guests})), imgs: new Set(Object.keys(S.urlCache)), tiers: tiers, aff: aff, fonts: fonts, have: have};
}
function importDone(snap, msg) {
  S.importUndo = {snap: snap, msg: msg, later: false};
  renderChrome();
  const n = $("#notice"); if (n && n.getBoundingClientRect().top < 0) n.scrollIntoView({block: "nearest"});
}
async function importUndo() {
  const u = S.importUndo; if (!u || S.readOnly) return;
  S.importUndo = null;
  Object.keys(timers).forEach((k) => { clearTimeout(timers[k]); timers[k] = null; delete dirty[k]; });
  COLS.forEach((c) => { store[c] = JSON.parse(JSON.stringify(u.snap.cols[c] || [])); });
  const ok = persist();
  COLS.forEach((c) => notify(c));
  // pictures the import brought in, and nothing from before uses
  const used = new Set(); store.servants.forEach((x) => Object.values(x.art || {}).forEach((id) => used.add(id)));
  for (const id of Object.keys(S.urlCache)) if (!u.snap.imgs.has(id) && !used.has(id)) { try { await localAssets.delete(id); } catch (e) {} }
  if (u.snap.tiers) { setTierOverrides(u.snap.tiers); }
  if (u.snap.aff) { setAffOverrides(u.snap.aff); }
  if (u.snap.fonts) { setFontPrefs(u.snap.fonts); initFonts(); }
  if (u.snap.have) { evPref.have = u.snap.have; evPrefSave(); }
  renderAll();
  toast(ok ? "Import undone: your list is back the way it was." : "Import undone on screen, but this browser couldn't save it.");
}

document.addEventListener("click", async (e) => {
  const tmn = document.getElementById("tier-menu"); if (tmn && !tmn.hidden && !e.target.closest("#tier-menu") && !e.target.closest(".tier-card")) closeTierMenu();
  const emn = document.getElementById("export-menu"); if (emn && !emn.hidden && !e.target.closest("#export-wrap")) { emn.hidden = true; $("#btn-export").setAttribute("aria-expanded", "false"); }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "tab") { S.tab = b.dataset.tab; if (S.tab !== "servants" && S.selected && !isWide()) { S.selected = null; renderList(); renderDossier(); } renderChrome(); renderVersus(); renderDna(); syncPageTheme(); window.scrollTo({top: 0}); return; }
  if (a === "select") {
    if (S.editing) { dropFormArt(); S.editing = null; }
    S.selected = b.dataset.id; S.lastSel = S.selected; renderList(); renderDossier();
    const d = $("#dossier"); d.scrollTop = 0; return;
  }
  if (a === "close") { if (S.editing) dropFormArt(); S.selected = null; S.editing = null; renderList(); renderDossier(); return; }
  if (a === "theme") { toggleTheme(b); return; }
  if (a === "goal-clear") { const s = S.servants.find((x) => x.id === shownId()); if (s && !S.readOnly) { delete s.goal; scheduleWrite("servants", s); renderDossier(); } return; }
  if (a === "card") { S.card = b.dataset.card; document.querySelectorAll("#f-card button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); renderList(); if (!S.editing) renderDossier(); return; }
  if (a === "clear-filters") {
    S.q = ""; S.cls = ""; S.card = ""; $("#q").value = ""; $("#f-class").value = ""; setTraitFilter("");
    document.querySelectorAll("#f-card button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.card === ""))); renderList(); renderDossier(); return;
  }
  if (a === "bump") { bump(b.dataset.f, Number(b.dataset.d)); return; }
  if (a === "add-servant") { S.tab = "servants"; renderChrome(); openServantEditor(null); return; }
  if (a === "edit") { openServantEditor(shownId()); return; }
  if (a === "cancel-edit") { dropFormArt(); S.editing = null; renderList(); renderDossier(); return; }
  if (a === "ask-delete") { const s = S.servants.find((x) => x.id === S.editing); if (s) confirmBox("#sv-confirm", "Delete " + s.name + " from your roster? This can't be undone.", "do-delete"); return; }
  if (a === "do-delete") {
    const id = S.editing; const s = S.servants.find((x) => x.id === id);
    if (await removeDoc("servants", id)) { S.servants = S.servants.filter((x) => x.id !== id); dropFormArt(); S.editing = null; S.selected = null; toast((s ? s.name : "Servant") + " deleted."); renderAll(); }
    return;
  }
  if (a === "keep") { const c = b.closest(".confirm"); if (c) c.parentElement.innerHTML = ""; return; }
  if (a === "add-party") { S.tab = "parties"; S.partyEdit = "new"; renderChrome(); renderParties(); const f = document.getElementById("pt-name"); if (f) f.focus(); return; }
  if (a === "edit-party") { S.partyEdit = b.dataset.id; renderParties(); return; }
  if (a === "cancel-party") { S.partyEdit = null; renderParties(); return; }
  if (a === "ask-delete-party") { const p = S.parties.find((x) => x.id === S.partyEdit); if (p) confirmBox("#pt-confirm", "Delete the party " + p.name + "?", "do-delete-party"); return; }
  if (a === "do-delete-party") { const id = S.partyEdit; if (await removeDoc("parties", id)) { S.parties = S.parties.filter((x) => x.id !== id); S.partyEdit = null; toast("Party deleted."); renderParties(); } return; }
  if (a === "add-guest") { S.tab = "guests"; S.guestEdit = "new"; renderChrome(); renderGuests(); const f = document.getElementById("gs-name"); if (f) f.focus(); return; }
  if (a === "edit-guest") { S.guestEdit = b.dataset.id; renderGuests(); return; }
  if (a === "cancel-guest") { S.guestEdit = null; renderGuests(); return; }
  if (a === "ask-delete-guest") { const g = S.guests.find((x) => x.id === S.guestEdit); if (g) confirmBox("#gs-confirm", "Delete " + g.name + " from your guest list?", "do-delete-guest"); return; }
  if (a === "do-delete-guest") { const id = S.guestEdit; if (await removeDoc("guests", id)) { S.guests = S.guests.filter((x) => x.id !== id); S.guestEdit = null; toast("Guest deleted."); renderGuests(); } return; }
  if (a === "stage") {
    const s = S.servants.find((x) => x.id === shownId()); if (!s) return;
    const k = b.dataset.slot; setView(s, k); S.artConfirm = null;
    if (artOf(s, k) && s.artStage !== k && !S.readOnly && S.db) { s.artStage = k; renderList(); renderParties(); scheduleWrite("servants", s); }
    renderDossier(); return;
  }
  if (a === "art-next") {
    const s = S.servants.find((x) => x.id === shownId()); if (!s) return;
    const filled = slotsOf(s).filter((x) => artOf(s, x.k)).map((x) => x.k); if (filled.length < 2) return;
    const k = filled[(filled.indexOf(viewSlot(s)) + 1) % filled.length]; setView(s, k);
    if (!S.readOnly && S.db) { s.artStage = k; renderList(); renderParties(); scheduleWrite("servants", s); }
    renderDossier(); return;
  }
  if (a === "art-remove") { S.artConfirm = b.dataset.slot; renderDossier(); return; }
  if (a === "art-keep") { S.artConfirm = null; renderDossier(); return; }
  if (a === "art-remove-go") { removeArt(shownId(), b.dataset.slot); return; }
  if (a === "add-costume") {
    const s = S.servants.find((x) => x.id === shownId()); if (!s || S.readOnly) return;
    const n = costumeCount(s); if (n >= MAX_COSTUMES) return;
    s.costumeSlots = n + 1; S.viewStage[s.id] = "c" + (n + 1);
    renderDossier(); scheduleWrite("servants", s); toast("Costume " + (n + 1) + " slot added."); return;
  }
  if (a === "remove-costume-slot") {
    const s = S.servants.find((x) => x.id === shownId()); if (!s) return;
    const n = costumeCount(s); if (n <= 1 || artOf(s, "c" + n)) return;
    s.costumeSlots = n - 1; S.viewStage[s.id] = n - 1 === 1 ? "c" : "c" + (n - 1);
    if (s.artNames && s.artNames["c" + n] != null) { const nm = Object.assign({}, s.artNames); delete nm["c" + n]; s.artNames = nm; }
    renderDossier(); scheduleWrite("servants", s); return;
  }
  if (a === "np-edit") { const s = curServant(); if (!s) return; S.npEdit = S.npEdit === s.id ? null : s.id; S.npConfirm = null; renderDossier(true); return; }
  if (a === "np-ver") { const s = curServant(); if (!s) return; S.npVer[s.id] = Number(b.dataset.i) || 0; S.npConfirm = null; renderDossier(true); return; }
  if (a === "np-ver-add") {
    const s = curServant(); if (!s || S.readOnly) return;
    const T = npEnsure(s), vi = npVi(s, T), src = T.v[vi], copy = JSON.parse(JSON.stringify(src));
    copy.name = npField(s, src, vi, "name"); copy.card = npField(s, src, vi, "card"); copy.tab = "";
    T.v.push(copy); S.npVer[s.id] = T.v.length - 1; S.npConfirm = null;
    scheduleWrite("servants", s); renderDossier(true);
    const tn = document.getElementById("np-tab"); if (tn) tn.focus();
    toast("Version added as a copy. Give it a tab name, then change what differs."); return;
  }
  if (a === "np-ver-del") { const s = curServant(); if (!s) return; S.npConfirm = npVi(s, npTableOf(s).T); renderDossier(true); return; }
  if (a === "np-ver-keep") { S.npConfirm = null; renderDossier(true); return; }
  if (a === "np-ver-del-go") {
    const s = curServant(); if (!s || S.readOnly) return;
    const T = npEnsure(s), vi = npVi(s, T); if (npInGroup(T, T.v[vi].grp).length < 2) return;
    if (vi === 0) { const nx = T.v[1]; if (nx.name) s.npName = nx.name; if (CARDS.includes(nx.card)) s.npCard = nx.card; }
    T.v.splice(vi, 1); S.npVer[s.id] = Math.max(0, vi - 1); S.npConfirm = null;
    scheduleWrite("servants", s); renderDossier(true); renderList(); renderSummary(); toast("Version deleted."); return;
  }
  if (a === "np-row-add") {
    const s = curServant(); if (!s || S.readOnly) return;
    const T = npEnsure(s), V = T.v[npVi(s, T)], kind = b.dataset.kind === "o" ? "o" : "r", rows = kind === "o" ? V.ocRows : V.rows;
    rows.push(blankRow()); scheduleWrite("servants", s); renderDossier(true);
    const c = document.querySelector('[data-np="' + kind + ":" + (rows.length - 1) + ':label"]'); if (c) c.focus(); return;
  }
  if (a === "np-row-del") {
    const s = curServant(); if (!s || S.readOnly) return;
    const T = npEnsure(s), V = T.v[npVi(s, T)], rows = b.dataset.kind === "o" ? V.ocRows : V.rows, i = Number(b.dataset.i);
    if (i >= 0 && i < rows.length) { rows.splice(i, 1); scheduleWrite("servants", s); renderDossier(true); }
    return;
  }
  if (a === "sk-levels") { const s = curServant(); if (!s) return; const k = s.id + ":" + (b.dataset.k || 0) + ":" + b.dataset.i; S.skOpen[k] = !S.skOpen[k]; renderDossier(true); const nb = document.querySelector('[data-action="sk-levels"][data-i="' + b.dataset.i + '"]'); if (nb) nb.focus(); return; }
  if (a === "sc-add") { const box = document.getElementById(b.dataset.target); if (!box) return; box.insertAdjacentHTML("beforeend", scaleRowHTML({})); const f = box.lastElementChild.querySelector("input"); if (f) f.focus(); return; }
  if (a === "sc-del") { const row = b.closest(".sc-row"); if (!row) return; const box = row.parentElement; row.remove(); if (!box.querySelector(".sc-row")) box.insertAdjacentHTML("beforeend", scaleRowHTML({})); return; }
  if (a === "ps-edit") {
    const s = curServant(); if (!s) return;
    if (S.psEdit === s.id) { S.psEdit = null; const list = passivesOf(s), kept = list.filter((x) => x.name || x.rank || x.effect); if (kept.length !== list.length) { s.passives = kept; scheduleWrite("servants", s); } }
    else S.psEdit = s.id;
    renderDossier(true); return;
  }
  if (a === "ps-add") {
    const s = curServant(); if (!s || S.readOnly) return;
    const list = passivesOf(s); list.push({name: "", rank: "", effect: ""}); s.passives = list; S.psEdit = s.id;
    scheduleWrite("servants", s); renderDossier(true);
    const c = document.querySelector('[data-ps="' + (list.length - 1) + ':name"]'); if (c) { c.focus(); c.scrollIntoView({block: "nearest"}); }
    return;
  }
  if (a === "ps-move") {
    const s = curServant(); if (!s || S.readOnly) return;
    const list = passivesOf(s), i = Number(b.dataset.i), j = i + Number(b.dataset.d);
    if (j < 0 || j >= list.length) return;
    const tmp = list[i]; list[i] = list[j]; list[j] = tmp; s.passives = list;
    scheduleWrite("servants", s); renderDossier(true);
    const nb = document.querySelector('[data-action="ps-move"][data-i="' + j + '"][data-d="' + b.dataset.d + '"]'); if (nb && !nb.disabled) nb.focus();
    return;
  }
  if (a === "ps-del") {
    const s = curServant(); if (!s || S.readOnly) return;
    const list = passivesOf(s), i = Number(b.dataset.i), gone = list[i]; if (!gone) return;
    list.splice(i, 1); s.passives = list; if (!list.length) S.psEdit = null;
    scheduleWrite("servants", s); renderDossier(true); toast((gone.name || "Passive skill") + " removed."); return;
  }
  if (a === "deck") {
    const s = curServant(); if (!s || S.readOnly) return;
    const d = deckOf(s), i = Number(b.dataset.i); if (!(i >= 0 && i < 5)) return;
    d[i] = DECK_NEXT[d[i]] || "Quick"; s.deck = d;
    scheduleWrite("servants", s); renderDossier(true);
    const nb = document.querySelector('[data-action="deck"][data-i="' + i + '"]'); if (nb) { nb.classList.add("flip"); nb.focus(); }
    return;
  }
  if (a === "deck-sort") {
    const s = curServant(); if (!s || S.readOnly) return;
    const order = {Quick: 0, Arts: 1, Buster: 2, "": 3}; s.deck = deckOf(s).sort((x, y) => order[x] - order[y]);
    scheduleWrite("servants", s); renderDossier(true); return;
  }
  if (a === "deck-clear") { const s = curServant(); if (!s || S.readOnly) return; s.deck = []; scheduleWrite("servants", s); renderDossier(true); toast("Deck cleared."); return; }
  if (a === "np-form") {
    const s = curServant(); if (!s) return;
    const T = npTableOf(s).T, i = Number(b.dataset.i); if (!(i >= 0 && i < T.g.length)) return;
    const claimed = [].concat(...T.g.map((G) => G.slots)), to = viewFor(s, T.g[i].slots, i === 0 ? claimed : []);
    if (to) setView(s, to, "np");
    S.npGrp[s.id] = i; delete S.npVer[s.id]; S.npConfirm = null; renderDossier(true); return;
  }
  if (a === "np-form-add") {
    const s = curServant(); if (!s || S.readOnly) return;
    const T = npEnsure(s), cur = T.v[npVi(s, T)], slot = viewSlot(s);
    const free = !T.g.some((G) => G.slots.includes(slot)) && (/^c\d*$/.test(slot) || slot !== "1");
    T.g.push({name: free ? slotLabel(s, slot) : "", slots: free ? [slot] : []});
    const copy = JSON.parse(JSON.stringify(cur)); copy.grp = T.g.length - 1; copy.tab = ""; copy.name = npField(s, cur, T.v.indexOf(cur), "name"); copy.card = npField(s, cur, T.v.indexOf(cur), "card");
    T.v.push(copy); S.npGrp[s.id] = T.g.length - 1; S.npVer[s.id] = T.v.length - 1; S.npConfirm = null;
    scheduleWrite("servants", s); renderDossier(true);
    const f = document.getElementById("np-form"); if (f) f.focus();
    toast(free ? "Form added and linked to " + slotLabel(s, slot) + ". Change what differs." : "Form added. Name it and link it to a stage or costume."); return;
  }
  if (a === "np-form-del") { const s = curServant(); if (!s) return; S.npConfirm = "g" + npGi(s, npTableOf(s).T); renderDossier(true); return; }
  if (a === "np-form-del-go") {
    const s = curServant(); if (!s || S.readOnly) return;
    const T = npEnsure(s), gi = npGi(s, T); if (T.g.length < 2) return;
    const first = T.v[0];
    T.v = T.v.filter((x) => x.grp !== gi); T.v.forEach((x) => { if (x.grp > gi) x.grp--; }); T.g.splice(gi, 1);
    if (T.v[0] !== first) { if (T.v[0].name) s.npName = T.v[0].name; if (CARDS.includes(T.v[0].card)) s.npCard = T.v[0].card; }
    delete S.npGrp[s.id]; delete S.npVer[s.id]; S.npConfirm = null;
    scheduleWrite("servants", s); renderDossier(true); renderList(); renderSummary(); toast("Form deleted."); return;
  }
  if (a === "np-link") {
    const s = curServant(); if (!s || S.readOnly) return;
    const T = npEnsure(s), gi = npGi(s, T), k = b.dataset.slot, G = T.g[gi];
    if (G.slots.includes(k)) G.slots = G.slots.filter((x) => x !== k);
    else { T.g.forEach((x) => { x.slots = x.slots.filter((y) => y !== k); }); G.slots.push(k); }
    S.npGrp[s.id] = gi; scheduleWrite("servants", s); renderDossier(true); return;
  }
  if (a === "sk-sets-on" || a === "sk-set-add") {
    const s = curServant(); if (!s || S.readOnly) return;
    const sets = skSets(s), slot = viewSlot(s), auto = /^c\d*$/.test(slot) && !sets.some((x) => (x.slots || []).includes(slot));
    sets.push({name: auto ? slotLabel(s, slot) : "", slots: auto ? [slot] : [], info: [{}, {}, {}]});
    s.skillSets = sets; S.skMgr[s.id] = true; S.skSet[s.id] = sets.length; S.skConfirm = null;
    scheduleWrite("servants", s); renderDossier(true);
    const f = document.querySelector('[data-skset-name="' + sets.length + '"]'); if (f) { f.focus(); f.scrollIntoView({block: "nearest"}); }
    toast(auto ? "Skill set added for " + slotLabel(s, slot) + ". Press Edit its skills to fill it in." : "Skill set added. Name it, link it, then press Edit its skills."); return;
  }
  if (a === "sk-mgr") { const s = curServant(); if (!s) return; S.skMgr[s.id] = !S.skMgr[s.id]; S.skConfirm = null; renderDossier(true); return; }
  if (a === "sk-set") {
    const s = curServant(); if (!s) return;
    const sets = skSets(s), k = Number(b.dataset.k); if (!(k >= 0 && k <= sets.length)) return;
    const claimed = [].concat(...sets.map((x) => x.slots || [])), to = viewFor(s, k ? (sets[k - 1].slots || []) : [], k ? [] : claimed);
    if (to) setView(s, to, "sk");
    S.skSet[s.id] = k; renderDossier(true);
    const nb = document.querySelector('[data-action="sk-set"][data-k="' + k + '"]'); if (nb) nb.focus(); return;
  }
  if (a === "sk-link") {
    const s = curServant(); if (!s || S.readOnly) return;
    const sets = skSets(s), set = sets[Number(b.dataset.k) - 1], k = b.dataset.slot; if (!set) return;
    const has = (set.slots || []).includes(k);
    sets.forEach((x) => { x.slots = (x.slots || []).filter((y) => y !== k); });
    if (!has) set.slots.push(k);
    s.skillSets = sets; scheduleWrite("servants", s); renderDossier(true); return;
  }
  if (a === "sk-set-edit") {
    const s = curServant(); if (!s || S.readOnly) return;
    openServantEditor(s.id);
    const fs = document.getElementById("fs-skset-" + b.dataset.k); if (fs) { fs.scrollIntoView({block: "start"}); const f = fs.querySelector("input"); if (f) f.focus({preventScroll: true}); }
    return;
  }
  if (a === "sk-set-del") { S.skConfirm = Number(b.dataset.k); renderDossier(true); return; }
  if (a === "sk-set-keep") { S.skConfirm = null; renderDossier(true); return; }
  if (a === "sk-set-del-go") {
    const s = curServant(); if (!s || S.readOnly) return;
    const sets = skSets(s), k = Number(b.dataset.k), gone = sets[k - 1]; if (!gone) return;
    sets.splice(k - 1, 1); s.skillSets = sets; delete S.skSet[s.id]; S.skConfirm = null; if (!sets.length) delete S.skMgr[s.id];
    scheduleWrite("servants", s); renderDossier(true); toast((gone.name || "Skill set") + " deleted."); return;
  }
  if (a === "trait-filter") {
    const tag = b.dataset.tag; if (!tag) return;
    setTraitFilter(tag); S.tab = "servants"; if (S.selected && !isWide()) S.selected = null;
    renderChrome(); renderList(); if (!S.editing) renderDossier();
    const n = S.servants.filter((x) => tagsOf(x).includes(tag)).length;
    toast("Showing the " + n + " servant" + (n === 1 ? "" : "s") + " with " + tagLabel(tag) + "."); return;
  }
  if (a === "trait-clear") { setTraitFilter(""); renderList(); if (!S.editing) renderDossier(); return; }
  if (a === "edit-traits") { const s = curServant(); if (!s || S.readOnly) return; openServantEditor(s.id); const fs = document.getElementById("fs-traits"); if (fs) { fs.scrollIntoView({block: "start"}); const f = fs.querySelector("select, button"); if (f) f.focus({preventScroll: true}); } return; }
  if (a === "tr-toggle") { const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); b.classList.toggle("on", on); refreshTraitLive(); return; }
  if (a === "tr-add") { addTraitFromInput(); return; }
  if (a === "tr-buff-add") { const box = document.getElementById("tr-buffs"); if (!box) return; box.insertAdjacentHTML("beforeend", buffRowHTML({tag: "", what: ""}, readTraitsForm())); const f = box.lastElementChild.querySelector("select"); if (f) f.focus(); return; }
  if (a === "tr-buff-del") { const r = b.closest(".tr-buff"); if (r) r.remove(); refreshTraitLive(); return; }
  if (a === "rank-view") { setRankView(b.dataset.v === "tiers" ? "tiers" : "list"); closeTierMenu(); renderRanking(); return; }
  if (a === "tier-card") { if (tierJustDragged) return; const m = document.getElementById("tier-menu"); if (m && !m.hidden && m.dataset.for === b.dataset.id) { closeTierMenu(); return; } openTierMenu(b); return; }
  if (a === "tier-set") {
    const id = b.dataset.id, k = b.dataset.k || "", s = S.servants.find((x) => x.id === id), r = rankRows().find((x) => x.s.id === id); if (!s || !r) return;
    setTier(id, k); closeTierMenu(); renderRanking();
    const c = document.querySelector('.tier-card[data-id="' + id + '"]'); if (c) c.focus({preventScroll: true});
    toast(k ? s.name + " moved to " + tierName(k) + "." : s.name + " is back in " + tierName(autoTier(r.sc.total)) + ", where the score puts them."); return;
  }
  if (a === "export-menu") { const m = $("#export-menu"), open = m.hidden; m.hidden = !open; b.setAttribute("aria-expanded", String(open)); if (open) { const f = m.querySelector("button"); if (f) f.focus(); } return; }
  if (a === "export-csv" || a === "export-planner") { $("#export-menu").hidden = true; $("#btn-export").setAttribute("aria-expanded", "false"); exportFile(a === "export-csv" ? "csv" : "planner"); return; }
  if (a === "dna-mode") { S.dnaMode = b.dataset.v; renderDna(); const nb = document.querySelector('[data-action="dna-mode"][data-v="' + S.dnaMode + '"]'); if (nb) nb.focus(); return; }
  if (a === "dna-save") {
    if (S.readOnly) return;
    const team = (b.dataset.ids || "").split(",").map((id) => S.servants.find((x) => x.id === id)).filter(Boolean); if (!team.length) return;
    const o = {name: (b.dataset.name || "Party DNA team").slice(0, 90), bestFor: b.dataset.why || null, front: [0, 1, 2].map((i) => team[i] ? team[i].name : ""), back: ["", "", ""], ce: [], guest: null, guestCe: null, strategy: null};
    o.id = slug(o.name, S.parties); o.order = nextOrder(S.parties);
    if (await writeDoc("parties", o)) { if (!S.parties.some((x) => x.id === o.id)) S.parties.push(o); renderParties(); toast("Saved as a party. It's in the list below."); }
    return;
  }
  if (a === "fa-pick") { S.formArtSlot = b.dataset.slot; document.querySelectorAll("#fs-art .fa-tile").forEach((t) => t.classList.toggle("on", t === b)); return; }
  if (a === "fa-clear") {
    const k = b.dataset.slot; if (!S.formArt) return;
    const id = S.formArt[k]; delete S.formArt[k];
    if (id && S.formArtNew.includes(id)) { S.formArtNew = S.formArtNew.filter((x) => x !== id); Promise.resolve().then(() => S.assets.delete(id)).catch(() => {}); }
    S.formArtSlot = k; renderFormArt(); return;
  }
  if (a === "add-wish") { S.tab = "servants"; renderChrome(); S.newWish = true; openServantEditor(null); S.newWish = false; return; }
  if (a === "summon") { summonServant(b.dataset.id); return; }
  if (a === "vs-add") {
    const id = b.dataset.id; if (!S.servants.some((x) => x.id === id)) return;
    const cur = vsPicks(), ids = [id].concat(cur.filter((x) => x !== id)).slice(0, Math.max(2, cur.length));
    setVsPicks(ids);
    S.tab = "versus"; if (S.selected && !isWide()) { S.selected = null; renderList(); renderDossier(); }
    renderChrome(); renderVersus(); window.scrollTo({top: 0});
    const me = S.servants.find((x) => x.id === id), o = S.servants.find((x) => x.id === ids[1]);
    if (me && o) toast("Comparing " + me.name + " with " + o.name + ". Pick someone else at the top.");
    return;
  }
  if (a === "vs-swap") { const ids = vsPicks(); if (ids.length < 2) return; const t0 = ids[0]; ids[0] = ids[1]; ids[1] = t0; setVsPicks(ids); renderVersus(); const nb = document.querySelector('[data-action="vs-swap"]'); if (nb) nb.focus(); return; }
  if (a === "vs-add3") {
    const ids = vsPicks(); if (ids.length >= 3) return;
    const nx = rankRows().map((r) => r.s.id).concat(S.servants.map((x) => x.id)).find((id) => !ids.includes(id)); if (!nx) return;
    ids.push(nx); setVsPicks(ids); renderVersus(); const ns = document.querySelector('[data-vs-pick="2"]'); if (ns) ns.focus(); return;
  }
  if (a === "vs-del") { const ids = vsPicks(); if (ids.length < 3) return; ids.splice(2, 1); setVsPicks(ids); renderVersus(); return; }
  if (a === "aff-edit") { S.affEdit = !S.affEdit; S.affConfirm = false; renderVersus(); const nb = document.querySelector('[data-action="aff-edit"]'); if (nb) nb.focus({preventScroll: true}); return; }
  if (a === "aff-cycle") { const A = b.dataset.a, D = b.dataset.d; affCycle(A, D); renderVersus(); const nb = document.querySelector('[data-action="aff-cycle"][data-a="' + A + '"][data-d="' + D + '"]'); if (nb) nb.focus({preventScroll: true}); return; }
  if (a === "aff-reset") { S.affConfirm = true; renderVersus(); const nb = document.querySelector('[data-action="aff-reset-go"]'); if (nb) nb.focus({preventScroll: true}); return; }
  if (a === "aff-keep") { S.affConfirm = false; renderVersus(); return; }
  if (a === "aff-reset-go") { setAffOverrides({}); S.affConfirm = false; renderVersus(); toast("The class chart is back to the standard values."); return; }
  if (a === "fonts") { openFonts(); return; }
  if (a === "font-close") { $("#font-dlg").close(); return; }
  if (a === "font-add") { fontAdd(); return; }
  if (a === "font-use") { setFontRole(b.dataset.role, b.dataset.name); return; }
  if (a === "font-del") {
    const n = b.dataset.name, f = fontPrefs();
    f.added = f.added.filter((x) => x !== n);
    FONT_ROLES.forEach((x) => { if (f[x.k] === n) f[x.k] = FONT_DEFAULT[x.k]; });
    setFontPrefs(f); applyFonts(f); renderFontDlg(); return;
  }
  if (a === "font-reset") { const f = fontPrefs(); Object.assign(f, FONT_DEFAULT); setFontPrefs(f); applyFonts(f); renderFontDlg(); toast("Back to the original fonts."); return; }
  if (a === "goto") { closeTierMenu(); if (S.editing) dropFormArt(); S.tab = "servants"; S.selected = b.dataset.id; S.editing = null; renderChrome(); renderList(); renderDossier(); window.scrollTo({top: 0}); return; }
  if (a === "rank-seen") { const m = {}; rankRows().forEach((r, i) => { m[r.s.id] = i + 1; }); setRankBase(m); renderRanking(); toast("Rank changes reset."); return; }
  if (a === "export") { const em = $("#export-menu"); if (em) { em.hidden = true; $("#btn-export").setAttribute("aria-expanded", "false"); } exportBackup(); return; }
  if (a === "import-go") { runImport(); return; }
  if (a === "import-cancel") { S.importData = null; renderChrome(); return; }
  if (a === "import-undo") { importUndo(); return; }
  if (a === "import-keep") { S.importUndo = null; renderChrome(); return; }
  if (a === "save-retry") { if (!persist()) toast("Still no room to save. Make some space first, then try again."); return; }
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id === "servant-form") submitServant();
  else if (e.target.id === "party-form") submitParty();
  else if (e.target.id === "guest-form") submitGuest();
});

$("#q").addEventListener("input", (e) => { S.q = e.target.value; renderList(); if (!S.editing) renderDossier(); });
$("#f-class").addEventListener("change", (e) => { S.cls = e.target.value; renderList(); if (!S.editing) renderDossier(); });
$("#f-trait").addEventListener("change", (e) => { S.trait = e.target.value; renderList(); if (!S.editing) renderDossier(); });
window.addEventListener("scroll", () => closeTierMenu(), true);
function addTraitFromInput() {
  const inp = document.getElementById("sv-trait-new"), box = document.getElementById("tr-traits"); if (!inp || !box) return;
  const v = normTrait(inp.value).slice(0, 40); if (!v) { inp.focus(); return; }
  let chip = Array.from(box.querySelectorAll(".tr-chip")).find((c) => c.dataset.v.toLowerCase() === v.toLowerCase());
  if (!chip) { box.insertAdjacentHTML("beforeend", trChip("traits", v, true)); chip = box.lastElementChild; }
  chip.setAttribute("aria-pressed", "true"); chip.classList.add("on"); chip.scrollIntoView({block: "nearest"});
  inp.value = ""; inp.focus(); refreshTraitLive();
}
$("#f-sort").addEventListener("change", (e) => { S.sort = e.target.value; renderList(); if (!S.editing) renderDossier(); });
$("#f-import").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) readImport(f); e.target.value = ""; });
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t && t.id === "dna-wish") { S.dnaWish = t.checked; renderDna(); const c = document.getElementById("dna-wish"); if (c) c.focus(); return; }
  if (t && (t.id === "sv-attr" || (t.dataset && t.dataset.buffTag != null))) { refreshTraitLive(); return; }
  if (t && t.dataset && t.dataset.vsPick != null) {
    const ids = vsPicks(), i = Number(t.dataset.vsPick), v = t.value, j = ids.indexOf(v);
    if (!(i >= 0 && i < ids.length) || !S.servants.some((x) => x.id === v)) return;
    if (j >= 0 && j !== i) ids[j] = ids[i];
    ids[i] = v; setVsPicks(ids); renderVersus();
    const ns = document.querySelector('[data-vs-pick="' + i + '"]'); if (ns) ns.focus({preventScroll: true}); return;
  }
  if (t && t.dataset && t.dataset.formArt) { const f = t.files && t.files[0]; if (f) formArtUpload(t.dataset.formArt, f); t.value = ""; return; }
  if (t && t.id === "sv-wish") { const sb = document.querySelector('#servant-form button[type="submit"]'); if (sb && S.editing === "new") sb.textContent = t.checked ? "Add to Guests" : "Add to roster"; return; }
  if (t && (t.id === "fou-hp" || t.id === "fou-atk")) {
    const s = S.servants.find((x) => x.id === shownId()); if (!s || S.readOnly) return;
    s[t.id === "fou-hp" ? "fouHp" : "fouAtk"] = clamp(Math.round(num(t.value) || 0), 0, 3000);
    renderSummary(); renderList(); renderDossier(); renderRanking(); scheduleWrite("servants", s); return;
  }
  if (t && t.dataset && t.dataset.costumeName != null) {
    const s = curServant(); if (!s || S.readOnly) return;
    const k = t.dataset.costumeName, v = t.value.replace(/\s+/g, " ").trim().slice(0, 48);
    if (v === costumeName(s, k)) return;
    const names = Object.assign({}, s.artNames || {}); if (v) names[k] = v; else delete names[k]; s.artNames = names;
    scheduleWrite("servants", s); renderDossier(true); toast(v ? "Costume renamed to " + v + "." : "Costume name cleared."); return;
  }
  if (t && t.dataset && t.dataset.npIn != null && t.tagName === "SELECT") { npWrite(t.dataset.npIn, t.value); renderDossier(true); renderList(); renderSummary(); return; }
  if (t && t.dataset && t.dataset.fontRole) { setFontRole(t.dataset.fontRole, t.value); return; }
  if (t && t.dataset && t.dataset.sksetName != null) {
    const s = curServant(); if (!s || S.readOnly) return;
    const k = Number(t.dataset.sksetName), v = t.value.replace(/\s+/g, " ").trim().slice(0, 40);
    if (k === 0) s.skillBaseName = v || null; else { const sets = skSets(s); if (!sets[k - 1]) return; sets[k - 1].name = v; s.skillSets = sets; }
    scheduleWrite("servants", s); renderDossier(true); return;
  }
  if (t && t.dataset && t.dataset.artFile) { const f = t.files && t.files[0]; const id = shownId(); if (f && id) uploadArt(id, t.dataset.artFile, f); t.value = ""; }
});
let trPasteT = 0, trLiveT = 0;
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.id === "tr-paste") { clearTimeout(trPasteT); trPasteT = setTimeout(() => applyWikiPaste(parseWikiPaste(t.value, "")), 450); return; }
  if (/-s\d-effect$/.test(t.id || "") && document.getElementById("fs-traits")) { clearTimeout(trLiveT); trLiveT = setTimeout(refreshTraitLive, 450); }
  if ((t.dataset.np != null || t.dataset.ps != null) && t.isContentEditable) {
    const multi = t.classList.contains("multi");
    const v = multi ? multiText(t.innerText) : t.textContent.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if (!v && t.innerHTML) t.innerHTML = "";
    if (t.dataset.np != null) npWrite(t.dataset.np, v); else psWrite(t.dataset.ps, v);
    return;
  }
  if (t.dataset.npIn != null && t.tagName === "INPUT") {
    npWrite(t.dataset.npIn, t.value.replace(/\s+/g, " ").trim());
    const s = curServant(), form = t.dataset.npIn === "g:name", b = document.querySelector(form ? '.npt-forms [aria-selected="true"]' : '.npt-vers [aria-selected="true"]');
    if (s && b) { const T = npTableOf(s).T, gi = npGi(s, T), vi = npVi(s, T); b.textContent = form ? npFormLabel(T.g[gi], gi) : npTabLabel(T.v[vi], npInGroup(T, gi).indexOf(vi)); }
  }
});
document.addEventListener("paste", (e) => {
  const pt = e.target;
  if (pt && pt.id === "tr-paste") {
    e.preventDefault();
    const html = (e.clipboardData && e.clipboardData.getData("text/html")) || "";
    let text = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
    if (!text && html) { try { text = new DOMParser().parseFromString(html, "text/html").body.textContent || ""; } catch (err) {} }
    pt.value = text.replace(/\s+/g, " ").trim().slice(0, 4000);
    applyWikiPaste(parseWikiPaste(text, html)); return;
  }
  if (pt && pt.isContentEditable) {
    e.preventDefault();
    const raw = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
    const txt = pt.closest && pt.closest(".multi") ? raw.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ") : raw.replace(/\s+/g, " ");
    if (txt) document.execCommand("insertText", false, txt);
    return;
  }
  if (S.editing && S.formArt && S.assets && !S.readOnly && document.getElementById("fs-art")) {
    const its = (e.clipboardData && e.clipboardData.items) ? Array.from(e.clipboardData.items) : [];
    const img = its.find((x) => x.kind === "file" && /^image\//.test(x.type)), tg = (e.target && e.target.tagName) || "";
    if (img && (!/INPUT|TEXTAREA/.test(tg) || !its.some((x) => x.type === "text/plain"))) {
      e.preventDefault();
      const slot = S.formArtSlot || (FORM_SLOTS.find((x) => !S.formArt[x.k]) || FORM_SLOTS[0]).k;
      formArtUpload(slot, img.getAsFile());
    }
    return;
  }
  if (S.tab !== "servants" || S.editing || !S.assets || S.readOnly) return;
  const tag = (e.target && e.target.tagName) || "";
  if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  const s = S.servants.find((x) => x.id === shownId()); if (!s) return;
  const items = (e.clipboardData && e.clipboardData.items) ? Array.from(e.clipboardData.items) : [];
  const it = items.find((x) => x.kind === "file" && /^image\//.test(x.type));
  if (!it) { if (items.length) toast("Copy the image itself (right-click it, then Copy image) and paste again."); return; }
  e.preventDefault(); uploadArt(s.id, viewSlot(s), it.getAsFile());
});
document.addEventListener("dragover", (e) => { const z = e.target.closest && e.target.closest("[data-drop], [data-fa-drop]"); if (z && S.assets && !S.readOnly) { e.preventDefault(); z.classList.add("dragging"); } });
document.addEventListener("dragleave", (e) => { const z = e.target.closest && e.target.closest("[data-drop], [data-fa-drop]"); if (z) z.classList.remove("dragging"); });
document.addEventListener("drop", (e) => {
  const fz = e.target.closest && e.target.closest("[data-fa-drop]");
  if (fz) { e.preventDefault(); fz.classList.remove("dragging"); const ff = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (ff) formArtUpload(fz.dataset.faDrop, ff); else toast("Drop an image file from your computer, or copy the image and paste it."); return; }
  const z = e.target.closest && e.target.closest("[data-drop]"); if (!z) return;
  e.preventDefault(); z.classList.remove("dragging");
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; const id = shownId();
  if (f && id) uploadArt(id, z.dataset.drop, f); else toast("Drop an image file from your computer, or copy the image and paste it.");
});
document.addEventListener("error", (e) => { const t = e.target; if (t && t.tagName === "IMG" && t.dataset && t.dataset.art) t.classList.add("broken"); }, true);
document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (e.key === "Escape") {
    const tmn = document.getElementById("tier-menu"); if (tmn && !tmn.hidden) { e.preventDefault(); closeTierMenu(true); return; }
    const emn = document.getElementById("export-menu"); if (emn && !emn.hidden) { e.preventDefault(); emn.hidden = true; const eb = $("#btn-export"); eb.setAttribute("aria-expanded", "false"); eb.focus(); return; }
  }
  if (t && t.id === "sv-trait-new" && e.key === "Enter") { e.preventDefault(); addTraitFromInput(); return; }
  if (t && t.dataset && t.dataset.buffWhat != null && e.key === "Enter") { e.preventDefault(); t.blur(); return; }
  if (t && t.isContentEditable && t.dataset && (t.dataset.np != null || t.dataset.ps != null)) {
    if (e.key === "Escape") { e.preventDefault(); t.blur(); }
    else if (e.key === "Enter") { e.preventDefault(); if (t.classList.contains("multi")) document.execCommand("insertLineBreak"); else t.blur(); }
    return;
  }
  if (t && t.dataset && (t.dataset.npIn != null || t.dataset.costumeName != null || t.dataset.sksetName != null) && t.tagName === "INPUT" && e.key === "Enter") { e.preventDefault(); t.blur(); return; }
  if (t && t.id === "font-new" && e.key === "Enter") { e.preventDefault(); fontAdd(); return; }
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "Escape" && S.selected && !S.editing && !document.querySelector("dialog[open]")) { S.selected = null; renderList(); renderDossier(); }
});
$("#font-dlg").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
window.matchMedia("(min-width: 901px)").addEventListener("change", () => { renderList(); if (!S.editing) renderDossier(); });

