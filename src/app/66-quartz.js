/* ================= 0.54.0-beta: the Saint Quartz planner =================
   On the Summoning page, under the simulator: how much Saint Quartz you'll have by a banner, a servant coming to NA,
   or a day you pick, and your chance at the one you want with it.
   - What you have (Saint Quartz, summon tickets), what you get a week, and anything extra you know is coming
     (an event's or campaign's Saint Quartz). Nothing is guessed for you: the week's Saint Quartz is yours to say.
   - The day: an NA summoning campaign (the date it starts, or for one already on, the day it ends), a servant from
     Coming to NA (the date NA announced, else the month expected, from its 1st), or any date.
   - Summons: 11 for 30 Saint Quartz, 1 for 3, 1 for a ticket. The chance of the featured servant with the rates the
     simulator uses (★5 0.8%, ★4 1.5%, ★3 4%, shared when a banner features two at once) and the 330-summon guarantee
     for a banner's only featured ★5, the same way as the simulator (once a banner).
   Kept in this browser and synced: spirit-origin-list:v1:quartz = {sq, tix, week, extra, t: the day picked, date,
   who: which featured servant, copies}. */
const QP_KEY = "spirit-origin-list:v1:quartz";
let qpRaw = null, qpObj = {};
function qpState() {
  const r = lsGet(QP_KEY);
  if (r !== qpRaw) { qpRaw = r; try { const v = JSON.parse(r || "{}"); qpObj = v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { qpObj = {}; } }
  return qpObj;
}
const qpSave = () => { qpRaw = JSON.stringify(qpObj); lsSet(QP_KEY, qpRaw); };
if (typeof EXTRA_KEYS !== "undefined") { EXTRA_KEYS.quartz = QP_KEY; EXTRA_BY_KEY.set(QP_KEY, "quartz"); }

/* ---------- the days to plan for ---------- */
// [{k, n, at (seconds), est, ft: [{n, r, no}]}]
function qpTargets() {
  const now = Date.now() / 1000, out = [];
  try {
    if (typeof live !== "undefined" && live.data && typeof hbCampaigns === "function") {
      hbCampaigns(hbEvents()).filter((b) => b.e > now && (b.ft || []).some((x) => x.r >= 3 && !x.ce)).forEach((b, i) => {
        const up = b.s > now;
        out.push({k: "b:" + (b.id || "w" + i) + ":" + Math.round(b.s), n: liveText(b.n), at: up ? b.s : b.e, est: false, up: up, ft: b.ft.filter((x) => !x.ce && x.r >= 3).map((x) => ({n: x.n, r: x.r, no: x.no || 0}))});
      });
    }
  } catch (e) {}
  (typeof UP_ALL !== "undefined" ? UP_ALL : []).forEach((x) => {
    const at = typeof upAt === "function" ? upAt(x) / 1000 : 0, m = /^(\d{4})-(\d{2})/.exec((x.up && x.up.eta) || "");
    const when = at > now ? at : m ? Date.UTC(+m[1], +m[2] - 1, 1, 18) / 1000 : 0;
    if (when > now) out.push({k: "u:" + x.no, n: x.n + " comes to NA" + (x.up && x.up.ev ? " (" + x.up.ev + ")" : ""), at: when, est: !(at > now), ft: [{n: x.n, r: x.r, no: x.no}]});
  });
  return out.sort((a, b) => a.at - b.at);
}
function qpTarget() {
  const st = qpState(), list = qpTargets();
  if (st.t === "d") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(st.date || "");
    const at = m ? new Date(+m[1], +m[2] - 1, +m[3], 12).getTime() / 1000 : 0;
    return {k: "d", n: "", at: at, est: false, ft: [], date: true};
  }
  return list.find((x) => x.k === st.t) || list[0] || {k: "d", n: "", at: 0, est: false, ft: [], date: true};
}

