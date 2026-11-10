/* ================= 0.52.0-beta: the summoning, rebuilt as a rite =================
   The old ceremony (three rings, a pillar, the back sliding off) was over in five seconds and looked the same for
   everyone. Now the summoning field is built one layer at a time, one layer for each star, and each layer lights a
   star under the card:

   - every summon starts the same: three layers in white light. A ★3 stops there (silver, and quick).
   - a fourth layer turns the whole field gold: a ★4. Four gold layers.
   - a fifth turns it rainbow: a ★5 servant. Five rainbow layers. (A ★5 Craft Essence gets five gold ones.)
   - the light gathers into a pillar and the card rises out of it, back first, then turns over to show its class
     on the palette that covers it;
   - the palette sinks down the card, slowly, and uncovers the picture from the top: rainbow for ★5, gold for ★4.
   Servants take their time (about 13 s for a ★5, 9 s for a ★4); Craft Essences and ★3 are quick. Skip and Escape
   jump to the uncovered card, as before, and reduced motion shows it at once.

   Every layer is a still drawing that's only turned, moved or faded (no canvas, no blur). The rings go round the
   card: each one is drawn twice, the far half behind the card and the near half in front of it. */
const S3_SIZE = [1, 0.93, 0.86, 0.79, 0.72];
const S3_GRAD = {
  n: [["0", "#ffffff"], [".35", "#b9c8e6"], [".7", "#f2f6ff"], ["1", "#93a4c8"]],
  g: SM_GRAD.gold, r: SM_GRAD.rainbow};
