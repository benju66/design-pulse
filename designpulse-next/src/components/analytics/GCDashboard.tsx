"use client";
import { useMemo } from 'react';
import { Opportunity } from '@/types/models';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { useGCBottleneckMetrics } from '@/hooks/useProjectQueries';

interface Props {
  projectId: string;
  opportunities: Opportunity[];
}

const COLORS = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#94a3b8'];

export default function GCDashboard({ projectId, opportunities }: Props) {
  const unlockedStatuses = ['Draft', 'Pending Review'];
  const unlockedOpps = useMemo(() => opportunities.filter(o => o.status && unlockedStatuses.includes(o.status)), [opportunities]);

  // KPI: Schedule Risk Exposure
  const scheduleRiskDays = useMemo(() => {
    return unlockedOpps.reduce((sum, opp) => sum + (Number(opp.days_impact) || 0), 0);
  }, [unlockedOpps]);

  // Hook into the new RPC Aggregation
  const { data: bottleneckMetrics, isLoading: isBottleneckLoading } = useGCBottleneckMetrics(projectId);

  // Bar Chart: Bottleneck by Assignee
  const bottleneckData = useMemo(() => {
    if (!bottleneckMetrics) return [];
    return bottleneckMetrics.map((m: any) => ({
      name: m.assignee,
      count: Number(m.pending_count)
    })).sort((a: any, b: any) => b.count - a.count);
  }, [bottleneckMetrics]);

  // Trade Heatmap
  const tradeHeatmap = useMemo(() => {
    const tradeMap = unlockedOpps.reduce((acc, opp) => {
      const code = opp.cost_code || 'Uncategorized';
      if (!acc[code]) acc[code] = 0;
      acc[code] += 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(tradeMap)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  }, [unlockedOpps]);

  const maxTradeVolume = tradeHeatmap.length > 0 ? tradeHeatmap[0].count : 1;

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-lg">
          <p className="font-bold text-slate-800 dark:text-slate-100">{data.name}</p>
          <p className="text-sky-600 dark:text-sky-400 font-medium mt-1">Pending Items: {data.count}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      {/* Top Left: KPI */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-center items-center h-48 xl:col-span-1">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Schedule Risk Exposure</h3>
        <div className={`text-6xl font-black ${scheduleRiskDays > 0 ? 'text-rose-600 dark:text-rose-500' : 'text-slate-800 dark:text-slate-100'}`}>
          {scheduleRiskDays}
        </div>
        <p className="text-sm text-slate-400 mt-2">Days of float at risk (Unlocked items)</p>
      </div>

      {/* Trade Coordination Heatmap */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm h-80 xl:col-span-2 overflow-y-auto">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Trade Coordination Heatmap</h3>
        <div className="flex flex-col gap-3">
          {tradeHeatmap.length === 0 ? (
            <div className="text-slate-400 text-sm py-4">No active unlocked items.</div>
          ) : (
            tradeHeatmap.map((trade) => (
              <div key={trade.code} className="flex items-center w-full">
                <div className="w-[30%] pr-4 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                  {trade.code}
                </div>
                <div className="w-[60%] relative h-6 bg-slate-50 dark:bg-slate-800/50 rounded flex items-center">
                  <div 
                    className="absolute left-0 h-full bg-rose-500 dark:bg-rose-600 rounded transition-all duration-500 ease-out"
                    style={{ width: `${(trade.count / maxTradeVolume) * 100}%`, opacity: 0.5 + (trade.count / maxTradeVolume) * 0.5 }}
                  />
                </div>
                <div className="w-[10%] pl-4 text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
                  {trade.count}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom: Bottleneck Bar Chart */}
      <div className="xl:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm h-96 flex flex-col">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Bottleneck Analysis (Pending Items by Assignee)</h3>
        {isBottleneckLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
          </div>
        ) : bottleneckData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No pending items found.</div>
        ) : (
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={bottleneckData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={40}>
                  {bottleneckData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Unassigned' ? '#ef4444' : COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

    </div>
  );
}
