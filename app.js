const state = {
  data: null,
  activeTab: 'recipes',
  cart: [],
  selectedIngredients: new Set(),
};

const CORE_SHARE_CATEGORIES = new Set(['โปรตีน', 'ผัก', 'ซีฟู้ด']);

document.addEventListener('DOMContentLoaded', async function() {
  bindTabs();
  bindFilters();
  bindShareActions();
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
  ['recipeSearch', 'recipeStatus', 'ingredientSearch', 'cartSearch', 'shareIngredientSearch'].forEach(function(id) {
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
    const text = document.getElementById('lineShareText').value;
    try {
      await navigator.clipboard.writeText(text);
      this.textContent = 'คัดลอกแล้ว';
      setTimeout(() => {
        this.textContent = 'คัดลอกข้อความ';
      }, 1500);
    } catch (error) {
      alert('คัดลอกไม่สำเร็จ ลองคัดลอกด้วยตัวเองจากกล่องข้อความ');
    }
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
  const ingredientMap = Object.fromEntries(ingredients.map(function(item) { return [item.id, item]; }));
  const recipes = (payload.recipes || []).map(function(recipe) {
    const items = (recipe.items || []).map(function(item) {
      const ingredient = ingredientMap[item.ingredientId] || {};
      const availableQty = Number(ingredient.stockQty || 0);
      const requiredQty = Number(item.requiredQty || 0);
      const missingQty = Math.max(0, requiredQty - availableQty);
      const purchasePrice = Number(ingredient.purchasePrice || 0);
      return {
        ingredientId: item.ingredientId,
        ingredientName: ingredient.name || 'Unknown',
        unit: ingredient.unit || '',
        requiredQty,
        availableQty,
        missingQty,
        missingCost: missingQty * purchasePrice,
        purchasePrice,
      };
    });

    return Object.assign({}, recipe, {
      items,
      canCook: items.every(function(item) { return item.missingQty === 0; }),
      estimatedMissingCost: items.reduce(function(sum, item) { return sum + item.missingCost; }, 0),
    });
  });

  return { ingredients, recipes };
}

function isCoreShareIngredient(ingredient) {
  return CORE_SHARE_CATEGORIES.has(String(ingredient && ingredient.category || '').trim());
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
      label: 'ยอดรายการซื้อ',
      value: formatCurrency(state.cart.reduce(function(sum, item) { return sum + item.totalCost; }, 0)),
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
    const haystack = normalizeText([recipe.name, recipe.category, recipe.notes].join(' '));
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
    const chips = fragment.querySelector('.chips');
    const notes = fragment.querySelector('.notes');
    const badge = fragment.querySelector('.price-badge');
    const addButton = fragment.querySelector('.add-cart-btn');

    image.src = recipe.imageUrl || createPlaceholderImage();
    image.alt = recipe.name;
    title.textContent = recipe.name;
    category.textContent = recipe.category || 'ไม่ระบุประเภท';
    notes.textContent = recipe.notes || '';
    badge.textContent = recipe.canCook ? 'ทำได้เลย' : 'ต้องซื้อเพิ่ม ' + formatCurrency(recipe.estimatedMissingCost);

    chips.innerHTML = recipe.items.map(function(item) {
      const label = item.missingQty === 0 ? 'พร้อม' : 'ขาด ' + item.missingQty + ' ' + item.unit;
      const type = item.missingQty === 0 ? 'ok' : 'warn';
      return '<span class="chip ' + type + '">' + escapeHtml(item.ingredientName + ' • ' + label) + '</span>';
    }).join('');

    addButton.addEventListener('click', function() {
      addMissingToCart(recipe);
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

  list.innerHTML = ingredients.length ? ingredients.map(function(item) {
    const uses = recipeUsage[item.id] || [];
    return `
      <article class="card simple-item">
        <h3>${escapeHtml(item.name)}</h3>
        <div class="meta-row">
          <span>${escapeHtml(item.category || 'ไม่ระบุหมวด')}</span>
          <span>คงเหลือ ${escapeHtml(String(item.stockQty || 0))} ${escapeHtml(item.unit || '')}</span>
        </div>
        <div class="meta-row">
          <span>ราคาซื้อ ${formatCurrency(item.purchasePrice || 0)} / ${escapeHtml(item.unit || 'หน่วย')}</span>
        </div>
        <div class="chips">
          ${uses.length ? uses.map(function(name) { return '<span class="chip">' + escapeHtml(name) + '</span>'; }).join('') : '<span class="chip warn">ยังไม่ถูกใช้ในเมนู</span>'}
        </div>
      </article>
    `;
  }).join('') : '<div class="empty-state">ไม่พบวัตถุดิบที่ค้นหา</div>';
}

function renderCart() {
  const search = normalizeText(document.getElementById('cartSearch').value);
  const items = state.cart.filter(function(item) {
    return !search || normalizeText([item.name, item.unit].join(' ')).includes(search);
  });

  const html = items.map(function(item, index) {
    return `
      <div class="cart-item">
        <strong>${escapeHtml(item.name)}</strong>
        <div class="meta-row">
          <span>${escapeHtml(String(item.qty))} ${escapeHtml(item.unit)} x ${formatCurrency(item.unitPrice)}</span>
          <span>${formatCurrency(item.totalCost)}</span>
        </div>
        <div class="actions">
          <button class="ghost" type="button" onclick="removeCartItem(${index})">ลบ</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('cartList').innerHTML = html
    ? html + '<div class="cart-item"><strong>รวมทั้งหมด</strong><div class="meta-row"><span></span><span>' + formatCurrency(state.cart.reduce(function(sum, item) { return sum + item.totalCost; }, 0)) + '</span></div></div>'
    : '<div class="empty-state">ยังไม่มีรายการซื้อ</div>';
}

function renderIngredientChecklist() {
  const search = normalizeText(document.getElementById('shareIngredientSearch').value);
  const ingredients = state.data.ingredients.filter(function(item) {
    if (!isCoreShareIngredient(item)) {
      return false;
    }
    return !search || normalizeText([item.name, item.category].join(' ')).includes(search);
  });

  const html = ingredients.map(function(item) {
    const checked = state.selectedIngredients.has(item.id) ? 'checked' : '';
    return `
      <label class="ingredient-check">
        <input type="checkbox" data-ingredient-check="${escapeHtml(item.id)}" ${checked}>
        <span>${escapeHtml(item.name)} <small>(${escapeHtml(item.unit || 'หน่วย')})</small></span>
      </label>
    `;
  }).join('');

  const container = document.getElementById('ingredientChecklist');
  container.innerHTML = html || '<div class="empty-state">ไม่พบวัตถุดิบสำหรับเลือก</div>';

  container.querySelectorAll('[data-ingredient-check]').forEach(function(node) {
    node.addEventListener('change', function() {
      if (node.checked) {
        state.selectedIngredients.add(node.getAttribute('data-ingredient-check'));
      } else {
        state.selectedIngredients.delete(node.getAttribute('data-ingredient-check'));
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
            <span>${recipe.canCook ? 'ครบทั้งจำนวน' : 'มีวัตถุดิบครบตามรายการ'}</span>
          </div>
        </div>
      `;
    }).join('')
    : '<div class="empty-state">ยังไม่มีเมนูที่ตรงกับวัตถุดิบที่เลือก</div>';

  const shareText = buildLineShareText(selectedIngredients, availableMenus, selectedIds.length);
  document.getElementById('lineShareText').value = shareText;
  document.getElementById('lineShareLink').href = 'https://line.me/R/msg/text/?' + encodeURIComponent(shareText);
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
    menuLines
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

function addMissingToCart(recipe) {
  recipe.items.forEach(function(item) {
    if (!item.missingQty) return;
    const existing = state.cart.find(function(cartItem) {
      return cartItem.ingredientId === item.ingredientId;
    });
    if (existing) {
      existing.qty += item.missingQty;
      existing.totalCost = existing.qty * existing.unitPrice;
      return;
    }
    state.cart.push({
      ingredientId: item.ingredientId,
      name: item.ingredientName,
      qty: item.missingQty,
      unit: item.unit,
      unitPrice: item.purchasePrice,
      totalCost: item.missingQty * item.purchasePrice,
    });
  });
}

function removeCartItem(index) {
  state.cart.splice(index, 1);
  renderAll();
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

function createPlaceholderImage() {
  return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=70';
}
