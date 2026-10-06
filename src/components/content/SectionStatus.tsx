import type { AttributeRow } from '@/lib/patterns';
import { ExtractionBadge } from '@/components/Badges';
import { sectionId } from './merge';

/**
 * The governance signal for the merged, continuous-document view: one row per attribute (in
 * display order), always visible above the document rather than tucked behind a toggle — a
 * reviewer should see at a glance which sections were sourced directly, which were AI-inferred,
 * and which required sections are missing entirely, without having to opt into a detail view.
 * Section names link down into the document; a 'missing' attribute, or one whose value didn't
 * match its source's expected shape, has no corresponding section to link to, so it's plain text.
 */
export function SectionStatus({ attributes, includedCodes }: { attributes: AttributeRow[]; includedCodes: Set<string> }) {
  return (
    <div className="table-wrap section-status">
      <table>
        <thead>
          <tr>
            <th>Section</th>
            <th>Extraction</th>
            <th>Excerpt</th>
          </tr>
        </thead>
        <tbody>
          {attributes.map((a) => {
            const linked = includedCodes.has(a.code);
            return (
              <tr key={a.typeId}>
                <td title={a.description ?? undefined}>
                  {linked ? (
                    <a href={`#${sectionId(a.code)}`}>{a.name}</a>
                  ) : (
                    <span>{a.name}</span>
                  )}
                  {a.isRequired && <span title="Required attribute"> *</span>}
                  {!linked && a.method !== 'missing' && (
                    <span className="small muted"> (not shown below — unexpected format)</span>
                  )}
                </td>
                <td>
                  <ExtractionBadge method={a.method} />
                </td>
                <td>
                  {a.excerpt ? (
                    <details className="excerpt">
                      <summary>Show</summary>
                      <blockquote>{a.excerpt}</blockquote>
                    </details>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
