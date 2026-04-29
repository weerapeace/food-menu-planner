const APP_DATA_KEY = 'food-menu-app-data-v2';
const ORDER_HISTORY_KEY = 'food-menu-daily-orders-v1';

const state = {
  data: null,
  activeTab: 'recipes',
  cart: [],
  selectedIngredients: [],
  editingRecipeId: null,
  orderHistory: [],
  ingredientDialogContext: 'ingredients',
};

const CORE_SHARE_CATEGORIES = new Set(['โปรตีน', 'ผัก', 'ซีฟู้ด']);

document.addEventListener('DOMContentLoaded', async function() {
  bindTabs();
  bindFilters();
  bindShareActions();
  bindRecipeDialogs();
  bindIngredientDialog();
  loadOrderHistory();
  await loadData();
});

function bindTabs() {
  document.querySelectorAll('.tab').forEach(function(button) {
    button.addEventListener('click', function() {
      setTab(button.dataset.tab);
    });
  });
}

function bindFilters() {
  ['recipeSearch', 'recipeStatus', 'ingredientSearch', 'ingredientCategoryFilter'].forEach(function(id) {
    const node = document.getElementById(id);
    if (!node) return;
    node.addEventListener('input', renderAll);
    node.addEventListener('change', renderAll);
  });
}

function bindShareActions() {
  document.getElementById('clearSelectedIngredients').addEventListener('click', function() {
    state.selectedIngredients = [''];
    renderAll();
  });

  document.getElementById('addShareIngredientRowBtn').addEventListener('click', function() {
    state.selectedIngredients.push('');
    renderAll();
  });

  document.getElementById('openAddIngredientFromShareBtn').addEventListener('click', function() {
    openIngredientDialog('share');
  });

  document.getElementById('copyLineTextBtn').addEventListener('click', async function() {
    await copyTextFromNode('lineShareText', this, 'คัดลอกข้อความ', 'คัดลอกแล้ว');
  });

  document.getElementById('copyOrderTextBtn').addEventListener('click', async function() {
    await copyTextFromNode('orderLineText', this, 'คัดลอกข้อความ', 'คัดลอกแล้ว');
  });

  document.getElementById('clearOrderBtn').addEventListener('click', function() {
    state.cart = [];
    renderAll();
  });

  document.getElementById('saveOrderBtn').addEventListener('click', saveCurrentOrder);
  document.getElementById('clearHistoryBtn').addEventListener('click', clearOrderHistory);
}

function bindRecipeDialogs() {
  document.getElementById('openAddRecipeBtn').addEventListener('click', function() {
    openRecipeDialog();
  });

  document.getElementById('addIngredientRowBtn').addEventListener('click', function() {
    appendRecipeIngredientRow('');
  });

  document.getElementById('openAddIngredientFromRecipeBtn').addEventListener('click', function() {
    openIngredientDialog('recipe');
  });

  document.getElementById('closeRecipeDialog').addEventListener('click', closeRecipeDialog);
  document.getElementById('cancelRecipeDialog').addEventListener('click', closeRecipeDialog);
  document.getElementById('closeRecipeDetailDialog').addEventListener('click', function() {
    document.getElementById('recipeDetailDialog').close();
  });

  document.getElementById('recipeForm').addEventListener('submit', function(event) {
    event.preventDefault();
    saveRecipeFromDialog();
  });
}

function bindIngredientDialog() {
  document.getElementById('openAddIngredientBtn').addEventListener('click', function() {
    openIngredientDialog('ingredients');
  });

  document.getElementById('closeIngredientDialog').addEventListener('click', closeIngredientDialog);
  document.getElementById('cancelIngredientDialog').addEventListener('click', closeIngredientDialog);

  document.getElementById('ingredientForm').addEventListener('submit', function(event) {
    event.preventDefault();
    saveIngredientFromDialog();
  });
}

function loadOrderHistory() {
  try {
    const raw = localStorage.getItem(ORDER_HISTORY_KEY);
    state.orderHistory = raw ? JSON.parse(raw) : [];
  } catch (error) {
    state.orderHistory = [];
  }
}

function persistOrderHistory() {
  localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(state.orderHistory));
}

