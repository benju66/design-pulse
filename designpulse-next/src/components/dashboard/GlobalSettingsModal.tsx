"use client";
import React, { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, flexRender,
  ColumnDef, FilterFn,
} from '@tanstack/react-table';
import { useCostCodes, useUploadCostCodesCSV, useSystemUsers, useTogglePlatformAdmin, useRolePermissions, useUpdateRolePermission, RolePermission, useGlobalCsiTrainingData, useToggleGlobalCsiVerified, useRemapGlobalCsiEntry } from '@/hooks/useGlobalQueries';
import { useIsPlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useAuth } from '@/providers/AuthProvider';
import { X, UploadCloud, AlertCircle, FileSpreadsheet, Users, ShieldCheck, Building2, Eye, EyeOff, Trash2, GitMerge, Search, ChevronLeft, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { useProjects, useUpdateProjectCore, useDeleteProjectCore } from '@/hooks/useProjectQueries';
import { Project, GlobalCsiTrainingData, RemapCsiEntryParams, CostCode } from '@/types/models';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSettingsModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'cost_codes' | 'users' | 'permissions' | 'projects' | 'csi_mapping'>('projects');
  const [error, setError] = useState<string | null>(null);
  const uploadMutation = useUploadCostCodesCSV();
  const { data: costCodes = [] } = useCostCodes();
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { data: users, isLoading: usersLoading } = useSystemUsers();
  const toggleAdmin = useTogglePlatformAdmin();
  const { session } = useAuth();
  
  const { data: rolePermissions, isLoading: permissionsLoading } = useRolePermissions();
  const updatePermission = useUpdateRolePermission();
  const { data: projects, isLoading: projectsLoading } = useProjects();

  if (!isOpen) return null;

  // ── Export ──────────────────────────────────────────────────────────────────────
  // Emits the new flat 8-column format so admins can round-trip: Download → Edit → Re-upload.
  // H-4 fix: old "Col A / Col B" format replaced with explicit flat CSV headers.
  const handleExportCSV = () => {
    if (!costCodes || costCodes.length === 0) {
      setError('No cost codes available to export.');
      return;
    }

    const header = 'code,description,parent_division,category_l,category_m,category_s,category_e,category_o';
    const csvRows: string[] = [header];

    const toBoolStr = (v: boolean | null | undefined) => (v === true ? 'TRUE' : 'FALSE');
    // Minimal CSV quoting — only wrap fields that contain commas or double-quotes.
    const q = (s: string | null | undefined): string => {
      const safe = (s ?? '').replace(/"/g, '""');
      return safe.includes(',') || safe.includes('"') ? `"${safe}"` : safe;
    };

    // Sort: divisions appear immediately before their children for human readability.
    const sorted = [...costCodes].sort((a, b) => {
      const aGroup = a.is_division ? a.code : (a.parent_division ?? '');
      const bGroup = b.is_division ? b.code : (b.parent_division ?? '');
      if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
      if (a.is_division && !b.is_division) return -1;
      if (!a.is_division && b.is_division) return 1;
      return a.code.localeCompare(b.code);
    });

    sorted.forEach(c => {
      csvRows.push([
        q(c.code),
        q(c.description),
        q(c.parent_division),
        toBoolStr(c.category_l),
        toBoolStr(c.category_m),
        toBoolStr(c.category_s),
        toBoolStr(c.category_e),
        toBoolStr(c.category_o),
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DesignPulse_Master_CostCodes.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ── Import ──────────────────────────────────────────────────────────────────────
  // Parses the new flat 8-column format. Strictly typed — no any casting (H-3 fix).
  // Guardrails applied:
  //   C1  — CostCode['Insert'][] throughout, catch uses unknown
  //   C20 — chunking lives in the mutation layer (useUploadCostCodesCSV)
  //   L-3 — is_division derived from parent_division column
  //   A   — iOS-safe CSV splitter: stateful loop instead of regex lookbehind
  type CostCodeInsert = CostCode['Insert'];

  // Stateful CSV field splitter — handles quoted fields with embedded commas.
  // Rule A: does NOT use a negative lookbehind regex. Uses an explicit loop.
  const splitCsvRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch === '"') {
        // Two consecutive quotes inside a quoted field = escaped literal quote
        if (insideQuotes && line[ci + 1] === '"') { current += '"'; ci++; }
        else { insideQuotes = !insideQuotes; }
      } else if (ch === ',' && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCsvBool = (val: string): boolean => val.trim().toUpperCase() === 'TRUE';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected after a validation fix
    e.target.value = '';

    try {
      setError(null);
      const text = await file.text();
      const allLines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');

      if (allLines.length < 2) {
        throw new Error('CSV must contain a header row and at least one data row.');
      }

      // 1. Build a column-index lookup from the header (case-insensitive)
      const headerTokens = splitCsvRow(allLines[0]);
      const col: Record<string, number> = {};
      headerTokens.forEach((h, idx) => { col[h.toLowerCase().trim()] = idx; });

      // Validate required headers
      for (const req of ['code', 'description']) {
        if (col[req] === undefined) {
          throw new Error(
            `CSV is missing required column: "${req}". ` +
            'Expected headers: code, description, parent_division, category_l, category_m, category_s, category_e, category_o'
          );
        }
      }

      // 2. Parse data rows — strictly typed, no any
      const payload: CostCodeInsert[] = [];
      const BOOL_COLS = ['category_l', 'category_m', 'category_s', 'category_e', 'category_o'] as const;

      allLines.slice(1).forEach((line, lineIdx) => {
        const tokens = splitCsvRow(line);
        const get = (key: string): string => (tokens[col[key]] ?? '').trim();

        const code = get('code');
        const description = get('description');
        if (!code || !description) return; // skip blank/incomplete rows

        // L-3 fix: is_division derived from parent_division column
        const rawParent = get('parent_division');
        const parent_division = rawParent !== '' ? rawParent : null;
        const is_division = parent_division === null;

        // Validate boolean columns before parsing
        for (const bc of BOOL_COLS) {
          const raw = get(bc).toUpperCase();
          if (col[bc] !== undefined && raw !== '' && raw !== 'TRUE' && raw !== 'FALSE') {
            throw new Error(
              `Row ${lineIdx + 2}: column "${bc}" must be TRUE, FALSE, or empty — got "${get(bc)}".`
            );
          }
        }

        const row: CostCodeInsert = {
          code,
          description,
          is_division,
          parent_division,
          category_l: col['category_l'] !== undefined ? parseCsvBool(get('category_l')) : false,
          category_m: col['category_m'] !== undefined ? parseCsvBool(get('category_m')) : false,
          category_s: col['category_s'] !== undefined ? parseCsvBool(get('category_s')) : false,
          category_e: col['category_e'] !== undefined ? parseCsvBool(get('category_e')) : false,
          category_o: col['category_o'] !== undefined ? parseCsvBool(get('category_o')) : false,
        };

        payload.push(row);
      });

      if (payload.length === 0) {
        throw new Error(
          'No valid cost code rows found. Ensure the CSV has a header row and ' +
          'at least one data row with both a code and description.'
        );
      }

      // 3. Chunk-UPSERT via mutation (chunking handled inside useUploadCostCodesCSV — Rule C20)
      await uploadMutation.mutateAsync(payload);
      onClose();
    } catch (err: unknown) {
      console.error('CSV Import Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse CSV or upload to database.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-4xl h-[720px] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Platform Administration</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('cost_codes')}
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
            onClick={() => setActiveTab('users')}
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
            onClick={() => setActiveTab('permissions')}
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
            onClick={() => setActiveTab('projects')}
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
            onClick={() => setActiveTab('csi_mapping')}
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

        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-950">
          {activeTab === 'cost_codes' && (
            <div className="max-w-xl mx-auto">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Upload a master CSV to populate the Global Cost Codes & Divisions. The file must have the following columns in exact order: <strong>Code, Description, L, M, S, O</strong>. This will completely overwrite existing codes.
              </p>

              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 hover:bg-sky-50 hover:border-sky-300 dark:hover:bg-sky-900/20 dark:hover:border-sky-700 transition-colors group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-10 h-10 mb-3 text-slate-400 group-hover:text-sky-500 transition-colors" />
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    {uploadMutation.isPending ? 'Uploading to database...' : 'Click or drag file to upload'}
                  </p>
                  <p className="text-xs text-slate-500">CSV files only</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".csv" 
                  onChange={handleFileUpload} 
                  disabled={uploadMutation.isPending}
                />
              </label>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  <FileSpreadsheet size={16} />
                  Download Current Master CSV
                </button>
              </div>

              {error && (
                <div className="mt-6 p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm flex items-start gap-3 border border-rose-100 dark:border-rose-900/50">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{error}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && isPlatformAdmin && (
            <div className="max-w-3xl mx-auto flex flex-col h-full">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">User Directory</h3>
              {usersLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col">
                  <div className="overflow-y-auto max-h-[400px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 dark:bg-slate-950/50 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">User</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-center w-32">Platform Admin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {users?.map(user => {
                          const isSelf = user.id === session?.user?.id;
                          return (
                          <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3">
                              {user.name ? (
                                <div className="flex flex-col">
                                  <div className="text-slate-700 dark:text-slate-300 font-medium">
                                    {user.name} {isSelf && <span className="ml-2 text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 px-2 py-0.5 rounded-full">You</span>}
                                  </div>
                                  <div className="text-xs text-slate-500">{user.email}</div>
                                </div>
                              ) : (
                                <div className="text-slate-700 dark:text-slate-300">
                                  {user.email} {isSelf && <span className="ml-2 text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 px-2 py-0.5 rounded-full">You</span>}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button 
                                type="button"
                                onClick={() => toggleAdmin.mutate({ userId: user.id, isAdmin: !user.is_platform_admin })}
                                disabled={toggleAdmin.isPending || isSelf}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 ${
                                  user.is_platform_admin ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                                }`}
                              >
                                <span 
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                                    user.is_platform_admin ? 'translate-x-6' : 'translate-x-1'
                                  }`} 
                                />
                              </button>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && !isPlatformAdmin && (
             <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                <AlertCircle size={32} className="text-rose-500 mb-4 mt-12" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Access Denied</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  You must be a Platform Admin to view the Global User Directory.
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
            <CsiMappingTab costCodes={costCodes} />
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
              <option key={c.code} value={c.code}>{c.code} – {c.description}</option>
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
