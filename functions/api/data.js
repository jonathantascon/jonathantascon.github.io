import { getSession, json, readJson, sameOrigin } from "../_lib/auth.js";
import { isValidData } from "../_lib/data.js";

const EMPTY_DATA = { operations: [], positions: [], diary: {} };

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env);
  if (!session) return json({ error: "Inicia sesión para ver tus registros." }, 401);

  const row = await env.DB.prepare(
    "SELECT payload, updated_at, revision FROM user_data WHERE user_id = ?"
  ).bind(session.id).first();
  if (!row) return json({ data: EMPTY_DATA, updatedAt: null, revision: null, hasData: false, email: session.email });

  try {
    const data = JSON.parse(row.payload);
    if (!isValidData(data)) throw new Error("invalid data");
    return json({ data, updatedAt: row.updated_at, revision: row.revision, hasData: true, email: session.email });
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

  const expectedRevision = body.expectedRevision;
  if (expectedRevision !== null && (!Number.isInteger(expectedRevision) || expectedRevision < 1)) {
    return json({ error: "Versión de datos no válida." }, 400);
  }
  const payload = JSON.stringify(body.data);
  const now = Math.floor(Date.now() / 1000);
  let result;
  if (expectedRevision === null) {
    result = await env.DB.prepare(
      "INSERT INTO user_data (user_id, payload, updated_at, revision) VALUES (?, ?, ?, 1) " +
      "ON CONFLICT(user_id) DO NOTHING"
    ).bind(session.id, payload, now).run();
  } else {
    result = await env.DB.prepare(
      "UPDATE user_data SET payload = ?, updated_at = ?, revision = revision + 1 " +
      "WHERE user_id = ? AND revision = ?"
    ).bind(payload, now, session.id, expectedRevision).run();
  }
  if (Number(result.meta?.changes || 0) !== 1) {
    return json({ error: "Los datos cambiaron en otra sesión. Recarga la página antes de guardar." }, 409);
  }
  const saved = await env.DB.prepare("SELECT revision, updated_at FROM user_data WHERE user_id = ?")
    .bind(session.id).first();
  return json({ ok: true, updatedAt: saved.updated_at, revision: saved.revision, data: body.data, hasData: true });
}

export async function onRequestDelete({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Origen de solicitud no válido." }, 403);
  const session = await getSession(request, env);
  if (!session) return json({ error: "Tu sesión venció. Inicia sesión de nuevo." }, 401);
  await env.DB.prepare("DELETE FROM user_data WHERE user_id = ?").bind(session.id).run();
  return json({ ok: true });
}
