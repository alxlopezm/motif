'use client';

import { useActionState, useState, useTransition, type FormEvent } from 'react';
import { COMMENT_MAX_LENGTH, DECISIONS, DECISION_LABELS, type Decision } from '@/lib/constants';
import type { ActionState } from '@/lib/action-state';

interface Props {
  patternId: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}

export function DecisionPanel({ patternId, action }: Props) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comments, setComments] = useState('');
  const [state, formAction] = useActionState(action, null);
  const [pending, startTransition] = useTransition();

  const commentRequired = decision !== null && decision !== 'approved';

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!decision) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <input type="hidden" name="patternId" value={patternId} />

      <fieldset className="decision-options">
        <legend>Decision</legend>
        {DECISIONS.map((d) => (
          <label key={d}>
            <input
              type="radio"
              name="decision"
              value={d}
              checked={decision === d}
              onChange={() => setDecision(d)}
            />
            {DECISION_LABELS[d]}
          </label>
        ))}
      </fieldset>
      {state?.fieldErrors?.decision && <p className="form-error">{state.fieldErrors.decision}</p>}

      <div className="field">
        <label htmlFor="comments">
          Comments {commentRequired ? '(required)' : '(optional)'}
        </label>
        <textarea
          id="comments"
          name="comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          maxLength={COMMENT_MAX_LENGTH}
          aria-required={commentRequired}
          aria-invalid={Boolean(state?.fieldErrors?.comments)}
        />
        {state?.fieldErrors?.comments && <span className="error">{state.fieldErrors.comments}</span>}
      </div>

      <button
        type="submit"
        className={`btn ${decision === 'rejected' ? 'btn-danger' : 'btn-primary'}`}
        disabled={pending || decision === null}
      >
        {pending ? 'Recording…' : decision ? `Record decision: ${DECISION_LABELS[decision]}` : 'Choose a decision'}
      </button>

      {state?.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="form-success">
          {state.message}
        </p>
      )}
    </form>
  );
}
