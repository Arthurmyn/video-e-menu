'use strict';

/* ---------------------------------------------------------------- venue data ---------------------------------------------------------------- */

const TABLE_NUMBER_DEFAULT = '12';

/* Restaurant identity/contact info now lives in Postgres (`restaurants` table)
   and is loaded by loadMenu() — these are just placeholders shown for the
   instant before that fetch resolves, not a second source of truth. */
let RESTAURANT = {
  name: 'Nauryz', phone: '', phoneTel: '', address: '', hoursRu: '', hoursEn: ''
};

/* Table number comes from the QR link, e.g. https://.../?table=7 — falls back
   to a generic default when opened without one (e.g. testing on a laptop). */
function resolveTableNumber() {
  try {
    const raw = new URLSearchParams(location.search).get('table');
    if (raw && /^[\p{L}\p{N}\-]{1,12}$/u.test(raw)) return raw;
  } catch (e) { /* malformed URL — ignore, use default */ }
  return TABLE_NUMBER_DEFAULT;
}
const TABLE_NUMBER = resolveTableNumber();
/* Display label respects the UI language; the kitchen order (submitOrder) always
   uses the Russian form since it's read by Nauryz staff regardless of what
   language the guest browsed in. */
function tableLabel() { return (currentLang() === 'en' ? 'Table ' : 'Стол ') + TABLE_NUMBER; }
function tableLabelRu() { return 'Стол ' + TABLE_NUMBER; }

/* ----------------------------------------------------------------- i18n ------------------------------------------------------------------- */
/* Real RU/EN toggle for interface chrome. Dish and category *names* stay in
   Russian in both languages — Kazakh/Uyghur/Russian dish names (e.g. "Гуйру
   лагман") aren't something to auto-translate without real culinary review,
   so only category labels get an English rendering (via CAT_NAME_EN below). */

const LANGS = [
  { code: 'RU', key: 'ru', name: 'Русский' },
  { code: 'EN', key: 'en', name: 'English' }
];
function currentLang() { return LANGS[state.lang].key; }
function t(key) { return I18N[currentLang()][key]; }

function ruPlural(n, one, few, many) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}
function positionsLabel(n) {
  return currentLang() === 'en' ? n + ' ' + (n === 1 ? 'item' : 'items') : n + ' ' + ruPlural(n, 'позиция', 'позиции', 'позиций');
}
function savedCountLabel(n) {
  return currentLang() === 'en' ? n + ' saved' : n + ' в избранном';
}
function orderLineLabel(n) {
  return t('sendToKitchen') + ' · ' + n + (currentLang() === 'en' ? (n === 1 ? ' item' : ' items') : ' поз.');
}

const I18N = {
  ru: {
    dineIn: 'Зал', searchPlaceholder: 'Поиск по меню',
    heroLine1: 'Проголодались?', heroLine2: 'Выбирайте и заказывайте.',
    navHome: 'Главная', navMenu: 'Меню', navFav: 'Избранное', navCart: 'Корзина',
    fullMenu: 'Всё меню', allCats: 'Все',
    tabAll: 'Все блюда', tabPopular: 'Популярные', tabOffer: 'Со скидкой',
    favTitle: 'Избранное', favEmptyTitle: 'Пока нет избранного',
    favEmptySub: 'Нажмите на сердечко у блюда, чтобы сохранить его здесь.', favBrowse: 'Смотреть меню',
    cartTitle: 'Ваш заказ', cartEmptyTitle: 'Заказ пуст',
    cartEmptySub: 'Выберите блюдо из меню, чтобы начать заказ.', cartOpenMenu: 'Открыть меню',
    viewOrder: 'Смотреть заказ', total: 'Итого', sendToKitchen: 'Отправить на кухню',
    sending: 'Отправляем…', orderSent: 'Заказ отправлен на кухню',
    orderFailed: 'Не получилось отправить заказ — позовите официанта',
    addedToCart: 'добавлено в заказ', savedToFav: 'сохранено в избранное', removedFromFav: 'удалено из избранного',
    languageSwitched: 'Язык', notFoundTitle: 'Ничего не найдено',
    notFoundSub: 'Попробуйте другой запрос или сбросьте фильтр цены.',
    goodToKnow: 'Полезно знать', hours: 'Часы работы', hoursValue: 'Круглосуточно, без выходных.',
    address: 'Адрес', phone: 'Телефон',
    allergens: 'Аллергены', allergensValue: 'Уточняйте у официанта — все блюда готовятся на общей кухне.',
    gotIt: 'Понятно', filters: 'Фильтры', price: 'Цена', from: 'От', to: 'До', reset: 'Сбросить',
    addToOrder: 'Добавить в заказ', portion: 'Порция',
    rating: 'Рейтинг', cookTime: 'Готовка', category: 'Категория', kcal: 'ккал', min: 'мин',
    unavailable: 'Нет в наличии', unavailableNow: 'Сейчас нет в наличии',
    sortLabel: 'Сортировка', sortDefault: 'По умолчанию', sortPriceAsc: 'Сначала дешёвые',
    sortPriceDesc: 'Сначала дорогие', sortRating: 'Сначала с высоким рейтингом',
    prepLabel: 'Время готовки', prepAny: 'Любое', prepUpTo15: 'До 15 мин', prepUpTo30: 'До 30 мин',
    spicyLabel: 'Острое', spicyAny: 'Любое', spicySpicy: 'Острое', spicyMild: 'Не острое',
    alsoShowLabel: 'Также показать только', vegOnly: 'Вегетарианское', offerOnly: 'Со скидкой', recommendedOnly: 'Рекомендуем',
    sortBtnLabel: 'Сортировка',
    randomBtnTitle: 'Случайное блюдо', randomModalTitle: 'Случайный выбор',
    randomSlotMain: 'Основное', randomSlotDrink: 'Напиток', randomSlotDessert: 'Десерт',
    spinAgain: 'Крутить ещё раз', addAllToCart: 'Добавить всё в заказ', addedAllToCart: 'добавлено в заказ',
    goesWellTitle: 'С этим блюдом заказывают'
  },
  en: {
    dineIn: 'Dine-in', searchPlaceholder: 'Search the menu',
    heroLine1: 'Hungry?', heroLine2: 'Pick something and order.',
    navHome: 'Home', navMenu: 'Menu', navFav: 'Favorites', navCart: 'Cart',
    fullMenu: 'Full menu', allCats: 'All',
    tabAll: 'All dishes', tabPopular: 'Popular', tabOffer: 'On offer',
    favTitle: 'Favorites', favEmptyTitle: 'No favorites yet',
    favEmptySub: 'Tap the heart on any dish to save it here.', favBrowse: 'Browse the menu',
    cartTitle: 'Your order', cartEmptyTitle: 'Nothing ordered yet',
    cartEmptySub: 'Pick a dish from the menu to start your order.', cartOpenMenu: 'Open the menu',
    viewOrder: 'View your order', total: 'Total', sendToKitchen: 'Send to kitchen',
    sending: 'Sending…', orderSent: 'Order sent to the kitchen',
    orderFailed: 'Could not send the order — please call a waiter',
    addedToCart: 'added to your order', savedToFav: 'saved to favorites', removedFromFav: 'removed from favorites',
    languageSwitched: 'Language', notFoundTitle: 'Nothing found',
    notFoundSub: 'Try a different search or reset the price filter.',
    goodToKnow: 'Good to know', hours: 'Kitchen hours', hoursValue: 'Open 24/7.',
    address: 'Address', phone: 'Phone',
    allergens: 'Allergens', allergensValue: 'Ask your server — every dish is prepared in a shared kitchen.',
    gotIt: 'Got it', filters: 'Filters', price: 'Price', from: 'From', to: 'To', reset: 'Reset',
    addToOrder: 'Add to order', portion: 'Portion',
    rating: 'Rating', cookTime: 'Cook time', category: 'Category', kcal: 'kcal', min: 'min',
    unavailable: 'Sold out', unavailableNow: 'Currently sold out',
    sortLabel: 'Sort by', sortDefault: 'Default', sortPriceAsc: 'Price: low to high',
    sortPriceDesc: 'Price: high to low', sortRating: 'Highest rated first',
    prepLabel: 'Prep time', prepAny: 'Any', prepUpTo15: 'Up to 15 min', prepUpTo30: 'Up to 30 min',
    spicyLabel: 'Spicy', spicyAny: 'Any', spicySpicy: 'Spicy', spicyMild: 'Not spicy',
    alsoShowLabel: 'Also show only', vegOnly: 'Vegetarian', offerOnly: 'With a discount', recommendedOnly: 'Recommended',
    sortBtnLabel: 'Sort',
    randomBtnTitle: 'Random dish', randomModalTitle: 'Random pick',
    randomSlotMain: 'Main', randomSlotDrink: 'Drink', randomSlotDessert: 'Dessert',
    spinAgain: 'Spin again', addAllToCart: 'Add all to order', addedAllToCart: 'added to your order',
    goesWellTitle: 'Goes well with this'
  }
};

