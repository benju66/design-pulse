import { Database } from './database.types';

// Rosetta Stone: The canonical Cost Type dimension
export type CostType = 'Labor' | 'Material' | 'Subcontract' | 'Equipment' | 'Other';

// Accurate representation of the mixed-key JSONB structure in coordination_details.
// Discipline entries keyed by UUID; is_escalated is a top-level boolean flag.
export type CoordinationDetailsMap = {
  is_escalated?: boolean;
} & Record<string, DisciplineDetails | boolean | undefined>;

export type Opportunity = Database['public']['Tables']['opportunities']['Row'] & {
  division?: string | null;
  cost_code?: string | null;
  record_type?: string | null;
  coordination_status?: string | null;
  coordination_details?: CoordinationDetailsMap | null;
  description?: string | null;
  cost_type?: CostType | null;
  spec_number_id?: string | null;
  estimate_sync_status?: 'Draft' | 'Pending Estimate Update' | 'Incorporated' | 'Returned';
  incorporated_version_id?: string | null;
  locked_variance?: number | null;
  estimator_assignee?: string | null;
  is_budget_line?: boolean;
  item_assumptions?: string | null;
  // Populated when Supabase query joins opportunity_options (e.g. usePendingEstimateUpdates)
  opportunity_options?: OpportunityOption[];
  // Ledger financial columns (populated only for is_budget_line=true rows from get_master_ledger_grid)
  baseline_budget?: number;
  approved_changes?: number;
  revised_budget?: number;
  pending_changes?: number;
  projected_final?: number;
};

