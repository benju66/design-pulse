"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Lock, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ClientLesson } from '@/types/models';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { statusBadgeClass, severityBadgeClass } from '../lessons/lessonBadges';
import { LessonAttachments } from '../lessons/LessonAttachments';

// Accepts the client-scoped lesson plus the dashboard variant (which carries client name).
type PanelLesson = ClientLesson & { client_id?: string | null; client_name?: string | null };

interface ClientLessonDetailPanelProps {
  lesson: PanelLesson | null;
  onClose: () => void;
}

const noop = () => {};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="text-sm text-slate-800 dark:text-slate-200">{value}</div>
    </div>
  );
}

function RichSection({ id, label, content }: { id: string; label: string; content: string | null }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{label}</label>
      {content && content.trim() ? (
        <div className="border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900 overflow-hidden">
          {/* Read-only: RichTextEditor re-parses stored HTML through its schema (no dangerouslySetInnerHTML). */}
          <RichTextEditor key={id} content={content} onSave={noop} disabled />
        </div>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-600 italic">Not provided</p>
      )}
    </div>
  );
}

export function ClientLessonDetailPanel({ lesson, onClose }: ClientLessonDetailPanelProps) {
  const isOpen = !!lesson;

  // Preserve the last lesson so content doesn't blank out during the slide-out animation.
  const [shown, setShown] = useState<PanelLesson | null>(lesson);
  const [prev, setPrev] = useState<PanelLesson | null>(lesson);
  if (lesson !== prev) {
    setPrev(lesson);
    if (lesson) setShown(lesson);
  }

  const { data: costCodes = [] } = useCostCodes();

  // Escape to close (matches the house drawer pattern). Defer to an open attachment
  // viewer so Escape closes that first rather than collapsing the whole panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.documentElement.dataset.lessonAttachmentViewerOpen) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const resolvedCostCode = shown?.cost_code
    ? costCodes.find(c => c.code === shown.cost_code)
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/15 dark:bg-slate-950/40 backdrop-blur-[3px] z-40 transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="Lesson details"
        className={`fixed top-0 right-0 h-screen w-full sm:w-[500px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {shown && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-slate-500 dark:text-slate-400">{shown.display_id || '—'}</span>
                {shown.status === 'Verified' && (
                  <span className="gap-1 flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <Lock size={12} /> Verified
                  </span>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md" title="Close (Esc)">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Client (dashboard variant only — client view omits this) */}
              {shown.client_name && (
                <Field
                  label="Client"
                  value={
                    shown.client_id ? (
                      <Link
                        href={`/clients/${shown.client_id}`}
                        className="group inline-flex items-center gap-1 font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
                      >
                        <span>{shown.client_name}</span>
                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ) : (
                      shown.client_name
                    )
                  }
                />
              )}

              {/* Project context (cross-project rollup) */}
              <Field
                label="Project"
                value={
                  <Link
                    href={`/project/${shown.project_id}`}
                    className="group inline-flex items-center gap-1 font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
                  >
                    <span>{shown.project_name}</span>
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                }
              />

              {/* Title */}
              <Field
                label="Title"
                value={<span className="font-semibold text-base text-slate-900 dark:text-slate-100">{shown.title}</span>}
              />

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Status"
                  value={<span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(shown.status)}`}>{shown.status}</span>}
                />
                <Field
                  label="Severity"
                  value={<span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${severityBadgeClass(shown.severity)}`}>{shown.severity}</span>}
                />
                <Field label="Category" value={shown.category} />
                <Field label="Phase" value={shown.phase} />
              </div>

              {/* Cost code */}
              <Field
                label="Cost Code"
                value={
                  shown.cost_code ? (
                    <div className="flex flex-col">
                      <span className="font-mono text-slate-700 dark:text-slate-300">{shown.cost_code}</span>
                      {resolvedCostCode && (
                        <span className="text-xs text-slate-500">{resolvedCostCode.description}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600">—</span>
                  )
                }
              />

              <hr className="border-slate-200 dark:border-slate-800" />

              {/* Rich text content */}
              <RichSection id={`${shown.id}-wh`} label="What Happened" content={shown.what_happened} />
              <RichSection id={`${shown.id}-rc`} label="Root Cause" content={shown.root_cause} />
              <RichSection id={`${shown.id}-rec`} label="Recommendation" content={shown.recommendation} />

              <hr className="border-slate-200 dark:border-slate-800" />

              {/* Attachments (read-only — view/download only; editing happens in the project) */}
              <LessonAttachments lessonId={shown.id} projectId={shown.project_id} disabled />

              <hr className="border-slate-200 dark:border-slate-800" />

              <Field
                label="Recorded"
                value={<span className="text-slate-500">{format(new Date(shown.created_at), 'MMMM d, yyyy')}</span>}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
