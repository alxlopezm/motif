import 'server-only';
import type { Queryable } from './db';

export type AuditAction =
  | 'pattern.review_requested'
  | 'pattern.review_picked_up'
  | 'pattern.decision_recorded'
  | 'user.created'
  | 'user.role_changed'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.password_reset'
  | 'role.updated';

/**
 * Append an audit row inside the caller's transaction so the change and its attribution
 * commit (or roll back) together. `details` must never contain passwords or hashes.
 */
export async function writeAudit(
  tx: Queryable,
  entry: {
    actorId: string;
    action: AuditAction;
    entityType: 'pattern' | 'user' | 'role';
    entityId: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.query(
    `INSERT INTO patt_audit_log (audi_actor_id, audi_action, audi_entity_type, audi_entity_id, audi_details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [entry.actorId, entry.action, entry.entityType, entry.entityId, JSON.stringify(entry.details ?? {})],
  );
}
