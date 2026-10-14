# 0.18.0 styles: the smooth glare (its stops computed here so the light falls off without visible rings),
# the costume remove button and the sparkle tile for well-grailed servants
import base64, io, math, colorsys, sys
import numpy as np
from PIL import Image
sp = sys.argv[1]

# ---- a tileable sparkle texture: a few four-point glints with soft cores ----
T = 176; rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:T, 0:T].astype(float)
acc = np.zeros((T, T))
pts = [(22, 30, 9), (98, 18, 5), (150, 70, 11), (60, 96, 6), (120, 132, 8), (30, 150, 5), (168, 160, 4), (84, 60, 3.5), (140, 22, 3)]
for (x0, y0, s) in pts:
    for ox in (-T, 0, T):
        for oy in (-T, 0, T):
            dx = xx - (x0 + ox); dy = yy - (y0 + oy)
            core = np.exp(-(dx ** 2 + dy ** 2) / (2 * (s * .32) ** 2))
            arm = np.exp(-np.abs(dx) / (s * .55)) * np.exp(-(dy ** 2) / (2 * (s * .09) ** 2)) + np.exp(-np.abs(dy) / (s * .55)) * np.exp(-(dx ** 2) / (2 * (s * .09) ** 2))
            acc = np.maximum(acc, np.clip(core * 1.0 + arm * .85, 0, 1))
a = np.clip(acc, 0, 1)
a = a + (rng.random(a.shape) - .5) / 255.0  # dither so the soft edges don't step
img = np.dstack([np.full((T, T), 255), np.full((T, T), 255), np.full((T, T), 250), np.clip(a * 255, 0, 255)]).astype("uint8")
bio = io.BytesIO(); Image.fromarray(img, "RGBA").save(bio, "PNG", optimize=True)
spark = "data:image/png;base64," + base64.b64encode(bio.getvalue()).decode()
print("sparkle tile bytes", len(bio.getvalue()))

def f(x): return ("%.3f" % x).rstrip("0").rstrip(".") if x else "0"
# ---- the light spot: a gaussian fall-off in many small steps, no kinks ----
spot = []
for i in range(0, 13):
    t = i * .06
    v = math.exp(-(t / .3) ** 2)
    spot.append(f"rgba(255,255,255,calc(var(--sh-spot) * {f(v)})) {f(t * 100)}%")
spot.append("rgba(255,255,255,0) 78%")
SPOT = "radial-gradient(115% 85% at var(--mx, 50%) var(--my, 30%), " + ", ".join(spot) + ")"
# ---- the holo band: hues run on without seams, under a soft bell-shaped envelope ----
holo = ["rgba(255,255,255,0) 0%"]
N = 28
for i in range(N + 1):
    p = 22 + 56 * i / N                       # band across 22%..78% of the (oversized) layer
    env = math.exp(-((p - 50) / 16) ** 2)
    h = (0.92 + 1.15 * i / N) % 1.0          # pink → violet → cyan → green → gold → pink
    r, g, b = colorsys.hls_to_rgb(h, .62, .95)
    holo.append(f"rgba({int(r*255)},{int(g*255)},{int(b*255)},{f(.8 * env)}) {f(p)}%")
holo.append("rgba(255,255,255,0) 100%")
HOLO = "linear-gradient(118deg, " + ", ".join(holo) + ")"
bo = []
for i in range(0, 12):
    t = i * .06
    bo.append(f"rgba(255,248,232,calc(var(--sh-boost) * {f(math.exp(-(t / .26) ** 2))})) {f(t * 100)}%")
bo.append("rgba(255,248,232,0) 72%")
BOOST = "radial-gradient(100% 75% at var(--mx, 50%) var(--my, 30%), " + ", ".join(bo) + ")"
gm = []
for i in range(0, 12):
    t = i * .08
    gm.append(f"rgba(0,0,0,{f(math.exp(-(t / .42) ** 2))}) {f(t * 100)}%")
gm.append("transparent 96%")
GMASK = "radial-gradient(60% 45% at var(--mx, 50%) var(--my, 30%), " + ", ".join(gm) + ")"

