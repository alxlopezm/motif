'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { createUserSchema, fieldErrors, passwordSchema, roleSchema, uuidSchema } from '@/lib/validation';
import { changeUserRole, createUser, resetUserPassword, setUserActive } from '@/lib/users';
import type { ActionState } from '@/lib/action-state';

function failure(err: unknown): ActionState {
  if (err instanceof AppError) return { ok: false, error: err.message };
  console.error('user admin action failed', err);
  return { ok: false, error: 'Something went wrong and nothing was changed. Please try again.' };
}

// requireUser() rejects anonymous / deactivated sessions; lib/users.ts re-verifies inside the
// transaction that the actor is (still) an active ARB member.

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    displayName: formData.get('displayName'),
    role: formData.get('role'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errors).join(' · '), fieldErrors: errors };
  }
  try {
    await createUser(actor.id, parsed.data);
  } catch (err) {
    return failure(err);
  }
  revalidatePath('/admin/users');
  return { ok: true, message: `Created ${parsed.data.email}.` };
}

export async function changeRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const userId = uuidSchema.safeParse(formData.get('userId'));
  const role = roleSchema.safeParse(formData.get('role'));
  if (!userId.success || !role.success) return { ok: false, error: 'Invalid request.' };
  try {
    await changeUserRole(actor.id, userId.data, role.data);
  } catch (err) {
    return failure(err);
  }
  revalidatePath('/admin/users');
  return { ok: true, message: 'Role updated.' };
}

export async function setActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const userId = uuidSchema.safeParse(formData.get('userId'));
  const active = formData.get('active');
  if (!userId.success || (active !== 'true' && active !== 'false')) {
    return { ok: false, error: 'Invalid request.' };
  }
  try {
    await setUserActive(actor.id, userId.data, active === 'true');
  } catch (err) {
    return failure(err);
  }
  revalidatePath('/admin/users');
  return { ok: true, message: active === 'true' ? 'User reactivated.' : 'User deactivated.' };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const userId = uuidSchema.safeParse(formData.get('userId'));
  const password = passwordSchema.safeParse(formData.get('password'));
  if (!userId.success) return { ok: false, error: 'Invalid request.' };
  if (!password.success) return { ok: false, error: password.error.issues[0]?.message ?? 'Invalid password.' };
  try {
    await resetUserPassword(actor.id, userId.data, password.data);
  } catch (err) {
    return failure(err);
  }
  revalidatePath('/admin/users');
  return { ok: true, message: 'Password updated.' };
}
