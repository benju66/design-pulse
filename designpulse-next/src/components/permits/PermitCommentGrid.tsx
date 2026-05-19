import React from 'react';
import { PermitComment } from '@/types/models';
import { useUpdatePermitComment, useDeletePermitComment } from '@/hooks/usePermitQueries';
import { PermitCommentGhostRow } from './PermitCommentGhostRow';
import { Trash2 } from 'lucide-react';

interface PermitCommentGridProps {
  projectId: string;
  permitId: string;
  comments: PermitComment[];
}

export function PermitCommentGrid({ projectId, permitId, comments }: PermitCommentGridProps) {
  const updateMutation = useUpdatePermitComment(projectId);
  const deleteMutation = useDeletePermitComment(projectId);

  const handleUpdate = (id: string, field: keyof PermitComment, value: string) => {
    updateMutation.mutate({ id, updates: { [field]: value } });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden bg-white dark:bg-slate-900 shadow-sm text-sm">
      {/* Header Row */}
      <div className="grid grid-cols-[80px_60px_1fr_1fr_90px_32px] gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300 text-xs">
        <div>Discipline</div>
        <div>No.</div>
        <div>Comment</div>
        <div>Response</div>
        <div>Status</div>
        <div></div>
      </div>

      {/* Rows */}
      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50 max-h-[300px] overflow-y-auto">
        {comments.map((comment) => (
          <div key={comment.id} className="grid grid-cols-[80px_60px_1fr_1fr_90px_32px] gap-2 p-2 items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
            <input
              type="text"
              value={comment.discipline || ''}
              onChange={(e) => handleUpdate(comment.id, 'discipline', e.target.value)}
              placeholder="e.g. Fire"
              className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-sky-500 rounded px-1"
            />
            <input
              type="text"
              value={comment.comment_number || ''}
              onChange={(e) => handleUpdate(comment.id, 'comment_number', e.target.value)}
              placeholder="#1"
              className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-sky-500 rounded px-1"
            />
            <textarea
              value={comment.comment_text || ''}
              onChange={(e) => handleUpdate(comment.id, 'comment_text', e.target.value)}
              placeholder="Comment text..."
              className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-sky-500 rounded px-1 resize-none h-8 text-xs"
            />
            <textarea
              value={comment.response_text || ''}
              onChange={(e) => handleUpdate(comment.id, 'response_text', e.target.value)}
              placeholder="Response..."
              className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-sky-500 rounded px-1 resize-none h-8 text-xs"
            />
            <select
              value={comment.status || 'Open'}
              onChange={(e) => handleUpdate(comment.id, 'status', e.target.value)}
              className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-sky-500 rounded px-1 text-xs cursor-pointer"
            >
              <option value="Open">Open</option>
              <option value="Addressed">Addressed</option>
              <option value="Approved">Approved</option>
            </select>
            <button
              onClick={() => handleDelete(comment.id)}
              className="p-1 text-slate-400 hover:text-red-600 rounded opacity-0 hover:bg-slate-100 dark:hover:bg-slate-800 focus:opacity-100 group-hover:opacity-100 transition-all flex items-center justify-center"
              title="Delete Comment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="p-4 text-center text-slate-500 text-sm italic">
            No comments logged yet.
          </div>
        )}
      </div>

      <PermitCommentGhostRow projectId={projectId} permitId={permitId} />
    </div>
  );
}
