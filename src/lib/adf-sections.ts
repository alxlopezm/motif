// Deliberately NOT `server-only` — runs in the browser, inside UploadPatternWizard, so an
// uploaded ADF file never needs a server round-trip just to be split and previewed.

import type { AdfDoc, AdfNode } from '@/components/content/adf-types';

export interface DetectedSection {
  /** Stable key for React lists and for carrying the admin's mapping choice between renders. */
  key: string;
  headingText: string;
  preview: string;
  content: AdfNode[];
}

/**
 * Splits an ADF document into sections at each top-level (`level === 1`) heading — matching
 * how the real Confluence exports used earlier this session were structured ("1. Introduction",
 * "2. Pattern Identity", ...). A document with no level-1 headings becomes a single section, so
 * there's always at least one for the admin to assign.
 */
export function splitAdfIntoSections(doc: AdfDoc): DetectedSection[] {
  const nodes = doc.content ?? [];
  const sections: { headingText: string; content: AdfNode[] }[] = [];

  for (const node of nodes) {
    if (node.type === 'heading' && node.attrs?.level === 1) {
      sections.push({ headingText: textOf(node), content: [] });
      continue;
    }
    if (sections.length === 0) sections.push({ headingText: '(start of document)', content: [] });
    sections[sections.length - 1].content.push(node);
  }

  if (sections.length === 0) sections.push({ headingText: '(whole document)', content: nodes });

  return sections.map((s, i) => ({
    key: `${i}-${s.headingText}`,
    headingText: s.headingText,
    preview: previewText(s.content),
    content: s.content,
  }));
}

const KEYWORDS: Record<string, string[]> = {
  context: ['business and technology', 'context', 'drivers'],
  problem: ['problem'],
  applicability: ['applicability', 'decision criteria', 'when to use'],
  overview: ['architecture overview', 'overview'],
  structure: ['structure', 'components'],
  standards: ['standards', 'mandatory requirements'],
  security: ['security', 'privacy', 'risk', 'compliance'],
};

/** Best-effort guess at which attribute code a section's heading belongs to, or null. */
export function guessAttributeCode(headingText: string, codes: readonly string[]): string | null {
  const lower = headingText.toLowerCase();
  let best: { code: string; length: number } | null = null;
  for (const code of codes) {
    for (const keyword of KEYWORDS[code] ?? []) {
      if (lower.includes(keyword) && (!best || keyword.length > best.length)) {
        best = { code, length: keyword.length };
      }
    }
  }
  return best?.code ?? null;
}

function textOf(node: AdfNode): string {
  if (typeof node.text === 'string') return node.text;
  if (!node.content) return '';
  return node.content.map(textOf).join(' ');
}

/** Small local equivalent of content-text.ts's flatten — that file is `server-only`-tagged. */
function previewText(nodes: AdfNode[], maxLength = 160): string {
  const text = nodes
    .map(textOf)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
