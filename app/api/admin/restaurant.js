// GET /api/admin/restaurant — current payment settings for the admin panel
// PUT /api/admin/restaurant — partial update of payment settings
// Both require the admin session cookie.

const crypto = require('crypto');
const { getPool, getRestaurant } = require('../_db');
const { requireAuth } = require('../_auth');

const MAX_DISPLAY_NAME = 200;

const FIELD_COLUMN = {
  paymentEnabled: 'payment_enabled',
  kaspiQrUrl: 'kaspi_qr_url',
  kaspiDisplayName: 'kaspi_display_name',
  paymentAutoConfirm: 'payment_auto_confirm'
};

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const client = getPool();

  if (req.method === 'GET') {
    try {
      const restaurant = await getRestaurant(client);
      res.status(200).json({
        ok: true,
        paymentEnabled: restaurant.payment_enabled,
        kaspiQrUrl: restaurant.kaspi_qr_url,
        kaspiDisplayName: restaurant.kaspi_display_name,
        paymentAutoConfirm: restaurant.payment_auto_confirm,
        kaspiWebhookToken: restaurant.kaspi_webhook_token
      });
    } catch (e) {
      console.error('[admin/restaurant GET]', e);
      res.status(500).json({ ok: false, error: 'Failed to load settings' });
    }
    return;
  }

  if (req.method === 'PUT') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!body || typeof body !== 'object') { res.status(400).json({ ok: false, error: 'Empty request body' }); return; }

    if (body.kaspiDisplayName !== undefined && body.kaspiDisplayName !== null &&
        (typeof body.kaspiDisplayName !== 'string' || body.kaspiDisplayName.length > MAX_DISPLAY_NAME)) {
      res.status(400).json({ ok: false, error: 'Invalid display name' });
      return;
    }
    if (body.kaspiQrUrl !== undefined && body.kaspiQrUrl !== null && typeof body.kaspiQrUrl !== 'string') {
      res.status(400).json({ ok: false, error: 'Invalid QR URL' });
      return;
    }

    const BOOLEAN_FIELDS = new Set(['paymentEnabled', 'paymentAutoConfirm']);

    try {
      const restaurant = await getRestaurant(client);
      const sets = [];
      const values = [];
      for (const [key, column] of Object.entries(FIELD_COLUMN)) {
        if (body[key] === undefined) continue;
        values.push(BOOLEAN_FIELDS.has(key) ? !!body[key] : body[key]);
        sets.push(`${column} = $${values.length}`);
      }
      let newToken;
      const wantsAutoConfirm = body.paymentAutoConfirm === true;
      if (body.regenerateKaspiToken || (wantsAutoConfirm && !restaurant.kaspi_webhook_token)) {
        newToken = crypto.randomBytes(16).toString('hex');
        values.push(newToken);
        sets.push(`kaspi_webhook_token = $${values.length}`);
      }
      if (sets.length) {
        values.push(restaurant.id);
        await client.query(`UPDATE restaurants SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
      }
      res.status(200).json(newToken ? { ok: true, kaspiWebhookToken: newToken } : { ok: true });
    } catch (e) {
      console.error('[admin/restaurant PUT]', e);
      res.status(500).json({ ok: false, error: 'Failed to save settings' });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
