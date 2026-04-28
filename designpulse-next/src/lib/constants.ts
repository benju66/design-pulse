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

export const ADVANCED_FIELD_IDS = [
  'existing_conditions', 
  'mep_impact', 
  'backing_required', 
  'coordination_required', 
  'design_lock_phase'
] as const;

export const DEFAULT_CATEGORIES = [
  "Existing Conditions",
  "Arch Plans/Specs",
  "Owner Standard",
  "Budgeted Item",
  "Other"
] as const;

export const DEFAULT_BUILDING_AREAS = [
  "Corridor / Common",
  "Unit Interiors",
  "Back of House"
] as const;

export const DEFAULT_SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'VE Matrix', iconName: 'LayoutDashboard', visible: true },
  { id: 'coordination', label: 'Coordination Tracker', iconName: 'ListChecks', visible: true },
  { id: 'analytics', label: 'Analytics', iconName: 'PieChart', visible: true },
  { id: 'map', label: 'Map View', iconName: 'Map', visible: false },
  { id: 'dashboard-v2', label: 'Grid V2 (Proto)', iconName: 'LayoutDashboard', visible: true },
  { id: 'my-desk', label: 'My Desk', iconName: 'Inbox', visible: true },
  { id: 'coordination-v2', label: 'Kanban (Proto)', iconName: 'Kanban', visible: false }
] as const;

export const DEFAULT_DISCIPLINES = [
  { id: 'd_arch', label: 'Arch' },
  { id: 'd_civil', label: 'Civil' },
  { id: 'd_struct', label: 'Struct' },
  { id: 'd_mech', label: 'Mech' },
  { id: 'd_elec', label: 'Elec' },
  { id: 'd_plumb', label: 'Plumb' },
  { id: 'd_fp', label: 'FP' },
  { id: 'd_lv', label: 'LV' }
];
