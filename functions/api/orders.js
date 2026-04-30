import { bootstrapPayload, clearOrders, json, readJson, upsertOrder } from '../_lib/db.js';

export async function onRequestPost(context) {
  const payload = await readJson(context.request);
  await upsertOrder(context.env.DB, payload);
  return json({ ok: true, data: await bootstrapPayload(context.env.DB) });
}

export async function onRequestDelete(context) {
  await clearOrders(context.env.DB);
  return json({ ok: true, data: await bootstrapPayload(context.env.DB) });
}
