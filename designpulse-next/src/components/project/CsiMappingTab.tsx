"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { Upload, RefreshCw, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CsiStagingGrid } from '@/components/project/CsiStagingGrid';
import { useUploadCsiTOC, useBulkUpsertProjectCsiSpecs, CsiSpecItem } from '@/hooks/useProjectQueries';
import { useCostCodes, useCsiTrainingSuggestions } from '@/hooks/useGlobalQueries';
import { toast } from 'sonner';

export function CsiMappingTab({ projectId }: { projectId: string }) {
  const [, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stagingData, setStagingData] = useState<CsiSpecItem[]>([]);
  
  const uploadMutation = useUploadCsiTOC(projectId);
  const upsertMutation = useBulkUpsertProjectCsiSpecs(projectId);
  const { data: costCodes = [] } = useCostCodes();

  // Extract just the CSI numbers to fetch suggestions
  const extractedNumbers = stagingData.map(d => d.csi_number.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const { data: suggestions = [] } = useCsiTrainingSuggestions(extractedNumbers);

  // Apply suggestions automatically when they load
  useEffect(() => {
    if (suggestions.length > 0 && stagingData.length > 0) {
      setStagingData(current => {
        let hasChanges = false;
        const next = current.map(item => {
          // If already mapped manually, skip
          if (item.cost_code && !(item as any).is_suggested) return item;

          const nq = item.csi_number.toLowerCase().replace(/[^a-z0-9]/g, '');
          const match = suggestions.find(s => s.normalized_csi_number === nq);
          
          if (match && match.global_cost_code_id !== item.cost_code) {
            hasChanges = true;
            return { 
              ...item, 
              cost_code: match.global_cost_code_id, 
              is_suggested: true 
            };
          }
          return item;
        });
        return hasChanges ? next : current;
      });
    }
  }, [suggestions, stagingData.length]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      handleUpload(droppedFile);
    } else {
      toast.error('Please upload a valid PDF file.');
    }
  }, []);

  const handleUpload = (selectedFile: File) => {
    setFile(selectedFile);
    uploadMutation.mutate(selectedFile, {
      onSuccess: (data) => {
        setStagingData(data);
      }
    });
  };

  const handleSave = () => {
    const payload = stagingData.map(d => ({
      id: d.id,
      csi_number: d.csi_number,
      description: d.description,
      cost_code: d.cost_code || null
    }));
    
    upsertMutation.mutate(payload as any, {
      onSuccess: () => {
        setStagingData([]);
        setFile(null);
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 w-full">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">CSI Spec Book Extractor</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Upload your project's PDF Table of Contents to automatically extract CSI divisions and map them to base Cost Codes using our ML Flywheel.
          </p>
        </div>
        
        {stagingData.length > 0 && (
          <button 
            onClick={handleSave}
            disabled={upsertMutation.isPending}
            className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {upsertMutation.isPending ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            {upsertMutation.isPending ? 'Saving to Project...' : 'Save & Lock Specs'}
          </button>
        )}
      </div>

      <motion.div layout>
        <AnimatePresence mode="popLayout">
          {stagingData.length === 0 ? (
            <motion.div 
              key="upload-zone"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`
                border-2 border-dashed rounded-xl p-10 text-center transition-colors
                ${isDragging ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
              `}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {uploadMutation.isPending ? (
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="w-10 h-10 text-sky-500 animate-spin" />
                  <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-200">Extracting CSI Data...</h4>
                    <p className="text-sm text-slate-500 mt-1">Our AI is parsing the PDF structure.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 cursor-pointer">
                  <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/40 rounded-full flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <Upload size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-200">Drag & Drop PDF TOC Here</h4>
                    <p className="text-sm text-slate-500 mt-1 mb-4">or click to browse your computer</p>
                    <input 
                      type="file" 
                      accept="application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                      }}
                      className="hidden" 
                      id="file-upload"
                    />
                    <label 
                      htmlFor="file-upload"
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Browse Files
                    </label>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="staging-grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <CsiStagingGrid 
                data={stagingData} 
                setData={setStagingData} 
                costCodes={costCodes} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
