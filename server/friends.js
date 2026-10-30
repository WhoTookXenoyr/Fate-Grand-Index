/* Friends: requests by friend code or name, rosters to look at, supports to borrow, and what friends have been up to.

   Who sees a roster (users.vis): "private" (only you), "friends" (friends you've accepted), "link" (friends, and anyone
   with the link's token). Supports (up to 10 servants you lend, like the game's support list) are always shown to
   friends, as is their picture; activity only when feed is on. */
import {fail, json, now, body, clean, cleanName, okName, nameKey, randomToken} from "./util.js";
import {needUser, sessionUser, me} from "./auth.js";

const pair = (x, y) => (x < y ? [x, y] : [y, x]);
async function friendState(env, me, other) {
  const [a, b] = pair(me, other);
  return env.DB.prepare("SELECT state, by FROM friends WHERE a = ? AND b = ?").bind(a, b).first();
}
const isFriend = async (env, me, other) => { const f = await friendState(env, me, other); return !!(f && f.state === "accepted"); };

// can the one asking see the owner's roster ("docs"), supports or pictures?
export async function canSee(ctx, owner, what) {
  const u = await sessionUser(ctx);
  if (u && u.id === owner) return true;
  const o = await ctx.env.DB.prepare("SELECT vis, share FROM users WHERE id = ?").bind(owner).first();
  if (!o) return false;
  const friend = u ? await isFriend(ctx.env, u.id, owner) : false;
  if (friend && (what !== "docs" || o.vis !== "private")) return true;
  const t = new URL(ctx.request.url).searchParams.get("t") || ctx.request.headers.get("x-fgi-share");
  return o.vis === "link" && !!o.share && !!t && t === o.share && what !== "supports-only";
}

const pub = (r) => ({id: r.id, name: r.name, code: r.code, vis: r.vis});
// PATCH-like: name, who sees the roster, activity on/off, supports
export async function saveAccount(ctx) {
  const env = ctx.env, u = await needUser(ctx), b = await body(ctx.request, 8000), sets = [], args = [];
  if (b.name != null) {
    const n = cleanName(b.name);
    if (!okName(n)) fail(400, "bad_name", "A name is 3–20 letters or digits (spaces, _ . - in between are fine).");
    if (nameKey(n) !== u.name_key && await env.DB.prepare("SELECT 1 FROM users WHERE name_key = ? AND id <> ?").bind(nameKey(n), u.id).first()) fail(409, "name_taken", "Someone already has that name. Try another.");
    sets.push("name = ?", "name_key = ?"); args.push(n, nameKey(n));
  }
  if (b.vis != null) {
    if (!["private", "friends", "link"].includes(b.vis)) fail(400, "bad_vis", "Pick who can see your roster.");
    sets.push("vis = ?"); args.push(b.vis);
    if (b.vis === "link" && (!u.share || b.newLink)) { sets.push("share = ?"); args.push(randomToken(18)); }
  }
  if (b.feed != null) { sets.push("feed = ?"); args.push(b.feed ? 1 : 0); }
  if (b.supports != null) {
    if (!Array.isArray(b.supports) || b.supports.length > 10) fail(400, "bad_supports", "Up to 10 supports.");
    const ids = b.supports.map((x) => clean(x, 120)).filter(Boolean);
    sets.push("supports = ?"); args.push(JSON.stringify(Array.from(new Set(ids))));
  }
  if (sets.length) await env.DB.prepare("UPDATE users SET " + sets.join(", ") + " WHERE id = ?").bind(...args, u.id).run();
  const nu = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first();
  return json({user: await me(ctx, nu)});
}

