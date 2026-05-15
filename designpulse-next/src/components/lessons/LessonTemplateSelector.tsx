import React from 'react';
import { LESSON_TEMPLATES } from '@/lib/lessonTemplates';
import { LessonTemplate } from '@/types/models';
import { FileText } from 'lucide-react';

interface LessonTemplateSelectorProps {
  onSelect: (template: LessonTemplate) => void;
  onCancel: () => void;
}

export const LessonTemplateSelector: React.FC<LessonTemplateSelectorProps> = ({ onSelect, onCancel }) => {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/30 p-6 items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 mb-2">Create New Lesson Learned</h2>
          <p className="text-slate-500 dark:text-slate-400">Select a template to get started or choose a blank entry.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LESSON_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="flex items-start p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 transition-all text-left group"
            >
              <div className="p-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg mr-4 group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">{template.label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  Category: {template.defaultCategory}
                </p>
              </div>
            </button>
          ))}
          
          <button
            onClick={() => onSelect({
              id: 'blank',
              label: 'Blank Template',
              defaultCategory: 'Other',
              whatHappenedPlaceholder: 'What happened?',
              rootCausePlaceholder: 'What was the root cause?',
              recommendationPlaceholder: 'What is the recommendation for future projects?'
            })}
            className="flex items-start p-4 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 transition-all text-left group"
          >
            <div className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg mr-4 group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">Blank Entry</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Start from scratch with no predefined fields.
              </p>
            </div>
          </button>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
