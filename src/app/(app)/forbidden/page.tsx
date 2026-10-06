import Link from 'next/link';

export const metadata = { title: 'Access denied' };

export default function ForbiddenPage() {
  return (
    <div className="card">
      <h1>Access denied</h1>
      <p>Your role does not permit access to that page.</p>
      <Link href="/patterns" className="btn btn-secondary">
        Back to patterns
      </Link>
    </div>
  );
}
