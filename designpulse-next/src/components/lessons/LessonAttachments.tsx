"use client";
import { useRef, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { Paperclip, Upload, Download, Trash2, FileText, FileSpreadsheet, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { LessonAttachment } from '@/types/models';
import { useLessonAttachments, useUploadLessonAttachment, useDeleteLessonAttachment } from '@/hooks/useLessonQueries';
import { AttachmentViewerModal, attachmentKind } from './AttachmentViewerModal';

interface LessonAttachmentsProps {
  lessonId: string;
  projectId: string;
  /** When true (e.g. no edit permission or Verified/locked), upload + delete are hidden. Downloads stay enabled. */
  disabled?: boolean;
}

function FileTypeIcon({ fileType, className }: { fileType: string | null; className?: string }) {
  if (!fileType) return <FileIcon size={16} className={className} />;
  if (fileType.startsWith('image/')) return <ImageIcon size={16} className={className} />;
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return <FileSpreadsheet size={16} className={className} />;
  if (fileType.includes('pdf')) return <FileText size={16} className={className} />;
  return <FileIcon size={16} className={className} />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LessonAttachments({ lessonId, projectId, disabled }: LessonAttachmentsProps) {
  const { data: attachments = [], isLoading } = useLessonAttachments(lessonId);
  const uploadMutation = useUploadLessonAttachment(projectId);
  const deleteMutation = useDeleteLessonAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<LessonAttachment | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => uploadMutation.mutate({ lessonId, file }));
  };

  // Bucket is private — generate a short-lived signed URL to download (no public URL).
  const handleDownload = async (att: LessonAttachment) => {
    const { data, error } = await supabase.storage
      .from('lesson_attachments')
      .createSignedUrl(att.file_path, 60);
    if (error || !data?.signedUrl) {
      toast.error('Could not open attachment');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  // Images + PDFs open in the in-app viewer; everything else falls back to download.
  const openAttachment = (att: LessonAttachment) => {
    if (attachmentKind(att) === 'other') {
      handleDownload(att);
      return;
    }
    setViewing(att);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Attachments{attachments.length > 0 ? ` (${attachments.length})` : ''}
        </label>
        {!disabled && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              isLoading={uploadMutation.isPending}
              loadingText="Uploading…"
            >
              <Upload size={14} /> Add File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading attachments…</p>
      ) : attachments.length === 0 ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-700 rounded-md px-3 py-4">
          <Paperclip size={14} /> No attachments
        </div>
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="group flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md">
              <div className="w-8 h-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <FileTypeIcon fileType={att.file_type} className="text-slate-500" />
              </div>
              <button onClick={() => openAttachment(att)} className="flex-1 min-w-0 text-left" title={`Open ${att.file_name}`}>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                  {att.file_name}
                </p>
                <span className="text-[10px] text-slate-400 font-mono">{formatFileSize(att.file_size)}</span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleDownload(att)}
                  className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded transition-colors"
                  title="Download"
                >
                  <Download size={14} />
                </button>
                {!disabled && (
                  <button
                    onClick={() => deleteMutation.mutate({ attachmentId: att.id, filePath: att.file_path, lessonId })}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AttachmentViewerModal attachment={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
