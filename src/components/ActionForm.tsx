'use client';

import { useActionState, useEffect, useRef, useTransition, type FormEvent, type ReactNode } from 'react';
import type { ActionState } from '@/lib/action-state';

interface Props {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
  className?: string;
  /** Clear the inputs after a successful submit (e.g. "create user"). */
  resetOnSuccess?: boolean;
  /** Ask the browser to confirm before submitting (destructive / irreversible actions). */
  confirmMessage?: string;
  children?: ReactNode;
}

/**
 * Generic wrapper around a server action. It submits from onSubmit inside a transition (rather
 * than <form action>) so React does not wipe the user's inputs when the action returns an error.
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = 'Working…',
  variant = 'primary',
  small,
  className,
  resetOnSuccess,
  confirmMessage,
  children,
}: Props) {
  const [state, formAction] = useActionState(action, null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={className}>
      {children}
      <button type="submit" disabled={pending} className={`btn btn-${variant}${small ? ' btn-small' : ''}`}>
        {pending ? pendingLabel : submitLabel}
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
