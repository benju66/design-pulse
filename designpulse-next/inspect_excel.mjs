/**
 * inspect_excel.mjs
 * Run: node inspect_excel.mjs
 * Dumps sheet names, header rows, and first 3 data rows from both Procore templates.
 */
import path from 'path';
import { readFileSync } from 'fs';

// Dynamic import of exceljs (ESM-compatible)
const { default: ExcelJS } = await import('exceljs');

const FILES = [
  'C:\\Users\\BUrness\\Dev\\design-pulse\\Procore_budget_Import_Template.xlsx',
  'C:\\Users\\BUrness\\Downloads\\procore_budget_import_template.xlsx',
  'C:\\Users\\BUrness\\Downloads\\02_Temporary\\Company_Estimate_Template.xlsx',
];

function cellVal(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '(empty)';
  if (typeof v === 'object' && 'formula' in v) {
    return `FORMULA[result=${v.result ?? 'none'}]`;
  }
  if (typeof v === 'object' && 'richText' in v) {
    return v.richText.map(r => r.text).join('');
  }
  if (typeof v === 'object' && 'error' in v) {
    return `ERROR[${v.error}]`;
  }
  return String(v);
}

for (const filePath of FILES) {
  console.log('\n' + '='.repeat(80));
  console.log('FILE:', filePath);
  console.log('='.repeat(80));

  let buf;
  try {
    buf = readFileSync(filePath);
  } catch {
    console.log('  [FILE NOT FOUND — skipping]');
    continue;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  console.log(`\nSheets (${wb.worksheets.length} total):`);
  for (const ws of wb.worksheets) {
    console.log(`  "${ws.name}"  state=${ws.state}  rows=${ws.rowCount}`);
  }

  for (const ws of wb.worksheets) {
    if (ws.state === 'hidden') continue;
    console.log(`\n--- Sheet: "${ws.name}" ---`);

    // Header row
    const hdr = ws.getRow(1);
    const headers = [];
    hdr.eachCell({ includeEmpty: false }, (cell, col) => {
      headers.push(`col${col}="${cellVal(cell)}"`);
    });
    console.log('  Headers:', headers.join(', ') || '(none)');

    // First 5 data rows
    for (let r = 2; r <= Math.min(ws.rowCount, 6); r++) {
      const row = ws.getRow(r);
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        cells.push(`[${col}]${cellVal(cell)}`);
      });
      if (cells.length > 0) {
        console.log(`  Row ${r}:`, cells.join('  '));
      }
    }
  }
}
