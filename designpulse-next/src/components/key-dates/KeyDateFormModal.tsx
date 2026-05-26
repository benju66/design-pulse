"use client";

import React, { useState } from 'react';
import { X, ExternalLink, CalendarDays, User, CircleDot } from 'lucide-react';
import { useCreateKeyDate, useUpdateKeyDate, useDeleteKeyDate } from '@/hooks/useKeyDateQueries';
import { Button } from '@/components/ui/Button';
import { ModalShell } from '@/components/ui/ModalShell';
import { useUIStore } from '@/stores/useUIStore';
import { toDateInputValue, formatDate } from '@/lib/formatters';
import { TimelineEvent } from '@/types/models';
import { toast } from 'sonner';

interface KeyDateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  event?: TimelineEvent | null;
  defaultDate?: string;
}

export function KeyDateFormModal({
  isOpen,
  onClose,
  projectId,
  event,
  defaultDate,
}: KeyDateFormModalProps) {
  const createMutation = useCreateKeyDate(projectId);
  const updateMutation = useUpdateKeyDate(projectId);
  const deleteMutation = useDeleteKeyDate(projectId);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');

  const [prevProps, setPrevProps] = useState({ isOpen, eventId: event?.id, defaultDate });
  if (isOpen !== prevProps.isOpen || event?.id !== prevProps.eventId || defaultDate !== prevProps.defaultDate) {
    setPrevProps({ isOpen, eventId: event?.id, defaultDate });
    if (isOpen) {
      if (event) {
        setTitle(event.title || '');
        setDate(toDateInputValue(event.timeline_date) || '');
        setDescription(event.description || '');
      } else {
        setTitle('');
        setDate(defaultDate ? toDateInputValue(defaultDate) : '');
        setDescription('');
      }
    }
  }

  if (!isOpen) return null;

  const isNative = !event || event.source_type === 'key_date';
  const sourceLabel = {
    key_date: 'Key Date',
    deliverable: 'Deliverable',
    permit: 'Permit',
  }[event?.source_type || 'key_date'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNative) return;
    if (!title.trim() || !date) {
      toast.error('Title and Date are required');
      return;
    }

    if (event) {
      // Edit mode mutation
      updateMutation.mutate(
        {
          id: event.id,
          updates: {
            title: title.trim(),
            event_date: date,
            description: description.trim() || null,
          },
        },
        {
          onSuccess: () => {
            toast.success('Key date successfully updated');
            onClose();
          },
        }
      );
    } else {
      // Create mode mutation
      createMutation.mutate(
        {
          title: title.trim(),
          event_date: date,
          description: description.trim() || null,
        },
        {
          onSuccess: () => {
            toast.success('Key date successfully created');
            onClose();
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!event || !isNative) return;

    deleteMutation.mutate(event.id, {
      onSuccess: () => {
        toast.success('Key date successfully deleted');
        onClose();
      },
    });
  };

  const handleJumpToSource = () => {
    if (!event) return;
    if (event.source_type === 'deliverable') {
      useUIStore.getState().setActiveView(projectId, 'deliverables');
    } else if (event.source_type === 'permit') {
      useUIStore.getState().setActiveView(projectId, 'permits');
    }
    onClose();
  };

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="sm" preventClose={isPending}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <CalendarDays size={20} className="text-sky-500" />
          {!event ? 'Add Key Date' : isNative ? 'Edit Key Date' : `${sourceLabel} Details`}
        </h2>
        <button
          onClick={onClose}
          disabled={isPending}
          className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-xl transition-colors disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </div>

      {/* Form / Details Pane */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Read-Only Warning Banner */}
        {!isNative && (
          <div className="p-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/60 rounded-xl text-xs text-violet-700 dark:text-violet-300 leading-relaxed font-medium">
            This milestone originates from the <strong className="font-bold">{sourceLabel}</strong> module and is read-only here. To reschedule, please edit it in its native view.
          </div>
        )}

        {/* Title Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Title {isNative && <span className="text-rose-500">*</span>}
          </label>
          {isNative ? (
            <input
              type="text"
              required
              disabled={isPending}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow text-sm font-medium"
              placeholder="e.g., Groundbreaking Ceremony"
            />
          ) : (
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 select-all">
              {title}
            </div>
          )}
        </div>

        {/* Event Date Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Date {isNative && <span className="text-rose-500">*</span>}
          </label>
          {isNative ? (
            <input
              type="date"
              required
              disabled={isPending}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow text-sm font-medium"
            />
          ) : (
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 select-all">
              {formatDate(date)}
            </div>
          )}
        </div>

        {/* Description Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Description
          </label>
          {isNative ? (
            <textarea
              disabled={isPending}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-sky-500 outline-none transition-shadow min-h-[90px] resize-none text-sm leading-relaxed"
              placeholder="Brief description or notes..."
            />
          ) : (
            <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 min-h-[90px] leading-relaxed whitespace-pre-wrap select-all">
              {description || 'No description provided.'}
            </div>
          )}
        </div>

        {/* Elevated Source Details Section */}
        {!isNative && event && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</span>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 text-sm font-semibold mt-0.5">
                  <CircleDot size={14} className="text-sky-500 shrink-0" />
                  {event.status || 'Open'}
                </div>
              </div>
              {/* Assignee */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Assignee</span>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 text-sm font-semibold mt-0.5">
                  <User size={14} className="text-slate-400 shrink-0" />
                  {event.assignee || 'Unassigned'}
                </div>
              </div>
            </div>

            {/* Jump Button */}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center text-xs font-semibold py-2 bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shadow-none"
                onClick={handleJumpToSource}
              >
                <ExternalLink size={13} className="mr-2" />
                Go to {sourceLabel} Board
              </Button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex gap-2 justify-end">
          {event && isNative && (
            <Button
              type="button"
              variant="destructive"
              className="mr-auto px-4 rounded-xl text-sm font-semibold"
              disabled={isPending}
              isLoading={deleteMutation.isPending}
              loadingText="Deleting..."
              onClick={handleDelete}
            >
              Delete
            </Button>
          )}
          
          <Button
            type="button"
            variant="secondary"
            className="px-4 rounded-xl text-sm font-semibold"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>

          {isNative && (
            <Button
              type="submit"
              variant="primary"
              className="px-5 rounded-xl text-sm font-semibold"
              disabled={isPending || !title.trim() || !date}
              isLoading={createMutation.isPending || updateMutation.isPending}
              loadingText={event ? 'Saving...' : 'Adding...'}
            >
              {event ? 'Save Changes' : 'Add Key Date'}
            </Button>
          )}
        </div>
      </form>
    </ModalShell>
  );
}
