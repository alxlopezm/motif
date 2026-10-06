import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { requiredRolesForPath } from '@/lib/permissions';

/**
 * Coarse gate: no session -> login; wrong role for /admin or /review-queue -> /forbidden.
 * This runs on the edge and only sees the JWT, so it is a first line of defence, not the
 * authority. Pages and server actions re-check against the database (lib/session.ts).
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname, search } = req.nextUrl;

  if (!token) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const required = requiredRolesForPath(pathname);
  if (required && !required.includes(token.role)) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/forbidden', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'],
};
