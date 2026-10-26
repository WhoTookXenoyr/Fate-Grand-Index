/* ================= 0.24.0: append skills, Servant Coins and a materials planner =================
   Kept on the servant (so backups carry them): append levels (`appends`, 0 = locked), Servant Coins (`coins`), the
   level a cap was ascended at (`ascAt`) and a plan (`plan`: target level, skills and appends). What you have of each
   material is the same list the Event page's calculator uses (evPref.have), so it's filled in once for both.
   Costs come from Atlas Academy's NA data: ascension, skill and append materials with their QP, Grails (QP, and 30
   coins each past Lv 100), 120 coins to unlock an append, and EXP turned into same-class Gold Embers. */
const AP_COINS = 120, GRAIL_COINS = 30, GOLD_EMBER = 32400, GRAIL_ID = 7999;
const QP_IC = "Items/5.png", GRAIL_IC = "Items/7999.png";
const MAT_BY_ID = new Map(ATLAS_MATS.map((m) => [m[0], m]));

const apLevels = (s) => [0, 1, 2, 3, 4].map((i) => clamp(Math.round(num((s.appends || [])[i]) || 0), 0, 10));
const skLevels = (s) => [0, 1, 2].map((i) => { const v = (s.skills || [])[i]; return typeof v === "number" ? clamp(v, 1, 10) : 0; });
const appendOf = (a, i) => (a && a.ap && ATLAS_APPENDS[a.ap[i]]) || null;
// append values move like skills: a tenth of the gap per level up to Lv 9, the full value at Lv 10
const apVal = (v, lv) => { const l = Math.max(1, lv); return l >= 10 ? v[2] : v[1] + (v[2] - v[1]) * (l - 1) / 10; };
function apEffect(k, lv) {
  return k.e.map((line, j) => {
    const v = k.v[Math.min(j, k.v.length - 1)];
    return line.replace(/\{\{\d+:[^}]*\}\}/g, () => v ? fmtVal(apVal(v, lv), "") : "…");
  }).join(" ");
}
const apIcon = (k) => !k || !k.ic ? `<i class="ap-ic none" aria-hidden="true"></i>`
  : iconKnown(k.ic) ? icHTML(k.ic, "ap-ic") : `<img class="ic gi ap-ic" src="${esc(gameIconUrl(k.ic))}" alt="" loading="lazy" decoding="async">`;

/* ---------- levels, ascensions and Grails ---------- */
const lvMax = (a) => a.lv || CAPS[a.r] || 90;
const grailRows = (a) => ATLAS_GRAIL[String(a.r)] || [];
const lvTop = (a) => { const t = grailRows(a); return lvMax(a) + (t.length ? t[t.length - 1][1] : 0); };
const ascCaps = (a) => { const c0 = lvMax(a) - 40; return [c0, c0 + 10, c0 + 20, c0 + 30]; };
// past a cap its ascension is done; at a cap exactly it's still to do, unless you said you've ascended there
function ascDone(s, a) {
  const lv = num(s.level) || 1; let n = 0;
  ascCaps(a).forEach((c, k) => { if (lv > c || (lv === c && num(s.ascAt) === lv)) n = k + 1; });
  return n;
}
const ascNeed = (a, L) => ascCaps(a).filter((c) => c < L).length;
const atAscCap = (s, a) => { const lv = num(s.level) || 1; return ascCaps(a).includes(lv); };
// Grails needed for a cap of at least L
function grailsFor(a, L) {
  const mx = lvMax(a); if (L <= mx) return 0;
  const t = grailRows(a);
  for (let g = 0; g < t.length; g++) if (mx + t[g][1] >= L) return g + 1;
  return t.length;
}

