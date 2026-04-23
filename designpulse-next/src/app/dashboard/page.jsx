"use client";
import React from 'react';
import Link from 'next/link';
import { Building2, Plus, ArrowRight } from 'lucide-react';
import { useProjects, useCreateProject } from '@/hooks/useProjectQueries';

export default function DashboardPage() {
  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();

  // Helper to instantly generate new test projects
  const handleCreateTestProject = () => {
    const randomNum = Math.floor(Math.random() * 1000);
    createProject.mutate({
      name: `Sandbox Project ${randomNum}`,
      description: 'Local development testing environment.'
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Design Pulse Projects</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Select a project to view its VE tracker and interactive floor plans.
          </p>
        </div>
        <button
          onClick={handleCreateTestProject}
          disabled={createProject.isPending}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50"
        >
          <Plus size={20} />
          {createProject.isPending ? 'Creating...' : 'New Test Project'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Loading projects...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
          {projects.map(project => (
            <Link key={project.id} href={`/project/${project.id}`}>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:shadow-lg hover:border-sky-300 dark:hover:border-sky-700 transition-all group cursor-pointer h-full flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <div className="bg-sky-100 dark:bg-sky-900/30 p-3.5 rounded-xl text-sky-600 dark:text-sky-400">
                    <Building2 size={26} strokeWidth={1.5} />
                  </div>
                  <ArrowRight className="text-slate-300 dark:text-slate-600 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" size={22} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">
                  {project.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-auto line-clamp-2">
                  {project.description || 'No description provided.'}
                </p>
              </div>
            </Link>
          ))}
          
          {/* Empty State Fallback */}
          {projects.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <Building2 size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 mb-4 text-lg">No projects found.</p>
              <button 
                onClick={handleCreateTestProject} 
                className="text-sky-500 font-bold hover:underline"
              >
                Spin up your first sandbox project
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
