import { Database } from './database.types';

export type Opportunity = Database['public']['Tables']['opportunities']['Row'] & {
  division?: string | null;
  cost_code?: string | null;
  record_type?: string | null;
  coordination_details?: Record<string, DisciplineDetails> | null;
};

export interface DisciplineDetails {
  status: 'Required' | 'Pending' | 'Complete' | 'Not Required';
  notes: string;
}
export type OpportunityOption = Database['public']['Tables']['opportunity_options']['Row'];
export type CostCode = Database['public']['Tables']['cost_codes']['Row'];
export type ProjectSettings = Database['public']['Tables']['project_settings']['Row'] & {
  disciplines?: DisciplineConfig[];
  ve_column_order?: string[];
};
export type Project = Database['public']['Tables']['projects']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

// Strictly typing the JSONB columns
export interface DisciplineConfig {
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
