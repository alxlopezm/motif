// Seeds mock-up data across all 4 initiative/technology tables (patt_initiatives,
// patt_technology_components, patt_initiative_technologies, patt_initiative_patterns),
// linked to patterns that already exist in the database, so the "Initiatives using this
// pattern" section on the pattern detail page has something real to show.
//
// Idempotent per-initiative (skips any whose init_description already exists) and additive
// — never touches an existing pattern, initiative, or technology component.
//
//   node --env-file=.env.local scripts/seed-initiatives-mockup.mjs

import { connect } from './_db.mjs';

const { client, host, database } = await connect();
console.log(`Target: database "${database}" on ${host}`);

const INITIATIVES = [
  {
    description: 'Vendor EDI Modernization',
    benefitedBu: 'us_bu',
    sponsorEmail: 'jane.doe@takeda.com',
    patterns: [
      {
        name: 'AWS Transfer Family SFTP Connector Pattern',
        note: 'Primary delivery pattern for outbound vendor file exchange.',
      },
    ],
    technologies: [
      { description: 'Vendor EDI Gateway', type: 'APP', vendor: null, disposition: 'INVEST' },
      { description: 'AWS Transfer Family', type: 'TEC', vendor: 'AWS', disposition: 'APPROVED' },
    ],
  },
  {
    description: 'Global Order Event Backbone',
    benefitedBu: 'international_bu',
    sponsorEmail: 'maria.santos@takeda.com',
    patterns: [{ name: 'Publish / Subscribe', note: 'Event backbone for order lifecycle fan-out.' }],
    technologies: [
      { description: 'Order Service', type: 'APP', vendor: null, disposition: 'MIGRATE' },
      { description: 'Confluent Kafka Platform', type: 'TEC', vendor: 'Confluent', disposition: 'APPROVED' },
    ],
  },
  {
    description: 'Partner API Exposure Program',
    benefitedBu: 'corporate_functions',
    sponsorEmail: 'daniel.price@takeda.com',
    patterns: [{ name: 'API Gateway & Security', note: 'Partner-facing APIs fronted by the enterprise gateway.' }],
    technologies: [
      { description: 'Partner Portal', type: 'APP', vendor: null, disposition: 'INVEST' },
      { description: 'Flex Gateway', type: 'TEC', vendor: 'MuleSoft', disposition: 'APPROVED' },
    ],
  },
  {
    description: 'R&D Data Integration Hub',
    benefitedBu: 'rd',
    sponsorEmail: 'li.wei@takeda.com',
    patterns: [
      { name: 'Publish / Subscribe', note: 'Lab instrument events feed the same backbone.' },
      { name: 'API Gateway & Security', note: 'Also exposes a synchronous lookup API for lab systems.' },
    ],
    technologies: [
      { description: 'Lab Data Connector', type: 'APP', vendor: null, disposition: 'INVEST' },
      { description: 'Schema Registry', type: 'TEC', vendor: 'Confluent', disposition: 'EXPLORE' },
    ],
  },
];

try {
  await client.query('BEGIN');

  const anyPatterns = (
    await client.query(`SELECT patt_pattern_id, patt_name FROM patt_patterns ORDER BY patt_created_at`)
  ).rows;
  if (anyPatterns.length === 0) {
    throw new Error('No patterns exist in the database yet — seed at least one pattern before running this script.');
  }

  let fallbackIndex = 0;
  async function resolvePatternId(name) {
    const found = (await client.query(`SELECT patt_pattern_id FROM patt_patterns WHERE patt_name = $1`, [name]))
      .rows[0];
    if (found) return found.patt_pattern_id;
    const fallback = anyPatterns[fallbackIndex % anyPatterns.length];
    fallbackIndex += 1;
    console.warn(`Pattern "${name}" not found — linking to "${fallback.patt_name}" instead.`);
    return fallback.patt_pattern_id;
  }

  let createdCount = 0;
  for (const initiative of INITIATIVES) {
    const exists = await client.query(`SELECT 1 FROM patt_initiatives WHERE init_description = $1`, [
      initiative.description,
    ]);
    if (exists.rows[0]) {
      console.log(`Initiative "${initiative.description}" already exists — skipping.`);
      continue;
    }

    const initRow = await client.query(
      `INSERT INTO patt_initiatives (init_description, init_benefited_bu, init_business_sponsor_email)
       VALUES ($1, $2, $3) RETURNING init_initiative_id`,
      [initiative.description, initiative.benefitedBu, initiative.sponsorEmail],
    );
    const initiativeId = initRow.rows[0].init_initiative_id;

    for (const tech of initiative.technologies) {
      const techRow = await client.query(
        `INSERT INTO patt_technology_components (tech_description, tech_component_type, tech_vendor_name)
         VALUES ($1, $2, $3) RETURNING tech_technology_component_id`,
        [tech.description, tech.type, tech.vendor],
      );
      await client.query(
        `INSERT INTO patt_initiative_technologies (inte_initiative_id, inte_technology_component_id, inte_disposition)
         VALUES ($1, $2, $3)`,
        [initiativeId, techRow.rows[0].tech_technology_component_id, tech.disposition],
      );
    }

    for (const p of initiative.patterns) {
      const patternId = await resolvePatternId(p.name);
      await client.query(
        `INSERT INTO patt_initiative_patterns (inpa_initiative_id, inpa_pattern_id, inpa_note)
         VALUES ($1, $2, $3)`,
        [initiativeId, patternId, p.note],
      );
    }

    createdCount += 1;
    console.log(
      `Created initiative "${initiative.description}" (${initiativeId}) with ${initiative.technologies.length} ` +
        `technologies and ${initiative.patterns.length} pattern link(s).`,
    );
  }

  await client.query('COMMIT');
  console.log(`Done. ${createdCount} of ${INITIATIVES.length} initiatives created (others already existed).`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Failed and rolled back:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
