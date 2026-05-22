import { CsiSpecItem } from '@/types/models';
import type { Cell, Row } from 'exceljs';

export async function parseCsiSpecExcel(arrayBuffer: ArrayBuffer): Promise<CsiSpecItem[]> {
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Find first visible sheet that contains recognizable headers.
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
      else if (val.includes('costcode')) costCodeCol = colNumber;
    });
    if (csiCol !== -1 && descCol !== -1) {
      sheet = ws;
      break;
    }
  }

  if (!sheet) {
    throw new Error("Could not find a worksheet containing 'CSI Number' and 'Description' columns.");
  }

  const parsedData: CsiSpecItem[] = [];
  sheet.eachRow((row: Row, rowNumber: number) => {
    if (rowNumber === 1) return; // skip header

    const rawCsi = String(row.getCell(csiCol).text || '');
    const rawDesc = String(row.getCell(descCol).text || '');
    if (!rawCsi) return;

    // Strict Formatting & iOS Safety (No negative lookbehinds)
    // Allow periods for extended CSI codes (e.g. 10 1423.16)
    const cleanCsi = rawCsi.replace(/[^a-zA-Z0-9.]/g, '');
    let formattedCsi = cleanCsi;
    
    const parts = cleanCsi.split('.');
    const base = parts[0];
    const ext = parts.length > 1 ? `.${parts[1]}` : '';

    if (/^\d{6}$/.test(base)) {
      formattedCsi = `${base.substring(0, 2)} ${base.substring(2, 4)} ${base.substring(4, 6)}${ext}`;
    }

    let costCodeVal: string | undefined;
    if (costCodeCol !== -1) {
      const rawCostCode = String(row.getCell(costCodeCol).text || '');
      if (rawCostCode) {
        costCodeVal = rawCostCode.split(' - ')[0].trim();
      }
    }

    parsedData.push({
      id: crypto.randomUUID(),
      csi_number: formattedCsi,
      description: rawDesc || "No Description",
      cost_code: costCodeVal || undefined
    });
  });

  return parsedData;
}
