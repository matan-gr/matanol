
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GceResource, FilterConfig, SavedView } from '../types';
import { 
  CheckSquare, Square, Search, FilterX, ChevronDown, ChevronRight, Layers, Tag,
  Server, Cloud, Box, Loader2, ArrowUp, ArrowDown, ArrowUpDown, AlertCircle
} from 'lucide-react';
import { Button, Card, Badge, Tooltip } from './DesignSystem';
import { ResourceRow } from './ResourceRow';
import { ResourceFilters, BulkActionBar, PaginationControl } from './TableControls';
import { AuditHistoryModal } from './AuditHistoryModal';
import { LabelingStudio } from './LabelingStudio';
import { useResourceFilter, calculateFacetedCounts, SortConfig } from '../hooks/useResourceFilter';
import { TableRowSkeleton } from './Skeletons';
import { motion, AnimatePresence } from 'framer-motion';

// Fix for framer-motion type mismatches
const MotionTr = motion.tr as any;
const MotionDiv = motion.div as any;

interface ResourceTableProps {
  resources: GceResource[];
  filterConfig: FilterConfig;
  onFilterChange: (config: FilterConfig) => void;
  onSaveView: (name: string) => void;
  savedViews?: SavedView[]; 
  onLoadView?: (view: SavedView) => void; 
  onDeleteView?: (id: string) => void; 
  onApplyLabels: (id: string, labels: Record<string, string>) => void;
  onUpdateLabels: (id: string, labels: Record<string, string>) => void;
  onRevert: (id: string) => void;
  onBulkUpdateLabels?: (updates: Map<string, Record<string, string>>) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  batchProgress?: { processed: number, total: number } | null;
}

type DisplayItem = 
  | { type: 'header'; key: string; label: string; count: number; isCollapsed: boolean }
  | { type: 'resource'; data: GceResource };

