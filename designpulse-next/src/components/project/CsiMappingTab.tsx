"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { Upload, RefreshCw, Save, Download, FileSpreadsheet, Building2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CsiStagingGrid } from '@/components/project/CsiStagingGrid';
import { ProjectCsiSpecsTable } from '@/components/project/ProjectCsiSpecsTable';
import { useUploadCsiTOC, useBulkUpsertProjectCsiSpecs, useProjectCsiSpecs } from '@/hooks/useCsiQueries';
import { useSeedFromCompanyDefaults, useCompanyCsiDefaults } from '@/hooks/useCompanyCsiQueries';
import { CsiSpecItem, ProjectCsiSpec } from '@/types/models';
import { useCostCodes, useCsiTrainingSuggestions } from '@/hooks/useGlobalQueries';
import { useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { runExcelWorker } from '@/lib/excel/excelWorkerClient';
import { toast } from 'sonner';

export function CsiMappingTab({ projectId }: { projectId: string }) {
  const [, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stagingData, setStagingData] = useState<CsiSpecItem[]>([]);
  const [showUploadZone, setShowUploadZone] = useState(false);
  
  const uploadMutation = useUploadCsiTOC();
  const upsertMutation = useBulkUpsertProjectCsiSpecs(projectId);
  const { data: costCodes = [] } = useCostCodes();
  const { data: projectSpecs = [] } = useProjectCsiSpecs(projectId);
  const { data: companyDefaults = [] } = useCompanyCsiDefaults();
  const seedMutation = useSeedFromCompanyDefaults(projectId);
  const { permissions, isLoading: permissionsLoading } = useCurrentUserPermissions(projectId);

  // Extract just the CSI numbers to fetch suggestions
  const extractedNumbers = stagingData.map(d => d.csi_number.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const { data: suggestions = [] } = useCsiTrainingSuggestions(extractedNumbers);

  // Apply suggestions automatically when they load
  useEffect(() => {
    if (suggestions.length > 0 && stagingData.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStagingData(current => {
        let hasChanges = false;
        const next = current.map(item => {
          // If already mapped manually, skip
          if (item.cost_code && !item.is_suggested) return item;

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

  const handleExcelUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const parsedData = await runExcelWorker<CsiSpecItem[]>({
        type: 'PARSE_CSI_SPEC',
        payload: { arrayBuffer: buffer },
      });

      if (parsedData.length === 0) {
        toast.error("No valid rows found in spreadsheet.");
        return;
      }

      setStagingData(parsedData);
      toast.success(`Loaded ${parsedData.length} items from Excel.`);
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to parse Excel file: ${msg}`);
    }
  };

  const downloadTemplate = async () => {
    try {
      const ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default;
      const workbook = new ExcelJS.Workbook();
      
      const hiddenSheet = workbook.addWorksheet('Hidden_CostCodes', { state: 'hidden' });
      costCodes.forEach((cc, i) => {
        hiddenSheet.getCell(`A${i + 1}`).value = `${cc.code} - ${cc.description}`;
      });

      const sheet = workbook.addWorksheet('Template');
      sheet.columns = [
        { header: 'CSI Number', key: 'csi', width: 15 },
        { header: 'Description', key: 'desc', width: 40 },
        { header: 'Cost Code', key: 'cost_code', width: 40 }
      ];

      if (costCodes.length > 0) {
        for (let i = 2; i <= 1000; i++) {
          sheet.getCell(`C${i}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`Hidden_CostCodes!$A$1:$A$${costCodes.length}`]
          };
        }
      }

      if (projectSpecs.length > 0) {
        projectSpecs.forEach((spec) => {
          let costCodeVal = '';
          if (spec.cost_code) {
            const cc = costCodes.find((c) => c.code === spec.cost_code);
            if (cc) costCodeVal = `${cc.code} - ${cc.description}`;
          }
          sheet.addRow([spec.csi_number, spec.description || '', costCodeVal]);
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'CSI_Spec_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to generate template: ${msg}`);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      handleUpload(droppedFile);
    } else if (droppedFile?.name.endsWith('.xlsx')) {
      handleExcelUpload(droppedFile);
    } else {
      toast.error('Please upload a valid PDF or .xlsx file.');
    }
  }, []);

  function handleUpload(selectedFile: File) {
    if (selectedFile.name.endsWith('.xlsx')) {
      handleExcelUpload(selectedFile);
      return;
    }
    setFile(selectedFile);
    uploadMutation.mutate(selectedFile, {
      onSuccess: (data) => {
        setStagingData(data);
      }
    });
  }

  const handleSave = () => {
    const payload: Partial<ProjectCsiSpec>[] = stagingData.map(d => ({
      id: d.id,
      csi_number: d.csi_number,
      description: d.description,
      cost_code: d.cost_code || null,
      source: 'project' as const,  // Finding 3: Explicitly mark user-uploaded specs
    }));
    
    upsertMutation.mutate(payload, {
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
            Upload your project&apos;s PDF Table of Contents or `.xlsx` template to extract CSI divisions and map them to base Cost Codes using our ML Flywheel.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={downloadTemplate}
            className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <Download size={18} />
            Download Template
          </button>
        
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
      </div>
      <motion.div layout>
        <AnimatePresence mode="popLayout">
          {stagingData.length > 0 ? (
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
          ) : projectSpecs.length > 0 && !showUploadZone ? (
            <motion.div
              key="specs-table"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {!permissionsLoading && (
                <ProjectCsiSpecsTable
                  projectId={projectId}
                  specs={projectSpecs}
                  costCodes={costCodes}
                  onUploadMore={() => setShowUploadZone(true)}
                  permissions={permissions}
                />
              )}
            </motion.div>
          ) : (
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
              {/* Back to Specs link when viewing upload zone with existing specs */}
              {showUploadZone && projectSpecs.length > 0 && (
                <button
                  onClick={() => setShowUploadZone(false)}
                  className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <ArrowLeft size={12} />
                  Back to Specs ({projectSpecs.length})
                </button>
              )}
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
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/40 rounded-full flex items-center justify-center text-sky-600 dark:text-sky-400">
                      <Upload size={28} />
                    </div>
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <FileSpreadsheet size={28} />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-200">Drag &amp; Drop PDF or XLSX Here</h4>
                    <p className="text-sm text-slate-500 mt-1 mb-4">or click to browse your computer</p>
                    <input 
                      type="file" 
                      accept="application/pdf,.xlsx"
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
                  {/* Phase 7: Seed from Company Defaults CTA */}
                  {companyDefaults.length > 0 && projectSpecs.length === 0 && (
                    <div className="mt-4 flex flex-col items-center gap-1">
                      <p className="text-xs text-slate-400 dark:text-slate-500">or</p>
                      <button
                        onClick={() => seedMutation.mutate()}
                        disabled={seedMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 transition-colors disabled:opacity-50"
                      >
                        {seedMutation.isPending ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Building2 size={14} />
                        )}
                        Seed from {companyDefaults.length} Company Default{companyDefaults.length !== 1 ? 's' : ''}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

