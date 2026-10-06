'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await signIn('credentials', {
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        redirect: false,
      });
      if (result?.ok && !result.error) {
        // Full navigation so the server picks up the new session cookie.
        window.location.assign(callbackUrl);
        return;
      }
      setError('Invalid e-mail or password, or the account is inactive.');
    } catch {
      setError('Sign-in is temporarily unavailable. Please try again.');
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
