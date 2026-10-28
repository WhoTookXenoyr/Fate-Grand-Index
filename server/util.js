/* Fate/Grand Index server (Cloudflare Pages Functions): small helpers shared by every route. */

export class HttpError extends Error {
  constructor(status, code, message, extra) { super(message || code); this.status = status; this.code = code; this.extra = extra; }
}
export const fail = (status, code, message, extra) => { throw new HttpError(status, code, message, extra); };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {status, headers: Object.assign({"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}, headers)});
}

export const now = () => Date.now();
const enc = new TextEncoder();
export const utf8 = (s) => enc.encode(s);

export function b64url(bytes) {
  let s = ""; const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64url(str) {
  const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
export const randomToken = (n = 32) => b64url(randomBytes(n));
// ids people never type: 16 base32 characters
const B32 = "abcdefghijkmnpqrstuvwxyz23456789";
export function randomId(n = 16) { const b = randomBytes(n); let s = ""; for (let i = 0; i < n; i++) s += B32[b[i] % B32.length]; return s; }

export async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", typeof s === "string" ? utf8(s) : s);
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}
export async function hmac(keyStr, data) {
  const key = await crypto.subtle.importKey("raw", utf8(keyStr), {name: "HMAC", hash: "SHA-256"}, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data instanceof Uint8Array ? data : utf8(String(data))));
}
export function sameBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
export const sameText = (a, b) => sameBytes(utf8(String(a || "")), utf8(String(b || "")));

export function cookies(req) {
  const out = {}; const raw = req.headers.get("cookie") || "";
  raw.split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
export function setCookie(name, value, opts = {}) {
  const parts = [name + "=" + encodeURIComponent(value), "Path=" + (opts.path || "/"), "HttpOnly", "SameSite=Lax"];
  if (opts.secure !== false) parts.push("Secure");
  if (opts.maxAge != null) parts.push("Max-Age=" + Math.floor(opts.maxAge));
  return parts.join("; ");
}

export async function body(req, max = 400000) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > max) fail(413, "too_big", "That's too much at once.");
  const text = await req.text();
  if (text.length > max) fail(413, "too_big", "That's too much at once.");
  if (!text) return {};
  try { return JSON.parse(text); } catch (e) { fail(400, "bad_json", "The request wasn't valid JSON."); }
}

export const clean = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
export const normEmail = (s) => clean(s, 200).toLowerCase();
export const okEmail = (s) => /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 200;
// names friends see: 3–20 letters, digits, spaces, _ . - (any script)
export function cleanName(s) { return clean(s, 40).normalize("NFKC"); }
export const okName = (s) => s.length >= 3 && s.length <= 20 && /^[\p{L}\p{N}_.\- ]+$/u.test(s) && !/^[\s._-]|[\s._-]$/.test(s);
export const nameKey = (s) => s.toLowerCase().replace(/\s+/g, " ");

export function clientIp(req) { return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "local"; }
