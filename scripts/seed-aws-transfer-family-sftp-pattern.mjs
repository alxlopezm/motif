// Seeds one real pattern — "AWS Transfer Family SFTP Connector Pattern" — from an actual GitHub
// Markdown export the user supplied, mapped onto patt_attribute_types' document-structure-
// mirroring codes (context, problem, applicability, overview, structure, standards, security).
// Source system is 'github', so each mapped section is stored as a plain Markdown string in
// attv_value (jsonb of a JSON string), not an ADF doc — see mergeMarkdown/MarkdownContent, which
// expect `attv_value` to be `typeof value === 'string'` for github-sourced patterns.
//
// The document's "📋 Overview" (Purpose/Scope/Audience/Maturity) and "🆔 Pattern Identity" tables
// are excluded from the mapping — they duplicate pattern-record fields already captured by
// patt_patterns columns (name, owner, category, etc.), same convention as excluding Confluence's
// "Pattern identity" table in scripts/seed-publish-subscribe-pattern.mjs. Sections with no home in
// the 7-attribute schema (Data Architecture Considerations, Integration and Interoperability,
// Non-Functional Requirements, Technology Standards and Approved Products, Implementation
// Guidance, Governance and Compliance Model, Architecture Decisions and Trade-offs, Anti-Patterns,
// Operational Model and Lifecycle Management, Examples and Reusable Assets, Author Checklist) are
// left out. The "📈 Reference Architecture" diagram is folded into `structure` as a fenced code
// block, since it depicts the same components that section describes and there's no dedicated
// attribute for diagrams.
//
// Idempotent: skips if a pattern with this name already exists. Additive — does not touch any
// other pattern already in the database.
//
//   node --env-file=.env.local scripts/seed-aws-transfer-family-sftp-pattern.mjs

import { connect } from './_db.mjs';

const { client, host, database } = await connect();
console.log(`Target: database "${database}" on ${host}`);

// ---------------------------------------------------------------------------
// Source content, copied verbatim (Markdown syntax intact) from the supplied export, one string
// per mapped section. Each string excludes its own top-level `#` heading — MergedMarkdownContent
// supplies that heading itself, from the attribute's attr_name, so the two don't collide.
// ---------------------------------------------------------------------------

const CONTEXT_MD = [
  '* **Business drivers:**',
  '  * Facilitate secure, reliable B2B file exchanges with external distributors, Contract Manufacturing Organizations (CMOs), logistics providers, and partners.',
  '  * Accelerate partner onboarding by standardizing file transfer protocols and eliminating point-to-point bespoke scripts.',
  '  * Reduce operational risks and manual overhead associated with legacy Managed File Transfer (MFT) systems.',
  '* **Technology drivers:**',
  '  * Eliminate the infrastructure maintenance, patching, and scaling burdens of running custom SSH/SFTP client EC2 instances or containers.',
  '  * Enforce zero-trust security principles by mandating SSH private key authentication and host key validation.',
  '  * Native cloud integration with Amazon S3 as the core enterprise data lake/staging storage layer.',
  '* **Enterprise capabilities supported:**',
  '  * TRM Category: `Integration & Middleware >> File Transfer & B2B Integration >> Managed File Transfer (MFT)` `[SUGGESTED]`',
  '  * Automated File Ingestion, Outbound B2B Data Delivery, Secure Partner Data Exchange.',
  '* **Assumptions:**',
  '  * Workloads run in Takeda Enterprise Cloud (TEC) AWS environments.',
  '  * Remote partner endpoints support standard SFTP over SSH (port 22) and provide valid host keys out-of-band.',
  '* **Constraints:**',
  '  * Approved scope is strictly limited to the **SFTP Connector** in **contained mode** (outbound client).',
  '  * Hosting inbound SFTP servers is deferred to a future release.',
  '  * Single-region connector deployment per module invocation.',
  '  * Supported Takeda Cloud environment: **TEC AWS Global** (TEC AWS China is currently out of scope).',
  '  * Maximum file size per transfer: **5 GB** (AWS Service Quota - non-adjustable).',
  '* **Environmental dependencies:**',
  '  * Amazon S3 (provisioned via Takeda S3 building block).',
  '  * AWS Secrets Manager (for credential storage).',
  '  * AWS KMS (`TEC-S3` alias key).',
  '  * Amazon CloudWatch Logs and AWS CloudTrail.',
  '* **Relevant policy or regulatory considerations:**',
  '  * Takeda Enterprise Cryptographic & Key Management Standards (mandating 90-day SSH private key rotation and disabling password authentication).',
  '  * Note on GxP: While the underlying AWS foundation is qualified, the AWS Transfer Family service itself is not pre-validated. Application teams must validate the end-to-end workload for GxP compliance.',
].join('\n');

