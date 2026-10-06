import { Fragment, type ReactNode } from 'react';
import { safeExternalUrl } from '@/lib/format';
import type { AdfDoc, AdfMark, AdfNode } from './adf-types';

/**
 * Renders Atlassian Document Format (ADF) content — Confluence Cloud's native page format —
 * as React elements. Deliberately hand-rolled rather than pulling in Atlassian's own
 * `@atlaskit/renderer` (heavy dependency tree, its own CSS-in-JS styling to reconcile with this
 * app's plain CSS). Walks a known, finite set of node/mark types; everything else falls back to
 * rendering its inner content (or is skipped) rather than being interpreted as markup — there is
 * no `dangerouslySetInnerHTML` anywhere in this file, so there is no HTML-injection surface here
 * regardless of what the sync pipeline hands us.
 *
 * Confluence macros (info/warning panels, expand, embedded code, …) surface in ADF as
 * `extension` / `bodiedExtension` / `inlineExtension` nodes keyed by macro name. `bodiedExtension`
 * content is rendered plainly (losing the macro's chrome, keeping its text); bare `extension` /
 * `inlineExtension` nodes have no renderable body, so they render a small, honest placeholder
 * rather than silently disappearing.
 */
export function AdfContent({ doc }: { doc: AdfDoc }) {
  return <div className="adf-body">{renderNodes(doc.content, 'root')}</div>;
}

function renderNodes(nodes: AdfNode[] | undefined, keyPrefix: string): ReactNode {
  if (!nodes || nodes.length === 0) return null;
  return nodes.map((node, i) => <Fragment key={`${keyPrefix}-${i}`}>{renderNode(node, `${keyPrefix}-${i}`)}</Fragment>);
}

function textOf(node: AdfNode): string {
  if (typeof node.text === 'string') return node.text;
  if (!node.content) return '';
  return node.content.map(textOf).join('');
}

function attr(node: AdfNode, name: string): unknown {
  return node.attrs?.[name];
}

function renderNode(node: AdfNode, key: string): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p>{renderNodes(node.content, key) ?? ' '}</p>;

    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(attr(node, 'level')) || 1));
      const Tag = (`h${level}` as unknown) as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const localId = attr(node, 'localId');
      return <Tag id={typeof localId === 'string' ? localId : undefined}>{renderNodes(node.content, key)}</Tag>;
    }

    case 'text':
      return renderMarks(node.text ?? '', node.marks);

    case 'hardBreak':
      return <br />;

    case 'rule':
      return <hr />;

    case 'bulletList':
      return <ul>{renderNodes(node.content, key)}</ul>;

    case 'orderedList': {
      const start = Number(attr(node, 'order'));
      return <ol start={Number.isFinite(start) && start > 0 ? start : undefined}>{renderNodes(node.content, key)}</ol>;
    }

    case 'listItem':
      return <li>{renderNodes(node.content, key)}</li>;

    case 'taskList':
      return <ul className="adf-tasklist">{renderNodes(node.content, key)}</ul>;

    case 'taskItem':
      return (
        <li>
          <label className="adf-task">
            <input type="checkbox" checked={attr(node, 'state') === 'DONE'} disabled readOnly />
            {renderNodes(node.content, key)}
          </label>
        </li>
      );

    case 'blockquote':
      return <blockquote>{renderNodes(node.content, key)}</blockquote>;

    case 'codeBlock': {
      const language = attr(node, 'language');
      return (
        <pre className="adf-codeblock">
          <code data-language={typeof language === 'string' ? language : undefined}>{textOf(node)}</code>
        </pre>
      );
    }

    case 'panel': {
      const panelType = typeof attr(node, 'panelType') === 'string' ? (attr(node, 'panelType') as string) : 'note';
      return <div className={`adf-panel adf-panel-${panelType}`}>{renderNodes(node.content, key)}</div>;
    }

    case 'expand':
    case 'nestedExpand': {
      const title = attr(node, 'title');
      return (
        <details className="adf-expand">
          <summary>{typeof title === 'string' && title ? title : 'Expand'}</summary>
          {renderNodes(node.content, key)}
        </details>
      );
    }

    case 'table':
      return (
        <div className="table-wrap">
          <table>
            <tbody>{renderNodes(node.content, key)}</tbody>
          </table>
        </div>
      );
    case 'tableRow':
      return <tr>{renderNodes(node.content, key)}</tr>;
    case 'tableHeader':
      return <th>{renderNodes(node.content, key)}</th>;
    case 'tableCell':
      return <td>{renderNodes(node.content, key)}</td>;

    case 'mediaSingle':
    case 'mediaGroup':
      return <div className="adf-media">{renderNodes(node.content, key)}</div>;
    case 'media': {
      const altAttr = attr(node, 'alt');
      const alt = typeof altAttr === 'string' && altAttr ? altAttr : 'embedded file';
      // Media nodes reference a Confluence attachment id, not a fetchable URL — this app has no
      // attachment-serving path, so it names what was there rather than trying to render it.
      return <span className="badge method-missing">Image: {alt}</span>;
    }

    case 'status': {
      const text = attr(node, 'text');
      return <span className="badge status-under_review">{typeof text === 'string' ? text : 'Status'}</span>;
    }

    case 'emoji': {
      const shortName = attr(node, 'shortName');
      const emojiText = attr(node, 'text');
      return <>{typeof emojiText === 'string' && emojiText ? emojiText : typeof shortName === 'string' ? shortName : ''}</>;
    }

    case 'mention': {
      const text = attr(node, 'text');
      const id = attr(node, 'id');
      return <span className="adf-mention">{typeof text === 'string' && text ? text : `@${String(id ?? 'mention')}`}</span>;
    }

    case 'date': {
      const ts = Number(attr(node, 'timestamp'));
      if (!Number.isFinite(ts)) return null;
      return <span>{new Date(ts).toISOString().slice(0, 10)}</span>;
    }

    // Confluence macros. Bodied ones still have real content worth showing; bare ones don't.
    case 'bodiedExtension':
      return renderNodes(node.content, key);
    case 'extension':
    case 'inlineExtension': {
      const extensionTitle = attr(node, 'extensionKey') ?? attr(node, 'text');
      return (
        <span className="badge method-inferred_from_text" title="Not rendered in this app">
          Unsupported content{typeof extensionTitle === 'string' ? `: ${extensionTitle}` : ''}
        </span>
      );
    }

    default:
      // Unknown node type: best-effort passthrough of its children so genuinely unfamiliar
      // wrapper nodes don't silently swallow real content.
      return renderNodes(node.content, key);
  }
}

function renderMarks(text: string, marks: AdfMark[] | undefined): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((child, mark) => {
    switch (mark.type) {
      case 'strong':
        return <strong>{child}</strong>;
      case 'em':
        return <em>{child}</em>;
      case 'code':
        return <code>{child}</code>;
      case 'strike':
        return <s>{child}</s>;
      case 'underline':
        return <u>{child}</u>;
      case 'subsup': {
        const sup = mark.attrs?.type === 'sup';
        return sup ? <sup>{child}</sup> : <sub>{child}</sub>;
      }
      case 'link': {
        const href = typeof mark.attrs?.href === 'string' ? safeExternalUrl(mark.attrs.href) : null;
        return href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {child}
          </a>
        ) : (
          child
        );
      }
      // textColor / backgroundColor: intentionally not applied, to keep rendered content visually
      // consistent with the app's own palette rather than importing arbitrary source colors.
      default:
        return child;
    }
  }, text);
}
