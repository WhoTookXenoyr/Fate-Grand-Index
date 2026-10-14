/* ---------- buff targets read from the skill, NP and passive text ---------- */
const escRx = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function buffVocab() {
  const v = uniq(COMMON_TRAITS.concat(rosterTraits())).map((t) => ({tag: "trait:" + t, name: t}))
    .concat(ORDERS.concat(MORALS).map((x) => ({tag: "align:" + x, name: x})))
    .concat(ATTRS.map((x) => ({tag: "attr:" + x, name: x})), [{tag: "attr:Man", name: "Human"}]);
  return v.sort((a, b) => b.name.length - a.name.length);
}
function tagsInPhrase(phrase, vocab) {
  let p = " " + phrase + " "; const out = [];
  vocab.forEach((v) => { const rx = new RegExp("(^|[^A-Za-z])" + escRx(v.name) + "(?![A-Za-z])", "i"); if (rx.test(p)) { out.push(v.tag); p = p.replace(rx, "$1 "); } });
  return uniq(out);
}
// "ATK up for Male or Fae allies", "Evade to Good alignment allies", "allies with the Divine trait"
function buffTagsInLine(ln, vocab) {
  const out = [], rx = /\ball(?:y|ies)\b/gi; let m;
  while ((m = rx.exec(ln))) {
    const before = ln.slice(Math.max(0, m.index - 70), m.index).split(/[;:.()]/).pop().replace(/^.*\b(?:for|to|of|on|grants?|gives?|all|party|their|its|the)\s+/i, "");
    if (before.trim()) tagsInPhrase(before.replace(/[-\s](?:trait|attribute|alignment|aligned)\s*$/i, ""), vocab).forEach((t) => out.push(t));
    const after = ln.slice(m.index + m[0].length, m.index + m[0].length + 60), a = /^\s+(?:with|who (?:are|have)|that (?:are|have)|having)\s+(?:the\s+|an?\s+)?([^,.;()]+)/i.exec(after);
    if (a) tagsInPhrase(a[1].replace(/\b(?:trait|attribute|alignment)s?\b.*$/i, ""), vocab).forEach((t) => out.push(t));
  }
  return uniq(out);
}
function autoBuffsFrom(texts) {
  const vocab = buffVocab(), out = [], seen = new Set();
  texts.forEach((x) => effectLines(x.text).forEach((ln) => buffTagsInLine(ln, vocab).forEach((tag) => {
    const key = tag + "|" + ln; if (seen.has(key)) return; seen.add(key);
    out.push({tag: tag, what: (ln.length > 110 ? ln.slice(0, 107) + "…" : ln) + " (" + x.where + ")", auto: true});
  })));
  return out;
}
function servantTexts(s) {
  const t = [], add = (text, where) => { if (text) t.push({text: text, where: where}); };
  (s.skillInfo || []).forEach((k, i) => add(k && k.effect, "skill " + (i + 1)));
  skSets(s).forEach((set) => (set.info || []).forEach((k, i) => add(k && k.effect, (set.name || "skill set") + " skill " + (i + 1))));
  const T = npNorm(s.npTable); if (T) T.v.forEach((V) => { add(V.effect, "NP"); add(V.oc, "NP overcharge"); });
  passivesOf(s).forEach((p) => add(p.effect, "passive" + (p.name ? " " + p.name : "")));
  return t;
}
const autoCache = new Map();
function autoBuffs(s) {
  const texts = servantTexts(s), sig = JSON.stringify(texts) + "|" + rosterTraits().length;
  const c = autoCache.get(s.id); if (c && c.sig === sig) return c.b;
  const b = autoBuffsFrom(texts); autoCache.set(s.id, {sig: sig, b: b}); return b;
}
// your own buff targets plus the ones read from the text (a tag you set yourself wins)
function buffsOf(s) { const own = traitInfo(s).buffs, tags = new Set(own.map((b) => b.tag)); return own.concat(autoBuffs(s).filter((b) => !tags.has(b.tag))); }
function formTexts() {
  const f = document.getElementById("servant-form"); if (!f) return [];
  return Array.from(f.querySelectorAll('textarea[id$="-effect"]')).map((ta) => { const m = /-s(\d)-effect$/.exec(ta.id); return {text: ta.value, where: "skill " + (m ? m[1] : "")}; });
}
function autoBuffsHTML(list) {
  if (!list.length) return `<p class="tr-hint">Skill text that names who a buff is for, like "ATK up for Male allies" or "Evade to allies with Good alignment", is picked up here automatically.</p>`;
  return `<p class="tr-hint"><b>Read from the skill text:</b></p><ul class="tr-auto">${list.map((b) => `<li><b>${esc(tagLabel(b.tag))}</b> · ${esc(b.what)}</li>`).join("")}</ul>`;
}

