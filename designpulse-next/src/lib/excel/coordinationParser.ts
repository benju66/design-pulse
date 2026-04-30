import { DisciplineConfig, DisciplineDetails, CostType } from '@/types/models';
import type { Cell, Row } from 'exceljs';

export interface DraftCoordinationTask {
  id: string; // Minted on client (AGENTS.md Rule C8)
  title: string;
  description: string;
  priority: string;
  building_area: string;
  cost_code: string;       // Normalized base code (Procore suffixes stripped)
  cost_type: CostType | null; // Extracted from suffix or explicit column
  coordination_details: Record<string, DisciplineDetails>;
  errors: string[];
}

// ------------------------------------------------------------------
// Rosetta Stone Suffix Parser
// ------------------------------------------------------------------
// Handles both standard (.L/.M/.S) and Procore full-word formats.
// SAFE: uses .endsWith() + .slice() — never .split('.') which would
// shred codes with internal periods (e.g. 09.6500.M → 09).
// iOS guardrail: no negative lookbehind regex (AGENTS.md Rule A).
// ------------------------------------------------------------------
const SUFFIX_MAP: Record<string, CostType> = {
  '.L': 'Labor',
  '.M': 'Material',
  '.S': 'Subcontract',
  '.Labor': 'Labor',
  '.Material': 'Material',
  '.Subcontract': 'Subcontract',
  '.Equipment': 'Equipment',
  '.Other': 'Other',
};

function parseCostCodeSuffix(rawCode: string): { normalizedCode: string; costType: CostType | null } {
  let normalizedCode = rawCode.trim();
  let costType: CostType | null = null;

  // 1. Extract and strip the Cost Type suffix (longest match first to avoid partial hits)
  const sortedSuffixes = Object.keys(SUFFIX_MAP).sort((a, b) => b.length - a.length);
  for (const suffix of sortedSuffixes) {
    if (normalizedCode.endsWith(suffix)) {
      costType = SUFFIX_MAP[suffix];
      normalizedCode = normalizedCode.slice(0, -suffix.length);
      break;
    }
  }

  // 2. Strip Procore's injected .000 quantity suffix if present
  if (normalizedCode.endsWith('.000')) {
    normalizedCode = normalizedCode.slice(0, -4);
  }

  return { normalizedCode, costType };
}

// ------------------------------------------------------------------
// Strict type-safe cell value extractor (no `any`)
// ------------------------------------------------------------------
function safeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    // ExcelJS rich text / formula result objects expose `.text`
    if (typeof obj.text === 'string') return obj.text.trim();
    if (typeof obj.result !== 'undefined') return safeString(obj.result);
  }
  return String(val).trim();
}

// ------------------------------------------------------------------
// Main Parser
// ------------------------------------------------------------------
export async function parseCoordinationExcel(
  arrayBuffer: ArrayBuffer,
  disciplinesConfig: DisciplineConfig[]
): Promise<DraftCoordinationTask[]> {
  // Dynamic import: browser-safe build prevents Node.js stream polyfill errors (AGENTS.md Rule C19)
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheet = workbook.getWorksheet('Coordination Import');
  if (!sheet) {
    throw new Error('Could not find the "Coordination Import" worksheet. Please use the provided template.');
  }

  const tasks: DraftCoordinationTask[] = [];

  // Discipline label → id lookup (case-insensitive)
  const disciplineMap = new Map<string, string>();
  disciplinesConfig.forEach(d => {
    disciplineMap.set(d.label.toLowerCase().trim(), d.id);
  });

  // Column index → discipline id (for [Disc] columns)
  const columnToDisciplineId = new Map<number, string>();

  // Detect optional Cost Type column (backward-compatible: old templates won't have it)
  let costTypeColumnIndex: number | null = null;

  const headerRow = sheet.getRow(1);
  if (headerRow) {
    headerRow.eachCell((cell: Cell, colNumber: number) => {
      const headerText = safeString(cell.value).trim();

      if (headerText === 'Cost Type') {
        costTypeColumnIndex = colNumber;
        return;
      }

      if (headerText.startsWith('[Disc] ')) {
        const disciplineLabel = headerText.replace('[Disc] ', '').trim().toLowerCase();
        const disciplineId = disciplineMap.get(disciplineLabel);
        if (disciplineId) {
          columnToDisciplineId.set(colNumber, disciplineId);
        }
      }
    });
  }

  sheet.eachRow((row: Row, rowNumber: number) => {
    if (rowNumber === 1) return;

    const title        = safeString(row.getCell(1).value);
    const description  = safeString(row.getCell(2).value);
    const priority     = safeString(row.getCell(3).value) || 'Set Priority';
    const building_area = safeString(row.getCell(4).value);
    const rawCostCode  = safeString(row.getCell(5).value);

    // Skip entirely blank rows
    if (!title && !description && !rawCostCode && !building_area) return;

    // -- Rosetta Stone: parse suffix from the cost code field --
    const { normalizedCode, costType: suffixCostType } = parseCostCodeSuffix(rawCostCode);

    // Explicit Cost Type column (new template) takes precedence over suffix notation
    let explicitCostType: CostType | null = null;
    if (costTypeColumnIndex !== null) {
      const raw = safeString(row.getCell(costTypeColumnIndex).value);
      if (raw && (raw as CostType) in ({ Labor: 1, Material: 1, Subcontract: 1, Equipment: 1, Other: 1 })) {
        explicitCostType = raw as CostType;
      }
    }

    const cost_type = explicitCostType ?? suffixCostType;

    const errors: string[] = [];
    if (!title) errors.push('Title is required.');

    const coordination_details: Record<string, DisciplineDetails> = {};
    columnToDisciplineId.forEach((disciplineId, colNumber) => {
      const cellValue = safeString(row.getCell(colNumber).value).toLowerCase();
      if (cellValue === 'yes' || cellValue === 'true' || cellValue === 'y') {
        coordination_details[disciplineId] = { status: 'Pending', notes: '' };
      }
    });

    // Mint client-side UUID — never use temp- IDs (AGENTS.md Rule C8)
    const id = crypto.randomUUID();

    tasks.push({
      id,
      title,
      description,
      priority,
      building_area,
      cost_code: normalizedCode,
      cost_type,
      coordination_details,
      errors,
    });
  });

  return tasks;
}
