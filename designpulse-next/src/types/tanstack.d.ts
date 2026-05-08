import '@tanstack/react-table';
import { UseMutationResult } from '@tanstack/react-query';
import { Opportunity, OpportunityOption, CostCode, ProjectCsiSpec, RemapCsiEntryParams, EstimateCostType, UserPermissions, ProjectMember } from './models';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData?: any; // Generic to support Permits and Opportunities
    optionsMap?: Record<string, OpportunityOption[]>;
    createOption?: (params: { opportunityId: string; option: Partial<OpportunityOption> }) => void;
    updateOption?: (params: { id: string; updates: Partial<OpportunityOption> }) => void;
    moveActiveCell?: (direction: 'down' | 'right' | 'left' | 'up') => void;
    activeCell?: { rowIndex: number | null; columnId: string | null };
    setActiveCell?: (cell: { rowIndex: number; columnId: string } | null) => void;
    rawCostCodes?: CostCode[];
    csiSpecs?: ProjectCsiSpec[];
    projectMembers?: ProjectMember[];
    permissions?: UserPermissions;
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
