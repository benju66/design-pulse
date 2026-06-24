"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { ModalShell } from '@/components/ui/ModalShell';
import { X, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { LessonAttachment } from '@/types/models';

export type AttachmentKind = 'image' | 'pdf' | 'other';

// Classify by MIME first, then fall back to the file-name extension (file_type can be null/generic).
export function attachmentKind(att: { file_type: string | null; file_name: string }): AttachmentKind {
  const ft = (att.file_type || '').toLowerCase();
  const name = att.file_name.toLowerCase();
  if (ft.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(name)) return 'image';
  if (ft.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  return 'other';
}

interface AttachmentViewerModalProps {
  attachment: LessonAttachment | null;
  onClose: () => void;
}

/**
 * In-app viewer for image + PDF lesson attachments. Renders a short-lived signed URL
 * from the private `lesson_attachments` bucket directly (no third-party service):
 * images via <img>, PDFs via the browser's native <iframe> renderer.
 */
export function AttachmentViewerModal({ attachment, onClose }: AttachmentViewerModalProps) {
  // State is only written from the async callback — never synchronously in the effect body.
  // Loading/reset is derived by comparing the resolved key against the current attachment.
  const [signed, setSigned] = useState<{ key: string; url: string } | null>(null);
  const [erroredKey, setErroredKey] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment) return;
    let cancelled = false;
    // Flag so an enclosing drawer (ClientLessonDetailPanel) lets Escape close THIS first.
    document.documentElement.dataset.lessonAttachmentViewerOpen = 'true';
    // 1h expiry so a PDF stays viewable while the modal is open.
    supabase.storage
      .from('lesson_attachments')
      .createSignedUrl(attachment.file_path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) setErroredKey(attachment.file_path);
        else setSigned({ key: attachment.file_path, url: data.signedUrl });
      });
    return () => {
      cancelled = true;
      delete document.documentElement.dataset.lessonAttachmentViewerOpen;
    };
  }, [attachment]);

  if (!attachment) return null;
  const key = attachment.file_path;
  const url = signed?.key === key ? signed.url : null;
  const status: 'loading' | 'ready' | 'error' = url ? 'ready' : (erroredKey === key ? 'error' : 'loading');
  const kind = attachmentKind(attachment);

  return (
    <ModalShell isOpen={!!attachment} onClose={onClose} size="full" nested className="h-[88vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate pr-4" title={attachment.file_name}>
          {attachment.file_name}
        </h3>
        <div className="flex items-center gap-1">
          {url && (
            <button
              onClick={() => window.open(url, '_blank')}
              title="Open in new tab"
              className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-md transition-colors"
            >
              <ExternalLink size={18} />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-auto">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-2 text-slate-500 p-8 text-center">
            <AlertTriangle size={28} className="text-amber-500" />
            <p className="text-sm font-medium">Couldn&apos;t load this file.</p>
          </div>
        )}
        {status === 'ready' && url && kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL, unknown dimensions; next/image adds no value here
          <img src={url} alt={attachment.file_name} className="max-w-full max-h-full object-contain" />
        )}
        {status === 'ready' && url && kind === 'pdf' && (
          <iframe src={url} title={attachment.file_name} className="w-full h-full border-0" />
        )}
      </div>
    </ModalShell>
  );
}
