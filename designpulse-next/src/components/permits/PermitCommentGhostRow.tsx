import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useCreatePermitComment } from '@/hooks/usePermitQueries';

interface PermitCommentGhostRowProps {
  projectId: string;
  permitId: string;
}

export function PermitCommentGhostRow({ projectId, permitId }: PermitCommentGhostRowProps) {
  const createMutation = useCreatePermitComment(projectId);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleCreate = () => {
    const val = inputValue.trim();
    if (!val) {
      setIsFocused(false);
      return;
    }
    
    createMutation.mutate({
      permit_id: permitId,
      comment_text: val,
      status: 'Open',
    });
    
    setInputValue('');
    setIsFocused(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      setInputValue('');
      setIsFocused(false);
    }
  };

  return (
    <div 
      className={`
        flex items-center gap-3 px-3 py-2 border-t transition-colors
        ${isFocused 
          ? 'bg-sky-50/50 border-sky-100 dark:bg-sky-900/10 dark:border-sky-900/30' 
          : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50 dark:bg-slate-900/20 dark:border-slate-800 dark:hover:bg-slate-800/50'
        }
      `}
      onClick={() => {
        if (!isFocused) setIsFocused(true);
      }}
    >
      <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
        <Plus className="w-4 h-4" />
      </div>
      
      {isFocused ? (
        <input
          autoFocus
          className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          placeholder="Type a new comment... (Press Enter to save)"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleCreate}
        />
      ) : (
        <div className="flex-1 text-sm text-slate-500 italic cursor-text">
          Add a new plan review comment...
        </div>
      )}
    </div>
  );
}
