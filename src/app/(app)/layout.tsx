import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { roleLabels } from '@/lib/roles';
import { getReviewQueue } from '@/lib/patterns';
import { initialsOf } from '@/lib/format';
import { archivo } from '@/lib/fonts';
import { canManageUsers, isReviewer } from '@/lib/permissions';
import { HeaderNav, type HeaderNavItem } from '@/components/HeaderNav';
import { SignOutButton } from '@/components/SignOutButton';

// Redesigned per design/README.md ("Handoff: Pattern Review — App Header (Option 1b 'Paper')").
// Routes in that spec (/users, /roles) are illustrative — this app's actual admin routes are
// /admin/users and /admin/roles, and link visibility stays driven by the existing role checks
// below (the static mockup shows all 4 links unconditionally; this app's real authorization
// rules decide who actually sees Review queue / Users / Roles, unchanged from before).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const reviewing = isReviewer(user.role);
  const [labels, pendingReviewCount] = await Promise.all([
    roleLabels(),
    reviewing ? getReviewQueue().then((q) => q.length) : Promise.resolve(0),
  ]);

  const navItems: HeaderNavItem[] = [{ href: '/patterns', label: 'Patterns' }];
  if (reviewing) navItems.push({ href: '/review-queue', label: 'Review queue', count: pendingReviewCount });
  if (canManageUsers(user.role)) {
    navItems.push(
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/roles', label: 'Roles' },
      { href: '/admin/patterns/new', label: 'Upload pattern' },
    );
  }

  return (
    <>
      <header className={`hdr ${archivo.className}`}>
        <Link className="hdr-brand" href="/patterns">
          <span className="hdr-brand-mark" aria-hidden="true" />
          <span className="hdr-brand-text">
            <span className="hdr-kicker">Architecture</span>
            <span className="hdr-title">Pattern Review</span>
          </span>
        </Link>

        <HeaderNav items={navItems} />

        <div className="hdr-user">
          <div className="hdr-user-text">
            <span className="hdr-user-name">{user.displayName}</span>
            <span className="hdr-user-role">{labels[user.role]}</span>
          </div>
          <div className="hdr-avatar" aria-hidden="true">
            {initialsOf(user.displayName)}
          </div>
        </div>

        <SignOutButton />
      </header>
      <main className="container">{children}</main>
    </>
  );
}