/* ---------- the plan and what it costs ---------- */
// a plan never goes below where the servant already is (a target you've passed counts as done)
function planOf(s, a) {
  const p = s.plan && typeof s.plan === "object" ? s.plan : null;
  const lv = num(s.level) || 1, sk = skLevels(s), ap = apLevels(s), top = a ? lvTop(a) : 120;
  return {
    lv: clamp(Math.max(lv, num(p && p.lv) || lv), 1, Math.max(lv, top)),
    sk: sk.map((v, i) => Math.max(v, clamp(num(p && p.sk && p.sk[i]) || 0, 0, 10))),
    ap: ap.map((v, i) => Math.max(v, clamp(num(p && p.ap && p.ap[i]) || 0, 0, 10))),
    any: !!p
  };
}
function planCost(s, a, p) {
  const out = {items: new Map(), qp: 0, coins: 0, grails: 0, exp: 0, asc: 0, skl: 0, apl: 0, unlock: 0, embers: 0};
  if (!a || !p) return out;
  const add = (row) => { for (let j = 0; j + 1 < (row || []).length; j += 2) { const m = ATLAS_MATS[row[j]]; if (m) out.items.set(m[0], (out.items.get(m[0]) || 0) + (row[j + 1] | 0)); } };
  const lv = num(s.level) || 1;
  for (let k = ascDone(s, a); k < ascNeed(a, p.lv); k++) { add((a.ma || [])[k]); out.qp += (a.qa || [])[k] || 0; out.asc++; }
  const gt = grailRows(a), mx = lvMax(a);
  for (let g = grailsFor(a, lv); g < grailsFor(a, p.lv) && g < gt.length; g++) { out.qp += gt[g][0]; out.grails++; if (mx + gt[g][1] > 100) out.coins += GRAIL_COINS; }
  const eg = ATLAS_EXP[a.xg || 0] || [], ex = (L) => eg[Math.min(L, eg.length) - 1] || 0;
  out.exp = Math.max(0, ex(p.lv) - ex(lv)); out.embers = Math.ceil(out.exp / GOLD_EMBER);
  skLevels(s).forEach((v, i) => { for (let l = Math.max(1, v); l < p.sk[i]; l++) { add((a.ms || [])[l - 1]); out.qp += (a.qs || [])[l - 1] || 0; out.skl++; } });
  apLevels(s).forEach((v, i) => {
    if (p.ap[i] > 0 && v === 0) { out.coins += AP_COINS; out.unlock++; }
    for (let l = Math.max(1, v); l < p.ap[i]; l++) { add((a.mp || [])[l - 1]); out.qp += (a.qp || [])[l - 1] || 0; out.apl++; }
  });
  return out;
}
const planEmpty = (c) => !c.items.size && !c.qp && !c.coins && !c.grails && !c.exp;
// every servant with a plan, added up
function allPlans() {
  const T = {items: new Map(), who: new Map(), qp: 0, grails: 0, exp: 0, embers: 0, list: [], coinShort: []};
  S.servants.forEach((s) => {
    if (!s.plan) return; const a = atlasOf(s); if (!a) return;
    const c = planCost(s, a, planOf(s, a)); if (planEmpty(c)) return;
    T.list.push(s); T.qp += c.qp; T.grails += c.grails; T.exp += c.exp; T.embers += c.embers;
    c.items.forEach((n, id) => { T.items.set(id, (T.items.get(id) || 0) + n); const w = T.who.get(id) || []; w.push([s.name, n]); T.who.set(id, w); });
    const short = Math.max(0, c.coins - (num(s.coins) || 0)); if (short) T.coinShort.push([s.name, short]);
  });
  return T;
}

