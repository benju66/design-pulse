"use client";
import React, { useState, useMemo, useEffect } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import { useCostCodes, useUploadCostCodesCSV, useSystemUsers, useTogglePlatformAdmin, useRolePermissions, useUpdateRolePermission, useGlobalCsiTrainingData, useToggleGlobalCsiVerified, useRemapGlobalCsiEntry, useUserProjectMembers, useBulkUpdateUserProjects, SystemUser, useUpdateCostCodeDescription, useDeleteCostCode, checkCostCodeUsage, useToggleCostCodeCategory, CategoryField } from '@/hooks/useGlobalQueries';
import { useCompanyCsiDefaults, useBulkUpsertCompanyCsiDefaults, useDeleteCompanyCsiDefault, useCompanyCsiRosettaView } from '@/hooks/useCompanyCsiQueries';
import { CompanyCsiDefault } from '@/types/models';
import { useIsPlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useAuth } from '@/providers/AuthProvider';
import { X, UploadCloud, AlertCircle, FileSpreadsheet, Users, ShieldCheck, Building2, Eye, EyeOff, Trash2, GitMerge, Search, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, Circle, Save, Pencil, Loader2, Check, TriangleAlert, Database, Layers, Download } from 'lucide-react';
import { useProjects, useUpdateProjectCore, useDeleteProjectCore } from '@/hooks/useProjectCoreQueries';
import { Project, GlobalCsiTrainingData, RemapCsiEntryParams, CostCode, RolePermission } from '@/types/models';
import { formatCostCode } from '@/lib/formatCostCode';
import { generateCostCodeTemplate } from '@/lib/excel/costCodeTemplate';
import { parseCostCodeExcel } from '@/lib/excel/costCodeParser';
import { generateCompanyDefaultsTemplate } from '@/lib/excel/companyDefaultsTemplate';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSettingsModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'cost_codes' | 'users' | 'permissions' | 'projects' | 'csi_mapping'>('projects');
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadMutation = useUploadCostCodesCSV();
  const { data: costCodes = [] } = useCostCodes();
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { data: users, isLoading: usersLoading } = useSystemUsers();
  const { session } = useAuth();
  
  const { data: myMemberships = [] } = useUserProjectMembers(session?.user?.id || null);
  const isGcAdminAnywhere = myMemberships.some(m => m.role == 'gc_admin');
  const canAccessUsers = isPlatformAdmin || isGcAdminAnywhere;

  const { data: rolePermissions, isLoading: permissionsLoading } = useRolePermissions();
  const updatePermission = useUpdateRolePermission();
  const { data: projects, isLoading: projectsLoading } = useProjects();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDirty) {
          if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, onClose]);

  if (!isOpen) return null;

  // ── Export ──────────────────────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    try {
      const blob = await generateCostCodeTemplate(costCodes);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'DesignPulse_CostCode_Template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating template:', err);
      setError('Failed to generate template.');
    }
  };

  // ── Import ──────────────────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected after a validation fix
    e.target.value = '';

    try {
      setError(null);
      const arrayBuffer = await file.arrayBuffer();
      
      const payload = await parseCostCodeExcel(arrayBuffer);

      // 3. Chunk-UPSERT via mutation (chunking handled inside useUploadCostCodesCSV — Rule C20)
      await uploadMutation.mutateAsync(payload);
      onClose();
    } catch (err: unknown) {
      console.error('Excel Import Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse Excel file or upload to database.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] max-h-[1000px] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Platform Administration</h2>
            {/* ⚠️ SUPER ADMIN BYPASS BANNER — remove with the bypass code in route.ts */}
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-semibold">
              <TriangleAlert size={13} className="shrink-0" />
              Don&apos;t forget to turn off the Super Admin Bypass!
            </span>
          </div>
          <button 
            onClick={() => {
              if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to close?')) return;
              onClose();
            }} 
            className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50 dark:bg-slate-900">
          <button
            onClick={() => {
              if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) return;
              setActiveTab('cost_codes');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'cost_codes'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet size={18} />
            Global Cost Codes
          </button>
          <button
            onClick={() => {
              if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) return;
              setActiveTab('users');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Users size={18} />
            User Directory
          </button>
          <button
            onClick={() => {
              if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) return;
              setActiveTab('permissions');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'permissions'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck size={18} />
            Role Permissions
          </button>
          <button
            onClick={() => {
              if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) return;
              setActiveTab('projects');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'projects'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Building2 size={18} />
            Projects
          </button>
          <button
            onClick={() => {
              if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) return;
              setActiveTab('csi_mapping');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'csi_mapping'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <GitMerge size={18} />
            CSI Mapping
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden p-6 bg-white dark:bg-slate-950">
          {activeTab === 'cost_codes' && (
            <div className="flex flex-col gap-4 flex-1 min-h-0">

              {/* ── Compact Workflow Bar ──────────────────────────────────────────── */}
              <div className="shrink-0 flex items-center gap-3 flex-wrap px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/80 dark:bg-slate-900/40">

                {/* Step pills */}
                <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap text-[11px]">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">1</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Download template</span>
                  </span>
                  <ChevronRight size={11} className="text-slate-300 dark:text-slate-600 shrink-0" />
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">2</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Fill <span className="font-bold">Sheet&nbsp;1</span> <span className="text-slate-400 font-normal">(Divisions)</span> &amp; <span className="font-bold">Sheet&nbsp;2</span> <span className="text-slate-400 font-normal">(Cost Codes)</span>
                    </span>
                  </span>
                  <ChevronRight size={11} className="text-slate-300 dark:text-slate-600 shrink-0" />
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0">3</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Upload to sync</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">&middot;</span>
                  <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">
                    Division codes (e.g. <code className="font-mono text-[10px]">260000</code>) in Sheet&nbsp;1 are selectable in dropdowns
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    <FileSpreadsheet size={13} />
                    Download Template
                  </button>
                  <label className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shadow-sm ${
                    uploadMutation.isPending
                      ? 'bg-sky-50 border-sky-300 text-sky-500 dark:bg-sky-900/20 dark:border-sky-700 dark:text-sky-400 cursor-wait'
                      : 'bg-sky-500 border-sky-600 text-white hover:bg-sky-600'
                  }`}>
                    <UploadCloud size={13} />
                    {uploadMutation.isPending ? 'Uploading…' : 'Upload .xlsx'}
                    <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} disabled={uploadMutation.isPending} />
                  </label>
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div className="shrink-0 px-3 py-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2 border border-rose-100 dark:border-rose-900/50">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="leading-relaxed font-medium">{error}</span>
                </div>
              )}

              {/* ── Live Cost Code Viewer (flex-1 — dominates remaining space) ────── */}
              <CostCodeViewer costCodes={costCodes} isPlatformAdmin={!!isPlatformAdmin} />
            </div>
          )}


          {activeTab === 'users' && canAccessUsers && (
            <GlobalUserManagementTab 
              users={users || []} 
              usersLoading={usersLoading} 
              projects={projects || []}
              sessionUserId={session?.user?.id || ''}
              setIsDirty={setIsDirty}
              isDirty={isDirty}
              isPlatformAdmin={!!isPlatformAdmin}
            />
          )}

          {activeTab === 'users' && !canAccessUsers && (
             <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                <AlertCircle size={32} className="text-rose-500 mb-4 mt-12" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Access Denied</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  You must be a Platform Admin or GC Admin to view the Global User Directory.
                </p>
             </div>
          )}

          {activeTab === 'permissions' && !isPlatformAdmin && (
             <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                <AlertCircle size={32} className="text-rose-500 mb-4 mt-12" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Access Denied</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  You must be a Platform Admin to manage Role Permissions.
                </p>
             </div>
          )}

          {activeTab === 'permissions' && isPlatformAdmin && (
            <div className="max-w-3xl mx-auto flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Global Role Permissions</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Configure the dynamic access matrix. These settings apply globally across all projects. Changes are saved automatically.
              </p>
              
              {permissionsLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col">
                  <div className="overflow-y-auto max-h-[400px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 dark:bg-slate-950/50 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Permission</th>
                          {rolePermissions?.map(rp => (
                            <th key={rp.role} className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-center capitalize w-28">
                              {rp.role.replace('_', ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {[
                          { label: 'Edit Records', key: 'can_edit_records' },
                          { label: 'Delete Records', key: 'can_delete_records' },
                          { label: 'Lock Options', key: 'can_lock_options' },
                          { label: 'Unlock Options', key: 'can_unlock_options' },
                          { label: 'Manage Budget', key: 'can_manage_budget' },
                          { label: 'Manage Team', key: 'can_manage_team' },
                          { label: 'Edit Settings', key: 'can_edit_project_settings' },
                          { label: 'View Audit Logs', key: 'can_view_audit_logs' },
                        ].map((perm) => (
                          <tr key={perm.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                              {perm.label}
                            </td>
                            {rolePermissions?.map(rp => (
                              <td key={rp.role} className="px-4 py-3 text-center">
                                <input 
                                  type="checkbox"
                                  className="w-4 h-4 text-sky-500 bg-slate-100 border-slate-300 rounded focus:ring-sky-500 dark:focus:ring-sky-600 dark:ring-offset-slate-900 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer disabled:opacity-50"
                                  checked={rp[perm.key as keyof Omit<RolePermission, 'role'>] as boolean}
                                  onChange={() => {
                                    updatePermission.mutate({ 
                                      role: rp.role, 
                                      field: perm.key as keyof Omit<RolePermission, 'role'>, 
                                      value: !rp[perm.key as keyof Omit<RolePermission, 'role'>] 
                                    });
                                  }}
                                  disabled={updatePermission.isPending && updatePermission.variables?.role === rp.role && updatePermission.variables?.field === perm.key}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'projects' && !isPlatformAdmin && (
             <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                <AlertCircle size={32} className="text-rose-500 mb-4 mt-12" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Access Denied</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  You must be a Platform Admin to manage all projects.
                </p>
             </div>
          )}

          {activeTab === 'projects' && isPlatformAdmin && (
            <div className="max-w-3xl mx-auto flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Global Project Management</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Hide projects from the main dashboard (soft delete) or permanently remove them from the database (hard delete).
              </p>
              
              {projectsLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col">
                  <div className="overflow-y-auto max-h-[400px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 dark:bg-slate-950/50 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Project Name</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-center w-28">Visibility</th>
                          <th className="px-4 py-3 font-semibold text-rose-600 dark:text-rose-500 text-center w-28">Hard Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {projects?.map(project => (
                          <ProjectAdminRow key={project.id} project={project} />
                        ))}
                        {projects?.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No projects found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'csi_mapping' && !isPlatformAdmin && (
             <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                <AlertCircle size={32} className="text-rose-500 mb-4 mt-12" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Access Denied</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  You must be a Platform Admin to review the CSI Mapping Flywheel.
                </p>
             </div>
          )}

          {activeTab === 'csi_mapping' && isPlatformAdmin && (
            <CsiMappingWithSubViews costCodes={costCodes} />
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectAdminRow({ project }: { project: Project }) {
  const updateProject = useUpdateProjectCore(project.id);
  const deleteProject = useDeleteProjectCore();

  const isHidden = project.is_archived;

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
        <div className="flex flex-col">
          <span>{project.name}</span>
          {project.project_number && (
            <span className="text-xs text-slate-500 font-mono mt-0.5">{project.project_number}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => updateProject.mutate({ is_archived: !isHidden })}
          disabled={updateProject.isPending}
          className={`flex items-center justify-center w-full gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
            isHidden 
              ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700' 
              : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/50'
          }`}
          title={isHidden ? "Show on dashboard" : "Hide from dashboard"}
        >
          {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          {isHidden ? 'Hidden' : 'Visible'}
        </button>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => {
            if (window.confirm(`Are you absolutely sure you want to hard delete "${project.name}"? This permanently erases all related data.`)) {
              deleteProject.mutate(project.id);
            }
          }}
          disabled={deleteProject.isPending}
          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors disabled:opacity-50 mx-auto block"
          title="Hard Delete Project"
        >
          <Trash2 size={18} />
        </button>
      </td>
    </tr>
  );
}

// ── CSI Mapping Review Tab ────────────────────────────────────────────────────
// Self-contained TanStack table with client-side pagination and search.
// C22: sorted by composite PK for MVCC safety
// C23: onChange fires mutation immediately (no onBlur)
// C1:  ColumnDef<GlobalCsiTrainingData, unknown> — no any
function CsiMappingTab({ costCodes }: { costCodes: CostCode[] }) {
  const { data: rows = [], isLoading } = useGlobalCsiTrainingData();
  const toggleVerifiedMutation = useToggleGlobalCsiVerified();
  const remapMutation = useRemapGlobalCsiEntry();
  const [globalFilter, setGlobalFilter] = useState('');

  const isMutating = toggleVerifiedMutation.isPending || remapMutation.isPending;

  const toggleVerified = useMemo(() => (
    (normalizedCsiNumber: string, costCodeId: string, value: boolean) =>
      toggleVerifiedMutation.mutate({ normalizedCsiNumber, costCodeId, value })
  ), [toggleVerifiedMutation]);

  const remapEntry = useMemo(() => (
    (params: RemapCsiEntryParams) => remapMutation.mutate(params)
  ), [remapMutation]);

  const baseCodes = useMemo(() => costCodes.filter(c => !c.is_division), [costCodes]);

  const columns = useMemo<ColumnDef<GlobalCsiTrainingData, unknown>[]>(() => [
    {
      accessorKey: 'latest_raw_csi_number',
      header: 'CSI Number',
      size: 160,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
          {(getValue() as string | null) ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'latest_description',
      header: 'Description',
      cell: ({ getValue }) => (
        <span className="text-xs text-slate-700 dark:text-slate-300 truncate block max-w-[260px]">
          {(getValue() as string | null) ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'global_cost_code_id',
      header: 'Mapped Cost Code',
      size: 200,
      cell: ({ getValue, row }) => {
        const currentCode = getValue() as string;
        return (
          <select
            defaultValue={currentCode}
            disabled={isMutating}
            onChange={(e) => {
              const newCode = e.target.value;
              if (newCode && newCode !== currentCode) {
                remapEntry({
                  normalizedCsiNumber : row.original.normalized_csi_number,
                  oldCostCode         : currentCode,
                  newCostCode         : newCode,
                  description         : row.original.latest_description,
                  rawCsiNumber        : row.original.latest_raw_csi_number,
                });
              }
            }}
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100 disabled:opacity-50"
          >
            {baseCodes.map(c => (
              <option key={c.code} value={c.code}>{formatCostCode(c.code)} – {c.description}</option>
            ))}
          </select>
        );
      },
    },
    {
      accessorKey: 'match_count',
      header: 'Seen',
      size: 64,
      cell: ({ getValue }) => (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {getValue() as number}
        </span>
      ),
    },
    {
      accessorKey: 'last_seen_at',
      header: 'Last Seen',
      size: 110,
      cell: ({ getValue }) => (
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {new Date(getValue() as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
        </span>
      ),
    },
    {
      accessorKey: 'is_admin_verified',
      header: 'Verified',
      size: 72,
      cell: ({ getValue, row }) => {
        const verified = getValue() as boolean;
        return (
          <button
            onClick={() => toggleVerified(row.original.normalized_csi_number, row.original.global_cost_code_id, !verified)}
            disabled={isMutating}
            title={verified ? 'Mark unverified' : 'Mark verified'}
            className="flex items-center justify-center w-full disabled:opacity-50 transition-colors"
          >
            {verified
              ? <CheckCircle2 size={18} className="text-emerald-500" />
              : <Circle       size={18} className="text-slate-300 dark:text-slate-600 hover:text-sky-400" />}
          </button>
        );
      },
    },
  ], [baseCodes, isMutating, toggleVerified, remapEntry]);

  const table = useReactTable<GlobalCsiTrainingData>({
    data: rows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _colId, filterValue: string) => {
      if (!filterValue) return true;
      const q = filterValue.toLowerCase();
      return (
        (row.original.latest_raw_csi_number ?? '').toLowerCase().includes(q) ||
        (row.original.latest_description   ?? '').toLowerCase().includes(q) ||
        row.original.global_cost_code_id.toLowerCase().includes(q)
      );
    },
    getCoreRowModel:       getCoreRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    initialState: { pagination: { pageSize: 20 } },
    getRowId: row => `${row.normalized_csi_number}::${row.global_cost_code_id}`,
    meta: {
      globalCsiActions: { toggleVerified, remapEntry, isMutating },
      rawCostCodes: costCodes,
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">CSI Mapping Flywheel</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {rows.length.toLocaleString()} entries across all projects
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Search CSI, description, code..."
            className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100 w-64"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm" style={{ tableLayout: 'fixed', minWidth: 860 }}>
            <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(h => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      style={{ width: h.getSize() }}
                      className="px-3 py-2.5 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-2 align-middle" style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-400 italic">
                    {globalFilter
                      ? 'No entries match your search.'
                      : 'No CSI training data yet. Entries appear automatically when project CSI specs are mapped.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
            {' · '}{table.getFilteredRowModel().rows.length.toLocaleString()} results
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CSI Mapping Sub-View Wrapper (Phase 7) ─────────────────────────────────────
// Segmented control switching between ML Flywheel and Company Defaults views.
function CsiMappingWithSubViews({ costCodes }: { costCodes: CostCode[] }) {
  const [subView, setSubView] = useState<'flywheel' | 'defaults' | 'rosetta'>('flywheel');

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Segmented Control */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setSubView('flywheel')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            subView === 'flywheel'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <GitMerge size={13} />
          ML Flywheel
        </button>
        <button
          onClick={() => setSubView('defaults')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            subView === 'defaults'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Database size={13} />
          Company Defaults
        </button>
        <button
          onClick={() => setSubView('rosetta')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            subView === 'rosetta'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Layers size={13} />
          Rosetta Stone
        </button>
      </div>

      {/* Sub-View Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {subView === 'flywheel' && <CsiMappingTab costCodes={costCodes} />}
        {subView === 'defaults' && <CompanyDefaultsTab costCodes={costCodes} />}
        {subView === 'rosetta' && <RosettaStoneTab costCodes={costCodes} />}
      </div>
    </div>
  );
}

// ── Company Defaults Tab (Phase 7) ─────────────────────────────────────────────
// Admin-only view for managing company-level default CSI-to-Cost-Code mappings.
function CompanyDefaultsTab({ costCodes }: { costCodes: CostCode[] }) {
  const { data: defaults = [], isLoading } = useCompanyCsiDefaults();
  const upsertMutation = useBulkUpsertCompanyCsiDefaults();
  const deleteMutation = useDeleteCompanyCsiDefault();
  const [searchFilter, setSearchFilter] = useState('');

  const filteredDefaults = useMemo(() => {
    if (!searchFilter) return defaults;
    const q = searchFilter.toLowerCase();
    return defaults.filter(d =>
      d.csi_number.toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q) ||
      (d.cost_code ?? '').toLowerCase().includes(q)
    );
  }, [defaults, searchFilter]);

  // Excel upload handler (reuses AGENTS.md C19 dynamic import pattern)
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // Reset so same file can be re-selected

    try {
      // C19: Dynamic import of browser-safe ExcelJS build
      const ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default;
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      // Find first visible sheet with CSI/Description headers
      let csiCol = -1;
      let descCol = -1;
      let costCodeCol = -1;
      // ExcelJS dynamic import (C19) loses type info — `any` is unavoidable here
      let sheet: any | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

      for (const ws of workbook.worksheets) {
        if (ws.state === 'hidden') continue;
        csiCol = -1;
        descCol = -1;
        costCodeCol = -1;
        ws.getRow(1).eachCell((cell: { text: string }, colNumber: number) => {
          const val = String(cell.text || '').toLowerCase().replace(/[^a-z]/g, '');
          if (val.includes('csi')) csiCol = colNumber;
          else if (val.includes('desc')) descCol = colNumber;
          else if (val.includes('costcode') || val.includes('code')) costCodeCol = colNumber;
        });
        if (csiCol !== -1 && descCol !== -1) {
          sheet = ws;
          break;
        }
      }

      if (!sheet) {
        toast.error("Could not find a sheet with 'CSI Number' and 'Description' columns.");
        return;
      }

      const parsedPayload: Partial<CompanyCsiDefault>[] = [];
      sheet.eachRow((row: { getCell: (col: number) => { text: string } }, rowNumber: number) => {
        if (rowNumber === 1) return; // skip header
        const rawCsi = String(row.getCell(csiCol).text || '').trim();
        const rawDesc = String(row.getCell(descCol).text || '').trim();
        if (!rawCsi) return;

        let costCodeVal: string | undefined;
        if (costCodeCol !== -1) {
          const rawCostCode = String(row.getCell(costCodeCol).text || '').trim();
          if (rawCostCode) {
            // Strip description suffix (e.g. "096500 - Flooring" → "096500")
            costCodeVal = rawCostCode.split(' - ')[0].split(' – ')[0].trim();
          }
        }

        parsedPayload.push({
          id: crypto.randomUUID(), // C8: Client-side UUIDs
          csi_number: rawCsi,
          description: rawDesc || null,
          cost_code: costCodeVal || null,
        });
      });

      if (parsedPayload.length === 0) {
        toast.error('No valid rows found in spreadsheet.');
        return;
      }

      await upsertMutation.mutateAsync(parsedPayload);
    } catch (err: unknown) {
      console.error('Company Defaults Excel Import Error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to import: ${msg}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Company Default CSI Codes</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {defaults.length.toLocaleString()} default mappings • Seeded into new projects on demand
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
            <button
              onClick={async () => {
                try {
                  const blob = await generateCompanyDefaultsTemplate(costCodes, defaults);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'Company_CSI_Defaults_Template.xlsx';
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('Template download error:', err);
                  toast.error('Failed to generate template.');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Download size={13} />
              Template
            </button>
            <label className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shadow-sm ${
              upsertMutation.isPending
                ? 'bg-sky-50 border-sky-300 text-sky-500 dark:bg-sky-900/20 dark:border-sky-700 dark:text-sky-400 cursor-wait'
                : 'bg-sky-500 border-sky-600 text-white hover:bg-sky-600'
            }`}>
              <UploadCloud size={13} />
              {upsertMutation.isPending ? 'Uploading…' : 'Upload .xlsx'}
              <input type="file" className="hidden" accept=".xlsx" onChange={handleExcelUpload} disabled={upsertMutation.isPending} />
            </label>
          </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm" style={{ tableLayout: 'fixed', minWidth: 700 }}>
            <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th style={{ width: 160 }} className="px-3 py-2.5 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider">CSI Number</th>
                <th className="px-3 py-2.5 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider">Description</th>
                <th style={{ width: 200 }} className="px-3 py-2.5 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider">Mapped Cost Code</th>
                <th style={{ width: 60 }} className="px-3 py-2.5 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredDefaults.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                  <td className="px-3 py-2 align-middle">
                    <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{row.csi_number}</span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate block">{row.description ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {(() => {
                      const matched = costCodes.find(c => c.code === row.cost_code);
                      return (
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate block" title={matched ? `${formatCostCode(matched.code)} – ${matched.description}` : (row.cost_code ?? 'Unmapped')}>
                          {matched ? `${formatCostCode(matched.code)} – ${matched.description}` : (row.cost_code ?? <span className="text-slate-400 italic">Unmapped</span>)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 align-middle text-center">
                    <button
                      onClick={() => deleteMutation.mutate(row.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all disabled:opacity-50"
                      title="Remove default"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDefaults.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400 italic">
                    {searchFilter
                      ? 'No defaults match your search.'
                      : 'No company CSI defaults yet. Upload an .xlsx to get started.'}
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

// ── Rosetta Stone Aggregation Tab (Phase 2) ─────────────────────────────────────
// Read-only cross-project view: company defaults + project overrides.
function RosettaStoneTab({ costCodes: _costCodes }: { costCodes: CostCode[] }) {
  const { data: rows = [], isLoading } = useCompanyCsiRosettaView(true);
  const [search, setSearch] = useState('');

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        (r.cost_code?.toLowerCase().includes(q)) ||
        (r.cost_code_description?.toLowerCase().includes(q)) ||
        r.default_csi_number.toLowerCase().includes(q) ||
        (r.default_csi_description?.toLowerCase().includes(q)) ||
        r.project_specs.some(
          (ps) =>
            ps.project_name.toLowerCase().includes(q) ||
            ps.csi_number.toLowerCase().includes(q)
        )
    );
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Rosetta Stone View
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {rows.length} default mappings • Cross-project override visibility
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search CSI, cost code, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
        <div className="overflow-auto h-full">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-[0_1px_0_var(--tw-shadow-color)] shadow-slate-200 dark:shadow-slate-700">
              <tr>
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-56">
                  Cost Code
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-44">
                  Default CSI Code
                </th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Project-Specific Overrides
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-3 py-12 text-center text-sm text-slate-400">
                    <Loader2 className="mx-auto mb-2 animate-spin" size={20} />
                    Loading Rosetta Stone view...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-12 text-center text-sm text-slate-400 dark:text-slate-500 italic">
                    {rows.length === 0
                      ? 'No company defaults to display. Upload defaults in the Company Defaults tab first.'
                      : `No results matching "${search}"`}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, i) => (
                  <tr key={`${row.default_csi_number}-${i}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    {/* Cost Code */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-sm text-slate-700 dark:text-slate-300">
                          {row.cost_code || '—'}
                        </span>
                        {row.cost_code_description && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[200px]" title={row.cost_code_description}>
                            {row.cost_code_description}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Default CSI */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
                          {row.default_csi_number}
                        </span>
                        {row.default_csi_description && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[200px]" title={row.default_csi_description}>
                            {row.default_csi_description}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Project Overrides */}
                    <td className="px-3 py-2.5">
                      {row.project_specs.length === 0 ? (
                        <span className="text-xs text-slate-300 dark:text-slate-600 italic">
                          No project overrides
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {row.project_specs.map((ps) => (
                            <span
                              key={`${ps.project_id}-${ps.csi_number}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                              title={`${ps.project_name}: ${ps.csi_number}`}
                            >
                              <span className="font-mono">{ps.csi_number}</span>
                              <span className="text-emerald-400 dark:text-emerald-600">·</span>
                              <span className="font-normal text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                {ps.project_name}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Global User Management Tab (Phase 6) ───────────────────────────────────────

function GlobalUserManagementTab({ 
  users, 
  usersLoading, 
  projects, 
  sessionUserId,
  setIsDirty,
  isDirty,
  isPlatformAdmin
}: { 
  users: SystemUser[], 
  usersLoading: boolean, 
  projects: Project[], 
  sessionUserId: string,
  setIsDirty: (val: boolean) => void,
  isDirty: boolean,
  isPlatformAdmin: boolean
}) {
  const visibleProjects = React.useMemo(() => {
    return isPlatformAdmin ? projects : projects.filter(p => !p.is_archived);
  }, [projects, isPlatformAdmin]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: dbMembers = [], isLoading: membersLoading } = useUserProjectMembers(activeUserId);
  const bulkUpdateMutation = useBulkUpdateUserProjects();
  const toggleAdmin = useTogglePlatformAdmin();

  // Local delta tracker for batch saves
  const [localDelta, setLocalDelta] = useState<Record<string, { role: string; action: 'UPSERT' | 'DELETE' }>>({});

  const activeUser = users.find(u => u.id === activeUserId);
  const isSelf = activeUser?.id === sessionUserId;

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u => 
      u.email.toLowerCase().includes(q) || 
      (u.name && u.name.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  const handleSelectUser = (userId: string) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    setActiveUserId(userId);
    setLocalDelta({});
    setIsDirty(false);
  };

  const handleSave = () => {
    if (!activeUserId) return;
    
    const payload = Object.entries(localDelta).map(([project_id, data]) => ({
      project_id,
      role: data.role,
      action: data.action
    }));

    bulkUpdateMutation.mutate({ userId: activeUserId, payload }, {
      onSuccess: () => {
        setLocalDelta({});
        setIsDirty(false);
      }
    });
  };

  const handleDiscard = () => {
    setLocalDelta({});
    setIsDirty(false);
  };

  const updateDelta = (projectId: string, isAssigned: boolean, role: string) => {
    // If we're modifying our own profile, prevent it
    if (isSelf) return;

    setLocalDelta(prev => {
      const next = { ...prev };
      
      const dbMatch = dbMembers.find(m => m.project_id === projectId);
      
      if (!isAssigned) {
        if (dbMatch) {
          next[projectId] = { role, action: 'DELETE' };
        } else {
          delete next[projectId];
        }
      } else {
        if (dbMatch && dbMatch.role === role) {
          delete next[projectId]; // Reverted back to DB state
        } else {
          next[projectId] = { role, action: 'UPSERT' };
        }
      }

      setIsDirty(Object.keys(next).length > 0);
      return next;
    });
  };

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    return email?.substring(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="@container flex flex-col h-full bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      <div className="flex h-full min-h-0">
        
        {/* Left Pane: Team Directory */}
        <div className="w-1/3 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-950">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Team Directory</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100 transition-shadow"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {usersLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500"></div></div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">No users found.</div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredUsers.map(user => {
                  const isSelected = activeUserId === user.id;
                  const selfBadge = user.id === sessionUserId;
                  return (
                    <li key={user.id}>
                      <button
                        onClick={() => handleSelectUser(user.id)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                          isSelected 
                            ? 'bg-sky-50 dark:bg-sky-900/20 border-l-2 border-sky-500' 
                            : 'border-l-2 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          user.is_platform_admin 
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' 
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {getInitials(user.name, user.email)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {user.name || user.email.split('@')[0]}
                            </span>
                            {selfBadge && <span className="text-[10px] uppercase font-bold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 px-1.5 py-0.5 rounded-full shrink-0">You</span>}
                          </div>
                          {(user.job_title || user.company_name) && (
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate block mb-0.5">
                              {[user.job_title, user.company_name].filter(Boolean).join(' • ')}
                            </span>
                          )}
                          <span className="text-xs text-slate-500 truncate block">{user.email}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right Pane: Configuration */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900">
          {!activeUser ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Select a User</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Choose a user from the directory to manage their platform-wide project access and administrative privileges.
              </p>
            </div>
          ) : (
            <>
              {/* Profile Header */}
              <div className="p-6 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {activeUser.name || 'Unnamed User'}
                    </h2>
                    {(activeUser.job_title || activeUser.company_name) && (
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">
                        {[activeUser.job_title, activeUser.company_name].filter(Boolean).join(' • ')}
                      </p>
                    )}
                    <p className="text-sm text-slate-500 mt-0.5">{activeUser.email}</p>
                  </div>
                  
                  {/* Global Platform Admin Toggle */}
                  <div className="flex flex-col items-end">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                      Platform Admin Status
                    </label>
                    <button 
                      type="button"
                      onClick={() => toggleAdmin.mutate({ userId: activeUser.id, isAdmin: !activeUser.is_platform_admin })}
                      disabled={toggleAdmin.isPending || isSelf}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 ${
                        activeUser.is_platform_admin ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                        activeUser.is_platform_admin ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                {isSelf && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 rounded-lg text-sm flex items-start gap-2 border border-amber-200 dark:border-amber-900/50">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p><strong>Self-Modification Locked:</strong> You cannot modify your own project assignments to prevent accidental lockouts.</p>
                  </div>
                )}
              </div>

              {/* Assignments Matrix */}
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider">Project Assignments</h3>
                
                {membersLoading ? (
                  <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div></div>
                ) : visibleProjects.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">No projects found.</div>
                ) : (
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50">
                    {visibleProjects.map(project => {
                      const dbMatch = dbMembers.find(m => m.project_id === project.id);
                      const deltaMatch = localDelta[project.id];
                      
                      const isAssigned = deltaMatch ? deltaMatch.action === 'UPSERT' : !!dbMatch;
                      const currentRole = deltaMatch?.role || dbMatch?.role || 'viewer';

                      return (
                        <div key={project.id} className={`flex items-center justify-between p-4 transition-colors ${isAssigned ? 'bg-sky-50/30 dark:bg-sky-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                          <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                            <button
                              type="button"
                              onClick={() => updateDelta(project.id, !isAssigned, currentRole)}
                              disabled={isSelf || bulkUpdateMutation.isPending}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 ${
                                isAssigned ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                                isAssigned ? 'translate-x-5' : 'translate-x-1'
                              }`} />
                            </button>
                            <div className="flex flex-col min-w-0">
                              <span className={`text-sm font-semibold truncate transition-colors ${isAssigned ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                {project.name}
                              </span>
                              {project.project_number && (
                                <span className="text-xs text-slate-500 truncate">{project.project_number}</span>
                              )}
                            </div>
                          </div>

                          <div className="w-40 shrink-0">
                            {isAssigned && (
                              <select
                                value={currentRole}
                                disabled={isSelf || bulkUpdateMutation.isPending}
                                onChange={(e) => updateDelta(project.id, true, e.target.value)}
                                className={`w-full text-xs border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors disabled:opacity-50 appearance-none ${
                                  currentRole === 'project_admin' ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-900 dark:text-rose-400' :
                                  currentRole === 'gc_admin' ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/20 dark:border-sky-900 dark:text-sky-400' :
                                  currentRole === 'design_team' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-900 dark:text-indigo-400' :
                                  'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900 dark:text-emerald-400'
                                }`}
                              >
                                <option value="project_admin">Owner (Admin)</option>
                                <option value="gc_admin">GC Admin</option>
                                <option value="design_team">Design Team</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
                <div className="text-sm font-medium text-slate-500">
                  {isDirty ? (
                    <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                      <Circle size={14} className="fill-current" /> Unsaved changes
                    </span>
                  ) : 'All assignments saved'}
                </div>
                <div className="flex items-center gap-3">
                  {isDirty && (
                    <button
                      onClick={handleDiscard}
                      disabled={bulkUpdateMutation.isPending}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                    >
                      Discard
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={!isDirty || bulkUpdateMutation.isPending}
                    className="flex items-center gap-2 px-6 py-2 bg-sky-500 text-white text-sm font-bold rounded-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {bulkUpdateMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <Save size={16} />
                    )}
                    Save Assignments
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Global Cost Code Viewer ──────────────────────────────────────────────────
// Read-only hierarchical browser for all cost_codes in the system.
//
// Architecture notes:
//   - Purely presentational — uses the already-fetched `costCodes` prop; no new
//     hook calls and therefore no extra Supabase round-trips.
//   - Builds a division → children map via a single useMemo loop (no any).
//   - Search filters across both `code` and `description` simultaneously.
//   - Divisions that have no matching children are hidden when a search query is
//     active, but the division header is shown when its own code/description
//     matches the query.
//   - Collapse state tracked per-division in a local Set stored in useState.
//   - Category badges (L/M/S/E/O) are conditionally rendered; active = amber,
//     inactive = muted grey.
//   - iOS-safe: zero regex, no lookbehinds (AGENTS.md Rule A).

interface CostCodeViewerProps {
  costCodes: CostCode[];
  isPlatformAdmin: boolean;
}

function CostCodeViewer({ costCodes, isPlatformAdmin }: CostCodeViewerProps) {
  const [search, setSearch] = useState('');
  // Tracks which division codes are collapsed. Starts fully expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  
  // ── Edit Description State ──────────────────────────────────────────────
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState('');
  const updateDescriptionMutation = useUpdateCostCodeDescription();

  // ── Delete State ────────────────────────────────────────────────────────
  const [pendingDeleteCode, setPendingDeleteCode] = useState<string | null>(null);
  const [usageCheckResult, setUsageCheckResult] = useState<{
    total: number;
    breakdown: { opportunities: number; options: number; csiSpecs: number };
  } | null>(null);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);
  const deleteMutation = useDeleteCostCode();
  const toggleCategoryMutation = useToggleCostCodeCategory();

  const toggleCollapse = (divCode: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(divCode)) next.delete(divCode);
      else next.add(divCode);
      return next;
    });
  };

  const startEdit = (code: string, currentDescription: string) => {
    setEditingCode(code);
    setDraftDescription(currentDescription);
  };

  const cancelEdit = () => {
    setEditingCode(null);
    setDraftDescription('');
  };

  const commitEdit = (originalDescription: string) => {
    const trimmed = draftDescription.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    if (trimmed === originalDescription) {
      cancelEdit();
      return;
    }
    updateDescriptionMutation.mutate({ code: editingCode!, description: trimmed });
    cancelEdit();
  };

  const handleDeleteClick = async (code: string) => {
    setIsCheckingUsage(true);
    setPendingDeleteCode(code);
    try {
      const result = await checkCostCodeUsage(code);
      setUsageCheckResult(result);
    } catch (err) {
      console.error("Failed to check usage", err);
      // Revert if check fails
      setPendingDeleteCode(null);
      setUsageCheckResult(null);
    } finally {
      setIsCheckingUsage(false);
    }
  };

  const cancelDelete = () => {
    setPendingDeleteCode(null);
    setUsageCheckResult(null);
  };

  const commitDelete = (code: string) => {
    deleteMutation.mutate(code);
    cancelDelete();
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const { divisions, childrenByDivision, orphans } = useMemo(() => {
    const divs: CostCode[] = [];
    const children: Record<string, CostCode[]> = {};
    const orph: CostCode[] = [];

    for (const cc of costCodes) {
      if (cc.is_division) {
        divs.push(cc);
        // Also add the division code itself as the first child of its own group.
        // This makes division-level codes (e.g. 260000 - Electrical) visible and
        // selectable as cost codes in the viewer, not only as group headers.
        if (!children[cc.code]) children[cc.code] = [cc];
      }
    }
    for (const cc of costCodes) {
      if (!cc.is_division) {
        const parent = cc.parent_division;
        if (parent && children[parent] !== undefined) {
          children[parent].push(cc);
        } else {
          orph.push(cc);
        }
      }
    }
    return { divisions: divs, childrenByDivision: children, orphans: orph };
  }, [costCodes]);

  // Count only child codes (is_division=false) — division header rows are counted
  // separately by the {divisions.length} badge already shown in the viewer header.
  // This ensures the badge reads "228 codes" not "242" (228 codes + 14 division headers).
  const totalCodes = costCodes.filter(c => !c.is_division).length;

  // ── Filtered view ─────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const matchesCostCode = (cc: CostCode): boolean => {
    if (!q) return true;
    return (
      cc.code.toLowerCase().includes(q) ||
      cc.description.toLowerCase().includes(q)
    );
  };

  // ── Category badge helper ─────────────────────────────────────────────────
  const CATEGORY_KEYS: { key: CategoryField; label: string }[] = [
    { key: 'category_l', label: 'L' },
    { key: 'category_m', label: 'M' },
    { key: 'category_s', label: 'S' },
    { key: 'category_e', label: 'E' },
    { key: 'category_o', label: 'O' },
  ];

  const renderCategoryBadges = (cc: CostCode) => (
    <div className="flex items-center gap-0.5 shrink-0">
      {CATEGORY_KEYS.map(({ key, label }) => {
        const active = cc[key] === true;
        const colorClass = active
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
          : 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600';
        const baseClass = `inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold transition-all`;

        if (isPlatformAdmin) {
          return (
            <button
              key={key}
              type="button"
              title={`Category ${label}: ${active ? 'Yes' : 'No'} — click to toggle`}
              onClick={() =>
                toggleCategoryMutation.mutate({ code: cc.code, field: key, value: !active })
              }
              className={`${baseClass} ${colorClass} cursor-pointer hover:ring-2 hover:ring-offset-1 ${
                active
                  ? 'hover:ring-amber-400 dark:hover:ring-amber-500'
                  : 'hover:ring-slate-300 dark:hover:ring-slate-600'
              }`}
            >
              {label}
            </button>
          );
        }

        return (
          <span
            key={key}
            title={`Category ${label}: ${active ? 'Yes' : 'No'}`}
            className={`${baseClass} ${colorClass}`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );

  const renderActions = (cc: CostCode, isDivisionWithChildren: boolean = false) => {
    if (!isPlatformAdmin) return null;
    
    // Delete Confirmation State
    if (pendingDeleteCode === cc.code) {
      if (isCheckingUsage) {
        return (
          <div className="flex items-center justify-end">
            <Loader2 size={16} className="text-slate-400 animate-spin" />
          </div>
        );
      }
      if (usageCheckResult) {
        if (usageCheckResult.total > 0 || isDivisionWithChildren) {
          // Blocked
          const count = isDivisionWithChildren ? childrenByDivision[cc.code]?.length || 0 : usageCheckResult.total;
          const blockedType = isDivisionWithChildren ? 'child code' : 'record';
          const breakdown = isDivisionWithChildren ? '' : 
            `— ${usageCheckResult.breakdown.opportunities} opps, ${usageCheckResult.breakdown.options} options, ${usageCheckResult.breakdown.csiSpecs} specs`;

          return (
            <div className="flex justify-end relative group">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
                <TriangleAlert size={14} />
                {count} {blockedType}{count !== 1 ? 's' : ''}
              </span>
              <div className="absolute right-0 top-full mt-1 w-max z-[100] px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                In use by {count} {blockedType}{count !== 1 ? 's' : ''} {breakdown} — cannot delete.
              </div>
              <button onClick={cancelDelete} className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={16} />
              </button>
            </div>
          );
        }
        // Safe to delete confirm
        return (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 mr-2">Delete?</span>
            <button
              onClick={() => commitDelete(cc.code)}
              className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded flex items-center gap-1 transition-colors"
            >
              <Check size={14} /> Yes
            </button>
            <button
              onClick={cancelDelete}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded flex items-center gap-1 transition-colors"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        );
      }
    }

    return (
      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => startEdit(cc.code, cc.description)}
          className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded transition-colors"
          title="Edit description"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => handleDeleteClick(cc.code)}
          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
          title="Delete cost code"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  // ── Child row ─────────────────────────────────────────────────────────────
  const renderChildRow = (cc: CostCode, indent: boolean) => {
    const isEditing = editingCode === cc.code;

    return (
      <tr
        key={cc.code}
        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
      >
        <td className={`py-2 pr-3 align-middle ${indent ? 'pl-8' : 'pl-4'}`}>
          <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            {formatCostCode(cc.code)}
          </span>
        </td>
        <td className="py-2 pr-3 align-middle">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                className="flex-1 px-2 py-1 text-xs border border-sky-300 dark:border-sky-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                value={draftDescription}
                onChange={e => setDraftDescription(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(cc.description); }
                  if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                }}
              />
              <button onClick={() => commitEdit(cc.description)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={16}/></button>
              <button onClick={cancelEdit} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={16}/></button>
            </div>
          ) : (
            <span className="text-xs text-slate-700 dark:text-slate-300 truncate block">
              {cc.description}
            </span>
          )}
        </td>
        <td className="py-2 pr-4 align-middle">
          <div className="flex items-center justify-between">
            {renderCategoryBadges(cc)}
            {renderActions(cc)}
          </div>
        </td>
      </tr>
    );
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (costCodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
        <FileSpreadsheet size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">No cost codes loaded</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Upload a master CSV above to populate the library.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Cost Code Library</h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {divisions.length} divisions
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            {totalCodes.toLocaleString()} codes
          </span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search code or description..."
            className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-slate-100 w-60"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm" style={{ tableLayout: 'fixed', minWidth: 520 }}>
            <colgroup>
              <col style={{ width: 140 }} />
              <col />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="pl-4 pr-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Code</th>
                <th className="pr-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</th>
                <th className="pr-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categories</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {divisions.map(div => {
                const divChildren = childrenByDivision[div.code] ?? [];
                const filteredChildren = q
                  ? divChildren.filter(matchesCostCode)
                  : divChildren;
                const divMatchesSearch = !q || matchesCostCode(div);

                // Hide the whole division group if neither the division header nor
                // any of its children match the current search query.
                if (q && !divMatchesSearch && filteredChildren.length === 0) return null;

                const isCollapsed = collapsed.has(div.code);
                const isEditing = editingCode === div.code;

                return (
                  <React.Fragment key={div.code}>
                    {/* Division header row */}
                    <tr className="bg-slate-50 dark:bg-slate-900/60 group">
                      <td className="pl-2 pr-3 py-2 align-middle">
                        <button
                          onClick={() => toggleCollapse(div.code)}
                          className="flex items-center gap-2 w-full text-left hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                        >
                          <span className="text-slate-400 dark:text-slate-500 shrink-0 transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                            <ChevronDown size={14} />
                          </span>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                            {`Div. ${formatCostCode(div.code).split('-')[0]}`}
                          </span>
                        </button>
                      </td>
                      <td className="py-2 pr-3 align-middle">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              autoFocus
                              className="flex-1 px-2 py-1 text-xs border border-sky-300 dark:border-sky-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                              value={draftDescription}
                              onChange={e => setDraftDescription(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); commitEdit(div.description); }
                                if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                              }}
                            />
                            <button onClick={() => commitEdit(div.description)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={16}/></button>
                            <button onClick={cancelEdit} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={16}/></button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate flex-1">
                              {div.description}
                            </span>
                            <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                              {filteredChildren.length} code{filteredChildren.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4 align-middle">
                         {renderActions(div, divChildren.length > 0)}
                      </td>
                    </tr>
                    {/* Child code rows */}
                    {!isCollapsed && filteredChildren.map(cc => renderChildRow(cc, true))}
                  </React.Fragment>
                );
              })}

              {/* Orphan codes (no matching parent division) */}
              {(() => {
                const filteredOrphans = q ? orphans.filter(matchesCostCode) : orphans;
                if (filteredOrphans.length === 0) return null;
                return (
                  <React.Fragment>
                    <tr className="bg-amber-50/60 dark:bg-amber-900/10">
                      <td colSpan={3} className="pl-4 pr-4 py-2">
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                          Uncategorised ({filteredOrphans.length})
                        </span>
                      </td>
                    </tr>
                    {filteredOrphans.map(cc => renderChildRow(cc, false))}
                  </React.Fragment>
                );
              })()}

              {/* No results */}
              {q && divisions.every(div => {
                const divChildren = childrenByDivision[div.code] ?? [];
                return !matchesCostCode(div) && divChildren.filter(matchesCostCode).length === 0;
              }) && (q ? orphans.filter(matchesCostCode).length === 0 : false) && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400 italic">
                    No cost codes match &quot;{search}&quot;
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