/* --------------------------------------------------------------- categories ---------------------------------------------------------------- */

const CAT_ICON_D = {
  'Первые блюда': 'M3.5 12.5h17a8.5 8.5 0 0 1-17 0zM8 7c0-1.2 1-1.2 1-2.4M12 7c0-1.2 1-1.2 1-2.4M16 7c0-1.2 1-1.2 1-2.4',
  'Вторые блюда': 'M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0zM20 12h2.5',
  'Салаты': 'M3.5 13h17a8.5 8.5 0 0 1-17 0zM9.5 10.5c-.5-3 1.5-5.5 4.5-5.5.4 3-1.5 5.5-4.5 5.5z',
  'Соусы': 'M9 2h6v3l2 2v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7l2-2ZM9 10h6',
  'Горячие закуски': 'M8 9.5h8L15 20H9zM10.5 9.5V4.5M13.5 9.5V5.5M12 9.5V3.5',
  'Каши': 'M4 12.5h16a8 8 0 0 1-16 0zM17 4l3 3-6 6-2-2z',
  'Завтраки': 'M3.5 14a8.5 5 0 1 0 17 0 8.5 5 0 1 0-17 0zM14.2 13.6a2.3 2.3 0 1 0 0-.1',
  'Пицца': 'M12 21.5 4.2 6.6a19 19 0 0 1 15.6 0zM10 12h.01M14 15h.01',
  'Десерты': 'M4.5 20h15v-6h-15zM6.5 14v-3h11v3M12 11V8M12 5.5v.01',
  'Гарниры': 'M4 13h16a8 8 0 0 1-16 0zM12 13V8a3 3 0 0 1 3-3',
  'Кофе': 'M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Zm13 2h2a2 2 0 0 1 0 4h-2M8 3c0 1-1 1-1 2M12 3c0 1-1 1-1 2',
  'Молочные коктейли': 'M7 4h10l-1 15a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2ZM15 2l1 3M9 9h6',
  'Лимонады': 'M6 4h12l-1.5 16a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1ZM8 8h8M16 2l2 4',
  'Чаи': 'M4 9h11a4 4 0 0 1 4 4 3 3 0 0 1-3 3h-1M4 9v6a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3V9M9 9V6a2 2 0 0 1 4 0v3',
  'Посуда с собой': 'M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2ZM9 8V6a3 3 0 0 1 6 0v2'
};

let CATS = []; // populated from /api/menu — ordered list of category name_ru
let CAT_META = {}; // name_ru -> { nameEn }
const CAT_ALL = 'ALL'; // internal sentinel — not displayed directly, see catLabel()

function catLabel(cat) {
  if (cat === CAT_ALL) return t('allCats');
  const meta = CAT_META[cat];
  return currentLang() === 'en' ? (meta ? meta.nameEn : cat) : cat;
}

/* ------------------------------------------------------------------ menu -------------------------------------------------------------------- */
/* The menu itself (dishes, prices, availability) lives in Postgres and is
   loaded from /api/menu on startup — see loadMenu(). What used to be a
   hardcoded array here is now edited through the admin, not this file.
   `db/seed.mjs` holds the original one-time migration of the 2GIS data. */

let DISHES = [];

/* ------------------------------------------------------------------ utils ------------------------------------------------------------------- */

const money = n => n.toLocaleString('ru-RU') + ' ₸';
const byId = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* --------------------------------------------------------------- icons ---------------------------------------------------------------- */

const HEART_D = 'M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8Z';
const CHECK_D = 'm5 13 4 4 10-10';
const STAR_D = 'm12 3 2.6 5.7 6.4.7-4.7 4.3 1.3 6.3L12 17l-5.6 3 1.3-6.3L3 9.4l6.4-.7L12 3Z';

function heartIcon(active, size = 13) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" stroke-width="2" stroke="${active ? '#FF5722' : '#141414'}" fill="${active ? '#FF5722' : 'none'}"><path d="${HEART_D}"/></svg>`;
}
function starIcon(size = 12, color = '#F5B800') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="none"><path d="${STAR_D}"/></svg>`;
}
function checkIcon(size = 13, color = '#FF5722') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3"><path d="${CHECK_D}"/></svg>`;
}
function plusMinusIcon(inCart) {
  return inCart
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="${CHECK_D}"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg>`;
}
function catIcon(name, size, stroke) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${CAT_ICON_D[name]}"/></svg>`;
}
function mediaPlaceholder(cat, extraClass, iconSize) {
  return `<div class="${extraClass} ph">${catIcon(cat, iconSize, '#C9C2BB')}</div>`;
}
function mediaHtml(d, imgClass, iconSize) {
  if (d.video) {
    return `<video class="${imgClass}" poster="${d.img || ''}" autoplay muted loop playsinline preload="metadata"><source src="${d.video}" type="video/mp4"></video>`;
  }
  return d.img
    ? `<img class="${imgClass}" src="${d.img}" alt="${esc(d.name)}" loading="lazy">`
    : mediaPlaceholder(d.cat, imgClass, iconSize);
}

