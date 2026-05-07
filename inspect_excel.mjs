/**
 * inspect_excel.mjs — Deep cell inspection for Budget Line Items sheet
 * Run: node inspect_excel.mjs (from designpulse-next/ dir)
 */
const { default: ExcelJS } = await import('exceljs');
import { readFileSync } from 'fs';

const FILE = 'C:\\Users\\BUrness\\Dev\\design-pulse\\Budget Import Test.xlsx';
const TARGET_SHEET = 'Budget Line Items';
const DUMP_ROWS = 20; // dump first N data rows

const buf = readFileSync(FILE);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);

console.log('\nAll sheets:');
for (const ws of wb.worksheets) {
  console.log(`  "${ws.name}"  state=${ws.state}  rows=${ws.rowCount}  cols=${ws.columnCount}`);
}

// Try the target sheet, fall back to first non-hidden
let sheet = wb.getWorksheet(TARGET_SHEET);
if (!sheet) {
  for (const ws of wb.worksheets) {
    if (ws.state !== 'hidden') { sheet = ws; break; }
  }
}
console.log(`\nInspecting sheet: "${sheet.name}"`);

// Header row — map col index → header name
const colNames = {};
sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
  const v = cell.value;
  const txt = typeof v === 'string' ? v
    : (typeof v === 'object' && v !== null && 'richText' in v)
      ? v.richText.map(r => r.text).join('')
      : String(v ?? '');
  colNames[col] = txt;
  console.log(`  Header col${col} (${String.fromCharCode(64 + col)}): "${txt}"`);
});

console.log(`\n--- First ${DUMP_ROWS} data rows (full cell dump) ---`);
let dataRowCount = 0;
sheet.eachRow((row, rowNum) => {
  if (rowNum === 1) return;
  if (dataRowCount >= DUMP_ROWS) return;
  dataRowCount++;

  const cells = [];
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const v = cell.value;
    let desc;
    if (v === null || v === undefined) {
      desc = '(null)';
    } else if (typeof v === 'number') {
      desc = `NUMBER(${v})`;
    } else if (typeof v === 'string') {
      desc = `STRING("${v}")`;
    } else if (typeof v === 'boolean') {
      desc = `BOOL(${v})`;
    } else if (typeof v === 'object') {
      if ('formula' in v) {
        // Full formula cell dump — shows formula text AND cached result
        const result = v.result;
        const resultDesc = result === null || result === undefined
          ? 'NULL'
          : typeof result === 'object' && 'error' in result
            ? `ERROR(${result.error})`
            : typeof result === 'number'
              ? `NUMBER(${result})`
              : `OTHER(${JSON.stringify(result)})`;
        desc = `FORMULA("${v.formula}") result=${resultDesc}`;
      } else if ('sharedFormula' in v) {
        const result = v.result;
        const resultDesc = result === null || result === undefined
          ? 'NULL'
          : typeof result === 'number'
            ? `NUMBER(${result})`
            : `OTHER(${JSON.stringify(result)})`;
        desc = `SHARED_FORMULA("${v.sharedFormula}") result=${resultDesc}`;
      } else if ('richText' in v) {
        desc = `RICHTEXT("${v.richText.map(r => r.text).join('')}")`;
      } else {
        desc = `OBJECT(${JSON.stringify(v)})`;
      }
    } else {
      desc = `UNKNOWN(${String(v)})`;
    }
    const colLetter = String.fromCharCode(64 + col);
    const colLabel = colNames[col] ? `${colLetter}:"${colNames[col]}"` : colLetter;
    cells.push(`[${colLabel}] ${desc}`);
  });
  console.log(`\nRow ${rowNum}:`);
  cells.forEach(c => console.log(`  ${c}`));
});
