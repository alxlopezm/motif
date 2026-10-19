'use client';

import { useMemo, useState } from 'react';
import styles from './pattern-map.module.css';
import { InitiativeDetail } from './InitiativeDetail';
import type { PatternGraph, GraphNode } from '@/lib/pattern-graph';
import type { BusinessUnit } from '@/lib/constants';

/**
 * design/pattern-map/README.md § 3 "Relationship map" (option 1a). ≥1120px: an absolutely
 * positioned SVG of cubic-bezier connectors behind absolutely positioned node boxes, laid out
 * from `graph` by the column/row formulas in the spec, generalized from the mockup's fixed
 * counts to however many apps/initiatives/techs this pattern's real data has. <760px: the
 * `.mobileList` stacked fallback (no SVG) takes over via the CSS module's media query — see
 * its definition for the two intermediate-width behaviour, this skips the spec's optional
 * 760–1119px fluid rescale and instead lets the desktop map scroll horizontally
 * (`.canvasScroll { overflow-x: auto }`), a deliberate scope cut for a rarely-hit width band.
 *
 * Selection is plain client state (no URL mirroring) — every app/tech/initiative needed to
 * render the detail strip is already in `graph`, so there's no value in a server round-trip
 * for what the README calls an "optional" enhancement.
 */

const APP_X = 0;
const INITIATIVE_X = 420;
const TECH_X = 840;
const COLUMN_WIDTH = 280;
const CANVAS_WIDTH = 1120;

const APP_HEIGHT = 48;
const APP_PITCH = 64;
const INITIATIVE_HEIGHT = 64;
const INITIATIVE_PITCH = 80;
const TECH_HEIGHT = 48;
const TECH_PITCH = 80;

function columnLayout(count: number, nominalPitch: number, totalHeight: number) {
  if (count === 0) return { pitch: nominalPitch, centerY: (_i: number) => 0 };
  const pitch = totalHeight / count;
  return { pitch, centerY: (i: number) => pitch * i + pitch / 2 };
}

function appTagClass(disposition: string): string {
  switch (disposition) {
    case 'INVEST':
      return styles.tagOutline;
    case 'TOLERATE':
      return styles.tagNeutral;
    case 'MIGRATE':
    case 'ELIMINATE':
      return styles.tagAccent;
    default:
      return styles.tagNeutral;
  }
}

function techTagClass(disposition: string): string {
  switch (disposition) {
    case 'APPROVED':
      return styles.tagOutline;
    case 'REPLACED':
    case 'NOT APPROVED':
      return styles.tagAccent;
    default:
      return styles.tagNeutral;
  }
}

