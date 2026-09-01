'use strict';

const byId = id => document.getElementById(id);
const money = n => Number(n).toLocaleString('ru-RU') + ' ₸';

let dishes = [];
let categories = [];
let editingId = null; // null = creating a new dish
let paymentSettings = { paymentEnabled: false, kaspiQrUrl: null, kaspiDisplayName: null };
let palomaSettings = { palomaEnabled: false, palomaAuthkey: null, palomaPointId: null, palomaClass: 'Tester' };

let toastTimer = null;
function flash(msg) {
  clearTimeout(toastTimer);
  const el = byId('toast');
  el.textContent = msg;
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

async function api(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options && options.headers) },
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Bad response' }));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ------------------------------------------------------------- auth screen ------------------------------------------------------------- */

async function checkAuth() {
  try {
    const data = await api('/api/admin/auth');
    return !!data.authed;
  } catch (e) {
    return false;
  }
}

async function showApp() {
  byId('loginScreen').hidden = true;
  byId('dashboard').hidden = false;
  await loadAll();
}

function showLogin() {
  byId('dashboard').hidden = true;
  byId('loginScreen').hidden = false;
  byId('passwordInput').focus();
}

byId('loginBtn').addEventListener('click', doLogin);
byId('passwordInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const password = byId('passwordInput').value;
  byId('loginError').textContent = '';
  try {
    await api('/api/admin/auth', { method: 'POST', body: JSON.stringify({ action: 'login', password }) });
    byId('passwordInput').value = '';
    await showApp();
  } catch (e) {
    byId('loginError').textContent = 'Неверный пароль';
  }
}

byId('logoutBtn').addEventListener('click', async () => {
  await api('/api/admin/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }).catch(() => {});
  showLogin();
});

/* ------------------------------------------------------------- dashboard ------------------------------------------------------------- */

async function loadAll() {
  try {
    const [dishRes, catRes, restaurantRes] = await Promise.all([
      api('/api/admin/dishes'), api('/api/admin/categories'), api('/api/admin/restaurant')
    ]);
    dishes = dishRes.dishes;
    categories = catRes.categories;
    paymentSettings = {
      paymentEnabled: restaurantRes.paymentEnabled, kaspiQrUrl: restaurantRes.kaspiQrUrl, kaspiDisplayName: restaurantRes.kaspiDisplayName,
      paymentAutoConfirm: restaurantRes.paymentAutoConfirm, kaspiWebhookToken: restaurantRes.kaspiWebhookToken
    };
    palomaSettings = {
      palomaEnabled: restaurantRes.palomaEnabled, palomaAuthkey: restaurantRes.palomaAuthkey,
      palomaPointId: restaurantRes.palomaPointId, palomaClass: restaurantRes.palomaClass
    };
    renderTable();
    renderPaymentCard();
    renderPalomaCard();
  } catch (e) {
    flash('Не удалось загрузить данные: ' + e.message);
  }
}

function renderPaymentCard() {
  byId('paymentEnabledInput').checked = !!paymentSettings.paymentEnabled;
  byId('kaspiDisplayNameInput').value = paymentSettings.kaspiDisplayName || '';
  const preview = byId('kaspiQrPreview');
  if (paymentSettings.kaspiQrUrl) {
    preview.src = paymentSettings.kaspiQrUrl;
    preview.hidden = false;
  } else {
    preview.hidden = true;
  }

  byId('paymentAutoConfirmInput').checked = !!paymentSettings.paymentAutoConfirm;
  byId('webhookSetupBlock').hidden = !paymentSettings.paymentAutoConfirm;
  byId('webhookUrlInput').value = paymentSettings.kaspiWebhookToken
    ? `${location.origin}/api/kaspi-notify?token=${paymentSettings.kaspiWebhookToken}`
    : '';
}

byId('paymentAutoConfirmInput').addEventListener('change', () => {
  byId('webhookSetupBlock').hidden = !byId('paymentAutoConfirmInput').checked;
});

byId('copyWebhookBtn').addEventListener('click', async () => {
  const url = byId('webhookUrlInput').value;
  if (!url) { flash('Сначала сгенерируйте токен'); return; }
  try {
    await navigator.clipboard.writeText(url);
    flash('Ссылка скопирована');
  } catch (e) {
    flash('Не удалось скопировать — выделите ссылку вручную');
  }
});

byId('regenTokenBtn').addEventListener('click', async () => {
  try {
    const data = await api('/api/admin/restaurant', { method: 'PUT', body: JSON.stringify({ regenerateKaspiToken: true }) });
    paymentSettings.kaspiWebhookToken = data.kaspiWebhookToken;
    renderPaymentCard();
    flash('Новый токен сохранён — обновите ссылку в приложении на телефоне');
  } catch (e) {
    flash('Не удалось сгенерировать токен: ' + e.message);
  }
});

byId('kaspiQrFileBtn').addEventListener('click', () => byId('kaspiQrFileInput').click());
byId('kaspiQrFileInput').addEventListener('change', async () => {
  const file = byId('kaspiQrFileInput').files[0];
  byId('kaspiQrFileInput').value = '';
  if (!file) return;

  const statusEl = byId('kaspiQrUploadStatus');
  if (!file.type.startsWith('image/')) { statusEl.textContent = 'Нужен файл изображения'; return; }
  if (file.size > MAX_UPLOAD_BYTES) {
    statusEl.textContent = `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ, максимум 4 МБ)`;
    return;
  }

  statusEl.textContent = 'Загружаем…';
  try {
    const dataBase64 = await fileToBase64(file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'image/png', dataBase64 }),
      credentials: 'same-origin'
    });
    const data = await res.json().catch(() => ({ ok: false, error: 'Bad response' }));
    if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed');
    paymentSettings.kaspiQrUrl = data.url;
    renderPaymentCard();
    statusEl.textContent = 'Загружено ✓';
    setTimeout(() => { if (statusEl.textContent === 'Загружено ✓') statusEl.textContent = ''; }, 3000);
  } catch (e) {
    statusEl.textContent = 'Ошибка загрузки: ' + e.message;
  }
});

