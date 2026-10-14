/* ================= v12: a servant from Past Chaldea on Home, a new one each day ================= */
function pcSpotlight() {
  const mine = mineMap(), pool = ATLAS_S.filter((x) => !mine.has(x.no) && !x.h && x.r >= 3);
  if (!pool.length) return null;
  const d = new Date(), seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  return pool[(seed * 2654435761 >>> 0) % pool.length];
}
function homePastHTML() {
  const x = pcSpotlight(), left = ATLAS_S.length - mineMap().size;
  const body = x ? `<button type="button" class="hp-spot r${x.r}" data-action="pc-open" data-no="${x.no}">
      <span class="hp-face"><img src="${esc(aimg(x.f))}" alt="" loading="lazy"></span>
      <span class="hm-main"><small class="hp-k">Today's visitor</small><b>${esc(x.n)}</b><small>${esc([x.c, "★".repeat(x.r), x.np ? (CARD_OF[x.np.cd] || "") + " " + (x.np.tg || "") : ""].filter(Boolean).join(" · "))}</small>${x.np ? `<small class="hp-np">${esc(x.np.n)}</small>` : ""}</span></button>` : `<p class="tr-none">You have every NA servant. Impressive, Master.</p>`;
  return `<section class="d-sec hm-block hm-b-past"><h3>Past Chaldea <small>${plural(left, "servant")} you haven't summoned</small></h3>${body}<div><button type="button" class="btn ghost sm" data-action="tab" data-tab="past">Browse Past Chaldea</button></div></section>`;
}
const renderHome11 = renderHome;
renderHome = function () {
  renderHome11();
  const g = document.querySelector("#home .hm-grid"), rec = g && g.querySelector(".hm-b-rec");
  if (g && !g.querySelector(".hm-b-past")) { const t = document.createElement("div"); t.innerHTML = homePastHTML(); (rec ? g.insertBefore(t.firstElementChild, rec) : g.appendChild(t.firstElementChild)); }
};
