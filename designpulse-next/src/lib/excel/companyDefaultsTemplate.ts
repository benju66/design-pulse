import { CostCode, CompanyCsiDefault } from '@/types/models';
import { formatCostCode } from '@/lib/formatCostCode';

/**
 * Generates a downloadable .xlsx template for Company Default CSI Codes.
 * If existingDefaults are provided, pre-populates rows with current data.
 *
 * Single sheet — "Company CSI Defaults"
 *   Col A: CSI Number    (text, e.g. "03 30 00")
 *   Col B: Description   (text, e.g. "Cast-In-Place Concrete")
 *   Col C: Cost Code     (text, validated dropdown from cost_codes if provided)
 *
 * Guardrails:
 *   C19 — dynamic import of browser-safe exceljs build
 *   C1  — no `any` casts; strict typing
 *   A   — no regex lookbehinds (iOS-safe)
 */
export async function generateCompanyDefaultsTemplate(
  costCodes: CostCode[],
  existingDefaults?: CompanyCsiDefault[]
): Promise<Blob> {
  // Dynamic import: browser-safe build (AGENTS.md C19)
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Design Pulse';
  workbook.lastModifiedBy = 'Design Pulse';
  workbook.created = new Date();

  // ── Hidden reference sheet for cost code dropdown ──────────────────────────
  const refSheet = workbook.addWorksheet('CostCodeRef', { state: 'hidden' });
  // AGENTS.md: is_division is a display hint ONLY — all codes are valid selections
  const sortedCodes = [...costCodes]
    .sort((a, b) => a.code.localeCompare(b.code));

  // Build a quick lookup for cost code formatting
  const codeMap = new Map<string, CostCode>();
  sortedCodes.forEach((cc) => codeMap.set(cc.code, cc));

  // Column A: formatted "code – description" for user-friendly dropdown display
  sortedCodes.forEach((cc, i) => {
    const formatted = `${formatCostCode(cc.code)} – ${cc.description}`;
    refSheet.getCell(`A${i + 1}`).value = formatted;
    refSheet.getCell(`B${i + 1}`).value = cc.code;
  });

  // ── Main sheet: "Company CSI Defaults" ─────────────────────────────────────
  const sheet = workbook.addWorksheet('Company CSI Defaults');

  sheet.columns = [
    { header: 'CSI Number',  key: 'csi_number',  width: 18 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Cost Code',   key: 'cost_code',   width: 40 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Text format on CSI Number to preserve spacing (e.g. "03 30 00" stays as-is)
  sheet.getColumn('A').numFmt = '@';

  // Pre-populate with existing defaults or show example rows
  if (existingDefaults && existingDefaults.length > 0) {
    existingDefaults.forEach((def) => {
      // Format cost code to match dropdown format if it exists in cost_codes
      let costCodeDisplay = def.cost_code || '';
      if (def.cost_code) {
        const cc = codeMap.get(def.cost_code);
        if (cc) {
          costCodeDisplay = `${formatCostCode(cc.code)} – ${cc.description}`;
        }
      }
      sheet.addRow({
        csi_number: def.csi_number,
        description: def.description || '',
        cost_code: costCodeDisplay,
      });
    });
  } else {
    // Empty template — show muted example rows as guidance
    const examples = [
      { csi_number: '03 30 00', description: 'Cast-In-Place Concrete',   cost_code: sortedCodes.length > 0 ? `${formatCostCode(sortedCodes[0].code)} – ${sortedCodes[0].description}` : '' },
      { csi_number: '09 29 00', description: 'Gypsum Board Assemblies',  cost_code: '' },
      { csi_number: '26 05 00', description: 'Common Work Results for Electrical', cost_code: '' },
    ];
    examples.forEach((ex) => {
      const row = sheet.addRow(ex);
      row.font = { italic: true, color: { argb: 'FF9CA3AF' } }; // muted gray
    });
  }

  // Add cell note on header
  sheet.getCell('A1').note = 'Enter the CSI specification number (e.g. "03 30 00" or "032000")';
  sheet.getCell('C1').note = 'Select a cost code from the dropdown, or type the raw code (e.g. "030000"). Leave blank if unmapped.';

  // Cost Code dropdown validation on Column C (generous row range)
  const dataRows = existingDefaults?.length ?? 0;
  const maxRows = Math.max(500, dataRows + 100, sortedCodes.length + 10);
  if (sortedCodes.length > 0) {
    for (let i = 2; i <= maxRows; i++) {
      sheet.getCell(`C${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=CostCodeRef!$A$1:$A$${sortedCodes.length}`],
        showErrorMessage: false, // Allow freeform typing too
      };
    }
  }

  // Freeze header row
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
