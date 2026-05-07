/**
 * inspect_excel_deep.mjs
 * Deeper audit — dumps ALL visible sheets with all rows up to row 20,
 * and specifically hunts for non-zero unit_cost values.
 */
import { readFileSync } from 'fs';
const { default: ExcelJS } = await import('exceljs');

const FILES = [
  'C:\\Users\\BUrness\\Dev\\design-pulse\\Procore_budget_Import_Template.xlsx',
  'C:\\Users\\BUrness\\Downloads\\procore_budget_import_template.xlsx',
  'C:\\Users\\BUrness\\Downloads\\02_Temporary\\Company_Estimate_Template.xlsx',
  'C:\\Users\\BUrness\\Downloads\\List 1.xlsx',
];

function cellVal(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && 'formula' in v) {
    const r = v.result;
    if (r === null || r === undefined) return `FX[NOCACHE]`;
    if (typeof r === 'object' && 'error' in r) return `FX[ERR:${r.error}]`;
    return `FX[${r}]`;
  }
  if (typeof v === 'object' && 'richText' in v) return v.richText.map(r=>r.text).join('');
  if (typeof v === 'object' && 'error' in v) return `ERR[${v.error}]`;
  return v;
}

for (const filePath of FILES) {
  console.log('\n' + '█'.repeat(80));
  console.log('FILE:', filePath);
  let buf;
  try { buf = readFileSync(filePath); }
  catch { console.log('  NOT FOUND'); continue; }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  for (const ws of wb.worksheets) {
    if (ws.state === 'hidden') continue;
    if (!['Budget Line Items','STEP 4 - ESTIMATE','Estimate','Sheet1','Budget'].some(n =>
      ws.name.toLowerCase().includes(n.toLowerCase())
    )) continue;

    console.log(`\n  ┌─ Sheet: "${ws.name}" (${ws.rowCount} rows) ─────────────────────`);

    // Header row — show column index and text
    const hdr = ws.getRow(1);
    const colNames = {};
    hdr.eachCell({ includeEmpty: true }, (cell, col) => {
      const v = cellVal(cell);
      if (v !== null) {
        colNames[col] = String(v).toLowerCase();
        console.log(`  │  col${col} = "${v}"`);
      }
    });

    // First 15 data rows — show every cell with a value
    let nonZeroBudgetFound = false;
    for (let r = 2; r <= Math.min(ws.rowCount, 20); r++) {
      const row = ws.getRow(r);
      const cells = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const v = cellVal(cell);
        if (v !== null) cells[col] = v;
      });
      if (Object.keys(cells).length === 0) continue;

      // Highlight rows where any numeric value > 0 exists in budget-like columns
      const hasValue = Object.values(cells).some(v => typeof v === 'number' && v > 0);
      const prefix = hasValue ? '  │★ ' : '  │  ';
      const parts = Object.entries(cells).map(([col, v]) => {
        const name = colNames[parseInt(col)] ?? `col${col}`;
        return `${name}=${JSON.stringify(v)}`;
      });
      console.log(`${prefix}Row${r}: ${parts.join(' | ')}`);
      if (hasValue) nonZeroBudgetFound = true;
    }
    if (!nonZeroBudgetFound) {
      console.log('  │  ⚠ No non-zero numeric values found in first 20 rows');
    }
    console.log('  └─────────────────────────────────────────────────────────');
  }
}
