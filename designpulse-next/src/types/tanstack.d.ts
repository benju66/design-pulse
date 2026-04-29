import '@tanstack/react-table';
import { UseMutationResult } from '@tanstack/react-query';
import { Opportunity, OpportunityOption, CostCode } from './models';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: UseMutationResult<Opportunity, Error, { id: string; updates: Partial<Opportunity> }, { previousOpportunities: Opportunity[] | undefined }>;
    optionsMap: Record<string, OpportunityOption[]>;
    moveActiveCell?: (direction: 'down' | 'right' | 'left' | 'up') => void;
    activeCell?: { rowIndex: number | null; columnId: string | null };
    setActiveCell?: (cell: { rowIndex: number; columnId: string } | null) => void;
    rawCostCodes?: CostCode[];
    projectMembers?: any[];
    permissions?: {
      can_edit_records: boolean;
      can_lock_options: boolean;
      can_unlock_options: boolean;
      can_manage_team: boolean;
      can_edit_project_settings: boolean;
      can_manage_budget: boolean;
      can_delete_records: boolean;
      can_view_audit_logs: boolean;
    };
  }
}
