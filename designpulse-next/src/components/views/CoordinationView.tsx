"use client";

import { useMemo, useState, useEffect, useCallback } from 'react';
import { PanelRight, LayoutGrid, UploadCloud } from 'lucide-react';
import CoordinationTable from '@/components/coordination/CoordinationTable';
import CoordinationBoard from '@/components/coordination/CoordinationBoard';
import { CoordinationDetailPanel } from '@/components/coordination/CoordinationDetailPanel';
import { CoordinationSummary } from '@/components/coordination/CoordinationSummary';
import { BulkImportModal } from '@/components/coordination/BulkImportModal';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
const FloorplanCanvas = dynamic(() => import('@/components/FloorplanCanvas'), { ssr: false });
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
import { useUIStore, isCoordViewMode } from '@/stores/useUIStore';
import { useOpportunities } from '@/hooks/useOpportunityQueries';
import { useProjectSettings, useUpdateCoordGroups } from '@/hooks/useProjectCoreQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { useURLFilters } from '@/hooks/useURLFilters';
import type { Opportunity, DisciplineConfig, CoordGroupConfig } from '@/types/models';
import { DEFAULT_DISCIPLINES, UNASSIGNED_GROUP_ID } from '@/lib/constants';

interface CoordinationViewProps {
  projectId: string;
}

const effectiveRecordType = (opp: Opportunity) => opp.record_type || 'VE';

