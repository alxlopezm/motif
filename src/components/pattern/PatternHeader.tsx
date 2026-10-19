import styles from './pattern-map.module.css';

/**
 * design/pattern-map/README.md, "Screen: Pattern detail" § 1 Header — kicker, title, status
 * tag, and the primary "Open in {source}" button + caption. This is the redesign's direct
 * replacement for the old `.page-head` title block and `.source-link` banner; the copy and
 * the underlying `sourceUrl`/`sourceName` values are unchanged (same `safeExternalUrl`-checked
 * link, same federated-summary wording), only the layout and visual style are new.
 */
export function PatternHeader({
  name,
  categoryLabel,
  statusLabel,
  sourceName,
  sourceUrl,
}: {
  name: string;
  categoryLabel: string;
  statusLabel: string;
  sourceName: string;
  sourceUrl: string | null;
}) {
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <span className={styles.kicker}>Architecture pattern · {categoryLabel}</span>
        <h1 className={styles.title}>{name}</h1>
        <span className={`${styles.tag} ${styles.tagOutline}`}>{statusLabel}</span>
      </div>
      <div className={styles.headerRight}>
        {sourceUrl ? (
          <a className={styles.btnPrimary} href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Open in {sourceName}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M7 7h10v10" />
              <path d="M7 17 17 7" />
            </svg>
          </a>
        ) : (
          <span className={`${styles.tag} ${styles.tagNeutral}`}>Source link unavailable</span>
        )}
        <p className={styles.caption}>
          This page shows the federated summary only. The full pattern document lives in {sourceName}.
        </p>
      </div>
    </div>
  );
}
