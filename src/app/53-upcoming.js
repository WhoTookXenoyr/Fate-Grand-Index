/* ================= 0.51.0-beta: servants coming to NA =================
   ATLAS_UP (data/atlas/upcoming.json, from JP's data) holds the servants JP has and NA doesn't yet. Past Chaldea shows
   them in a "Coming to NA" row. For everyone, their page stays locked with a countdown to NA's release, and opens on
   its own when the countdown ends. The site's owner (the server's OWNER variable: /api/me says owner: true) sees them
   in full right away, the way NA's servants are: the page, Summon and Guests, the battle and the rest.

   NA's release time comes from the wiki once NA announces the event that brings them (Home's event board reads the
   wiki: an upcoming event's new servants and its start), and until then from upcoming.json ("at", or "eta" for the
   month it's expected). Once NA's own data has them, tools/gen_atlas.py makes them ordinary servants.

   This is a lock on the page against spoilers. JP's data is public (Atlas Academy, the wiki), so it isn't a secret
   kept from anyone who goes looking. Nothing on your roster changes. */
const UP_OWNER_KEY = "spirit-origin-list:v1:owner";
const UP_ALL = typeof ATLAS_UP !== "undefined" ? ATLAS_UP.filter((x) => !ATLAS_BY_NO.has(x.no)) : [];
const UP_IN = new Set();
let upNowFn = () => Date.now();
const upNow = () => upNowFn();
// the owner: what the server said this time, or last time on this device (so the page opens in full before it answers)
function upOwner() {
  if (!HOSTED) return false;
  if (API.checked && API.on && !API.offline) {
    const o = !!(API.user && API.user.owner);
    try { if (o) localStorage.setItem(UP_OWNER_KEY, "1"); else localStorage.removeItem(UP_OWNER_KEY); } catch (e) {}
    return o;
  }
  try { return localStorage.getItem(UP_OWNER_KEY) === "1"; } catch (e) { return false; }
}
// NA's release in ms, or 0 when no date is known yet
function upAt(x) {
  const w = typeof HB !== "undefined" && HB.wiki ? HB.wiki.ev || [] : [], me = nick(x.n);
  const hits = w.filter((e) => e.s && (e.pick || []).some((p) => nick(p.n) === me)).map((e) => e.s * 1000);
  if (hits.length) return Math.min(...hits);
  return x.up && x.up.at ? Date.parse(x.up.at) || 0 : 0;
}
const upOpenFor = (x) => upOwner() || (upAt(x) > 0 && upNow() >= upAt(x));
const upLocked = () => UP_ALL.filter((x) => !UP_IN.has(x.no));
const upIsUp = (no) => UP_ALL.some((x) => x.no === no);
// the ones that may be seen join NA's list; when the owner signs out (or the server says this isn't the owner after
// all), the ones not out on NA yet leave it again
function upAdmit() {
  let n = 0, out = 0;
  UP_ALL.forEach((x) => {
    const ok = upOpenFor(x);
    if (ok && !UP_IN.has(x.no)) {
      UP_IN.add(x.no); ATLAS_S.push(x); ATLAS_BY_NO.set(x.no, x);
      NICK_N.set(x.no, nick(x.n)); NICK_B.set(x.no, nick(x.n.replace(/\([^)]*\)/g, " ")));
      n++;
    } else if (!ok && UP_IN.has(x.no)) {
      UP_IN.delete(x.no); const i = ATLAS_S.indexOf(x); if (i >= 0) ATLAS_S.splice(i, 1);
      ATLAS_BY_NO.delete(x.no); NICK_N.delete(x.no); NICK_B.delete(x.no);
      out++;
    }
  });
  if (n || out) { ATLAS_S.sort((a, b) => a.no - b.no); PC_WORDS.clear(); PC_TRAITS = null; mineCache = null; }
  upAdmit.out = out;
  return n + out;
}
upAdmit();

/* ---------- words ---------- */
const UP_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const upEta = (x) => { const m = /^(\d{4})-(\d{2})/.exec((x.up && x.up.eta) || ""); return m ? UP_MONTHS[+m[2] - 1] + " " + m[1] : ""; };
const upWhen = (ms) => anFmt(ms, {weekday: "short", day: "numeric", month: "short", year: "numeric"}) + ", " + anFmt(ms, {hour: "2-digit", minute: "2-digit"});
// "Coming with Mystery House Crafters" / "in 3d 14:05:09"
function upCountHTML(x, big) {
  const at = upAt(x), now = upNow();
  if (at && at > now) return `<span class="up-cd${big ? " big" : ""}" data-up-at="${at}">${anCount(at - now)}</span>`;
  if (at) return `<span class="up-cd${big ? " big" : ""} on">On NA now</span>`;
  return `<span class="up-cd${big ? " big" : ""} tbd">${upEta(x) ? "Expected " + esc(upEta(x)) : "Date not announced"}</span>`;
}

