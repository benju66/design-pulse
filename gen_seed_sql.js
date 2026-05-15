const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(__dirname, '../CSI_Spec_Template.xlsx'));
  const ws = wb.worksheets[0];

  const rows = [];
  ws.eachRow((row, rn) => {
    if (rn === 1) return;
    const csi = String(row.getCell(1).text || '').trim();
    const desc = String(row.getCell(2).text || '').trim();
    const rawCode = String(row.getCell(3).text || '').trim();
    if (!csi) return;

    const code = rawCode ? rawCode.split(' - ')[0].split(' \u2013 ')[0].trim() : null;
    const escDesc = desc.replace(/'/g, "''");
    const escCsi = csi.replace(/'/g, "''");
    const codeVal = code ? "'" + code + "'" : 'NULL';
    rows.push("  ('" + escCsi + "', '" + escDesc + "', " + codeVal + ")");
  });

  const sql = [
    '-- Seed ' + rows.length + ' company CSI defaults',
    '-- Run in Supabase SQL Editor',
    'INSERT INTO company_csi_defaults (csi_number, description, cost_code)',
    'VALUES',
    rows.join(',\n'),
    'ON CONFLICT (csi_number) DO UPDATE SET',
    '  description = EXCLUDED.description,',
    '  cost_code = EXCLUDED.cost_code;',
  ].join('\n');

  const outPath = path.resolve(__dirname, 'seed_company_defaults.sql');
  fs.writeFileSync(outPath, sql, 'utf-8');
  console.log('Wrote ' + rows.length + ' rows to ' + outPath);
}

main().catch(console.error);
