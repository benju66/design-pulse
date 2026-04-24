"use client";
import React, { useState, useEffect } from 'react';
import { Plus, X, GripVertical, Save, RefreshCw, Layers, LayoutDashboard, Eye, EyeOff, Info, Map } from 'lucide-react';
import { useProjectSettings, useUpdateProjectSettings } from '@/hooks/useProjectQueries';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as LucideIcons from 'lucide-react';

const SortableItem = ({ id, content, onRemove, renderExtra }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl group transition-colors hover:border-sky-300 dark:hover:border-sky-700 bg-white dark:bg-slate-900"
    >
       <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-3">
         <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-400 p-1 hover:text-sky-500 rounded">
           <GripVertical size={16} />
         </div>
         {content}
       </span>
       <div className="flex gap-2">
         {renderExtra && renderExtra()}
         {onRemove && (
           <button 
             onClick={onRemove} 
             className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100"
             title="Remove"
           >
             <X size={16} strokeWidth={2.5} />
           </button>
         )}
       </div>
    </div>
  );
};

export const ProjectSettings = ({ projectId }) => {
  const { data: settings, isLoading } = useProjectSettings(projectId);
  const updateSettings = useUpdateProjectSettings(projectId);
  
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'categories' | 'scopes' | 'sidebar'
  
  const [categories, setCategories] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [sidebarItems, setSidebarItems] = useState([]);
  
  const [projectInfo, setProjectInfo] = useState({
    project_name: '',
    location: '',
    original_budget: 0,
    enable_audit_logging: false
  });
  
  const [newCat, setNewCat] = useState('');
  const [newScope, setNewScope] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setCategories(settings.categories || []);
      setScopes(settings.scopes || []);
      setSidebarItems(settings.sidebar_items || []);
      setProjectInfo({
        project_name: settings.project_name || projectId,
        location: settings.location || '',
        original_budget: settings.original_budget || 0,
        enable_audit_logging: settings.enable_audit_logging || false
      });
      setHasChanges(false);
    }
  }, [settings, projectId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addCat = () => {
    if (newCat.trim() && !categories.includes(newCat.trim())) {
      setCategories([...categories, newCat.trim()]);
      setNewCat('');
      setHasChanges(true);
    }
  };

  const addScope = () => {
    if (newScope.trim() && !scopes.includes(newScope.trim())) {
      setScopes([...scopes, newScope.trim()]);
      setNewScope('');
      setHasChanges(true);
    }
  };

  const handleDragEndCategories = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = categories.indexOf(active.id);
      const newIndex = categories.indexOf(over.id);
      setCategories(arrayMove(categories, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const handleDragEndScopes = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = scopes.indexOf(active.id);
      const newIndex = scopes.indexOf(over.id);
      setScopes(arrayMove(scopes, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const handleDragEndSidebar = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sidebarItems.findIndex(i => i.id === active.id);
      const newIndex = sidebarItems.findIndex(i => i.id === over.id);
      setSidebarItems(arrayMove(sidebarItems, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  const toggleSidebarItem = (id) => {
    setSidebarItems(items => items.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    ));
    setHasChanges(true);
  };

  const handleInfoChange = (field, value) => {
    setProjectInfo(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings.mutate(
      { 
        categories,
        scopes,
        sidebar_items: sidebarItems,
        project_name: projectInfo.project_name,
        location: projectInfo.location,
        original_budget: Number(projectInfo.original_budget),
        enable_audit_logging: Boolean(projectInfo.enable_audit_logging)
      },
      { onSuccess: () => setHasChanges(false) }
    );
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Project Settings</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configure global preferences for {projectId}</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={!hasChanges || updateSettings.isPending}
          className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateSettings.isPending ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-800">
        <button 
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'info' 
              ? 'border-sky-500 text-sky-600 dark:text-sky-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Info size={18} />
          Project Info
        </button>
        <button 
          onClick={() => setActiveTab('scopes')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'scopes' 
              ? 'border-sky-500 text-sky-600 dark:text-sky-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Map size={18} />
          Project Scopes
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'categories' 
              ? 'border-sky-500 text-sky-600 dark:text-sky-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Layers size={18} />
          Opportunity Categories
        </button>
        <button 
          onClick={() => setActiveTab('sidebar')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === 'sidebar' 
              ? 'border-sky-500 text-sky-600 dark:text-sky-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <LayoutDashboard size={18} />
          Sidebar Menu
        </button>
      </div>
      
      {activeTab === 'info' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Project Information</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Basic details about this project. These will be used in exports and dashboard summaries.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project Name</label>
              <input 
                type="text" 
                value={projectInfo.project_name}
                onChange={e => handleInfoChange('project_name', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium"
                placeholder="e.g. Acme Headquarters"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Location</label>
              <input 
                type="text" 
                value={projectInfo.location}
                onChange={e => handleInfoChange('location', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium"
                placeholder="e.g. New York, NY"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mt-6">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 mb-4">Financials</h3>
            <div className="w-1/2 pr-3 space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Original Budget</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                <input 
                  type="number" 
                  value={projectInfo.original_budget}
                  onChange={e => handleInfoChange('original_budget', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium"
                  placeholder="5000000"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">This value sets the baseline for the Value Engineering Matrix.</p>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mt-6">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 mb-4">Security & Compliance</h3>
            <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enable Audit Logging</p>
                <p className="text-xs text-slate-500 mt-1">Track all row-level changes (INSERT/UPDATE/DELETE) in the database.</p>
              </div>
              <button 
                type="button"
                onClick={() => handleInfoChange('enable_audit_logging', !projectInfo.enable_audit_logging)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                  projectInfo.enable_audit_logging ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                title={projectInfo.enable_audit_logging ? "Disable audit logging" : "Enable audit logging"}
              >
                <span 
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                    projectInfo.enable_audit_logging ? 'translate-x-6' : 'translate-x-1'
                  }`} 
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'scopes' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Project Scopes / Filtering Tabs</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Define the physical scopes or locations within your project (e.g., Corridor, Exterior, Units). These become the main filter tabs at the top of the VE Matrix and can be assigned to items in the grid.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndScopes}>
            <SortableContext items={scopes} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-6">
                {scopes.map((scope) => (
                  <SortableItem 
                    key={scope} 
                    id={scope} 
                    content={scope} 
                    onRemove={() => {
                      setScopes(scopes.filter(s => s !== scope));
                      setHasChanges(true);
                    }} 
                  />
                ))}
                {scopes.length === 0 && (
                  <div className="p-4 text-center text-sm text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                    No scopes defined.
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex gap-3">
             <input 
               type="text" 
               value={newScope}
               onChange={e => setNewScope(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && addScope()}
               placeholder="Add a new project scope..." 
               className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium"
             />
             <button 
               onClick={addScope} 
               disabled={!newScope.trim()}
               className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
             >
               <Plus size={18} /> Add
             </button>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Custom Dropdown Categories</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Customize the options available when classifying a VE or Alternate contender. Drag to reorder.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCategories}>
            <SortableContext items={categories} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-6">
                {categories.map((cat) => (
                  <SortableItem 
                    key={cat} 
                    id={cat} 
                    content={cat} 
                    onRemove={() => {
                      setCategories(categories.filter(c => c !== cat));
                      setHasChanges(true);
                    }} 
                  />
                ))}
                {categories.length === 0 && (
                  <div className="p-4 text-center text-sm text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                    No custom categories defined.
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex gap-3">
             <input 
               type="text" 
               value={newCat}
               onChange={e => setNewCat(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && addCat()}
               placeholder="Type a new category name..." 
               className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-shadow font-medium"
             />
             <button 
               onClick={addCat} 
               disabled={!newCat.trim()}
               className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
             >
               <Plus size={18} /> Add
             </button>
          </div>
        </div>
      )}

      {activeTab === 'sidebar' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Sidebar Layout Configuration</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Drag items to rearrange the left navigation bar. Toggle visibility to hide unused features.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndSidebar}>
            <SortableContext items={sidebarItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 mb-6">
                {sidebarItems.map((item) => {
                  const Icon = LucideIcons[item.iconName] || LucideIcons.Square;
                  return (
                    <SortableItem 
                      key={item.id} 
                      id={item.id} 
                      content={
                        <div className="flex items-center gap-3">
                          <Icon size={18} className={item.visible ? 'text-sky-500' : 'text-slate-400'} />
                          <span className={item.visible ? '' : 'text-slate-400 line-through decoration-slate-500 opacity-60'}>
                            {item.label}
                          </span>
                        </div>
                      }
                      renderExtra={() => (
                        <button 
                          type="button"
                          onClick={() => toggleSidebarItem(item.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                            item.visible ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          title={item.visible ? "Turn off view" : "Turn on view"}
                        >
                          <span 
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                              item.visible ? 'translate-x-6' : 'translate-x-1'
                            }`} 
                          />
                        </button>
                      )}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-500 flex items-center gap-2 mt-6">
            <span>The <strong>Project Settings</strong> tab is locked to the bottom and cannot be disabled.</span>
          </div>
        </div>
      )}

    </div>
  );
};
