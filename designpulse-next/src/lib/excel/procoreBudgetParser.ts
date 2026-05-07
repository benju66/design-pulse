/**
 * procoreBudgetParser.ts
 *
 * Client-side parser for the Procore Budget Import Template (.xlsx).
 * Runs entirely in the browser — no server round-trip (AGENTS.md C19).
 *
 * Procore cost code format: "{div}-{sub}.{ext}"  e.g. "2-29005.000"
 * Internal format (6-digit): "029005"
 * Normalization: extract sub-code only, padStart to 6 digits (AGENTS.md C32).
 *
 * iOS-safe: zero regex lookbehind (AGENTS.md A).
 * Strict TypeScript: no any — ExcelJS cells typed via ExcelJS.CellValue (AGENTS.md C1).
 */

import type { EstimateStagingRow, EstimateCostType } from '@/types/models';
import type { Workbook, Worksheet, Cell, Row } from 'exceljs';

// ── ParseResult ──────────────────────────────────────────────────────────────
// Returned by parseProcoreBudgetExcel. availableHeaders lists every column found
// in the sheet (excluding structural columns) so the UI can offer a column picker
// when the default Budget Amount column is unresolvable.
export interface ParseResult {
  rows:             EstimateStagingRow[];
  // Lowercase column headers that carry numeric data — used by the staging column picker.
  // e.g. ['manual calculation', 'unit qty', 'unit cost', 'budget amount']
  availableHeaders: string[];
}

// ── Normalizer ───────────────────────────────────────────────────────────────
// Converts Procore's hyphenated code to our 6-digit internal format.
// The division prefix is discarded — the sub-code already encodes it numerically.
// Returns null for any malformed, non-numeric, or out-of-range input.
function normalizeProcoreCode(raw: string): string | null {
  const hyphenIdx = raw.indexOf('-');
  if (hyphenIdx === -1) return null;

  const afterDiv = raw.slice(hyphenIdx + 1);          // "29005.000"
  const dotIdx = afterDiv.indexOf('.');
  const subCode = dotIdx === -1 ? afterDiv : afterDiv.slice(0, dotIdx); // "29005"

  if (subCode.length === 0) return null;

  // All-digit validation (iOS-safe — no regex lookbehind)
  for (let i = 0; i < subCode.length; i++) {
    const ch = subCode[i];
    if (ch < '0' || ch > '9') return null;
  }

  // Length guard BEFORE padStart — padStart only pads up, never truncates.
  if (subCode.length > 6) return null;

  return subCode.padStart(6, '0'); // "029005"
}

// ── Cost Type Parser ─────────────────────────────────────────────────────────
function parseCostType(raw: string): EstimateCostType | null {
  const s = raw.trim().toLowerCase();
  if (s === 'labor')       return 'Labor';
  if (s === 'material')    return 'Material';
  if (s === 'subcontract') return 'Subcontract';
  if (s === 'equipment')   return 'Equipment';
  if (s === 'other')       return 'Other';
  return null;
}

// Safely extract a string from an ExcelJS cell value (which is a union type).
// Handles formula cells: ExcelJS returns { formula, result } for formula-driven cells.
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // RichText object: { richText: [{text}] }
    if ('richText' in (value as object)) {
      const rt = (value as { richText: { text: string }[] }).richText;
      return rt.map(r => r.text).join('');
    }
    // Formula cell: { formula, result } — resolve result to a primitive directly.
    // NEVER recurse into cellText(result) — result is always a primitive in ExcelJS
    // (number | string | boolean | Date | null | {error}) and never another formula object.
    // Recursing would create an unbounded call chain on pathological inputs.
    if ('result' in (value as object)) {
      const r = (value as { result: unknown }).result;
      if (typeof r === 'string')  return r;
      if (typeof r === 'number')  return String(r);
      if (typeof r === 'boolean') return String(r);
      if (r instanceof Date)      return r.toISOString();
      return ''; // null, undefined, or error object ({ error: '#DIV/0!' }) — treat as empty
    }
    // Shared formula reference: { sharedFormula: "I17" } — unresolvable without recalculation.
    // Falls through to return '' below.
  }
  return '';
}

