import { bootstrapPayload, deleteOrder, json } from '../../_lib/db.js';

export async function onRequestDelete(context) {
  await deleteOrder(context.env.DB, context.params.id);
  return json({ ok: true, data: await bootstrapPayload(context.env.DB) });
}
