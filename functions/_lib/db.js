function json(data, init) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    ...init,
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function sanitizeNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildIngredientRecord(record) {
  return {
    id: sanitizeText(record.id) || `ING${Date.now()}`,
    name: sanitizeText(record.name),
    category: sanitizeText(record.category),
    unit: sanitizeText(record.unit),
    purchase_price: sanitizeNumber(record.purchasePrice ?? record.purchase_price),
    image_url: sanitizeText(record.imageUrl ?? record.image_url),
    notes: sanitizeText(record.notes),
  };
}

function buildRecipeRecord(record) {
  return {
    id: sanitizeText(record.id) || `REC${Date.now()}`,
    name: sanitizeText(record.name),
    category: sanitizeText(record.category),
    image_url: sanitizeText(record.imageUrl ?? record.image_url),
    notes: sanitizeText(record.notes),
    ingredients_text: sanitizeText(record.ingredientsText ?? record.ingredients_text),
    method_text: sanitizeText(record.methodText ?? record.method_text),
    youtube_url: sanitizeText(record.youtubeUrl ?? record.youtube_url),
    items: Array.isArray(record.items) ? record.items : [],
  };
}

function buildOrderRecord(record) {
  return {
    id: sanitizeText(record.id) || `ORD${Date.now()}`,
    date_key: sanitizeText(record.dateKey ?? record.date_key),
    time_label: sanitizeText(record.timeLabel ?? record.time_label),
    items_json: JSON.stringify(Array.isArray(record.items) ? record.items : []),
  };
}

async function bootstrapPayload(db) {
  const [ingredientsResult, recipesResult, recipeItemsResult, ordersResult, categoriesResult] = await Promise.all([
    db.prepare(`
      SELECT id, name, category, unit, purchase_price, image_url, notes
      FROM ingredients
      ORDER BY name COLLATE NOCASE
    `).all(),
    db.prepare(`
      SELECT id, name, category, image_url, notes, ingredients_text, method_text, youtube_url
      FROM recipes
      ORDER BY created_at DESC, name COLLATE NOCASE
    `).all(),
    db.prepare(`
      SELECT id, recipe_id, ingredient_id, required_qty
      FROM recipe_items
      ORDER BY recipe_id, id
    `).all(),
    db.prepare(`
      SELECT id, date_key, time_label, items_json
      FROM daily_orders
      ORDER BY date_key DESC, time_label DESC
    `).all(),
    db.prepare(`
      SELECT id, name
      FROM recipe_categories
      ORDER BY name COLLATE NOCASE
    `).all(),
  ]);

  const ingredients = ingredientsResult.results || [];
  const ingredientMap = Object.fromEntries(ingredients.map((item) => [item.id, item]));
  const recipeItemsByRecipe = {};

  for (const item of recipeItemsResult.results || []) {
    if (!recipeItemsByRecipe[item.recipe_id]) {
      recipeItemsByRecipe[item.recipe_id] = [];
    }
    recipeItemsByRecipe[item.recipe_id].push({
      ingredientId: item.ingredient_id,
      requiredQty: item.required_qty || 1,
      ingredientName: ingredientMap[item.ingredient_id]?.name || 'ไม่ทราบชื่อ',
      unit: ingredientMap[item.ingredient_id]?.unit || '',
    });
  }

  return {
    ingredients: ingredients.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      purchasePrice: item.purchase_price,
      imageUrl: item.image_url,
      notes: item.notes,
    })),
    recipes: (recipesResult.results || []).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      imageUrl: item.image_url,
      notes: item.notes,
      ingredientsText: item.ingredients_text,
      methodText: item.method_text,
      youtubeUrl: item.youtube_url,
      items: recipeItemsByRecipe[item.id] || [],
    })),
    orderHistory: (ordersResult.results || []).map((item) => ({
      id: item.id,
      dateKey: item.date_key,
      timeLabel: item.time_label,
      items: safeParseJson(item.items_json, []),
    })),
    recipeCategories: (categoriesResult.results || []).map((item) => item.name),
  };
}

function safeParseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch (error) {
    return fallback;
  }
}

