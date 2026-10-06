import 'server-only';
import { readFileSync, existsSync } from 'node:fs';
import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from 'pg';

/**
 * All SQL in this app goes through `query` / `queryOne` / `withTransaction` with
 * positional parameters ($1, $2, ...). Values are never concatenated into SQL text.
 */

function buildConfig(): PoolConfig {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');

  // TLS is controlled by DATABASE_SSL, not by `sslmode=` in the URL (which pg would let
  // override our setting).
  const url = new URL(raw);
  url.searchParams.delete('sslmode');

  const mode = (process.env.DATABASE_SSL ?? 'require').toLowerCase();
  let ssl: PoolConfig['ssl'];
  if (mode === 'disable') {
    ssl = false;
  } else if (mode === 'no-verify') {
    ssl = { rejectUnauthorized: false };
  } else if (mode === 'require') {
    const ca = process.env.DATABASE_SSL_CA;
    if (ca) {
      ssl = { ca: existsSync(ca) ? readFileSync(ca, 'utf8') : ca, rejectUnauthorized: true };
    } else {
      ssl = { rejectUnauthorized: true };
    }
  } else {
    throw new Error(`Unsupported DATABASE_SSL value: ${mode}`);
  }

  return {
    connectionString: url.toString(),
    ssl,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    idle_in_transaction_session_timeout: 30_000,
  };
}

const globalForPool = globalThis as unknown as { __pattPool?: Pool };

function getPool(): Pool {
  if (!globalForPool.__pattPool) {
    const pool = new Pool(buildConfig());
    pool.on('error', (err) => console.error('pg pool error', err.message));
    globalForPool.__pattPool = pool;
  }
  return globalForPool.__pattPool;
}

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]): Promise<T[]>;
  queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]): Promise<T | null>;
}

function wrap(runner: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable {
  async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const result = await runner.query(text, [...params]);
    return result.rows as T[];
  }
  async function queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<T | null> {
    const rows = await query<T>(text, params);
    return rows[0] ?? null;
  }
  return { query, queryOne };
}

export const db: Queryable = wrap({ query: (text, params) => getPool().query(text, params) });

export const query = db.query;
export const queryOne = db.queryOne;

export async function withTransaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(wrap(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // connection is likely gone; original error is what matters
    }
    throw err;
  } finally {
    client.release();
  }
}
