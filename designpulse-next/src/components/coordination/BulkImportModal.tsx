'use client';

import React, { useState, useRef, useMemo } from 'react';
import { create } from 'zustand';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  createColumnHelper,
} from '@tanstack/react-table';
import { X, UploadCloud, AlertCircle, Check, Download, Trash2 } from 'lucide-react';
import { DraftCoordinationTask, parseCoordinationExcel } from '@/lib/excel/coordinationParser';
import { generateCoordinationTemplate } from '@/lib/excel/coordinationTemplate';
import { useBulkImportCoordinationTasks } from '@/hooks/useProjectQueries';
import { ProjectSettings } from '@/types/models';
import { toast } from 'sonner';

interface BulkImportStore {
  tasks: DraftCoordinationTask[];
  setTasks: (tasks: DraftCoordinationTask[]) => void;
  removeTask: (id: string) => void;
  updateTaskTitle: (id: string, title: string) => void;
  clearTasks: () => void;
}

const useBulkImportStore = create<BulkImportStore>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  removeTask: (id) => set((state) => ({ tasks: state.tasks.filter(t => t.id !== id) })),
  updateTaskTitle: (id, title) => set((state) => ({
    tasks: state.tasks.map(t => {
      if (t.id === id) {
        // Simple error recalculation for Title
        const errors = t.errors.filter(e => e !== 'Title is required.');
        if (!title.trim()) errors.push('Title is required.');
        return { ...t, title: title.trim(), errors };
      }
      return t;
    })
  })),
  clearTasks: () => set({ tasks: [] }),
}));

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectSettings: ProjectSettings | null;
}

// Editable Cell Component for Title
const EditableTitleCell = ({ getValue, row }: any) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const { updateTaskTitle } = useBulkImportStore();

  const onBlur = () => {
    updateTaskTitle(row.original.id, value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // AGENTS.md Guardrail: Escape-Key State Preservation
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      const currentVal = e.currentTarget.value;
      updateTaskTitle(row.original.id, currentVal);
      // Let the modal know escape was pressed, but handled here
      e.stopPropagation();
    }
  };

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={`w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 text-sm ${
        row.original.errors.includes('Title is required.') ? 'text-rose-600 font-semibold' : ''
      }`}
      placeholder="Required..."
    />
  );
};

