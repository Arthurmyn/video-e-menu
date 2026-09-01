// GET   /api/admin/paloma — current Paloma365 POS integration settings
// PUT   /api/admin/paloma — partial update of those settings
// POST  /api/admin/paloma { action: 'points' }    — list this restaurant's Paloma365 venues
// POST  /api/admin/paloma { action: 'automatch' } — bulk-link dishes to Paloma items by matching name
// All require the admin session cookie.

const { getPool, getRestaurant } = require('../_db');
const { requireAuth } = require('../_auth');
const { palomaRequest, isConfigured } = require('../_paloma');

const FIELD_COLUMN = {
  palomaEnabled: 'paloma_enabled',
  palomaAuthkey: 'paloma_authkey',
  palomaPointId: 'paloma_point_id',
  palomaClass: 'paloma_class'
};

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const client = getPool();

  if (req.method === 'GET') {
    try {
      const restaurant = await getRestaurant(client);
      res.status(200).json({
        ok: true,
        palomaEnabled: restaurant.paloma_enabled,
        palomaAuthkey: restaurant.paloma_authkey,
        palomaPointId: restaurant.paloma_point_id,
        palomaClass: restaurant.paloma_class
      });
    } catch (e) {
      console.error('[admin/paloma GET]', e);
      res.status(500).json({ ok: false, error: 'Failed to load settings' });
    }
    return;
  }

  if (req.method === 'PUT') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!body || typeof body !== 'object') { res.status(400).json({ ok: false, error: 'Empty request body' }); return; }

    try {
      const restaurant = await getRestaurant(client);
      const sets = [];
      const values = [];
      for (const [key, column] of Object.entries(FIELD_COLUMN)) {
        if (body[key] === undefined) continue;
        values.push(key === 'palomaEnabled' ? !!body[key] : body[key]);
        sets.push(`${column} = $${values.length}`);
      }
      if (sets.length) {
        values.push(restaurant.id);
        await client.query(`UPDATE restaurants SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
      }
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[admin/paloma PUT]', e);
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
    if (!isConfigured(restaurant)) {
      res.status(400).json({ ok: false, error: 'Save an AUTHKEY and enable the integration first' });
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
        console.error('[admin/paloma automatch]', e);
        res.status(500).json({ ok: false, error: 'Failed to save matches' });
      }
      return;
    }

    res.status(400).json({ ok: false, error: 'Unknown action' });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
