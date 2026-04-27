"use client";
import React, { useState } from 'react';
import { useUploadCostCodesCSV, useSystemUsers, useTogglePlatformAdmin } from '@/hooks/useGlobalQueries';
import { useIsPlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useAuth } from '@/providers/AuthProvider';
import { X, UploadCloud, AlertCircle, FileSpreadsheet, Users } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSettingsModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'cost_codes' | 'users'>('cost_codes');
  const [error, setError] = useState<string | null>(null);
  const uploadMutation = useUploadCostCodesCSV();
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { data: users, isLoading: usersLoading } = useSystemUsers();
  const toggleAdmin = useTogglePlatformAdmin();
  const { session } = useAuth();

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const text = await file.text();
      
      // 1. Strip \r and split by newline
      const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
      
      // 2. Parse skipping header
      const uniqueCodes = new Map<string, any>();

      lines.slice(1).forEach(line => {
        // Robust regex to split commas outside of quotes
        const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const tokens = line.split(regex).map(t => t.replace(/^"|"$/g, '').trim());
        
        const colA = tokens[0] || ''; // e.g. "DIV. 1 - General Conditions"
        const colB = tokens[1] || ''; // e.g. "10000.M - General Conditions"
        if (!colA && !colB) return;

        // Parse Division (Col A)
        let divCode = '';
        if (colA) {
          const divMatch = colA.match(/^([A-Z0-9.\s]+?)\s*-\s*(.+)$/i) || [null, colA, colA];
          divCode = divMatch[1]?.trim() || colA;
          const divDesc = divMatch[2]?.trim() || '';

          if (!uniqueCodes.has(divCode)) {
            uniqueCodes.set(divCode, {
              code: divCode,
              description: divDesc,
              is_division: true,
              parent_division: null,
            });
          }
        }

        // Parse Cost Code (Col B)
        if (colB) {
          const ccMatch = colB.match(/^([A-Z0-9.\s]+?)\s*-\s*(.+)$/i) || [null, colB, colB];
          const ccCode = ccMatch[1]?.trim() || colB;
          const ccDesc = ccMatch[2]?.trim() || '';

          uniqueCodes.set(ccCode, {
            code: ccCode,
            description: ccDesc,
            is_division: false,
            parent_division: divCode || null,
          });
        }
      });

      const parsedData = Array.from(uniqueCodes.values());

      if (parsedData.length === 0) {
        throw new Error('No valid cost codes found in CSV.');
      }

      // 3. Upload
      await uploadMutation.mutateAsync(parsedData as any);
      onClose();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('CSV Parsing Error:', JSON.stringify(err, null, 2));
      
      const errMsg = err?.message || err?.details || 'Failed to parse CSV format or Database insertion failed.';
      setError(errMsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-2xl h-[600px] overflow-hidden flex flex-col">
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
        </div>
      </div>
    </div>
  );
}
