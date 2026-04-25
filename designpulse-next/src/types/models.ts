import { Database } from './database.types';

export type Opportunity = Database['public']['Tables']['opportunities']['Row'] & {
  cost_code?: string | null;
  arch_completed?: boolean;
  mep_completed?: boolean;
  struct_completed?: boolean;
};
export type OpportunityOption = Database['public']['Tables']['opportunity_options']['Row'];
export type ProjectSettings = Database['public']['Tables']['project_settings']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

// Strictly typing the JSONB columns
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
