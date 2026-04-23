import MarkupCanvas from '@/components/MarkupCanvas';

export default function ProjectPage({ params }) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left side: Markup Canvas */}
      <div className="flex-1 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 relative">
        <MarkupCanvas />
      </div>
      
      {/* Right side: VE Data Grid */}
      <div className="w-1/2 h-full bg-white dark:bg-gray-950 flex flex-col p-4">
        <h2 className="text-xl font-bold mb-4">Value Engineering (VE) Log</h2>
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">TanStack Data Grid will go here</p>
        </div>
      </div>
    </div>
  );
}
