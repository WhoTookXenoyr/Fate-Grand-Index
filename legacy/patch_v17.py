import sys
sp = sys.argv[1]
src = open(f"{sp}/spirit-origin-list.html").read()
rd = lambda n: open(f"{sp}/{n}").read()
def rep(old, new, count=1):
    global src
    c = src.count(old)
    if c != count: raise SystemExit(f"expected {count} got {c}: {old[:120]!r}")
    src = src.replace(old, new)

rep("</style>", rd("css_v17.css") + "</style>")

# ---- the layout switch, next to light / dark
rep('''      <button id="theme-tgl" class="theme-tgl"''', '''      <button id="layout-tgl" class="lay-tgl" type="button" data-action="layout" aria-pressed="false" title="Servant page layout: Modern. Press for Compact"><svg viewBox="0 0 40 20" width="34" height="17" aria-hidden="true" focusable="false"><g class="lt-m"><rect x="1" y="1" width="16" height="18" rx="3"/><rect x="21" y="1" width="18" height="5" rx="2"/><rect x="21" y="8" width="18" height="5" rx="2"/><rect x="21" y="15" width="18" height="4" rx="2"/></g></svg><b>Modern</b></button>
      <button id="theme-tgl" class="theme-tgl"''')

# ---- stars: 4★ beige, 5★ a deeper gold; Foreigner stars follow the rarity like everyone else
rep('''const STAR_COL = {5: [246, 204, 82], 4: [222, 228, 236], 3: [214, 156, 98], 2: [196, 196, 196], 1: [196, 196, 196]};''',
    '''const STAR_COL = {5: [255, 196, 40], 4: [230, 208, 162], 3: [214, 156, 98], 2: [196, 196, 196], 1: [196, 196, 196]};''')
rep('''beast: s.cls === "Beast", foreign: s.cls === "Foreigner", extra: EXTRA_ACC[s.cls] || null};''',
    '''beast: s.cls === "Beast", foreign: s.cls === "Foreigner", pret: s.cls === "Pretender", extra: EXTRA_ACC[s.cls] || null};''')
# Pretender takes its colour from the picture, not a fixed green
rep('''  const ACC = p.extra ? (p.beast ? hslToRgb(hue / 360, 0.9, LT ? 0.45 : 0.62) : (LT ? mixC(p.extra, [0, 0, 0], 0.25) : p.extra)) : null;''',
    '''  const XA = p.pret ? EXTRA_ACC.Pretender : p.extra;
  const ACC = XA ? (p.beast ? hslToRgb(hue / 360, 0.9, LT ? 0.45 : 0.62) : (LT ? mixC(XA, [0, 0, 0], 0.25) : XA)) : null;''')
rep('''  const pal = ACC && !p.beast && !p.foreign ? F.pal.map''', '''  const pal = ACC && !p.beast && !p.foreign && !p.pret ? F.pal.map''')
rep('''      c.fillStyle = p.beast ? "hsla(" + ((hue + q.i * 72) % 360) + (LT ? ",85%,50%," : ",85%,65%,") + a.toFixed(3) + ")" : p.foreign ? rgba(FC[q.i % 2], a) : rgba(STAR_COL[p.rarity] || STAR_COL[1], a + (LT ? 0.15 : 0));''',
    '''      c.fillStyle = starLook(p, F, q.i, hue, t, LT).fill(a + (LT ? 0.15 : 0));''')
rep('''      if (p.beast) { c.shadowColor = "hsla(" + ((hue + i * 72) % 360) + ",90%,60%,0.9)"; c.fillStyle = "hsla(" + ((hue + i * 72) % 360) + ",90%,64%," + (0.75 + 0.25 * tw).toFixed(3) + ")"; }
      else if (p.foreign) { const g = c.createLinearGradient(x - R, y - R, x + R, y + R); g.addColorStop(0, rgba(FC[0], 0.95)); g.addColorStop(1, rgba(FC[1], 0.95)); c.fillStyle = g; c.shadowColor = rgba(FC[i % 2], 0.95); }
      else { const cc = STAR_COL[N] || STAR_COL[1]; c.shadowColor = ACC ? rgba(ACC, 0.95) : rgba(cc, 0.9); c.fillStyle = rgba(cc, 0.7 + 0.3 * tw); }
      starPath(c, x, y, R * (0.92 + 0.08 * tw), Math.sin(t * 0.6 + i) * 0.08); c.fill();''',
    '''      const SL = starLook(p, F, i, hue, t, false); c.shadowColor = SL.glow; c.fillStyle = SL.fill(0.7 + 0.3 * tw); c.shadowBlur = 14 * tw * SL.blur;
      starPath(c, x, y, R * (0.92 + 0.08 * tw) * SL.scale, Math.sin(t * 0.6 + i) * 0.08); c.fill();''')