const NAV_ITEMS = [
  { key: 'home', icon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8Z"/></svg>' },
  { key: 'menu', icon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></svg>' },
  { key: 'fav', icon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="' + HEART_D + '"/></svg>' },
  { key: 'cart', icon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M3 4h2l2.5 11h11L21 7H6"/></svg>' }
];

/* --------------------------------------------------------------- state ---------------------------------------------------------------- */

const TABS = ['all', 'popular', 'offer'];
function tabLabel(key) { return key === 'popular' ? t('tabPopular') : key === 'offer' ? t('tabOffer') : t('tabAll'); }

const state = {
  screen: 'home', cat: CAT_ALL, tab: TABS[0], detailId: null, size: 0, qty: 1,
  cart: {}, fav: {}, query: '', lang: 0, toast: '',
  infoOpen: false, filtersOpen: false, sortOpen: false, randomOpen: false, fMin: '', fMax: '',
  fPrep: 0, fSpicy: 'any', fVegOnly: false, fOfferOnly: false, fRecommendedOnly: false, sortBy: 'default',
  suggestId: null, suggestList: []
};

let toastTimer = null;
function flash(msg) {
  clearTimeout(toastTimer);
  state.toast = msg;
  renderToast();
  toastTimer = setTimeout(() => { state.toast = ''; renderToast(); }, 1600);
}

function go(screen) {
  state.screen = screen;
  setHash(screen);
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function openDetail(id) {
  state.detailId = id; state.size = 0; state.qty = 1; state.screen = 'detail';
  setHash('detail', id);
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addToCart(dish, sizeIdx, qty) {
  const key = dish.id + '|' + sizeIdx;
  const existing = state.cart[key];
  state.cart[key] = { id: dish.id, size: sizeIdx, qty: (existing ? existing.qty : 0) + qty };
  flash(dish.name + ' ' + t('addedToCart'));
}
function bumpCart(key, delta) {
  const item = state.cart[key];
  if (!item) return;
  const q = item.qty + delta;
  if (q <= 0) delete state.cart[key]; else item.qty = q;
  renderAll();
}
function inCart(dishId) {
  return Object.keys(state.cart).some(k => k.split('|')[0] === dishId);
}
function toggleFav(dish) {
  const on = !state.fav[dish.id];
  state.fav[dish.id] = on;
  flash(dish.name + ' ' + (on ? t('savedToFav') : t('removedFromFav')));
  renderAll();
}

/* ------------------------------------------------------------ recommendations --------------------------------------------------------- */
/* No order-history data to learn real pairings from, so this is a fixed
   category-complementarity map (a soup suggests salads/drinks, a dessert
   suggests coffee, etc). "Посуда с собой" is never suggested — it's takeaway
   packaging, not a dish. */

const COMPLEMENT_CATS = {
  'Первые блюда': ['Салаты', 'Горячие закуски', 'Чаи', 'Десерты'],
  'Вторые блюда': ['Салаты', 'Гарниры', 'Соусы', 'Лимонады'],
  'Завтраки': ['Кофе', 'Чаи', 'Десерты'],
  'Пицца': ['Соусы', 'Лимонады', 'Салаты'],
  'Салаты': ['Первые блюда', 'Вторые блюда', 'Лимонады'],
  'Горячие закуски': ['Соусы', 'Лимонады', 'Молочные коктейли'],
  'Каши': ['Кофе', 'Чаи'],
  'Десерты': ['Кофе', 'Чаи', 'Молочные коктейли'],
  'Гарниры': ['Вторые блюда', 'Соусы'],
  'Соусы': ['Вторые блюда', 'Горячие закуски', 'Пицца'],
  'Кофе': ['Десерты'],
  'Молочные коктейли': ['Десерты'],
  'Лимонады': ['Десерты', 'Пицца'],
  'Чаи': ['Десерты']
};

function getComplementaryDishes(dish, count) {
  const seen = new Set([dish.id]);
  const picks = [];
  for (const cat of COMPLEMENT_CATS[dish.cat] || []) {
    const pool = DISHES.filter(d => d.cat === cat && d.available && !seen.has(d.id));
    if (!pool.length) continue;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    seen.add(pick.id);
    picks.push(pick);
    if (picks.length >= count) return picks;
  }
  const fallback = DISHES.filter(d => d.cat !== 'Посуда с собой' && d.available && d.popular && !seen.has(d.id));
  fallback.sort(() => Math.random() - 0.5);
  for (const d of fallback) {
    if (picks.length >= count) break;
    seen.add(d.id);
    picks.push(d);
  }
  return picks;
}

/* ------------------------------------------------------------- random picker ----------------------------------------------------------- */

const RANDOM_SLOTS = [
  { cats: ['Первые блюда', 'Вторые блюда', 'Пицца'], labelKey: 'randomSlotMain' },
  { cats: ['Кофе', 'Молочные коктейли', 'Лимонады', 'Чаи'], labelKey: 'randomSlotDrink' },
  { cats: ['Десерты'], labelKey: 'randomSlotDessert' }
];

function openRandomPicker() {
  state.randomOpen = true;
  renderModals();
  runRandomSpin();
}
function closeRandomPicker() {
  state.randomOpen = false;
  renderModals();
}

function reelCardHtml(d, spinning) {
  // While spinning, always use the static poster image — creating and tearing
  // down a fresh autoplaying <video> on every tick (every ~60-280ms) is wasted
  // work and can leave a stray composited frame floating above the modal on
  // some browsers. The real video only ever appears on the final landed pick.
  const thumb = (!spinning && d.video)
    ? mediaHtml(d, '', 22)
    : (d.img ? `<img src="${d.img}" alt="${esc(d.name)}">` : mediaPlaceholder(d.cat, '', 22));
  return `<div class="reel-thumb">${thumb}</div>
    <div class="reel-name">${esc(d.name)}</div>
    <div class="reel-price">${money(d.sizes[0].price)}</div>`;
}

function spinReel(cardEl, pool, finalPick, durationMs) {
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    if (elapsed >= durationMs || !document.body.contains(cardEl)) {
      cardEl.innerHTML = reelCardHtml(finalPick, false);
      return;
    }
    cardEl.innerHTML = reelCardHtml(pool[Math.floor(Math.random() * pool.length)], true);
    const delay = 60 + (elapsed / durationMs) * 220;
    setTimeout(() => requestAnimationFrame(tick), delay);
  }
  requestAnimationFrame(tick);
}

function runRandomSpin() {
  byId('randomResult').hidden = true;
  byId('randomActions').hidden = true;

  const reelsEl = byId('randomReels');
  reelsEl.innerHTML = RANDOM_SLOTS.map((slot, i) => `
    <div class="reel">
      <div class="reel-label">${esc(t(slot.labelKey))}</div>
      <div class="reel-window" id="reel-window-${i}"></div>
    </div>`).join('');

  const picks = [];
  RANDOM_SLOTS.forEach((slot, i) => {
    const pool = DISHES.filter(d => slot.cats.includes(d.cat) && d.available);
    const windowEl = byId('reel-window-' + i);
    if (!pool.length) {
      windowEl.innerHTML = '<span class="reel-empty">—</span>';
      return;
    }
    const finalPick = pool[Math.floor(Math.random() * pool.length)];
    picks.push(finalPick);
    const cardEl = document.createElement('div');
    windowEl.appendChild(cardEl);
    spinReel(cardEl, pool, finalPick, 700 + i * 350);
  });

  setTimeout(() => showRandomResult(picks), 700 + (RANDOM_SLOTS.length - 1) * 350 + 150);
}

function showRandomResult(picks) {
  const resultEl = byId('randomResult');
  resultEl.hidden = false;
  resultEl.innerHTML = picks.map(rowCardHtml).join('');
  bindDishCardEvents(resultEl);

  byId('randomActions').hidden = false;
  byId('randomAgainBtn').textContent = t('spinAgain');
  byId('randomAddAllBtn').textContent = t('addAllToCart');
  byId('randomAgainBtn').onclick = runRandomSpin;
  byId('randomAddAllBtn').onclick = () => {
    picks.forEach(d => addToCart(d, 0, 1));
    flash(t('addedAllToCart'));
    closeRandomPicker();
    renderAll();
  };
}

/* ------------------------------------------------------------- persistence ------------------------------------------------------------- */
/* Cart and favorites survive a page reload / return visit via localStorage.
   Not shared between devices or table sessions — purely a per-browser convenience. */

const STORAGE_KEY = 'nauryz-emenu-v1';

function loadPersisted() {
  let saved;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    saved = raw ? JSON.parse(raw) : null;
  } catch (e) { return; }
  if (!saved || typeof saved !== 'object') return;

  if (saved.cart && typeof saved.cart === 'object') {
    const cleanCart = {};
    for (const key of Object.keys(saved.cart)) {
      const c = saved.cart[key];
      const d = DISHES.find(x => x.id === c.id);
      if (d && Number(c.qty) > 0 && d.sizes[c.size]) cleanCart[key] = { id: c.id, size: c.size, qty: c.qty };
    }
    state.cart = cleanCart;
  }
  if (saved.fav && typeof saved.fav === 'object') {
    const cleanFav = {};
    for (const id of Object.keys(saved.fav)) {
      if (saved.fav[id] && DISHES.some(d => d.id === id)) cleanFav[id] = true;
    }
    state.fav = cleanFav;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart: state.cart, fav: state.fav }));
  } catch (e) { /* private mode / storage full — cart just won't survive reload */ }
}

/* ------------------------------------------------------------- hash routing ------------------------------------------------------------- */

function setHash(screen, id) {
  const h = '#' + screen + (id ? '/' + id : '');
  if (location.hash !== h) history.pushState(null, '', h);
}
function applyHash() {
  const [screen, id] = location.hash.replace('#', '').split('/');
  if (['home', 'menu', 'fav', 'cart', 'detail'].includes(screen)) {
    state.screen = screen;
    if (screen === 'detail') {
      // Validated against DISHES once loadMenu() has populated it — see init().
      if (id && (DISHES.length === 0 || DISHES.some(d => d.id === id))) state.detailId = id;
      state.size = 0; state.qty = 1;
    }
  }
}
window.addEventListener('popstate', () => { applyHash(); renderAll(); });

/* --------------------------------------------------------- derived data helpers --------------------------------------------------------- */

function matchesQuery(d) {
  const q = state.query.trim().toLowerCase();
  return !q || d.name.toLowerCase().includes(q) || d.cat.toLowerCase().includes(q);
}
function matchesCat(d) {
  return state.cat === CAT_ALL || d.cat === state.cat;
}
function matchesTab(d) {
  if (state.tab === 'popular') return !!d.popular;
  if (state.tab === 'offer') return !!d.offer;
  return true;
}
function matchesPrice(d) {
  const min = state.fMin === '' ? 0 : (parseFloat(state.fMin) || 0);
  const max = state.fMax === '' ? Infinity : (parseFloat(state.fMax) || Infinity);
  const p = d.sizes[0].price;
  return p >= min && p <= max;
}
function matchesPrepTime(d) {
  if (!state.fPrep) return true;
  return d.time !== undefined && d.time <= state.fPrep;
}
function matchesSpicy(d) {
  if (state.fSpicy === 'spicy') return !!d.spicy;
  if (state.fSpicy === 'mild') return !d.spicy;
  return true;
}
function matchesVegOnly(d) { return !state.fVegOnly || !!d.vegetarian; }
function matchesOfferOnly(d) { return !state.fOfferOnly || !!d.offer; }
function matchesRecommendedOnly(d) { return !state.fRecommendedOnly || !!d.popular; }
function sortList(list) {
  if (state.sortBy === 'default') return list;
  const arr = list.slice();
  if (state.sortBy === 'price-asc') arr.sort((a, b) => a.sizes[0].price - b.sizes[0].price);
  else if (state.sortBy === 'price-desc') arr.sort((a, b) => b.sizes[0].price - a.sizes[0].price);
  else if (state.sortBy === 'rating-desc') arr.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  return arr;
}
function filterCount() {
  return (state.fMin !== '' || state.fMax !== '' ? 1 : 0) + (state.fPrep ? 1 : 0) +
    (state.fSpicy !== 'any' ? 1 : 0) + (state.fVegOnly ? 1 : 0) + (state.fOfferOnly ? 1 : 0) + (state.fRecommendedOnly ? 1 : 0);
}
function cartEntries() {
  return Object.keys(state.cart).map(key => {
    const c = state.cart[key];
    const d = DISHES.find(x => x.id === c.id);
    return { key, dish: d, size: c.size, qty: c.qty };
  });
}
function cartCount() {
  return cartEntries().reduce((a, c) => a + c.qty, 0);
}
function cartTotal() {
  return cartEntries().reduce((a, c) => a + c.dish.sizes[c.size].price * c.qty, 0);
}
function favList() {
  return DISHES.filter(d => state.fav[d.id]);
}

/* -------------------------------------------------------------- rendering -------------------------------------------------------------- */

function renderAll() {
  persist();
  renderBrand();
  renderNav();
  renderChrome();
  renderStrips();
  renderScreens();
  renderCartBar();
  renderToast();
  renderModals();
}

function renderBrand() {
  document.documentElement.lang = currentLang();
  byId('dineInLabel').textContent = t('dineIn');
  byId('tableLabel').textContent = tableLabel();
  byId('restaurantName').textContent = RESTAURANT.name;
  byId('cartDineInLabel').textContent = t('dineIn');
  byId('cartTableLabel').textContent = tableLabel();
  byId('langCode').textContent = LANGS[state.lang].code;
  byId('langBtn').title = currentLang() === 'en' ? 'Change language' : 'Сменить язык';
  byId('infoBtn').title = t('goodToKnow');
}

const NAV_LABEL_KEY = { home: 'navHome', menu: 'navMenu', fav: 'navFav', cart: 'navCart' };

function renderNav() {
  const showNav = state.screen !== 'detail';
  const favCount = favList().length;
  const cCount = cartCount();

  const itemHtml = (navItem, withLabel) => {
    const active = state.screen === navItem.key;
    const badgeCount = navItem.key === 'fav' ? favCount : navItem.key === 'cart' ? cCount : 0;
    const badge = badgeCount > 0 ? `<span class="${withLabel ? 'nav-badge' : 'bn-badge'}">${badgeCount}</span>` : '';
    const iconColor = active ? '#fff' : '#8B8580';
    return `<button type="button" class="${withLabel ? 'nav-btn' : 'bn-btn'} ${active ? 'active' : ''}" data-go="${navItem.key}">
      ${navItem.icon.replace('stroke-width="2"', `stroke-width="2" stroke="${iconColor}"`)}
      ${withLabel ? `<span class="nav-label">${t(NAV_LABEL_KEY[navItem.key])}</span>` : ''}
      ${badge}
    </button>`;
  };

  byId('topNav').innerHTML = showNav ? NAV_ITEMS.map(i => itemHtml(i, true)).join('') : '';
  byId('bottomNav').innerHTML = showNav ? NAV_ITEMS.map(i => itemHtml(i, false)).join('') : '';
  byId('bottomNav').style.display = showNav ? '' : 'none';

  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => go(btn.getAttribute('data-go')));
  });
}

