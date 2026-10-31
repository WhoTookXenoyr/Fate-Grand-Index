/* ================= 0.25.0: a big, searchable picker for the damage calculator's supports =================
   The calculator's two "Support" boxes were plain dropdowns with 400-odd names, small and hard to search. Each is now a
   button with the support's face; it opens a window the size of the Craft Essence picker with a search box (names and
   nicknames: "castoria", "skadi", "waver"), class buttons, and pictures in four groups: your Guests, the supports most
   people borrow, your own servants, and every NA servant. What it stores is the same as before (npcPrefs.sup). */
const spk = document.createElement("div");
spk.className = "spk"; spk.hidden = true; spk.setAttribute("role", "dialog"); spk.setAttribute("aria-modal", "true"); spk.setAttribute("aria-labelledby", "spk-t");
document.body.appendChild(spk);
const SPK = {q: "", c: "", n: 72, cb: null, back: null, title: "", cur: "", list: null};
const SPK_CLASSES = ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker", "Ruler", "Avenger", "Moon Cancer", "Alter Ego", "Foreigner", "Pretender", "Shielder", "Beast"];
// everyone that can be picked: [key, name, Atlas record or null, group]
function spkAll() {
  if (SPK.list) return SPK.list; // 0.26.0: a list of its own (your supports, friends' servants for Versus)
  const out = [];
  guestsForSup().forEach((x) => out.push({key: x.key, n: x.n, a: calcKitOf(x.s || x.g), s: x.s, g: "Your Guests"}));
  NPC_POP.forEach((no) => { const a = ATLAS_BY_NO.get(no); if (a) out.push({key: "a:" + no, n: a.n, a: a, g: "Often borrowed"}); });
  S.servants.filter((x) => !x.wish).slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((s) => out.push({key: "r:" + s.id, n: s.name, a: calcKitOf(s), s: s, g: "Your servants"}));
  ATLAS_S.slice().sort((a, b) => a.n.localeCompare(b.n)).forEach((a) => out.push({key: "a:" + a.no, n: a.n, a: a, g: "Every NA servant"}));
  return out;
}
function spkList() {
  const q = nick(SPK.q), words = q.split(" ").filter(Boolean);
  const hit = (x) => {
    if (SPK.c && !(x.a && x.a.c === SPK.c)) return false;
    if (!words.length) return true;
    const hay = " " + nick(x.n) + " " + (x.a ? nick(x.a.n) + " " + nname(x.a.n) : "") + " ";
    return words.every((w) => hay.includes(" " + w) || hay.includes(w));
  };
  return spkAll().filter(hit);
}
function spkCardHTML(x) {
  const a = x.a, face = a && a.f ? aimg(a.f) : "", r = a ? a.r : num(x.s && x.s.rarity) || 0, cls = a ? a.c : (x.s && x.s.cls) || "";
  const on = x.key === SPK.cur;
  return `<li><button type="button" class="pc-card r${clamp(r || 1, 1, 5)}${on ? " is-on" : ""}" data-spk="${esc(x.key)}" aria-pressed="${on}" aria-label="${esc(x.n)}${cls ? ", " + esc(cls) : ""}">
    <span class="pc-face">${face ? `<img src="${esc(face)}" alt="" loading="lazy" decoding="async">` : `<i class="spk-none">${esc((x.n || "?").slice(0, 1))}</i>`}${CLASS_LOGO[cls] ? `<img class="pc-cls" src="${CLASS_LOGO[cls]}" alt="">` : ""}${r ? `<span class="pc-st">${stars(r)}</span>` : ""}</span>
    <span class="pc-n">${esc(x.n)}</span><span class="pc-m">${esc(cls || "not in NA's data")}${x.m ? " · " + esc(x.m) : x.s ? (x.s.wish ? " · Guest" : " · your levels") : ""}</span></button></li>`;
}
function spkBody() {
  const all = spkList(), searching = !!(SPK.q.trim() || SPK.c);
  if (!all.length) return `<p class="tr-none">No servant matches. Try part of the name, or a nickname like "castoria".</p>`;
  const groups = SPK.list ? Array.from(new Set(all.map((x) => x.g))) : ["Your Guests", "Often borrowed", "Your servants", "Every NA servant"];
  let shown = 0, html = "";
  groups.forEach((gname) => {
    let list = all.filter((x) => x.g === gname);
    // while searching, a servant already shown in an earlier group isn't repeated under every NA servant
    if (gname === "Every NA servant" && searching) { const seen = new Set(all.filter((x) => x.g !== gname && x.a).map((x) => x.a.no)); list = list.filter((x) => !seen.has(x.a.no)); }
    if (!list.length) return;
    const cut = gname === "Every NA servant" ? Math.max(0, SPK.n - shown) : list.length, part = list.slice(0, cut); shown += part.length;
    html += `<section class="spk-g"><h3>${esc(gname)} <small>${list.length}</small></h3><ul class="pc-grid spk-grid">${part.map(spkCardHTML).join("")}</ul>
      ${list.length > part.length ? `<p class="cep-more"><button type="button" class="btn ghost sm" data-spk-more>Show more (${fmt(list.length - part.length)} left)</button></p>` : ""}</section>`;
  });
  return html;
}
function spkRender(full) {
  if (full) {
    spk.innerHTML = `<div class="cep-veil" data-spk-close></div><div class="cep-panel spk-panel">
      <header class="cep-head"><h2 id="spk-t">${esc(SPK.title)}</h2><button type="button" class="cep-x" data-spk-close aria-label="Close">×</button></header>
      <div class="cep-tools"><input type="search" class="field-input" data-spk-q placeholder="Search: Castoria, Skadi, Waver…" value="${esc(SPK.q)}" aria-label="Search servants" autocomplete="off">
        ${SPK.cur ? `<button type="button" class="btn ghost sm" data-spk="">No support</button>` : ""}
        <div class="cep-rs spk-cls" role="group" aria-label="Class"><button type="button" class="chip" data-spk-c="" aria-pressed="${!SPK.c}">All</button>${SPK_CLASSES.map((c) => `<button type="button" class="chip spk-c" data-spk-c="${esc(c)}" aria-pressed="${SPK.c === c}" title="${esc(c)}">${CLASS_LOGO[c] ? `<img src="${CLASS_LOGO[c]}" alt="${esc(c)}">` : esc(c)}</button>`).join("")}</div></div>
      <div class="cep-body spk-body">${spkBody()}</div></div>`;
  } else {
    const b = spk.querySelector(".spk-body"); if (b) { b.innerHTML = spkBody(); }
    spk.querySelectorAll("[data-spk-c]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.spkC === SPK.c)));
  }
}
function openSpk(title, cur, cb, list) {
  SPK.title = title; SPK.cur = cur || ""; SPK.cb = cb; SPK.n = 72; SPK.q = ""; SPK.c = ""; SPK.back = document.activeElement; SPK.list = list || null;
  spkRender(true); spk.hidden = false; document.documentElement.classList.add("cep-open");
  const q = spk.querySelector("[data-spk-q]"); if (q) q.focus({preventScroll: true});
}
function closeSpk() {
  if (spk.hidden) return;
  spk.hidden = true; spk.innerHTML = ""; document.documentElement.classList.remove("cep-open"); SPK.cb = null; SPK.list = null;
  const b = SPK.back; SPK.back = null; if (b && b.isConnected && b.focus) b.focus({preventScroll: true});
}
spk.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("[data-spk-close]")) { closeSpk(); return; }
  const c = t.closest("[data-spk-c]"); if (c) { SPK.c = c.dataset.spkC; SPK.n = 72; spkRender(false); return; }
  if (t.closest("[data-spk-more]")) { SPK.n += 120; spkRender(false); return; }
  const p = t.closest("[data-spk]");
  if (p) { const cb = SPK.cb, key = p.dataset.spk; closeSpk(); if (cb) cb(key); }
});
let spkT = 0;
spk.addEventListener("input", (e) => { if (!e.target.matches("[data-spk-q]")) return; SPK.q = e.target.value; clearTimeout(spkT); spkT = setTimeout(() => { SPK.n = 72; spkRender(false); }, 120); });
spk.addEventListener("keydown", (e) => {
  // Enter in the search box picks the first match
  if (e.key === "Enter" && e.target.matches("[data-spk-q]")) { const f = spk.querySelector(".spk-body [data-spk]"); if (f) { e.preventDefault(); f.click(); } }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !spk.hidden) { e.preventDefault(); e.stopPropagation(); closeSpk(); } }, true);

