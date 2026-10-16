/* ================= 0.22.0: simulate an NA summon banner ================= */
// "Simulate" on a banner (Home or the Event page) loads it into the Summoning page: its featured servants and Craft
// Essences become the rate-ups. One rate-up at a rarity gets 0.8% (★5), 1.5% (★4) or 4% (★3) of the servant rate and
// 2.8% / 4% / 8% for Craft Essences (the fandom wiki's Summoning page). Two or more at the same rarity share that
// evenly here; the wiki doesn't give the exact split. The 330-summon guarantee is only simulated for one featured ★5.
// Featured servants that aren't on your list come from Past Chaldea; nothing is added to your roster.
const SM_CE_FEAT = {5: 2.8, 4: 4, 3: 8};
const banFt = (r, ce) => SM.ban && Array.isArray(SM.ban.ft) ? SM.ban.ft.filter((x) => !!x.ce === !!ce && x.r === r) : [];
// a featured servant as the simulator sees it: yours if you have them (Guests too), otherwise a stand-in from the NA data
function banServant(x) {
  const mine = mineMap().get(x.no); if (mine) return mine;
  const a = ATLAS_BY_NO.get(x.no), pic = a ? aimg((a.im && a.im[0]) || a.f) : (x.f && x.f.startsWith(ATLAS_IMG) ? x.f : "");
  return {id: "na:" + x.no, name: a ? a.n : x.n, rarity: x.r, cls: a ? a.c : x.c || "", art: pic ? {"1": pic} : {}, artStage: "1", na: x.no};
}
let banNoPity = false;
const smFeat22 = smFeat;
smFeat = function (r) {
  if (!SM.ban) return smFeat22(r);
  const f = banFt(r, false); if (!f.length || (r === 5 && banNoPity)) return null;
  if (f.length === 1) return banServant(f[0]);
  const s = banServant(f[0]); // two or more: shown together, sharing the rate
  return Object.assign({}, s, {id: "na:any" + r, name: f.map((x) => banServant(x).name).join(" or ")});
};
const smServant22 = smServant;
smServant = function (r) {
  const f = banFt(r, false);
  if (!f.length) return smServant22(r);
  if (Math.random() * SM_RATE["s" + r] < SM_FEAT[r]) {
    const x = pickOf(f), s = banServant(x);
    return String(s.id).startsWith("na:") ? {k: "s", r: r, pc: x.no, f: 1, nn: x.n, nf: x.f} : {k: "s", r: r, id: s.id, f: 1};
  }
  // everyone else answers as usual, but never a featured one: they already had their share
  const mineIds = new Set(f.map((x) => (mineMap().get(x.no) || {}).id).filter(Boolean)), nos = new Set(f.map((x) => x.no));
  for (let i = 0; i < 24; i++) { const y = smServant22(r); if (!y.f && !(y.pc && nos.has(y.pc)) && !(y.id && mineIds.has(y.id))) return y; }
  return {k: "s", r: r};
};
const smDraw22 = smDraw;
smDraw = function (only) {
  const x = smDraw22(only);
  if (SM.ban && x.k === "c") {
    const f = banFt(x.r, true).filter((c) => CE_BY_NO.has(c.no));
    if (f.length && Math.random() * SM_RATE["c" + x.r] < SM_CE_FEAT[x.r]) { x.ce = pickOf(f).no; x.fc = 1; }
  }
  return x;
};
// the drop chances list: featured servants get their share (yours or not), everyone else splits the rest as before
const smRates22 = smRates;
smRates = function () {
  if (!SM.ban) return smRates22();
  const base = smRates22(), out = [];
  [5, 4, 3].forEach((r) => {
    const f = banFt(r, false), mine = base.filter((x) => x.r === r);
    if (!f.length) { out.push(...mine); return; }
    const fs = f.map(banServant), ids = new Set(fs.map((s) => s.id)), rest = mine.filter((x) => !ids.has(x.s.id));
    const sum = rest.reduce((a, x) => a + x.p, 0), want = SM_RATE["s" + r] - SM_FEAT[r];
    rest.forEach((x) => out.push(Object.assign({}, x, {f: false, p: sum ? x.p * want / sum : 0})));
    fs.forEach((s) => out.push({s: s, r: r, f: true, p: SM_FEAT[r] / fs.length}));
  });
  return out;
};
// featuring one of your own servants leaves the NA banner
const smSetFeat22 = smSetFeat;
// (with its own Undo, which brings the NA banner back too)
smSetFeat = function (r, id, why) {
  if (!SM.ban) return smSetFeat22(r, id, why);
  const before = JSON.parse(JSON.stringify(SM));
  delete SM.ban; delete SM.banPrev; SM["f" + r] = id || "";
  Object.assign(SM, smBlank(), {batch: SM.batch}); smSave(); renderSummon();
  const s = id ? S.servants.find((x) => x.id === id) : null;
  toastAction((s ? s.name + " is the featured ★" + r + "." : "No ★" + r + " rate-up.") + " Back to your own banner: the counts start from 0.", "Undo", () => { Object.keys(SM).forEach((k) => delete SM[k]); Object.assign(SM, before); smSave(); renderSummon(); });
};
const smBatch22 = smBatch;
// The 330 guarantee hands out the featured ★5 by id. One who isn't on your list is turned into a Past Chaldea pull here,
// so the card, the ceremony and the summary show them by name.
function banPc(x) {
  if (!x || !x.id || !String(x.id).startsWith("na:")) return x;
  const no = Number(String(x.id).slice(3)), ft = banFt(x.r, false).find((y) => y.no === no);
  delete x.id; x.pc = no; if (ft) { x.nn = ft.n; x.nf = ft.f; }
  return x;
}
smBatch = function (count) {
  banNoPity = banFt(5, false).length > 1;
  try {
    const out = smBatch22(count);
    if (SM.ban) { out.forEach(banPc); SM.log = (SM.log || []).filter((l) => !String(l.id || "").startsWith("na:")); }
    return out;
  } finally { banNoPity = false; }
};
const smChance22 = smChance;
smChance = function (row, n) {
  if (row && row.f && row.r === 5 && banFt(5, false).length > 1) return n > 0 ? (1 - Math.pow(1 - row.p / 100, n)) * 100 : 0;
  return smChance22(row, n);
};
// a featured servant who isn't in this file's NA data yet still gets a card, with Atlas Academy's face picture
const smCardHTML22 = smCardHTML;
const banTag = (x) => x.pity ? `<i class="smr-tag pity">Guaranteed</i>` : x.f ? `<i class="smr-tag up">Rate-up</i>` : "";
smCardHTML = function (x, i) {
  if (!(x.k === "s" && x.pc && !ATLAS_BY_NO.has(x.pc) && x.nn)) {
    const h = smCardHTML22(x, i);
    return x.k === "s" && x.pc && (x.f || x.pity) ? h.replace(`<i class="smr-tag pc">Past Chaldea</i>`, banTag(x)) : h;
  }
  return `<li class="smr is-s r${x.r} ${x.r >= 4 ? "gold" : "silver"} from-pc" style="--i:${i}" data-glow="${x.r >= 5 ? "rainbow" : x.r >= 4 ? "gold" : "silver"}">
    <div class="smr-card"><div class="smr-in"><div class="smr-face smr-front">${x.nf ? `<img class="smr-art" src="${esc(x.nf)}" alt="" decoding="async">` : ""}<span class="smr-plate">${smStars(x.r)}</span>${banTag(x) || `<i class="smr-tag pc">New on NA</i>`}</div><div class="smr-face smr-back"><img src="${backOf("s", x.r)}" alt=""></div></div></div>
    <span class="smr-n" title="${esc(x.nn)} · summon ${x.p}"><a href="${LIVE_DB}servant/${x.pc}" target="_blank" rel="noopener">${esc(x.nn)}</a></span></li>`;
};
const smPullItem22 = smPullItem;
smPullItem = function (x) {
  if (x.k === "s" && x.pc && !ATLAS_BY_NO.has(x.pc) && x.nn) return {_item: true, k: "s", r: x.r, name: x.nn, sub: "New on NA", art: x.nf || "", logo: "", mark: ""};
  return smPullItem22(x);
};
const smSetupHTML22 = smSetupHTML;
smSetupHTML = function () {
  if (!SM.ban) return smSetupHTML22();
  const b = SM.ban, now = Date.now() / 1000;
  const rows = [5, 4, 3].map((r) => [false, true].map((ce) => {
    const f = banFt(r, ce); if (!f.length) return "";
    const each = (ce ? SM_CE_FEAT[r] : SM_FEAT[r]) / f.length;
    return `<li><span class="smb-k">★${r} ${ce ? "Craft Essence" : "servant"}${f.length > 1 ? "s" : ""} <small>${smPct(each)} each summon${f.length > 1 ? " each" : ""}</small></span><span class="lv-faces">${f.map((x) => liveFace(x, true)).join("")}</span></li>`;
  }).join("")).join("");
  return `<section class="d-sec smb sm-setup sm-ban"><h3>Banner <small>from NA</small></h3>
    <p class="smb-n"><b>${esc(b.n)}</b><small>${b.e ? (b.e > now ? "closes " + esc(liveWhen(b.e)) : "closed " + esc(liveWhen(b.e))) : ""}</small></p>
    <ul class="smb-ft">${rows}</ul>
    <p class="sms-note">One rate-up at a rarity gets 0.8% (★5), 1.5% (★4) or 4% (★3) for servants and 2.8% / 4% / 8% for Craft Essences, from the <a href="https://fategrandorder.fandom.com/wiki/Summoning" target="_blank" rel="noopener">wiki's Summoning page ↗</a>. Two or more at one rarity share it evenly here; the wiki doesn't say how the game splits it. ${banFt(5, false).length > 1 ? "With two or more featured ★5 servants the " + SM_PITY + "-summon guarantee isn't simulated." : banFt(5, false).length ? "The " + SM_PITY + "-summon guarantee is on." : ""} Everyone else who can answer: ${SM.pool === "all" ? "every NA servant" : "your list"}.</p>
    <div><button type="button" class="btn sm" data-action="sm-ban-off">Back to your own banner</button></div>
  </section>`;
};
function banSimulate(id) {
  const b = live.data && (live.data.ba || []).find((x) => x.id === Number(id)); if (!b) { toast("That banner isn't in On NA now any more."); return; }
  const before = JSON.parse(JSON.stringify(SM));
  if (!SM.ban) SM.banPrev = {f5: SM.f5, f4: SM.f4, f3: SM.f3};
  SM.ban = {id: b.id, n: liveText(b.n), s: b.s, e: b.e, ft: b.ft.map((x) => Object.assign({}, x))};
  Object.assign(SM, smBlank(), {batch: SM.batch}); smSave();
  S.tab = "summon"; if (S.selected && !isWide()) { S.selected = null; renderList(); renderDossier(); }
  try { history.pushState(null, "", "#summon"); } catch (e) {}
  renderChrome(); syncPageTheme(); renderSummon(); window.scrollTo({top: 0});
  toastAction(liveText(b.n) + " is loaded. The counts start from 0.", "Undo", () => { Object.keys(SM).forEach((k) => delete SM[k]); Object.assign(SM, before); smSave(); renderSummon(); });
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="ev-sim"], [data-action="sm-ban-off"]'); if (!b) return;
  if (b.dataset.action === "ev-sim") { banSimulate(b.dataset.g); return; }
  const before = JSON.parse(JSON.stringify(SM));
  const p = SM.banPrev || {}; delete SM.ban; delete SM.banPrev;
  Object.assign(SM, {f5: p.f5 === undefined ? SM.f5 : p.f5, f4: p.f4 === undefined ? SM.f4 : p.f4, f3: p.f3 === undefined ? SM.f3 : p.f3}, smBlank(), {batch: SM.batch}); smSave(); renderSummon();
  toastAction("Back to your own banner. The counts start from 0.", "Undo", () => { Object.keys(SM).forEach((k) => delete SM[k]); Object.assign(SM, before); smSave(); renderSummon(); });
});
