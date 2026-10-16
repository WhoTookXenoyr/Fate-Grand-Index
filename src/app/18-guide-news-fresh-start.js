/* ================= v15: fresh start, a short guide, What's new, grails counted, quick set, trait check ================= */
// Everything here is drawn once and left still: no blur, no looping animation, nothing that repaints on its own.
// alpha until the full website and app: 1.0.0
const APP_VER = "0.22.1";
const INTRO_KEY = "spirit-origin-list:v1:intro", NEWS_KEY = "spirit-origin-list:v1:news";
const TRK_KEY = "spirit-origin-list:v1:traitkeep", TRN_KEY = "spirit-origin-list:v1:traitnote";
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

/* ---------- the title takes you Home ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="go-home"]'); if (!b) return;
  e.preventDefault();
  const t = document.getElementById("tab-home"); if (t && S.tab !== "home") t.click();
  window.scrollTo({top: 0});
});

/* ---------- grails: how many it took to get there ---------- */
// Each Holy Grail lifts the cap by 5 up to Lv 90, then by 2 up to Lv 100 and by 2 again up to Lv 120,
// so a ★5 at Lv 100 took 5 grails and at Lv 120 took 15; a ★4 at Lv 100 took 7.
function grailsTo(r, lv) {
  const cap = CAPS[r]; if (!cap || !(lv > cap)) return 0;
  let c = cap, n = 0;
  while (c < lv && n < 60) { c += c < 90 ? 5 : 2; n++; }
  return n;
}
const grailsOf = (s) => grailsTo(num(s.rarity), num(s.level));
const levelStatus14 = levelStatus;
levelStatus = function (s) {
  const st = levelStatus14(s);
  if (st && st.kind === "grail") { const g = grailsOf(s); st.grails = g; st.text = "+" + (num(s.level) - CAPS[s.rarity]) + " · " + plural(g, "grail"); }
  return st;
};
const grailTotal = (list) => list.reduce((a, s) => a + grailsOf(s), 0);

