import { CompanyCsiDefault } from '@/types/models';
import type { Cell, Row } from 'exceljs';

export async function parseCompanyDefaultsExcel(arrayBuffer: ArrayBuffer): Promise<Partial<CompanyCsiDefault>[]> {
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Find first visible sheet with CSI/Description headers
  let csiCol = -1;
  let descCol = -1;
  let costCodeCol = -1;
  let sheet: any | undefined;

  for (const ws of workbook.worksheets) {
    if (ws.state === 'hidden') continue;
    csiCol = -1;
    descCol = -1;
    costCodeCol = -1;
    ws.getRow(1).eachCell((cell: Cell, colNumber: number) => {
      const val = String(cell.text || '').toLowerCase().replace(/[^a-z]/g, '');
      if (val.includes('csi')) csiCol = colNumber;
      else if (val.includes('desc')) descCol = colNumber;
      else if (val.includes('costcode') || val.includes('code')) costCodeCol = colNumber;
    });
    if (csiCol !== -1 && descCol !== -1) {
      sheet = ws;
      break;
    }
  }

  if (!sheet) {
    throw new Error("Could not find a worksheet containing 'CSI Number' and 'Description' columns.");
  }

  const parsedPayload: Partial<CompanyCsiDefault>[] = [];
  sheet.eachRow((row: Row, rowNumber: number) => {
    if (rowNumber === 1) return; // skip header
    const rawCsi = String(row.getCell(csiCol).text || '').trim();
    const rawDesc = String(row.getCell(descCol).text || '').trim();
    if (!rawCsi) return;

    let costCodeVal: string | null = null;
    if (costCodeCol !== -1) {
      const rawCostCode = String(row.getCell(costCodeCol).text || '').trim();
      if (rawCostCode) {
        // Strip description suffix (e.g. "096500 - Flooring" → "096500")
        costCodeVal = rawCostCode.split(' - ')[0].split(' – ')[0].trim();
      }
    }

    parsedPayload.push({
      id: crypto.randomUUID(), // C8: Client-side UUIDs
      csi_number: rawCsi,
      description: rawDesc || null,
      cost_code: costCodeVal,
    });
  });

  return parsedPayload;
}
