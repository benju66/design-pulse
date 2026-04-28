"use client";
import { useMemo } from 'react';
import { Opportunity } from '@/types/models';
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, PolarAngleAxis, Tooltip } from 'recharts';
import { useDesignCompletionMetrics, useProjectSettings } from '@/hooks/useProjectQueries';

interface Props {
  projectId: string;
  opportunities: Opportunity[];
}

// Fallback color palette if project settings lack colors
const COLOR_PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function DesignDashboard({ projectId, opportunities }: Props) {
  // We still calculate the local lists for the sidebar list UI
  const lockedStatuses = ['Approved'];
  const lockedOpps = useMemo(() => opportunities.filter(o => {
    if (o.record_type === 'Coordination') return true;
    if (o.record_type === 'VE' && o.status && lockedStatuses.includes(o.status)) return true;
    return false;
  }), [opportunities]);
  const totalLockedItems = lockedOpps.length;

  const pendingPlanUpdates = useMemo(() => {
    return lockedOpps.filter(o => o.coordination_status === 'Pending Plan Update');
  }, [lockedOpps]);

  // Hook into the new RPC Aggregations
  const { data: metrics, isLoading } = useDesignCompletionMetrics(projectId);
  const { data: settings } = useProjectSettings(projectId);

  // Dynamic Radial Bar Chart: Discipline Completion
  const disciplineData = useMemo(() => {
    if (!metrics) return [];

    const rawDisciplines = settings?.disciplines || [];
    const disciplines = Array.isArray(rawDisciplines) 
      ? rawDisciplines.map((d: any, i) => 
          typeof d === 'string' 
            ? { id: `d_${d.toLowerCase().replace(/\s+/g, '_')}`, label: d, color: COLOR_PALETTE[i % COLOR_PALETTE.length] } 
            : { ...d, color: d.color || COLOR_PALETTE[i % COLOR_PALETTE.length] }
        )
      : [];

    // Filter RPC response to only 'Complete' status
    const completeMetrics = metrics.filter((m: any) => m.status === 'Complete');

    return disciplines.map(disc => {
      const match = completeMetrics.find((m: any) => m.discipline_id === disc.id);
      return {
        name: `${disc.label} Completion`,
        count: match ? Number(match.count) : 0,
        fill: disc.color
      };
    }).filter(d => d.count > 0); // Hide disciplines with 0 tasks to keep the chart clean
  }, [metrics, settings]);

  const CustomRadialTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const pct = totalLockedItems > 0 ? Math.round((data.count / totalLockedItems) * 100) : 0;
      return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg shadow-lg">
          <p className="font-bold text-slate-800 dark:text-slate-100">{data.name}</p>
          <p className="text-slate-500 text-sm mt-1">{data.count} / {totalLockedItems} ({pct}%)</p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <ul className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <li key={`item-${index}`} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
            {entry.value}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
      
      {/* Left: Discipline Completion Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm h-[400px] flex flex-col">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Discipline Sign-off Completion</h3>
        <p className="text-xs text-slate-400 mb-4">Total Locked Items: {totalLockedItems}</p>
        
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
          </div>
        ) : totalLockedItems === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No locked items found.</div>
        ) : (
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart 
                cx="50%" 
                cy="50%" 
                innerRadius="20%" 
                outerRadius="100%" 
                barSize={20} 
                data={disciplineData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, totalLockedItems]} angleAxisId={0} tick={false} />
                <RadialBar
                  background
                  dataKey="count"
                  cornerRadius={10}
                />
                <Tooltip content={<CustomRadialTooltip />} />
                <Legend iconSize={10} content={renderLegend} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Right: Pending Plan Updates List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm h-[400px] flex flex-col">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex justify-between items-center">
          <span>Action Required: Pending Plan Updates</span>
          <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full text-xs font-bold">
            {pendingPlanUpdates.length}
          </span>
        </h3>
        
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {pendingPlanUpdates.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">All caught up! No pending plan updates.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingPlanUpdates.map((opp) => (
                <div key={opp.id} className="border border-slate-200 dark:border-slate-700/50 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                        {opp.display_id || 'VE-000'}
                      </span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {opp.title}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {opp.location && <span className="mr-3">📍 {opp.location}</span>}
                      {opp.cost_code && <span>{opp.cost_code}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Due Date</div>
                    <div className={`text-sm font-medium ${opp.due_date ? 'text-rose-500' : 'text-slate-500'}`}>
                      {opp.due_date || 'Not Set'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
