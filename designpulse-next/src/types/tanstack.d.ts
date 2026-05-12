import '@tanstack/react-table';
import { UseMutationResult } from '@tanstack/react-query';
import { Opportunity, OpportunityOption, CostCode, ProjectCsiSpec, RemapCsiEntryParams, EstimateCostType, UserPermissions, ProjectMember, DisciplineConfig } from './models';
import { MutableRefObject } from 'react';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    // Generic mutation result — supports both Opportunity and Permit grids
    updateData?: UseMutationResult<unknown, Error, { id: string; updates: Record<string, unknown> }>;
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
    // Grid navigation ref (C10 — passed via ref, never mutated inline on render)
    moveActiveCellRef?: MutableRefObject<((direction: 'down' | 'right' | 'left' | 'up') => void) | null>;
    // Coordination-specific meta (C24 — derived once in parent, not per-row)
    projectId?: string;
    disciplines?: DisciplineConfig[];
    buildingAreas?: string[];
    // Phase 2: pre-computed variance note lookup (cost_code → note text) for active estimate version
    varianceNoteMap?: Record<string, string>;
  }
}
