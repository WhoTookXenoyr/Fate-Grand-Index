/* The D1 database's tables. The first request after a deploy brings them up to date by itself (ensureSchema), so the
   database never needs SQL typed into Cloudflare's dashboard. A new version only ever adds; nothing is dropped.

   users     one row per account. pw: "v1$<salt>$<hmac>" of the key the browser derived from the password (see auth.js);
             recovery: hmac of the recovery code; code: the 9-digit friend code; vis: who sees the roster (private |
             friends | link); share: the link's token; feed: activity shown to friends; supports: servant ids lent to
             friends; rev: the account's sync counter; bytes: pictures stored
   idents    Discord / Google accounts linked to a user
   sessions  signed-in browsers; id is the sha-256 of the cookie's token
   docs      the roster: servants, parties, guests and extras, one JSON document each; data NULL = deleted. rev orders the
             changes, so a device asks only for what changed since it last looked
   pics      uploaded pictures; data holds the bytes only when no R2 bucket is bound (the free D1-only setup)
   friends   pairs (a < b); state pending | accepted; by = who asked
   activity  what friends see: summoned, grailed, NP up, skills maxed, Bond reached
   throttle  counters that slow down guessing passwords and making accounts */
export const SCHEMA_VERSION = 1;
const V1 = [
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, email TEXT UNIQUE, pw TEXT, recovery TEXT,
     code TEXT NOT NULL UNIQUE, vis TEXT NOT NULL DEFAULT 'friends', share TEXT UNIQUE, feed INTEGER NOT NULL DEFAULT 1,
     supports TEXT NOT NULL DEFAULT '[]', rev INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0,
     created INTEGER NOT NULL, seen INTEGER)`,
  `CREATE TABLE IF NOT EXISTS idents (provider TEXT NOT NULL, sub TEXT NOT NULL, user_id TEXT NOT NULL, label TEXT, created INTEGER, PRIMARY KEY (provider, sub))`,
  `CREATE INDEX IF NOT EXISTS idents_user ON idents (user_id)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER, seen INTEGER, expires INTEGER, agent TEXT)`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS docs (user_id TEXT NOT NULL, col TEXT NOT NULL, id TEXT NOT NULL, rev INTEGER NOT NULL, data TEXT, PRIMARY KEY (user_id, col, id))`,
  `CREATE INDEX IF NOT EXISTS docs_rev ON docs (user_id, rev)`,
  `CREATE TABLE IF NOT EXISTS pics (user_id TEXT NOT NULL, id TEXT NOT NULL, type TEXT, size INTEGER, created INTEGER, data BLOB, PRIMARY KEY (user_id, id))`,
  `CREATE TABLE IF NOT EXISTS friends (a TEXT NOT NULL, b TEXT NOT NULL, state TEXT NOT NULL, by TEXT NOT NULL, created INTEGER, PRIMARY KEY (a, b))`,
  `CREATE INDEX IF NOT EXISTS friends_b ON friends (b)`,
  `CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, at INTEGER NOT NULL, kind TEXT NOT NULL, data TEXT)`,
  `CREATE INDEX IF NOT EXISTS activity_user ON activity (user_id, at)`,
  `CREATE TABLE IF NOT EXISTS throttle (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL)`
];
const STEPS = [V1];
let ready = false;
export async function ensureSchema(db) {
  if (ready) return;
  let v = 0;
  try { const r = await db.prepare("SELECT v FROM meta WHERE k = 'schema'").first(); v = r ? Number(r.v) || 0 : 0; } catch (e) { v = 0; }
  for (let i = v; i < STEPS.length; i++) {
    await db.batch(STEPS[i].map((sql) => db.prepare(sql)).concat([db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('schema', ?)").bind(String(i + 1))]));
  }
  ready = true;
}
