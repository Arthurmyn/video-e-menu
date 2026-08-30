// POST /api/order — receives an order from the e-menu frontend, relays it to
// the staff Telegram group via the Bot API, and logs it in the `orders` table.
// Every order gets a row (not just payment-flow ones) — that's what makes
// amount-matching possible for payment_auto_confirm, and it's a free order
// log as a side effect. Telegram credentials come from environment variables
// only — never hardcode the bot token here, it must stay out of any file
// that could be committed or shipped to the browser.

const { getPool, getRestaurant } = require('../_db');

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

  res.status(200).json(
    orderId
      ? { ok: true, orderId, awaitConfirmation: autoConfirm ? true : undefined }
      : { ok: true }
  );
};
