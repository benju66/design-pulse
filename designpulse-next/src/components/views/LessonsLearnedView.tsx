"use client";

import { useState } from 'react';
import { useLessons, useCreateLesson } from '@/hooks/useLessonQueries';
import { useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { LessonTemplate } from '@/types/models';
import { LessonTemplateSelector } from '@/components/lessons/LessonTemplateSelector';
import { LessonDetailPanel } from '@/components/lessons/LessonDetailPanel';
import { lessonColumns } from '@/components/lessons/LessonColumns';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';

interface LessonsLearnedViewProps {
  projectId: string;
}

export function LessonsLearnedView({ projectId }: LessonsLearnedViewProps) {
  const { data: lessons = [], isLoading } = useLessons(projectId);
  const { data: costCodes = [] } = useCostCodes();
  const { permissions } = useCurrentUserPermissions(projectId);
  const createLesson = useCreateLesson(projectId);
  const viewMode = useUIStore(state => state.lessonsViewMode);

  const [isCreating, setIsCreating] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const table = useReactTable({
    data: lessons,
    columns: lessonColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      rawCostCodes: costCodes
    }
  });

  const handleCreate = (template: LessonTemplate) => {
    createLesson.mutate({
      title: 'New Lesson',
      category: template.defaultCategory,
      template_id: template.id !== 'blank' ? template.id : null,
      what_happened: template.whatHappenedPlaceholder,
      root_cause: template.rootCausePlaceholder,
      recommendation: template.recommendationPlaceholder,
      phase: 'Pre-Construction',
      severity: 'Medium',
      status: 'Draft',
    }, {
      onSuccess: (newLesson) => {
        setIsCreating(false);
        setSelectedLessonId(newLesson.id);
      }
    });
  };

  const selectedLesson = lessons.find(l => l.id === selectedLessonId);

  if (isCreating) {
    return <LessonTemplateSelector onSelect={handleCreate} onCancel={() => setIsCreating(false)} />;
  }

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900/30">
      <div className={`flex flex-col flex-1 min-w-0 ${selectedLessonId && viewMode === 'split' ? 'border-r border-slate-200 dark:border-slate-800' : ''}`}>
        {/* Header/Toolbar */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Lessons Learned</h2>
          
          <button
            onClick={() => setIsCreating(true)}
            disabled={!permissions.can_edit_records}
            className="flex items-center gap-2 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
          >
            <Plus size={16} /> New Lesson
          </button>
        </div>

        {/* Data Grid */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-500">Loading lessons...</div>
          ) : lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <p>No lessons learned yet.</p>
              {permissions.can_edit_records && (
                <button onClick={() => setIsCreating(true)} className="mt-4 text-sky-600 hover:text-sky-700 font-medium text-sm">
                  Create your first lesson
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="p-3 select-none" style={{ width: header.column.getSize() }}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-700/50">
                  {table.getRowModel().rows.map(row => {
                    const isSelected = row.original.id === selectedLessonId;
                    return (
                      <tr 
                        key={row.id} 
                        onClick={() => setSelectedLessonId(isSelected ? null : row.original.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30' 
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="p-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedLesson && (
        <LessonDetailPanel
          lesson={selectedLesson}
          projectId={projectId}
          canEdit={permissions.can_edit_records}
          onClose={() => setSelectedLessonId(null)}
        />
      )}
    </div>
  );
}
