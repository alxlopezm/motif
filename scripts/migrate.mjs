// Applies db/schema.sql (idempotent). Usage: npm run db:migrate
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connect } from './_db.mjs';

const sql = readFileSync(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8');
const { client, host, database } = await connect(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL);

try {
  console.log(`Applying db/schema.sql to ${database} on ${host} ...`);
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Schema is up to date.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migration failed and was rolled back:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