rep('''  const x = s ? (EXTRA_ACC[s.cls] || null) : null, pal = x ? raw.map(vividHex) : raw;''',
    '''  const x = s ? extraAccOf(s, raw) : null, pal = x ? raw.map(vividHex) : raw;''', 2)

# ---- Bond, next to level and NP
rep('''      <div class="steps two">
        ${stepper("Level", "level", esc(s.level ?? "—"), st ? `<span class="status ${st.kind}">${st.text}</span>` : "")}
        ${stepper("NP level", "np", s.npLevel ? "NP" + esc(s.npLevel) : "—", s.npLevel ? "" : `<span class="status">Not set</span>`)}
      </div>''', '''      <div class="steps three lv-row">
        ${stepper("Level", "level", esc(s.level ?? "—"), st ? `<span class="status ${st.kind}">${st.text}</span>` : "")}
        ${stepper("NP level", "np", s.npLevel ? "NP" + esc(s.npLevel) : "—", s.npLevel ? "" : `<span class="status">Not set</span>`)}
        ${stepper("Bond", "bond", esc(num(s.bond) || 0), bondNote(s))}
      </div>''')

# ---- the NP table: base damage from the card; a value that's the same at every NP level gets no row
rep('''  const showNp = ed || V.rows.length > 0;''', '''  const showNp = ed || V.rows.some((r) => !npFlat(r));''')
rep('''  const base = ed ? `<span>Base Damage: x</span>${cell("f:base", V.base, "1.0")}` :''',
    '''  const base = CARD_MULT[card] ? `<span>Base Damage: x${CARD_MULT[card]}</span>${ed ? `<small class="npt-auto">from the ${esc(card)} card</small>` : ""}` : ed ? `<span>Base Damage: x</span>${cell("f:base", V.base, "1.0")}` :''')
rep('''${V.rows.map((r, ri) => rowHTML(r, ri, "r")).join("")}''', '''${V.rows.map((r, ri) => ed || !npFlat(r) ? rowHTML(r, ri, "r") : "").join("")}''')

# ---- the top tier is called EX (stored as SS, so placements you made stay put)
rep('''aria-label="Tier ${t.k}, score ${range}"><div class="tier-lab"><b>${t.k}</b>''', '''aria-label="Tier ${tierName(t.k)}, score ${range}"><div class="tier-lab"><b>${tierName(t.k)}</b>''')
rep('''Score ranges: SS 75+, S 62–75''', '''Score ranges: EX 75+, S 62–75''')
rep('''<small>Score ${r.sc.total.toFixed(1)} · by score: ${auto}</small>''', '''<small>Score ${r.sc.total.toFixed(1)} · by score: ${tierName(auto)}</small>''')
rep('''data-k="${t.k}">${t.k}</button>''', '''data-k="${t.k}">${tierName(t.k)}</button>''')
rep('''Back to automatic (${auto})''', '''Back to automatic (${tierName(auto)})''')
rep('''toast(s.name + " is in " + k + (k === autoTier(r.sc.total) ? " (where the score puts them)." : ". Their score puts them in " + autoTier(r.sc.total) + "."));''',
    '''toast(s.name + " is in " + tierName(k) + (k === autoTier(r.sc.total) ? " (where the score puts them)." : ". Their score puts them in " + tierName(autoTier(r.sc.total)) + "."));''')
rep('''toast(k ? s.name + " moved to " + k + "." : s.name + " is back in " + autoTier(r.sc.total) + ", where the score puts them."); return;''',
    '''toast(k ? s.name + " moved to " + tierName(k) + "." : s.name + " is back in " + tierName(autoTier(r.sc.total)) + ", where the score puts them."); return;''')

js = rd("v17.js")
for k in ("s3", "s4", "c3", "c4", "c5"): js = js.replace(f"__CB_{k.upper()}__", rd(f"up17/cb_{k}.b64").strip())
rep("\ninitFonts();\ninit();\n", "\n" + js + "\n\ninitFonts();\ninit();\n")
open(f"{sp}/spirit-origin-list.html", "w").write(src)
print("patched 0.16.0", len(src))
