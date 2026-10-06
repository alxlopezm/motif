// Creates the FIRST arb_member so someone can sign in and use the Users screen.
// Refuses to run if any user already exists.
//
//   NEW_USER_PASSWORD='...' npm run user:bootstrap -- --email jane@acme.com --name "Jane Doe"
import os from 'node:os';
import bcrypt from 'bcryptjs';
import { connect, passwordFromEnv } from './_db.mjs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = arg('email')?.trim().toLowerCase();
const name = arg('name')?.trim();
if (!email || !email.includes('@') || !name) {
  console.error('Usage: npm run user:bootstrap -- --email <email> --name "<display name>"');
  process.exit(1);
}
const hash = await bcrypt.hash(passwordFromEnv(), 12);

const { client, host, database } = await connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query('SELECT count(*)::int AS n FROM patt_users');
  if (rows[0].n > 0) {
    throw new Error('Users already exist. Sign in as an ARB member and use the Users screen instead.');
  }
  const created = await client.query(
    `INSERT INTO patt_users (user_email, user_display_name, user_password_hash, user_role)
     VALUES ($1, $2, $3, 'arb_member') RETURNING user_id`,
    [email, name, hash],
  );
  const id = created.rows[0].user_id;
  // The first user has no earlier actor, so the audit row is self-referential and records the
  // operating-system account that ran the script.
  await client.query(
    `INSERT INTO patt_audit_log (audi_actor_id, audi_action, audi_entity_type, audi_entity_id, audi_details)
     VALUES ($1, 'user.created', 'user', $1, $2::jsonb)`,
    [id, JSON.stringify({ email, role: 'arb_member', via: 'bootstrap-admin script', operator: os.userInfo().username })],
  );
  await client.query('COMMIT');
  console.log(`Created ARB member ${email} in ${database} on ${host}.`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
