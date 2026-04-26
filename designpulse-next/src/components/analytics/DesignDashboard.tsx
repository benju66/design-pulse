"use client";
import { useMemo } from 'react';
import { Opportunity } from '@/types/models';
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, PolarAngleAxis, Tooltip } from 'recharts';

interface Props {
  projectId: string;
  opportunities: Opportunity[];
}

export default function DesignDashboard({ opportunities }: Props) {
  // Items in locked workflow phases where design coordination occurs
  const lockedStatuses = ['Pending Plan Update', 'In Drafting', 'GC / Owner Review', 'Implemented', 'Approved'];
  const lockedOpps = useMemo(() => opportunities.filter(o => o.status && lockedStatuses.includes(o.status)), [opportunities]);
  const totalLockedItems = lockedOpps.length;

  // Pending Plan Updates List
  const pendingPlanUpdates = useMemo(() => {
    return lockedOpps.filter(o => o.status === 'Pending Plan Update');
  }, [lockedOpps]);

  // Radial Bar Chart: Discipline Completion
  const disciplineData = useMemo(() => {
    let archCount = 0;
    let mepCount = 0;
    let strCount = 0;

    lockedOpps.forEach(opp => {
      const details = opp.coordination_details || {};
      if (details['d_arch']?.status === 'Complete') archCount++;
      if (details['d_mech']?.status === 'Complete' || details['d_elec']?.status === 'Complete' || details['d_plumb']?.status === 'Complete') mepCount++;
      if (details['d_struct']?.status === 'Complete') strCount++;
    });

    return [
      { name: 'STR Completion', count: strCount, fill: '#f59e0b' },
      { name: 'MEP Completion', count: mepCount, fill: '#3b82f6' },
      { name: 'ARCH Completion', count: archCount, fill: '#10b981' }
    ];
  }, [lockedOpps]);

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
      <ul className="flex justify-center gap-4 mt-4">
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
        
        {totalLockedItems === 0 ? (
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
                {/* Scaling Trap Fix */}
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