/* ---------- quick set on a servant's page ---------- */
function quickHTML(s) {
  const r = num(s.rarity), cap = CAPS[r], lv = num(s.level), sk = Array.isArray(s.skills) ? s.skills : [];
  const ten = [0, 1, 2].every((i) => sk[i] === 10);
  const b = (act, v, label, sub, title, off) => `<button type="button" class="ql-b" data-action="${act}" data-v="${v}" title="${esc(title)}"${off ? " disabled" : ""}><b>${label}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
  return `<div class="ql" role="group" aria-label="Quick set">
    <span class="ql-k">Quick set</span>
    ${cap ? b("ql-lv", cap, "Max level", "Lv " + cap + ", no grails", "Level " + cap + ": the most it goes without grails", lv === cap) : ""}
    ${b("ql-lv", 100, "Lv 100", cap ? plural(grailsTo(r, 100), "grail") : "", "Level 100", lv === 100)}
    ${b("ql-lv", 120, "Lv 120", cap ? plural(grailsTo(r, 120), "grail") : "", "Level 120", lv === 120)}
    ${b("ql-sk", 10, "Skills 10/10/10", "", "All three skills to Lv 10", ten)}
  </div>`;
}
function quickSet(kind, v) {
  const s = S.servants.find((x) => x.id === shownId()); if (!s || S.readOnly) return;
  const keep = {level: s.level, skills: s.skills === undefined ? undefined : JSON.parse(JSON.stringify(s.skills)), hp: s.hp, atk: s.atk};
  let msg = "";
  if (kind === "lv") {
    s.level = v;
    const stats = syncStats(s);
    const g = grailsTo(num(s.rarity), v);
    msg = s.name + " is now Lv " + v + (g ? " (" + plural(g, "grail") + ")" : "") + (stats ? ", with HP and ATK to match." : ".");
  } else {
    s.skills = [10, 10, 10];
    msg = s.name + "'s skills are all Lv 10.";
  }
  renderSummary(); renderList(); renderDossier(); renderRanking();
  scheduleWrite("servants", s);
  toastAction(msg, "Undo", () => {
    Object.keys(keep).forEach((k) => { if (keep[k] === undefined) delete s[k]; else s[k] = keep[k]; });
    renderSummary(); renderList(); renderDossier(); renderRanking(); scheduleWrite("servants", s);
    toast("Put back as it was.");
  });
}

/* ---------- trait check: attribute, alignment and traits against the NA data ---------- */
// Another name for the same trait, so it isn't counted as different
const TRAIT_SYN = {"spaceflight-able servant": "Can Fly in Space", "artoria": "Arthur"};
const synT = (t) => TRAIT_SYN[String(t).toLowerCase()] || t;
// only traits the NA data knows about can be called wrong; others you added (Pseudo-Servant, …) are left alone
// both sides are read the way the page shows them (aliases and other names for the same trait), so a fix always sticks
const nT = (t) => synT(normTrait(t));
let NA_TRAITS = null;
const naTraits = () => NA_TRAITS || (NA_TRAITS = new Set([].concat(...ATLAS_S.map((x) => (x.t || []).map(nT)))));
const sameSet = (x, y) => x.length === y.length && x.every((v) => y.includes(v));
function traitDiff(s) {
  if (!s) return null;
  const a = atlasOf(s); if (!a) return null;
  const ti = traitInfo(s);
  // nothing set at all is a job for Fill in, not a difference
  if (!ti.attr && !ti.order.length && !ti.moral.length && !ti.traits.length) return null;
  const fm = missingOf(s); if (fm && fm.m.tr) return null;
  const mine = ti.traits.map(nT), na = (a.t || []).map(nT), d = {};
  if (a.a && ti.attr !== a.a) d.attr = [ti.attr, a.a];
  if ((a.o || []).length && !sameSet(ti.order, a.o)) d.order = [ti.order, a.o];
  if ((a.m || []).length && !sameSet(ti.moral, a.m)) d.moral = [ti.moral, a.m];
  const add = na.filter((t) => !mine.includes(t)), drop = mine.filter((t) => naTraits().has(t) && !na.includes(t));
  if (add.length) d.add = add;
  if (drop.length) d.drop = drop;
  if (!Object.keys(d).length) return null;
  return {s: s, a: a, d: d, sig: s.id + "|" + JSON.stringify(d)};
}
const trKeep = () => { try { return new Set(JSON.parse(lsGet(TRK_KEY) || "[]")); } catch (e) { return new Set(); } };
const trCands = () => { const k = trKeep(); return S.servants.map(traitDiff).filter((x) => x && !k.has(x.sig)); };
const alTxt = (o, m) => (o.concat(m).join(" ") || "none");
function diffLines(x) {
  const d = x.d, out = [];
  if (d.attr) out.push(["Attribute", (ATTR_LABEL[d.attr[0]] || d.attr[0] || "none") + " → " + (ATTR_LABEL[d.attr[1]] || d.attr[1])]);
  if (d.order || d.moral) { const ti = traitInfo(x.s); out.push(["Alignment", alTxt(ti.order, ti.moral) + " → " + alTxt(x.a.o.length ? x.a.o : ti.order, x.a.m.length ? x.a.m : ti.moral)]); }
  if (d.add) out.push(["Adds", d.add.join(", ")]);
  if (d.drop) out.push(["Removes", d.drop.join(", ")]);
  return out;
}
function fixTraits(x) {
  const s = x.s, a = x.a, d = x.d, ti = traitInfo(s);
  const keep = {}; ["attr", "lawOrder", "moral", "traits", "traitsSet", "buffs", "gender"].forEach((k) => { keep[k] = s[k] === undefined ? undefined : JSON.parse(JSON.stringify(s[k])); });
  const drop = new Set(d.drop || []);
  s.attr = a.a || ti.attr || null;
  s.lawOrder = (a.o || []).length ? a.o.slice() : ti.order;
  s.moral = (a.m || []).length ? a.m.slice() : ti.moral;
  s.traits = uniq(ti.traits.filter((t) => !drop.has(nT(t))).concat(d.add || []));
  if (s.gender && drop.has(s.gender)) { if (a.g && a.g !== "Unknown") s.gender = a.g; else delete s.gender; }
  if (!Array.isArray(s.buffs) && ti.buffs.length) s.buffs = ti.buffs;
  s.traitsSet = true;
  return keep;
}
async function fixMany(list) {
  if (S.readOnly || !list.length) return;
  const undo = [];
  for (const x of list) { undo.push([x.s, fixTraits(x)]); await writeDoc("servants", x.s); }
  renderAll(); if (!pcDlg.hidden) pcClose();
  toastAction(list.length === 1 ? list[0].s.name + " now matches the NA data." : plural(list.length, "servant") + " now match the NA data.", "Undo", async () => {
    for (const u of undo) { restore(u[0], u[1]); await writeDoc("servants", u[0]); }
    renderAll(); toast("Put back as they were.");
  });
}
const trNote = document.createElement("div");
trNote.id = "trait-note"; trNote.className = "notice fill-note tr-note"; trNote.hidden = true;
(() => { const n = document.getElementById("fill-note") || document.getElementById("notice"); if (n && n.parentNode) n.parentNode.insertBefore(trNote, n.nextSibling); })();
function renderTraitNote() {
  if (S.dbState !== "ok" || !S.loaded.servants || S.readOnly) { trNote.hidden = true; return; }
  const list = trCands(), sig = list.map((x) => x.sig).sort().join("~");
  if (!list.length || sig === lsGet(TRN_KEY)) { trNote.hidden = true; return; }
  trNote.hidden = false;
  trNote.innerHTML = `<p><b>${plural(list.length, "servant")} ${list.length === 1 ? "has" : "have"} an attribute, alignment or traits that differ from the NA data</b>: ${esc(list.slice(0, 5).map((x) => x.s.name).join(", "))}${list.length > 5 ? "…" : ""}.</p>
    <button type="button" class="btn primary sm" data-action="tr-fixall">Fix ${list.length === 1 ? "it" : "them"}</button><button type="button" class="btn sm" data-action="tr-open">See what changes</button><button type="button" class="btn ghost sm" data-action="tr-later">Not now</button>`;
}
let trSel = null;
function traitPanelHTML() {
  const list = trCands();
  if (!trSel) trSel = new Set(list.map((x) => x.s.id));
  const n = list.filter((x) => trSel.has(x.s.id)).length;
  const row = (x) => `<li class="fill-row"><label><input type="checkbox" data-trsel="${esc(x.s.id)}"${trSel.has(x.s.id) ? " checked" : ""}>
      <span class="fill-face"><img src="${esc(aimg(x.a.f))}" alt="" loading="lazy"></span>
      <span class="fill-main"><b>${esc(x.s.name)}${x.s.wish ? ` <small>Guest</small>` : ""}</b><small>as ${esc(x.a.n)} · No. ${x.a.no} · ${esc(x.a.c)}</small>
        <span class="tr-diff">${diffLines(x).map((l) => `<span><i>${esc(l[0])}</i> ${esc(l[1])}</span>`).join("")}</span></span></label>
      <button type="button" class="btn ghost sm" data-action="tr-keep" data-k="${esc(x.sig)}" title="Keep yours and stop asking about this servant">Keep mine</button></li>`;
  return `<div class="pcd-panel fill-panel v15-panel" tabindex="-1">
    <button type="button" class="pcd-x" data-action="pc-close" aria-label="Close">×</button>
    <h2 id="pcd-title" class="pcd-name">Check traits against the NA data</h2>
    <p class="fill-intro">Attribute and alignment take the NA value. Traits the NA data has are added, and traits it knows but doesn't give this servant are removed. Traits it doesn't know about (like Pseudo-Servant) stay. You can undo it right after.</p>
    ${list.length ? `<ul class="fill-list">${list.map(row).join("")}</ul>` : `<p class="tr-none">Every matched servant agrees with the NA data.</p>`}
    <div class="fill-act"><button type="button" class="btn primary" data-action="tr-go"${n ? "" : " disabled"}>Fix ${plural(n, "servant")}</button><button type="button" class="btn ghost" data-action="pc-close">Cancel</button></div>
  </div>`;
}

/* ---------- What's new ---------- */
// MAJOR.MINOR.PATCH: still alpha (0.x) until the full website and app, which will be 1.0.0.
// A release with new features moves MINOR, a release with only fixes moves PATCH.
const CHANGES = [
  {v: "0.22.1", d: "16 Oct 2026", t: "Event page and banner fixes", i: [
    "Simulating a banner whose featured ★5 isn't on your list: the 330-summon guarantee now shows them by name, with their picture, instead of an unknown servant. Featured servants from Past Chaldea are tagged Rate-up or Guaranteed. Featuring one of your own servants while an NA banner is loaded can be undone, back to the NA banner.",
    "Opening a second event while the first one's wiki text was still loading could show the first event's text on the second page. Each page now only gets its own.",
    "Refresh on an Event page while free-quest drops were still loading could leave the drops empty. They load again now.",
    "Currency calculator: a material sold twice (two rows, or for two currencies) is no longer counted as needed twice.",
    "Banners named \"Fate/…\" aren't taken for an event's own just because the names share \"Fate\".",
    "With live NA updates off, the Event page says why there are no banners and can turn them on. Opening an Event page moves keyboard focus to it, and only the 30 most recently opened events are kept in this browser."]},
  {v: "0.22.0", d: "16 Oct 2026", t: "Event pages and NA banners", i: [
    "<b>Event pages</b>: press an event in On NA now and it gets its own page. It has the summary and guide, the summoning campaign with its rate-up schedule, the event's servants and Craft Essences (what you can get, plus the wiki's bonus lists), missions, main, free, extra and challenge quests with what free quests drop, the event shop, point rewards and lotteries, misc info and game updates.",
    "<b>Currency calculator</b> on every Event page: what your servants still need from the event shop for ascensions and skills, what that costs in each currency, and roughly how many runs of the best free quest it takes, with your drop bonus. Fill in what you already have and the numbers follow.",
    "<b>Simulate NA banners</b>: Simulate on a banner loads it into the Summoning page, with its featured servants and Craft Essences on rate-up. Servants you don't have come from Past Chaldea; nothing is added to your list. Go back to your own banner whenever you like.",
    "Event data comes from Atlas Academy, and the written parts from the Fate/Grand Order wiki. Wiki text is filtered first, so only plain text, lists, tables, links and wiki pictures come through. An Event page you've opened is kept in this browser and works offline."]},
  {v: "0.21.0", d: "16 Oct 2026", t: "On NA now", i: [
    "<b>On NA now</b> at the top of Home: the events, campaigns and login bonuses running on the NA server, with how long each has left; the summon banners up right now with their featured servants; and the newest servants and Craft Essences. Announced events show when they start.",
    "It comes straight from Atlas Academy's NA data: Fate/Grand Index checks every few hours while it's open and only downloads the lists when NA has updated. What it got is kept in this browser, so Home still shows it offline.",
    "Servants and Craft Essences this file doesn't have yet are marked <b>NEW</b> and open on Atlas Academy; the ones it has open in Past Chaldea. Your roster is never touched, and you can turn live updates off at the bottom of the block."]},
  {v: "0.20.1", d: "15 Oct 2026", t: "Smoother class names, edges fixed", i: [
    "The big class name behind a servant's page no longer drops frames when it pulses or glows. The letters only move and fade now, and the glow is drawn once instead of on every frame. Berserker, Caster and Avenger were the worst; every class got the same fix, and the letters no longer blur on the way in.",
    "Beast waves (Space Ereshkigal) reach the right edge of the picture and the page instead of stopping short at a slant. Moon Cancer's tide lines got the same fix.",
    "Compact: the gold grail outline no longer runs over the × that closes the servant window."]},
  {v: "0.20.0", d: "15 Oct 2026", t: "Rebuilt behind the scenes", i: [
    "<b>Tidier inside</b>: Fate/Grand Index is now made from one clean set of source files instead of a pile of patches, and hundreds of automatic checks run on every change before a new version comes out. Your roster, settings and pictures stay exactly as they are.",
    "Favourite Craft Essences and removed costumes are saved the moment you press, and Undo shows the old state straight away."]},
  {v: "0.19.0", d: "14 Oct 2026", t: "Craft Essences", i: [
    "<b>Favourite Craft Essences</b>: every servant has five slots for Craft Essences, with pictures, under their stats. Press one to equip it and its HP and ATK (at its max level) are added to the servant's stats.",
    "<b>Parties</b>: pick each Craft Essence from a searchable list with pictures, and the party cards show the Craft Essence's picture. Typing a name still works."]},
  {v: "0.18.1", d: "14 Oct 2026", t: "15 fps fixes", i: [
    "At 30 and 15 fps, animations that scrolled out of view and back no longer stay frozen, like the gold outline on grailed servants in your list.",
    "The buttons at the top stay on their own row under the logo; switching the frame rate no longer moves them.",
    "The gold frame around the servant page follows the page when something above it changes size."]},
  {v: "0.18.0", d: "14 Oct 2026", t: "Lighter, shinier", i: [
    "<b>Lighter on your PC</b>: the moving background keeps to the frame rate you pick, also on 144 Hz and 240 Hz screens, and the graphics card keeps the pace instead of JavaScript. It also rests while this window isn't the one you're using, like when you're in a game.",
    "<b>Overcharge rows</b> in Past Chaldea for 32 more servants: chances that grow with Overcharge (Stun, Charm, Charge decrease), extra damage and the low-HP bonus.",
    "<b>Costumes</b>: the × on a costume removes it from that servant, with Undo, and one more click clears the empty costume slot from every servant. + Add costume brings one back.",
    "<b>The picture's glare</b> is smooth now, without rings, and it grows with grails like a graded card: a holo sheen once grailed, glints from Lv 100 and the full shine at Lv 120.",
    "Compact: × sits on the window's corner and no longer covers Edit details."]},
  {v: "0.17.1", d: "13 Oct 2026", t: "Favicon", i: [
    "The browser tab now shows the <b>Fate/Grand Index</b> diamond. Bigger icons, like a shortcut on the taskbar, show the full logo."]},
  {v: "0.17.0", d: "13 Oct 2026", t: "Fate/Grand Index", i: [
    "<b>Fate/Grand Index</b>: the page has a new name and logo. Your Spirit Origin List lives inside it, with everything you saved.",
    "<b>Compact layout</b>: a servant's page now opens as a window over the list, like Past Chaldea, and your servants spread across the whole width. Close it with ×, Esc or a click outside.",
    "A <b>footer</b> at the bottom of every page: every section, your data (backup, import, spreadsheet, start fresh), help, credits for Atlas Academy and the wiki, and a back-to-top link. Saving stays in this browser for now; accounts are on the way."]},
  {v: "0.16.0", d: "13 Oct 2026", t: "Summoning, rebuilt", i: [
    "<b>Summoning</b> is smoother and lighter, with no canvas at all. ★5 servants get rainbow circles, rainbow pillars and a rainbow wipe that unveils them. ★4 servants and ★4–5 Craft Essences get the same in gold, a little faster. ★3 is a short silver reveal, and ★1–2 skip the ceremony.",
    "On the Summoning page the best card of each pull gets the ceremony before the cards are dealt (you can switch that off there). The cards wear their own backs: silver ★3 and gold ★4 servants, bronze ★3, silver ★4 and red ★5 Craft Essences.",
    "<b>Compact layout</b>: a switch next to light / dark puts a servant's picture on the left and the essentials beside it, like Past Chaldea. Modern is the layout you know.",
    "<b>Bond</b> 0–15 on every servant, next to level and NP, with new Master records: Bond 10, Max Bond, EX Servant, Five S, Ten A, Holy Grail Servant (NP5, 10/10/10, Lv 120) and Rainbow Fou.",
    "<b>NP upgrades</b> get a switch too, set up automatically from the NA data for 169 servants. An NP's base damage now follows its card: Buster x1.5, Arts x1.0, Quick x0.8.",
    "Stars: ★4 in beige, ★5 in gold with a pulse, a ★5 grailed past Lv 100 in rainbow, and Beasts (Space Ereshkigal, Draco) in their picture's colours. Foreigners use the same stars as everyone else.",
    "Servant pictures catch the light like the command cards when you move over them.",
    "The Ranking's top tier is called <b>EX</b>.",
    "Fixed: switching light / dark at 30 or 15 fps froze the page until a reload.",
    "Fixed: the upgraded-skill switch didn't flip when the two versions differ only by a + in the rank (A → A+) or share a name.",
    "Fixed: NP rows whose value is the same at every NP level are gone. Pretender backgrounds follow the picture's colours instead of a fixed green."]},
  {v: "0.15.0", d: "13 Oct 2026", t: "Upgraded skills", i: [
    "<b>Upgraded skills</b>: 264 skills of 191 servants change after a Rank Up quest, an interlude or the story. A switch next to the skill name flips between the upgraded skill and the one before it, on your servants and in Past Chaldea. Mash, Emiya, Altera, Nikola Tesla and Kingprotea have three or four versions; their switch steps through them.",
    "<b>HP and ATK follow the level</b> everywhere: the + and − buttons, Quick set, the edit form, and a Guest's summon. Your servants whose HP or ATK didn't match their level were put right once, with undo.",
    "The trait check's fix now sticks. Shuten-Douji (Caster) kept asking because the page read her “Demonic Beast” trait as “Demonic Beast Servant”, which is a different trait.",
    "<b>Artoria Face</b> is the trait's name now (it was Saberface), in filters, traits and Past Chaldea.",
    "Fixed: “Increase C. Star Drop Rate” stays on one line (the C. is Critical Stars, not the end of a sentence).",
    "Version numbers: MAJOR.MINOR.PATCH, still in alpha until 1.0.0, the full website and app. The version shows at the top left; press it for this list."]},
  {v: "0.14.0", d: "13 Oct 2026", t: "A fresh start", i: [
    "The file now opens empty, with a short guide for first-timers. Got a file with someone else's servants in it? <b>Export ▾ → Start fresh</b> empties this browser only.",
    "<b>What's new</b>: every update in one place, under the button at the top.",
    "<b>Quick set</b> on a servant's page: Max level, Lv 100, Lv 120 and Skills 10/10/10 in one press.",
    "Grailed servants show how many grails it took: <b>+10 · 5 grails</b> for a ★5 at Lv 100, 15 grails at Lv 120.",
    "Past Chaldea: search and filter by <b>attribute, alignment, gender and trait</b>. Type “lawful evil dragon”, or press a tag on a servant's page to see everyone who shares it.",
    "<b>Trait check</b>: your servants' attribute, alignment and traits are compared with the NA data, with a one-click fix and undo.",
    "Space Ereshkigal, BB (Summer) and Kishinami Hakuno (Male / Female) have their proper names. Alignments that change with ascension (Aesc, Kuonji Alice, Hibiki &amp; Chikagi, Archetype: EARTH) and Nero (Bride)'s are complete.",
    "Press <b>Spirit Origin List</b> at the top to go back Home."]},
  {v: "0.13.1", d: "13 Oct 2026", t: "Filled in", i: [
    "<b>Fill in from the NA data</b> covers everything that's empty now: pictures, skills, passives, deck, NP, traits and HP / ATK, with undo.",
    "Fixed: the page colours follow a servant's stage art again, Atlas Academy pictures included.",
    "Fixed: on the Quick NP banner the cut-lines sweep across the whole banner."]},
  {v: "0.13.0", d: "13 Oct 2026", t: "Summoned from the past", i: [
    "<b>Summon</b> any servant from Past Chaldea straight onto your roster, with an animation by rarity: quick for ★1–2, slower for ★3, a gold edge for ★4 and a rainbow edge for ★5.",
    "Fill in your servants' empty pictures, skills and passives from the NA data.",
    "Better name matching between your servants and the NA list (Elizabeth / Elisabeth, Atalanta / Atalante, Demon King Nobunaga and more)."]},
  {v: "0.12.0", d: "12 Oct 2026", t: "Past Chaldea", i: [
    "A new page with <b>every servant and Craft Essence on the NA server</b>, from Atlas Academy's data: stats from Lv 1 to 120, skills, passives, NP tables, ascension art and costumes.",
    "Add any of them to your Guests. Your own servants are matched to the NA list, and you can fix a match by hand.",
    "Every skill and buff icon from the game joins the icon picker, and a servant from Past Chaldea visits Home each day."]},
  {v: "0.11.0", d: "12 Oct 2026", t: "Icons and summoning", i: [
    "Icons on every effect line of skills, passives and Noble Phantasms, with an icon picker.",
    "<b>Summoning</b>: a banner simulator with the real rates, 10-summons and the 330 pity, plus your odds.",
    "Home: find a servant, who on your roster hits a class hardest, Recent progress and Master records.",
    "A frame-rate switch (60 / 30 / 15 fps), and animations that rest while they're off screen, for lighter computers."]},
  {v: "0.10.0", d: "11 Oct 2026", t: "Home", i: [
    "<b>Home</b> opens first and sums up your Chaldea; a reload keeps you on the tab you were on.",
    "The grail frame wraps the whole servant panel."]},
  {v: "0.9.0", d: "11 Oct 2026", t: "Light and dark", i: [
    "A light / dark switch, a slow summoning-circle backdrop, and page colours from the servant you have open.",
    "Fou tiers (silver, gold, rainbow) up to 3,000, grail effects from Lv 100 and Lv 102, and a Lv 10 skill celebration.",
    "Command cards you can tilt, NP atmosphere by card type, and Guests that join with a card-flip summon."]},
  {v: "0.8.0", d: "11 Oct 2026", t: "Rankings and traits", i: [
    "Export as a spreadsheet (.csv) or planner list, and import from either.",
    "<b>Ranking</b> with a drag-and-drop tier board and the best next upgrade, plus Party DNA team ideas.",
    "Traits, attribute and alignment, with a roster filter, servants alike, and support buffs that target them. Paste the wiki's infobox to fill them in."]},
  {v: "0.7.1", d: "10 Oct 2026", t: "Tidy-up", i: ["Fixed: pictures added in the edit form but never saved are dropped when you leave it. Clearer wording here and there."]},
  {v: "0.7.0", d: "10 Oct 2026", t: "Versus", i: [
    "<b>Versus</b>: compare servants side by side, with class affinity.",
    "Skill ranks in colour, the official command card art, a wishlist, and a living background for each class."]},
  {v: "0.6.0", d: "10 Oct 2026", t: "Skill sets", i: ["Several skill sets per servant, class logos under the art, and a banner for extra classes."]},
  {v: "0.5.0", d: "10 Oct 2026", t: "Deck and passives", i: ["Deck, passive skills, effects over several lines and any number of values per skill. Search finds passives too."]},
  {v: "0.4.0", d: "9 Oct 2026", t: "Parties", i: ["<b>Parties</b> on a formation screen, named costumes, the NP table, a fonts dialog and the living background."]},
  {v: "0.3.0", d: "9 Oct 2026", t: "Ascensions", i: ["Ascension stages plus any number of costumes, Fou on HP and ATK, and the Ranking tab."]},
  {v: "0.2.0", d: "9 Oct 2026", t: "On the web", i: ["The spreadsheet becomes this page: your roster with a full servant panel, saved in your browser, with backup and import."]},
  {v: "0.1.0", d: "Sept 2026", t: "The spreadsheet", i: ["Where it started: an Excel Spirit Origin List of ★5 servants with HP, ATK, skills, NP and teams."]},
];
function newsHTML() {
  return `<div class="pcd-panel v15-panel news-panel" tabindex="-1">
    <button type="button" class="pcd-x" data-action="pc-close" aria-label="Close">×</button>
    <p class="pcd-kick">Changelog · alpha</p>
    <h2 id="pcd-title" class="pcd-name">What's new</h2>
    <p class="fill-intro">Every update to Fate/Grand Index, newest first. Numbers go MAJOR.MINOR.PATCH: new features move the middle number, fixes the last one, and 1.0.0 will be the full website and app. Past Chaldea holds ${fmt(ATLAS_S.length)} servants and ${fmt(ATLAS_C.length)} Craft Essences.</p>
    ${CHANGES.map((c, i) => `<article class="cl-v${i ? "" : " is-new"}"><h3><span class="cl-n">${esc(c.v)}</span> ${esc(c.t)} <small>${esc(c.d)}</small>${i ? "" : `<i class="cl-new">New</i>`}</h3><ul>${c.i.map((t) => `<li>${t}</li>`).join("")}</ul></article>`).join("")}
    <div class="fill-act"><button type="button" class="btn" data-action="tour">Take the guide</button><button type="button" class="btn ghost" data-action="pc-close">Close</button></div>
  </div>`;
}
function newsSeen() { lsSet(NEWS_KEY, APP_VER); syncNewsDot(); }
function syncNewsDot() { const d = document.querySelector(".news-dot"); if (d) d.hidden = lsGet(NEWS_KEY) === APP_VER; }

/* ---------- the guide ---------- */
const TOUR = [
  {t: "Welcome to Fate/Grand Index", b: () => `<p>A Fate/Grand Order index with every NA servant and Craft Essence, and a Spirit Origin List of your own: levels, skills, Noble Phantasms, traits, parties and more.</p><p>Everything you add stays in <b>this browser</b>. No account, nothing uploaded.</p>
    ${S.servants.length ? `<p class="tour-aside">Got this file from a friend and see their servants? <button type="button" class="linkish" data-action="sf-open">Start fresh</button> gives you an empty list. It only clears this browser.</p>` : ""}`, art: ["Saber", "Caster", "Berserker"]},
  {t: "Find your servants in Past Chaldea", b: () => `<p>Every servant and Craft Essence on the NA server waits in <b>Past Chaldea</b>. Search by name, NP, class, attribute, alignment or trait.</p><p>Open one and press <b>Summon to roster</b> to add them, or <b>Add to Guests</b> for the ones you're still hoping for.</p>`, art: ["Archer", "Lancer", "Rider"]},
  {t: "Keep each servant up to date", b: () => `<p>On a servant's page, <b>+</b> and <b>−</b> set level, NP and skills. <b>Quick set</b> jumps to Max level, Lv 100, Lv 120 or Skills 10/10/10, and HP and ATK follow.</p><p>Empty parts and traits can be filled in from the NA data in one press.</p>`, art: ["Ruler", "Avenger", "Moon Cancer"]},
  {t: "Plan, compare and dream", b: () => `<p><b>Parties</b> builds teams, <b>Ranking</b> and <b>Versus</b> weigh your servants against each other, and <b>Summoning</b> tries a banner with the real rates.</p><p><b>Home</b> sums it all up, with your recent progress and records.</p>`, art: ["Alter Ego", "Foreigner", "Pretender"]},
  {t: "Keep it safe", b: () => `<p>Your list lives in this browser on this computer. Use <b>Export ▾ → Full backup</b> now and then, and <b>Import</b> to bring it to another computer or browser.</p><p>The sun / moon switch picks light or dark, and the <b>fps</b> button slows animations down for older computers.</p>`, art: ["Shielder", "Assassin", "Beast"]},
];
function tourHTML() {
  const i = clamp(pcOpen.step || 0, 0, TOUR.length - 1), st = TOUR[i], last = i === TOUR.length - 1;
  const art = st.art.map((c) => CLASS_LOGO[c] ? `<img src="${CLASS_LOGO[c]}" alt="">` : "").join("");
  return `<div class="pcd-panel v15-panel tour-panel" tabindex="-1">
    <button type="button" class="pcd-x" data-action="pc-close" aria-label="Close the guide">×</button>
    <div class="tour-art" aria-hidden="true">${art}</div>
    <p class="pcd-kick">Guide · ${i + 1} of ${TOUR.length}</p>
    <h2 id="pcd-title" class="pcd-name">${esc(st.t)}</h2>
    <div class="tour-body">${st.b()}</div>
    <div class="tour-dots" aria-hidden="true">${TOUR.map((x, k) => `<i${k === i ? ` class="on"` : ""}></i>`).join("")}</div>
    <div class="fill-act">${i ? `<button type="button" class="btn ghost" data-action="tour-step" data-d="-1">Back</button>` : `<button type="button" class="btn ghost" data-action="pc-close">Skip</button>`}
      ${last ? `<button type="button" class="btn primary" data-action="tour-done" data-autofocus>${S.servants.length ? "Done" : "Open Past Chaldea"}</button>${S.servants.length ? "" : `<button type="button" class="btn" data-action="pc-close">Look around first</button>`}`
        : `<button type="button" class="btn primary" data-action="tour-step" data-d="1" data-autofocus>Next</button>`}</div>
  </div>`;
}

