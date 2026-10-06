import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { REVIEWER_ROLES } from '@/lib/permissions';
import { getReviewQueue } from '@/lib/patterns';
import { CATEGORY_LABELS } from '@/lib/constants';
import { formatAge, formatDateTime } from '@/lib/format';
import { ActionForm } from '@/components/ActionForm';
import { StatusBadge } from '@/components/Badges';
import { pickUpAction } from '../patterns/[id]/actions';

export const metadata = { title: 'Review queue' };

export default async function ReviewQueuePage() {
  await requireRole(REVIEWER_ROLES);
  const items = await getReviewQueue();
  const now = new Date();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Review queue</h1>
          <p className="muted">Oldest requests first. {items.length} pattern{items.length === 1 ? '' : 's'} waiting.</p>
        </div>
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        {items.length === 0 ? (
          <p className="empty">Nothing is waiting for review.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Category</th>
                <th>Requested by</th>
                <th>Requested</th>
                <th>Waiting</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/patterns/${item.id}`}>{item.name}</Link>
                    <div className="small muted">Owner: {item.owner}</div>
                  </td>
                  <td>{CATEGORY_LABELS[item.category] ?? item.category}</td>
                  <td>{item.requestedByName ?? '—'}</td>
                  <td>{formatDateTime(item.waitingSince)}</td>
                  <td>{formatAge(item.waitingSince, now)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                    {item.status === 'under_review' && (
                      <div className="small muted">by {item.pickedUpByName ?? 'unknown'}</div>
                    )}
                  </td>
                  <td>
                    {item.status === 'review_requested' ? (
                      <ActionForm action={pickUpAction} submitLabel="Pick up" pendingLabel="Picking up…" small>
                        <input type="hidden" name="patternId" value={item.id} />
                      </ActionForm>
                    ) : (
                      <Link href={`/patterns/${item.id}`} className="btn btn-secondary btn-small">
                        Continue review
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
