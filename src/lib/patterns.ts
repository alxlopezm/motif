import 'server-only';
import { query, queryOne } from './db';
import { extractPlainText } from './content-text';
import {
  CATEGORIES,
  PAGE_SIZE,
  PATTERN_STATUSES,
  type Category,
  type Decision,
  type ExtractionMethod,
  type PatternStatus,
} from './constants';
import { isReviewer, ownerMatchValues, visibleStatuses, type Actor } from './permissions';

export interface PatternSummary {
  id: string;
  name: string;
  category: Category;
  owner: string;
  sourceSystem: string;
  status: PatternStatus;
  updatedAt: Date;
  /** The pattern's `summary` attribute value (attr_code = 'summary'), if the sync populated one. */
  summary: string | null;
}

export interface PatternDetail extends PatternSummary {
  sourceUrl: string;
  sourceLastModified: Date | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
}

export const SORT_OPTIONS = ['updated_desc', 'name_asc'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const SORT_LABELS: Record<SortOption, string> = {
  updated_desc: 'Recently updated',
  name_asc: 'Name (A–Z)',
};

export interface ListFilters {
  q: string;
  category: Category | '';
  status: PatternStatus | '';
  sort: SortOption;
  page: number;
}

/**
 * SQL predicate implementing the role visibility table. Only static SQL plus `$n`
 * placeholders are emitted; user-derived values are pushed onto `params`.
 */
function visibilityClause(actor: Actor, params: unknown[]): string {
  if (isReviewer(actor.role)) return 'TRUE';
  if (actor.role === 'viewer') return `p.patt_approval_status = 'approved'`;
  const [email, name] = ownerMatchValues(actor);
  params.push(email, name);
  const a = params.length - 1;
  const b = params.length;
  return `(p.patt_approval_status = 'approved' OR lower(btrim(p.patt_owner)) IN ($${a}, $${b}))`;
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function parseListFilters(raw: RawParams, actor: Actor): ListFilters {
  const category = first(raw.category);
  const status = first(raw.status);
  const sort = first(raw.sort);
  const page = Number.parseInt(first(raw.page), 10);
  return {
    q: first(raw.q).trim().slice(0, 200),
    category: (CATEGORIES as readonly string[]).includes(category) ? (category as Category) : '',
    status: (visibleStatuses(actor) as readonly string[]).includes(status) ? (status as PatternStatus) : '',
    sort: (SORT_OPTIONS as readonly string[]).includes(sort) ? (sort as SortOption) : 'updated_desc',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export async function listPatterns(
  actor: Actor,
  filters: ListFilters,
): Promise<{ rows: PatternSummary[]; total: number; pageSize: number }> {
  const params: unknown[] = [];
  const where: string[] = [visibilityClause(actor, params)];

  if (filters.category) {
    params.push(filters.category);
    where.push(`p.patt_category = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`p.patt_approval_status = $${params.length}`);
  }
  if (filters.q) {
    params.push(filters.q);
    const n = params.length;
    // Matches the "Search patterns, owners, sources" placeholder: name, owner, and source system.
    where.push(
      `(strpos(lower(p.patt_name), lower($${n})) > 0
        OR strpos(lower(p.patt_owner), lower($${n})) > 0
        OR strpos(lower(p.patt_source_system), lower($${n})) > 0)`,
    );
  }
  const whereSql = where.join(' AND ');

  const count = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM patt_patterns p WHERE ${whereSql}`,
    params,
  );

  const orderBy =
    filters.sort === 'name_asc'
      ? 'lower(p.patt_name), p.patt_pattern_id'
      : 'p.patt_updated_at DESC, p.patt_pattern_id';

  const pageParams = [...params, PAGE_SIZE, (filters.page - 1) * PAGE_SIZE];
  // attv_value is jsonb of whatever shape the pattern's source produces (plain string for
  // SharePoint/GitHub-style extraction, a full ADF document for Confluence, …) — raw here, not
  // yet the `string | null` PatternSummary.summary promises; extractPlainText below is what
  // actually makes that promise true, regardless of format.
  const rawRows = await query<Omit<PatternSummary, 'summary'> & { summary: unknown }>(
    `SELECT p.patt_pattern_id AS id, p.patt_name AS name, p.patt_category AS category,
            p.patt_owner AS owner, p.patt_source_system AS "sourceSystem",
            p.patt_approval_status AS status, p.patt_updated_at AS "updatedAt",
            s.summary
       FROM patt_patterns p
       LEFT JOIN LATERAL (
              SELECT v.attv_value AS summary
                FROM patt_attribute_values v
                JOIN patt_attribute_types t ON t.attr_attribute_type_id = v.attv_attribute_type_id
               WHERE v.attv_pattern_id = p.patt_pattern_id AND t.attr_code = 'summary'
               ORDER BY v.attv_updated_at DESC
               LIMIT 1) s ON true
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    pageParams,
  );
  const rows: PatternSummary[] = rawRows.map((r) => ({ ...r, summary: extractPlainText(r.summary) }));
  return { rows, total: count?.count ?? 0, pageSize: PAGE_SIZE };
}

export interface PatternStats {
  total: number;
  byStatus: Record<PatternStatus, number>;
}

/**
 * Counts scoped only by role visibility (no search/category/status filter) — the totals shown
 * on the stat cards at the top of the Patterns list, independent of whichever tab is active.
 */
export async function getPatternStats(actor: Actor): Promise<PatternStats> {
  const params: unknown[] = [];
  const visibility = visibilityClause(actor, params);
  const rows = await query<{ status: PatternStatus; count: number }>(
    `SELECT p.patt_approval_status AS status, count(*)::int AS count
       FROM patt_patterns p
      WHERE ${visibility}
      GROUP BY p.patt_approval_status`,
    params,
  );
  const byStatus = Object.fromEntries(PATTERN_STATUSES.map((s) => [s, 0])) as Record<PatternStatus, number>;
  let total = 0;
  for (const row of rows) {
    byStatus[row.status] = row.count;
    total += row.count;
  }
  return { total, byStatus };
}

/** Returns null when the pattern does not exist OR the actor may not see it. */
export async function getPattern(actor: Actor, id: string): Promise<PatternDetail | null> {
  const params: unknown[] = [id];
  const visibility = visibilityClause(actor, params);
  return queryOne<PatternDetail>(
    `SELECT p.patt_pattern_id AS id, p.patt_name AS name, p.patt_category AS category,
            p.patt_owner AS owner, p.patt_source_system AS "sourceSystem",
            p.patt_source_url AS "sourceUrl",
            p.patt_source_last_modified AS "sourceLastModified",
            p.patt_last_synced_at AS "lastSyncedAt",
            p.patt_approval_status AS status,
            p.patt_created_at AS "createdAt", p.patt_updated_at AS "updatedAt"
       FROM patt_patterns p
      WHERE p.patt_pattern_id = $1 AND ${visibility}`,
    params,
  );
}

export interface AttributeRow {
  typeId: string;
  code: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  value: unknown;
  excerpt: string | null;
  method: ExtractionMethod;
  extractedAt: Date | null;
}

/**
 * Every attribute type is listed (LEFT JOIN), so an attribute the pipeline never produced
 * still shows up as "missing" to the reviewer. If duplicates exist for a (pattern, type)
 * pair the most recently updated value wins.
 */
export async function getAttributes(patternId: string): Promise<AttributeRow[]> {
  return query<AttributeRow>(
    `SELECT DISTINCT ON (t.attr_display_order, t.attr_attribute_type_id)
            t.attr_attribute_type_id AS "typeId", t.attr_code AS code, t.attr_name AS name,
            t.attr_description AS description, t.attr_is_required AS "isRequired",
            v.attv_value AS value, v.attv_source_excerpt AS excerpt,
            COALESCE(v.attv_extraction_method, 'missing') AS method,
            v.attv_extracted_at AS "extractedAt"
       FROM patt_attribute_types t
       LEFT JOIN patt_attribute_values v
              ON v.attv_attribute_type_id = t.attr_attribute_type_id AND v.attv_pattern_id = $1
      ORDER BY t.attr_display_order, t.attr_attribute_type_id, v.attv_updated_at DESC NULLS LAST`,
    [patternId],
  );
}

export interface HistoryEntry {
  requestId: string;
  requestedAt: Date;
  requestStatus: 'open' | 'closed';
  requestedByName: string;
  requestedByEmail: string;
  pickedUpAt: Date | null;
  pickedUpByName: string | null;
  decision: Decision | null;
  comments: string | null;
  decidedAt: Date | null;
  decidedByName: string | null;
}

/** One entry per review cycle, newest first. Pickup attribution comes from the audit log. */
export async function getHistory(patternId: string): Promise<HistoryEntry[]> {
  return query<HistoryEntry>(
    `SELECT r.revi_review_request_id AS "requestId", r.revi_requested_at AS "requestedAt",
            r.revi_status AS "requestStatus",
            ru.user_display_name AS "requestedByName", ru.user_email AS "requestedByEmail",
            pk.audi_occurred_at AS "pickedUpAt", pku.user_display_name AS "pickedUpByName",
            d.appr_decision AS decision, d.appr_comments AS comments,
            d.appr_decided_at AS "decidedAt", du.user_display_name AS "decidedByName"
       FROM patt_review_requests r
       JOIN patt_users ru ON ru.user_id = r.revi_requested_by
       LEFT JOIN LATERAL (
              SELECT a.audi_occurred_at, a.audi_actor_id
                FROM patt_audit_log a
               WHERE a.audi_entity_type = 'pattern'
                 AND a.audi_entity_id = r.revi_pattern_id::text
                 AND a.audi_action = 'pattern.review_picked_up'
                 AND a.audi_details->>'review_request_id' = r.revi_review_request_id::text
               ORDER BY a.audi_occurred_at DESC
               LIMIT 1) pk ON true
       LEFT JOIN patt_users pku ON pku.user_id = pk.audi_actor_id
       LEFT JOIN patt_approval_decisions d ON d.appr_review_request_id = r.revi_review_request_id
       LEFT JOIN patt_users du ON du.user_id = d.appr_decided_by
      WHERE r.revi_pattern_id = $1
      ORDER BY r.revi_requested_at DESC`,
    [patternId],
  );
}

export interface QueueItem {
  id: string;
  name: string;
  category: Category;
  owner: string;
  status: PatternStatus;
  waitingSince: Date;
  requestedByName: string | null;
  pickedUpByName: string | null;
}

/** Oldest waiting request first. Caller must already have verified the actor is a reviewer. */
export async function getReviewQueue(): Promise<QueueItem[]> {
  return query<QueueItem>(
    `SELECT p.patt_pattern_id AS id, p.patt_name AS name, p.patt_category AS category,
            p.patt_owner AS owner, p.patt_approval_status AS status,
            COALESCE(r.revi_requested_at, p.patt_updated_at) AS "waitingSince",
            ru.user_display_name AS "requestedByName",
            pku.user_display_name AS "pickedUpByName"
       FROM patt_patterns p
       LEFT JOIN patt_review_requests r
              ON r.revi_pattern_id = p.patt_pattern_id AND r.revi_status = 'open'
       LEFT JOIN patt_users ru ON ru.user_id = r.revi_requested_by
       LEFT JOIN LATERAL (
              SELECT a.audi_actor_id
                FROM patt_audit_log a
               WHERE a.audi_entity_type = 'pattern'
                 AND a.audi_entity_id = p.patt_pattern_id::text
                 AND a.audi_action = 'pattern.review_picked_up'
                 AND a.audi_details->>'review_request_id' = r.revi_review_request_id::text
               ORDER BY a.audi_occurred_at DESC
               LIMIT 1) pk ON p.patt_approval_status = 'under_review'
       LEFT JOIN patt_users pku ON pku.user_id = pk.audi_actor_id
      WHERE p.patt_approval_status IN ('review_requested', 'under_review')
      ORDER BY COALESCE(r.revi_requested_at, p.patt_updated_at) ASC, p.patt_pattern_id`,
  );
}
