/* ================= 0.60.0: your favourite servant ================= */
// Noyr (28 Nov 2026): "nice colours and animation around a SERVANTPAGE (during idle and when clicking) on your selected
// FAVOURITE servant". One servant at a time is your favourite: press the heart on their page. Their page then wears a
// halo in the colours of their own picture (--p1..--p3, from applyTheme): a ring around the page with one light
// travelling round it, a slow breathing glow, motes and sparkles rising along its sides, and a burst of light wherever
// you click on it. Their row in the roster gets a small heart.
// - The heart is a button of its own, without a word next to it, so the page's header keeps its room for the name.
// - Kept under its own key (the roster's servants aren't touched), and it syncs with your account like the tier board.
// - Like the grail frame (10-motion.js), the halo is a layer of its own laid over the page, so nothing inside the page
//   is redrawn for it. Only transform and opacity move; the looping parts are CSS animations, so the frame-rate switch
//   steps them like the rest, and they stop when the halo is hidden (another servant, another page, a phone's list).
//   With reduced motion, only the still ring and glow stay.
const FAV_KEY = "spirit-origin-list:v1:favourite";
EXTRA_KEYS.favourite = FAV_KEY; EXTRA_BY_KEY.set(FAV_KEY, "favourite");
function favId() { try { return localStorage.getItem(FAV_KEY) || ""; } catch (e) { return ""; } }
function setFavId(id) { try { if (id) localStorage.setItem(FAV_KEY, id); else localStorage.removeItem(FAV_KEY); } catch (e) {} }
const favAllowed = () => !S.readOnly && !VIEWING();
const favServant = () => { const id = favId(); return id && favAllowed() ? S.servants.find((x) => x.id === id && !x.wish) || null : null; };
const FAV_HEART = `<svg class="fv-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.2-4.5-9.6-9.1C.8 8.7 2.6 4.5 6.6 4.5c2.2 0 3.7 1.2 5.4 3.2 1.7-2 3.2-3.2 5.4-3.2 4 0 5.8 4.2 4.2 7.4C19.2 16.5 12 21 12 21z"/></svg>`;

/* ---------- the heart on the servant page, and in the roster ---------- */
function favBtnHTML(s) {
  const on = favId() === s.id;
  return `<button type="button" class="btn sm fav-btn${on ? " on" : ""}" data-action="fav-toggle" data-id="${esc(s.id)}" aria-pressed="${on}" title="${on ? esc(s.name) + " is your favourite servant. Press to unset" : "Make " + esc(s.name) + " your favourite servant"}">${FAV_HEART}<span class="vh">Favourite</span></button>`;
}
function favDecor() {
  const d = document.getElementById("dossier"), s = S.selected ? S.servants.find((x) => x.id === S.selected) : null;
  const acts = d && d.querySelector(".d-head-actions");
  if (acts) {
    const old = acts.querySelector(".fav-btn"), show = s && !s.wish && favAllowed();
    if (!show) { if (old) old.remove(); }
    else {
      const html = favBtnHTML(s);
      if (!old) acts.insertAdjacentHTML("afterbegin", html);
      else if (old.dataset.id !== s.id || old.classList.contains("on") !== (favId() === s.id)) old.outerHTML = html;
    }
  }
  if (d) d.classList.toggle("is-fav", !!(s && favServant() === s));
  favMarkList(); queueFav();
}
function favMarkList() {
  const id = favServant() ? favId() : "";
  document.querySelectorAll("#list .row.is-fav").forEach((r) => { if (r.dataset.id !== id) { r.classList.remove("is-fav"); const m = r.querySelector(":scope > .fav-mark"); if (m) m.remove(); } });
  if (!id) return;
  const r = document.querySelector('#list .row[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  if (r && !r.classList.contains("is-fav")) { r.classList.add("is-fav"); r.insertAdjacentHTML("beforeend", `<i class="fav-mark" aria-hidden="true">${FAV_HEART}</i><span class="vh">, your favourite</span>`); }
}
const renderDossierFav = renderDossier;
renderDossier = function (force) { const r = renderDossierFav(force); favDecor(); return r; };
const renderListFav = renderList;
renderList = function () { const r = renderListFav.apply(this, arguments); favMarkList(); return r; };

document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="fav-toggle"]'); if (!b || !favAllowed()) return;
  const s = S.servants.find((x) => x.id === b.dataset.id); if (!s) return;
  const was = favId(), now = was === s.id ? "" : s.id;
  setFavId(now); favDecor();
  if (now) favPop(b);
  const prev = was && was !== s.id ? S.servants.find((x) => x.id === was) : null;
  toastAction(now ? s.name + " is your favourite servant now" + (prev ? ", in place of " + prev.name : "") + "." : s.name + " isn't your favourite servant any more.", "Undo", () => { setFavId(was); favDecor(); });
});
// the heart pops when it's pressed on
function favPop(b) {
  const h = b.querySelector(".fv-heart"); if (!h || RM.matches || !h.animate) return;
  h.animate([{transform: "scale(1)"}, {transform: "scale(1.45)", offset: 0.35}, {transform: "scale(.92)", offset: 0.7}, {transform: "scale(1)"}], {duration: 520, easing: "ease-out"});
}

