// GET  /api/admin/restaurant — current payment + Paloma365 POS settings
// PUT  /api/admin/restaurant — partial update of those settings
// POST /api/admin/restaurant { action: 'points' }    — list this restaurant's Paloma365 venues
// POST /api/admin/restaurant { action: 'automatch' } — bulk-link dishes to Paloma items by name
// All require the admin session cookie. Payment and Paloma settings share this
// one file (rather than a file each) to stay under Vercel Hobby's 12-function
// cap per deployment — both are restaurant-scoped config, not really separate
// resources.

const crypto = require('crypto');
const { getPool, getRestaurant } = require('../_db');
const { requireAuth } = require('../_auth');
const { palomaRequest, isConfigured: palomaConfigured } = require('../_paloma');

const MAX_DISPLAY_NAME = 200;

const FIELD_COLUMN = {
  paymentEnabled: 'payment_enabled',
  kaspiQrUrl: 'kaspi_qr_url',
  kaspiDisplayName: 'kaspi_display_name',
  paymentAutoConfirm: 'payment_auto_confirm',
  palomaEnabled: 'paloma_enabled',
  palomaAuthkey: 'paloma_authkey',
  palomaPointId: 'paloma_point_id',
  palomaClass: 'paloma_class'
};
const BOOLEAN_FIELDS = new Set(['paymentEnabled', 'paymentAutoConfirm', 'palomaEnabled']);

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
        kaspiWebhookToken: restaurant.kaspi_webhook_token,
        palomaEnabled: restaurant.paloma_enabled,
        palomaAuthkey: restaurant.paloma_authkey,
        palomaPointId: restaurant.paloma_point_id,
        palomaClass: restaurant.paloma_class
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

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    const action = body && body.action;

    let restaurant;
    try {
      restaurant = await getRestaurant(client);
    } catch (e) {
      res.status(500).json({ ok: false, error: 'Failed to resolve restaurant' });
      return;
    }
    if (!palomaConfigured(restaurant)) {
      res.status(400).json({ ok: false, error: 'Save a Paloma365 AUTHKEY and enable the integration first' });
      return;
    }

    if (action === 'points') {
      const result = await palomaRequest(restaurant, 'points');
      if (!result.ok || !Array.isArray(result.data)) {
        const message = !result.ok ? result.error : (result.data && result.data.error) || 'Unexpected response from Paloma365';
        res.status(502).json({ ok: false, error: message });
        return;
      }
      res.status(200).json({ ok: true, points: result.data });
      return;
    }

    if (action === 'automatch') {
      const result = await palomaRequest(restaurant, 'menu');
      if (!result.ok) { res.status(502).json({ ok: false, error: result.error }); return; }

      const nameToId = new Map();
      const groups = (result.data && result.data.item_groups) || [];
      for (const group of groups) {
        for (const item of group.items || []) {
          nameToId.set(String(item.name || '').trim().toLowerCase(), item.object_id);
        }
      }

      try {
        const dishRows = await client.query('SELECT id, name FROM dishes WHERE restaurant_id = $1', [restaurant.id]);
        let matched = 0;
        for (const dish of dishRows.rows) {
          const palomaId = nameToId.get(String(dish.name).trim().toLowerCase());
          if (palomaId === undefined) continue;
          await client.query('UPDATE dishes SET paloma_object_id = $1 WHERE id = $2', [String(palomaId), dish.id]);
          matched++;
        }
        res.status(200).json({ ok: true, matched, total: dishRows.rows.length });
      } catch (e) {
        console.error('[admin/restaurant automatch]', e);
        res.status(500).json({ ok: false, error: 'Failed to save matches' });
      }
      return;
    }

    res.status(400).json({ ok: false, error: 'Unknown action' });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
