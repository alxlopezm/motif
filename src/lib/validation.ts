import { z } from 'zod';
import { COMMENT_MAX_LENGTH, DECISIONS, ROLES } from './constants';

export const uuidSchema = z.string().uuid();

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid e-mail address').max(254);

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name is required')
  .max(100, 'Display name is too long');

// bcrypt only uses the first 72 bytes, so reject anything longer rather than silently truncate.
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 bytes');

export const roleSchema = z.enum(ROLES);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const createUserSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
  role: roleSchema,
  password: passwordSchema,
});

export const decisionSchema = z
  .object({
    patternId: uuidSchema,
    decision: z.enum(DECISIONS, { errorMap: () => ({ message: 'Choose a decision' }) }),
    comments: z
      .string()
      .trim()
      .max(COMMENT_MAX_LENGTH, `Comments must be at most ${COMMENT_MAX_LENGTH} characters`),
  })
  .superRefine((v, ctx) => {
    if (v.decision !== 'approved' && v.comments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comments'],
        message: 'A comment is required when rejecting or requesting changes',
      });
    }
  });

/** Flatten zod issues into { field: message } (first message per field). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
