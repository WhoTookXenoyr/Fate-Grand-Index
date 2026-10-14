/* ================= v10 ================= */

/* ---------- the whole servant panel wears the grail frame too ---------- */
function syncDossierFrame() {
  const d = document.getElementById("dossier"); if (!d) return;
  const s = S.servants.find((x) => x.id === shownId()), form = !!d.querySelector("#servant-form");
  const g = s && !form && d.firstElementChild ? grTier(s).trim() : "";
  d.classList.toggle("gr100", g === "gr100"); d.classList.toggle("gr102", g === "gr102");
}
const renderDossier9 = renderDossier;
renderDossier = function (force) { const r = renderDossier9(force); syncDossierFrame(); return r; };
// the edit form is drawn without renderDossier, so watch the panel itself
(function () { const d = document.getElementById("dossier"); if (d && window.MutationObserver) new MutationObserver(syncDossierFrame).observe(d, {childList: true}); })();

/* ---------- tabs: open on Home, and a reload stays on the tab you were on ---------- */
const renderChrome9 = renderChrome;
renderChrome = function () {
  renderChrome9();
  document.documentElement.dataset.tab = S.tab;
  try { if (location.hash.slice(1) !== S.tab) history.replaceState(null, "", "#" + S.tab); } catch (e) {}
};
(function () { const h = (location.hash || "").slice(1); S.tab = TABS.includes(h) ? h : "home"; })();

