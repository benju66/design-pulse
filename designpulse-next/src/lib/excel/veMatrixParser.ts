import type { Cell, Row } from 'exceljs';

export interface DraftMatrixOption {
  id: string; // Minted locally (AGENTS.md Rule C8)
  order_index: number;
  title: string;
  cost_impact: number;
}

export interface DraftMatrixRow {
  id: string; // Minted locally for staging key
  display_id: string; // Matched against DB during bulk upsert
  title: string;
  cost_impact: number;
  days_impact: number;
  status: string;
  final_direction: string;
  building_area: string;
  division: string;
  cost_code: string;
  spec_number_id: string;
  priority: string;
  assignee: string;
  due_date: string;
  options: DraftMatrixOption[];
  errors: string[];
}

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

function safeNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[$,]/g, ''));
    if (!isNaN(parsed)) return parsed;
  }
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    if (typeof obj.result !== 'undefined') return safeNumber(obj.result);
  }
  return 0;
}

export async function parseVeMatrixExcel(arrayBuffer: ArrayBuffer): Promise<DraftMatrixRow[]> {
  // Dynamic import: browser-safe build prevents Node.js stream polyfill errors (AGENTS.md Rule C19)
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheet = workbook.getWorksheet('VE Matrix');
  if (!sheet) {
    throw new Error('Could not find "VE Matrix" worksheet. Please use the downloaded template.');
  }

  const results: DraftMatrixRow[] = [];
  const headerRow = sheet.getRow(1);
  
  // Find column indices dynamically
  const colMap = {
    display_id: -1, title: -1, cost_impact: -1, days_impact: -1, status: -1,
    final_direction: -1, building_area: -1, division: -1, cost_code: -1,
    spec_number_id: -1, priority: -1, assignee: -1, due_date: -1
  };
  
  // Maps order_index to column numbers for title/cost
  const contenderMap = new Map<number, { titleCol: number, costCol: number }>();

  headerRow.eachCell((cell: Cell, colNumber: number) => {
    const header = safeString(cell.value).toLowerCase();
    
    // Base columns mapping
    if (header === 'id' || header === 'display id') colMap.display_id = colNumber;
    else if (header === 'title (element)' || header === 'title') colMap.title = colNumber;
    else if (header === 'cost impact ($)' || header === 'cost impact') colMap.cost_impact = colNumber;
    else if (header === 'days impact') colMap.days_impact = colNumber;
    else if (header === 've status' || header === 'status') colMap.status = colNumber;
    else if (header === 'final direction') colMap.final_direction = colNumber;
    else if (header === 'building area') colMap.building_area = colNumber;
    else if (header === 'division') colMap.division = colNumber;
    else if (header === 'cost code') colMap.cost_code = colNumber;
    else if (header === 'csi spec') colMap.spec_number_id = colNumber;
    else if (header === 'priority') colMap.priority = colNumber;
    else if (header === 'assigned user') colMap.assignee = colNumber;
    else if (header === 'due date') colMap.due_date = colNumber;
    else {
      // Dynamic Contender mapping: e.g. "[C1] Title" or "[C1] Cost"
      const match = header.match(/\[c(\d+)\]\s*(title|cost)/i);
      if (match) {
        const index = parseInt(match[1]) - 1; // 0-indexed order_index
        const type = match[2].toLowerCase();
        
        if (!contenderMap.has(index)) {
          contenderMap.set(index, { titleCol: -1, costCol: -1 });
        }
        
        const entry = contenderMap.get(index)!;
        if (type === 'title') entry.titleCol = colNumber;
        else if (type === 'cost') entry.costCol = colNumber;
      }
    }
  });

  sheet.eachRow((row: Row, rowNumber: number) => {
    if (rowNumber === 1) return;

    const title = colMap.title > 0 ? safeString(row.getCell(colMap.title).value) : '';
    
    // Skip entirely blank rows (but allow rows where only title is filled)
    if (!title && colMap.display_id > 0 && !safeString(row.getCell(colMap.display_id).value)) {
      return;
    }

    const display_id = colMap.display_id > 0 ? safeString(row.getCell(colMap.display_id).value) : '';
    const cost_impact = colMap.cost_impact > 0 ? safeNumber(row.getCell(colMap.cost_impact).value) : 0;
    const days_impact = colMap.days_impact > 0 ? safeNumber(row.getCell(colMap.days_impact).value) : 0;
    const status = colMap.status > 0 ? safeString(row.getCell(colMap.status).value) : 'Draft';
    const final_direction = colMap.final_direction > 0 ? safeString(row.getCell(colMap.final_direction).value) : '';
    const building_area = colMap.building_area > 0 ? safeString(row.getCell(colMap.building_area).value) : '';
    const division = colMap.division > 0 ? safeString(row.getCell(colMap.division).value) : '';
    const cost_code = colMap.cost_code > 0 ? safeString(row.getCell(colMap.cost_code).value) : '';
    const spec_number_id = colMap.spec_number_id > 0 ? safeString(row.getCell(colMap.spec_number_id).value) : '';
    const priority = colMap.priority > 0 ? safeString(row.getCell(colMap.priority).value) : '';
    const assignee = colMap.assignee > 0 ? safeString(row.getCell(colMap.assignee).value) : '';
    const due_date = colMap.due_date > 0 ? safeString(row.getCell(colMap.due_date).value) : '';

    const errors: string[] = [];
    if (!title) errors.push('Title is required.');

    const options: DraftMatrixOption[] = [];
    contenderMap.forEach((cols, index) => {
      const optTitle = cols.titleCol > 0 ? safeString(row.getCell(cols.titleCol).value) : '';
      const optCost = cols.costCol > 0 ? safeNumber(row.getCell(cols.costCol).value) : 0;
      
      if (optTitle || optCost !== 0) {
        options.push({
          id: crypto.randomUUID(), // Mint client UUID for options
          order_index: index,
          title: optTitle || 'Untitled Contender',
          cost_impact: optCost
        });
      }
    });

    results.push({
      id: crypto.randomUUID(), // Staging row key
      display_id,
      title,
      cost_impact,
      days_impact,
      status,
      final_direction,
      building_area,
      division,
      cost_code,
      spec_number_id,
      priority,
      assignee,
      due_date,
      options,
      errors
    });
  });

  return results;
}
