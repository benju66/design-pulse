"use client";
import React, { useState, useMemo } from 'react';
import { Search, Trash2, Upload, Building2, GitBranch, Cpu } from 'lucide-react';
import { ProjectCsiSpec, CostCode, UserPermissions } from '@/types/models';
import { useUpdateProjectCsiSpec, useDeleteProjectCsiSpec } from '@/hooks/useCsiQueries';
import { formatCostCode } from '@/lib/formatCostCode';

interface ProjectCsiSpecsTableProps {
  projectId: string;
  specs: ProjectCsiSpec[];
  costCodes: CostCode[];
  onUploadMore: () => void;
  permissions: UserPermissions;
}

const SOURCE_BADGES: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  company_default: {
    label: 'Default',
    icon: <Building2 size={10} />,
    className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  project: {
    label: 'Project',
    icon: <GitBranch size={10} />,
    className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  ml_suggested: {
    label: 'ML',
    icon: <Cpu size={10} />,
    className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  },
};

export function ProjectCsiSpecsTable({
  projectId,
  specs,
  costCodes,
  onUploadMore,
  permissions,
}: ProjectCsiSpecsTableProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const updateMutation = useUpdateProjectCsiSpec(projectId);
  const deleteMutation = useDeleteProjectCsiSpec(projectId);

  // Pre-build sorted cost code options for dropdown
  const costCodeOptions = useMemo(() => {
    // AGENTS.md: is_division is display-only — include ALL codes
    return [...costCodes]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(cc => ({
        value: cc.code,
        label: `${formatCostCode(cc.code)} – ${cc.description}`,
      }));
  }, [costCodes]);

  // Build cost code lookup for display
  const codeMap = useMemo(() => {
    const map = new Map<string, CostCode>();
    costCodes.forEach(cc => map.set(cc.code, cc));
    return map;
  }, [costCodes]);

  // Stats
  const defaultCount = specs.filter(s => s.source === 'company_default').length;
  const projectCount = specs.filter(s => s.source === 'project').length;

  // Filtered list
  const filtered = useMemo(() => {
    if (!searchFilter) return specs;
    const q = searchFilter.toLowerCase();
    return specs.filter(s =>
      s.csi_number.toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q) ||
      (s.cost_code ?? '').toLowerCase().includes(q)
    );
  }, [specs, searchFilter]);

  const formatCostCodeDisplay = (code: string | null) => {
    if (!code) return '—';
    const cc = codeMap.get(code);
    return cc ? `${formatCostCode(cc.code)} – ${cc.description}` : code;
  };

  const showActions = permissions.can_edit_records || permissions.can_delete_records;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Project CSI Specifications</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {specs.length.toLocaleString()} specs
            {defaultCount > 0 && <> · {defaultCount} company defaults</>}
            {projectCount > 0 && <> · {projectCount} project-specific</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Search CSI, description, code..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100 w-56"
            />
          </div>
          {permissions.can_edit_records && (
            <button
              onClick={onUploadMore}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Upload size={13} />
              Upload More
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm" style={{ tableLayout: 'fixed', minWidth: 700 }}>
            <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th style={{ width: 200 }} className="px-3 py-2.5 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider">CSI Number</th>
                <th className="px-3 py-2.5 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider">Description</th>
                <th style={{ width: 280 }} className="px-3 py-2.5 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider">Mapped Cost Code</th>
                {showActions && (
                  <th style={{ width: 50 }} className="px-3 py-2.5 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filtered.map(spec => {
                const badge = SOURCE_BADGES[spec.source ?? 'project'];
                return (
                  <tr
                    key={spec.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {/* CSI Number + Source Badge */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                          {spec.csi_number}
                        </span>
                        {badge && (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${badge.className}`}>
                            {badge.icon}
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 truncate">
                      {spec.description || '—'}
                    </td>

                    {/* Mapped Cost Code */}
                    <td className="px-3 py-2">
                      {permissions.can_edit_records ? (
                        <select
                          value={spec.cost_code ?? ''}
                          onChange={e => {
                            const newCode = e.target.value || null;
                            if (newCode !== spec.cost_code) {
                              updateMutation.mutate({ specId: spec.id, costCode: newCode });
                            }
                          }}
                          className="w-full text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700 dark:text-slate-300 dark:bg-slate-800"
                        >
                          <option value="">— Unmapped —</option>
                          {costCodeOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {formatCostCodeDisplay(spec.cost_code)}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    {showActions && (
                      <td className="px-3 py-2 text-center">
                        {permissions.can_delete_records && (
                          <button
                            onClick={() => deleteMutation.mutate(spec.id)}
                            disabled={deleteMutation.isPending}
                            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Remove mapping"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={showActions ? 4 : 3} className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    {searchFilter ? 'No specs match your search.' : 'No specs found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