function renderChrome() {
  const s = state.screen;
  byId('searchRow').style.display = (s === 'home' || s === 'menu') ? '' : 'none';
  byId('hero').style.display = s === 'home' ? '' : 'none';
  byId('catStrip').style.display = s === 'home' ? '' : 'none';
  byId('menuTabs').style.display = s === 'menu' ? '' : 'none';
  byId('menuChips').style.display = s === 'menu' ? '' : 'none';

  byId('searchInput').value = state.query;
  byId('searchInput').placeholder = t('searchPlaceholder');
  byId('heroLine1').textContent = t('heroLine1');
  byId('heroLine2').textContent = t('heroLine2');
  const badge = byId('filterBadge');
  const fc = filterCount();
  badge.hidden = fc === 0;
  badge.textContent = fc;
}

function renderStrips() {
  const allCats = [CAT_ALL, ...CATS];

  byId('catStrip').innerHTML = allCats.map(c => {
    const active = state.cat === c;
    return `<button type="button" class="cat-btn ${active ? 'active' : ''}" data-cat="${esc(c)}">
      <span class="cat-circle">${c === CAT_ALL ? allIconSvg(active) : catIcon(c, active ? 24 : 20, active ? '#FF5722' : '#141414')}</span>
      <span class="cat-label">${esc(catLabel(c))}</span>
    </button>`;
  }).join('');
  document.querySelectorAll('#catStrip [data-cat]').forEach(btn => btn.addEventListener('click', () => {
    state.cat = btn.getAttribute('data-cat'); renderAll();
  }));

  byId('menuTabs').innerHTML = TABS.map(tabKey =>
    `<button type="button" class="tab-btn ${state.tab === tabKey ? 'active' : ''}" data-tab="${tabKey}">${esc(tabLabel(tabKey))}</button>`
  ).join('');
  document.querySelectorAll('#menuTabs [data-tab]').forEach(btn => btn.addEventListener('click', () => {
    state.tab = btn.getAttribute('data-tab'); renderAll();
  }));

  byId('menuChips').innerHTML = allCats.map(c => {
    const active = state.cat === c;
    return `<button type="button" class="chip-btn ${active ? 'active' : ''}" data-cat="${esc(c)}">
      ${c === CAT_ALL ? allIconSvg(active, 15) : catIcon(c, 15, active ? '#fff' : '#5C544F')}${esc(catLabel(c))}
    </button>`;
  }).join('');
  document.querySelectorAll('#menuChips [data-cat]').forEach(btn => btn.addEventListener('click', () => {
    state.cat = btn.getAttribute('data-cat'); renderAll();
  }));
}