/* ---------- Home ---------- */
let homeDealt = false;
function greeting() { const h = new Date().getHours(); return h < 5 ? "Still up, Master?" : h < 12 ? "Good morning, Master." : h < 18 ? "Good afternoon, Master." : "Good evening, Master."; }
const plural = (n, one, many) => n + " " + (n === 1 ? one : (many || one + "s"));
function homeCardHTML(s, i, n) {
  const k = iconSlot(s), r = clamp(num(s.rarity) || 0, 0, 5), mid = (n - 1) / 2, off = i - mid;
  const metal = r >= 4 ? "gold" : r === 3 ? "silver" : "bronze";
  const art = k ? `<img class="hm-art" src="${esc(artSrc(artOf(s, k)))}" alt="" data-art="1">` : (CLASS_MARK[s.cls] ? `<img class="hm-art mark" src="${CLASS_MARK[s.cls]}" alt="">` : "");
  const rk = rankOf(s.id);
  return `<button type="button" class="hm-card ${metal}${grTier(s)}" data-action="goto" data-id="${esc(s.id)}" style="--o:${off};--a:${Math.abs(off)};--d:${i}"
      data-cap="${esc(s.name)}" data-sub="${esc([s.cls, s.level ? "Lv " + s.level : "", s.npLevel ? "NP" + s.npLevel : "", rk ? "Rank #" + rk.rank : ""].filter(Boolean).join(" · "))}" aria-label="Open ${esc(s.name)}">
      ${grTier(s) === " gr102" ? `<i class="hm-rb" aria-hidden="true"><b></b></i>` : ""}<span class="hm-face">${art}<span class="hm-plate">${CLASS_LOGO[s.cls] ? `<img src="${CLASS_LOGO[s.cls]}" alt="">` : ""}<span class="hm-stars">${"★".repeat(r)}</span></span></span>
    </button>`;
}
function homeHeroHTML(own, guests) {
  const lv = own.map((s) => num(s.level)).filter((v) => v != null);
  const avg = lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 0;
  const grailed = own.filter((s) => { const st = levelStatus(s); return st && st.kind === "grail"; }).length;
  const top = rankRows().map((r) => r.s);
  // the hand: your best, with pictures first, the strongest in the middle
  const pick = top.filter((s) => iconSlot(s)).concat(top.filter((s) => !iconSlot(s))).slice(0, isWide() ? 7 : 5);
  const order = [];
  pick.forEach((s, i) => { if (i % 2) order.push(s); else order.unshift(s); });
  const hand = order.length ? order.map((s, i) => homeCardHTML(s, i, order.length)).join("") : "";
  const lead = own.length
    ? `${plural(own.length, "servant")} in your Chaldea${grailed ? `, ${grailed} of them grailed` : ""}, at an average of Lv ${avg.toFixed(1)}.${guests.length ? ` ${plural(guests.length, "Guest")} ${guests.length === 1 ? "is" : "are"} waiting to be summoned.` : ""}`
    : "Your Chaldea is empty. Add the servants you own and they'll gather here.";
  const centre = order.length ? order[Math.floor((order.length - 1) / 2)] : null;
  return `<section class="hm-hero">
    <div class="hm-intro">
      <h2 class="hm-hello">${esc(greeting())}</h2>
      <p class="hm-lead">${esc(lead)}</p>
      <div class="hm-actions">
        <button type="button" class="btn primary" data-action="tab" data-tab="servants">Open your roster</button>
        ${guests.length ? `<button type="button" class="btn" data-action="home-guests">Summon a Guest</button>` : ""}
        ${S.readOnly ? "" : `<button type="button" class="btn ghost" data-action="home-add">Add a servant</button>`}
      </div>
    </div>
    ${order.length ? `<div class="hm-table">
      <div class="hm-fan${homeDealt ? " dealt" : ""}" role="group" aria-label="Your strongest servants">${hand}</div>
      <p class="hm-cap" aria-live="polite"><b>${esc(centre ? centre.name : "")}</b><span>${esc(centre ? [centre.cls, centre.level ? "Lv " + centre.level : "", centre.npLevel ? "NP" + centre.npLevel : ""].filter(Boolean).join(" · ") : "")}</span></p>
    </div>` : `<div class="hm-table empty">${S.readOnly ? "" : `<button type="button" class="btn primary" data-action="home-add">Add your first servant</button>`}</div>`}
  </section>`;
}
function homeNextHTML(own) {
  const rows = own.map((s) => ({s: s, r: roiOf(s)})).filter((x) => x.r && x.r.gain > 0.05).sort((a, b) => b.r.gain - a.r.gain).slice(0, 5);
  const body = rows.length ? `<ol class="hm-next">${rows.map((x) => `<li><button type="button" class="hm-row" data-action="goto" data-id="${esc(x.s.id)}">${miniAva(x.s)}<span class="hm-main"><b>${esc(x.s.name)}</b><small>${esc(roiText(x.r))}</small></span><span class="hm-gain" title="Rank score gained">+${x.r.gain.toFixed(1)}</span></button></li>`).join("")}</ol>`
    : `<p class="tr-none">${own.length ? "Every servant is at their best. Nothing left to level." : "Add servants and the upgrades worth doing first show up here."}</p>`;
  return `<section class="d-sec hm-block hm-b-next"><h3>Next upgrades <small>the steps that raise your rank scores most</small></h3>${body}</section>`;
}
function homeRosterHTML(own) {
  const n = own.length || 1;
  const cls = CLASSES.map((c) => { const k = own.filter((s) => s.cls === c).length; return `<button type="button" class="hm-cls${k ? "" : " none"}" data-action="home-cls" data-cls="${esc(c)}" title="${esc(c)}: ${k}"${k ? "" : " disabled"}>${CLASS_LOGO[c] ? `<img src="${CLASS_LOGO[c]}" alt="">` : `<span class="mono-tag">${esc(ABBR[c] || c)}</span>`}<b>${k}</b><span class="vh">${esc(c)}</span></button>`; }).join("");
  const cards = CARDS.map((c) => { const k = own.filter((s) => s.npCard === c).length; return `<div class="hm-bar ${cardCls(c)}"><span class="hm-bl">${CARD_IMG[c] ? `<img src="${CARD_IMG[c]}" alt="">` : ""}${esc(c)}</span><span class="hm-track"><i style="width:${(k / n * 100).toFixed(1)}%"></i></span><b>${k}</b></div>`; }).join("");
  const skills = own.reduce((a, s) => a + [0, 1, 2].reduce((b, i) => b + (typeof (s.skills || [])[i] === "number" ? s.skills[i] : 0), 0), 0);
  const maxed = own.reduce((a, s) => a + (s.skills || []).filter((v) => v === 10).length, 0);
  const pct = own.length ? skills / (own.length * 30) * 100 : 0;
  const grails = own.filter((s) => { const st = levelStatus(s); return st && st.kind === "grail"; }).sort((a, b) => (num(b.level) || 0) - (num(a.level) || 0));
  const fou = own.reduce((a, s) => a + (num(s.fouHp) || 0) + (num(s.fouAtk) || 0), 0);
  return `<section class="d-sec hm-block hm-b-roster"><h3>Your roster <small>press a class to see who you have</small></h3>
    <div class="hm-clsgrid">${cls}</div>
    <div class="hm-bars" aria-label="Noble Phantasm cards">${cards}</div>
    <div class="hm-meter"><span class="hm-ml">Skills <b>${Math.round(pct)}%</b> of max</span><span class="hm-track gold"><i style="width:${pct.toFixed(1)}%"></i></span><span class="hm-mr">${plural(maxed, "skill")} at Lv 10</span></div>
    <p class="hm-facts"><span><b>${grails.length}</b> grailed${grails.length ? `, highest ${esc(grails[0].name)} at Lv ${esc(grails[0].level)}` : ""}</span><span><b>${fmt(fou)}</b> Fou fed in total</span></p>
  </section>`;
}
function homeGuestsHTML(guests) {
  const list = guests.slice(0, 6);
  const body = list.length ? `<ul class="hm-guests">${list.map((s) => `<li>${miniAva(s)}<button type="button" class="tr-name" data-action="goto" data-id="${esc(s.id)}">${esc(s.name)}</button><small>${esc(s.cls || "")}</small>${S.readOnly ? "" : `<button type="button" class="btn sm summon-btn" data-action="summon" data-id="${esc(s.id)}" aria-label="Summon ${esc(s.name)}">Summon</button>`}</li>`).join("")}</ul>${guests.length > list.length ? `<button type="button" class="btn ghost sm" data-action="home-guests">See all ${guests.length}</button>` : ""}`
    : `<p class="tr-none">The supports you borrow and the servants you hope to summon go here.</p>${S.readOnly ? "" : `<button type="button" class="btn sm" data-action="add-wish-home">+ Add guest</button>`}`;
  return `<section class="d-sec hm-block hm-b-guests"><h3>Guests <small>${guests.length ? guests.length + " waiting" : "nobody yet"}</small></h3>${body}</section>`;
}
function homePartiesHTML() {
  const ps = (S.parties || []).slice(0, 4);
  const byName = (n) => S.servants.find((s) => s.name === n);
  const body = ps.length ? `<ul class="hm-parties">${ps.map((p) => { const mem = (p.front || []).concat(p.guest ? [p.guest] : []).map(byName).filter(Boolean); return `<li><button type="button" class="hm-row" data-action="tab" data-tab="parties"><span class="hm-avas">${mem.map(miniAva).join("")}</span><span class="hm-main"><b>${esc(p.name || "Party")}</b>${p.bestFor ? `<small>${esc(p.bestFor)}</small>` : ""}</span></button></li>`; }).join("")}</ul>`
    : `<p class="tr-none">Save the teams you use and they show up here.</p>`;
  const more = (S.parties || []).length > ps.length ? `<button type="button" class="btn ghost sm" data-action="tab" data-tab="parties">See all ${S.parties.length}</button>` : "";
  return `<section class="d-sec hm-block hm-b-parties"><h3>Parties <small>${(S.parties || []).length ? plural(S.parties.length, "team") : "none saved"}</small></h3>${body}${more}</section>`;
}
function renderHome() {
  const el = document.getElementById("home"); if (!el) return;
  if (S.tab !== "home") { if (el.firstChild) el.innerHTML = ""; return; }
  if (S.dbState !== "ok" || !S.loaded.servants) { el.innerHTML = `<div class="skeleton" style="height:340px"></div>`; return; }
  const own = owned(), guests = wished();
  el.innerHTML = homeHeroHTML(own, guests) + `<div class="hm-grid">${homeNextHTML(own)}${homeRosterHTML(own)}${homeGuestsHTML(guests)}${homePartiesHTML()}</div>`;
  if (!homeDealt) {
    const fan = el.querySelector(".hm-fan");
    if (fan) { if (RM.matches) fan.classList.add("dealt"); else requestAnimationFrame(() => requestAnimationFrame(() => fan.classList.add("deal"))); homeDealt = true; }
  }
}
// the caption under the hand follows the card you point at
function homeCap(card) {
  const cap = document.querySelector(".hm-cap"); if (!cap || !card) return;
  cap.innerHTML = `<b>${esc(card.dataset.cap || "")}</b><span>${esc(card.dataset.sub || "")}</span>`;
}
document.addEventListener("pointerover", (e) => { const c = e.target.closest && e.target.closest(".hm-card"); if (c) homeCap(c); });
document.addEventListener("focusin", (e) => { const c = e.target.closest && e.target.closest(".hm-card"); if (c) homeCap(c); });
const renderAll9 = renderAll;
renderAll = function () { renderAll9(); renderHome(); };
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action;
  if (a === "tab" || a === "goto" || a === "summon") { setTimeout(renderHome, 0); if (a === "tab") return; }
  if (a === "home-cls") { S.cls = b.dataset.cls || ""; const f = document.getElementById("f-class"); if (f) f.value = S.cls; S.tab = "servants"; renderChrome(); renderList(); renderDossier(); syncPageTheme(); window.scrollTo({top: 0}); return; }
  if (a === "home-guests") { S.tab = "servants"; renderChrome(); renderList(); renderDossier(); syncPageTheme(); requestAnimationFrame(() => { const w = document.querySelector(".wish"); if (w) w.scrollIntoView({block: "start", behavior: RM.matches ? "auto" : "smooth"}); }); return; }
  if (a === "home-add" || a === "add-wish-home") { S.tab = "servants"; renderChrome(); syncPageTheme(); const t = document.querySelector(a === "home-add" ? '#view-servants [data-action="add-servant"]' : '[data-action="add-wish"]'); if (t) t.click(); window.scrollTo({top: 0}); return; }
});

// "Skill 1: Lv 9 → 10" reads better than "Skill 1 9 → 10"
roiText = function (r) {
  const step = r.kind === "skill" ? `Skill ${r.i + 1}: Lv ${r.from} → ${r.to}` : r.kind === "level" ? `Lv ${r.from} → ${r.to}` : `Grail: Lv ${r.from} → ${r.to}`;
  return step + (r.why ? ", " + r.why : "");
};