/* ---------- paste the wiki's infobox and the chips fill themselves ---------- */
function parseWikiPaste(text, html) {
  const vocab = uniq(COMMON_TRAITS.concat(rosterTraits())).sort((a, b) => b.length - a.length);
  const r = {attr: "", order: [], moral: [], traits: []};
  const flat = String(text || "").replace(/\s+/g, " ");
  const at = /Attribute[s]?\s*:?\s*(Man|Human|Earth|Sky|Star|Beast)\b/i.exec(flat); if (at) r.attr = /human/i.test(at[1]) ? "Man" : at[1][0].toUpperCase() + at[1].slice(1).toLowerCase();
  const alSrc = (/Alignments?\s*:?\s*([A-Za-z・·\s\/,&-]{3,60})/i.exec(flat) || [])[1] || flat;
  const al = /(Lawful|Neutral|Chaotic)\s*[・·\-\s]?\s*(Good|Balanced|Evil|Summer|Madness|Bride|Neutral)/gi; let m;
  while ((m = al.exec(alSrc))) { const o = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), mo = /neutral/i.test(m[2]) ? "Balanced" : m[2][0].toUpperCase() + m[2].slice(1).toLowerCase(); if (!r.order.includes(o)) r.order.push(o); if (!r.moral.includes(mo)) r.moral.push(mo); }
  const g = /Gender\s*:?\s*(Male|Female)\b/i.exec(flat); if (g) r.traits.push(/^f/i.test(g[1]) ? "Female" : "Male");
  let tr = flat; const ti = tr.search(/\bTraits?\b/); if (ti >= 0) tr = tr.slice(ti + 6);
  const stop = tr.search(/\b(?:Height|Weight|Region|Origin|Illustrator|Voice Actor|Release Date|Series)\b/); if (stop > 0) tr = tr.slice(0, stop);
  // a comma or line separated list after "Traits" can hold traits this page doesn't know yet
  const raw = String(text || ""), rti = raw.search(/\bTraits?\b/); let listed = rti >= 0 ? raw.slice(rti).replace(/^Traits?/, "") : "";
  const lstop = listed.search(/\b(?:Height|Weight|Region|Origin|Illustrator|Voice Actor|Release Date|Series|Gender|Attribute|Alignments?)\b/); if (lstop >= 0) listed = listed.slice(0, lstop);
  const parts = /[,\n]/.test(listed.trim()) ? listed.replace(/^\s*:?\s*/, "").split(/\s*[,\n;]\s*/).map((x) => x.replace(/\s+/g, " ").trim()) : [];
  const skipWords = new Set(["Servant", "Servants"].concat(CLASSES, ATTRS, ORDERS, MORALS));
  vocab.forEach((v) => { if (tr.includes(v)) { r.traits.push(v); tr = tr.split(v).join(" "); } });
  parts.forEach((x) => { const t = normTrait(x); if (t && t.length >= 3 && t.length <= 40 && /^[A-Z]/.test(t) && !skipWords.has(t) && !/\b(?:Height|Weight|Region|Gender|Attribute|Alignment)\b/.test(t) && !/\d/.test(t)) r.traits.push(t); });
  Object.keys(TRAIT_ALIAS).forEach((k) => { const v = TRAIT_ALIAS[k], rx = new RegExp(escRx(k), "i"); if (rx.test(tr)) { r.traits.push(v); tr = tr.replace(rx, " "); } });
  if (html) {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html"), walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let on = false, n;
      const skip = new Set(["Servant", "Servants"].concat(CLASSES, ATTRS, ORDERS, MORALS));
      while ((n = walk.nextNode())) {
        if (n.nodeType === 3) { const t = n.textContent; if (/\bTraits?\b/.test(t)) on = true; else if (on && /\b(?:Height|Weight|Region|Gender|Attribute|Alignment|Illustrator|Voice Actor)\b/.test(t)) on = false; continue; }
        if (on && n.tagName === "A") { const t = normTrait(n.textContent); if (t && t.length >= 3 && t.length <= 40 && /^[A-Z]/.test(t) && !skip.has(t)) r.traits.push(t); }
      }
    } catch (e) {}
  }
  r.traits = uniq(r.traits.map(normTrait));
  return r;
}
function applyWikiPaste(r) {
  const box = document.getElementById("fs-traits"); if (!box) return;
  if (r.attr) { const sel = document.getElementById("sv-attr"); if (sel) sel.value = r.attr; }
  const set = (group, v) => {
    let c = Array.from(box.querySelectorAll('.tr-chip[data-group="' + group + '"]')).find((x) => x.dataset.v.toLowerCase() === v.toLowerCase());
    if (!c && group === "traits") { const t = document.getElementById("tr-traits"); t.insertAdjacentHTML("beforeend", trChip("traits", v, true)); c = t.lastElementChild; }
    if (c) { c.setAttribute("aria-pressed", "true"); c.classList.add("on"); }
  };
  r.order.forEach((v) => set("order", v)); r.moral.forEach((v) => set("moral", v)); r.traits.forEach((v) => set("traits", v));
  // ticked traits move to the front of the list so they're in view
  const tb = document.getElementById("tr-traits"); if (tb && r.traits.length) { Array.from(tb.querySelectorAll('.tr-chip[aria-pressed="true"]')).reverse().forEach((c) => tb.prepend(c)); tb.scrollTop = 0; }
  const msg = document.getElementById("tr-paste-msg");
  const parts = [r.attr ? (ATTR_LABEL[r.attr] || r.attr) + " attribute" : "", r.order.concat(r.moral).join(" "), r.traits.length ? r.traits.length + " trait" + (r.traits.length === 1 ? "" : "s") + " (" + r.traits.join(", ") + ")" : ""].filter(Boolean);
  if (msg) msg.textContent = parts.length ? "Ticked: " + parts.join(" · ") + ". Check them, then save." : "Couldn't find an attribute, alignment or traits in that. Copy the part of the wiki page with those labels and paste again.";
  refreshTraitLive();
}