export interface DisciplineDetails {
  status: 'Required' | 'Pending' | 'Complete' | 'Not Required';
  notes: string;
}
export type OpportunityOption = Database['public']['Tables']['opportunity_options']['Row'] & {
  is_returned?: boolean | null;
  return_note?: string | null;
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
export type PermitComment = Database['public']['Tables']['permit_comments']['Row'];

export interface PermitRevision {
  status: string;
  date: string;
  note: string;
  author?: string;
}

export type ProjectSettings = Database['public']['Tables']['project_settings']['Row'] & {
  disciplines?: DisciplineConfig[];
  ve_column_order?: any[]; // Supports legacy string[] or new {id, visible}[] format
  coord_column_order?: any[]; // New column for Coordination Board
  permit_types?: PermitTypeConfig[];
  permit_ahjs?: PermitAHJConfig[];
};
export type Project = Database['public']['Tables']['projects']['Row'] & {
  project_number?: string | null;
  procore_project_id?: string | null;
  procore_company_id?: string | null;
  client_id?: string | null;
  is_archived?: boolean;
  project_settings?: { project_name: string | null }[];
  clients?: { name: string } | null; // For joined query results
};

export interface Client {
  id: string;
  name: string;
  description: string | null;
  general_standards_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  is_archived: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientBrandStandard {
  id: string;
  client_id: string;
  source_project_id: string | null;
  cost_code: string | null;
  division: string | null;
  normalized_csi_number: string | null;
  standard_description: string;
  category: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectBrandStandard {
  id: string;
  project_id: string;
  client_standard_id: string | null;
  spec_number_id: string | null;
  cost_code: string | null;
  standard_description: string;
  is_verified: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface ClientDocument {
  id: string;
  client_id: string;
  brand_standard_id: string | null;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  category: string | null;
  version: number;
  replaces_document_id: string | null;
  uploaded_by: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientProjectsMetrics {
  project_id: string;
  name: string;
  status: string;
  original_budget: number;
  locked_variance: number;
  potential_exposure: number;
}

export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

// Strictly typing the JSONB columns
export interface DisciplineConfig {
  id: string;
  label: string;
}
export interface CategoryConfig {
  id: string;            // Immutable UUID — dnd-kit key, JSONB identity (AGENTS.md C7)
  label: string;         // Display name; stored as loose-text FK in opportunity_options.category
  no_coord_default: boolean; // false = coordination required (default for all new categories)
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
export type ProjectCsiSpec = Omit<
  Database['public']['Tables']['project_csi_specs']['Row'],
  'source'
> & {
  source?: 'company_default' | 'project' | 'ml_suggested' | null;
};

export interface CsiSpecItem {
  csi_number: string;
  description: string;
  id?: string;
  cost_code?: string;
  is_suggested?: boolean;  // ML Flywheel: true when cost_code was auto-mapped from training data
  source?: 'company_default' | 'project' | 'ml_suggested';  // Phase 7: Lineage tracking
}

// Phase 7: Company-level default CSI-to-Cost-Code mapping (Rosetta Stone)
export type CompanyCsiDefault = Database['public']['Tables']['company_csi_defaults']['Row'];


// Rosetta Stone Phase 4: ML Flywheel — Global cross-project CSI training data
// Composite PK: (normalized_csi_number, global_cost_code_id)
export type GlobalCsiTrainingData = Database['public']['Tables']['global_csi_training_data']['Row'];

// Params for the remap_global_csi_entry SECURITY DEFINER RPC
export interface RemapCsiEntryParams {
  normalizedCsiNumber: string;
  oldCostCode: string;
  newCostCode: string;
  description: string | null;
  rawCsiNumber: string | null;
}

// Activity & Audit Log
export type ItemActivity = Omit<
  Database['public']['Tables']['item_activity']['Row'],
  'activity_type' | 'mentions'
> & {
  activity_type: 'system_log' | 'user_comment';
  mentions: string[];
  deliverable_id?: string | null;
  key_date_id?: string | null;
};

// Pre-Construction Deliverable
export interface ProjectDeliverable {
  id: string;
  project_id: string;
  permit_id: string | null;
  display_id: string | null;
  title: string;
  description: string | null;
  assignee: string | null;
  due_date: string; // ISO date format YYYY-MM-DD
  status: 'Open' | 'In Progress' | 'Under Review' | 'Closed' | 'Not Applicable';
  is_elevated_key_date: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// Pre-Construction Key Date
export interface ProjectKeyDate {
  id: string;
  project_id: string;
  display_id: string | null;
  title: string;
  description: string | null;
  event_date: string; // ISO date format YYYY-MM-DD (timezone stable)
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// Unified Timeline Event — union of standalone key dates + elevated deliverables.
// Extensible: future sources (permits) add to the source_type union.
export interface TimelineEvent {
  id: string;
  project_id: string;
  display_id: string | null;
  title: string;
  description: string | null;
  timeline_date: string; // ISO date format YYYY-MM-DD (timezone stable)
  source_type: 'key_date' | 'deliverable'; // Future: | 'permit'
  status: string | null; // null for key_dates, deliverable status for elevated items
  assignee: string | null; // null for key_dates
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ── Project Estimate (Budget Import) ──────────────────────────────────────────
// EstimateCostType is aliased from CostType for semantic clarity in estimate context.
// It must remain a separate export so tanstack.d.ts can import it without circular deps.
export type EstimateCostType = 'Labor' | 'Material' | 'Subcontract' | 'Equipment' | 'Other';

export interface ProjectEstimateVersion {
  id: string;
  project_id: string;
  version_name: string;
  version_date: string;   // ISO date string, e.g. "2024-01-15"
  is_active: boolean;
  is_finalized: boolean;  // set to true by finalize_estimate_version RPC; never trust total_budget=0 as proxy
  total_budget: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectEstimateLine {
  id: string;
  version_id: string;
  project_id: string;
  cost_code: string | null;             // Loose FK to cost_codes.code (AGENTS.md §5)
  cost_type: EstimateCostType | null;   // Plain text, not an enum (AGENTS.md §5)
  description: string;
  unit_qty: number;
  uom: string | null;
  unit_cost: number;
  budget_amount: number;
  display_order: number;
  item_assumptions: string | null;
  created_at: string;
  updated_at: string;
}

// Client-side staging row enriched with validation state before database save.
// version_id is omitted — it is assigned at commit time after create_estimate_version RPC returns.
export interface EstimateStagingRow extends Omit<ProjectEstimateLine, 'version_id' | 'created_at' | 'updated_at'> {
  procore_raw_code:    string;  // Original Procore code, e.g. "2-29005.000" — display only
  is_matched:          boolean; // true if cost_code found in cost_codes table
  is_budget_resolved:  boolean; // true when parser found a real value (manual, cached formula, or column remap).
                                // false when all sources returned 0/null — UI shows amber warning (informational only,
                                // NOT a block; $0 budgets and early estimates are valid user data).
  // Phase 1: variance note captured during upload staging when delta is detected.
  variance_note?:      string;
  // Client-minted UUID for the variance note row (AGENTS.md C8 — optimistic stability).
  variance_note_id?:   string;
  // Client-only: raw numeric values keyed by lowercase column header (e.g. "budget amount", "unit cost").
  // Populated during parse so the staging column picker can remap without re-reading the file.
  // Stripped by the mutation hook's explicit payload map — never sent to the DB.
  _rawCols?:           Record<string, number>;
}

// Phase 1: Variance note captured during estimate upload to explain cost swings.
// Immutable once the parent version is finalized (is_finalized = true).
// Granularity: (estimate_version_id, cost_code) — no cost_type drill-down.
export interface EstimateVarianceNote {
  id: string;
  project_id: string;
  estimate_version_id: string;
  cost_code: string | null;
  variance_note: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetWaterfallRow {
  cost_code: string;
  description: string;
  budget_amount: number;
  ve_impact: number;
  pending_impact: number;
  net_position: number;
  projected_position: number;
}

export interface BudgetVersionTimelineRow {
  version_id: string;
  version_name: string;
  version_date: string;
  baseline: number;
  locked_ve: number;
  pending_ve: number;
}

export interface MasterLedgerRow {
  cost_code: string;
  /** 2-digit CSI MasterFormat division prefix derived from cost_code via the
   *  get_master_ledger_grid RPC — NOT from project_csi_specs. */
  csi_division: string;
  description: string;
  baseline_budget: number;
  locked_ve: number;
  pending_ve: number;
  revised_budget: number;
  projected_final: number;
}

export type RolePermission = Database['public']['Tables']['role_permissions']['Row'];

export type UserPermissions = Omit<RolePermission, 'role'>;

export interface ProjectMember {
  user_id: string;
  email: string;
  name: string | null;
  role: RolePermission['role'];
  joined_at: string;
}

export interface EstimateComparisonRow {
  cost_code: string;
  cost_type: EstimateCostType;
  description: string;
  old_amount: number;
  new_amount: number;
  delta_amount: number;
  variance_note_b: string | null;
}

export interface MultiVersionMatrixRow {
  cost_code: string;
  description: string;
  version_id: string;
  version_name: string;
  version_date: string; // ISO date
  budget_amount: number;
  variance_note: string | null;
}

// ── Lessons Learned ──────────────────────────────────────────────────────────

export type LessonCategory = 'Design' | 'Constructability' | 'Cost' | 'Schedule'
  | 'Safety' | 'Procurement' | 'Coordination' | 'Client/Owner' | 'Other';

export type LessonSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

export type LessonPhase = 'Pre-Construction' | 'Design Development'
  | 'Construction Documents' | 'Buyout' | 'Construction' | 'Closeout';

export type LessonStatus = 'Draft' | 'Submitted' | 'Verified' | 'Archived';

export type LessonSourceType = 'manual' | 'ai_generated' | 'ai_assisted';

export type ProjectLesson = Omit<
  Database['public']['Tables']['project_lessons']['Row'],
  'category' | 'severity' | 'phase' | 'status' | 'source_type' | 'ai_metadata'
> & {
  category: LessonCategory;
  severity: LessonSeverity;
  phase: LessonPhase;
  status: LessonStatus;
  source_type: LessonSourceType;
  ai_metadata: Record<string, unknown> | null;
};

export type LessonAttachment = Database['public']['Tables']['lesson_attachments']['Row'];

export type LessonOpportunityLink = Database['public']['Tables']['lesson_opportunity_links']['Row'];

export interface LessonIndicator {
  cost_code: string;
  lesson_count: number;
  max_severity: string;
}

export interface LessonTemplate {
  id: string;
  label: string;
  defaultCategory: LessonCategory;
  whatHappenedPlaceholder: string;
  rootCausePlaceholder: string;
  recommendationPlaceholder: string;
}