function s3RingSVG(i, tone) {
  const st = `stroke="url(#s3${tone})" fill="none"`, f = (v) => v.toFixed(1);
  const pts = (n, r, rot) => Array.from({length: n}, (_, k) => { const a = (rot + k * 360 / n - 90) * Math.PI / 180; return f(Math.cos(a) * r) + "," + f(Math.sin(a) * r); }).join(" ");
  const glow = (r, w) => `<circle r="${r}" ${st} stroke-width="${w}" opacity=".2"/>`;
  let body;
  if (i === 0) {
    let ticks = ""; for (let k = 0; k < 36; k++) { const a = k * 10 * Math.PI / 180, r1 = k % 3 ? 81 : 78; ticks += `M${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1)}L${f(Math.cos(a) * 85)} ${f(Math.sin(a) * 85)}`; }
    body = `${glow(95, 8)}<circle r="95" ${st} stroke-width="1.8"/><circle r="89.5" ${st} stroke-width="4.5" stroke-dasharray="1.3 4.4"/><path d="${ticks}" ${st} stroke-width=".9"/><circle r="76" ${st} stroke-width=".9"/>`;
  } else if (i === 1) {
    body = `${glow(93, 6)}<circle r="93" ${st} stroke-width="1.3"/><polygon points="${pts(3, 93, 0)}" ${st} stroke-width="1.5"/><polygon points="${pts(3, 93, 60)}" ${st} stroke-width="1.5"/><circle r="46.5" ${st} stroke-width=".9"/>`;
  } else if (i === 2) {
    const nodes = Array.from({length: 12}, (_, k) => { const a = k * 30 * Math.PI / 180; return `<circle cx="${f(Math.cos(a) * 92)}" cy="${f(Math.sin(a) * 92)}" r="4.6" ${st} stroke-width="1.3"/>`; }).join("");
    body = `${glow(92, 6)}<circle r="92" ${st} stroke-width="1.5"/>${nodes}<circle r="80" ${st} stroke-width="1.4" stroke-dasharray="9 5"/>`;
  } else if (i === 3) {
    body = `${glow(93, 6)}<circle r="93" ${st} stroke-width="1.5"/><polygon points="${pts(4, 93, 0)}" ${st} stroke-width="1.4"/><polygon points="${pts(4, 93, 45)}" ${st} stroke-width="1.4"/><circle r="65.8" ${st} stroke-width="1"/>`;
  } else {
    body = `${glow(92, 9)}<circle r="92" ${st} stroke-width="2.4"/><polygon points="${pts(5, 92, 0)}" ${st} stroke-width="1.2"/><polygon points="${Array.from({length: 5}, (_, k) => { const a = (k * 144 - 90) * Math.PI / 180; return f(Math.cos(a) * 92) + "," + f(Math.sin(a) * 92); }).join(" ")}" ${st} stroke-width="1.4"/><circle r="84" ${st} stroke-width=".8" stroke-dasharray="2 5"/>`;
  }
  return `<svg class="${tone}" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">${body}</svg>`;
}
// one half of the field: the far halves of the rings (behind the card) or the near halves (in front of it)
function s3FieldHTML(side, n, tones) {
  let h = "";
  for (let i = 0; i < n; i++) {
    h += `<div class="s3-layer l${i + 1}" style="--i:${i};--sz:${S3_SIZE[i]}">${side === "back" ? `<i class="s3-pulse"></i>` : ""}
      <div class="s3-half"><div class="s3-full"><div class="s3-ign"><div class="s3-surge"><div class="s3-spin">${tones.map((t) => s3RingSVG(i, t)).join("")}</div></div></div></div></div></div>`;
  }
  return `<div class="s3-field ${side}" aria-hidden="true">${h}</div>`;
}
const s3Defs = () => `<svg class="s3-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${Object.keys(S3_GRAD).map((k) =>
  `<linearGradient id="s3${k}" x1="0" y1="0" x2="1" y2="1">${S3_GRAD[k].map((s) => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join("")}</linearGradient>`).join("")}</defs></svg>`;
// when each part of the rite starts (ms, before the speed factor): [[time, classes], …] and the moment it's over.
// A ★3 has no pillar and no long look at its class: three layers, the card, the picture.
function s3Plan(n, tier, servant) {
  const T = [], big = n >= 4; let t = 450;
  for (let i = 1; i <= Math.min(n, 3); i++) { T.push([t, "l" + i]); t += 650; }
  if (n >= 4) { t += 250; T.push([t, "l4 t4 fl"]); t += n >= 5 ? 1200 : 950; }
  if (n >= 5) { T.push([t, tier === "rainbow" ? "l5 t5 fl2" : "l5 fl2"]); t += 1150; }
  if (big) { T.push([t, "gather"]); t += 750; T.push([t, "card"]); t += 1250; }
  else { T.push([t, "gather card"]); t += 950; }
  T.push([t, "flip"]); t += servant ? (big ? 1900 : 1000) : (big ? 1000 : 600);
  const uv = tier === "rainbow" ? 3600 : tier === "gold" ? 2900 : 1500;
  T.push([t, "unveil"]); t += uv + 150;
  T.push([t, "lit hss"]); t += big ? 850 : 600;
  T.push([t, "info end"]);
  return {steps: T, end: t, uv: uv};
}
// servants take their time; Craft Essences and ★3 are quick
const s3Speed = (tier, servant) => servant ? (tier === "rainbow" ? 1 : tier === "gold" ? 0.9 : 0.5) : (tier === "silver" ? 0.4 : 0.45);
playSummon = function (who) {
  return new Promise((resolve) => {
    const ov = document.getElementById("summon"); if (!ov) { resolve(); return; }
    const it = smItemOf(who), r = it.r, tier = smTierOf(it.k, r), servant = it.k !== "c", n = tier === "none" ? 0 : clamp(r, 3, 5);
    const still = RM.matches || tier === "none";
    const K = s3Speed(tier, servant);
    const plan = s3Plan(n, tier, servant);
    const hss = servant ? "Heroic Spirit Summoned" : "Craft Essence";
    const letters = hss.split("").map((ch, i) => ch === " " ? `<span class="sp"> </span>` : `<span style="--i:${i}">${esc(ch)}</span>`).join("");
    const tones = tier === "rainbow" ? ["n", "g", "r"] : tier === "gold" ? ["n", "g"] : ["n"];
    const cls = servant ? String(it.sub || "") : "Craft Essence";
    const front = it.art ? `<img class="s3-art s2-art${servant ? "" : " ce"}" src="${esc(it.art)}" alt="">` : it.mark ? `<img class="s3-art s2-art mark" src="${it.mark}" alt="">` : `<span class="s2-q">?</span>`;
    const orbs = n >= 4 ? Array.from({length: 12}, (_, i) => `<i style="--x:${(Math.sin(i * 2.39) * 1).toFixed(2)};--y:${(Math.cos(i * 2.39) * 1).toFixed(2)};--dl:${(i * 0.09).toFixed(2)}s;--sz:${5 + (i * 7) % 6}px"></i>`).join("") : "";
    const stars = n ? Array.from({length: 5}, (_, i) => `<i><b class="o">☆</b>${i < r ? `<b class="f">★</b>` : ""}</i>`).join("") : Array.from({length: r}, () => `<i><b class="f">★</b></i>`).join("");
    ov.innerHTML = `${s3Defs()}<div class="s3-bg" aria-hidden="true"><i class="g"></i><i class="r"></i></div>
      <i class="s3-flash" aria-hidden="true"></i>
      <div class="sm-stage s3-stage">
        <div class="s3-wrap" aria-hidden="true">
          ${n ? s3FieldHTML("back", n, tones) : ""}
          ${n >= 4 ? `<i class="s3-pillar"></i>` : ""}
          ${orbs ? `<div class="s3-orbs">${orbs}</div>` : ""}
          <div class="s3-card"><div class="s3-flipper">
            <div class="s3-side back"><img src="${backOf(it.k, r)}" alt=""></div>
            <div class="s3-side face">${front}<div class="s2-plate">${it.logo ? `<img src="${it.logo}" alt="">` : ""}<span>${"★".repeat(r)}</span></div>
              <div class="s3-veil"><i class="pal"></i><i class="sheen"></i><i class="line"></i></div>
              <div class="s3-crest">${servant && it.mark ? `<i class="s3-emb" style="--m:url('${it.mark}')"></i>` : `<i class="s3-emb gem"></i>`}<span class="s3-cls">${esc(cls)}</span></div>
            </div>
          </div></div>
          ${n ? s3FieldHTML("front", n, tones) : ""}
          ${r >= 3 ? `<i class="sm-halo"></i><i class="sm-edge"><b></b></i>` : ""}
        </div>
        <p class="s3-stars" aria-hidden="true">${stars}</p>
        <div class="sm-info" role="status" aria-live="polite"><p class="sm-hss"><span class="vh">${hss}</span><span class="sm-hss-l" aria-hidden="true">${letters}</span></p><h2>${nmHTML(it)}</h2><p class="sm-sub">${esc(it.sub || "")}${r ? " · " + "★".repeat(r) : ""}</p><button type="button" class="btn sm sm-done">Done</button></div>
      </div>
      <button type="button" class="btn ghost sm sm-skip">Skip</button>`;
    ov.dataset.tier = tier === "rainbow" ? "gold5" : tier === "none" ? "bronze" : tier; ov.dataset.look = tier; ov.dataset.k = it.k; ov.dataset.layers = String(n);
    ov.dataset.speed = tier === "none" ? "none" : tier === "silver" ? "brisk" : tier === "gold" ? "gold" : "full";
    ov.style.setProperty("--k", K); ov.style.setProperty("--uv", plan.uv + "ms");
    ov.className = "summon s3"; ov.hidden = false;
    const shell = document.querySelector(".shell"); if (shell) shell.inert = true;
    const timers = []; let done = false, ended = false;
    const fin = "now go " + Array.from({length: n}, (_, i) => "l" + (i + 1)).join(" ") + (tier === "gold" || tier === "rainbow" ? " t4" : "") + (tier === "rainbow" ? " t5" : "") + " gather card flip unveil lit hss info end";
    const reveal = () => { timers.forEach(clearTimeout); ov.classList.remove("fl", "fl2"); ov.classList.add(...fin.split(" ").filter(Boolean)); const b = ov.querySelector(".sm-done"); if (b) b.focus(); ended = true; };
    const close = () => {
      if (done) return; done = true; timers.forEach(clearTimeout); document.removeEventListener("keydown", onKey, true);
      if (shell) shell.inert = false;
      ov.classList.add("out");
      setTimeout(() => { ov.hidden = true; ov.innerHTML = ""; ov.className = "summon"; delete ov.dataset.look; delete ov.dataset.layers; ov.style.removeProperty("--uv"); resolve(); }, 300);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (ended) close(); else reveal(); } };
    document.addEventListener("keydown", onKey, true);
    ov.querySelector(".sm-skip").addEventListener("click", () => { if (ended) close(); else reveal(); });
    ov.querySelector(".sm-done").addEventListener("click", close);
    ov.addEventListener("click", (e) => { if (ended && (e.target === ov || e.target.classList.contains("s3-bg"))) close(); });
    if (still) { reveal(); return; }
    ov.querySelector(".sm-skip").focus({preventScroll: true});
    requestAnimationFrame(() => ov.classList.add("go"));
    plan.steps.forEach(([ms, c]) => timers.push(setTimeout(() => ov.classList.add(...c.split(" ")), Math.round(ms * K))));
    timers.push(setTimeout(() => { ended = true; const b = ov.querySelector(".sm-done"); if (b) b.focus({preventScroll: true}); }, Math.round(plan.end * K)));
  });
};
// for the tests: how long each kind of summon takes, in seconds
window.__fgiSummon = {plan: (r, k) => { const tier = smTierOf(k || "s", r), servant = (k || "s") !== "c", n = tier === "none" ? 0 : clamp(r, 3, 5);
  return {tier: tier, layers: n, seconds: tier === "none" ? 0 : s3Plan(n, tier, servant).end * s3Speed(tier, servant) / 1000}; }};
