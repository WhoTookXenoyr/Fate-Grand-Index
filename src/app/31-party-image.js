/* ================= 0.24.0: a party as a picture =================
   "Share image" on a party draws it once onto a canvas (not an animation): the six slots with their art, class, level,
   NP, skills and Craft Essence, the totals and the strategy. It can be saved as a PNG, copied, or handed to the phone's
   share sheet. Your own stage pictures are used first, then Atlas Academy's art; a picture the browser won't let the
   canvas read (no CORS) is swapped for the class emblem, so the image can always be saved. */
const PIMG = {W: 1200, H: 700, scale: 2, theme: null, blob: null, url: "", party: null, busy: false, missed: 0};
const PIMG_PAL = {
  light: {bg: "#ebe4d8", panel: "#f7f3ec", sunken: "#e1d8c9", line: "#d2c6b2", ink: "#2a231c", muted: "#74685a", gold: "#9e7a2c", Buster: "#a4523f", Arts: "#47698d", Quick: "#527b4a"},
  dark: {bg: "#1c1814", panel: "#26211b", sunken: "#2f2922", line: "#41382e", ink: "#eee5d6", muted: "#a99b87", gold: "#d6b062", Buster: "#dc8572", Arts: "#8fb0d6", Quick: "#95be86"}
};
const pimgDlg = document.createElement("dialog");
pimgDlg.id = "party-img-dlg"; pimgDlg.className = "dlg pimg-dlg"; pimgDlg.setAttribute("aria-labelledby", "pimg-title");
pimgDlg.innerHTML = `<div class="dlg-in">
  <header class="dlg-head"><h2 id="pimg-title">Share party image</h2><button type="button" class="btn ghost sm" data-action="pimg-close">Close</button></header>
  <div class="pimg-view"><img id="pimg-img" alt=""><p class="pimg-wait" id="pimg-wait">Drawing…</p></div>
  <div class="pimg-acts">
    <div class="pimg-theme" role="group" aria-label="Colours"><button type="button" class="btn sm" data-action="pimg-theme" data-v="light">Light</button><button type="button" class="btn sm" data-action="pimg-theme" data-v="dark">Dark</button></div>
    <span class="spacer"></span>
    <button type="button" class="btn sm" data-action="pimg-copy">Copy</button>
    <button type="button" class="btn sm" data-action="pimg-share" hidden>Share…</button>
    <button type="button" class="btn sm primary" data-action="pimg-save">Save PNG</button>
  </div>
  <p class="pimg-msg muted" id="pimg-msg" role="status"></p>
</div>`;
document.body.appendChild(pimgDlg);

const cssVar = (k, fb) => (getComputedStyle(document.documentElement).getPropertyValue(k) || "").trim() || fb;
function pimgLoad(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const i = new Image(); let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    if (/^https?:/i.test(src)) i.crossOrigin = "anonymous";
    i.onload = () => fin(i); i.onerror = () => fin(null); i.src = src; setTimeout(() => fin(null), 9000);
  });
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
function fitText(ctx, t, w) {
  t = String(t || ""); if (ctx.measureText(t).width <= w) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > w) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}
