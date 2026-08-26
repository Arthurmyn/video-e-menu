// One-time migration: loads the current static Nauryz menu (today living as a
// hardcoded array in app.js) into Postgres. After this runs and the frontend
// switches to /api/menu (Phase B), this file's dish list becomes historical —
// the database is the source of truth from here on, editable via the admin.
//
// Usage: node db/seed.mjs   (reads DATABASE_URL from the environment)

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CATS = [
  { ru: 'Первые блюда', en: 'Soups', icon: 'soups',
    img: 'https://images.unsplash.com/photo-1652088079703-38f4a8d6b981?w=800&q=80', cal: [220, 420], time: [12, 20] },
  { ru: 'Вторые блюда', en: 'Main Courses', icon: 'mains',
    img: 'https://images.unsplash.com/photo-1616645258469-ec681c17f3ee?w=800&q=80', cal: [380, 750], time: [15, 30] },
  { ru: 'Завтраки', en: 'Breakfast', icon: 'breakfast',
    img: 'https://images.unsplash.com/photo-1729223921099-7a8a72955baa?w=800&q=80', cal: [150, 450], time: [6, 15] },
  { ru: 'Пицца', en: 'Pizza', icon: 'pizza',
    img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80', cal: [600, 950], time: [15, 22] },
  { ru: 'Салаты', en: 'Salads', icon: 'salads',
    img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80', cal: [140, 360], time: [8, 15] },
  { ru: 'Горячие закуски', en: 'Hot Appetizers', icon: 'hot-snacks',
    img: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80', cal: [280, 550], time: [10, 18] },
  { ru: 'Каши', en: 'Porridge', icon: 'porridge',
    img: 'https://images.unsplash.com/photo-1702648982253-8b851013e81f?w=800&q=80', cal: [180, 300], time: [8, 14] },
  { ru: 'Десерты', en: 'Desserts', icon: 'desserts',
    img: 'https://images.unsplash.com/photo-1569174642127-108ca8e14f49?w=800&q=80', cal: [250, 420], time: [5, 10] },
  { ru: 'Кофе', en: 'Coffee', icon: 'coffee',
    img: 'https://images.unsplash.com/photo-1550071555-917d67a1188f?w=800&q=80', cal: [5, 120], time: [3, 6] },
  { ru: 'Молочные коктейли', en: 'Milkshakes', icon: 'milkshakes',
    img: 'https://images.unsplash.com/photo-1653085315536-1379bc836161?w=800&q=80', cal: [250, 350], time: [4, 6] },
  { ru: 'Лимонады', en: 'Lemonade', icon: 'lemonade',
    img: 'https://images.unsplash.com/photo-1647403354189-27023032a383?w=800&q=80', cal: [60, 150], time: [3, 5] },
  { ru: 'Чаи', en: 'Tea', icon: 'tea',
    img: 'https://images.unsplash.com/photo-1715798901309-1636b3f7fb83?w=800&q=80', cal: [0, 40], time: [4, 8] },
  { ru: 'Гарниры', en: 'Sides', icon: 'sides',
    img: 'https://images.unsplash.com/photo-1514843319620-4f042827c481?w=800&q=80', cal: [150, 320], time: [8, 15] },
  { ru: 'Соусы', en: 'Sauces', icon: 'sauces',
    img: 'https://images.unsplash.com/photo-1695088224651-162033438b3b?w=800&q=80', cal: [20, 70], time: [2, 4] },
  { ru: 'Посуда с собой', en: 'Takeaway Containers', icon: 'takeaway', img: null, cal: null, time: null }
];

const S1 = price => [{ label: '', price }];
const S2 = (l1, p1, l2, p2) => [{ label: l1, price: p1 }, { label: l2, price: p2 }];
const item = (id, name, cat, sizes) => ({ id, name, cat, sizes });

const DISHES = [
  item('shorpa-baranina', 'Шорпа баранина', 'Первые блюда', S1(2290)),
  item('domashniy-lagman', 'Домашний лагман', 'Первые блюда', S1(2290)),
  item('ramen-kuritsa', 'Рамен с курицей', 'Первые блюда', S1(2390)),
  item('ramen-govyadina', 'Рамен с говядиной', 'Первые блюда', S1(2490)),
  item('pelmeni-govyazhi', 'Пельмени говяжьи', 'Первые блюда', S1(2190)),
  item('domashnie-pelmeni-govyazhi', 'Домашние пельмени говяжьи', 'Первые блюда', S1(2290)),
  item('domashnyaya-lapsha-kuritsa', 'Домашняя лапша с курицей', 'Первые блюда', S1(1790)),
  item('shorpa-govyadina', 'Шорпа с говядиной', 'Первые блюда', S1(2390)),
  item('mampar', 'Мампар', 'Первые блюда', S1(2090)),
  item('krem-sup', 'Крем-суп', 'Первые блюда', S1(1590)),
  item('sup-frikadelki', 'Суп с фрикадельками', 'Первые блюда', S1(1790)),

  item('zharenyy-lagman', 'Жареный лагман', 'Вторые блюда', S1(2390)),
  item('fri-s-myasom', 'Фри с мясом', 'Вторые блюда', S1(2690)),
  item('befstroganov-govyadina', 'Бефстроганов из говядины с гарниром', 'Вторые блюда', S1(2790)),
  item('myaso-po-uygurski', 'Мясо по-уйгурски', 'Вторые блюда', S1(2890)),
  item('fettuccine-kuritsa-griby', 'Фетучини с курицей и грибами', 'Вторые блюда', S1(2790)),
  item('zharenye-pelmeni', 'Жареные пельмени', 'Вторые блюда', S1(2490)),
  item('plov', 'Плов', 'Вторые блюда', S1(2190)),
  item('plov-1kg', 'Плов 1 кг', 'Вторые блюда', S1(5490)),
  item('kazan-kebab', 'Казан кебаб', 'Вторые блюда', S1(3350)),
  item('manty', 'Манты', 'Вторые блюда', S1(2450)),
  item('zharenye-manty', 'Жареные манты', 'Вторые блюда', S1(2450)),
  item('guyru-lagman', 'Гуйру лагман', 'Вторые блюда', S1(2350)),
  item('befstroganov-kuritsa', 'Бефстроганов из курицы с гарниром', 'Вторые блюда', S1(2690)),
  item('guyru-ganfan', 'Гуйру ганфан', 'Вторые блюда', S1(2290)),
  item('kuyrdak-govyadina', 'Куырдак с говядиной', 'Вторые блюда', S1(3690)),
  item('pasta-bolognese', 'Паста болоньезе', 'Вторые блюда', S1(2490)),
  item('kuritsa-kislo-sladkiy', 'Курица в кисло-сладком соусе', 'Вторые блюда', S1(2290)),

  item('salat-achichuk', '«Ачичук»', 'Салаты', S1(1490)),
  item('salat-grecheskiy', '«Греческий»', 'Салаты', S1(2490)),
  item('baklazhan-hrustyashiy', 'Хрустящий баклажан', 'Салаты', S1(2490)),
  item('salat-tsezar', '«Цезарь»', 'Салаты', S1(2590)),
  item('salat-malibu', '«Малибу»', 'Салаты', S1(2390)),
  item('salat-svezhiy', '«Свежий»', 'Салаты', S1(1490)),
  item('rukola-svekla', 'Рукола со свеклой', 'Салаты', S1(2590)),
  item('salat-rafaello', '«Рафаэлло»', 'Салаты', S1(2390)),

  item('sous-smetana', 'Сметана', 'Соусы', S1(390)),
  item('sous-chesnochniy', 'Чесночный соус', 'Соусы', S1(390)),
  item('sous-mayonez', 'Майонез', 'Соусы', S1(390)),
  item('sous-ketchup', 'Кетчуп', 'Соусы', S1(390)),
  item('sous-lazjan', 'Лазджан острый', 'Соусы', S1(490)),

  item('naggetsy-fri', 'Наггетсы и фри', 'Горячие закуски', S1(1890)),
  item('mini-cheburek', 'Мини чебуреки', 'Горячие закуски', S1(1390)),
  item('kartoshka-fri', 'Картошка фри', 'Горячие закуски', S1(990)),
  item('kartofel-dolki', 'Картофель дольками', 'Горячие закуски', S1(990)),
  item('tandyr-samsa', 'Тандыр самса', 'Горячие закуски', S1(990)),

  item('kasha-risovaya', 'Рисовая каша', 'Каши', S1(990)),
  item('kasha-ovsyanaya', 'Овсяная каша', 'Каши', S1(990)),
  item('kasha-mannaya', 'Манная каша', 'Каши', S1(990)),

  item('varenoe-yaytso', 'Варёное яйцо', 'Завтраки', S1(290)),
  item('yaichnitsa', 'Яичница из двух яиц', 'Завтраки', S1(1490)),
  item('omlet-syr-kolbasa', 'Омлет с сыром и колбасой', 'Завтраки', S1(1990)),
  item('sardelki', 'Сардельки', 'Завтраки', S1(390)),
  item('kazaksha-tangy-as', 'Қазақша таңғы ас', 'Завтраки', S1(2490)),
  item('omlet-griby', 'Омлет с грибами', 'Завтраки', S1(1990)),
  item('zavtrak-tunets', 'Завтрак с тунцом', 'Завтраки', S1(1990)),
  item('amerikanskiy-zavtrak', 'Американский завтрак', 'Завтраки', S1(1990)),

  item('pizza-pepperoni', 'Пепперони', 'Пицца', S1(2690)),
  item('pizza-margarita', 'Маргарита', 'Пицца', S1(2490)),
  item('pizza-kuritsa-griby', 'С курицей и грибами', 'Пицца', S1(2590)),

  item('pahlava', 'Пахлава', 'Десерты', S1(1200)),
  item('ponchik', 'Пончик', 'Десерты', S1(790)),

  item('garnir-ris-pyure', 'Рис / пюре', 'Гарниры', S1(790)),
  item('lepeshka', 'Лепёшка', 'Гарниры', S1(350)),
  item('baursaki', 'Баурсаки', 'Гарниры', S1(850)),

  item('espresso', 'Эспрессо', 'Кофе', S1(490)),
  item('dvoynoy-espresso', 'Двойной эспрессо', 'Кофе', S1(590)),
  item('flat-white', 'Флэт уайт', 'Кофе', S1(890)),
  item('americano', 'Американо', 'Кофе', S2('0.3 л', 790, '0.4 л', 890)),
  item('cappuccino', 'Капучино', 'Кофе', S2('0.3 л', 890, '0.4 л', 990)),
  item('latte', 'Латте', 'Кофе', S2('0.3 л', 890, '0.4 л', 990)),
  item('vietnamese-coffee', 'Кофе по-вьетнамски', 'Кофе', S2('0.3 л', 990, '0.4 л', 1090)),
  item('mocaccino', 'Моккачино', 'Кофе', S2('0.3 л', 990, '0.4 л', 1090)),
  item('hot-chocolate', 'Горячий шоколад', 'Кофе', S2('0.3 л', 790, '0.4 л', 890)),
  item('ice-latte', 'Айс латте', 'Кофе', S1(1090)),
  item('ice-cappuccino', 'Айс капучино', 'Кофе', S1(1090)),
  item('ice-americano', 'Айс американо', 'Кофе', S1(1090)),

  item('shake-strawberry', 'Клубничный молочный коктейль', 'Молочные коктейли', S1(890)),
  item('shake-vanilla', 'Ванильный молочный коктейль', 'Молочные коктейли', S1(890)),
  item('shake-chocolate', 'Шоколадный молочный коктейль', 'Молочные коктейли', S1(890)),
  item('shake-banana', 'Банановый молочный коктейль', 'Молочные коктейли', S1(890)),

  item('lemonade-mojito', 'Мохито', 'Лимонады', S2('0.4 л', 890, '1 л', 1590)),
  item('lemonade-citrus', 'Цитрусовый', 'Лимонады', S2('0.4 л', 890, '1 л', 1590)),
  item('lemonade-strawberry', 'Клубничный', 'Лимонады', S2('0.4 л', 890, '1 л', 1590)),
  item('lemonade-mojito-strawberry', 'Мохито-клубника', 'Лимонады', S2('0.4 л', 890, '1 л', 1590)),
  item('lemonade-raspberry', 'Малиновый', 'Лимонады', S2('0.4 л', 890, '1 л', 1590)),
  item('lemonade-mango-maracuya', 'Манго-маракуйя', 'Лимонады', S2('0.4 л', 890, '1 л', 1590)),
  item('lemonade-kiwi-apple', 'Киви-яблоко', 'Лимонады', S2('0.4 л', 890, '1 л', 1590)),

  item('tea-black', 'Чёрный чай', 'Чаи', S2('0.4 л', 290, '1 л', 990)),
  item('tea-green', 'Зелёный чай', 'Чаи', S2('0.4 л', 290, '1 л', 990)),
  item('tea-kazakh', 'Чай по-казахски', 'Чаи', S2('0.4 л', 290, '1 л', 990)),
  item('tea-tashkent', 'Ташкентский чай', 'Чаи', S2('0.4 л', 790, '1 л', 1490)),
  item('tea-moroccan', 'Марокканский чай', 'Чаи', S2('0.4 л', 890, '1 л', 1590)),
  item('tea-strawberry-mint', 'Чай клубника с мятой', 'Чаи', S2('0.4 л', 790, '1 л', 1490)),
  item('tea-orange-mint', 'Чай апельсин с мятой', 'Чаи', S2('0.4 л', 790, '1 л', 1490)),
  item('tea-raspberry', 'Малиновый чай', 'Чаи', S2('0.4 л', 790, '1 л', 1490)),

  item('posuda-1kg', 'Посуда с собой, 1 кг', 'Посуда с собой', S1(350)),
  item('posuda-obychnaya', 'Посуда с собой, обычная', 'Посуда с собой', S1(150))
];

const UNAVAILABLE = new Set(['plov-1kg', 'tea-moroccan']);

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function seeded(id, salt) { return (hashStr(id + '|' + salt) % 10000) / 10000; }

function demoFields(d, cat) {
  if (!cat.cal) return { rating: null, cal: null, time: null, popular: false, offer: 0 };
  const rating = (4.3 + seeded(d.id, 'rating') * 0.6).toFixed(1);
  const cal = Math.round(cat.cal[0] + seeded(d.id, 'cal') * (cat.cal[1] - cat.cal[0]));
  const time = Math.round(cat.time[0] + seeded(d.id, 'time') * (cat.time[1] - cat.time[0]));
  const popular = seeded(d.id, 'popular') < 0.35;
  const isOffer = seeded(d.id, 'offer') < 0.25;
  const offer = isOffer ? [10, 15, 20, 25, 30][Math.floor(seeded(d.id, 'pct') * 5)] : 0;
  return { rating, cal, time, popular, offer };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Run with: node --env-file=.env.local db/seed.mjs');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema ready.');

    await client.query('BEGIN');

    const rest = await client.query(
      `INSERT INTO restaurants (slug, name, phone, phone_tel, address, hours_ru, hours_en)
       VALUES ('nauryz', 'Nauryz', '+7 771 288 64 34', '+77712886434',
               'просп. Улы Дала, 35, район Нура, Астана', 'Круглосуточно, без выходных.', 'Open 24/7.')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const restaurantId = rest.rows[0].id;

    const catIdByRu = {};
    for (let i = 0; i < CATS.length; i++) {
      const c = CATS[i];
      const res = await client.query(
        `INSERT INTO categories (restaurant_id, name_ru, name_en, icon_key, sort_order)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (restaurant_id, name_ru) DO UPDATE SET name_en = EXCLUDED.name_en, icon_key = EXCLUDED.icon_key
         RETURNING id`,
        [restaurantId, c.ru, c.en, c.icon, i]
      );
      catIdByRu[c.ru] = res.rows[0].id;
    }

    // Idempotent re-runs: clear previously seeded dishes for this restaurant first.
    await client.query('DELETE FROM dishes WHERE restaurant_id = $1', [restaurantId]);

    let sortOrder = 0;
    for (const d of DISHES) {
      const cat = CATS.find(c => c.ru === d.cat);
      const fields = demoFields(d, cat);
      const available = !UNAVAILABLE.has(d.id);
      const dishRes = await client.query(
        `INSERT INTO dishes (restaurant_id, category_id, name, img_url, rating, cal, time_min, popular, offer_pct, available, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [restaurantId, catIdByRu[d.cat], d.name, cat.img, fields.rating, fields.cal, fields.time, fields.popular, fields.offer, available, sortOrder++]
      );
      const dishId = dishRes.rows[0].id;
      for (let i = 0; i < d.sizes.length; i++) {
        const z = d.sizes[i];
        await client.query(
          `INSERT INTO dish_sizes (dish_id, label, price, sort_order) VALUES ($1,$2,$3,$4)`,
          [dishId, z.label, z.price, i]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Seeded ${DISHES.length} dishes across ${CATS.length} categories for restaurant "nauryz".`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
