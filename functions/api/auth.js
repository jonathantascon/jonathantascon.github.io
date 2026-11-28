import {
  checkRateLimit,
  clearSessionCookie,
  createSession,
  getSession,
  json,
  passwordHash,
  passwordsEqual,
  randomToken,
  readJson,
  sameOrigin,
  sha256Hex,
  validEmail,
  validPassword
} from "../_lib/auth.js";

const encoder = new TextEncoder();

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function passwordInputError(password) {
  return validPassword(password) ? "" : "La contraseña debe tener entre 12 y 128 caracteres.";
}

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
    return json({ initialized: Number(row?.total || 0) > 0 });
  } catch {
    return json({ error: "El servicio de cuentas no está disponible." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Origen de solicitud no válido." }, 403);

  let body;
  try {
    body = await readJson(request, 8192);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const action = body?.action;
  if (action === "logout") {
    const session = await getSession(request, env);
    if (session) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(session.tokenHash).run();
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  if (action === "setup" || action === "login") {
    if (!(await checkRateLimit(request, env))) {
      return json({ error: "Demasiados intentos. Espera 15 minutos y vuelve a intentarlo." }, 429);
    }
    if (action === "setup") return setupAccount(body, env);
    return login(body, env);
  }

  if (action === "change-password") return changePassword(body, request, env);
  return json({ error: "Acción no reconocida." }, 400);
}

async function setupAccount(body, env) {
  const email = normalizeEmail(body.email);
  const password = body.password;
  if (!validEmail(email)) return json({ error: "Escribe un correo válido." }, 400);
  const passwordError = passwordInputError(password);
  if (passwordError) return json({ error: passwordError }, 400);
  if (typeof env.SETUP_TOKEN !== "string" || env.SETUP_TOKEN.length < 32 ||
      !passwordsEqual(String(body.setupToken || ""), env.SETUP_TOKEN)) {
    return json({ error: "Token de configuración inválido." }, 403);
  }

  const salt = randomToken(16);
  const hash = await passwordHash(password, salt);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const created = await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, password_salt, created_at) " +
    "SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users) RETURNING id, email"
  ).bind(id, email, hash, salt, now).first();

  if (!created) return json({ error: "La cuenta inicial ya fue creada." }, 409);
  const session = await createSession(created.id, env);
  return json({ ok: true, email: created.email }, 201, { "Set-Cookie": session.cookie });
}

async function login(body, env) {
  const email = normalizeEmail(body.email);
  const password = body.password;
  if (!validEmail(email) || typeof password !== "string" || password.length > 128) {
    return json({ error: "Correo o contraseña incorrectos." }, 401);
  }
  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, password_salt FROM users WHERE email = ?"
  ).bind(email).first();

  const salt = user?.password_salt || "invalid-account-salt";
  const calculated = await passwordHash(password, salt);
  const expected = user?.password_hash || "invalid-account-hash";
  if (!user || !passwordsEqual(calculated, expected)) {
    return json({ error: "Correo o contraseña incorrectos." }, 401);
  }

  const session = await createSession(user.id, env);
  return json({ ok: true, email: user.email }, 200, { "Set-Cookie": session.cookie });
}

async function changePassword(body, request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Tu sesión venció. Inicia sesión de nuevo." }, 401);
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = body.newPassword;
  const passwordError = passwordInputError(next);
  if (passwordError) return json({ error: passwordError }, 400);

  const user = await env.DB.prepare(
    "SELECT password_hash, password_salt FROM users WHERE id = ?"
  ).bind(session.id).first();
  const calculated = await passwordHash(current, user.password_salt);
  if (!passwordsEqual(calculated, user.password_hash)) {
    return json({ error: "La contraseña actual no coincide." }, 400);
  }

  const salt = randomToken(16);
  const hash = await passwordHash(next, salt);
  await env.DB.prepare(
    "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?"
  ).bind(hash, salt, session.id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(session.id).run();
  const renewed = await createSession(session.id, env);
  return json({ ok: true }, 200, { "Set-Cookie": renewed.cookie });
}
