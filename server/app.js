/* Fate/Grand Index API: every /api/ address (functions/api/[[path]].js hands the request here).

   Settings in Cloudflare (Pages project → Settings): the D1 database bound as DB (required), an R2 bucket bound as PICS
   (optional; without it pictures are kept in D1), and the secrets PEPPER (16+ random characters; needed for email and
   password), DISCORD_CLIENT_ID + DISCORD_CLIENT_SECRET and GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (each pair optional).
   PIC_QUOTA_MB changes the picture space per account (default 300 with R2, 120 without). docs/hosting.md has the steps. */
import {HttpError, json, fail} from "./util.js";
import {ensureSchema} from "./schema.js";
import * as auth from "./auth.js";
import * as sync from "./sync.js";
import * as fr from "./friends.js";

const ROUTES = [
  ["GET", /^me$/, async (c) => { const u = await auth.sessionUser(c); return json({user: u ? await auth.me(c, u) : null, providers: auth.providers(c.env)}); }],
  ["POST", /^auth\/signup$/, auth.signup],
  ["POST", /^auth\/login$/, auth.login],
  ["POST", /^auth\/logout$/, auth.logout],
  ["POST", /^auth\/recover$/, auth.recover],
  ["GET", /^auth\/(discord|google)$/, (c, m) => auth.oauthStart(c, m[1])],
  ["GET", /^auth\/(discord|google)\/callback$/, (c, m) => auth.oauthCallback(c, m[1])],
  ["POST", /^account$/, fr.saveAccount],
  ["POST", /^account\/password$/, auth.setPassword],
  ["POST", /^account\/recovery$/, auth.newRecoveryCode],
  ["GET", /^account\/sessions$/, auth.sessions],
  ["POST", /^account\/sessions\/end-others$/, auth.signOutOthers],
  ["POST", /^account\/unlink\/(discord|google)$/, (c, m) => auth.unlink(c, m[1])],
  ["POST", /^account\/delete$/, auth.deleteAccount],
  ["GET", /^sync$/, sync.pull],
  ["POST", /^sync$/, sync.push],
  ["GET", /^pics$/, sync.picList],
  ["PUT", /^pics\/(img_[a-z0-9]+)$/, (c, m) => sync.putPic(c, m[1])],
  ["DELETE", /^pics\/(img_[a-z0-9]+)$/, (c, m) => sync.delPic(c, m[1])],
  ["GET", /^pics\/([a-z0-9]{16})\/(img_[a-z0-9]+)$/, (c, m) => sync.getPic(c, m[1], m[2], fr.canSee)],
  ["GET", /^friends$/, fr.list],
  ["POST", /^friends$/, fr.request],
  ["POST", /^friends\/([a-z0-9]{16})\/accept$/, (c, m) => fr.accept(c, m[1])],
  ["POST", /^friends\/([a-z0-9]{16})\/remove$/, (c, m) => fr.remove(c, m[1])],
  ["GET", /^friends\/supports$/, fr.friendSupports],
  ["GET", /^feed$/, fr.feed],
  ["GET", /^u\/([a-z0-9]{16})$/, (c, m) => fr.profile(c, m[1])],
  ["GET", /^u\/([a-z0-9]{16})\/roster$/, (c, m) => fr.roster(c, m[1])],
  ["GET", /^share\/([A-Za-z0-9_-]{8,60})$/, (c, m) => fr.shared(c, m[1])]
];

export async function handle(ctx) {
  const req = ctx.request, url = new URL(req.url), path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  try {
    if (!ctx.env.DB) fail(503, "no_db", "This server has no database bound yet (D1 binding DB).");
    // anything that changes something needs this header: a page on another site can't send it without asking first
    if (req.method !== "GET" && req.method !== "HEAD" && req.headers.get("x-fgi") !== "1") fail(403, "no_header", "Missing the X-FGI header.");
    await ensureSchema(ctx.env.DB);
    let methodOk = false;
    for (const [m, re, fn] of ROUTES) {
      const hit = re.exec(path); if (!hit) continue;
      if (m !== req.method && !(m === "GET" && req.method === "HEAD")) { methodOk = true; continue; }
      return await fn(ctx, hit);
    }
    fail(methodOk ? 405 : 404, methodOk ? "method" : "not_found", methodOk ? "Not like that." : "No such address.");
  } catch (e) {
    if (e instanceof HttpError) return json(Object.assign({error: e.code, message: e.message}, e.extra || {}), e.status);
    console.error(e && e.stack || e);
    return json({error: "server", message: "Something went wrong on the server. Try again in a moment."}, 500);
  }
}