function allIconSvg(active, size = 20) {
  const stroke = active ? '#FF5722' : (size <= 15 ? '#5C544F' : '#141414');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h6.5v6.5H4zM13.5 4.5H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z"/></svg>`;
}

function dishCardHtml(d) {
  const fav = !!state.fav[d.id];
  const added = inCart(d.id);
  return `<div class="dish-card ${d.available ? '' : 'unavailable'}">
    <div class="dish-media" data-open="${d.id}">
      ${mediaHtml(d, 'dish-media-img', 30)}
      <button type="button" class="fav-btn" data-fav="${d.id}">${heartIcon(fav)}</button>
      ${!d.available ? `<div class="unavail-pill">${t('unavailable')}</div>` : d.offer ? `<div class="offer-pill">-${d.offerPct}%</div>` : ''}
    </div>
    <div class="dish-body">
      <div class="dish-name">${esc(d.name)}</div>
      <div class="dish-tagline">${esc(catLabel(d.cat))}</div>
      <div class="dish-price-row">
        <span class="price"><span class="num">${money(d.sizes[0].price)}</span></span>
        ${d.available
          ? `<button type="button" class="add-btn ${added ? 'in-cart' : ''}" data-add="${d.id}">${plusMinusIcon(added)}</button>`
          : `<button type="button" class="add-btn add-btn-disabled" disabled>${plusMinusIcon(false)}</button>`}
      </div>
    </div>
  </div>`;
}

function rowCardHtml(d) {
  const fav = !!state.fav[d.id];
  const sizeNote = d.sizes.length > 1 ? d.sizes.map(z => z.label).join(' / ') : '';
  const hasStats = d.rating !== undefined;
  return `<div class="row-card ${d.available ? '' : 'unavailable'}">
    <div class="row-media" data-open="${d.id}">
      ${mediaHtml(d, '', 26)}
      ${!d.available ? `<div class="row-offer unavail">${t('unavailable')}</div>` : d.offer ? `<div class="row-offer">-${d.offerPct}%</div>` : ''}
    </div>
    <div class="row-body" data-open="${d.id}">
      <div class="row-name">${esc(d.name)}</div>
      <div class="row-tagline">${esc(catLabel(d.cat))}</div>
      ${hasStats ? `<div class="row-meta">
        <span class="stat">${starIcon(12)} ${d.rating}</span>
        <span class="stat">${d.cal} ${t('kcal')}</span>
        <span class="stat">${d.time} ${t('min')}</span>
        ${sizeNote ? `<span class="stat">${esc(sizeNote)}</span>` : ''}
      </div>` : (sizeNote ? `<div class="row-meta"><span class="stat">${esc(sizeNote)}</span></div>` : '')}
    </div>
    <div class="row-side">
      <button type="button" class="row-fav-btn ${fav ? 'active' : ''}" data-fav="${d.id}">${heartIcon(fav)}</button>
      <span class="row-price"><span class="num">${money(d.sizes[0].price)}</span></span>
      ${d.available
        ? `<button type="button" class="add-btn ${inCart(d.id) ? 'in-cart' : ''}" data-add="${d.id}">${plusMinusIcon(inCart(d.id))}</button>`
        : `<button type="button" class="add-btn add-btn-disabled" disabled>${plusMinusIcon(false)}</button>`}
    </div>
  </div>`;
}

