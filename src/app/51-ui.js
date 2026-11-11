/* ================= 0.50.0-beta: the new look, the sidebar, and moving between pages =================
   Two looks, picked in the sidebar and kept in this browser (spirit-origin-list:v1:ui = {look, mini}):
   - New (the default): the Chaldea terminal. Navy and gold like the game's own menus, and a sidebar on the left in
     place of the row of tabs, with everything that was in the header at its foot. On a computer it folds down to its
     icons (mini); on a phone it's a menu that slides in.
   - Classic: the page as it was in 0.28, with the sliding menu on phones only.
   The sidebar is made of the page's own parts, moved (the logo, the tabs, the header's buttons), so every button keeps
   what it does; going back to Classic on a computer puts them back where they were.
   Switching pages slides the new one in; the gold marker in the sidebar glides to the page you're on. */
const UI_KEY = "spirit-origin-list:v1:ui";
const UI_PHONE = window.matchMedia ? window.matchMedia("(max-width: 900px)") : {matches: false, addEventListener() {}};
let uiMem = null;
function uiPrefs() {
  if (uiMem) return uiMem;
  try { const d = JSON.parse(localStorage.getItem(UI_KEY) || "null"); uiMem = d && typeof d === "object" && !Array.isArray(d) ? d : {}; } catch (e) { uiMem = {}; }
  return uiMem;
}
function uiSave() { try { localStorage.setItem(UI_KEY, JSON.stringify(uiMem)); } catch (e) {} }
const uiLook = () => uiPrefs().look === "classic" ? "classic" : "beta";
// (page.html starts in the new look, so it never shows the old one first; Classic is put back here)
document.documentElement.setAttribute("data-ui", uiLook());

