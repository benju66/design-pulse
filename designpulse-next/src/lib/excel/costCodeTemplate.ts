import { CostCode } from '@/types/models';
import { formatCostCode } from '@/lib/formatCostCode';

/**
 * Generates a downloadable two-sheet .xlsx workbook.
 *
 * Sheet 1 — "Divisions" (visible, user-editable)
 *   Col A: Division #   (2-digit text, e.g. "01") — Text-formatted to preserve leading zeros
 *   Col B: Division Name (e.g. "General Conditions")
 *
 * Sheet 2 — "Cost Codes"
 *   Col A: Code          — Text-formatted to preserve leading zeros (e.g. "010000")
 *   Col B: Description
 *   Col C: Division #    — 2-digit text; dropdown validated from Divisions!$A$2:$A$500
 *   Col D–H: Category L/M/S/E/O — "Yes"/"No" dropdown from hidden Metadata sheet
 *
 * Design decisions:
 *   - Division-level codes (is_division=true) go to Sheet 1 ONLY. They are simultaneously
 *     selectable in cost code dropdowns (SmartCostCodeCombobox no longer filters on is_division).
 *     No duplication in Sheet 2 is needed or correct.
 *   - Sheet 2 "Division #" uses a generous $A$2:$A$500 validation range so new divisions
 *     added by the user to Sheet 1 immediately appear in the dropdown without re-downloading.
 *   - Both Code and Division # columns are Text-formatted to prevent Excel silently stripping
 *     leading zeros (e.g. "010000" → "10000", "01" → "1").
 *
 * Guardrails:
 *   C19 — dynamic import of browser-safe exceljs build
 *   C27 / C29 — two-sheet format; .xlsx only; dropdown values validated at source
 *   C1  — no `any` casts; CostCode[] is strictly typed
 *   A   — no regex lookbehinds (iOS-safe); prefix extraction uses .split('-')[0]
 */
