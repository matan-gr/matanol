
import React, { useState } from 'react';
import { FilterConfig, GceResource, LabelHistoryEntry } from '../types';
import { 
  Search, SlidersHorizontal, Download, Plus, X, 
  ChevronLeft, ChevronRight, Check,
  Filter, Tag, Wand2, Trash2, Save, Globe, RefreshCw,
  History, ArrowRight, Server, Database, Cloud, 
  HardDrive, Image as ImageIcon, Camera
} from 'lucide-react';
import { Button, Input, MultiSelect, ToggleSwitch, Modal, Badge } from './DesignSystem';
import { RegionIcon } from './RegionIcon';

// --- Filters ---
export interface ResourceFiltersProps {
  config: FilterConfig;
  onChange: (config: FilterConfig) => void;
  show: boolean;
  onDownload: () => void;
  onToggleShow: () => void;
  onSaveView: (name: string) => void;
  availableZones: string[];
  availableMachineTypes: string[];
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
  config, onChange, show, onDownload, onToggleShow, onSaveView, availableZones, availableMachineTypes, counts, onRefresh, isRefreshing
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

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md sticky top-0 z-20 transition-all duration-300">
      {/* Toolbar */}
      <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <Input 
          icon={<Search className="w-4 h-4"/>} 
          placeholder="Filter resources by name, ID or label..." 
          value={config.search} 
          onChange={e => onChange({ ...config, search: e.target.value })}
          className="w-full sm:max-w-md shadow-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="flex items-center gap-3">
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
              Filters
            </Button>
        </div>
      </div>

      {/* Expanded Filters */}
      {show && (
        <div className="px-6 py-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-300 relative">
           
           {/* Visual Resource Type Filter */}
           <div className="md:col-span-4 mb-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-3 block">Resource Type</label>
              <div className="flex flex-wrap gap-2">
                 {[
                   { id: 'INSTANCE', label: 'VM Instances', icon: Server },
                   { id: 'CLOUD_SQL', label: 'Cloud SQL', icon: Database },
                   { id: 'CLOUD_RUN', label: 'Cloud Run', icon: Cloud },
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
                        <Button variant="ghost" size="xs" onClick={() => setIsSavingView(true)} leftIcon={<Save className="w-3 h-3"/>}>Save View</Button>
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-4 duration-300">
       <div className="bg-slate-900 text-white rounded-full px-4 py-2 shadow-2xl flex items-center gap-4 border border-slate-700">
          <div className="flex items-center gap-2 pl-2">
             <div className="bg-blue-600 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {count}
             </div>
             <span className="text-sm font-medium">Selected</span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center gap-2">
             <Button 
                variant="ghost" 
                size="sm" 
                onClick={onOpenStudio} 
                className="text-white hover:text-blue-200 hover:bg-white/10 h-8"
                leftIcon={<Wand2 className="w-4 h-4" />}
             >
                Label Studio
             </Button>
             <button 
                onClick={onClear} 
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
             >
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
  currentPage, totalPages, itemsPerPage, totalItems, startIndex, onPageChange, onItemsPerPageChange 
}: PaginationControlProps) => {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
         <span>
            Showing <span className="font-bold text-slate-900 dark:text-white">{totalItems > 0 ? startIndex + 1 : 0}</span> to <span className="font-bold text-slate-900 dark:text-white">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of <span className="font-bold text-slate-900 dark:text-white">{totalItems}</span>
         </span>
         <select 
            value={itemsPerPage} 
            onChange={onItemsPerPageChange}
            className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
         >
            <option value={10}>10 per page</option>
            <option value={15}>15 per page</option>
            <option value={25}>25 per page</option>
            <option value={35}>35 per page</option>
            <option value={50}>50 per page</option>
         </select>
      </div>

      <div className="flex items-center gap-2">
         <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => onPageChange(currentPage - 1)} 
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
         >
            <ChevronLeft className="w-4 h-4" />
         </Button>
         <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[3rem] text-center">
            {currentPage} / {totalPages || 1}
         </span>
         <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => onPageChange(currentPage + 1)} 
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-8 w-8 p-0"
         >
            <ChevronRight className="w-4 h-4" />
         </Button>
      </div>
    </div>
  );
};

// --- Audit History Modal ---
interface AuditHistoryModalProps {
  resource: GceResource | null;
  onClose: () => void;
}

export const AuditHistoryModal = ({ resource, onClose }: AuditHistoryModalProps) => {
  return (
    <Modal
      isOpen={!!resource}
      onClose={onClose}
      title={`Audit History: ${resource?.name}`}
    >
       <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
             <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />
             </div>
             <div>
                <h4 className="font-bold text-slate-800 dark:text-white">Change Log</h4>
                <p className="text-xs text-slate-500">Track all label modifications for compliance auditing.</p>
             </div>
          </div>

          <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-8">
             {resource?.history?.length === 0 && (
                <div className="pl-6 text-slate-500 text-sm italic">No history recorded yet.</div>
             )}
             {resource?.history?.map((entry, idx) => (
                <div key={idx} className="relative pl-6">
                   <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-900"></div>
                   
                   <div className="flex flex-col gap-1 mb-2">
                      <div className="flex justify-between items-start">
                         <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
                         <Badge variant="neutral">{entry.changeType}</Badge>
                      </div>
                      <div className="text-sm font-medium text-slate-800 dark:text-white">
                         Modified by <span className="text-blue-600 dark:text-blue-400">{entry.actor}</span>
                      </div>
                   </div>

                   <div className="bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800 p-3 text-xs">
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <div className="mb-1 text-[10px] font-bold text-slate-400 uppercase">Before</div>
                            <div className="space-y-1">
                               {Object.entries(entry.previousLabels).map(([k,v]) => (
                                  <div key={k} className="text-slate-500">{k}: {v}</div>
                               ))}
                               {Object.keys(entry.previousLabels).length === 0 && <span className="text-slate-400 italic">Empty</span>}
                            </div>
                         </div>
                         <div className="relative">
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-slate-300"><ArrowRight className="w-3 h-3" /></div>
                            <div className="mb-1 text-[10px] font-bold text-slate-400 uppercase">After</div>
                            <div className="space-y-1">
                               {Object.entries(entry.newLabels).map(([k,v]) => {
                                  const isChanged = entry.previousLabels[k] !== v;
                                  return (
                                    <div key={k} className={isChanged ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-slate-500"}>
                                       {k}: {v}
                                    </div>
                                  )
                               })}
                               {Object.keys(entry.newLabels).length === 0 && <span className="text-slate-400 italic">Empty</span>}
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             ))}
          </div>
       </div>
    </Modal>
  );
};
