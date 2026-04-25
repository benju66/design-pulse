"use client";
import React from 'react';
import { Opportunity } from '@/types/models';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CoordinationColumn } from './CoordinationColumn';
import { CoordinationCard } from './CoordinationCard';
import { useUpdateOpportunity } from '@/hooks/useProjectQueries';
import { toast } from 'sonner';

interface CoordinationBoardProps {
  projectId: string;
  opportunities: Opportunity[];
}

const COLUMNS = [
  { id: 'Pending Plan Update', title: 'Pending Plan Update' },
  { id: 'In Drafting', title: 'In Drafting' },
  { id: 'GC / Owner Review', title: 'GC / Owner Review' },
  { id: 'Implemented', title: 'Implemented' },
];

export default function CoordinationBoard({ projectId, opportunities }: CoordinationBoardProps) {
  const updateMutation = useUpdateOpportunity(projectId);

  // Filter opportunities to only those that should be on the board.
  // Assuming the board tracks execution after an item is locked and moved to 'Pending Plan Update'
  const boardOpportunities = opportunities.filter(opp => 
    COLUMNS.some(col => col.id === opp.status)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Prevent clicks on buttons from triggering drag
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const opportunity = active.data.current?.opportunity as Opportunity;
    if (!opportunity) return;
    
    const currentColumnId = opportunity.status;
    const targetColumnId = over.id as string;

    if (currentColumnId === targetColumnId) return;

    // Validation Logic
    if (targetColumnId === 'GC / Owner Review' || targetColumnId === 'Implemented') {
      const isReady = opportunity.arch_completed && opportunity.mep_completed && opportunity.struct_completed;
      if (!isReady) {
        toast.error('Coordination Incomplete', {
          description: 'All discipline pills (ARCH, MEP, STR) must be completed before moving to Review or Implementation.',
        });
        return; // Exits without calling mutation. dnd-kit will automatically snap back to original column because we do not have an optimistic state array.
      }
    }

    // Passed validation, execute mutation
    updateMutation.mutate({
      id: opportunity.id,
      updates: { status: targetColumnId },
    });
  };

  return (
    <div className="p-6 w-full h-full flex flex-col overflow-hidden">
      <div className="mb-6 shrink-0">
        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Design Coordination Tracker V2</h3>
        <p className="text-sm text-slate-500 mt-1">Drag and drop approved design changes through the drafting and execution pipeline.</p>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full pb-4">
            {COLUMNS.map((col) => {
              const colOpps = boardOpportunities.filter(o => o.status === col.id);
              return (
                <CoordinationColumn key={col.id} id={col.id} title={col.title} count={colOpps.length}>
                  {colOpps.map(opp => (
                    <CoordinationCard key={opp.id} opportunity={opp} projectId={projectId} />
                  ))}
                </CoordinationColumn>
              );
            })}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
