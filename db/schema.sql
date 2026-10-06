-- Pattern Review App — idempotent schema migration.
--
-- Schema-relative by design: every object name here is UNQUALIFIED. It lands wherever the
-- connecting role's `search_path` points — a dedicated schema in a shared database (local dev,
-- see README) or `public` in a dedicated database (RDS in production). Do not add `public.` /
-- schema prefixes; that would defeat the point.
--
-- Safe to run repeatedly and against a database where the reference tables already exist:
-- everything is CREATE ... IF NOT EXISTS / guarded DO blocks. Run with `npm run db:migrate`.

-- ---------------------------------------------------------------------------
-- New: users (manual provisioning for v1). Created first because other tables reference it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patt_users (
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_email text NOT NULL UNIQUE,
  user_display_name text NOT NULL,
  user_password_hash text NOT NULL,
  user_role text NOT NULL CHECK (user_role = ANY (ARRAY['pattern_owner'::text, 'ea_reviewer'::text, 'arb_member'::text, 'viewer'::text])),
  user_is_active boolean NOT NULL DEFAULT true,
  user_created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patt_users_pkey PRIMARY KEY (user_id)
);

-- ---------------------------------------------------------------------------
-- New: roles as reference data, admin-editable (display name / description) via the app's
-- Roles screen. The set of role codes itself stays fixed at these 4 — every permission check
-- throughout the app (lib/permissions.ts) is written against these specific identifiers, so
-- role_code is intentionally not something the UI lets an admin add to or delete from; only
-- role_name/role_description are mutable. Seeded here, then patt_users.user_role's CHECK is
-- replaced with a FK to this table further down (after it's guaranteed to be populated).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patt_roles (
  role_code text NOT NULL,
  role_name text NOT NULL,
  role_description text,
  role_created_at timestamp with time zone NOT NULL DEFAULT now(),
  role_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patt_roles_pkey PRIMARY KEY (role_code)
);

INSERT INTO patt_roles (role_code, role_name, role_description) VALUES
  ('pattern_owner', 'Pattern owner', 'Owns one or more patterns and requests review for them.'),
  ('ea_reviewer', 'EA reviewer', 'Reviews patterns submitted for review and records decisions.'),
  ('arb_member', 'ARB member', 'Reviews patterns and records decisions; also manages users and roles.'),
  ('viewer', 'Viewer', 'Read-only access to approved patterns.')
