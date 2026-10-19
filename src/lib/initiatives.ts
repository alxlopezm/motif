import 'server-only';
import { query } from './db';
import type { BusinessUnit, ComponentType } from './constants';

export interface InitiativeTechnology {
  id: string;
  description: string;
  componentType: ComponentType;
  vendorName: string | null;
  disposition: string;
}

export interface InitiativeUsage {
  id: string;
  description: string;
  benefitedBu: BusinessUnit;
  businessSponsorEmail: string;
  note: string | null;
  technologies: InitiativeTechnology[];
}

interface InitiativeUsageRow {
  init_initiative_id: string;
  init_description: string;
  init_benefited_bu: BusinessUnit;
  init_business_sponsor_email: string;
  inpa_note: string | null;
  tech_technology_component_id: string | null;
  tech_description: string | null;
  tech_component_type: ComponentType | null;
  tech_vendor_name: string | null;
  inte_disposition: string | null;
}

/**
 * Initiatives that use the given pattern, each with its linked technology components
 * (LEFT JOINed, so an initiative with zero linked technologies still appears once).
 */
export async function getInitiativesForPattern(patternId: string): Promise<InitiativeUsage[]> {
  const rows = await query<InitiativeUsageRow>(
    `SELECT i.init_initiative_id, i.init_description, i.init_benefited_bu, i.init_business_sponsor_email,
            ip.inpa_note,
            t.tech_technology_component_id, t.tech_description, t.tech_component_type, t.tech_vendor_name,
            it.inte_disposition
       FROM patt_initiative_patterns ip
       JOIN patt_initiatives i ON i.init_initiative_id = ip.inpa_initiative_id
       LEFT JOIN patt_initiative_technologies it ON it.inte_initiative_id = i.init_initiative_id
       LEFT JOIN patt_technology_components t ON t.tech_technology_component_id = it.inte_technology_component_id
      WHERE ip.inpa_pattern_id = $1
      ORDER BY i.init_description, t.tech_description`,
    [patternId],
  );

  const byInitiative = new Map<string, InitiativeUsage>();
  for (const r of rows) {
    let initiative = byInitiative.get(r.init_initiative_id);
    if (!initiative) {
      initiative = {
        id: r.init_initiative_id,
        description: r.init_description,
        benefitedBu: r.init_benefited_bu,
        businessSponsorEmail: r.init_business_sponsor_email,
        note: r.inpa_note,
        technologies: [],
      };
      byInitiative.set(r.init_initiative_id, initiative);
    }
    if (r.tech_technology_component_id) {
      initiative.technologies.push({
        id: r.tech_technology_component_id,
        description: r.tech_description!,
        componentType: r.tech_component_type!,
        vendorName: r.tech_vendor_name,
        disposition: r.inte_disposition!,
      });
    }
  }
  return [...byInitiative.values()];
}
