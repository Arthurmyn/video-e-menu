// Vercel serverless function — POST /api/order
// Receives an order from the e-menu frontend and relays it to the staff Telegram
// group via the Bot API. Reads credentials from environment variables only —
// never hardcode the bot token here, it must stay out of any file that could
// be committed or shipped to the browser.

const { getPool, getRestaurant } = require('./_db');

const MAX_ITEMS = 50;
const MAX_STRING = 200;

function clean(str) {
  return String(str ?? '').slice(0, MAX_STRING).replace(/[\r\n]+/g, ' ').trim();
}

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('ru-RU') + ' ₸';
}

function buildMessage(order, paymentRequired) {
  const lines = [];
  lines.push((paymentRequired ? '⏳ ТРЕБУЕТ ПРОВЕРКИ ОПЛАТЫ (Kaspi) — ' : '🔔 Новый заказ — ') + clean(order.table || 'стол не указан'));
  lines.push('');
  for (const it of order.items) {
    const size = it.size ? ' (' + clean(it.size) + ')' : '';
    lines.push(`• ${clean(it.name)}${size} × ${Number(it.qty) || 1} — ${formatMoney(it.lineTotal)}`);
  }
  lines.push('');
  lines.push('Итого: ' + formatMoney(order.total));
  lines.push(new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }));
  if (paymentRequired) {
    lines.push('');
    lines.push('⚠️ Гость нажал «Я оплатил» — проверьте поступление в Kaspi перед началом приготовления.');
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('[order] Missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID env vars');
    res.status(500).json({ ok: false, error: 'Server is not configured yet' });
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

  let paymentRequired = false;
  try {
    const restaurant = await getRestaurant(getPool());
    paymentRequired = !!restaurant.payment_enabled;
  } catch (e) {
    console.error('[order] Failed to read payment settings, sending as a normal order:', e);
  }

  const text = buildMessage(body, paymentRequired);

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      console.error('[order] Telegram API error:', tgData);
      res.status(502).json({ ok: false, error: 'Failed to reach the kitchen chat' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[order] Network error calling Telegram:', e);
    res.status(502).json({ ok: false, error: 'Failed to reach the kitchen chat' });
  }
};