ON CONFLICT (role_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Reference schema (no-ops when the tables already exist)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patt_patterns (
  patt_pattern_id uuid NOT NULL DEFAULT gen_random_uuid(),
  patt_name text NOT NULL,
  patt_category text NOT NULL CHECK (patt_category = ANY (ARRAY['data_integration'::text, 'data_ingestion'::text, 'web_application'::text, 'cloud_application'::text])),
  patt_owner text NOT NULL,
  patt_source_system text NOT NULL CHECK (patt_source_system = ANY (ARRAY['confluence'::text, 'sharepoint'::text])),
  patt_source_url text NOT NULL,
  patt_source_last_modified timestamp with time zone,
  patt_approval_status text NOT NULL DEFAULT 'draft'::text CHECK (patt_approval_status = ANY (ARRAY['draft'::text, 'review_requested'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'changes_requested'::text])),
  patt_last_synced_at timestamp with time zone,
  patt_created_at timestamp with time zone NOT NULL DEFAULT now(),
  patt_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patt_patterns_pkey PRIMARY KEY (patt_pattern_id)
);

CREATE TABLE IF NOT EXISTS patt_attribute_types (
  attr_attribute_type_id uuid NOT NULL DEFAULT gen_random_uuid(),
  attr_code text NOT NULL UNIQUE,
  attr_name text NOT NULL,
  attr_description text,
  attr_display_order integer NOT NULL DEFAULT 0,
  attr_is_required boolean NOT NULL DEFAULT false,
  attr_created_at timestamp with time zone NOT NULL DEFAULT now(),
  attr_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patt_attribute_types_pkey PRIMARY KEY (attr_attribute_type_id)
);

CREATE TABLE IF NOT EXISTS patt_attribute_values (
  attv_attribute_value_id uuid NOT NULL DEFAULT gen_random_uuid(),
  attv_pattern_id uuid NOT NULL,
  attv_attribute_type_id uuid NOT NULL,
  attv_value jsonb,
  attv_source_excerpt text,
  attv_extraction_method text NOT NULL DEFAULT 'missing'::text CHECK (attv_extraction_method = ANY (ARRAY['direct_field_match'::text, 'inferred_from_text'::text, 'missing'::text])),
  attv_extracted_at timestamp with time zone,
  attv_created_at timestamp with time zone NOT NULL DEFAULT now(),
  attv_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patt_attribute_values_pkey PRIMARY KEY (attv_attribute_value_id),
  CONSTRAINT patt_attribute_values_attv_pattern_id_fkey FOREIGN KEY (attv_pattern_id) REFERENCES patt_patterns(patt_pattern_id),
  CONSTRAINT patt_attribute_values_attv_attribute_type_id_fkey FOREIGN KEY (attv_attribute_type_id) REFERENCES patt_attribute_types(attr_attribute_type_id)
);

CREATE TABLE IF NOT EXISTS patt_review_requests (
  revi_review_request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  revi_pattern_id uuid NOT NULL,
  revi_requested_at timestamp with time zone NOT NULL DEFAULT now(),
  revi_requested_by uuid NOT NULL,
  revi_status text NOT NULL DEFAULT 'open'::text CHECK (revi_status = ANY (ARRAY['open'::text, 'closed'::text])),
  revi_created_at timestamp with time zone NOT NULL DEFAULT now(),
  revi_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patt_review_requests_pkey PRIMARY KEY (revi_review_request_id),
  CONSTRAINT patt_review_requests_revi_pattern_id_fkey FOREIGN KEY (revi_pattern_id) REFERENCES patt_patterns(patt_pattern_id),
  CONSTRAINT patt_review_requests_revi_requested_by_fkey FOREIGN KEY (revi_requested_by) REFERENCES patt_users(user_id)
);

CREATE TABLE IF NOT EXISTS patt_approval_decisions (
  appr_approval_decision_id uuid NOT NULL DEFAULT gen_random_uuid(),
  appr_review_request_id uuid NOT NULL,
  appr_decided_by uuid NOT NULL,
  appr_decision text NOT NULL CHECK (appr_decision = ANY (ARRAY['approved'::text, 'rejected'::text, 'changes_requested'::text])),
  appr_comments text,
  appr_decided_at timestamp with time zone NOT NULL DEFAULT now(),
  appr_created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patt_approval_decisions_pkey PRIMARY KEY (appr_approval_decision_id),
  CONSTRAINT patt_approval_decisions_appr_review_request_id_fkey FOREIGN KEY (appr_review_request_id) REFERENCES patt_review_requests(revi_review_request_id),
  CONSTRAINT patt_approval_decisions_appr_decided_by_fkey FOREIGN KEY (appr_decided_by) REFERENCES patt_users(user_id)
);

CREATE TABLE IF NOT EXISTS patt_sync_checkpoints (
  sync_sync_checkpoint_id uuid NOT NULL DEFAULT gen_random_uuid(),
  sync_source_system text NOT NULL CHECK (sync_source_system = ANY (ARRAY['confluence'::text, 'sharepoint'::text])),
  sync_source_scope text NOT NULL,
  sync_last_checkpoint text,
  sync_created_at timestamp with time zone NOT NULL DEFAULT now(),
  sync_updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patt_sync_checkpoints_pkey PRIMARY KEY (sync_sync_checkpoint_id)
);

-- ---------------------------------------------------------------------------
-- Live-DB fix-ups: convert text user references to uuid + add FKs to patt_users.
-- Fails loudly (by design) if existing values are not valid uuids of existing users.
-- `table_schema = current_schema()` matches whichever schema `search_path` resolved these
-- unqualified CREATE TABLEs into above.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'patt_review_requests'
      AND column_name = 'revi_requested_by' AND data_type = 'text'
  ) THEN
    ALTER TABLE patt_review_requests
      ALTER COLUMN revi_requested_by TYPE uuid USING revi_requested_by::uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patt_review_requests_revi_requested_by_fkey'
      AND conrelid = 'patt_review_requests'::regclass
  ) THEN
    ALTER TABLE patt_review_requests
      ADD CONSTRAINT patt_review_requests_revi_requested_by_fkey
      FOREIGN KEY (revi_requested_by) REFERENCES patt_users(user_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'patt_approval_decisions'
      AND column_name = 'appr_decided_by' AND data_type = 'text'
  ) THEN
    ALTER TABLE patt_approval_decisions
      ALTER COLUMN appr_decided_by TYPE uuid USING appr_decided_by::uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patt_approval_decisions_appr_decided_by_fkey'
      AND conrelid = 'patt_approval_decisions'::regclass
  ) THEN
    ALTER TABLE patt_approval_decisions
      ADD CONSTRAINT patt_approval_decisions_appr_decided_by_fkey
      FOREIGN KEY (appr_decided_by) REFERENCES patt_users(user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Widen patt_source_system to allow 'github' (Markdown content pulled from GitHub, alongside
-- Confluence and SharePoint). patt_patterns is shared with the Sync Scheduler and Catalog MCP
-- Server, so finds the existing CHECK constraint by inspecting its definition rather than
-- assuming a name, and only touches it if 'github' isn't already permitted.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  existing_name text;
BEGIN
  SELECT conname INTO existing_name
    FROM pg_constraint
   WHERE conrelid = 'patt_patterns'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%patt_source_system%';

  IF existing_name IS NOT NULL AND pg_get_constraintdef(
       (SELECT oid FROM pg_constraint WHERE conname = existing_name AND conrelid = 'patt_patterns'::regclass)
     ) NOT LIKE '%github%' THEN
    EXECUTE format('ALTER TABLE patt_patterns DROP CONSTRAINT %I', existing_name);
    ALTER TABLE patt_patterns
      ADD CONSTRAINT patt_patterns_patt_source_system_check
      CHECK (patt_source_system = ANY (ARRAY['confluence'::text, 'sharepoint'::text, 'github'::text]));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Replace patt_users.user_role's CHECK with a FK to patt_roles, now that patt_roles is
-- guaranteed to be seeded with all 4 codes (above). Finds the existing CHECK constraint by
-- definition rather than assuming its name, same approach as the patt_source_system widening.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  existing_name text;
BEGIN
  SELECT conname INTO existing_name
    FROM pg_constraint
   WHERE conrelid = 'patt_users'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%user_role%';

  IF existing_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE patt_users DROP CONSTRAINT %I', existing_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patt_users_user_role_fkey' AND conrelid = 'patt_users'::regclass
  ) THEN
    ALTER TABLE patt_users
      ADD CONSTRAINT patt_users_user_role_fkey FOREIGN KEY (user_role) REFERENCES patt_roles(role_code);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Integrity guards for the review workflow