/* ---------- start fresh ---------- */
// Only this browser's copy is emptied: other browsers and computers each keep their own list.
const PREF_KEYS = ["spirit-origin-list:v1:theme", "spirit-origin-list:v1:fonts", "spirit-origin-list:v1:fps", "spirit-origin-list:v1:affinity", "spirit-origin-list:v1:icauto",
  "spirit-origin-list:v1:past", "spirit-origin-list:v1:rankBase", "spirit-origin-list:v1:rankView", NEWS_KEY];
const SF_WORD = "START FRESH";
function freshHTML() {
  const own = S.servants.filter((s) => !s.wish).length, gu = S.servants.filter((s) => s.wish).length, pa = (S.parties || []).length;
  const what = [plural(own, "servant"), plural(gu, "Guest"), plural(pa, "party", "parties")].join(", ");
  return `<div class="pcd-panel v15-panel sf-panel" tabindex="-1">
    <button type="button" class="pcd-x" data-action="pc-close" aria-label="Close">×</button>
    <h2 id="pcd-title" class="pcd-name">Start fresh</h2>
    <p>This empties your Spirit Origin List <b>in this browser</b>: ${esc(what)}, their pictures, the progress log, ranking pins and NA matches. It can't be undone.</p>
    <p class="sf-safe">Nothing else is touched. Other browsers and computers keep their own lists, so if a friend gave you this file, their list stays safe on their computer.</p>
    <ol class="sf-steps">
      <li><span>Keep a copy, just in case.</span> <button type="button" class="btn sm" data-action="export">Download a backup</button></li>
      <li><label class="sf-chk"><input type="checkbox" data-sf-prefs> Also reset settings: light / dark, fonts, frame rate, class affinity</label></li>
      <li><label class="sf-word">Type <b>${SF_WORD}</b> to confirm <input type="text" data-sf-word autocomplete="off" autocapitalize="characters" spellcheck="false" data-autofocus></label></li>
    </ol>
    <div class="fill-act"><button type="button" class="btn danger solid" data-action="sf-go" disabled>Delete everything in this browser</button><button type="button" class="btn ghost" data-action="pc-close">Cancel</button></div>
  </div>`;
}
async function startFresh(prefs) {
  S.readOnly = true;
  try { Object.keys(timers).forEach((k) => clearTimeout(timers[k])); } catch (e) {}
  try {
    const rm = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("spirit-origin-list") && (prefs || !PREF_KEYS.includes(k))) rm.push(k); }
    rm.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("spirit-origin-list:v1", JSON.stringify({servants: [], parties: [], guests: [], savedAt: new Date().toISOString()}));
  } catch (e) {}
  try { if (typeof store !== "undefined") { store.servants = []; store.parties = []; store.guests = []; } } catch (e) {}
  try {
    const db = typeof imgStore !== "undefined" ? await imgStore.open() : null;
    if (db) await new Promise((res) => { const t = db.transaction("img", "readwrite"); t.objectStore("img").clear(); t.oncomplete = res; t.onerror = res; t.onabort = res; });
  } catch (e) {}
  location.reload();
}

