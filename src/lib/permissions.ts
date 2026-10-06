import type { PatternStatus, Role } from './constants';
import { PATTERN_STATUSES } from './constants';

/**
 * Pure (edge-safe) permission rules. This is the single source of truth for the role table:
 * pages use it to decide what to render, workflow.ts / users.ts use it to enforce, and
 * middleware.ts uses `requiredRolesForPath` for coarse route gating.
 */

export interface Actor {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface PatternAccess {
  owner: string;
  status: PatternStatus;
}

export const REVIEWER_ROLES: readonly Role[] = ['ea_reviewer', 'arb_member'];

export const isReviewer = (role: Role) => REVIEWER_ROLES.includes(role);
export const canManageUsers = (role: Role) => role === 'arb_member';

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * patt_owner is free text populated by the sync. A user owns a pattern when it matches their
 * e-mail or display name (case-insensitive). The SQL twin is `ownerParams` in patterns.ts.
 */
export function ownsPattern(actor: Pick<Actor, 'email' | 'displayName'>, owner: string): boolean {
  const o = normalize(owner);
  return o === normalize(actor.email) || o === normalize(actor.displayName);
}

export function ownerMatchValues(actor: Pick<Actor, 'email' | 'displayName'>): [string, string] {
  return [normalize(actor.email), normalize(actor.displayName)];
}

export const REVIEW_REQUESTABLE_STATUSES: readonly PatternStatus[] = ['draft', 'changes_requested'];

export function canView(actor: Actor, p: PatternAccess): boolean {
  if (isReviewer(actor.role)) return true;
  if (p.status === 'approved') return true;
  return actor.role === 'pattern_owner' && ownsPattern(actor, p.owner);
}

export function canRequestReview(actor: Actor, p: PatternAccess): boolean {
  return (
    actor.role === 'pattern_owner' &&
    ownsPattern(actor, p.owner) &&
    REVIEW_REQUESTABLE_STATUSES.includes(p.status)
  );
}

export const canPickUp = (actor: Actor, p: PatternAccess) =>
  isReviewer(actor.role) && p.status === 'review_requested';

export const canDecide = (actor: Actor, p: PatternAccess) =>
  isReviewer(actor.role) && p.status === 'under_review';

/** Review history (reviewer names + comments) is for reviewers and the pattern's own owner. */
export function canViewHistory(actor: Actor, p: PatternAccess): boolean {
  if (isReviewer(actor.role)) return true;
  return actor.role === 'pattern_owner' && ownsPattern(actor, p.owner);
}

/** Statuses a user may usefully filter the list by. */
export function visibleStatuses(actor: Actor): readonly PatternStatus[] {
  return actor.role === 'viewer' ? ['approved'] : PATTERN_STATUSES;
}

const ROUTE_RULES: readonly { prefix: string; roles: readonly Role[] }[] = [
  { prefix: '/admin', roles: ['arb_member'] },
  { prefix: '/review-queue', roles: REVIEWER_ROLES },
];

export function requiredRolesForPath(pathname: string): readonly Role[] | null {
  const rule = ROUTE_RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return rule ? rule.roles : null;
}
