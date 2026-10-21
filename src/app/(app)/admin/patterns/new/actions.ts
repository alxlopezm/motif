'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { AppError } from '@/lib/errors';
import { createPatternFromAdfSchema, fieldErrors } from '@/lib/validation';
import { createPatternFromAdf } from '@/lib/pattern-upload';
import type { ActionState } from '@/lib/action-state';

export async function createPatternFromAdfAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get('payload') ?? ''));
  } catch {
    return { ok: false, error: 'Invalid submission — please try uploading the file again.' };
  }

  const parsed = createPatternFromAdfSchema.safeParse(payload);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errors).join(' · '), fieldErrors: errors };
  }

  let patternId: string;
  try {
    patternId = await createPatternFromAdf(actor.id, parsed.data);
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    console.error('createPatternFromAdfAction failed', err);
    return { ok: false, error: 'Something went wrong and nothing was changed. Please try again.' };
  }

  redirect(`/patterns/${patternId}`);
}