/* ---------- the dialogs share Past Chaldea's panel ---------- */
const pcRenderDetail14 = pcRenderDetail;
pcRenderDetail = function () {
  if (pcOpen && pcOpen.v15) {
    const sc = pcDlg.querySelector(".pcd-panel"), top = sc ? sc.scrollTop : 0;
    pcDlg.innerHTML = {tour: tourHTML, news: newsHTML, fresh: freshHTML, traits: traitPanelHTML}[pcOpen.v15]();
    const p2 = pcDlg.querySelector(".pcd-panel"); if (p2 && pcOpen.keep) p2.scrollTop = top;
    return;
  }
  return pcRenderDetail14();
};
function v15Show(kind, extra) {
  if (pcDlg.hidden) pcBack = document.activeElement;
  pcOpen = Object.assign({v15: kind}, extra || {});
  pcRenderDetail();
  pcDlg.hidden = false; document.documentElement.classList.add("pcd-on");
  const shell = document.querySelector(".shell"); if (shell) shell.inert = true;
  const f = pcDlg.querySelector("[data-autofocus]") || pcDlg.querySelector(".pcd-x"); if (f) f.focus({preventScroll: true});
}
// a guide closed any way counts as seen
const pcClose14 = pcClose;
pcClose = function () { if (pcOpen && pcOpen.v15 === "tour") lsSet(INTRO_KEY, "seen"); return pcClose14(); };