// 0.26.1: where someone is in the story ({w, q, ph}), from the page's remembered story progress (extras/story)
function storyPos(data) {
  try { const p = JSON.parse(JSON.parse(data).v).pos; const n = (x) => Math.max(0, Math.floor(Number(x) || 0)); return p && n(p.w) ? {w: n(p.w), q: n(p.q), ph: n(p.ph)} : null; } catch (e) { return null; }
}
async function storyOf(env, ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90);
    const rows = (await env.DB.prepare("SELECT user_id, data FROM docs WHERE col = 'extras' AND id = 'story' AND data IS NOT NULL AND user_id IN (" + part.map(() => "?").join(",") + ")").bind(...part).all()).results || [];
    rows.forEach((r) => { const p = storyPos(r.data); if (p) out[r.user_id] = p; });
  }
  return out;
}
export async function list(ctx) {
  const env = ctx.env, u = await needUser(ctx);
  const rows = (await env.DB.prepare(`SELECT f.state, f.by, f.created, x.id, x.name, x.code, x.vis, x.supports, x.seen FROM friends f
     JOIN users x ON x.id = (CASE WHEN f.a = ?1 THEN f.b ELSE f.a END) WHERE f.a = ?1 OR f.b = ?1 ORDER BY x.name_key`).bind(u.id).all()).results || [];
  const out = {friends: [], incoming: [], outgoing: []};
  rows.forEach((r) => {
    let sup = 0; try { sup = JSON.parse(r.supports || "[]").length; } catch (e) {}
    const f = Object.assign(pub(r), {since: r.created, supports: sup, seen: r.seen});
    if (r.state === "accepted") out.friends.push(f); else if (r.by === u.id) out.outgoing.push(f); else out.incoming.push(f);
  });
  // friends see where you are in the story, unless your roster is only for you
  const st = await storyOf(env, out.friends.filter((f) => f.vis !== "private").map((f) => f.id));
  out.friends.forEach((f) => { if (st[f.id]) f.story = st[f.id]; });
  return json(out);
}
// ask by friend code (123456789, spaces and commas allowed) or by name; asking someone who asked you accepts
export async function request(ctx) {
  const env = ctx.env, u = await needUser(ctx), b = await body(ctx.request, 2000), q = clean(b.to, 40);
  const digits = q.replace(/[\s,.-]/g, "");
  const o = /^\d{9}$/.test(digits) ? await env.DB.prepare("SELECT * FROM users WHERE code = ?").bind(digits).first()
    : q ? await env.DB.prepare("SELECT * FROM users WHERE name_key = ?").bind(nameKey(cleanName(q))).first() : null;
  if (!o) fail(404, "no_one", "No one has that friend code or name.");
  if (o.id === u.id) fail(400, "self", "That's you.");
  const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM friends WHERE a = ?1 OR b = ?1").bind(u.id).first()).n;
  if (n >= 150) fail(400, "too_many", "That's a lot of friends: remove a few first.");
  const [a, bb] = pair(u.id, o.id), f = await friendState(env, u.id, o.id);
  if (f && f.state === "accepted") return json({state: "friends", friend: pub(o)});
  if (f && f.by !== u.id) { await env.DB.prepare("UPDATE friends SET state = 'accepted', created = ? WHERE a = ? AND b = ?").bind(now(), a, bb).run(); return json({state: "friends", friend: pub(o)}); }
  if (!f) await env.DB.prepare("INSERT INTO friends (a, b, state, by, created) VALUES (?, ?, 'pending', ?, ?)").bind(a, bb, u.id, now()).run();
  return json({state: "asked", friend: pub(o)});
}
export async function accept(ctx, other) {
  const env = ctx.env, u = await needUser(ctx), f = await friendState(env, u.id, other);
  if (!f || f.by === u.id) fail(404, "no_request", "There's no request from them.");
  const [a, b] = pair(u.id, other);
  await env.DB.prepare("UPDATE friends SET state = 'accepted', created = ? WHERE a = ? AND b = ?").bind(now(), a, b).run();
  return json({ok: true});
}
// decline, cancel or unfriend
export async function remove(ctx, other) {
  const u = await needUser(ctx), [a, b] = pair(u.id, other);
  await ctx.env.DB.prepare("DELETE FROM friends WHERE a = ? AND b = ?").bind(a, b).run();
  return json({ok: true});
}

