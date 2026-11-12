/* ================= 0.53.0-beta: the page's own background in black and cream =================
   The colours are variables in 39-palette.css. What's here is the page's own background (--g1..3, which the page's
   gradient and its glow use), worked out by paintPage from the shown servant's picture:
   - with a servant on show (with a picture of your own: their colours come from it) it takes their colours, as it did: on black in dark mode (the deep tones of 0.52,
     the middle of the gradient pulled a little towards black), on cream in light mode (cream with 55% of their tone).
     Noyr: a red servant left the page black in dark mode and cream in light mode. That was this file keeping the page
     black whatever the servant; the colours were worked out and thrown away.
   - with no servant (the Home page, a fresh list) it's true black in dark mode (a black pixel is a pixel switched off,
     which is the point) and cream in light mode.
   (For one build this was a choice on Settings, "Colours", next to the navy of 0.50; its key is cleared here.) */
const PAL_CREAM = ["#f3ecdd", "#ece3cf", "#faf5ea"];
// is something giving the page its colours? (a servant on show, from the picture you gave them, or a chapter with the
// Story look; with nothing, curPal is DEFAULT_PAL)
const palServant = () => curPal !== DEFAULT_PAL;
const paintPage60 = paintPage;
paintPage = function () {
  const r = paintPage60.apply(this, arguments);
  try {
    const st = document.documentElement.style, dark = isDark(), own = palServant();
    [1, 2, 3].forEach((i) => {
      const c = st.getPropertyValue("--g" + i).trim(), ok = /^#[0-9a-f]{6}$/i.test(c);
      st.setProperty("--g" + i, !own || !ok ? (dark ? "#000000" : PAL_CREAM[i - 1]) : dark ? (i === 2 ? scMix(c, "#000000", 0.3) : c) : scMix(PAL_CREAM[i - 1], c, 0.55));
    });
    document.documentElement.classList.toggle("pal-own", own);
  } catch (e) {}
  return r;
};
try { localStorage.removeItem("spirit-origin-list:v1:palette"); } catch (e) {}
paintPage();
