// Shared Postgres pool — not a route (Vercel skips "_"-prefixed files).
// Module-level singleton so warm serverless invocations reuse the pool
// instead of opening a fresh connection per request.

const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool;
}

const RESTAURANT_SLUG = 'nauryz';

async function getRestaurantId(client) {
  const res = await client.query('SELECT id FROM restaurants WHERE slug = $1', [RESTAURANT_SLUG]);
  if (res.rows.length === 0) throw new Error('Restaurant not found');
  return res.rows[0].id;
}

module.exports = { getPool, getRestaurantId, RESTAURANT_SLUG };