const PROBLEM_MD = [
  '* **Recurring problem:** Application teams frequently require automated mechanisms to push or pull data to/from external vendor and partner SFTP servers. Historically, teams deployed custom EC2 virtual machines, cron scripts, or unmanaged open-source tools with fragmented credential management and weak logging.',
  '* **Why ad hoc approaches are risky:**',
  '  * Hardcoded passwords or unmanaged SSH keys present critical credential leakage vectors.',
  '  * Inconsistent host key verification exposes data streams to Man-in-the-Middle (MITM) attacks.',
  '  * Unmanaged EC2 bastion/client servers introduce unpatched OS vulnerabilities, high maintenance overhead, and lack centralized audit trails.',
  '* **Design decisions pre-resolved by this pattern:**',
  '  * Fully serverless, managed connector architecture removing all compute management.',
  '  * Strict prohibition of password-based authentication; mandatory SSH private key authentication.',
  '  * Automated IAM role generation scoping access strictly to designated S3 bucket ARNs, Secrets Manager secrets, and KMS keys.',
  '  * Enforced cryptographic security policy (`TransferSFTPConnectorSecurityPolicy-2024-03` or FIPS variant).',
  '  * Pre-configured CloudWatch logging role for all connection and transfer telemetry.',
].join('\n');

const APPLICABILITY_MD = [
  '* **Use this pattern when:**',
  '  * Secure outbound file transfer from AWS to external vendor, partner, or distributor SFTP endpoints is required.',
  '  * Ingesting reports, regulatory submissions, or operational datasets from vendor SFTP servers into Amazon S3.',
  '  * Modernizing legacy on-premises MFT point-to-point SFTP scripts to cloud-native AWS services.',
  '  * File transfer sizes are within 5 GB per individual transfer.',
  '* **Do not use this pattern when:**',
  '  * Inbound SFTP server hosting is needed (allowing external partners to initiate push/pull to Takeda) — *currently deferred*.',
  '  * Private VPC-only connectivity via VPC Lattice is required — *not supported in current connector release*.',
  '  * Protocols other than SFTP (e.g., FTPS, AS2, raw FTP) are required.',
  '  * Complex file transformation, schema validation, or content inspection is required in-transit (must use Lambda / Step Functions post-transfer).',
  '  * Transfers exceed 5 GB per file.',
  '',
  '### Selection Guidance',
  '| **Decision criterion** | **Pattern fit guidance** |',
  '| :--- | :--- |',
  '| **Directionality** | Outbound client connections initiated by AWS (Push to / Pull from remote server) |',
  '| **Data sensitivity** | Internal / Confidential / Regulated (KMS-encrypted at rest and in transit via SSH) |',
  '| **Transfer Protocol** | SFTP (SSH File Transfer Protocol) only |',
  '| **Storage Target** | Amazon S3 (native object storage integration) |',
  '| **Throughput / Scale** | Up to 100 concurrent file transfers per connector (default quota) |',
  '| **Deployment Model** | Cloud-native serverless managed resource provisioned via Terraform |',
  '| **Operational Effort** | Low (managed service; primary operations are 90-day key rotations) |',
].join('\n');

const OVERVIEW_MD = [
  '* **Pattern narrative:** The pattern provisions an AWS Transfer Family SFTP Connector that initiates outbound SSH connections over the internet to vendor-operated SFTP servers. Authentication is handled using SSH key pairs: the remote server registers the public key, while the connector securely retrieves the private key from AWS Secrets Manager using an auto-provisioned IAM Connector Access Role. Remote host identity is verified against pre-configured trusted host keys. Transferred files are read from or written directly to Amazon S3 buckets encrypted with the `TEC-S3` KMS key. All transfer activities and connection events are streamed to CloudWatch Logs (`/aws/transfer/*`) and audited via AWS CloudTrail.',
  '* **Primary data flows and integration paths:**',
  '  1. *Transfer Trigger:* Application workflow (e.g., Step Functions, EventBridge, or Lambda) triggers the Transfer Family API (`StartFileTransfer`).',
  '  2. *Authentication & Verification:* SFTP Connector assumes the Connector Access Role, retrieves the SSH private key from Secrets Manager, and validates the remote host key against its trusted list.',
  '  3. *Connection:* Outbound SSH connection is established to the vendor SFTP server (`sftp://remote-server:22`).',
  '  4. *Data Transfer:*',
  '     * **Push:** Connector reads source object from Amazon S3 (KMS decrypted) and writes to the remote SFTP server directory.',
  '     * **Pull:** Connector reads source file from remote SFTP server and writes object into Amazon S3 (KMS encrypted).',
  '  5. *Telemetry & Audit:* Connector writes detailed byte transfer and status logs to CloudWatch Logs via the Logging Role; CloudTrail records the control-plane API calls.',
].join('\n');