/* ---------- the numbers ---------- */
const qpN = (v, max) => clamp(Math.floor(num(v) || 0), 0, max || 1e6);
// what you have now: the planner's own number, else the one typed into "Your odds" above it
const qpHave = (k) => { const v = qpState()[k]; return v != null ? v : typeof SM !== "undefined" && SM.calc && SM.calc[k] !== "" && SM.calc[k] != null ? num(SM.calc[k]) : null; };
// the chance (0–1) of at least k copies in n summons at p each; with pity, summon `pity` is a copy when none came before
function qpChance(n, p, k, pity) {
  if (n <= 0 || k <= 0) return k <= 0 ? 1 : 0;
  if (k === 1 && pity && n >= pity) return 1;
  let d = new Float64Array(k + 1); d[0] = 1;
  for (let i = 1; i <= n; i++) {
    const nd = new Float64Array(k + 1);
    for (let c = 0; c <= k; c++) {
      const x = d[c]; if (!x) continue;
      if (c === k) { nd[k] += x; continue; }
      if (c === 0 && pity && i === pity) { nd[1] += x; continue; }
      nd[c + 1] += x * p; nd[c] += x * (1 - p);
    }
    d = nd;
  }
  return d[k];
}
const qpCopies = (n, p, pity) => n * p + (pity && n >= pity ? Math.pow(1 - p, pity - 1) * (1 - p) : 0);
// Saint Quartz for n summons, tickets first, then 11 for 30, then 3 each
function qpSqFor(n, tix) { const left = Math.max(0, n - tix), m = Math.floor(left / 11), r = left % 11; return m * 30 + Math.min(30, r * 3); }
function qpCalc() {
  const st = qpState(), T = qpTarget(), now = Date.now() / 1000;
  const days = T.at > now ? (T.at - now) / 86400 : 0;
  const sq = qpN(qpHave("sq")) + Math.floor(qpN(st.week, 1e4) * days / 7) + qpN(st.extra), tix = qpN(qpHave("tix"), 1e4);
  const n = smPulls(sq, tix);
  const ft = T.ft || [], who = ft.find((x) => String(x.no || x.n) === String(st.who)) || ft.slice().sort((a, b) => b.r - a.r)[0] || null;
  const r = who ? who.r : num(st.r) || 5, same = ft.filter((x) => x.r === r).length || 1;
  const p = (SM_FEAT[r] || 0.8) / same / 100, pity = r === 5 && same === 1 ? SM_PITY : 0, k = clamp(qpN(st.copies) || 1, 1, 5);
  return {T: T, days: days, sq: sq, tix: tix, n: n, who: who, r: r, p: p, pity: pity, k: k, ch: qpChance(n, p, k, pity), cp: qpCopies(n, p, pity), share: same};
}

