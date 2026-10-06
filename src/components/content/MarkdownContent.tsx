import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeExternalUrl } from '@/lib/format';
import type { MarkdownSection } from './merge';

/**
 * Renders GitHub-flavored Markdown, styled to read like GitHub's rendered `.md` view.
 *
 * `react-markdown` parses to a markdown AST and renders that AST directly as React elements —
 * it never interprets a string as HTML, so raw HTML embedded in the source markdown is not
 * rendered as markup (it's dropped) rather than needing a separate sanitization pass. No syntax
 * highlighting for fenced code blocks in this first pass — plain monospace, matching how
 * SharePoint content is shown elsewhere on this page — can be added later if needed.
 */

const components: Components = {
  // react-markdown passes the underlying AST `node` alongside real DOM props to custom
  // renderers — it must be destructured out, not spread, or it leaks onto the DOM element as a
  // stray `node="[object Object]"` attribute.
  a({ node: _node, href, children, ...domProps }) {
    const safe = typeof href === 'string' ? safeExternalUrl(href) : null;
    if (!safe) return <>{children}</>;
    return (
      <a {...domProps} href={safe} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  img({ node: _node, src, alt, ...domProps }) {
    const safe = typeof src === 'string' ? safeExternalUrl(src) : null;
    if (!safe) return <span className="badge method-missing">Image: {alt || 'unavailable'}</span>;
    // eslint-disable-next-line @next/next/no-img-element -- external, unconfigured-domain source
    return <img {...domProps} src={safe} alt={alt ?? ''} loading="lazy" />;
  },
};

/**
 * Renders a single Markdown string (one attribute's value, unmerged).
 */
export function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Renders several attributes' Markdown as one continuous document — a heading this component
 * controls directly (carrying the section's stable anchor id), followed by that section's own
 * `ReactMarkdown` render, per section. Each section gets its own parse pass rather than being
 * concatenated into one string first: see mergeMarkdown's docstring for why that matters (a
 * section's own content can contain its own `##`/`###` headings).
 */
export function MergedMarkdownContent({ sections }: { sections: MarkdownSection[] }) {
  return (
    <div className="markdown-body">
      {sections.map((s) => (
        <section key={s.code} id={s.id}>
          <h2>{s.name}</h2>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {s.text}
          </ReactMarkdown>
        </section>
      ))}
    </div>
  );
}
