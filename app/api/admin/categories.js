// GET /api/admin/categories — id + names, for the dish-editor dropdown.
// (The public /api/menu also returns categories, but without ids — those are
// an internal admin concern, not something the storefront needs.)

const { getPool, getRestaurantId } = require('../_db');
const { requireAuth } = require('../_auth');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'GET') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  try {
    const client = getPool();
    const restaurantId = await getRestaurantId(client);
    const rows = await client.query(
      'SELECT id, name_ru, name_en FROM categories WHERE restaurant_id = $1 ORDER BY sort_order',
      [restaurantId]
    );
    res.status(200).json({ ok: true, categories: rows.rows.map(r => ({ id: r.id, nameRu: r.name_ru, nameEn: r.name_en })) });
  } catch (e) {
    console.error('[admin/categories]', e);
    res.status(500).json({ ok: false, error: 'Failed to load categories' });
  }
};
