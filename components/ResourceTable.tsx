
import React, { useState, useCallback, useMemo } from 'react';
import { GceResource, FilterConfig } from '../types';
import { 
  CheckSquare, Square, Search, FilterX, RefreshCw
} from 'lucide-react';
import { Button, Card } from './DesignSystem';
import { ResourceRow } from './ResourceRow';
import { ResourceFilters, BulkActionBar, PaginationControl, AuditHistoryModal } from './TableControls';
import { LabelingStudio } from './LabelingStudio';
import { useResourceFilter, filterResources } from '../hooks/useResourceFilter';
import { TableRowSkeleton } from './Skeletons';

interface ResourceTableProps {
  resources: GceResource[];
  filterConfig: FilterConfig;
  onFilterChange: (config: FilterConfig) => void;
  onSaveView: (name: string) => void;
  onApplyLabels: (id: string, labels: Record<string, string>) => void;
  onUpdateLabels: (id: string, labels: Record<string, string>) => void;
  onRevert: (id: string) => void;
  // Changed signature to accept a Map for efficient diverse bulk updates
  onBulkUpdateLabels?: (updates: Map<string, Record<string, string>>) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const ResourceTable: React.FC<ResourceTableProps> = React.memo(({ 
  resources, 
  filterConfig,
  onFilterChange,
  onSaveView,
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
    paginatedResources, 
    totalPages, 
    itemsPerPage, 
    currentPage, 
    startIndex, 
    availableZones, 
    availableMachineTypes,
    setCurrentPage, 
    handleItemsPerPageChange 
  } = useResourceFilter(resources, filterConfig);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historyResource, setHistoryResource] = useState<GceResource | null>(null);
  const [isLabelingStudioOpen, setIsLabelingStudioOpen] = useState(false);

  // --- Faceted Counts Calculation ---
  const counts = useMemo(() => {
    const statusResources = filterResources(resources, filterConfig, 'statuses');
    const typeResources = filterResources(resources, filterConfig, 'types');
    const zoneResources = filterResources(resources, filterConfig, 'zones');
    const machineResources = filterResources(resources, filterConfig, 'machineTypes');

    const countMap = {
        statuses: {} as Record<string, number>,
        types: {} as Record<string, number>,
        zones: {} as Record<string, number>,
        machineTypes: {} as Record<string, number>
    };

    statusResources.forEach(r => countMap.statuses[r.status] = (countMap.statuses[r.status] || 0) + 1);
    typeResources.forEach(r => countMap.types[r.type] = (countMap.types[r.type] || 0) + 1);
    zoneResources.forEach(r => countMap.zones[r.zone] = (countMap.zones[r.zone] || 0) + 1);
    machineResources.forEach(r => { if(r.machineType) countMap.machineTypes[r.machineType] = (countMap.machineTypes[r.machineType] || 0) + 1 });

    return countMap;
  }, [resources, filterConfig]);

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

    // Pass the entire map to the bulk handler for optimized processing
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
     if (resources.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 w-full">
             <div className="bg-white dark:bg-slate-900/50 p-6 rounded-full mb-4 border border-slate-300 dark:border-slate-800 shadow-xl">
                <Search className="w-10 h-10 opacity-50" />
             </div>
             <h3 className="text-xl font-medium text-slate-700 dark:text-slate-400">No resources discovered</h3>
             <p className="max-w-xs text-center mt-2 text-sm text-slate-500">Connect to a project to view resources or check your API permissions.</p>
          </div>
        );
     }
     return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 animate-in fade-in w-full">
           <div className="bg-white dark:bg-slate-900/50 p-6 rounded-full mb-4 border border-slate-300 dark:border-slate-800 shadow-xl">
              <FilterX className="w-10 h-10 opacity-50" />
           </div>
           <h3 className="text-xl font-medium text-slate-700 dark:text-slate-400">No matching resources</h3>
           <p className="max-w-xs text-center mt-2 text-sm text-slate-500">Try adjusting your filters or search terms.</p>
           <Button variant="ghost" size="sm" className="mt-4" onClick={() => onFilterChange({ search: '', statuses: [], types: [], zones: [], machineTypes: [], hasPublicIp: null, dateStart: '', dateEnd: '', labelLogic: 'AND', labels: [], showUnlabeledOnly: false })}>
              Clear all filters
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
          availableZones={availableZones}
          availableMachineTypes={availableMachineTypes}
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

       {/* Main Table Area: Removed overflow-auto and fixed height to allow dynamic growth */}
       <div className="bg-white/40 dark:bg-slate-900/40 relative min-h-[400px]">
          <table className="w-full text-left text-sm border-collapse">
             {/* Offset sticky top to accommodate filter bar (~73px estimate, adjustable) */}
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
               
               {!isLoading && paginatedResources.map(r => (
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
               ))}
             </tbody>
          </table>
          {!isLoading && filteredResources.length === 0 && renderEmptyState()}
       </div>

       {filteredResources.length > 0 && !isLoading && (
         <div className="shrink-0">
            <PaginationControl 
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                totalItems={filteredResources.length}
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
