import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card">
      <h1>Not found</h1>
      <p>That pattern does not exist, or you do not have access to it.</p>
      <Link href="/patterns" className="btn btn-secondary">
        Back to patterns
      </Link>
    </div>
  );
}
