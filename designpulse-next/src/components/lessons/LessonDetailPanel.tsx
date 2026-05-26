import React, { useState } from 'react';
import { ProjectLesson, LessonStatus, LessonSeverity, LessonCategory, LessonPhase } from '@/types/models';
import { useUpdateLesson, useUpdateLessonStatus } from '@/hooks/useLessonQueries';
import { useCostCodes } from '@/hooks/useGlobalQueries';
import { ActivityFeed } from '@/components/opportunities/ActivityFeed';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { SmartCostCodeCombobox } from '@/components/ui/SmartCostCodeCombobox';
import { X, Save, Lock, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface LessonDetailPanelProps {
  lesson: ProjectLesson;
  projectId: string;
  onClose: () => void;
  canEdit: boolean;
}

export const LessonDetailPanel: React.FC<LessonDetailPanelProps> = ({
  lesson,
  projectId,
  onClose,
  canEdit
}) => {
  const [localData, setLocalData] = useState<ProjectLesson>(lesson);
  const [isDirty, setIsDirty] = useState(false);
  const updateLesson = useUpdateLesson(projectId);
  const updateStatus = useUpdateLessonStatus(projectId);
  const { data: costCodes = [] } = useCostCodes();

  const [prevLesson, setPrevLesson] = useState(lesson);
  if (lesson.id !== prevLesson.id || lesson.updated_at !== prevLesson.updated_at) {
    setPrevLesson(lesson);
    setLocalData(lesson);
    setIsDirty(false);
  }

  const handleChange = <K extends keyof ProjectLesson>(field: K, value: ProjectLesson[K]) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!canEdit) return;
    updateLesson.mutate({
      id: lesson.id,
      title: localData.title,
      what_happened: localData.what_happened,
      root_cause: localData.root_cause,
      recommendation: localData.recommendation,
      category: localData.category,
      severity: localData.severity,
      phase: localData.phase,
      cost_code: localData.cost_code
    }, {
      onSuccess: () => {
        setIsDirty(false);
        toast.success('Lesson updated');
      }
    });
  };

  const handleStatusChange = (newStatus: LessonStatus) => {
    if (!canEdit) return;
    
    // Check if transitioning out of Verified
    if (lesson.status === 'Verified' && newStatus !== 'Verified') {
      if (!window.confirm('This lesson is verified. Are you sure you want to reopen it?')) {
        return;
      }
    }
    
    updateStatus.mutate({ id: lesson.id, status: newStatus }, {
      onSuccess: () => {
        toast.success(`Status updated to ${newStatus}`);
      }
    });
  };

  const isVerified = lesson.status === 'Verified';
  const isReadonly = !canEdit || isVerified;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-[500px] shadow-2xl flex-shrink-0 z-20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
            {lesson.display_id || 'New'}
          </span>
          {isVerified && (
            <span className="gap-1 flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Lock size={12} /> Verified
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <Save size={16} /> Save
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Immutability Banner */}
        {isVerified && canEdit && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg flex gap-3 text-sm text-amber-800 dark:text-amber-300">
            <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Record Locked</p>
              <p className="opacity-90">This lesson has been verified and is immutable. You must change the status to Draft or Submitted to edit contents.</p>
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Title</label>
          <input
            type="text"
            value={localData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            disabled={isReadonly}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
          />
        </div>

        {/* Status & Metadata Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Status</label>
            <select
              value={lesson.status}
              onChange={(e) => handleStatusChange(e.target.value as LessonStatus)}
              disabled={!canEdit}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
            >
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="Verified">Verified</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Severity</label>
            <select
              value={localData.severity}
              onChange={(e) => handleChange('severity', e.target.value as LessonSeverity)}
              disabled={isReadonly}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Informational">Informational</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Category</label>
            <select
              value={localData.category}
              onChange={(e) => handleChange('category', e.target.value as LessonCategory)}
              disabled={isReadonly}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
            >
              <option value="Design">Design</option>
              <option value="Constructability">Constructability</option>
              <option value="Cost">Cost</option>
              <option value="Schedule">Schedule</option>
              <option value="Safety">Safety</option>
              <option value="Procurement">Procurement</option>
              <option value="Coordination">Coordination</option>
              <option value="Client/Owner">Client/Owner</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Phase</label>
            <select
              value={localData.phase}
              onChange={(e) => handleChange('phase', e.target.value as LessonPhase)}
              disabled={isReadonly}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
            >
              <option value="Pre-Construction">Pre-Construction</option>
              <option value="Design Development">Design Development</option>
              <option value="Construction Documents">Construction Documents</option>
              <option value="Buyout">Buyout</option>
              <option value="Construction">Construction</option>
              <option value="Closeout">Closeout</option>
            </select>
          </div>
        </div>

        {/* Cost Code Mapping */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Cost Code Taxonomy Mapping</label>
          <div className="h-9 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden bg-slate-50 dark:bg-slate-900">
            <SmartCostCodeCombobox
              value={localData.cost_code}
              onChange={(updates) => {
                if (updates.cost_code !== undefined) {
                  handleChange('cost_code', updates.cost_code);
                }
              }}
              rawCostCodes={costCodes}
              disabled={isReadonly}
              showCostTypeSegment={false}
              mode="cost_code_only"
            />
          </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-800" />

        {/* Text Areas */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">What Happened</label>
          <div className="border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <RichTextEditor
              content={localData.what_happened || ''}
              onSave={(html) => handleChange('what_happened', html)}
              disabled={isReadonly}
              placeholder="Describe the material that was substituted and what issue arose..."
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Root Cause</label>
          <div className="border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <RichTextEditor
              content={localData.root_cause || ''}
              onSave={(html) => handleChange('root_cause', html)}
              disabled={isReadonly}
              placeholder="Why was the substitute material incompatible or inadequate?"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Recommendation</label>
          <div className="border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <RichTextEditor
              content={localData.recommendation || ''}
              onSave={(html) => handleChange('recommendation', html)}
              disabled={isReadonly}
              placeholder="What checks should be performed before approving material substitutions?"
            />
          </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-800" />

        {/* Activity Feed */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Discussion & Audit Log</h3>
          <div className="h-[400px]">
            <ActivityFeed lessonId={lesson.id} projectId={projectId} />
          </div>
        </div>

      </div>
    </div>
  );
};
