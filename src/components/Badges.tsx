import {
  EXTRACTION_LABELS,
  STATUS_LABELS,
  type ExtractionMethod,
  type PatternStatus,
} from '@/lib/constants';

export function StatusBadge({ status }: { status: PatternStatus }) {
  return (
    <span className={`badge status-${status}`}>
      {status === 'approved' ? '✓ ' : ''}
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ExtractionBadge({ method }: { method: ExtractionMethod }) {
  const prefix = method === 'inferred_from_text' ? '⚠ ' : method === 'missing' ? '✕ ' : '';
  return (
    <span className={`badge method-${method}`} title={EXTRACTION_LABELS[method]}>
      {prefix}
      {EXTRACTION_LABELS[method]}
    </span>
  );
}