-- ---------------------------------------------------------------------------
-- At most one open review request per pattern.
CREATE UNIQUE INDEX IF NOT EXISTS patt_review_requests_one_open_per_pattern
  ON patt_review_requests (revi_pattern_id) WHERE revi_status = 'open';

-- Exactly one decision closes a review request.
CREATE UNIQUE INDEX IF NOT EXISTS patt_approval_decisions_one_per_request
  ON patt_approval_decisions (appr_review_request_id);

CREATE INDEX IF NOT EXISTS patt_patterns_status_idx ON patt_patterns (patt_approval_status);
CREATE INDEX IF NOT EXISTS patt_review_requests_pattern_idx ON patt_review_requests (revi_pattern_id);
CREATE INDEX IF NOT EXISTS patt_attribute_values_pattern_idx ON patt_attribute_values (attv_pattern_id);

-- ---------------------------------------------------------------------------
-- New: append-only audit log. The existing tables record who requested / who decided,
-- but nothing records who picked a request up (review_requested -> under_review) or who
-- performed user-management changes. Written in the same transaction as each change.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patt_audit_log (
  audi_audit_log_id uuid NOT NULL DEFAULT gen_random_uuid(),
  audi_occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  audi_actor_id uuid NOT NULL,
  audi_action text NOT NULL,
  audi_entity_type text NOT NULL CHECK (audi_entity_type = ANY (ARRAY['pattern'::text, 'user'::text, 'role'::text])),
  -- text, not uuid: a role's key (role_code, e.g. 'arb_member') isn't a UUID like pattern/user
  -- ids are. uuid values still fit here as their string form, so this is a widening, not a
  -- breaking change, for the existing pattern/user audit rows.
  audi_entity_id text NOT NULL,
  audi_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT patt_audit_log_pkey PRIMARY KEY (audi_audit_log_id),
  CONSTRAINT patt_audit_log_audi_actor_id_fkey FOREIGN KEY (audi_actor_id) REFERENCES patt_users(user_id)
);