byId('savePaymentBtn').addEventListener('click', async () => {
  const payload = {
    paymentEnabled: byId('paymentEnabledInput').checked,
    kaspiDisplayName: byId('kaspiDisplayNameInput').value.trim() || null,
    kaspiQrUrl: paymentSettings.kaspiQrUrl || null,
    paymentAutoConfirm: byId('paymentAutoConfirmInput').checked
  };
  try {
    const data = await api('/api/admin/restaurant', { method: 'PUT', body: JSON.stringify(payload) });
    paymentSettings = { ...paymentSettings, ...payload };
    if (data.kaspiWebhookToken) paymentSettings.kaspiWebhookToken = data.kaspiWebhookToken;
    renderPaymentCard();
    flash('Настройки оплаты сохранены');
  } catch (e) {
    flash('Не удалось сохранить: ' + e.message);
  }
});

/* ------------------------------------------------------------- Paloma365 POS ----------------------------------------------------------- */

function renderPalomaCard() {
  byId('palomaEnabledInput').checked = !!palomaSettings.palomaEnabled;
  byId('palomaAuthkeyInput').value = palomaSettings.palomaAuthkey || '';
  byId('palomaClassInput').value = palomaSettings.palomaClass || 'Tester';
  const select = byId('palomaPointSelect');
  if (palomaSettings.palomaPointId && ![...select.options].some(o => o.value === palomaSettings.palomaPointId)) {
    select.insertAdjacentHTML('beforeend', `<option value="${palomaSettings.palomaPointId}">Точка #${palomaSettings.palomaPointId}</option>`);
  }
  select.value = palomaSettings.palomaPointId || '';
}

byId('palomaLoadPointsBtn').addEventListener('click', async () => {
  const statusEl = byId('palomaPointsStatus');
  statusEl.textContent = 'Загружаем…';
  try {
    const authkey = byId('palomaAuthkeyInput').value.trim();
    if (!authkey) { statusEl.textContent = 'Сначала укажите AUTHKEY'; return; }
    if (authkey !== palomaSettings.palomaAuthkey || !palomaSettings.palomaEnabled) {
      await savePalomaSettings({ palomaAuthkey: authkey, palomaEnabled: true });
    }
    const data = await api('/api/admin/restaurant', { method: 'POST', body: JSON.stringify({ action: 'points' }) });
    const select = byId('palomaPointSelect');
    select.innerHTML = '<option value="">— не выбрано —</option>' +
      (data.points || []).map(p => `<option value="${p.point_id}">${esc(p.name)} — ${esc(p.address || '')}</option>`).join('');
    select.value = palomaSettings.palomaPointId || '';
    statusEl.textContent = `Найдено точек: ${(data.points || []).length}`;
  } catch (e) {
    statusEl.textContent = 'Не удалось загрузить точки: ' + e.message;
  }
});

