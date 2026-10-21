// Seeds one real pattern — "API Gateway & Security" — from an actual Confluence ADF export the
// user supplied, mapped onto patt_attribute_types' document-structure-mirroring codes (overview,
// context, problem, applicability, structure, standards, security) — the schema now matches this
// document's own section headings directly, rather than the earlier generic best-effort mapping.
// Idempotent: skips if a pattern with this name already exists.
//
//   node --env-file=.env.local scripts/seed-api-gateway-pattern.mjs

import { connect } from './_db.mjs';

const { client, host, database } = await connect();
console.log(`Target: database "${database}" on ${host}`);

// ---------------------------------------------------------------------------
// Source content, copied verbatim from the ADF export (localIds included, unmodified) for the
// sections that map onto each attribute. The export was truncated by the user mid "6.
// Architecture overview" (the JSON simply stops mid-paragraph after the enforcement-chain
// table) — only the complete portion up to and including that table is used here; nothing after
// it (which would presumably cover `standards` and `security`) was available to seed.
//
// Confluence's own internal `MATURITY N` doc-maturity markers (a plain paragraph with a single
// `code`-marked "MATURITY 1" run, appearing at the top of several sections) are Confluence
// authoring metadata, not pattern content, and are excluded from every section below.
//
// "2. Pattern identity" isn't represented as an attribute at all: it's mostly metadata that
// duplicates fields the pattern record already has natively (name, owner, category); the few
// fields with no home (Pattern ID, Approval body, Review cadence, Related patterns, Measurement
// of use) have nowhere to go in the current attribute schema.
// ---------------------------------------------------------------------------

function tRow(cells, header = false) {
  const type = header ? 'tableHeader' : 'tableCell';
  return {
    type: 'tableRow',
    content: cells.map((c) => ({
      type,
      attrs: { colspan: 1, rowspan: 1 },
      content: [{ type: 'paragraph', content: typeof c === 'string' ? [{ type: 'text', text: c }] : c }],
    })),
  };
}

// attr_code 'overview' is named "Architecture overview" (confirmed against the live schema, not
// assumed from the code alone — attr_code and attr_name diverge here) — this is section 6's own
// narrative paragraph, not section 1 ("1. Overview", which has no attribute type to hold it: its
// Purpose/Scope/Executive summary content is dropped, same as any other extraction gap).
const OVERVIEW_ADF = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hero pattern — the Flex Gateway enforcement chain.', marks: [{ type: 'strong' }] },
        {
          type: 'text',
          text: ' A client (app or agent) call passes through an ordered chain of policies; each stage can short-circuit with a typed error before the call reaches the backend. The chain is: ',
        },
        {
          type: 'text',
          text: 'TLS termination → AuthN → AuthZ → rate limit → transform → backend',
          marks: [{ type: 'em' }],
        },
        { type: 'text', text: '. The caller gets a typed error, never a stack trace.' },
      ],
    },
  ],
};

const CONTEXT_ADF = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'bulletList',
      attrs: { localId: 'e6df8b8564e6' },
      content: [
        ['Business drivers & outcomes —', ' a single, auditable control plane for every external and internal API and agent call; faster onboarding of partners and SaaS apps because security is a policy, not a per-project build; demonstrable compliance evidence (who called what, when, with what result) for regulated flows.'],
        ['Technology drivers & constraints —', ' API-led connectivity with Flex Gateway as the enforcement point; APIM in front of Flex Gateway for edge WAF, discovery, and Defender for APIs; Zero-Trust identity at every hop; policy changes decoupled from service deployments.'],
        ['Enterprise capabilities supported —', ' every capability that exposes an API or MCP tool — Order-to-Cash, Patient Services, HCP Engagement, Master-Data lookups, Agent Fabric tool calls — inherits the same gateway controls.'],
        ['Assumptions & dependencies —', ' Microsoft Entra ID issues and rotates JWTs (OIDC); Flex Gateway policies are active and version-controlled; APIM is deployed as the outer edge; secrets live in a vault; observability sink (App Insights / Anypoint Monitoring) is reachable.'],
        ['Regulatory / policy —', ' GxP and 21 CFR Part 11 where the transaction is regulated; PII/PHI handling for patient/HCP data; enterprise Zero-Trust and least-privilege mandates; audit-log retention requirements.'],
      ].map(([lead, rest]) => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: lead, marks: [{ type: 'strong' }] },
              { type: 'text', text: rest },
            ],
          },
        ],
      })),
    },
  ],
};

