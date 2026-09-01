// POST /api/order — receives an order from the e-menu frontend, relays it to
// the staff Telegram group via the Bot API, and logs it in the `orders` table.
// Every order gets a row (not just payment-flow ones) — that's what makes
// amount-matching possible for payment_auto_confirm, and it's a free order
// log as a side effect. Telegram credentials come from environment variables
// only — never hardcode the bot token here, it must stay out of any file
// that could be committed or shipped to the browser.

const { getPool, getRestaurant } = require('../_db');
const { palomaRequest, isConfigured: palomaConfigured } = require('../_paloma');

const MAX_ITEMS = 50;
const MAX_STRING = 200;

function clean(str) {
  return String(str ?? '').slice(0, MAX_STRING).replace(/[\r\n]+/g, ' ').trim();
}

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('ru-RU') + ' ₸';
}

function buildMessage(order, mode, method) {
  const header = mode === 'awaiting_payment'
    ? '⏳ Ожидает автоподтверждения оплаты (Kaspi) — '
    : mode === 'awaiting_manual_check'
      ? '⏳ ТРЕБУЕТ ПРОВЕРКИ ОПЛАТЫ (Kaspi) — '
      : '🔔 Новый заказ — ';
  const lines = [header + clean(order.table || 'стол не указан'), ''];
  for (const it of order.items) {
    const size = it.size ? ' (' + clean(it.size) + ')' : '';
    lines.push(`• ${clean(it.name)}${size} × ${Number(it.qty) || 1} — ${formatMoney(it.lineTotal)}`);
  }
  lines.push('', 'Итого: ' + formatMoney(order.total));
  lines.push(new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }));
  if (mode === 'sent' && method === 'cash') {
    lines.push('', '💵 Оплата наличными/картой — у официанта.');
  } else if (mode === 'awaiting_manual_check') {
    lines.push('', '⚠️ Гость нажал «Я оплатил» — проверьте поступление в Kaspi перед началом приготовления.');
  } else if (mode === 'awaiting_payment') {
    lines.push('', 'Официанту действовать не нужно — подтвердится автоматически, как только поступит оплата.');
  }
  return lines.join('\n');
}

function validateOrder(body) {
  if (!body || typeof body !== 'object') return 'Empty request body';
  if (!Array.isArray(body.items) || body.items.length === 0) return 'Order has no items';
  if (body.items.length > MAX_ITEMS) return 'Too many items';
  for (const it of body.items) {
    if (!it || typeof it.name !== 'string' || !it.name.trim()) return 'Item missing a name';
    if (!Number.isFinite(Number(it.qty)) || Number(it.qty) <= 0) return 'Item has an invalid quantity';
    if (!Number.isFinite(Number(it.lineTotal)) || Number(it.lineTotal) < 0) return 'Item has an invalid price';
  }
  if (!Number.isFinite(Number(body.total)) || Number(body.total) < 0) return 'Invalid order total';
  return null;
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('[order] Missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID env vars');
    return { ok: false };
  }
  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const tgData = await tgRes.json().catch(() => ({ ok: false }));
  if (!tgRes.ok || !tgData.ok) console.error('[order] Telegram API error:', tgData);
  return tgData;
}