async function upsertIngredient(db, payload) {
  const item = buildIngredientRecord(payload);
  const timestamp = nowIso();
  await db.prepare(`
    INSERT INTO ingredients (id, name, category, unit, purchase_price, image_url, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      unit = excluded.unit,
      purchase_price = excluded.purchase_price,
      image_url = excluded.image_url,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).bind(
    item.id,
    item.name,
    item.category,
    item.unit,
    item.purchase_price,
    item.image_url,
    item.notes,
    timestamp,
    timestamp,
  ).run();
}

async function upsertRecipe(db, payload) {
  const recipe = buildRecipeRecord(payload);
  const timestamp = nowIso();

  await db.prepare(`
    INSERT INTO recipes (id, name, category, image_url, notes, ingredients_text, method_text, youtube_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      image_url = excluded.image_url,
      notes = excluded.notes,
      ingredients_text = excluded.ingredients_text,
      method_text = excluded.method_text,
      youtube_url = excluded.youtube_url,
      updated_at = excluded.updated_at
  `).bind(
    recipe.id,
    recipe.name,
    recipe.category,
    recipe.image_url,
    recipe.notes,
    recipe.ingredients_text,
    recipe.method_text,
    recipe.youtube_url,
    timestamp,
    timestamp,
  ).run();

  if (recipe.category) {
    await upsertRecipeCategory(db, { name: recipe.category });
  }

  await db.prepare(`DELETE FROM recipe_items WHERE recipe_id = ?`).bind(recipe.id).run();

  for (const item of recipe.items) {
    const ingredientId = sanitizeText(item.ingredientId ?? item.ingredient_id);
    if (!ingredientId) continue;
    await db.prepare(`
      INSERT INTO recipe_items (id, recipe_id, ingredient_id, required_qty, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      sanitizeText(item.id) || `${recipe.id}_${ingredientId}`,
      recipe.id,
      ingredientId,
      sanitizeNumber((item.requiredQty ?? item.required_qty) || 1),
      timestamp,
    ).run();
  }
}

async function upsertOrder(db, payload) {
  const order = buildOrderRecord(payload);
  const timestamp = nowIso();
  await db.prepare(`
    INSERT INTO daily_orders (id, date_key, time_label, items_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      date_key = excluded.date_key,
      time_label = excluded.time_label,
      items_json = excluded.items_json,
      updated_at = excluded.updated_at
  `).bind(
    order.id,
    order.date_key,
    order.time_label,
    order.items_json,
    timestamp,
    timestamp,
  ).run();
}

async function deleteOrder(db, id) {
  await db.prepare(`DELETE FROM daily_orders WHERE id = ?`).bind(sanitizeText(id)).run();
}

async function clearOrders(db) {
  await db.prepare(`DELETE FROM daily_orders`).run();
}

async function upsertRecipeCategory(db, payload) {
  const name = sanitizeText(payload.name);
  if (!name) return;
  const timestamp = nowIso();
  await db.prepare(`
    INSERT INTO recipe_categories (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      updated_at = excluded.updated_at
  `).bind(
    sanitizeText(payload.id) || `CAT_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    timestamp,
    timestamp,
  ).run();
}

async function renameRecipeCategory(db, payload) {
  const oldName = sanitizeText(payload.oldName);
  const newName = sanitizeText(payload.newName);
  if (!oldName || !newName) return;
  const timestamp = nowIso();

  await db.prepare(`UPDATE recipes SET category = ?, updated_at = ? WHERE category = ?`)
    .bind(newName, timestamp, oldName)
    .run();

  await db.prepare(`DELETE FROM recipe_categories WHERE name = ?`).bind(oldName).run();
  await upsertRecipeCategory(db, { name: newName });
}

async function deleteRecipeCategory(db, payload) {
  const name = sanitizeText(payload.name);
  if (!name) return;
  const timestamp = nowIso();
  await db.prepare(`UPDATE recipes SET category = '', updated_at = ? WHERE category = ?`)
    .bind(timestamp, name)
    .run();
  await db.prepare(`DELETE FROM recipe_categories WHERE name = ?`).bind(name).run();
}

export {
  json,
  readJson,
  bootstrapPayload,
  upsertIngredient,
  upsertRecipe,
  upsertOrder,
  deleteOrder,
  clearOrders,
  upsertRecipeCategory,
  renameRecipeCategory,
  deleteRecipeCategory,
};
