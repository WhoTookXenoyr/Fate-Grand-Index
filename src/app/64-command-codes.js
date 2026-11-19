/* ================= 0.54.0-beta: Command Codes =================
   NA's Command Codes (ATLAS_CC, made by tools/gen_atlas.py from Atlas Academy's export; the NA data job keeps them up
   to date), and the ones you engrave on your servants' cards:
   - a page, Command Codes: every one with its picture, what it does in the game's words and in numbers, filters by
     what it's for, and which of your servants have it;
   - on a servant's page, under Deck: their five cards, each with a slot. Click one to engrave a code on it (or take
     it off). Under the slots, what each code adds to that card: critical damage, damage against a trait, NP Gain,
     stars, HP;
   - in the Battle simulator, a card with a code fights with it: its critical damage, special attack, Damage Plus, NP
     Gain, star drop and gather, Sure Hit and Ignore Invincible, and the stars, NP or HP it gives each time it attacks.
   Codes only work on the card they're engraved on, never on the Noble Phantasm, so the NP calculator doesn't count them.
   Kept apart from the roster (the roster's servants aren't changed): spirit-origin-list:v1:cc =
   {s: {servant id: [code number × 5, 0 for none]}, f: the page's filters}. It syncs with the account like the other
   things the page remembers. */
const CC_KEY = "spirit-origin-list:v1:cc";
const CC_ALL = typeof ATLAS_CC !== "undefined" && Array.isArray(ATLAS_CC) ? ATLAS_CC : [];
const CC_BY = new Map(CC_ALL.map((c) => [c.no, c]));
const CCU = {open: null, q: "", k: ""};
// what's kept, read again whenever it changed (another tab, or sync bringing it from another device)
let ccRaw = null, ccObj = {s: {}, f: {}};
function ccState() {
  const r = lsGet(CC_KEY);
  if (r !== ccRaw) {
    ccRaw = r;
    try { const v = JSON.parse(r || "{}"); ccObj = v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { ccObj = {}; }
    if (!ccObj.s || typeof ccObj.s !== "object" || Array.isArray(ccObj.s)) ccObj.s = {};
    if (!ccObj.f || typeof ccObj.f !== "object" || Array.isArray(ccObj.f)) ccObj.f = {};
  }
  return ccObj;
}
const ccSave = () => { ccRaw = JSON.stringify(ccObj); lsSet(CC_KEY, ccRaw); };
if (typeof EXTRA_KEYS !== "undefined") { EXTRA_KEYS.commandcodes = CC_KEY; EXTRA_BY_KEY.set(CC_KEY, "commandcodes"); }
const ccSlots = (s) => { const a = (s && ccState().s[s.id]) || []; return [0, 1, 2, 3, 4].map((i) => CC_BY.has(num(a[i])) ? num(a[i]) : 0); };
function ccPut(s, i, no) {
  const st = ccState(), a = ccSlots(s); a[clamp(i, 0, 4)] = CC_BY.has(num(no)) ? num(no) : 0;
  if (a.some(Boolean)) st.s[s.id] = a; else delete st.s[s.id];
  ccSave();
}
const ccPic = (c) => c && c.f ? aimg(c.f) : "";
// the five cards a servant's slots go with: the deck on their page when it's set, else NA's
function ccDeck(s) {
  const d = deckOf(s);
  if (d.every(Boolean)) return d;
  const a = atlasOf(s), L = {Q: "Quick", A: "Arts", B: "Buster"};
  return a && a.d ? String(a.d).split("").slice(0, 5).map((x) => L[x] || "") : d;
}
const CC_L = {Buster: "B", Arts: "A", Quick: "Q"};

/* ---------- what a code does, in numbers ---------- */
// [kind, value, cards, needs(, turns before it works again)] (tools/gen_atlas.py)
const CC_WORD = {k: "Critical damage", p: "Special attack", g: "NP Gain", s: "Star drop", w: "Star gather", f: "Damage Plus"};
function ccNeedText(n) {
  if (!n) return "";
  if (n === "?field") return "on some quests";
  if (n === "?hp") return "more as your HP drops";
  if (n.charAt(0) === "+") return "if you're " + n.slice(1);
  return "against " + n.split("|").join(", ");
}
function ccRowText(r) {
  const v = Math.round(num(r[1]) * 100) / 100, cards = r[2] ? {B: "Buster", A: "Arts", Q: "Quick"}[r[2]] + " card only" : "", need = ccNeedText(r[3]);
  let t;
  if ("kgswp".includes(r[0])) t = CC_WORD[r[0]] + " +" + v + "%";
  else if (r[0] === "f") t = "Damage Plus +" + fmt(v);
  else if (r[0] === "h") t = "Sure Hit";
  else if (r[0] === "i") t = "Ignore Invincible";
  else if (r[0] === "d") t = "Ignore DEF";
  else if (r[0] === "S") t = "+" + v + (v === 1 ? " star" : " stars") + " each attack";
  else if (r[0] === "N") t = "NP +" + v + "% when it attacks";
  else if (r[0] === "H") t = "Restores " + fmt(v) + " HP when it attacks";
  else if (r[0] === "A") t = "Restores " + fmt(v) + " HP to all allies when it attacks";
  else t = r[0];
  const more = [need, cards, r[4] ? "once every " + r[4] + " turns" : ""].filter(Boolean).join(", ");
  return t + (more ? " (" + more + ")" : "");
}
// what it's for, for the page's filter
const CC_KINDS = [["", "Everything"], ["crit", "Critical damage"], ["spec", "Damage against a trait"], ["stars", "Stars"], ["np", "NP"], ["hp", "HP"], ["hit", "Sure Hit, Ignore Invincible or DEF"], ["other", "Other effects"]];
const CC_KIND_OF = {k: "crit", p: "spec", f: "spec", S: "stars", s: "stars", w: "stars", g: "np", N: "np", H: "hp", A: "hp", h: "hit", i: "hit", d: "hit"};
function ccKinds(c) {
  const k = new Set((c.x || []).map((r) => CC_KIND_OF[r[0]]).filter(Boolean));
  if (!(c.x || []).length || /\b(?:inflict|remove|apply (?!sure hit)|decrease|increase (?:buff|debuff|hp recovery|np strength|quick|arts|buster)|activate|absorb)\b/i.test(c.e)) k.add("other");
  return k;
}
// does a row work for this servant on this card? (a "+Lawful" needs the servant to be Lawful)
function ccRowOk(r, s, card) {
  if (r[2] && CC_L[card] !== r[2]) return false;
  const n = r[3] || "";
  if (n.charAt(0) === "+") {
    const a = atlasOf(s), w = n.slice(1).toLowerCase(), all = [].concat(a ? a.o || [] : [], a ? a.m || [] : [], a ? a.t || [] : [], s.traits || []).map((x) => String(x).toLowerCase());
    return all.includes(w);
  }
  return n !== "?field";
}
// one card's codes added up: {crit, vs: [[v, "Human|..."]], dp, gain, drop, gather, stars, np, npCd, heal, healAll, pierce, surehit, idef}
function ccFx(c, s, card) {
  const F = {crit: 0, vs: [], dp: 0, gain: 0, drop: 0, gather: 0, stars: 0, np: 0, npCd: 0, heal: 0, healCd: 0, healAll: 0, pierce: false, surehit: false, idef: false, n: c ? c.n : "", no: c ? c.no : 0};
  if (!c) return F;
  (c.x || []).forEach((r) => {
    if (!ccRowOk(r, s, card)) return;
    const v = num(r[1]) || 0, vs = r[3] && r[3].charAt(0) !== "+" && r[3].charAt(0) !== "?" ? r[3] : "";
    switch (r[0]) {
      case "k": if (vs) F.vs.push([0, vs, v]); else F.crit += v; break;
      case "p": if (vs) F.vs.push([v, vs, 0]); break;
      case "f": F.dp += v; break;
      case "g": F.gain += v; break;
      case "s": F.drop += v; break;
      case "w": F.gather += v; break;
      case "S": F.stars += v; break;
      case "N": F.np += v; F.npCd = Math.max(F.npCd, num(r[4]) || 0); break;
      case "H": F.heal += v; F.healCd = Math.max(F.healCd, num(r[4]) || 0); break;
      case "A": F.healAll += v; break;
      case "h": F.surehit = true; break;
      case "i": F.pierce = true; break;
      case "d": F.idef = true; break;
    }
  });
  return F;
}

/* ---------- a card's damage with its code (the game's formula for a card; see 58-workshop-damage.js) ---------- */
function ccBase(s) {
  const a = atlasOf(s), k = !a && typeof customKit === "function" ? customKit(s) : null;
  const atk = total(s, "atk") || (a && a.atk ? num(a.atk[1]) : k && k.atk ? num(k.atk[1]) : 0) || 0;
  let pm = a && a.pm ? a.pm.slice() : [0, 0, 0, 0, 0];
  if (k) { pm = [0, 0, 0, 0, 0]; (k.ps || []).forEach((p) => { const v = typeof psValue === "function" ? psValue(p) : null; if (v) pm[v.slot] += v.v; }); }
  return {atk: atk, cls: NPC_CLASS_ATK[s.cls] || 1, pm: pm};
}
// one hit of a card on its own: ATK × 0.23 × card × (1 + card up) × class × (1 + special attack + critical up) × 2 on a critical + Damage Plus
function ccCardDmg(A, card, F, crit, vsOn) {
  const up = (A.pm[{Buster: 0, Arts: 1, Quick: 2}[card]] || 0) / 100, vs = F && vsOn ? F.vs.reduce((t, x) => t + x[0] + (crit ? x[2] : 0), 0) : 0;
  return A.atk * 0.23 * (NPC_CARD[card] || 1) * (1 + up) * A.cls * (1 + ((F ? (crit ? F.crit : 0) + vs : 0)) / 100) * (crit ? 2 : 1) + (A.pm[4] || 0) + (F ? F.dp : 0);
}

/* ---------- on a servant's page, under Deck ---------- */
function ccSlotHTML(s, i, card, no, open) {
  const c = CC_BY.get(no), cc = card ? cardCls(card) : "";
  return `<button type="button" class="cc-slot ${cc}${c ? " has" : ""}${open ? " open" : ""}" data-cc-slot="${i}" aria-expanded="${open}" aria-label="Card ${i + 1}${card ? ", " + card : ""}: ${c ? esc(c.n) + ". Change or take it off" : "no Command Code. Engrave one"}">
    <span class="cc-cardic">${card && CARD_IMG[card] ? `<img src="${CARD_IMG[card]}" alt="">` : ""}</span>
    ${c ? `<img class="cc-face" src="${esc(ccPic(c))}" alt="" loading="lazy" decoding="async" width="56" height="56">` : `<span class="cc-face none" aria-hidden="true">+</span>`}
    <span class="cc-sn">${c ? esc(c.n) : card ? "Empty" : "Card not set"}</span></button>`;
}
function ccPickList(s, i) {
  const q = CCU.q.trim().toLowerCase(), k = CCU.k, card = ccDeck(s)[i], cur = ccSlots(s)[i];
  const list = CC_ALL.filter((c) => (!q || c.n.toLowerCase().includes(q) || c.e.toLowerCase().includes(q)) && (!k || ccKinds(c).has(k)))
    .sort((a, b) => b.r - a.r || a.no - b.no);
  if (!list.length) return `<p class="cc-none">No Command Code matches that.</p>`;
  return list.map((c) => {
    const F = ccFx(c, s, card), dead = (c.x || []).length && (c.x || []).every((r) => !ccRowOk(r, s, card));
    return `<li><button type="button" class="cc-opt${c.no === cur ? " on" : ""}${dead ? " dead" : ""}" data-cc-put="${c.no}">
      <img class="cc-face sm" src="${esc(ccPic(c))}" alt="" loading="lazy" decoding="async" width="40" height="40">
      <span class="cc-ot"><b>${esc(c.n)}</b> <i class="cc-stars" aria-label="${c.r} stars">${"★".repeat(c.r)}</i><small>${esc(c.e)}</small>${dead ? `<em>Does nothing on this ${esc(card || "card")}</em>` : ""}</span></button></li>`;
  }).join("");
}
function ccPickHTML(s, i) {
  const card = ccDeck(s)[i], cur = CC_BY.get(ccSlots(s)[i]);
  return `<div class="cc-pick" data-cc-pick="${i}">
    <div class="cc-pick-head"><p><b>Card ${i + 1}${card ? ", " + esc(card) : ""}</b>${cur ? `: ${esc(cur.n)}` : ""}</p>
      <div class="cc-pick-acts">${cur ? `<button type="button" class="btn sm" data-cc-put="0">Take it off</button>` : ""}<button type="button" class="btn ghost sm" data-cc-close>Done</button></div></div>
    <div class="cc-pick-ctl"><label class="cc-f"><span>Find</span><input type="search" data-cc-q value="${esc(CCU.q)}" placeholder="A name or an effect" autocomplete="off"></label>
      <label class="cc-f"><span>For</span><select data-cc-k>${CC_KINDS.map((x) => `<option value="${x[0]}"${x[0] === CCU.k ? " selected" : ""}>${esc(x[1])}</option>`).join("")}</select></label></div>
    <ul class="cc-opts" data-cc-opts>${ccPickList(s, i)}</ul></div>`;
}
function ccEffHTML(s) {
  const d = ccDeck(s), sl = ccSlots(s), A = ccBase(s), rows = [];
  sl.forEach((no, i) => {
    const c = CC_BY.get(no), card = d[i]; if (!c) return;
    const F = ccFx(c, s, card), chips = (c.x || []).filter((r) => ccRowOk(r, s, card)).map(ccRowText);
    const nums = [];
    if (card && A.atk) {
      const p = (a, b) => `<span class="was">${fmt(Math.round(a))}</span> <b>${fmt(Math.round(b))}</b>`;
      if (F.crit) nums.push(`Critical ${p(ccCardDmg(A, card, null, true), ccCardDmg(A, card, F, true))}`);
      if (F.dp) nums.push(`Hit ${p(ccCardDmg(A, card, null, false), ccCardDmg(A, card, F, false))}`);
      if (F.vs.length) {
        const who = F.vs.map((x) => x[1].split("|").join(", ")).filter((v, j, a) => a.indexOf(v) === j).join("; ");
        const hitToo = F.vs.some((x) => x[0] > 0);
        nums.push(`Against ${esc(who)}: ${hitToo ? `hit ${p(ccCardDmg(A, card, null, false), ccCardDmg(A, card, F, false, true))}, ` : ""}critical ${p(ccCardDmg(A, card, null, true), ccCardDmg(A, card, F, true, true))}`);
      }
    }
    rows.push(`<li class="${card ? cardCls(card) : ""}"><span class="cc-cardic">${card && CARD_IMG[card] ? `<img src="${CARD_IMG[card]}" alt="">` : ""}</span>
      <div><p class="cc-en"><b>${esc(c.n)}</b> <small>card ${i + 1}${card ? ", " + esc(card) : ""}</small></p>
      ${chips.length ? `<p class="cc-chips">${chips.map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : `<p class="cc-chips none">${esc(c.e)}</p>`}
      ${nums.length ? `<p class="cc-nums">${nums.join(" · ")}</p>` : ""}</div></li>`);
  });
  if (!rows.length) return "";
  return `<ol class="cc-eff">${rows.join("")}</ol><p class="cc-note">${A.atk ? `One card on its own: ATK ${fmt(A.atk)} (this level, Fou included), a neutral enemy, the average roll. ` : ""}Codes work on their own card only, never on the Noble Phantasm. They fight with these cards in the Battle simulator.</p>`;
}
function ccSecHTML(s) {
  if (!CC_ALL.length) return "";
  const d = ccDeck(s), sl = ccSlots(s), n = sl.filter(Boolean).length, open = CCU.open && CCU.open.id === s.id ? CCU.open.i : -1;
  return `<section class="d-sec cc-sec" data-cc-for="${esc(s.id)}">
    <div class="sec-head"><h3>Command Codes <small>${n ? n + " of 5 engraved" : "none engraved"}</small></h3><button type="button" class="btn ghost sm" data-action="tab" data-tab="codes">All codes</button></div>
    <div class="cc-slots" role="group" aria-label="Command Codes on the five cards">${d.map((card, i) => ccSlotHTML(s, i, card, sl[i], open === i)).join("")}</div>
    ${open >= 0 ? ccPickHTML(s, open) : ""}
    <div data-cc-eff>${ccEffHTML(s)}</div></section>`;
}
function ccPaintSec(s, focusSlot) {
  const sec = document.querySelector("#dossier .cc-sec"); if (!sec || !s) return;
  sec.outerHTML = ccSecHTML(s);
  if (focusSlot != null) { const b = document.querySelector(`#dossier .cc-sec [data-cc-slot="${focusSlot}"]`); if (b) b.focus({preventScroll: true}); }
}
const renderDossier64 = renderDossier;
renderDossier = function (force) {
  const r = renderDossier64.apply(this, arguments);
  try {
    const d = document.getElementById("dossier");
    if (d && !S.editing && !S.readOnly && !d.querySelector("#servant-form") && !d.querySelector(".cc-sec")) {
      const s = S.servants.find((v) => v.id === shownId()), deck = d.querySelector(".deck-sec");
      if (s && deck) deck.insertAdjacentHTML("afterend", ccSecHTML(s));
    }
  } catch (e) { console.error(e); }
  return r;
};
const typingInDossier64 = typingInDossier;
typingInDossier = function () {
  const a = document.activeElement;
  return typingInDossier64() || !!(a && a.matches && a.matches("#dossier input[data-cc-q]"));
};
function ccChanged(s) {
  ccPaintSec(s);
  if (S.tab === "codes") ccRender();
  if (S.tab === "battle" && typeof BT !== "undefined" && !BT.run) { try { btRender(); } catch (e) {} }
}
document.addEventListener("click", (e) => {
  const t = e.target.closest && e.target.closest("[data-cc-slot], [data-cc-put], [data-cc-close]"); if (!t) return;
  const sec = t.closest(".cc-sec"), s = sec && S.servants.find((v) => v.id === sec.dataset.ccFor); if (!s) return;
  if (t.dataset.ccSlot != null) {
    const i = num(t.dataset.ccSlot) || 0, was = CCU.open && CCU.open.id === s.id && CCU.open.i === i;
    CCU.open = was ? null : {id: s.id, i: i}; if (!was) CCU.q = ""; ccPaintSec(s, i);
    if (!was) { const f = document.querySelector("#dossier .cc-pick input[data-cc-q]"); if (f && !matchMedia("(pointer: coarse)").matches) f.focus({preventScroll: true}); }
  } else if (t.dataset.ccClose != null) { const i = CCU.open ? CCU.open.i : 0; CCU.open = null; ccPaintSec(s, i); }
  else if (t.dataset.ccPut != null && CCU.open) {
    const i = CCU.open.i, was = ccSlots(s)[i], no = num(t.dataset.ccPut) || 0, c = CC_BY.get(no);
    ccPut(s, i, no); CCU.open = null; ccChanged(s);
    const b = document.querySelector(`#dossier .cc-sec [data-cc-slot="${i}"]`); if (b) b.focus({preventScroll: true});
    toastAction(c ? c.n + " is engraved on card " + (i + 1) + "." : "Card " + (i + 1) + "'s Command Code is off.", "Undo", () => { ccPut(s, i, was); ccChanged(s); });
  }
});
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("#dossier input[data-cc-q]")) return;
  CCU.q = t.value.slice(0, 60);
  const sec = t.closest(".cc-sec"), s = sec && S.servants.find((v) => v.id === sec.dataset.ccFor), ul = sec && sec.querySelector("[data-cc-opts]");
  if (s && ul && CCU.open) ul.innerHTML = ccPickList(s, CCU.open.i);
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.matches) return;
  if (t.matches("#dossier select[data-cc-k]")) {
    CCU.k = t.value;
    const sec = t.closest(".cc-sec"), s = sec && S.servants.find((v) => v.id === sec.dataset.ccFor), ul = sec && sec.querySelector("[data-cc-opts]");
    if (s && ul && CCU.open) ul.innerHTML = ccPickList(s, CCU.open.i);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !CCU.open) return;
  const t = e.target; if (!t || !t.closest || !t.closest("#dossier .cc-sec")) return;
  const s = S.servants.find((v) => v.id === CCU.open.id), i = CCU.open.i; CCU.open = null; e.preventDefault(); e.stopPropagation(); if (s) ccPaintSec(s, i);
}, true);