const PROBLEM_ADF = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'bulletList',
      attrs: { localId: 'f6ecb35f6f9d' },
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'What repeats —', marks: [{ type: 'strong' }] },
                {
                  type: 'text',
                  text: ' every API and every agent tool needs the same controls: authenticate the caller, authorize the operation, throttle abuse, protect against malformed/malicious payloads, and record the call for audit.',
                },
              ],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Why ad hoc is risky —', marks: [{ type: 'strong' }] },
                {
                  type: 'text',
                  text: ' per-service security models drift, credentials get hardcoded, endpoints go unmonitored, and callers bypass controls by talking to backends directly — producing inconsistent auth, unauditable traffic, and a much larger attack surface with no single place to fix it.',
                },
              ],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Pre-resolved by this pattern —', marks: [{ type: 'strong' }] },
                {
                  type: 'text',
                  text: ' one enforcement chain (TLS → AuthN → AuthZ → rate limit → transform → backend), typed errors (',
                },
                { type: 'text', text: '401/403/429/400', marks: [{ type: 'code' }] },
                {
                  type: 'text',
                  text: '), key-rotation handling, mTLS service-to-service, and uniform audit — so a control change is a policy edit at the edge, not a redeploy of every API.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const APPLICABILITY_ADF = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'table',
      attrs: { layout: 'default', width: 760, localId: 'c025ff07480c' },
      content: [
        tRow(['Decision criterion', 'This pattern'], true),
        ...[
          ['Latency', 'Real-time; gateway adds ~20 ms for centralized control (acceptable for the security guarantee)'],
          ['Data sensitivity', 'Public → regulated — identity, encryption, and audit are enforced regardless of sensitivity'],
          ['Integration style', 'API (request/response), MCP tool calls, agent-to-agent — any north-south or east-west hop'],
          ['Availability', 'Mission-critical (Tier-0); the gateway is on the critical path, so it must be multi-region'],
          ['Scalability', 'Elastic; scales horizontally ahead of the services it protects'],
          ['Coupling', 'Loose — the gateway decouples security policy from service implementation'],
          ['Governance model', 'Platform-managed (Flex Gateway + APIM + Anypoint policy plane)'],
        ].map(([k, v]) => tRow([k, v])),
        // Deployment model — kept separate: its source cell links to another heading in the same
        // document ("#25332e7f7087") that isn't part of what was supplied. AdfContent's link
        // safety check (safeExternalUrl) already handles this correctly on its own: a
        // fragment-only href isn't a parseable absolute URL, so it renders as plain text instead
        // of a broken or unsafe link — no special-casing needed here.
        tRow([
          'Deployment model',
          [
            { type: 'text', text: 'Cloud-native (CloudHub 2.0) / hybrid; edge, internal, sidecar, or embedded topology (' },
            { type: 'text', text: '12. Integration and interoperability', marks: [{ type: 'link', attrs: { href: '#25332e7f7087' } }] },
            { type: 'text', text: ')' },
          ],
        ]),
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Use when:', marks: [{ type: 'strong' }] },
        {
          type: 'text',
          text: ' any API, MCP tool, or agent is exposed to a caller — external or internal — and needs authentication, authorization, throttling, threat protection, or audit (i.e. essentially always). ',
        },
        { type: 'text', text: 'Do not use when:', marks: [{ type: 'strong' }] },
        {
          type: 'text',
          text: ' a call never crosses a trust boundary (pure in-process function call) — but even intra-service east-west calls SHOULD carry identity via an internal gateway or service mesh under Zero-Trust.',
        },
      ],
    },
  ],
};

