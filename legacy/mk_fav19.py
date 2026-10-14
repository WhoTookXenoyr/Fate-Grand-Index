# Draws the Fate/Grand Index diamond on its own, traced from Noyr's logo, and builds favicon.ico
import io, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

CX, CY, SIDE = 173.5, 264, 540           # square window around the emblem, in logo pixels (logo crop starting at x=270)
T = dict(cx=171, cy=197); B = dict(cx=176, cy=333)
W, H, WI, HI = 156, 187, 110, 131        # outer / inner half sizes of each rhombus band

def rh(c, w, h): return [(c["cx"], c["cy"] - h), (c["cx"] + w, c["cy"]), (c["cx"], c["cy"] + h), (c["cx"] - w, c["cy"])]
O = lambda y: T["cx"] + W / H * (y - (T["cy"] - H))        # T's outer upper-right edge
I = lambda y: T["cx"] + WI / HI * (y - (T["cy"] - HI))     # T's inner upper-right edge
# the upper chevron's right arm breaks: a hook along its inner edge, then the arm restarts lower down,
# set a little inward, with a spike at its top and a bar that joins it to the lower diamond
REM = [(196, -10), (194, 35), (191.5, 40), (190.5, 45), (190.5, 57), (192, 63), (193, 68), (214, 103), (209, 110), (205, 114),
       (264, 217.2), (315.5, 211.4), (360, 211.4), (360, -10)]
ARM = [(251.1, 134.9), (315.5, 211.4), (313.2, 213.5), (262.3, 219.3), (222.6, 167.8)]
SPIKE = [(266.6, 117), (276.6, 117), (256, 140.7), (251.1, 134.9)]
BAR = [(222.6, 167.8), (207, 185.3), (205, 190), (214.2, 193.6), (229.4, 176)]
STOPS = [(0, (228, 222, 198)), (85, (235, 210, 154)), (125, (222, 182, 116)), (150, (208, 170, 107)), (190, (174, 140, 88)), (245, (140, 110, 70)), (400, (120, 94, 60))]

def render(n, ss=8, outline=None):
    S = n * ss; k = S / SIDE
    tx = lambda p: ((p[0] - (CX - SIDE / 2)) * k, (p[1] - (CY - SIDE / 2)) * k)
    def poly(pts):
        m = Image.new("L", (S, S), 0); ImageDraw.Draw(m).polygon([tx(p) for p in pts], fill=255); return np.asarray(m) > 127
    t = (poly(rh(T, W, H)) & ~poly(rh(T, WI, HI)) & ~poly(REM)) | poly(ARM) | poly(SPIKE) | poly(BAR)
    b = poly(rh(B, W, H)) & ~poly(rh(B, WI, HI))
    shape = t | b
    # gold: pale in the middle, gold on the sides, bronze at the tips
    yy, xx = np.mgrid[0:S, 0:S] / k; xx += CX - SIDE / 2; yy += CY - SIDE / 2
    e = np.sqrt(((xx - 175) / 1.25) ** 2 + (yy - 265) ** 2)
    col = np.zeros((S, S, 3))
    for i in range(3): col[..., i] = np.interp(e, [s[0] for s in STOPS], [s[1][i] for s in STOPS])
    img = np.zeros((S, S, 4))
    if outline:
        rad = outline * k
        g = np.asarray(Image.fromarray((shape * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(rad / 2))) / 255.0
        ring = np.clip((g - 0.04) / 0.12, 0, 1)
        img[..., :3] = [24, 46, 98]; img[..., 3] = ring * 0.92
    a = shape.astype(float)
    img[..., :3] = img[..., :3] * (1 - a[..., None]) + col * a[..., None]
    img[..., 3] = np.maximum(img[..., 3], a)
    big = Image.fromarray(np.dstack([img[..., :3], img[..., 3] * 255]).astype("uint8"), "RGBA")
    # premultiplied downscale so the outline doesn't bleed colour
    return big.resize((n, n), Image.LANCZOS, reducing_gap=3.0)

def ico(frames):
    pngs = []
    for im in frames:
        bio = io.BytesIO(); im.save(bio, "PNG", optimize=True); pngs.append((im.size[0], bio.getvalue()))
    head = struct.pack("<HHH", 0, 1, len(pngs)); off = 6 + 16 * len(pngs); dirs = b""; data = b""
    for w, d in pngs:
        dirs += struct.pack("<BBBBHHII", w % 256, w % 256, 0, 0, 1, 32, len(d), off + len(data)); data += d
    return head + dirs + data

if __name__ == "__main__":
    sp = sys.argv[1]
    # at 16 px the bands are drawn a little thicker and the outline thinner, so the two diamonds still read
    WI, HI = 98, 117; d16 = render(16, ss=16, outline=14); WI, HI = 110, 131
    d32 = render(32, outline=17); d48 = render(48, outline=13)
    for n, im in ((16, d16), (32, d32), (48, d48)): im.save(f"{sp}/up19/diamond{n}.png")
    render(192, outline=9).save(f"{sp}/up19/diamond192.png")
    orig = Image.open(f"{sp}/up19/favicon.ico"); orig48 = orig.ico.getimage((48, 48)).convert("RGBA")
    orig48.save(f"{sp}/up19/logo48.png")
    open(f"{sp}/up19/favicon_diamond.ico", "wb").write(ico([d16, d32, orig48]))
    open(f"{sp}/up19/favicon_alldiamond.ico", "wb").write(ico([d16, d32, d48]))
    print("ok")
