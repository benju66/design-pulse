"use client";

import { useCreateKeyDate } from '@/hooks/useKeyDateQueries';
import { useUnifiedTimeline } from '@/hooks/useTimelineQueries';
import { KeyDatesTable } from '@/components/key-dates/KeyDatesTable';
import { KeyDatesCalendar } from '@/components/key-dates/KeyDatesCalendar';
import { CalendarDays, Plus, List, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/stores/useUIStore';

interface KeyDatesViewProps {
  projectId: string;
}

export function KeyDatesView({ projectId }: KeyDatesViewProps) {
  const { data: timelineEvents = [], isLoading } = useUnifiedTimeline(projectId);
  const createKeyDateMutation = useCreateKeyDate(projectId);
  
  const viewMode = useUIStore(state => state.keyDatesViewMode);
  const setViewMode = useUIStore(state => state.setKeyDatesViewMode);

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
          {/* Layout Toggle Buttons */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2 ml-2 shrink-0 select-none">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Log Table View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Monthly Calendar View"
            >
              <Calendar size={18} />
            </button>
          </div>

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
        ) : viewMode === 'calendar' ? (
          <KeyDatesCalendar 
            projectId={projectId}
            keyDates={timelineEvents}
          />
        ) : (
          <KeyDatesTable 
            projectId={projectId}
            keyDates={timelineEvents}
            createMutation={createKeyDateMutation}
          />
        )}
      </div>
    </div>
  );
}
