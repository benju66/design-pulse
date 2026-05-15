/**
 * One-off script to parse CSI_Spec_Template.xlsx and insert rows
 * into company_csi_defaults via the bulk_upsert_company_csi_defaults RPC.
 *
 * Usage: npx tsx src/scripts/seedCompanyDefaults.ts
 */
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const filePath = path.resolve(__dirname, '../../../CSI_Spec_Template.xlsx');
  console.log(`Reading: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Find the first visible sheet with CSI-like headers
  let sheet: ExcelJS.Worksheet | null = null;
  let csiCol = -1;
  let descCol = -1;
  let costCodeCol = -1;

  for (const ws of workbook.worksheets) {
    if (ws.state === 'hidden') continue;
    csiCol = -1;
    descCol = -1;
    costCodeCol = -1;

    ws.getRow(1).eachCell((cell, colNumber) => {
      const val = String(cell.text || '').toLowerCase().replace(/[^a-z]/g, '');
      if (val.includes('csi') || val.includes('spec')) csiCol = colNumber;
      else if (val.includes('desc') || val.includes('title')) descCol = colNumber;
      else if (val.includes('costcode') || val.includes('code')) costCodeCol = colNumber;
    });

    if (csiCol !== -1) {
      sheet = ws;
      // If we didn't find a dedicated description column, check if col 2 is description-like
      if (descCol === -1 && csiCol === 1) descCol = 2;
      break;
    }
  }

  if (!sheet) {
    // Fallback: try first sheet, assume Col A = CSI, Col B = Description
    sheet = workbook.worksheets[0];
    csiCol = 1;
    descCol = 2;
    costCodeCol = -1;
    console.log('No CSI header found, falling back to Col A=CSI, Col B=Description');
  }

  console.log(`Sheet: "${sheet.name}", CSI col: ${csiCol}, Desc col: ${descCol}, Cost Code col: ${costCodeCol}`);

  // Print first row headers for debugging
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNum) => {
    headers.push(`Col ${colNum}: "${cell.text}"`);
  });
  console.log('Headers:', headers.join(' | '));

  // Parse rows
  const payload: { id: string; csi_number: string; description: string | null; cost_code: string | null }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const rawCsi = String(row.getCell(csiCol).text || '').trim();
    if (!rawCsi) return;

    const rawDesc = descCol !== -1 ? String(row.getCell(descCol).text || '').trim() : null;

    let costCode: string | null = null;
    if (costCodeCol !== -1) {
      const rawCode = String(row.getCell(costCodeCol).text || '').trim();
      if (rawCode) {
        costCode = rawCode.split(' - ')[0].split(' – ')[0].trim();
      }
    }

    payload.push({
      id: crypto.randomUUID(),
      csi_number: rawCsi,
      description: rawDesc || null,
      cost_code: costCode || null,
    });
  });

  console.log(`Parsed ${payload.length} CSI default rows`);

  if (payload.length === 0) {
    console.error('No rows parsed. Check file format.');
    process.exit(1);
  }

  // Print first 5 rows for verification
  console.log('\nSample rows:');
  payload.slice(0, 5).forEach((r, i) =>
    console.log(`  ${i + 1}. CSI: "${r.csi_number}" | Desc: "${r.description}" | Code: "${r.cost_code}"`)
  );

  // Chunk and upsert (AGENTS.md C20: chunk size 50)
  const CHUNK_SIZE = 50;
  let inserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    const chunk = payload.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.rpc('bulk_upsert_company_csi_defaults', {
      p_payload: chunk,
    });
    if (error) {
      console.error(`Chunk ${i / CHUNK_SIZE + 1} failed:`, error.message);
      process.exit(1);
    }
    inserted += chunk.length;
    console.log(`Upserted chunk ${Math.floor(i / CHUNK_SIZE) + 1} (${inserted}/${payload.length})`);
  }

  console.log(`\n✅ Successfully seeded ${payload.length} company CSI defaults.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
