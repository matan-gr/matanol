
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { GceResource } from '../types';
import { LABEL_TEMPLATES } from '../constants';
import { 
  Server, HardDrive, Zap, Clock, Check, X, Pencil, Save, 
  Trash2, Plus, ArrowRight, Copy, History, 
  CheckSquare, Square, ChevronDown, ChevronRight,
  Cpu, Tag, Globe, Network, Fingerprint, Database,
  Image as ImageIcon, Camera, Cloud, GripVertical, AlertCircle, PlayCircle, StopCircle, Box,
  Ship, User, ShieldAlert, Lock, ExternalLink, Container, Anchor
} from 'lucide-react';
import { Button, Input, Select, Badge, Tooltip, Spinner } from './DesignSystem';
import { validateKey, validateValue } from '../utils/validation';
import { RegionIcon } from './RegionIcon';
import { ServiceIcon } from './ServiceIcons';
import { motion, AnimatePresence } from 'framer-motion';

interface ResourceRowProps {
  resource: GceResource;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, labels: Record<string, string>) => void;
  onApply: (id: string, labels: Record<string, string>) => void;
  onRevert: (id: string) => void;
  onViewHistory: (r: GceResource) => void;
}

export const ResourceRow = React.memo(({ 
  resource, 
  isSelected, 
  onToggleSelect, 
  onUpdate, 
  onApply, 
  onRevert, 
  onViewHistory 
}: ResourceRowProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editForm, setEditForm] = useState<{key: string, value: string}[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Derived State
  const hasProposed = resource.proposedLabels && Object.keys(resource.proposedLabels).length > 0;
  const isFormValid = useMemo(() => editForm.every(l => !validateKey(l.key) && !validateValue(l.value)), [editForm]);
  const labelCount = Object.keys(resource.labels).length;
  const isCompliant = labelCount > 0;
  const hasHistory = resource.history && resource.history.length > 0;
  const violations = resource.violations || [];
  
  const timeAgo = useMemo(() => {
    const date = new Date(resource.creationTimestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    return "Just now";
  }, [resource.creationTimestamp]);

  // Handlers
  const startEditing = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditForm(Object.entries(resource.labels).map(([key, value]) => ({ key, value })));
    setIsExpanded(false);
  }, [resource.labels]);

  const handleSave = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newLabels: Record<string, string> = {};
    editForm.forEach(({key, value}) => {
      if (key.trim()) newLabels[key.trim()] = value.trim();
    });
    onUpdate(resource.id, newLabels);
    setIsEditing(false);
  }, [editForm, resource.id, onUpdate]);

  const addTemplate = (templateString: string) => {
    if(!templateString) return;
    const [k, v] = templateString.split('::');
    const exists = editForm.some(i => i.key === k);
    if(exists) {
      setEditForm(prev => prev.map(i => i.key === k ? { ...i, value: v } : i));
    } else {
      setEditForm(prev => [...prev, { key: k, value: v }]);
    }
  };

  const copyId = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(resource.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }, [resource.id]);

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, position: number) => {
    dragItem.current = position;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e: React.DragEvent, position: number) => {
    dragOverItem.current = position;
  };

  const handleDragEnd = () => {
    const start = dragItem.current;
    const end = dragOverItem.current;

    if (start !== null && end !== null && start !== end) {
      const newItems = [...editForm];
      const draggedItemContent = newItems[start];
      newItems.splice(start, 1);
      newItems.splice(end, 0, draggedItemContent);
      setEditForm(newItems);
    }
    
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const statusColor = resource.status === 'RUNNING' || resource.status === 'READY' || resource.status === 'RUNNABLE'
    ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 dark:text-emerald-400' 
    : resource.status === 'STOPPED' || resource.status === 'TERMINATED'
      ? 'text-slate-600 bg-slate-200 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 dark:text-slate-400' 
      : 'text-amber-700 bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 dark:text-amber-400';

  // Align middle for better vertical centering in spacious rows
  const commonTdClasses = "py-5 px-5 align-middle bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 transition-colors";

  // Helper to render specific configuration details based on type (Collapsed View)
  const renderConfiguration = () => {
    if (resource.type === 'DISK') {
        return (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <HardDrive className="w-3.5 h-3.5 text-purple-500" />
                <span>{resource.machineType || 'Standard'}</span> 
                <span className="text-slate-400 font-normal">|</span>
                <span>{resource.sizeGb}GB</span>
            </div>
        );
    }
    if (resource.type === 'CLOUD_SQL') {
        return (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Database className="w-3.5 h-3.5 text-orange-500" />
                <span>{resource.machineType || 'db-custom'}</span>
                {resource.sizeGb && <span className="text-[10px] text-slate-500 font-normal">({resource.sizeGb}GB)</span>}
            </div>
        );
    }
    if (resource.type === 'GKE_CLUSTER') {
        return (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Ship className="w-3.5 h-3.5 text-sky-500" />
                <span>{resource.clusterDetails?.nodeCount} Nodes</span>
                <span className="text-slate-400 font-normal">v{resource.clusterDetails?.version}</span>
            </div>
        );
    }
    
    // Default VM / Other
    return (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]" title={resource.machineType || resource.storageClass || ''}>
            {resource.machineType ? <Cpu className="w-3.5 h-3.5 text-slate-400"/> : <Box className="w-3.5 h-3.5 text-slate-400"/>}
            {resource.machineType || resource.storageClass || '-'}
        </div>
    );
  };

  // --- Expanded View Renderers ---

  const renderVmDetails = () => (
    <div className="space-y-4">
       <div className="text-[10px] uppercase font-bold text-blue-500 tracking-wider mb-2 flex items-center gap-2">
          <Server className="w-3 h-3"/> Instance Specs
       </div>
       <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-slate-50 dark:bg-slate-950/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] text-slate-500 mb-1">Machine Type</div>
                <div className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{resource.machineType}</div>
             </div>
             <div className="bg-slate-50 dark:bg-slate-950/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] text-slate-500 mb-1">Provisioning</div>
                <div className="flex items-center gap-2">
                   {resource.provisioningModel === 'SPOT' 
                      ? <Badge variant="warning">Spot</Badge> 
                      : <Badge variant="info">Standard</Badge>}
                </div>
             </div>
          </div>
          
          {resource.disks && (
             <div className="mt-3">
                <div className="text-[10px] text-slate-500 mb-2">Attached Storage</div>
                <div className="space-y-2">
                   {resource.disks.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                         <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded ${d.boot ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'}`}>
                               <HardDrive className="w-3.5 h-3.5" />
                            </div>
                            <div>
                               <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{d.deviceName}</div>
                               <div className="text-[10px] text-slate-400">{d.type} • {d.interface || 'SCSI'}</div>
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                               <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }}></div>
                            </div>
                            <span className="text-xs font-mono font-medium">{d.sizeGb}GB</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}
       </div>
    </div>
  );

  const renderBucketDetails = () => (
    <div className="space-y-4">
       <div className="text-[10px] uppercase font-bold text-yellow-500 tracking-wider mb-2 flex items-center gap-2">
          <Container className="w-3 h-3"/> Bucket Config
       </div>
       <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg">
             <div className="text-[10px] text-yellow-700 dark:text-yellow-500 mb-1 font-bold">Access Control</div>
             {resource.publicAccess ? (
                <Badge variant="error" className="flex items-center gap-1 w-fit"><Globe className="w-3 h-3"/> Public Internet</Badge>
             ) : (
                <Badge variant="success" className="flex items-center gap-1 w-fit"><Lock className="w-3 h-3"/> Private Access</Badge>
             )}
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg">
             <div className="text-[10px] text-slate-500 mb-1">Storage Class</div>
             <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{resource.storageClass}</div>
          </div>
          <div className="col-span-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg flex justify-between items-center">
             <div>
                <div className="text-[10px] text-slate-500">Location Type</div>
                <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{resource.locationType || 'Region'}</div>
             </div>
             <Globe className="w-5 h-5 text-slate-300" />
          </div>
       </div>
    </div>
  );

  const renderGkeDetails = () => (
    <div className="space-y-4">
       <div className="text-[10px] uppercase font-bold text-sky-500 tracking-wider mb-2 flex items-center gap-2">
          <Anchor className="w-3 h-3"/> Cluster Topology
       </div>
       <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/30 rounded-lg">
             <div>
                <div className="text-[10px] text-sky-700 dark:text-sky-400 font-bold mb-0.5">Control Plane</div>
                <div className="text-xs text-sky-900 dark:text-sky-200">v{resource.clusterDetails?.version}</div>
             </div>
             {resource.clusterDetails?.isAutopilot ? <Badge variant="info">Autopilot</Badge> : <Badge variant="neutral">Standard</Badge>}
          </div>

          <div className="space-y-2">
             <div className="flex justify-between text-[10px] text-slate-500 px-1">
                <span>Node Pools</span>
                <span>{resource.clusterDetails?.nodeCount} Total Nodes</span>
             </div>
             {resource.clusterDetails?.nodePools?.map((pool, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                   <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${pool.status === 'RUNNING' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{pool.name}</span>
                   </div>
                   <div className="flex gap-3 text-slate-500 font-mono">
                      <span>{pool.machineType || 'auto'}</span>
                      <span className="bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{pool.nodeCount} nodes</span>
                   </div>
                </div>
             ))}
          </div>
       </div>
    </div>
  );

  const renderCloudRunDetails = () => (
    <div className="space-y-4">
       <div className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider mb-2 flex items-center gap-2">
          <Zap className="w-3 h-3"/> Service Config
       </div>
       <div className="space-y-3">
          {resource.url && (
             <a href={resource.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/10 dark:hover:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-lg group transition-colors">
                <div className="truncate pr-4">
                   <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mb-0.5">Service URL</div>
                   <div className="text-xs text-indigo-900 dark:text-indigo-200 truncate">{resource.url}</div>
                </div>
                <ExternalLink className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600" />
             </a>
          )}
          
          <div className="grid grid-cols-2 gap-3">
             <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <div className="text-[10px] text-slate-400 uppercase">Memory</div>
                <div className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{resource.memory || '512Mi'}</div>
             </div>
             <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <div className="text-[10px] text-slate-400 uppercase">CPU Limit</div>
                <div className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{resource.cpu || '1.0'}</div>
             </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
             <span className="text-xs text-slate-500">Ingress</span>
             <Badge variant={resource.ingress === 'all' ? 'warning' : 'success'}>
                {resource.ingress === 'all' ? 'All Traffic' : 'Internal Only'}
             </Badge>
          </div>
       </div>
    </div>
  );

  return (
    <>
      <motion.tr 
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        onClick={() => !isEditing && !resource.isUpdating && setIsExpanded(p => !p)}
        className={`
          group transition-all duration-300 relative mb-4 hover:translate-y-[-2px]
          ${isEditing ? 'z-10' : 'cursor-pointer hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-none'}
          ${resource.isUpdating ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        {/* Loading Overlay */}
        <AnimatePresence>
          {resource.isUpdating && (
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 dark:bg-slate-950/50"
             >
             </motion.div>
          )}
        </AnimatePresence>

        {/* 1. Selection Checkbox - Rounded Left */}
        <td className={`pl-6 pr-2 rounded-l-2xl border-l border-slate-200 dark:border-slate-800 w-16 ${commonTdClasses}`} onClick={e => e.stopPropagation()}>
          <button 
            onClick={() => onToggleSelect(resource.id)} 
            disabled={resource.isUpdating}
            className={`
              p-2 rounded-lg transition-colors
              ${resource.isUpdating ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}
              ${isSelected ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-300 dark:text-slate-600'}
            `}
          >
            {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5"/>}
          </button>
        </td>

        {/* 2. Identity (Name, ID) */}
        <td className={commonTdClasses}>
          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-4">
                {/* Official GCP Service Icon */}
                <Tooltip content={resource.type.replace('_', ' ')} placement="right">
                  <div className="p-2 shrink-0 bg-transparent">
                     <ServiceIcon type={resource.type} className="w-8 h-8 drop-shadow-sm" />
                  </div>
                </Tooltip>
                <div className="flex-1 min-w-0">
                    <span className="font-bold text-slate-800 dark:text-white truncate text-[15px] leading-tight block" title={resource.name}>
                      {resource.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <code className="text-[10px] text-slate-500 font-mono bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50 max-w-[160px] truncate tabular-nums select-all" title={resource.id}>
                        {resource.id}
                        </code>
                        <button onClick={copyId} className="text-slate-400 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100">
                        {copiedId ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                        </button>
                    </div>
                </div>
                {/* Dynamically change expansion indicator */}
                <div className="ml-2">
                    {isExpanded 
                    ? <ChevronDown className="w-4 h-4 text-slate-400 transition-transform duration-200" /> 
                    : <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:translate-x-1" />
                    }
                </div>
             </div>
          </div>
        </td>

        {/* 3. Infrastructure (Type, Zone) */}
        <td className={commonTdClasses}>
           <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {resource.type === 'INSTANCE' ? 'VM Instance' : 
                     resource.type === 'CLOUD_SQL' ? 'Cloud SQL' : 
                     resource.type === 'BUCKET' ? 'Storage Bucket' :
                     resource.type === 'DISK' ? 'Persistent Disk' :
                     resource.type === 'CLOUD_RUN' ? 'Cloud Run' :
                     resource.type === 'GKE_CLUSTER' ? 'GKE Cluster' :
                     resource.type.charAt(0) + resource.type.slice(1).toLowerCase().replace('_', ' ')}
                 </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                 <RegionIcon zone={resource.zone} className="w-4 h-3 rounded-[2px] shadow-sm opacity-90" />
                 <span className="font-mono text-[11px] tabular-nums">{resource.zone === 'global' ? 'Global' : resource.zone}</span>
              </div>
           </div>
        </td>

        {/* 4. Configuration (Specs) - DYNAMIC PER TYPE */}
        <td className={commonTdClasses}>
           <div className="space-y-1.5">
              {renderConfiguration()}
              {/* Contextual Detail based on type */}
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400 items-center">
                 {resource.type === 'INSTANCE' && (
                    <>
                        {resource.provisioningModel && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                                resource.provisioningModel === 'SPOT' 
                                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400' 
                                : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                                {resource.provisioningModel}
                            </span>
                        )}
                        {resource.sizeGb && <span>Boot: {resource.sizeGb}GB</span>}
                    </>
                 )}
                 {resource.ips?.some(i => i.external) && <span className="text-amber-600 dark:text-amber-500 font-bold border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded text-[9px]">Public IP</span>}
              </div>
           </div>
        </td>

        {/* 5. State & Lifecycle - DYNAMIC */}
        <td className={commonTdClasses}>
           <div className="flex flex-col gap-2">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold w-fit tracking-wide shadow-sm ${statusColor}`}>
                {resource.status === 'RUNNING' || resource.status === 'READY' ? <PlayCircle className="w-3 h-3" /> : 
                resource.status === 'STOPPED' || resource.status === 'TERMINATED' ? <StopCircle className="w-3 h-3" /> : 
                <AlertCircle className="w-3 h-3" />}
                {resource.status}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                <Clock className="w-3 h-3" />
                <span className="tabular-nums font-medium">{timeAgo}</span>
            </div>
           </div>
        </td>

        {/* 6. Governance (Labels) */}
        <td className={commonTdClasses} onClick={(e) => isEditing && e.stopPropagation()}>
           {isEditing ? (
             <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl p-4 min-w-[340px] z-20 absolute top-4 left-0 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                   <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                     <Tag className="w-3 h-3" /> Manage Labels
                   </h4>
                   <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-4 h-4"/></button>
                </div>
                
                <div className="space-y-2 max-h-[240px] overflow-y-visible pr-1 custom-scrollbar">
                   {editForm.map((item, idx) => {
                      const suggestions = focusedIdx === idx && item.key.length > 0 
                        ? LABEL_TEMPLATES.filter(t => t.key.toLowerCase().includes(item.key.toLowerCase()) && t.key !== item.key).slice(0, 5) 
                        : [];

                      return (
                      <div 
                        key={idx} 
                        className="flex gap-2 items-center group/item transition-transform duration-200 ease-out"
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragEnter={(e) => handleDragEnter(e, idx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                      >
                         <div className="cursor-move text-slate-300 hover:text-slate-500">
                            <GripVertical className="w-3.5 h-3.5" />
                         </div>
                         <div className="relative flex-1">
                            <Input 
                                value={item.key} 
                                placeholder="Key" 
                                className="h-8 text-xs py-1 font-mono"
                                onChange={e => { const n = [...editForm]; n[idx].key = e.target.value; setEditForm(n); }}
                                onFocus={() => setFocusedIdx(idx)}
                                onBlur={() => setTimeout(() => setFocusedIdx(null), 200)}
                                error={validateKey(item.key) || undefined}
                            />
                            <AnimatePresence>
                                {suggestions.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="absolute left-0 top-full mt-1 w-[200px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl z-50 overflow-hidden"
                                    >
                                        {suggestions.map(s => (
                                            <button
                                                key={`${s.key}-${s.value}`}
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors flex flex-col border-b last:border-0 border-slate-100 dark:border-slate-700/50"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const n = [...editForm];
                                                    n[idx].key = s.key;
                                                    n[idx].value = s.value;
                                                    setEditForm(n);
                                                    setFocusedIdx(null);
                                                }}
                                            >
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{s.key}</span>
                                                <span className="text-[10px] text-slate-500">{s.value}</span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                         </div>
                         <span className="text-slate-300">:</span>
                         <div className="flex-1">
                            <Input 
                                value={item.value} 
                                placeholder="Value" 
                                className="h-8 text-xs py-1 font-mono"
                                onChange={e => { const n = [...editForm]; n[idx].value = e.target.value; setEditForm(n); }}
                                error={validateValue(item.value) || undefined}
                            />
                         </div>
                         <button 
                            onClick={() => setEditForm(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                         >
                            <Trash2 className="w-3.5 h-3.5" />
                         </button>
                      </div>
                   )})}
                   {editForm.length === 0 && <div className="text-xs text-slate-400 italic text-center py-2">No labels assigned</div>}
                </div>
                
                <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-2">
                   <div className="flex gap-2">
                      <Button size="xs" variant="ghost" onClick={() => setEditForm(p => [...p, {key:'', value:''}])} leftIcon={<Plus className="w-3 h-3" />}>Add</Button>
                      <Select className="h-7 text-xs py-1 w-28" onChange={(e) => { addTemplate(e.target.value); e.target.value=""; }}>
                         <option value="">Templates...</option>
                         {LABEL_TEMPLATES.map((t, i) => <option key={i} value={`${t.key}::${t.value}`}>{t.label}</option>)}
                      </Select>
                   </div>
                   <Button size="xs" variant="primary" disabled={!isFormValid} onClick={handleSave} leftIcon={<Save className="w-3 h-3" />}>Save</Button>
                </div>
             </div>
           ) : (
             <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5 content-start">
                   {Object.entries(resource.labels).slice(0, 4).map(([k, v]) => (
                      <span key={k} className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 max-w-[140px] truncate" title={`${k}: ${v}`}>
                         <span className="opacity-60 mr-1">{k}:</span> {v}
                      </span>
                   ))}
                   {Object.keys(resource.labels).length > 4 && (
                      <span className="text-[10px] text-slate-400 px-1 py-0.5">+{Object.keys(resource.labels).length - 4} more</span>
                   )}
                   {violations.length > 0 ? (
                      <Tooltip content={`${violations.length} policy violations found`}>
                         <span className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                            <ShieldAlert className="w-3 h-3" /> {violations.length}
                         </span>
                      </Tooltip>
                   ) : !isCompliant && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                         <X className="w-3 h-3" /> Unlabeled
                      </span>
                   )}
                </div>

                {hasProposed && (
                   <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 animate-in slide-in-from-left-2 duration-300">
                      <div className="w-full text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                         <Zap className="w-3 h-3" /> AI Suggestion
                      </div>
                      {Object.entries(resource.proposedLabels || {}).map(([k, v]) => {
                          const isNew = resource.labels[k] === undefined;
                          return (
                              <Badge key={k} variant={isNew ? 'success' : 'warning'} className="max-w-full truncate text-[10px] px-1.5 py-0.5 border-dashed">
                                  {isNew ? <Plus className="w-2.5 h-2.5 mr-1" /> : <ArrowRight className="w-2.5 h-2.5 mr-1" />}
                                  {k}:{v}
                              </Badge>
                          )
                      })}
                   </div>
                )}
             </div>
           )}
        </td>

        {/* 7. Actions - Rounded Right */}
        <td className={`pr-6 pl-4 rounded-r-2xl border-r border-slate-200 dark:border-slate-800 relative z-20 w-[120px] ${commonTdClasses}`}>
           <div className="flex items-center justify-end gap-1 min-h-[32px]">
              {resource.isUpdating ? (
                 <div className="flex items-center gap-2 text-indigo-500 animate-in fade-in">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Updating</span>
                    <Spinner className="w-4 h-4" />
                 </div>
              ) : (
                 !isEditing && (
                    <>
                        {hasProposed ? (
                           <div className="flex items-center gap-1">
                             <Button 
                                size="xs" 
                                variant="success" 
                                onClick={(e) => { e.stopPropagation(); onApply(resource.id, resource.proposedLabels!); }} 
                                className="h-8 px-2" 
                                leftIcon={<Check className="w-3.5 h-3.5" />}
                              >
                                Apply
                              </Button>
                             <Button 
                                size="xs" 
                                variant="danger" 
                                onClick={(e) => { e.stopPropagation(); onRevert(resource.id); }} 
                                className="h-8 px-2"
                                leftIcon={<X className="w-3.5 h-3.5" />}
                              >
                                Reject
                              </Button>
                           </div>
                        ) : (
                           <>
                              <button 
                                 onClick={(e) => { e.stopPropagation(); onViewHistory(resource); }}
                                 className={`
                                   p-2 rounded-lg transition-colors relative group/hist
                                   ${hasHistory 
                                     ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20' 
                                     : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'}
                                 `}
                                 title="View Audit History"
                              >
                                 <History className="w-4 h-4" />
                                 {hasHistory && (
                                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-50 rounded-full border border-white dark:border-slate-900"></span>
                                 )}
                              </button>
                              <button 
                                 onClick={startEditing} 
                                 className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                 title="Edit Labels"
                              >
                                 <Pencil className="w-4 h-4" />
                              </button>
                           </>
                        )}
                    </>
                 )
              )}
           </div>
        </td>
      </motion.tr>

      {/* Expanded Details Panel */}
      {isExpanded && !isEditing && (
        <tr>
          <td colSpan={7} className="p-0 border-none">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 mx-6 mb-6 -mt-2 border border-slate-200 dark:border-slate-800 rounded-b-2xl bg-slate-50 dark:bg-slate-950 shadow-inner relative z-0">
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-black/5 to-transparent dark:from-black/20 pointer-events-none"></div>
                
                {/* Column 1: Identity & Violations */}
                <div className="space-y-4">
                   <div>
                     <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-2">
                        <Fingerprint className="w-3 h-3"/> Identity & Policy
                     </div>
                     <div className="space-y-2">
                        <div className="group relative">
                          <label className="text-[10px] text-slate-500 block">Resource ID</label>
                          <code className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 break-all tabular-nums">
                             {resource.id}
                          </code>
                        </div>
                        
                        {/* Violations List */}
                        {violations.length > 0 && (
                           <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg p-3 space-y-2">
                              <label className="text-[10px] uppercase font-bold text-red-500 tracking-wider">Policy Violations</label>
                              {violations.map((v, i) => (
                                 <div key={i} className="flex gap-2 text-xs text-red-700 dark:text-red-300">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>{v.message}</span>
                                 </div>
                              ))}
                           </div>
                        )}
                        {resource.serviceAccount && (
                           <div>
                              <label className="text-[10px] text-slate-500 block">Service Account</label>
                              <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 break-all">
                                 <User className="w-3 h-3 text-slate-400 shrink-0" />
                                 {resource.serviceAccount}
                              </div>
                           </div>
                        )}
                     </div>
                   </div>
                </div>
                
                {/* Column 2: Provisioning & Lifecycle */}
                <div className="space-y-4">
                   <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-2">
                      <Clock className="w-3 h-3"/> Lifecycle & Cost
                   </div>
                   <div className="space-y-2">
                     <div>
                        <label className="text-[10px] text-slate-500 block">Created At</label>
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                           {new Date(resource.creationTimestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                     </div>
                     <div>
                        <label className="text-[10px] text-slate-500 block">Provisioning Model</label>
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                           {resource.provisioningModel || 'Standard'}
                        </div>
                     </div>
                     {resource.description && (
                        <div>
                           <label className="text-[10px] text-slate-500 block">Description</label>
                           <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                              "{resource.description}"
                           </p>
                        </div>
                     )}
                   </div>
                </div>

                {/* Column 3: Network */}
                <div className="space-y-4">
                   <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-2">
                      <Network className="w-3 h-3"/> Network & Tags
                   </div>
                   <div className="space-y-3">
                      {resource.tags && resource.tags.length > 0 && (
                         <div>
                            <label className="text-[10px] text-slate-500 block mb-1">Network Tags</label>
                            <div className="flex flex-wrap gap-1">
                               {resource.tags.map((tag, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                                     {tag}
                                  </span>
                               ))}
                            </div>
                         </div>
                      )}
                      {resource.ips && resource.ips.length > 0 ? (
                        resource.ips.map((ip, i) => (
                           <div key={i}>
                              <label className="text-[10px] text-slate-500 block">IP ({ip.network})</label>
                              <code className="text-xs font-mono text-slate-700 dark:text-slate-300 block select-all">
                                 {ip.external || ip.internal}
                              </code>
                           </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 italic">No network interfaces</div>
                      )}
                   </div>
                </div>

                {/* Column 4: SPECIALIZED DETAILS */}
                {resource.type === 'INSTANCE' && renderVmDetails()}
                {resource.type === 'BUCKET' && renderBucketDetails()}
                {resource.type === 'GKE_CLUSTER' && renderGkeDetails()}
                {resource.type === 'CLOUD_RUN' && renderCloudRunDetails()}
                
                {/* Fallback for generic types (Disks, SQL) */}
                {!['INSTANCE', 'BUCKET', 'GKE_CLUSTER', 'CLOUD_RUN'].includes(resource.type) && (
                    <div className="space-y-4">
                       <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-2">
                          <HardDrive className="w-3 h-3"/> Config Details
                       </div>
                       <div className="space-y-3">
                          {/* SQL Special Handling */}
                          {resource.type === 'CLOUD_SQL' && (
                             <div className="p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-lg space-y-2">
                                <div className="flex justify-between">
                                   <span className="text-xs text-orange-800 dark:text-orange-200 font-bold">DB Tier</span>
                                   <span className="text-xs font-mono">{resource.machineType}</span>
                                </div>
                                <div className="flex justify-between">
                                   <span className="text-xs text-orange-800 dark:text-orange-200 font-bold">Version</span>
                                   <span className="text-xs font-mono">{resource.databaseVersion || 'Postgres'}</span>
                                </div>
                             </div>
                          )}

                          {/* Disk Special Handling */}
                          {resource.type === 'DISK' && (
                             <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/10 rounded border border-purple-100 dark:border-purple-800">
                                   <div className="text-[10px] text-purple-500 uppercase font-bold">IOPS</div>
                                   <div className="font-mono text-sm">{resource.provisionedIops || 'N/A'}</div>
                                </div>
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/10 rounded border border-purple-100 dark:border-purple-800">
                                   <div className="text-[10px] text-purple-500 uppercase font-bold">Throughput</div>
                                   <div className="font-mono text-sm">{resource.provisionedThroughput || 'N/A'} MB/s</div>
                                </div>
                             </div>
                          )}
                          
                          {/* Generic Fallback */}
                          <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
                             <div className="text-[10px] text-slate-500 mb-1">Configuration</div>
                             <div className="font-mono text-sm text-slate-700 dark:text-slate-300">
                                {resource.machineType || resource.storageClass || 'Standard Config'}
                             </div>
                          </div>
                       </div>
                    </div>
                )}

             </div>
          </td>
        </tr>
      )}
    </>
  );
});