/* ---------- Past Chaldea: the "Coming to NA" row ---------- */
function upRowHTML() {
  if (PC.view !== "servants") return "";
  const q = nname(PC.q), all = UP_ALL.filter((x) => (!PC.cls || x.c === PC.cls) && (!PC.r || x.r === Number(PC.r)) && (!q || nname(x.n).includes(q)));
  if (!all.length) return "";
  const own = upOwner();
  const card = (x) => {
    const open = UP_IN.has(x.no), at = upAt(x);
    return `<li><button type="button" class="up-card r${x.r}${open ? " open" : ""}" data-action="up-open" data-no="${x.no}" aria-label="${esc(x.n)}, ${esc(x.c)}, ${x.r} stars, ${open ? "" : "locked, "}coming to NA">
      <span class="up-face"><img src="${esc(aimg(x.f))}" alt="" loading="lazy" decoding="async">${CLASS_LOGO[x.c] ? `<img class="pc-cls" src="${CLASS_LOGO[x.c]}" alt="">` : ""}<span class="pc-st">${stars(x.r)}</span>${open ? "" : `<i class="up-lock" aria-hidden="true">${UP_LOCK}</i>`}</span>
      <span class="pc-n">${esc(x.n)}</span><span class="up-m">${esc(x.up && x.up.ev ? x.up.ev : x.c)}</span>${upCountHTML(x)}</button></li>`;
  };
  return `<section class="up-row" aria-labelledby="up-h"><div class="up-head"><h3 id="up-h">Coming to NA</h3>
    <p>${own ? "You're the owner: their pages are open for you. Everyone else sees a countdown until NA gets them." : "JP has these servants already. Their pages open here when NA gets them."}</p></div>
    <ul class="up-grid">${all.map(card).join("")}</ul></section>`;
}
const UP_LOCK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
const pcGridHTML53 = pcGridHTML;
pcGridHTML = function () { return upRowHTML() + pcGridHTML53.apply(this, arguments); };

/* ---------- the locked page ---------- */
function upLockedHTML(x) {
  const at = upAt(x), ev = x.up && x.up.ev;
  return `<div class="pcd-panel up-panel" tabindex="-1">
    <button type="button" class="pcd-x" data-action="pc-close" aria-label="Close">×</button>
    <div class="up-lockpage r${x.r}">
      <div class="up-art"><img src="${esc(aimg(x.im[0] || x.f))}" alt="" decoding="async"><i class="up-veil" aria-hidden="true"></i><i class="up-lock big" aria-hidden="true">${UP_LOCK}</i></div>
      <div class="up-info">
        <p class="pcd-kick">No. ${x.no} · ${esc(x.c)} · coming to NA</p>
        <h2 id="pcd-title" class="pcd-name">${CLASS_LOGO[x.c] ? `<img src="${CLASS_LOGO[x.c]}" alt="">` : ""}${esc(x.n)}</h2>
        <p class="pcd-stars" aria-label="${x.r} stars">${stars(x.r)}</p>
        <p class="up-say">${esc(x.n)}'s page opens here when NA gets them${ev ? `, with <b>${esc(ev)}</b>` : ""}.</p>
        <div class="up-clock">${at && at > upNow() ? `<p class="an-k">Opens in</p>` : ""}${upCountHTML(x, true)}
          ${at ? `<p class="up-when">${esc(upWhen(at))} your time</p>` : `<p class="up-when">The countdown starts once NA announces the date.</p>`}</div>
        <p class="pcd-src">Their skills, Noble Phantasm and numbers stay hidden until then.</p>
      </div>
    </div>
  </div>`;
}
// an open upcoming servant's own page says it isn't on NA yet, and its data is JP's
function upNoteHTML(x) {
  const at = upAt(x), own = upOwner() && at > upNow() || (upOwner() && !at);
  return `<div class="up-note${own ? " owner" : ""}"><p><b>${own ? "Only you can see this page." : "New on NA."}</b> ${own ? "Everyone else sees a countdown" + (at ? " until " + esc(upWhen(at)) + "." : (upEta(x) ? ", expected " + esc(upEta(x)) + "." : " until NA's date is known.")) : ""}
    The text comes from JP's data, so skill and NP descriptions are short until NA's own data replaces it.</p>${own && at ? upCountHTML(x) : ""}</div>`;
}
const pcDetailHTML53 = pcDetailHTML;
pcDetailHTML = function (x) {
  let h = pcDetailHTML53.apply(this, arguments);
  if (!x || !upIsUp(x.no)) return h;
  h = h.replace(`<div class="pcd-top">`, upNoteHTML(x) + `<div class="pcd-top">`)
    .replace(`https://apps.atlasacademy.io/db/NA/servant/${x.no}`, `https://apps.atlasacademy.io/db/JP/servant/${x.no}`)
    .replace("Data from Atlas Academy's NA export.", "Data from Atlas Academy's JP export, in English where they have it.");
  return h;
};
const pcRenderDetail53 = pcRenderDetail;
pcRenderDetail = function () {
  if (pcOpen && pcOpen.up) { const x = UP_ALL.find((u) => u.no === pcOpen.no); if (x) { pcDlg.innerHTML = upLockedHTML(x); return; } }
  return pcRenderDetail53.apply(this, arguments);
};
function upShow(no) {
  const x = UP_ALL.find((u) => u.no === no); if (!x) return;
  if (UP_IN.has(no)) { pcShow(no, false); return; }
  if (pcDlg.hidden) pcBack = document.activeElement;
  pcOpen = {no: no, ce: false, k: 0, up: true};
  pcRenderDetail();
  pcDlg.hidden = false; document.documentElement.classList.add("pcd-on");
  const shell = document.querySelector(".shell"); if (shell) shell.inert = true;
  const c = pcDlg.querySelector(".pcd-x"); if (c) c.focus({preventScroll: true});
}
// a locked servant asked for by number (a link, Home, the banner list) opens its locked page instead of nothing
const pcShow53 = pcShow;
pcShow = function (no, ce) {
  if (!ce && !ATLAS_BY_NO.has(no) && UP_ALL.some((u) => u.no === no)) { upShow(no); return; }
  return pcShow53.apply(this, arguments);
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action='up-open']"); if (!b) return;
  upShow(Number(b.dataset.no));
});