/* ---------- what you have ---------- */
const haveOf = (k) => Math.max(0, num(evPref.have[k]) || 0);
const qpShort = (n) => n >= 1e9 ? (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B" : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, "") + "M" : n >= 1e4 ? Math.round(n / 1e3) + "K" : fmt(n);
const haveIn = (k, label) => S.readOnly ? `<span class="pl-hv">${fmt(haveOf(k))}</span>`
  : `<input class="pl-in" type="number" min="0" step="1" inputmode="numeric" data-ev-have="${esc(k)}" value="${esc(evPref.have[k] || "")}" placeholder="0" aria-label="${esc(label)} you have">`;
const shortHTML = (k, need) => { const s = Math.max(0, need - haveOf(k)); return `<span class="pl-short${s ? "" : " ok"}" data-pl-short="${esc(k)}" data-need="${need}">${s ? fmt(s) + " short" : "enough"}</span>`; };

/* ---------- the Append skills section ---------- */
function apSecHTML(s, a) {
  const lv = apLevels(s), ro = S.readOnly, n = lv.filter((v) => v > 0).length;
  const rows = lv.map((l, i) => {
    const k = appendOf(a, i);
    const ctl = `<div class="stepper ap-step">${ro ? "" : `<button type="button" data-action="bump" data-f="ap${i}" data-d="-1" aria-label="Lower append ${i + 1}"${l ? "" : " disabled"}>−</button>`}<output>${l ? l : "—"}</output>${ro ? "" : `<button type="button" data-action="bump" data-f="ap${i}" data-d="1" aria-label="${l ? "Raise" : "Unlock"} append ${i + 1}"${l >= 10 ? " disabled" : ""}>+</button>`}</div>`;
    return `<article class="ap-row${l ? "" : " locked"}${l >= 10 ? " max" : ""}">${apIcon(k)}
      <div class="ap-main"><span class="ap-n"><i>${i + 1}</i><b>${esc(k ? k.n : "Append skill " + (i + 1))}</b>${l ? (l >= 10 ? `<span class="status grail">Maxed</span>` : `<span class="status">Lv ${l}</span>`) : `<span class="status">Locked</span>`}</span>
        ${k ? `<span class="ap-eff">${esc(apEffect(k, l || 1))}${l ? "" : ` <em>(at Lv 1)</em>`}</span>` : ""}</div>${ctl}</article>`;
  }).join("");
  const coin = a && a.ci ? `<img class="ap-coin" src="${esc(aimg(a.ci))}" alt="" loading="lazy" decoding="async">` : `<i class="ap-coin none" aria-hidden="true"></i>`;
  const cv = num(s.coins) || 0;
  return `<section class="d-sec ap-sec"><div class="sec-head"><h3>Append skills <small>${n ? n + " of 5 unlocked" : "none unlocked yet"}</small></h3></div>
    <div class="ap-coins">${coin}<label class="ap-cin"><span>Servant Coins</span>${ro ? `<b>${fmt(cv)}</b>` : `<input type="number" min="0" max="99999" step="1" inputmode="numeric" data-coins value="${cv || ""}" placeholder="0" aria-label="Servant Coins you have">`}</label>
      <p>${a && a.cn ? `+${a.cn} for each copy summoned, and more from Bond levels. ` : "From summons and Bond levels. "}Unlocking an append costs ${AP_COINS}; a Grail past Lv 100 costs ${GRAIL_COINS}.</p></div>
    <div class="ap-list">${rows}</div></section>`;
}

/* ---------- the Planner section ---------- */
const PL_OPEN = {}; let plAll = false;
function plSummary(s, a, p) {
  const sk = skLevels(s), ap = apLevels(s), lv = num(s.level) || 1, bits = [];
  const sl = (arr) => arr.map((v) => v || "—").join("/");
  if (p.lv > lv) bits.push(`Lv ${lv} → ${p.lv}`);
  if (p.sk.some((v, i) => v > sk[i])) bits.push(`skills ${sl(sk)} → ${sl(p.sk)}`);
  if (p.ap.some((v, i) => v > ap[i])) bits.push(`appends ${sl(ap)} → ${sl(p.ap)}`);
  return bits.join(" · ");
}
function lvOptions(s, a, p) {
  const lv = num(s.level) || 1, mx = lvMax(a), set = new Set([lv, p.lv]);
  ascCaps(a).concat([mx]).forEach((c) => { if (c > lv) set.add(c); });
  grailRows(a).forEach((g) => { if (mx + g[1] > lv) set.add(mx + g[1]); });
  return [...set].sort((x, y) => x - y).map((L) => {
    const t = L === lv ? "now" : L < mx ? `${ascNeed(a, L)} ascension${ascNeed(a, L) === 1 ? "" : "s"}` : L === mx ? "max" : `${grailsFor(a, L)} Grail${grailsFor(a, L) === 1 ? "" : "s"}`;
    return `<option value="${L}"${L === p.lv ? " selected" : ""}>Lv ${L} · ${t}</option>`;
  }).join("");
}
function lvlSelect(key, cur, tgt, label, lockedWord) {
  let o = ""; for (let v = cur; v <= 10; v++) o += `<option value="${v}"${v === tgt ? " selected" : ""}>${v === 0 ? lockedWord : v === cur ? v + " (now)" : v}</option>`;
  return `<select class="pl-sel" data-pl="${key}" aria-label="${esc(label)}"${S.readOnly ? " disabled" : ""}>${o}</select>`;
}
function itemRow(id, need, who) {
  const m = MAT_BY_ID.get(id), nm = m ? m[1] : "Item " + id;
  const tip = who && who.length > 1 ? ` title="${esc(who.slice().sort((x, y) => y[1] - x[1]).map((w) => w[0] + " " + fmt(w[1])).join(" · "))}"` : "";
  return `<tr><td class="pl-it">${m && m[2] ? `<img src="${esc(aimg(m[2]))}" alt="" loading="lazy" decoding="async">` : ""}<span>${esc(nm)}</span></td>
    <td class="n"${tip}>${fmt(need)}</td><td class="n">${haveIn(String(id), nm)}</td><td class="n">${shortHTML(String(id), need)}</td></tr>`;
}
function plTilesHTML(c, coinTile) {
  const tile = (ic, big, label, extra) => `<div class="pl-tile">${ic ? `<img src="${esc(aimg(ic))}" alt="" loading="lazy" decoding="async">` : `<i class="pl-tic" aria-hidden="true">EXP</i>`}<div><b>${big}</b><span>${label}</span>${extra || ""}</div></div>`;
  const t = [];
  if (c.qp) t.push(tile(QP_IC, qpShort(c.qp), `QP <small>(${fmt(c.qp)})</small>`, `<span class="pl-trow">have ${haveIn("qp", "QP")} ${shortHTML("qp", c.qp)}</span>`));
  if (c.grails) t.push(tile(GRAIL_IC, fmt(c.grails), c.grails === 1 ? "Holy Grail" : "Holy Grails", `<span class="pl-trow">have ${haveIn(String(GRAIL_ID), "Holy Grails")} ${shortHTML(String(GRAIL_ID), c.grails)}</span>`));
  if (coinTile) t.push(coinTile);
  if (c.exp) t.push(tile("", qpShort(c.exp), `EXP · about <b class="pl-emb">${fmt(c.embers)}</b> Gold Embers <small>(same class, ${fmt(GOLD_EMBER)} each)</small>`));
  return t.length ? `<div class="pl-tiles">${t.join("")}</div>` : "";
}
function plSecHTML(s, a) {
  if (!a) return `<section class="d-sec pl-sec"><div class="sec-head"><h3>Planner</h3></div><p class="tr-none">${esc(s.name)} isn't matched to the NA servant list, so there's no material data to plan with. Match them in Past Chaldea first.</p></section>`;
  const p = planOf(s, a), c = planCost(s, a, p), ro = S.readOnly;
  const open = PL_OPEN[s.id] != null ? PL_OPEN[s.id] : (p.any || plAll);
  const sum = plSummary(s, a, p), lv = num(s.level) || 1, sk = skLevels(s), ap = apLevels(s);
  const pre = (k, t) => `<button type="button" class="btn ghost sm" data-action="pl-pre" data-k="${k}">${t}</button>`;
  const asked = atAscCap(s, a) && lv < lvMax(a) ? `<label class="pl-asc"><input type="checkbox" data-pl-asc${num(s.ascAt) === lv ? " checked" : ""}${ro ? " disabled" : ""}> Already ascended at Lv ${lv}</label>` : "";
  const targets = `<div class="pl-tg">
      <div class="pl-row"><span class="pl-k">Level</span><div class="pl-ctl"><select class="pl-sel wide" data-pl="lv" aria-label="Target level"${ro ? " disabled" : ""}>${lvOptions(s, a, p)}</select>${asked}</div></div>
      <div class="pl-row"><span class="pl-k">Skills</span><div class="pl-ctl">${[0, 1, 2].map((i) => lvlSelect("sk" + i, sk[i], p.sk[i], "Skill " + (i + 1) + " target", "Locked")).join("")}</div></div>
      <div class="pl-row"><span class="pl-k">Appends</span><div class="pl-ctl">${[0, 1, 2, 3, 4].map((i) => lvlSelect("ap" + i, ap[i], p.ap[i], "Append " + (i + 1) + " target", "—")).join("")}</div></div>
      ${ro ? "" : `<div class="pl-pre">${pre("sk10", "Skills 10/10/10")}${pre("sk9", "Skills 9/9/9")}${pre("lvmax", "Max level")}${lvTop(a) >= 100 && lv < 100 ? pre("lv100", "Lv 100") : ""}${lvTop(a) >= 120 && lv < 120 ? pre("lv120", "Lv 120") : ""}${pre("ap2", "Append 2 to 10")}${p.any ? `<button type="button" class="btn ghost sm" data-action="pl-clear">Clear plan</button>` : ""}</div>`}
    </div>`;
  // what it costs: this servant, or every plan
  let body;
  if (plAll) {
    const T = allPlans(), ids = [...T.items.keys()].sort((x, y) => x - y);
    const coinTile = T.coinShort.length ? `<div class="pl-tile"><i class="pl-tic" aria-hidden="true">¢</i><div><b>${T.coinShort.length}</b><span>${T.coinShort.length === 1 ? "servant is" : "servants are"} short of coins</span><span class="pl-trow muted">${esc(T.coinShort.map((x) => x[0] + " " + x[1]).join(" · "))}</span></div></div>` : "";
    body = T.list.length ? `<p class="pl-note">Every plan added up: ${T.list.map((x) => `<button type="button" class="linkish" data-action="select" data-id="${esc(x.id)}">${esc(x.name)}</button>`).join(", ")}.</p>
      ${plTilesHTML(T, coinTile)}
      ${ids.length ? `<div class="pl-scroll"><table class="pl-tb"><thead><tr><th>Material</th><th class="n">Need</th><th class="n">Have</th><th class="n">Short</th></tr></thead><tbody>${ids.map((id) => itemRow(id, T.items.get(id), T.who.get(id))).join("")}</tbody></table></div>` : ""}`
      : `<p class="tr-none">No plans yet. Pick targets above for any servant and they're added up here.</p>`;
  } else if (planEmpty(c)) {
    body = `<p class="tr-none">${p.any ? "Nothing left to spend: this plan is done." : "Pick a target level, skills or appends above to see what it takes."}</p>`;
  } else {
    const have = num(s.coins) || 0, cs = Math.max(0, c.coins - have);
    const coinTile = c.coins ? `<div class="pl-tile">${a.ci ? `<img src="${esc(aimg(a.ci))}" alt="" loading="lazy" decoding="async">` : ""}<div><b>${fmt(c.coins)}</b><span>Servant Coins <small>(${[c.unlock ? plural(c.unlock, "append unlock") : "", c.coins - c.unlock * AP_COINS ? (c.coins - c.unlock * AP_COINS) / GRAIL_COINS + " Grails past Lv 100" : ""].filter(Boolean).join(", ")})</small></span>
      <span class="pl-trow">have ${fmt(have)} <span class="pl-short${cs ? "" : " ok"}" data-pl-coins="${c.coins}">${cs ? fmt(cs) + " short" + (a.cn ? ` (${plural(Math.ceil(cs / a.cn), "copy", "copies")})` : "") : "enough"}</span></span></div></div>` : "";
    const ids = [...c.items.keys()].sort((x, y) => x - y);
    const what = [c.asc ? plural(c.asc, "ascension") : "", c.grails ? plural(c.grails, "Grail") : "", c.skl ? plural(c.skl, "skill level") : "", c.apl ? plural(c.apl, "append level") : ""].filter(Boolean).join(", ");
    body = `<p class="pl-note">${esc(what)}.</p>${plTilesHTML(c, coinTile)}
      ${ids.length ? `<div class="pl-scroll"><table class="pl-tb"><thead><tr><th>Material</th><th class="n">Need</th><th class="n">Have</th><th class="n">Short</th></tr></thead><tbody>${ids.map((id) => itemRow(id, c.items.get(id))).join("")}</tbody></table></div>` : ""}
      ${ro ? "" : `<div class="pl-done"><button type="button" class="btn sm primary" data-action="pl-done">Done: set ${esc(s.name)} to the plan</button><span class="muted">Takes what it used out of what you have. You can undo it.</span></div>`}`;
  }
  const nPlans = S.servants.filter((x) => x.plan).length;
  return `<section class="d-sec pl-sec"><details class="pl"${open ? " open" : ""} data-pl-for="${esc(s.id)}">
    <summary><span class="pl-h">Planner</span><span class="pl-sum">${sum ? esc(sum) : "What leveling costs"}${!plAll && !planEmpty(c) && c.qp ? ` · ${qpShort(c.qp)} QP` : ""}</span></summary>
    ${targets}
    <div class="pl-view" role="group" aria-label="Show"><button type="button" class="btn sm${plAll ? " ghost" : " primary"}" data-action="pl-view" data-v="one" aria-pressed="${!plAll}">${esc(s.name)}</button><button type="button" class="btn sm${plAll ? " primary" : " ghost"}" data-action="pl-view" data-v="all" aria-pressed="${plAll}">All plans${nPlans ? " (" + nPlans + ")" : ""}</button></div>
    <div class="pl-out">${body}</div>
    <p class="pl-foot">Ember QP and Fou aren't counted. Ascensions count as done once the level is past their cap.</p>
  </details></section>`;
}

/* ---------- on the servant page ---------- */
const renderDossier24p = renderDossier;
renderDossier = function (force) {
  const r = renderDossier24p(force);
  const d = document.getElementById("dossier");
  if (d && !S.editing && !d.querySelector("#servant-form")) {
    const s = S.servants.find((v) => v.id === shownId());
    if (s && !d.querySelector(".pl-sec")) {
      const a = atlasOf(s);
      // the planner after the stats (after the top block in Compact), the appends after the skills
      const st = d.querySelector(".stat-grid"), at = d.querySelector(".cmp-top") || (st && st.closest(".d-sec"));
      if (at) at.insertAdjacentHTML("afterend", plSecHTML(s, a)); else d.insertAdjacentHTML("beforeend", plSecHTML(s, a));
      const sk = d.querySelector(".skills"), sks = sk && sk.closest(".d-sec");
      if (sks) sks.insertAdjacentHTML("afterend", apSecHTML(s, a)); else d.insertAdjacentHTML("beforeend", apSecHTML(s, a));
    }
  }
  return r;
};
const typingInDossier24 = typingInDossier;
typingInDossier = function () {
  const a = document.activeElement;
  return typingInDossier24() || !!(a && a.closest && a.closest("#dossier") && a.matches && a.matches("input[data-coins], input[data-ev-have]"));
};
function plRedraw(focusSel) {
  renderDossier(true);
  if (focusSel) { const e = document.querySelector("#dossier " + focusSel); if (e) e.focus({preventScroll: true}); }
}

/* ---------- append levels: + and − ---------- */
const bump24 = bump;
bump = function (f, d) {
  const m = /^ap([0-4])$/.exec(f);
  if (!m) return bump24(f, d);
  const s = S.servants.find((x) => x.id === shownId()); if (!s || S.readOnly) return;
  const lv = apLevels(s), i = Number(m[1]);
  lv[i] = clamp(lv[i] + d, 0, 10); s.appends = lv;
  renderDossier(); scheduleWrite("servants", s);
  const b = document.querySelector(`#dossier [data-action="bump"][data-f="${f}"][data-d="${d}"]`); if (b && !b.disabled) b.focus({preventScroll: true});
};

/* ---------- changing the plan ---------- */
function setPlan(s, fn) {
  const a = atlasOf(s); if (!a || S.readOnly) return;
  const p = planOf(s, a), next = {lv: p.lv, sk: p.sk.slice(), ap: p.ap.slice()};
  fn(next, a);
  s.plan = next; PL_OPEN[s.id] = true;
  scheduleWrite("servants", s);
}
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.closest || !t.closest("#dossier")) return;
  const s = curServant(); if (!s || S.readOnly) return;
  if (t.dataset.pl) {
    const k = t.dataset.pl, v = Number(t.value);
    setPlan(s, (p) => { if (k === "lv") p.lv = v; else p[k.slice(0, 2)][Number(k.slice(2))] = v; });
    plRedraw(`[data-pl="${k}"]`); return;
  }
  if (t.matches("input[data-pl-asc]")) {
    if (t.checked) s.ascAt = num(s.level); else delete s.ascAt;
    scheduleWrite("servants", s); plRedraw("input[data-pl-asc]"); return;
  }
  // coins and counts aren't redrawn when you leave the box: the redraw would swallow the click that moved you away
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b || !b.closest("#dossier")) return;
  const a = b.dataset.action; if (!/^pl-/.test(a)) return;
  const s = curServant(); if (!s) return;
  if (a === "pl-view") { plAll = b.dataset.v === "all"; PL_OPEN[s.id] = true; plRedraw(`[data-action="pl-view"][data-v="${b.dataset.v}"]`); return; }
  if (S.readOnly) return;
  if (a === "pl-pre") {
    const k = b.dataset.k;
    setPlan(s, (p, at) => {
      if (k === "sk10" || k === "sk9") p.sk = p.sk.map(() => k === "sk10" ? 10 : 9);
      else if (k === "lvmax") p.lv = Math.max(p.lv, lvMax(at));
      else if (k === "lv100") p.lv = Math.max(p.lv, 100);
      else if (k === "lv120") p.lv = Math.max(p.lv, Math.min(120, lvTop(at)));
      else if (k === "ap2") p.ap[1] = 10;
    });
    plRedraw(`[data-action="pl-pre"][data-k="${k}"]`); return;
  }
  if (a === "pl-clear") { delete s.plan; PL_OPEN[s.id] = true; scheduleWrite("servants", s); plRedraw("details.pl > summary"); toast("Plan cleared for " + s.name + "."); return; }
  if (a === "pl-done") { planDone(s); return; }
});
document.addEventListener("toggle", (e) => {
  const d = e.target; if (!d || !d.matches || !d.matches("details.pl")) return;
  PL_OPEN[d.dataset.plFor] = d.open;
}, true);