// Pushes the order into the restaurant's own Paloma365 kassa, if configured.
// Only ever logs on failure/partial-mapping — a Paloma hiccup must never
// affect the guest's own order, which already went through above regardless.
async function pushToPaloma(client, restaurant, body, orderId, method, mode) {
  if (!palomaConfigured(restaurant) || !restaurant.paloma_point_id) return { attempted: false };

  const orderedIds = body.items.map(it => it.id).filter(id => Number.isInteger(id));
  let dishRows = [];
  if (orderedIds.length) {
    try {
      const result = await client.query(
        'SELECT id, paloma_object_id FROM dishes WHERE restaurant_id = $1 AND id = ANY($2)',
        [restaurant.id, orderedIds]
      );
      dishRows = result.rows;
    } catch (e) {
      console.error('[order] Failed to look up dish->Paloma mappings:', e);
    }
  }
  const objectIdByDishId = new Map(dishRows.filter(r => r.paloma_object_id).map(r => [r.id, r.paloma_object_id]));

  const mappedItems = [];
  const unmappedNames = [];
  for (const it of body.items) {
    const palomaObjectId = Number.isInteger(it.id) ? objectIdByDishId.get(it.id) : undefined;
    if (palomaObjectId) {
      mappedItems.push({ object_id: Number(palomaObjectId) || palomaObjectId, name: clean(it.name), count: Number(it.qty) || 1, price: Number(it.lineTotal) / (Number(it.qty) || 1) });
    } else {
      unmappedNames.push(clean(it.name));
    }
  }

  if (mappedItems.length === 0) {
    return { attempted: true, ok: false, error: 'No ordered items are mapped to a Paloma365 item', unmappedNames };
  }

  const mappedTotal = mappedItems.reduce((sum, it) => sum + it.price * it.count, 0);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const almatyDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Almaty' }));
  const dateStr = `${almatyDate.getFullYear()}-${pad(almatyDate.getMonth() + 1)}-${pad(almatyDate.getDate())} ${pad(almatyDate.getHours())}:${pad(almatyDate.getMinutes())}:${pad(almatyDate.getSeconds())}`;

  const result = await palomaRequest(restaurant, 'order', {
    query: { point_id: restaurant.paloma_point_id },
    body: {
      order_id: String(orderId),
      date: dateStr,
      name: clean(body.table || 'Гость'),
      person_amount: 1,
      total_price: Math.round(mappedTotal),
      discount_amount: 0,
      delivery_type: 0, // dine-in has no real analog in this API — 0 (self-pickup) is the closest
      is_cash: method === 'cash',
      is_payed: false,
      order_items: mappedItems
    }
  });

  if (result.ok && result.data && result.data.paloma_order_id) {
    try {
      await client.query('UPDATE orders SET paloma_order_id = $1 WHERE id = $2', [String(result.data.paloma_order_id), orderId]);
    } catch (e) {
      console.error('[order] Failed to save paloma_order_id:', e);
    }
  }

  return { attempted: true, ok: !!(result.ok && result.data && result.data.paloma_order_id), error: result.error, unmappedNames };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }

  const validationError = validateOrder(body);
  if (validationError) {
    res.status(400).json({ ok: false, error: validationError });
    return;
  }

  const client = getPool();
  let restaurant;
  try {
    restaurant = await getRestaurant(client);
  } catch (e) {
    console.error('[order] Failed to resolve restaurant, sending as a normal order:', e);
  }

  const paymentEnabled = !!(restaurant && restaurant.payment_enabled);
  const method = body.method === 'cash' ? 'cash' : body.method === 'kaspi' ? 'kaspi' : null;
  const autoConfirm = paymentEnabled && method === 'kaspi' && !!restaurant.payment_auto_confirm;
  const mode = method === 'cash'
    ? 'sent'
    : autoConfirm
      ? 'awaiting_payment'
      : (paymentEnabled && method === 'kaspi') ? 'awaiting_manual_check' : 'sent';
  const status = autoConfirm ? 'awaiting_payment' : 'sent';

  const text = buildMessage(body, mode, method);
  const tgData = await sendTelegram(text);
  if (!tgData.ok) {
    res.status(502).json({ ok: false, error: 'Failed to reach the kitchen chat' });
    return;
  }

  let orderId = null;
  if (restaurant) {
    try {
      const insert = await client.query(
        `INSERT INTO orders (restaurant_id, table_label, items_json, total, status, payment_method, telegram_message_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [restaurant.id, clean(body.table || ''), JSON.stringify(body.items), Math.round(Number(body.total)),
         status, method, tgData.result ? String(tgData.result.message_id) : null]
      );
      orderId = insert.rows[0].id;
    } catch (e) {
      console.error('[order] Failed to log order in DB (Telegram message already sent):', e);
    }
  }

  if (orderId && restaurant && restaurant.paloma_enabled) {
    try {
      const pushResult = await pushToPaloma(client, restaurant, body, orderId, method, mode);
      if (pushResult.attempted && !pushResult.ok) {
        console.error('[order] Paloma365 push failed:', pushResult.error, pushResult.unmappedNames);
        const warnLines = ['⚠️ Не удалось передать заказ в кассу Paloma — введите вручную.'];
        if (pushResult.unmappedNames && pushResult.unmappedNames.length) {
          warnLines.push('Без привязки к Paloma: ' + pushResult.unmappedNames.join(', '));
        }
        await sendTelegram(warnLines.join('\n'));
      }
    } catch (e) {
      console.error('[order] Unexpected error pushing to Paloma365:', e);
    }
  }

  res.status(200).json(
    orderId
      ? { ok: true, orderId, awaitConfirmation: autoConfirm ? true : undefined }
      : { ok: true }
  );
};