css = f"""
/* ===== 0.18.0 ===== */
/* ---------- the picture's glare: one smooth light, and on grailed servants a holo sheen and glints that grow with grails ---------- */
.art-frame, .pcd-frame {{ --sh-spot: .62; --sh-holo: .1; --sh-glint: 0; --sh-boost: 0; --sh-glow: 0; }}
.art-frame[data-shine="1"] {{ --sh-spot: .7; --sh-holo: .22; --sh-glint: 0; --sh-boost: .07; --sh-glow: .35; }}
.art-frame[data-shine="2"] {{ --sh-spot: .78; --sh-holo: .34; --sh-glint: .5; --sh-boost: .12; --sh-glow: .55; }}
.art-frame[data-shine="3"] {{ --sh-spot: .86; --sh-holo: .46; --sh-glint: .75; --sh-boost: .18; --sh-glow: .75; }}
.art-frame[data-shine="4"] {{ --sh-spot: .95; --sh-holo: .6; --sh-glint: 1; --sh-boost: .26; --sh-glow: 1; }}
/* the light itself lifts the picture's own colours (soft light) */
.art-glare {{ mix-blend-mode: soft-light; background: {SPOT}; }}
/* the sheen adds light on top (screen), so it shows on dark and bright pictures alike */
.art-sheen {{ position: absolute; inset: 0; z-index: 2; pointer-events: none; border-radius: inherit; opacity: 0; transition: opacity .35s ease; mix-blend-mode: screen;
  background: {BOOST}; }}
.glare-on > .art-sheen {{ opacity: 1; }}
.art-sheen::before, .art-sheen::after {{ content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }}
.art-sheen::before {{ opacity: var(--sh-holo); background: {HOLO};
  background-size: 300% 300%; background-position: calc(100% - var(--mx, 50%)) calc(100% - var(--my, 50%)); }}
/* glints catch the light only around the pointer, and drift a little against it */
.art-sheen::after {{ opacity: var(--sh-glint); background: url("{spark}") calc(var(--mx, 50%) * -.35) calc(var(--my, 50%) * -.35) / 176px 176px repeat;
  -webkit-mask-image: {GMASK}; mask-image: {GMASK}; }}
@media (prefers-reduced-motion: reduce) {{ .art-sheen {{ display: none; }} }}
.art-frame.glare-on, .pcd-frame.glare-on {{ box-shadow: 0 0 0 1px color-mix(in srgb, var(--p2, #fff) 60%, transparent), 0 10px 34px -8px color-mix(in srgb, var(--p2, #888) 80%, transparent),
  0 0 calc(30px * var(--sh-glow)) calc(2px * var(--sh-glow)) color-mix(in srgb, var(--gold, #d4a640) calc(70% * var(--sh-glow)), transparent); }}
.art-frame[data-shine="4"].glare-on {{ box-shadow: 0 0 0 1px color-mix(in srgb, var(--gold, #d4a640) 80%, #fff), 0 10px 34px -8px color-mix(in srgb, var(--p2, #888) 80%, transparent),
  0 0 34px 3px color-mix(in srgb, var(--gold, #d4a640) 75%, transparent), 0 0 70px 8px color-mix(in srgb, var(--p2, #d4a640) 30%, transparent); }}

/* ---------- costume slots can be removed ---------- */
.cos-cell {{ position: relative; display: grid; min-width: 0; }}
.cos-cell > .stage-btn {{ min-width: 0; }}
.cos-x {{ position: absolute; top: -7px; right: -7px; z-index: 2; width: 24px; height: 24px; padding: 0; display: grid; place-items: center; border-radius: 50%;
  border: 1px solid var(--line); background: var(--panel); color: var(--ink); font-size: 15px; line-height: 1; cursor: pointer; opacity: .82;
  box-shadow: 0 3px 8px -3px rgba(0,0,0,.4); transition: opacity .15s ease, transform .15s ease; }}
.cos-cell:hover .cos-x, .cos-x:focus-visible {{ opacity: 1; }}
.cos-x:hover {{ transform: scale(1.08); border-color: var(--muted); }}
.cos-x:focus-visible {{ outline: 2px solid var(--focus); outline-offset: 2px; }}
@media (hover: none) {{ .cos-x {{ opacity: 1; width: 28px; height: 28px; top: -9px; right: -9px; }} }}
/* a toast may use the whole width of a phone; with buttons, they wrap under the message */
#toast {{ width: max-content; }}
#toast.has-btn {{ flex-wrap: wrap; justify-content: center; column-gap: 14px; row-gap: 0; }}
@media (max-width: 600px) {{ #toast {{ border-radius: 18px; text-align: center; }} }}
"""
open(f"{sp}/css_v19.css", "w").write(css)
print("css bytes", len(css))