/* ---------- typing what you have: the "short" numbers follow without redrawing the page ---------- */
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.closest || !t.closest("#dossier")) return;
  if (t.matches("input[data-coins]")) {
    const s = curServant(); if (!s || S.readOnly) return;
    const v = clamp(Math.round(num(t.value.replace(/[^\d]/g, "")) || 0), 0, 99999);
    if (v) s.coins = v; else delete s.coins;
    scheduleWrite("servants", s); plPatch(); return;
  }
  if (t.dataset.evHave != null) {
    // the Event page's handler saves it; this keeps the other boxes for the same thing in step
    const k = t.dataset.evHave, v = t.value.replace(/[^\d]/g, "").slice(0, 10);
    if (v) evPref.have[k] = Number(v); else delete evPref.have[k];
    evPrefSave();
    document.querySelectorAll(`#dossier input[data-ev-have="${CSS.escape(k)}"]`).forEach((x) => { if (x !== t) x.value = v; });
    plPatch();
  }
});
function plPatch() {
  document.querySelectorAll("#dossier [data-pl-short]").forEach((el) => {
    const short = Math.max(0, (num(el.dataset.need) || 0) - haveOf(el.dataset.plShort));
    el.textContent = short ? fmt(short) + " short" : "enough"; el.classList.toggle("ok", !short);
  });
  const s = curServant(), c = document.querySelector("#dossier [data-pl-coins]");
  if (s && c) {
    const a = atlasOf(s), short = Math.max(0, (num(c.dataset.plCoins) || 0) - (num(s.coins) || 0));
    c.textContent = short ? fmt(short) + " short" + (a && a.cn ? ` (${plural(Math.ceil(short / a.cn), "copy", "copies")})` : "") : "enough"; c.classList.toggle("ok", !short);
    const hv = c.parentElement && c.parentElement.firstChild; if (hv && hv.nodeType === 3) hv.textContent = "have " + fmt(num(s.coins) || 0) + " ";
  }
}