const STRUCTURE_MD = [
  '* **Core components:**',
  '  1. **AWS Transfer Family SFTP Connector:** Fully managed outbound SFTP client executing transfer jobs.',
  '  2. **Amazon S3 Bucket:** Enterprise backend storage staging area for incoming and outgoing files.',
  '  3. **AWS Secrets Manager:** Secure vault storing SFTP credentials (username and RSA/ED25519 private key).',
  '  4. **AWS KMS (`TEC-S3`):** Customer Managed Key used for encrypting S3 objects at rest.',
  '  5. **Amazon CloudWatch Logs:** Centralized log destination for transfer executions (`/aws/transfer/*`).',
  '  6. **IAM Connector Access Role:** Fine-grained role allowing S3 read/write, Secrets Manager secret retrieval, and KMS decryption.',
  '  7. **IAM Connector Logging Role:** Role allowing log stream creation and log event delivery to CloudWatch.',
  '* **Interfaces & Protocols:**',
  '  * Protocol: **SFTP over SSH** (Default Port: `22`).',
  '  * Cryptographic Policy: `TransferSFTPConnectorSecurityPolicy-2024-03` (or `TransferSFTPConnectorSecurityPolicy-FIPS-2024-10`).',
  '  * AWS APIs: Transfer Family Control & Data APIs (`StartFileTransfer`, `TestConnection`, `DescribeConnector`).',
  '',
  '### Reference Architecture',
  '```',
  '┌────────────────────────────────────────────────────────────────────────┐',
  '│                      AWS Cloud (Takeda TEC Account)                    │',
  '│                                                                        │',
  '│  ┌──────────────────────────────────────────────────────────────────┐  │',
  '│  │  AWS Transfer Family                                             │  │',
  '│  │  - SFTP Connector (Outbound Client)                              │  │',
  '│  │  - Security Policy: TransferSFTPConnectorSecurityPolicy-2024-03  │  │',
  '│  │  - Connector Access Role & Logging Role                          │  │',
  '│  └────────────────┬───────────────────────────┬─────────────────────┘  │',
  '│                   │                           │                        │',
  '│                   │ (IAM Least Privilege)     │ (IAM Logging)          │',
  '│                   ▼                           ▼                        │',
  '│  ┌─────────────────────────────┐    ┌───────────────────────────────┐  │',
  '│  │  Amazon S3 (File Staging)   │    │  Amazon CloudWatch Logs       │  │',
  '│  │  - Encrypted with TEC-S3 KMS│    │  - /aws/transfer/* log groups │  │',
  '│  └──────────────┬──────────────┘    └───────────────────────────────┘  │',
  '│                 │                                                      │',
  '│                 ▼                                                      │',
  '│  ┌─────────────────────────────┐    ┌───────────────────────────────┐  │',
  '│  │  AWS Secrets Manager        │    │  AWS CloudTrail               │  │',
  '│  │  - SFTP Username            │    │  - Full API Audit Trail       │  │',
  '│  │  - SSH Private Key          │    │                               │  │',
  '│  └─────────────────────────────┘    └───────────────────────────────┘  │',
  '│                                                                        │',
  '└─────────────────────────────────┬──────────────────────────────────────┘',
  '                                  │ Outbound SSH / SFTP (Port 22)',
  '                                  │ Host Key Verified',
  '                                  ▼',
  '┌────────────────────────────────────────────────────────────────────────┐',
  '│                   External Partner / Vendor Environment                │',
  '│                                                                        │',
  '│  ┌──────────────────────────────────────────────────────────────────┐  │',
  '│  │  Remote SFTP Server                                              │  │',
  '│  │  - Vendor-managed host & storage                                 │  │',
  '│  │  - Authenticated via Public Key corresponding to Secrets Manager │  │',
  '│  └──────────────────────────────────────────────────────────────────┘  │',
  '└────────────────────────────────────────────────────────────────────────┘',
  '```',
].join('\n');

