/* ================= 0.28.0: announcements, news from FGO itself that matters on every server =================
   Shown at the top of Home, under the greeting, from `from` until `until`, whatever live updates are set to (they're
   part of the page, nothing is fetched). One with a stream counts down to it in the reader's own time, says it's on
   for `live` minutes, then says it has aired. Hide puts one away in this browser (spirit-origin-list:v1:announce =
   [ids]), with Undo. One with a login bonus lists its days, today's marked, until the bonus ends. Everything written
   here comes from the official announcements, which are linked; when the official stream links come out, `stream.url`
   is the one line to change. */
const AN_KEY = "spirit-origin-list:v1:announce";
const ANNOUNCE = [{
  id: "100mdl-2026",
  from: Date.UTC(2026, 9, 31, 0, 0), until: Date.UTC(2026, 10, 21, 0, 0),
  kick: "Every server",
  title: "Fate/Grand Order passed 100 million downloads",
  body: "Announced on 31 October 2026: the game has been downloaded 100 million times across its Japanese, English, Simplified Chinese, Traditional Chinese and Korean versions. The worldwide campaign for it will be revealed in a stream shown in every region at the same time, with Ayako Kawasumi and the development team.",
  // (once the stream has aired)
  after: "Announced on 31 October 2026: the game has been downloaded 100 million times across its Japanese, English, Simplified Chinese, Traditional Chinese and Korean versions. The worldwide campaign for it was revealed on 7 November in a stream shown in every region at the same time. NA's part of it shows up under Events once NA's data has it.",
  stream: {
    at: Date.UTC(2026, 10, 7, 11, 0), live: 120,
    name: "Chaldea Broadcasting Station: Worldwide Simultaneous Stream SP",
    jp: "Fate/Grand Order カルデア放送局 全世界同時配信SP ～全世界1億DL突破キャンペーン～",
    where: "On YouTube Live, Niconico Live and X. Pre-recorded.",
    url: "https://www.youtube.com/channel/UCXBgKqFxSjKADEuMLkc1Bpg/live", label: "YouTube",
    note: "The official stream links come out closer to the day. Until then YouTube opens FGO's official channel, where the stream goes live."
  },
  // a daily login bonus: from `start`, one reward a day, each day changing at the same time; the days are shown in
  // `tz` (`zone` names it). Every server has this one with the same rewards: NA's days (NA's item names) are shown,
  // JP's start 9 hours earlier (news.fate-go.jp/2026/10/100mdl/: 1 Nov 04:00 to 8 Nov 03:59 JST).
  bonus: {
    name: "Countdown login bonus", server: "Every server", start: Date.UTC(2026, 10, 1, 4, 0), tz: "America/Los_Angeles", zone: "PST", whose: "NA's days",
    who: "For Masters who have cleared the Fuyuki prologue, one reward a day. On JP each day starts 9 hours earlier, at 04:00 JST.",
    days: ["10 Golden Fruit", "10 Star Fou ★3 (HP) and 10 Sun Fou ★3 (ATK)", "20 Hellfire of Wisdom ★5 and 100 Mana Prisms", "1 Rare Prism", "1 Meteor Fou ★4 (HP) and 1 Corona Fou ★4 (ATK)", "1 Crystallized Lore", "100,000,000 QP"]
  },
  links: [["Stream announcement", "https://news.fate-go.jp/2026/10/1031nico/"], ["Login bonus (NA)", "https://webview.fate-go.us/iframe/2026/1031_100million_cd/"], ["Login bonus (JP)", "https://news.fate-go.jp/2026/10/100mdl/"]]
}];

