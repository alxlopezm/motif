import 'server-only';
import type { Queryable } from './db';
import { AppError } from './errors';

/**
 * Every admin write (user management, role management) runs under this one advisory lock and
 * re-verifies, inside the transaction, that the acting user is still an active ARB member.
 * Combined with the rule that nobody may change their own role/active flag, at least one active
 * ARB member always remains, even with two admins acting at the same moment.
 */
export async function assertAdmin(tx: Queryable, actorId: string): Promise<void> {
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['patt_users_admin']);
  const admin = await tx.queryOne(
    `SELECT 1 FROM patt_users
      WHERE user_id = $1 AND user_is_active = true AND user_role = 'arb_member'`,
    [actorId],
  );
  if (!admin) throw new AppError('Only active ARB members can manage users.');
}
