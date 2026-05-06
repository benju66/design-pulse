import { Database } from '@/types/database.types';
import type { Row } from 'exceljs';

type CostCodeInsert = Database['public']['Tables']['cost_codes']['Insert'];

// ------------------------------------------------------------------
// Strict type-safe cell value extractor (no `any`) — Rule C1
// ------------------------------------------------------------------
function safeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text.trim();
    if (typeof obj.result !== 'undefined') return safeString(obj.result);
  }
  return String(val).trim();
}

// iOS-safe all-digits check: loop, no regex (AGENTS.md Rule A)
function isAllDigits(s: string): boolean {
  return s.length > 0 && s.split('').every(ch => ch >= '0' && ch <= '9');
}

// ------------------------------------------------------------------
// Normalise a raw Division # value to a 6-digit parent_division code.
//
// Handles all input variants:
//   "1"      → "01" → "010000"   (single digit, no leading zero)
//   "01"     → "01" → "010000"   (standard 2-digit)
//   "010000" → "01" → "010000"   (user typed the full 6-digit code by mistake)
//
// iOS-safe: no regex — uses string slicing and padStart/padEnd.
// ------------------------------------------------------------------
function normaliseDivNum(raw: string): string | null {
  if (!raw || !isAllDigits(raw)) return null;
  const numStr = raw.length === 6
    ? raw.slice(0, 2)          // "010000" → "01"
    : raw.padStart(2, '0');    // "1" → "01"
  return numStr.padEnd(6, '0'); // "01" → "010000"
}

// ------------------------------------------------------------------
// Accept all recognised truthy representations:
//   App template  : "Yes" / "No"
//   Old CSV format: "TRUE" / "FALSE"
//   Raw company   : "1" / "0"
// No regex — pure string equality after toLowerCase() (iOS-safe, AGENTS.md Rule A)
// ------------------------------------------------------------------
function parseCellBool(row: Row, col: number): boolean {
  if (col === -1) return false;
  const v = safeString(row.getCell(col).value).toLowerCase();
  return v === 'yes' || v === 'true' || v === '1';
}

// ------------------------------------------------------------------
// Main Parser
//
// Supports two Excel formats (AGENTS.md Rule C29):
//
//   FORMAT A — Two-sheet (new canonical format):
//     Sheet "Divisions"  → one division per row: Division # | Division Name
//     Sheet "Cost Codes" → one code per row:     Code | Description | Division # | L|M|S|E|O
//     Detected when: "Divisions" sheet exists AND has ≥1 data row
//
//   FORMAT B — Single-sheet (backward compat):
//     Sheet "Cost Code Import", "Sheet1", or worksheets[0]
//     Division info embedded in Column C as "DIV. 01 - General Conditions"
//     Division header rows identified by blank Column C
//     Detected when: "Divisions" sheet is absent or empty
//
// Guardrails:
//   C19 — dynamic import of browser-safe exceljs build
//   C27 / C29 — .xlsx only; two-sheet canonical format
//   C20 — chunked upsert handled downstream in useUploadCostCodesCSV
//   C1  — no `any`; typed via CostCodeInsert
//   A   — no regex lookbehinds; iOS-safe digit checks and string ops only
// ------------------------------------------------------------------
export async function parseCostCodeExcel(
  arrayBuffer: ArrayBuffer
): Promise<CostCodeInsert[]> {
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // ── Format detection ──────────────────────────────────────────────────────
  const divisionsSheet = workbook.getWorksheet('Divisions');
  const hasDivisionsSheet =
    divisionsSheet != null && (divisionsSheet.rowCount ?? 0) > 1;

  const costCodesSheet =
    workbook.getWorksheet('Cost Codes') ??          // new two-sheet format
    workbook.getWorksheet('Cost Code Import') ??    // old single-sheet template
    workbook.getWorksheet('Sheet1') ??              // raw company Excel
    workbook.worksheets[0];                         // absolute fallback

  if (!costCodesSheet) {
    throw new Error(
      'No parseable worksheet found. Please use the provided Design Pulse template.'
    );
  }

  if (hasDivisionsSheet) {
    return twoSheetParse(divisionsSheet!, costCodesSheet);
  } else {
    return singleSheetParse(costCodesSheet);
  }
}

