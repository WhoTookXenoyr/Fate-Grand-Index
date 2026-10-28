/* ================= 0.26.0: the installable app (the hosted site only) =================
   On the hosted site (site/index.html carries <meta name="fgi-hosted">) the page registers the service worker
   (site/sw.js): it keeps this page and its icons, so the app opens offline and at once. When a new version has been
   downloaded in the background, a toast offers to reload into it. Browsers that can install the site as an app fire
   beforeinstallprompt; then "Install the app" shows in the footer and the account window. On an iPhone or iPad,
   Safari's Share menu → Add to Home Screen does the same, which the same places explain. The file people open from
   their computer is unchanged: no service worker, no install, no account. */
const HOSTED = !!document.querySelector('meta[name="fgi-hosted"]') && /^https?:$/.test(location.protocol);
const APP = {prompt: null, installed: false, reg: null, waiting: null,
  ios: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)};
APP.installed = !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
function appUpdateReady(w) {
  if (!w || APP.waiting === w) return;
  APP.waiting = w;
  toastAction("A new version of Fate/Grand Index is ready.", "Reload", () => { try { w.postMessage("skip"); } catch (e) { location.reload(); } });
}
if (HOSTED && "serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloading || !APP.waiting) return; reloading = true; location.reload(); });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      APP.reg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) appUpdateReady(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) appUpdateReady(w); });
      });
      // a page left open for days still notices new versions
      setInterval(() => { if (document.visibilityState === "visible") reg.update().catch(() => {}); }, 3600000);
    }).catch(() => {});
  });
  // the browser may clear storage it needs room for; an app (and a site people sign in to) asks to keep it
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then((p) => { if (!p) navigator.storage.persist().catch(() => {}); }); } catch (e) {}
}
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); APP.prompt = e; appInstallPaint(); });
window.addEventListener("appinstalled", () => { APP.prompt = null; APP.installed = true; appInstallPaint(); toast("Installed: Fate/Grand Index is on your home screen or apps list now."); });
const canInstall = () => HOSTED && !APP.installed && (!!APP.prompt || APP.ios);
async function appInstall() {
  if (APP.prompt) {
    const p = APP.prompt; APP.prompt = null;
    try { p.prompt(); const r = await p.userChoice; if (r && r.outcome !== "accepted") APP.prompt = p; } catch (e) {}
    appInstallPaint(); return;
  }
  if (APP.ios) toast("In Safari: tap Share (the square with an arrow), then Add to Home Screen.");
}
function appInstallHTML(cls) {
  if (!canInstall()) return "";
  return `<button type="button" class="${cls || "btn sm"}" data-action="app-install">${APP.prompt ? "Install the app" : "Add to Home Screen"}</button>`;
}
function appInstallPaint() {
  document.querySelectorAll("[data-app-install-slot]").forEach((el) => { el.innerHTML = appInstallHTML(el.dataset.appInstallSlot); });
}
document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest('[data-action="app-install"]')) appInstall(); });
