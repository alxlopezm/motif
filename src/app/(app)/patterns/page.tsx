import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { getPatternStats, listPatterns, parseListFilters, SORT_LABELS, SORT_OPTIONS, type PatternSummary } from '@/lib/patterns';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  type PatternStatus,
} from '@/lib/constants';
import { canRequestReview, isReviewer, visibleStatuses, type Actor } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/Badges';
import { StatCards } from '@/components/StatCards';
import { AutoSubmitSelect } from '@/components/AutoSubmitSelect';
import { QuickButton, QuickChangesButton } from '@/components/QuickActions';
import { quickApproveAction, quickChangesAction } from './actions';
import { requestReviewAction } from './[id]/actions';

export const metadata = { title: 'Patterns' };

export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const filters = parseListFilters(await searchParams, user);
  const [{ rows, total, pageSize }, stats] = await Promise.all([
    listPatterns(user, filters),
    getPatternStats(user),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = () => {
    const qs = new URLSearchParams();
    if (filters.q) qs.set('q', filters.q);
    if (filters.category) qs.set('category', filters.category);
    if (filters.sort !== 'updated_desc') qs.set('sort', filters.sort);
    return qs;
  };
  const pageHref = (page: number) => {
    const qs = baseParams();
    if (filters.status) qs.set('status', filters.status);
    if (page > 1) qs.set('page', String(page));
    const s = qs.toString();
    return s ? `/patterns?${s}` : '/patterns';
  };
  const tabHref = (status: PatternStatus | '') => {
    const qs = baseParams();
    if (status) qs.set('status', status);
    const s = qs.toString();
    return s ? `/patterns?${s}` : '/patterns';
  };

  const statuses: readonly PatternStatus[] = visibleStatuses(user);
  const showAllTabs = statuses.length > 1;
  const primaryTabs: PatternStatus[] = (['review_requested', 'draft', 'approved'] as PatternStatus[]).filter((s) =>
    statuses.includes(s),
  );
  const extraTabs = statuses.filter((s) => !primaryTabs.includes(s));
  const hasFilters = Boolean(filters.q || filters.category || filters.status || filters.sort !== 'updated_desc');

  const reviewing = isReviewer(user.role);
  const awaitingCount = stats.byStatus.review_requested + stats.byStatus.under_review;
  const awaitingLabel = reviewing ? 'AWAITING REVIEW' : 'IN REVIEW';
  const awaitingSub = reviewing ? 'assigned to you' : user.role === 'pattern_owner' ? 'your patterns' : 'in progress';
  const draftsSub = reviewing ? 'not submitted' : 'not submitted';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Patterns</h1>
          <p className="muted">
            {user.role === 'viewer' && 'Showing approved patterns.'}
            {user.role === 'pattern_owner' && 'Showing approved patterns and the patterns you own.'}
            {reviewing && 'Showing all patterns.'}
          </p>
        </div>
      </div>

      <StatCards
        stats={[
          { label: 'TOTAL PATTERNS', value: stats.total, sub: 'in registry' },
          { label: awaitingLabel, value: awaitingCount, sub: awaitingSub },
          { label: 'APPROVED', value: stats.byStatus.approved, sub: 'published' },
          { label: 'DRAFTS', value: stats.byStatus.draft, sub: draftsSub },
        ]}
      />

      <div className="controls-row">
        <form method="get" className="controls-form" role="search">
          <input type="hidden" name="status" value={filters.status} />

          <div className="search-box">
            <svg aria-hidden viewBox="0 0 20 20" width="16" height="16">
              <circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <line x1="14" y1="14" x2="18.5" y2="18.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <label htmlFor="q" className="sr-only">
              Search patterns, owners, sources
            </label>
            <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Search patterns, owners, sources" />
          </div>

          {showAllTabs && (
            <div className="status-tabs" role="tablist" aria-label="Filter by status">
              <Link href={tabHref('')} className={`status-tab${filters.status === '' ? ' active' : ''}`}>
                ALL <span className="status-tab-count">{stats.total}</span>
              </Link>
              {primaryTabs.map((s) => (
                <Link key={s} href={tabHref(s)} className={`status-tab${filters.status === s ? ' active' : ''}`}>
                  {STATUS_LABELS[s].toUpperCase()} <span className="status-tab-count">{stats.byStatus[s]}</span>
                </Link>
              ))}
              {extraTabs.map((s) => (
                <Link key={s} href={tabHref(s)} className={`status-tab${filters.status === s ? ' active' : ''}`}>
                  {STATUS_LABELS[s].toUpperCase()} <span className="status-tab-count">{stats.byStatus[s]}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="controls-right">
            <label htmlFor="category" className="sr-only">
              Category
            </label>
            <AutoSubmitSelect id="category" name="category" defaultValue={filters.category}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </AutoSubmitSelect>

            <span className="sort-label">SORT</span>
            <AutoSubmitSelect id="sort" name="sort" defaultValue={filters.sort} aria-label="Sort">
              {SORT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </AutoSubmitSelect>
          </div>
        </form>
        {hasFilters && (
          <Link href="/patterns" className="btn btn-secondary btn-small">
            Clear filters
          </Link>
        )}
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <p className="empty">No patterns match.</p>
        ) : (
          <table className="patterns-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input type="checkbox" disabled title="Bulk actions are not available yet" aria-label="Select all" />
                </th>
                <th>Pattern</th>
                <th>Owner</th>
                <th>Source</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="col-check">
                    <input type="checkbox" disabled title="Bulk actions are not available yet" aria-label={`Select ${p.name}`} />
                  </td>
                  <td>
                    <div className="pattern-name-row">
                      <Link href={`/patterns/${p.id}`} className="pattern-name">
                        {p.name}
                      </Link>
                      <span className="pattern-category">{CATEGORY_LABELS[p.category] ?? p.category}</span>
                    </div>
                    {p.summary && <p className="pattern-desc">{p.summary}</p>}
                  </td>
                  <td>{p.owner}</td>
                  <td>
                    <span className="source-cell">
                      <span className="bullet" aria-hidden />
                      {SOURCE_LABELS[p.sourceSystem] ?? p.sourceSystem}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>{formatDate(p.updatedAt)}</td>
                  <td>
                    <ReviewCell actor={user} pattern={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination small">
        <span className="muted">
          {total} pattern{total === 1 ? '' : 's'} · page {Math.min(filters.page, lastPage)} of {lastPage}
        </span>
        {filters.page > 1 && <Link href={pageHref(filters.page - 1)}>← Previous</Link>}
        {filters.page < lastPage && <Link href={pageHref(filters.page + 1)}>Next →</Link>}
      </div>
    </>
  );
}

/** Contents of the "Review" column: quick actions when the viewer can act, else a status note. */
function ReviewCell({ actor, pattern }: { actor: Actor; pattern: PatternSummary }) {
  const reviewerActionable = isReviewer(actor.role) && (pattern.status === 'review_requested' || pattern.status === 'under_review');
  const ownerActionable = canRequestReview(actor, pattern);

  if (reviewerActionable) {
    return (
      <div className="review-actions">
        <QuickButton patternId={pattern.id} action={quickApproveAction} label="Approve" pendingLabel="Approving…" />
        <QuickChangesButton patternId={pattern.id} action={quickChangesAction} />
      </div>
    );
  }

  if (ownerActionable) {
    return (
      <QuickButton
        patternId={pattern.id}
        action={requestReviewAction}
        label="Request review"
        pendingLabel="Requesting…"
        confirmMessage={pattern.status === 'changes_requested' ? undefined : 'Submit this pattern for review?'}
      />
    );
  }

  const text: Record<PatternStatus, string> = {
    draft: 'Awaiting submission',
    review_requested: 'Awaiting reviewer',
    under_review: 'Awaiting reviewer',
    approved: 'Approved · no action',
    rejected: 'Rejected · no action',
    changes_requested: 'Changes requested · with owner',
  };
  return <span className="review-note muted">{text[pattern.status]}</span>;
}
