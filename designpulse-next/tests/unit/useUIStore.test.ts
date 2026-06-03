import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore, isCoordViewMode } from '@/stores/useUIStore';
import { useMapStore } from '@/stores/useMapStore';

// ---------------------------------------------------------------------------
// Reset store state between tests so they don't leak
// ---------------------------------------------------------------------------
beforeEach(() => {
  // Reset UIStore to initial state by calling setState with defaults
  useUIStore.setState({
    selectedOpportunityId: null,
    coordinationViewMode: 'table-split',
    veGridViewMode: 'split',
    permitViewMode: 'table-split',
    drawingGridViewMode: 'split',
    lessonsViewMode: 'split',
    deliverablesViewMode: 'table-split',
    keyDatesViewMode: 'table',
    dashboardViewMode: 'card',
    gridMode: 'navigate',
    isCoordGroupingEnabled: false,
    activeView: {},
    activeSettingsTab: {},
    permitFilters: {},
    coordGroupCollapsed: {},
    isBudgetSummaryCollapsed: false,
    isCoordSummaryCollapsed: false,
    isPermitSummaryCollapsed: false,
    isSandboxPanelOpen: false,
    isFilterLinkingEnabled: true,
    globalBuildingAreas: [],
    globalCostCodes: [],
    dashboardWidgetVisibility: {},
  });
});

// ===========================================================================
// isCoordViewMode guard function
// ===========================================================================

describe('isCoordViewMode', () => {
  it('returns true for valid coordination view modes', () => {
    expect(isCoordViewMode('board')).toBe(true);
    expect(isCoordViewMode('table-split')).toBe(true);
  });

  it('returns false for invalid strings', () => {
    expect(isCoordViewMode('kanban')).toBe(false);
    expect(isCoordViewMode('grid')).toBe(false);
    expect(isCoordViewMode('')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isCoordViewMode(undefined)).toBe(false);
  });
});

// ===========================================================================
// FLAT view modes — should be user-wide, NOT scoped per project
// ===========================================================================

describe('Flat view modes (user-wide, not per-project)', () => {
  it('coordinationViewMode is a flat string, not a Record', () => {
    const state = useUIStore.getState();
    expect(typeof state.coordinationViewMode).toBe('string');
    expect(state.coordinationViewMode).toBe('table-split');
  });

  it('veGridViewMode is a flat string', () => {
    const state = useUIStore.getState();
    expect(typeof state.veGridViewMode).toBe('string');
    expect(state.veGridViewMode).toBe('split');
  });

  it('setting coordinationViewMode persists globally', () => {
    useUIStore.getState().setCoordinationViewMode('board');
    expect(useUIStore.getState().coordinationViewMode).toBe('board');

    // A second call to setCoordinationViewMode does NOT need a projectId
    useUIStore.getState().setCoordinationViewMode('table-split');
    expect(useUIStore.getState().coordinationViewMode).toBe('table-split');
  });

  it('permitViewMode is a flat string', () => {
    useUIStore.getState().setPermitViewMode('board');
    expect(useUIStore.getState().permitViewMode).toBe('board');
  });

  it('dashboardViewMode is a flat string', () => {
    useUIStore.getState().setDashboardViewMode('table');
    expect(useUIStore.getState().dashboardViewMode).toBe('table');
  });
});

// ===========================================================================
// PER-PROJECT state — should be scoped by projectId
// ===========================================================================

