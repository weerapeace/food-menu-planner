import { bootstrapPayload, json } from '../_lib/db.js';

export async function onRequestGet(context) {
  const payload = await bootstrapPayload(context.env.DB);
  return json({ ok: true, data: payload });
}
