"use client";

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';
import { TimelineEvent } from '@/types/models';
import { useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { KeyDateFormModal } from './KeyDateFormModal';
import { getTodayLocalDate } from '@/lib/formatters';
import { Button } from '@/components/ui/Button';

interface KeyDatesCalendarProps {
  projectId: string;
  keyDates: TimelineEvent[];
}

export function KeyDatesCalendar({
  projectId,
  keyDates,
}: KeyDatesCalendarProps) {
  const { permissions } = useCurrentUserPermissions(projectId);

  // Month navigation state
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed

  // Animation transition state
  const [transitionClass, setTransitionClass] = useState('animate-in fade-in duration-200');

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Navigation handlers
  const handlePrevMonth = () => {
    setTransitionClass('animate-out fade-out slide-out-to-right-5 duration-100');
    setTimeout(() => {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(prev => prev - 1);
      } else {
        setCurrentMonth(prev => prev - 1);
      }
      setTransitionClass('animate-in fade-in slide-in-from-left-5 duration-200');
    }, 100);
  };

  const handleNextMonth = () => {
    setTransitionClass('animate-out fade-out slide-out-to-left-5 duration-100');
    setTimeout(() => {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(prev => prev + 1);
      } else {
        setCurrentMonth(prev => prev + 1);
      }
      setTransitionClass('animate-in fade-in slide-in-from-right-5 duration-200');
    }, 100);
  };

  const handleToday = () => {
    setTransitionClass('animate-in fade-in zoom-in-95 duration-200');
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Generate calendar dates for the active grid (6 weeks = 42 cells)
  const calendarCells = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeekIndex = new Date(currentYear, currentMonth, 1).getDay();
    const prevMonthDaysCount = new Date(currentYear, currentMonth, 0).getDate();

    const cells = [];
    const todayStr = getTodayLocalDate();

    // 1. Previous month padding days
    for (let i = firstDayOfWeekIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDaysCount - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dayNumber: dayNum,
        dateString: dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // 2. Active month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({
        dayNumber: i,
        dateString: dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // 3. Next month padding days to complete 42 cells
    const remainingSlots = 42 - cells.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({
        dayNumber: i,
        dateString: dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Click handler to edit an event
  const handleEventClick = (e: React.MouseEvent, event: TimelineEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setSelectedDate(undefined);
    setIsModalOpen(true);
  };

  // Click handler to add a new event on a specific day
  const handleDayClick = (dateStr: string) => {
    if (!permissions.can_edit_records) return;
    setSelectedEvent(null);
    setSelectedDate(dateStr);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-b-xl shadow-sm">
      {/* Calendar Header Controls */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex-wrap gap-3">
        {/* Left: Navigation actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            className="p-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-lg shadow-none bg-white dark:bg-slate-900"
          >
            <ChevronLeft size={16} />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-bold tracking-wide uppercase border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-lg shadow-none bg-white dark:bg-slate-900"
          >
            Today
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            className="p-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-lg shadow-none bg-white dark:bg-slate-900"
          >
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* Center: Month / Year Label */}
        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 select-none tracking-tight">
          <Calendar size={18} className="text-sky-500 shrink-0" />
          {monthNames[currentMonth]} {currentYear}
        </h3>

        {/* Right: Legend Indicator */}
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500" /> Key Dates</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-sky-500" /> Deliverables</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> Permits</span>
        </div>
      </div>

      {/* Weekday Titles Bar */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 shrink-0 text-center py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {weekdayNames.map(day => (
          <div key={day} className="select-none">{day}</div>
        ))}
      </div>

      {/* Monthly Days Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-100 dark:bg-slate-950/20">
        <div className={`grid grid-cols-7 h-full min-h-[500px] border-l border-t border-slate-200 dark:border-slate-800/80 ${transitionClass}`}>
          {calendarCells.map((cell) => {
            // Retrieve events mapped onto this specific YYYY-MM-DD slot
            const dayEvents = keyDates.filter(e => e.timeline_date === cell.dateString && !e.is_deleted);
            const visibleEvents = dayEvents.slice(0, 3);
            const overflowCount = dayEvents.length - 3;

            return (
              <div
                key={cell.dateString}
                onClick={() => handleDayClick(cell.dateString)}
                className={`relative flex flex-col p-2 min-w-0 border-r border-b border-slate-200 dark:border-slate-800/80 transition-colors group select-none ${
                  cell.isCurrentMonth
                    ? cell.isToday
                      ? 'bg-sky-50/15 dark:bg-sky-950/10 hover:bg-sky-50/30 dark:hover:bg-sky-950/20'
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    : 'bg-slate-50/50 dark:bg-slate-950/20 opacity-60 hover:bg-slate-100 dark:hover:bg-slate-950/45'
                } ${permissions.can_edit_records ? 'cursor-pointer' : ''}`}
                style={{ height: 'calc((100vh - 350px) / 6)', minHeight: '80px' }}
              >
                {/* Header of Day cell: Day number + Add Date trigger */}
                <div className="flex items-center justify-between shrink-0 mb-1.5">
                  <span
                    className={`text-xs font-extrabold flex items-center justify-center rounded-full w-5 h-5 leading-none transition-colors ${
                      cell.isToday
                        ? 'bg-sky-500 text-white shadow-sm'
                        : cell.isCurrentMonth
                        ? 'text-slate-800 dark:text-slate-200'
                        : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {permissions.can_edit_records && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDayClick(cell.dateString);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md bg-transparent"
                      title="Add Key Date"
                    >
                      <Plus size={13} strokeWidth={3} />
                    </button>
                  )}
                </div>

                {/* Body of Day cell: Event Badges Stack */}
                <div className="flex-1 min-h-0 overflow-y-hidden flex flex-col gap-1">
                  {visibleEvents.map((event) => {
                    const badgeStyles = {
                      key_date: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-amber-900/30',
                      deliverable: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900/60 hover:bg-sky-100 dark:hover:bg-sky-900/30',
                      permit: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
                    }[event.source_type];

                    return (
                      <div
                        key={event.id}
                        onClick={(e) => handleEventClick(e, event)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded-lg border truncate transition-all ${badgeStyles}`}
                        title={`${event.source_type === 'key_date' ? 'KD' : event.source_type === 'deliverable' ? 'DE' : 'PER'} - ${event.title}`}
                      >
                        {event.title}
                      </div>
                    );
                  })}

                  {/* Overflow Indicator */}
                  {overflowCount > 0 && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDayClick(cell.dateString);
                      }}
                      className="px-1.5 py-0.5 text-[9px] font-extrabold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg text-center border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors"
                    >
                      + {overflowCount} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shared Key Date Modal */}
      <KeyDateFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={projectId}
        event={selectedEvent}
        defaultDate={selectedDate}
      />
    </div>
  );
}