/* ---------- the halo: a layer laid over the page, where the page is ---------- */
const favFrame = document.createElement("div");
favFrame.className = "fav-frame"; favFrame.hidden = true; favFrame.setAttribute("aria-hidden", "true");
// motes and sparkles along both sides and the bottom (placed the same way every time, so the halo doesn't jump)
const FAV_MOTES = Array.from({length: 16}, (_, i) => {
  const side = i % 4 === 3 ? "b" : i % 2 ? "r" : "l", f = ((i * 37) % 16) / 16, g = ((i * 53) % 13) / 13;
  const x = side === "l" ? (-2 + g * 10) + "px" : side === "r" ? "calc(100% - " + (8 + g * 10) + "px)" : (8 + f * 84) + "%";
  const y = side === "b" ? "calc(100% - " + (6 + g * 8) + "px)" : (28 + f * 68) + "%";
  const dx = side === "l" ? -(4 + g * 14) : side === "r" ? 4 + g * 14 : (g - 0.5) * 30, dy = -(90 + f * 170);
  return `<s class="${i % 3 === 1 ? "sp" : ""}" style="--x:${x};--y:${y};--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(0)}px;--s:${(i % 3 === 1 ? 9 : 4) + g * 4}px;--t:${(5.5 + f * 4).toFixed(2)}s;--d:${(-(i * 0.73) % 9).toFixed(2)}s;--c:var(--p${1 + i % 3});--o:${(0.55 + g * 0.4).toFixed(2)}"></s>`;
}).join("");
favFrame.innerHTML = `<i class="fv-glow"></i><i class="fv-ring"><b></b></i><i class="fv-flash"></i><i class="fv-motes">${FAV_MOTES}</i><i class="fv-bursts"></i>`;
(() => { const d = document.getElementById("dossier"); if (d && d.parentNode) d.parentNode.insertBefore(favFrame, d.nextSibling); else document.body.appendChild(favFrame); })();
let favRaf = 0, favTimer = 0;
function placeFav() {
  favRaf = 0;
  const d = document.getElementById("dossier"), s = favServant();
  const on = d && s && S.tab === "servants" && S.selected === s.id;
  const r = on ? d.getBoundingClientRect() : null;
  if (!on || !r || r.width < 20 || r.height < 20 || getComputedStyle(d).display === "none") { if (!favFrame.hidden) { favFrame.hidden = true; favFrame.querySelector(".fv-bursts").innerHTML = ""; } return; }
  favFrame.hidden = false;
  const z = UI_Z || 1, st = favFrame.style, zi = getComputedStyle(d).zIndex;
  // a page with room around it (the wide layout) gets the halo just outside its edge, past the grail frame; a page that
  // fills the screen (a phone's, or a narrow window's, where the scroll bar takes a little of the width) gets it just inside
  // (the wide layout's page always has the roster to its left, so the left edge tells them apart)
  const full = r.left <= 6, out = full ? -3 : 7;
  favFrame.classList.toggle("in", full);
  st.zIndex = zi === "auto" ? "" : zi;
  st.left = (r.left / z - out) + "px"; st.top = (r.top / z - out) + "px"; st.width = (r.width / z + out * 2) + "px"; st.height = (r.height / z + out * 2) + "px";
  st.borderRadius = (parseFloat(getComputedStyle(d).borderTopLeftRadius) || 0) + Math.max(0, out) + "px";
}
const queueFav = () => { if (!favRaf) favRaf = requestAnimationFrame(placeFav); clearTimeout(favTimer); favTimer = setTimeout(() => { if (!favRaf) favRaf = requestAnimationFrame(placeFav); }, 260); };
window.addEventListener("scroll", () => { if (!favFrame.hidden && !favRaf) favRaf = requestAnimationFrame(placeFav); }, {passive: true});
window.addEventListener("resize", queueFav);
const renderChromeFav = renderChrome;
renderChrome = function () { renderChromeFav(); favDecor(); };
if (window.ResizeObserver) { const d = document.getElementById("dossier"); if (d) new ResizeObserver(queueFav).observe(d); }
if (window.MutationObserver) new MutationObserver(queueFav).observe(document.documentElement, {attributes: true, attributeFilter: ["class", "data-theme"]});
// a favourite pulled in from your account (another device) shows straight away
const syncApplyFav = typeof syncApply === "function" ? syncApply : null;
if (syncApplyFav) syncApply = function () { const r = syncApplyFav.apply(this, arguments); Promise.resolve(r).then(() => favDecor(), () => {}); return r; };

