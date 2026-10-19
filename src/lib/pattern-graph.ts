import type { InitiativeUsage } from './initiatives';
import type { BusinessUnit } from './constants';

/**
 * Pure transform: the initiatives using a pattern (already fetched from the DB) → a graph
 * {@link PatternGraph} shaped for design/pattern-map's relationship-map layout — apps and
 * technology components de-duplicated across initiatives, with usedBy counts and an ordering
 * that minimizes connector crossings. No I/O here; this is the `buildPatternGraph` referenced
 * in design/pattern-map/README.md, just colocated with the rest of the app's `lib` functions
 * rather than under a `lib/patterns/` subfolder.
 */

export interface GraphNode {
  id: string;
  name: string;
  /** Raw disposition value (e.g. 'INVEST', 'APPROVED') — label mapping is a render concern. */
  disposition: string;
  vendorName: string | null;
  usedBy: number;
  isCore: boolean;
}

export interface GraphInitiative {
  id: string;
  name: string;
  businessUnit: BusinessUnit;
  sponsorEmail: string;
  /** This pattern-link's note (`inpa_note`) — the design's "selected initiative description". */
  note: string | null;
  appIds: string[];
  techIds: string[];
}

export interface PatternGraph {
  initiatives: GraphInitiative[];
  /** Ordered to minimize connector crossings (mean index of the initiatives using each). */
  apps: GraphNode[];
  /** Same ordering rule, but with core tech(s) pinned first. */
  techs: GraphNode[];
}

export function buildPatternGraph(initiatives: InitiativeUsage[]): PatternGraph {
  const appById = new Map<string, GraphNode & { initiativeIndexes: number[] }>();
  const techById = new Map<string, GraphNode & { initiativeIndexes: number[] }>();
  const graphInitiatives: GraphInitiative[] = [];

  initiatives.forEach((initiative, index) => {
    const appIds: string[] = [];
    const techIds: string[] = [];

    for (const tech of initiative.technologies) {
      const target = tech.componentType === 'APP' ? appById : techById;
      const ids = tech.componentType === 'APP' ? appIds : techIds;
      ids.push(tech.id);

      const existing = target.get(tech.id);
      if (existing) {
        existing.usedBy += 1;
        existing.initiativeIndexes.push(index);
      } else {
        target.set(tech.id, {
          id: tech.id,
          name: tech.description,
          disposition: tech.disposition,
          vendorName: tech.vendorName,
          usedBy: 1,
          isCore: false,
          initiativeIndexes: [index],
        });
      }
    }

    graphInitiatives.push({
      id: initiative.id,
      name: initiative.description,
      businessUnit: initiative.benefitedBu,
      sponsorEmail: initiative.businessSponsorEmail,
      note: initiative.note,
      appIds,
      techIds,
    });
  });

  const totalInitiatives = initiatives.length;
  for (const tech of techById.values()) {
    tech.isCore = totalInitiatives > 0 && tech.usedBy === totalInitiatives;
  }

  function meanIndex(node: { initiativeIndexes: number[] }): number {
    const sum = node.initiativeIndexes.reduce((a, b) => a + b, 0);
    return sum / node.initiativeIndexes.length;
  }

  const apps = [...appById.values()].sort((a, b) => meanIndex(a) - meanIndex(b));
  const techs = [...techById.values()].sort((a, b) => {
    if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
    return meanIndex(a) - meanIndex(b);
  });

  const strip = ({ initiativeIndexes: _i, ...rest }: GraphNode & { initiativeIndexes: number[] }): GraphNode => rest;

  return {
    initiatives: graphInitiatives,
    apps: apps.map(strip),
    techs: techs.map(strip),
  };
}
