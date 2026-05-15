'use client';
/**
 * TabInfoTooltip — Zero-JS inline tooltip for analytics tab descriptions.
 *
 * Uses the group-hover Tailwind pattern (AGENTS.md C17) for instant,
 * no-JS tooltips. Wraps the Lucide Info icon in a span (C17: Lucide
 * doesn't accept title prop).
 */
import { Info } from 'lucide-react';

interface TabInfoTooltipProps {
  description: string;
}

export function TabInfoTooltip({ description }: TabInfoTooltipProps) {
  return (
    <span className="relative group inline-flex items-center ml-1.5">
      <span title={description}>
        <Info
          size={13}
          className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors cursor-help"
        />
      </span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-800 text-white text-[11px] leading-relaxed rounded-lg p-2.5 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100]">
        {description}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </span>
  );
}