const STANDARDS_MD = [
  '| Requirement | Level | Rationale or source |',
  '| :--- | :--- | :--- |',
  '| Connectors **must** authenticate to remote SFTP servers using SSH private key authentication. Password-based authentication **must not** be used. | **Must / Must not** | Takeda Enterprise Security & Cryptographic Standards |',
  '| SSH private keys stored in Secrets Manager **must** be rotated at least every 90 days. | **Must** | Takeda Credential Rotation Standard |',
  '| SFTP Connectors **must** configure trusted host keys to verify remote server identity. | **Must** | MITM Prevention Standard |',
  '| The **External Secret** approach **should** be used for production to keep private keys out of Terraform state. | **Should** | DevSecOps IaC Security Standard |',
  '| S3 staging buckets **must** be encrypted at rest using Customer Managed KMS keys (`TEC-S3`). | **Must** | TEC S3 Data Protection Standard |',
  '| Connectors **must** enforce minimum cryptographic policy `TransferSFTPConnectorSecurityPolicy-2024-03` (or FIPS variant). | **Must** | Enterprise Cryptographic Standards |',
  '| Hosting inbound SFTP servers with AWS Transfer Family **must not** be provisioned until formally approved. | **Must not** | Cloud Platform Governance Policy |',
  '',
  '* **Approved platforms:** AWS Transfer Family (SFTP Connector), Amazon S3, AWS Secrets Manager, AWS KMS, Amazon CloudWatch.',
  '* **Exception handling:** Any requirement deviation (e.g., legacy vendor requiring password auth or custom ciphers) must be approved via the Enterprise Architecture Review Board (EARB) and Global Information Security.',
].join('\n');

const SECURITY_MD = [
  '* **Authentication model:**',
  '  * Asymmetric SSH Key Pair authentication. Public key is provided out-of-band to the vendor; private key (RSA 2048/4096-bit or ED25519) is stored exclusively in AWS Secrets Manager.',
  '* **Authorization model:**',
  '  * Dedicated least-privilege IAM Roles generated per connector:',
  '    * `Connector Access Role`: `{ENV_ID}-{APMS_ID}-{REGION_CODE}-TRANSFER-CONNECTOR-ACCESS-ROLE` (scoped to target bucket ARN, specific Secret ARN, and KMS key).',
  '    * `Connector Logging Role`: `{ENV_ID}-{APMS_ID}-{REGION_CODE}-TRANSFER-CONNECTOR-LOGGING-ROLE` (scoped to `/aws/transfer/*`).',
  '* **Host Verification:** Strict host key checking against `connector_trusted_host_keys`.',
  '* **Encryption requirements:**',
  '  * *In Transit:* SSH protocol encrypted with approved ciphers (AES-GCM / ChaCha20-Poly1305).',
  '  * *At Rest:* S3 storage and Secrets Manager encrypted with AWS KMS (`TEC-S3` alias key).',
  '* **Logging and auditability:**',
  '  * Complete connection lifecycle and byte counts logged to CloudWatch.',
  '  * All management and transfer API calls recorded in AWS CloudTrail.',
].join('\n');

// ---------------------------------------------------------------------------

function excerptOf(markdown) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ') // drop fenced code blocks (diagram noise)
    .replace(/[|#*`_>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
}

const ATTRIBUTE_VALUES = {
  context: CONTEXT_MD,
  problem: PROBLEM_MD,
  applicability: APPLICABILITY_MD,
  overview: OVERVIEW_MD,
  structure: STRUCTURE_MD,
  standards: STANDARDS_MD,
  security: SECURITY_MD,
};

const PATTERN_NAME = 'AWS Transfer Family SFTP Connector Pattern';
const PATTERN_OWNER = 'Peter Malinič · DCE Cloud Platform Team / Cloud Platform Engineering';
// Placeholder — the supplied export didn't include the page's real GitHub URL. Update once known.
const SOURCE_URL = 'https://github.com/oneTakeda/terraform-aws-TransferFamily';

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
       VALUES ($1, 'data_integration', $2, 'github', $3, now() - interval '1 day', now() - interval '1 hour', 'authored')
       RETURNING patt_pattern_id`,
      [PATTERN_NAME, PATTERN_OWNER, SOURCE_URL],
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
