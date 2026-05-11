const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ── Response types ────────────────────────────────────────────────────────────
export interface ProcessSheetAccepted {
  status: 'accepted';
  sheet_id: string;
}

// InspectPdfResponse mirrors the Pydantic model in routers/drawings.py
// Re-exported from map.types.ts for single-source-of-truth (AGENTS.md C1)
export type { InspectPdfResponse, StagedPageMeta } from '@/types/map.types';

// ── inspectAndStagePdfService ─────────────────────────────────────────────────
// Step 1 of UOPM. Uploads the full PDF once, returns page thumbnails + staged_key.
// All subsequent /process-sheet calls reference staged_key — no re-upload needed.
export async function inspectAndStagePdfService(
  projectId: string,
  file: File,
  token: string
): Promise<import('@/types/map.types').InspectPdfResponse> {
  const formData = new FormData();
  formData.append('project_id', projectId);
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/drawings/inspect-and-stage-pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      (errData as { detail?: string }).detail ?? 'Failed to inspect PDF'
    );
  }

  return response.json() as Promise<import('@/types/map.types').InspectPdfResponse>;
}

// ── processSheetService ───────────────────────────────────────────────────────
// Step 2 of UOPM. Dual-mode dispatch (AGENTS.md B.2):
//
//   Staged mode (bulk import, Q1 re-upload shortcut):
//     Pass stagedKeyOrFile as a string (staged_key UUID).
//     No file body sent — worker downloads from Storage.
//
//   Direct mode (single re-upload):
//     Pass stagedKeyOrFile as a File object.
//     Endpoint stages it immediately, then dispatches.
//
// The sheet DB row must already exist before calling this.
export async function processSheetService(
  sheetId: string,
  stagedKeyOrFile: string | File,
  pageIndex: number,
  token: string
): Promise<ProcessSheetAccepted> {
  const formData = new FormData();
  formData.append('page_index', String(pageIndex));

  if (typeof stagedKeyOrFile === 'string') {
    formData.append('staged_key', stagedKeyOrFile);
  } else {
    formData.append('file', stagedKeyOrFile);
  }

  const response = await fetch(`${API_BASE_URL}/drawings/process-sheet/${sheetId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      (errData as { detail?: string }).detail ?? 'Failed to dispatch sheet processing'
    );
  }

  return response.json() as Promise<ProcessSheetAccepted>;
}

// ── Legacy services (unchanged) ───────────────────────────────────────────────
export async function exportToPDFService(activeSheetId: string, payload: unknown, token: string) {
  const response = await fetch(`${API_BASE_URL}/export-pdf/${activeSheetId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as { detail?: string }).detail || 'Export failed on server');
  }

  const blob = await response.blob();
  let filename = 'Export.pdf';
  const disposition = response.headers.get('content-disposition');
  if (disposition && disposition.indexOf('filename=') !== -1) {
    const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, '');
    }
  }
  return { blob, filename };
}

export async function uploadFloorplanService(sheetId: string, file: File, pdfPageNumber: number, token: string) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${API_BASE_URL}/upload-floorplan/${sheetId}?page_number=${pdfPageNumber}`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as { detail?: string }).detail || 'Failed to convert PDF');
  }

  return response.json();
}

export async function attachOriginalService(activeSheetId: string, file: File, token: string) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/drawings/attach-original/${activeSheetId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as { detail?: string }).detail || 'Failed to attach');
  }

  return response.json();
}

export async function extractVectorsService(sheetId: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/extract-vectors/${sheetId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as { detail?: string }).detail || 'Failed to extract vectors');
  }

  return response.json();
}
