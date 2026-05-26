"use client";
import React, { useMemo } from 'react';
import { Permit } from '@/types/models';
import { useUpdatePermit } from '@/hooks/usePermitQueries';
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
import { Calendar, User, Building2, Tag } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
import { formatDate } from '@/lib/formatters';

const COLUMNS = [
  { id: 'Preparing', label: 'Preparing', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700' },
  { id: 'Submitted', label: 'Submitted', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  { id: 'Under Review', label: 'Under Review', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  { id: 'Comments Received', label: 'Comments Received', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { id: 'Approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' }
];

// eslint-disable-next-line react/display-name
const SortablePermitCard = React.memo(({ permit }: { permit: Permit }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: permit.id,
    data: {
      type: 'Permit',
      permit
    }
  });

  const setSelectedOpportunityId = useUIStore(state => state.setSelectedOpportunityId);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        // Prevent opening if dragging
        if (!isDragging) {
          setSelectedOpportunityId(permit.id);
        }
      }}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-grab active:cursor-grabbing group relative ${isDragging ? 'z-50 ring-2 ring-sky-500' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
          {permit.display_id || 'PER-???'}
        </span>
        {permit.revision_number ? (
          <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">
            Rev {permit.revision_number}
          </span>
        ) : null}
      </div>
      
      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-3 leading-snug">
        {permit.title}
      </h4>

      <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
        {(permit.permit_type || permit.ahj) && (
          <div className="flex flex-col gap-1">
            {permit.permit_type && (
              <div className="flex items-center gap-1.5" title="Permit Type">
                <Tag size={12} className="shrink-0" />
                <span className="truncate">{permit.permit_type}</span>
              </div>
            )}
            {permit.ahj && (
              <div className="flex items-center gap-1.5" title="AHJ">
                <Building2 size={12} className="shrink-0" />
                <span className="truncate">{permit.ahj}</span>
              </div>
            )}
          </div>
        )}
        
        {permit.assignee && (
          <div className="flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-2" title="Assignees">
            <User size={12} className="shrink-0" />
            <span className="truncate">{permit.assignee.split(',').join(', ')}</span>
          </div>
        )}

        {permit.target_approval_date && (
          <div className="flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-2" title="Target Approval">
            <Calendar size={12} className="shrink-0" />
            <span className="truncate">{formatDate(permit.target_approval_date)}</span>
          </div>
        )}
      </div>

      {/* Zero-JS Tooltip */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-full mb-2 hidden group-hover:block z-[100] pointer-events-none">
        <div className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
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
      className="flex-1 bg-slate-50 dark:bg-slate-900 border-x border-b border-slate-200 dark:border-slate-800 rounded-b-xl p-3 overflow-y-auto custom-scrollbar flex flex-col gap-3 min-h-[150px]"
    >
      {children}
    </div>
  );
};

export default function PermitKanban({ projectId, permits }: { projectId: string, permits: Permit[] }) {
  const updatePermit = useUpdatePermit(projectId);
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
    const cols: Record<string, Permit[]> = {};
    COLUMNS.forEach(c => cols[c.id] = []);
    
    permits.forEach(p => {
      const status = p.status || 'Preparing';
      if (cols[status]) {
        cols[status].push(p);
      } else {
        // Fallback for custom statuses
        cols['Preparing'].push(p);
      }
    });
    
    return cols;
  }, [permits]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    
    if (!over) return;

    const activePermitId = active.id as string;
    const overId = over.id as string; // Could be a column ID or another permit ID

    const activePermit = permits.find(p => p.id === activePermitId);
    if (!activePermit) return;

    // Find the target status
    let targetStatus = overId;
    // If we dropped over another permit, find its status
    const overPermit = permits.find(p => p.id === overId);
    if (overPermit) {
      targetStatus = overPermit.status || 'Preparing';
    }

    if (activePermit.status !== targetStatus) {
      updatePermit.mutate({ 
        id: activePermitId, 
        updates: { status: targetStatus } 
      });
    }
  };

  const activePermit = useMemo(() => {
    return permits.find(p => p.id === activeId);
  }, [activeId, permits]);

  return (
    <div className="w-full h-full p-6 overflow-x-auto overflow-y-hidden bg-slate-100 dark:bg-slate-950">
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 h-full min-w-max pb-4">
          {COLUMNS.map(column => (
            <div key={column.id} className="flex flex-col w-80 h-full max-h-full">
              <div className={`flex items-center justify-between p-3 rounded-t-xl border-x border-t font-semibold text-sm ${column.color}`}>
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                </div>
                <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full text-xs">
                  {columns[column.id].length}
                </span>
              </div>
              
              <DroppableColumn id={column.id}>
                <SortableContext 
                  id={column.id}
                  items={columns[column.id].map(p => p.id)} 
                  strategy={verticalListSortingStrategy}
                >
                  {columns[column.id].map(permit => (
                    <SortablePermitCard key={permit.id} permit={permit} />
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
          {activePermit ? <SortablePermitCard permit={activePermit} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
