// GET  /api/admin/dishes  — list every dish (available or not) for the admin table
// POST /api/admin/dishes  — create a new dish with its sizes
// Both require the admin session cookie (see ../../_auth.js).

const { getPool, getRestaurantId } = require('../../_db');
const { requireAuth } = require('../../_auth');

const MAX_NAME = 200;
const MAX_SIZES = 10;
const MAX_LABEL = 40;

function validateDishInput(body) {
  if (!body || typeof body !== 'object') return 'Empty request body';
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > MAX_NAME) return 'Invalid name';
  if (!Number.isInteger(body.categoryId)) return 'Invalid categoryId';
  if (!Array.isArray(body.sizes) || body.sizes.length === 0 || body.sizes.length > MAX_SIZES) return 'Dish needs 1-10 sizes';
  for (const s of body.sizes) {
    if (!s || typeof s.label !== 'string' || s.label.length > MAX_LABEL) return 'Invalid size label';
    if (!Number.isFinite(Number(s.price)) || Number(s.price) < 0 || Number(s.price) > 10000000) return 'Invalid size price';
  }
  return null;
}

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const client = getPool();

  if (req.method === 'GET') {
    try {
      const restaurantId = await getRestaurantId(client);
      const rows = await client.query(
        `SELECT d.id, d.category_id, c.name_ru AS category_ru, d.name, d.img_url, d.video_url, d.rating, d.cal, d.time_min,
                d.popular, d.offer_pct, d.available, d.sort_order,
                s.id AS size_id, s.label AS size_label, s.price AS size_price, s.sort_order AS size_sort
         FROM dishes d
         JOIN categories c ON c.id = d.category_id
         LEFT JOIN dish_sizes s ON s.dish_id = d.id
         WHERE d.restaurant_id = $1
         ORDER BY d.sort_order, s.sort_order`,
        [restaurantId]
      );
      const byId = new Map();
      for (const r of rows.rows) {
        if (!byId.has(r.id)) {
          byId.set(r.id, {
            id: r.id, categoryId: r.category_id, categoryRu: r.category_ru, name: r.name,
            imgUrl: r.img_url, videoUrl: r.video_url, rating: r.rating !== null ? Number(r.rating) : null, cal: r.cal, time: r.time_min,
            popular: r.popular, offerPct: r.offer_pct, available: r.available, sortOrder: r.sort_order, sizes: []
          });
        }
        if (r.size_id !== null) byId.get(r.id).sizes.push({ id: r.size_id, label: r.size_label, price: r.size_price });
      }
      res.status(200).json({ ok: true, dishes: Array.from(byId.values()) });
    } catch (e) {
      console.error('[admin/dishes GET]', e);
      res.status(500).json({ ok: false, error: 'Failed to load dishes' });
    }
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    const err = validateDishInput(body);
    if (err) { res.status(400).json({ ok: false, error: err }); return; }

    try {
      const restaurantId = await getRestaurantId(client);
      const catCheck = await client.query('SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2', [body.categoryId, restaurantId]);
      if (catCheck.rows.length === 0) { res.status(400).json({ ok: false, error: 'Unknown categoryId' }); return; }

      const dishRes = await client.query(
        `INSERT INTO dishes (restaurant_id, category_id, name, img_url, video_url, rating, cal, time_min, popular, offer_pct, available, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
           (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM dishes WHERE restaurant_id = $1))
         RETURNING id`,
        [restaurantId, body.categoryId, body.name.trim(), body.imgUrl || null, body.videoUrl || null,
         body.rating != null ? body.rating : null, body.cal != null ? body.cal : null, body.time != null ? body.time : null,
         !!body.popular, Number.isInteger(body.offerPct) ? body.offerPct : 0, body.available !== false]
      );
      const dishId = dishRes.rows[0].id;
      for (let i = 0; i < body.sizes.length; i++) {
        const s = body.sizes[i];
        await client.query('INSERT INTO dish_sizes (dish_id, label, price, sort_order) VALUES ($1,$2,$3,$4)',
          [dishId, s.label, Math.round(Number(s.price)), i]);
      }
      res.status(201).json({ ok: true, id: dishId });
    } catch (e) {
      console.error('[admin/dishes POST]', e);
      res.status(500).json({ ok: false, error: 'Failed to create dish' });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