async function supportDocs(env, owner, ids) {
  if (!ids.length) return [];
  const rows = (await env.DB.prepare("SELECT id, data FROM docs WHERE user_id = ? AND col = 'servants' AND data IS NOT NULL AND id IN (" + ids.map(() => "?").join(",") + ")").bind(owner, ...ids).all()).results || [];
  const by = new Map(rows.map((r) => [r.id, r.data]));
  return ids.filter((id) => by.has(id)).map((id) => '{"id":' + JSON.stringify(id) + ',"data":' + by.get(id) + "}");
}
// a profile: name, code, supports (with their servants) and whether the roster can be opened
export async function profile(ctx, owner) {
  const env = ctx.env, o = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(owner).first();
  if (!o || !(await canSee(ctx, owner, "pics"))) fail(404, "not_found", "No such Master, or they don't share with you.");
  const u = await sessionUser(ctx), friend = u && u.id !== owner ? await isFriend(env, u.id, owner) : false;
  let ids = []; try { ids = JSON.parse(o.supports || "[]"); } catch (e) {}
  const sup = friend || (u && u.id === owner) ? await supportDocs(env, owner, ids) : [];
  const roster = await canSee(ctx, owner, "docs");
  return new Response('{"user":' + JSON.stringify(Object.assign(pub(o), {friend, roster})) + ',"supports":[' + sup.join(",") + "]}",
    {headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}});
}
// a roster to look at (read-only): every document, as stored
export async function roster(ctx, owner) {
  const env = ctx.env;
  if (!(await canSee(ctx, owner, "docs"))) fail(404, "not_found", "That roster isn't shared with you.");
  const rows = (await env.DB.prepare("SELECT col, id, data FROM docs WHERE user_id = ? AND (col IN ('servants','parties','guests') OR (col = 'extras' AND id = 'story')) AND data IS NOT NULL").bind(owner).all()).results || [];
  // 0.26.1: with the roster comes where they are in the story (only the position, not the rest of what's remembered)
  const story = rows.filter((r) => r.col === "extras").map((r) => storyPos(r.data))[0] || null;
  return new Response('{"docs":[' + rows.filter((r) => r.col !== "extras").map((r) => '{"col":' + JSON.stringify(r.col) + ',"id":' + JSON.stringify(r.id) + ',"data":' + r.data + "}").join(",") + '],"story":' + JSON.stringify(story) + "}",
    {headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}});
}
// the link someone shared: whose roster it is
export async function shared(ctx, token) {
  const o = token ? await ctx.env.DB.prepare("SELECT id, name, code, vis FROM users WHERE share = ? AND vis = 'link'").bind(clean(token, 60)).first() : null;
  if (!o) fail(404, "not_found", "That link doesn't work any more.");
  return json({user: pub(o)});
}
// the friends' supports, for the damage calculator's picker
export async function friendSupports(ctx) {
  const env = ctx.env, u = await needUser(ctx);
  const rows = (await env.DB.prepare(`SELECT x.id, x.name, x.supports FROM friends f JOIN users x ON x.id = (CASE WHEN f.a = ?1 THEN f.b ELSE f.a END)
     WHERE (f.a = ?1 OR f.b = ?1) AND f.state = 'accepted' ORDER BY x.name_key LIMIT 150`).bind(u.id).all()).results || [];
  const parts = [];
  for (const r of rows) {
    let ids = []; try { ids = JSON.parse(r.supports || "[]"); } catch (e) {}
    if (!ids.length) continue;
    const docs = await supportDocs(env, r.id, ids.slice(0, 10));
    if (docs.length) parts.push('{"user":' + JSON.stringify({id: r.id, name: r.name}) + ',"supports":[' + docs.join(",") + "]}");
  }
  return new Response('{"friends":[' + parts.join(",") + "]}", {headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}});
}
// what friends have been up to, newest first
export async function feed(ctx) {
  const env = ctx.env, u = await needUser(ctx);
  const rows = (await env.DB.prepare(`SELECT a.id AS aid, a.at, a.kind, a.data, x.id, x.name FROM activity a JOIN users x ON x.id = a.user_id
     JOIN friends f ON f.state = 'accepted' AND ((f.a = ?1 AND f.b = a.user_id) OR (f.b = ?1 AND f.a = a.user_id))
     WHERE x.feed = 1 AND a.at > ?2 ORDER BY a.at DESC, a.id DESC LIMIT 60`).bind(u.id, now() - 30 * 86400000).all()).results || [];
  return new Response('{"items":[' + rows.map((r) => '{"id":' + r.aid + ',"at":' + r.at + ',"kind":' + JSON.stringify(r.kind) + ',"user":' + JSON.stringify({id: r.id, name: r.name}) + ',"data":' + (r.data || "null") + "}").join(",") + "]}",
    {headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}});
}
