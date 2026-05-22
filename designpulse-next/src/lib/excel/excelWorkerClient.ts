import { ExcelWorkerMessage, ExcelWorkerResponse } from '../../workers/excelParser.worker';
import { parseCoordinationExcel } from './coordinationParser';
import { parseCostCodeExcel } from './costCodeParser';
import { parseProcoreBudgetExcel } from './procoreBudgetParser';
import { parseCsiSpecExcel } from './csiSpecParser';
import { parseCompanyDefaultsExcel } from './companyDefaultsParser';

// --- FALLBACK EMERGENCY SWITCH ---
// Set to true to bypass Web Workers entirely and execute parser modules
// directly on Next.js's main thread (e.g. for testing/troubleshooting).
const FORCE_MAIN_THREAD = false;

export function runExcelWorker<T>(message: ExcelWorkerMessage): Promise<T> {
  if (FORCE_MAIN_THREAD) {
    return handleMainThreadFallback<T>(message);
  }

  return new Promise<T>((resolve, reject) => {
    // Instantiate module worker natively compiled by Next.js/Webpack
    const worker = new Worker(
      new URL('../../workers/excelParser.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<ExcelWorkerResponse>) => {
      const response = e.data;
      if (response.type === 'SUCCESS') {
        resolve(response.payload);
      } else {
        reject(new Error(response.error || 'Excel parsing failed with an unknown error.'));
      }
      worker.terminate(); // Free worker memory immediately
    };

    worker.onerror = (err) => {
      reject(err);
      worker.terminate(); // Guarantee cleanup on thread crashes
    };

    // Pass transferable arrayBuffer to transfer ownership instantly (zero-copy)
    worker.postMessage(message, [message.payload.arrayBuffer]);
  });
}

async function handleMainThreadFallback<T>(message: ExcelWorkerMessage): Promise<T> {
  const { type, payload } = message;
  
  if (type === 'PARSE_COORDINATION') {
    return (await parseCoordinationExcel(payload.arrayBuffer, payload.disciplines)) as unknown as T;
  }
  if (type === 'PARSE_COST_CODES') {
    return (await parseCostCodeExcel(payload.arrayBuffer)) as unknown as T;
  }
  if (type === 'PARSE_PROCORE_BUDGET') {
    const knownCodesSet = new Set(payload.knownCodes);
    return (await parseProcoreBudgetExcel(payload.arrayBuffer, payload.projectId, knownCodesSet)) as unknown as T;
  }
  if (type === 'PARSE_CSI_SPEC') {
    return (await parseCsiSpecExcel(payload.arrayBuffer)) as unknown as T;
  }
  if (type === 'PARSE_COMPANY_DEFAULTS') {
    return (await parseCompanyDefaultsExcel(payload.arrayBuffer)) as unknown as T;
  }
  
  throw new Error(`Unsupported fallback action type: ${type}`);
}