// ------------------------------------------------------------------
// FORMAT A — Two-sheet parse
// ------------------------------------------------------------------
function twoSheetParse(
  divisionsSheet: import('exceljs').Worksheet,
  costCodesSheet: import('exceljs').Worksheet
): CostCodeInsert[] {
  // payloadMap ensures Pass 1 rows always take precedence over Pass 2.
  // Using a Map (not array) deduplicates by code automatically.
  const payloadMap = new Map<string, CostCodeInsert>();
  // Set of codes established in Pass 1 — used to skip conflicts in Pass 2.
  const pass1Codes = new Set<string>();

  // ── Pass 1: Divisions sheet ─────────────────────────────────────
  divisionsSheet.eachRow((row: Row, rowNum: number) => {
    if (rowNum === 1) return; // skip header

    const rawNum = safeString(row.getCell(1).value);
    const description = safeString(row.getCell(2).value);
    if (!rawNum || !description) return;

    const divCode = normaliseDivNum(rawNum);
    if (!divCode) return;

    payloadMap.set(divCode, {
      code:         divCode,
      description,
      is_division:  true,
      parent_division: null,
      category_l:   false,
      category_m:   false,
      category_s:   false,
      category_e:   false,
      category_o:   false,
    });
    pass1Codes.add(divCode);
  });

  // ── Pass 2: Cost Codes sheet ─────────────────────────────────────
  // Discover column positions from header row
  const colIndex: Record<string, number> = {};
  const headerRow = costCodesSheet.getRow(1);
  if (headerRow) {
    headerRow.eachCell((cell, colNumber) => {
      colIndex[safeString(cell.value).toLowerCase().trim()] = colNumber;
    });
  }

  const colCode    = colIndex['code']        ?? 1;
  const colDesc    = colIndex['description'] ?? 2;
  const colDivNum  = colIndex['division #']  ?? 3;
  const colCatL    = colIndex['category l']  ?? 4;
  const colCatM    = colIndex['category m']  ?? 5;
  const colCatS    = colIndex['category s']  ?? 6;
  const colCatE    = colIndex['category e']  ?? 7;
  const colCatO    = colIndex['category o']  ?? 8;

  if (colCode === -1 || colDesc === -1) {
    throw new Error('Cost Codes sheet is missing required "Code" or "Description" columns.');
  }

  costCodesSheet.eachRow((row: Row, rowNum: number) => {
    if (rowNum === 1) return;

    let code = safeString(row.getCell(colCode).value);
    const description = safeString(row.getCell(colDesc).value);
    if (!code || !description) return;

    // Pad short numeric codes (Excel may strip leading zeros despite Text format)
    if (isAllDigits(code) && code.length < 6) {
      code = code.padStart(6, '0');
    }

    // Pass 1 always wins — skip any code that was established as a division header
    if (pass1Codes.has(code)) return;

    const rawDivNum = colDivNum !== -1
      ? safeString(row.getCell(colDivNum).value)
      : '';
    const parent_division = rawDivNum ? normaliseDivNum(rawDivNum) : null;

    const isSelfRef = parent_division !== null && parent_division === code;
    const is_division = parent_division === null || isSelfRef;
    const resolvedParent = isSelfRef ? null : parent_division;

    payloadMap.set(code, {
      code,
      description,
      is_division,
      parent_division: resolvedParent,
      category_l: parseCellBool(row, colCatL),
      category_m: parseCellBool(row, colCatM),
      category_s: parseCellBool(row, colCatS),
      category_e: parseCellBool(row, colCatE),
      category_o: parseCellBool(row, colCatO),
    });
  });

  const result = Array.from(payloadMap.values());
  if (result.length === 0) {
    throw new Error(
      'No valid cost code rows found. Ensure the Cost Codes sheet has a header row ' +
      'and at least one data row with a Code and Description.'
    );
  }
  return result;
}

