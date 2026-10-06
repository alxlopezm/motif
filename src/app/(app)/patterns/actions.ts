'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { uuidSchema } from '@/lib/validation';
import { quickDecision } from '@/lib/workflow';
import { COMMENT_MAX_LENGTH } from '@/lib/constants';
import type { ActionState } from '@/lib/action-state';

function failure(err: unknown): ActionState {
  if (err instanceof AppError) return { ok: false, error: err.message };
  console.error('quick action failed', err);
  return { ok: false, error: 'Something went wrong and nothing was recorded. Please try again.' };
}

function refresh(patternId: string) {
  revalidatePath('/patterns');
  revalidatePath(`/patterns/${patternId}`);
  revalidatePath('/review-queue');
}

// Row-level quick actions for the Patterns list. requireUser() rejects anonymous/deactivated
// sessions; quickDecision() in lib/workflow.ts re-verifies the actor's role and the pattern's
// state inside its own transaction, so these are just as safe as the full decision panel.

export async function quickApproveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = uuidSchema.safeParse(formData.get('patternId'));
  if (!id.success) return { ok: false, error: 'Invalid pattern.' };

  try {
    await quickDecision(user.id, id.data, 'approved', '');
  } catch (err) {
    return failure(err);
  }
  refresh(id.data);
  return { ok: true, message: 'Approved.' };
}

export async function quickChangesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = uuidSchema.safeParse(formData.get('patternId'));
  const comments = String(formData.get('comments') ?? '').trim();
  if (!id.success) return { ok: false, error: 'Invalid pattern.' };
  if (!comments) {
    return { ok: false, error: 'A comment is required when requesting changes.', fieldErrors: { comments: 'Required' } };
  }
  if (comments.length > COMMENT_MAX_LENGTH) {
    return { ok: false, error: `Comments must be at most ${COMMENT_MAX_LENGTH} characters.` };
  }

  try {
    await quickDecision(user.id, id.data, 'changes_requested', comments);
  } catch (err) {
    return failure(err);
  }
  refresh(id.data);
  return { ok: true, message: 'Changes requested.' };
}