describe('Per-project state (Record<projectId, value>)', () => {
  const PROJECT_A = 'proj-aaa';
  const PROJECT_B = 'proj-bbb';

  it('activeView stores independent views per project', () => {
    useUIStore.getState().setActiveView(PROJECT_A, 'dashboard');
    useUIStore.getState().setActiveView(PROJECT_B, 'coordination');

    const state = useUIStore.getState();
    expect(state.activeView[PROJECT_A]).toBe('dashboard');
    expect(state.activeView[PROJECT_B]).toBe('coordination');
  });

  it('setting activeView for one project does not affect another', () => {
    useUIStore.getState().setActiveView(PROJECT_A, 'analytics');
    useUIStore.getState().setActiveView(PROJECT_B, 'map');

    useUIStore.getState().setActiveView(PROJECT_A, 'permits');

    expect(useUIStore.getState().activeView[PROJECT_A]).toBe('permits');
    expect(useUIStore.getState().activeView[PROJECT_B]).toBe('map');
  });

  it('permitFilters are scoped per project', () => {
    useUIStore.getState().setPermitFilters(PROJECT_A, { status: ['Active'] });
    useUIStore.getState().setPermitFilters(PROJECT_B, { type: ['Building'] });

    const state = useUIStore.getState();
    expect(state.permitFilters[PROJECT_A]).toEqual({ status: ['Active'] });
    expect(state.permitFilters[PROJECT_B]).toEqual({ type: ['Building'] });
  });

  it('activeSettingsTab is scoped per project', () => {
    useUIStore.getState().setActiveSettingsTab(PROJECT_A, 'team');
    useUIStore.getState().setActiveSettingsTab(PROJECT_B, 'estimate');

    const state = useUIStore.getState();
    expect(state.activeSettingsTab[PROJECT_A]).toBe('team');
    expect(state.activeSettingsTab[PROJECT_B]).toBe('estimate');
  });
});

// ===========================================================================
// navigateToSettings — compound atomic action
// ===========================================================================

describe('navigateToSettings compound action', () => {
  it('sets both activeView and activeSettingsTab in a single call', () => {
    const projectId = 'proj-compound';
    useUIStore.getState().navigateToSettings(projectId, 'csi_specs');

    const state = useUIStore.getState();
    expect(state.activeView[projectId]).toBe('settings');
    expect(state.activeSettingsTab[projectId]).toBe('csi_specs');
  });
});

// ===========================================================================
// Coordination Groups — per-project collapse state
// ===========================================================================

describe('Coordination group collapse state', () => {
  const PROJECT = 'proj-groups';

  it('toggleCoordGroupCollapsed adds and removes group IDs', () => {
    useUIStore.getState().toggleCoordGroupCollapsed(PROJECT, 'group-1');
    expect(useUIStore.getState().coordGroupCollapsed[PROJECT]).toContain('group-1');

    // Toggle again to remove
    useUIStore.getState().toggleCoordGroupCollapsed(PROJECT, 'group-1');
    expect(useUIStore.getState().coordGroupCollapsed[PROJECT]).not.toContain('group-1');
  });

  it('collapseAllCoordGroups sets all group IDs', () => {
    useUIStore.getState().collapseAllCoordGroups(PROJECT, ['g1', 'g2', 'g3']);
    expect(useUIStore.getState().coordGroupCollapsed[PROJECT]).toEqual(['g1', 'g2', 'g3']);
  });

  it('expandAllCoordGroups clears to empty array', () => {
    useUIStore.getState().collapseAllCoordGroups(PROJECT, ['g1', 'g2']);
    useUIStore.getState().expandAllCoordGroups(PROJECT);
    expect(useUIStore.getState().coordGroupCollapsed[PROJECT]).toEqual([]);
  });
});

// ===========================================================================
// Toggle patterns
// ===========================================================================

