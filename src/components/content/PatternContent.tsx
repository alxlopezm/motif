import type { AttributeRow } from '@/lib/patterns';
import { AttributeValue } from '@/components/AttributeValue';
import { AdfContent } from './AdfContent';
import { MergedMarkdownContent } from './MarkdownContent';
import { SectionStatus } from './SectionStatus';
import { mergeAdf, mergeGeneric, mergeMarkdown, sectionId } from './merge';

/**
 * Renders a pattern's attributes as one continuous document that mimics its source system,
 * rather than a list of separate per-attribute cards — with the governance signal (extraction
 * method, missing required attributes, source excerpts) kept visible via SectionStatus above the
 * document, not lost in the merge. The underlying `patt_attribute_values` rows are untouched;
 * this merge happens at render time only.
 */
export function PatternContent({ attributes, sourceSystem }: { attributes: AttributeRow[]; sourceSystem: string }) {
  if (sourceSystem === 'confluence') {
    const { content, includedCodes } = mergeAdf(attributes);
    return (
      <>
        <SectionStatus attributes={attributes} includedCodes={includedCodes} />
        {content.content && content.content.length > 0 ? (
          <AdfContent doc={content} />
        ) : (
          <p className="muted">No content in a recognized format for this pattern.</p>
        )}
      </>
    );
  }

  if (sourceSystem === 'github') {
    const { content, includedCodes } = mergeMarkdown(attributes);
    return (
      <>
        <SectionStatus attributes={attributes} includedCodes={includedCodes} />
        {content.length > 0 ? (
          <MergedMarkdownContent sections={content} />
        ) : (
          <p className="muted">No content in a recognized format for this pattern.</p>
        )}
      </>
    );
  }

  const { content, includedCodes } = mergeGeneric(attributes);
  return (
    <>
      <SectionStatus attributes={attributes} includedCodes={includedCodes} />
      {content.length > 0 ? (
        <div className="doc-body">
          {content.map((a) => (
            <section key={a.typeId} id={sectionId(a.code)}>
              <h2>{a.name}</h2>
              <AttributeValue value={a.value} />
            </section>
          ))}
        </div>
      ) : (
        <p className="muted">No content to show.</p>
      )}
    </>
  );
}
