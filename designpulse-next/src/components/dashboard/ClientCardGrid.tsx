import Link from 'next/link';
import { Users, ArrowRight, Briefcase } from 'lucide-react';
import { Client } from '@/types/models';

interface ClientCardGridProps {
  clients: Client[];
}

export default function ClientCardGrid({ clients }: ClientCardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
      {clients.map(client => (
        <Link key={client.id} href={`/clients/${client.id}`}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:shadow-lg hover:border-sky-300 dark:hover:border-sky-700 transition-all group cursor-pointer h-full flex flex-col relative overflow-hidden">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex items-start justify-between mb-4">
              <div className="bg-slate-100 dark:bg-slate-800 p-3.5 rounded-xl text-slate-600 dark:text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-500 transition-colors">
                <Briefcase size={26} strokeWidth={1.5} />
              </div>
              <ArrowRight className="text-slate-300 dark:text-slate-600 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" size={22} />
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1" title={client.name}>
              {client.name}
            </h3>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
              {client.description || 'No description provided.'}
            </p>
            
            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/50">
              {client.primary_contact_name && (
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Users size={14} />
                  <span>{client.primary_contact_name}</span>
                </div>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
