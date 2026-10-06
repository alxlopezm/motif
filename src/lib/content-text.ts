import 'server-only';

/**
 * Best-effort plain-text extraction from a jsonb attribute value of unknown shape — a plain
 * string, an ADF document, a plain array, or anything else the sync pipeline might produce.
 * Used wherever a short, safe text preview is needed (e.g. the Patterns list row description)
 * regardless of the pattern's source-specific rich format, so a caller never has to assume the
 * value is a string just because it usually is.
 *
 * Deliberately has no dependency on the ADF type definitions in components/content/ — this is
 * lib code, not UI code — so it walks generically for anything shaped like `{ text }` or
 * `{ content: [...] }`, which happens to cover ADF (and most similar rich-text JSON schemas)
 * without needing to know about ADF specifically.
 */
export function extractPlainText(value: unknown, maxLength = 200): string | null {
  const text = flatten(value).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function flatten(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(flatten).join(' ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (Array.isArray(obj.content)) return obj.content.map(flatten).join(' ');
  }
  return '';
}