// Safely extract a number from an ExcelJS cell value AND signal whether a real
// value was actually found (resolved=true) or whether the cell was empty / a
// formula with no cached result (resolved=false).
//
// Distinguishes three cases:
//   result = number  → resolved=true,  value=result          (real data)
//   result = null    → resolved=false, value=0               (cross-sheet formula, can't resolve)
//   cell empty       → resolved=false, value=0               (no data)
//
// This replaces the old cellNumber() which returned 0 for both resolved-zero
// and unresolvable-formula, making NOCACHE/null-result rows indistinguishable
// from intentional $0 values.
function cellNumberResolved(value: unknown): { value: number; resolved: boolean } {
  if (typeof value === 'number') return { value, resolved: true };
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return isNaN(n) ? { value: 0, resolved: false } : { value: n, resolved: true };
  }
  if (typeof value === 'object' && value !== null) {
    if ('result' in (value as object)) {
      const result = (value as { result: unknown }).result;
      if (typeof result === 'number') return { value: result, resolved: true };
      if (typeof result === 'string') {
        const n = parseFloat(result);
        return isNaN(n) ? { value: 0, resolved: false } : { value: n, resolved: true };
      }
      // result is null, undefined, or error object ({ error: '#DIV/0!' }) —
      // formula cell present but result unresolvable (cross-sheet ref, NOCACHE, etc.)
      return { value: 0, resolved: false };
    }
  }
  return { value: 0, resolved: false };
}

// Convenience wrapper for non-budget numeric cells where we only need the value.
function cellNumber(value: unknown): number {
  return cellNumberResolved(value).value;
}

// ── Main Parser ──────────────────────────────────────────────────────────────
/**
 * Parses any .xlsx file with a "Budget Line Items" sheet into staging rows.
 *
 * @param buffer      - Raw file bytes from File.arrayBuffer()
 * @param projectId   - The current project UUID
 * @param knownCodes  - Set of 6-digit codes from cost_codes table for match detection
 * @returns           - ParseResult: staging rows + list of available column headers
 * @throws            - Descriptive Error if file structure is invalid
 */
