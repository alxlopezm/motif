import styles from './pattern-map.module.css';
import type { GraphInitiative } from '@/lib/pattern-graph';

/**
 * design/pattern-map/README.md § 4 "Selected initiative detail". The description slot maps
 * onto this app's `patt_initiative_patterns.inpa_note` — the note recorded on the specific
 * initiative↔pattern link, which already plays exactly that role (e.g. "Primary delivery
 * pattern for outbound vendor file exchange.").
 */
export function InitiativeDetail({ initiative }: { initiative: GraphInitiative }) {
  return (
    <div className={styles.detail}>
      <div className={styles.detailLabel}>
        <span>Selected initiative</span>
        <span className={styles.detailName}>{initiative.name}</span>
      </div>
      <div className={styles.detailBody}>{initiative.note ?? 'No note recorded for this link.'}</div>
    </div>
  );
}
