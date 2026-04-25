"use client";
import { useState } from 'react';
import { Opportunity } from '@/types/models';
import OwnerDashboard from './OwnerDashboard';
import GCDashboard from './GCDashboard';
import DesignDashboard from './DesignDashboard';

interface Props {
  projectId: string;
  opportunities: Opportunity[];
}

type PersonaTab = 'Owner' | 'GC' | 'Design';

export default function AnalyticsDashboard({ projectId, opportunities }: Props) {
  const [activePersona, setActivePersona] = useState<PersonaTab>('Owner');

  const tabs: { id: PersonaTab; label: string }[] = [
    { id: 'Owner', label: 'Owner Financials' },
    { id: 'GC', label: 'GC Execution' },
    { id: 'Design', label: 'Design Coordination' }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 p-6 overflow-hidden">
      <div className="shrink-0 mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Project Analytics</h2>
          <p className="text-sm text-slate-500 mt-1">High-level reporting tailored by stakeholder persona.</p>
        </div>
        
        {/* Tailwind Segmented Control */}
        <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActivePersona(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
                activePersona === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        {activePersona === 'Owner' && <OwnerDashboard projectId={projectId} opportunities={opportunities} />}
        {activePersona === 'GC' && <GCDashboard projectId={projectId} opportunities={opportunities} />}
        {activePersona === 'Design' && <DesignDashboard projectId={projectId} opportunities={opportunities} />}
      </div>
    </div>
  );
}
