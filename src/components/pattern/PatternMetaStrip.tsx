import styles from './pattern-map.module.css';

/**
 * design/pattern-map/README.md § 2 Metadata strip. Direct replacement for the old
 * `<dl className="meta">` block — same four fields this redesign keeps (Owner, Source
 * system, Source last modified, Last synced); Category and Status moved into the header.
 */
export function PatternMetaStrip({
  owner,
  sourceName,
  sourceLastModified,
  lastSynced,
}: {
  owner: string;
  sourceName: string;
  sourceLastModified: string;
  lastSynced: string;
}) {
  const cells: Array<[string, string]> = [
    ['Owner', owner],
    ['Source system', sourceName],
    ['Source last modified', sourceLastModified],
    ['Last synced', lastSynced],
  ];

  return (
    <div className={styles.metaStrip}>
      {cells.map(([label, value]) => (
        <div className={styles.metaCell} key={label}>
          <span className={styles.metaLabel}>{label}</span>
          <span className={styles.metaValue}>{value}</span>
        </div>
      ))}
    </div>
  );
}