export const ResourceTable: React.FC<ResourceTableProps> = React.memo(({ 
  resources, 
  filterConfig,
  onFilterChange,
  onSaveView,
  savedViews = [], 
  onLoadView,
  onDeleteView,
  onApplyLabels, 
  onUpdateLabels, 
  onRevert, 
  onBulkUpdateLabels,
  onRefresh,
  isLoading,
  batchProgress
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const { 
    filteredResources, 
    paginatedResources,
    itemsPerPage, 
    currentPage: defaultCurrentPage, 
    startIndex: defaultStartIndex, 
    availableZones, 
    availableMachineTypes,
    setCurrentPage, 
    handleItemsPerPageChange 
  } = useResourceFilter(resources, filterConfig, sortConfig);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historyResource, setHistoryResource] = useState<GceResource | null>(null);
  const [isLabelingStudioOpen, setIsLabelingStudioOpen] = useState(false);
  
  const [groupByLabel, setGroupByLabel] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const availableLabelKeys = useMemo(() => {
    const keys = new Set<string>();
    resources.forEach(r => Object.keys(r.labels).forEach(k => keys.add(k)));
    return Array.from(keys).sort();
  }, [resources]);

  const counts = useMemo(() => {
    return calculateFacetedCounts(resources, filterConfig);
  }, [resources, filterConfig]);

  const displayItems = useMemo<DisplayItem[]>(() => {
    if (!groupByLabel) return paginatedResources.map(r => ({ type: 'resource', data: r }));

    const groups = new Map<string, GceResource[]>();
    const noLabelKey = 'Unassigned';

    paginatedResources.forEach(r => {
      const val = r.labels[groupByLabel] || noLabelKey;
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val)!.push(r);
    });

    const sortedKeys = Array.from(groups.keys()).sort();

    const items: DisplayItem[] = [];
    sortedKeys.forEach(key => {
        const groupResources = groups.get(key)!;
        const isCollapsed = collapsedGroups.has(key);
        items.push({ 
            type: 'header', 
            key, 
            label: key, 
            count: groupResources.length,
            isCollapsed
        });
        if (!isCollapsed) {
            groupResources.forEach(r => items.push({ type: 'resource', data: r }));
        }
    });

    return items;
  }, [paginatedResources, groupByLabel, collapsedGroups]);

  const totalItems = filteredResources.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const toggleGroupCollapse = (groupKey: string) => {
      setCollapsedGroups(prev => {
          const next = new Set(prev);
          if (next.has(groupKey)) next.delete(groupKey);
          else next.add(groupKey);
          return next;
      });
  };

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortConfig?.key !== colKey) return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-50 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-indigo-500" /> 
      : <ArrowDown className="w-3 h-3 text-indigo-500" />;
  };

  const toggleSelectAll = useCallback(() => {
     setSelectedIds(prev => {
        if (prev.size > 0 && prev.size === filteredResources.length) {
            return new Set();
        }
        return new Set(filteredResources.map(r => r.id));
     });
  }, [filteredResources]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if(next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const executeBulkStudioUpdates = useCallback((updates: Map<string, Record<string, string>>) => {
    if (!onBulkUpdateLabels) return;
    onBulkUpdateLabels(updates);
    setSelectedIds(new Set());
  }, [onBulkUpdateLabels]);

  const downloadCSV = useCallback(() => {
    const header = ['ID', 'Name', 'Type', 'Provisioning', 'Status', 'Zone', 'Labels'];
    const rows = filteredResources.map(r => [
        r.id, 
        r.name, 
        r.type, 
        r.provisioningModel, 
        r.status, 
        r.zone, 
        Object.entries(r.labels).map(([k,v]) => `${k}:${v}`).join(';')
    ]);
    
    const csvContent = [header, ...rows]
        .map(e => e.join(","))
        .join("\n");

    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI(csvContent);
    link.download = `gcp_inventory_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  }, [filteredResources]);

  const renderEmptyState = () => {
     if (isLoading && resources.length === 0) return null; // Show skeletons instead
     
     if (resources.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-24 w-full text-center">
             <div className="relative group">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-700 animate-pulse"></div>
                <div className="bg-white dark:bg-slate-900 p-8 rounded-full relative shadow-2xl border border-slate-200 dark:border-slate-800">
                    <Cloud className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                </div>
             </div>
             <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-8 mb-2">No Resources Detected</h3>
             <p className="max-w-md text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                We couldn't find any resources in this project. 
                Verify your API Token permissions or try refreshing the connection.
             </p>
             {onRefresh && (
                <Button variant="primary" onClick={onRefresh} className="shadow-lg shadow-blue-500/20">
                    Retry Connection
                </Button>
             )}
          </div>
        );
     }

     return (
        <div className="flex flex-col items-center justify-center py-20 w-full animate-in fade-in zoom-in-95 duration-300">
           <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-full mb-4 border border-slate-200 dark:border-slate-800 shadow-inner">
              <FilterX className="w-10 h-10 text-indigo-400" />
           </div>
           <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No matching resources</h3>
           <p className="max-w-xs text-center mt-2 text-sm text-slate-500">
              Your filters are too strict. Try resetting them to view your inventory.
           </p>
           <Button 
              variant="secondary" 
              size="sm" 
              className="mt-6 shadow-sm"
              onClick={() => onFilterChange({ search: '', statuses: [], types: [], zones: [], machineTypes: [], hasPublicIp: null, dateStart: '', dateEnd: '', labelLogic: 'AND', labels: [], showUnlabeledOnly: false })}
           >
              Clear All Filters
           </Button>
        </div>
     );
  };

  const selectedResourcesList = useMemo(() => 
    resources.filter(r => selectedIds.has(r.id)), 
  [resources, selectedIds]);

  return (
    <div className="flex flex-col relative h-auto">
       <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-6 z-30 sticky top-4">
           <ResourceFilters 
              config={filterConfig} 
              onChange={onFilterChange} 
              show={showFilters} 
              onDownload={downloadCSV}
              onToggleShow={() => setShowFilters(!showFilters)}
              onSaveView={onSaveView}
              savedViews={savedViews}
              onLoadView={onLoadView}
              onDeleteView={onDeleteView}
              availableZones={availableZones}
              availableMachineTypes={availableMachineTypes}
              availableLabelKeys={availableLabelKeys}
              groupBy={groupByLabel}
              onGroupByChange={setGroupByLabel}
              counts={counts}
              onRefresh={onRefresh}
              isRefreshing={isLoading}
           />

           {batchProgress && (
              <div className="absolute top-0 left-0 right-0 h-1 z-50 rounded-t-2xl overflow-hidden">
                 <MotionDiv 
                   className="h-full bg-blue-500"
                   initial={{ width: 0 }}
                   animate={{ width: `${(batchProgress.processed / batchProgress.total) * 100}%` }}
                   transition={{ duration: 0.2 }}
                 />
              </div>
           )}

           <BulkActionBar 
             count={selectedIds.size} 
             onOpenStudio={() => setIsLabelingStudioOpen(true)}
             onClear={() => setSelectedIds(new Set())}
           />
       </div>

       <LabelingStudio 
          isOpen={isLabelingStudioOpen}
          onClose={() => setIsLabelingStudioOpen(false)}
          selectedResources={selectedResourcesList}
          onApply={executeBulkStudioUpdates}
       />

       <div className="relative min-h-[400px]">
          {/* Responsive Table Wrapper */}
          <div className="overflow-x-auto w-full pb-4">
            <table className="w-full text-left text-sm border-separate border-spacing-y-6 min-w-[900px]">
               <thead>
                 <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                   <th className="pl-6 pr-3 py-2 w-16">
                      <button onClick={toggleSelectAll} className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center">
                        {selectedIds.size > 0 && selectedIds.size === filteredResources.length ? <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-500"/> : <Square className="w-5 h-5"/>}
                      </button>
                   </th>
                   <th className="px-4 py-2 w-[280px] cursor-pointer group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1.5">
                         Identity
                         <SortIcon colKey="name" />
                      </div>
                   </th>
                   <th className="px-4 py-2 w-[200px] cursor-pointer group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('type')}>
                      <div className="flex items-center gap-1.5">
                         Infrastructure
                         <SortIcon colKey="type" />
                      </div>
                   </th>
                   <th className="px-4 py-2 w-[220px]">Configuration</th>
                   <th className="px-4 py-2 w-[200px]">
                      <div className="flex items-center gap-3">
                         <button 
                            className="flex items-center gap-1 cursor-pointer group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            onClick={() => handleSort('status')}
                         >
                            State
                            <SortIcon colKey="status" />
                         </button>
                         <span className="text-slate-300 dark:text-slate-700">|</span>
                         <button 
                            className="flex items-center gap-1 cursor-pointer group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            onClick={() => handleSort('creationTimestamp')}
                         >
                            Lifecycle
                            <SortIcon colKey="creationTimestamp" />
                         </button>
                      </div>
                   </th>
                   <th className="px-4 py-2">Governance</th>
                   <th className="pr-6 pl-4 py-2 text-right w-[100px]"></th>
                 </tr>
               </thead>
               <tbody>
                 {/* Show skeletons only if we have NO resources yet and are loading */}
                 {isLoading && resources.length === 0 && Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)}
                 
                 <AnimatePresence mode="popLayout">
                   {displayItems.map((item) => {
                     if (item.type === 'header') {
                        return (
                            <MotionTr 
                              key={`group-${item.key}`} 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="cursor-pointer" 
                              onClick={() => toggleGroupCollapse(item.key)}
                            >
                                <td colSpan={7} className="px-1 py-4">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                            {item.isCollapsed ? <ChevronRight className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                                            <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                            <span className="text-indigo-600 dark:text-indigo-400">{item.label}</span>
                                            <span className="bg-white dark:bg-slate-900 text-slate-400 px-1.5 rounded ml-1">{item.count}</span>
                                        </div>
                                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                                    </div>
                                </td>
                            </MotionTr>
                        );
                     }
                     const r = item.data;
                     return (
                       <ResourceRow 
                         key={r.id} 
                         resource={r} 
                         isSelected={selectedIds.has(r.id)}
                         onToggleSelect={toggleSelect}
                         onUpdate={onUpdateLabels}
                         onApply={onApplyLabels}
                         onRevert={onRevert}
                         onViewHistory={setHistoryResource}
                       />
                     );
                   })}
                 </AnimatePresence>
               </tbody>
            </table>
          </div>
          
          {/* Empty state or loading feedback */}
          {(!isLoading || resources.length > 0) && filteredResources.length === 0 && renderEmptyState()}
       </div>

       {filteredResources.length > 0 && (
         <div className="mt-4">
            <PaginationControl 
                currentPage={defaultCurrentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems} 
                startIndex={defaultStartIndex}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={handleItemsPerPageChange}
            />
         </div>
       )}

       <AuditHistoryModal 
         resource={historyResource} 
         onClose={() => setHistoryResource(null)} 
       />
    </div>
  );
});
