// One-off: records a real MP4 of the "Asynchronous Messaging" pattern moving from 'authored'
// to 'approved' through the actual running app (not a mock) — owner requests review, a
// reviewer picks it up, then records the Approve decision. Requires the dev server already
// running at http://localhost:3001 (see package.json "dev"). This is a demo/recording
// utility, not part of the app itself.
//
//   node --env-file=.env.local scripts/record-demo-workflow.mjs

import crypto from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { chromium } from 'playwright';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connect } from './_db.mjs';

const execFileAsync = promisify(execFile);

const BASE_URL = 'http://localhost:3001';
const PATTERN_ID = '253a7735-f7a2-4133-a3b7-da6c0ac00a72'; // Asynchronous Messaging
const OWNER_EMAIL = 'sundar.krishnadas@takeda.com';
const REVIEWER_EMAIL = 'rita.reviewer@example.com';
const REVIEWER_PASSWORD = 'JqrJm7CBt5zDhz1D';
const OUTPUT_PATH = path.resolve('demo/asynchronous-messaging-authored-to-approved.mp4');

function randomPassword(length = 16) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

async function resetOwnerPassword() {
  const { client } = await connect();
  try {
    const owner = await client.query(`SELECT user_id FROM patt_users WHERE user_email = $1`, [OWNER_EMAIL]);
    if (!owner.rows[0]) throw new Error(`No user found with email ${OWNER_EMAIL}`);
    const password = randomPassword();
    const hash = await bcrypt.hash(password, 12);
    await client.query(`UPDATE patt_users SET user_password_hash = $2, user_updated_at = now() WHERE user_id = $1`, [
      owner.rows[0].user_id,
      hash,
    ]);
    console.log(`Reset ${OWNER_EMAIL}'s password for this recording.`);
    return password;
  } finally {
    await client.end();
  }
}

async function main() {
  const ownerPassword = await resetOwnerPassword();

  const videoDir = await mkdtemp(path.join(tmpdir(), 'pattern-demo-'));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  // Dev-mode cold compile of a route can take >30s (observed ~34s for /patterns/[id]) —
  // default Playwright navigation timeout is 30s, so this heads that off for every goto().
  page.setDefaultNavigationTimeout(90000);

  async function login(email, password) {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(`${BASE_URL}/patterns`, { timeout: 15000 });
    await page.waitForTimeout(800);
  }

  async function signOut() {
    await page.getByRole('button', { name: 'Sign out' }).click();
    // NextAuth's signOut() redirects using its own configured base URL, which may not match
    // BASE_URL if that differs from NEXTAUTH_URL (observed: redirected to :3000 while the app
    // actually runs on :3001) — wait for the login form itself rather than an exact URL.
    await page.getByLabel('E-mail').waitFor({ timeout: 15000 });
    if (!page.url().startsWith(BASE_URL)) await page.goto(`${BASE_URL}/login`);
    await page.waitForTimeout(500);
  }

  // Burned-in caption banner: a DOM overlay, so it's part of the actual recorded frames. Any
  // full navigation (goto / the full-page redirect NextAuth's sign-in and sign-out both do)
  // wipes the DOM, so this re-creates the element every call rather than assuming it persists.
  async function caption(text) {
    await page.evaluate((t) => {
      let el = document.getElementById('__demo_caption__');
      if (!el) {
        el = document.createElement('div');
        el.id = '__demo_caption__';
        Object.assign(el.style, {
          position: 'fixed',
          left: '0',
          right: '0',
          bottom: '0',
          zIndex: '2147483647',
          background: 'rgba(17, 17, 17, 0.9)',
          color: '#fff',
          font: '600 20px system-ui, -apple-system, sans-serif',
          padding: '18px 28px',
          textAlign: 'center',
          lineHeight: '1.4',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
        });
        document.body.appendChild(el);
      }
      el.textContent = t;
    }, text);
  }

  try {
    console.log('--- Scene 1: owner requests review ---');
    await login(OWNER_EMAIL, ownerPassword);
    await caption('Step 1 — Pattern owner (Sundar Krishnadas) signs in');
    await page.waitForTimeout(1200);

    await page.goto(`${BASE_URL}/patterns/${PATTERN_ID}`);
    await page.getByText('Authored', { exact: true }).waitFor({ timeout: 15000 });
    await caption('Pattern "Asynchronous Messaging" — current status: Authored');
    await page.waitForTimeout(2000);

    await caption('Step 2 — Owner clicks "Request review"');
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Request review' }).click();
    await page.getByText('Review requested', { exact: true }).first().waitFor({ timeout: 15000 });
    await caption('Status updated: Authored → Review requested');
    await page.waitForTimeout(2200);

    await caption('Owner signs out');
    await page.waitForTimeout(800);
    await signOut();

    console.log('--- Scene 2: reviewer picks up ---');
    await login(REVIEWER_EMAIL, REVIEWER_PASSWORD);
    await caption('Step 3 — EA reviewer (Rita Reviewer) signs in');
    await page.waitForTimeout(1200);

    await page.goto(`${BASE_URL}/patterns/${PATTERN_ID}`);
    await page.getByText('Review requested', { exact: true }).first().waitFor({ timeout: 15000 });
    await caption('Step 4 — Reviewer clicks "Pick up for review"');
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'Pick up for review' }).click();
    await page.getByText('Under review', { exact: true }).first().waitFor({ timeout: 15000 });
    await caption('Status updated: Review requested → Under review');
    await page.waitForTimeout(2200);

    console.log('--- Scene 3: reviewer approves ---');
    await caption('Step 5 — Reviewer selects "Approve" and records the decision');
    await page.waitForTimeout(1200);
    await page.getByLabel('Approve').check();
    await page.getByRole('button', { name: 'Record decision: Approve' }).click();
    await page.getByText('Approved', { exact: false }).first().waitFor({ timeout: 15000 });
    await caption('Status updated: Under review → Approved — workflow complete');
    await page.waitForTimeout(3000);
  } finally {
    await context.close();
    await browser.close();
  }

  const files = await readdir(videoDir);
  const webm = files.find((f) => f.endsWith('.webm'));
  if (!webm) throw new Error(`No .webm recording found in ${videoDir}`);
  const webmPath = path.join(videoDir, webm);

  console.log('--- Transcoding to mp4 ---');
  await execFileAsync(ffmpegPath.path, ['-y', '-i', webmPath, '-pix_fmt', 'yuv420p', OUTPUT_PATH]);
  console.log(`Wrote ${OUTPUT_PATH}`);

  await rm(videoDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error('Recording failed:', err);
  process.exitCode = 1;
});
