/* ================= 0.17.0: Fate/Grand Index — a new name, Compact as a window, and a footer ================= */

/* ---------- Compact: a servant's page opens as a window over the list ---------- */
const cmpVeil = document.createElement("div");
cmpVeil.className = "cmp-veil"; cmpVeil.hidden = true; cmpVeil.setAttribute("aria-hidden", "true");
// a click outside the window closes it, the same way as × and Esc
const cmpClose = () => { if (S.editing) dropFormArt(); S.selected = null; S.editing = null; renderList(); renderDossier(); };
cmpVeil.addEventListener("click", cmpClose);
// × sits on the window's top-right corner, outside its content, so it never covers a button
const cmpX = document.createElement("button");
cmpX.type = "button"; cmpX.className = "cmp-x"; cmpX.hidden = true; cmpX.setAttribute("aria-label", "Close"); cmpX.textContent = "×";
cmpX.addEventListener("click", cmpClose);
// the veil and × sit next to the servant page, in the same layer, so they fall between the list and the window
(() => { const d = document.getElementById("dossier"); if (d && d.parentNode) { d.parentNode.insertBefore(cmpVeil, d); d.parentNode.insertBefore(cmpX, d.nextSibling); } else { document.body.appendChild(cmpVeil); document.body.appendChild(cmpX); } })();
const cmpModal = () => pageLayout === "compact" && isWide();
function syncCmpModal() {
  const d = document.getElementById("dossier"), on = !!(cmpModal() && d && d.classList.contains("open") && S.tab === "servants");
  const was = !cmpVeil.hidden;
  cmpVeil.hidden = !on; cmpX.hidden = !on;
  document.documentElement.classList.toggle("cmp-open", on);
  // opening the window moves focus into it; closing it hands focus back to the list
  if (on && !was) cmpX.focus({preventScroll: true});
  if (!on && was && S.lastSel) { const r = document.querySelector(`#list .row[data-id="${CSS.escape(S.lastSel)}"]`); if (r) r.focus({preventScroll: true}); }
  if (d) { if (on) { d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); } else { d.removeAttribute("role"); d.removeAttribute("aria-modal"); } }
}
const renderDossier18 = renderDossier;
renderDossier = function (force) {
  const r = renderDossier18(force);
  syncCmpModal();
  return r;
};
const renderChrome18 = renderChrome;
renderChrome = function () { const r = renderChrome18.apply(this, arguments); syncCmpModal(); return r; };
window.addEventListener("resize", () => { clearTimeout(syncCmpModal._t); syncCmpModal._t = setTimeout(syncCmpModal, 120); });

/* ---------- the footer ---------- */
const FOOT_TABS = [["home", "Home"], ["servants", "Servants"], ["summon", "Summoning"], ["parties", "Parties"], ["ranking", "Ranking"], ["versus", "Versus"], ["past", "Past Chaldea"]];
function footHTML() {
  const logo = (document.querySelector(".brand-logo") || {}).src || "";
  return `<div class="sf-grid">
      <div class="sf-brand">
        ${logo ? `<img class="sf-logo" src="${logo}" alt="Fate/Grand Index" width="176" height="70" loading="lazy">` : `<b>Fate/Grand Index</b>`}
        <p>A Fate/Grand Order index with every NA servant and Craft Essence, and a Spirit Origin List of your own.</p>
        <p><button type="button" class="ver-chip" data-action="news" title="What's new in this version">v${APP_VER} · alpha</button></p>
      </div>
      <nav class="sf-col" aria-label="Pages"><h2>Explore</h2><ul>${FOOT_TABS.map((t) => `<li><button type="button" data-action="tab" data-tab="${t[0]}" data-foot>${t[1]}</button></li>`).join("")}</ul></nav>
      <div class="sf-col"><h2>Your data</h2>
        <p class="sf-save" id="sf-save"></p>
        <ul>
          <li><button type="button" data-action="export">Download a backup</button></li>
          <li><button type="button" data-action="foot-import">Import a backup or spreadsheet</button></li>
          <li><button type="button" data-action="export-csv">Export as a spreadsheet</button></li>
          ${S.readOnly ? "" : `<li><button type="button" data-action="sf-open" class="sf-danger">Start fresh…</button></li>`}
        </ul>
        <p class="sf-acct"><span class="sf-pill">Local save</span> Accounts and signing in are on the way.</p>
      </div>
      <div class="sf-col"><h2>Help</h2><ul>
        <li><button type="button" data-action="tour">Guide</button></li>
        <li><button type="button" data-action="news">What's new</button></li>
        <li><button type="button" data-action="fonts">Fonts</button></li>
        <li><button type="button" data-action="theme">Light / dark</button></li>
        <li><button type="button" data-action="layout">Modern / Compact layout</button></li>
      </ul></div>
    </div>
    <div class="sf-bottom">
      <p>Servant and Craft Essence data and pictures from <a href="https://atlasacademy.io" target="_blank" rel="noopener">Atlas Academy</a>; skill notes from the <a href="https://fategrandorder.fandom.com" target="_blank" rel="noopener">Fate/Grand Order Wiki</a>.</p>
      <p>Fate/Grand Index is a fan project, not affiliated with or endorsed by TYPE-MOON, Aniplex or Lasengle. Fate/Grand Order and its characters belong to their owners.</p>
      <button type="button" class="sf-top" data-action="to-top">Back to top ↑</button>
    </div>`;
}
const foot = document.createElement("footer");
foot.className = "site-foot"; foot.setAttribute("role", "contentinfo");
(document.querySelector(".shell") || document.body).appendChild(foot);
foot.innerHTML = footHTML();
function renderFoot() {
  const el = document.getElementById("sf-save"); if (!el) return;
  const own = S.servants.filter((s) => !s.wish).length, gu = S.servants.filter((s) => s.wish).length;
  let last = null; try { last = localStorage.getItem("spirit-origin-list:v1:lastBackup"); } catch (e) {}
  const when = last ? new Date(last).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"}) : null;
  el.textContent = "Saved in this browser: " + plural(own, "servant") + (gu ? ", " + plural(gu, "Guest") : "") + ", " + plural((S.parties || []).length, "party", "parties") + ". " + (when ? "Last backup " + when + "." : "No backup yet.");
}
const renderAll18 = renderAll;
renderAll = function () { renderAll18(); renderFoot(); syncCmpModal(); };
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action;
  if (a === "foot-import") { const f = document.getElementById("f-import"); if (f) f.click(); return; }
  if (a === "to-top") { window.scrollTo({top: 0, behavior: RM.matches ? "auto" : "smooth"}); return; }
  if (a === "tab" && b.hasAttribute("data-foot")) { setTimeout(() => window.scrollTo({top: 0}), 0); return; }
  if (a === "layout") setTimeout(syncCmpModal, 0);
});
