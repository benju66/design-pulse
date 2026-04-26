"use client";
import React, { useState } from 'react';
import { useUploadCostCodesCSV } from '@/hooks/useGlobalQueries';
import { X, UploadCloud, AlertCircle, FileSpreadsheet, Users } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSettingsModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'cost_codes' | 'users'>('cost_codes');
  const [error, setError] = useState<string | null>(null);
  const uploadMutation = useUploadCostCodesCSV();

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

          {activeTab === 'users' && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl mb-4 mt-12">
                <Users size={32} className="text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">User Directory</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Pending secure RPC implementation. This tab will allow you to view all authenticated users and assign them Platform Admin privileges.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
