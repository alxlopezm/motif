/**
 * Minimal local types for Atlassian Document Format (ADF) — just the shapes this renderer
 * actually handles. Deliberately hand-written rather than pulling in `@atlaskit/adf-schema`
 * (part of the large Atlaskit design-system monorepo): this app only needs to read a JSON tree
 * and render the standard node/mark set, not author or validate documents.
 */

export interface AdfDoc {
  type: 'doc';
  version?: number;
  content?: AdfNode[];
}

export interface AdfMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface AdfNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  marks?: AdfMark[];
  text?: string;
}

/** True for anything that looks like a top-level ADF document (not a proof it's well-formed). */
export function isAdfDoc(value: unknown): value is AdfDoc {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'doc' &&
    Array.isArray((value as { content?: unknown }).content)
  );
}
