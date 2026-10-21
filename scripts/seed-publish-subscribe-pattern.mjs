// Seeds one real pattern — "Publish / Subscribe" — from an actual Confluence ADF export the user
// supplied, mapped onto patt_attribute_types' document-structure-mirroring codes (context,
// problem, applicability, overview, structure, standards, security). Same mapping convention as
// scripts/seed-api-gateway-pattern.mjs — see that file's comments for the reasoning (in
// particular: attr_code and attr_name diverge for 'overview'/'structure', so the mapping is
// derived from attr_name, not guessed from the code).
// Idempotent: skips if a pattern with this name already exists. Additive — does not touch any
// other pattern already in the database.
//
//   node --env-file=.env.local scripts/seed-publish-subscribe-pattern.mjs

import { connect } from './_db.mjs';

const { client, host, database } = await connect();
console.log(`Target: database "${database}" on ${host}`);

// ---------------------------------------------------------------------------
// Source content, copied verbatim from the ADF export (localIds included, unmodified) for the
// sections that map onto each attribute. The export was truncated by the user mid "6.
// Architecture overview" table (row "2b" cuts off mid-cell) — only the three complete rows
// (1, —, 2a) are used for `structure`; nothing after that point was available.
//
// Confluence's own internal `MATURITY N` doc-maturity markers are excluded, as is "2. Pattern
// identity" (duplicates pattern-record fields; the rest has no home in the attribute schema).
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

const CONTEXT_ADF = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'bulletList',
      content: [
        ['Business drivers & outcomes —', ' a single business event (order created, shipment dispatched, case opened, adverse event received) must fan out to many downstream domains — fulfillment, billing, analytics, patient safety — each reacting independently. New capabilities plug in without touching the source system, so time-to-integrate for a new consumer drops from a project to a subscription.'],
        ['Technology drivers & constraints —', ' event-driven architecture as the decoupling layer across 300+ SaaS apps; Kafka / Confluent as the strategic event backbone with Schema Registry enforcing contracts; Solace for the JMS/legacy estate; CloudHub 2.0 MuleSoft applications as governed publishers and consumers; Flex Gateway fronting HTTP-facing publish endpoints and webhook fan-out.'],
        ['Enterprise capabilities supported —', ' Order-to-Cash event choreography, supply-chain track-and-trace, master-data change propagation, pharmacovigilance intake fan-out, and agent-facing event streams (see Streaming as Agent Context).'],
        ['Assumptions & dependencies —', ' Microsoft Entra ID issues identities for producers/consumers; Schema Registry is authoritative for event contracts; topics are provisioned as governed assets; consumers are idempotent; a dead-letter topic exists per subscription.'],
        ['Regulatory / policy —', ' GxP where the event drives a regulated process; PII/PHI classification on event payloads; 21 CFR Part 11 audit trail on regulated event flows; data residency honoured by topic/cluster placement.'],
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
      content: [
        ['What repeats —', ' the same business event must reach several unrelated systems, the list of interested systems keeps growing, and the publisher should not have to change every time a new consumer appears.'],
        ['Why ad hoc is risky —', " point-to-point notifications create N² wiring; the publisher becomes coupled to every consumer's availability; adding a consumer means changing and re-releasing the producer; a slow or broken consumer back-pressures the source; there is no replay when a consumer was down."],
        ['Pre-resolved by this pattern —', ' transport (Kafka/Solace topic), contract (registry-enforced, backward-compatible schema), delivery semantics (at-least-once by default, exactly-once where dedup is costly), partitioning for ordering, dead-letter handling for poison messages, and consumer-group offsets so each subscriber reads independently — so every event flow behaves the same way.'],
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

const APPLICABILITY_ADF = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'table',
      content: [
        tRow(['Decision criterion', 'This pattern'], true),
        ...[
          ['Latency', 'Near-real-time (sub-second end-to-end typical; not request-blocking)'],
          ['Data sensitivity', 'Public → regulated (classification, encryption, and residency enforced at topic/cluster)'],
          ['Integration style', 'Event (topic fan-out) — decoupled, one-to-many'],
          ['Availability', 'High → mission-critical (replicated partitions, multi-AZ brokers, DLQ isolation)'],
          ['Scalability', 'Elastic — partition to add consumer parallelism; consumers scale independently of the publisher'],
          ['Deployment model', 'Cloud-native (CloudHub 2.0 apps) + managed broker (Confluent Cloud / Solace)'],
          ['Coupling', 'Loose / async — publisher and consumers share only the schema contract'],
          ['Governance model', 'Platform-managed (broker + Schema Registry + topic-as-asset governance)'],
        ].map(([k, v]) => tRow([k, v])),
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Use when:', marks: [{ type: 'strong' }] },
        {
          type: 'text',
          text: ' one event must reach many consumers; the set of consumers changes over time; consumers can react independently and asynchronously; eventual consistency is acceptable; you want to add subscribers without touching the publisher. ',
        },
        { type: 'text', text: 'Do not use when:', marks: [{ type: 'strong' }] },
        { type: 'text', text: ' the caller needs the answer to continue (use ' },
        { type: 'text', text: 'Synchronous Request / Response', marks: [{ type: 'em' }] },
        { type: 'text', text: '); exactly one worker should handle each message as a unit of work (use the ' },
        { type: 'text', text: 'queue / point-to-point', marks: [{ type: 'em' }] },
        { type: 'text', text: ' variant in ' },
        // Internal cross-reference to another heading in the same (not supplied) document —
        // AdfContent's safeExternalUrl check already renders a fragment-only href as plain text
        // rather than a broken/unsafe link, same as the API Gateway pattern's equivalent case.
        { type: 'text', text: 'section 12', marks: [{ type: 'link', attrs: { href: '#9204e854378f' } }] },
        { type: 'text', text: '); or the interaction is a durable one-to-one handoff (use ' },
        { type: 'text', text: 'Asynchronous Messaging', marks: [{ type: 'em' }] },
        { type: 'text', text: ').' },
      ],
    },
  ],
};

