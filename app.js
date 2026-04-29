const state = {
  data: null,
  activeTab: 'recipes',
  cart: [],
  selectedIngredients: new Set(),
  editingRecipeId: null,
};

const CORE_SHARE_CATEGORIES = new Set(['โปรตีน', 'ผัก', 'ซีฟู้ด']);

document.addEventListener('DOMContentLoaded', async function() {
  bindTabs();
  bindFilters();
  bindShareActions();
  bindRecipeDialogs();
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
  ['recipeSearch', 'recipeStatus', 'ingredientSearch', 'shareIngredientSearch'].forEach(function(id) {
    const node = document.getElementById(id);
    if (!node) return;
    node.addEventListener('input', renderAll);
    node.addEventListener('change', renderAll);
  });
}

function bindShareActions() {
  document.getElementById('clearSelectedIngredients').addEventListener('click', function() {
    state.selectedIngredients.clear();
    renderAll();
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
}

function bindRecipeDialogs() {
  document.getElementById('openAddRecipeBtn').addEventListener('click', function() {
    openRecipeDialog();
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

async function loadData() {
  try {
    const response = await fetch('./data/menu-data.json', { cache: 'force-cache' });
    const payload = await response.json();
    state.data = transformData(payload);
    renderAll();
  } catch (error) {
    document.getElementById('recipeList').innerHTML = '<div class="empty-state">โหลดข้อมูลไม่สำเร็จ</div>';
  }
}

function transformData(payload) {
  const ingredients = payload.ingredients || [];
  const ingredientMap = Object.fromEntries(ingredients.map(function(item) {
    return [item.id, item];
  }));

  const recipes = (payload.recipes || []).map(function(recipe) {
    const items = (recipe.items || []).map(function(item) {
      const ingredient = ingredientMap[item.ingredientId] || {};
      const availableQty = Number(ingredient.stockQty || 0);
      const requiredQty = Number(item.requiredQty || 0);
      const missingQty = Math.max(0, requiredQty - availableQty);
      const purchasePrice = Number(ingredient.purchasePrice || 0);

      return {
        ingredientId: item.ingredientId,
        ingredientName: ingredient.name || 'ไม่ทราบชื่อ',
        unit: ingredient.unit || '',
        requiredQty: requiredQty,
        availableQty: availableQty,
        missingQty: missingQty,
        missingCost: missingQty * purchasePrice,
        purchasePrice: purchasePrice,
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

  return {
    ingredients: ingredients,
    recipes: recipes,
  };
}

function renderAll() {
  if (!state.data) return;
  renderSummary();
  renderRecipes();
  renderIngredients();
  renderCart();
  renderIngredientChecklist();
  renderAvailableMenus();
  updateTabUI();
}

function renderSummary() {
  const shareMenus = getMenusFromSelectedIngredients();
  const summaryCards = [
    {
      label: 'ทำได้เลย',
      value: state.data.recipes.filter(function(recipe) { return recipe.canCook; }).length + ' / ' + state.data.recipes.length,
    },
    {
      label: 'ยอดรายการสั่ง',
      value: String(state.cart.reduce(function(sum, item) { return sum + item.qty; }, 0)),
    },
    {
      label: 'เมนูจากของที่มี',
      value: String(shareMenus.length),
    },
  ];

  document.getElementById('summaryCards').innerHTML = summaryCards.map(function(card) {
    return '<div class="stat-card"><span>' + escapeHtml(card.label) + '</span><strong>' + escapeHtml(card.value) + '</strong></div>';
  }).join('');
}

function renderRecipes() {
  const search = normalizeText(document.getElementById('recipeSearch').value);
  const status = document.getElementById('recipeStatus').value;
  const container = document.getElementById('recipeList');
  const template = document.getElementById('recipeCardTemplate');

  const recipes = state.data.recipes.filter(function(recipe) {
    const haystack = normalizeText([
      recipe.name,
      recipe.category,
      recipe.notes,
      recipe.ingredientsText,
      recipe.methodText,
    ].join(' '));
    const matchesText = !search || haystack.includes(search);
    const matchesStatus = status === 'cookable'
      ? recipe.canCook
      : status === 'need-buy'
        ? !recipe.canCook
        : true;

    return matchesText && matchesStatus;
  });

  if (!recipes.length) {
    container.innerHTML = '<div class="empty-state">ไม่พบเมนูตามเงื่อนไขที่เลือก</div>';
    return;
  }

  container.innerHTML = '';
  recipes.forEach(function(recipe) {
    const fragment = template.content.cloneNode(true);
    const image = fragment.querySelector('.card-image');
    const title = fragment.querySelector('h3');
    const category = fragment.querySelector('.category');
    const chips = fragment.querySelector('.ingredients-used');
    const notes = fragment.querySelector('.notes');
    const badge = fragment.querySelector('.price-badge');

    image.src = recipe.imageUrl || createPlaceholderImage();
    image.alt = recipe.name;
    title.textContent = recipe.name;
    category.textContent = recipe.category || 'ไม่ระบุประเภท';
    notes.textContent = recipe.notes || '';
    badge.textContent = recipe.canCook ? 'ทำได้เลย' : 'ต้องซื้อเพิ่ม ' + formatCurrency(recipe.estimatedMissingCost);

    chips.innerHTML = recipe.items.map(function(item) {
      return '<span class="chip">' + escapeHtml(item.ingredientName + ' x ' + item.requiredQty + ' ' + item.unit) + '</span>';
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
  const list = document.getElementById('ingredientList');
  const recipeUsage = {};

  state.data.recipes.forEach(function(recipe) {
    recipe.items.forEach(function(item) {
      recipeUsage[item.ingredientId] = recipeUsage[item.ingredientId] || [];
      recipeUsage[item.ingredientId].push(recipe.name);
    });
  });

  const ingredients = state.data.ingredients.filter(function(item) {
    const haystack = normalizeText([item.name, item.category, item.notes].join(' '));
    return !search || haystack.includes(search);
  });

  if (!ingredients.length) {
    list.innerHTML = '<div class="empty-state">ไม่พบวัตถุดิบที่ค้นหา</div>';
    return;
  }

  list.innerHTML = ingredients.map(function(item) {
    const uses = recipeUsage[item.id] || [];
    return `
      <article class="card simple-item">
        <h3>${escapeHtml(item.name)}</h3>
        <div class="meta-row">
          <span>${escapeHtml(item.category || 'ไม่ระบุหมวด')}</span>
          <span>${escapeHtml(item.unit || 'หน่วย')}</span>
        </div>
        <div class="chips">
          ${uses.length ? uses.map(function(name) {
            return '<span class="chip">' + escapeHtml(name) + '</span>';
          }).join('') : '<span class="chip warn">ยังไม่ถูกใช้ในเมนู</span>'}
        </div>
      </article>
    `;
  }).join('');
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

function renderIngredientChecklist() {
  const search = normalizeText(document.getElementById('shareIngredientSearch').value);
  const ingredients = state.data.ingredients.filter(function(item) {
    if (!isCoreShareIngredient(item)) {
      return false;
    }
    return !search || normalizeText([item.name, item.category].join(' ')).includes(search);
  });

  const container = document.getElementById('ingredientChecklist');
  if (!ingredients.length) {
    container.innerHTML = '<div class="empty-state">ไม่พบวัตถุดิบสำหรับเลือก</div>';
    return;
  }

  container.innerHTML = ingredients.map(function(item) {
    const checked = state.selectedIngredients.has(item.id) ? 'checked' : '';
    return `
      <label class="ingredient-check">
        <input type="checkbox" data-ingredient-check="${escapeHtml(item.id)}" ${checked}>
        <span>${escapeHtml(item.name)} <small>(${escapeHtml(item.unit || 'หน่วย')})</small></span>
      </label>
    `;
  }).join('');

  container.querySelectorAll('[data-ingredient-check]').forEach(function(node) {
    node.addEventListener('change', function() {
      const id = node.getAttribute('data-ingredient-check');
      if (node.checked) {
        state.selectedIngredients.add(id);
      } else {
        state.selectedIngredients.delete(id);
      }
      renderAll();
    });
  });
}

function renderAvailableMenus() {
  const selectedIds = Array.from(state.selectedIngredients);
  const selectedIngredients = state.data.ingredients.filter(function(item) {
    return state.selectedIngredients.has(item.id);
  });
  const availableMenus = getMenusFromSelectedIngredients();

  document.getElementById('selectedIngredientChips').innerHTML = selectedIngredients.length
    ? selectedIngredients.map(function(item) {
      return '<span class="chip">' + escapeHtml(item.name) + '</span>';
    }).join('')
    : '<span class="chip warn">ยังไม่ได้เลือกวัตถุดิบ</span>';

  document.getElementById('availableMenuCount').textContent = availableMenus.length + ' เมนู';
  document.getElementById('availableMenuList').innerHTML = availableMenus.length
    ? availableMenus.map(function(recipe) {
      const coreItemCount = recipe.items.filter(function(item) {
        const ingredient = state.data.ingredients.find(function(entry) {
          return entry.id === item.ingredientId;
        });
        return isCoreShareIngredient(ingredient);
      }).length;

      return `
        <div class="menu-list-item">
          <h4>${escapeHtml(recipe.name)}</h4>
          <div class="meta-row">
            <span>${escapeHtml(recipe.category || 'ไม่ระบุประเภท')}</span>
            <span>ใช้วัตถุดิบหลัก ${coreItemCount} รายการ</span>
          </div>
        </div>
      `;
    }).join('')
    : '<div class="empty-state">ยังไม่มีเมนูที่ตรงกับวัตถุดิบที่เลือก</div>';

  const shareText = buildLineShareText(selectedIngredients, availableMenus, selectedIds.length);
  document.getElementById('lineShareText').value = shareText;
  document.getElementById('lineShareLink').href = 'https://line.me/R/msg/text/?' + encodeURIComponent(shareText);
}

function openRecipeDialog(recipeId) {
  state.editingRecipeId = recipeId || null;
  const recipe = recipeId ? state.data.recipes.find(function(item) { return item.id === recipeId; }) : null;
  const dialog = document.getElementById('recipeDialog');

  document.getElementById('recipeDialogTitle').textContent = recipe ? 'แก้ไขเมนู' : 'เพิ่มเมนู';
  document.getElementById('recipeNameInput').value = recipe ? recipe.name : '';
  document.getElementById('recipeCategoryInput').value = recipe ? recipe.category : '';
  document.getElementById('recipeImageInput').value = recipe ? recipe.imageUrl : '';
  document.getElementById('recipeNotesInput').value = recipe ? recipe.notes : '';
  document.getElementById('recipeIngredientsTextInput').value = recipe ? recipe.ingredientsText : '';
  document.getElementById('recipeMethodTextInput').value = recipe ? recipe.methodText : '';
  document.getElementById('recipeYoutubeInput').value = recipe ? recipe.youtubeUrl : '';

  renderRecipeIngredientEditor(recipe);
  dialog.showModal();
}

function renderRecipeIngredientEditor(recipe) {
  const selectedItems = {};
  (recipe && recipe.items || []).forEach(function(item) {
    selectedItems[item.ingredientId] = item.requiredQty;
  });

  document.getElementById('recipeIngredientEditor').innerHTML = state.data.ingredients.map(function(ingredient) {
    const checked = selectedItems[ingredient.id] ? 'checked' : '';
    const qty = selectedItems[ingredient.id] || '';
    return `
      <div class="ingredient-editor-item">
        <label>
          <input type="checkbox" data-editor-ingredient="${escapeHtml(ingredient.id)}" ${checked}>
          <span>${escapeHtml(ingredient.name)}</span>
          <input type="number" min="0" step="0.01" value="${escapeHtml(String(qty))}" data-editor-qty="${escapeHtml(ingredient.id)}" placeholder="qty">
        </label>
      </div>
    `;
  }).join('');
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

  const items = state.data.ingredients.map(function(ingredient) {
    const checkedNode = document.querySelector('[data-editor-ingredient="' + ingredient.id + '"]');
    const qtyNode = document.querySelector('[data-editor-qty="' + ingredient.id + '"]');
    const checked = checkedNode && checkedNode.checked;
    const qty = Number(qtyNode && qtyNode.value || 0);

    if (!checked || qty <= 0) {
      return null;
    }

    return {
      ingredientId: ingredient.id,
      requiredQty: qty,
    };
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

  const rawRecipes = state.data.recipes.map(function(recipe) {
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
          requiredQty: item.requiredQty,
        };
      }),
    };
  });

  const existingIndex = rawRecipes.findIndex(function(recipe) {
    return recipe.id === recipeRecord.id;
  });

  if (existingIndex >= 0) {
    rawRecipes[existingIndex] = recipeRecord;
  } else {
    rawRecipes.push(recipeRecord);
  }

  state.data = transformData({
    ingredients: state.data.ingredients,
    recipes: rawRecipes,
  });

  closeRecipeDialog();
  renderAll();
}

function openRecipeDetail(recipeId) {
  const recipe = state.data.recipes.find(function(item) { return item.id === recipeId; });
  if (!recipe) return;

  const youtubeEmbedUrl = toYoutubeEmbedUrl(recipe.youtubeUrl);
  const detailBody = document.getElementById('recipeDetailBody');

  detailBody.innerHTML = `
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
            return '<div class="detail-ingredient"><strong>' + escapeHtml(item.ingredientName) + '</strong><span class="detail-note">ใช้ ' + escapeHtml(String(item.requiredQty)) + ' ' + escapeHtml(item.unit) + '</span></div>';
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

  document.getElementById('recipeDetailTitle').textContent = recipe.name;
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
  const existing = state.cart.find(function(item) {
    return item.id === recipe.id;
  });

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

function getMenusFromSelectedIngredients() {
  return state.data.recipes.filter(function(recipe) {
    const coreItems = recipe.items.filter(function(item) {
      const ingredient = state.data.ingredients.find(function(entry) {
        return entry.id === item.ingredientId;
      });
      return isCoreShareIngredient(ingredient);
    });

    if (!coreItems.length) {
      return false;
    }

    return coreItems.every(function(item) {
      return state.selectedIngredients.has(item.ingredientId);
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

  return [
    'สรุปวัตถุดิบที่มีตอนนี้',
    'เลือกไว้ ' + totalSelected + ' รายการ',
    '',
    ingredientLines,
    '',
    'เมนูที่ทำได้',
    menuLines,
  ].join('\n');
}

function buildOrderLineText() {
  if (!state.cart.length) {
    return 'ยังไม่มีออเดอร์';
  }

  const lines = state.cart.map(function(item) {
    return '- ' + item.name + ' x ' + item.qty + ' จาน';
  }).join('\n');

  return [
    'สรุปออเดอร์',
    '',
    lines,
  ].join('\n');
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
      if (videoId) {
        return 'https://www.youtube.com/embed/' + encodeURIComponent(videoId);
      }

      const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/);
      if (embedMatch) {
        return 'https://www.youtube.com/embed/' + encodeURIComponent(embedMatch[1]);
      }
    }
  } catch (error) {
    return '';
  }

  return '';
}

function createPlaceholderImage() {
  return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=70';
}
