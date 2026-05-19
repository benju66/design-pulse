'use client';
/**
 * useLedgerExport.ts
 *
 * Phase 6: Budget Ledger Export Hook.
 * Generates an Excel workbook (.xlsx) containing:
 *   1. Budget Summary sheet — project totals, version info
 *   2. Line Items sheet — all budget lines with cost codes, types, amounts
 *   3. Variance Notes sheet — all variance notes with version context
 *
 * Architecture:
 *  - Uses `exceljs` (already in dependencies) for workbook generation
 *  - Downloads via Blob URL pattern (iOS-safe, no pop-up blockers)
 *  - Wrapped in a TanStack mutation for pending state tracking
 */

import { useCallback, useState } from 'react';
import type { Opportunity } from '@/types/models';
import type { VarianceNoteWithVersion } from '@/hooks/useEstimateQueries';

interface ExportOptions {
  projectName: string;
  versionName?: string;
  ledgerItems: Opportunity[];
  varianceNotes: VarianceNoteWithVersion[];
}

export function useLedgerExport() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportToExcel = useCallback(async (options: ExportOptions) => {
    setIsPending(true);
    setError(null);

    try {
      // Dynamic import — exceljs is heavy, only load when user clicks export
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();

      // ── Sheet 1: Budget Summary ──
      const summarySheet = workbook.addWorksheet('Budget Summary');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 25 },
      ];

      const budgetLines = options.ledgerItems.filter(i => i.is_budget_line);
      const veItems = options.ledgerItems.filter(i => !i.is_budget_line);
      const totalBaseline = budgetLines.reduce((s, i) => s + (Number(i.baseline_budget) || 0), 0);
      const totalVeImpact = veItems.reduce((s, i) => s + (Number(i.cost_impact) || 0), 0);

      summarySheet.addRows([
        { metric: 'Project', value: options.projectName },
        { metric: 'Active Version', value: options.versionName || 'N/A' },
        { metric: 'Export Date', value: new Date().toLocaleDateString() },
        { metric: '', value: '' },
        { metric: 'Total Baseline Budget', value: totalBaseline },
        { metric: 'Total VE Impact', value: totalVeImpact },
        { metric: 'Revised Budget', value: totalBaseline + totalVeImpact },
        { metric: '', value: '' },
        { metric: 'Budget Line Items', value: budgetLines.length },
        { metric: 'VE Items', value: veItems.length },
        { metric: 'Variance Notes', value: options.varianceNotes.length },
      ]);

      // Style the header row
      const headerRow = summarySheet.getRow(1);
      headerRow.font = { bold: true, size: 12 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

      // ── Sheet 2: Line Items ──
      const linesSheet = workbook.addWorksheet('Line Items');
      linesSheet.columns = [
        { header: 'Cost Code', key: 'cost_code', width: 15 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Record Type', key: 'record_type', width: 15 },
        { header: 'Baseline Budget', key: 'baseline', width: 18 },
        { header: 'VE Impact', key: 've_impact', width: 15 },
        { header: 'Revised Budget', key: 'revised', width: 18 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      for (const item of options.ledgerItems) {
        linesSheet.addRow({
          cost_code: item.cost_code || '',
          description: item.title || item.description || '',
          type: item.cost_type || '',
          record_type: item.is_budget_line ? 'Budget Line' : 'VE Item',
          baseline: Number(item.baseline_budget) || 0,
          ve_impact: Number(item.cost_impact) || 0,
          revised: Number(item.revised_budget) || 0,
          status: item.status || '',
        });
      }

      const linesHeaderRow = linesSheet.getRow(1);
      linesHeaderRow.font = { bold: true, size: 11 };
      linesHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

      // Format currency columns
      ['baseline', 've_impact', 'revised'].forEach(col => {
        const column = linesSheet.getColumn(col);
        column.numFmt = '$#,##0';
      });

      // ── Sheet 3: Variance Notes ──
      const notesSheet = workbook.addWorksheet('Variance Notes');
      notesSheet.columns = [
        { header: 'Cost Code', key: 'cost_code', width: 15 },
        { header: 'Estimate Version', key: 'version', width: 25 },
        { header: 'Note', key: 'note', width: 60 },
        { header: 'Created', key: 'created', width: 20 },
        { header: 'Updated', key: 'updated', width: 20 },
      ];

      for (const note of options.varianceNotes) {
        notesSheet.addRow({
          cost_code: note.cost_code || '',
          version: note.version_name,
          note: note.variance_note,
          created: new Date(note.created_at).toLocaleString(),
          updated: note.updated_at ? new Date(note.updated_at).toLocaleString() : '',
        });
      }

      const notesHeaderRow = notesSheet.getRow(1);
      notesHeaderRow.font = { bold: true, size: 11 };
      notesHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

      // ── Generate and download ──
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${options.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_Budget_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      // AGENTS.md: revoke blob URL to prevent memory leak
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Export failed'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { exportToExcel, isPending, error };
}
