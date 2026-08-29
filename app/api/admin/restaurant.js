// GET /api/admin/restaurant — current payment settings for the admin panel
// PUT /api/admin/restaurant — partial update of payment settings
// Both require the admin session cookie.

const { getPool, getRestaurant } = require('../_db');
const { requireAuth } = require('../_auth');

const MAX_DISPLAY_NAME = 200;

const FIELD_COLUMN = {
  paymentEnabled: 'payment_enabled',
  kaspiQrUrl: 'kaspi_qr_url',
  kaspiDisplayName: 'kaspi_display_name'
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
        kaspiDisplayName: restaurant.kaspi_display_name
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

    try {
      const restaurant = await getRestaurant(client);
      const sets = [];
      const values = [];
      for (const [key, column] of Object.entries(FIELD_COLUMN)) {
        if (body[key] === undefined) continue;
        values.push(key === 'paymentEnabled' ? !!body[key] : body[key]);
        sets.push(`${column} = $${values.length}`);
      }
      if (sets.length) {
        values.push(restaurant.id);
        await client.query(`UPDATE restaurants SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
      }
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[admin/restaurant PUT]', e);
      res.status(500).json({ ok: false, error: 'Failed to save settings' });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