export function CoordinationView({ projectId }: CoordinationViewProps) {
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // ── Queries ──
  const { data: opportunities = [], isLoading } = useOpportunities(projectId);
  const { data: settings } = useProjectSettings(projectId);
  const { data: globalCostCodes = [] } = useCostCodes();

  // ── UI Store states & actions ──
  const selectedOpportunityId = useUIStore(state => state.selectedOpportunityId);
  const isMapVisible = useUIStore(state => state.isMapVisible);
  const rawCoordinationViewMode = useUIStore(state => state.coordinationViewMode);
  // Deep-review Issue 10: apply validity guard on persisted value
  const coordinationViewMode = isCoordViewMode(rawCoordinationViewMode) ? rawCoordinationViewMode : 'table-split';
  const setCoordinationViewMode = useUIStore(state => state.setCoordinationViewMode);

  // ── Coordination Groups ──
  const coordGroups: CoordGroupConfig[] = useMemo(() => settings?.coord_groups ?? [], [settings]);
  const updateCoordGroupsMutation = useUpdateCoordGroups(projectId);
  const handleGroupsChange = useCallback((groups: CoordGroupConfig[]) => {
    updateCoordGroupsMutation.mutate(groups);
  }, [updateCoordGroupsMutation]);
  const isCoordGroupingEnabled = useUIStore(state => state.isCoordGroupingEnabled);

  // ── Local Filter State (v17 URL Integrated) ──
  const [urlFilters, setUrlFilters] = useURLFilters({
    type: 'All',
    statuses: [] as string[],
    areas: [] as string[],
    disciplines: [] as string[],
    codes: [] as string[],
    groups: [] as string[],
    priorities: [] as string[],
    meetingTypes: [] as string[]
  }, 'coord');

  // ── Global Filter linkage settings ──
  const isFilterLinkingEnabled = useUIStore(state => state.isFilterLinkingEnabled);
  const setFilterLinkingEnabled = useUIStore(state => state.setFilterLinkingEnabled);
  const globalBuildingAreas = useUIStore(state => state.globalBuildingAreas);
  const setGlobalBuildingAreas = useUIStore(state => state.setGlobalBuildingAreas);
  const linkedCostCodes = useUIStore(state => state.globalCostCodes);
  const setGlobalCostCodes = useUIStore(state => state.setGlobalCostCodes);

  // Derive filter values either from urlFilters or from global Zustand linkage
  const coordActiveType = urlFilters.type;
  const coordActiveStatuses = urlFilters.statuses;
  const coordActiveBuildingAreas = isFilterLinkingEnabled ? globalBuildingAreas : urlFilters.areas;
  const coordActiveCostCodes = isFilterLinkingEnabled ? linkedCostCodes : urlFilters.codes;
  const coordActiveDisciplines = urlFilters.disciplines;
  const coordActiveGroups = urlFilters.groups;
  const coordActivePriorities = urlFilters.priorities;
  const coordActiveMeetingTypes = urlFilters.meetingTypes;

  const setCoordActiveBuildingAreas = useCallback((areas: string[]) => {
    if (isFilterLinkingEnabled) {
      setGlobalBuildingAreas(areas);
    }
    setUrlFilters(prev => ({ ...prev, areas }));
  }, [isFilterLinkingEnabled, setGlobalBuildingAreas, setUrlFilters]);

  const setCoordActiveCostCodes = useCallback((codes: string[]) => {
    if (isFilterLinkingEnabled) {
      setGlobalCostCodes(codes);
    }
    setUrlFilters(prev => ({ ...prev, codes }));
  }, [isFilterLinkingEnabled, setGlobalCostCodes, setUrlFilters]);

  const setCoordActiveType = useCallback((type: string) => {
    setUrlFilters(prev => ({ ...prev, type }));
  }, [setUrlFilters]);

  const setCoordActiveStatuses = useCallback((statuses: string[]) => {
    setUrlFilters(prev => ({ ...prev, statuses }));
  }, [setUrlFilters]);

  const setCoordActiveDisciplines = useCallback((disciplines: string[]) => {
    setUrlFilters(prev => ({ ...prev, disciplines }));
  }, [setUrlFilters]);

  const setCoordActiveGroups = useCallback((groups: string[]) => {
    setUrlFilters(prev => ({ ...prev, groups }));
  }, [setUrlFilters]);

  const setCoordActivePriorities = useCallback((priorities: string[]) => {
    setUrlFilters(prev => ({ ...prev, priorities }));
  }, [setUrlFilters]);

  const setCoordActiveMeetingTypes = useCallback((meetingTypes: string[]) => {
    setUrlFilters(prev => ({ ...prev, meetingTypes }));
  }, [setUrlFilters]);

  // ── Memoized Group filter label↔ID translation ──
  const groupFilterOptions = useMemo(() =>
    [...coordGroups.map(g => g.label), 'Unassigned'],
    [coordGroups]
  );

  const groupIdToLabel = useMemo(() => {
    const map = new Map<string, string>();
    coordGroups.forEach(g => map.set(g.id, g.label));
    map.set(UNASSIGNED_GROUP_ID, 'Unassigned');
    return map;
  }, [coordGroups]);

  const groupLabelToId = useMemo(() => {
    const map = new Map<string, string>();
    coordGroups.forEach(g => map.set(g.label, g.id));
    map.set('Unassigned', UNASSIGNED_GROUP_ID);
    return map;
  }, [coordGroups]);

  const groupFilterSelected = useMemo(() =>
    coordActiveGroups.map(id => groupIdToLabel.get(id) ?? id),
    [coordActiveGroups, groupIdToLabel]
  );

  const handleGroupFilterChange = useCallback((labels: string[]) => {
    setCoordActiveGroups(labels.map(l => groupLabelToId.get(l) ?? l));
  }, [setCoordActiveGroups, groupLabelToId]);

  const groupColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    coordGroups.forEach(g => { map[g.label] = g.color; });
    map['Unassigned'] = '#94a3b8'; // slate-400
    return map;
  }, [coordGroups]);

  // Sync global linking state back into URL search params
  useEffect(() => {
    if (isFilterLinkingEnabled) {
      setUrlFilters(prev => {
        if (
          JSON.stringify(prev.areas) === JSON.stringify(globalBuildingAreas) &&
          JSON.stringify(prev.codes) === JSON.stringify(linkedCostCodes)
        ) {
          return prev;
        }
        return {
          ...prev,
          areas: globalBuildingAreas,
          codes: linkedCostCodes
        };
      });
    }
  }, [isFilterLinkingEnabled, globalBuildingAreas, linkedCostCodes, setUrlFilters]);

  // ── Derived Settings and Filters ──
  const dynamicBuildingAreas = useMemo(() => {
    return (settings?.building_areas && Array.isArray(settings.building_areas) && settings.building_areas.length > 0) 
      ? (settings.building_areas as string[]) 
      : ['Corridor / Common', 'Unit Interiors', 'Back of House'];
  }, [settings]);

  const projectDisciplines = useMemo((): DisciplineConfig[] => {
    const raw = settings?.disciplines;
    // Guard 1: not an array or empty — fall back to project defaults
    if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_DISCIPLINES;
    // Guard 2: legacy string-array format (same normalization as CoordinationTable)
    return raw.map((d: unknown) =>
      typeof d === 'string'
        ? { id: `d_${d.toLowerCase().replace(/\s+/g, '_')}`, label: d }
        : (d as DisciplineConfig)
    );
  }, [settings]);

  const disciplineLabels = useMemo(() => {
    return projectDisciplines.map(d => d.label);
  }, [projectDisciplines]);

  const globalCostCodeStrings = useMemo(() => {
    return globalCostCodes.map(c => c.description ? `${c.code} - ${c.description}` : c.code);
  }, [globalCostCodes]);

  const coordinationOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      const rt = effectiveRecordType(opp);
      if (rt === 'Coordination') return true;
      if (rt === 'VE' && opp.coordination_status && opp.coordination_status !== 'Not Required') {
        return true;
      }
      return false;
    });
  }, [opportunities]);

  const uniqueCoordTypes = useMemo(() => {
    const types = coordinationOpportunities.map(o => o.record_type || 'VE').filter(Boolean) as string[];
    return Array.from(new Set(types)).sort();
  }, [coordinationOpportunities]);

  const uniqueCoordStatuses = useMemo(() => {
    const statuses = coordinationOpportunities.map(o => o.coordination_status).filter(Boolean) as string[];
    return Array.from(new Set(statuses)).sort();
  }, [coordinationOpportunities]);

  const uniqueCoordCostCodes = useMemo(() => {
    const codes = coordinationOpportunities.map(o => o.cost_code).filter(Boolean) as string[];
    return Array.from(new Set(codes)).sort();
  }, [coordinationOpportunities]);

  const uniqueMeetingTypes = useMemo(() => {
    const types = coordinationOpportunities.map(o => o.meeting_type).filter(Boolean) as string[];
    return Array.from(new Set(types)).sort();
  }, [coordinationOpportunities]);

  const filteredOpportunities = useMemo(() => {
    // Pre-compute discipline ID set once — not per-row (Fix 5)
    const matchingDisciplineIds = coordActiveDisciplines.length > 0
      ? new Set(projectDisciplines
          .filter(d => coordActiveDisciplines.includes(d.label))
          .map(d => d.id))
      : null;

    return coordinationOpportunities.filter(opp => {
      if (coordActiveType !== 'All' && (opp.record_type || 'VE') !== coordActiveType) return false;
      if (coordActiveStatuses.length > 0 && !coordActiveStatuses.includes(opp.coordination_status || '')) return false;
      if (coordActiveBuildingAreas.length > 0 && !coordActiveBuildingAreas.includes(opp.building_area || '')) return false;
      if (coordActiveCostCodes.length > 0 && !coordActiveCostCodes.includes(opp.cost_code || '')) return false;
      
      if (coordActiveGroups.length > 0) {
        const itemGroupId = opp.coord_group_id ?? UNASSIGNED_GROUP_ID;
        if (!coordActiveGroups.includes(itemGroupId)) return false;
      }

      if (coordActivePriorities.length > 0) {
        const itemPriority = opp.priority || 'Set Priority';
        if (!coordActivePriorities.includes(itemPriority)) return false;
      }

      if (coordActiveMeetingTypes.length > 0) {
        if (!opp.meeting_type || !coordActiveMeetingTypes.includes(opp.meeting_type)) return false;
      }

      if (matchingDisciplineIds) {
        const details = (opp.coordination_details as Record<string, unknown>) || {};
        const hasMatch = Array.from(matchingDisciplineIds).some(id => {
          const disc = details[id];
          return typeof disc === 'object' && disc !== null && 'status' in disc
            && (disc as { status: string }).status !== 'Not Required';
        });
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [coordinationOpportunities, coordActiveType, coordActiveStatuses, coordActiveBuildingAreas, coordActiveCostCodes, coordActiveGroups, coordActiveDisciplines, coordActivePriorities, coordActiveMeetingTypes, projectDisciplines]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-950">
      
      {/* View-Specific Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Design Coordination Items
        </h2>
        <div className="flex gap-3 items-center">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2 ml-2">
            <button
              onClick={() => setCoordinationViewMode('table-split')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                coordinationViewMode === 'table-split' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Split View"
            >
              <PanelRight size={18} />
            </button>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />
            <button
              onClick={() => setCoordinationViewMode('board')}
              className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                coordinationViewMode === 'board' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title="Board View"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          <Button 
            intent="coordination"
            onClick={() => setIsBulkImportOpen(true)}
          >
            <UploadCloud size={16} className="mr-2" />
            Bulk Import
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex flex-1 overflow-hidden">
          <div className={`flex flex-col p-6 transition-all duration-300 flex-1 min-w-0 @container ${selectedOpportunityId && coordinationViewMode === 'table-split' ? 'border-r border-slate-200 dark:border-slate-800' : ''}`}>
            
            {/* Hide summary when grouping is enabled to maximize table space */}
            {!isCoordGroupingEnabled && (
              <div className="shrink-0 mb-4">
                <CoordinationSummary
                  opportunities={filteredOpportunities}
                  forceCollapse={coordinationViewMode === 'table-split' && !!selectedOpportunityId}
                  disciplines={projectDisciplines}
                />
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
              {isMapVisible && (
                <div className="h-1/2 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <FloorplanCanvas 
                    projectId={projectId}
                    sheetId=""
                    maxZoom={0}
                    originalWidth={1000}
                    originalHeight={1000}
                    zones={[]}
                  />
                </div>
              )}
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-slate-500">Loading coordination...</div>
              ) : coordinationViewMode === 'board' ? (
                <CoordinationBoard projectId={projectId} opportunities={filteredOpportunities} />
              ) : (
                <CoordinationTable
                  projectId={projectId}
                  opportunities={filteredOpportunities}
                  viewMode={coordinationViewMode === 'table-split' ? 'split' : 'flat'}
                  coordGroups={coordGroups}
                  onGroupsChange={handleGroupsChange}
                  activeGroupIds={coordActiveGroups}
                  filterActiveCount={(coordActiveType !== 'All' ? 1 : 0) + coordActiveStatuses.length + coordActiveBuildingAreas.length + coordActiveDisciplines.length + coordActiveCostCodes.length + coordActiveGroups.length + coordActivePriorities.length + coordActiveMeetingTypes.length}
                  onClearFilters={() => { setCoordActiveType('All'); setCoordActiveStatuses([]); setCoordActiveBuildingAreas([]); setCoordActiveDisciplines([]); setCoordActiveCostCodes([]); setCoordActiveGroups([]); setCoordActivePriorities([]); setCoordActiveMeetingTypes([]); }}
                  filterSlot={
                    <>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Link Filters across views</span>
                        <input
                          type="checkbox"
                          checked={isFilterLinkingEnabled}
                          onChange={(e) => setFilterLinkingEnabled(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</label>
                        <select value={coordActiveType} onChange={(e) => setCoordActiveType(e.target.value)} className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-200 cursor-pointer">
                          <option value="All">All</option>
                          {uniqueCoordTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</label>
                        <MultiSelectFilter fullWidth label="Status" options={uniqueCoordStatuses} selected={coordActiveStatuses} onChange={setCoordActiveStatuses} placeholder="Search statuses..." />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Priority</label>
                        <MultiSelectFilter
                          fullWidth
                          label="Priority"
                          options={['Critical', 'High', 'Medium', 'Low', 'Set Priority']}
                          selected={coordActivePriorities}
                          onChange={setCoordActivePriorities}
                          placeholder="Search priority..."
                          colorMap={{
                            'Critical': '#e11d48',     // rose-600
                            'High': '#d97706',         // amber-600
                            'Medium': '#0284c7',       // sky-600
                            'Low': '#64748b',          // slate-500
                            'Set Priority': '#94a3b8'  // slate-400
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Building Area</label>
                        <MultiSelectFilter fullWidth label="Building Area" options={dynamicBuildingAreas} selected={coordActiveBuildingAreas} onChange={setCoordActiveBuildingAreas} placeholder="Search areas..." />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Discipline</label>
                        <MultiSelectFilter fullWidth label="Discipline" options={disciplineLabels} selected={coordActiveDisciplines} onChange={setCoordActiveDisciplines} placeholder="Search disciplines..." />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Group</label>
                        <MultiSelectFilter fullWidth label="Group" options={groupFilterOptions} selected={groupFilterSelected} onChange={handleGroupFilterChange} placeholder="Search groups..." colorMap={groupColorMap} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost Code</label>
                        <MultiSelectFilter fullWidth label="Cost Code" options={uniqueCoordCostCodes} selected={coordActiveCostCodes} onChange={setCoordActiveCostCodes} placeholder="Search codes..." />
                      </div>
                      {uniqueMeetingTypes.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Meeting</label>
                          <MultiSelectFilter fullWidth label="Meeting" options={uniqueMeetingTypes} selected={coordActiveMeetingTypes} onChange={setCoordActiveMeetingTypes} placeholder="Search meetings..." />
                        </div>
                      )}
                    </>
                  }
                />
              )}
            </div>
          </div>

          {coordinationViewMode === 'table-split' && selectedOpportunityId && filteredOpportunities.find(o => o.id === selectedOpportunityId) && (
            <CoordinationDetailPanel 
              projectId={projectId} 
              opportunity={filteredOpportunities.find(o => o.id === selectedOpportunityId)!} 
            />
          )}
        </div>
      </div>

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        projectId={projectId}
        projectSettings={settings || null}
        costCodes={globalCostCodeStrings}
      />
    </div>
  );
}
