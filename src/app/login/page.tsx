import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in' };

/** Only same-site relative paths are accepted as post-login destinations. */
function safeCallback(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return value;
  return '/patterns';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const callbackUrl = safeCallback(sp.callbackUrl);
  if (await getCurrentUser()) redirect(callbackUrl);

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Pattern Review</h1>
        <p className="tagline">AI assists. Humans govern. Approved patterns become enterprise knowledge.</p>
        <LoginForm callbackUrl={callbackUrl} />
        <p className="small muted" style={{ marginTop: '1rem', marginBottom: 0 }}>
          Access is provisioned by the Architecture Review Board.
        </p>
      </div>
    </div>
  );
}
