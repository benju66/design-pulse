"use client";
import React, { useMemo } from 'react';
import { ProjectDeliverable } from '@/types/models';
import { useUpdateDeliverable } from '@/hooks/useDeliverableQueries';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { User, Tag, CalendarDays } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { formatDate } from '@/lib/formatters';
import { useProjectMembers } from '@/hooks/useProjectCoreQueries';

const COLUMNS = [
  { id: 'Open', label: 'Open', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700' },
  { id: 'In Progress', label: 'In Progress', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  { id: 'Under Review', label: 'Under Review', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  { id: 'Closed', label: 'Closed', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { id: 'Not Applicable', label: 'Not Applicable', color: 'bg-rose-100/60 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300 border-rose-200/50 dark:border-rose-900/40' }
];

// eslint-disable-next-line react/display-name
const SortableDeliverableCard = React.memo(({ deliverable, projectMembers }: { deliverable: ProjectDeliverable, projectMembers: any[] }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deliverable.id,
    data: {
      type: 'Deliverable',
      deliverable
    }
  });

  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const isActive = selectedOpportunityId === deliverable.id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const emails = deliverable.assignee ? deliverable.assignee.split(',').map(e => e.trim()).filter(Boolean) : [];
  const assignedMembers = emails.map(email => {
    const matched = projectMembers.find(m => m.email === email || m.name === email);
    return {
      displayName: matched ? (matched.name || matched.email) : email
    };
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) {
          setSelectedOpportunityId(deliverable.id);
        }
      }}
      className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-grab active:cursor-grabbing group relative ${
        isActive ? 'ring-2 ring-sky-500 border-sky-500' : 'border-slate-200 dark:border-slate-800'
      } ${isDragging ? 'z-50 ring-2 ring-sky-500' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-2 py-0.5 rounded">
          {deliverable.display_id || 'DE-???'}
        </span>
        {deliverable.is_elevated_key_date && (
          <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 px-2 py-0.5 rounded flex items-center gap-1">
            <Tag size={10} /> Key Date
          </span>
        )}
      </div>
      
      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-3 leading-snug truncate">
        {deliverable.title}
      </h4>

      <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
        {assignedMembers.length > 0 && (
          <div className="flex items-center gap-1.5 pt-1.5" title="Assignees">
            <User size={12} className="shrink-0 text-slate-400" />
            <div className="flex items-center -space-x-1.5 overflow-hidden">
              {assignedMembers.slice(0, 3).map((m, i) => (
                <div key={i} title={m.displayName} className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400 flex items-center justify-center text-[8px] font-bold shrink-0 border border-white dark:border-slate-900 shadow-sm">
                  {m.displayName.substring(0, 2).toUpperCase()}
                </div>
              ))}
              {assignedMembers.length > 3 && (
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center text-[8px] font-bold shrink-0 border border-white dark:border-slate-900 shadow-sm">
                  +{assignedMembers.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        {deliverable.due_date && (
          <div className="flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800/80 pt-2 text-[11px]" title="Due Date">
            <CalendarDays size={12} className="shrink-0 text-slate-400" />
            <span className="truncate">{formatDate(deliverable.due_date)}</span>
          </div>
        )}
      </div>

      {/* Tooltip hint */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-full mb-2 hidden group-hover:block z-50 pointer-events-none">
        <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
          Drag to change status
        </div>
        <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-slate-800 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
      </div>
    </div>
  );
});

const DroppableColumn = ({ id, children }: { id: string, children: React.ReactNode }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div 
      ref={setNodeRef}
      className="flex-1 bg-slate-50 dark:bg-slate-900 border-x border-b border-slate-200 dark:border-slate-800 rounded-b-xl p-3 overflow-y-auto custom-scrollbar flex flex-col gap-3 min-h-[250px]"
    >
      {children}
    </div>
  );
};

export default function DeliverableKanban({ projectId, deliverables }: { projectId: string, deliverables: ProjectDeliverable[] }) {
  const updateDeliverable = useUpdateDeliverable(projectId);
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const columns = useMemo(() => {
    const cols: Record<string, ProjectDeliverable[]> = {};
    COLUMNS.forEach(c => cols[c.id] = []);
    
    deliverables.forEach(d => {
      const status = d.status || 'Open';
      if (cols[status]) {
        cols[status].push(d);
      } else {
        // Fallback for custom/unrecognized statuses
        cols['Open'].push(d);
      }
    });
    
    return cols;
  }, [deliverables]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    
    if (!over) return;

    const activeDelivId = active.id as string;
    const overId = over.id as string;

    const activeDeliv = deliverables.find(d => d.id === activeDelivId);
    if (!activeDeliv) return;

    // Find the target status
    let targetStatus = overId;
    // If dropped over another card, resolve its column status
    const overDeliv = deliverables.find(d => d.id === overId);
    if (overDeliv) {
      targetStatus = overDeliv.status || 'Open';
    }

    if (activeDeliv.status !== targetStatus) {
      updateDeliverable.mutate({ 
        id: activeDelivId, 
        updates: { status: targetStatus as any } 
      });
    }
  };

  const activeDeliverable = useMemo(() => {
    return deliverables.find(d => d.id === activeId);
  }, [activeId, deliverables]);

  return (
    <div className="w-full h-full p-4 overflow-x-auto overflow-y-hidden bg-slate-100 dark:bg-slate-950">
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full min-w-max pb-2">
          {COLUMNS.map(column => (
            <div key={column.id} className="flex flex-col w-72 h-full max-h-full">
              <div className={`flex items-center justify-between p-3 rounded-t-xl border-x border-t font-semibold text-xs uppercase tracking-wider ${column.color}`}>
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                </div>
                <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {columns[column.id].length}
                </span>
              </div>
              
              <DroppableColumn id={column.id}>
                <SortableContext 
                  id={column.id}
                  items={columns[column.id].map(d => d.id)} 
                  strategy={verticalListSortingStrategy}
                >
                  {columns[column.id].map(d => (
                    <SortableDeliverableCard 
                      key={d.id} 
                      deliverable={d} 
                      projectMembers={projectMembers}
                    />
                  ))}
                  
                  {columns[column.id].length === 0 && (
                    <div className="h-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                      Drop here
                    </div>
                  )}
                </SortableContext>
              </DroppableColumn>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeDeliverable ? (
            <SortableDeliverableCard 
              deliverable={activeDeliverable} 
              projectMembers={projectMembers}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