/* ---------- the block ---------- */
const qpDay = (ts) => new Date(ts * 1000).toLocaleDateString("en-GB", {weekday: "short", day: "numeric", month: "short", year: "numeric"});
function qpOutHTML() {
  const st = qpState(), C = qpCalc(), T = C.T;
  if (!T.at || T.at <= Date.now() / 1000) return `<p class="qp-none">${T.date ? "Pick a day that's still to come." : "Pick a banner, a servant or a day."}</p>`;
  const nm = C.who ? esc(C.who.n) : "the featured ★" + C.r;
  const when = T.date ? qpDay(T.at) : `${esc(T.n)} ${T.k.startsWith("b:") ? (T.up ? "starts" : "ends") : T.est ? "is expected" : "comes"} ${T.est ? "in " + new Date(T.at * 1000).toLocaleDateString("en-GB", {month: "long", year: "numeric"}) : "on " + qpDay(T.at)}`;
  const k = C.k, need = C.pity ? qpSqFor(C.pity, C.tix) : 0, more = Math.max(0, need - C.sq);
  const per = qpN(st.week, 1e4);
  const left = fmt(Math.ceil(C.days)) + " " + (Math.ceil(C.days) === 1 ? "day" : "days") + " from now";
  return `<p class="qp-when">${when} <small>(${T.est ? "counted from the 1st, " + left : left})</small></p>
    <div class="qp-big"><span class="qp-sq">${SQ_SVG}<b>${fmt(C.sq)}</b><small>Saint Quartz by then${C.tix ? " and " + plural(C.tix, "ticket") : ""}</small></span><span><b>${fmt(C.n)}</b><small>${C.n === 1 ? "summon" : "summons"}</small></span>
      <span class="qp-ch"><b>${smPct(C.ch * 100)}</b><small>chance of ${k > 1 ? "at least " + k + " copies of " : ""}${nm}</small></span></div>
    <p class="qp-how">${C.cp >= 0.05 ? `About ${C.cp.toFixed(1)} ${C.cp >= 0.95 && C.cp < 1.05 ? "copy" : "copies"} on average. ` : ""}${C.share > 1 ? `${C.share} ★${C.r} servants share the rate-up, so each gets ${(C.p * 100).toFixed(2).replace(/0$/, "")}%. ` : `${(C.p * 100).toFixed(1)}% each summon. `}${C.pity ? (C.n >= C.pity ? `Enough for the ${C.pity}-summon guarantee.` : `The ${C.pity}-summon guarantee takes ${fmt(need)} Saint Quartz${C.tix ? " with your tickets" : ""}: ${fmt(more)} more${per ? ", about " + plural(Math.ceil(more / per), "week") + " of what you get now" : ""}.`) : C.r === 5 ? "No guarantee: it only covers a banner's one featured ★5." : ""}</p>`;
}
function qpHTML() {
  const st = qpState(), list = qpTargets(), T = qpTarget(), cur = T.k;
  const nf = (k, label, ph, ic) => { const v = k === "sq" || k === "tix" ? qpHave(k) : st[k]; return `<label class="qp-f"><span>${ic ? SQ_SVG : ""}${label}</span><input type="number" min="0" step="1" inputmode="numeric" data-qp="${k}" value="${esc(v != null ? String(v) : "")}" placeholder="${esc(ph)}"></label>`; };
  const opt = (x) => `<option value="${esc(x.k)}"${x.k === cur ? " selected" : ""}>${esc(x.n)}, ${x.est ? new Date(x.at * 1000).toLocaleDateString("en-GB", {month: "short", year: "numeric"}) + " (expected)" : new Date(x.at * 1000).toLocaleDateString("en-GB", {day: "numeric", month: "short"})}</option>`;
  const bans = list.filter((x) => x.k.startsWith("b:")), ups = list.filter((x) => x.k.startsWith("u:"));
  const ft = T.ft || [];
  return `<section class="d-sec smb qp" aria-labelledby="qp-h"><h3 id="qp-h">Saint Quartz planner <small>how much you'll have, and your chance</small></h3>
    <div class="qp-in">${nf("sq", "Saint Quartz now", "0", true)}${nf("tix", "Summon tickets now", "0")}${nf("week", "Saint Quartz you get a week", "your guess")}${nf("extra", "Extra before then (events)", "0")}</div>
    <div class="qp-in">
      <label class="qp-f wide"><span>Saving for</span><select data-qp="t">${bans.length ? `<optgroup label="NA summoning campaigns">${bans.map(opt).join("")}</optgroup>` : ""}${ups.length ? `<optgroup label="Coming to NA">${ups.map(opt).join("")}</optgroup>` : ""}<option value="d"${cur === "d" ? " selected" : ""}>A day I pick</option></select></label>
      ${cur === "d" ? `<label class="qp-f"><span>The day</span><input type="date" data-qp="date" value="${esc(st.date || "")}"></label>` : ft.length > 1 ? `<label class="qp-f"><span>Who you want</span><select data-qp="who">${ft.slice().sort((a, b) => b.r - a.r).map((x) => `<option value="${esc(String(x.no || x.n))}"${String(x.no || x.n) === String(st.who) ? " selected" : ""}>${esc(x.n)} (★${x.r})</option>`).join("")}</select></label>` : ""}
      ${cur === "d" ? `<label class="qp-f"><span>Rarity</span><select data-qp="r">${[5, 4, 3].map((r) => `<option value="${r}"${(num(st.r) || 5) === r ? " selected" : ""}>★${r} rate-up</option>`).join("")}</select></label>` : ""}
      <label class="qp-f"><span>Copies</span><select data-qp="copies">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${(qpN(st.copies) || 1) === n ? " selected" : ""}>${n === 1 ? "1 (NP1)" : n + " (NP" + n + ")"}</option>`).join("")}</select></label>
    </div>
    <div class="qp-out" data-qp-out aria-live="polite">${qpOutHTML()}</div>
    <p class="sms-note">${bans.length ? "Banners come from NA's data and the wiki" : typeof liveOn === "function" && !liveOn() ? "Turn on live updates to plan for NA's banners" : "NA's banners show here once they're announced"}; Coming to NA dates are expected ones until NA announces them. 11 summons for 30 Saint Quartz.</p></section>`;
}
const renderSummon66 = renderSummon;
renderSummon = function () {
  const a = document.activeElement, keep = a && a.dataset && a.dataset.qp != null ? a.dataset.qp : null;
  const r = renderSummon66.apply(this, arguments);
  try {
    const el = document.getElementById("summoning");
    if (el && S.tab === "summon" && el.querySelector(".sm-grid")) {
      el.insertAdjacentHTML("beforeend", qpHTML());
      if (keep) { const i = el.querySelector(`[data-qp="${keep}"]`); if (i) i.focus({preventScroll: true}); }
    }
  } catch (e) { console.error(e); }
  return r;
};
function qpRepaint(whole) {
  const box = document.querySelector("#summoning .qp"); if (!box) return;
  if (!whole) { const o = box.querySelector("[data-qp-out]"); if (o) o.innerHTML = qpOutHTML(); return; }
  const a = document.activeElement, keep = a && box.contains(a) && a.dataset ? a.dataset.qp : null;
  box.outerHTML = qpHTML();
  if (keep) { const i = document.querySelector(`#summoning .qp [data-qp="${keep}"]`); if (i) i.focus({preventScroll: true}); }
}
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("#summoning .qp input[data-qp]")) return;
  const st = qpState(), k = t.dataset.qp;
  if (k === "date") st.date = t.value; else { const v = t.value.replace(/[^\d]/g, "").slice(0, 6); st[k] = v === "" ? undefined : Number(v); }
  qpSave(); qpRepaint(false);
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("#summoning .qp select[data-qp]")) return;
  const st = qpState(), k = t.dataset.qp;
  if (k === "t") { st.t = t.value; delete st.who; } else if (k === "who") st.who = t.value; else st[k] = num(t.value) || undefined;
  qpSave(); qpRepaint(k === "t");
});
// for the tests
window.__fgiQuartz = {calc: () => qpCalc(), chance: qpChance, copies: qpCopies, sqFor: qpSqFor, targets: () => qpTargets(), state: () => qpState()};
