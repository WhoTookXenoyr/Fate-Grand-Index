/* ================= v12: Summoning meets Past Chaldea ================= */
// Craft Essences that come out are real ones from the story summon pool, and the banner can draw from every NA servant.
const CE_POOL = {3: [], 4: [], 5: []};
ATLAS_C.forEach((c) => { if (c.f === "N" && CE_POOL[c.r]) CE_POOL[c.r].push(c.no); });
const NA_POOL = {3: [], 4: [], 5: []};
ATLAS_S.forEach((x) => { if (!x.h && NA_POOL[x.r]) NA_POOL[x.r].push(x.no); });
if (SM.pool !== "all") SM.pool = "list";
const naPoolFor = (r, f) => { const fa = f ? atlasOf(f) : null; return NA_POOL[r].filter((no) => !fa || no !== fa.no); };

const smServant11 = smServant;
smServant = function (r) {
  if (SM.pool !== "all") return smServant11(r);
  const f = smFeat(r);
  if (f && Math.random() * SM_RATE["s" + r] < SM_FEAT[r]) return {k: "s", r: r, id: f.id, f: 1};
  const pool = naPoolFor(r, f); if (!pool.length) return smServant11(r);
  const no = pickOf(pool), mine = mineMap().get(no);
  return mine ? {k: "s", r: r, id: mine.id} : {k: "s", r: r, pc: no};
};
const smDraw11 = smDraw;
smDraw = function (only) {
  const x = smDraw11(only);
  if (x.k === "c" && CE_POOL[x.r] && CE_POOL[x.r].length) x.ce = pickOf(CE_POOL[x.r]);
  return x;
};
const smCardHTML11 = smCardHTML;
smCardHTML = function (x, i) {
  const ce = x.k === "c" && x.ce ? CE_BY_NO.get(x.ce) : null, pc = x.k === "s" && x.pc ? ATLAS_BY_NO.get(x.pc) : null;
  if (!ce && !pc) return smCardHTML11(x, i);
  const glow = pc && x.r === 5 ? "rainbow" : x.r >= 4 ? "gold" : "silver";
  const front = ce ? `<img class="smr-art ce-art" src="${esc(aimg(ce.im))}" alt="" decoding="async"><span class="smr-plate">${smStars(x.r)}</span>`
    : `<img class="smr-art" src="${esc(aimg(pc.im[0] || pc.f))}" alt="" decoding="async"><span class="smr-plate">${CLASS_LOGO[pc.c] ? `<img src="${CLASS_LOGO[pc.c]}" alt="">` : ""}${smStars(x.r)}</span><i class="smr-tag pc">Past Chaldea</i>`;
  const name = ce ? ce.n : pc.n;
  return `<li class="smr ${ce ? "is-c" : "is-s"} r${x.r} ${x.r >= 4 ? "gold" : "silver"}${ce ? " real-ce" : " from-pc"}" style="--i:${i}" data-glow="${glow}">
    <div class="smr-card"><div class="smr-in"><div class="smr-face smr-front">${front}</div><div class="smr-face smr-back"><img src="${CARD_BACK}" alt=""></div></div>${pc && x.r === 5 ? `<i class="smr-burst" aria-hidden="true"></i>` : ""}</div>
    <span class="smr-n" title="${esc(name)} · summon ${x.p}"><button type="button" data-action="${ce ? "ce-open" : "pc-open"}" data-no="${ce ? ce.no : pc.no}">${esc(name)}</button></span>
  </li>`;
};
const smResultsHTML11 = smResultsHTML;
smResultsHTML = function () {
  const h = smResultsHTML11();
  const pcs = [...new Set((SM.last || []).filter((x) => x.k === "s" && x.pc && x.r >= 4).map((x) => x.pc))].map((no) => ATLAS_BY_NO.get(no)).filter((x) => x && !mineMap().has(x.no));
  if (!pcs.length || S.readOnly) return h;
  return h + `<div class="smr-real pc"><p>${pcs.length === 1 ? `${esc(pcs[0].n)} isn't on your list yet.` : "Some of these aren't on your list yet."} Got ${pcs.length === 1 ? "them" : "one"} in the game? Summon them onto your roster.</p>${pcs.slice(0, 4).map((x) => `<button type="button" class="btn sm summon-btn" data-action="pc-summon" data-no="${x.no}">Summon ${esc(x.n)}</button>`).join("")}</div>`;
};
const smRates11 = smRates;
smRates = function () {
  if (SM.pool !== "all") return smRates11();
  const out = [], mine = mineMap();
  [5, 4, 3].forEach((r) => {
    const f = smFeat(r), pool = naPoolFor(r, f), set = new Set(pool);
    const share = (SM_RATE["s" + r] - (f ? SM_FEAT[r] : 0)) / Math.max(1, pool.length);
    smPool(r).forEach((s) => { const a = atlasOf(s), feat = !!f && s.id === f.id; out.push({s: s, r: r, f: feat, p: feat ? SM_FEAT[r] : (a && set.has(a.no) ? share : 0)}); });
    const rest = pool.filter((no) => !mine.has(no)).length;
    if (rest) out.push({s: {id: "__na" + r, name: plural(rest, "servant") + " from Past Chaldea", cls: "each " + smPct(share), rarity: r}, r: r, f: false, p: share * rest});
  });
  return out;
};
const smSetupHTML11 = smSetupHTML;
smSetupHTML = function () {
  const n = NA_POOL[5].length + NA_POOL[4].length + NA_POOL[3].length;
  const seg = `<div class="sms-pool"><span class="sms-pl">Who can come out</span><div class="seg" role="group" aria-label="Who can come out"><button data-action="sm-pool" data-v="list" aria-pressed="${SM.pool !== "all"}">Your list</button><button data-action="sm-pool" data-v="all" aria-pressed="${SM.pool === "all"}">All of NA</button></div>
    <small>${SM.pool === "all" ? `Any of the ${n} ★3–★5 servants on NA can answer (limited ones too, so it's a bit generous). Yours show as yours; the rest come from Past Chaldea.` : "Only the servants on your list: your roster and Guests."} Craft Essences are real ones from the story summon pool.</small></div>`;
  return smSetupHTML11().replace(`<p class="sms-note">`, seg + `<p class="sms-note">`);
};
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="sm-pool"]'); if (!b) return;
  SM.pool = b.dataset.v === "all" ? "all" : "list"; smSave(); renderSummon();
  toast(SM.pool === "all" ? "Every NA servant can come out now." : "Only the servants on your list can come out now.");
});
