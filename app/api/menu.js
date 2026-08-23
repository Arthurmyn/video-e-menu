// GET /api/menu — public read endpoint the storefront loads on startup.
// Single-tenant for now (slug hardcoded to 'nauryz'), but every query is
// already scoped by restaurant_id so a second venue is a new slug + row,
// not a rewrite of this handler.

const { getPool, RESTAURANT_SLUG } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!process.env.DATABASE_URL) {
    res.status(500).json({ ok: false, error: 'Server is not configured yet' });
    return;
  }

  try {
    const client = getPool();

    const restRes = await client.query(
      `SELECT id, name, phone, phone_tel, address, hours_ru, hours_en FROM restaurants WHERE slug = $1`,
      [RESTAURANT_SLUG]
    );
    if (restRes.rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Restaurant not found' });
      return;
    }
    const restaurant = restRes.rows[0];

    const catRes = await client.query(
      `SELECT id, name_ru, name_en, icon_key, sort_order FROM categories WHERE restaurant_id = $1 ORDER BY sort_order`,
      [restaurant.id]
    );

    const dishRes = await client.query(
      `SELECT d.id, d.category_id, d.name, d.img_url, d.video_url, d.rating, d.cal, d.time_min, d.popular, d.offer_pct, d.available, d.sort_order,
              c.name_ru AS category_ru,
              s.label AS size_label, s.price AS size_price, s.sort_order AS size_sort
       FROM dishes d
       JOIN categories c ON c.id = d.category_id
       LEFT JOIN dish_sizes s ON s.dish_id = d.id
       WHERE d.restaurant_id = $1
       ORDER BY d.sort_order, s.sort_order`,
      [restaurant.id]
    );

    const dishesById = new Map();
    for (const row of dishRes.rows) {
      if (!dishesById.has(row.id)) {
        dishesById.set(row.id, {
          id: String(row.id),
          name: row.name,
          cat: row.category_ru,
          img: row.img_url || undefined,
          video: row.video_url || undefined,
          rating: row.rating !== null ? Number(row.rating) : undefined,
          cal: row.cal !== null ? row.cal : undefined,
          time: row.time_min !== null ? row.time_min : undefined,
          popular: row.popular,
          offer: row.offer_pct > 0,
          offerPct: row.offer_pct,
          available: row.available,
          sizes: []
        });
      }
      if (row.size_label !== null) {
        dishesById.get(row.id).sizes.push({ label: row.size_label, price: row.size_price });
      }
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    res.status(200).json({
      ok: true,
      restaurant: {
        name: restaurant.name,
        phone: restaurant.phone,
        phoneTel: restaurant.phone_tel,
        address: restaurant.address,
        hoursRu: restaurant.hours_ru,
        hoursEn: restaurant.hours_en
      },
      categories: catRes.rows.map(c => ({ nameRu: c.name_ru, nameEn: c.name_en, iconKey: c.icon_key })),
      dishes: Array.from(dishesById.values())
    });
  } catch (e) {
    console.error('[menu] DB error:', e);
    res.status(500).json({ ok: false, error: 'Failed to load the menu' });
  }
};