-- Fix-ups for an already-existing patt_audit_log: widen audi_entity_type's CHECK to include
-- 'role', and audi_entity_id from uuid to text (role_code isn't a UUID) — same pattern as the
-- patt_source_system widening above.
DO $$
DECLARE
  existing_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'patt_audit_log'
      AND column_name = 'audi_entity_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE patt_audit_log ALTER COLUMN audi_entity_id TYPE text USING audi_entity_id::text;
  END IF;

  SELECT conname INTO existing_name
    FROM pg_constraint
   WHERE conrelid = 'patt_audit_log'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%audi_entity_type%';

  IF existing_name IS NOT NULL AND pg_get_constraintdef(
       (SELECT oid FROM pg_constraint WHERE conname = existing_name AND conrelid = 'patt_audit_log'::regclass)
     ) NOT LIKE '%role%' THEN
    EXECUTE format('ALTER TABLE patt_audit_log DROP CONSTRAINT %I', existing_name);
    ALTER TABLE patt_audit_log
      ADD CONSTRAINT patt_audit_log_audi_entity_type_check
      CHECK (audi_entity_type = ANY (ARRAY['pattern'::text, 'user'::text, 'role'::text]));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS patt_audit_log_entity_idx
  ON patt_audit_log (audi_entity_type, audi_entity_id, audi_occurred_at);

CREATE OR REPLACE FUNCTION patt_audit_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'patt_audit_log is append-only (% not permitted)', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS patt_audit_log_no_update_delete ON patt_audit_log;
CREATE TRIGGER patt_audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON patt_audit_log
  FOR EACH ROW EXECUTE FUNCTION patt_audit_log_append_only();

DROP TRIGGER IF EXISTS patt_audit_log_no_truncate ON patt_audit_log;
CREATE TRIGGER patt_audit_log_no_truncate
  BEFORE TRUNCATE ON patt_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION patt_audit_log_append_only();

-- ---------------------------------------------------------------------------
-- Supabase only: tables in `public` are exposed through the PostgREST API to the
-- `anon` / `authenticated` roles. Turn on RLS (with no policies = deny) for the two
-- tables this app owns so password hashes and the audit trail are never reachable that
-- way. No-op outside Supabase (no `anon` role) and irrelevant when deployed to a private
-- non-`public` schema, since PostgREST only exposes `public` by default.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    ALTER TABLE patt_users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE patt_audit_log ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
