"use client";
import { Building2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ClientProjectsMetrics } from '@/types/models';

interface ClientProjectsTabProps {
  metrics: ClientProjectsMetrics[];
  isLoading: boolean;
}

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function ClientProjectsTab({ metrics, isLoading }: ClientProjectsTabProps) {
  if (isLoading) {
    return (
      <div className="animate-in fade-in space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 animate-pulse">
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
            <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} className="text-slate-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-semibold mb-2">No Projects Linked</p>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Assign this client to a project in the project&apos;s Settings → Info → Client Association dropdown.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            {metrics.length} Linked Project{metrics.length !== 1 ? 's' : ''}
          </h3>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Total Budget: {currencyFmt.format(metrics.reduce((s, p) => s + (p.original_budget || 0), 0))}
          </div>
        </div>
      </div>

      {metrics.map(proj => (
        <Link key={proj.project_id} href={`/project/${proj.project_id}`} className="block group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm group-hover:border-sky-300 dark:group-hover:border-sky-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 group-hover:text-sky-500 transition-colors">
                  {proj.name}
                </h3>
                <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  proj.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {proj.status || 'active'}
                </span>
              </div>
              <ExternalLink size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Budget</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  {currencyFmt.format(proj.original_budget || 0)}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Locked Variance</p>
                <p className={`text-sm font-bold tabular-nums ${
                  proj.locked_variance < 0 ? 'text-emerald-500' : proj.locked_variance > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'
                }`}>
                  {currencyFmt.format(proj.locked_variance || 0)}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Exposure</p>
                <p className={`text-sm font-bold tabular-nums ${
                  proj.potential_exposure < 0 ? 'text-emerald-500' : proj.potential_exposure > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'
                }`}>
                  {currencyFmt.format(proj.potential_exposure || 0)}
                </p>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
