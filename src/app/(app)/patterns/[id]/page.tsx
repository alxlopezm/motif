import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getAttributes, getHistory, getPattern } from '@/lib/patterns';
import { uuidSchema } from '@/lib/validation';
import {
  CATEGORY_LABELS,
  DECISION_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  type Decision,
} from '@/lib/constants';
import { canDecide, canPickUp, canRequestReview, canViewHistory } from '@/lib/permissions';
import { formatDateTime, safeExternalUrl } from '@/lib/format';
import { ActionForm } from '@/components/ActionForm';
import { PatternContent } from '@/components/content/PatternContent';
import { StatusBadge } from '@/components/Badges';
import { Tabs, type TabDef } from '@/components/Tabs';
import { pickUpAction, recordDecisionAction, requestReviewAction } from './actions';
import { DecisionPanel } from './DecisionPanel';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return { title: 'Pattern' };
}

export default async function PatternDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  // Returns null for "does not exist" and "you may not see it" alike.
  const pattern = await getPattern(user, id);
  if (!pattern) notFound();

  const access = { owner: pattern.owner, status: pattern.status };
  const showHistory = canViewHistory(user, access);
  const [attributes, history] = await Promise.all([
    getAttributes(pattern.id),
    showHistory ? getHistory(pattern.id) : Promise.resolve([]),
  ]);

  const sourceUrl = safeExternalUrl(pattern.sourceUrl);
  const sourceName = SOURCE_LABELS[pattern.sourceSystem] ?? pattern.sourceSystem;
  const inferred = attributes.filter((a) => a.method === 'inferred_from_text').length;
  const missing = attributes.filter((a) => a.method === 'missing').length;
  const missingRequired = attributes.filter((a) => a.method === 'missing' && a.isRequired).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{pattern.name}</h1>
          <StatusBadge status={pattern.status} />
        </div>
      </div>

      <div className="source-link">
        <p>
          This page shows the federated summary only. The full pattern document lives in {sourceName}.
        </p>
        {sourceUrl ? (
          <a className="btn" href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Open in {sourceName} ↗
          </a>
        ) : (
          <span className="badge method-missing">Source link unavailable</span>
        )}
      </div>

      <section className="card" aria-label="Pattern details">
        <dl className="meta">
          <div>
            <dt>Category</dt>
            <dd>{CATEGORY_LABELS[pattern.category] ?? pattern.category}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{pattern.owner}</dd>
          </div>
          <div>
            <dt>Source system</dt>
            <dd>{sourceName}</dd>
          </div>
          <div>
            <dt>Source last modified</dt>
            <dd>{formatDateTime(pattern.sourceLastModified)}</dd>
          </div>
          <div>
            <dt>Last synced</dt>
            <dd>{formatDateTime(pattern.lastSyncedAt)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{STATUS_LABELS[pattern.status]}</dd>
          </div>
        </dl>
      </section>

      {canRequestReview(user, access) && (
        <section className="card" aria-label="Request review">
          <h2>Request review</h2>
          <p>
            {pattern.status === 'changes_requested'
              ? 'Reviewers asked for changes. Once you have updated the source document and it has re-synced, request a new review.'
              : 'Submit this pattern to the EA reviewers for review.'}
          </p>
          <ActionForm
            action={requestReviewAction}
            submitLabel="Request review"
            pendingLabel="Requesting…"
            confirmMessage="Submit this pattern for review?"
          >
            <input type="hidden" name="patternId" value={pattern.id} />
          </ActionForm>
        </section>
      )}

      {canPickUp(user, access) && (
        <section className="card" aria-label="Pick up review">
          <h2>Review requested</h2>
          <p>Pick this request up to start reviewing. It will be recorded against your account.</p>
          <ActionForm action={pickUpAction} submitLabel="Pick up for review" pendingLabel="Picking up…">
            <input type="hidden" name="patternId" value={pattern.id} />
          </ActionForm>
        </section>
      )}

      {canDecide(user, access) && (
        <section className="card" aria-label="Decision panel">
          <h2>Record decision</h2>
          <p className="muted">
            Approving publishes this pattern as enterprise knowledge. Rejection is final for this pattern.
            Your name and the time are recorded with the decision.
          </p>
          <DecisionPanel patternId={pattern.id} action={recordDecisionAction} />
        </section>
      )}

      <section className="card" aria-label="Pattern content" style={{ padding: 0 }}>
        <Tabs
          tabs={[
            {
              id: 'source-content',
              label: 'Source content',
              content: (
                <>
                  {(inferred > 0 || missing > 0) && (
                    <div className="callout" role="note">
                      {inferred > 0 && (
                        <>
                          <strong>{inferred}</strong> attribute{inferred === 1 ? ' was' : 's were'} inferred by AI
                          from the source text and should be verified.{' '}
                        </>
                      )}
                      {missing > 0 && (
                        <>
                          <strong>{missing}</strong> attribute{missing === 1 ? ' is' : 's are'} missing
                          {missingRequired > 0 && (
                            <>
                              {' '}
                              (<strong>{missingRequired}</strong> required)
                            </>
                          )}
                          .
                        </>
                      )}
                    </div>
                  )}

                  {attributes.length === 0 ? (
                    <p className="muted">No attribute types are configured.</p>
                  ) : (
                    <PatternContent attributes={attributes} sourceSystem={pattern.sourceSystem} />
                  )}
                </>
              ),
            },
            {
              id: 'images',
              label: 'Images',
              content: (
                <p className="muted">
                  Image support isn&rsquo;t built yet — this pattern&rsquo;s images from {sourceName} aren&rsquo;t
                  synced into the app. See the {sourceName} page directly for now.
                </p>
              ),
            },
          ] satisfies TabDef[]}
        />
      </section>

      {showHistory && (
        <section className="card" aria-label="Review history">
          <h2>Review history</h2>
          {history.length === 0 ? (
            <p className="muted">No review has been requested for this pattern yet.</p>
          ) : (
            <ol className="timeline">
              {history.map((h) => (
                <li key={h.requestId}>
                  <strong>
                    Review requested by {h.requestedByName}{' '}
                    <span className="muted small">({h.requestedByEmail})</span>
                  </strong>{' '}
                  <span className="muted small">{formatDateTime(h.requestedAt)}</span>
                  <ul className="events">
                    {h.pickedUpAt && (
                      <li>
                        Picked up by <strong>{h.pickedUpByName ?? 'unknown'}</strong>{' '}
                        <span className="muted small">{formatDateTime(h.pickedUpAt)}</span>
                      </li>
                    )}
                    {h.decision ? (
                      <li>
                        <span className={`badge status-${h.decision}`}>
                          {DECISION_LABELS[h.decision as Decision]}
                        </span>{' '}
                        by <strong>{h.decidedByName ?? 'unknown'}</strong>{' '}
                        <span className="muted small">{formatDateTime(h.decidedAt)}</span>
                        {h.comments && <blockquote>{h.comments}</blockquote>}
                      </li>
                    ) : (
                      <li className="muted">
                        {h.requestStatus === 'open' ? 'Awaiting decision.' : 'Closed without a recorded decision.'}
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </>
  );
}
