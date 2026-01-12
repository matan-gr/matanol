
import React, { useState, useMemo } from 'react';
import { FilterConfig, SavedView } from '../types';
import { 
  Search, Download, Plus, X, 
  ChevronLeft, ChevronRight, Check,
  Filter, Tag, Save, RefreshCw,
  Server, Database, Cloud, 
  HardDrive, Image as ImageIcon, Camera, Box,
  Bookmark, LayoutList
} from 'lucide-react';
import { Button, Input, MultiSelect, ToggleSwitch, Select, Badge } from './DesignSystem';

// --- Filters ---
export interface ResourceFiltersProps {
  config: FilterConfig;
  onChange: (config: FilterConfig) => void;
  show: boolean;
  onDownload: () => void;
  onToggleShow: () => void;
  onSaveView: (name: string) => void;
  savedViews?: SavedView[]; // Added to allow quick loading
  onLoadView?: (view: SavedView) => void; // Added handler
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

export const ResourceFilters = React.memo(({ 
  config, onChange, show, onDownload, onToggleShow, onSaveView, savedViews = [], onLoadView,
  availableZones, availableMachineTypes, availableLabelKeys,
  groupBy, onGroupByChange,
  counts, onRefresh, isRefreshing
}: ResourceFiltersProps) => {
  const [viewName, setViewName] = useState('');
  const [isSavingView, setIsSavingView] = useState(false);

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
      count += config.types.length;
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
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md sticky top-0 z-20 transition-all duration-300">
      {/* Toolbar */}
      <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col gap-2 w-full sm:max-w-2xl">
            <div className="flex gap-2 w-full">
                <Input 
                icon={<Search className="w-4 h-4"/>} 
                placeholder="Filter resources by name, ID, or IP..." 
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

            {/* Visual Active Filters (The "Chips" Area) */}
            {activeFiltersCount > 0 && !show && (
                <div className="flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-1">
                    {config.search && (
                        <Badge variant="info" className="pl-2 pr-1 py-0.5 flex items-center gap-1">
                            Text: {config.search}
                            <button onClick={() => removeFilter('search')} className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"><X className="w-3 h-3"/></button>
                        </Badge>
                    )}
                    {config.types.map(t => (
                        <Badge key={t} variant="purple" className="pl-2 pr-1 py-0.5 flex items-center gap-1">
                            Type: {t}
                            <button onClick={() => removeFilter('types', t)} className="hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5"><X className="w-3 h-3"/></button>
                        </Badge>
                    ))}
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
                        className="text-[10px] text-slate-500 hover:text-red-500 underline decoration-dotted"
                    >
                        Clear All
                    </button>
                </div>
            )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
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
            <Button variant="outline" size="md" onClick={onDownload} leftIcon={<Download className="w-4 h-4"/>}>Export</Button>
            <Button 
              variant="primary" 
              size="md" 
              onClick={onToggleShow}
              leftIcon={show ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4"/>}
              className={show ? 'shadow-inner bg-slate-800 border-slate-800 text-white' : ''}
            >
              {show ? 'Close' : `Filters ${activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}`}
            </Button>
        </div>
      </div>

      {/* Expanded Filters */}
      {show && (
        <div className="px-6 py-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-300 relative">
           
           {/* Saved Views Quick Load */}
           <div className="md:col-span-4 flex items-center justify-between bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 mb-2">
               <div className="flex items-center gap-3">
                   <Bookmark className="w-4 h-4 text-indigo-500" />
                   <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Saved Views</span>
                   <div className="flex gap-2">
                       {savedViews.map(view => (
                           <button
                               key={view.id}
                               onClick={() => onLoadView?.(view)}
                               className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-300 text-xs rounded border border-slate-200 dark:border-slate-700 transition-colors"
                           >
                               {view.name}
                           </button>
                       ))}
                       {savedViews.length === 0 && <span className="text-xs text-slate-400 italic">No saved views yet. Configure filters and click 'Save View'.</span>}
                   </div>
               </div>
           </div>

           {/* Visual Resource Type Filter */}
           <div className="md:col-span-4 mb-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-3 block">Resource Type</label>
              <div className="flex flex-wrap gap-2">
                 {[
                   { id: 'INSTANCE', label: 'VM Instances', icon: Server },
                   { id: 'CLOUD_SQL', label: 'Cloud SQL', icon: Database },
                   { id: 'CLOUD_RUN', label: 'Cloud Run', icon: Cloud },
                   { id: 'BUCKET', label: 'Buckets', icon: Box },
                   { id: 'DISK', label: 'Disks', icon: HardDrive },
                   { id: 'IMAGE', label: 'Images', icon: ImageIcon },
                   { id: 'SNAPSHOT', label: 'Snapshots', icon: Camera },
                 ].map(type => {
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
                             flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border
                             ${isSelected 
                               ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20' 
                               : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}
                          `}
                       >
                          <type.icon className="w-3.5 h-3.5" />
                          {type.label}
                          <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                             {count}
                          </span>
                       </button>
                    )
                 })}
                 {config.types.length > 0 && (
                    <button 
                       onClick={() => onChange({ ...config, types: [] })}
                       className="text-[10px] text-slate-400 hover:text-red-500 underline decoration-dotted underline-offset-2 transition-colors ml-2"
                    >
                       Clear Type Filter
                    </button>
                 )}
              </div>
           </div>

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
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Advanced Label Filters</label>
                    <ToggleSwitch 
                        checked={config.showUnlabeledOnly} 
                        onChange={(checked) => onChange({...config, showUnlabeledOnly: checked})}
                        label="Show Unlabeled Only"
                    />
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-950 rounded-lg p-1 border border-slate-200 dark:border-slate-800 mr-4">
                        {['AND', 'OR'].map((logic) => (
                        <button 
                            key={logic}
                            onClick={() => onChange({ ...config, labelLogic: logic as 'AND' | 'OR' })}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${config.labelLogic === logic ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >{logic}</button>
                        ))}
                    </div>

                    {/* Save View Controls */}
                    {isSavingView ? (
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-1 rounded-lg border border-blue-200 dark:border-blue-800 animate-in fade-in slide-in-from-right-2">
                            <input 
                              autoFocus
                              className="bg-transparent text-xs text-blue-900 dark:text-blue-100 placeholder-blue-400 px-2 py-1 outline-none w-32"
                              placeholder="View Name..."
                              value={viewName}
                              onChange={e => setViewName(e.target.value)}
                              onKeyDown={e => { if(e.key === 'Enter' && viewName) { onSaveView(viewName); setIsSavingView(false); setViewName(''); } }}
                            />
                            <button onClick={() => { if(viewName) { onSaveView(viewName); setIsSavingView(false); setViewName(''); }}} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-300"><Check className="w-3 h-3"/></button>
                            <button onClick={() => setIsSavingView(false)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"><X className="w-3 h-3"/></button>
                        </div>
                    ) : (
                        <Button variant="ghost" size="xs" onClick={() => setIsSavingView(true)} leftIcon={<Save className="w-3 h-3"/>}>Save as View</Button>
                    )}
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
interface BulkActionBarProps {
  count: number;
  onOpenStudio: () => void;
  onClear: () => void;
}

export const BulkActionBar = ({ count, onOpenStudio, onClear }: BulkActionBarProps) => {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
       <div className="bg-slate-900 text-white rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 border border-slate-700/50 backdrop-blur-md">
          <div className="flex items-center gap-3 pr-4 border-r border-slate-700">
             <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {count}
             </div>
             <span className="text-sm font-medium">Selected</span>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="sm" onClick={onOpenStudio} className="text-slate-200 hover:text-white hover:bg-slate-800 rounded-full px-4 h-8" leftIcon={<Tag className="w-4 h-4"/>}>
                Labeling Studio
             </Button>
             <button onClick={onClear} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
             </button>
          </div>
       </div>
    </div>
  );
};

// --- Pagination ---
interface PaginationControlProps {
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    totalItems: number;
    startIndex: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const PaginationControl = ({ 
    currentPage, totalPages, itemsPerPage, totalItems, startIndex,
    onPageChange, onItemsPerPageChange 
}: PaginationControlProps) => {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="text-xs text-slate-500 dark:text-slate-400">
               Showing <span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(startIndex + 1, totalItems)}</span> to <span className="font-bold text-slate-700 dark:text-slate-300">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of <span className="font-bold text-slate-700 dark:text-slate-300">{totalItems}</span> resources
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Rows per page:</span>
                  <Select 
                    value={itemsPerPage} 
                    onChange={onItemsPerPageChange}
                    className="h-8 py-1 text-xs w-16 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                  >
                     <option value={10}>10</option>
                     <option value={20}>20</option>
                     <option value={50}>50</option>
                     <option value={100}>100</option>
                  </Select>
               </div>
               <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === 1} 
                    onClick={() => onPageChange(currentPage - 1)}
                    className="px-2 h-8"
                  >
                     <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2">
                     Page {currentPage} of {totalPages || 1}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === totalPages || totalPages === 0} 
                    onClick={() => onPageChange(currentPage + 1)}
                    className="px-2 h-8"
                  >
                     <ChevronRight className="w-4 h-4" />
                  </Button>
               </div>
            </div>
        </div>
    );
};
