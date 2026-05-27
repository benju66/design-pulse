"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { SettingsTab } from '@/stores/useUIStore';
import { Plus, X, GripVertical, Save, RefreshCw, Layers, LayoutDashboard, Info, Map, Tags, Users, TableProperties, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useProjects,
  useUpdateProjectCore,
  useProjectSettings,
  useUpdateProjectSettings,
  useProjectMembers,
  useAddProjectMember,
  useUpdateProjectMemberRole,
  useRemoveProjectMember
} from '@/hooks/useProjectCoreQueries';
import { useSystemUsers } from '@/hooks/useGlobalQueries';
import { useProjectEstimateVersions } from '@/hooks/useEstimateQueries';
import { useIsPlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useAuth } from '@/providers/AuthProvider';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as LucideIcons from 'lucide-react';
import { SidebarItem, DisciplineConfig, PermitTypeConfig, PermitAHJConfig, CategoryConfig } from '@/types/models';
import { DEFAULT_SIDEBAR_ITEMS, DEFAULT_DISCIPLINES } from '@/lib/constants';
import { normalizeCategories } from '@/lib/normalizeSettings';
import { CsiMappingTab } from '@/components/project/CsiMappingTab';
import { ProjectEstimateTab } from '@/components/project/ProjectEstimateTab';
import { BrandStandardsSyncGrid } from '@/components/project/BrandStandardsSyncGrid';
import { useClients } from '@/hooks/useClientQueries';

interface SortableItemProps {
  id: string;
  content: React.ReactNode;
  onRemove?: () => void;
  renderExtra?: () => React.ReactNode;
}

const DEFAULT_VE_COLUMNS = [
  { id: 'display_id', label: 'ID' },
  { id: 'title', label: 'Task / Item' },
  { id: 'options', label: 'Options / Contenders' },
  { id: 'cost_impact', label: 'Cost Impact ($)' },
  { id: 'days_impact', label: 'Days Impact' },
  { id: 'status', label: 'VE Status' },
  { id: 'final_direction', label: 'Final Direction' },
  { id: 'coordination_status', label: 'Coordination Status' },
  { id: 'building_area', label: 'Building Area' },
  { id: 'division', label: 'CSI Division' },
  { id: 'cost_code', label: 'Cost Code' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'due_date', label: 'Due Date' },
];

const DEFAULT_COORD_COLUMNS = [
  { id: 'display_id', label: 'ID' },
  { id: 'record_type', label: 'Record Type' },
  { id: 'title', label: 'Title' },
  { id: 'final_direction', label: 'Direction' },
  { id: 'priority', label: 'Priority' },
  { id: 'status', label: 'Status' },
  { id: 'due_date', label: 'Due Date' },
  { id: 'discipline_status', label: 'Disciplines' }
];

const VALID_SETTINGS_TABS = new Set<SettingsTab>([
  'info', 'team', 'building_areas', 'categories', 'drawings',
  'csi_specs', 'estimate', 'sidebar', 've_matrix', 'coord_matrix', 'brand_standards', 'permits',
  'packages'
]);

const SortableItem = ({ id, content, onRemove, renderExtra }: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl group transition-colors hover:border-sky-300 dark:hover:border-sky-700 bg-white dark:bg-slate-900"
    >
       <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-3">
         <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-400 p-1 hover:text-sky-500 rounded">
           <GripVertical size={16} />
         </div>
         {content}
       </span>
       <div className="flex gap-2">
         {renderExtra && renderExtra()}
         {onRemove && (
           <button 
             onClick={onRemove} 
             className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100"
             title="Remove"
           >
             <X size={16} strokeWidth={2.5} />
           </button>
         )}
       </div>
    </div>
  );
};

