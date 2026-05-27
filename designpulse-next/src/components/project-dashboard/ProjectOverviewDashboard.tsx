"use client";
import React, { useMemo, useCallback } from 'react';
import { Gauge } from 'lucide-react';
import { useUIStore, type DashboardWidgetId } from '@/stores/useUIStore';
import { useOpportunities, useAllProjectOptions, usePendingEstimateUpdates } from '@/hooks/useOpportunityQueries';
import { useEffectiveBudget } from '@/hooks/useEffectiveBudget';
import { useDeliverables } from '@/hooks/useDeliverableQueries';
import { usePermits } from '@/hooks/usePermitQueries';
import { useUnifiedTimeline } from '@/hooks/useTimelineQueries';
import { calculateBudgetMetrics } from '@/utils/financialMath';
import type { TimelineEvent } from '@/types/models';

import { BudgetHealthStrip } from './BudgetHealthStrip';
import { VEStatusDonut } from './VEStatusDonut';
import { CoordinationProgress } from './CoordinationProgress';
import { DeliverablePermitSummary } from './DeliverablePermitSummary';
import { TopExposureItems } from './TopExposureItems';
import { UpcomingTimeline } from './UpcomingTimeline';
import { DashboardWidgetConfigMenu, DEFAULT_WIDGET_VISIBILITY } from './DashboardWidgetConfigMenu';

// ── Module-level stable fallbacks (Rule 47) ──────────────────────────────────
const EMPTY_ARRAY: never[] = [];
const EMPTY_VISIBILITY: Record<string, boolean> = {};

// ── Props ────────────────────────────────────────────────────────────────────
interface ProjectOverviewDashboardProps {
  projectId: string;
}

