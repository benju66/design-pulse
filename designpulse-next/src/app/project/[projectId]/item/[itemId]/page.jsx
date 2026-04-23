"use client";
import React from 'react';
import { ExpandedCard } from '@/components/opportunities/ExpandedCard';
import { useOpportunity, useUpdateOpportunity } from '@/hooks/useProjectQueries';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ItemPopOutPage({ params }) {
  const resolvedParams = React.use(params);
  const { projectId, itemId } = resolvedParams;
  
  const { data: opportunity, isLoading } = useOpportunity(itemId);
  const updateData = useUpdateOpportunity(projectId);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
        Loading...
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
        Item not found.
      </div>
    );
  }

  const mockRow = { original: opportunity };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shrink-0">
        <h1 className="text-xl font-bold truncate pr-4 text-slate-900 dark:text-white">
          {opportunity.title || 'Untitled Opportunity'}
        </h1>
        <ThemeToggle />
      </div>
      <div className="flex-1 overflow-auto p-6 max-w-7xl mx-auto w-full">
        <div className="bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
            <div className="-m-4 border-none shadow-none bg-transparent">
              <ExpandedCard row={mockRow} updateData={updateData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