async function loadData() {
  try {
    const response = await fetch('./data/menu-data.json', { cache: 'force-cache' });
    const defaults = await response.json();
    const stored = loadStoredData();
    state.data = transformData(stored || defaults);
    if (!state.selectedIngredients.length) {
      state.selectedIngredients = [''];
    }
    populateIngredientCategoryOptions();
    renderAll();
  } catch (error) {
    document.getElementById('recipeList').innerHTML = '<div class="empty-state">โหลดข้อมูลไม่สำเร็จ</div>';
  }
}

function loadStoredData() {
  try {
    const raw = localStorage.getItem(APP_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function persistAppData() {
  if (!state.data) return;
  const payload = {
    ingredients: state.data.ingredients.map(function(item) {
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        stockQty: item.stockQty,
        unit: item.unit,
        purchasePrice: item.purchasePrice,
        imageUrl: item.imageUrl,
        notes: item.notes,
      };
    }),
    recipes: state.data.recipes.map(function(recipe) {
      return {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        imageUrl: recipe.imageUrl,
        notes: recipe.notes,
        ingredientsText: recipe.ingredientsText,
        methodText: recipe.methodText,
        youtubeUrl: recipe.youtubeUrl,
        items: recipe.items.map(function(item) {
          return {
            ingredientId: item.ingredientId,
            requiredQty: 1,
          };
        }),
      };
    }),
  };
  localStorage.setItem(APP_DATA_KEY, JSON.stringify(payload));
}

function transformData(payload) {
  const ingredients = (payload.ingredients || []).map(function(item) {
    return {
      id: item.id,
      name: item.name,
      category: item.category || '',
      stockQty: Number(item.stockQty || 0),
      unit: item.unit || '',
      purchasePrice: Number(item.purchasePrice || 0),
      imageUrl: item.imageUrl || '',
      notes: item.notes || '',
    };
  });

  const ingredientMap = Object.fromEntries(ingredients.map(function(item) {
    return [item.id, item];
  }));

  const recipes = (payload.recipes || []).map(function(recipe) {
    const items = (recipe.items || []).map(function(item) {
      const ingredient = ingredientMap[item.ingredientId] || {};
      const requiredQty = 1;
      const availableQty = Number(ingredient.stockQty || 0);
      const missingQty = Math.max(0, requiredQty - availableQty);
      return {
        ingredientId: item.ingredientId,
        ingredientName: ingredient.name || 'ไม่ทราบชื่อ',
        unit: ingredient.unit || '',
        requiredQty: requiredQty,
        availableQty: availableQty,
        missingQty: missingQty,
        missingCost: missingQty * Number(ingredient.purchasePrice || 0),
      };
    });

    return {
      id: recipe.id,
      name: recipe.name,
      category: recipe.category || '',
      imageUrl: recipe.imageUrl || '',
      notes: recipe.notes || '',
      ingredientsText: recipe.ingredientsText || '',
      methodText: recipe.methodText || '',
      youtubeUrl: recipe.youtubeUrl || '',
      items: items,
      canCook: items.every(function(item) { return item.missingQty === 0; }),
      estimatedMissingCost: items.reduce(function(sum, item) { return sum + item.missingCost; }, 0),
    };
  });

  return { ingredients: ingredients, recipes: recipes };
}

function populateIngredientCategoryOptions() {
  const categories = getIngredientCategories();
  const filter = document.getElementById('ingredientCategoryFilter');
  const datalist = document.getElementById('ingredientCategorySuggestions');

  filter.innerHTML = '<option value="all">ทุกหมวดหมู่</option>' + categories.map(function(category) {
    return '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + '</option>';
  }).join('');

  datalist.innerHTML = categories.map(function(category) {
    return '<option value="' + escapeHtml(category) + '"></option>';
  }).join('');
}

function getIngredientCategories() {
  return Array.from(new Set(state.data.ingredients.map(function(item) {
    return String(item.category || '').trim();
  }).filter(Boolean))).sort(function(a, b) {
    return a.localeCompare(b, 'th');
  });
}

function renderAll() {
  if (!state.data) return;
  renderSummary();
  renderRecipes();
  renderIngredients();
  renderCart();
  renderDailyOrders();
  renderShareIngredientRows();
  renderAvailableMenus();
  updateTabUI();
}

function renderSummary() {
  const todayCount = state.orderHistory.filter(function(order) {
    return order.dateKey === getDateKeyFromDate(new Date());
  }).length;

  const cards = [
    {
      label: 'ทำได้เลย',
      value: state.data.recipes.filter(function(recipe) { return recipe.canCook; }).length + ' / ' + state.data.recipes.length,
    },
    {
      label: 'ยอดรายการสั่ง',
      value: String(state.cart.reduce(function(sum, item) { return sum + item.qty; }, 0)),
    },
    {
      label: 'ออเดอร์วันนี้',
      value: String(todayCount),
    },
  ];

  document.getElementById('summaryCards').innerHTML = cards.map(function(card) {
    return '<div class="stat-card"><span>' + escapeHtml(card.label) + '</span><strong>' + escapeHtml(card.value) + '</strong></div>';
  }).join('');
}

function renderRecipes() {
  const search = normalizeText(document.getElementById('recipeSearch').value);
  const status = document.getElementById('recipeStatus').value;
  const container = document.getElementById('recipeList');
  const template = document.getElementById('recipeCardTemplate');

  const recipes = state.data.recipes.filter(function(recipe) {
    const haystack = normalizeText([recipe.name, recipe.category, recipe.notes, recipe.ingredientsText, recipe.methodText].join(' '));
    const matchesText = !search || haystack.includes(search);
    const matchesStatus = status === 'cookable' ? recipe.canCook : status === 'need-buy' ? !recipe.canCook : true;
    return matchesText && matchesStatus;
  });

  if (!recipes.length) {
    container.innerHTML = '<div class="empty-state">ไม่พบเมนูตามเงื่อนไขที่เลือก</div>';
    return;
  }

  container.innerHTML = '';
  recipes.forEach(function(recipe) {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('.card-image').src = recipe.imageUrl || createPlaceholderImage();
    fragment.querySelector('.card-image').alt = recipe.name;
    fragment.querySelector('h3').textContent = recipe.name;
    fragment.querySelector('.category').textContent = recipe.category || 'ไม่ระบุประเภท';
    fragment.querySelector('.notes').textContent = recipe.notes || '';
    fragment.querySelector('.price-badge').textContent = recipe.canCook ? 'ทำได้เลย' : 'ต้องซื้อเพิ่ม ' + formatCurrency(recipe.estimatedMissingCost);
    fragment.querySelector('.ingredients-used').innerHTML = recipe.items.map(function(item) {
      return '<span class="chip">' + escapeHtml(item.ingredientName) + '</span>';
    }).join('');

    fragment.querySelector('.detail-btn').addEventListener('click', function() {
      openRecipeDetail(recipe.id);
    });
    fragment.querySelector('.edit-btn').addEventListener('click', function() {
      openRecipeDialog(recipe.id);
    });
    fragment.querySelector('.add-cart-btn').addEventListener('click', function() {
      addRecipeToOrder(recipe);
      setTab('cart');
      renderAll();
    });

    container.appendChild(fragment);
  });
}

function renderIngredients() {
  const search = normalizeText(document.getElementById('ingredientSearch').value);
  const category = document.getElementById('ingredientCategoryFilter').value;
  const list = document.getElementById('ingredientList');
  const recipeUsage = buildRecipeUsageMap();

  const ingredients = state.data.ingredients.filter(function(item) {
    const haystack = normalizeText([item.name, item.category, item.notes].join(' '));
    const matchesSearch = !search || haystack.includes(search);
    const matchesCategory = category === 'all' || item.category === category;
    return matchesSearch && matchesCategory;
  });

  if (!ingredients.length) {
    list.innerHTML = '<div class="empty-state">ไม่พบวัตถุดิบที่ค้นหา</div>';
    return;
  }

  list.innerHTML = ingredients.map(function(item) {
    const uses = recipeUsage[item.id] || [];
    return `
      <article class="card simple-item">
        <div class="title-row">
          <h3>${escapeHtml(item.name)}</h3>
          <span>${escapeHtml(item.unit || '-')}</span>
        </div>
        <div class="meta-row">
          <span>${escapeHtml(item.category || 'ไม่ระบุหมวด')}</span>
          <span>${formatCurrency(item.purchasePrice || 0)}</span>
        </div>
        <p class="notes">${escapeHtml(item.notes || '')}</p>
        <div class="chips">
          ${uses.length ? uses.map(function(name) {
            return '<span class="chip">' + escapeHtml(name) + '</span>';
          }).join('') : '<span class="chip warn">ยังไม่ถูกใช้ในเมนู</span>'}
        </div>
      </article>
    `;
  }).join('');
}

function buildRecipeUsageMap() {
  const usage = {};
  state.data.recipes.forEach(function(recipe) {
    recipe.items.forEach(function(item) {
      if (!usage[item.ingredientId]) {
        usage[item.ingredientId] = [];
      }
      usage[item.ingredientId].push(recipe.name);
    });
  });
  return usage;
}

function renderCart() {
  const cartList = document.getElementById('cartList');
  if (!state.cart.length) {
    cartList.innerHTML = '<div class="empty-state">ยังไม่มีเมนูในตะกร้าออเดอร์</div>';
  } else {
    cartList.innerHTML = state.cart.map(function(item, index) {
      return `
        <div class="cart-item">
          <strong>${escapeHtml(item.name)}</strong>
          <div class="meta-row">
            <span>${escapeHtml(String(item.qty))} จาน</span>
            <span>${item.canCook ? 'พร้อมทำ' : 'ต้องซื้อเพิ่ม ' + formatCurrency(item.estimatedMissingCost)}</span>
          </div>
          <div class="chips">
            ${item.items.map(function(ingredient) {
              return '<span class="chip">' + escapeHtml(ingredient.ingredientName) + '</span>';
            }).join('')}
          </div>
          <div class="actions">
            <button class="secondary" type="button" onclick="changeOrderQty(${index}, 1)">+1</button>
            <button class="secondary" type="button" onclick="changeOrderQty(${index}, -1)">-1</button>
            <button class="ghost" type="button" onclick="removeCartItem(${index})">ลบ</button>
          </div>
        </div>
      `;
    }).join('');
  }

  const orderText = buildOrderLineText();
  document.getElementById('orderLineText').value = orderText;
  document.getElementById('orderLineLink').href = 'https://line.me/R/msg/text/?' + encodeURIComponent(orderText);
  document.getElementById('orderShareBox').classList.toggle('is-hidden', !state.cart.length);
}

function renderDailyOrders() {
  const container = document.getElementById('dailyOrdersList');
  if (!state.orderHistory.length) {
    container.innerHTML = '<div class="empty-state">ยังไม่มีออเดอร์ที่บันทึกไว้</div>';
    return;
  }

  const grouped = state.orderHistory.reduce(function(map, order) {
    if (!map[order.dateKey]) {
      map[order.dateKey] = [];
    }
    map[order.dateKey].push(order);
    return map;
  }, {});

  container.innerHTML = Object.keys(grouped).sort().reverse().map(function(dateKey) {
    const orders = grouped[dateKey];
    return `
      <section class="daily-order-group">
        <div class="daily-order-head">
          <h3>${escapeHtml(formatDateLabel(dateKey))}</h3>
          <span class="chip">${orders.length} ออเดอร์</span>
        </div>
        <div class="daily-order-list">
          ${orders.map(function(order) {
            return `
              <article class="daily-order-item">
                <div class="title-row">
                  <strong>${escapeHtml(order.timeLabel)}</strong>
                  <button class="ghost small-button" type="button" onclick="removeHistoryOrder('${escapeHtml(order.id)}')">ลบ</button>
                </div>
                <div class="chips">
                  ${order.items.map(function(item) {
                    return '<span class="chip">' + escapeHtml(item.name + ' x ' + item.qty) + '</span>';
                  }).join('')}
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function renderShareIngredientRows() {
  const container = document.getElementById('shareIngredientRows');
  if (!state.selectedIngredients.length) {
    state.selectedIngredients = [''];
  }

  container.innerHTML = state.selectedIngredients.map(function(selectedId, index) {
    return `
      <div class="ingredient-editor-item">
        <select data-share-index="${index}">
          ${buildIngredientOptions(selectedId, true)}
        </select>
        <button class="ghost" type="button" data-remove-share-index="${index}">ลบ</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-share-index]').forEach(function(select) {
    select.addEventListener('change', function() {
      state.selectedIngredients[Number(select.dataset.shareIndex)] = select.value;
      renderAll();
    });
  });

  container.querySelectorAll('[data-remove-share-index]').forEach(function(button) {
    button.addEventListener('click', function() {
      const index = Number(button.dataset.removeShareIndex);
      if (state.selectedIngredients.length <= 1) {
        state.selectedIngredients = [''];
      } else {
        state.selectedIngredients.splice(index, 1);
      }
      renderAll();
    });
  });
}

function renderAvailableMenus() {
  const selectedIds = getSelectedShareIngredientIds();
  const selectedIngredients = state.data.ingredients.filter(function(item) {
    return selectedIds.includes(item.id);
  });
  const availableMenus = getMenusFromSelectedIngredients(selectedIds);

  document.getElementById('selectedIngredientChips').innerHTML = selectedIngredients.length
    ? selectedIngredients.map(function(item) { return '<span class="chip">' + escapeHtml(item.name) + '</span>'; }).join('')
    : '<span class="chip warn">ยังไม่ได้เลือกวัตถุดิบ</span>';

  document.getElementById('availableMenuCount').textContent = availableMenus.length + ' เมนู';
  document.getElementById('availableMenuList').innerHTML = availableMenus.length
    ? availableMenus.map(function(recipe) {
      return `
        <div class="menu-list-item">
          <h4>${escapeHtml(recipe.name)}</h4>
          <div class="meta-row">
            <span>${escapeHtml(recipe.category || 'ไม่ระบุประเภท')}</span>
            <span>วัตถุดิบหลัก ${recipe.items.filter(function(item) {
              const ingredient = state.data.ingredients.find(function(entry) { return entry.id === item.ingredientId; });
              return isCoreShareIngredient(ingredient);
            }).length} รายการ</span>
          </div>
        </div>
      `;
    }).join('')
    : '<div class="empty-state">ยังไม่มีเมนูที่ตรงกับวัตถุดิบที่เลือก</div>';

  const shareText = buildLineShareText(selectedIngredients, availableMenus, selectedIds.length);
  document.getElementById('lineShareText').value = shareText;
  document.getElementById('lineShareLink').href = 'https://line.me/R/msg/text/?' + encodeURIComponent(shareText);
}

function getSelectedShareIngredientIds() {
  return Array.from(new Set(state.selectedIngredients.map(function(id) {
    return String(id || '').trim();
  }).filter(Boolean)));
}

function openRecipeDialog(recipeId) {
  state.editingRecipeId = recipeId || null;
  const recipe = recipeId ? state.data.recipes.find(function(item) { return item.id === recipeId; }) : null;
  document.getElementById('recipeDialogTitle').textContent = recipe ? 'แก้ไขเมนู' : 'เพิ่มเมนู';
  document.getElementById('recipeNameInput').value = recipe ? recipe.name : '';
  document.getElementById('recipeCategoryInput').value = recipe ? recipe.category : '';
  document.getElementById('recipeImageInput').value = recipe ? recipe.imageUrl : '';
  document.getElementById('recipeNotesInput').value = recipe ? recipe.notes : '';
  document.getElementById('recipeIngredientsTextInput').value = recipe ? recipe.ingredientsText : '';
  document.getElementById('recipeMethodTextInput').value = recipe ? recipe.methodText : '';
  document.getElementById('recipeYoutubeInput').value = recipe ? recipe.youtubeUrl : '';
  renderRecipeIngredientEditor(recipe);
  document.getElementById('recipeDialog').showModal();
}

function renderRecipeIngredientEditor(recipe) {
  const container = document.getElementById('recipeIngredientEditor');
  const selectedIds = recipe ? recipe.items.map(function(item) { return item.ingredientId; }) : [''];
  container.innerHTML = '';
  (selectedIds.length ? selectedIds : ['']).forEach(function(id) {
    appendRecipeIngredientRow(id);
  });
}

function appendRecipeIngredientRow(selectedId) {
  const container = document.getElementById('recipeIngredientEditor');
  const row = document.createElement('div');
  row.className = 'ingredient-editor-item';
  row.innerHTML = `
    <select class="ingredient-select">
      ${buildIngredientOptions(selectedId, false)}
    </select>
    <button class="ghost remove-ingredient-row" type="button">ลบ</button>
  `;

  row.querySelector('.remove-ingredient-row').addEventListener('click', function() {
    const rows = container.querySelectorAll('.ingredient-editor-item');
    if (rows.length <= 1) {
      row.querySelector('.ingredient-select').value = '';
      return;
    }
    row.remove();
  });

  container.appendChild(row);
}

function buildIngredientOptions(selectedId, coreOnly) {
  const ingredients = coreOnly
    ? state.data.ingredients.filter(function(item) { return isCoreShareIngredient(item); })
    : state.data.ingredients;

  return ['<option value="">เลือกวัตถุดิบ</option>'].concat(ingredients.map(function(item) {
    const selected = item.id === selectedId ? ' selected' : '';
    return '<option value="' + escapeHtml(item.id) + '"' + selected + '>' + escapeHtml(item.name) + '</option>';
  })).join('');
}

function closeRecipeDialog() {
  document.getElementById('recipeDialog').close();
  state.editingRecipeId = null;
}

function saveRecipeFromDialog() {
  const name = document.getElementById('recipeNameInput').value.trim();
  if (!name) {
    alert('กรุณาใส่ชื่อเมนู');
    return;
  }

  const seen = new Set();
  const items = Array.from(document.querySelectorAll('#recipeIngredientEditor .ingredient-select')).map(function(select) {
    const id = String(select.value || '').trim();
    if (!id || seen.has(id)) return null;
    seen.add(id);
    return { ingredientId: id, requiredQty: 1 };
  }).filter(Boolean);

  if (!items.length) {
    alert('กรุณาเลือกวัตถุดิบอย่างน้อย 1 รายการ');
    return;
  }

  const recipeRecord = {
    id: state.editingRecipeId || 'REC' + Date.now(),
    name: name,
    category: document.getElementById('recipeCategoryInput').value.trim(),
    imageUrl: document.getElementById('recipeImageInput').value.trim(),
    notes: document.getElementById('recipeNotesInput').value.trim(),
    ingredientsText: document.getElementById('recipeIngredientsTextInput').value.trim(),
    methodText: document.getElementById('recipeMethodTextInput').value.trim(),
    youtubeUrl: document.getElementById('recipeYoutubeInput').value.trim(),
    items: items,
  };

  const recipes = state.data.recipes.map(function(recipe) {
    return {
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      imageUrl: recipe.imageUrl,
      notes: recipe.notes,
      ingredientsText: recipe.ingredientsText,
      methodText: recipe.methodText,
      youtubeUrl: recipe.youtubeUrl,
      items: recipe.items.map(function(item) {
        return { ingredientId: item.ingredientId, requiredQty: 1 };
      }),
    };
  });

  const index = recipes.findIndex(function(recipe) { return recipe.id === recipeRecord.id; });
  if (index >= 0) recipes[index] = recipeRecord;
  else recipes.push(recipeRecord);

  state.data = transformData({
    ingredients: state.data.ingredients,
    recipes: recipes,
  });
  persistAppData();
  closeRecipeDialog();
  renderAll();
}

function openIngredientDialog(context) {
  state.ingredientDialogContext = context;
  document.getElementById('ingredientDialogTitle').textContent = 'เพิ่มวัตถุดิบ';
  document.getElementById('ingredientNameInput').value = '';
  document.getElementById('ingredientCategoryInput').value = '';
  document.getElementById('ingredientUnitInput').value = '';
  document.getElementById('ingredientPriceInput').value = '';
  document.getElementById('ingredientNotesInput').value = '';
  document.getElementById('ingredientDialog').showModal();
}

function closeIngredientDialog() {
  document.getElementById('ingredientDialog').close();
}

function saveIngredientFromDialog() {
  const name = document.getElementById('ingredientNameInput').value.trim();
  if (!name) {
    alert('กรุณาใส่ชื่อวัตถุดิบ');
    return;
  }

  const ingredient = {
    id: 'ING' + Date.now(),
    name: name,
    category: document.getElementById('ingredientCategoryInput').value.trim() || 'อื่นๆ',
    stockQty: 1,
    unit: document.getElementById('ingredientUnitInput').value.trim(),
    purchasePrice: Number(document.getElementById('ingredientPriceInput').value || 0),
    imageUrl: '',
    notes: document.getElementById('ingredientNotesInput').value.trim(),
  };

  state.data = transformData({
    ingredients: state.data.ingredients.concat(ingredient),
    recipes: state.data.recipes.map(function(recipe) {
      return {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        imageUrl: recipe.imageUrl,
        notes: recipe.notes,
        ingredientsText: recipe.ingredientsText,
        methodText: recipe.methodText,
        youtubeUrl: recipe.youtubeUrl,
        items: recipe.items.map(function(item) {
          return { ingredientId: item.ingredientId, requiredQty: 1 };
        }),
      };
    }),
  });

  populateIngredientCategoryOptions();
  persistAppData();
  closeIngredientDialog();

  if (state.ingredientDialogContext === 'recipe') {
    appendRecipeIngredientRow(ingredient.id);
  }
  if (state.ingredientDialogContext === 'share') {
    state.selectedIngredients.push(ingredient.id);
  }

  renderAll();
}

function openRecipeDetail(recipeId) {
  const recipe = state.data.recipes.find(function(item) { return item.id === recipeId; });
  if (!recipe) return;

  const youtubeEmbedUrl = toYoutubeEmbedUrl(recipe.youtubeUrl);
  document.getElementById('recipeDetailTitle').textContent = recipe.name;
  document.getElementById('recipeDetailBody').innerHTML = `
    <div class="detail-grid">
      <img class="detail-image" src="${escapeHtml(recipe.imageUrl || createPlaceholderImage())}" alt="${escapeHtml(recipe.name)}" loading="lazy" decoding="async">
      <div class="meta-row">
        <span>${escapeHtml(recipe.category || 'ไม่ระบุประเภท')}</span>
        <span class="price">${recipe.canCook ? 'ทำได้เลย' : 'ต้องซื้อเพิ่ม ' + formatCurrency(recipe.estimatedMissingCost)}</span>
      </div>
      ${recipe.notes ? '<p class="detail-note">' + escapeHtml(recipe.notes) + '</p>' : ''}
      <div class="detail-section">
        <h4>วัตถุดิบที่ใช้</h4>
        <div class="menu-list">
          ${recipe.items.map(function(item) {
            return '<div class="detail-ingredient"><strong>' + escapeHtml(item.ingredientName) + '</strong></div>';
          }).join('')}
        </div>
      </div>
      ${recipe.ingredientsText ? '<div class="detail-section"><h4>วัตถุดิบ</h4><div class="detail-longtext">' + formatLongText(recipe.ingredientsText) + '</div></div>' : ''}
      ${recipe.methodText ? '<div class="detail-section"><h4>วิธีทำ</h4><div class="detail-longtext">' + formatLongText(recipe.methodText) + '</div></div>' : ''}
      ${youtubeEmbedUrl ? '<div class="detail-section"><h4>วิดีโอ YouTube</h4><div class="video-embed"><iframe src="' + escapeHtml(youtubeEmbedUrl) + '" title="' + escapeHtml('วิดีโอ ' + recipe.name) + '" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>' : ''}
      ${recipe.youtubeUrl ? '<a class="ghost inline-link" href="' + escapeHtml(recipe.youtubeUrl) + '" target="_blank" rel="noopener noreferrer">เปิดดูบน YouTube</a>' : ''}
      <div class="actions">
        <button class="secondary" type="button" onclick="openRecipeDialog('${recipe.id}')">แก้ไขเมนูนี้</button>
        <button class="primary" type="button" onclick="handleDetailAddToCart('${recipe.id}')">เพิ่มในตะกร้า</button>
      </div>
    </div>
  `;
  document.getElementById('recipeDetailDialog').showModal();
}

function handleDetailAddToCart(recipeId) {
  const recipe = state.data.recipes.find(function(item) { return item.id === recipeId; });
  if (!recipe) return;
  addRecipeToOrder(recipe);
  document.getElementById('recipeDetailDialog').close();
  setTab('cart');
  renderAll();
}

function addRecipeToOrder(recipe) {
  const existing = state.cart.find(function(item) { return item.id === recipe.id; });
  if (existing) {
    existing.qty += 1;
    return;
  }

  state.cart.push({
    id: recipe.id,
    name: recipe.name,
    qty: 1,
    items: recipe.items,
    canCook: recipe.canCook,
    estimatedMissingCost: recipe.estimatedMissingCost,
  });
}

function saveCurrentOrder() {
  if (!state.cart.length) {
    alert('ยังไม่มีออเดอร์ให้บันทึก');
    return;
  }

  const now = new Date();
  state.orderHistory.unshift({
    id: 'ORD' + now.getTime(),
    dateKey: getDateKeyFromDate(now),
    timeLabel: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    items: state.cart.map(function(item) {
      return { name: item.name, qty: item.qty };
    }),
  });
  persistOrderHistory();
  state.cart = [];
  setTab('daily-orders');
  renderAll();
}

function clearOrderHistory() {
  if (!state.orderHistory.length) return;
  if (!window.confirm('ต้องการล้างประวัติออเดอร์ทั้งหมดหรือไม่')) return;
  state.orderHistory = [];
  persistOrderHistory();
  renderAll();
}

function removeHistoryOrder(orderId) {
  state.orderHistory = state.orderHistory.filter(function(order) {
    return order.id !== orderId;
  });
  persistOrderHistory();
  renderAll();
}

function changeOrderQty(index, delta) {
  const item = state.cart[index];
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    state.cart.splice(index, 1);
  }
  renderAll();
}

function removeCartItem(index) {
  state.cart.splice(index, 1);
  renderAll();
}

function getMenusFromSelectedIngredients(selectedIds) {
  return state.data.recipes.filter(function(recipe) {
    const coreItems = recipe.items.filter(function(item) {
      const ingredient = state.data.ingredients.find(function(entry) { return entry.id === item.ingredientId; });
      return isCoreShareIngredient(ingredient);
    });
    if (!coreItems.length) return false;
    return coreItems.every(function(item) {
      return selectedIds.includes(item.ingredientId);
    });
  });
}

function isCoreShareIngredient(ingredient) {
  return CORE_SHARE_CATEGORIES.has(String(ingredient && ingredient.category || '').trim());
}

function buildLineShareText(selectedIngredients, availableMenus, totalSelected) {
  const ingredientLines = selectedIngredients.length
    ? selectedIngredients.map(function(item) { return '- ' + item.name; }).join('\n')
    : '- ยังไม่ได้เลือกวัตถุดิบ';
  const menuLines = availableMenus.length
    ? availableMenus.map(function(recipe) { return '- ' + recipe.name; }).join('\n')
    : '- ยังไม่มีเมนูที่ทำได้จากวัตถุดิบที่เลือก';

  return ['สรุปวัตถุดิบที่มีตอนนี้', 'เลือกไว้ ' + totalSelected + ' รายการ', '', ingredientLines, '', 'เมนูที่ทำได้', menuLines].join('\n');
}

function buildOrderLineText() {
  if (!state.cart.length) return 'ยังไม่มีออเดอร์';
  return ['สรุปออเดอร์', ''].concat(state.cart.map(function(item) {
    return '- ' + item.name + ' x ' + item.qty + ' จาน';
  })).join('\n');
}

function getDateKeyFromDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDateLabel(dateKey) {
  const parts = dateKey.split('-');
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function setTab(tab) {
  state.activeTab = tab;
  updateTabUI();
}

function updateTabUI() {
  document.querySelectorAll('.tab').forEach(function(button) {
    button.classList.toggle('is-active', button.dataset.tab === state.activeTab);
  });
  document.querySelectorAll('[data-panel]').forEach(function(panel) {
    panel.classList.toggle('is-hidden', panel.dataset.panel !== state.activeTab);
  });
}

async function copyTextFromNode(nodeId, button, defaultLabel, successLabel) {
  try {
    await navigator.clipboard.writeText(document.getElementById(nodeId).value);
    button.textContent = successLabel;
    setTimeout(function() {
      button.textContent = defaultLabel;
    }, 1500);
  } catch (error) {
    alert('คัดลอกไม่สำเร็จ ลองคัดลอกด้วยตัวเองจากกล่องข้อความ');
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatLongText(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function toYoutubeEmbedUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/\//g, '');
      return id ? 'https://www.youtube.com/embed/' + encodeURIComponent(id) : '';
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const videoId = parsed.searchParams.get('v');
      if (videoId) return 'https://www.youtube.com/embed/' + encodeURIComponent(videoId);
      const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/);
      if (embedMatch) return 'https://www.youtube.com/embed/' + encodeURIComponent(embedMatch[1]);
    }
  } catch (error) {
    return '';
  }

  return '';
}

function createPlaceholderImage() {
  return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=70';
}