function bindDishCardEvents(root) {
  root.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openDetail(el.getAttribute('data-open'))));
  root.querySelectorAll('[data-fav]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    toggleFav(DISHES.find(d => d.id === el.getAttribute('data-fav')));
  }));
  root.querySelectorAll('[data-add]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    const d = DISHES.find(x => x.id === el.getAttribute('data-add'));
    addToCart(d, 0, 1);
    renderAll();
  }));
}

function renderScreens() {
  ['home', 'menu', 'fav', 'cart', 'detail'].forEach(s => {
    byId('screen-' + s).setAttribute('data-active', String(state.screen === s));
  });

  const list = sortList(DISHES.filter(d =>
    matchesCat(d) && matchesQuery(d) && matchesPrice(d) && matchesPrepTime(d) &&
    matchesSpicy(d) && matchesVegOnly(d) && matchesOfferOnly(d) && matchesRecommendedOnly(d)
  ));

  // Home
  byId('homeTitle').textContent = catLabel(state.cat) + ' · ' + positionsLabel(list.length);
  const homeGrid = byId('homeGrid');
  homeGrid.innerHTML = list.slice(0, 12).map(dishCardHtml).join('') || emptyResultsHtml();
  bindDishCardEvents(homeGrid);
  byId('fullMenuBtn').textContent = t('fullMenu');
  byId('fullMenuBtn').onclick = () => go('menu');

  // Menu (full list, plus tab filter)
  const menuList = list.filter(matchesTab);
  byId('menuTitle').textContent = catLabel(state.cat) + ' · ' + positionsLabel(menuList.length);
  const menuGrid = byId('menuGrid');
  menuGrid.innerHTML = menuList.map(rowCardHtml).join('') || emptyResultsHtml();
  bindDishCardEvents(menuGrid);

  // Favorites
  const favs = favList();
  byId('favTitle').textContent = t('favTitle');
  byId('favCountLabel').textContent = savedCountLabel(favs.length);
  const favGrid = byId('favGrid');
  favGrid.innerHTML = favs.map(rowCardHtml).join('');
  bindDishCardEvents(favGrid);
  favGrid.hidden = favs.length === 0;
  byId('favEmpty').hidden = favs.length > 0;
  byId('favEmptyTitle').textContent = t('favEmptyTitle');
  byId('favEmptySub').textContent = t('favEmptySub');
  byId('favBrowseBtn').textContent = t('favBrowse');
  byId('favBackBtn').onclick = () => go('home');
  byId('favBrowseBtn').onclick = () => go('menu');

  renderCartScreen();
  renderDetailScreen();
}

function emptyResultsHtml() {
  return `<div class="empty-state" style="grid-column:1/-1;">
    <div class="empty-title">${esc(t('notFoundTitle'))}</div>
    <div class="empty-sub">${esc(t('notFoundSub'))}</div>
  </div>`;
}

function renderCartScreen() {
  const entries = cartEntries();
  const total = cartTotal();

  byId('cartItems').innerHTML = entries.map(c => `
    <div class="cart-row">
      ${mediaHtml(c.dish, '', 22)}
      <div class="cart-row-body">
        <div class="cart-row-name">${esc(c.dish.name)}</div>
        <div class="cart-row-meta">${c.dish.sizes[c.size].label ? esc(c.dish.sizes[c.size].label) + ' · ' : ''}${money(c.dish.sizes[c.size].price)}</div>
        <div class="cart-row-bottom">
          <div class="qty-ctrl">
            <button type="button" class="qty-btn minus" data-dec="${c.key}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF5722" stroke-width="3"><path d="M5 12h14"/></svg></button>
            <span class="qty-num">${c.qty}</span>
            <button type="button" class="qty-btn plus" data-inc="${c.key}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg></button>
          </div>
          <div class="line-total">${money(c.dish.sizes[c.size].price * c.qty)}</div>
        </div>
      </div>
    </div>`).join('');

  document.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => bumpCart(b.getAttribute('data-inc'), 1)));
  document.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => bumpCart(b.getAttribute('data-dec'), -1)));

  byId('cartTotalLabel').textContent = t('total');
  byId('cartTotal').textContent = money(total);
  const n = entries.reduce((a, c) => a + c.qty, 0);
  byId('orderLabel').textContent = orderLineLabel(n);
  byId('orderTotal').textContent = money(total);

  byId('cartTitle').textContent = t('cartTitle');
  byId('cartLayout').hidden = entries.length === 0;
  byId('cartEmpty').hidden = entries.length > 0;
  byId('cartEmptyTitle').textContent = t('cartEmptyTitle');
  byId('cartEmptySub').textContent = t('cartEmptySub');
  byId('cartBrowseBtn').textContent = t('cartOpenMenu');
  byId('cartBackBtn').onclick = () => go('menu');
  byId('cartBrowseBtn').onclick = () => go('menu');
  byId('placeOrderBtn').onclick = () => submitOrder(entries, total);
}

async function submitOrder(entries, total) {
  const btn = byId('placeOrderBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  const originalLabel = byId('orderLabel').textContent;
  byId('orderLabel').textContent = t('sending');

  const payload = {
    table: tableLabelRu(),
    total,
    items: entries.map(c => ({
      name: c.dish.name,
      size: c.dish.sizes[c.size].label,
      qty: c.qty,
      lineTotal: c.dish.sizes[c.size].price * c.qty
    }))
  };

  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!res.ok || !data.ok) throw new Error(data.error || 'request failed');
    state.cart = {};
    go('home');
    flash(t('orderSent'));
  } catch (e) {
    btn.disabled = false;
    byId('orderLabel').textContent = originalLabel;
    flash(t('orderFailed'));
  }
}

