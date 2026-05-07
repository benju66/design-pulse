import '@tanstack/react-table';
import { UseMutationResult } from '@tanstack/react-query';
import { Opportunity, OpportunityOption, CostCode, ProjectCsiSpec, RemapCsiEntryParams, EstimateCostType } from './models';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData?: any; // Made optional and generic to support Permits and Opportunities
    optionsMap?: Record<string, OpportunityOption[]>;
    moveActiveCell?: (direction: 'down' | 'right' | 'left' | 'up') => void;
    activeCell?: { rowIndex: number | null; columnId: string | null };
    setActiveCell?: (cell: { rowIndex: number; columnId: string } | null) => void;
    rawCostCodes?: CostCode[];
    csiSpecs?: ProjectCsiSpec[];
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
    // Phase 4: ML Flywheel admin actions — used by the CSI Mapping Review TanStack grid
    // in GlobalSettingsModal. Functions wrap the mutations so cells stay decoupled from
    // TanStack Query internals. isMutating gates all interactive controls simultaneously.
    globalCsiActions?: {
      toggleVerified: (normalizedCsiNumber: string, costCodeId: string, value: boolean) => void;
      remapEntry: (params: RemapCsiEntryParams) => void;
      isMutating: boolean;
    };
    // Project Estimate staging grid meta (AGENTS.md C24 — derived once in parent, not per-row)
    estimateCostCodes?: CostCode[];
    onAssignCostCode?: (rowId: string, costCode: string, costType: EstimateCostType) => void;
  }
}
