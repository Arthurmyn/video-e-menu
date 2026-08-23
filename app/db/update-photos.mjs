// One-time update: assigns a per-dish photo (sourced from Unsplash, verified
// reachable) instead of the shared per-category placeholder used at seed time.
// Usage: node --env-file=.env.local db/update-photos.mjs path/to/all-photos.json

import pg from 'pg';
import { readFileSync } from 'fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node db/update-photos.mjs <photos.json>');
  process.exit(1);
}
const photos = JSON.parse(readFileSync(file, 'utf8'));

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const restRes = await client.query("SELECT id FROM restaurants WHERE slug = 'nauryz'");
  const restaurantId = restRes.rows[0].id;

  const dishRes = await client.query('SELECT id, name FROM dishes WHERE restaurant_id = $1', [restaurantId]);
  const idByName = new Map(dishRes.rows.map(r => [r.name, r.id]));

  let updated = 0;
  const unmatched = [];
  for (const p of photos) {
    const dishId = idByName.get(p.name);
    if (!dishId) { unmatched.push(p.name); continue; }
    await client.query('UPDATE dishes SET img_url = $1, updated_at = now() WHERE id = $2', [p.url, dishId]);
    updated++;
  }

  console.log(`Updated ${updated}/${photos.length} dishes.`);
  if (unmatched.length) console.log('No matching dish name for:', unmatched);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