byId('palomaAutomatchBtn').addEventListener('click', async () => {
  const statusEl = byId('palomaAutomatchStatus');
  statusEl.textContent = 'Сопоставляем…';
  try {
    const data = await api('/api/admin/restaurant', { method: 'POST', body: JSON.stringify({ action: 'automatch' }) });
    statusEl.textContent = `Сопоставлено ${data.matched} из ${data.total} блюд по названию. Остальные привяжите вручную в карточке блюда.`;
    await loadAll();
  } catch (e) {
    statusEl.textContent = 'Не удалось сопоставить: ' + e.message;
  }
});

async function savePalomaSettings(extra) {
  const payload = {
    palomaEnabled: byId('palomaEnabledInput').checked,
    palomaAuthkey: byId('palomaAuthkeyInput').value.trim() || null,
    palomaPointId: byId('palomaPointSelect').value || null,
    palomaClass: byId('palomaClassInput').value.trim() || 'Tester',
    ...extra
  };
  await api('/api/admin/restaurant', { method: 'PUT', body: JSON.stringify(payload) });
  palomaSettings = { ...palomaSettings, ...payload };
}

byId('savePalomaBtn').addEventListener('click', async () => {
  try {
    await savePalomaSettings();
    renderPalomaCard();
    flash('Настройки Paloma365 сохранены');
  } catch (e) {
    flash('Не удалось сохранить: ' + e.message);
  }
});

function priceLabel(d) {
  if (d.sizes.length === 1) return money(d.sizes[0].price);
  return d.sizes.map(s => (s.label ? s.label + ' ' : '') + money(s.price)).join(' / ');
}

function renderTable() {
  const rows = byId('dishRows');
  rows.innerHTML = dishes.map(d => `
    <tr>
      <td class="dish-name">${esc(d.name)}${d.videoUrl ? ' 🎬' : ''}</td>
      <td class="muted">${esc(d.categoryRu)}</td>
      <td>${priceLabel(d)}</td>
      <td><span class="badge ${d.available ? 'badge-available' : 'badge-unavailable'}">${d.available ? 'В наличии' : 'Нет в наличии'}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn-outline btn-sm" data-edit="${d.id}">Изменить</button>
        </div>
      </td>
    </tr>
  `).join('');
  byId('emptyHint').hidden = dishes.length > 0;

  rows.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openModal(Number(btn.getAttribute('data-edit'))));
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ------------------------------------------------------------- edit modal ------------------------------------------------------------- */