// ── Component ────────────────────────────────────────────────────────────────
export const ProjectOverviewDashboard = React.memo(function ProjectOverviewDashboard({
  projectId,
}: ProjectOverviewDashboardProps) {
  // ── Data hooks (Rule 24: called once in parent, data passed via props) ───
  const { data: opportunities = EMPTY_ARRAY } = useOpportunities(projectId);
  const { data: allOptions = EMPTY_ARRAY } = useAllProjectOptions(projectId);
  const { data: pendingUpdates = EMPTY_ARRAY } = usePendingEstimateUpdates(projectId);
  const { data: deliverables = EMPTY_ARRAY } = useDeliverables(projectId);
  const { data: permits = EMPTY_ARRAY } = usePermits(projectId);
  const { data: timeline = EMPTY_ARRAY } = useUnifiedTimeline(projectId);

  // Effective budget: settings.original_budget > 0 ? settings : active estimate version fallback
  const { effectiveBudget: originalBudget, revisedBudget } = useEffectiveBudget(projectId);

  // ── Zustand selectors (stable references per Rule 47) ──────────────────
  const dashboardWidgetVisibility = useUIStore((s) => s.dashboardWidgetVisibility) || EMPTY_VISIBILITY;
  const setActiveView = useUIStore((s) => s.setActiveView);
  const setSelectedOpportunityId = useUIStore((s) => s.setSelectedOpportunityId);

  // ── Widget visibility helper ───────────────────────────────────────────
  const isVisible = useCallback(
    (id: DashboardWidgetId): boolean =>
      dashboardWidgetVisibility[id] ?? DEFAULT_WIDGET_VISIBILITY[id],
    [dashboardWidgetVisibility],
  );

  // ── Derived data (computed once, shared across widgets) ────────────────
  const budgetMetrics = useMemo(
    () => calculateBudgetMetrics(opportunities, allOptions, originalBudget),
    [opportunities, allOptions, originalBudget],
  );

  const pendingIncorporationCount = pendingUpdates.length;
  const pendingIncorporationValue = useMemo(
    () => pendingUpdates.reduce((sum, opp) => sum + (Number(opp.cost_impact) || 0), 0),
    [pendingUpdates],
  );

  // ── Click-through navigation handlers ──────────────────────────────────
  const handleDonutSegmentClick = useCallback(
    (status: string) => {
      // Seed URL params via replaceState, NOT useURLFilters (Rule 48)
      const params = new URLSearchParams(window.location.search);
      params.set('ve.status', status);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      setActiveView(projectId, 'dashboard');
    },
    [projectId, setActiveView],
  );

  const handleCoordClick = useCallback(
    () => setActiveView(projectId, 'coordination'),
    [projectId, setActiveView],
  );

  const handleDeliverablesClick = useCallback(
    () => setActiveView(projectId, 'deliverables'),
    [projectId, setActiveView],
  );

  const handlePermitsClick = useCallback(
    () => setActiveView(projectId, 'permits'),
    [projectId, setActiveView],
  );

  const handleExposureRowClick = useCallback(
    (opportunityId: string) => {
      setSelectedOpportunityId(opportunityId);
      setActiveView(projectId, 'dashboard');
    },
    [projectId, setActiveView, setSelectedOpportunityId],
  );

  const handleTimelineEventClick = useCallback(
    (event: TimelineEvent) => {
      const viewMap: Record<string, 'key-dates' | 'deliverables' | 'permits'> = {
        key_date: 'key-dates',
        deliverable: 'deliverables',
        permit: 'permits',
      };
      const targetView = viewMap[event.source_type] || 'key-dates';
      setActiveView(projectId, targetView);
    },
    [projectId, setActiveView],
  );

  // ── Row visibility calculations ────────────────────────────────────────
  const row1Visible = isVisible('budget-health');

  const veDonutVisible = isVisible('ve-status-donut');
  const coordVisible = isVisible('coordination-progress');
  const delivPermitVisible = isVisible('deliverable-permit-summary');
  const row2Visible = veDonutVisible || coordVisible || delivPermitVisible;
  const row2Count = [veDonutVisible, coordVisible, delivPermitVisible].filter(Boolean).length;
  const row2Cols = row2Count === 3 ? 'grid-cols-3' : row2Count === 2 ? 'grid-cols-2' : 'grid-cols-1';

  const exposureVisible = isVisible('top-exposure-items');
  const timelineVisible = isVisible('upcoming-timeline');
  const row3Visible = exposureVisible || timelineVisible;
  const row3Count = [exposureVisible, timelineVisible].filter(Boolean).length;
  const row3Cols = row3Count === 2 ? 'grid-cols-2' : 'grid-cols-1';

  const anyVisible = row1Visible || row2Visible || row3Visible;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-auto min-h-0 p-6 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
            <Gauge size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Project Overview
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              At-a-glance summary of decisions, budget, and timelines
            </p>
          </div>
        </div>
        <DashboardWidgetConfigMenu />
      </div>

      {/* All widgets hidden empty state */}
      {!anyVisible && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <Gauge size={32} className="opacity-50" />
          <p className="text-sm font-medium">All widgets hidden</p>
          <p className="text-xs">Use the ⚙️ Customize menu to restore widgets.</p>
        </div>
      )}

      {/* Row 1: Budget Health */}
      {row1Visible && (
        <BudgetHealthStrip
          originalBudget={originalBudget}
          revisedBudget={revisedBudget}
          metrics={budgetMetrics}
          pendingIncorporationCount={pendingIncorporationCount}
          pendingIncorporationValue={pendingIncorporationValue}
        />
      )}

      {/* Row 2: Decision & Coordination Progress */}
      {row2Visible && (
        <div className={`grid ${row2Cols} gap-5`}>
          {veDonutVisible && (
            <VEStatusDonut
              opportunities={opportunities}
              onSegmentClick={handleDonutSegmentClick}
            />
          )}
          {coordVisible && (
            <CoordinationProgress
              opportunities={opportunities}
              onClick={handleCoordClick}
            />
          )}
          {delivPermitVisible && (
            <DeliverablePermitSummary
              deliverables={deliverables}
              permits={permits}
              onDeliverablesClick={handleDeliverablesClick}
              onPermitsClick={handlePermitsClick}
            />
          )}
        </div>
      )}

      {/* Row 3: Attention Required */}
      {row3Visible && (
        <div className={`grid ${row3Cols} gap-5`}>
          {exposureVisible && (
            <TopExposureItems
              opportunities={opportunities}
              allOptions={allOptions}
              onRowClick={handleExposureRowClick}
            />
          )}
          {timelineVisible && (
            <UpcomingTimeline
              timeline={timeline}
              onEventClick={handleTimelineEventClick}
            />
          )}
        </div>
      )}
    </div>
  );
});
