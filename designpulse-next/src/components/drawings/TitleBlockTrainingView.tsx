import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, X, CheckCircle, ChevronRight } from 'lucide-react';
import { InspectPdfResponse } from '@/types/map.types';
import { SheetSelection, ModalPhase, ZoneDefinition } from './PdfImportModal.types';

interface TitleBlockTrainingViewProps {
  projectId: string;
  token: string;
  inspectResult: InspectPdfResponse | null;
  selections: SheetSelection[];
  setSelections: React.Dispatch<React.SetStateAction<SheetSelection[]>>;
  onComplete: () => void;
  setPhase: (phase: ModalPhase) => void;
}

export function TitleBlockTrainingView({
  projectId,
  token,
  inspectResult,
  selections,
  setSelections,
  onComplete,
  setPhase
}: TitleBlockTrainingViewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadingImg, setLoadingImg] = useState(true);
  
  const [zones, setZones] = useState<ZoneDefinition[]>([]);
  const [activeField, setActiveField] = useState<'sheetName' | 'drawingTitle'>('sheetName');
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  
  const [livePreview, setLivePreview] = useState<Record<string, string>>({});
  const [previewError, setPreviewError] = useState(false);
  const [previewExpired, setPreviewExpired] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    let localBlobUrl: string | null = null;
    const fetchPreview = async () => {
      if (!inspectResult?.staged_key) return;
      setLoadingImg(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const url = `${apiUrl}/drawings/preview/${projectId}/${inspectResult.staged_key}/0`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to load preview');
        const blob = await res.blob();
        if (isMounted) {
          localBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(localBlobUrl);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingImg(false);
      }
    };
    fetchPreview();
    return () => {
      isMounted = false;
      if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
    };
  }, [inspectResult?.staged_key, projectId, token]);

  // Debounced Live Preview
  useEffect(() => {
    if (zones.length === 0 || !inspectResult) {
      setLivePreview({});
      setPreviewError(false);
      return;
    }
    
    let isMounted = true;
    
    const fetchLivePreview = async () => {
      setPreviewError(false);
      setPreviewExpired(false);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${apiUrl}/drawings/extract/${projectId}/${inspectResult.staged_key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            zones,
            page_indices: [0] // Preview only first page
          })
        });
        
        if (res.status === 404) {
          if (isMounted) setPreviewExpired(true);
          return;
        }
        
        if (!res.ok) throw new Error('Preview failed');
        const data = await res.json();
        
        if (isMounted && data.length > 0) {
           const extracted = data[0];
           setLivePreview(prev => {
             const newPreview = { ...prev };
             if (extracted.sheetName) newPreview.sheetName = extracted.sheetName;
             if (extracted.drawingTitle) newPreview.drawingTitle = extracted.drawingTitle;
             return newPreview;
           });
           
           // If zones exist but nothing was extracted, flag vector error
           if (!extracted.sheetName && !extracted.drawingTitle) {
             setPreviewError(true);
           }
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    const timer = setTimeout(fetchLivePreview, 500);
    return () => clearTimeout(timer);
  }, [zones, inspectResult, projectId, token]);

  // Auto-scroll to bottom right once image is loaded
  useEffect(() => {
    if (blobUrl && !loadingImg && containerRef.current) {
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
          containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        }
      }, 100);
    }
  }, [blobUrl, loadingImg]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));
    
    setIsDrawing(true);
    setStartPos({ x: clampedX, y: clampedY });
    setCurrentPos({ x: clampedX, y: clampedY });
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentPos({ 
      x: Math.max(0, Math.min(1, x)), 
      y: Math.max(0, Math.min(1, y)) 
    });
  };
  
  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(currentPos.x - startPos.x);
    const h = Math.abs(currentPos.y - startPos.y);
    
    if (w > 0.01 && h > 0.01) {
      setZones(prev => {
        const filtered = prev.filter(z => z.field !== activeField);
        return [...filtered, { field: activeField, rect: [x, y, w, h] }];
      });
      if (activeField === 'sheetName') setActiveField('drawingTitle');
    }
  };

  const executeExtraction = async () => {
    if (zones.length === 0 || !inspectResult) return;
    setPhase('extracting');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const pageIndices = selections.filter(s => s.selected).map(s => s.pageIndex);
      
      const res = await fetch(`${apiUrl}/drawings/extract/${projectId}/${inspectResult.staged_key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          zones,
          page_indices: pageIndices
        })
      });
      
      if (!res.ok) throw new Error('Extraction failed');
      const data = await res.json();
      
      setSelections(prev => {
        const newSel = [...prev];
        data.forEach((extracted: any) => {
          const idx = newSel.findIndex(s => s.pageIndex === extracted.pageIndex);
          if (idx !== -1) {
             if (extracted.sheetName) newSel[idx].sheetName = extracted.sheetName;
             if (extracted.drawingTitle) newSel[idx].drawingTitle = extracted.drawingTitle;
          }
        });
        return newSel;
      });
      
      onComplete(); // move to wizard phase
    } catch (e) {
      console.error(e);
      onComplete(); // Fallback to wizard even if extraction fails
    }
  };

  return (
    <div className="flex gap-6 h-[600px] min-h-0 w-full pt-4">
      {/* Main Preview Pane */}
      <div 
        ref={containerRef}
        className="flex-1 bg-slate-900 rounded-2xl border border-white/10 overflow-auto relative touch-none select-none scroll-smooth"
      >
        {loadingImg ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        ) : blobUrl ? (
          <div 
            className="relative min-w-[250%] w-max cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img 
              ref={imageRef}
              src={blobUrl} 
              alt="Training Preview" 
              className="w-full h-auto pointer-events-none"
              draggable={false}
            />
            {/* Render Saved Zones */}
            {zones.map((z, i) => (
              <div
                key={i}
                className={`absolute border-2 transition-colors group ${z.field === 'sheetName' ? 'border-sky-400 bg-sky-400/20 hover:border-sky-300' : 'border-emerald-400 bg-emerald-400/20 hover:border-emerald-300'}`}
                style={{
                  left: `${z.rect[0] * 100}%`,
                  top: `${z.rect[1] * 100}%`,
                  width: `${z.rect[2] * 100}%`,
                  height: `${z.rect[3] * 100}%`,
                }}
              >
                {/* Zero-JS Tooltip */}
                {livePreview[z.field] && (
                  <span className="absolute -bottom-8 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap border border-white/10 z-50 pointer-events-none shadow-xl">
                    Preview: {livePreview[z.field]}
                  </span>
                )}
                
                {/* Hover Delete Button */}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                     e.stopPropagation();
                     setZones(prev => prev.filter(zone => zone.field !== z.field));
                     setLivePreview(prev => {
                       const next = { ...prev };
                       delete next[z.field];
                       return next;
                     });
                  }}
                  className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 rounded-full text-white items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex hover:bg-red-400 z-50"
                  type="button"
                >
                  <X className="w-3 h-3" />
                </button>

                <span className="absolute -top-6 left-0 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap border border-white/10 pointer-events-none">
                  {z.field === 'sheetName' ? 'Drawing Number' : 'Drawing Title'}
                </span>
              </div>
            ))}
            {/* Render Active Drawing Box */}
            {isDrawing && imageRef.current && (
              <div
                className={`absolute border-2 border-dashed ${activeField === 'sheetName' ? 'border-sky-400 bg-sky-400/20' : 'border-emerald-400 bg-emerald-400/20'}`}
                style={{
                  left: `${Math.min(startPos.x, currentPos.x) * 100}%`,
                  top: `${Math.min(startPos.y, currentPos.y) * 100}%`,
                  width: `${Math.abs(currentPos.x - startPos.x) * 100}%`,
                  height: `${Math.abs(currentPos.y - startPos.y) * 100}%`,
                  pointerEvents: 'none'
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-slate-500 text-sm">Failed to load preview.</span>
          </div>
        )}
      </div>

      {/* Sidebar Editor */}
      <div className="w-[320px] shrink-0 bg-slate-900/50 p-5 rounded-2xl border border-white/5 flex flex-col gap-6 relative">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-100">Train Extractor</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Drag a box over the Drawing Number and Title regions on this sheet.
          </p>
        </div>

        {previewExpired && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Session expired. Please close this modal and re-import the PDF to continue.</p>
          </div>
        )}

        {previewError && !previewExpired && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs p-3 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>No text found in boxes. If this is an AutoCAD vector sheet, you may need to enter text manually in the next step.</p>
          </div>
        )}

        <div className="space-y-4 flex-1">
           <div className="relative group">
             <button
               onClick={() => setActiveField('sheetName')}
               className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex flex-col gap-1 ${
                 activeField === 'sheetName' 
                   ? 'border-sky-500 bg-sky-500/10' 
                   : 'border-white/5 bg-slate-950 hover:border-white/20'
               }`}
             >
               <div className="flex items-center justify-between">
                 <span className={`text-sm font-semibold ${activeField === 'sheetName' ? 'text-sky-400' : 'text-slate-300'}`}>
                   1. Drawing Number
                 </span>
                 {zones.find(z => z.field === 'sheetName') && (
                   <CheckCircle className="w-4 h-4 text-sky-400" />
                 )}
               </div>
               <span className="text-xs text-slate-500 truncate">
                 {livePreview['sheetName'] ? <span className="text-sky-400/80">Preview: {livePreview['sheetName']}</span> : 'Click and drag over the sheet number.'}
               </span>
             </button>
             {zones.find(z => z.field === 'sheetName') && (
               <button
                 onClick={() => {
                   setZones(prev => prev.filter(z => z.field !== 'sheetName'));
                   setLivePreview(prev => { const n = {...prev}; delete n['sheetName']; return n; });
                 }}
                 className="absolute top-3 right-10 text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                 title="Clear Selection"
               >
                 <X className="w-4 h-4" />
               </button>
             )}
           </div>

           <div className="relative group">
             <button
               onClick={() => setActiveField('drawingTitle')}
               className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex flex-col gap-1 ${
                 activeField === 'drawingTitle' 
                   ? 'border-emerald-500 bg-emerald-500/10' 
                   : 'border-white/5 bg-slate-950 hover:border-white/20'
               }`}
             >
               <div className="flex items-center justify-between">
                 <span className={`text-sm font-semibold ${activeField === 'drawingTitle' ? 'text-emerald-400' : 'text-slate-300'}`}>
                   2. Drawing Title
                 </span>
                 {zones.find(z => z.field === 'drawingTitle') && (
                   <CheckCircle className="w-4 h-4 text-emerald-400" />
                 )}
               </div>
               <span className="text-xs text-slate-500 truncate">
                 {livePreview['drawingTitle'] ? <span className="text-emerald-400/80">Preview: {livePreview['drawingTitle']}</span> : 'Click and drag over the sheet title.'}
               </span>
             </button>
             {zones.find(z => z.field === 'drawingTitle') && (
               <button
                 onClick={() => {
                   setZones(prev => prev.filter(z => z.field !== 'drawingTitle'));
                   setLivePreview(prev => { const n = {...prev}; delete n['drawingTitle']; return n; });
                 }}
                 className="absolute top-3 right-10 text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                 title="Clear Selection"
               >
                 <X className="w-4 h-4" />
               </button>
             )}
           </div>
        </div>

        <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
          <button 
            onClick={executeExtraction}
            disabled={zones.length === 0}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
          >
            Extract {selections.filter(s => s.selected).length} Sheets
            <ChevronRight size={18} />
          </button>
          <button 
            onClick={onComplete}
            className="w-full py-2.5 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
          >
            Skip & Review Manually
          </button>
        </div>
      </div>
    </div>
  );
}
