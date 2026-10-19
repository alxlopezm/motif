// One-off: resets the password for a fixed list of existing accounts, each to a freshly
// generated random password, mirroring the admin "reset password" action's own logic
// (src/lib/users.ts resetUserPassword): bcrypt cost 12, acted on by an existing active
// arb_member, with a user.password_reset audit row — same shape as every other admin
// mutation in this app, just run as a script instead of clicked through the UI.
//
//   node --env-file=.env.local scripts/reset-passwords-oneoff.mjs

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { connect } from './_db.mjs';

const ACTOR_EMAIL = 'alejandro-fidel.lopez@takeda.com';
const TARGET_EMAILS = ['alxlopezm@gmail.com', 'sundar.krishnadas@takeda.com', 'vera.viewer@example.com'];

function randomPassword(length = 16) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

const { client, host, database } = await connect();
console.log(`Target: database "${database}" on ${host}`);

try {
  await client.query('BEGIN');

  const actor = (
    await client.query(
      `SELECT user_id, user_role, user_is_active FROM patt_users WHERE user_email = $1`,
      [ACTOR_EMAIL],
    )
  ).rows[0];
  if (!actor || actor.user_role !== 'arb_member' || !actor.user_is_active) {
    throw new Error(`Actor ${ACTOR_EMAIL} must be an existing, active arb_member.`);
  }

  const results = [];
  for (const email of TARGET_EMAILS) {
    const target = (await client.query(`SELECT user_id FROM patt_users WHERE user_email = $1`, [email])).rows[0];
    if (!target) throw new Error(`No user found with email ${email}.`);

    const password = randomPassword();
    const hash = await bcrypt.hash(password, 12);

    await client.query(
      `UPDATE patt_users SET user_password_hash = $2, user_updated_at = now() WHERE user_id = $1`,
      [target.user_id, hash],
    );
    await client.query(
      `INSERT INTO patt_audit_log (audi_actor_id, audi_action, audi_entity_type, audi_entity_id, audi_details)
       VALUES ($1, 'user.password_reset', 'user', $2, $3::jsonb)`,
      [actor.user_id, target.user_id, JSON.stringify({ email, via: 'reset-passwords-oneoff script' })],
    );
    results.push({ email, password });
  }

  await client.query('COMMIT');
  console.log('Passwords reset:');
  for (const r of results) console.log(`  ${r.email} -> ${r.password}`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Failed and rolled back:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