// ------------------------------------------------------------------
// FORMAT B — Single-sheet backward compat parse
//
// Handles:
//   - Old app template ("Cost Code Import" sheet)
//   - Raw company Excel ("Sheet1" or first sheet)
//
// Division info is embedded in Column C as "DIV. 01 - General Conditions".
// Division header rows have blank Column C.
//
// Regex note: \b\d{1,2}\b is used here to extract 1–2 digit division numbers
// from human-readable strings. This is a word-boundary regex — NOT a negative
// lookbehind — and is safe on iOS WebKit (AGENTS.md Rule A).
// ------------------------------------------------------------------
function singleSheetParse(sheet: import('exceljs').Worksheet): CostCodeInsert[] {
  const payload: CostCodeInsert[] = [];

  // Column index map from header row
  const colIndex: Record<string, number> = {};
  const headerRow = sheet.getRow(1);
  if (headerRow) {
    headerRow.eachCell((cell, colNumber) => {
      colIndex[safeString(cell.value).toLowerCase().trim()] = colNumber;
    });
  }

  const colCode   = colIndex['code']           ?? 1;
  const colDesc   = colIndex['description']    ?? 2;
  const colParent = colIndex['parent division'] ?? colIndex['parent_division'] ?? 3;
  const colCatL   = colIndex['category l']     ?? 4;
  const colCatM   = colIndex['category m']     ?? 5;
  const colCatS   = colIndex['category s']     ?? 6;
  const colCatE   = colIndex['category e']     ?? 7;
  const colCatO   = colIndex['category o']     ?? 8;

  if (colCode === -1 || colDesc === -1) {
    throw new Error('Excel file is missing required column: "Code" or "Description".');
  }

  sheet.eachRow((row: Row, rowNum: number) => {
    if (rowNum === 1) return;

    let code = safeString(row.getCell(colCode).value);
    const description = safeString(row.getCell(colDesc).value);
    if (!code || !description) return;

    if (isAllDigits(code) && code.length < 6) {
      code = code.padStart(6, '0');
    }

    const rawParent = colParent !== -1
      ? safeString(row.getCell(colParent).value)
      : '';
    let parent_division: string | null = null;

    if (rawParent !== '') {
      if (isAllDigits(rawParent)) {
        parent_division = rawParent.length < 6
          ? rawParent.padStart(6, '0')
          : rawParent;
      } else {
        // Human-readable: "DIV. 01 - General Conditions" → extract "01" → "010000"
        // \b\d{1,2}\b = word-boundary, 1-2 digit number. NOT a lookbehind. iOS-safe.
        const match = rawParent.match(/\b\d{1,2}\b/);
        if (match) {
          const numStr = match[0].length === 1 ? '0' + match[0] : match[0];
          parent_division = numStr.padEnd(6, '0');
        } else {
          parent_division = rawParent;
        }
      }
    }

    const isSelfRef = parent_division !== null && parent_division === code;
    const is_division = parent_division === null || isSelfRef;
    if (isSelfRef) parent_division = null;

    payload.push({
      code,
      description,
      is_division,
      parent_division,
      category_l: parseCellBool(row, colCatL),
      category_m: parseCellBool(row, colCatM),
      category_s: parseCellBool(row, colCatS),
      category_e: parseCellBool(row, colCatE),
      category_o: parseCellBool(row, colCatO),
    });
  });

  if (payload.length === 0) {
    throw new Error(
      'No valid cost code rows found. Ensure the file has a header row and ' +
      'at least one data row with a Code and Description.'
    );
  }

  // ── Auto-synthesize missing division header rows ──────────────────
  // The raw company Excel has no explicit division header rows — they
  // are referenced only in Column C of child codes. After parsing all
  // child rows, synthesize is_division=true header rows for any
  // parent_division value that has no corresponding header in the payload.
  const existingDivCodes = new Set(
    payload.filter(r => r.is_division).map(r => r.code)
  );

  // Track the best description available for each referenced parent_division
  const divDescByCode = new Map<string, string>();

  sheet.eachRow((row: Row, rowNum: number) => {
    if (rowNum === 1 || colParent === -1) return;
    const rawParent = safeString(row.getCell(colParent).value);
    if (!rawParent) return;

    const match = rawParent.match(/\b\d{1,2}\b/);
    if (!match) return;

    const numStr = match[0].length === 1 ? '0' + match[0] : match[0];
    const divCode = numStr.padEnd(6, '0');

    if (!divDescByCode.has(divCode)) {
      // Extract description from "DIV. 01 - General Conditions" → "General Conditions"
      const parts = rawParent.split(' - ');
      const desc = parts.length > 1
        ? parts.slice(1).join(' - ').trim()
        : rawParent.trim();
      divDescByCode.set(divCode, desc);
    }
  });

  divDescByCode.forEach((description, code) => {
    if (!existingDivCodes.has(code)) {
      payload.unshift({
        code,
        description,
        is_division: true,
        parent_division: null,
        category_l: false,
        category_m: false,
        category_s: false,
        category_e: false,
        category_o: false,
      });
      existingDivCodes.add(code);
    }
  });

  return payload;
}
