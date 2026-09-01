// PUT    /api/admin/dishes/:id — update a dish (and replace its sizes, if provided)
// DELETE /api/admin/dishes/:id — remove a dish
// Both require the admin session cookie.

const { getPool, getRestaurantId } = require('../../_db');
const { requireAuth } = require('../../_auth');

const MAX_NAME = 200;
const MAX_SIZES = 10;
const MAX_LABEL = 40;

const FIELD_COLUMN = {
  name: 'name', categoryId: 'category_id', imgUrl: 'img_url', videoUrl: 'video_url', rating: 'rating',
  cal: 'cal', time: 'time_min', popular: 'popular', offerPct: 'offer_pct', available: 'available',
  spicy: 'is_spicy', vegetarian: 'is_vegetarian', palomaObjectId: 'paloma_object_id'
};

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const dishId = Number(req.query.id);
  if (!Number.isInteger(dishId)) { res.status(400).json({ ok: false, error: 'Invalid dish id' }); return; }

  const client = getPool();
  let restaurantId;
  try {
    restaurantId = await getRestaurantId(client);
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to resolve restaurant' });
    return;
  }

  const owns = await client.query('SELECT id FROM dishes WHERE id = $1 AND restaurant_id = $2', [dishId, restaurantId]);
  if (owns.rows.length === 0) { res.status(404).json({ ok: false, error: 'Dish not found' }); return; }

  if (req.method === 'DELETE') {
    try {
      await client.query('DELETE FROM dishes WHERE id = $1', [dishId]);
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[admin/dishes DELETE]', e);
      res.status(500).json({ ok: false, error: 'Failed to delete dish' });
    }
    return;
  }

  if (req.method === 'PUT') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!body || typeof body !== 'object') { res.status(400).json({ ok: false, error: 'Empty request body' }); return; }

    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > MAX_NAME)) {
      res.status(400).json({ ok: false, error: 'Invalid name' }); return;
    }
    if (body.sizes !== undefined) {
      if (!Array.isArray(body.sizes) || body.sizes.length === 0 || body.sizes.length > MAX_SIZES) {
        res.status(400).json({ ok: false, error: 'Dish needs 1-10 sizes' }); return;
      }
      for (const s of body.sizes) {
        if (!s || typeof s.label !== 'string' || s.label.length > MAX_LABEL) { res.status(400).json({ ok: false, error: 'Invalid size label' }); return; }
        if (!Number.isFinite(Number(s.price)) || Number(s.price) < 0 || Number(s.price) > 10000000) { res.status(400).json({ ok: false, error: 'Invalid size price' }); return; }
      }
    }
    if (body.categoryId !== undefined) {
      const catCheck = await client.query('SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2', [body.categoryId, restaurantId]);
      if (catCheck.rows.length === 0) { res.status(400).json({ ok: false, error: 'Unknown categoryId' }); return; }
    }

    try {
      const sets = [];
      const values = [];
      for (const [key, column] of Object.entries(FIELD_COLUMN)) {
        if (body[key] === undefined) continue;
        values.push(key === 'name' ? body[key].trim() : body[key]);
        sets.push(`${column} = $${values.length}`);
      }
      if (sets.length) {
        values.push(dishId);
        await client.query(`UPDATE dishes SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
      }

      if (body.sizes !== undefined) {
        await client.query('DELETE FROM dish_sizes WHERE dish_id = $1', [dishId]);
        for (let i = 0; i < body.sizes.length; i++) {
          const s = body.sizes[i];
          await client.query('INSERT INTO dish_sizes (dish_id, label, price, sort_order) VALUES ($1,$2,$3,$4)',
            [dishId, s.label, Math.round(Number(s.price)), i]);
        }
      }
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[admin/dishes PUT]', e);
      res.status(500).json({ ok: false, error: 'Failed to update dish' });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
