const uniq = (a) => Array.from(new Set(a));
// A servant's own traits once saved from the form; until then the wiki defaults
function traitInfo(s) {
  const empty = {attr: "", order: [], moral: [], traits: [], buffs: [], fromWiki: false};
  if (!s) return empty;
  const own = !!(s.traitsSet || s.attr || (Array.isArray(s.traits) && s.traits.length) || (Array.isArray(s.lawOrder) && s.lawOrder.length) || (Array.isArray(s.moral) && s.moral.length));
  const key = defaultKey(s), d = own ? s : (TRAIT_DEFAULTS[key] || null);
  if (!d) return empty;
  const arr = (v, ok) => Array.isArray(v) ? v.map(String).filter((x) => !ok || ok.includes(x)) : [];
  const traits = uniq((d.gender ? [d.gender] : []).concat(arr(d.traits).map(normTrait)).filter(Boolean));
  const buffs = (Array.isArray(d.buffs) ? d.buffs : []).filter((b) => b && typeof b.tag === "string" && b.tag.includes(":")).map((b) => ({tag: b.tag, what: String(b.what || "")}));
  return {attr: ATTRS.includes(d.attr) ? d.attr : "", order: arr(d.lawOrder, ORDERS), moral: arr(d.moral, MORALS), traits: traits, buffs: buffs, fromWiki: !own};
}
function infoTags(t) {
  const out = [];
  if (t.attr) out.push("attr:" + t.attr);
  t.order.concat(t.moral).forEach((v) => out.push("align:" + v));
  t.traits.forEach((v) => out.push("trait:" + v));
  return uniq(out);
}
const tagsOf = (s) => infoTags(traitInfo(s));
const tagVal = (tag) => tag.slice(tag.indexOf(":") + 1);
const tagLabel = (tag) => tag.startsWith("attr:") ? (ATTR_LABEL[tagVal(tag)] || tagVal(tag)) + " attribute" : tagVal(tag);
const tagShort = (tag) => tag.startsWith("attr:") ? (ATTR_LABEL[tagVal(tag)] || tagVal(tag)) : tagVal(tag);
const tagKind = (tag) => tag.slice(0, tag.indexOf(":"));
// rare tags count for more when looking for servants alike
function tagCounts() { const m = {}; S.servants.forEach((x) => tagsOf(x).forEach((t) => { m[t] = (m[t] || 0) + 1; })); return m; }
function similarTo(id, tags, limit) {
  const cnt = tagCounts(), N = Math.max(2, S.servants.length);
  return S.servants.filter((x) => x.id !== id).map((x) => {
    const xt = tagsOf(x), shared = tags.filter((t) => xt.includes(t));
    return {s: x, shared: shared, w: shared.reduce((a, t) => a + Math.log((N + 1) / (cnt[t] || 1)), 0)};
  }).filter((r) => r.shared.length).sort((a, b) => b.w - a.w || b.shared.length - a.shared.length || String(a.s.name).localeCompare(String(b.s.name))).slice(0, limit || 6);
}
// supports in the roster whose ally buffs target any of these tags, grouped by support
function buffHits(tags, excludeId) {
  const by = new Map();
  S.servants.forEach((x) => {
    if (x.id === excludeId) return;
    buffsOf(x).forEach((b) => { if (tags.includes(b.tag)) { if (!by.has(x.id)) by.set(x.id, {s: x, items: []}); by.get(x.id).items.push(b); } });
  });
  return Array.from(by.values());
}
function boostsOf(info, excludeId) {
  const seen = new Set();
  return info.buffs.filter((b) => { const k = b.tag; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((b) => ({tag: b.tag, list: S.servants.filter((x) => x.id !== excludeId && tagsOf(x).includes(b.tag))}));
}
const miniAva = (x) => { const k = iconSlot(x); return k ? `<img class="tr-ava" src="${esc(artSrc(artOf(x, k)))}" alt="" data-art="1">` : (CLASS_LOGO[x.cls] ? `<img class="tr-ava logo" src="${CLASS_LOGO[x.cls]}" alt="">` : `<span class="tr-ava"></span>`); };
const tagChip = (tag, extra) => `<button type="button" class="tr-tag k-${tagKind(tag)}${extra || ""}" data-action="trait-filter" data-tag="${esc(tag)}" title="Show servants with ${esc(tagLabel(tag))}">${esc(tagShort(tag))}</button>`;

function worksHTML(hits) {
  if (!hits.length) return `<p class="tr-none">No servant in your roster has a buff aimed at these traits yet. A support shows up here once its skill text names who it's for (like "ATK up for Divine allies") or you add a buff target in its Edit details.</p>`;
  return `<ul class="tr-people">${hits.map((h) => `<li>${miniAva(h.s)}<span><button type="button" class="tr-name" data-action="goto" data-id="${esc(h.s.id)}">${esc(h.s.name)}</button>${h.s.wish ? ` <span class="tag">Guest</span>` : ""}<small>${h.items.map((b) => `<b>${esc(tagLabel(b.tag))}:</b> ${esc(b.what || "buff")}`).join("<br>")}</small></span></li>`).join("")}</ul>`;
}
function boostsHTML(boosts) {
  if (!boosts.length) return "";
  return boosts.map((b) => `<p class="tr-line"><b>${esc(tagLabel(b.tag))}</b> in your roster: ${b.list.length ? b.list.map((x, i, a) => `<span class="nowrap"><button type="button" class="tr-name" data-action="goto" data-id="${esc(x.id)}">${esc(x.name)}</button>${i < a.length - 1 ? "," : ""}</span>`).join(" ") : `<span class="muted">nobody yet</span>`}</p>`).join("");
}
function similarHTML(sim) {
  if (!sim.length) return `<p class="tr-none">No one else in your roster shares these yet.</p>`;
  return `<ul class="tr-people">${sim.map((r) => `<li>${miniAva(r.s)}<span><button type="button" class="tr-name" data-action="goto" data-id="${esc(r.s.id)}">${esc(r.s.name)}</button>${r.s.wish ? ` <span class="tag">Guest</span>` : ""}<small>${r.shared.length} shared: ${r.shared.map((t) => esc(tagShort(t))).join(", ")}</small></span></li>`).join("")}</ul>`;
}
// Which traits this servant shares with the servants most like it
function overlapMatrixHTML(s, tags, sim) {
  const cols = [s].concat(sim.slice(0, 3).map((r) => r.s));
  if (cols.length < 2) return "";
  const colTags = cols.map((x) => tagsOf(x));
  const rows = tags.map((t) => ({t: t, has: colTags.map((ct) => ct.includes(t))})).map((r) => Object.assign(r, {n: r.has.filter(Boolean).length})).filter((r) => r.n >= 2).sort((a, b) => b.n - a.n || tagLabel(a.t).localeCompare(tagLabel(b.t)));
  if (!rows.length) return "";
  return `<div class="tr-mx-scroll"><table class="tr-mx"><caption class="sr">Traits ${esc(s.name)} shares with the servants most like them</caption>
    <thead><tr><th scope="col">Trait</th>${cols.map((x, i) => `<th scope="col"${i ? "" : ' class="me"'}>${miniAva(x)}<span>${esc(x.name)}</span></th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr class="${r.n === cols.length ? "all" : ""}"><th scope="row">${esc(tagLabel(r.t))}</th>${r.has.map((h, i) => `<td${i ? "" : ' class="me"'}>${h ? `<span class="tr-dot" aria-label="Yes">●</span>` : `<span class="sr">No</span>`}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function traitsSectionHTML(s) {
  const info = traitInfo(s), tags = infoTags(info);
  const head = `<div class="sec-head"><h3>Traits &amp; alignment ${info.fromWiki && tags.length ? `<small>from the wiki</small>` : ""}</h3>${S.readOnly ? "" : `<button type="button" class="btn sm" data-action="edit-traits">${tags.length ? "Edit traits" : "Add traits"}</button>`}</div>`;
  const allBuffs = buffsOf(s);
  if (!tags.length && !allBuffs.length) return `<section class="d-sec tr-sec">${head}<p class="d-empty">Not filled in yet. Add the attribute, alignment and traits so you can filter by buff targets and see who works well together.</p></section>`;
  const al = info.order.concat(info.moral).map((v) => "align:" + v), tr = info.traits.map((v) => "trait:" + v);
  const sim = similarTo(s.id, tags, 6), works = buffHits(tags, s.id), boosts = boostsOf({buffs: allBuffs}, s.id);
  return `<section class="d-sec tr-sec">${head}
    <dl class="tr-kv">
      <div><dt>Attribute</dt><dd>${info.attr ? tagChip("attr:" + info.attr) : `<span class="muted">—</span>`}</dd></div>
      <div><dt>Alignment</dt><dd>${al.length ? al.map((t) => tagChip(t)).join("") : `<span class="muted">—</span>`}</dd></div>
      <div class="wide"><dt>Traits</dt><dd>${tr.length ? tr.map((t) => tagChip(t)).join("") : `<span class="muted">—</span>`}</dd></div>
    </dl>
    <p class="tr-hint">Press a trait to list everyone in your roster who has it.</p>
    <div class="tr-cols">
      <div><h4 class="tr-h">Works well with</h4>${worksHTML(works)}</div>
      ${boosts.length ? `<div><h4 class="tr-h">${esc(s.name)} boosts</h4>${boostsHTML(boosts)}</div>` : ""}
    </div>
    <h4 class="tr-h">Most in common</h4>${similarHTML(sim.slice(0, 4))}
    ${overlapMatrixHTML(s, tags, sim)}
  </section>`;
}

/* ---- the form ---- */
function rosterTraits() { const out = []; S.servants.forEach((x) => traitInfo(x).traits.forEach((t) => out.push(t))); return out; }
function allTraitsFor(info) { return uniq(COMMON_TRAITS.concat(info.traits, rosterTraits())); }
function tagOptionsHTML(sel, info) {
  const o = (tag) => `<option value="${esc(tag)}"${tag === sel ? " selected" : ""}>${esc(tagLabel(tag))}</option>`;
  const traits = allTraitsFor(info).map((t) => "trait:" + t);
  if (sel && !traits.includes(sel) && sel.startsWith("trait:")) traits.push(sel);
  return `<option value="">Choose…</option><optgroup label="Traits">${traits.map(o).join("")}</optgroup><optgroup label="Alignment">${ORDERS.concat(MORALS).map((v) => o("align:" + v)).join("")}</optgroup><optgroup label="Attribute">${ATTRS.map((v) => o("attr:" + v)).join("")}</optgroup>`;
}
const trChip = (group, v, on) => `<button type="button" class="chip tr-chip${on ? " on" : ""}" data-action="tr-toggle" data-group="${group}" data-v="${esc(v)}" aria-pressed="${on}">${esc(v)}</button>`;
const buffRowHTML = (b, info) => `<div class="tr-buff"><select data-buff-tag aria-label="Who it buffs">${tagOptionsHTML(b.tag || "", info)}</select><input type="text" data-buff-what value="${esc(b.what || "")}" placeholder="What it gives, e.g. ATK +20% for 3 turns" autocomplete="off" aria-label="What the buff gives"><button type="button" class="btn ghost sm" data-action="tr-buff-del">Remove</button></div>`;
function traitsFieldHTML(s) {
  const info = s && s.id ? traitInfo(s) : traitInfo(null);
  return `<fieldset id="fs-traits"><legend>Traits &amp; alignment</legend>
    ${info.fromWiki && infoTags(info).length ? `<p class="tr-hint">Filled in from the fandom wiki. Change anything that's off, then save.</p>` : ""}
    <div class="form-grid">${fld("sv-attr", "Attribute", `<select id="sv-attr" data-tr-live>${opt(ATTRS.map((v) => ({v: v, t: ATTR_LABEL[v]})), info.attr, "—")}</select>`)}</div>
    <div class="tr-group"><span class="lbl" id="lb-order">Order</span><div class="tr-chips" role="group" aria-labelledby="lb-order">${ORDERS.map((v) => trChip("order", v, info.order.includes(v))).join("")}</div></div>
    <div class="tr-group"><span class="lbl" id="lb-moral">Alignment</span><div class="tr-chips" role="group" aria-labelledby="lb-moral">${MORALS.map((v) => trChip("moral", v, info.moral.includes(v))).join("")}</div></div>
    <div class="tr-group"><span class="lbl" id="lb-traits">Traits</span><div class="tr-chips" id="tr-traits" role="group" aria-labelledby="lb-traits">${allTraitsFor(info).map((v) => trChip("traits", v, info.traits.includes(v))).join("")}</div>
      <div class="tr-add"><input id="sv-trait-new" type="text" maxlength="40" placeholder="Another trait, e.g. Roman" autocomplete="off" aria-label="New trait"><button type="button" class="btn sm" data-action="tr-add">Add trait</button></div></div>
    <div class="tr-group tr-paste"><label class="lbl" for="tr-paste">Paste from the wiki</label><textarea id="tr-paste" rows="2" placeholder="On the servant's wiki page, select from Attribute down to the Traits list, copy, and paste here. The chips above tick themselves."></textarea><p id="tr-paste-msg" class="tr-hint" role="status"></p></div>
    <div class="tr-group"><span class="lbl">Buffs allies who are…</span><div id="tr-buffs" class="tr-buffs">${info.buffs.map((b) => buffRowHTML(b, info)).join("")}</div><button type="button" class="btn sm tr-buff-add" data-action="tr-buff-add">+ Add buff target</button><div id="tr-autobuffs">${autoBuffsHTML(s && s.id ? autoBuffs(s).filter((b) => !info.buffs.some((x) => x.tag === b.tag)) : [])}</div></div>
    <div id="tr-live" class="tr-live" aria-live="polite">${traitLiveHTML(Object.assign({}, info, {buffs: s && s.id ? buffsOf(s) : info.buffs}), s && s.id)}</div>
  </fieldset>`;
}
function readTraitsForm() {
  const box = document.getElementById("fs-traits"); if (!box) return null;
  const on = (g) => Array.from(box.querySelectorAll('.tr-chip[data-group="' + g + '"][aria-pressed="true"]')).map((b) => b.dataset.v);
  const buffs = Array.from(box.querySelectorAll(".tr-buff")).map((r) => ({tag: r.querySelector("[data-buff-tag]").value, what: r.querySelector("[data-buff-what]").value.replace(/\s+/g, " ").trim()})).filter((b) => b.tag);
  return {attr: val("sv-attr") || "", order: on("order"), moral: on("moral"), traits: on("traits"), buffs: buffs, fromWiki: false};
}
function traitLiveHTML(info, id) {
  const tags = infoTags(info);
  if (!tags.length && !info.buffs.length) return `<p class="tr-none">Pick a few traits and the servants who share them, or who buff them, show up here.</p>`;
  const sim = similarTo(id, tags, 6), works = buffHits(tags, id), boosts = boostsOf(info, id);
  return `<div class="tr-cols"><div><h4 class="tr-h">Same traits in your roster</h4>${similarHTML(sim)}</div><div><h4 class="tr-h">Works well with</h4>${worksHTML(works)}${boosts.length ? `<h4 class="tr-h">Boosts</h4>${boostsHTML(boosts)}` : ""}</div></div>`;
}
function refreshTraitLive() {
  const box = document.getElementById("tr-live"), info = readTraitsForm(); if (!box || !info) return;
  const cur = S.editing && S.editing !== "new" ? S.servants.find((x) => x.id === S.editing) : null;
  const auto = autoBuffsFrom(formTexts().concat(cur ? servantTexts(cur).filter((x) => !/^skill \d$/.test(x.where) && !/ skill \d$/.test(x.where)) : [])).filter((b) => !info.buffs.some((x) => x.tag === b.tag));
  const ab = document.getElementById("tr-autobuffs"); if (ab) ab.innerHTML = autoBuffsHTML(auto);
  box.innerHTML = traitLiveHTML(Object.assign({}, info, {buffs: info.buffs.concat(auto)}), cur ? cur.id : null);
}

/* ---- roster filter by trait ---- */
let traitOptKey = "";
function fillTraitFilter() {
  const sel = document.getElementById("f-trait"); if (!sel) return;
  const cnt = tagCounts(), tags = Object.keys(cnt);
  const groups = [["Attribute", tags.filter((t) => t.startsWith("attr:")).sort((a, b) => ATTRS.indexOf(tagVal(a)) - ATTRS.indexOf(tagVal(b)))],
    ["Alignment", tags.filter((t) => t.startsWith("align:")).sort((a, b) => ORDERS.concat(MORALS).indexOf(tagVal(a)) - ORDERS.concat(MORALS).indexOf(tagVal(b)))],
    ["Traits", tags.filter((t) => t.startsWith("trait:")).sort((a, b) => tagVal(a).localeCompare(tagVal(b)))]];
  if (S.trait && !tags.includes(S.trait)) groups[2][1].push(S.trait);
  const key = JSON.stringify(groups) + "|" + JSON.stringify(cnt) + "|" + S.trait;
  if (key === traitOptKey) return; traitOptKey = key;
  sel.innerHTML = `<option value="">All traits</option>` + groups.filter((g) => g[1].length).map((g) => `<optgroup label="${g[0]}">${g[1].map((t) => `<option value="${esc(t)}"${t === S.trait ? " selected" : ""}>${esc(tagShort(t))} (${cnt[t] || 0})</option>`).join("")}</optgroup>`).join("");
}
function traitBannerHTML() {
  if (!S.trait) return "";
  const all = S.servants.filter((x) => tagsOf(x).includes(S.trait)), hits = buffHits([S.trait], null);
  return `<div class="tr-banner"><p><b>${esc(tagLabel(S.trait))}</b> · ${all.length} servant${all.length === 1 ? "" : "s"}${hits.length ? `<br><span>Boosted by ${hits.map((h) => `<button type="button" class="tr-name" data-action="goto" data-id="${esc(h.s.id)}">${esc(h.s.name)}</button> <small>(${esc(h.items.map((b) => b.what).join("; "))})</small>`).join(", ")}</span>` : `<br><span class="muted">No support in your roster has a buff aimed at this yet.</span>`}</p><button type="button" class="btn ghost sm" data-action="trait-clear">Show everyone</button></div>`;
}
function setTraitFilter(tag) {
  S.trait = tag || ""; traitOptKey = ""; fillTraitFilter();
  const sel = document.getElementById("f-trait"); if (sel) sel.value = S.trait;
}

/* ---- Versus: shared traits and supports that boost the picks ---- */
function vsTraitsHTML(picks) {
  const tagsBy = picks.map((s) => tagsOf(s)), n = picks.length;
  if (!tagsBy.some((t) => t.length)) return `<p class="tr-none">None of these servants have traits filled in yet.</p>`;
  const rows = uniq([].concat(...tagsBy)).map((t) => ({t: t, has: tagsBy.map((ts) => ts.includes(t))})).map((r) => Object.assign(r, {c: r.has.filter(Boolean).length}));
  const shared = rows.filter((r) => r.c >= 2).sort((a, b) => b.c - a.c || tagKind(a.t).localeCompare(tagKind(b.t)) || tagLabel(a.t).localeCompare(tagLabel(b.t)));
  const allShared = shared.filter((r) => r.c === n);
  const table = shared.length ? `<div class="tr-mx-scroll"><table class="tr-mx vs-trm"><caption class="sr">Traits shared by the servants you're comparing</caption>
    <thead><tr><th scope="col">Shared trait</th>${picks.map((s, i) => `<th scope="col">${vsKey(i)}<span>${esc(s.name)}</span></th>`).join("")}</tr></thead>
    <tbody>${shared.map((r) => `<tr class="${r.c === n ? "all" : ""}"><th scope="row">${esc(tagLabel(r.t))}${r.c === n && n > 2 ? ` <small>all ${n}</small>` : ""}</th>${r.has.map((h) => `<td>${h ? `<span class="tr-dot" aria-label="Yes">●</span>` : `<span class="sr">No</span>`}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="tr-none">They don't share any traits.</p>`;
  const only = picks.map((s, i) => { const u = rows.filter((r) => r.c === 1 && r.has[i]).map((r) => r.t); return u.length ? `<p class="tr-line">${vsKey(i)} only: ${u.map((t) => esc(tagShort(t))).join(", ")}</p>` : ""; }).join("");
  const sup = [];
  S.servants.forEach((x) => buffsOf(x).forEach((b) => { const who = tagsBy.map((ts, i) => ts.includes(b.tag) ? i : -1).filter((i) => i >= 0); if (who.length) sup.push({s: x, b: b, who: who}); }));
  sup.sort((a, b) => b.who.length - a.who.length);
  const supHTML = sup.length ? `<ul class="tr-people">${sup.map((r) => `<li>${miniAva(r.s)}<span><button type="button" class="tr-name" data-action="goto" data-id="${esc(r.s.id)}">${esc(r.s.name)}</button>${r.who.length === n ? ` <span class="tr-all">Boosts ${n === 2 ? "both" : "all " + n}</span>` : ""}<small><b>${esc(tagLabel(r.b.tag))}:</b> ${esc(r.b.what || "buff")} · reaches ${r.who.map((i) => VS_K[i]).join(", ")}</small></span></li>`).join("")}</ul>` : `<p class="tr-none">No support in your roster has a buff aimed at their traits.</p>`;
  return `${allShared.length ? `<p class="tr-shared">${n === 2 ? "Both" : "All " + n} share: ${allShared.map((r) => `<b>${esc(tagShort(r.t))}</b>`).join(", ")}.</p>` : ""}
    ${table}${only}
    <h4 class="tr-h">Supports that buff these traits</h4>${supHTML}`;
}


// v8 kept the Lawful / Neutral / Chaotic picks in `order`, which is also the roster position. Move them to `lawOrder`.
function fixLawOrder() {
  S.servants.forEach((s) => {
    if (!Array.isArray(s.order)) return;
    if (!Array.isArray(s.lawOrder)) s.lawOrder = s.order.filter((x) => ORDERS.includes(x));
    s.order = nextOrder(S.servants.filter((x) => x !== s));
    if (!S.readOnly) scheduleWrite("servants", s);
  });
}
