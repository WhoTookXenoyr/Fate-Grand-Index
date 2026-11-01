/* Sync: every device keeps the whole roster in its own browser and works offline; signed in, it sends what changed and
   asks for what changed elsewhere.

   The roster is documents in four collections (servants, parties, guests, and extras for the progress log, NA matches,
   tiers and the like). Each saved change gets the account's next number (users.rev), so "what changed since I last
   looked" is one query. The last save of a document wins; a device's unsent changes are kept back from what it pulls.
   Pictures people upload go to R2 when a bucket is bound (PICS), else into the database itself (pics.data, the free
   D1-only setup, so up to 1.9 MB a picture). */
import {fail, json, now, body, clean} from "./util.js";
import {needUser} from "./auth.js";

export const COLS = new Set(["servants", "parties", "guests", "extras"]);
const MAX_DOC = 300000, MAX_PUSH = 1200000, PAGE_BYTES = 1500000;
const okId = (id) => typeof id === "string" && id.length > 0 && id.length <= 120 && !/[\u0000-\u001f]/.test(id);
const CAPS = {1: 60, 2: 65, 3: 70, 4: 80, 5: 90};

// GET /api/sync?since=N: the changes after N, oldest first, in pages of about 1.5 MB (documents are sent as stored)
export async function pull(ctx) {
  const u = await needUser(ctx), since = Math.max(0, Number(new URL(ctx.request.url).searchParams.get("since")) || 0);
  const rows = (await ctx.env.DB.prepare("SELECT col, id, rev, data FROM docs WHERE user_id = ? AND rev > ? ORDER BY rev LIMIT 400").bind(u.id, since).all()).results || [];
  let size = 0, out = [], last = since;
  for (const r of rows) {
    const d = r.data == null ? "null" : r.data;
    if (out.length && size + d.length > PAGE_BYTES) break;
    size += d.length; last = r.rev;
    out.push('{"col":' + JSON.stringify(r.col) + ',"id":' + JSON.stringify(r.id) + ',"rev":' + r.rev + ',"data":' + d + "}");
  }
  const more = out.length < rows.length || rows.length === 400;
  return new Response('{"rev":' + (more ? last : Math.max(last, u.rev)) + ',"more":' + more + ',"docs":[' + out.join(",") + "]}",
    {headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}});
}

// POST /api/sync {changes: [{col, id, data | null}], first?}: saves them in order; returns the new numbers
export async function push(ctx) {
  const env = ctx.env, u = await needUser(ctx), b = await body(ctx.request, MAX_PUSH);
  const ch = Array.isArray(b.changes) ? b.changes : [];
  if (!ch.length) return json({rev: u.rev, revs: []});
  if (ch.length > 120) fail(413, "too_many", "Too many changes at once.");
  const rows = ch.map((c) => {
    if (!c || !COLS.has(c.col) || !okId(c.id)) fail(400, "bad_change", "A change didn't make sense.");
    const data = c.data == null ? null : JSON.stringify(c.data);
    if (data && data.length > MAX_DOC) fail(413, "doc_too_big", "One entry is too big to sync (" + c.col + "/" + c.id + ").");
    return {col: c.col, id: c.id, data};
  });
  // the old servants, to tell friends what changed (summoned, grailed, NP up…)
  const sv = rows.filter((r) => r.col === "servants"), old = {};
  if (sv.length && u.feed) {
    const ids = sv.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 50) {
      const part = ids.slice(i, i + 50), q = "SELECT id, data FROM docs WHERE user_id = ? AND col = 'servants' AND id IN (" + part.map(() => "?").join(",") + ")";
      ((await env.DB.prepare(q).bind(u.id, ...part).all()).results || []).forEach((r) => { old[r.id] = r.data; });
    }
  }
  const top = await env.DB.prepare("UPDATE users SET rev = rev + ? WHERE id = ? RETURNING rev").bind(rows.length, u.id).first();
  const base = top.rev - rows.length, t = now();
  const stmts = rows.map((r, i) => env.DB.prepare("INSERT INTO docs (user_id, col, id, rev, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, col, id) DO UPDATE SET rev = excluded.rev, data = excluded.data")
    .bind(u.id, r.col, r.id, base + i + 1, r.data));
  const acts = u.feed && !b.first && sv.length <= 15 ? activityOf(sv, old) : [];
  acts.slice(0, 20).forEach((a) => stmts.push(env.DB.prepare("INSERT INTO activity (user_id, at, kind, data) VALUES (?, ?, ?, ?)").bind(u.id, t, a.kind, JSON.stringify(a.data))));
  if (acts.length) stmts.push(env.DB.prepare("DELETE FROM activity WHERE user_id = ? AND at < ?").bind(u.id, t - 45 * 86400000));
  await env.DB.batch(stmts);
  return json({rev: top.rev, revs: rows.map((r, i) => base + i + 1)});
}

