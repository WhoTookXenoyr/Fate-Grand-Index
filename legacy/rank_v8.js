// Skills count like the game: each level moves 10% of the Lv1→Lv10 gap, Lv10 gets the full value, and Lv6 and Lv10 each cut the cooldown by a turn
function skillPower(v) {
  if (typeof v !== "number") return 0;
  const lv = clamp(v, 1, 10);
  return 0.8 * (lv >= 10 ? 1 : (lv - 1) / 10) + 0.2 * ((lv >= 6 ? 0.5 : 0) + (lv >= 10 ? 0.5 : 0));
}
// Level: steady growth, plus a bump for reaching max level and for Lv 100
function levelPart(lv, cap) { return 6.5 * lv / 120 + (cap && lv >= cap ? 2 : 0) + (lv >= 100 ? 1.5 : 0); }
function scoreOf(s, over) {
  over = over || {};
  const atk = total(s, "atk"), hp = total(s, "hp"), mod = CLASS_ATK[s.cls] || 1;
  const missing = atk == null || hp == null;
  const sk = over.skills || s.skills || [], lv = clamp(num(over.level != null ? over.level : s.level) || 1, 1, 120);
  const parts = {
    stats: missing ? 0 : Math.min(1, (atk * mod / 16000) * 0.7 + (hp / 18000) * 0.3) * 35,
    skills: [0, 1, 2].reduce((a, i) => a + skillPower(sk[i]), 0) / 3 * 30,
    np: clamp(num(s.npLevel) || 1, 1, 5) / 5 * 15,
    level: levelPart(lv, CAPS[s.rarity]),
    rarity: clamp(num(s.rarity) || 0, 0, 5) / 5 * 10
  };
  return {total: parts.stats + parts.skills + parts.np + parts.level + parts.rarity, parts: parts, missing: missing};
}
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
    return `<section class="tier-row t-${t.k.toLowerCase()}" data-tier-drop="${t.k}" aria-label="Tier ${t.k}, score ${range}"><div class="tier-lab"><b>${t.k}</b><small>${range}</small></div><div class="tier-cards">${cards || `<span class="tier-empty">Nobody here yet</span>`}</div></section>`;
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
  if (board && view === "tiers") board.innerHTML = tierBoardHTML(rows) + `<p class="tier-note">Drag a servant to another tier, or press it to pick one. Servants you placed yourself show a pin; press "Back to automatic" to let the score decide again. Score ranges: SS 75+, S 62–75, A 50–62, B 40–50, C under 40.</p>`;
  if (view !== "list") return;
  const cur = {}; rows.forEach((r, i) => { cur[r.s.id] = i + 1; });
  let base = rankBase(); if (!base) { base = cur; setRankBase(cur); }
  el.innerHTML = rows.map((r, i) => {
    const rank = i + 1, prev = base[r.s.id], q = r.sc.parts, roi = roiOf(r.s);
    const mv = prev == null ? `<span class="mv">new</span>` : prev > rank ? `<span class="mv up" title="Up ${prev - rank}">▲${prev - rank}</span>` : prev < rank ? `<span class="mv down" title="Down ${rank - prev}">▼${rank - prev}</span>` : `<span class="mv" title="No change">–</span>`;
    const parts = "Stats " + q.stats.toFixed(1) + " · Skills " + q.skills.toFixed(1) + " · NP " + q.np.toFixed(1) + " · Level " + q.level.toFixed(1) + " · Rarity " + q.rarity.toFixed(1);
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
  m.innerHTML = `<p class="tm-h"><b>${esc(r.s.name)}</b><small>Score ${r.sc.total.toFixed(1)} · by score: ${auto}</small></p>
    <div class="tm-tiers" role="group" aria-label="Move to tier">${TIERS.map((t) => `<button type="button" role="menuitemradio" aria-checked="${t.k === cur}" class="t-${t.k.toLowerCase()}" data-action="tier-set" data-id="${esc(id)}" data-k="${t.k}">${t.k}</button>`).join("")}</div>
    ${manual ? `<button type="button" role="menuitem" class="btn ghost sm" data-action="tier-set" data-id="${esc(id)}" data-k="">Back to automatic (${auto})</button>` : ""}
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
  if (s && r) toast(s.name + " is in " + k + (k === autoTier(r.sc.total) ? " (where the score puts them)." : ". Their score puts them in " + autoTier(r.sc.total) + "."));
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

