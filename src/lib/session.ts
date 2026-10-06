import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { queryOne } from './db';
import type { Role } from './constants';
import type { Actor } from './permissions';

/**
 * The authenticated user for this request, or null. The JWT only proves *who* signed in;
 * whether that account is still active and what role it has now comes from the database on
 * every request (memoised per request).
 */
export const getCurrentUser = cache(async (): Promise<Actor | null> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const row = await queryOne<Actor & { isActive: boolean }>(
    `SELECT user_id AS id, user_email AS email, user_display_name AS "displayName",
            user_role AS role, user_is_active AS "isActive"
       FROM patt_users WHERE user_id = $1`,
    [session.user.id],
  );
  if (!row || !row.isActive) return null;
  return { id: row.id, email: row.email, displayName: row.displayName, role: row.role };
});

export async function requireUser(): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireRole(roles: readonly Role[]): Promise<Actor> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect('/forbidden');
  return user;
}
