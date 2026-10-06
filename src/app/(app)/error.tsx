'use client';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" role="alert">
      <h1>Something went wrong</h1>
      <p>The page could not be loaded. Nothing has been changed.</p>
      {error.digest && <p className="small muted">Reference: {error.digest}</p>}
      <button type="button" className="btn btn-secondary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
