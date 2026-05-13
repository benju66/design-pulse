"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useUIStore } from '@/stores/useUIStore';
import { useUpdateOpportunity, useDeleteOpportunity, useDeEscalateOpportunity } from '@/hooks/useOpportunityQueries';
import { useProjectSettings, useProjectMembers, useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { List, Paperclip, MessageSquare, Settings, ChevronDown } from 'lucide-react';
import { ALL_PRIMARY_FIELDS, ADVANCED_FIELD_IDS } from '@/lib/constants';

import { ContendersMatrix } from './ContendersMatrix';
import { ActivityFeed } from './ActivityFeed';
import { SortableFieldCard } from './SortableFieldCard';
import { AssigneeSelect } from './AssigneeSelect';
import { Row } from '@tanstack/react-table';
import { Opportunity } from '@/types/models';

interface ExpandedCardProps {
  row: Row<Opportunity>;
}

export const ExpandedCard = ({ row }: ExpandedCardProps) => {
  const params = useParams();
  const projectId = params?.projectId as string;
  const updateData = useUpdateOpportunity(projectId);
  const deleteData = useDeleteOpportunity(projectId);
  const deEscalate = useDeEscalateOpportunity(projectId);
  const { data: settings } = useProjectSettings(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { permissions } = useCurrentUserPermissions(projectId);
  const buildingAreas = (settings?.building_areas as string[]) || ['Corridor / Common', 'Unit Interiors', 'Back of House'];

  const isLocked = row.original.status === 'Approved';

  // Detect escalated Coordination items surfaced in the Value Matrix.
  // These must NOT be hard-deleted — de-escalation is the only safe action.
  const coordDetails = row.original.coordination_details as Record<string, unknown> | null;
  const isEscalatedCoordItem =
    row.original.record_type === 'Coordination' &&
    (coordDetails?.is_escalated as boolean | undefined) === true;

  const cardOrder = useUIStore(state => state.cardOrder);
  const setCardOrder = useUIStore(state => state.setCardOrder);
  const visibleCards = useUIStore(state => state.visibleCards);
  const toggleCardVisibility = useUIStore(state => state.toggleCardVisibility);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('Details');

  // Controlled accordion: eliminates React vs browser DOM fight on <details open>
  const [descOpen, setDescOpen] = useState(
    () => !!row.original.description?.trim()
  );
  // Re-derive default when the user navigates to a different item.
  // Keyed on `id` only — NOT `description` — so the user's manual toggle
  // isn't overridden when their own edits trigger a TanStack refetch.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { setDescOpen(!!row.original.description?.trim()); }, [row.original.id]);

  const activeFields = cardOrder
    .map(id => ALL_PRIMARY_FIELDS.find(f => f.id === id))
    .filter(f => f && visibleCards[f.id]);

  const primaryFields = activeFields.filter(f => f && !ADVANCED_FIELD_IDS.includes(f.id as any));
  const advancedFields = activeFields.filter(f => f && ADVANCED_FIELD_IDS.includes(f.id as any));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = cardOrder.indexOf(active.id as string);
      const newIndex = cardOrder.indexOf(over.id as string);
      setCardOrder(arrayMove(cardOrder, oldIndex, newIndex));
    }
  };

  const renderFieldInput = (field: any) => {
    const val = (row.original as any)[field.id];
    if (field.id === 'status') {
      return (
        <select
          value={val || 'Draft'}
          disabled={!permissions.can_edit_records}
          onChange={(e) => {
            updateData.mutate({ id: row.original.id, updates: { status: e.target.value } });
          }}
          className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <option value="Draft">Draft</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      );
    } else if (field.id === 'coordination_status') {
      return (
        <select
          value={val || 'Not Required'}
          disabled={!permissions.can_edit_records}
          onChange={(e) => {
            updateData.mutate({ id: row.original.id, updates: { coordination_status: e.target.value } });
          }}
          className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <option value="Not Required">Not Required</option>
          <option value="Pending Plan Update">Pending Plan Update</option>
          <option value="Ready for Review">Ready for Review</option>
          <option value="Implemented">Implemented</option>
        </select>
      );
    } else if (field.id === 'priority') {
      return (
        <select
          value={val || 'Medium'}
          disabled={!permissions.can_edit_records}
          onChange={(e) => {
            updateData.mutate({ id: row.original.id, updates: { priority: e.target.value } });
          }}
          className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <option value="Critical" className="font-bold text-rose-600">Critical</option>
          <option value="High" className="font-semibold text-amber-600">High</option>
          <option value="Medium" className="font-medium text-sky-600">Medium</option>
          <option value="Low" className="text-slate-500">Low</option>
        </select>
      );
    } else if (field.id === 'cost_impact' || field.id === 'days_impact') {
      return (
        <input
          type="number"
          disabled={isLocked || !permissions.can_edit_records}
          className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none ${(isLocked || !permissions.can_edit_records) ? 'opacity-70 cursor-not-allowed' : ''}`}
          key={val as string}
          defaultValue={val || ''}
          onBlur={(e) => {
            const num = Number(e.target.value);
            if (num !== (val || 0)) {
              updateData.mutate({ id: row.original.id, updates: { [field.id]: num } });
            }
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()}
        />
      );
    } else if (field.id === 'assignee') {
      return (
        <div className={`relative w-full ${!permissions.can_edit_records ? 'pointer-events-none opacity-70' : ''}`}>
          <AssigneeSelect
            value={val || ''}
            members={members}
            onChange={(newValue) => {
              updateData.mutate({ id: row.original.id, updates: { assignee: newValue } });
            }}
          />
        </div>
      );
    } else {
      return (
        <textarea
          disabled={(isLocked && field.id === 'title') || !permissions.can_edit_records}
          className={`w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none ${((isLocked && field.id === 'title') || !permissions.can_edit_records) ? 'opacity-70 cursor-not-allowed' : ''}`}
          rows={2}
          key={val as string}
          defaultValue={val || ''}
          onBlur={(e) => {
            if (e.target.value !== (val || '')) {
              updateData.mutate({ id: row.original.id, updates: { [field.id]: e.target.value } });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLElement).blur();
            }
          }}
        />
      );
    }
  };

  return (
    <div className="flex flex-col m-4 border border-slate-300 dark:border-slate-700 rounded-xl shadow-lg bg-slate-50 dark:bg-slate-900/50 whitespace-normal overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/30 px-4">
        <div className="flex space-x-1 py-2">
          {['Details', 'Attachments', 'Activity'].map(tab => {
            const Icon = tab === 'Details' ? List : tab === 'Attachments' ? Paperclip : MessageSquare;
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab 
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon size={16} />
                {tab}
              </button>
            )
          })}
        </div>
        {activeTab === 'Details' && (
          <div className="relative flex items-center gap-3">
            <select
              value={row.original.status || 'Draft'}
              disabled={!permissions.can_edit_records}
              onChange={(e) => {
                updateData.mutate({ id: row.original.id, updates: { status: e.target.value } });
              }}
              className="bg-transparent border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="Draft">Draft</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-700" />

            <select
              value={row.original.building_area || ''}
              disabled={!permissions.can_edit_records}
              onChange={(e) => {
                updateData.mutate({ id: row.original.id, updates: { building_area: e.target.value } });
              }}
              className="bg-transparent border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="" disabled>Select Building Area...</option>
              {buildingAreas.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 p-1.5 px-3 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            >
              <Settings size={18} />
              <span className="text-sm font-semibold">Configure Layout</span>
            </button>
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-700" />
            {isEscalatedCoordItem ? (
              // "Remove from Value Matrix" is accurate from both the Value Matrix
              // AND the CoordinationTable card-mode contexts (ExpandedCard renders in both).
              <button
                onClick={() => {
                  if (window.confirm(
                    'Remove from Value Matrix?\n\nThis returns the item to the Coordination Board only.\nContender options will be unlocked and financial figures cleared.\nNo data will be deleted.'
                  )) {
                    deEscalate.mutate({ id: row.original.id });
                  }
                }}
                disabled={deEscalate.isPending}
                className="flex items-center gap-2 p-1.5 px-3 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove from Value Matrix — returns item to Coordination Board, clears financials, no data deleted"
              >
                <span className="text-sm font-semibold">
                  {deEscalate.isPending ? 'Removing…' : 'Remove from Value Matrix'}
                </span>
              </button>
            ) : permissions.can_delete_records ? (
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this item and all its options? This cannot be undone.')) {
                    deleteData.mutate(row.original.id);
                  }
                }}
                className="flex items-center gap-2 p-1.5 px-3 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500 transition-colors"
                title="Delete Item"
              >
                <span className="text-sm font-semibold">Delete</span>
              </button>
            ) : null}
            {showSettings && (
              <div className="absolute right-0 top-10 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-20">
                <h5 className="text-xs font-semibold text-slate-500 mb-2 px-2">Visible Fields</h5>
                <div className="flex flex-col space-y-1 max-h-60 overflow-y-auto">
                  {ALL_PRIMARY_FIELDS.map(f => (
                    <label key={f.id} className="flex items-center px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="mr-2"
                        checked={!!visibleCards[f.id]}
                        onChange={() => toggleCardVisibility(f.id)}
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
        {activeTab === 'Details' && (
          <>
            {/* Pinned Description / Notes Accordion */}
            <details 
              className="group border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm mb-6"
              open={descOpen}
              onToggle={(e) => setDescOpen(e.newState === 'open')}
            >
              <summary className="flex items-center justify-between p-3 cursor-pointer select-none outline-none bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 transition-colors rounded-xl group-open:rounded-b-none group-open:border-b group-open:border-slate-200 dark:group-open:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                    Description / Notes
                  </span>
                  {/* Subtle Visual Indicator if content exists */}
                  {!!row.original.description?.trim() && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400"></span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 pr-2">
                  {/* Text preview when collapsed and empty */}
                  {!row.original.description?.trim() && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 group-open:hidden">
                      + Add description...
                    </span>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                </div>
              </summary>
              
              <div className="p-2 bg-white dark:bg-slate-800 rounded-b-xl">
                <textarea
                  className="w-full text-sm bg-transparent border-none p-2 h-24 resize-y focus:ring-2 focus:ring-sky-500 rounded-lg outline-none text-slate-800 dark:text-slate-200 disabled:opacity-70 disabled:cursor-not-allowed"
                  placeholder="Add description, scope notes, or context..."
                  key={row.original.id + '-desc'}
                  defaultValue={row.original.description || ''}
                  disabled={isLocked || !permissions?.can_edit_records}
                  onBlur={(e) => {
                    if (e.target.value !== (row.original.description || '')) {
                      updateData.mutate({
                        id: row.original.id,
                        updates: { description: e.target.value }
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      const val = e.currentTarget.value;
                      if (val !== (row.original.description || '')) {
                        updateData.mutate({
                          id: row.original.id,
                          updates: { description: val }
                        });
                      }
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
            </details>
            <ContendersMatrix
              opportunityId={row.original.id}
              isLocked={isLocked}
              recordType="VE"
              projectId={projectId}
              permissions={permissions}
            />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              {/* Primary Data Grid */}
              <SortableContext items={primaryFields.map(f => f!.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                  {primaryFields.map(f => f && (
                    <SortableFieldCard key={f.id} id={f.id} title={f.label}>
                      {renderFieldInput(f)}
                    </SortableFieldCard>
                  ))}
                </div>
              </SortableContext>

              {/* Advanced Drawer */}
              <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-colors font-semibold text-slate-700 dark:text-slate-300">
                  Advanced Details & History
                  <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                  <SortableContext items={advancedFields.map(f => f!.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {advancedFields.map(f => f && (
                        <SortableFieldCard key={f.id} id={f.id} title={f.label}>
                          {renderFieldInput(f)}
                        </SortableFieldCard>
                      ))}
                    </div>
                  </SortableContext>
                  
                  {/* Future Accountability History Log Placeholder */}
                  <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3">Accountability History Log</h4>
                    <div className="space-y-3">
                      <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">System</span> created this record. <span className="text-xs">Just now</span>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </DndContext>
          </>
        )}

        {activeTab === 'Attachments' && (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 bg-white dark:bg-slate-800/50">
            <Paperclip size={32} className="mb-3 text-slate-400" />
            <p className="font-medium text-slate-600 dark:text-slate-300">Drag and drop files here, or click to browse</p>
            <p className="text-sm mt-1 text-slate-400">Supports PDF, JPG, PNG, DOCX</p>
          </div>
        )}

        {activeTab === 'Activity' && (
          <div className="h-[400px]">
            <ActivityFeed opportunityId={row.original.id} projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  );
};
