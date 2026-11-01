/* Fate/Grand Index: the service worker that makes the site an installable app that works offline.
   The page (one big file) and its icons are kept in a cache named after this build. Opening the app shows the kept copy
   at once, online or not; meanwhile the browser checks for a newer sw.js, and when one is there the page offers to
   reload into the new version (40-app.js). /api/ never comes from the cache: the roster syncs itself. */
const V = "fgi-3bd72b112be9";
const SHELL = ["./", "manifest.webmanifest", "icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL.map((u) => new Request(u, {cache: "reload"})))));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("fgi-") && k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skip") self.skipWaiting(); });
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== self.location.origin || u.pathname.startsWith("/api/")) return;
  // the page for any address in the app; a real file (robots.txt, a picture) is fetched as it is
  const page = u.pathname === "/" || u.pathname.endsWith("/index.html") || (r.mode === "navigate" && !/\.[a-z0-9]{2,5}$/i.test(u.pathname));
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = page ? await c.match("./", {ignoreSearch: true}) : await c.match(r, {ignoreSearch: true});
    if (hit) return hit;
    try {
      const res = await fetch(r);
      if (res.ok && !page && SHELL.some((s) => u.pathname.endsWith(s.replace(/^\.\//, "/")))) c.put(r, res.clone());
      return res;
    } catch (err) {
      return page ? (await c.match("./", {ignoreSearch: true})) || Response.error() : Response.error();
    }
  })());
});
