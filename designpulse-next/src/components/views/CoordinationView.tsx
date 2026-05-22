"use client";

import { useMemo, useState } from 'react';
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
import { useUIStore } from '@/stores/useUIStore';
import { useOpportunities } from '@/hooks/useOpportunityQueries';
import { useProjectSettings } from '@/hooks/useProjectCoreQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import type { Opportunity } from '@/types/models';

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
  const coordinationViewMode = useUIStore(state => state.coordinationViewMode);
  const setCoordinationViewMode = useUIStore(state => state.setCoordinationViewMode);

  // ── Local Filter State ──
  const [coordActiveType, setCoordActiveType] = useState('All');
  const [coordActiveStatuses, setCoordActiveStatuses] = useState<string[]>([]);
  const [coordActiveBuildingAreas, setCoordActiveBuildingAreas] = useState<string[]>([]);
  const [coordActiveDisciplines, setCoordActiveDisciplines] = useState<string[]>([]);
  const [coordActiveCostCodes, setCoordActiveCostCodes] = useState<string[]>([]);

  // ── Derived Settings and Filters ──
  const dynamicBuildingAreas = useMemo(() => {
    return (settings?.building_areas && Array.isArray(settings.building_areas) && settings.building_areas.length > 0) 
      ? (settings.building_areas as string[]) 
      : ['Corridor / Common', 'Unit Interiors', 'Back of House'];
  }, [settings]);

  const projectDisciplines = useMemo(() => {
    return (settings?.disciplines as { id: string; label: string }[]) || [];
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

  const filteredOpportunities = useMemo(() => {
    return coordinationOpportunities.filter(opp => {
      if (coordActiveType !== 'All' && (opp.record_type || 'VE') !== coordActiveType) return false;
      if (coordActiveStatuses.length > 0 && !coordActiveStatuses.includes(opp.coordination_status || '')) return false;
      if (coordActiveBuildingAreas.length > 0 && !coordActiveBuildingAreas.includes(opp.building_area || '')) return false;
      if (coordActiveCostCodes.length > 0 && !coordActiveCostCodes.includes(opp.cost_code || '')) return false;
      
      if (coordActiveDisciplines.length > 0) {
        const details = (opp.coordination_details as Record<string, any>) || {};
        const matchingDisciplineIds = projectDisciplines
          .filter(d => coordActiveDisciplines.includes(d.label))
          .map(d => d.id);
          
        const hasMatchingDiscipline = matchingDisciplineIds.some(id => {
          const disc = details[id];
          return disc && disc.status && disc.status !== 'Not Required';
        });
        
        if (!hasMatchingDiscipline) return false;
      }

      return true;
    });
  }, [coordinationOpportunities, coordActiveType, coordActiveStatuses, coordActiveBuildingAreas, coordActiveCostCodes, coordActiveDisciplines, projectDisciplines]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-950">
      
      {/* View-Specific Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Design Coordination Board
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
            
            <div className="shrink-0">
              <CoordinationSummary 
                opportunities={filteredOpportunities} 
                forceCollapse={coordinationViewMode === 'table-split' && !!selectedOpportunityId} 
              />
            </div>

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
              ) : coordinationViewMode.startsWith('table') ? (
                <CoordinationTable
                  projectId={projectId}
                  opportunities={filteredOpportunities}
                  viewMode={coordinationViewMode.replace('table-', '')}
                  filterActiveCount={(coordActiveType !== 'All' ? 1 : 0) + coordActiveStatuses.length + coordActiveBuildingAreas.length + coordActiveDisciplines.length + coordActiveCostCodes.length}
                  onClearFilters={() => { setCoordActiveType('All'); setCoordActiveStatuses([]); setCoordActiveBuildingAreas([]); setCoordActiveDisciplines([]); setCoordActiveCostCodes([]); }}
                  filterSlot={
                    <>
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
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Building Area</label>
                        <MultiSelectFilter fullWidth label="Building Area" options={dynamicBuildingAreas} selected={coordActiveBuildingAreas} onChange={setCoordActiveBuildingAreas} placeholder="Search areas..." />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Discipline</label>
                        <MultiSelectFilter fullWidth label="Discipline" options={disciplineLabels} selected={coordActiveDisciplines} onChange={setCoordActiveDisciplines} placeholder="Search disciplines..." />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost Code</label>
                        <MultiSelectFilter fullWidth label="Cost Code" options={uniqueCoordCostCodes} selected={coordActiveCostCodes} onChange={setCoordActiveCostCodes} placeholder="Search codes..." />
                      </div>
                    </>
                  }
                />
              ) : (
                <CoordinationBoard projectId={projectId} opportunities={filteredOpportunities} />
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
