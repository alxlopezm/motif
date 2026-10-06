# Pattern Review App

Human-governance surface for enterprise architecture patterns: EA reviewers and ARB members review,
adjudicate and publish patterns that the sync process has federated in from Confluence / SharePoint.
*AI assists. Humans govern. Approved patterns become enterprise knowledge.*

Next.js (App Router) · TypeScript · PostgreSQL via `pg` (parameterized queries only) · NextAuth.js
(Credentials, JWT session) · bcrypt password hashes · plain CSS with the Acme palette.

## Setup

```bash
npm install
cp .env.example .env.local      # fill in DATABASE_URL, NEXTAUTH_SECRET
npm run db:migrate              # idempotent; safe on a DB that already has the reference tables
NEW_USER_PASSWORD='<12+ chars>' npm run user:bootstrap -- --email you@acme.com --name "Your Name"
npm run dev                     # http://localhost:3000
```

Sign in as the bootstrapped ARB member, then create everyone else on **Users**.

Optional, dev database only — one user per role plus sample patterns in different states:

```bash
NEW_USER_PASSWORD='<12+ chars>' npm run db:seed -- --confirm-dev
```

### Local development

This app runs against the local Postgres already installed on this machine (EDB "pgsql-portable",
`127.0.0.1:5432`) rather than a cloud database, sharing the instance with the existing `pulsepoint`
project without touching its data:

- A dedicated login role, **`patternforge_app`**, owns a dedicated schema, **`pattern_review`**, inside
  the existing **`pulsepoint`** database. The role's `search_path` is pinned server-side to
  `pattern_review` (`ALTER ROLE patternforge_app IN DATABASE pulsepoint SET search_path = pattern_review`),
  so every unqualified table name in this app's SQL — `db/schema.sql` and everything under `src/lib/` —
  resolves there automatically. `db/schema.sql` is written with no schema prefixes for exactly this
  reason; don't add `public.` back.
  - `patternforge_app` has no grants on `public` (where Pulsepoint's own tables live) and cannot see
    them. Verified: `SELECT * FROM business_units` from this role fails with
    `relation "business_units" does not exist`.
  - The role/schema were created once, out of band (not by `npm run db:migrate`, which only creates
    tables *inside* an existing schema), as `postgres`:
    ```sql
    CREATE ROLE patternforge_app LOGIN PASSWORD '...';
    CREATE SCHEMA IF NOT EXISTS pattern_review AUTHORIZATION patternforge_app;
    ALTER ROLE patternforge_app IN DATABASE pulsepoint SET search_path = pattern_review;
    GRANT CONNECT ON DATABASE pulsepoint TO patternforge_app;
    ```
    Re-run this (with a new password) if the role needs recreating; `db:migrate` then just works.
  - `DATABASE_SSL=disable` — this is a local, loopback-only (`127.0.0.1`) connection, no TLS involved.
- **If you need a truly separate local database instead** (no sharing at all): create one with
  `CREATE DATABASE patternforge OWNER patternforge_app;` on the same instance and point `DATABASE_URL`
  at it — `db/schema.sql`'s lack of schema prefixes means it lands in that database's `public` schema
  unchanged, no edits needed.
- A hosted dev Postgres (e.g. Supabase) works too: point `DATABASE_URL` at it, set `DATABASE_SSL=no-verify`
  for a quick start (`require` + `DATABASE_SSL_CA` for certificate verification), and if it's Supabase
  specifically, note that `db/schema.sql` enables RLS (no policies = deny) on `patt_users` and
  `patt_audit_log` when it detects Supabase's `anon` role, since Supabase exposes `public` tables through
  its REST API and this app's tables must not be reachable that way.

## What's where

| Path | Purpose |
|---|---|
| `db/schema.sql` | Idempotent migration: `patt_users`, `text → uuid` fix-ups + FKs, integrity indexes, `patt_audit_log` |
| `src/lib/permissions.ts` | The role table as code — one source of truth for UI, enforcement and middleware |
| `src/lib/workflow.ts` | State machine: request review → pick up → decide, each in one locked transaction |
| `src/lib/users.ts` | User admin (create, change role, (de)activate, reset password) |
| `src/lib/patterns.ts` | Role-scoped read queries |
| `src/middleware.ts` | Coarse route gating (login required; `/admin` ARB only; `/review-queue` reviewers) |
| `scripts/` | `migrate`, `bootstrap-admin`, `seed-dev` |

## Governance & audit design

- **Authorization is enforced server-side, three times over**: middleware (JWT role) → page/action
  (`requireUser` re-reads the user from the DB, so deactivation and role changes apply on the next
  request, not at JWT expiry) → the workflow transaction (re-loads actor + locks the pattern row).
- **Attribution.** Requests are attributed via `revi_requested_by`, decisions via `appr_decided_by`,
  both timestamped in the database. The reference schema has no place to record *who picked a request
  up* or *who changed a user*, so this app adds one append-only table, `patt_audit_log`
  (UPDATE/DELETE/TRUNCATE blocked by trigger), written in the same transaction as each change.
  Passwords and hashes are never written to it or to logs.
- **Integrity.** Unique partial index → at most one open review request per pattern; unique index →
  one decision per request. Nobody can change their own role or deactivate themselves, and user-admin
  writes are serialised so at least one active ARB member always remains.
- All timestamps are displayed in UTC.

## Assumptions to confirm

1. **Pattern ownership.** `patt_patterns.patt_owner` is free text and `patt_users` has no link to it.
   A user owns a pattern when `patt_owner` equals their e-mail **or** display name (case-insensitive,
   trimmed). Change `ownsPattern` in `permissions.ts` and `visibilityClause` in `patterns.ts` together
   if the sync writes a different identifier.
2. **Review history visibility.** Reviewer names and comments are shown to reviewers/ARB and to the
   pattern's own owner — not to viewers or to other owners looking at an approved pattern.
3. **Requesting review** is not blocked by missing required attributes; the detail page flags them.
4. **Attributes.** The detail page lists *every* attribute type, so an attribute with no value row
   shows as "Missing".

## Known gaps (v1)

- No account lockout / failed-login throttling, no password expiry, no forced change of the initial
  password. Part 11 typically expects these; there is no column for them in `patt_users` yet.
- No electronic-signature re-authentication on approve/reject (Part 11 §11.200) — decisions rely on the session.
- No automated test suite yet; verified with `tsc` and `next build` only (see the hand-off notes).
