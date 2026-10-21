import 'server-only';
import { withTransaction, type Queryable } from './db';
import { writeAudit } from './audit';
import { AppError } from './errors';
import type { Decision, PatternStatus, Role } from './constants';
import { REVIEW_REQUESTABLE_STATUSES, isReviewer, ownsPattern, type Actor } from './permissions';

/**
 * Governance state machine. Every function:
 *   - takes only the acting user's id and re-loads that user (active flag + role) from the DB
 *     inside the transaction, so a stale session can never authorise a write;
 *   - locks the pattern row (FOR UPDATE) so concurrent clicks cannot double-transition;
 *   - writes the domain rows and the audit row in one transaction, stamped with now().
 */

interface PatternRow {
  id: string;
  name: string;
  owner: string;
  status: PatternStatus;
}

async function loadActor(tx: Queryable, actorId: string): Promise<Actor> {
  const row = await tx.queryOne<Actor & { isActive: boolean }>(
    `SELECT user_id AS id, user_email AS email, user_display_name AS "displayName",
            user_role AS role, user_is_active AS "isActive"
       FROM patt_users WHERE user_id = $1`,
    [actorId],
  );
  if (!row || !row.isActive) throw new AppError('Your account is not active.');
  return row;
}

async function lockPattern(tx: Queryable, patternId: string): Promise<PatternRow> {
  const row = await tx.queryOne<PatternRow>(
    `SELECT patt_pattern_id AS id, patt_name AS name, patt_owner AS owner,
            patt_approval_status AS status
       FROM patt_patterns WHERE patt_pattern_id = $1 FOR UPDATE`,
    [patternId],
  );
  if (!row) throw new AppError('Pattern not found.');
  return row;
}

async function lockOpenRequest(tx: Queryable, patternId: string): Promise<string> {
  const row = await tx.queryOne<{ id: string }>(
    `SELECT revi_review_request_id AS id FROM patt_review_requests
      WHERE revi_pattern_id = $1 AND revi_status = 'open' FOR UPDATE`,
    [patternId],
  );
  if (!row) {
    throw new AppError('No open review request exists for this pattern. Please contact an administrator.');
  }
  return row.id;
}

function requireReviewer(actor: Actor): void {
  if (!isReviewer(actor.role as Role)) {
    throw new AppError('Only EA reviewers and ARB members can perform this action.');
  }
}

const staleMessage = (status: PatternStatus) =>
  `This pattern is now "${status.replace(/_/g, ' ')}" and can no longer take this action. Reload the page.`;

/** authored | changes_requested -> review_requested (pattern owner, own pattern only). */
export async function requestReview(actorId: string, patternId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const actor = await loadActor(tx, actorId);
    if (actor.role !== 'pattern_owner') throw new AppError('Only pattern owners can request a review.');

    const pattern = await lockPattern(tx, patternId);
    if (!ownsPattern(actor, pattern.owner)) {
      throw new AppError('You can only request a review for patterns you own.');
    }
    if (!REVIEW_REQUESTABLE_STATUSES.includes(pattern.status)) throw new AppError(staleMessage(pattern.status));

    const request = await tx.queryOne<{ id: string }>(
      `INSERT INTO patt_review_requests (revi_pattern_id, revi_requested_by, revi_status)
       VALUES ($1, $2, 'open') RETURNING revi_review_request_id AS id`,
      [pattern.id, actor.id],
    );
    await tx.query(
      `UPDATE patt_patterns SET patt_approval_status = 'review_requested', patt_updated_at = now()
        WHERE patt_pattern_id = $1`,
      [pattern.id],
    );
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'pattern.review_requested',
      entityType: 'pattern',
      entityId: pattern.id,
      details: { from: pattern.status, to: 'review_requested', review_request_id: request!.id },
    });
  });
}

/** review_requested -> under_review (EA reviewer / ARB member). */
export async function pickUpReview(actorId: string, patternId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const actor = await loadActor(tx, actorId);
    requireReviewer(actor);

    const pattern = await lockPattern(tx, patternId);
    if (pattern.status !== 'review_requested') throw new AppError(staleMessage(pattern.status));
    const requestId = await lockOpenRequest(tx, pattern.id);

    await tx.query(
      `UPDATE patt_patterns SET patt_approval_status = 'under_review', patt_updated_at = now()
        WHERE patt_pattern_id = $1`,
      [pattern.id],
    );
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'pattern.review_picked_up',
      entityType: 'pattern',
      entityId: pattern.id,
      details: { from: 'review_requested', to: 'under_review', review_request_id: requestId },
    });
  });
}

