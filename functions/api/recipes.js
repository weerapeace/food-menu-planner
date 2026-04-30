import { bootstrapPayload, json, readJson, upsertRecipe } from '../_lib/db.js';

export async function onRequestPost(context) {
  const payload = await readJson(context.request);
  await upsertRecipe(context.env.DB, payload);
  return json({ ok: true, data: await bootstrapPayload(context.env.DB) });
}
