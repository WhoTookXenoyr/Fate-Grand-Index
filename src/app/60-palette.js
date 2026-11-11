/* ================= 0.53.0-beta: the page's own background in black and cream =================
   The colours are variables in 39-palette.css. What's here is the page's own background, which paintPage works out
   from a servant's or a chapter's colours and writes on the page itself: it stays black in dark mode (a black pixel is
   a pixel switched off, which is the point of true black) and is cream with a tenth of that colour in light mode.
   (For one build this was a choice on Settings, "Colours", next to the navy of 0.50; its key is cleared here.) */
const PAL_CREAM = ["#f3ecdd", "#ece3cf", "#faf5ea"];
const paintPage60 = paintPage;
paintPage = function () {
  const r = paintPage60.apply(this, arguments);
  try {
    const st = document.documentElement.style, dark = isDark();
    [1, 2, 3].forEach((i) => { const c = st.getPropertyValue("--g" + i).trim(); st.setProperty("--g" + i, dark ? "#000000" : /^#[0-9a-f]{6}$/i.test(c) ? scMix(PAL_CREAM[i - 1], c, 0.1) : PAL_CREAM[i - 1]); });
  } catch (e) {}
  return r;
};
try { localStorage.removeItem("spirit-origin-list:v1:palette"); } catch (e) {}
paintPage();
