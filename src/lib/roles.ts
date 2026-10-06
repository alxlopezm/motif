import 'server-only';
import { cache } from 'react';
import { query, withTransaction } from './db';
import { writeAudit } from './audit';
import { AppError } from './errors';
import { assertAdmin } from './admin-guard';
import { ROLES, ROLE_LABELS, type Role } from './constants';

export interface RoleRow {
  code: Role;
  name: string;
  description: string | null;
  updatedAt: Date;
}

/**
 * The set of role codes is fixed at the 4 in ROLES — every permission check in
 * lib/permissions.ts is written against those specific identifiers, so this app never lets an
 * admin add or remove a row here, only edit name/description. Cached per request: called from
 * both the app shell (layout) and the admin Users/Roles pages, and it rarely changes.
 */
export const listRoles = cache(async (): Promise<RoleRow[]> => {
  const rows = await query<{ code: Role; name: string; description: string | null; updatedAt: Date }>(
    `SELECT role_code AS code, role_name AS name, role_description AS description,
            role_updated_at AS "updatedAt"
       FROM patt_roles`,
  );
  const byCode = new Map(rows.map((r) => [r.code, r]));
  // Defensive fallback to the static label, not load-bearing: the FK on patt_users.user_role
  // guarantees every code here is seeded, but a row is looked up by code regardless in case of
  // a future manual edit to patt_roles outside this app.
  return ROLES.map(
    (code) => byCode.get(code) ?? { code, name: ROLE_LABELS[code], description: null, updatedAt: new Date(0) },
  );
});

export async function roleLabels(): Promise<Record<Role, string>> {
  const rows = await listRoles();
  return Object.fromEntries(rows.map((r) => [r.code, r.name])) as Record<Role, string>;
}

export async function updateRole(
  actorId: string,
  code: Role,
  input: { name: string; description: string },
): Promise<void> {
  const name = input.name.trim();
  const description = input.description.trim();
  if (!name) throw new AppError('Role name cannot be empty.');

  await withTransaction(async (tx) => {
    await assertAdmin(tx, actorId);
    const before = await tx.queryOne<{ name: string; description: string | null }>(
      `SELECT role_name AS name, role_description AS description FROM patt_roles WHERE role_code = $1 FOR UPDATE`,
      [code],
    );
    if (!before) throw new AppError('Role not found.');

    await tx.query(
      `UPDATE patt_roles SET role_name = $2, role_description = $3, role_updated_at = now() WHERE role_code = $1`,
      [code, name, description || null],
    );
    await writeAudit(tx, {
      actorId,
      action: 'role.updated',
      entityType: 'role',
      entityId: code,
      details: { from: before, to: { name, description: description || null } },
    });
  });
}