/* ---------- the page ---------- */
TABS.push("codes");
UI_IC.codes = '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><circle cx="12" cy="11" r="3.4"/><path d="M12 7.6v-1.6M12 16v-1.6M8.6 11H7M17 11h-1.6"/><path d="M9 17.5h6"/>';
(function () {
  const nav = document.querySelector("nav.tabs"), before = document.getElementById("tab-past");
  const b = document.createElement("button");
  b.className = "tab"; b.setAttribute("role", "tab"); b.id = "tab-codes"; b.dataset.action = "tab"; b.dataset.tab = "codes"; b.setAttribute("aria-selected", "false");
  b.innerHTML = `<i class="tab-ic">${uiIcon("codes")}</i><span class="tab-t">Command Codes</span>`; b.title = "Command Codes";
  if (nav) nav.insertBefore(b, before && before.parentNode === nav ? before : null);
  const sec = document.createElement("section");
  sec.id = "view-codes"; sec.setAttribute("aria-labelledby", "tab-codes"); sec.hidden = true; sec.innerHTML = `<div id="codes" class="cc"></div>`;
  const after = document.getElementById("view-mystic") || document.getElementById("view-battle"); if (after) after.after(sec); else document.querySelector(".shell").appendChild(sec);
  if ((location.hash || "").slice(1) === "codes") S.tab = "codes";
})();
if (typeof FOOT_TABS !== "undefined") {
  const i = FOOT_TABS.findIndex((x) => x[0] === "past"); FOOT_TABS.splice(i >= 0 ? i : FOOT_TABS.length, 0, ["codes", "Command Codes"]);
  try { if (typeof foot !== "undefined" && foot) { foot.innerHTML = footHTML(); renderFoot(); } } catch (e) {}
}
// which of your servants have each code
function ccWhere() {
  const m = new Map(), st = ccState().s;
  S.servants.forEach((s) => { (st[s.id] || []).forEach((no) => { no = num(no); if (!CC_BY.has(no)) return; if (!m.has(no)) m.set(no, []); if (!m.get(no).includes(s)) m.get(no).push(s); }); });
  return m;
}
const CC_SORT = [["", "Release order"], ["r", "Rarity"], ["n", "Name"], ["mine", "Engraved first"]];
function ccCardHTML(c, where) {
  const on = where.get(c.no) || [], chips = (c.x || []).map(ccRowText);
  return `<li class="cc-card${on.length ? " on" : ""}" data-cc="${c.no}">
    <div class="cc-top"><img class="cc-face" src="${esc(ccPic(c))}" alt="" loading="lazy" decoding="async" width="64" height="64">
      <div class="cc-name"><h3>${esc(c.n)}</h3><p class="cc-meta"><i class="cc-stars" aria-label="${c.r} stars">${"★".repeat(c.r)}</i><span>No. ${c.no}</span>${c.il ? `<span>Art by ${esc(c.il)}</span>` : ""}</p></div></div>
    <p class="cc-e">${esc(c.e)}</p>
    ${chips.length ? `<p class="cc-chips">${chips.map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : ""}
    ${on.length ? `<p class="cc-on">On ${on.map((s) => `<button type="button" class="linkish" data-action="goto" data-id="${esc(s.id)}">${esc(nmText(s))}</button>`).join(", ")}</p>` : ""}</li>`;
}
function ccPageHTML() {
  const f = ccState().f, q = String(f.q || "").trim().toLowerCase(), k = CC_KINDS.some((x) => x[0] === f.k) ? f.k || "" : "", r = num(f.r) || 0, sort = CC_SORT.some((x) => x[0] === f.sort) ? f.sort || "" : "";
  const where = ccWhere();
  let list = CC_ALL.filter((c) => (!q || c.n.toLowerCase().includes(q) || c.e.toLowerCase().includes(q)) && (!k || ccKinds(c).has(k)) && (!r || c.r === r));
  list = list.slice().sort(sort === "r" ? (a, b) => b.r - a.r || a.no - b.no : sort === "n" ? (a, b) => a.n.localeCompare(b.n) : sort === "mine" ? (a, b) => (where.has(b.no) - where.has(a.no)) || a.no - b.no : (a, b) => a.no - b.no);
  const mine = Object.values(ccState().s).reduce((t, a) => t + (Array.isArray(a) ? a.filter((x) => CC_BY.has(num(x))).length : 0), 0);
  return `<section class="d-sec cc-head">
      <p class="cc-lead">All ${CC_ALL.length} of NA's Command Codes. Engrave them on your servants' cards from a servant's page, under Deck: what they add shows there, and the cards fight with them in the Battle simulator.${mine ? ` You have ${mine} engraved.` : ""}</p>
      <div class="cc-ctl">
        <label class="cc-f grow"><span>Find</span><input type="search" data-ccp-q value="${esc(f.q || "")}" placeholder="A name or an effect" autocomplete="off"></label>
        <label class="cc-f"><span>For</span><select data-ccp-k>${CC_KINDS.map((x) => `<option value="${x[0]}"${x[0] === k ? " selected" : ""}>${esc(x[1])}</option>`).join("")}</select></label>
        <label class="cc-f"><span>Rarity</span><select data-ccp-r><option value="0">Any</option>${[5, 4, 3, 2, 1].map((v) => `<option value="${v}"${v === r ? " selected" : ""}>${v}★</option>`).join("")}</select></label>
        <label class="cc-f"><span>Sort by</span><select data-ccp-sort>${CC_SORT.map((x) => `<option value="${x[0]}"${x[0] === sort ? " selected" : ""}>${esc(x[1])}</option>`).join("")}</select></label>
      </div>
      <p class="cc-count" aria-live="polite">${list.length === CC_ALL.length ? "Showing all " + list.length : "Showing " + list.length + " of " + CC_ALL.length}</p></section>
    ${list.length ? `<ol class="cc-grid">${list.map((c) => ccCardHTML(c, where)).join("")}</ol>` : `<p class="cc-none">No Command Code matches that. Clear the search or pick Everything.</p>`}`;
}
function ccRender() {
  const box = document.getElementById("codes"); if (!box) return;
  const a = document.activeElement, keep = a && a.matches && a.matches("#codes input[data-ccp-q]") ? [a.selectionStart, a.selectionEnd] : null;
  box.innerHTML = ccPageHTML();
  if (keep) { const i = box.querySelector("input[data-ccp-q]"); if (i) { i.focus({preventScroll: true}); try { i.setSelectionRange(keep[0], keep[1]); } catch (e) {} } }
}
const renderAll64 = renderAll;
renderAll = function () { const r = renderAll64.apply(this, arguments); try { if (S.tab === "codes") ccRender(); } catch (e) { console.error(e); } return r; };
const renderChrome64 = renderChrome;
renderChrome = function () { const r = renderChrome64.apply(this, arguments); try { if (S.tab === "codes") { const b = document.getElementById("codes"); if (b && !b.childElementCount) ccRender(); } } catch (e) { console.error(e); } return r; };
let ccTypeT = 0;
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("#codes input[data-ccp-q]")) return;
  ccState().f.q = t.value.slice(0, 60); clearTimeout(ccTypeT); ccTypeT = setTimeout(() => { ccSave(); ccRender(); }, 120);
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("#codes select")) return;
  const f = ccState().f;
  if (t.dataset.ccpK != null) f.k = t.value || undefined; else if (t.dataset.ccpR != null) f.r = num(t.value) || undefined; else if (t.dataset.ccpSort != null) f.sort = t.value || undefined; else return;
  ccSave(); ccRender();
});

/* ---------- the Battle simulator: each card fights with its code ---------- */
// the codes for a fighter's deck (letters, in the battle's order): a servant's k-th Buster card gets the code on their
// k-th Buster card on their page
function ccForBattle(s, deck) {
  const d = ccDeck(s), sl = ccSlots(s); if (!sl.some(Boolean)) return null;
  const W = {B: "Buster", A: "Arts", Q: "Quick"}, used = new Set();
  return deck.map((L) => {
    const card = W[L], j = d.findIndex((c, i) => c === card && !used.has(i)); if (j < 0) return null;
    used.add(j); const c = CC_BY.get(sl[j]); return c ? ccFx(c, s, card) : null;
  });
}
if (typeof btFromServant === "function") {
  const btFromServant64 = btFromServant;
  btFromServant = function (s) {
    const t = btFromServant64.apply(this, arguments);
    try { if (t && s && !S.readOnly) { const cc = ccForBattle(s, t.deck || []); if (cc) t.cc = cc; } } catch (e) {}
    return t;
  };
}
// (the engine, 49a-battle-engine.js, reads a card's code from opts.cc)
window.__fgiCc = {list: () => CC_ALL, slots: (id) => ccSlots(S.servants.find((s) => s.id === id)), put: (id, i, no) => { const s = S.servants.find((x) => x.id === id); ccPut(s, i, no); ccChanged(s); },
  fx: (no, id, card) => ccFx(CC_BY.get(no), S.servants.find((s) => s.id === id) || {}, card), dmg: (id, card, no, crit, vs) => { const s = S.servants.find((x) => x.id === id); return ccCardDmg(ccBase(s), card, no ? ccFx(CC_BY.get(no), s, card) : null, crit, vs); },
  battle: (id) => { const s = S.servants.find((x) => x.id === id); return s ? btFromServant(s) : null; }, kinds: (no) => Array.from(ccKinds(CC_BY.get(no))), text: (no) => (CC_BY.get(no).x || []).map(ccRowText)};
