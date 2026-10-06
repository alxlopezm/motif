export const ROLES = ['pattern_owner', 'ea_reviewer', 'arb_member', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PATTERN_STATUSES = [
  'draft',
  'review_requested',
  'under_review',
  'approved',
  'rejected',
  'changes_requested',
] as const;
export type PatternStatus = (typeof PATTERN_STATUSES)[number];

export const CATEGORIES = [
  'data_integration',
  'data_ingestion',
  'web_application',
  'cloud_application',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DECISIONS = ['approved', 'rejected', 'changes_requested'] as const;
export type Decision = (typeof DECISIONS)[number];

export const EXTRACTION_METHODS = ['direct_field_match', 'inferred_from_text', 'missing'] as const;
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

export const ROLE_LABELS: Record<Role, string> = {
  pattern_owner: 'Pattern owner',
  ea_reviewer: 'EA reviewer',
  arb_member: 'ARB member',
  viewer: 'Viewer',
};

export const STATUS_LABELS: Record<PatternStatus, string> = {
  draft: 'Draft',
  review_requested: 'Review requested',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  data_integration: 'Data integration',
  data_ingestion: 'Data ingestion',
  web_application: 'Web application',
  cloud_application: 'Cloud application',
};

export const SOURCE_LABELS: Record<string, string> = {
  confluence: 'Confluence',
  sharepoint: 'SharePoint',
  github: 'GitHub',
};

export const EXTRACTION_LABELS: Record<ExtractionMethod, string> = {
  direct_field_match: 'Sourced (direct field match)',
  inferred_from_text: 'AI-inferred from text',
  missing: 'Missing',
};

export const DECISION_LABELS: Record<Decision, string> = {
  approved: 'Approve',
  rejected: 'Reject',
  changes_requested: 'Request changes',
};

export const PAGE_SIZE = 25;
export const COMMENT_MAX_LENGTH = 4000;
