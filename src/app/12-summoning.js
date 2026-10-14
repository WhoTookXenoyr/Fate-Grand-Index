/* ================= v11: the Summoning page ================= */
// Rates from the fandom wiki's Summoning page: per summon, ★5 servant 1%, ★4 servant 3%, ★3 servant 40%,
// ★5 CE 4%, ★4 CE 12%, ★3 CE 40%. With one servant featured at a rarity, that servant takes 0.8% / 1.5% / 4%.
// A 10-summon costs 30 Saint Quartz and gives 11 summons, with at least one servant and at least one ★4 or higher.
// Rate-Up SSR Pity System: summon 330 on a banner is the featured ★5 if you haven't had them yet on that banner.
TABS.splice(TABS.indexOf("servants") + 1, 0, "summon");
(function () { if ((location.hash || "").slice(1) === "summon") S.tab = "summon"; })();
const SM_RATE = {s5: 1, c5: 4, s4: 3, c4: 12, s3: 40, c3: 40};
const SM_FEAT = {5: 0.8, 4: 1.5, 3: 4};
const SM_PITY = 330;
const SUM_KEY = "spirit-origin-list:v1:summon";
const smBlank = () => ({n: 0, sq: 0, got: 0, t: {s5: 0, s4: 0, s3: 0, c5: 0, c4: 0, c3: 0, f5: 0, f4: 0, f3: 0}, last: [], log: [], run: null, batch: 0});
const SM = Object.assign({f5: null, f4: null, f3: null, life: {n: 0, sq: 0}, calc: {sq: "", tix: ""}}, smBlank(), (() => { try { const v = JSON.parse(localStorage.getItem(SUM_KEY) || "null"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })());
function smSave() { try { localStorage.setItem(SUM_KEY, JSON.stringify(SM)); } catch (e) {} }
const SQ_SVG = `<svg class="sq-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 1.5 3.8 9 12 22.5 20.2 9z" fill="#7cc4f5"/><path d="M12 1.5 3.8 9h16.4z" fill="#d6c2ff"/><path d="M12 1.5 8.2 9h7.6z" fill="#fff" opacity=".85"/><path d="M12 22.5 8.2 9h7.6z" fill="#ffbfe3" opacity=".9"/></svg>`;

/* ---------- who can come out: every servant on your list, Guests included ---------- */
const smPool = (r) => S.servants.filter((s) => num(s.rarity) === r);
function smFeat(r) {
  const id = SM["f" + r]; if (!id) return null;
  const s = S.servants.find((x) => x.id === id); return s && num(s.rarity) === r ? s : null;
}
// the first time, a ★5 Guest you're hoping for is the featured servant
function smDefaults() {
  if (SM.f5 !== null || !S.loaded.servants) return;
  const g = wished().find((s) => num(s.rarity) === 5); SM.f5 = g ? g.id : ""; smSave();
}
function smServant(r) {
  const f = smFeat(r);
  if (f && Math.random() * SM_RATE["s" + r] < SM_FEAT[r]) return {k: "s", r: r, id: f.id, f: 1};
  const pool = smPool(r).filter((s) => !f || s.id !== f.id);
  return pool.length ? {k: "s", r: r, id: pool[Math.floor(Math.random() * pool.length)].id} : {k: "s", r: r};
}
function smDraw(only) {
  const W = only === "s" ? ["s5", "s4", "s3"] : only === "h" ? ["s5", "c5", "s4", "c4"] : ["s5", "c5", "s4", "c4", "s3", "c3"];
  let u = Math.random() * W.reduce((a, k) => a + SM_RATE[k], 0), k = W[W.length - 1];
  for (const x of W) { if (u < SM_RATE[x]) { k = x; break; } u -= SM_RATE[x]; }
  const r = Number(k[1]);
  return k[0] === "s" ? smServant(r) : {k: "c", r: r};
}
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
function smBatch(count) {
  const out = []; for (let i = 0; i < count; i++) out.push(smDraw());
  if (count === 11) {
    if (!out.some((x) => x.k === "s")) out[pickOf(out.map((x, i) => i))] = smDraw("s");
    if (!out.some((x) => x.r >= 4)) {
      const lone = out.filter((x) => x.k === "s").length === 1;
      out[pickOf(out.map((x, i) => i).filter((i) => !(lone && out[i].k === "s")))] = smDraw("h");
    }
  }
  const f5 = smFeat(5);
  out.forEach((x, i) => {
    SM.n++; SM.life.n++;
    if (f5 && !SM.got && SM.n >= SM_PITY && !(x.f && x.r === 5)) { x = out[i] = {k: "s", r: 5, id: f5.id, f: 1, pity: 1}; }
    x.p = SM.n;
    if (x.f && x.r === 5 && !SM.got) SM.got = SM.n;
    SM.t[x.k + x.r]++; if (x.f) SM.t["f" + x.r]++;
    if (x.k === "s" && x.r >= 4 && x.id) { SM.log.unshift({p: x.p, id: x.id, r: x.r, f: x.f || 0, pity: x.pity || 0}); }
  });
  if (SM.log.length > 60) SM.log.length = 60;
  const cost = count === 11 ? 30 : 3 * count;
  SM.sq += cost; SM.life.sq += cost;
  return out;
}

/* ---------- odds ---------- */
const smPulls = (sq, tix) => Math.floor((num(sq) || 0) / 30) * 11 + Math.floor(((num(sq) || 0) % 30) / 3) + Math.max(0, Math.floor(num(tix) || 0));
const smPct = (p) => p >= 99.95 ? "100%" : p >= 10 ? p.toFixed(1) + "%" : p >= 0.1 ? p.toFixed(2) + "%" : p >= 0.001 ? p.toFixed(3) + "%" : p > 0 ? "<0.001%" : "0%";
function smRates() {
  const out = [];
  [5, 4, 3].forEach((r) => {
    const pool = smPool(r), f = smFeat(r), others = pool.filter((s) => !f || s.id !== f.id);
    const share = (SM_RATE["s" + r] - (f ? SM_FEAT[r] : 0)) / Math.max(1, others.length);
    pool.forEach((s) => out.push({s: s, r: r, f: !!f && s.id === f.id, p: f && s.id === f.id ? SM_FEAT[r] : share}));
  });
  return out;
}
// the chance of seeing a servant at least once in n more summons (the guarantee counted for the featured ★5)
function smChance(row, n) {
  if (n <= 0) return 0;
  if (row.f && row.r === 5 && !SM.got && SM.n + n >= SM_PITY) return 100;
  return (1 - Math.pow(1 - row.p / 100, n)) * 100;
}

/* ---------- drawing the page ---------- */
let smDealBatch = -1, smDealT = 0;
function smArt(s, face) {
  const k = face ? iconSlot(s) : ["4", "3", "2", "1"].find((x) => artOf(s, x)) || iconSlot(s);
  return k ? artSrc(artOf(s, k)) : "";
}
const smStars = (r) => `<span class="sm-st" aria-label="${r} stars">${"★".repeat(r)}</span>`;
function smCardHTML(x, i) {
  const s = x.id ? S.servants.find((v) => v.id === x.id) : null, sv = x.k === "s";
  const glow = sv && x.r === 5 ? "rainbow" : x.r >= 4 ? "gold" : "silver";
  const art = s ? smArt(s, true) : "";
  const front = sv
    ? `${art ? `<img class="smr-art" src="${esc(art)}" alt="" data-art="1">` : (s && CLASS_MARK[s.cls] ? `<img class="smr-art mark" src="${CLASS_MARK[s.cls]}" alt="">` : `<span class="smr-q">?</span>`)}
       <span class="smr-plate">${s && CLASS_LOGO[s.cls] ? `<img src="${CLASS_LOGO[s.cls]}" alt="">` : ""}${smStars(x.r)}</span>`
    : `<span class="smr-ce"><i class="smr-gem" aria-hidden="true"></i><b>Craft Essence</b></span><span class="smr-plate">${smStars(x.r)}</span>`;
  const name = sv ? (s ? s.name : `A ★${x.r} servant not on your list`) : `★${x.r} Craft Essence`;
  const tag = x.pity ? `<i class="smr-tag pity">Guaranteed</i>` : x.f ? `<i class="smr-tag up">Rate-up</i>` : s && s.wish ? `<i class="smr-tag new">Guest</i>` : "";
  return `<li class="smr ${sv ? "is-s" : "is-c"} r${x.r} ${x.r >= 4 ? "gold" : "silver"}${x.f ? " feat" : ""}${s ? "" : " anon"}" style="--i:${i}" data-glow="${glow}">
    <div class="smr-card"><div class="smr-in"><div class="smr-face smr-front">${front}${tag}</div><div class="smr-face smr-back"><img src="${CARD_BACK}" alt=""></div></div>${sv && x.r === 5 ? `<i class="smr-burst" aria-hidden="true"></i>` : ""}</div>
    <span class="smr-n" title="${esc(name)} · summon ${x.p}">${s ? `<button type="button" data-action="goto" data-id="${esc(s.id)}">${esc(name)}</button>` : esc(name)}</span>
  </li>`;
}
function smResultsHTML() {
  const L = SM.last || [];
  if (!L.length) return `<div class="smr-empty"><p>Press Summon to see who answers. Results here are only a simulation: your roster doesn't change.</p></div>`;
  const el = performance.now() - smDealT, deal = SM.batch === smDealBatch && el < 3400 && !RM.matches;
  const sv = L.filter((x) => x.k === "s"), hi = sv.filter((x) => x.r === 5), f = L.filter((x) => x.f);
  const bits = [plural(L.length, "summon"), hi.length ? plural(hi.length, "★5 servant") : "", sv.filter((x) => x.r === 4).length ? plural(sv.filter((x) => x.r === 4).length, "★4 servant") : "", L.filter((x) => x.k === "c" && x.r >= 4).length ? plural(L.filter((x) => x.k === "c" && x.r >= 4).length, "★4+ CE", "★4+ CEs") : ""].filter(Boolean).join(" · ");
  const guests = [...new Set(sv.map((x) => x.id).filter(Boolean))].map((id) => S.servants.find((s) => s.id === id)).filter((s) => s && s.wish);
  const run = SM.run && SM.run.batch === SM.batch ? SM.run : null;
  return `<div class="smr-head"><p class="smr-sum">${run ? `<b>${esc(run.name)}</b> came on summon ${run.at}${run.pity ? " (the guarantee)" : ""}: ${plural(run.n, "summon")} and ${fmt(run.sq)} Saint Quartz this run.${run.other ? " Along the way: " + esc(run.other) + "." : ""}` : `${f.some((x) => x.r === 5) ? `<b>Rate-up ★5!</b> ` : ""}${esc(bits)}`}</p>
      ${deal ? `<button type="button" class="btn ghost sm" data-action="sm-reveal">Show all</button>` : ""}</div>
    <ol class="smr-list${deal ? " deal" : ""}${L.length === 1 ? " one" : ""}"${deal && el > 120 ? ` style="--el:-${Math.round(el)}ms"` : ""} aria-label="Summon results">${L.map(smCardHTML).join("")}</ol>
    ${guests.length && !S.readOnly ? `<div class="smr-real"><p>${guests.length === 1 ? `${esc(guests[0].name)} is one of your Guests.` : "Some of these are your Guests."} Got ${guests.length === 1 ? "them" : "one"} in the game too?</p>${guests.map((s) => `<button type="button" class="btn sm summon-btn" data-action="summon" data-id="${esc(s.id)}">Summon ${esc(s.name)} for real</button>`).join("")}</div>` : ""}`;
}
function smHeroHTML() {
  const f5 = smFeat(5), f4 = smFeat(4), f3 = smFeat(3), art = f5 ? smArt(f5) : "";
  const pityTxt = !f5 ? `Pick a featured ★5 below to turn on the ${SM_PITY}-summon guarantee.`
    : SM.got ? `${esc(f5.name)} came on summon ${SM.got}. The guarantee works once per banner.`
    : `Summon ${Math.min(SM.n, SM_PITY)} of ${SM_PITY}. If ${esc(f5.name)} hasn't come by summon ${SM_PITY}, that one is them.`;
  const fp = f5 ? Math.min(1, (SM.got || SM.n) / SM_PITY) : 0;
  const mini = (s, r) => s ? `<span class="smh-f">${miniAva(s)}<span><b>${esc(s.name)}</b><small>★${r} rate-up · ${SM_FEAT[r]}%</small></span></span>` : "";
  const can = !!f5, again = !!SM.got;
  return `<section class="smh${art ? " has-art" : ""}${f5 && f5.cls === "Beast" ? " beast" : ""}">
    <div class="smh-banner">
      ${art ? `<img class="smh-art" src="${esc(art)}" alt="" data-art="1">` : (f5 && CLASS_MARK[f5.cls] ? `<img class="smh-art mark" src="${CLASS_MARK[f5.cls]}" alt="">` : "")}
      <div class="smh-txt">
        <p class="smh-kick">${f5 ? "Pickup Summon" : "Summoning simulator"}</p>
        <h2 class="smh-title">${f5 ? esc(f5.name) : "Your Spirit Origin List"}</h2>
        <p class="smh-sub">${f5 ? `${esc(f5.cls || "")} · ★5 · ${SM_FEAT[5]}% each summon` : "Every servant on your list can answer. Feature one for a rate-up banner."}</p>
        ${f4 || f3 ? `<div class="smh-fs">${mini(f4, 4)}${mini(f3, 3)}</div>` : ""}
      </div>
    </div>
    <div class="smh-ctl">
      <div class="smh-btns">
        <button type="button" class="sm-go one" data-action="sm-roll" data-n="1"><b>Summon</b><span>${SQ_SVG}3</span></button>
        <button type="button" class="sm-go ten" data-action="sm-roll" data-n="11"><b>Summon ×11</b><span>${SQ_SVG}30</span></button>
        <button type="button" class="sm-go until" data-action="sm-until"${can ? "" : ` disabled title="Pick a featured ★5 first"`}><b>${again ? "New banner, until the rate-up" : "Until the rate-up"}</b><span>${can ? "keeps going until " + esc(f5.name) + " comes" : "needs a featured ★5"}</span></button>
      </div>
      <div class="smh-pity${SM.got ? " done" : ""}${f5 ? "" : " off"}">
        <div class="smh-pl"><span>Rate-up guarantee</span><b>${f5 ? (SM.got ? "Got them" : Math.max(0, SM_PITY - SM.n) + " to go") : "Off"}</b></div>
        <span class="smh-track" role="progressbar" aria-label="Summons toward the guarantee" aria-valuemin="0" aria-valuemax="${SM_PITY}" aria-valuenow="${Math.min(SM.n, SM_PITY)}"><i style="width:${(fp * 100).toFixed(2)}%"></i></span>
        <p>${pityTxt}</p>
      </div>
      <dl class="smh-stats">
        <div><dt>Summons</dt><dd>${fmt(SM.n)}</dd></div>
        <div><dt>Saint Quartz</dt><dd>${SQ_SVG}${fmt(SM.sq)}</dd></div>
        <div><dt>★5 servants</dt><dd>${SM.t.s5}<small>expected ${(SM.n * 0.01).toFixed(1)}</small></dd></div>
        <div><dt>★4 servants</dt><dd>${SM.t.s4}<small>expected ${(SM.n * 0.03).toFixed(1)}</small></dd></div>
      </dl>
      <div class="smh-foot"><button type="button" class="btn ghost sm" data-action="sm-reset"${SM.n ? "" : " disabled"}>New banner</button><span class="muted">All time: ${plural(SM.life.n, "summon")}, ${fmt(SM.life.sq)} Saint Quartz</span></div>
    </div>
  </section>`;
}
function smSetupHTML() {
  const sel = (r) => {
    const pool = smPool(r), cur = smFeat(r), g = pool.filter((s) => s.wish), o = pool.filter((s) => !s.wish);
    const op = (s) => `<option value="${esc(s.id)}"${cur && cur.id === s.id ? " selected" : ""}>${esc(s.name)}</option>`;
    return `<label class="sms-f"><span>Featured ★${r} <small>${SM_FEAT[r]}% of ${SM_RATE["s" + r]}%</small></span><select data-sm-feat="${r}"${pool.length ? "" : " disabled"}><option value="">${pool.length ? "No rate-up" : "No ★" + r + " servants on your list"}</option>${g.length ? `<optgroup label="Guests">${g.map(op).join("")}</optgroup>` : ""}${o.length ? `<optgroup label="Your servants">${o.map(op).join("")}</optgroup>` : ""}</select></label>`;
  };
  return `<section class="d-sec smb sm-setup"><h3>Banner <small>who's on rate-up</small></h3>
    ${sel(5)}${sel(4)}${sel(3)}
    <p class="sms-note">Changing the featured ★5 starts a new banner, so the guarantee counts from 0 again. Rates come from the <a href="https://fategrandorder.fandom.com/wiki/Summoning" target="_blank" rel="noopener">Summoning page on the FGO wiki ↗</a>: ★5 servant 1%, ★4 servant 3%, ★3 servant 40%, Craft Essences ★5 4%, ★4 12%, ★3 40%.</p>
  </section>`;
}
function smOddsHTML() {
  const f5 = smFeat(5), row = f5 ? {f: true, r: 5, p: SM_FEAT[5]} : null;
  const n = smPulls(SM.calc.sq, SM.calc.tix);
  const steps = [[30, 11], [90, 33], [150, 55], [300, 110], [600, 220], [900, 330]];
  const big = row && n ? smChance(row, n) : null;
  const copies = f5 && n ? n * SM_FEAT[5] / 100 : 0;
  return `<section class="d-sec smb sm-odds"><h3>Your odds <small>${f5 ? "for " + esc(f5.name) : "pick a featured ★5"}</small></h3>
    <div class="smo-in"><label><span>${SQ_SVG}Saint Quartz</span><input type="number" min="0" step="1" inputmode="numeric" data-sm-calc="sq" value="${esc(SM.calc.sq)}" placeholder="e.g. 600"></label><label><span>Summon tickets</span><input type="number" min="0" step="1" inputmode="numeric" data-sm-calc="tix" value="${esc(SM.calc.tix)}" placeholder="0"></label></div>
    <p class="smo-big" aria-live="polite">${n ? `${plural(n, "summon")}. ${f5 ? `<b>${smPct(big)}</b> chance of ${esc(f5.name)}${!SM.got && SM.n + n >= SM_PITY ? `: guaranteed, since summon ${SM_PITY} on this banner falls inside them` : ""}${copies >= 0.05 ? `, about ${copies.toFixed(1)} ${copies >= 0.95 && copies < 1.05 ? "copy" : "copies"} on average` : ""}.` : "Feature a ★5 to see your chance."}` : "Type how much Saint Quartz you have."}</p>
    ${f5 ? `<table class="smo-t"><thead><tr><th>Saint Quartz</th><th>Summons</th><th>Chance</th></tr></thead><tbody>${steps.map((x) => { const c = smChance(row, x[1]); return `<tr><td>${SQ_SVG}${x[0]}</td><td>${x[1]}</td><td><span class="smo-bar"><i style="width:${Math.min(100, c).toFixed(1)}%"></i></span><b>${smPct(c)}</b></td></tr>`; }).join("")}</tbody></table>
    <p class="sms-note">The chance column starts from ${SM.n && !SM.got ? "where this banner is now" : "a fresh banner"}. On average one copy takes about ${Math.round(30 / 11 / (SM_FEAT[5] / 100))} Saint Quartz.</p>` : ""}
  </section>`;
}
function smChancesHTML() {
  const rows = smRates(), n = smPulls(SM.calc.sq, SM.calc.tix);
  if (!rows.length) return `<section class="d-sec smb sm-ch"><h3>Drop chances</h3><p class="tr-none">Give your servants a rarity (★3 to ★5) and they can be summoned here.</p></section>`;
  const max = Math.max(...rows.map((x) => x.p));
  const body = [5, 4, 3].map((r) => {
    const rr = rows.filter((x) => x.r === r).sort((a, b) => b.p - a.p || a.s.name.localeCompare(b.s.name));
    if (!rr.length) return "";
    return `<li class="smc-h">★${r} servants <small>${SM_RATE["s" + r]}% each summon in all</small></li>` + rr.map((x) => `<li class="smc${x.f ? " up" : ""}">${miniAva(x.s)}<span class="smc-n"><b>${esc(x.s.name)}</b><small>${x.f ? "Rate-up" : x.s.wish ? "Guest" : esc(x.s.cls || "")}</small></span><span class="smc-bar" aria-hidden="true"><i style="width:${(Math.sqrt(x.p / max) * 100).toFixed(1)}%"></i></span><b class="smc-p" title="Each summon">${smPct(x.p)}</b>${n ? `<span class="smc-y" title="With your ${plural(n, "summon")}">${smPct(smChance(x, n))}</span>` : ""}</li>`).join("");
  }).join("");
  return `<section class="d-sec smb sm-ch"><h3>Drop chances <small>each summon${n ? ", and with your " + plural(n, "summon") : ""}</small></h3><ul class="smc-list">${body}</ul></section>`;
}
function smLogHTML() {
  const L = (SM.log || []).slice(0, 14);
  const body = L.length ? `<ol class="sml">${L.map((x) => { const s = S.servants.find((v) => v.id === x.id); return s ? `<li class="${x.r === 5 ? "r5" : "r4"}${x.f ? " up" : ""}"><span class="sml-p">#${x.p}</span>${miniAva(s)}<span class="sml-n"><b>${esc(s.name)}</b><small>★${x.r}${x.pity ? " · the guarantee" : x.f ? " · rate-up" : ""}</small></span></li>` : ""; }).join("")}</ol>`
    : `<p class="tr-none">★4 and ★5 servants you pull on this banner are listed here.</p>`;
  const t = SM.t;
  return `<section class="d-sec smb sm-log"><h3>This banner <small>${plural(SM.n, "summon")}</small></h3>
    <dl class="sml-t"><div><dt>★5 servants</dt><dd>${t.s5}</dd></div><div><dt>★4 servants</dt><dd>${t.s4}</dd></div><div><dt>★3 servants</dt><dd>${t.s3}</dd></div><div><dt>★5 CEs</dt><dd>${t.c5}</dd></div><div><dt>★4 CEs</dt><dd>${t.c4}</dd></div><div><dt>★3 CEs</dt><dd>${t.c3}</dd></div></dl>
    ${body}</section>`;
}
function smGuestsHTML() {
  const g = wished();
  const body = g.length ? `<ul class="smg-list">${g.map((s) => {
    const r = clamp(num(s.rarity) || 0, 0, 5), art = smArt(s, true), on = smFeat(r) && smFeat(r).id === s.id;
    return `<li class="smg" id="smg-${esc(s.id)}">
      <button type="button" class="smg-face ${r >= 4 ? "gold" : r === 3 ? "silver" : "bronze"}" data-action="goto" data-id="${esc(s.id)}" aria-label="Open ${esc(s.name)}">${art ? `<img src="${esc(art)}" alt="" data-art="1">` : (CLASS_MARK[s.cls] ? `<img class="mark" src="${CLASS_MARK[s.cls]}" alt="">` : "")}<span class="smg-plate">${CLASS_LOGO[s.cls] ? `<img src="${CLASS_LOGO[s.cls]}" alt="">` : ""}${r ? smStars(r) : ""}</span></button>
      <div class="smg-b"><b>${esc(s.name)}</b><small>${esc([s.cls, r ? "★" + r : "", s.level && num(s.level) > 1 ? "goal Lv " + s.level : ""].filter(Boolean).join(" · "))}</small>
        <div class="smg-act">${S.readOnly ? "" : `<button type="button" class="btn sm summon-btn" data-action="summon" data-id="${esc(s.id)}" aria-label="Summon ${esc(s.name)}">Summon</button>`}${r >= 3 ? `<button type="button" class="btn ghost sm" data-action="sm-feature" data-id="${esc(s.id)}" aria-pressed="${!!on}">${on ? "On the banner" : "Feature"}</button>` : ""}</div></div>
    </li>`; }).join("")}</ul>`
    : `<p class="tr-none">Guests are the supports you borrow and the servants you hope to summon.</p>`;
  return `<section class="d-sec smb sm-guests"><div class="sm-gh"><h3>Guests <small>${g.length ? g.length + " waiting" : "nobody yet"}</small></h3>${S.readOnly ? "" : `<button type="button" class="btn sm" data-action="add-wish">+ Add guest</button>`}</div>
    <p class="sms-note">Got one in the game? Press Summon: they join your roster at Lv 1, and the stats you filled in stay as their goal.</p>${body}</section>`;
}
function renderSummon() {
  const el = document.getElementById("summoning"); if (!el) return;
  if (S.tab !== "summon") { if (el.firstChild) el.innerHTML = ""; return; }
  if (S.dbState !== "ok" || !S.loaded.servants) { el.innerHTML = `<div class="skeleton" style="height:340px"></div>`; return; }
  smDefaults();
  const keep = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.smCalc;
  el.innerHTML = smHeroHTML() + `<section class="d-sec smr-wrap" id="sm-results" aria-label="Results">${smResultsHTML()}</section>`
    + `<div class="sm-grid">${smGuestsHTML()}${smSetupHTML()}${smOddsHTML()}${smChancesHTML()}${smLogHTML()}</div>`;
  if (keep) { const i = el.querySelector(`[data-sm-calc="${keep}"]`); if (i) { i.focus(); const v = i.value; i.value = ""; i.value = v; } }
}
function smRenderResults() { const r = document.getElementById("sm-results"); if (r) r.innerHTML = smResultsHTML(); }

/* ---------- pressing the buttons ---------- */
function smStartDeal() { SM.batch = (SM.batch || 0) + 1; smDealBatch = SM.batch; smDealT = performance.now(); }
function smAfter() {
  smSave(); renderSummon();
  const r = document.getElementById("sm-results");
  if (r && r.getBoundingClientRect().top > innerHeight * 0.55) r.scrollIntoView({block: "start", behavior: RM.matches ? "auto" : "smooth"});
}
function smRoll(n) {
  if (!smPool(5).length && !smPool(4).length && !smPool(3).length) toast("None of your servants has a rarity yet, so only unnamed servants and Craft Essences can come out.");
  SM.last = smBatch(n); SM.run = null; smStartDeal(); smAfter();
}
function smUntil() {
  const f5 = smFeat(5); if (!f5) return;
  if (SM.got) Object.assign(SM, smBlank(), {batch: SM.batch});
  const n0 = SM.n, sq0 = SM.sq, t0 = Object.assign({}, SM.t);
  let last = []; for (let i = 0; i < 40 && !SM.got; i++) last = smBatch(11);
  const d = (k) => SM.t[k] - t0[k];
  const other = [d("s5") - d("f5") > 0 ? plural(d("s5") - d("f5"), "other ★5 servant") : "", d("s4") ? plural(d("s4"), "★4 servant") : "", d("c5") ? plural(d("c5"), "★5 CE", "★5 CEs") : ""].filter(Boolean).join(", ");
  SM.last = last; smStartDeal();
  const hit = last.find((x) => x.f && x.r === 5);
  SM.run = {batch: SM.batch, name: f5.name, at: SM.got, pity: !!(hit && hit.pity), n: SM.n - n0, sq: SM.sq - sq0, other: other};
  smAfter();
}
function smSetFeat(r, id, why) {
  const before = JSON.parse(JSON.stringify(SM)), old = SM["f" + r] || "";
  if ((id || "") === old) return;
  SM["f" + r] = id || "";
  const fresh = r === 5 && SM.n > 0;
  if (fresh) Object.assign(SM, smBlank(), {batch: SM.batch});
  smSave(); renderSummon();
  const s = id ? S.servants.find((x) => x.id === id) : null;
  const msg = (s ? s.name + " is the featured ★" + r + "." : "No ★" + r + " rate-up.") + (fresh ? " New banner: the counts start from 0." : "");
  if (fresh) toastAction(msg, "Undo", () => { Object.keys(SM).forEach((k) => delete SM[k]); Object.assign(SM, before); smSave(); renderSummon(); });
  else if (why) toast(msg);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action;
  if (a === "tab" || a === "goto" || a === "summon") { setTimeout(renderSummon, 0); return; }
  if (a === "sm-roll") { smRoll(Number(b.dataset.n) === 11 ? 11 : 1); return; }
  if (a === "sm-until") { smUntil(); return; }
  if (a === "sm-reveal") { const l = document.querySelector(".smr-list"); if (l) { l.classList.add("now"); smDealT = 0; } b.remove(); return; }
  if (a === "sm-reset") {
    const before = JSON.parse(JSON.stringify(SM));
    Object.assign(SM, smBlank(), {batch: SM.batch}); smSave(); renderSummon();
    toastAction("New banner: the counts start from 0.", "Undo", () => { Object.keys(SM).forEach((k) => delete SM[k]); Object.assign(SM, before); smSave(); renderSummon(); });
    return;
  }
  if (a === "sm-feature") { const s = S.servants.find((x) => x.id === b.dataset.id); if (!s) return; const r = num(s.rarity); if (![3, 4, 5].includes(r)) return; const on = smFeat(r) && smFeat(r).id === s.id; smSetFeat(r, on ? "" : s.id, true); return; }
  if (a === "to-summon") {
    const id = b.dataset.id; S.tab = "summon"; if (!isWide()) { S.selected = null; renderList(); renderDossier(); }
    renderChrome(); syncPageTheme(); renderSummon(); window.scrollTo({top: 0});
    requestAnimationFrame(() => { const c = document.getElementById("smg-" + id); if (c) { c.scrollIntoView({block: "center", behavior: RM.matches ? "auto" : "smooth"}); c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 1800); } });
    return;
  }
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.dataset.smFeat) smSetFeat(Number(t.dataset.smFeat), t.value, false);
});
let smCalcT = 0;
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.smCalc) return;
  SM.calc[t.dataset.smCalc] = t.value.replace(/[^\d]/g, "").slice(0, 6); smSave();
  clearTimeout(smCalcT); smCalcT = setTimeout(() => {
    const o = document.querySelector(".sm-odds"), c = document.querySelector(".sm-ch");
    if (o) { const tmp = document.createElement("div"); tmp.innerHTML = smOddsHTML(); const nb = tmp.firstElementChild; o.querySelector(".smo-big").replaceWith(nb.querySelector(".smo-big")); const ot = o.querySelector(".smo-t"), nt = nb.querySelector(".smo-t"); if (ot && nt) ot.replaceWith(nt); }
    if (c) { const tmp = document.createElement("div"); tmp.innerHTML = smChancesHTML(); c.replaceWith(tmp.firstElementChild); }
  }, 160);
});
const renderAll10 = renderAll;
renderAll = function () { renderAll10(); renderSummon(); };
