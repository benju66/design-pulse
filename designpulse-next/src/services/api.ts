const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// 202 Accepted response — the endpoint returns immediately after staging the PDF.
// Heavy processing (tiling, vector extraction) runs in the background worker.
// The frontend receives live progress updates via Supabase Realtime (useSheetRealtime).
export interface ProcessSheetAccepted {
  status: 'accepted';
  sheet_id: string;
}

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
      const matches = /filename[^;=\n]*=((['"]).+?\2|[^;\n]*)/.exec(disposition);
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
      headers: {
        'Authorization': `Bearer ${token}`
      },
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
  
  const response = await fetch(`${API_BASE_URL}/attach-original/${activeSheetId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
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
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as { detail?: string }).detail || 'Failed to extract vectors');
  }

  return response.json();
}

// ── processSheetService ───────────────────────────────────────────────────────
// Sends a PDF to the FastAPI /process-sheet/{sheet_id} endpoint, which:
//   1. Slices the PDF into a Deep Zoom WebP tile pyramid → Supabase Storage
//   2. Extracts snapping vectors → Supabase Storage
//   3. Updates project_sheets row: status='ready', max_zoom, original_width/height
//
// AGENTS.md B.2: FastAPI microservice call — stays in services/api.ts only.
// The sheet DB row must already exist before calling this (create it first via
// useCreateProjectSheet, then call processSheetService in onSuccess).
export async function processSheetService(
  sheetId: string,
  file: File,
  token: string
): Promise<ProcessSheetAccepted> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/process-sheet/${sheetId}`, {
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
