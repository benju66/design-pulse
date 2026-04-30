import { DisciplineConfig, DisciplineDetails } from '@/types/models';
import type { Cell, Row } from 'exceljs';

export interface DraftCoordinationTask {
  id: string; // Minted on client
  title: string;
  description: string;
  priority: string;
  building_area: string;
  cost_code: string;
  coordination_details: Record<string, DisciplineDetails>;
  errors: string[];
}

export async function parseCoordinationExcel(
  arrayBuffer: ArrayBuffer,
  disciplinesConfig: DisciplineConfig[]
): Promise<DraftCoordinationTask[]> {
  // Dynamically import exceljs browser build to protect main bundle
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheet = workbook.getWorksheet('Coordination Import');
  if (!sheet) {
    throw new Error('Could not find the "Coordination Import" worksheet. Please use the provided template.');
  }

  const tasks: DraftCoordinationTask[] = [];

  // Create a map for case-insensitive discipline lookup
  const disciplineMap = new Map<string, string>();
  disciplinesConfig.forEach(d => {
    disciplineMap.set(d.label.toLowerCase().trim(), d.id);
  });

  // Map of column index -> discipline id
  const columnToDisciplineId = new Map<number, string>();
  
  // Read headers to map dynamic discipline columns
  const headerRow = sheet.getRow(1);
  if (headerRow) {
    headerRow.eachCell((cell: Cell, colNumber: number) => {
      const headerText = cell.value?.toString().trim() || '';
      if (headerText.startsWith('[Disc] ')) {
        const disciplineLabel = headerText.replace('[Disc] ', '').trim().toLowerCase();
        const disciplineId = disciplineMap.get(disciplineLabel);
        if (disciplineId) {
          columnToDisciplineId.set(colNumber, disciplineId);
        }
      }
    });
  }

  // Start reading from row 2 (skipping header)
  sheet.eachRow((row: Row, rowNumber: number) => {
    if (rowNumber === 1) return;

    // Extract raw values, falling back to empty string if empty
    // Cast dates/numbers to string gracefully
    const safeString = (val: any) => {
      if (val === null || val === undefined) return '';
      if (val.text) return val.text.toString().trim(); // Handling rich text or formula results
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return val.toString().trim();
    };

    const title = safeString(row.getCell(1).value);
    const description = safeString(row.getCell(2).value);
    const priority = safeString(row.getCell(3).value) || 'Set Priority';
    const building_area = safeString(row.getCell(4).value);
    const cost_code = safeString(row.getCell(5).value);

    // Skip completely blank rows (all base columns empty)
    if (!title && !description && !priority && !building_area && !cost_code) {
      return;
    }

    const errors: string[] = [];
    if (!title) {
      errors.push('Title is required.');
    }

    const coordination_details: Record<string, DisciplineDetails> = {};

    // Parse Boolean Matrix for Disciplines
    columnToDisciplineId.forEach((disciplineId, colNumber) => {
      const cellValue = safeString(row.getCell(colNumber).value).toLowerCase();
      if (cellValue === 'yes' || cellValue === 'true' || cellValue === 'y') {
        coordination_details[disciplineId] = {
          status: 'Pending',
          notes: ''
        };
      }
    });

    // Mint client-side UUID (AGENTS.md guardrail)
    const id = crypto.randomUUID();

    tasks.push({
      id,
      title,
      description,
      priority,
      building_area,
      cost_code,
      coordination_details,
      errors
    });
  });

  return tasks;
}
