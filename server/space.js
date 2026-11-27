/* 0.56.1 (the daily security check, 26 Nov 2026): a ceiling for the whole site, not just each account.

   Every account shares one D1 database, and D1 caps a database's size (500 MB on Workers Free, 10 GB on Workers Paid).
   Each account has its own shares (pictures, roster), but a handful of new accounts filling theirs could still fill the
   database, and then every write fails for everyone: signing in, syncing, friends. So writes that make the database
   bigger first check how full it is, and stop at FULL_AT of DB_MAX_MB (a Cloudflare variable; 500 by default, set it to
   10000 on Workers Paid). What stays open, always: signing in (small rows), deleting things, and pushes that shrink.

   - D1 says how big the database is after each query it runs (`meta.size_after` on run() and batch() results). The last
     figure is kept for a minute in the worker; growing writes add to it as they go, so one worker can't overshoot by
     much, and a fresh worker asks with a one-row query.
   - The file doesn't get smaller when rows are deleted: SQLite keeps the freed space and fills it again first. So once
     the file is past FULL_AT, what the accounts actually keep decides (rosters, pictures kept in the database, and a
     little for each account): below REUSE_AT of the limit, there's freed space inside and writes go on. That's how a
     site that was cleaned up (say, spam accounts deleted) opens again without anyone touching the database. */
import {fail} from "./util.js";

export const FULL_AT = 0.8, REUSE_AT = 0.5, PER_ACCOUNT = 4000;
const FRESH = 60000;
let known = {size: 0, at: 0};
export const dbLimit = (env) => (Number(env.DB_MAX_MB) || 500) * 1048576;

// remember D1's figure from a result of run() or batch()
export function noteSize(res) {
  for (const r of Array.isArray(res) ? res : [res]) {
    const s = r && r.meta ? Number(r.meta.size_after) : 0;
    if (s > 0) known = {size: s, at: Date.now()};
  }
  return res;
}
export async function dbSize(env) {
  if (Date.now() - known.at > FRESH) {
    try { noteSize(await env.DB.prepare("SELECT 1").run()); } catch (e) { /* no figure: don't stop anyone */ }
  }
  return known.size;
}
// what the accounts keep in the database (only asked once the file looks full)
async function kept(env) {
  try {
    const r = await env.DB.prepare("SELECT COALESCE(SUM(docs_bytes), 0) AS d, COALESCE(SUM(bytes), 0) AS b, COUNT(*) AS c FROM users").first();
    return Number(r.d) + (env.PICS ? 0 : Number(r.b)) + Number(r.c) * PER_ACCOUNT;
  } catch (e) { return null; }
}
async function full(env, grow) {
  const size = await dbSize(env), lim = dbLimit(env);
  if (!size || size + grow <= lim * FULL_AT) return false;
  const k = await kept(env);
  return k == null || k + grow > lim * REUSE_AT;
}
// a write that would add `grow` bytes: refused (507) while the database is full in that sense
export async function room(env, grow, words) {
  if (!(grow > 0)) return;
  if (await full(env, grow)) {
    fail(507, "server_full", words || "The server's storage is nearly full, so nothing new can be saved there for now. Your changes stay on this device.");
  }
  // until D1 reports again, count this write as made
  if (known.size) known.size += grow;
}
// how full the database is, for the site's owner (/api/me); `full`: a new account would be refused now
export async function fill(env) {
  const used = await dbSize(env), limit = dbLimit(env);
  return used ? {used: used, limit: limit, stopsAt: Math.round(limit * FULL_AT), full: await full(env, PER_ACCOUNT)} : null;
}