/* ---------- time ---------- */
// once a second while a countdown shows; when one ends, that servant opens for everyone
function upTick() {
  if (document.hidden || !UP_ALL.length) return;
  const els = document.querySelectorAll("[data-up-at]"); if (!els.length && !upLocked().length) return;
  const now = upNow();
  let ended = false;
  els.forEach((el) => { const at = +el.dataset.upAt; if (at <= now) ended = true; else el.textContent = anCount(at - now); });
  if (!ended && !upLocked().some((x) => upAt(x) && upAt(x) <= now)) return;
  upRecheck(true);
}
function upRecheck(say) {
  const before = new Set(UP_IN), n = upAdmit();
  if (!n) { if (pcOpen && pcOpen.up) pcRenderDetail(); if (S.tab === "past") pcResults(); return; }
  const fresh = UP_ALL.filter((x) => UP_IN.has(x.no) && !before.has(x.no));
  if (pcOpen && pcOpen.up && UP_IN.has(pcOpen.no)) { pcOpen.up = false; }
  if (pcOpen && !pcOpen.ce && !pcOpen.up && upIsUp(pcOpen.no) && !UP_IN.has(pcOpen.no)) { pcOpen.up = true; }
  renderAll();
  if (pcOpen) pcRenderDetail();
  if (say && !upOwner() && fresh.length) toast(fresh.length === 1 ? fresh[0].n + " is on NA now. Their page is open." : fresh.length + " servants are on NA now. Their pages are open.");
}
setInterval(upTick, 1000);
// the server answers who's signed in (and whether they're the owner) after the page has drawn
let upOwnerWas = upOwner();
const acctPaint53 = acctPaint;
acctPaint = function () { const r = acctPaint53.apply(this, arguments); if (API.checked && UP_ALL.length && upOwnerWas !== upOwner()) { upOwnerWas = upOwner(); upRecheck(false); } return r; };
// the wiki's dates arrive with Home's event board; Past Chaldea asks for them too
const hbPaint53 = hbPaint;
hbPaint = function () { const r = hbPaint53.apply(this, arguments); if (UP_ALL.length && S.tab === "past") pcResults(); if (pcOpen && pcOpen.up) pcRenderDetail(); return r; };
const renderPast53 = renderPast;
renderPast = function () { const r = renderPast53.apply(this, arguments); if (S.tab === "past" && UP_ALL.length && typeof hbLoad === "function" && !upPastAsked) { upPastAsked = true; hbLoad(false); } return r; };
let upPastAsked = false;
// for the tests: what's locked, and a stand-in clock
window.__fgiUpcoming = {all: () => UP_ALL.map((x) => ({no: x.no, n: x.n, at: upAt(x), open: UP_IN.has(x.no)})), owner: () => upOwner(), setNow: (ms) => { upNowFn = ms == null ? () => Date.now() : () => ms; upTick(); },
  wiki: (ev) => { HB.wiki = Object.assign({}, HB.wiki || {}, {ev: ev}); upRecheck(true); }};
