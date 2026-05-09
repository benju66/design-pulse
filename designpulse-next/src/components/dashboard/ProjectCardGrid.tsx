import Link from 'next/link';
import { Building2, ArrowRight } from 'lucide-react';
import { Project } from '@/types/models';

interface ProjectCardGridProps {
  projects: Project[];
  isSuperAdmin?: boolean;
  onOpenCreateProject?: () => void;
}

export default function ProjectCardGrid({ projects, isSuperAdmin, onOpenCreateProject }: ProjectCardGridProps) {
  return (
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
            {project.project_number && (
              <div className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md w-fit mb-2">
                {project.project_number}
              </div>
            )}
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1" title={project.project_settings?.[0]?.project_name || project.name}>
              {project.project_settings?.[0]?.project_name || project.name}
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
          {isSuperAdmin && onOpenCreateProject && (
            <button 
              onClick={onOpenCreateProject} 
              className="text-sky-500 font-bold hover:underline"
            >
              Spin up your first sandbox project
            </button>
          )}
        </div>
      )}
    </div>
  );
}