// attr_code 'structure' is "Pattern structure and components" — the enforcement chain's own
// step-by-step table (TLS Termination, AuthN, AuthZ, …) is exactly that: the pattern's
// components, broken out — a natural, honest split from the narrative paragraph above rather
// than duplicating the same content under both attributes.
const STRUCTURE_ADF = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'table',
      attrs: { layout: 'default', width: 760, localId: 'dfc531dbc1f1' },
      content: [
        tRow(['Step', 'Stage', 'Enforces', 'Short-circuit'], true),
        tRow(['1', 'TLS Termination', 'mTLS · client cert · TLS 1.2+', [
          { type: 'text', text: '495/525', marks: [{ type: 'code' }] },
          { type: 'text', text: ' cert error' },
        ]]),
        tRow(['2', 'AuthN', 'JWT validation · OIDC discovery · key rotation', [
          { type: 'text', text: '401', marks: [{ type: 'code' }] },
          { type: 'text', text: ' Unauthorized' },
        ]]),
        tRow(['3', 'AuthZ', 'Scopes · RBAC · ABAC · per-resource policy', [
          { type: 'text', text: '403', marks: [{ type: 'code' }] },
          { type: 'text', text: ' Forbidden' },
        ]]),
        tRow(['4', 'Rate Limit', 'Per-client RPS · burst window · quota', [
          { type: 'text', text: '429', marks: [{ type: 'code' }] },
          { type: 'text', text: ' + ' },
          { type: 'text', text: 'Retry-After', marks: [{ type: 'code' }] },
        ]]),
        tRow(['5', 'Transform', 'Header/payload shaping · schema & size validation', [
          { type: 'text', text: '400', marks: [{ type: 'code' }] },
          { type: 'text', text: ' Bad Request' },
        ]]),
        tRow(['6', 'Backend', 'Routed over mTLS to API / service', [
          { type: 'text', text: '5xx', marks: [{ type: 'code' }] },
          { type: 'text', text: ' upstream error' },
        ]]),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------

function textOf(node) {
  if (typeof node.text === 'string') return node.text;
  if (!node.content) return '';
  return node.content.map(textOf).join(' ');
}

function excerptOf(doc) {
  const text = (doc.content ?? []).map(textOf).join(' ').replace(/\s+/g, ' ').trim();
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
}

const ATTRIBUTE_VALUES = {
  overview: OVERVIEW_ADF,
  context: CONTEXT_ADF,
  problem: PROBLEM_ADF,
  applicability: APPLICABILITY_ADF,
  structure: STRUCTURE_ADF,
  // Nothing in the supplied (truncated) export reaches these sections — left missing, same as
  // any other pattern the pipeline couldn't fully extract.
  standards: null,
  security: null,
};

const PATTERN_NAME = 'API Gateway & Security';
// Placeholder — the export didn't include the page's real URL. Update once known.
const SOURCE_URL = 'https://confluence.example.com/display/EA/api-gateway-and-security';

try {
  await client.query('BEGIN');

  const exists = await client.query('SELECT 1 FROM patt_patterns WHERE patt_name = $1', [PATTERN_NAME]);
  if (exists.rows[0]) {
    console.log(`Pattern "${PATTERN_NAME}" already exists — nothing to do.`);
  } else {
    const types = (
      await client.query('SELECT attr_attribute_type_id AS id, attr_code AS code FROM patt_attribute_types')
    ).rows;
    const unknownCodes = types.map((t) => t.code).filter((code) => !(code in ATTRIBUTE_VALUES));
    if (unknownCodes.length > 0) {
      throw new Error(
        `patt_attribute_types has codes this script doesn't know how to map: ${unknownCodes.join(', ')}. ` +
          'Update ATTRIBUTE_VALUES before seeding.',
      );
    }

    const pat = await client.query(
      `INSERT INTO patt_patterns
         (patt_name, patt_category, patt_owner, patt_source_system, patt_source_url,
          patt_source_last_modified, patt_last_synced_at, patt_approval_status)
       VALUES ($1, 'data_integration', $2, 'confluence', $3, now() - interval '2 days', now() - interval '1 hour', 'authored')
       RETURNING patt_pattern_id`,
      [PATTERN_NAME, 'AI & Data · Integrations & API Platform (DD&T)', SOURCE_URL],
    );
    const patternId = pat.rows[0].patt_pattern_id;

    for (const type of types) {
      const value = ATTRIBUTE_VALUES[type.code];
      await client.query(
        `INSERT INTO patt_attribute_values
           (attv_pattern_id, attv_attribute_type_id, attv_value, attv_source_excerpt, attv_extraction_method, attv_extracted_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, now() - interval '1 hour')`,
        [
          patternId,
          type.id,
          value === null ? null : JSON.stringify(value),
          value === null ? null : excerptOf(value),
          value === null ? 'missing' : 'direct_field_match',
        ],
      );
    }

    const populated = Object.values(ATTRIBUTE_VALUES).filter((v) => v).length;
    console.log(`Created pattern "${PATTERN_NAME}" (${patternId}) with ${populated} of ${types.length} attributes populated.`);
  }

  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Failed and rolled back:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
