"use client";
import { useMemo } from 'react';
import { Opportunity } from '@/types/models';
import VarianceWaterfallChart from './VarianceWaterfallChart';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useOwnerROIMetrics } from '@/hooks/useProjectQueries';

interface Props {
  projectId: string;
  opportunities: Opportunity[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function OwnerDashboard({ projectId, opportunities }: Props) {
  // KPI: Average Age of Pending Items
  const avgPendingDays = useMemo(() => {
    const pendingOpps = opportunities.filter(o => o.status === 'Pending Review');
    if (pendingOpps.length === 0) return 0;

    const now = new Date().getTime();
    const totalDays = pendingOpps.reduce((sum, opp) => {
      const created = opp.created_at ? new Date(opp.created_at).getTime() : now;
      const diffTime = Math.abs(now - created);
      return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(totalDays / pendingOpps.length);
  }, [opportunities]);

  // Hook into the new RPC Aggregation
  const { data: roiMetrics, isLoading: isRoiLoading } = useOwnerROIMetrics(projectId);

  // Pie Chart: ROI Distribution
  const pieData = useMemo(() => {
    if (!roiMetrics) return [];
    return roiMetrics.map((m: any) => {
      const savings = Number(m.total_savings);
      return {
        name: m.scope,
        rawValue: savings, // Absolute positive savings from RPC
        value: savings
      };
    }).sort((a: any, b: any) => b.value - a.value);
  }, [roiMetrics]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-lg">
          <p className="font-bold text-slate-800 dark:text-slate-100">{data.name}</p>
          <p className="text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            Savings: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(data.rawValue)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* Top Left: KPI */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-center items-center h-80">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">Avg Age of Pending Items</h3>
        <div className="text-6xl font-black text-slate-800 dark:text-slate-100 mb-2">{avgPendingDays}</div>
        <p className="text-sm text-slate-400 mt-2">Days spent in 'Pending Review'</p>
      </div>

      {/* Top Right: ROI Pie Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm h-80 flex flex-col">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">ROI Distribution (Savings by Scope)</h3>
        {isRoiLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
          </div>
        ) : pieData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No approved savings logged yet.</div>
        ) : (
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom: Variance Waterfall */}
      <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Trade Variance Waterfall</h3>
        <VarianceWaterfallChart projectId={projectId} opportunities={opportunities} />
      </div>

    </div>
  );
}