/* ---------- on the page ---------- */
const renderDossier14 = renderDossier;
renderDossier = function (force) {
  const r = renderDossier14(force);
  const d = document.getElementById("dossier");
  if (d && !S.editing && !S.readOnly && !d.querySelector("#servant-form")) {
    const s = S.servants.find((v) => v.id === shownId());
    if (s) {
      const lv = d.querySelector('[data-action="bump"][data-f="level"]'), sec = lv && lv.closest(".d-sec");
      if (sec && !sec.querySelector(".ql")) sec.insertAdjacentHTML("beforeend", quickHTML(s));
      const x = traitDiff(s), trs = d.querySelector(".tr-sec");
      if (x && trs && !trs.querySelector(".tr-one") && !trKeep().has(x.sig)) {
        const el = document.createElement("div"); el.className = "fill-one tr-one";
        el.innerHTML = `<p>Compared with the NA data for <b>${esc(x.a.n)}</b>: ${diffLines(x).map((l) => `<span class="tr-l"><i>${esc(l[0])}</i> ${esc(l[1])}</span>`).join(" ")}</p><button type="button" class="btn sm primary" data-action="tr-one" data-id="${esc(s.id)}">Fix</button><button type="button" class="btn ghost sm" data-action="tr-keep" data-k="${esc(x.sig)}">Keep mine</button>`;
        const h = trs.querySelector(".sec-head"); if (h) h.insertAdjacentElement("afterend", el); else trs.prepend(el);
      }
    }
  }
  return r;
};
let introDone = false;
function maybeIntro() {
  if (introDone || S.dbState !== "ok" || !S.loaded.servants) return;
  introDone = true;
  if (lsGet(INTRO_KEY)) return;
  // someone who already has servants here knows the page
  if (S.servants.length || (S.parties || []).length) { lsSet(INTRO_KEY, "seen"); return; }
  setTimeout(() => { if (pcDlg.hidden && !S.servants.length) v15Show("tour", {step: 0}); }, 350);
}
const renderAll14 = renderAll;
renderAll = function () { renderAll14(); renderTraitNote(); maybeIntro(); syncNewsDot(); };

