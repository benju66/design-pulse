import type { CategoryConfig } from '@/types/models';

export const ALL_PRIMARY_FIELDS = [
  { id: 'priority', label: 'Priority' },
  { id: 'cost_impact', label: 'Cost Impact' },
  { id: 'days_impact', label: 'Days Impact' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'status', label: 'Status' },
  { id: 'arch_plans_spec', label: 'Arch Plans/Spec' },
  { id: 'bok_standard', label: 'BOK Standard' },
  { id: 'existing_conditions', label: 'Existing Conditions' },
  { id: 'mep_impact', label: 'MEP Impact' },
  { id: 'owner_goals', label: 'Owner Goals' },
  { id: 'final_direction', label: 'Final Direction' },
  { id: 'backing_required', label: 'Backing Required' },
  { id: 'coordination_required', label: 'Coordination Required' },
  { id: 'design_lock_phase', label: 'Design Lock Phase' },
  { id: 'coordination_status', label: 'Coordination Status' },
] as const;

export const DEFAULT_COORD_COLUMN_ORDER = [
  'select', 'open_panel', 'display_id', 'record_type', 'title', 
  'final_direction', 'priority', 'status', 'due_date', 'discipline_status'
] as const;

export const DEFAULT_KEY_DATES_COLUMN_ORDER = [
  'select', 'display_id', 'title', 'description', 'event_date', 'source_type'
] as const;

export const ADVANCED_FIELD_IDS = [
  'existing_conditions', 
  'mep_impact', 
  'backing_required', 
  'coordination_required', 
  'design_lock_phase'
] as const;

// Stable prefixed IDs so all new projects share identical defaults.
// User-created categories get crypto.randomUUID() at creation time.
export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'd_existing_conditions', label: 'Existing Conditions', no_coord_default: false },
  { id: 'd_arch_plans_specs',    label: 'Arch Plans/Specs',    no_coord_default: false },
  { id: 'd_owner_standard',      label: 'Owner Standard',      no_coord_default: false },
  { id: 'd_budgeted_item',       label: 'Budgeted Item',        no_coord_default: false },
  { id: 'd_other',               label: 'Other',                no_coord_default: false },
];

export const DEFAULT_BUILDING_AREAS = [
  "Corridor / Common",
  "Unit Interiors",
  "Back of House"
] as const;

export const DEFAULT_SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Value Matrix', iconName: 'LayoutDashboard', visible: true },
  { id: 'coordination', label: 'Coordination Items', iconName: 'ListChecks', visible: true },
  { id: 'map', label: 'Drawings', iconName: 'Map', visible: false },
  { id: 'permits', label: 'Permits', iconName: 'FileCheck2', visible: true },
  { id: 'deliverables', label: 'Deliverables', iconName: 'CalendarCheck2', visible: true },
  { id: 'key-dates', label: 'Key Dates', iconName: 'CalendarDays', visible: true },
  { id: 'analytics', label: 'Analytics', iconName: 'PieChart', visible: true },
  { id: 'dashboard-v2', label: 'Budget Ledger', iconName: 'LayoutDashboard', visible: true },
  { id: 'budget-compare', label: 'Version Matrix', iconName: 'GitCompareArrows', visible: true },
  { id: 'scenario-planner', label: 'Scenarios', iconName: 'Columns3', visible: true },
  { id: 'my-desk', label: 'My Desk', iconName: 'Inbox', visible: true },
  { id: 'coordination-v2', label: 'Kanban (Proto)', iconName: 'Kanban', visible: false },
  { id: 'lessons', label: 'Lessons Learned', iconName: 'GraduationCap', visible: false }
] as const;

export const DEFAULT_DISCIPLINES = [
  { id: 'd_arch', label: 'Arch' },
  { id: 'd_civil', label: 'Civil' },
  { id: 'd_struct', label: 'Struct' },
  { id: 'd_mech', label: 'Mech' },
  { id: 'd_elec', label: 'Elec' },
  { id: 'd_plumb', label: 'Plumbg' },
  { id: 'd_fp', label: 'FP' },
  { id: 'd_lv', label: 'LV' },
  { id: 'd_proc', label: 'Proc' },
  { id: 'd_owner', label: 'Owner' },
  { id: 'd_gc', label: 'GC' }
];