export async function parseProcoreBudgetExcel(
  buffer: ArrayBuffer,
  projectId: string,
  knownCodes: Set<string>,
): Promise<ParseResult> {
  // Dynamic import — browser-safe bundle to prevent Next.js Webpack from bundling
  // Node.js stream polyfills from the main exceljs build (AGENTS.md C19).
  // Types sourced from 'exceljs' (compile-time only); src/types/exceljs.d.ts shims the runtime module.
  // Pattern matches costCodeParser.ts and coordinationParser.ts.
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExcelJS = (ExcelJSModule as any).default ?? ExcelJSModule;
  const wb = new ExcelJS.Workbook() as Workbook;
  await wb.xlsx.load(buffer);

  // Prefer sheet named "Budget Line Items"; fall back to first non-hidden sheet
  let sheet: Worksheet | undefined = wb.getWorksheet('Budget Line Items') as Worksheet | undefined;
  if (!sheet) {
    for (const ws of wb.worksheets) {
      if (ws.state !== 'hidden') { sheet = ws; break; }
    }
  }
  if (!sheet) throw new Error('No parseable worksheet found. Expected a sheet named "Budget Line Items".');

  // Discover column positions from header row — case-insensitive.
  // includeEmpty:true prevents silent column misalignment if the template ever gains
  // a blank column between populated headers (defensive guard against future template changes).
  const colMap: Record<string, number> = {};
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell: Cell, col: number) => {
    const txt = cellText(cell.value).toLowerCase().trim();
    if (txt) colMap[txt] = col; // only map non-empty headers
  });

  const colCode   = colMap['cost code']          ?? -1;
  const colType   = colMap['cost type']          ?? -1;
  const colDesc   = colMap['description']        ?? -1;
  const colManual = colMap['manual calculation'] ?? -1; // user-typed override; always a raw number
  const colQty    = colMap['unit qty']           ?? -1;
  const colUOM    = colMap['uom']                ?? -1;
  const colUnit   = colMap['unit cost']          ?? -1;
  const colBudget = colMap['budget amount']      ?? -1;  // formula-driven; may have NOCACHE result

  if (colCode === -1 || colBudget === -1 || colDesc === -1) {
    throw new Error(
      'Required columns not found. Expected: "Cost Code", "Description", "Budget Amount". ' +
      `Found headers: ${Object.keys(colMap).join(', ')}`
    );
  }

  const rows: EstimateStagingRow[] = [];
  let order = 0;

  sheet.eachRow((row: Row, rowNum: number) => {
    if (rowNum === 1) return; // skip header

    const rawCode = cellText(row.getCell(colCode).value).trim();
    if (!rawCode) return; // skip blank-code rows (subtotal rows)

    const rawDesc    = cellText(row.getCell(colDesc).value).trim();
    const rawType    = colType  !== -1 ? cellText(row.getCell(colType).value) : '';
    const rawUOM     = colUOM   !== -1 ? cellText(row.getCell(colUOM).value).trim() : '';
    const unitCost   = colUnit  !== -1 ? cellNumber(row.getCell(colUnit).value) : 0;
    const unitQty    = colQty   !== -1 ? Math.max(cellNumber(row.getCell(colQty).value) || 1, 0.0001) : 1;

    // ── Two-tier budget resolution ────────────────────────────────────────────
    // Tier 1: Manual Calculation column — user-typed raw number, always reliable.
    //         Negative values valid (deducts/credits).
    // Tier 2: Budget Amount column — formula-driven; may be NOCACHE or a
    //         cross-sheet reference that ExcelJS can't resolve (result=null).
    // Tier 3: $0 — both unresolvable; is_budget_resolved=false → amber warning.
    //         NOT a block — $0 early estimates and intentional zero lines are valid.
    const manualRes  = colManual !== -1
      ? cellNumberResolved(row.getCell(colManual).value)
      : { value: 0, resolved: false };
    const budgetRes  = cellNumberResolved(row.getCell(colBudget).value);
    const budgetAmt  = manualRes.value !== 0 ? manualRes.value : budgetRes.value;
    const isBudgetResolved = manualRes.resolved || budgetRes.resolved;

    // ── _rawCols: capture every discovered column's numeric value ─────────────
    // Stored client-side so the staging column picker can remap budget_amount
    // to any column without re-parsing the file. Stripped from DB payload by the
    // mutation hook's explicit field map (AGENTS.md C24).
    const rawCols: Record<string, number> = {};
    for (const [header, colIdx] of Object.entries(colMap)) {
      rawCols[header] = cellNumberResolved(row.getCell(colIdx).value).value;
    }

    const normalized = normalizeProcoreCode(rawCode);
    const costType   = rawType ? parseCostType(rawType) : null;

    rows.push({
      id:                  crypto.randomUUID(), // client-minted UUID (AGENTS.md C8)
      project_id:          projectId,
      cost_code:           normalized,
      cost_type:           costType,
      description:         rawDesc || 'No Description',
      unit_qty:            unitQty,
      uom:                 rawUOM || null,
      unit_cost:           unitCost,
      budget_amount:       budgetAmt,
      display_order:       order++,
      procore_raw_code:    rawCode,
      is_matched:          normalized !== null && knownCodes.has(normalized),
      is_budget_resolved:  isBudgetResolved,
      _rawCols:            rawCols,
    });
  });

  if (rows.length === 0) {
    throw new Error(
      'No valid data rows found. Ensure the file contains rows with a Cost Code and Budget Amount.'
    );
  }

  // availableHeaders: lowercase column headers that carry numeric data.
  // Excludes structural text columns; used by the staging column picker dropdown.
  const nonNumericCols = new Set(['cost code', 'cost type', 'description', 'uom']);
  const availableHeaders = Object.keys(colMap).filter(h => !nonNumericCols.has(h));

  return { rows, availableHeaders };
}
