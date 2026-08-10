/**
 * Database schema, expressed as idempotent DDL.
 *
 * Kept as a TypeScript string rather than a .sql file so it travels with the
 * traced `output: "standalone"` bundle without extra file-tracing config.
 *
 * Translatable columns are `jsonb` objects keyed by locale ({pt,en,es,fr}),
 * mirroring the `Record<Locale, T>` shape the components already consume.
 */
export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS settings (
  id              smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name            text        NOT NULL,
  total_rooms     integer     NOT NULL DEFAULT 0,
  brand_tagline   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  street          text        NOT NULL DEFAULT '',
  postal_code     text        NOT NULL DEFAULT '',
  city            text        NOT NULL DEFAULT '',
  country         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  phones          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  email           text        NOT NULL DEFAULT '',
  social          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  coords          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  rating          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  legal           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  payment_methods jsonb       NOT NULL DEFAULT '[]'::jsonb,
  languages       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id                text        PRIMARY KEY,
  slug              text        NOT NULL UNIQUE,
  image             text        NOT NULL DEFAULT '',
  gallery           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  capacity          integer     NOT NULL DEFAULT 2,
  size              integer     NOT NULL DEFAULT 0,
  bed               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  bathroom          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  price_from        numeric(10,2) NOT NULL DEFAULT 0,
  name              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  short_description jsonb       NOT NULL DEFAULT '{}'::jsonb,
  long_description  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  amenities         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  romantic          boolean     NOT NULL DEFAULT false,
  panorama360       text,
  position          integer     NOT NULL DEFAULT 0,
  published         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooms_published_position_idx ON rooms (published, position);

CREATE TABLE IF NOT EXISTS services (
  id          text        PRIMARY KEY,
  icon        text        NOT NULL DEFAULT 'sparkle',
  title       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  description jsonb       NOT NULL DEFAULT '{}'::jsonb,
  position    integer     NOT NULL DEFAULT 0,
  published   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS services_published_position_idx ON services (published, position);

CREATE TABLE IF NOT EXISTS offers (
  id          text        PRIMARY KEY,
  slug        text        NOT NULL UNIQUE,
  image       text        NOT NULL DEFAULT '',
  badge       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  title       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  description jsonb       NOT NULL DEFAULT '{}'::jsonb,
  price_from  numeric(10,2) NOT NULL DEFAULT 0,
  price_label jsonb       NOT NULL DEFAULT '{}'::jsonb,
  includes    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  conditions  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  position    integer     NOT NULL DEFAULT 0,
  published   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offers_published_position_idx ON offers (published, position);

CREATE TABLE IF NOT EXISTS testimonials (
  id         text        PRIMARY KEY,
  author     text        NOT NULL DEFAULT '',
  origin     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  quote      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  rating     integer     NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  position   integer     NOT NULL DEFAULT 0,
  published  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS testimonials_published_position_idx ON testimonials (published, position);

CREATE TABLE IF NOT EXISTS posts (
  slug            text        PRIMARY KEY,
  image           text        NOT NULL DEFAULT '',
  date            date        NOT NULL DEFAULT CURRENT_DATE,
  reading_minutes integer     NOT NULL DEFAULT 3,
  category        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  title           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  excerpt         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  body            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  published       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_published_date_idx ON posts (published, date DESC);

CREATE TABLE IF NOT EXISTS gallery_images (
  id         serial      PRIMARY KEY,
  src        text        NOT NULL,
  alt        text        NOT NULL DEFAULT '',
  position   integer     NOT NULL DEFAULT 0,
  published  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gallery_published_position_idx ON gallery_images (published, position);

CREATE TABLE IF NOT EXISTS extras (
  id          text        PRIMARY KEY,
  label       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  description jsonb       NOT NULL DEFAULT '{}'::jsonb,
  price       numeric(10,2) NOT NULL DEFAULT 0,
  per_night   boolean     NOT NULL DEFAULT false,
  position    integer     NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  code       text        PRIMARY KEY,
  percent    numeric(5,4) NOT NULL DEFAULT 0 CHECK (percent > 0 AND percent < 1),
  active     boolean     NOT NULL DEFAULT true,
  expires_at date,
  uses       integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text        NOT NULL UNIQUE,
  first_name     text        NOT NULL DEFAULT '',
  last_name      text        NOT NULL DEFAULT '',
  email          text        NOT NULL DEFAULT '',
  phone          text        NOT NULL DEFAULT '',
  country        text        NOT NULL DEFAULT '',
  notes          text        NOT NULL DEFAULT '',
  room_id        text        REFERENCES rooms(id) ON DELETE SET NULL,
  offer_id       text,
  check_in       date        NOT NULL,
  check_out      date        NOT NULL,
  nights         integer     NOT NULL DEFAULT 0,
  adults         integer     NOT NULL DEFAULT 1,
  children       integer     NOT NULL DEFAULT 0,
  extras         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  promo_code     text,
  base           numeric(10,2) NOT NULL DEFAULT 0,
  extras_total   numeric(10,2) NOT NULL DEFAULT 0,
  discount       numeric(10,2) NOT NULL DEFAULT 0,
  total          numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text        NOT NULL DEFAULT 'hotel',
  status         text        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','confirmed','checked_in','cancelled')),
  locale         text        NOT NULL DEFAULT 'pt',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_check_in_idx ON bookings (check_in);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_created_idx ON bookings (created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL DEFAULT '',
  email      text        NOT NULL DEFAULT '',
  subject    text        NOT NULL DEFAULT '',
  message    text        NOT NULL DEFAULT '',
  locale     text        NOT NULL DEFAULT 'pt',
  read       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_created_idx ON messages (created_at DESC);

CREATE TABLE IF NOT EXISTS subscribers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL UNIQUE,
  locale     text        NOT NULL DEFAULT 'pt',
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     text        NOT NULL,
  path         text        NOT NULL UNIQUE,
  mime         text        NOT NULL DEFAULT '',
  size         integer     NOT NULL DEFAULT 0,
  width        integer,
  height       integer,
  alt          text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_created_idx ON media (created_at DESC);

-- ===========================================================================
-- Hotel operations
-- ===========================================================================

-- Physical accommodation units, as opposed to the sales categories in "rooms".
CREATE TABLE IF NOT EXISTS units (
  id         serial      PRIMARY KEY,
  code       text        NOT NULL UNIQUE,
  floor      integer     NOT NULL DEFAULT 0,
  room_id    text        REFERENCES rooms(id) ON DELETE SET NULL,
  status     text        NOT NULL DEFAULT 'available'
             CHECK (status IN ('available','occupied','cleaning','maintenance','blocked')),
  notes      text        NOT NULL DEFAULT '',
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS units_status_idx ON units (status);
CREATE INDEX IF NOT EXISTS units_floor_idx ON units (floor, code);

CREATE TABLE IF NOT EXISTS staff (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  role       text        NOT NULL DEFAULT '',
  department text        NOT NULL DEFAULT 'housekeeping'
             CHECK (department IN ('reception','housekeeping','maintenance','kitchen','management')),
  email      text        NOT NULL DEFAULT '',
  phone      text        NOT NULL DEFAULT '',
  shift      text        NOT NULL DEFAULT 'morning'
             CHECK (shift IN ('morning','afternoon','night','flexible')),
  active     boolean     NOT NULL DEFAULT true,
  hired_at   date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_department_idx ON staff (department, active);

-- Housekeeping, maintenance and inspection work, always tied to a unit.
CREATE TABLE IF NOT EXISTS tasks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      integer     REFERENCES units(id) ON DELETE CASCADE,
  kind         text        NOT NULL DEFAULT 'cleaning'
               CHECK (kind IN ('cleaning','maintenance','inspection')),
  title        text        NOT NULL,
  description  text        NOT NULL DEFAULT '',
  assignee_id  uuid        REFERENCES staff(id) ON DELETE SET NULL,
  priority     text        NOT NULL DEFAULT 'normal'
               CHECK (priority IN ('low','normal','high','urgent')),
  status       text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','in_progress','done')),
  due_date     date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status, due_date);
CREATE INDEX IF NOT EXISTS tasks_unit_idx ON tasks (unit_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  contact    text        NOT NULL DEFAULT '',
  email      text        NOT NULL DEFAULT '',
  phone      text        NOT NULL DEFAULT '',
  notes      text        NOT NULL DEFAULT '',
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  category     text        NOT NULL DEFAULT 'other'
               CHECK (category IN ('amenities','cleaning','linen','food','beverage','maintenance','office','other')),
  unit         text        NOT NULL DEFAULT 'un',
  quantity     numeric(12,2) NOT NULL DEFAULT 0,
  min_quantity numeric(12,2) NOT NULL DEFAULT 0,
  cost         numeric(10,2) NOT NULL DEFAULT 0,
  supplier_id  uuid        REFERENCES suppliers(id) ON DELETE SET NULL,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_category_idx ON inventory_items (category, active);

-- Append-only stock ledger; inventory_items.quantity is the running total.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid        NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  delta      numeric(12,2) NOT NULL,
  reason     text        NOT NULL DEFAULT 'adjustment'
             CHECK (reason IN ('purchase','consumption','loss','adjustment')),
  note       text        NOT NULL DEFAULT '',
  staff_id   uuid        REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS movements_item_idx ON inventory_movements (item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS meals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service     text        NOT NULL DEFAULT 'breakfast'
              CHECK (service IN ('breakfast','lunch','dinner','room_service','bar')),
  name        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  description jsonb       NOT NULL DEFAULT '{}'::jsonb,
  price       numeric(10,2) NOT NULL DEFAULT 0,
  allergens   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  vegetarian  boolean     NOT NULL DEFAULT false,
  available   boolean     NOT NULL DEFAULT true,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meals_service_idx ON meals (service, position);

-- Link a booking to the physical unit it was assigned.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS unit_id integer REFERENCES units(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS admin_users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL UNIQUE,
  name          text        NOT NULL DEFAULT '',
  password_hash text        NOT NULL,
  role          text        NOT NULL DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
`;
