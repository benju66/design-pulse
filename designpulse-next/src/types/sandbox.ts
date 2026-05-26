// ============================================================================
// VE Sandbox Packages — Domain Types
// ============================================================================

export interface VePackage {
  id: string;
  project_id: string;
  name: string;
  color: string;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface VePackageItem {
  id: string;
  package_id: string;
  opportunity_id: string;
  project_id: string;
  assumed_option_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface VePackageWithItems extends VePackage {
  items: VePackageItem[];
}
