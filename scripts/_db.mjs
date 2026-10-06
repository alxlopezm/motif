// Shared connection helper for the CLI scripts. Mirrors the TLS handling in src/lib/db.ts.
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

export function sslConfig() {
  const mode = (process.env.DATABASE_SSL ?? 'require').toLowerCase();
  if (mode === 'disable') return false;
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  if (mode === 'require') {
    const ca = process.env.DATABASE_SSL_CA;
    return ca
      ? { ca: existsSync(ca) ? readFileSync(ca, 'utf8') : ca, rejectUnauthorized: true }
      : { rejectUnauthorized: true };
  }
  throw new Error(`Unsupported DATABASE_SSL value: ${mode}`);
}

export async function connect(rawUrl = process.env.DATABASE_URL) {
  if (!rawUrl) throw new Error('DATABASE_URL is not set (copy .env.example to .env.local)');
  const url = new URL(rawUrl);
  url.searchParams.delete('sslmode');
  const client = new pg.Client({ connectionString: url.toString(), ssl: sslConfig() });
  await client.connect();
  return { client, host: url.host, database: url.pathname.replace(/^\//, '') };
}

export function passwordFromEnv() {
  const pw = process.env.NEW_USER_PASSWORD;
  if (!pw || pw.length < 12 || Buffer.byteLength(pw, 'utf8') > 72) {
    throw new Error('Set NEW_USER_PASSWORD (12-72 bytes) in the environment for this run.');
  }
  return pw;
}