function renderDetailScreen() {
  const dish = DISHES.find(d => d.id === state.detailId) || DISHES[0];
  const fav = !!state.fav[dish.id];
  const unit = dish.sizes[state.size].price;
  const hasSizes = dish.sizes.length > 1;
  const hasStats = dish.rating !== undefined;

  if (state.suggestId !== dish.id) {
    state.suggestId = dish.id;
    state.suggestList = getComplementaryDishes(dish, 6);
  }
  const suggestions = state.suggestList;

  byId('detailContent').innerHTML = `
    <div class="detail-top">
      <button type="button" class="icon-btn" id="detailCloseBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="2.6"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <div class="detail-actions">
        <button type="button" class="icon-btn" id="detailInfoBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141414" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.6v.01"/></svg></button>
        <button type="button" class="icon-btn" id="detailFavBtn">${heartIcon(fav, 16)}</button>
      </div>
    </div>
    <div class="detail-layout">
      <div class="detail-media ${dish.available ? '' : 'unavailable'}">
        ${mediaHtml(dish, '', 64)}
        <div class="detail-price-pill">${money(unit)}</div>
      </div>
      <div>
        <div class="detail-head">
          <div>
            <div class="detail-name">${esc(dish.name)}</div>
            <div class="detail-tagline">${esc(catLabel(dish.cat))}</div>
          </div>
          ${hasStats ? `<div class="detail-cal">${catIcon(dish.cat, 14, '#FF5722')}${dish.cal} ${t('kcal')}</div>` : ''}
        </div>
        ${hasStats ? `
        <div class="detail-stats">
          <div class="stat-card"><div class="stat-label">${t('rating')}</div><div class="stat-value">${dish.rating}${starIcon(12)}</div></div>
          <div class="stat-card"><div class="stat-label">${t('cookTime')}</div><div class="stat-value">${dish.time} ${t('min')}</div></div>
          <div class="stat-card"><div class="stat-label">${t('category')}</div><div class="stat-value">${esc(catLabel(dish.cat))}</div></div>
        </div>` : ''}
        ${!dish.available ? `<div class="unavail-banner">${t('unavailableNow')}</div>` : ''}
        ${hasSizes ? `
        <div class="size-card">
          <div class="size-title">${t('portion')}</div>
          <div>
            ${dish.sizes.map((z, i) => `
              <button type="button" class="size-opt" data-size="${i}">
                <span class="size-left">
                  <span class="size-dot ${i === state.size ? 'checked' : ''}">${i === state.size ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4"><path d="${CHECK_D}"/></svg>` : ''}</span>
                  <span class="size-label">${esc(z.label)}</span>
                </span>
                <span class="size-price">${money(z.price)}</span>
              </button>`).join('')}
          </div>
        </div>` : ''}
        <div class="detail-order-bar ${dish.available ? '' : 'disabled'}">
          ${dish.available ? `
          <button type="button" class="detail-add-btn" id="detailAddBtn">${t('addToOrder')} · ${money(unit * state.qty)}</button>
          <div class="detail-qty">
            <button type="button" class="qty-btn minus" id="detailDecBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5722" stroke-width="3"><path d="M5 12h14"/></svg></button>
            <span class="qty-num">${state.qty}</span>
            <button type="button" class="qty-btn plus" id="detailIncBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg></button>
          </div>` : `<span class="detail-add-btn detail-add-btn-disabled">${t('unavailable')}</span>`}
        </div>
      </div>
    </div>
    ${suggestions.length ? `
    <div class="detail-suggest">
      <div class="section-title-row">
        <h2>${esc(t('goesWellTitle'))}</h2>
      </div>
      <div class="suggest-row" id="detailSuggestRow">
        ${suggestions.map(dishCardHtml).join('')}
      </div>
    </div>` : ''}`;

  if (suggestions.length) bindDishCardEvents(byId('detailSuggestRow'));

  byId('detailCloseBtn').onclick = () => go('menu');
  byId('detailInfoBtn').onclick = () => { state.infoOpen = true; renderModals(); };
  byId('detailFavBtn').onclick = () => toggleFav(dish);
  document.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => {
    state.size = parseInt(b.getAttribute('data-size'), 10); renderAll();
  }));
  if (dish.available) {
    byId('detailIncBtn').onclick = () => { state.qty += 1; renderAll(); };
    byId('detailDecBtn').onclick = () => { state.qty = Math.max(1, state.qty - 1); renderAll(); };
    byId('detailAddBtn').onclick = () => { addToCart(dish, state.size, state.qty); go('menu'); };
  }
}

function renderCartBar() {
  const cCount = cartCount();
  const show = cCount > 0 && ['home', 'menu', 'fav'].includes(state.screen);
  byId('cartBarWrap').hidden = !show;
  if (!show) return;
  byId('cartBarLabel').textContent = t('viewOrder');
  byId('cartBarCount').textContent = cCount + 'x';
  byId('cartBarTotal').textContent = money(cartTotal());
  byId('cartBarBtn').onclick = () => go('cart');
}

function renderToast() {
  const el = byId('toast');
  el.hidden = !state.toast;
  el.textContent = state.toast;
}

function renderModals() {
  byId('infoBackdrop').hidden = !state.infoOpen;
  byId('infoModalTitle').textContent = t('goodToKnow');
  byId('infoVenue').textContent = RESTAURANT.name;
  byId('infoTable').textContent = tableLabel();
  byId('infoHoursTitle').textContent = t('hours');
  byId('infoHoursValue').textContent = (currentLang() === 'en' ? RESTAURANT.hoursEn : RESTAURANT.hoursRu) || t('hoursValue');
  byId('infoAddressTitle').textContent = t('address');
  byId('infoAddressValue').textContent = RESTAURANT.address;
  byId('infoPhoneTitle').textContent = t('phone');
  byId('infoPhoneLink').textContent = RESTAURANT.phone;
  byId('infoPhoneLink').href = 'tel:' + RESTAURANT.phoneTel;
  byId('infoAllergensTitle').textContent = t('allergens');
  byId('infoAllergensValue').textContent = t('allergensValue');
  byId('infoGotItBtn').textContent = t('gotIt');

  byId('filtersBackdrop').hidden = !state.filtersOpen;
  byId('filtersModalTitle').textContent = t('filters');
  byId('priceFilterLabel').textContent = t('price');
  byId('fromLabel').textContent = t('from');
  byId('toLabel').textContent = t('to');
  byId('resetFiltersBtn').textContent = t('reset');
  byId('priceMinInput').value = state.fMin;
  byId('priceMaxInput').value = state.fMax;

  byId('prepFilterLabel').textContent = t('prepLabel');
  byId('prepOpts').innerHTML = [
    { v: 0, label: t('prepAny') }, { v: 15, label: t('prepUpTo15') }, { v: 30, label: t('prepUpTo30') }
  ].map(o => `<button type="button" class="opt-btn ${state.fPrep === o.v ? 'active' : ''}" data-prep="${o.v}">${esc(o.label)}</button>`).join('');
  document.querySelectorAll('#prepOpts [data-prep]').forEach(b => b.addEventListener('click', () => {
    state.fPrep = Number(b.getAttribute('data-prep')); renderAll();
  }));

  byId('spicyFilterLabel').textContent = t('spicyLabel');
  byId('spicyOpts').innerHTML = [
    { v: 'any', label: t('spicyAny') }, { v: 'spicy', label: t('spicySpicy') }, { v: 'mild', label: t('spicyMild') }
  ].map(o => `<button type="button" class="opt-btn ${state.fSpicy === o.v ? 'active' : ''}" data-spicy="${o.v}">${esc(o.label)}</button>`).join('');
  document.querySelectorAll('#spicyOpts [data-spicy]').forEach(b => b.addEventListener('click', () => {
    state.fSpicy = b.getAttribute('data-spicy'); renderAll();
  }));

  byId('alsoShowLabel').textContent = t('alsoShowLabel');
  byId('toggleOpts').innerHTML = [
    { key: 'fVegOnly', id: 'vegOnlyBtn', label: t('vegOnly') },
    { key: 'fOfferOnly', id: 'offerOnlyBtn', label: t('offerOnly') },
    { key: 'fRecommendedOnly', id: 'recommendedOnlyBtn', label: t('recommendedOnly') }
  ].map(o => `<button type="button" class="opt-btn toggle ${state[o.key] ? 'active' : ''}" id="${o.id}">${esc(o.label)}</button>`).join('');
  byId('vegOnlyBtn').addEventListener('click', () => { state.fVegOnly = !state.fVegOnly; renderAll(); });
  byId('offerOnlyBtn').addEventListener('click', () => { state.fOfferOnly = !state.fOfferOnly; renderAll(); });
  byId('recommendedOnlyBtn').addEventListener('click', () => { state.fRecommendedOnly = !state.fRecommendedOnly; renderAll(); });

  const resultCount = DISHES.filter(d =>
    matchesCat(d) && matchesQuery(d) && matchesPrice(d) && matchesPrepTime(d) &&
    matchesSpicy(d) && matchesVegOnly(d) && matchesOfferOnly(d) && matchesRecommendedOnly(d) &&
    (state.screen === 'menu' ? matchesTab(d) : true)
  ).length;
  byId('applyFiltersBtn').textContent = (currentLang() === 'en' ? 'Show ' : 'Показать ') + positionsLabel(resultCount);

  byId('sortBackdrop').hidden = !state.sortOpen;
  byId('sortModalTitle').textContent = t('sortLabel');
  byId('sortList').innerHTML = [
    { v: 'default', label: t('sortDefault') },
    { v: 'price-asc', label: t('sortPriceAsc') },
    { v: 'price-desc', label: t('sortPriceDesc') },
    { v: 'rating-desc', label: t('sortRating') }
  ].map(o => `<button type="button" class="sort-item ${state.sortBy === o.v ? 'active' : ''}" data-sort="${o.v}">
      <span>${esc(o.label)}</span>
      ${state.sortBy === o.v ? checkIcon(15) : ''}
    </button>`).join('');
  document.querySelectorAll('#sortList [data-sort]').forEach(b => b.addEventListener('click', () => {
    state.sortBy = b.getAttribute('data-sort'); state.sortOpen = false; renderAll();
  }));

  byId('randomBackdrop').hidden = !state.randomOpen;
  byId('randomModalTitle').textContent = t('randomModalTitle');
}

/* ---------------------------------------------------------------- init ---------------------------------------------------------------- */

function bindStaticEvents() {
  byId('brandHomeBtn').addEventListener('click', () => go('home'));
  byId('searchInput').addEventListener('input', e => { state.query = e.target.value; renderAll(); });

  byId('langBtn').addEventListener('click', () => {
    state.lang = (state.lang + 1) % LANGS.length;
    flash(t('languageSwitched') + ' · ' + LANGS[state.lang].name);
    renderAll();
  });

  byId('infoBtn').addEventListener('click', () => { state.infoOpen = true; renderModals(); });
  byId('infoCloseBtn').addEventListener('click', () => { state.infoOpen = false; renderModals(); });
  byId('infoGotItBtn').addEventListener('click', () => { state.infoOpen = false; renderModals(); });
  byId('infoBackdrop').addEventListener('click', e => { if (e.target.id === 'infoBackdrop') { state.infoOpen = false; renderModals(); } });

  byId('filterBtn').addEventListener('click', () => { state.filtersOpen = true; renderModals(); });
  byId('filtersCloseBtn').addEventListener('click', () => { state.filtersOpen = false; renderModals(); });
  byId('filtersBackdrop').addEventListener('click', e => { if (e.target.id === 'filtersBackdrop') { state.filtersOpen = false; renderModals(); } });
  byId('applyFiltersBtn').addEventListener('click', () => { state.filtersOpen = false; renderAll(); });
  byId('resetFiltersBtn').addEventListener('click', () => {
    Object.assign(state, { fMin: '', fMax: '', fPrep: 0, fSpicy: 'any', fVegOnly: false, fOfferOnly: false, fRecommendedOnly: false });
    renderAll();
  });
  byId('priceMinInput').addEventListener('input', e => { state.fMin = e.target.value; renderModals(); });
  byId('priceMaxInput').addEventListener('input', e => { state.fMax = e.target.value; renderModals(); });

  byId('sortBtn').addEventListener('click', () => { state.sortOpen = true; renderModals(); });
  byId('sortCloseBtn').addEventListener('click', () => { state.sortOpen = false; renderModals(); });
  byId('sortBackdrop').addEventListener('click', e => { if (e.target.id === 'sortBackdrop') { state.sortOpen = false; renderModals(); } });

  byId('randomBtn').addEventListener('click', openRandomPicker);
  byId('randomCloseBtn').addEventListener('click', closeRandomPicker);
  byId('randomBackdrop').addEventListener('click', e => { if (e.target.id === 'randomBackdrop') closeRandomPicker(); });
}

async function loadMenu() {
  const res = await fetch('/api/menu');
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || 'request failed');
  RESTAURANT = {
    name: data.restaurant.name, phone: data.restaurant.phone, phoneTel: data.restaurant.phoneTel,
    address: data.restaurant.address, hoursRu: data.restaurant.hoursRu, hoursEn: data.restaurant.hoursEn
  };
  CATS = data.categories.map(c => c.nameRu);
  CAT_META = {};
  data.categories.forEach(c => { CAT_META[c.nameRu] = { nameEn: c.nameEn }; });
  DISHES = data.dishes;
}

function showLoadError() {
  byId('initialLoading').hidden = true;
  const el = document.createElement('div');
  el.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px;text-align:center;font-family:Inter,system-ui,sans-serif;color:#141414;';
  el.innerHTML = `<div>
    <div style="font-size:20px;font-weight:800;margin-bottom:8px;">Меню сейчас недоступно</div>
    <div style="font-size:14px;color:#7C736D;margin-bottom:18px;">Не получилось загрузить данные. Попробуйте обновить страницу.</div>
    <button type="button" onclick="location.reload()" style="border:none;background:#FF5722;color:#fff;font-size:14px;font-weight:700;padding:13px 24px;border-radius:999px;cursor:pointer;">Обновить</button>
  </div>`;
  document.getElementById('app').replaceWith(el);
}

async function init() {
  loadPersisted();
  applyHash();
  bindStaticEvents();
  try {
    await loadMenu();
  } catch (e) {
    console.error('[init] failed to load menu:', e);
    showLoadError();
    return;
  }
  if (!state.detailId && DISHES.length) state.detailId = DISHES[0].id;
  if (state.screen === 'detail' && !DISHES.some(d => d.id === state.detailId)) state.screen = 'home';
  byId('initialLoading').hidden = true;
  byId('app').hidden = false;
  renderAll();
}
init();