const OVERVIEW_ADF = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hero pattern — topic-based fan-out.', marks: [{ type: 'strong' }] },
        { type: 'text', text: ' The ' },
        { type: 'text', text: 'Order Service', marks: [{ type: 'em' }] },
        { type: 'text', text: ' publishes an ' },
        { type: 'text', text: 'order.created', marks: [{ type: 'code' }] },
        { type: 'text', text: ' event to a topic; three independent consumer groups — ' },
        { type: 'text', text: 'Fulfillment', marks: [{ type: 'em' }] },
        { type: 'text', text: ', ' },
        { type: 'text', text: 'Billing', marks: [{ type: 'em' }] },
        { type: 'text', text: ', ' },
        { type: 'text', text: 'Analytics', marks: [{ type: 'em' }] },
        {
          type: 'text',
          text: ' — each subscribe and each receive every event, reading at their own pace with their own offsets. The topic is persistent and partitioned; the publisher never learns who is downstream, and a new fourth consumer can join tomorrow with zero change to the Order Service.',
        },
      ],
    },
  ],
};

const STRUCTURE_ADF = {
  type: 'doc',
  version: 1,
  content: [
    {
      type: 'table',
      content: [
        tRow(['Step', 'Hop', 'Action'], true),
        tRow(['1', 'Order Service → Topic', [
          { type: 'text', text: 'publish order.created', marks: [{ type: 'code' }] },
          { type: 'text', text: ' (key = orderId) + schema-validated payload' },
        ]]),
        tRow(['—', ['Topic ', { type: 'text', text: 'order.created', marks: [{ type: 'code' }] }], 'Persist & partition by key; retain per policy; offsets tracked per consumer group']),
        tRow(['2a', 'Topic → Fulfillment', 'Consumer group reads, processes, commits offset (ack after processing)']),
        // Row "2b" and beyond were cut off mid-cell in the supplied export — not included.
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
  context: CONTEXT_ADF,
  problem: PROBLEM_ADF,
  applicability: APPLICABILITY_ADF,
  overview: OVERVIEW_ADF,
  structure: STRUCTURE_ADF,
  // Nothing in the supplied (truncated) export reaches these sections — left missing, same as
  // any other pattern the pipeline couldn't fully extract.
  standards: null,
  security: null,
};

const PATTERN_NAME = 'Publish / Subscribe';
// Placeholder — the export didn't include the page's real URL. Update once known.
const SOURCE_URL = 'https://confluence.example.com/display/EA/publish-subscribe';

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
       VALUES ($1, 'data_integration', $2, 'confluence', $3, now() - interval '1 day', now() - interval '1 hour', 'authored')
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