/* ---------- Home: what's new, the guide and starting fresh ---------- */
function homeNewsHTML() {
  const c = CHANGES[0];
  return `<section class="d-sec hm-block hm-b-news"><h3>What's new <small>${esc(c.v)} · ${esc(c.d)}</small></h3>
    <ul class="hn-list">${c.i.slice(0, 4).map((t) => `<li>${t}</li>`).join("")}</ul>
    <div class="hn-act"><button type="button" class="btn ghost sm" data-action="news">All updates</button><button type="button" class="btn ghost sm" data-action="tour">Guide</button>${S.readOnly ? "" : `<button type="button" class="btn ghost sm" data-action="sf-open">Start fresh…</button>`}</div></section>`;
}
const renderHome14 = renderHome;
renderHome = function () {
  renderHome14();
  const g = document.querySelector("#home .hm-grid");
  if (g && !g.querySelector(".hm-b-news")) g.insertAdjacentHTML("beforeend", homeNewsHTML());
};

/* ---------- pressing things ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action;
  if (a === "news") { const m = document.getElementById("export-menu"); if (m) m.hidden = true; v15Show("news"); newsSeen(); return; }
  if (a === "tour") { v15Show("tour", {step: 0}); return; }
  if (a === "tour-step") { pcOpen.step = clamp((pcOpen.step || 0) + Number(b.dataset.d || 0), 0, TOUR.length - 1); pcRenderDetail(); const f = pcDlg.querySelector("[data-autofocus]"); if (f) f.focus({preventScroll: true}); return; }
  if (a === "tour-done") { const go = !S.servants.length; pcClose(); if (go) { const t = document.getElementById("tab-past"); if (t) t.click(); window.scrollTo({top: 0}); } return; }
  if (a === "sf-open") { const m = document.getElementById("export-menu"); if (m) m.hidden = true; const w = document.getElementById("btn-export"); if (w) w.setAttribute("aria-expanded", "false"); v15Show("fresh"); return; }
  if (a === "sf-go") { const w = pcDlg.querySelector("[data-sf-word]"), p = pcDlg.querySelector("[data-sf-prefs]"); if (!w || w.value.trim().toUpperCase() !== SF_WORD) return; b.disabled = true; b.textContent = "Clearing…"; startFresh(!!(p && p.checked)); return; }
  if (a === "ql-lv") { const v = Number(b.dataset.v); if (v >= 1 && v <= 120) quickSet("lv", v); return; }
  if (a === "ql-sk") { quickSet("sk"); return; }
  if (a === "tr-open") { trSel = null; v15Show("traits"); return; }
  if (a === "tr-fixall") { fixMany(trCands()); return; }
  if (a === "tr-go") { fixMany(trCands().filter((x) => trSel && trSel.has(x.s.id))); return; }
  if (a === "tr-one") { const x = traitDiff(S.servants.find((v) => v.id === b.dataset.id)); if (x) fixMany([x]); return; }
  if (a === "tr-later") { lsSet(TRN_KEY, trCands().map((x) => x.sig).sort().join("~")); renderTraitNote(); return; }
  if (a === "tr-keep") {
    const k = trKeep(); k.add(b.dataset.k); lsSet(TRK_KEY, JSON.stringify(Array.from(k).slice(-400)));
    const one = b.closest(".tr-one"); if (one) one.remove();
    if (pcOpen && pcOpen.v15 === "traits") { pcOpen.keep = true; pcRenderDetail(); }
    renderTraitNote(); toast("Kept yours."); return;
  }
});
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.dataset || t.dataset.sfWord == null) return;
  const go = pcDlg.querySelector('[data-action="sf-go"]'); if (go) go.disabled = t.value.trim().toUpperCase() !== SF_WORD;
});
document.addEventListener("keydown", (e) => {
  const t = e.target; if (e.key !== "Enter" || !t || !t.dataset || t.dataset.sfWord == null) return;
  const go = pcDlg.querySelector('[data-action="sf-go"]'); if (go && !go.disabled) go.click();
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset || t.dataset.trsel == null || !trSel) return;
  if (t.checked) trSel.add(t.dataset.trsel); else trSel.delete(t.dataset.trsel);
  const go = pcDlg.querySelector('[data-action="tr-go"]'), n = trSel.size;
  if (go) { go.disabled = !n; go.textContent = "Fix " + plural(n, "servant"); }
});
syncNewsDot();


