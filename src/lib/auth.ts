import 'server-only';
import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { queryOne } from './db';
import { loginSchema } from './validation';
import { BCRYPT_COST } from './users';
import type { Role } from './constants';

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

// Compared against when the e-mail is unknown, so response time does not reveal which
// e-mail addresses exist.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash('not-a-real-password', BCRYPT_COST));

function logFailure(email: string, reason: string) {
  // Never log the password. E-mail + reason only, for security monitoring.
  console.warn(JSON.stringify({ event: 'auth.login_failed', email, reason, at: new Date().toISOString() }));
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'E-mail and password',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await queryOne<{
          id: string;
          email: string;
          displayName: string;
          role: Role;
          isActive: boolean;
          hash: string;
        }>(
          `SELECT user_id AS id, user_email AS email, user_display_name AS "displayName",
                  user_role AS role, user_is_active AS "isActive", user_password_hash AS hash
             FROM patt_users WHERE lower(user_email) = $1`,
          [email],
        );

        const passwordOk = await bcrypt.compare(password, user?.hash ?? (await getDummyHash()));
        if (!user || !passwordOk) {
          logFailure(email, 'bad_credentials');
          return null;
        }
        if (!user.isActive) {
          logFailure(email, 'inactive_account');
          return null;
        }
        return { id: user.id, email: user.email, name: user.displayName, role: user.role };
      },
    }),
  ],
  callbacks: {
    // The role in the token only drives coarse middleware gating. Pages and every mutation
    // re-read the user from the database (see session.ts), so a role change or
    // deactivation takes effect immediately.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
