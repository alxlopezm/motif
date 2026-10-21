// DEV ONLY: inserts one user per role plus a few sample patterns in different workflow states so
// every screen has something to show. It writes fake data into whatever DATABASE_URL points at,
// so it insists on an explicit --confirm-dev flag and prints the target first.
//
//   NEW_USER_PASSWORD='...' npm run db:seed -- --confirm-dev
import bcrypt from 'bcryptjs';
import { connect, passwordFromEnv } from './_db.mjs';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed with NODE_ENV=production.');
  process.exit(1);
}

const password = passwordFromEnv();
const { client, host, database } = await connect();
console.log(`Target: database "${database}" on ${host}`);
if (!process.argv.includes('--confirm-dev')) {
  console.error('Add --confirm-dev to confirm this is a development database.');
  await client.end();
  process.exit(1);
}

const USERS = [
  ['alice.owner@example.com', 'Alice Owner', 'pattern_owner'],
  ['rita.reviewer@example.com', 'Rita Reviewer', 'ea_reviewer'],
  ['arthur.arb@example.com', 'Arthur ARB', 'arb_member'],
  ['vera.viewer@example.com', 'Vera Viewer', 'viewer'],
];

const ATTRIBUTE_TYPES = [
  ['summary', 'Summary', 'One-paragraph description of the pattern', 10, true],
  ['problem', 'Problem statement', 'The problem the pattern solves', 20, true],
  ['solution', 'Solution overview', 'How the pattern solves it', 30, true],
  ['technology_stack', 'Technology stack', 'Key technologies', 40, false],
  ['benefits', 'Benefits', 'Expected benefits', 50, false],
  ['constraints', 'Constraints & trade-offs', 'Known limitations', 60, false],
  ['security', 'Security considerations', 'Security controls and concerns', 70, true],
];

// [name, category, owner, source, status]
const PATTERNS = [
  ['Event-Driven Data Ingestion', 'data_ingestion', 'alice.owner@example.com', 'confluence', 'authored'],
  ['Secure Web App Baseline', 'web_application', 'Alice Owner', 'sharepoint', 'authored'],
  ['API-Led Data Integration', 'data_integration', 'bob.other@example.com', 'confluence', 'authored'],
  ['Serverless Cloud Application', 'cloud_application', 'alice.owner@example.com', 'confluence', 'review_requested'],
  ['Managed Batch Ingestion', 'data_ingestion', 'alice.owner@example.com', 'sharepoint', 'approved'],
  // Demo patterns for the source-mimicking content renderers (see AttributeContent):
  ['Circuit Breaker for Downstream Calls', 'cloud_application', 'alice.owner@example.com', 'github', 'authored'],
  ['Event Streaming with Kafka', 'data_integration', 'alice.owner@example.com', 'confluence', 'authored'],
];

// GitHub demo: real Markdown, exercising headings, bold, a link, a list, a table, a fenced code
// block, and a blockquote.
const MARKDOWN_SAMPLE = `## Overview

This pattern implements a **circuit breaker** for downstream service calls, based on the
[Netflix Hystrix](https://github.com/Netflix/Hystrix) design.

### Key properties

- Trips after \`5\` consecutive failures within a 30s window
- Falls back to a cached response when open
- Exposes health via \`/actuator/circuitbreakers\`

| State | Behavior |
| --- | --- |
| Closed | Requests pass through normally |
| Open | Requests fail fast, fallback used |
| Half-open | A trial request is allowed through |

\`\`\`ts
const breaker = new CircuitBreaker(call, { timeout: 3000, errorThresholdPercentage: 50 });
\`\`\`

> Tune thresholds per downstream SLA — the defaults above are a starting point, not a guarantee.
`;

// Confluence demo: real ADF, exercising heading levels, marks (strong/link), an info panel, a
// bullet list, a table, a code block, a bodied macro (renders its inner text) and a bare macro
// (renders the "Unsupported content" fallback badge).
const CONFLUENCE_ADF_SAMPLE = {
  type: 'doc',
  version: 1,
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Overview' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'This pattern routes events through a ' },
        { type: 'text', text: 'schema-registry-backed', marks: [{ type: 'strong' }] },
        { type: 'text', text: ' Kafka topic, replayable via ' },
        {
          type: 'text',
          text: 'Kafka Connect',
          marks: [{ type: 'link', attrs: { href: 'https://kafka.apache.org/documentation/#connect' } }],
        },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'panel',
      attrs: { panelType: 'info' },
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Schema compatibility is enforced at publish time; breaking changes are rejected by the registry.',
            },
          ],
        },
      ],
    },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Key properties' }] },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'At-least-once delivery' }] }] },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '7-day retention, replayable from any offset' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Consumer groups scale independently' }] }],
        },
      ],
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Topic' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Partitions' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'orders.events' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '12' }] }] },
          ],
        },
      ],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'json' },
      content: [{ type: 'text', text: '{\n  "topic": "orders.events",\n  "partitions": 12\n}' }],
    },
    {
      type: 'bodiedExtension',
      attrs: { extensionKey: 'expand' },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Fallback body text from a bodied macro, shown without its original chrome.' }],
        },
      ],
    },
    { type: 'extension', attrs: { extensionKey: 'jira-issues-macro' } },
  ],
};

// [pattern name, attribute code to override] -> rich content for that one attribute; every other
// attribute on these two patterns still gets the generic rotation below, same as any other
// pattern — a real synced pattern would typically only have a few richly-formatted sections.
const CONTENT_DEMO_OVERRIDES = {
  'Circuit Breaker for Downstream Calls|solution': MARKDOWN_SAMPLE,
  'Event Streaming with Kafka|solution': CONFLUENCE_ADF_SAMPLE,
};

