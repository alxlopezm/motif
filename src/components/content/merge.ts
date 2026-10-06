import type { AttributeRow } from '@/lib/patterns';
import { isAdfDoc, type AdfDoc, type AdfNode } from './adf-types';

/** Stable per-attribute anchor id, shared by the status strip's links and every merge function's
 * headings — deterministic from the attribute's own code, not derived from rendered text, so it
 * never depends on a slugification algorithm matching between two separate render passes. */
export function sectionId(code: string): string {
  return `attr-${code}`;
}

/** 'missing' (or an empty value) contributes nothing to the merged body — there's no content to
 * merge in. It still gets a row in the status strip; it just isn't a section of the document. */
function renderableAttributes(attributes: AttributeRow[]): AttributeRow[] {
  return attributes.filter((a) => a.method !== 'missing' && a.value !== null && a.value !== undefined);
}

export interface MergeResult<T> {
  content: T;
  /** Attribute codes that actually made it into `content` as a linkable section — everything
   * else (missing, or present but the wrong shape for this source) is flagged in the status
   * strip without a working anchor into the body. */
  includedCodes: Set<string>;
}

export interface MarkdownSection {
  code: string;
  id: string;
  name: string;
  text: string;
}

/**
 * Splits attribute values into ordered Markdown sections, one per attribute, in
 * `attr_display_order`. Deliberately does NOT concatenate them into one string and hand it to a
 * single parser: a section's own content can (and, in practice, does) contain its own `##`/`###`
 * headings, which would collide with a synthetic wrapper heading built the same way — reliably
 * telling "my section heading" apart from "a heading that happens to be inside the content" after
 * everything's been flattened into one string is not reliably solvable by counting headings.
 * MarkdownContent instead renders one section at a time, each with a heading it controls
 * directly, so there's no reparse step to lose that distinction across.
 */
export function mergeMarkdown(attributes: AttributeRow[]): MergeResult<MarkdownSection[]> {
  const sections: MarkdownSection[] = [];
  for (const a of renderableAttributes(attributes)) {
    if (typeof a.value !== 'string' || a.value.trim().length === 0) continue;
    sections.push({ code: a.code, id: sectionId(a.code), name: a.name, text: a.value.trim() });
  }
  return { content: sections, includedCodes: new Set(sections.map((s) => s.code)) };
}

/** Combines every attribute's ADF into one document: a heading node (carrying the section's
 * anchor id as ADF's own `localId` attribute) followed by that attribute's content nodes, per
 * attribute, in `attr_display_order`. */
export function mergeAdf(attributes: AttributeRow[]): MergeResult<AdfDoc> {
  const content: AdfNode[] = [];
  const includedCodes = new Set<string>();

  for (const a of renderableAttributes(attributes)) {
    if (!isAdfDoc(a.value)) continue;
    content.push({
      type: 'heading',
      attrs: { level: 2, localId: sectionId(a.code) },
      content: [{ type: 'text', text: a.name }],
    });
    content.push(...(a.value.content ?? []));
    includedCodes.add(a.code);
  }

  return { content: { type: 'doc', version: 1, content }, includedCodes };
}

/** No rich format to merge into (plain text / anything that doesn't match its source's expected
 * shape) — every non-missing attribute renders, in order, via the existing generic renderer. */
export function mergeGeneric(attributes: AttributeRow[]): MergeResult<AttributeRow[]> {
  const rendered = renderableAttributes(attributes);
  return { content: rendered, includedCodes: new Set(rendered.map((a) => a.code)) };
}
