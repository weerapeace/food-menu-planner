import { bootstrapPayload, json, readJson, upsertIngredient } from '../_lib/db.js';

export async function onRequestPost(context) {
  const payload = await readJson(context.request);
  await upsertIngredient(context.env.DB, payload);
  return json({ ok: true, data: await bootstrapPayload(context.env.DB) });
}
