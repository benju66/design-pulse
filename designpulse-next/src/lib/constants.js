export const ALL_PRIMARY_FIELDS = [
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
];

export const ADVANCED_FIELD_IDS = [
  'existing_conditions', 
  'mep_impact', 
  'backing_required', 
  'coordination_required', 
  'design_lock_phase'
];

export const DEFAULT_CATEGORIES = [
  "Existing Conditions",
  "Arch Plans/Specs",
  "Owner Standard",
  "Budgeted Item",
  "Other"
];

export const DEFAULT_SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'VE Matrix', iconName: 'LayoutDashboard', visible: true },
  { id: 'map', label: 'Map View', iconName: 'Map', visible: true },
  { id: 'analytics', label: 'Analytics', iconName: 'PieChart', visible: true },
  { id: 'coordination', label: 'Coordination Tracker', iconName: 'ListChecks', visible: true }
];
