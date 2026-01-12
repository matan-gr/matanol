
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GceResource, FilterConfig, SavedView } from '../types';
import { 
  CheckSquare, Square, Search, FilterX, ChevronDown, ChevronRight, Layers, Tag,
  Server, Cloud, Box
} from 'lucide-react';
import { Button, Card } from './DesignSystem';
import { ResourceRow } from './ResourceRow';
import { ResourceFilters, BulkActionBar, PaginationControl } from './TableControls';
import { AuditHistoryModal } from './AuditHistoryModal';
import { LabelingStudio } from './LabelingStudio';
import { useResourceFilter, calculateFacetedCounts } from '../hooks/useResourceFilter';
import { TableRowSkeleton } from './Skeletons';
import { motion, AnimatePresence } from 'framer-motion';

interface ResourceTableProps {
  resources: GceResource[];
  filterConfig: FilterConfig;
  onFilterChange: (config: FilterConfig) => void;
  onSaveView: (name: string) => void;
  savedViews?: SavedView[]; // Pass saved views
  onLoadView?: (view: SavedView) => void; // Handler to load a view
  onApplyLabels: (id: string, labels: Record<string, string>) => void;
  onUpdateLabels: (id: string, labels: Record<string, string>) => void;
  onRevert: (id: string) => void;
  onBulkUpdateLabels?: (updates: Map<string, Record<string, string>>) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

// Helper type for display items (either a group header or a resource row)
type DisplayItem = 
  | { type: 'header'; key: string; label: string; count: number; isCollapsed: boolean }
  | { type: 'resource'; data: GceResource };

export const ResourceTable: React.FC<ResourceTableProps> = React.memo(({ 
  resources, 
  filterConfig,
  onFilterChange,
  onSaveView,
  savedViews = [], // Default empty
  onLoadView,
  onApplyLabels, 
  onUpdateLabels, 
  onRevert, 
  onBulkUpdateLabels,
  onRefresh,
  isLoading
}) => {
  // --- Hooks & State ---
  const { 
    filteredResources, 
    itemsPerPage, 
    currentPage: defaultCurrentPage, 
    startIndex: defaultStartIndex, 
    availableZones, 
    availableMachineTypes,
    setCurrentPage, 
    handleItemsPerPageChange 
  } = useResourceFilter(resources, filterConfig);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historyResource, setHistoryResource] = useState<GceResource | null>(null);
  const [isLabelingStudioOpen, setIsLabelingStudioOpen] = useState(false);
  
  // Grouping State
  const [groupByLabel, setGroupByLabel] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Derive available labels for Group By dropdown
  const availableLabelKeys = useMemo(() => {
    const keys = new Set<string>();
    resources.forEach(r => Object.keys(r.labels).forEach(k => keys.add(k)));
    return Array.from(keys).sort();
  }, [resources]);

  // --- Optimized Faceted Counts ---
  const counts = useMemo(() => {
    return calculateFacetedCounts(resources, filterConfig);
  }, [resources, filterConfig]);

  // --- Grouping Logic ---
  const displayItems = useMemo<DisplayItem[]>(() => {
    if (!groupByLabel) return filteredResources.map(r => ({ type: 'resource', data: r }));

    const groups = new Map<string, GceResource[]>();
    const noLabelKey = 'Unassigned';

    // 1. Group
    filteredResources.forEach(r => {
      const val = r.labels[groupByLabel] || noLabelKey;
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val)!.push(r);
    });

    // 2. Sort Groups
    const sortedKeys = Array.from(groups.keys()).sort();

    // 3. Flatten
    const items: DisplayItem[] = [];
    sortedKeys.forEach(key => {
        const groupResources = groups.get(key)!;
        const isCollapsed = collapsedGroups.has(key);
        
        // Add Header
        items.push({ 
            type: 'header', 
            key, 
            label: key, 
            count: groupResources.length,
            isCollapsed
        });

        // Add Items if not collapsed
        if (!isCollapsed) {
            groupResources.forEach(r => items.push({ type: 'resource', data: r }));
        }
    });

    return items;
  }, [filteredResources, groupByLabel, collapsedGroups]);

  // --- Pagination Logic (Override hook if grouped) ---
  const totalItems = displayItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  // Ensure current page is valid when grouping changes
  useEffect(() => {
      if (defaultCurrentPage > totalPages && totalPages > 0) {
          setCurrentPage(1);
      }
  }, [totalPages, defaultCurrentPage, setCurrentPage]);