export function RelationshipMap({
  graph,
  businessUnitLabels,
}: {
  graph: PatternGraph;
  businessUnitLabels: Record<BusinessUnit, string>;
}) {
  const [selectedId, setSelectedId] = useState(graph.initiatives[0]?.id ?? null);
  const selected = graph.initiatives.find((i) => i.id === selectedId) ?? graph.initiatives[0];

  const totalHeight = Math.max(
    graph.apps.length * APP_PITCH,
    graph.initiatives.length * INITIATIVE_PITCH,
    graph.techs.length * TECH_PITCH,
  );

  const appLayout = columnLayout(graph.apps.length, APP_PITCH, totalHeight);
  const initiativeLayout = columnLayout(graph.initiatives.length, INITIATIVE_PITCH, totalHeight);
  const techLayout = columnLayout(graph.techs.length, TECH_PITCH, totalHeight);

  const appIndex = useMemo(() => new Map(graph.apps.map((a, i) => [a.id, i])), [graph.apps]);
  const techIndex = useMemo(() => new Map(graph.techs.map((t, i) => [t.id, i])), [graph.techs]);

  interface Link {
    key: string;
    d: string;
    stroke: string;
  }
  const baseLinks: Link[] = [];
  const selectedLinks: Link[] = [];

  graph.initiatives.forEach((initiative, i) => {
    const yI = initiativeLayout.centerY(i);
    const isSelected = initiative.id === selected?.id;

    for (const appId of initiative.appIds) {
      const ai = appIndex.get(appId);
      if (ai === undefined) continue;
      const yA = appLayout.centerY(ai);
      const midX = (INITIATIVE_X + (APP_X + COLUMN_WIDTH)) / 2;
      const d = `M ${INITIATIVE_X} ${yI} C ${midX} ${yI} ${midX} ${yA} ${APP_X + COLUMN_WIDTH} ${yA}`;
      const link = { key: `a-${initiative.id}-${appId}`, d, stroke: 'var(--color-neutral-400)' };
      (isSelected ? selectedLinks : baseLinks).push(isSelected ? { ...link, stroke: 'var(--color-accent)' } : link);
    }

    for (const techId of initiative.techIds) {
      const ti = techIndex.get(techId);
      if (ti === undefined) continue;
      const yT = techLayout.centerY(ti);
      const midX = ((INITIATIVE_X + COLUMN_WIDTH) + TECH_X) / 2;
      const d = `M ${INITIATIVE_X + COLUMN_WIDTH} ${yI} C ${midX} ${yI} ${midX} ${yT} ${TECH_X} ${yT}`;
      const isCore = graph.techs[ti]?.isCore ?? false;
      const stroke = isSelected ? 'var(--color-accent)' : isCore ? 'var(--color-accent-300)' : 'var(--color-neutral-400)';
      const link = { key: `t-${initiative.id}-${techId}`, d, stroke };
      (isSelected ? selectedLinks : baseLinks).push(link);
    }
  });

  if (graph.initiatives.length === 0) {
    return <p className={styles.emptyRow}>No initiatives use this pattern yet.</p>;
  }

  return (
    <div className={styles.mapSection}>
      <div className={styles.columnHeaders}>
        <span>Applications · {graph.apps.length}</span>
        <span />
        <span>Initiatives · {graph.initiatives.length}</span>
        <span />
        <span>Technology components · {graph.techs.length}</span>
      </div>

      <div className={styles.canvasScroll}>
        <div className={styles.canvas} style={{ height: totalHeight }}>
          <svg className={styles.svg} width={CANVAS_WIDTH} height={totalHeight} fill="none" strokeWidth={2} aria-hidden="true">
            {baseLinks.map((l) => (
              <path key={l.key} d={l.d} stroke={l.stroke} />
            ))}
            {selectedLinks.map((l) => (
              <path key={l.key} d={l.d} stroke={l.stroke} />
            ))}
          </svg>

          {graph.apps.map((app, i) => {
            const linked = selected?.appIds.includes(app.id) ?? false;
            return (
              <div
                key={app.id}
                className={`${styles.node} ${styles.appNode} ${linked ? styles.appNodeLinked : ''}`}
                style={{ left: APP_X, top: appLayout.centerY(i) - APP_HEIGHT / 2, width: COLUMN_WIDTH, height: APP_HEIGHT }}
              >
                <span className={`${styles.appName} ${linked ? styles.appNameLinked : ''}`}>{app.name}</span>
                <span className={`${styles.tag} ${appTagClass(app.disposition)}`}>{app.disposition}</span>
              </div>
            );
          })}

          {graph.initiatives.map((initiative, i) => {
            const isSelected = initiative.id === selected?.id;
            return (
              <button
                key={initiative.id}
                type="button"
                onClick={() => setSelectedId(initiative.id)}
                aria-pressed={isSelected}
                aria-describedby={`initiative-components-${initiative.id}`}
                className={`${styles.node} ${styles.initiativeNode} ${isSelected ? styles.initiativeNodeSelected : ''}`}
                style={{
                  left: INITIATIVE_X,
                  top: initiativeLayout.centerY(i) - INITIATIVE_HEIGHT / 2,
                  width: COLUMN_WIDTH,
                  height: INITIATIVE_HEIGHT,
                }}
              >
                <span className={styles.initiativeName}>{initiative.name}</span>
                <span className={styles.initiativeSub}>
                  {businessUnitLabels[initiative.businessUnit] ?? initiative.businessUnit} · {initiative.sponsorEmail}
                </span>
              </button>
            );
          })}

          {graph.techs.map((tech, i) => (
            <div
              key={tech.id}
              className={`${styles.node} ${styles.techNode} ${tech.isCore ? styles.techNodeCore : ''}`}
              style={{ left: TECH_X, top: techLayout.centerY(i) - TECH_HEIGHT / 2, width: COLUMN_WIDTH, height: TECH_HEIGHT }}
            >
              <span className={styles.techStack}>
                <span className={styles.techName}>{tech.name}</span>
                <span className={styles.techVendor}>
                  {tech.vendorName ?? '—'}
                  {tech.isCore ? ` · used by ${tech.usedBy} of ${graph.initiatives.length}` : ''}
                </span>
              </span>
              {tech.isCore ? (
                <span className={styles.coreLifecycle}>{tech.disposition}</span>
              ) : (
                <span className={`${styles.tag} ${techTagClass(tech.disposition)}`}>{tech.disposition}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Visually-hidden equivalent of the map, for screen readers (the SVG is aria-hidden). */}
      <ul className={styles.srOnly}>
        {graph.initiatives.map((initiative) => (
          <li key={initiative.id} id={`initiative-components-${initiative.id}`}>
            {initiative.name} uses{' '}
            {initiative.appIds.map((id) => graph.apps.find((a) => a.id === id)?.name).filter(Boolean).join(', ') ||
              'no applications'}{' '}
            and{' '}
            {initiative.techIds.map((id) => graph.techs.find((t) => t.id === id)?.name).filter(Boolean).join(', ') ||
              'no technology components'}
            .
          </li>
        ))}
      </ul>

      {/* <760px fallback — same data, no SVG. */}
      <div className={styles.mobileList}>
        {graph.initiatives.map((initiative) => (
          <div key={initiative.id} className={styles.mobileInitiative}>
            <button
              type="button"
              onClick={() => setSelectedId(initiative.id)}
              className={`${styles.node} ${styles.initiativeNode} ${
                initiative.id === selected?.id ? styles.initiativeNodeSelected : ''
              }`}
              style={{ position: 'static', width: '100%', height: INITIATIVE_HEIGHT }}
            >
              <span className={styles.initiativeName}>{initiative.name}</span>
              <span className={styles.initiativeSub}>
                {businessUnitLabels[initiative.businessUnit] ?? initiative.businessUnit} · {initiative.sponsorEmail}
              </span>
            </button>

            {initiative.appIds.length > 0 && (
              <>
                <div className={styles.mobileGroupLabel}>Applications</div>
                <div className={styles.mobileNodeList}>
                  {initiative.appIds.map((id) => {
                    const app = graph.apps.find((a) => a.id === id);
                    if (!app) return null;
                    return <MobileNodeRow key={id} node={app} tagClass={appTagClass(app.disposition)} />;
                  })}
                </div>
              </>
            )}

            {initiative.techIds.length > 0 && (
              <>
                <div className={styles.mobileGroupLabel}>Technology components</div>
                <div className={styles.mobileNodeList}>
                  {initiative.techIds.map((id) => {
                    const tech = graph.techs.find((t) => t.id === id);
                    if (!tech) return null;
                    return <MobileNodeRow key={id} node={tech} tagClass={techTagClass(tech.disposition)} />;
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {selected && <InitiativeDetail initiative={selected} />}
    </div>
  );
}

function MobileNodeRow({ node, tagClass }: { node: GraphNode; tagClass: string }) {
  return (
    <div className={`${styles.node} ${styles.appNode}`} style={{ position: 'static', width: '100%', height: APP_HEIGHT }}>
      <span className={styles.appName}>{node.name}</span>
      <span className={`${styles.tag} ${tagClass}`}>{node.disposition}</span>
    </div>
  );
}
