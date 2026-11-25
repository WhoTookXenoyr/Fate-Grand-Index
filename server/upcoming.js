/* 0.54.1: the servants JP has and NA doesn't yet, in full (Noyr: "Make it really owner-only").

   Until 0.54.1 their whole kit was in the page and only the display was locked, so anyone could read it in the page's
   source (the daily security check, 24 Nov). Now the page has just their cards (name, class, stars, picture, when) and
   asks here for the rest: the site's owner (OWNER, auth.js isOwner) gets all of them; anyone else only the ones whose
   NA release ("at" in data/atlas/upcoming.json) has passed. The rest wait until NA's own data has them (the NA data
   job), when they're ordinary servants in the page.

   The data is server/upcoming_data.js, made by tools/gen_atlas.py. It's JP's public data (Atlas Academy, the wiki), and
   the repo is public: this keeps it out of the site, so visitors don't get spoilers from the page. */
import {sessionUser, isOwner} from "./auth.js";
import {ATLAS_IMG, UPCOMING} from "./upcoming_data.js";

export async function list(ctx) {
  const u = await sessionUser(ctx), owner = isOwner(ctx.env, u), t = Date.now();
  const out = UPCOMING.filter((x) => owner || (x.up && x.up.at && Date.parse(x.up.at) <= t));
  return new Response(JSON.stringify({owner, base: ATLAS_IMG, servants: out}),
    {headers: {"content-type": "application/json; charset=utf-8", "cache-control": "private, no-store"}});
}
