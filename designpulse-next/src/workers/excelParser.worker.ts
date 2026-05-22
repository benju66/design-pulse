import { parseCoordinationExcel } from '../lib/excel/coordinationParser';
import { parseCostCodeExcel } from '../lib/excel/costCodeParser';
import { parseProcoreBudgetExcel } from '../lib/excel/procoreBudgetParser';
import { parseCsiSpecExcel } from '../lib/excel/csiSpecParser';
import { parseCompanyDefaultsExcel } from '../lib/excel/companyDefaultsParser';
import { DisciplineConfig } from '@/types/models';

export type ExcelWorkerMessage =
  | { type: 'PARSE_COORDINATION'; payload: { arrayBuffer: ArrayBuffer; disciplines: DisciplineConfig[] } }
  | { type: 'PARSE_COST_CODES'; payload: { arrayBuffer: ArrayBuffer } }
  | { type: 'PARSE_PROCORE_BUDGET'; payload: { arrayBuffer: ArrayBuffer; projectId: string; knownCodes: string[] } }
  | { type: 'PARSE_CSI_SPEC'; payload: { arrayBuffer: ArrayBuffer } }
  | { type: 'PARSE_COMPANY_DEFAULTS'; payload: { arrayBuffer: ArrayBuffer } };

export type ExcelWorkerResponse =
  | { type: 'SUCCESS'; payload: any }
  | { type: 'ERROR'; error: string };

self.onmessage = async (e: MessageEvent<ExcelWorkerMessage>) => {
  const { type, payload } = e.data;

  try {
    let result: any;

    if (type === 'PARSE_COORDINATION') {
      result = await parseCoordinationExcel(payload.arrayBuffer, payload.disciplines);
    } else if (type === 'PARSE_COST_CODES') {
      result = await parseCostCodeExcel(payload.arrayBuffer);
    } else if (type === 'PARSE_PROCORE_BUDGET') {
      // Reconstruct the Set from the flat array to avoid structured clone constraints
      const knownCodesSet = new Set(payload.knownCodes);
      result = await parseProcoreBudgetExcel(payload.arrayBuffer, payload.projectId, knownCodesSet);
    } else if (type === 'PARSE_CSI_SPEC') {
      result = await parseCsiSpecExcel(payload.arrayBuffer);
    } else if (type === 'PARSE_COMPANY_DEFAULTS') {
      result = await parseCompanyDefaultsExcel(payload.arrayBuffer);
    } else {
      throw new Error(`Unknown parser action type: ${type}`);
    }

    self.postMessage({ type: 'SUCCESS', payload: result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'ERROR', error: errorMsg });
  }
};