export async function generateCostCodeTemplate(
  costCodes: CostCode[]
): Promise<Blob> {
  // Dynamic import: browser-safe build prevents Node.js stream polyfill errors (AGENTS.md C19)
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Design Pulse';
  workbook.lastModifiedBy = 'Design Pulse';
  workbook.created = new Date();

  // ── Helpers ─────────────────────────────────────────────────────────────────

  // Extracts the 2-digit prefix from a 6-digit code.
  // iOS-safe: uses split('-')[0], no regex. e.g. "010000" → "01-0000" → "01"
  const divPrefix = (code: string): string =>
    formatCostCode(code).split('-')[0];

  const toBoolStr = (v: boolean | null | undefined): string =>
    v === true ? 'Yes' : 'No';

  const PROTECT_OPTIONS = {
    selectLockedCells:   true,
    selectUnlockedCells: true,
    formatCells:         true,
    formatColumns:       true,
    formatRows:          true,
    insertRows:          true,
    insertColumns:       false,
    insertHyperlinks:    true,
    deleteRows:          true,
    deleteColumns:       false,
    sort:                true,
    autoFilter:          true,
  };

  // Separate data sources
  const divisions = costCodes
    .filter(c => c.is_division)
    .sort((a, b) => a.code.localeCompare(b.code));

  const childCodes = costCodes
    .filter(c => !c.is_division)
    .sort((a, b) => a.code.localeCompare(b.code));

  // ── Hidden Metadata sheet ───────────────────────────────────────────────────
  // Must be added BEFORE protected sheets.
  // Provides the Yes/No source list for category dropdowns (Col D–H on Sheet 2).
  const metaSheet = workbook.addWorksheet('Metadata', { state: 'hidden' });
  metaSheet.getColumn('A').values = ['Boolean', 'Yes', 'No'];

  // ── Sheet 1: "Divisions" ────────────────────────────────────────────────────
  const divSheet = workbook.addWorksheet('Divisions');

  divSheet.columns = [
    { header: 'Division #',    key: 'div_num',  width: 14 },
    { header: 'Division Name', key: 'div_name', width: 50 },
  ];

  // Style header row
  const divHeader = divSheet.getRow(1);
  divHeader.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  divHeader.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  divHeader.alignment = { vertical: 'middle', horizontal: 'center' };

  // Column A: Text format to preserve leading zeros ("01" stays "01", not 1)
  divSheet.getColumn('A').numFmt = '@';

  // Pre-populate division rows
  divisions.forEach(div => {
    divSheet.addRow({
      div_num:  divPrefix(div.code),  // "010000" → "01"
      div_name: div.description,
    });
  });

  // Protect: header locked, data rows unlocked
  await divSheet.protect('designpulse', PROTECT_OPTIONS);
  const divDataRows = Math.max(200, divisions.length + 10);
  for (let row = 2; row <= divDataRows; row++) {
    divSheet.getCell(row, 1).protection = { locked: false };
    divSheet.getCell(row, 2).protection = { locked: false };
  }

  // Freeze header row
  divSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }];

  // ── Sheet 2: "Cost Codes" ───────────────────────────────────────────────────
  const codeSheet = workbook.addWorksheet('Cost Codes');

  codeSheet.columns = [
    { header: 'Code',        key: 'code',        width: 16 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Division #',  key: 'division_num', width: 14 },
    { header: 'Category L',  key: 'category_l',  width: 14 },
    { header: 'Category M',  key: 'category_m',  width: 14 },
    { header: 'Category S',  key: 'category_s',  width: 14 },
    { header: 'Category E',  key: 'category_e',  width: 14 },
    { header: 'Category O',  key: 'category_o',  width: 14 },
  ];

  // Style header row
  const codeHeader = codeSheet.getRow(1);
  codeHeader.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  codeHeader.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  codeHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  codeSheet.getCell('C1').note =
    'Enter the 2-digit Division # (e.g. "01"). Must match a row in the Divisions sheet.';

  // Text format on Code (A) and Division # (C) columns to preserve leading zeros
  codeSheet.getColumn('A').numFmt = '@';
  codeSheet.getColumn('C').numFmt = '@';

  // Build parent_division → 2-digit prefix lookup
  const divPrefixByCode = new Map<string, string>();
  divisions.forEach(div => divPrefixByCode.set(div.code, divPrefix(div.code)));

  // Pre-populate child codes sorted by code
  childCodes.forEach(cc => {
    const divNum = cc.parent_division
      ? (divPrefixByCode.get(cc.parent_division) ?? cc.parent_division.slice(0, 2))
      : '';
    codeSheet.addRow({
      code:         cc.code,
      description:  cc.description,
      division_num: divNum,
      category_l:   toBoolStr(cc.category_l),
      category_m:   toBoolStr(cc.category_m),
      category_s:   toBoolStr(cc.category_s),
      category_e:   toBoolStr(cc.category_e),
      category_o:   toBoolStr(cc.category_o),
    });
  });

  // Protect: header locked, data rows unlocked
  await codeSheet.protect('designpulse', PROTECT_OPTIONS);
  const codeDataRows = Math.max(1000, childCodes.length + 10);
  for (let row = 2; row <= codeDataRows; row++) {
    for (let col = 1; col <= 8; col++) {
      codeSheet.getCell(row, col).protection = { locked: false };
    }
  }

  // Data validations on all potential data rows
  for (let i = 2; i <= codeDataRows; i++) {
    // Column C: Division # — validated against visible Divisions sheet (generous range = future-proof)
    codeSheet.getCell(`C${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Divisions!$A$2:$A$500'],
      showErrorMessage: true,
      errorTitle: 'Invalid Division #',
      error: 'Enter a 2-digit Division # from the Divisions sheet (e.g. "01", "26").',
    };

    // Columns D–H: Yes/No for category flags
    for (const col of ['D', 'E', 'F', 'G', 'H'] as const) {
      codeSheet.getCell(`${col}${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Metadata!$A$2:$A$3'],
        showErrorMessage: true,
        errorTitle: 'Invalid Input',
        error: 'Please select Yes or No.',
      };
    }
  }

  // Freeze header row
  codeSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
