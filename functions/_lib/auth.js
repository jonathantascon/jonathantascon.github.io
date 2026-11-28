const SESSION_COOKIE = "__Host-trading-session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 310000;
const encoder = new TextEncoder();

export function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  return new Response(JSON.stringify(data), { status, headers });
}

export async function readJson(request, maxBytes = 1_000_000) {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > maxBytes) throw new Error("El cuerpo supera el tamaño permitido.");
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > maxBytes) throw new Error("El cuerpo supera el tamaño permitido.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("El contenido JSON no es válido.");
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomToken(size = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return bytesToBase64Url(bytes);
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function passwordHash(password, salt) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: PASSWORD_ITERATIONS },
    material,
    256
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

export function passwordsEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

export async function checkRateLimit(request, env, limit = 12) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256Hex(ip);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % 900);
  await env.DB.prepare(
    "INSERT INTO auth_rate_limits (ip_hash, window_start, attempts) VALUES (?, ?, 1) " +
    "ON CONFLICT(ip_hash) DO UPDATE SET " +
    "attempts = CASE WHEN auth_rate_limits.window_start = excluded.window_start THEN auth_rate_limits.attempts + 1 ELSE 1 END, " +
    "window_start = excluded.window_start"
  ).bind(ipHash, windowStart).run();
  const row = await env.DB.prepare("SELECT attempts FROM auth_rate_limits WHERE ip_hash = ?").bind(ipHash).first();
  return Number(row?.attempts || 0) <= limit;
}

export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !!origin && origin === new URL(request.url).origin &&
    request.headers.get("Sec-Fetch-Site") !== "cross-site";
}

function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const item = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(name + "="));
  return item ? item.slice(name.length + 1) : "";
}

export async function getSession(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    "SELECT users.id, users.email FROM sessions " +
    "JOIN users ON users.id = sessions.user_id " +
    "WHERE sessions.token_hash = ? AND sessions.expires_at > ?"
  ).bind(tokenHash, now).first();
  return row ? { id: row.id, email: row.email, tokenHash } : null;
}

export async function createSession(userId, env) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_SECONDS;
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(tokenHash, userId, now, expiresAt).run();
  const cookie = SESSION_COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + SESSION_SECONDS;
  return { cookie, expiresAt };
}

export function clearSessionCookie() {
  return SESSION_COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

export function validPassword(password) {
  return typeof password === "string" && password.length >= 12 && password.length <= 128;
}

export function validEmail(email) {
  return typeof email === "string" && email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