function activityOf(rows, old) {
  const out = [];
  const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  for (const r of rows) {
    const n = parse(r.data), o = parse(old[r.id]);
    if (!n || n.wish) continue;
    const who = {sid: r.id, name: clean(n.name, 80), cls: clean(n.cls, 20), rarity: Number(n.rarity) || 0, atlas: Number(n.atlas) || null};
    // a servant made in the Servant Workshop shows as Custom in friends' feeds
    if (n.custom) who.custom = true;
    const cap = CAPS[who.rarity] || 0, lv = Number(n.level) || 0, olv = o ? Number(o.level) || 0 : 0;
    if (!o || o.wish) { out.push({kind: "summoned", data: who}); continue; }
    if (lv > olv && cap && lv > cap) out.push({kind: "grail", data: Object.assign({to: lv}, who)});
    else if (lv > olv && cap && lv === cap) out.push({kind: "maxlevel", data: Object.assign({to: lv}, who)});
    const np = Number(n.npLevel) || 0, onp = Number(o.npLevel) || 0;
    if (np > onp && onp > 0) out.push({kind: "np", data: Object.assign({to: np}, who)});
    const max = (s) => Array.isArray(s && s.skills) && s.skills.length >= 3 && s.skills.slice(0, 3).every((v) => Number(v) >= 10);
    if (max(n) && !max(o)) out.push({kind: "skills", data: who});
    const bd = Number(n.bond) || 0, obd = Number(o.bond) || 0;
    if (bd > obd && [5, 10, 15].some((x) => bd >= x && obd < x)) out.push({kind: "bond", data: Object.assign({to: bd}, who)});
  }
  return out;
}

/* ---------- pictures ---------- */
const okPic = (id) => typeof id === "string" && /^img_[a-z0-9]{4,40}$/.test(id);
const quota = (env) => (Number(env.PIC_QUOTA_MB) || (env.PICS ? 300 : 120)) * 1048576;
export async function putPic(ctx, id) {
  const env = ctx.env, u = await needUser(ctx);
  if (!okPic(id)) fail(400, "bad_id", "That picture id isn't valid.");
  const type = clean(ctx.request.headers.get("content-type"), 60);
  if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(type)) fail(415, "not_image", "Only pictures (PNG, JPEG, WebP, GIF, AVIF).");
  const buf = await ctx.request.arrayBuffer(), size = buf.byteLength, max = env.PICS ? 8000000 : 1900000;
  if (!size) fail(400, "empty", "That picture is empty.");
  if (size > max) fail(413, "pic_too_big", "That picture is too big to sync (" + Math.round(size / 1048576 * 10) / 10 + " MB).");
  const had = await env.DB.prepare("SELECT size FROM pics WHERE user_id = ? AND id = ?").bind(u.id, id).first();
  if (had) return json({ok: true, size: had.size});
  if ((u.bytes || 0) + size > quota(env)) fail(507, "full", "Your picture space on the server is full. Remove some uploaded pictures, or keep using them on this device only.");
  if (env.PICS) await env.PICS.put("u/" + u.id + "/" + id, buf, {httpMetadata: {contentType: type}});
  await env.DB.batch([env.DB.prepare("INSERT INTO pics (user_id, id, type, size, created, data) VALUES (?, ?, ?, ?, ?, ?)").bind(u.id, id, type, size, now(), env.PICS ? null : buf),
    env.DB.prepare("UPDATE users SET bytes = bytes + ? WHERE id = ?").bind(size, u.id)]);
  return json({ok: true, size});
}
export async function delPic(ctx, id) {
  const env = ctx.env, u = await needUser(ctx);
  if (!okPic(id)) fail(400, "bad_id", "That picture id isn't valid.");
  const had = await env.DB.prepare("SELECT size FROM pics WHERE user_id = ? AND id = ?").bind(u.id, id).first();
  if (!had) return json({ok: true});
  if (env.PICS) await env.PICS.delete("u/" + u.id + "/" + id);
  await env.DB.batch([env.DB.prepare("DELETE FROM pics WHERE user_id = ? AND id = ?").bind(u.id, id),
    env.DB.prepare("UPDATE users SET bytes = MAX(0, bytes - ?) WHERE id = ?").bind(had.size || 0, u.id)]);
  return json({ok: true});
}
export async function picList(ctx) {
  const u = await needUser(ctx);
  const rows = (await ctx.env.DB.prepare("SELECT id FROM pics WHERE user_id = ?").bind(u.id).all()).results || [];
  return json({ids: rows.map((r) => r.id), bytes: u.bytes || 0, quota: quota(ctx.env)});
}
// GET /api/pics/<owner>/<id>: yours, a friend's, or (with ?t=) one from a shared roster
export async function getPic(ctx, owner, id, canSee) {
  const env = ctx.env;
  if (!okPic(id) || !/^[a-z0-9]{16}$/.test(owner)) fail(404, "not_found", "No such picture.");
  if (!(await canSee(ctx, owner, "pics"))) fail(404, "not_found", "No such picture.");
  const head = {"cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff"};
  if (env.PICS) {
    const o = await env.PICS.get("u/" + owner + "/" + id); if (!o) fail(404, "not_found", "No such picture.");
    return new Response(o.body, {headers: Object.assign({"content-type": (o.httpMetadata && o.httpMetadata.contentType) || "image/png"}, head)});
  }
  const r = await env.DB.prepare("SELECT type, data FROM pics WHERE user_id = ? AND id = ?").bind(owner, id).first();
  if (!r || !r.data) fail(404, "not_found", "No such picture.");
  return new Response(r.data instanceof ArrayBuffer ? r.data : new Uint8Array(r.data), {headers: Object.assign({"content-type": r.type || "image/png"}, head)});
}