// the calculator's support boxes: a button with the support's face instead of a dropdown
npcSupSel = function (i, cur) {
  const src = npcSrc(cur), a = src && src.a;
  return `<span class="npc-sup"><span class="npc-sup-k">Support ${i + 1}</span>
    <button type="button" class="npc-pick${src ? " on" : ""}" data-npc-pick="${i}" aria-label="Support ${i + 1}: ${esc(src ? src.n : "none")}. Change">
      ${a && a.f ? `<img src="${esc(aimg(a.f))}" alt="" loading="lazy">` : `<i class="npc-pick-none" aria-hidden="true">+</i>`}
      <span><b>${esc(src ? src.n : "Pick a support")}</b><small>${esc(src ? [a ? a.c : "", src.key[0] === "g" ? "Guest" : src.key[0] === "r" ? "yours" : "Lv 10 skills"].filter(Boolean).join(" · ") : "Castoria, Skadi, Oberon, a Guest…")}</small></span><i class="npc-pick-c" aria-hidden="true">▾</i></button>
    ${src ? `<button type="button" class="npc-unpick" data-npc-unpick="${i}" aria-label="Remove support ${i + 1}">×</button>` : ""}</span>`;
};
// the support face in the row's heading is part of the button now
const npcTeamHTML25 = npcTeamHTML;
npcTeamHTML = function (s, np, I) { return npcTeamHTML25(s, np, I).replace(/<div class="npc-wh">(<img class="npc-face"[^>]*>)(<span class="npc-sup">)/g, '<div class="npc-wh">$2'); };
function npcSetSup(box, i, key) {
  const sup = (npcPrefs.sup || []).slice(0, 2); while (sup.length < 2) sup.push("");
  sup[i] = key || ""; npcPrefs.sup = sup.filter(Boolean); npcSave(); npcPaint(box, true);
  const b = box.querySelector(`[data-npc-pick="${Math.min(i, npcPrefs.sup.length)}"]`) || box.querySelector("[data-npc-pick]"); if (b) b.focus({preventScroll: true});
}
document.addEventListener("click", (e) => {
  const p = e.target.closest && e.target.closest("[data-npc-pick], [data-npc-unpick]"); if (!p) return;
  const box = p.closest(".npc"); if (!box) return;
  if (p.dataset.npcUnpick != null) { npcSetSup(box, num(p.dataset.npcUnpick) || 0, ""); return; }
  const i = num(p.dataset.npcPick) || 0, cur = (npcPrefs.sup || [])[i] || "";
  openSpk("Support " + (i + 1) + " for the damage calculator", cur, (key) => { const b2 = document.querySelector(`.npc[data-npc-for="${CSS.escape(box.dataset.npcFor)}"]`) || box; npcSetSup(b2, i, key); });
});