// ── Budget Source Picker ─────────────────────────────────────────────────────
// Segmented control: "From Estimate" dropdown vs "Custom Amount" manual input.
// Uses cached useProjectEstimateVersions — zero additional network requests.
function formatBudgetCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function BudgetSourcePicker({
  projectId,
  currentBudget,
  disabled,
  onChange,
}: {
  projectId: string;
  currentBudget: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const { data: versions = [] } = useProjectEstimateVersions(projectId);
  const finalizedVersions = useMemo(
    () => versions.filter((v) => v.is_finalized),
    [versions],
  );

  // Determine the initial mode: if current budget matches a version's total_budget, show "estimate" mode
  const matchingVersionId = useMemo(() => {
    if (currentBudget <= 0) return null;
    const match = finalizedVersions.find((v) => Number(v.total_budget) === Number(currentBudget));
    return match?.id ?? null;
  }, [currentBudget, finalizedVersions]);

  const [mode, setMode] = useState<'estimate' | 'custom'>(
    matchingVersionId ? 'estimate' : (finalizedVersions.length > 0 && currentBudget <= 0) ? 'estimate' : 'custom'
  );

  // Sync mode when versions load asynchronously
  useEffect(() => {
    if (finalizedVersions.length > 0 && matchingVersionId) {
      setMode('estimate');
    }
  }, [finalizedVersions.length, matchingVersionId]);

  const handleVersionSelect = useCallback(
    (versionId: string) => {
      const version = finalizedVersions.find((v) => v.id === versionId);
      if (version) {
        onChange(Number(version.total_budget));
      }
    },
    [finalizedVersions, onChange],
  );

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mt-6">
      <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 mb-4">Financials</h3>
      <div className="w-2/3 space-y-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Original Budget</label>

        {/* Segmented Toggle */}
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden w-fit">
          <button
            type="button"
            disabled={disabled || finalizedVersions.length === 0}
            onClick={() => setMode('estimate')}
            className={`px-4 py-1.5 text-xs font-bold transition-colors ${
              mode === 'estimate'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            From Estimate
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMode('custom')}
            className={`px-4 py-1.5 text-xs font-bold transition-colors border-l border-slate-200 dark:border-slate-700 ${
              mode === 'custom'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Custom Amount
          </button>
        </div>

        {/* Mode A: Estimate Version Dropdown */}
        {mode === 'estimate' && (
          <div className="space-y-2">
            {finalizedVersions.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                No finalized estimate versions found. Import a budget first in the Estimate tab.
              </p>
            ) : (
              <select
                disabled={disabled}
                value={matchingVersionId ?? ''}
                onChange={(e) => handleVersionSelect(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
              >
                <option value="" disabled>
                  Select an estimate version…
                </option>
                {finalizedVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.is_active ? '⭐ ' : ''}{v.version_name} ({v.version_date}) — {formatBudgetCurrency(v.total_budget)}
                  </option>
                ))}
              </select>
            )}
            {currentBudget > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Budget set to <span className="font-bold text-slate-700 dark:text-slate-300">{formatBudgetCurrency(currentBudget)}</span>
              </p>
            )}
          </div>
        )}

        {/* Mode B: Custom Manual Input */}
        {mode === 'custom' && (
          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
              <input
                type="number"
                disabled={disabled}
                value={currentBudget}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="5000000"
              />
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500 mt-1">This value sets the baseline for the Value Matrix and Project Overview.</p>
      </div>
    </div>
  );
}

export const ProjectSettings = ({
  projectId,
  activeTab,
  onTabChange,
}: {
  projectId: string;
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}) => {
  const { session } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useProjectSettings(projectId);
  const updateSettings = useUpdateProjectSettings(projectId);
  
  const { data: projects } = useProjects();
  const currentProject = projects?.find(p => p.id === projectId);
  const updateProjectCore = useUpdateProjectCore(projectId);
  const { data: clients = [] } = useClients();

  // Tab state is now CONTROLLED via props (activeTab / onTabChange from parent).
  // The parent (page.tsx) persists this in useUIStore so it survives page refreshes.
  
  const { data: teamMembers, isLoading: teamLoading } = useProjectMembers(projectId);
  const { data: allUsers } = useSystemUsers({ enabled: activeTab === 'team' });
  const { data: isPlatformAdmin, isLoading: adminLoading } = useIsPlatformAdmin();

  const currentUserRole = teamMembers?.find(m => m.user_id === session?.user?.id)?.role;
  const canManageTeam = isPlatformAdmin || currentUserRole === 'project_admin' || currentUserRole === 'gc_admin';

  // Guard 1: reject stale or unknown tab values from persisted storage
  const safeTab: SettingsTab = VALID_SETTINGS_TABS.has(activeTab) ? activeTab : 'info';
  // Guard 2: role-gate — team tab requires management permissions; redirect to info silently
  const displayTab: SettingsTab = (safeTab === 'team' && !canManageTeam) ? 'info' : safeTab;
  
  const addMemberMutation = useAddProjectMember(projectId);
  const updateRoleMutation = useUpdateProjectMemberRole(projectId);
  const removeMemberMutation = useRemoveProjectMember(projectId);

  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');


  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [buildingAreas, setBuildingAreas] = useState<string[]>([]);
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineConfig[]>([]);
  const [veColumns, setVeColumns] = useState<{id: string, label: string, visible?: boolean, pinned?: boolean}[]>([]);
  const [coordColumns, setCoordColumns] = useState<{id: string, label: string, visible?: boolean}[]>([]);
  const [permitTypes, setPermitTypes] = useState<PermitTypeConfig[]>([]);
  const [permitAHJs, setPermitAHJs] = useState<PermitAHJConfig[]>([]);
  
  const [projectInfo, setProjectInfo] = useState({
    project_name: '',
    location: '',
    original_budget: 0,
    enable_audit_logging: false
  });
  
  const [projectNumber, setProjectNumber] = useState('');
  const [procoreProjectId, setProcoreProjectId] = useState('');
  const [procoreCompanyId, setProcoreCompanyId] = useState('');
  const [clientId, setClientId] = useState('');
  
  const [newCat, setNewCat] = useState('');
  const [newBuildingArea, setNewBuildingArea] = useState('');
  const [newDiscipline, setNewDiscipline] = useState('');
  const [newPermitType, setNewPermitType] = useState('');
  const [newPermitAHJ, setNewPermitAHJ] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const resetSettings = useCallback(() => {
    if (settings) {
      setCategories(normalizeCategories(settings.categories));
      setBuildingAreas((settings.building_areas as string[]) || []);
      const savedSidebarItems = (settings.sidebar_items as unknown as SidebarItem[]) || [];
      const mergedSidebarItems = savedSidebarItems.map(item => {
        const defaultItem = DEFAULT_SIDEBAR_ITEMS.find(d => d.id === item.id);
        return defaultItem ? { ...item, label: defaultItem.label, iconName: defaultItem.iconName } : item;
      });
      DEFAULT_SIDEBAR_ITEMS.forEach(defaultItem => {
        if (!mergedSidebarItems.find(i => i.id === defaultItem.id)) {
          mergedSidebarItems.push({ ...defaultItem } as SidebarItem);
        }
      });
      setSidebarItems(mergedSidebarItems);
      
      const rawDisciplines = settings.disciplines;
      setDisciplines(
        Array.isArray(rawDisciplines) 
          ? rawDisciplines.map((d: any) => typeof d === 'string' ? { id: `d_${d.toLowerCase().replace(/\s+/g, '_')}`, label: d } : d)
          : [...DEFAULT_DISCIPLINES]
      );
      
      setPermitTypes((settings.permit_types as PermitTypeConfig[]) || []);
      setPermitAHJs((settings.permit_ahjs as PermitAHJConfig[]) || []);
      
      const savedOrder = settings.ve_column_order || [];
      if (savedOrder.length > 0) {
        const isLegacy = typeof savedOrder[0] === 'string';
        const orderIds = isLegacy ? savedOrder : savedOrder.map((c: { id: string }) => c.id);
        const visibilityMap = isLegacy ? {} : savedOrder.reduce((acc: Record<string, boolean>, c: { id: string, visible?: boolean }) => ({ ...acc, [c.id]: c.visible !== false }), {});
        const pinnedMap = isLegacy ? {} : savedOrder.reduce((acc: Record<string, boolean>, c: { id: string, pinned?: boolean }) => ({ ...acc, [c.id]: !!c.pinned }), {});
        
        const sorted = [...DEFAULT_VE_COLUMNS].sort((a, b) => {
          const indexA = orderIds.indexOf(a.id);
          const indexB = orderIds.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        }).map(c => ({
          ...c,
          visible: visibilityMap[c.id] ?? true,
          pinned: pinnedMap[c.id] ?? false
        }));
        setVeColumns(sorted);
      } else {
        setVeColumns(DEFAULT_VE_COLUMNS.map(c => ({ ...c, visible: true })));
      }
      
      const savedCoordOrder = settings.coord_column_order || [];
      if (savedCoordOrder.length > 0) {
        const isLegacy = typeof savedCoordOrder[0] === 'string';
        const orderIds = isLegacy ? savedCoordOrder : savedCoordOrder.map((c: { id: string }) => c.id);
        const visibilityMap = isLegacy ? {} : savedCoordOrder.reduce((acc: Record<string, boolean>, c: { id: string, visible?: boolean }) => ({ ...acc, [c.id]: c.visible !== false }), {});
        
        const sortedCoord = [...DEFAULT_COORD_COLUMNS].sort((a, b) => {
          const indexA = orderIds.indexOf(a.id);
          const indexB = orderIds.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        }).map(c => ({
          ...c,
          visible: visibilityMap[c.id] ?? true
        }));
        setCoordColumns(sortedCoord);
      } else {
        setCoordColumns(DEFAULT_COORD_COLUMNS.map(c => ({ ...c, visible: true })));
      }
      
      setProjectInfo({
        project_name: settings.project_name || projectId,
        location: settings.location || '',
        original_budget: Number(settings.original_budget) || 0,
        enable_audit_logging: settings.enable_audit_logging || false
      });
      if (currentProject) {
        setProjectNumber(currentProject.project_number || '');
        setProcoreProjectId(currentProject.procore_project_id || '');
        setProcoreCompanyId(currentProject.procore_company_id || '');
        setClientId(currentProject.client_id || '');
      }
      setHasChanges(false);
    }
  }, [settings, currentProject, projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetSettings();
  }, [resetSettings]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addCat = () => {
    if (newCat.trim() && !categories.some(c => c.label === newCat.trim())) {
      setCategories([...categories, { id: crypto.randomUUID(), label: newCat.trim(), no_coord_default: false }]);
      setNewCat('');
      setHasChanges(true);
    }
  };

  const addBuildingArea = () => {
    if (newBuildingArea.trim() && !buildingAreas.includes(newBuildingArea.trim())) {
      setBuildingAreas([...buildingAreas, newBuildingArea.trim()]);
      setNewBuildingArea('');
      setHasChanges(true);
    }
  };

  const addDiscipline = () => {
    if (newDiscipline.trim()) {
      setDisciplines([...disciplines, { id: crypto.randomUUID(), label: newDiscipline.trim() }]);
      setNewDiscipline('');
      setHasChanges(true);
    }
  };

  const addPermitType = () => {
    if (newPermitType.trim()) {
      setPermitTypes([...permitTypes, { id: crypto.randomUUID(), label: newPermitType.trim() }]);
      setNewPermitType('');
      setHasChanges(true);
    }
  };

  const addPermitAHJ = () => {
    if (newPermitAHJ.trim()) {
      setPermitAHJs([...permitAHJs, { id: crypto.randomUUID(), label: newPermitAHJ.trim() }]);
      setNewPermitAHJ('');
      setHasChanges(true);
    }
  };

  const handleDragEndCategories = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex(c => c.id === active.id);
      const newIndex = categories.findIndex(c => c.id === over.id);
      setCategories(arrayMove(categories, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const handleDragEndBuildingAreas = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = buildingAreas.indexOf(active.id as string);
      const newIndex = buildingAreas.indexOf(over.id as string);
      setBuildingAreas(arrayMove(buildingAreas, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const handleDragEndDisciplines = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = disciplines.findIndex(d => d.id === active.id);
      const newIndex = disciplines.findIndex(d => d.id === over.id);
      setDisciplines(arrayMove(disciplines, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const handleDragEndPermitTypes = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = permitTypes.findIndex(d => d.id === active.id);
      const newIndex = permitTypes.findIndex(d => d.id === over.id);
      setPermitTypes(arrayMove(permitTypes, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const handleDragEndPermitAHJs = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = permitAHJs.findIndex(d => d.id === active.id);
      const newIndex = permitAHJs.findIndex(d => d.id === over.id);
      setPermitAHJs(arrayMove(permitAHJs, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const handleDragEndSidebar = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sidebarItems.findIndex(i => i.id === active.id);
      const newIndex = sidebarItems.findIndex(i => i.id === over.id);
      setSidebarItems(arrayMove(sidebarItems, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const handleDragEndVeColumns = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = veColumns.findIndex(c => c.id === active.id);
      const newIndex = veColumns.findIndex(c => c.id === over.id);
      setVeColumns(arrayMove(veColumns, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const handleDragEndCoordColumns = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = coordColumns.findIndex(c => c.id === active.id);
      const newIndex = coordColumns.findIndex(c => c.id === over.id);
      setCoordColumns(arrayMove(coordColumns, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const toggleSidebarItem = (id: string) => {
    setSidebarItems(items => items.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    ));
    setHasChanges(true);
  };

  const toggleVeColumn = (id: string) => {
    setVeColumns(cols => cols.map(col => 
      col.id === id ? { ...col, visible: !col.visible } : col
    ));
    setHasChanges(true);
  };

  const toggleVeColumnPin = (id: string) => {
    setVeColumns(cols => cols.map(col => 
      col.id === id ? { ...col, pinned: !col.pinned } : col
    ));
    setHasChanges(true);
  };

  const toggleCoordColumn = (id: string) => {
    setCoordColumns(cols => cols.map(col => 
      col.id === id ? { ...col, visible: !col.visible } : col
    ));
    setHasChanges(true);
  };

  const handleInfoChange = (field: string, value: string | number | boolean) => {
    setProjectInfo(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateProjectCore.mutate({ 
      project_number: projectNumber || null,
      procore_project_id: procoreProjectId.trim() || null,
      procore_company_id: procoreCompanyId.trim() || null,
      client_id: clientId || null
    });
    updateSettings.mutate(
      { 
        categories: categories as unknown as any,
        building_areas: buildingAreas,
        sidebar_items: sidebarItems as any,
        disciplines: disciplines as any,
        project_name: projectInfo.project_name,
        location: projectInfo.location,
        original_budget: Number(projectInfo.original_budget),
        enable_audit_logging: Boolean(projectInfo.enable_audit_logging),
        ve_column_order: veColumns.map(c => ({ id: c.id, visible: c.visible ?? true, pinned: c.pinned ?? false })),
        coord_column_order: coordColumns.map(c => ({ id: c.id, visible: c.visible ?? true })),
        permit_types: permitTypes as any,
        permit_ahjs: permitAHJs as any
      },
      { onSuccess: () => setHasChanges(false) }
    );
  };

  if (settingsLoading || teamLoading || adminLoading) {
    return (
      <div className="flex w-full h-full bg-white dark:bg-slate-900 overflow-hidden">
        <div className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-6">
           <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-6"></div>
           <div className="space-y-3">
             {[...Array(6)].map((_, i) => <div key={i} className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>)}
           </div>
        </div>
        <div className="flex-1 p-8">
           <div className="max-w-4xl mx-auto">
             <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-8"></div>
             <div className="h-96 w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse"></div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full bg-white dark:bg-slate-900 overflow-hidden relative">
      {/* Left Sidebar Navigation */}
      <div className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col h-full overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-6">
          
          {/* General Group */}
          <div>
            <h4 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">General</h4>
            <nav className="space-y-1">
              <button
                onClick={() => onTabChange('info')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'info' 
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <Info size={16} className={activeTab === 'info' ? 'text-sky-500' : 'text-slate-400'} /> Project Info
              </button>
              {canManageTeam && (
                <button
                  onClick={() => onTabChange('team')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                    activeTab === 'team' 
                      ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                      : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Users size={16} className={activeTab === 'team' ? 'text-sky-500' : 'text-slate-400'} /> Team Members
                </button>
              )}
            </nav>
          </div>
          
          {/* Data & Classifications Group */}
          <div>
            <h4 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Data & Classifications</h4>
            <nav className="space-y-1">
              <button
                onClick={() => onTabChange('building_areas')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'building_areas' 
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <Map size={16} className={activeTab === 'building_areas' ? 'text-sky-500' : 'text-slate-400'} /> Building Areas
              </button>
              <button
                onClick={() => onTabChange('categories')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'categories' 
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <Layers size={16} className={activeTab === 'categories' ? 'text-sky-500' : 'text-slate-400'} /> Categories
              </button>
              <button
                onClick={() => onTabChange('drawings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'drawings' 
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <Tags size={16} className={activeTab === 'drawings' ? 'text-sky-500' : 'text-slate-400'} /> Drawings
              </button>
              <button
                onClick={() => onTabChange('csi_specs')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'csi_specs' 
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <LucideIcons.BookOpen size={16} className={activeTab === 'csi_specs' ? 'text-sky-500' : 'text-slate-400'} /> CSI &amp; Specs
              </button>
              <button
                onClick={() => onTabChange('estimate')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'estimate'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400'
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <LucideIcons.BarChart3 size={16} className={activeTab === 'estimate' ? 'text-sky-500' : 'text-slate-400'} /> Project Budget
              </button>
              <button
                onClick={() => onTabChange('brand_standards')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'brand_standards'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400'
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <LucideIcons.Link2 size={16} className={activeTab === 'brand_standards' ? 'text-sky-500' : 'text-slate-400'} /> Brand Standards
              </button>
            </nav>
          </div>
          
          {/* Views & Config Group */}
          <div>
            <h4 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Views & Config</h4>
            <nav className="space-y-1">
              <button
                onClick={() => onTabChange('sidebar')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'sidebar' 
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard size={16} className={activeTab === 'sidebar' ? 'text-sky-500' : 'text-slate-400'} /> Sidebar Menu
              </button>
              <button
                onClick={() => onTabChange('ve_matrix')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 've_matrix' 
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <TableProperties size={16} className={activeTab === 've_matrix' ? 'text-sky-500' : 'text-slate-400'} /> Value Matrix
              </button>
              <button
                onClick={() => onTabChange('coord_matrix')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'coord_matrix' 
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <TableProperties size={16} className={activeTab === 'coord_matrix' ? 'text-sky-500' : 'text-slate-400'} /> Coordination Items
              </button>
              <button
                onClick={() => onTabChange('permits')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'permits' 
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <LucideIcons.FileCheck2 size={16} className={activeTab === 'permits' ? 'text-sky-500' : 'text-slate-400'} /> Permits
              </button>
              <button
                onClick={() => onTabChange('packages')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeTab === 'packages' 
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' 
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <LucideIcons.Package size={16} className={activeTab === 'packages' ? 'text-sky-500' : 'text-slate-400'} /> Packages
              </button>
            </nav>
          </div>
          
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-y-auto p-8 relative custom-scrollbar">
        <div className={`mx-auto pb-32 ${displayTab === 'estimate' ? 'max-w-full' : 'max-w-4xl'}`}>
      {displayTab === 'info' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Project Information</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Basic details about this project. These will be used in exports and dashboard summaries.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Database ID</label>
              <input 
                type="text" 
                readOnly
                disabled
                value={projectId}
                className="w-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none font-mono opacity-70 cursor-not-allowed"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project Display Name</label>
              <input 
                type="text" 
                disabled={!canManageTeam}
                value={projectInfo.project_name}
                onChange={e => handleInfoChange('project_name', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g. Acme Headquarters"
              />
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Client Association</label>
            <select 
              disabled={!canManageTeam}
              value={clientId}
              onChange={e => {
                setClientId(e.target.value);
                setHasChanges(true);
              }}
              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">No Client Assigned</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project Number</label>
              <input 
                type="text" 
                disabled={!canManageTeam}
                value={projectNumber}
                onChange={e => {
                  setProjectNumber(e.target.value);
                  setHasChanges(true);
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g. 26-123"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Location</label>
              <input 
                type="text" 
                disabled={!canManageTeam}
                value={projectInfo.location}
                onChange={e => handleInfoChange('location', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g. New York, NY"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Procore Project ID</label>
              <input 
                type="text" 
                disabled={!canManageTeam}
                value={procoreProjectId}
                onChange={e => {
                  setProcoreProjectId(e.target.value);
                  setHasChanges(true);
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g. 1234567"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Procore Company ID</label>
              <input 
                type="text" 
                disabled={!canManageTeam}
                value={procoreCompanyId}
                onChange={e => {
                  setProcoreCompanyId(e.target.value);
                  setHasChanges(true);
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g. 890123"
              />
            </div>
          </div>

          <BudgetSourcePicker
            projectId={projectId}
            currentBudget={projectInfo.original_budget}
            disabled={!canManageTeam}
            onChange={(value) => handleInfoChange('original_budget', value)}
          />

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mt-6">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 mb-4">Security & Compliance</h3>
            <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enable Audit Logging</p>
                <p className="text-xs text-slate-500 mt-1">Track all row-level changes (INSERT/UPDATE/DELETE) in the database.</p>
              </div>
              <button 
                type="button"
                onClick={() => handleInfoChange('enable_audit_logging', !projectInfo.enable_audit_logging)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                  projectInfo.enable_audit_logging ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                title={projectInfo.enable_audit_logging ? "Disable audit logging" : "Enable audit logging"}
              >
                <span 
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                    projectInfo.enable_audit_logging ? 'translate-x-6' : 'translate-x-1'
                  }`} 
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {displayTab === 'building_areas' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Project Building Areas / Filtering Tabs</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Define the physical buildingAreas or locations within your project (e.g., Corridor, Exterior, Units). These become the main filter tabs at the top of the Value Matrix and can be assigned to items in the grid.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndBuildingAreas}>
            <SortableContext items={buildingAreas} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-6">
                {buildingAreas.map((buildingArea) => (
                  <SortableItem 
                    key={buildingArea} 
                    id={buildingArea} 
                    content={buildingArea} 
                    onRemove={() => {
                      setBuildingAreas(buildingAreas.filter(s => s !== buildingArea));
                      setHasChanges(true);
                    }} 
                  />
                ))}
                {buildingAreas.length === 0 && (
                  <div className="p-4 text-center text-sm text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                    No buildingAreas defined.
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex gap-3">
             <input 
               type="text" 
               value={newBuildingArea}
               onChange={e => setNewBuildingArea(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && addBuildingArea()}
               placeholder="Add a new project buildingArea..." 
               className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium"
             />
             <button 
               onClick={addBuildingArea} 
               disabled={!newBuildingArea.trim()}
               className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
             >
               <Plus size={18} /> Add
             </button>
          </div>
        </div>
      )}

      {displayTab === 'brand_standards' && (
        <BrandStandardsSyncGrid projectId={projectId} />
      )}

      {displayTab === 'categories' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Custom Dropdown Categories</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Customize the options available when classifying a VE or Alternate contender. Drag to reorder.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCategories}>
            <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-6">
                {categories.map((cat) => (
                  <SortableItem 
                    key={cat.id} 
                    id={cat.id} 
                    content={cat.label} 
                    onRemove={() => {
                      setCategories(categories.filter(c => c.id !== cat.id));
                      setHasChanges(true);
                    }}
                    renderExtra={() => (
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap" title="When ON, locking a contender in this category will default the Requires Coordination toggle to OFF">
                          No Coord Default
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={cat.no_coord_default}
                          onClick={() => {
                            setCategories(categories.map(c =>
                              c.id === cat.id ? { ...c, no_coord_default: !c.no_coord_default } : c
                            ));
                            setHasChanges(true);
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                            cat.no_coord_default ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            cat.no_coord_default ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    )}
                  />
                ))}
                {categories.length === 0 && (
                  <div className="p-4 text-center text-sm text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                    No custom categories defined.
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex gap-3">
             <input 
               type="text" 
               value={newCat}
               onChange={e => setNewCat(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && addCat()}
               placeholder="Type a new category name..." 
               className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium"
             />
             <button 
               onClick={addCat} 
               disabled={!newCat.trim()}
               className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
             >
               <Plus size={18} /> Add
             </button>
          </div>
        </div>
      )}

      {displayTab === 'sidebar' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Sidebar Layout Configuration</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Drag items to rearrange the left navigation bar. Toggle visibility to hide unused features.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndSidebar}>
            <SortableContext items={sidebarItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-6">
                {sidebarItems.map((item) => {
                  const Icon = (LucideIcons as any)[item.iconName] || LucideIcons.Square;
                  return (
                    <SortableItem 
                      key={item.id} 
                      id={item.id} 
                      content={
                        <div className="flex items-center gap-3">
                          <Icon size={18} className={item.visible ? 'text-sky-500' : 'text-slate-400'} />
                          <span className={item.visible ? '' : 'text-slate-400 line-through decoration-slate-500 opacity-60'}>
                            {item.label}
                          </span>
                        </div>
                      }
                      renderExtra={() => (
                        <button 
                          type="button"
                          onClick={() => toggleSidebarItem(item.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                            item.visible ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          title={item.visible ? "Turn off view" : "Turn on view"}
                        >
                          <span 
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                              item.visible ? 'translate-x-6' : 'translate-x-1'
                            }`} 
                          />
                        </button>
                      )}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-500 flex items-center gap-2 mt-6">
            <span>The <strong>Project Settings</strong> tab is locked to the bottom and cannot be disabled.</span>
          </div>
        </div>
      )}

      {displayTab === 'drawings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Drawing Disciplines</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Define the engineering and design disciplines to organize project drawings and track in Coordination Items. Drag to reorder.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndDisciplines}>
            <SortableContext items={disciplines.map(d => d.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-6">
                {disciplines.map((disc) => (
                  <SortableItem 
                    key={disc.id} 
                    id={disc.id} 
                    content={disc.label} 
                    onRemove={() => {
                      setDisciplines(disciplines.filter(d => d.id !== disc.id));
                      setHasChanges(true);
                    }} 
                  />
                ))}
                {disciplines.length === 0 && (
                  <div className="p-4 text-center text-sm text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                    No disciplines defined.
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex gap-3">
             <input 
               type="text" 
               value={newDiscipline}
               onChange={e => setNewDiscipline(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && addDiscipline()}
               placeholder="Add a new discipline..." 
               className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium"
             />
             <button 
               onClick={addDiscipline} 
               disabled={!newDiscipline.trim()}
               className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
             >
               <Plus size={18} /> Add
             </button>
          </div>
        </div>
      )}

      {displayTab === 've_matrix' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Value Matrix Configuration</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Set the default column order for the Value Matrix. Drag items to rearrange them. Note: individual users can still temporarily reorder columns using the View menu.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndVeColumns}>
            <SortableContext items={veColumns.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-6">
                {veColumns.map((col) => (
                  <SortableItem 
                    key={col.id} 
                    id={col.id} 
                    content={col.label}
                    renderExtra={() => (
                      <div className="flex items-center gap-2">
                        <div className="relative group">
                          <button
                            onClick={() => toggleVeColumnPin(col.id)}
                            className={`p-1 rounded transition-colors ${
                              col.pinned 
                                ? 'text-sky-500 bg-sky-50 dark:bg-sky-900/30' 
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                          >
                            {col.pinned ? <LucideIcons.Pin size={16} className="fill-sky-500" /> : <LucideIcons.PinOff size={16} />}
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                            {col.pinned ? 'Unpin column' : 'Pin to left side'}
                          </div>
                        </div>

                        <div className="relative group">
                          <button
                            onClick={() => toggleVeColumn(col.id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                              col.visible ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <span 
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                                col.visible ? 'translate-x-6' : 'translate-x-1'
                              }`} 
                            />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                            {col.visible ? 'Hide column by default' : 'Show column by default'}
                          </div>
                        </div>
                      </div>
                    )}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {displayTab === 'coord_matrix' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Coordination Items Configuration</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Set the default column order for Coordination Items. Drag items to rearrange them or toggle their visibility.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCoordColumns}>
            <SortableContext items={coordColumns.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-6">
                {coordColumns.map((col) => (
                  <SortableItem 
                    key={col.id} 
                    id={col.id} 
                    content={col.label}
                    renderExtra={() => (
                      <button
                        onClick={() => toggleCoordColumn(col.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                          col.visible ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                        title={col.visible ? 'Hide column by default' : 'Show column by default'}
                      >
                        <span 
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                            col.visible ? 'translate-x-6' : 'translate-x-1'
                          }`} 
                        />
                      </button>
                    )}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {displayTab === 'csi_specs' && (
        <CsiMappingTab projectId={projectId} />
      )}

      {displayTab === 'estimate' && (
        <ProjectEstimateTab projectId={projectId} />
      )}

      {displayTab === 'team' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Team Members</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Manage who has access to this project and their permission levels.
          </p>

          <div className="flex gap-3 mb-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex-1">
              <select 
                value={newMemberId}
                onChange={e => setNewMemberId(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium"
              >
                <option value="">Select a user...</option>
                {allUsers?.filter(u => !teamMembers?.find(m => m.user_id === u.id)).map(user => (
                  <option key={user.id} value={user.id}>{user.name ? `${user.name} (${user.email})` : user.email}</option>
                ))}
              </select>
            </div>
            <div className="w-48">
              <select 
                value={newMemberRole}
                onChange={e => setNewMemberRole(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium"
              >
                <option value="viewer">Viewer</option>
                <option value="design_team">Design Team</option>
                <option value="gc_admin">GC Admin</option>
                <option value="project_admin">Project Admin</option>
              </select>
            </div>
            <button 
              onClick={() => {
                if (newMemberId) {
                  addMemberMutation.mutate({ userId: newMemberId, role: newMemberRole }, {
                    onSuccess: () => setNewMemberId('')
                  });
                }
              }}
              disabled={!newMemberId || addMemberMutation.isPending}
              className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Plus size={18} /> Add Member
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">User</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 w-48">Role</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {teamMembers?.map(member => {
                  const isSelf = member.user_id === session?.user?.id;
                  return (
                    <tr key={member.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        {member.name ? (
                          <div className="flex flex-col">
                            <div className="text-slate-700 dark:text-slate-300 font-medium">
                              {member.name} {isSelf && <span className="ml-2 text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 px-2 py-0.5 rounded-full">You</span>}
                            </div>
                            <div className="text-xs text-slate-500">{member.email}</div>
                          </div>
                        ) : (
                          <div className="text-slate-700 dark:text-slate-300">
                            {member.email} {isSelf && <span className="ml-2 text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 px-2 py-0.5 rounded-full">You</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          value={member.role}
                          onChange={e => updateRoleMutation.mutate({ userId: member.user_id, role: e.target.value })}
                          disabled={(!isPlatformAdmin && isSelf) || updateRoleMutation.isPending}
                          className="bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-0 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="design_team">Design Team</option>
                          <option value="gc_admin">GC Admin</option>
                          <option value="project_admin">Project Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isSelf && (
                          <button 
                            onClick={() => removeMemberMutation.mutate(member.user_id)}
                            disabled={removeMemberMutation.isPending}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1.5 rounded-md transition-colors disabled:opacity-50"
                            title="Remove"
                          >
                            <X size={16} strokeWidth={2.5} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {teamMembers?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No team members assigned.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {displayTab === 'permits' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Permit Types</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Define the categories of permits (e.g. Building, Electrical).
            </p>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newPermitType} 
                onChange={(e) => setNewPermitType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPermitType()}
                placeholder="e.g. Electrical" 
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
              />
              <button 
                onClick={addPermitType} 
                disabled={!newPermitType.trim()}
                className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <Plus size={16} /> Add Type
              </button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndPermitTypes}>
              <SortableContext items={permitTypes.map(d => d.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {permitTypes.map(type => (
                    <SortableItem 
                      key={type.id} 
                      id={type.id} 
                      content={type.label}
                      onRemove={() => {
                        setPermitTypes(permitTypes.filter(d => d.id !== type.id));
                        setHasChanges(true);
                      }}
                    />
                  ))}
                  {permitTypes.length === 0 && (
                    <div className="text-center p-6 text-sm text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No Permit Types defined. Add one above.
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Authorities Having Jurisdiction (AHJ)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Define the governing bodies that issue permits.
            </p>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newPermitAHJ} 
                onChange={(e) => setNewPermitAHJ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPermitAHJ()}
                placeholder="e.g. City Building Department" 
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
              />
              <button 
                onClick={addPermitAHJ} 
                disabled={!newPermitAHJ.trim()}
                className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <Plus size={16} /> Add AHJ
              </button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndPermitAHJs}>
              <SortableContext items={permitAHJs.map(d => d.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {permitAHJs.map(ahj => (
                    <SortableItem 
                      key={ahj.id} 
                      id={ahj.id} 
                      content={ahj.label}
                      onRemove={() => {
                        setPermitAHJs(permitAHJs.filter(d => d.id !== ahj.id));
                        setHasChanges(true);
                      }}
                    />
                  ))}
                  {permitAHJs.length === 0 && (
                    <div className="text-center p-6 text-sm text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No AHJs defined. Add one above.
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      {displayTab === 'packages' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Package Scopes</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Define scope labels to organize VE packages by category (e.g., &quot;Interior&quot;, &quot;Exterior&quot;, &quot;MEP&quot;).
              Scopes are used in the Scenario Planner to group and filter packages.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
              To manage package scopes, use the <strong>&quot;Manage Scopes&quot;</strong> button in the Scenario Planner view.
            </p>
          </div>
        </div>
      )}
        </div>
      </div>

      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-800 border border-slate-700 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-6 z-[100]"
          >
            <div className="flex items-center gap-3 text-white">
               <AlertTriangle size={20} className="text-amber-500" />
               <div className="flex flex-col">
                 <span className="text-sm font-bold">Unsaved changes</span>
                 <span className="text-xs text-slate-400">Please save or discard to continue.</span>
               </div>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <button 
                onClick={resetSettings}
                disabled={updateSettings.isPending}
                className="px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button 
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {updateSettings.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                {updateSettings.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
