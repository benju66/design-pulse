// ============================================================================
// VE Scenarios — Domain Types
// ============================================================================

export interface VeScenario {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_by: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface VeScenarioPackage {
  id: string;
  scenario_id: string;
  package_id: string;
  project_id: string;
  sort_order: number;
  created_at: string;
}

export interface VeScenarioWithPackages extends VeScenario {
  scenarioPackages: VeScenarioPackage[];
}
