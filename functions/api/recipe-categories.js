import {
  bootstrapPayload,
  deleteRecipeCategory,
  json,
  readJson,
  renameRecipeCategory,
  upsertRecipeCategory,
} from '../_lib/db.js';

export async function onRequestPost(context) {
  const payload = await readJson(context.request);
  await upsertRecipeCategory(context.env.DB, payload);
  return json({ ok: true, data: await bootstrapPayload(context.env.DB) });
}

export async function onRequestPatch(context) {
  const payload = await readJson(context.request);
  await renameRecipeCategory(context.env.DB, payload);
  return json({ ok: true, data: await bootstrapPayload(context.env.DB) });
}

export async function onRequestDelete(context) {
  const payload = await readJson(context.request);
  await deleteRecipeCategory(context.env.DB, payload);
  return json({ ok: true, data: await bootstrapPayload(context.env.DB) });
}
