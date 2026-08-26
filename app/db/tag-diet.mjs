// One-time population of is_vegetarian / is_spicy. Nauryz's 2GIS listing has
// no dietary metadata, so these are a conservative best-effort read of the
// dish *names* only — marked only where the name makes it unambiguous (e.g.
// a sauce, a drink, "Лазджан острый" literally saying "spicy"). Anything
// uncertain (e.g. whether "Цезарь" comes with chicken by default) is left
// unmarked rather than guessed. Correct via the admin panel as needed.
//
// Usage: node --env-file=.env.local db/tag-diet.mjs

import pg from 'pg';

const VEGETARIAN = [
  'Сметана', 'Чесночный соус', 'Майонез', 'Кетчуп', 'Лазджан острый',
  'Рис / пюре', 'Лепёшка', 'Баурсаки',
  'Пахлава', 'Пончик',
  'Варёное яйцо', 'Яичница из двух яиц', 'Омлет с грибами',
  'Рисовая каша', 'Овсяная каша', 'Манная каша',
  '«Ачичук»', 'Хрустящий баклажан', 'Рукола со свеклой',
  'Маргарита',
  'Картошка фри', 'Картофель дольками',
  // All coffee / milkshakes / lemonade / tea — no meat in any of them.
  'Эспрессо', 'Двойной эспрессо', 'Флэт уайт', 'Американо', 'Капучино', 'Латте',
  'Кофе по-вьетнамски', 'Моккачино', 'Горячий шоколад', 'Айс латте', 'Айс капучино', 'Айс американо',
  'Клубничный молочный коктейль', 'Ванильный молочный коктейль', 'Шоколадный молочный коктейль', 'Банановый молочный коктейль',
  'Мохито', 'Цитрусовый', 'Клубничный', 'Мохито-клубника', 'Малиновый', 'Манго-маракуйя', 'Киви-яблоко',
  'Чёрный чай', 'Зелёный чай', 'Чай по-казахски', 'Ташкентский чай', 'Марокканский чай',
  'Чай клубника с мятой', 'Чай апельсин с мятой', 'Малиновый чай'
];

const SPICY = ['Лазджан острый'];

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let vegCount = 0;
  for (const name of VEGETARIAN) {
    const r = await client.query('UPDATE dishes SET is_vegetarian = true WHERE name = $1', [name]);
    if (r.rowCount === 0) console.warn('No match for vegetarian name:', name);
    vegCount += r.rowCount;
  }
  let spicyCount = 0;
  for (const name of SPICY) {
    const r = await client.query('UPDATE dishes SET is_spicy = true WHERE name = $1', [name]);
    if (r.rowCount === 0) console.warn('No match for spicy name:', name);
    spicyCount += r.rowCount;
  }

  console.log(`Marked ${vegCount} dishes vegetarian, ${spicyCount} dishes spicy.`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
