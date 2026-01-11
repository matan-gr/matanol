
import { useState, useMemo, useEffect } from 'react';
import { GceResource, FilterConfig } from '../types';

export const filterResources = (resources: GceResource[], config: FilterConfig, ignoreKey?: keyof FilterConfig) => {
  return resources.filter(r => {
    // 1. Text Search
    if (config.search) {
        const searchLower = config.search.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(searchLower);
        const matchesId = r.id.toLowerCase().includes(searchLower);
        const matchesLabel = Object.values(r.labels).some(v => (v as string).toLowerCase().includes(searchLower));
        const matchesZone = r.zone.toLowerCase().includes(searchLower);
        
        if (!matchesName && !matchesId && !matchesLabel && !matchesZone) return false;
    }

    // 2. Status
    if (ignoreKey !== 'statuses' && config.statuses.length > 0 && !config.statuses.includes(r.status)) return false;

    // 3. Type
    if (ignoreKey !== 'types' && config.types.length > 0 && !config.types.includes(r.type)) return false;

    // 4. Zones
    if (ignoreKey !== 'zones' && config.zones.length > 0 && !config.zones.includes(r.zone)) return false;

    // 5. Machine Types (Only for instances)
    if (ignoreKey !== 'machineTypes' && config.machineTypes.length > 0) {
      if (r.type !== 'INSTANCE' || !r.machineType || !config.machineTypes.includes(r.machineType)) return false;
    }

    // 6. Public IP
    if (ignoreKey !== 'hasPublicIp' && config.hasPublicIp !== null) {
        const hasExternal = r.ips?.some(ip => !!ip.external) || false;
        if (config.hasPublicIp && !hasExternal) return false;
        if (!config.hasPublicIp && hasExternal) return false;
    }

    // 7. Date Range
    if (config.dateStart && new Date(r.creationTimestamp) < new Date(config.dateStart)) return false;
    if (config.dateEnd) {
      const end = new Date(config.dateEnd);
      end.setHours(23, 59, 59);
      if (new Date(r.creationTimestamp) > end) return false;
    }

    // 8. Unlabeled Toggle
    if (config.showUnlabeledOnly) {
        if (Object.keys(r.labels).length > 0) return false;
    }

    // 9. Advanced Label Logic
    if (config.labels.length > 0) {
      const matches = config.labels.map(l => {
          if (!l.value) return r.labels[l.key] !== undefined;
          return r.labels[l.key] === l.value;
      });
      
      if (config.labelLogic === 'AND' && !matches.every(Boolean)) return false;
      if (config.labelLogic === 'OR' && !matches.some(Boolean)) return false;
    }

    return true;
  });
};

export const useResourceFilter = (resources: GceResource[], filterConfig: FilterConfig) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('gcp_inventory_rows');
        return saved ? parseInt(saved, 10) : 10;
    }
    return 10;
  });

  const availableZones = useMemo(() => Array.from(new Set(resources.map(r => r.zone))).sort(), [resources]);
  const availableMachineTypes = useMemo(() => Array.from(new Set(resources.filter(r => r.machineType).map(r => r.machineType!))).sort(), [resources]);

  const filteredResources = useMemo(() => filterResources(resources, filterConfig), [resources, filterConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterConfig, resources.length]);

  const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedResources = useMemo(() => filteredResources.slice(startIndex, startIndex + itemsPerPage), [filteredResources, startIndex, itemsPerPage]);

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setItemsPerPage(val);
    setCurrentPage(1);
    localStorage.setItem('gcp_inventory_rows', val.toString());
  };

  return {
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
  };
};
