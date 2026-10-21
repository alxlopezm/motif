import { z } from 'zod';
import { CATEGORIES, COMMENT_MAX_LENGTH, DECISIONS, ROLES } from './constants';
import { safeExternalUrl } from './format';

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

export const createPatternFromAdfSchema = z.object({
  name: z.string().trim().min(1, 'Pattern name is required').max(200, 'Pattern name is too long'),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Choose a category' }) }),
  owner: z.string().trim().min(1, 'Owner is required').max(200, 'Owner is too long'),
  sourceUrl: z
    .string()
    .trim()
    .url('Enter a valid URL')
    .refine((v) => safeExternalUrl(v) !== null, 'Enter a valid http(s) URL'),
  sections: z.array(
    z.object({
      attributeTypeId: uuidSchema,
      // Full ADF shape-checking is out of scope — the existing renderer is already lenient
      // with unknown node shapes, so this just confirms it's a plain object (an array of nodes).
      content: z.array(z.record(z.unknown())),
    }),
  ),
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
