import '@tanstack/react-table';
import { UseMutationResult } from '@tanstack/react-query';
import { Opportunity, OpportunityOption, CostCode } from './models';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: UseMutationResult<Opportunity, Error, { id: string; updates: Partial<Opportunity> }, { previousOpportunities: Opportunity[] | undefined }>;
    optionsMap: Record<string, OpportunityOption[]>;
    activeCell: { rowIndex: number | null; columnId: string | null };
    setActiveCell: (cell: { rowIndex: number | null; columnId: string | null }) => void;
    rawCostCodes?: CostCode[];
    projectMembers?: any[];
  }
}
