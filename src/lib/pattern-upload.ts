import 'server-only';
import { withTransaction, type Queryable } from './db';
import { writeAudit } from './audit';
import { AppError } from './errors';
import type { Category } from './constants';

export interface PatternUploadSection {
  attributeTypeId: string;
  content: unknown[];
}

export interface CreatePatternFromAdfInput {
  name: string;
  category: Category;
  owner: string;
  sourceUrl: string;
  sections: PatternUploadSection[];
}

/**
 * Re-verifies the actor is still an active ARB member, same guarantee every other admin write
 * relies on (`admin-guard.ts`'s `assertAdmin`) — written separately here rather than reusing
 * that function directly because its advisory lock and error message ("...can manage users")
 * are specific to the last-admin-standing concern around user management, which doesn't apply
 * to pattern creation.
 */
async function assertActiveAdmin(tx: Queryable, actorId: string): Promise<void> {
  const admin = await tx.queryOne(
    `SELECT 1 FROM patt_users WHERE user_id = $1 AND user_is_active = true AND user_role = 'arb_member'`,
    [actorId],
  );
  if (!admin) throw new AppError('Only active ARB members can create patterns.');
}

/**
 * Creates a new `confluence`-sourced pattern and its 7 attribute-value rows from an
 * admin-reviewed section mapping. Sections assigned to the same attribute type (the admin is
 * free to do this) are concatenated into one ADF doc for that row — `patt_attribute_values` is
 * one row per (pattern, attribute type), the same invariant every existing writer (seed
 * scripts, the sync pipeline) already honors. Attribute types with no assigned section get a
 * `missing` row, exactly like a pattern the sync pipeline only partially extracted.
 */
export async function createPatternFromAdf(actorId: string, input: CreatePatternFromAdfInput): Promise<string> {
  return withTransaction(async (tx) => {
    await assertActiveAdmin(tx, actorId);

    const existing = await tx.queryOne(`SELECT 1 FROM patt_patterns WHERE patt_name = $1`, [input.name]);
    if (existing) throw new AppError('A pattern with that name already exists.');

    const pattern = await tx.queryOne<{ id: string }>(
      `INSERT INTO patt_patterns
         (patt_name, patt_category, patt_owner, patt_source_system, patt_source_url,
          patt_source_last_modified, patt_last_synced_at, patt_approval_status)
       VALUES ($1, $2, $3, 'confluence', $4, now(), now(), 'authored')
       RETURNING patt_pattern_id AS id`,
      [input.name, input.category, input.owner, input.sourceUrl],
    );
    if (!pattern) throw new AppError('Could not create the pattern.');

    const allAttributeTypes = await tx.query<{ id: string }>(`SELECT attr_attribute_type_id AS id FROM patt_attribute_types`);
    const contentByType = new Map<string, unknown[]>();
    for (const section of input.sections) {
      const existingContent = contentByType.get(section.attributeTypeId) ?? [];
      contentByType.set(section.attributeTypeId, [...existingContent, ...section.content]);
    }

    const attributeCodesAssigned: string[] = [];
    for (const type of allAttributeTypes) {
      const content = contentByType.get(type.id);
      const value = content && content.length > 0 ? { type: 'doc', version: 1, content } : null;
      await tx.query(
        `INSERT INTO patt_attribute_values
           (attv_pattern_id, attv_attribute_type_id, attv_value, attv_extraction_method, attv_extracted_at)
         VALUES ($1, $2, $3::jsonb, $4, now())`,
        [pattern.id, type.id, value === null ? null : JSON.stringify(value), value === null ? 'missing' : 'direct_field_match'],
      );
      if (value !== null) attributeCodesAssigned.push(type.id);
    }

    await writeAudit(tx, {
      actorId,
      action: 'pattern.created',
      entityType: 'pattern',
      entityId: pattern.id,
      details: { name: input.name, category: input.category, sourceSystem: 'confluence', attributeCodesAssigned },
    });

    return pattern.id;
  });
}