/** under_review -> approved | rejected | changes_requested (EA reviewer / ARB member). */
export async function recordDecision(
  actorId: string,
  patternId: string,
  decision: Decision,
  comments: string,
): Promise<void> {
  const trimmed = comments.trim();
  if (decision !== 'approved' && trimmed.length === 0) {
    throw new AppError('A comment is required when rejecting or requesting changes.');
  }

  await withTransaction(async (tx) => {
    const actor = await loadActor(tx, actorId);
    requireReviewer(actor);

    const pattern = await lockPattern(tx, patternId);
    if (pattern.status !== 'under_review') throw new AppError(staleMessage(pattern.status));
    const requestId = await lockOpenRequest(tx, pattern.id);

    const recorded = await tx.queryOne<{ id: string }>(
      `INSERT INTO patt_approval_decisions (appr_review_request_id, appr_decided_by, appr_decision, appr_comments)
       VALUES ($1, $2, $3, $4) RETURNING appr_approval_decision_id AS id`,
      [requestId, actor.id, decision, trimmed.length > 0 ? trimmed : null],
    );
    await tx.query(
      `UPDATE patt_review_requests SET revi_status = 'closed', revi_updated_at = now()
        WHERE revi_review_request_id = $1`,
      [requestId],
    );
    // The decision value doubles as the new status ('approved' | 'rejected' | 'changes_requested').
    await tx.query(
      `UPDATE patt_patterns SET patt_approval_status = $2, patt_updated_at = now()
        WHERE patt_pattern_id = $1`,
      [pattern.id, decision],
    );
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'pattern.decision_recorded',
      entityType: 'pattern',
      entityId: pattern.id,
      details: {
        from: 'under_review',
        to: decision,
        review_request_id: requestId,
        decision_id: recorded!.id,
      },
    });
  });
}

/**
 * review_requested | under_review -> approved | rejected | changes_requested, in one step.
 *
 * This is the fast path used by the Patterns list's inline row actions (Approve / Request
 * changes): a reviewer can decide directly from `review_requested` without visiting the pickup
 * step first. It still goes through both transitions for audit purposes — when starting from
 * `review_requested` it writes the same `pattern.review_picked_up` audit entry `pickUpReview`
 * would, so the history timeline reads identically either way — it just never persists the
 * intermediate `under_review` status on the pattern row, since the whole thing is one click.
 * `recordDecision` (used by the full decision panel) is unchanged and still requires the
 * explicit pickup step; this is an additive, separate entry point for the quick action.
 */
export async function quickDecision(
  actorId: string,
  patternId: string,
  decision: Decision,
  comments: string,
): Promise<void> {
  const trimmed = comments.trim();
  if (decision !== 'approved' && trimmed.length === 0) {
    throw new AppError('A comment is required when rejecting or requesting changes.');
  }

  await withTransaction(async (tx) => {
    const actor = await loadActor(tx, actorId);
    requireReviewer(actor);

    const pattern = await lockPattern(tx, patternId);
    if (pattern.status !== 'review_requested' && pattern.status !== 'under_review') {
      throw new AppError(staleMessage(pattern.status));
    }
    const requestId = await lockOpenRequest(tx, pattern.id);

    if (pattern.status === 'review_requested') {
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'pattern.review_picked_up',
        entityType: 'pattern',
        entityId: pattern.id,
        details: { from: 'review_requested', to: 'under_review', review_request_id: requestId },
      });
    }

    const recorded = await tx.queryOne<{ id: string }>(
      `INSERT INTO patt_approval_decisions (appr_review_request_id, appr_decided_by, appr_decision, appr_comments)
       VALUES ($1, $2, $3, $4) RETURNING appr_approval_decision_id AS id`,
      [requestId, actor.id, decision, trimmed.length > 0 ? trimmed : null],
    );
    await tx.query(
      `UPDATE patt_review_requests SET revi_status = 'closed', revi_updated_at = now()
        WHERE revi_review_request_id = $1`,
      [requestId],
    );
    await tx.query(
      `UPDATE patt_patterns SET patt_approval_status = $2, patt_updated_at = now()
        WHERE patt_pattern_id = $1`,
      [pattern.id, decision],
    );
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'pattern.decision_recorded',
      entityType: 'pattern',
      entityId: pattern.id,
      details: {
        from: pattern.status,
        to: decision,
        review_request_id: requestId,
        decision_id: recorded!.id,
      },
    });
  });
}
