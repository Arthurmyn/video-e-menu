-- Nauryz e-menu schema.
-- Scoped with restaurant_id everywhere on purpose: today there's exactly one
-- row in `restaurants`, but every other table already carries the FK so a
-- second venue is a new row + a WHERE clause, not a schema rewrite.

CREATE TABLE IF NOT EXISTS restaurants (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  phone_tel     TEXT,
  address       TEXT,
  hours_ru      TEXT,
  hours_en      TEXT,
  payment_enabled      BOOLEAN NOT NULL DEFAULT false, -- require Kaspi payment before an order reaches the kitchen
  kaspi_qr_url         TEXT,                           -- Blob-hosted QR image, shown to guests when payment_enabled
  kaspi_display_name   TEXT,                           -- fallback text (phone/name) if the QR won't scan
  payment_auto_confirm BOOLEAN NOT NULL DEFAULT false, -- confirm payment automatically via a phone notification-forwarder instead of manual Telegram verification
  kaspi_webhook_token  TEXT,                           -- secret in the notify-webhook URL that identifies this restaurant
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name_ru       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  icon_key      TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (restaurant_id, name_ru)
);

CREATE TABLE IF NOT EXISTS dishes (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  img_url       TEXT,
  video_url     TEXT,  -- optional short looping clip (cinemagraph); img_url is always the poster/fallback
  rating        NUMERIC(2,1),
  cal           INTEGER,
  time_min      INTEGER,
  popular       BOOLEAN NOT NULL DEFAULT false,
  offer_pct     INTEGER NOT NULL DEFAULT 0,   -- 0 = no discount badge
  available     BOOLEAN NOT NULL DEFAULT true,
  is_spicy      BOOLEAN NOT NULL DEFAULT false,
  is_vegetarian BOOLEAN NOT NULL DEFAULT false,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dish_sizes (
  id            SERIAL PRIMARY KEY,
  dish_id       INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  label         TEXT NOT NULL DEFAULT '',
  price         INTEGER NOT NULL,             -- tenge, whole units
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- Every submitted order gets a row, even outside the payment flow — that's
-- what makes amount-matching possible for payment_auto_confirm, and it's a
-- free order log as a side effect.
CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_label   TEXT,
  items_json    JSONB NOT NULL,
  total         INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'sent', -- sent | awaiting_payment | confirmed | expired
  telegram_message_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant ON dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_dish_sizes_dish ON dish_sizes(dish_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status, created_at);
