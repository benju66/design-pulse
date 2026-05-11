import React, { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { InspectPdfResponse } from '@/types/map.types';
import { SheetSelection } from './PdfImportModal.types';

interface WizardViewProps {
  projectId: string;
  token: string;
  inspectResult: InspectPdfResponse | null;
  selections: SheetSelection[];
  currentWizardIndex: number;
  setCurrentWizardIndex: React.Dispatch<React.SetStateAction<number>>;
  toggleOne: (pageIndex: number) => void;
  updateField: (pageIndex: number, field: keyof SheetSelection, value: string | boolean) => void;
}

export function WizardView({
  projectId,
  token,
  inspectResult,
  selections,
  currentWizardIndex,
  setCurrentWizardIndex,
  toggleOne,
  updateField
}: WizardViewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const currentSel = selections[currentWizardIndex];
  const pageIndex = currentSel?.pageIndex;
  const stagedKey = inspectResult?.staged_key;

  useEffect(() => {
    let isMounted = true;
    let localBlobUrl: string | null = null;

    const fetchPreview = async () => {
      if (!stagedKey || pageIndex === undefined) return;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const url = `${apiUrl}/drawings/preview/${projectId}/${stagedKey}/${pageIndex}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error('Failed to load preview');
        const blob = await res.blob();
        if (isMounted) {
          localBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(localBlobUrl);
        }
      } catch (err) {
        if (isMounted) setPreviewError('Failed to load preview image');
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    };
    
    fetchPreview();
    
    return () => {
      isMounted = false;
      if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
    };
  }, [pageIndex, stagedKey, projectId, token]);

  if (!inspectResult || selections.length === 0) return null;
  if (!currentSel) return null;

  const handleNext = () => {
    if (currentWizardIndex < selections.length - 1) {
      setCurrentWizardIndex(i => i + 1);
    }
  };
  const handlePrev = () => {
    if (currentWizardIndex > 0) {
      setCurrentWizardIndex(i => i - 1);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
       e.preventDefault();
       handleNext();
    }
  };

  return (
    <div className="flex gap-6 h-[600px] min-h-0 w-full pt-4">
      {/* Main Preview Pane */}
      <div className="flex-1 bg-slate-900 rounded-2xl border border-white/10 overflow-hidden relative group">
        {previewLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
          </div>
        ) : previewError ? (
          <div className="w-full h-full flex flex-col gap-2 items-center justify-center text-slate-400">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm">{previewError}</p>
          </div>
        ) : blobUrl ? (
          <TransformWrapper initialScale={1} minScale={0.5} maxScale={5} centerOnInit>
            <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
              <img 
                 src={blobUrl} 
                 className="max-w-full max-h-full object-contain"
                 alt="Sheet Preview"
                 loading="lazy"
              />
            </TransformComponent>
          </TransformWrapper>
        ) : null}
        
        {/* Navigation Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-950/90 backdrop-blur px-2 py-2 rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl">
           <button onClick={handlePrev} disabled={currentWizardIndex === 0} className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/10 disabled:opacity-30 transition-colors font-medium text-sm">Previous</button>
           <span className="text-white text-sm font-semibold px-2">Page {currentWizardIndex + 1} of {selections.length}</span>
           <button onClick={handleNext} disabled={currentWizardIndex === selections.length - 1} className="px-4 py-2 rounded-xl bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 disabled:opacity-30 transition-colors font-medium text-sm">Next</button>
        </div>
      </div>
      
      {/* Sidebar Editor */}
      <div className="w-[320px] shrink-0 bg-slate-900/50 p-5 rounded-2xl border border-white/5 flex flex-col gap-6">
         <div className="flex justify-between items-center pb-4 border-b border-white/10">
            <h3 className="font-semibold text-slate-200">Sheet Metadata</h3>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors">
               <input 
                 type="checkbox" 
                 checked={currentSel.selected} 
                 onChange={() => toggleOne(currentSel.pageIndex)} 
                 className="w-4 h-4 rounded border-white/20 text-sky-500 focus:ring-sky-500/50 bg-slate-950"
               />
               Import Sheet
            </label>
         </div>
         
         <div className="flex-1 space-y-5 overflow-y-auto pr-1" onKeyDown={handleKeyDown}>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Drawing Number</label>
              <input 
                value={currentSel.sheetName} 
                onChange={e => updateField(currentSel.pageIndex, 'sheetName', e.target.value)} 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-inner" 
                placeholder="e.g. A101"
                autoFocus 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Drawing Title</label>
              <input 
                value={currentSel.drawingTitle} 
                onChange={e => updateField(currentSel.pageIndex, 'drawingTitle', e.target.value)} 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-inner" 
                placeholder="e.g. Floor Plan"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Revision</label>
              <input 
                value={currentSel.revision} 
                onChange={e => updateField(currentSel.pageIndex, 'revision', e.target.value)} 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-inner" 
                placeholder="e.g. 1"
              />
            </div>
         </div>
         
         <div className="pt-4 border-t border-white/10">
           <button 
              onClick={handleNext} 
              disabled={currentWizardIndex === selections.length - 1}
              className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
           >
              {currentWizardIndex === selections.length - 1 ? 'Last Sheet' : 'Next Sheet'}
              {currentWizardIndex !== selections.length - 1 && <ChevronRight size={18} />}
           </button>
         </div>
      </div>
    </div>
  );
}
