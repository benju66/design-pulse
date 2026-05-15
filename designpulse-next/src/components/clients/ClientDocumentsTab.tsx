"use client";
import { useState, useMemo, useRef, useCallback } from 'react';
import { Upload, FileText, Download, Trash2, Search, Paperclip, FileSpreadsheet, Image, File as FileIcon } from 'lucide-react';
import { ClientDocument, ClientBrandStandard } from '@/types/models';
import { useClientDocuments, useUploadClientDocument, useDeleteClientDocument } from '@/hooks/useClientQueries';
import { supabase } from '@/supabaseClient';

interface ClientDocumentsTabProps {
  clientId: string;
  canEdit: boolean;
  brandStandards: ClientBrandStandard[];
}

// File type icon mapping
function FileTypeIcon({ mimeType, className }: { mimeType: string | null; className?: string }) {
  if (!mimeType) return <FileIcon size={16} className={className} />;
  if (mimeType.startsWith('image/')) return <Image size={16} className={className} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet size={16} className={className} />;
  if (mimeType.includes('pdf')) return <FileText size={16} className={className} />;
  return <FileIcon size={16} className={className} />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClientDocumentsTab({ clientId, canEdit, brandStandards }: ClientDocumentsTabProps) {
  const { data: documents = [], isLoading } = useClientDocuments(clientId);
  const uploadMutation = useUploadClientDocument();
  const deleteMutation = useDeleteClientDocument(clientId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [standardFilter, setStandardFilter] = useState<string | null>(null);

  // Filter documents
  const filteredDocs = useMemo(() => {
    let result = documents;
    if (standardFilter === 'library') {
      result = result.filter(d => !d.brand_standard_id);
    } else if (standardFilter) {
      result = result.filter(d => d.brand_standard_id === standardFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.file_name.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [documents, standardFilter, searchQuery]);

  // Unique brand standards that have documents
  const linkedStandards = useMemo(() => {
    const ids = new Set(documents.filter(d => d.brand_standard_id).map(d => d.brand_standard_id!));
    return brandStandards.filter(s => ids.has(s.id));
  }, [documents, brandStandards]);

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      uploadMutation.mutate({
        clientId,
        file,
        brandStandardId: standardFilter === 'library' ? null : standardFilter,
      });
    }
  }, [clientId, standardFilter, uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  const handleDownload = async (doc: ClientDocument) => {
    const { data } = await supabase.storage
      .from('client_documents')
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const getStandardName = (standardId: string | null): string => {
    if (!standardId) return 'Library';
    const found = brandStandards.find(s => s.id === standardId);
    return found ? found.standard_description : 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="animate-in fade-in space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 animate-pulse">
          <div className="h-32 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in space-y-4">
      {/* Upload Zone */}
      {canEdit && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`bg-white dark:bg-slate-900 border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
            isDragging
              ? 'border-sky-400 bg-sky-50/50 dark:bg-sky-900/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700'
          }`}
        >
          <Upload size={28} className={`mx-auto mb-3 ${isDragging ? 'text-sky-500' : 'text-slate-400'}`} />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
            {isDragging ? 'Drop files to upload' : 'Drag & drop files here'}
          </p>
          <p className="text-xs text-slate-400 mb-3">or</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition-colors disabled:opacity-50"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Choose Files'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleUpload(e.target.files);
                e.target.value = '';
              }
            }}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search documents…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-slate-900 dark:text-white"
            />
          </div>
          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setStandardFilter(null)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                !standardFilter ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All ({documents.length})
            </button>
            <button
              onClick={() => setStandardFilter(standardFilter === 'library' ? null : 'library')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                standardFilter === 'library' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Library ({documents.filter(d => !d.brand_standard_id).length})
            </button>
            {linkedStandards.map(s => (
              <button
                key={s.id}
                onClick={() => setStandardFilter(standardFilter === s.id ? null : s.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors truncate max-w-[140px] ${
                  standardFilter === s.id ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title={s.standard_description}
              >
                {s.standard_description}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Documents list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Paperclip size={20} className="text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-semibold mb-1">
              {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
            </p>
            <p className="text-slate-400 text-sm">
              {documents.length === 0 ? 'Upload files to build your client document library.' : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {filteredDocs.map(doc => (
              <div key={doc.id} className="group flex items-center gap-4 px-5 py-3 hover:bg-sky-50/30 dark:hover:bg-sky-900/10 transition-colors">
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <FileTypeIcon mimeType={doc.mime_type} className="text-slate-500" />
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {doc.description && (
                      <span className="text-xs text-slate-500 truncate max-w-[200px]">{doc.description}</span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">{formatFileSize(doc.file_size)}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Linked standard badge */}
                <div className="shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    doc.brand_standard_id
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {getStandardName(doc.brand_standard_id)}
                  </span>
                </div>

                {/* Version */}
                {doc.version > 1 && (
                  <span className="text-[10px] font-mono font-bold text-sky-500 shrink-0">v{doc.version}</span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded transition-colors"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => deleteMutation.mutate(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
