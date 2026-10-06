'use client';

import { useActionState, useState, useTransition, type FormEvent } from 'react';
import type { ActionState } from '@/lib/action-state';

type QuickAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** One-click row action with no extra input (Approve, Request review). */
export function QuickButton({
  patternId,
  action,
  label,
  pendingLabel,
  variant = 'primary',
  confirmMessage,
}: {
  patternId: string;
  action: QuickAction;
  label: string;
  pendingLabel: string;
  variant?: 'primary' | 'outline-danger';
  confirmMessage?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="quick-action">
      <input type="hidden" name="patternId" value={patternId} />
      <button type="submit" className={`btn btn-small btn-${variant}`} disabled={pending}>
        {pending ? pendingLabel : label}
      </button>
      {state?.error && (
        <p role="alert" className="form-error small">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** "Request changes" needs a mandatory comment, so it expands an inline form in place. */
export function QuickChangesButton({ patternId, action }: { patternId: string; action: QuickAction }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn btn-small btn-outline-danger" onClick={() => setOpen(true)}>
        Changes
      </button>
    );
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="quick-changes">
      <input type="hidden" name="patternId" value={patternId} />
      <textarea
        name="comments"
        required
        rows={2}
        placeholder="Reason for requesting changes…"
        autoFocus
        aria-invalid={Boolean(state?.fieldErrors?.comments)}
      />
      <div className="quick-changes-buttons">
        <button type="submit" className="btn btn-small btn-outline-danger" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit'}
        </button>
        <button type="button" className="btn btn-small btn-secondary" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="form-error small">
          {state.error}
        </p>
      )}
    </form>
  );
}