/* ---------- a burst of light where you click on the favourite's page ---------- */
let favLastBurst = 0;
document.addEventListener("pointerdown", (e) => {
  if (favFrame.hidden || RM.matches || e.button > 0) return;
  const d = document.getElementById("dossier"); if (!d || !d.contains(e.target)) return;
  const now = performance.now(); if (now - favLastBurst < 90) return; favLastBurst = now;
  const box = favFrame.querySelector(".fv-bursts"); if (!box.animate) return;
  while (box.childElementCount >= 4) box.firstElementChild.remove();
  const z = UI_Z || 1, x = e.clientX / z - parseFloat(favFrame.style.left), y = e.clientY / z - parseFloat(favFrame.style.top);
  const b = document.createElement("i"); b.className = "fv-burst"; b.style.left = x + "px"; b.style.top = y + "px";
  const N = 10, sparks = [];
  let html = `<i class="ring"></i><i class="ring two"></i>`;
  for (let i = 0; i < N; i++) html += `<i class="spark${i % 2 ? " sp" : ""}" style="--c:var(--p${1 + i % 3})"></i>`;
  b.innerHTML = html; box.appendChild(b);
  const rings = b.querySelectorAll(".ring");
  // each part keeps its light through the first half and fades over the second (one easing over the whole animation
  // faded them before they'd grown)
  rings[0].animate([{transform: "scale(.18)", opacity: 0.3, easing: "cubic-bezier(.2,.8,.4,1)"}, {transform: "scale(.62)", opacity: 1, offset: 0.3, easing: "ease-in"}, {transform: "scale(1.05)", opacity: 0}], {duration: 720});
  rings[1].animate([{transform: "scale(.1)", opacity: 0.4, easing: "ease-out"}, {transform: "scale(.4)", opacity: 0.95, offset: 0.3, easing: "ease-in"}, {transform: "scale(.7)", opacity: 0}], {duration: 600, delay: 60, fill: "backwards"});
  b.querySelectorAll(".spark").forEach((el, i) => {
    const a = (i / N) * 360 + (Math.random() * 24 - 12), r = 38 + Math.random() * 30;
    sparks.push(el.animate([
      {transform: `rotate(${a}deg) translateX(6px) scale(.6)`, opacity: 1, easing: "cubic-bezier(.15,.8,.35,1)"},
      {transform: `rotate(${a + 8}deg) translateX(${r * 0.8}px) scale(1.15)`, opacity: 1, offset: 0.55, easing: "ease-in"},
      {transform: `rotate(${a + 22}deg) translateX(${r}px) scale(.3)`, opacity: 0}], {duration: 700 + Math.random() * 160}));
  });
  // the whole ring lights up for a moment
  favFrame.querySelector(".fv-flash").animate([{opacity: 0}, {opacity: 0.85, offset: 0.2}, {opacity: 0}], {duration: 700, easing: "ease-out"});
  Promise.all(sparks.map((a) => a.finished)).then(() => b.remove(), () => b.remove());
}, {passive: true});