/* ---------- the icons in the sidebar ---------- */
const UI_IC = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
  servants: '<rect x="6" y="3.5" width="12" height="17" rx="1.6"/><path d="M12 7.2l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/><path d="M8.5 17.5h7"/>',
  story: '<path d="M12 6.5C10 5 7.5 4.6 4.5 5v13c3-.4 5.5 0 7.5 1.5 2-1.5 4.5-1.9 7.5-1.5V5c-3-.4-5.5 0-7.5 1.5z"/><path d="M12 6.5v13"/>',
  summon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><path d="M12 4v3.8M12 16.2V20M4 12h3.8M16.2 12H20"/>',
  parties: '<rect x="3.5" y="7" width="5" height="10" rx="1"/><rect x="9.5" y="5" width="5" height="12" rx="1"/><rect x="15.5" y="7" width="5" height="10" rx="1"/><path d="M6 19.5h12"/>',
  ranking: '<path d="M5 19.5V12M10 19.5V6M15 19.5V9.5M20 19.5V14"/><path d="M3.5 19.5h18"/>',
  versus: '<path d="M5 4.5l9.5 9.5M4.5 14l5 5M7 16.5l-3 3"/><path d="M19 4.5 9.5 14M19.5 14l-5 5M17 16.5l3 3"/>',
  battle: '<path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.3 7 9 4.1-1.7 7-4.7 7-9V6z"/><path d="M12 8v7M9 11.5h6"/>',
  past: '<path d="M4.5 8.5h15v11h-15z"/><path d="M3.5 5h17v3.5h-17z"/><path d="M10 12h4"/>',
  friends: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="8" r="2.6"/><path d="M15.5 13.2c2.6-.3 4.6 1.4 5.1 4.3"/>',
  _: '<circle cx="12" cy="12" r="7"/>'
};
const uiIcon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${UI_IC[k] || UI_IC._}</svg>`;

const UI_COG = '<svg class="cog" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.3 3.5h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9 1.8-1.6v-1.9L4.2 8.9l1.7-2.9 2.3.8 1.6-.9z"/><circle cx="12" cy="12" r="3"/></svg>';

/* ---------- 0.50.0-beta: the Settings page (the cog beside the account) ----------
   The header's tools live here in the new look and on phones: light or dark, the look, the servant page's layout, the
   sidebar's fold, fonts, the frame rate, export and import, the guide and What's new. They're the same buttons (moved,
   not copied), so everything they did still works; Classic on a computer puts them back in the header. */
TABS.push("settings");
const UI_SET_ROWS = [
  ["Look and feel", [
    ["theme", "Light or dark", ""],
    ["look", "Look", "Classic is the page as it was before 0.50."],
    ["layout", "Servant page", "Modern puts the servant beside your list; Compact opens them in a window."],
    ["menu", "Sidebar", "The pages' names and icons, or only the icons."],
    ["fonts", "Text", "The page's fonts."],
    ["fps", "Animations", "Fewer frames a second are lighter on a slow computer."],
    ["power", "Power saving", "The background moves at half the frame rate and rests after a minute without input. Cooler and quieter on a laptop."],
    ["scenecam", "Story scenes follow the pointer", "The chapter's scene shifts in depth as you move the pointer or scroll. Off keeps it still, which is lighter for the graphics card."],
    ["bg3d", "3D background", "A moving 3D picture behind the page, drawn by vanta.js. It follows the frame rate and power saving. Off is the lightest for the graphics card."],
    ["bg3dfx", "3D effect", "What moves behind the usual pages. With the Story look, each scene picks its own."],
    ["bg3dq", "3D quality", "Light draws it small and stretches it. Full is sharper and asks about four times as much of the graphics card."]]],
  ["Your data", [
    ["export", "Backup", "Download your servants, parties and pictures, or a spreadsheet."],
    ["import", "Bring a list in", "A backup from this page, a spreadsheet (.csv) or a planner's .json export."]]],
  ["Help", [
    ["guide", "New here?", "A short tour of the page."],
    ["news", "Updates", "Every version, newest first."]]]
];
function uiSetHTML() {
  const seg = (k) => k === "look"
    ? `<div class="seg set-seg" role="group" aria-label="Look"><button type="button" data-action="ui-look" data-v="beta">New</button><button type="button" data-action="ui-look" data-v="classic">Classic</button></div>`
    : k === "menu" ? `<div class="seg set-seg" role="group" aria-label="Sidebar"><button type="button" data-action="ui-mini" data-v="0">Names and icons</button><button type="button" data-action="ui-mini" data-v="1">Only icons</button></div>`
    : k === "scenecam" ? `<div class="seg set-seg" role="group" aria-label="Story scenes follow the pointer"><button type="button" data-action="scenecam" data-v="1">On</button><button type="button" data-action="scenecam" data-v="0">Off</button></div>`
    : k === "bg3d" ? `<div class="seg set-seg" role="group" aria-label="3D background"><button type="button" data-action="bg3d" data-v="1">On</button><button type="button" data-action="bg3d" data-v="0">Off</button></div><small class="bg3d-note" hidden></small>`
    : k === "bg3dfx" ? `<div class="seg set-seg set-seg-wrap" role="group" aria-label="3D effect">${[["globe", "Globe"], ["net", "Net"], ["fog", "Haze"], ["waves", "Waves"], ["clouds", "Clouds"], ["cells", "Cells"]].map((x) => `<button type="button" data-action="bg3d-fx" data-v="${x[0]}">${x[1]}</button>`).join("")}</div>`
    : k === "bg3dq" ? `<div class="seg set-seg" role="group" aria-label="3D quality"><button type="button" data-action="bg3d-q" data-v="light">Light</button><button type="button" data-action="bg3d-q" data-v="full">Full</button></div>`
    : k === "power" ? `<div class="seg set-seg" role="group" aria-label="Power saving"><button type="button" data-action="power" data-v="1">On</button><button type="button" data-action="power" data-v="0">Off</button></div>` : "";
  return `<button type="button" id="tab-settings" class="set-tab" data-action="tab" data-tab="settings" hidden tabindex="-1" aria-hidden="true">Settings</button>
    <div class="set-grid">${UI_SET_ROWS.map(([h, rows]) => `<section class="set-card" aria-labelledby="set-h-${esc(h.replace(/\W+/g, "-").toLowerCase())}"><h3 id="set-h-${esc(h.replace(/\W+/g, "-").toLowerCase())}">${esc(h)}</h3>
      ${rows.map(([k, t, d]) => `<div class="set-row set-${k}"><div class="set-l"><b>${esc(t)}</b>${d ? `<small>${esc(d)}</small>` : ""}</div><div class="set-c" data-set="${k}">${seg(k)}</div></div>`).join("")}</section>`).join("")}</div>`;
}
(function () {
  const sec = document.createElement("section");
  sec.id = "view-settings"; sec.className = "set-page"; sec.setAttribute("aria-label", "Settings"); sec.hidden = true; sec.innerHTML = uiSetHTML();
  const sh = document.querySelector(".shell"), ft = sh && sh.querySelector(":scope > .site-foot");
  if (ft) sh.insertBefore(sec, ft); else if (sh) sh.appendChild(sec);
  if ((location.hash || "").slice(1) === "settings") S.tab = "settings";
})();
function uiSetFill() {
  const set = document.getElementById("view-settings"), acts = document.querySelector(".mast-actions"); if (!set || !acts) return;
  const slot = (k) => set.querySelector(`[data-set="${k}"]`), pick = (sel) => acts.querySelector(":scope > " + sel);
  uiMove(pick("#theme-tgl"), slot("theme"));
  uiMove(pick("#layout-tgl"), slot("layout"));
  uiMove(pick('[data-action="fonts"]'), slot("fonts"));
  uiMove(pick("#fps-btn"), slot("fps"));
  uiMove(pick("#export-wrap"), slot("export"));
  uiMove(pick("#lbl-import"), slot("import"));
  uiMove(pick('[data-action="tour"]'), slot("guide"));
  uiMove(pick(".news-btn"), slot("news"));
}

/* ---------- building the sidebar, and taking it apart ---------- */
const uiMoved = [];   // [node, its old parent, the node it came before]
function uiMove(node, into) {
  if (!node || !into || node.parentNode === into) return;
  uiMoved.push([node, node.parentNode, node.nextSibling]);
  into.appendChild(node);
}
function uiSideHTML() {
  return `<aside id="side" class="side" aria-label="Menu">
      <div class="side-top"><a class="side-gem" href="#home" data-action="go-home" aria-label="Fate/Grand Index, Home" title="Home"><svg viewBox="118 50 276 412" aria-hidden="true" focusable="false">
        <defs><linearGradient id="sd-gem-au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe7ad"/><stop offset=".45" stop-color="#d9a640"/><stop offset="1" stop-color="#8c5c12"/></linearGradient></defs>
        <g fill="none" stroke="url(#sd-gem-au)" stroke-linejoin="miter" stroke-miterlimit="10"><path d="M256 66 L374 256 L256 446 L138 256 Z" stroke-width="28"/><path d="M256 150 L322 256 L256 362 L190 256 Z" stroke-width="20"/></g>
        <path d="M256 214 L282 256 L256 298 L230 256 Z" fill="url(#sd-gem-au)"/></svg></a></div>
      <div class="side-nav"><i class="side-mark" aria-hidden="true"></i></div>
      <div class="side-tools"><button type="button" class="side-cog" data-action="tab" data-tab="settings" title="Settings" aria-label="Settings">${UI_COG}<span class="side-cog-t">Settings</span><i class="side-cog-dot" aria-hidden="true" hidden></i></button></div>
    </aside><div id="side-scrim" class="side-scrim" data-action="ui-close" aria-hidden="true"></div>`;
}
function uiBuild() {
  const root = document.documentElement;
  let side = document.getElementById("side");
  if (!side) { document.body.insertAdjacentHTML("afterbegin", uiSideHTML()); side = document.getElementById("side"); }
  const mast = document.querySelector(".masthead"), brand = mast && mast.querySelector(".brand") || document.querySelector(".side .brand");
  uiMove(document.querySelector(".masthead .eyebrow"), side.querySelector(".side-top"));
  uiMove(brand, side.querySelector(".side-top"));
  uiMove(document.querySelector("nav.tabs"), side.querySelector(".side-nav"));
  uiMove(document.querySelector(".mast-actions"), side.querySelector(".side-tools"));
  // (the account stays beside the cog; everything else in the header goes to Settings)
  const tools = side.querySelector(".side-tools"), cog = tools.querySelector(".side-cog"); if (cog) tools.appendChild(cog);
  uiSetFill();
  // the bar across the top: the menu button (phones), the page's name, and the logo small (phones)
  if (mast && !mast.querySelector(".top-bar")) {
    const logo = document.querySelector(".brand-logo");
    mast.insertAdjacentHTML("afterbegin", `<div class="top-bar"><button type="button" class="side-btn" data-action="ui-open" aria-controls="side" aria-expanded="false" aria-label="Open the menu"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h10"/></svg></button>
      <a class="top-logo" href="#home" data-action="go-home" aria-label="Fate/Grand Index, Home">${logo ? `<img src="${logo.getAttribute("src")}" alt="" width="110" height="44">` : "Fate/Grand Index"}</a>
      <h2 class="top-title" id="top-title" aria-live="polite"></h2></div>`);
  }
  root.classList.add("has-side");
  const tryB = document.querySelector(".mast-actions .ui-try"); if (tryB) tryB.remove();
  // the tabs get their icons (once; they keep them in Classic too, where they stay hidden on a computer)
  document.querySelectorAll("nav.tabs .tab").forEach((t) => {
    if (t.querySelector(".tab-ic")) return;
    const label = t.textContent.trim();
    t.innerHTML = `<i class="tab-ic">${uiIcon(t.dataset.tab)}</i><span class="tab-t">${esc(label)}</span>`;
    t.title = label;
  });
  uiSync();
}
function uiTakeApart() {
  const root = document.documentElement;
  while (uiMoved.length) { const [n, p, nx] = uiMoved.pop(); if (p) p.insertBefore(n, nx && nx.parentNode === p ? nx : null); }
  const tb = document.querySelector(".masthead .top-bar"); if (tb) tb.remove();
  root.classList.remove("has-side", "side-open");
  const side = document.getElementById("side"); if (side) side.remove();
  // (Classic on a computer has no menu with the switch in it: the header gets a way back)
  const acts = document.querySelector(".mast-actions");
  if (acts && !acts.querySelector(".ui-try")) acts.insertAdjacentHTML("beforeend", `<button type="button" class="btn ghost ui-try" data-action="ui-look" data-v="beta" title="Switch to the new look">New look</button>`);
  const sc = document.getElementById("side-scrim"); if (sc) sc.remove();
  // (and Settings is the header again: its page has nothing left on it)
  if (S.tab === "settings" && !UI_PHONE.matches) { S.tab = "home"; try { history.replaceState(history.state, "", "#home"); } catch (e) {} }
}
// the sidebar is there in the new look, and on phones in either look
const uiMini = () => uiPrefs().mini === true;
function uiApply() {
  const root = document.documentElement, look = uiLook();
  root.setAttribute("data-ui", look);
  root.classList.toggle("side-mini", look === "beta" && uiMini() && !UI_PHONE.matches);
  if (look === "beta" || UI_PHONE.matches) uiBuild(); else uiTakeApart();
  try { paintPage(); } catch (e) {}
}
UI_PHONE.addEventListener("change", () => { uiClose(true); uiApply(); });

/* ---------- the phone's sliding menu ---------- */
function uiOpen() {
  const root = document.documentElement; if (!UI_PHONE.matches) return;
  root.classList.add("side-open");
  const side = document.getElementById("side"); if (side) { side.inert = false; const f = side.querySelector('.tab[aria-selected="true"]') || side.querySelector("button"); if (f) f.focus({preventScroll: true, focusVisible: false}); }
  const b = document.querySelector(".side-btn"); if (b) b.setAttribute("aria-expanded", "true");
}
function uiClose(quiet) {
  const root = document.documentElement, was = root.classList.contains("side-open");
  root.classList.remove("side-open");
  const side = document.getElementById("side"), sh = document.querySelector(".shell"); if (side) side.inert = UI_PHONE.matches || !!(sh && sh.inert);
  const b = document.querySelector(".side-btn"); if (b) { b.setAttribute("aria-expanded", "false"); if (was && !quiet) b.focus({preventScroll: true}); }
}
// a swipe to the left closes it
(function () {
  let x0 = null, y0 = 0;
  document.addEventListener("touchstart", (e) => { if (!document.documentElement.classList.contains("side-open") || !e.target.closest || !e.target.closest("#side")) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, {passive: true});
  document.addEventListener("touchend", (e) => { if (x0 == null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null; if (dx < -60 && Math.abs(dy) < 50) uiClose(); }, {passive: true});
})();
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.documentElement.classList.contains("side-open")) { e.stopPropagation(); uiClose(); } }, true);

/* ---------- what the sidebar shows: the page you're on, the look, folded or not ---------- */
function uiMark() {
  const nav = document.querySelector(".side-nav"), t = nav && nav.querySelector('.tab[aria-selected="true"]'), m = nav && nav.querySelector(".side-mark");
  if (!m) return;
  if (!t) { m.style.opacity = "0"; return; }
  m.style.opacity = "1"; m.style.transform = `translateY(${t.offsetTop}px)`; m.style.height = t.offsetHeight + "px";
}
function uiSync() {
  const side = document.getElementById("side"); if (!side) return;
  document.querySelectorAll('#view-settings [data-action="ui-look"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === uiLook())));
  document.querySelectorAll('#view-settings [data-action="ui-mini"]').forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.v === "1") === uiMini())));
  // the cog: lit on its page, a dot while What's new is unread, and the whole width when there's no account button beside it
  const cog = side.querySelector(".side-cog"), acct = document.getElementById("acct-btn"), nd = document.querySelector(".news-dot");
  if (cog) {
    if (S.tab === "settings") cog.setAttribute("aria-current", "page"); else cog.removeAttribute("aria-current");
    const dot = cog.querySelector(".side-cog-dot"); if (dot) dot.hidden = !nd || nd.hidden;
  }
  side.classList.toggle("has-acct", !!(acct && !acct.hidden && side.contains(acct)));
  // closed on a phone, or a window is open over the page (the page itself is inert then, and so is the menu beside it)
  const sh = document.querySelector(".shell");
  side.inert = (UI_PHONE.matches && !document.documentElement.classList.contains("side-open")) || !!(sh && sh.inert);
  const tt = document.getElementById("top-title"), cur = document.querySelector('nav.tabs .tab[aria-selected="true"] .tab-t');
  if (tt) tt.textContent = S.tab === "settings" ? "Settings" : cur ? cur.textContent : "";
  uiMark();
}

/* ---------- moving between pages ---------- */
let uiTab = null;
const renderChrome51 = renderChrome;
renderChrome = function () {
  const r = renderChrome51.apply(this, arguments);
  try {
    if (uiTab !== null && uiTab !== S.tab) {
      const v = document.getElementById("view-" + S.tab);
      if (v) { v.classList.remove("view-in"); void v.offsetWidth; v.classList.add("view-in"); setTimeout(() => { v.classList.remove("view-in"); if (typeof queueDsFrame === "function") queueDsFrame(); }, 700); }
      if (UI_PHONE.matches) uiClose(true);
    }
    uiTab = S.tab; uiSync();
  } catch (e) {}
  return r;
};
window.addEventListener("resize", () => requestAnimationFrame(uiMark));
// every window that makes the page inert (the Workshop, a summon, Past Chaldea's, the Saint Graph maker …) does it to
// .shell; the menu lives beside .shell, so it follows along
(() => { const sh = document.querySelector(".shell"); if (sh && window.MutationObserver) new MutationObserver(() => uiSync()).observe(sh, {attributes: true, attributeFilter: ["inert"]}); })();

document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action^="ui-"]'); if (!b) return;
  const a = b.dataset.action;
  if (a === "ui-open") { e.preventDefault(); if (document.documentElement.classList.contains("side-open")) uiClose(); else uiOpen(); }
  else if (a === "ui-close") uiClose();
  else if (a === "ui-look") {
    const v = b.dataset.v === "classic" ? "classic" : "beta"; if (v === uiLook()) return;
    const was = uiLook(); uiPrefs().look = v; uiSave(); uiApply(); renderChrome(); uiSync();
    toastAction(v === "classic" ? "Classic look: the page as it was before 0.50." : "The new look is on.", "Undo", () => { uiPrefs().look = was; uiSave(); uiApply(); renderChrome(); uiSync(); });
  } else if (a === "ui-mini") {
    const v = b.dataset.v != null ? b.dataset.v === "1" : !uiMini(); if (v === uiMini()) return;
    uiPrefs().mini = v; uiSave(); uiApply(); uiSync();
  }
});
// a page picked in the phone's menu closes the menu (the page changes underneath), and so do Settings, the version chip
// (What's new) and the account button
document.addEventListener("click", (e) => {
  if (!UI_PHONE.matches || !e.target.closest) return;
  const t = e.target.closest('#side .tab, #side .side-cog, #side [data-action="news"], #side #acct-btn');
  if (t) setTimeout(() => uiClose(true), 0);
});

// the cog's dot follows What's new's, and the cog widens when there's no account button beside it
const syncNewsDot51 = syncNewsDot;
syncNewsDot = function () { const r = syncNewsDot51.apply(this, arguments); try { uiSync(); } catch (e) {} return r; };
if (typeof acctPaint === "function") { const acctPaint51 = acctPaint; acctPaint = function () { const r = acctPaint51.apply(this, arguments); try { uiSync(); } catch (e) {} return r; }; }

/* ---------- the background when no servant gives it colours: gold in the new look (Chaldea's blue until 0.53.0) ---------- */
const UI_PAL = ["#c9ad6a", "#8a6f35", "#e8d9a8"];
const paintPage51 = paintPage;
paintPage = function () {
  const keep = curPal, swap = uiLook() === "beta" && curPal === DEFAULT_PAL;
  if (swap) { curPal = UI_PAL; PAGE.pal = UI_PAL.map(hexToRgb); }
  try { return paintPage51.apply(this, arguments); } finally { if (swap) curPal = keep; }
};

/* ---------- Past Chaldea's window drops in; the sidebar waits behind it like the page does ---------- */
let uiDropT = 0;
const pcShow51 = pcShow;
pcShow = function () {
  const was = pcDlg.hidden, r = pcShow51.apply(this, arguments);
  try {
    const side = document.getElementById("side"); if (side && !pcDlg.hidden) side.inert = true;
    if (was && !pcDlg.hidden) { pcDlg.classList.remove("pcd-drop"); void pcDlg.offsetWidth; pcDlg.classList.add("pcd-drop"); clearTimeout(uiDropT); uiDropT = setTimeout(() => pcDlg.classList.remove("pcd-drop"), 1000); }
  } catch (e) {}
  return r;
};
const pcClose51 = pcClose;
pcClose = function () { const r = pcClose51.apply(this, arguments); try { pcDlg.classList.remove("pcd-drop"); uiSync(); } catch (e) {} return r; };

uiApply();
