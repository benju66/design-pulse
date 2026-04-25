"use client";
import React, { useState } from 'react';
import { useUploadCostCodesCSV } from '@/hooks/useGlobalQueries';
import { X, UploadCloud, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSettingsModal({ isOpen, onClose }: Props) {
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Global Settings (Master Data)</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Upload a master CSV to populate the Global Cost Codes & Divisions. The file must have the following columns in exact order: <strong>Code, Description, L, M, S, O</strong>. This will completely overwrite existing codes.
          </p>

          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <UploadCloud className="w-8 h-8 mb-2 text-slate-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400 font-semibold">
                {uploadMutation.isPending ? 'Uploading...' : 'Click to upload CSV'}
              </p>
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
            <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
