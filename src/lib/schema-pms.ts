/**
 * Second layer of the schema: the property-management system, payments,
 * invoicing, guest registration, access control and audit.
 *
 * Applied after SCHEMA_SQL on every boot. Everything is additive and
 * idempotent — `IF NOT EXISTS` for objects, and CHECK constraints are dropped
 * and re-created by name so widening an enum never needs a manual step on a
 * database that already holds data.
 */
export const SCHEMA_PMS_SQL = /* sql */ `
-- ===========================================================================
-- Access control
-- ===========================================================================

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS active          boolean     NOT NULL DEFAULT true;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS staff_id        uuid        REFERENCES staff(id) ON DELETE SET NULL;
-- Bumped on password change, role change or deactivation: every session
-- carries the version it was issued with, so old cookies stop working.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS session_version integer     NOT NULL DEFAULT 1;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS failed_logins   integer     NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_until    timestamptz;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();
UPDATE admin_users SET role = 'owner' WHERE role NOT IN ('owner','admin','reception','housekeeping','maintenance','accounting');
DO $$ BEGIN
  ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
  ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('owner','admin','reception','housekeeping','maintenance','accounting'));
END $$;

-- Who changed what. Append-only: nothing in the app updates or deletes rows.
CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial   PRIMARY KEY,
  actor_id    uuid,
  actor_email text        NOT NULL DEFAULT '',
  action      text        NOT NULL,
  entity      text        NOT NULL DEFAULT '',
  entity_id   text        NOT NULL DEFAULT '',
  summary     text        NOT NULL DEFAULT '',
  details     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ip          text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_entity_idx  ON audit_log (entity, entity_id);

-- ===========================================================================
-- Third-party services configured from the admin
-- ===========================================================================

-- One row per external service (payments, invoicing, e-mail, SIBA…).
-- Credentials are AES-256-GCM ciphertext; see lib/crypto.ts.
CREATE TABLE IF NOT EXISTS integrations (
  id            text        PRIMARY KEY,
  enabled       boolean     NOT NULL DEFAULT false,
  mode          text        NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  credentials   text        NOT NULL DEFAULT '',
  settings      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  last_test_at  timestamptz,
  last_test_ok  boolean,
  last_message  text        NOT NULL DEFAULT '',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Booking-engine rules the hotel edits itself: tourist tax, times, cut-offs.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS booking_rules jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Search-engine and monitoring identifiers beyond the analytics trio.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ===========================================================================
-- Rate plans and restrictions
-- ===========================================================================

CREATE TABLE IF NOT EXISTS rate_plans (
  id                   text          PRIMARY KEY,
  name                 jsonb         NOT NULL DEFAULT '{}'::jsonb,
  description          jsonb         NOT NULL DEFAULT '{}'::jsonb,
  board                text          NOT NULL DEFAULT 'room_only'
                       CHECK (board IN ('room_only','breakfast','half_board')),
  -- Price = room's nightly rate × (1 + adjust_pct/100) + adjust_amount,
  -- plus per_guest_amount per adult per night (breakfast, typically).
  adjust_pct           numeric(6,2)  NOT NULL DEFAULT 0,
  adjust_amount        numeric(10,2) NOT NULL DEFAULT 0,
  per_guest_amount     numeric(10,2) NOT NULL DEFAULT 0,
  refundable           boolean       NOT NULL DEFAULT true,
  free_cancel_days     integer       NOT NULL DEFAULT 2 CHECK (free_cancel_days >= 0),
  cancel_penalty       text          NOT NULL DEFAULT 'first_night'
                       CHECK (cancel_penalty IN ('none','first_night','percent','total')),
  cancel_penalty_pct   numeric(5,2)  NOT NULL DEFAULT 0,
  payment_policy       text          NOT NULL DEFAULT 'hotel'
                       CHECK (payment_policy IN ('hotel','deposit','full')),
  deposit_pct          numeric(5,2)  NOT NULL DEFAULT 0,
  min_stay             integer       NOT NULL DEFAULT 1 CHECK (min_stay >= 1),
  max_stay             integer       CHECK (max_stay IS NULL OR max_stay >= 1),
  min_advance_days     integer       NOT NULL DEFAULT 0 CHECK (min_advance_days >= 0),
  max_advance_days     integer       CHECK (max_advance_days IS NULL OR max_advance_days >= 0),
  -- Empty array = available for every room type.
  room_ids             jsonb         NOT NULL DEFAULT '[]'::jsonb,
  active               boolean       NOT NULL DEFAULT true,
  position             integer       NOT NULL DEFAULT 0,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE availability ADD COLUMN IF NOT EXISTS max_stay         integer;
ALTER TABLE availability ADD COLUMN IF NOT EXISTS closed_arrival   boolean NOT NULL DEFAULT false;
ALTER TABLE availability ADD COLUMN IF NOT EXISTS closed_departure boolean NOT NULL DEFAULT false;

-- ===========================================================================
-- Bookings as the PMS sees them
-- ===========================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rate_plan_id     text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS policy           jsonb         NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS nightly          jsonb         NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tourist_tax      numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source           text          NOT NULL DEFAULT 'site';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS channel_id       text          REFERENCES channels(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS external_ref     text          NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commission       numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_due_now   numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_total       numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status   text          NOT NULL DEFAULT 'unpaid';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_token      text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS eta              text          NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checkin_done_at  timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at    timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_out_at   timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at     timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancel_reason    text          NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancel_fee       numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by       text          NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS bookings_guest_token_idx ON bookings (guest_token) WHERE guest_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_stay_idx ON bookings (room_id, check_in, check_out) WHERE status NOT IN ('cancelled','no_show');
CREATE INDEX IF NOT EXISTS bookings_unit_stay_idx ON bookings (unit_id, check_in, check_out);

DO $$ BEGIN
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending','confirmed','checked_in','checked_out','cancelled','no_show'));
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_source_check;
  ALTER TABLE bookings ADD CONSTRAINT bookings_source_check
    CHECK (source IN ('site','desk','phone','email','walk_in','channel','extranet'));
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
  ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
    CHECK (payment_status IN ('unpaid','pending','partial','paid','refunded'));
END $$;

-- Everyone staying, as the guest registration (SIBA) needs them.
CREATE TABLE IF NOT EXISTS booking_guests (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  is_primary        boolean     NOT NULL DEFAULT false,
  first_name        text        NOT NULL DEFAULT '',
  last_name         text        NOT NULL DEFAULT '',
  nationality       text        NOT NULL DEFAULT '',
  birth_date        date,
  birth_place       text        NOT NULL DEFAULT '',
  document_type     text        NOT NULL DEFAULT '',
  document_number   text        NOT NULL DEFAULT '',
  document_country  text        NOT NULL DEFAULT '',
  residence_country text        NOT NULL DEFAULT '',
  residence_city    text        NOT NULL DEFAULT '',
  siba_status       text        NOT NULL DEFAULT 'pending'
                    CHECK (siba_status IN ('pending','not_required','sent','error')),
  siba_sent_at      timestamptz,
  siba_message      text        NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_guests_booking_idx ON booking_guests (booking_id);
CREATE INDEX IF NOT EXISTS booking_guests_siba_idx ON booking_guests (siba_status);

-- The room folio: everything charged during the stay.
CREATE TABLE IF NOT EXISTS booking_charges (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid          NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  category    text          NOT NULL DEFAULT 'other'
              CHECK (category IN ('room','extra','breakfast','laundry','parking','restaurant','bar','minibar','tourist_tax','damage','cancellation','other')),
  description text          NOT NULL DEFAULT '',
  quantity    numeric(10,2) NOT NULL DEFAULT 1,
  unit_price  numeric(10,2) NOT NULL DEFAULT 0,
  total       numeric(10,2) NOT NULL DEFAULT 0,
  vat_rate    numeric(5,2)  NOT NULL DEFAULT 6,
  voided      boolean       NOT NULL DEFAULT false,
  created_by  text          NOT NULL DEFAULT '',
  created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_charges_booking_idx ON booking_charges (booking_id);

-- Every attempt to take or return money, whatever the provider.
CREATE TABLE IF NOT EXISTS payments (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid          REFERENCES bookings(id) ON DELETE SET NULL,
  provider      text          NOT NULL CHECK (provider IN ('stripe','ifthenpay','manual')),
  method        text          NOT NULL DEFAULT 'card'
                CHECK (method IN ('card','mbway','multibanco','cash','transfer','other')),
  kind          text          NOT NULL DEFAULT 'payment' CHECK (kind IN ('payment','refund')),
  status        text          NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','succeeded','failed','cancelled','expired')),
  amount        numeric(10,2) NOT NULL DEFAULT 0,
  currency      text          NOT NULL DEFAULT 'EUR',
  provider_ref  text          NOT NULL DEFAULT '',
  checkout_url  text          NOT NULL DEFAULT '',
  mb_entity     text          NOT NULL DEFAULT '',
  mb_reference  text          NOT NULL DEFAULT '',
  expires_at    timestamptz,
  data          jsonb         NOT NULL DEFAULT '{}'::jsonb,
  note          text          NOT NULL DEFAULT '',
  created_by    text          NOT NULL DEFAULT '',
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments (booking_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_ref_idx ON payments (provider, provider_ref) WHERE provider_ref <> '';

-- Documents issued by the hotel's certified invoicing software.
CREATE TABLE IF NOT EXISTS invoices (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid          REFERENCES bookings(id) ON DELETE SET NULL,
  provider     text          NOT NULL,
  provider_id  text          NOT NULL DEFAULT '',
  number       text          NOT NULL DEFAULT '',
  status       text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','error','cancelled')),
  total        numeric(10,2) NOT NULL DEFAULT 0,
  customer     jsonb         NOT NULL DEFAULT '{}'::jsonb,
  pdf_url      text          NOT NULL DEFAULT '',
  message      text          NOT NULL DEFAULT '',
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_booking_idx ON invoices (booking_id);

-- Outgoing e-mail, so the desk can see what a guest was actually sent.
CREATE TABLE IF NOT EXISTS email_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid        REFERENCES bookings(id) ON DELETE SET NULL,
  template    text        NOT NULL,
  to_email    text        NOT NULL,
  subject     text        NOT NULL DEFAULT '',
  status      text        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  message     text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_log_created_idx ON email_log (created_at DESC);
CREATE INDEX IF NOT EXISTS email_log_booking_idx ON email_log (booking_id);

-- ===========================================================================
-- Maintenance: faults, repair orders, inspections
-- ===========================================================================

CREATE TABLE IF NOT EXISTS issues (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      integer     REFERENCES units(id) ON DELETE SET NULL,
  location     text        NOT NULL DEFAULT '',
  title        text        NOT NULL,
  description  text        NOT NULL DEFAULT '',
  severity     text        NOT NULL DEFAULT 'normal' CHECK (severity IN ('low','normal','high','urgent')),
  photo        text        NOT NULL DEFAULT '',
  status       text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  reported_by  text        NOT NULL DEFAULT '',
  blocks_unit  boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);
CREATE INDEX IF NOT EXISTS issues_status_idx ON issues (status, created_at DESC);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS issue_id    uuid          REFERENCES issues(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS booking_id  uuid          REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS supplier_id uuid          REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cost        numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes       text          NOT NULL DEFAULT '';
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS checklists (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  items      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      integer     REFERENCES units(id) ON DELETE CASCADE,
  checklist_id uuid        REFERENCES checklists(id) ON DELETE SET NULL,
  inspector    text        NOT NULL DEFAULT '',
  results      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  passed       integer     NOT NULL DEFAULT 0,
  failed       integer     NOT NULL DEFAULT 0,
  notes        text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inspections_created_idx ON inspections (created_at DESC);

-- ===========================================================================
-- Site: points of interest for the map
-- ===========================================================================

CREATE TABLE IF NOT EXISTS pois (
  id           uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text             NOT NULL DEFAULT 'sight'
               CHECK (category IN ('sight','museum','food','shopping','transport','nature','nightlife','other')),
  name         jsonb            NOT NULL DEFAULT '{}'::jsonb,
  description  jsonb            NOT NULL DEFAULT '{}'::jsonb,
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  walk_minutes integer,
  url          text             NOT NULL DEFAULT '',
  published    boolean          NOT NULL DEFAULT true,
  position     integer          NOT NULL DEFAULT 0,
  created_at   timestamptz      NOT NULL DEFAULT now(),
  updated_at   timestamptz      NOT NULL DEFAULT now()
);

-- ===========================================================================
-- Channels: manual extranets with allotments
-- ===========================================================================

DO $$ BEGIN
  ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_provider_check;
  ALTER TABLE channels ADD CONSTRAINT channels_provider_check
    CHECK (provider IN ('ical','beds24','booking','expedia','manual','extranet'));
END $$;

-- Background jobs: when each last ran and how it went.
CREATE TABLE IF NOT EXISTS job_runs (
  name        text        PRIMARY KEY,
  last_run_at timestamptz,
  last_ok     boolean,
  message     text        NOT NULL DEFAULT '',
  duration_ms integer     NOT NULL DEFAULT 0
);
`;