function wrapText(ctx, t, w, lines) {
  const words = String(t || "").split(/\s+/).filter(Boolean), out = []; let cur = "";
  for (const wd of words) { const nx = cur ? cur + " " + wd : wd; if (ctx.measureText(nx).width <= w) cur = nx; else { if (cur) out.push(cur); cur = wd; } if (out.length === lines) break; }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && words.join(" ") !== out.join(" ")) out[lines - 1] = fitText(ctx, out[lines - 1] + " …", w);
  return out;
}
// object-fit: cover, kept to the top (stage art has the face near the top)
function drawCover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / r, sh = h / r;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, 0, sw, sh, x, y, w, h);
}
// what goes in each slot
function pimgSlots(p) {
  const front = [0, 1, 2].map((i) => (p.front || [])[i] || ""), back = [0, 1, 2].map((i) => (p.back || [])[i] || ""), ce = Array.isArray(p.ce) ? p.ce : [];
  const gi = p.guest ? front.findIndex((n) => !n) : -1;
  const slot = (name, i) => {
    if (i === gi) return {support: true, name: p.guest, ce: p.guestCe || "", s: S.servants.find((x) => x.name === p.guest) || null, g: S.guests.find((x) => x.name === p.guest) || null};
    return {name: name, ce: ce[i] || "", s: name ? S.servants.find((x) => x.name === name) || null : null};
  };
  const start = front.map(slot);
  if (p.guest && gi < 0) start[2] = {support: true, name: p.guest, ce: p.guestCe || "", s: S.servants.find((x) => x.name === p.guest) || null, g: S.guests.find((x) => x.name === p.guest) || null};
  return start.concat(back.map((n, i) => slot(n, 3 + i)));
}
async function pimgArt(sl) {
  const s = sl.s;
  if (s) { const k = iconSlot(s); if (k) { const im = await pimgLoad(artSrc(artOf(s, k))); if (im) return im; } }
  const a = s ? atlasOf(s) : (sl.name && typeof ATLAS_S !== "undefined" ? ATLAS_S.find((x) => nname(x.n) === nname(sl.name)) : null);
  if (a) {
    for (const src of [(a.im || [])[0], a.f]) { const im = src ? await pimgLoad(aimg(src)) : null; if (im) return im; }
    if ((a.im || [])[0] || a.f) PIMG.missed++; // offline, or the site doesn't allow its pictures in a canvas
  }
  return null;
}
async function pimgDraw(p, theme) {
  const P = PIMG_PAL[theme] || PIMG_PAL.light, W = PIMG.W, H = PIMG.H, K = PIMG.scale;
  const fD = cssVar("--f-display", "system-ui"), fB = cssVar("--f-body", "system-ui"), fM = cssVar("--f-data", "monospace");
  try { await Promise.all([`700 40px ${fD}`, `600 16px ${fB}`, `500 13px ${fM}`].map((f) => document.fonts.load(f))); } catch (e) {}
  const slots = pimgSlots(p); PIMG.missed = 0;
  const arts = await Promise.all(slots.map((sl) => (sl.name ? pimgArt(sl) : Promise.resolve(null))));
  const logos = await Promise.all(slots.map((sl) => { const c = sl.s ? sl.s.cls : sl.g ? sl.g.cls : ""; return CLASS_LOGO[c] ? pimgLoad(CLASS_LOGO[c]) : Promise.resolve(null); }));
  const ceImgs = await Promise.all(slots.map((sl) => { const c = sl.ce ? ceByName(sl.ce) : null; return c ? pimgLoad(ceFace(c)) : Promise.resolve(null); }));
  const draw = (useRemote) => {
    const cv = document.createElement("canvas"); cv.width = W * K; cv.height = H * K;
    const ctx = cv.getContext("2d"); ctx.scale(K, K);
    // backdrop: the page's colours, a soft glow of the leader's card colour and a gold rule
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    const lead = slots[0].s, tone = lead && P[lead.npCard] ? P[lead.npCard] : P.gold;
    const g = ctx.createRadialGradient(W * 0.85, -60, 40, W * 0.85, -60, 720); g.addColorStop(0, tone + "55"); g.addColorStop(1, tone + "00");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = P.gold; ctx.fillRect(48, 40, 56, 3);
    ctx.fillStyle = P.muted; ctx.font = `500 13px ${fM}`; ctx.textBaseline = "alphabetic";
    ctx.fillText("FATE/GRAND INDEX  ·  PARTY", 116, 46);
    ctx.fillStyle = P.ink; ctx.font = `700 42px ${fD}`; ctx.fillText(fitText(ctx, p.name || "Party", W - 96), 48, 96);
    if (p.bestFor) { ctx.fillStyle = P.muted; ctx.font = `500 18px ${fB}`; ctx.fillText(fitText(ctx, p.bestFor, W - 96), 48, 126); }
    // the six slots: three starting, a gap, three sub
    const top = 170, gap = 12, mid = 30, cw = (W - 96 - gap * 4 - mid) / 6, ah = Math.round(cw * 1.3);
    ctx.font = `500 12px ${fM}`; ctx.fillStyle = P.muted;
    ctx.fillText("STARTING", 48, top - 12); ctx.fillText("SUB", 48 + 3 * (cw + gap) - gap + mid, top - 12);
    slots.forEach((sl, i) => {
      const x = 48 + i * (cw + gap) + (i >= 3 ? mid - gap : 0), y = top;
      ctx.save(); rr(ctx, x, y, cw, ah + 150, 14); ctx.fillStyle = P.panel; ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      if (!sl.name) { ctx.fillStyle = P.muted; ctx.font = `500 14px ${fB}`; ctx.textAlign = "center"; ctx.fillText("Empty", x + cw / 2, y + ah / 2 + 40); ctx.textAlign = "left"; return; }
      ctx.save(); rr(ctx, x + 6, y + 6, cw - 12, ah, 10); ctx.clip();
      ctx.fillStyle = P.sunken; ctx.fillRect(x + 6, y + 6, cw - 12, ah);
      const art = useRemote || (arts[i] && !/^https?:/i.test(arts[i].src)) ? arts[i] : null;
      if (art) drawCover(ctx, art, x + 6, y + 6, cw - 12, ah);
      else if (logos[i]) { const sz = Math.min(cw - 40, 110); ctx.globalAlpha = 0.5; ctx.drawImage(logos[i], x + (cw - sz) / 2, y + 6 + (ah - sz) / 2, sz, sz); ctx.globalAlpha = 1; }
      // a shade at the bottom of the art for the name
      const sh = ctx.createLinearGradient(0, y + ah - 70, 0, y + ah + 6); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.72)");
      ctx.fillStyle = sh; ctx.fillRect(x + 6, y + ah - 70, cw - 12, 76);
      ctx.restore();
      if (logos[i]) ctx.drawImage(logos[i], x + 12, y + 12, 30, 30);
      if (sl.support) { ctx.save(); ctx.font = `600 11px ${fM}`; const tw = ctx.measureText("SUPPORT").width + 14; rr(ctx, x + cw - tw - 12, y + 14, tw, 20, 10); ctx.fillStyle = P.gold; ctx.fill(); ctx.fillStyle = "#1c1814"; ctx.fillText("SUPPORT", x + cw - tw - 5, y + 28); ctx.restore(); }
      else if (i === 0) { ctx.save(); ctx.font = `600 11px ${fM}`; const tw = ctx.measureText("LEADER").width + 14; rr(ctx, x + cw - tw - 12, y + 14, tw, 20, 10); ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText("LEADER", x + cw - tw - 5, y + 28); ctx.restore(); }
      // a servant made in the Servant Workshop says so in the picture too (under SUPPORT or LEADER)
      if (isCu(sl.s)) { const ty0 = sl.support || i === 0 ? 40 : 14; ctx.save(); ctx.font = `600 11px ${fM}`; const tw = ctx.measureText("CUSTOM").width + 14; rr(ctx, x + cw - tw - 12, y + ty0, tw, 20, 10); ctx.fillStyle = "rgba(242,211,145,.92)"; ctx.fill(); ctx.fillStyle = "#3a2a0c"; ctx.fillText("CUSTOM", x + cw - tw - 5, y + ty0 + 14); ctx.restore(); }
      ctx.fillStyle = "#fff"; ctx.font = `700 16px ${fD}`;
      const nl = wrapText(ctx, sl.name, cw - 28, 2);
      nl.forEach((l, j) => ctx.fillText(l, x + 14, y + ah - 8 - (nl.length - 1 - j) * 19));
      // level, stars, NP and skills
      let ty = y + ah + 28; const s = sl.s;
      ctx.font = `600 14px ${fM}`; ctx.fillStyle = P.ink;
      if (s && !sl.support) {
        const r = clamp(num(s.rarity) || 0, 0, 5);
        ctx.fillText(`Lv ${s.level ?? "—"}`, x + 12, ty);
        ctx.fillStyle = P.gold; ctx.font = `600 12px ${fB}`; ctx.textAlign = "right"; ctx.fillText("★".repeat(r), x + cw - 12, ty); ctx.textAlign = "left";
        ty += 22; ctx.font = `500 13px ${fM}`; ctx.fillStyle = P.muted;
        const sk = (s.skills || []).map((v) => typeof v === "number" ? v : "–").join("/");
        ctx.fillText(fitText(ctx, `${s.npLevel ? "NP" + s.npLevel : "NP–"}  ·  ${sk || "–/–/–"}`, cw - 24), x + 12, ty);
        ty += 20; ctx.fillStyle = s.npCard && P[s.npCard] ? P[s.npCard] : P.muted; ctx.font = `600 12px ${fB}`;
        ctx.fillText(fitText(ctx, [s.npCard, s.npTarget].filter(Boolean).join(" · ") || s.cls || "", cw - 24), x + 12, ty);
      } else {
        ctx.fillStyle = P.muted; ctx.font = `500 13px ${fB}`;
        ctx.fillText(fitText(ctx, sl.support ? ((sl.g && sl.g.cls) || (s && s.cls) || "Friend's servant") : "Not in the roster", cw - 24), x + 12, ty);
        ty += 42;
      }
      // the Craft Essence
      const cy = y + ah + 150 - 46;
      ctx.save(); rr(ctx, x + 8, cy, cw - 16, 38, 9); ctx.fillStyle = P.sunken; ctx.fill(); ctx.restore();
      const ci = useRemote ? ceImgs[i] : null;
      if (ci) { ctx.save(); rr(ctx, x + 12, cy + 4, 30, 30, 6); ctx.clip(); drawCover(ctx, ci, x + 12, cy + 4, 30, 30); ctx.restore(); }
      ctx.fillStyle = sl.ce ? P.ink : P.muted; ctx.font = `${sl.ce ? 600 : 500} 12px ${fB}`;
      const cl = wrapText(ctx, sl.ce || "No Craft Essence", cw - (ci ? 58 : 32), 2);
      cl.forEach((l, j) => ctx.fillText(l, x + (ci ? 48 : 16), cy + (cl.length === 1 ? 23 : 16 + j * 14)));
    });
    // totals, the strategy and the date
    const own = slots.filter((sl) => sl.s && !sl.support).map((sl) => sl.s);
    const sum = (k) => own.reduce((a, s) => a + (total(s, k) || 0), 0), cost = own.reduce((a, s) => a + (COST[clamp(num(s.rarity) || 0, 0, 5)] || 0), 0);
    const fy = top + ah + 150 + 46;
    ctx.fillStyle = P.line; ctx.fillRect(48, fy - 22, W - 96, 1);
    const stat = (label, v, x) => { ctx.fillStyle = P.muted; ctx.font = `500 12px ${fM}`; ctx.fillText(label, x, fy); ctx.fillStyle = P.ink; ctx.font = `700 22px ${fM}`; ctx.fillText(v, x, fy + 26); };
    stat("TOTAL ATK", fmt(sum("atk")), 48); stat("TOTAL HP", fmt(sum("hp")), 220); stat("COST", String(cost), 392);
    if (p.strategy) { ctx.fillStyle = P.ink; ctx.font = `500 15px ${fB}`; wrapText(ctx, p.strategy, W - 96 - 470, 3).forEach((l, j) => ctx.fillText(l, 520, fy + 4 + j * 20)); }
    ctx.fillStyle = P.muted; ctx.font = `500 12px ${fM}`; ctx.textAlign = "right";
    ctx.fillText(new Date().toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"}) + "  ·  Fate/Grand Index", W - 48, H - 24); ctx.textAlign = "left";
    return cv;
  };
  const toBlob = (cv) => new Promise((res, rej) => { try { cv.toBlob((b) => b ? res(b) : rej(new Error("no blob")), "image/png"); } catch (e) { rej(e); } });
  try { return {blob: await toBlob(draw(true)), plain: PIMG.missed > 0}; }
  catch (e) { return {blob: await toBlob(draw(false)), plain: true}; } // a picture without CORS made the canvas unreadable
}
async function pimgOpen(id) {
  const p = S.parties.find((x) => x.id === id); if (!p) return;
  PIMG.party = p; PIMG.theme = PIMG.theme || (isDark() ? "dark" : "light");
  if (typeof pimgDlg.showModal === "function") { if (!pimgDlg.open) pimgDlg.showModal(); } else pimgDlg.setAttribute("open", "");
  const share = pimgDlg.querySelector('[data-action="pimg-share"]');
  share.hidden = !(navigator.canShare && navigator.share && (() => { try { return navigator.canShare({files: [new File([""], "x.png", {type: "image/png"})]}); } catch (e) { return false; } })());
  await pimgRender();
}
async function pimgRender() {
  const p = PIMG.party; if (!p || PIMG.busy) return;
  PIMG.busy = true;
  const img = document.getElementById("pimg-img"), wait = document.getElementById("pimg-wait"), msg = document.getElementById("pimg-msg");
  wait.hidden = false; img.classList.add("dim"); msg.textContent = "";
  pimgDlg.querySelectorAll('[data-action="pimg-theme"]').forEach((b) => { const on = b.dataset.v === PIMG.theme; b.classList.toggle("primary", on); b.setAttribute("aria-pressed", String(on)); });
  try {
    const r = await pimgDraw(p, PIMG.theme);
    if (PIMG.url) URL.revokeObjectURL(PIMG.url);
    PIMG.blob = r.blob; PIMG.url = URL.createObjectURL(r.blob); img.src = PIMG.url; img.alt = "Picture of the party " + (p.name || "");
    if (r.plain) msg.textContent = "Some art couldn't be loaded into the picture (offline, or its site doesn't allow it), so class emblems stand in for it.";
  } catch (e) { msg.textContent = "Couldn't draw the picture in this browser."; }
  finally { wait.hidden = true; img.classList.remove("dim"); PIMG.busy = false; }
}
const pimgName = () => "party-" + (nname(PIMG.party && PIMG.party.name || "party").replace(/ /g, "-") || "party") + ".png";
document.addEventListener("click", async (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action;
  if (a === "party-img") { pimgOpen(b.dataset.id); return; }
  if (!/^pimg-/.test(a)) return;
  const msg = document.getElementById("pimg-msg");
  if (a === "pimg-close") { pimgDlg.close ? pimgDlg.close() : pimgDlg.removeAttribute("open"); return; }
  if (a === "pimg-theme") { PIMG.theme = b.dataset.v; pimgRender(); return; }
  if (!PIMG.blob) return;
  if (a === "pimg-save") { await localDownloads.save({filename: pimgName(), data: PIMG.blob}); msg.textContent = "Saved to your downloads as " + pimgName() + "."; return; }
  if (a === "pimg-copy") {
    try { await navigator.clipboard.write([new ClipboardItem({"image/png": PIMG.blob})]); msg.textContent = "Copied. Paste it into a chat or post."; }
    catch (err) { msg.textContent = "This browser won't copy pictures. Use Save PNG instead."; }
    return;
  }
  if (a === "pimg-share") {
    try { await navigator.share({files: [new File([PIMG.blob], pimgName(), {type: "image/png"})], title: PIMG.party ? PIMG.party.name : "Party"}); }
    catch (err) { if (err && err.name !== "AbortError") msg.textContent = "Sharing didn't work here. Use Save PNG instead."; }
  }
});
pimgDlg.addEventListener("close", () => { PIMG.party = null; });
