"use client";

import { useKeyDates, useCreateKeyDate } from '@/hooks/useKeyDateQueries';
import { KeyDatesTable } from '@/components/key-dates/KeyDatesTable';
import { CalendarDays, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface KeyDatesViewProps {
  projectId: string;
}

export function KeyDatesView({ projectId }: KeyDatesViewProps) {
  const { data: keyDates = [], isLoading } = useKeyDates(projectId);
  const createKeyDateMutation = useCreateKeyDate(projectId);

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* View-Specific Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays size={20} className="text-sky-500" />
            Key Dates
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Track, plan, and schedule all pre-construction phases and milestone events.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <Button 
            onClick={() => createKeyDateMutation.mutate({})}
            isLoading={createKeyDateMutation.isPending}
            loadingText="Adding..."
            variant="primary"
          >
            <Plus size={16} strokeWidth={3} className="mr-2" />
            New Key Date
          </Button>
        </div>
      </div>

      {/* Main Board View Container */}
      <div className="flex-1 overflow-hidden relative flex flex-col p-6">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
          </div>
        ) : (
          <KeyDatesTable 
            projectId={projectId}
            keyDates={keyDates}
            createMutation={createKeyDateMutation}
          />
        )}
      </div>
    </div>
  );
}
