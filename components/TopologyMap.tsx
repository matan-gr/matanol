
import React, { useCallback, useEffect, useState, memo, useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  Handle,
  Position,
  Node,
  Edge,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  MarkerType,
  BackgroundVariant,
  ConnectionLineType,
  MiniMap
} from 'reactflow';
import dagre from 'dagre';
import { GceResource } from '../types';
import { 
  Server, HardDrive, Globe, Cloud, Database, Monitor, 
  Activity, X, Network as NetworkIcon,
  Maximize, Cpu, Zap, Box, Layers, ArrowRight, Tag,
  MoreVertical, Power, Terminal, ShieldCheck
} from 'lucide-react';
import { RegionIcon } from './RegionIcon';
import { Badge, Button, ToggleSwitch } from './DesignSystem';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface TopologyFilters {
  showDisks: boolean;
  showStopped: boolean;
  showOrphans: boolean;
}

// --- Constants ---
const NODE_WIDTH = 280;
const NODE_HEIGHT = 100;

// --- Helper Components ---

const StatusIndicator = ({ status }: { status: string }) => {
  const isRunning = status === 'RUNNING' || status === 'READY';
  const isStopped = status === 'STOPPED' || status === 'TERMINATED';
  
  if (isRunning) return <span className="flex h-2.5 w-2.5 relative">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
  </span>;
  
  if (isStopped) return <span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-slate-600"></span>;
  
  return <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>;
};

// --- Custom Nodes ---

const NetworkNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`
    relative w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-500 group
    ${selected 
      ? 'bg-blue-600/20 shadow-[0_0_60px_rgba(37,99,235,0.4)] scale-110 z-50 ring-2 ring-blue-500' 
      : 'bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 backdrop-blur-md hover:bg-slate-200 dark:hover:bg-slate-800'}
  `}>
    <Handle type="source" position={Position.Right} className="!opacity-0" />
    <Handle type="target" position={Position.Left} className="!opacity-0" />
    
    {/* Rotating Rings */}
    <div className={`absolute inset-0 rounded-full border border-dashed border-slate-400 dark:border-slate-700 opacity-30 ${selected ? 'animate-spin-slow duration-[10s]' : ''}`}></div>
    <div className={`absolute inset-2 rounded-full border border-dotted border-indigo-400 dark:border-indigo-700 opacity-30 ${selected ? 'animate-spin-slow duration-[15s] direction-reverse' : ''}`}></div>
    
    <div className="relative z-10 p-4 bg-white dark:bg-slate-950 rounded-full shadow-xl border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform duration-300">
        <NetworkIcon className={`w-8 h-8 ${selected ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />
    </div>

    <div className={`
        absolute -bottom-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border transition-all whitespace-nowrap shadow-sm
        ${selected 
            ? 'bg-blue-600 text-white border-blue-500 translate-y-1' 
            : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'}
    `}>
      {data.label}
    </div>
  </div>
));

const ResourceNode = memo(({ data, selected }: { data: any, selected: boolean }) => {
  const isRunning = data.status === 'RUNNING' || data.status === 'READY';
  const isActive = selected || data.isRelated;
  const isDimmed = data.isDimmed;

  const getIcon = () => {
    switch(data.type) {
      case 'INSTANCE': return <Server className={`w-5 h-5 ${isRunning ? 'text-emerald-500' : 'text-slate-400'}`} />;
      case 'DISK': return <HardDrive className="w-5 h-5 text-purple-500" />;
      case 'CLOUD_RUN': return <Cloud className="w-5 h-5 text-indigo-500" />;
      case 'CLOUD_SQL': return <Database className="w-5 h-5 text-cyan-500" />;
      case 'BUCKET': return <Box className="w-5 h-5 text-yellow-500" />;
      default: return <Monitor className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className={`
      relative min-w-[260px] rounded-xl overflow-hidden transition-all duration-300
      ${isDimmed ? 'opacity-30 grayscale blur-[1px] scale-95' : 'opacity-100'}
      ${selected 
        ? 'bg-white dark:bg-slate-900 ring-2 ring-indigo-500 shadow-[0_0_40px_rgba(99,102,241,0.3)] z-50 scale-105' 
        : 'bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-lg hover:shadow-xl'}
    `}>
      <Handle type="target" position={Position.Left} className="!w-1 !h-8 !bg-slate-300 dark:!bg-slate-600 !rounded-full !-left-1.5 !border-none" />
      
      {/* Top Bar Status Line */}
      <div className={`h-1 w-full ${isRunning ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
             <div className={`p-2.5 rounded-lg border shadow-sm transition-colors ${selected ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'}`}>
                {getIcon()}
             </div>
             <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[140px] leading-tight" title={data.label}>
                    {data.label}
                </div>
                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mt-0.5">
                   {data.type}
                </div>
             </div>
          </div>
          <StatusIndicator status={data.status} />
        </div>

        {/* Metrics / Details */}
        <div className="space-y-2">
           {data.type === 'INSTANCE' && (
              <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded-md border border-slate-100 dark:border-slate-800">
                 <Cpu className="w-3 h-3 text-slate-400" />
                 <span className="font-mono">{data.machineType}</span>
              </div>
           )}
           
           <div className="flex justify-between items-center">
              {data.zone && data.zone !== 'global' && (
                 <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <RegionIcon zone={data.zone} className="w-3.5 h-2.5 rounded-[1px]" />
                    <span>{data.zone}</span>
                 </div>
              )}
              {data.zone === 'global' && (
                 <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Globe className="w-3 h-3" />
                    <span>Global</span>
                 </div>
              )}
           </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!w-1 !h-8 !bg-slate-300 dark:!bg-slate-600 !rounded-full !-right-1.5 !border-none" />
    </div>
  );
});

