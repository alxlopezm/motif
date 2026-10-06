'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { decisionSchema, fieldErrors, uuidSchema } from '@/lib/validation';
import { pickUpReview, recordDecision, requestReview } from '@/lib/workflow';
import type { ActionState } from '@/lib/action-state';

function failure(err: unknown): ActionState {
  if (err instanceof AppError) return { ok: false, error: err.message };
  console.error('workflow action failed', err);
  return { ok: false, error: 'Something went wrong and nothing was recorded. Please try again.' };
}

function refresh(patternId: string) {
  revalidatePath(`/patterns/${patternId}`);
  revalidatePath('/patterns');
  revalidatePath('/review-queue');
}

// Every action starts with requireUser(): no session (or a deactivated account) means no write.
// workflow.ts then re-verifies the user's role and the pattern's state inside the transaction.

export async function requestReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = uuidSchema.safeParse(formData.get('patternId'));
  if (!id.success) return { ok: false, error: 'Invalid pattern.' };

  try {
    await requestReview(user.id, id.data);
  } catch (err) {
    return failure(err);
  }
  refresh(id.data);
  return { ok: true, message: 'Review requested.' };
}

export async function pickUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = uuidSchema.safeParse(formData.get('patternId'));
  if (!id.success) return { ok: false, error: 'Invalid pattern.' };

  try {
    await pickUpReview(user.id, id.data);
  } catch (err) {
    return failure(err);
  }
  refresh(id.data);
  redirect(`/patterns/${id.data}`);
}

export async function recordDecisionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = decisionSchema.safeParse({
    patternId: formData.get('patternId'),
    decision: formData.get('decision'),
    comments: formData.get('comments') ?? '',
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    await recordDecision(user.id, parsed.data.patternId, parsed.data.decision, parsed.data.comments);
  } catch (err) {
    return failure(err);
  }
  refresh(parsed.data.patternId);
  return { ok: true, message: 'Decision recorded.' };
}