describe('Toggle patterns', () => {
  it('toggleBudgetSummary flips the collapsed state', () => {
    expect(useUIStore.getState().isBudgetSummaryCollapsed).toBe(false);
    useUIStore.getState().toggleBudgetSummary();
    expect(useUIStore.getState().isBudgetSummaryCollapsed).toBe(true);
    useUIStore.getState().toggleBudgetSummary();
    expect(useUIStore.getState().isBudgetSummaryCollapsed).toBe(false);
  });

  it('toggleCoordGrouping flips the grouping state', () => {
    expect(useUIStore.getState().isCoordGroupingEnabled).toBe(false);
    useUIStore.getState().toggleCoordGrouping();
    expect(useUIStore.getState().isCoordGroupingEnabled).toBe(true);
  });

  it('toggleSandboxPanel flips open state', () => {
    expect(useUIStore.getState().isSandboxPanelOpen).toBe(false);
    useUIStore.getState().toggleSandboxPanel();
    expect(useUIStore.getState().isSandboxPanelOpen).toBe(true);
  });

  it('toggleDashboardWidget defaults to visible then hides', () => {
    // Default is undefined (treated as visible by the ?? true pattern)
    const pre = useUIStore.getState().dashboardWidgetVisibility['budget-health'];
    expect(pre).toBeUndefined();

    useUIStore.getState().toggleDashboardWidget('budget-health');
    // First toggle: !(undefined ?? true) → false
    expect(useUIStore.getState().dashboardWidgetVisibility['budget-health']).toBe(false);

    useUIStore.getState().toggleDashboardWidget('budget-health');
    // Second toggle: !(false) → true
    expect(useUIStore.getState().dashboardWidgetVisibility['budget-health']).toBe(true);
  });
});

// ===========================================================================
// Cross-store sync — setSelectedOpportunityId → useMapStore
// ===========================================================================

describe('Cross-store sync (UIStore → MapStore)', () => {
  it('setSelectedOpportunityId propagates to MapStore.setSelectedZoneIds', () => {
    const mapSpy = vi.spyOn(useMapStore.getState(), 'setSelectedZoneIds');

    useUIStore.getState().setSelectedOpportunityId('opp-123');

    expect(useUIStore.getState().selectedOpportunityId).toBe('opp-123');
    expect(mapSpy).toHaveBeenCalledWith(['opp-123']);

    mapSpy.mockRestore();
  });

  it('setting null clears MapStore selected zones', () => {
    // First set a value
    useUIStore.getState().setSelectedOpportunityId('opp-456');

    const clearSpy = vi.spyOn(useMapStore.getState(), 'clearSelectedZones');
    useUIStore.getState().setSelectedOpportunityId(null);

    expect(useUIStore.getState().selectedOpportunityId).toBeNull();
    expect(clearSpy).toHaveBeenCalled();

    clearSpy.mockRestore();
  });

  it('setting the same ID again is a no-op (early return guard)', () => {
    useUIStore.getState().setSelectedOpportunityId('opp-789');
    const mapSpy = vi.spyOn(useMapStore.getState(), 'setSelectedZoneIds');

    // Set same ID — should be skipped
    useUIStore.getState().setSelectedOpportunityId('opp-789');
    expect(mapSpy).not.toHaveBeenCalled();

    mapSpy.mockRestore();
  });
});

// ===========================================================================
// Column pinning overrides (per-project)
// ===========================================================================

describe('Column pinning overrides', () => {
  const PROJECT = 'proj-pins';

  it('toggleUserColumnPin adds to pinned array when isPinned=true', () => {
    useUIStore.getState().toggleUserColumnPin(PROJECT, 'cost_impact', true);
    const overrides = useUIStore.getState().gridColumnPinningOverrides[PROJECT];
    expect(overrides.pinned).toContain('cost_impact');
    expect(overrides.unpinned).not.toContain('cost_impact');
  });

  it('toggleUserColumnPin adds to unpinned array when isPinned=false', () => {
    useUIStore.getState().toggleUserColumnPin(PROJECT, 'status', false);
    const overrides = useUIStore.getState().gridColumnPinningOverrides[PROJECT];
    expect(overrides.unpinned).toContain('status');
  });

  it('clearUserColumnPinOverrides removes project overrides entirely', () => {
    useUIStore.getState().toggleUserColumnPin(PROJECT, 'col-a', true);
    expect(useUIStore.getState().gridColumnPinningOverrides[PROJECT]).toBeDefined();

    useUIStore.getState().clearUserColumnPinOverrides(PROJECT);
    expect(useUIStore.getState().gridColumnPinningOverrides[PROJECT]).toBeUndefined();
  });
});