// Memoized Row Component (AGENTS.md Guardrail)
const MemoizedRow = React.memo(
  ({ row }: { row: any; visibleColumnIds: string }) => {
    const hasErrors = row.original.errors.length > 0;
    
    return (
      <tr className={`border-b border-gray-100 dark:border-gray-800 transition-colors ${
        hasErrors ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}>
        {row.getVisibleCells().map((cell: any) => (
          <td key={cell.id} className="p-2 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    );
  },
  (prev, next) => {
    return (
      prev.row.original === next.row.original &&
      prev.visibleColumnIds === next.visibleColumnIds
    );
  }
);
MemoizedRow.displayName = 'MemoizedRow';

export function BulkImportModal({ isOpen, onClose, projectId, projectSettings }: BulkImportModalProps) {
  const { tasks, setTasks, removeTask, clearTasks } = useBulkImportStore();
  const [isParsing, setIsParsing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const { mutate: importTasks, isPending: isImporting } = useBulkImportCoordinationTasks(projectId);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const columnHelper = createColumnHelper<DraftCoordinationTask>();

  const columns = useMemo<ColumnDef<DraftCoordinationTask, any>[]>(() => [
    columnHelper.accessor('title', {
      header: 'Title',
      cell: EditableTitleCell,
      size: 200,
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: info => <span className="text-xs">{info.getValue()}</span>,
      size: 100,
    }),
    columnHelper.accessor('building_area', {
      header: 'Building Area',
      cell: info => <span className="text-xs">{info.getValue()}</span>,
      size: 150,
    }),
    columnHelper.accessor('cost_code', {
      header: 'Cost Code',
      cell: info => <span className="text-xs">{info.getValue()}</span>,
      size: 150,
    }),
    columnHelper.accessor('errors', {
      header: 'Status',
      size: 100,
      cell: info => {
        const errors = info.getValue() as string[];
        if (errors.length === 0) {
          return (
            <div className="flex items-center text-emerald-600 dark:text-emerald-400">
              <Check className="w-4 h-4 mr-1" />
              <span className="text-xs font-medium">Valid</span>
            </div>
          );
        }
        
        // AGENTS.md Guardrail: Zero-JS Enterprise Tooltips
        return (
          <div className="relative group inline-flex items-center text-rose-600 dark:text-rose-400 cursor-help">
            <AlertCircle className="w-4 h-4 mr-1" />
            <span className="text-xs font-medium">{errors.length} Error{errors.length > 1 ? 's' : ''}</span>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-max max-w-xs p-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded shadow-lg z-[100] pointer-events-none">
              <ul className="list-disc pl-4 space-y-1">
                {errors.map((e, idx) => <li key={idx}>{e}</li>)}
              </ul>
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900 dark:border-t-gray-100" />
            </div>
          </div>
        );
      }
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      size: 50,
      cell: info => (
        <button
          onClick={() => removeTask(info.row.original.id)}
          className="p-1 text-gray-400 hover:text-rose-500 rounded transition-colors"
          title="Discard Row"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )
    })
  ], [removeTask]);

  const table = useReactTable({
    data: tasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const visibleColumnIds = useMemo(() => {
    return table.getVisibleLeafColumns().map(c => c.id).join(',');
  }, [table]);

  const handleDownloadTemplate = async () => {
    if (!projectSettings) return;
    try {
      setIsDownloading(true);
      const blob = await generateCoordinationTemplate(
        (projectSettings.building_areas as string[]) || [],
        [], // Empty initially if global cost codes aren't passed, but typically we pass them. For now, empty array defaults to N/A.
        projectSettings.disciplines || []
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Coordination_Bulk_Import_Template.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(`Failed to generate template: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsParsing(true);
      const buffer = await file.arrayBuffer();
      const parsedTasks = await parseCoordinationExcel(buffer, projectSettings?.disciplines || []);
      setTasks(parsedTasks);
    } catch (err: any) {
      toast.error(`Failed to parse Excel file: ${err.message}`);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFinalize = () => {
    importTasks(tasks, {
      onSuccess: () => {
        clearTasks();
        onClose();
      }
    });
  };

  const hasErrors = tasks.some(t => t.errors.length > 0);
  const isValidToImport = tasks.length > 0 && !hasErrors;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Smart Excel Bulk Import</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          
          {/* Top Actions */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Step 1: Download Template</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Get the dynamically generated .xlsx file with your project's settings and data validations.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              disabled={isDownloading || !projectSettings}
              className="flex items-center px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloading ? 'Generating...' : 'Download Template'}
            </button>
          </div>

          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Step 2: Upload Populated Sheet</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Upload your completed template to validate and stage the tasks.
              </p>
            </div>
            <div>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                className="flex items-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4 mr-2" />
                {isParsing ? 'Parsing...' : 'Select File'}
              </button>
            </div>
          </div>

          {/* Staging Grid */}
          {tasks.length > 0 && (
            <div className="mt-4 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden flex flex-col flex-1 min-h-[300px]">
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800/80 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800">
                    {table.getHeaderGroups().map(headerGroup => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                          <th key={header.id} className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: header.getSize() }}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map(row => (
                      <MemoizedRow key={row.id} row={row} visibleColumnIds={visibleColumnIds} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
          <div className="flex items-center text-sm">
            {tasks.length > 0 && (
              <span className="text-gray-600 dark:text-gray-400">
                Staging <span className="font-semibold text-gray-900 dark:text-white">{tasks.length}</span> tasks
                {hasErrors && (
                  <span className="text-rose-600 dark:text-rose-400 ml-2">
                    (Fix or discard rows with errors before importing)
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleFinalize}
              disabled={!isValidToImport || isImporting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isImporting ? 'Importing...' : 'Finalize Import'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
