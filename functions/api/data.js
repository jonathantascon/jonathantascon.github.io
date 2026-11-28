import { getSession, json, readJson, sameOrigin } from "../_lib/auth.js";
import { isValidData } from "../_lib/data.js";

const EMPTY_DATA = { operations: [], positions: [], diary: {} };

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Inicia sesión para ver tus registros." }, 401);

  const row = await env.DB.prepare(
    "SELECT payload, updated_at FROM user_data WHERE user_id = ?"
  ).bind(session.id).first();
  if (!row) return json({ data: EMPTY_DATA, updatedAt: null, hasData: false });

  try {
    const data = JSON.parse(row.payload);
    if (!isValidData(data)) throw new Error("invalid data");
    return json({ data, updatedAt: row.updated_at, hasData: true });
  } catch {
    return json({ error: "Los datos guardados no pasan la validación." }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Origen de solicitud no válido." }, 403);
  const session = await getSession(request, env);
  if (!session) return json({ error: "Tu sesión venció. Inicia sesión de nuevo." }, 401);

  let body;
  try {
    body = await readJson(request, 1_000_000);
  } catch (error) {
    return json({ error: error.message }, 413);
  }
  if (!isValidData(body?.data)) return json({ error: "Los registros contienen datos inválidos." }, 400);

  const payload = JSON.stringify(body.data);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "INSERT INTO user_data (user_id, payload, updated_at) VALUES (?, ?, ?) " +
    "ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
  ).bind(session.id, payload, now).run();
  return json({ ok: true, updatedAt: now, data: body.data, hasData: true });
}

export async function onRequestDelete({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Origen de solicitud no válido." }, 403);
  const session = await getSession(request, env);
  if (!session) return json({ error: "Tu sesión venció. Inicia sesión de nuevo." }, 401);
  await env.DB.prepare("DELETE FROM user_data WHERE user_id = ?").bind(session.id).run();
  return json({ ok: true });
}
