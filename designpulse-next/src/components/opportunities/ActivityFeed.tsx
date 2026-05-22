"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useActivityFeed, useAddComment, useDeleteComment } from '@/hooks/useItemActivity';
import { useProjectMembers, useCurrentUserPermissions } from '@/hooks/useProjectCoreQueries';
import { formatDistanceToNow } from 'date-fns';
import { User, Shield, MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';

interface ActivityFeedProps {
  opportunityId?: string;
  lessonId?: string;
  permitId?: string;
  deliverableId?: string;
  projectId: string;
}

export const ActivityFeed = ({ opportunityId, lessonId, permitId, deliverableId, projectId }: ActivityFeedProps) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useActivityFeed({ opportunityId, lessonId, permitId, deliverableId });
  const addComment = useAddComment({ opportunityId, lessonId, permitId, deliverableId }, projectId);
  const deleteComment = useDeleteComment({ opportunityId, lessonId, permitId, deliverableId });
  const { data: members = [] } = useProjectMembers(projectId);
  const { permissions } = useCurrentUserPermissions(projectId);
  const { session } = useAuth();
  const user = session?.user;

  const [commentText, setCommentText] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [includeInOAC, setIncludeInOAC] = useState(false);
  
  // Mentions Popover State
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const mentionsRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Click-outside logic for mentions dropdown (AGENTS.md Rule 16)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (showMentions && mentionsRef.current && !mentionsRef.current.contains(e.target as Node)) {
        setShowMentions(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showMentions]);

  // Escape key logic (AGENTS.md Rule 18)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      if (showMentions) {
        setShowMentions(false);
        e.preventDefault();
      }
      // If we wanted to auto-save a draft, we could do it here
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);

    // Naive mention trigger logic
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPosition);
    const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionFilter(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (userId: string, userName: string) => {
    setMentions(prev => [...new Set([...prev, userId])]);
    
    // Replace the `@...` with `@UserName `
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = commentText.slice(0, cursorPosition);
    const textAfterCursor = commentText.slice(cursorPosition);
    
    const newTextBeforeCursor = textBeforeCursor.replace(/@([a-zA-Z0-9_]*)$/, `@${userName} `);
    
    setCommentText(newTextBeforeCursor + textAfterCursor);
    setShowMentions(false);
    
    // Refocus
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newTextBeforeCursor.length, newTextBeforeCursor.length);
    }, 0);
  };

  const handleSubmit = () => {
    if (!commentText.trim()) return;
    
    addComment.mutate({
      id: crypto.randomUUID(),
      content: commentText.trim(),
      mentions: mentions,
      include_in_oac: includeInOAC,
      author_id: user?.id
    });

    setCommentText('');
    setMentions([]);
    setIncludeInOAC(false);
  };

  const allItems = data?.pages.flatMap(page => page.data) || [];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-lg">
      {/* Feed List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading && <div className="text-sm text-slate-500 animate-pulse">Loading activity...</div>}
        
        {allItems.map((item) => {
          const isSystem = item.activity_type === 'system_log';
          const isAuthor = user?.id === item.author_id;
          
          if (isSystem) {
            return (
              <div key={item.id} className="relative pl-6">
                <div className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 ring-4 ring-slate-50 dark:ring-slate-900/50" />
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-slate-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">System: </span>
                    {item.content}
                  </p>
                </div>
                <span className="text-xs text-slate-400 block mt-0.5 ml-5" title={new Date(item.created_at).toLocaleString()}>
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </span>
              </div>
            );
          }

          // User Comment
          const authorMember = members.find(m => m.user_id === item.author_id);
          const authorInitials = authorMember?.name?.substring(0, 2).toUpperCase() || 'U';

          return (
            <div key={item.id} className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-700 dark:text-sky-300 font-bold text-xs border border-sky-200 dark:border-sky-800">
                {authorInitials}
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm relative group">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {authorMember?.name || 'Unknown User'}
                    </span>
                    <span className="text-xs text-slate-400" title={new Date(item.created_at).toLocaleString()}>
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                    {item.include_in_oac && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        OAC
                      </span>
                    )}
                  </div>
                  {isAuthor && !item.is_deleted && (
                    <button 
                      onClick={() => {
                        if(window.confirm('Delete this comment?')) {
                          deleteComment.mutate(item.id);
                        }
                      }}
                      className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {item.content}
                </div>
              </div>
            </div>
          );
        })}
        
        {hasNextPage && (
          <div className="flex justify-center pt-2">
            <button 
              onClick={() => fetchNextPage()} 
              disabled={isFetchingNextPage}
              className="text-sm font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load older activity'}
            </button>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-b-lg relative">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={!permissions.can_edit_records}
            placeholder={permissions.can_edit_records ? "Add a comment... (Type @ to tag)" : "You don't have permission to comment."}
            className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none min-h-[80px]"
          />
          
          {/* Mentions Popover */}
          {showMentions && (
            <div 
              ref={mentionsRef}
              className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-50"
            >
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-500">
                Tag Team Member
              </div>
              <div className="max-h-48 overflow-y-auto">
                {members
                  .filter(m => !mentionFilter || (m.name || '').toLowerCase().includes(mentionFilter))
                  .map(m => (
                    <button
                      key={m.user_id}
                      onClick={() => handleMentionSelect(m.user_id, m.name || 'User')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-sky-50 dark:hover:bg-sky-900/20 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-2"
                    >
                      <User size={14} className="text-slate-400" />
                      {m.name || m.email}
                    </button>
                  ))}
                {members.filter(m => !mentionFilter || (m.name || '').toLowerCase().includes(mentionFilter)).length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-500 text-center">No matches found.</div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center mt-3">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${includeInOAC ? 'bg-amber-500 border-amber-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-amber-400'}`}>
              {includeInOAC && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={includeInOAC} 
              onChange={(e) => setIncludeInOAC(e.target.checked)}
              disabled={!permissions.can_edit_records}
            />
            <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
              Flag for OAC Minutes
            </span>
          </label>
          
          <button 
            onClick={handleSubmit}
            disabled={!commentText.trim() || !permissions.can_edit_records || addComment.isPending}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {addComment.isPending ? 'Sending...' : 'Send'}
            <MessageSquare size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