  const startIndex = (defaultCurrentPage - 1) * itemsPerPage;
  const paginatedDisplayItems = useMemo(() => 
      displayItems.slice(startIndex, startIndex + itemsPerPage), 
  [displayItems, startIndex, itemsPerPage]);

  const toggleGroupCollapse = (groupKey: string) => {
      setCollapsedGroups(prev => {
          const next = new Set(prev);
          if (next.has(groupKey)) next.delete(groupKey);
          else next.add(groupKey);
          return next;
      });
  };

  // --- Handlers ---
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
     if (isLoading) return null;
     
     // Scenario 1: Absolutely no resources (Project empty or Connection failed)
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

     // Scenario 2: Resources exist, but Filter returns 0 matches
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
    <Card className="flex flex-col border-slate-300 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20 backdrop-blur-sm shadow-xl relative h-auto">
       
       <ResourceFilters 
          config={filterConfig} 
          onChange={onFilterChange} 
          show={showFilters} 
          onDownload={downloadCSV}
          onToggleShow={() => setShowFilters(!showFilters)}
          onSaveView={onSaveView}
          savedViews={savedViews}
          onLoadView={onLoadView}
          availableZones={availableZones}
          availableMachineTypes={availableMachineTypes}
          availableLabelKeys={availableLabelKeys}
          groupBy={groupByLabel}
          onGroupByChange={setGroupByLabel}
          counts={counts}
          onRefresh={onRefresh}
          isRefreshing={isLoading}
       />

       <BulkActionBar 
         count={selectedIds.size} 
         onOpenStudio={() => setIsLabelingStudioOpen(true)}
         onClear={() => setSelectedIds(new Set())}
       />

       <LabelingStudio 
          isOpen={isLabelingStudioOpen}
          onClose={() => setIsLabelingStudioOpen(false)}
          selectedResources={selectedResourcesList}
          onApply={executeBulkStudioUpdates}
       />

       {/* Main Table Area */}
       <div className="bg-white/40 dark:bg-slate-900/40 relative min-h-[400px]">
          <table className="w-full text-left text-sm border-collapse">
             <thead className="sticky top-[73px] z-10">
               <tr className="bg-slate-50/95 dark:bg-slate-950/95 border-b border-slate-300 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider backdrop-blur-md shadow-sm">
                 <th className="pl-6 pr-3 py-4 w-12">
                    <button onClick={toggleSelectAll} className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center">
                      {selectedIds.size > 0 && selectedIds.size === filteredResources.length ? <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-500"/> : <Square className="w-5 h-5"/>}
                    </button>
                 </th>
                 <th className="px-4 py-4 w-[260px]">Identity</th>
                 <th className="px-4 py-4 w-[160px]">Infrastructure</th>
                 <th className="px-4 py-4 w-[180px]">Configuration</th>
                 <th className="px-4 py-4 w-[160px]">State & Lifecycle</th>
                 <th className="px-4 py-4">Governance</th>
                 <th className="pr-6 pl-4 py-4 text-right w-[100px]"></th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
               {isLoading && Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)}
               
               <AnimatePresence mode="popLayout">
                 {!isLoading && paginatedDisplayItems.map((item, idx) => {
                   if (item.type === 'header') {
                      return (
                          <motion.tr 
                            key={`group-${item.key}`} 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="bg-slate-100 dark:bg-slate-900/80 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors" 
                            onClick={() => toggleGroupCollapse(item.key)}
                          >
                              <td colSpan={7} className="px-6 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide border-t border-slate-200 dark:border-slate-800">
                                  <div className="flex items-center gap-2">
                                      {item.isCollapsed ? <ChevronRight className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                                      <span>{groupByLabel}: <span className="text-blue-600 dark:text-blue-400">{item.label}</span></span>
                                      <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-500">{item.count} items</span>
                                  </div>
                              </td>
                          </motion.tr>
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
          {!isLoading && filteredResources.length === 0 && renderEmptyState()}
       </div>

       {filteredResources.length > 0 && !isLoading && (
         <div className="shrink-0">
            <PaginationControl 
                currentPage={defaultCurrentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                totalItems={totalItems} // Use display items count if grouped
                startIndex={startIndex}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={handleItemsPerPageChange}
            />
         </div>
       )}

       <AuditHistoryModal 
         resource={historyResource} 
         onClose={() => setHistoryResource(null)} 
       />
    </Card>
  );
});
