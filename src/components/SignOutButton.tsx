'use client';

import { signOut } from 'next-auth/react';

// Icon markup copied from design/header-1b-reference.html (Lucide `log-out`) — inlined rather
// than adding the lucide-react package for a single icon.
export function SignOutButton() {
  return (
    <button type="button" className="hdr-signout" onClick={() => signOut({ callbackUrl: '/login' })}>
      Sign out
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
        <path d="M9 21H5V3h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  );
}
