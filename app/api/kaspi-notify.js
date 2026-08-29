// POST /api/kaspi-notify?token=<kaspi_webhook_token> — receives a forwarded
// Kaspi payment notification from a phone automation app (e.g. MacroDroid)
// watching the restaurant's own Kaspi Business app, and auto-confirms the
// oldest matching pending order by amount.
//
// This is NOT an official Kaspi API — there is no documented notification
// text format to rely on, so the amount regex below is a best-effort guess.
// It may need tightening once real notification text is available; nothing
// here should ever *guess wrong* (a false positive would confirm someone's
// order without real payment), so an ambiguous or unmatched notification is
// just logged and ignored rather than acted on.

const { getPool } = require('./_db');

const MATCH_WINDOW_MINUTES = 30;
const AMOUNT_RE = /(\d[\d\s]{0,9})\s*(?:₸|kzt|тенге)/i;

function extractAmount(text) {
  const match = AMOUNT_RE.exec(String(text || ''));
  if (!match) return null;
  const digits = match[1].replace(/\s/g, '');
  const amount = Number(digits);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function extractText(body) {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') {
    if (typeof body.text === 'string') return body.text;
    if (typeof body.message === 'string') return body.message;
  }
  return '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const token = req.query.token;
  if (!token || typeof token !== 'string') {
    res.status(401).json({ ok: false, error: 'Missing token' });
    return;
  }

  const client = getPool();
  let restaurant;
  try {
    const result = await client.query('SELECT id FROM restaurants WHERE kaspi_webhook_token = $1', [token]);
    if (result.rows.length === 0) {
      res.status(401).json({ ok: false, error: 'Unknown token' });
      return;
    }
    restaurant = result.rows[0];
  } catch (e) {
    console.error('[kaspi-notify] DB error resolving token:', e);
    res.status(500).json({ ok: false, error: 'Server error' });
    return;
  }

  const text = extractText(req.body);
  const amount = extractAmount(text);
  console.log('[kaspi-notify] received:', JSON.stringify(text).slice(0, 300), '-> parsed amount:', amount);

  if (amount === null) {
    res.status(200).json({ ok: true, matched: false, reason: 'no_amount_found' });
    return;
  }

  try {
    const pending = await client.query(
      `SELECT id FROM orders
       WHERE restaurant_id = $1 AND status = 'awaiting_payment' AND total = $2
         AND created_at > now() - ($3 || ' minutes')::interval
       ORDER BY created_at ASC`,
      [restaurant.id, amount, MATCH_WINDOW_MINUTES]
    );

    if (pending.rows.length === 0) {
      console.log('[kaspi-notify] no pending order for amount', amount);
      res.status(200).json({ ok: true, matched: false, reason: 'no_pending_order' });
      return;
    }
    if (pending.rows.length > 1) {
      console.warn('[kaspi-notify] ambiguous match, multiple pending orders for amount', amount, '- confirming the oldest');
    }

    const orderId = pending.rows[0].id;
    await client.query(`UPDATE orders SET status = 'confirmed', updated_at = now() WHERE id = $1`, [orderId]);

    const token2 = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token2 && chatId) {
      fetch(`https://api.telegram.org/bot${token2}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `✅ Оплата подтверждена автоматически (заказ #${orderId}) — можно готовить.` })
      }).catch(e => console.error('[kaspi-notify] Telegram follow-up failed:', e));
    }

    res.status(200).json({ ok: true, matched: true, orderId });
  } catch (e) {
    console.error('[kaspi-notify] DB error matching order:', e);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
};
