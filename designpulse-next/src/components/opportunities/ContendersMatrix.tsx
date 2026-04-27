"use client";
import { useMemo, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useAllProjectOptions, useCreateOption, useUpdateOption, useLockOption, useDeleteOption, useToggleOptionBudget, useProjectSettings, useReorderOptions, useCurrentUserPermissions, useUnlockOpportunityOption } from '@/hooks/useProjectQueries';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { SortableContenderCard } from './SortableContenderCard';

interface ContendersMatrixProps {
  opportunityId: string;
  isLocked?: boolean;
}

export const ContendersMatrix = ({ opportunityId, isLocked }: ContendersMatrixProps) => {
  const params = useParams();
  const projectId = params?.projectId as string;

  const { data: allOptions = [] } = useAllProjectOptions(projectId);
  const options = useMemo(() => allOptions.filter(o => o.opportunity_id === opportunityId), [allOptions, opportunityId]);
  const { data: settings } = useProjectSettings(projectId);
  const categories = (settings?.categories as string[]) || DEFAULT_CATEGORIES;

  const createOption = useCreateOption(opportunityId, projectId);
  const updateOption = useUpdateOption(opportunityId, projectId);
  const lockOption = useLockOption(opportunityId, projectId);
  const toggleOptionBudget = useToggleOptionBudget(opportunityId, projectId);
  const deleteOption = useDeleteOption(opportunityId, projectId);
  const reorderOptions = useReorderOptions(projectId);

  const { can_unlock_options } = useCurrentUserPermissions(projectId);
  const unlockMutation = useUnlockOpportunityOption(projectId);
  const [unlockConfirmOppId, setUnlockConfirmOppId] = useState<string | null>(null);

  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [options]);

  const hasLockedOption = useMemo(() => sortedOptions.some(o => o.is_locked), [sortedOptions]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sortedOptions.findIndex(o => o.id === active.id);
      const newIndex = sortedOptions.findIndex(o => o.id === over.id);
      const newOrder = arrayMove(sortedOptions, oldIndex, newIndex);
      
      reorderOptions.mutate(newOrder.map(o => o.id));
    }
  };

  const sensors = useSensors(useSensor(PointerSensor));
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);

  useEffect(() => {
    if (options.length > 0 && !initialScrollDone.current) {
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      }, 50);
      initialScrollDone.current = true;
    }
  }, [options.length]);

  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 px-2 flex items-center gap-3">
        Contenders Matrix
        <span className="text-xs font-normal text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-full">
          {options.length} Options
        </span>
      </h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedOptions.map(o => o.id)} strategy={horizontalListSortingStrategy}>
          <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-6 pt-3 px-2">
            {sortedOptions.map(opt => (
              <SortableContenderCard 
                key={opt.id} 
                opt={opt}
                opportunityId={opportunityId}
                categories={categories}
                updateOption={updateOption} 
                deleteOption={deleteOption} 
                lockOption={lockOption} 
                toggleOptionBudget={toggleOptionBudget}
                hasLockedOption={hasLockedOption}
                isLocked={isLocked}
                canUnlock={can_unlock_options}
                onUnlockClick={() => setUnlockConfirmOppId(opportunityId)}
              />
            ))}

            {!isLocked && (
              <div 
                onClick={() => createOption.mutate({})}
                className="shrink-0 w-80 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors text-slate-500 hover:text-sky-600 dark:hover:text-sky-400"
              >
                <Plus size={32} className="mb-2 opacity-50" />
                <span className="font-semibold">+ Add Option</span>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {unlockConfirmOppId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full overflow-hidden p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Unlock Decision</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to unlock this item? This will revert the Opportunity to 'Draft' status, clear the final direction, and shift the locked cost back into Pending/Potential exposure.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setUnlockConfirmOppId(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                disabled={unlockMutation.isPending}
              >
                Cancel
              </button>
              <button 
                onClick={() => unlockMutation.mutate(unlockConfirmOppId, { onSuccess: () => setUnlockConfirmOppId(null) })}
                className="px-4 py-2 text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={unlockMutation.isPending}
              >
                {unlockMutation.isPending ? 'Unlocking...' : 'Yes, Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
