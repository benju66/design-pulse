import { Database } from './database.types';

// Rosetta Stone: The canonical Cost Type dimension
export type CostType = 'Labor' | 'Material' | 'Subcontract' | 'Equipment' | 'Other';

export type Opportunity = Database['public']['Tables']['opportunities']['Row'] & {
  division?: string | null;
  cost_code?: string | null;
  record_type?: string | null;
  coordination_status?: string | null;
  coordination_details?: Record<string, DisciplineDetails> | null;
  description?: string | null;
  cost_type?: CostType | null;
  spec_number_id?: string | null;
};

export interface DisciplineDetails {
  status: 'Required' | 'Pending' | 'Complete' | 'Not Required';
  notes: string;
}
export type OpportunityOption = Database['public']['Tables']['opportunity_options']['Row'] & {
  requires_coordination?: boolean | null;
  coordination_requirements?: Record<string, { required: boolean; notes?: string }> | null;
  cost_code?: string | null;
  division?: string | null;
  cost_type?: CostType | null;
  spec_number_id?: string | null;
};
export type CostCode = Database['public']['Tables']['cost_codes']['Row'];
export type Permit = Database['public']['Tables']['permits']['Row'];
export type PermitTaskLink = Database['public']['Tables']['permit_task_links']['Row'];

export interface PermitRevision {
  status: string;
  date: string;
  note: string;
  author?: string;
}

export type ProjectSettings = Database['public']['Tables']['project_settings']['Row'] & {
  disciplines?: DisciplineConfig[];
  ve_column_order?: any[]; // Supports legacy string[] or new {id, visible}[] format
  coord_column_order?: any[]; // New column for Coordination Tracker
  permit_types?: PermitTypeConfig[];
  permit_ahjs?: PermitAHJConfig[];
};
export type Project = Database['public']['Tables']['projects']['Row'] & {
  project_number?: string | null;
  procore_project_id?: string | null;
  procore_company_id?: string | null;
  is_archived?: boolean;
};
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

// Strictly typing the JSONB columns
export interface DisciplineConfig {
  id: string;
  label: string;
}
export interface PermitTypeConfig {
  id: string;
  label: string;
}
export interface PermitAHJConfig {
  id: string;
  label: string;
}
export interface DesignMarkup {
  id: string;
  type: 'pin' | 'polygon';
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  // Add other Konva-specific or custom properties here
}

export interface SidebarItem {
  id: string;
  label: string;
  iconName: string;
  visible: boolean;
}

// Rosetta Stone: Project-level CSI Spec mapping
export interface ProjectCsiSpec {
  id: string;
  project_id: string;
  csi_number: string;
  normalized_csi_number: string;
  description: string | null;
  cost_code: string | null;
  created_at: string;
  updated_at: string;
}

// Rosetta Stone Phase 4: ML Flywheel — Global cross-project CSI training data
// Composite PK: (normalized_csi_number, global_cost_code_id)
export interface GlobalCsiTrainingData {
  normalized_csi_number: string;   // PK part 1 — e.g. '096516'
  global_cost_code_id: string;     // PK part 2 — FK to cost_codes.code
  latest_description: string | null;
  latest_raw_csi_number: string | null; // e.g. '09 65 16.13'
  match_count: number;
  is_admin_verified: boolean;
  last_seen_at: string;
}

// Params for the remap_global_csi_entry SECURITY DEFINER RPC
export interface RemapCsiEntryParams {
  normalizedCsiNumber: string;
  oldCostCode: string;
  newCostCode: string;
  description: string | null;
  rawCsiNumber: string | null;
}

// Activity & Audit Log
export interface ItemActivity {
  id: string;
  project_id: string;
  opportunity_id: string;
  option_id: string | null;
  activity_type: 'system_log' | 'user_comment';
  content: string;
  mentions: string[]; // UUIDs
  author_id: string | null;
  include_in_oac: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}
