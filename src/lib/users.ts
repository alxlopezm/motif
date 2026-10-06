import 'server-only';
import bcrypt from 'bcryptjs';
import { query, withTransaction, type Queryable } from './db';
import { writeAudit } from './audit';
import { AppError } from './errors';
import { assertAdmin } from './admin-guard';
import type { Role } from './constants';

export const BCRYPT_COST = 12;

export interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function listUsers(): Promise<UserRow[]> {
  return query<UserRow>(
    `SELECT user_id AS id, user_email AS email, user_display_name AS "displayName",
            user_role AS role, user_is_active AS "isActive",
            user_created_at AS "createdAt", user_updated_at AS "updatedAt"
       FROM patt_users
      ORDER BY user_is_active DESC, lower(user_display_name), user_email`,
  );
}

async function loadTarget(tx: Queryable, userId: string) {
  const target = await tx.queryOne<{ id: string; email: string; role: Role; isActive: boolean }>(
    `SELECT user_id AS id, user_email AS email, user_role AS role, user_is_active AS "isActive"
       FROM patt_users WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  if (!target) throw new AppError('User not found.');
  return target;
}

export async function createUser(
  actorId: string,
  input: { email: string; displayName: string; role: Role; password: string },
): Promise<void> {
  const hash = await bcrypt.hash(input.password, BCRYPT_COST);
  await withTransaction(async (tx) => {
    await assertAdmin(tx, actorId);
    const existing = await tx.queryOne(`SELECT 1 FROM patt_users WHERE lower(user_email) = $1`, [input.email]);
    if (existing) throw new AppError('A user with that e-mail address already exists.');

    const created = await tx.queryOne<{ id: string }>(
      `INSERT INTO patt_users (user_email, user_display_name, user_password_hash, user_role)
       VALUES ($1, $2, $3, $4) RETURNING user_id AS id`,
      [input.email, input.displayName, hash, input.role],
    );
    await writeAudit(tx, {
      actorId,
      action: 'user.created',
      entityType: 'user',
      entityId: created!.id,
      details: { email: input.email, role: input.role },
    });
  });
}

export async function changeUserRole(actorId: string, userId: string, role: Role): Promise<void> {
  await withTransaction(async (tx) => {
    await assertAdmin(tx, actorId);
    if (userId === actorId) throw new AppError('You cannot change your own role.');
    const target = await loadTarget(tx, userId);
    if (target.role === role) throw new AppError('The user already has that role.');

    await tx.query(`UPDATE patt_users SET user_role = $2, user_updated_at = now() WHERE user_id = $1`, [
      userId,
      role,
    ]);
    await writeAudit(tx, {
      actorId,
      action: 'user.role_changed',
      entityType: 'user',
      entityId: userId,
      details: { email: target.email, from: target.role, to: role },
    });
  });
}

export async function setUserActive(actorId: string, userId: string, active: boolean): Promise<void> {
  await withTransaction(async (tx) => {
    await assertAdmin(tx, actorId);
    if (userId === actorId) throw new AppError('You cannot deactivate your own account.');
    const target = await loadTarget(tx, userId);
    if (target.isActive === active) {
      throw new AppError(active ? 'The user is already active.' : 'The user is already deactivated.');
    }

    await tx.query(`UPDATE patt_users SET user_is_active = $2, user_updated_at = now() WHERE user_id = $1`, [
      userId,
      active,
    ]);
    await writeAudit(tx, {
      actorId,
      action: active ? 'user.reactivated' : 'user.deactivated',
      entityType: 'user',
      entityId: userId,
      details: { email: target.email },
    });
  });
}

export async function resetUserPassword(actorId: string, userId: string, password: string): Promise<void> {
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  await withTransaction(async (tx) => {
    await assertAdmin(tx, actorId);
    const target = await loadTarget(tx, userId);
    await tx.query(
      `UPDATE patt_users SET user_password_hash = $2, user_updated_at = now() WHERE user_id = $1`,
      [userId, hash],
    );
    await writeAudit(tx, {
      actorId,
      action: 'user.password_reset',
      entityType: 'user',
      entityId: userId,
      details: { email: target.email },
    });
  });
}