/* ---------- Done: the servant moves to the plan, and what it used comes out of what you have ---------- */
function planDone(s) {
  const a = atlasOf(s); if (!a || S.readOnly) return;
  const p = planOf(s, a), c = planCost(s, a, p); if (planEmpty(c)) return;
  const before = JSON.parse(JSON.stringify({level: s.level, skills: s.skills, appends: s.appends, plan: s.plan, coins: s.coins, ascAt: s.ascAt, hp: s.hp, atk: s.atk}));
  const haveBefore = {};
  const take = (k, n) => { if (!(k in evPref.have)) return; haveBefore[k] = evPref.have[k]; const v = Math.max(0, haveOf(k) - n); if (v) evPref.have[k] = v; else delete evPref.have[k]; };
  c.items.forEach((n, id) => take(String(id), n)); take("qp", c.qp); take(String(GRAIL_ID), c.grails);
  s.level = p.lv;
  const sk = Array.isArray(s.skills) ? s.skills.slice() : [1, 1, 1];
  p.sk.forEach((v, i) => { if (v > 0) sk[i] = v; }); s.skills = sk;
  s.appends = p.ap.slice();
  if (num(s.coins) != null && c.coins) { const v = Math.max(0, num(s.coins) - c.coins); if (v) s.coins = v; else delete s.coins; }
  delete s.plan; delete s.ascAt;
  if (typeof syncStats === "function") syncStats(s);
  evPrefSave();
  renderSummary(); renderList(); renderDossier(true); renderRanking(); scheduleWrite("servants", s);
  toastAction(s.name + " is at the plan now" + (Object.keys(haveBefore).length ? ", and what it used is out of your materials." : "."), "Undo", () => {
    const cur = S.servants.find((x) => x.id === s.id); if (!cur) return;
    Object.keys(before).forEach((k) => { if (before[k] === undefined) delete cur[k]; else cur[k] = before[k]; });
    Object.keys(haveBefore).forEach((k) => { evPref.have[k] = haveBefore[k]; }); evPrefSave();
    renderSummary(); renderList(); renderDossier(true); renderRanking(); scheduleWrite("servants", cur);
    toast("Undone: " + cur.name + " and your materials are back.");
  });
}