function categoryOptionsHtml(selectedId) {
  return categories.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.nameRu)}</option>`).join('');
}

function sizeRowHtml(label, price) {
  return `<div class="size-row">
    <input type="text" placeholder="Подпись (напр. 0.4 л) — необязательно" class="size-label" value="${esc(label || '')}">
    <input type="number" placeholder="Цена, ₸" class="size-price" min="0" value="${price != null ? price : ''}" style="max-width:130px;">
    <button type="button" class="btn btn-outline btn-sm remove-size">✕</button>
  </div>`;
}

function renderSizeRows(sizes) {
  const list = byId('sizesList');
  list.innerHTML = (sizes.length ? sizes : [{ label: '', price: '' }]).map(s => sizeRowHtml(s.label, s.price)).join('');
  bindSizeRowRemovers();
}
function bindSizeRowRemovers() {
  byId('sizesList').querySelectorAll('.remove-size').forEach(btn => {
    btn.onclick = () => {
      const rows = byId('sizesList').querySelectorAll('.size-row');
      if (rows.length <= 1) return; // keep at least one row
      btn.closest('.size-row').remove();
    };
  });
}
byId('addSizeBtn').addEventListener('click', () => {
  byId('sizesList').insertAdjacentHTML('beforeend', sizeRowHtml('', ''));
  bindSizeRowRemovers();
});

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // matches the server-side cap in api/admin/upload.js

async function fileToBase64(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000; // avoid call-stack blowup from spreading a huge array at once
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

byId('videoFileBtn').addEventListener('click', () => byId('videoFileInput').click());
byId('videoFileInput').addEventListener('change', async () => {
  const file = byId('videoFileInput').files[0];
  byId('videoFileInput').value = ''; // allow re-selecting the same file later
  if (!file) return;

  const statusEl = byId('videoUploadStatus');
  if (!file.type.startsWith('video/')) { statusEl.textContent = 'Нужен видеофайл'; return; }
  if (file.size > MAX_UPLOAD_BYTES) {
    statusEl.textContent = `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ, максимум 4 МБ) — сожмите видео покороче или в меньшем разрешении`;
    return;
  }

  statusEl.textContent = 'Загружаем…';
  try {
    const dataBase64 = await fileToBase64(file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4', dataBase64 }),
      credentials: 'same-origin'
    });
    const data = await res.json().catch(() => ({ ok: false, error: 'Bad response' }));
    if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed');
    byId('fVideo').value = data.url;
    statusEl.textContent = 'Загружено ✓';
    setTimeout(() => { if (statusEl.textContent === 'Загружено ✓') statusEl.textContent = ''; }, 3000);
  } catch (e) {
    statusEl.textContent = 'Ошибка загрузки: ' + e.message;
  }
});

function collectSizesFromForm() {
  return Array.from(byId('sizesList').querySelectorAll('.size-row')).map(row => ({
    label: row.querySelector('.size-label').value.trim(),
    price: Number(row.querySelector('.size-price').value)
  })).filter(s => Number.isFinite(s.price) && s.price >= 0);
}

function openModal(id) {
  editingId = id;
  const d = id ? dishes.find(x => x.id === id) : null;

  byId('modalTitle').textContent = d ? 'Редактировать блюдо' : 'Новое блюдо';
  byId('fName').value = d ? d.name : '';
  byId('fCategory').innerHTML = categoryOptionsHtml(d ? d.categoryId : (categories[0] && categories[0].id));
  renderSizeRows(d ? d.sizes : []);
  byId('fRating').value = d && d.rating != null ? d.rating : '';
  byId('fCal').value = d && d.cal != null ? d.cal : '';
  byId('fTime').value = d && d.time != null ? d.time : '';
  byId('fOfferPct').value = d ? d.offerPct : 0;
  byId('fImg').value = d && d.imgUrl ? d.imgUrl : '';
  byId('fVideo').value = d && d.videoUrl ? d.videoUrl : '';
  byId('fAvailable').checked = d ? d.available : true;
  byId('fPopular').checked = d ? d.popular : false;
  byId('fSpicy').checked = d ? !!d.spicy : false;
  byId('fVegetarian').checked = d ? !!d.vegetarian : false;
  byId('fPalomaObjectId').value = d && d.palomaObjectId ? d.palomaObjectId : '';
  byId('deleteDishBtn').hidden = !d;

  byId('modalBackdrop').hidden = false;
  byId('fName').focus();
}
function closeModal() { byId('modalBackdrop').hidden = true; editingId = null; }

byId('addDishBtn').addEventListener('click', () => openModal(null));
byId('cancelModalBtn').addEventListener('click', closeModal);
byId('modalBackdrop').addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeModal(); });

byId('saveDishBtn').addEventListener('click', async () => {
  const name = byId('fName').value.trim();
  if (!name) { flash('Введите название блюда'); return; }
  const sizes = collectSizesFromForm();
  if (sizes.length === 0) { flash('Добавьте хотя бы один размер с ценой'); return; }

  const payload = {
    name,
    categoryId: Number(byId('fCategory').value),
    sizes,
    rating: byId('fRating').value !== '' ? Number(byId('fRating').value) : null,
    cal: byId('fCal').value !== '' ? Number(byId('fCal').value) : null,
    time: byId('fTime').value !== '' ? Number(byId('fTime').value) : null,
    offerPct: byId('fOfferPct').value !== '' ? Number(byId('fOfferPct').value) : 0,
    imgUrl: byId('fImg').value.trim() || null,
    videoUrl: byId('fVideo').value.trim() || null,
    available: byId('fAvailable').checked,
    popular: byId('fPopular').checked,
    spicy: byId('fSpicy').checked,
    vegetarian: byId('fVegetarian').checked,
    palomaObjectId: byId('fPalomaObjectId').value.trim() || null
  };

  try {
    if (editingId) {
      await api(`/api/admin/dishes/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      flash('Изменения сохранены');
    } else {
      await api('/api/admin/dishes', { method: 'POST', body: JSON.stringify(payload) });
      flash('Блюдо добавлено');
    }
    closeModal();
    await loadAll();
  } catch (e) {
    flash('Ошибка: ' + e.message);
  }
});

byId('deleteDishBtn').addEventListener('click', async () => {
  if (!editingId) return;
  if (!confirm('Удалить это блюдо? Действие необратимо.')) return;
  try {
    await api(`/api/admin/dishes/${editingId}`, { method: 'DELETE' });
    flash('Блюдо удалено');
    closeModal();
    await loadAll();
  } catch (e) {
    flash('Ошибка: ' + e.message);
  }
});

/* ------------------------------------------------------------- init ------------------------------------------------------------- */

(async function init() {
  const authed = await checkAuth();
  if (authed) await showApp(); else showLogin();
})();
