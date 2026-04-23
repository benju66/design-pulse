"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center" />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center justify-center relative overflow-hidden"
      title="Toggle Light/Dark Mode"
      aria-label="Toggle Light/Dark Mode"
    >
      <div className={`transition-transform duration-500 ease-in-out flex items-center justify-center ${isDark ? 'rotate-90 opacity-0 absolute' : 'rotate-0 opacity-100'}`}>
        <Sun size={20} />
      </div>
      <div className={`transition-transform duration-500 ease-in-out flex items-center justify-center ${isDark ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0 absolute'}`}>
        <Moon size={20} />
      </div>
    </button>
  );
}
