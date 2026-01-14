
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FilterConfig, SavedView } from '../types';
import { 
  Search, Download, Plus, X, 
  Filter, Save, RefreshCw,
  Server, Database, Cloud, 
  HardDrive, Image as ImageIcon, Camera, Box,
  Bookmark, SlidersHorizontal, Trash2, Ship,
  Wand2, ChevronLeft, ChevronRight, Code, FileText, ChevronDown
} from 'lucide-react';
import { Button, Input, MultiSelect, ToggleSwitch, Select, Badge } from './DesignSystem';
import { motion, AnimatePresence } from 'framer-motion';

// --- Filters ---
export interface ResourceFiltersProps {
  config: FilterConfig;
  onChange: (config: FilterConfig) => void;
  show: boolean;
  onDownload: () => void;
  onExportTerraform: () => void; // New Prop
  onToggleShow: () => void;
  onSaveView: (name: string) => void;
  savedViews?: SavedView[]; 
  onLoadView?: (view: SavedView) => void; 
  onDeleteView?: (id: string) => void;
  availableZones: string[];
  availableMachineTypes: string[];
  availableLabelKeys: string[];
  groupBy: string;
  onGroupByChange: (key: string) => void;
  counts: {
    statuses: Record<string, number>;
    types: Record<string, number>;
    zones: Record<string, number>;
    machineTypes: Record<string, number>;
  };
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const RESOURCE_TYPES = [
  { id: 'INSTANCE', label: 'VM Instances', icon: Server },
  { id: 'GKE_CLUSTER', label: 'GKE Clusters', icon: Ship },
  { id: 'CLOUD_SQL', label: 'Cloud SQL', icon: Database },
  { id: 'CLOUD_RUN', label: 'Cloud Run', icon: Cloud },
  { id: 'BUCKET', label: 'Buckets', icon: Box },
  { id: 'DISK', label: 'Disks', icon: HardDrive },
  { id: 'IMAGE', label: 'Images', icon: ImageIcon },
  { id: 'SNAPSHOT', label: 'Snapshots', icon: Camera },
];

export const ResourceFilters = React.memo(({ 
  config, onChange, show, onDownload, onExportTerraform, onToggleShow, onSaveView, savedViews = [], onLoadView, onDeleteView,
  availableZones, availableMachineTypes, availableLabelKeys,
  groupBy, onGroupByChange,
  counts, onRefresh, isRefreshing
}: ResourceFiltersProps) => {
  const [viewName, setViewName] = useState('');
  const [isViewsOpen, setIsViewsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false); // Export Menu State
  const viewsRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewsRef.current && !viewsRef.current.contains(event.target as Node)) {
        setIsViewsOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLabelChange = (idx: number, field: 'key' | 'value', val: string) => {
    const newLabels = [...config.labels];
    newLabels[idx][field] = val;
    onChange({ ...config, labels: newLabels });
  };

  const getLabelWithCount = (label: string, value: string, countRecord: Record<string, number>) => {
     const count = countRecord[value] || 0;
     return `${label} (${count})`;
  };

  // Helper to remove a specific filter part
  const removeFilter = (type: keyof FilterConfig, value?: string | number) => {
      const newConfig = { ...config };
      if (type === 'search') newConfig.search = '';
      if (type === 'statuses' && value) newConfig.statuses = config.statuses.filter(s => s !== value);
      if (type === 'types' && value) newConfig.types = config.types.filter(t => t !== value);
      if (type === 'zones' && value) newConfig.zones = config.zones.filter(z => z !== value);
      if (type === 'machineTypes' && value) newConfig.machineTypes = config.machineTypes.filter(m => m !== value);
      if (type === 'hasPublicIp') newConfig.hasPublicIp = null;
      if (type === 'dateStart') newConfig.dateStart = '';
      if (type === 'dateEnd') newConfig.dateEnd = '';
      if (type === 'labels' && typeof value === 'number') newConfig.labels = config.labels.filter((_, i) => i !== value);
      if (type === 'showUnlabeledOnly') newConfig.showUnlabeledOnly = false;
      onChange(newConfig);
  };

  const activeFiltersCount = useMemo(() => {
      let count = 0;
      if (config.search) count++;
      count += config.statuses.length;
      count += config.zones.length;
      count += config.machineTypes.length;
      if (config.hasPublicIp !== null) count++;
      if (config.dateStart) count++;
      if (config.dateEnd) count++;
      if (config.showUnlabeledOnly) count++;
      config.labels.forEach(l => { if (l.key) count++; });
      return count;
  }, [config]);

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md sticky top-0 z-20 transition-all duration-300 shadow-sm">
      {/* Toolbar Row 1: Search & Controls */}
      <div className="p-4 pb-2 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col gap-2 w-full sm:max-w-2xl">
            <div className="flex gap-2 w-full">
                <Input 
                icon={<Search className="w-4 h-4"/>} 
                placeholder="Search by name, labels, tags, or IDs..." 
                value={config.search} 
                onChange={e => onChange({ ...config, search: e.target.value })}
                className="w-full shadow-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 focus:ring-2 focus:ring-blue-500/20"
                />
                
                {/* Quick Group By Access */}
                <div className="hidden sm:block min-w-[140px]">
                    <Select 
                        value={groupBy} 
                        onChange={e => onGroupByChange(e.target.value)}
                        className="h-10 text-xs bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-700"
                    >
                        <option value="">No Grouping</option>
                        {availableLabelKeys.map(k => <option key={k} value={k}>Group by: {k}</option>)}
                    </Select>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
            {onRefresh && (
                <Button 
                    variant="ghost" 
                    size="md" 
                    onClick={onRefresh}
                    isLoading={isRefreshing}
                    leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
                    className="hidden sm:inline-flex"
                >
                    Refresh
                </Button>
            )}
            
            {/* Views Dropdown */}
            <div className="relative" ref={viewsRef}>
                <Button 
                    variant="outline" 
                    size="md" 
                    onClick={() => setIsViewsOpen(!isViewsOpen)}
                    leftIcon={<Bookmark className="w-4 h-4" />}
                    className={isViewsOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}
                >
                    Views
                </Button>
                <AnimatePresence>
                    {isViewsOpen && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden"
                        >
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Save Current View</span>
                                <div className="flex items-center gap-2 mt-2">
                                    <input 
                                        autoFocus
                                        className="flex-1 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500"
                                        placeholder="Name..."
                                        value={viewName}
                                        onChange={e => setViewName(e.target.value)}
                                        onKeyDown={e => { if(e.key === 'Enter' && viewName) { onSaveView(viewName); setViewName(''); setIsViewsOpen(false); } }}
                                    />
                                    <button 
                                        onClick={() => { if(viewName) { onSaveView(viewName); setViewName(''); setIsViewsOpen(false); }}}
                                        className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                                    >
                                        <Save className="w-3 h-3"/>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="max-h-[200px] overflow-y-auto p-1 custom-scrollbar">
                                {savedViews.length === 0 && (
                                    <div className="text-center py-4 text-xs text-slate-400 italic">No saved views</div>
                                )}
                                {savedViews.map(view => (
                                    <div key={view.id} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded group">
                                        <button 
                                            onClick={() => { onLoadView?.(view); setIsViewsOpen(false); }}
                                            className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate flex-1 text-left"
                                        >
                                            {view.name}
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDeleteView?.(view.id); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-all"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Export Dropdown */}
            <div className="relative" ref={exportRef}>
                <Button variant="outline" size="md" onClick={() => setIsExportOpen(!isExportOpen)} rightIcon={<ChevronDown className="w-3 h-3"/>} leftIcon={<Download className="w-4 h-4"/>}>
                    Export
                </Button>
                <AnimatePresence>
                    {isExportOpen && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden p-1"
                        >
                            <button onClick={() => { onDownload(); setIsExportOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-left">
                                <FileText className="w-4 h-4 text-emerald-500" /> Download CSV
                            </button>
                            <button onClick={() => { onExportTerraform(); setIsExportOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-left">
                                <Code className="w-4 h-4 text-indigo-500" /> Export Terraform
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <Button 
              variant="primary" 
              size="md" 
              onClick={onToggleShow}
              leftIcon={show ? <X className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4"/>}
              className={show ? 'shadow-inner bg-slate-800 border-slate-800 text-white' : ''}
            >
              {show ? 'Close' : `Filters ${activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}`}
            </Button>
        </div>
      </div>

      {/* Toolbar Row 2: Always Visible Resource Types */}
      <div className="px-4 pb-3 overflow-x-auto no-scrollbar">
         <div className="flex gap-2 items-center min-w-max">
             <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mr-1 sticky left-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md z-10 py-1">Type:</span>
             {RESOURCE_TYPES.map(type => {
                const isSelected = config.types.includes(type.id);
                const count = counts.types[type.id] || 0;
                return (
                   <button
                      key={type.id}
                      onClick={() => {
                         const newTypes = isSelected 
                            ? config.types.filter(t => t !== type.id)
                            : [...config.types, type.id];
                         onChange({ ...config, types: newTypes });
                      }}
                      className={`
                         flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border
                         ${isSelected 
                           ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20 scale-105' 
                           : 'bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-300'}
                      `}
                   >
                      <type.icon className="w-3.5 h-3.5 opacity-80" />
                      {type.label}
                      <span className={`ml-1 text-[9px] px-1.5 py-px rounded-full font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500'}`}>
                         {count}
                      </span>
                   </button>
                )
             })}
             {config.types.length > 0 && (
                <button 
                   onClick={() => onChange({ ...config, types: [] })}
                   className="ml-2 text-[10px] text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded border border-transparent hover:border-red-200 dark:hover:border-red-900/30"
                >
                   <X className="w-3 h-3" /> Clear
                </button>
             )}
         </div>
      </div>

      {/* Visual Active Filters (The "Chips" Area) */}
      {/* We check show activeFiltersCount (which excludes types) > 0 OR showUnlabeledOnly/search etc.
          Logic: If any filter BESIDES types is active, and the panel is closed, show these chips.
      */}
      {activeFiltersCount > 0 && !show && (
        <div className="px-4 pb-3 flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-1">
            {config.search && (
                <Badge variant="info" className="pl-2 pr-1 py-0.5 flex items-center gap-1">
                    Text: {config.search}
                    <button onClick={() => removeFilter('search')} className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"><X className="w-3 h-3"/></button>
                </Badge>
            )}
            {/* Note: Types are now visible above, so we don't render them here to avoid duplication */}
            {config.statuses.map(s => (
                <Badge key={s} variant="neutral" className="pl-2 pr-1 py-0.5 flex items-center gap-1">
                    {s}
                    <button onClick={() => removeFilter('statuses', s)} className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-0.5"><X className="w-3 h-3"/></button>
                </Badge>
            ))}
            {config.zones.map(z => (
                <Badge key={z} variant="info" className="pl-2 pr-1 py-0.5 flex items-center gap-1">
                    {z}
                    <button onClick={() => removeFilter('zones', z)} className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"><X className="w-3 h-3"/></button>
                </Badge>
            ))}
            {config.labels.map((l, idx) => l.key ? (
                <Badge key={idx} variant="warning" className="pl-2 pr-1 py-0.5 flex items-center gap-1">
                    {l.key}{l.value ? `:${l.value}` : ''}
                    <button onClick={() => removeFilter('labels', idx)} className="hover:bg-amber-200 dark:hover:bg-amber-800 rounded-full p-0.5"><X className="w-3 h-3"/></button>
                </Badge>
            ) : null)}
            {config.showUnlabeledOnly && (
                <Badge variant="error" className="pl-2 pr-1 py-0.5 flex items-center gap-1">
                    Unlabeled Only
                    <button onClick={() => removeFilter('showUnlabeledOnly')} className="hover:bg-red-200 dark:hover:bg-red-800 rounded-full p-0.5"><X className="w-3 h-3"/></button>
                </Badge>
            )}
            <button 
                onClick={() => onChange({ ...config, search: '', statuses: [], types: [], zones: [], machineTypes: [], hasPublicIp: null, dateStart: '', dateEnd: '', labels: [], showUnlabeledOnly: false })}
                className="text-[10px] text-slate-500 hover:text-red-500 underline decoration-dotted ml-1"
            >
                Reset All Filters
            </button>
        </div>
      )}

      {/* Expanded Filters Panel */}
      {show && (
        <div className="px-6 py-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-300 relative">
           
           {/* Resource Type Filter REMOVED (Moved to top) */}

           <div>
              <MultiSelect 
                 label="Status"
                 options={[
                   { label: getLabelWithCount('Running', 'RUNNING', counts.statuses), value: 'RUNNING' },
                   { label: getLabelWithCount('Stopped', 'STOPPED', counts.statuses), value: 'STOPPED' },
                   { label: getLabelWithCount('Ready', 'READY', counts.statuses), value: 'READY' },
                   { label: getLabelWithCount('Terminated', 'TERMINATED', counts.statuses), value: 'TERMINATED' },
                 ]}
                 selected={config.statuses}
                 onChange={(vals) => onChange({...config, statuses: vals})}
                 placeholder="All Statuses"
              />
           </div>
           
           <div>
              <MultiSelect 
                 label="Zone / Region"
                 options={availableZones.map(z => ({ label: getLabelWithCount(z, z, counts.zones), value: z }))}
                 selected={config.zones}
                 onChange={(vals) => onChange({...config, zones: vals})}
                 placeholder="All Zones"
              />
           </div>

           <div className="md:col-span-2">
              <MultiSelect 
                 label="Machine Type"
                 options={availableMachineTypes.map(m => ({ label: getLabelWithCount(m, m, counts.machineTypes), value: m }))}
                 selected={config.machineTypes}
                 onChange={(vals) => onChange({...config, machineTypes: vals})}
                 placeholder="All Machine Types"
              />
           </div>

           <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div>
                 <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-wider">Created After</label>
                 <input 
                    type="date" 
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
                    value={config.dateStart}
                    onChange={e => onChange({ ...config, dateStart: e.target.value })}
                 />
              </div>
              <div>
                 <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-wider">Created Before</label>
                 <input 
                    type="date" 
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow"
                    value={config.dateEnd}
                    onChange={e => onChange({ ...config, dateEnd: e.target.value })}
                 />
              </div>
           </div>

           <div className="md:col-span-2 flex items-center gap-6 border border-slate-200 dark:border-slate-800 rounded-lg px-4 bg-white dark:bg-slate-950/30">
              <div className="flex flex-col gap-1">
                 <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Public Internet Access</span>
                 <span className="text-xs text-slate-400">Filter by external IP presence</span>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
                 <button 
                   onClick={() => onChange({ ...config, hasPublicIp: null })}
                   className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${config.hasPublicIp === null ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                 >Any</button>
                 <button 
                   onClick={() => onChange({ ...config, hasPublicIp: true })}
                   className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${config.hasPublicIp === true ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                 >Public</button>
                 <button 
                   onClick={() => onChange({ ...config, hasPublicIp: false })}
                   className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${config.hasPublicIp === false ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                 >Private</button>
              </div>
           </div>

           <div className="md:col-span-4 border-t border-slate-200 dark:border-slate-800 pt-6">
              <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
                 <div className="flex items-center gap-6">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Advanced Filtering</label>
                    <ToggleSwitch 
                        checked={config.showUnlabeledOnly} 
                        onChange={(checked) => onChange({...config, showUnlabeledOnly: checked})}
                        label="Show Unlabeled Only"
                    />
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-950 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
                        {['AND', 'OR'].map((logic) => (
                        <button 
                            key={logic}
                            onClick={() => onChange({ ...config, labelLogic: logic as 'AND' | 'OR' })}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${config.labelLogic === logic ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >{logic}</button>
                        ))}
                    </div>
                 </div>
              </div>
              
              <div className="space-y-3">
                 {config.labels.map((l, idx) => (
                    <div key={idx} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
                       <Input placeholder="Label Key" value={l.key} onChange={e => handleLabelChange(idx, 'key', e.target.value)} className="py-1.5 text-xs font-mono" />
                       <span className="text-slate-300">=</span>
                       <Input placeholder="Label Value" value={l.value} onChange={e => handleLabelChange(idx, 'value', e.target.value)} className="py-1.5 text-xs font-mono" />
                       <button onClick={() => onChange({ ...config, labels: config.labels.filter((_, i) => i !== idx) })} className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                 ))}
                 <Button variant="ghost" size="sm" onClick={() => onChange({ ...config, labels: [...config.labels, { key: '', value: '' }] })} leftIcon={<Plus className="w-3.5 h-3.5" />} className="text-slate-500">Add Label Rule</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
});

// --- Bulk Action Bar ---
export interface BulkActionBarProps {
  count: number;
  onOpenStudio: () => void;
  onClear: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({ count, onOpenStudio, onClear }) => {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-[88px] left-0 right-0 z-30 bg-indigo-600 text-white px-6 py-3 flex items-center justify-between shadow-lg backdrop-blur-md bg-indigo-600/95"
        >
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 font-bold text-sm">
                <span className="bg-white/20 px-2 py-0.5 rounded text-white tabular-nums">{count}</span>
                <span>Selected</span>
             </div>
             <div className="h-4 w-px bg-indigo-400"></div>
             <Button 
                variant="ghost" 
                size="sm" 
                onClick={onOpenStudio} 
                leftIcon={<Wand2 className="w-4 h-4" />}
                className="text-white hover:bg-indigo-500 hover:text-white border border-white/20 hover:border-white/40"
             >
                AI Labeling Studio
             </Button>
          </div>
          <button onClick={onClear} className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
             <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- Pagination ---
export interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  startIndex: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const PaginationControl: React.FC<PaginationControlProps> = ({ 
  currentPage, totalPages, itemsPerPage, totalItems, startIndex, 
  onPageChange, onItemsPerPageChange 
}) => {
  return (
    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
       <div className="text-xs text-slate-500 dark:text-slate-400 order-2 sm:order-1">
          Showing <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{Math.min(startIndex + 1, totalItems)}</span> to <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">{totalItems}</span> results
       </div>
       
       <div className="flex items-center gap-4 order-1 sm:order-2">
          <div className="flex items-center gap-2">
             <span className="text-[10px] uppercase font-bold text-slate-400 hidden sm:inline">Rows per page</span>
             <select 
               value={itemsPerPage}
               onChange={onItemsPerPageChange}
               className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 rounded px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
             >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
             </select>
          </div>
          
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
             <button 
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
             >
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
             </button>
             <span className="text-xs font-mono px-2 text-slate-600 dark:text-slate-400 min-w-[3rem] text-center">
                {currentPage} / {Math.max(1, totalPages)}
             </span>
             <button 
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => onPageChange(currentPage + 1)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
             >
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
             </button>
          </div>
       </div>
    </div>
  );
};
