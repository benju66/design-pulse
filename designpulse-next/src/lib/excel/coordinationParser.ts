import { DisciplineConfig, DisciplineDetails } from '@/types/models';

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

  // Start reading from row 2 (skipping header)
  sheet.eachRow((row, rowNumber) => {
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
    const priority = safeString(row.getCell(3).value);
    const building_area = safeString(row.getCell(4).value);
    const cost_code = safeString(row.getCell(5).value);
    const rawDisciplines = safeString(row.getCell(6).value);

    // Skip completely blank rows (all columns empty)
    if (!title && !description && !priority && !building_area && !cost_code && !rawDisciplines) {
      return;
    }

    const errors: string[] = [];
    if (!title) {
      errors.push('Title is required.');
    }

    const coordination_details: Record<string, DisciplineDetails> = {};

    // Parse disciplines using standard split (AGENTS.md guardrail: NO negative lookbehinds)
    if (rawDisciplines) {
      const parts = rawDisciplines.split(',');
      for (const part of parts) {
        const cleanedPart = part.trim().toLowerCase();
        if (!cleanedPart) continue;

        const disciplineId = disciplineMap.get(cleanedPart);
        if (disciplineId) {
          coordination_details[disciplineId] = {
            status: 'Pending',
            notes: ''
          };
        } else {
          // If we can't fuzzy match it, flag an error
          errors.push(`Unrecognized discipline: "${part.trim()}".`);
        }
      }
    }

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