const nodeTypes = {
  network: NetworkNode,
  resource: ResourceNode,
};

// --- Layout Engine ---

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ 
    rankdir: direction, 
    align: 'DL', 
    nodesep: 40, 
    ranksep: 100, 
    ranker: 'longest-path'
  });

  nodes.forEach((node) => {
    const width = node.type === 'network' ? 150 : NODE_WIDTH + 20;
    const height = node.type === 'network' ? 150 : NODE_HEIGHT + 20;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - (node.type === 'network' ? 75 : NODE_WIDTH / 2),
        y: nodeWithPosition.y - (node.type === 'network' ? 75 : NODE_HEIGHT / 2),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// --- Main Component ---

interface TopologyMapProps {
  resources: GceResource[];
}

const TopologyMapInner: React.FC<TopologyMapProps> = ({ resources }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TopologyFilters>({
    showDisks: true,
    showStopped: true,
    showOrphans: true
  });
  
  const { fitView } = useReactFlow();

  // Memoized Selected Resource
  const selectedResource = useMemo(() => {
     if (!selectedNodeId) return null;
     const node = nodes.find(n => n.id === selectedNodeId);
     return node?.data.resource as GceResource | undefined;
  }, [selectedNodeId, nodes]);

  // Structural Hash
  const topologyHash = useMemo(() => {
    return resources.map(r => `${r.id}-${r.status}-${r.ips?.length}-${r.disks?.length}`).join('|') 
           + `-${filters.showDisks}-${filters.showStopped}-${filters.showOrphans}`;
  }, [resources, filters]);

  // Graph Building
  useEffect(() => {
    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];
    const createdNetworks = new Set<string>();
    const createdZones = new Set<string>();

    const activeResources = resources.filter(r => filters.showStopped || (r.status !== 'STOPPED' && r.status !== 'TERMINATED'));

    // 1. Create Networks
    activeResources.forEach(r => {
      r.ips?.forEach(ip => {
        if (!createdNetworks.has(ip.network)) {
          createdNetworks.add(ip.network);
          rawNodes.push({
            id: `net-${ip.network}`,
            type: 'network',
            data: { label: ip.network },
            position: { x: 0, y: 0 },
            zIndex: 10
          });
        }
      });
    });

    // 2. Create Global/Zone Hubs for Orphans
    if (filters.showOrphans) {
        activeResources.forEach(r => {
            if (!r.ips || r.ips.length === 0) {
                const hubId = `hub-${r.zone}`;
                if (!createdZones.has(hubId)) {
                    createdZones.add(hubId);
                    rawNodes.push({
                        id: hubId,
                        type: 'network',
                        data: { label: r.zone === 'global' ? 'Global' : r.zone },
                        position: { x: 0, y: 0 },
                        zIndex: 10
                    });
                }
            }
        });
    }

    // 3. Create Resources & Edges
    activeResources.forEach(r => {
      const isRunning = r.status === 'RUNNING' || r.status === 'READY';
      
      rawNodes.push({
        id: r.id,
        type: 'resource',
        data: { 
          label: r.name, 
          machineType: r.machineType,
          storageClass: r.storageClass,
          type: r.type,
          status: r.status,
          zone: r.zone,
          resource: r,
          isDimmed: false // Initial state
        },
        position: { x: 0, y: 0 },
        zIndex: 20,
      });

      // Connections
      let connected = false;
      
      // Network Connection
      r.ips?.forEach(ip => {
        rawEdges.push({
          id: `e-${ip.network}-${r.id}`,
          source: `net-${ip.network}`,
          target: r.id,
          type: 'smoothstep',
          animated: isRunning,
          style: { stroke: isRunning ? '#10b981' : '#64748b', strokeWidth: 1.5 },
        });
        connected = true;
      });

      // Orphan Connection
      if (!connected && filters.showOrphans) {
          rawEdges.push({
              id: `e-hub-${r.zone}-${r.id}`,
              source: `hub-${r.zone}`,
              target: r.id,
              type: 'smoothstep',
              style: { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5,5' }
          });
      }

      // Disks
      if (filters.showDisks) {
        r.disks?.forEach((d, idx) => {
          const diskId = `${r.id}-disk-${idx}`;
          // Mock resource for disk
          const diskRes = { ...r, id: diskId, type: 'DISK', name: d.deviceName, sizeGb: d.sizeGb.toString(), machineType: `${d.sizeGb}GB`, status: 'READY' };
          
          rawNodes.push({
            id: diskId,
            type: 'resource',
            data: { 
              label: d.deviceName, 
              machineType: `${d.sizeGb}GB`, 
              type: 'DISK',
              status: 'READY',
              resource: diskRes
            },
            position: { x: 0, y: 0 },
            zIndex: 20
          });

          rawEdges.push({
            id: `e-${r.id}-${diskId}`,
            source: r.id,
            target: diskId,
            type: 'default',
            animated: false,
            style: { stroke: '#a855f7', strokeWidth: 2 }
          });
        });
      }
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    setTimeout(() => fitView({ padding: 0.2 }), 50);

  }, [topologyHash, fitView, setNodes, setEdges]); // Removed selectedNodeId from here to prevent re-layout on click

  // Focus Mode Effect (Visual Update Only)
  useEffect(() => {
    setNodes((nds) => 
      nds.map((node) => {
        const isSelected = node.id === selectedNodeId;
        const isNeighbor = edges.some(e => 
            (e.source === selectedNodeId && e.target === node.id) || 
            (e.target === selectedNodeId && e.source === node.id)
        );
        const isFocus = !selectedNodeId || isSelected || isNeighbor;
        
        return {
          ...node,
          selected: isSelected,
          data: { ...node.data, isDimmed: !isFocus }
        };
      })
    );

    setEdges((eds) => 
        eds.map((edge) => {
            const isConnected = edge.source === selectedNodeId || edge.target === selectedNodeId;
            const isFocus = !selectedNodeId || isConnected;
            return {
                ...edge,
                style: { 
                    ...edge.style, 
                    opacity: isFocus ? 1 : 0.1,
                    strokeWidth: isConnected ? 3 : (edge.style?.strokeWidth || 1)
                },
                zIndex: isConnected ? 50 : 0
            };
        })
    );
  }, [selectedNodeId, setNodes, setEdges, edges]); // Depend on edges to find neighbors

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'resource' || node.type === 'network') {
      setSelectedNodeId(node.id);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm relative flex">
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        minZoom={0.1}
        maxZoom={3}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#94a3b8" className="opacity-30" />
        
        <Controls className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 fill-slate-600 dark:fill-slate-300" />
        
        <MiniMap 
            nodeColor={(n) => n.type === 'network' ? '#3b82f6' : '#cbd5e1'} 
            maskColor="rgba(15, 23, 42, 0.1)"
            className="!bg-white/50 dark:!bg-slate-900/50 !border-slate-200 dark:!border-slate-800 rounded-lg"
        />

        <Panel position="top-left" className="m-4">
           <div className="glass-panel p-4 rounded-xl shadow-lg w-64 space-y-4 animate-in fade-in slide-in-from-left-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/50">
                 <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Visualization Layers</h3>
                 <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div className="space-y-3">
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Attached Disks</span>
                    <ToggleSwitch checked={filters.showDisks} onChange={v => setFilters(p => ({...p, showDisks: v}))} />
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Stopped Resources</span>
                    <ToggleSwitch checked={filters.showStopped} onChange={v => setFilters(p => ({...p, showStopped: v}))} />
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Orphaned Items</span>
                    <ToggleSwitch checked={filters.showOrphans} onChange={v => setFilters(p => ({...p, showOrphans: v}))} />
                 </div>
              </div>
              <Button size="xs" variant="outline" className="w-full" onClick={() => fitView({ duration: 600 })}>
                 <Maximize className="w-3 h-3 mr-2" /> Reset View
              </Button>
           </div>
        </Panel>
      </ReactFlow>

      {/* Detail Side Panel */}
      <AnimatePresence>
        {selectedResource && (
          <motion.div 
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute right-0 top-0 bottom-0 w-[420px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col"
          >
             {/* Panel Header */}
             <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div className="flex justify-between items-start mb-4">
                   <div className="flex gap-2">
                       <Badge variant="neutral" className="font-mono">{selectedResource.type}</Badge>
                       <Badge variant={selectedResource.status === 'RUNNING' || selectedResource.status === 'READY' ? 'success' : 'error'}>{selectedResource.status}</Badge>
                   </div>
                   <button onClick={() => setSelectedNodeId(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                      <X className="w-5 h-5 text-slate-500" />
                   </button>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white break-all leading-tight mb-2">
                    {selectedResource.name}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <Globe className="w-3 h-3" /> {selectedResource.zone}
                    <span className="text-slate-300">|</span>
                    <span className="truncate">{selectedResource.id}</span>
                </div>
             </div>

             {/* Panel Content */}
             <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3">
                   <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Specification</div>
                      <div className="font-bold text-slate-700 dark:text-slate-200 truncate" title={selectedResource.machineType || selectedResource.storageClass}>
                         {selectedResource.machineType || selectedResource.storageClass || 'N/A'}
                      </div>
                   </div>
                   <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Provisioning</div>
                      <div className="font-bold text-slate-700 dark:text-slate-200">
                         {selectedResource.provisioningModel || 'Standard'}
                      </div>
                   </div>
                </div>

                {/* Labels */}
                <div>
                   <h3 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2">
                      <Tag className="w-3 h-3" /> Labels & Tags
                   </h3>
                   {Object.keys(selectedResource.labels || {}).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                         {Object.entries(selectedResource.labels).map(([k,v]) => (
                            <span key={k} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/30">
                               <span className="opacity-60 mr-1">{k}:</span> {v}
                            </span>
                         ))}
                      </div>
                   ) : (
                      <div className="text-xs text-slate-400 italic">No labels assigned.</div>
                   )}
                </div>

                {/* Network */}
                {selectedResource.ips && selectedResource.ips.length > 0 && (
                   <div>
                      <h3 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2">
                         <NetworkIcon className="w-3 h-3" /> Networking
                      </h3>
                      <div className="space-y-3">
                         {selectedResource.ips.map((ip, i) => (
                            <div key={i} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-2 bg-white dark:bg-slate-900">
                               <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
                                  <span>VPC Network</span>
                                  <span>{ip.network}</span>
                               </div>
                               <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 font-mono text-slate-600 dark:text-slate-400">
                                  <div className="flex justify-between"><span>Internal IP</span> <span className="select-all">{ip.internal}</span></div>
                                  {ip.external && <div className="flex justify-between text-blue-600 dark:text-blue-400"><span>Public IP</span> <span className="select-all">{ip.external}</span></div>}
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                )}

                {/* Storage */}
                {selectedResource.disks && selectedResource.disks.length > 0 && (
                   <div>
                      <h3 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-2">
                         <HardDrive className="w-3 h-3" /> Attached Storage
                      </h3>
                      <div className="space-y-2">
                         {selectedResource.disks.map((d, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs">
                               <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${d.boot ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">{d.deviceName}</span>
                               </div>
                               <div className="font-mono text-slate-500">{d.sizeGb} GB</div>
                            </div>
                         ))}
                      </div>
                   </div>
                )}
             </div>

             {/* Actions Footer */}
             <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 grid grid-cols-2 gap-3">
                <Button variant="secondary" size="sm" onClick={() => {}} leftIcon={<Terminal className="w-3 h-3"/>}>SSH Connect</Button>
                <Button variant="secondary" size="sm" onClick={() => {}} leftIcon={<Activity className="w-3 h-3"/>}>View Metrics</Button>
                <div className="col-span-2 pt-2">
                   <Button variant="primary" className="w-full" onClick={() => setSelectedNodeId(null)}>Close Panel</Button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const TopologyMap: React.FC<TopologyMapProps> = memo((props) => (
  <ReactFlowProvider>
    <TopologyMapInner {...props} />
  </ReactFlowProvider>
));