function anHidden() { try { const d = JSON.parse(localStorage.getItem(AN_KEY) || "[]"); return Array.isArray(d) ? d.filter((x) => typeof x === "string") : []; } catch (e) { return []; } }
function anSetHidden(list) { try { localStorage.setItem(AN_KEY, JSON.stringify(list)); } catch (e) {} }
const anNow = () => Date.now();
function anShown(now) { const h = anHidden(); return ANNOUNCE.filter((a) => now >= a.from && now < a.until && !h.includes(a.id)); }
function anState(a, now) { const s = a.stream; return !s ? "" : now < s.at ? "soon" : now < s.at + s.live * 60e3 ? "live" : "aired"; }
// which day of the login bonus it is (0 = the first), -1 before, days.length after
function anDay(b, now) { return b ? (now < b.start ? -1 : Math.min(b.days.length, Math.floor((now - b.start) / 864e5))) : -1; }
// (the card redraws when either changes)
const anKey = (a, now) => anState(a, now) + "|" + anDay(a.bonus, now);
const anFmt = (ms, o) => { try { return new Date(ms).toLocaleString("en-GB", o); } catch (e) { return new Date(ms).toUTCString(); } };
const an2 = (n) => String(n).padStart(2, "0");
// 5d 19:14:03, or 19:14:03 on the day
function anCount(ms) {
  const t = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return (d ? d + "d " : "") + an2(h) + ":" + an2(m) + ":" + an2(s);
}
function anStreamHTML(a, now) {
  const s = a.stream, st = anState(a, now);
  const day = anFmt(s.at, {weekday: "short", day: "numeric", month: "short"}), mine = anFmt(s.at, {hour: "2-digit", minute: "2-digit"});
  const jst = anFmt(s.at, {timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit"}), pt = anFmt(s.at, {timeZone: "America/Los_Angeles", weekday: "short", hour: "2-digit", minute: "2-digit"});
  const head = st === "soon" ? `<p class="an-k">Stream starts in</p><p class="an-cd" data-an-at="${s.at}">${anCount(s.at - now)}</p>`
    : st === "live" ? `<p class="an-k an-on"><i class="hb-dot" aria-hidden="true"></i>On now</p>`
    : `<p class="an-k">The stream has aired</p><p class="an-cd sm">${esc(day)}</p>`;
  return `<div class="an-stream">${head}
    <p class="an-when"><b>${esc(day)}, ${esc(mine)}</b> your time<br><span>${esc(jst)} JST · ${esc(pt)} in NA (Pacific)</span></p>
    <a class="btn sm${st === "aired" ? "" : " primary"} an-watch" href="${esc(s.url)}" target="_blank" rel="noopener">${st === "live" ? "Watch now" : st === "aired" ? "FGO's YouTube channel" : "Watch on " + esc(s.label)} ↗</a></div>`;
}
function anBonusHTML(b, now) {
  const today = anDay(b, now), n = b.days.length, end = b.start + n * 864e5; if (today >= n) return "";
  const tz = b.tz || "Asia/Tokyo", zone = b.zone || "JST";
  const dayOf = (i) => anFmt(b.start + i * 864e5 + 864e5 / 2, {timeZone: tz, weekday: "short", day: "numeric", month: "short"});
  // (the second day's start: the first can begin on summer time)
  const flip = anFmt(b.start + 864e5, {hour: "2-digit", minute: "2-digit"}), flipZ = anFmt(b.start + 864e5, {timeZone: tz, hour: "2-digit", minute: "2-digit"});
  return `<div class="an-bonus"><p class="an-bh"><b>${esc(b.name)}</b><span class="an-btag">${esc(b.server)}</span><small>${b.whose ? esc(b.whose) + ", " : ""}until ${esc(anFmt(end - 6e4, {timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}))} ${esc(zone)}</small></p>
    <ol class="an-days">${b.days.map((d, i) => `<li class="${i < today ? "past" : i === today ? "today" : ""}"${i === today ? ' aria-current="date"' : ""}><span class="an-dn">${i === today ? "Today" : "Day " + (i + 1)}<small>${esc(dayOf(i))}</small></span><span class="an-dr">${esc(d)}</span></li>`).join("")}</ol>
    <p class="an-note">${esc(b.who)} ${esc(b.whose ? b.whose.replace(/^\w/, (c) => c.toUpperCase()) : "A new day")} start at ${esc(flipZ)} ${esc(zone)} (${esc(flip)} your time).</p></div>`;
}
function anHTML(a, now) {
  const s = a.stream, st = anState(a, now);
  return `<article class="an" data-an="${esc(a.id)}" data-an-state="${anKey(a, now)}" aria-labelledby="an-t-${esc(a.id)}">
    <div class="an-main">
      <p class="an-kick"><span class="an-tag">Announcement</span>${esc(a.kick)}</p>
      <h3 class="an-title" id="an-t-${esc(a.id)}">${esc(a.title)}</h3>
      <p class="an-body">${esc(st === "aired" && a.after ? a.after : a.body)}</p>
      ${s ? `<p class="an-show"><b>${esc(s.name)}</b><small lang="ja">${esc(s.jp)}</small><span>${esc(s.where)}${st === "soon" && s.note ? " " + esc(s.note) : ""}</span></p>` : ""}
      ${a.bonus ? anBonusHTML(a.bonus, now) : ""}
      <p class="an-links">${(a.links || []).map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join("")}<button type="button" class="linkish an-hide" data-action="an-hide" data-id="${esc(a.id)}">Hide</button></p>
    </div>
    ${s ? anStreamHTML(a, now) : ""}
  </article>`;
}
// under the greeting, above the event board
function anPaint() {
  const home = document.getElementById("home"); if (!home || S.tab !== "home") return;
  const old = home.querySelector(".an-list"); if (old) old.remove();
  const now = anNow(), list = anShown(now); if (!list.length) return;
  const hero = home.querySelector(".hm-hero"), html = `<section class="an-list" aria-label="Announcements">${list.map((a) => anHTML(a, now)).join("")}</section>`;
  if (hero) hero.insertAdjacentHTML("afterend", html); else home.insertAdjacentHTML("afterbegin", html);
}
// the countdown moves once a second while Home is open; a stream that starts or ends redraws its card
function anTick() {
  if (document.hidden || S.tab !== "home") return;
  const home = document.getElementById("home"), now = anNow(); if (!home) return;
  for (const el of home.querySelectorAll(".an[data-an]")) {
    const a = ANNOUNCE.find((x) => x.id === el.dataset.an);
    if (!a || now >= a.until || anKey(a, now) !== el.dataset.anState) { anPaint(); return; }
  }
  home.querySelectorAll("[data-an-at]").forEach((el) => { el.textContent = anCount(+el.dataset.anAt - now); });
}
setInterval(anTick, 1000);
const renderHome28 = renderHome;
renderHome = function () { const r = renderHome28.apply(this, arguments); try { anPaint(); } catch (e) {} return r; };
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="an-hide"]'); if (!b) return;
  e.preventDefault();
  const id = b.dataset.id, h = anHidden(); if (!h.includes(id)) anSetHidden(h.concat([id]));
  anPaint();
  toastAction("Announcement hidden.", "Undo", () => { anSetHidden(anHidden().filter((x) => x !== id)); anPaint(); });
});
