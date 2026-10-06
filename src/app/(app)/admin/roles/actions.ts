'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { roleSchema } from '@/lib/validation';
import { updateRole } from '@/lib/roles';
import type { ActionState } from '@/lib/action-state';

// requireUser() rejects anonymous/deactivated sessions; updateRole() re-verifies inside its own
// transaction that the actor is (still) an active ARB member — same pattern as admin/users.

export async function updateRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const code = roleSchema.safeParse(formData.get('code'));
  const name = String(formData.get('name') ?? '');
  const description = String(formData.get('description') ?? '');
  if (!code.success) return { ok: false, error: 'Invalid role.' };
  if (!name.trim()) return { ok: false, error: 'Role name cannot be empty.', fieldErrors: { name: 'Required' } };

  try {
    await updateRole(actor.id, code.data, { name, description });
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    console.error('role update failed', err);
    return { ok: false, error: 'Something went wrong and nothing was changed. Please try again.' };
  }
  revalidatePath('/admin/roles');
  revalidatePath('/admin/users');
  return { ok: true, message: 'Role updated.' };
}