try {
  await client.query('BEGIN');
  const hash = await bcrypt.hash(password, 12);

  const ids = {};
  for (const [email, name, role] of USERS) {
    const found = await client.query('SELECT user_id FROM patt_users WHERE lower(user_email) = $1', [email]);
    if (found.rows[0]) {
      ids[role] = found.rows[0].user_id;
      continue;
    }
    const ins = await client.query(
      `INSERT INTO patt_users (user_email, user_display_name, user_password_hash, user_role)
       VALUES ($1, $2, $3, $4) RETURNING user_id`,
      [email, name, hash, role],
    );
    ids[role] = ins.rows[0].user_id;
    console.log(`  user ${email} (${role})`);
  }

  for (const [code, name, description, order, required] of ATTRIBUTE_TYPES) {
    await client.query(
      `INSERT INTO patt_attribute_types (attr_code, attr_name, attr_description, attr_display_order, attr_is_required)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (attr_code) DO NOTHING`,
      [code, name, description, order, required],
    );
  }
  const types = (await client.query('SELECT attr_attribute_type_id AS id, attr_code AS code FROM patt_attribute_types ORDER BY attr_display_order')).rows;

  for (const [p, [name, category, owner, source, status]] of PATTERNS.entries()) {
    const exists = await client.query('SELECT 1 FROM patt_patterns WHERE patt_name = $1', [name]);
    if (exists.rows[0]) continue;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const url =
      source === 'confluence'
        ? `https://confluence.example.com/display/EA/${slug}`
        : source === 'github'
          ? `https://github.com/acme-org/ea-patterns/blob/main/patterns/${slug}.md`
          : `https://example.sharepoint.com/sites/EA/Patterns/${slug}.docx`;
    const pat = await client.query(
      `INSERT INTO patt_patterns
         (patt_name, patt_category, patt_owner, patt_source_system, patt_source_url,
          patt_source_last_modified, patt_last_synced_at, patt_approval_status)
       VALUES ($1, $2, $3, $4, $5, now() - interval '3 days', now() - interval '1 hour', $6)
       RETURNING patt_pattern_id`,
      [name, category, owner, source, url, status],
    );
    const patternId = pat.rows[0].patt_pattern_id;

    for (const [t, type] of types.entries()) {
      const override = CONTENT_DEMO_OVERRIDES[`${name}|${type.code}`];
      const slot = (p + t) % 4; // 0,1 sourced; 2 inferred; 3 missing
      const method = override !== undefined ? 'direct_field_match' : slot === 2 ? 'inferred_from_text' : slot === 3 ? 'missing' : 'direct_field_match';
      const value =
        override !== undefined
          ? override
          : method === 'missing'
            ? null
            : type.code === 'technology_stack'
              ? ['Kafka', 'AWS Lambda', 'Amazon S3']
              : `Sample ${type.code.replace(/_/g, ' ')} for ${name}.`;
      await client.query(
        `INSERT INTO patt_attribute_values
           (attv_pattern_id, attv_attribute_type_id, attv_value, attv_source_excerpt, attv_extraction_method, attv_extracted_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, now() - interval '1 hour')`,
        [
          patternId,
          type.id,
          value === null ? null : JSON.stringify(value),
          method === 'missing' ? null : `"...source text describing the ${type.code.replace(/_/g, ' ')}..."`,
          method,
        ],
      );
    }

    const audit = (actor, action, at, details) =>
      client.query(
        `INSERT INTO patt_audit_log (audi_actor_id, audi_action, audi_entity_type, audi_entity_id, audi_occurred_at, audi_details)
         VALUES ($1, $2, 'pattern', $3, $4, $5::jsonb)`,
        [actor, action, patternId, at, JSON.stringify(details)],
      );

    if (status === 'review_requested') {
      const r = await client.query(
        `INSERT INTO patt_review_requests (revi_pattern_id, revi_requested_by, revi_requested_at)
         VALUES ($1, $2, now() - interval '2 days') RETURNING revi_review_request_id AS id`,
        [patternId, ids.pattern_owner],
      );
      await audit(ids.pattern_owner, 'pattern.review_requested', new Date(Date.now() - 2 * 864e5), {
        from: 'authored', to: 'review_requested', review_request_id: r.rows[0].id,
      });
    }

    if (status === 'approved') {
      const day = 864e5;
      const r = await client.query(
        `INSERT INTO patt_review_requests (revi_pattern_id, revi_requested_by, revi_requested_at, revi_status)
         VALUES ($1, $2, now() - interval '5 days', 'closed') RETURNING revi_review_request_id AS id`,
        [patternId, ids.pattern_owner],
      );
      const reqId = r.rows[0].id;
      const d = await client.query(
        `INSERT INTO patt_approval_decisions (appr_review_request_id, appr_decided_by, appr_decision, appr_comments, appr_decided_at)
         VALUES ($1, $2, 'approved', 'Meets the reference architecture guidelines.', now() - interval '3 days')
         RETURNING appr_approval_decision_id AS id`,
        [reqId, ids.ea_reviewer],
      );
      await audit(ids.pattern_owner, 'pattern.review_requested', new Date(Date.now() - 5 * day), {
        from: 'authored', to: 'review_requested', review_request_id: reqId,
      });
      await audit(ids.ea_reviewer, 'pattern.review_picked_up', new Date(Date.now() - 4 * day), {
        from: 'review_requested', to: 'under_review', review_request_id: reqId,
      });
      await audit(ids.ea_reviewer, 'pattern.decision_recorded', new Date(Date.now() - 3 * day), {
        from: 'under_review', to: 'approved', review_request_id: reqId, decision_id: d.rows[0].id,
      });
    }
    console.log(`  pattern "${name}" (${status})`);
  }

  await client.query('COMMIT');
  console.log('Seed complete.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Seed failed and was rolled back:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
