
import React, { useCallback, useEffect, useState, memo } from 'react';
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
  ConnectionLineType
} from 'reactflow';
import dagre from 'dagre';
import { GceResource } from '../types';
import { 
  Server, HardDrive, Globe, Cloud, Database, Monitor, 
  Activity, X, Network as NetworkIcon,
  Maximize, Cpu, Zap, Box, Layers, ArrowRight
} from 'lucide-react';
import { RegionIcon } from './RegionIcon';
import { Badge, Button, ToggleSwitch } from './DesignSystem';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface TopologyFilters {
  showDisks: boolean;
  showStopped: boolean;
  groupZones: boolean;
}

// --- Custom Nodes ---

const NetworkNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`
    relative w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-500 group
    ${selected 
      ? 'bg-blue-600/90 shadow-[0_0_50px_rgba(37,99,235,0.5)] scale-110 z-50' 
      : 'bg-slate-900/90 dark:bg-slate-950/90 shadow-2xl border border-slate-700/50 backdrop-blur-md'}
  `}>
    <Handle type="source" position={Position.Right} className="!opacity-0" />
    <Handle type="target" position={Position.Left} className="!opacity-0" />
    
    {/* Orbiting Ring Effect */}
    <div className={`absolute inset-0 rounded-full border-2 border-dashed border-slate-600/50 ${selected ? 'animate-spin-slow' : 'group-hover:animate-spin-slow'}`}></div>
    <div className={`absolute inset-[-4px] rounded-full border border-slate-700/30 opacity-50`}></div>
    
    <div className="relative z-10 p-3 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full border border-slate-700 shadow-inner">
        <NetworkIcon className={`w-8 h-8 ${selected ? 'text-white' : 'text-blue-400'}`} />
    </div>

    <div className={`
        absolute -bottom-8 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border transition-all
        ${selected 
            ? 'bg-blue-600 text-white border-blue-500 shadow-lg' 
            : 'bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}
    `}>
      {data.label}
    </div>
  </div>
));

const ResourceNode = memo(({ data, selected }: { data: any, selected: boolean }) => {
  const isRunning = data.status === 'RUNNING' || data.status === 'READY';
  const isStopped = data.status === 'STOPPED' || data.status === 'TERMINATED';
  
  const getIcon = () => {
    switch(data.type) {
      case 'INSTANCE': return <Server className={`w-5 h-5 ${isRunning ? 'text-emerald-500' : 'text-slate-400'}`} />;
      case 'DISK': return <HardDrive className="w-5 h-5 text-purple-500" />;
      case 'CLOUD_RUN': return <Cloud className="w-5 h-5 text-indigo-500" />;
      case 'CLOUD_SQL': return <Database className="w-5 h-5 text-orange-500" />;
      default: return <Monitor className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusColor = () => {
      if (isRunning) return 'border-l-emerald-500 shadow-emerald-500/10';
      if (isStopped) return 'border-l-red-500 shadow-red-500/10';
      return 'border-l-slate-400';
  };

  return (
    <div className={`
      relative min-w-[240px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-l-4 transition-all duration-300 rounded-lg overflow-hidden group
      ${getStatusColor()}
      ${selected 
        ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/50 scale-105 z-50' 
        : 'border-y border-r border-y-slate-200 dark:border-y-slate-800 border-r-slate-200 dark:border-r-slate-800 shadow-lg hover:shadow-xl hover:-translate-y-1'}
    `}>
      <Handle type="target" position={Position.Left} className="!bg-slate-400/50 !w-2 !h-2 !-left-[5px] !border-none" />
      
      {/* Gloss Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

      <div className="p-3.5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-lg border shadow-sm ${selected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                {getIcon()}
             </div>
             <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px]" title={data.label}>
                    {data.label}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                   {data.type === 'INSTANCE' ? data.machineType : data.type}
                </div>
             </div>
          </div>
          
          {data.zone && data.zone !== 'global' && (
             <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-500 uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                <RegionIcon zone={data.zone} className="w-3 h-2" />
                <span>{data.zone.split('-')[1]}</span>
             </div>
          )}
        </div>

        {/* Visual Specs / Mini Metrics */}
        {data.type === 'INSTANCE' && (
           <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                 <span>Resources</span>
                 <span className={isRunning ? 'text-emerald-500' : 'text-slate-500'}>{isRunning ? 'Active' : 'Stopped'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <div className="bg-slate-100 dark:bg-slate-950 rounded px-2 py-1 flex items-center gap-2 border border-slate-100 dark:border-slate-800">
                    <Cpu className="w-3 h-3 text-slate-400" />
                    <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-[40%]"></div>
                    </div>
                 </div>
                 <div className="bg-slate-100 dark:bg-slate-950 rounded px-2 py-1 flex items-center gap-2 border border-slate-100 dark:border-slate-800">
                    <Zap className="w-3 h-3 text-slate-400" />
                    <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 w-[65%]"></div>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* IP Address Snippet */}
        {data.ip && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-500 truncate flex items-center gap-1">
                <Globe className="w-3 h-3 opacity-50" />
                {data.ip}
            </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-slate-400/50 !w-2 !h-2 !-right-[5px] !border-none" />
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

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ 
    rankdir: direction, 
    align: 'DL', 
    nodesep: 50, // Increase horizontal spacing
    ranksep: 120, // Increase hierarchical spacing
    ranker: 'network-simplex' // Better for structured flows
  });

  nodes.forEach((node) => {
    // Precise dimensions for layout calc
    const width = node.type === 'network' ? 120 : 260;
    const height = node.type === 'network' ? 120 : 160;
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
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - (node.type === 'network' ? 60 : 130),
        y: nodeWithPosition.y - (node.type === 'network' ? 60 : 80),
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
  const [selectedNode, setSelectedNode] = useState<GceResource | null>(null);
  const [filters, setFilters] = useState<TopologyFilters>({
    showDisks: true,
    showStopped: true,
    groupZones: false
  });
  
  const { fitView } = useReactFlow();

  // Graph Construction Logic
  useEffect(() => {
    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];
    const createdNetworks = new Set<string>();

    // 1. Networks (Root Nodes)
    resources.forEach(r => {
      if (!filters.showStopped && r.status === 'STOPPED') return;

      r.ips?.forEach(ip => {
        const netName = ip.network;
        if (!createdNetworks.has(netName)) {
          createdNetworks.add(netName);
          rawNodes.push({
            id: `net-${netName}`,
            type: 'network',
            data: { label: netName },
            position: { x: 0, y: 0 },
            zIndex: 10
          });
        }
      });
    });

    // 2. Resources
    resources.forEach(r => {
      if (!filters.showStopped && r.status === 'STOPPED') return;
      const isRunning = r.status === 'RUNNING' || r.status === 'READY';

      // Add Resource Node
      rawNodes.push({
        id: r.id,
        type: 'resource',
        data: { 
          label: r.name, 
          machineType: r.machineType, 
          type: r.type,
          status: r.status,
          zone: r.zone,
          ip: r.ips?.[0]?.internal || r.ips?.[0]?.external,
          resource: r 
        },
        position: { x: 0, y: 0 },
      });

      // Edge: Network -> Resource
      r.ips?.forEach(ip => {
        rawEdges.push({
          id: `e-${ip.network}-${r.id}`,
          source: `net-${ip.network}`,
          target: r.id,
          type: 'default', // Bezier is default in newer ReactFlow, or explicitly 'bezier'
          animated: isRunning, // Animate traffic only if active
          style: { 
              stroke: isRunning ? '#3b82f6' : '#64748b', 
              strokeWidth: isRunning ? 2 : 1, 
              opacity: isRunning ? 0.8 : 0.3 
          },
          markerEnd: { 
              type: MarkerType.ArrowClosed, 
              color: isRunning ? '#3b82f6' : '#64748b' 
          },
        });
      });

      // Disks (Attached)
      if (filters.showDisks) {
        r.disks?.forEach((d, idx) => {
          // Only show non-boot disks as separate nodes to reduce clutter, or all if preferred
          // Showing all for detail request
          const diskNodeId = `${r.id}-disk-${idx}`;
          rawNodes.push({
            id: diskNodeId,
            type: 'resource',
            data: { 
              label: d.deviceName, 
              machineType: `${d.sizeGb}GB ${d.type}`, 
              type: 'DISK',
              status: 'READY' 
            },
            position: { x: 0, y: 0 },
          });
          
          rawEdges.push({
            id: `e-${r.id}-${diskNodeId}`,
            source: r.id,
            target: diskNodeId,
            type: 'step', // Step lines for storage look distinct
            animated: false,
            style: { stroke: '#a855f7', strokeWidth: 1.5, strokeDasharray: '4,4', opacity: 0.6 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' }
          });
        });
      }
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    // Smooth transition to new layout
    setTimeout(() => fitView({ padding: 0.3, duration: 800 }), 100);

  }, [resources, filters, setNodes, setEdges, fitView]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'resource' && node.data.resource) {
      setSelectedNode(node.data.resource);
    } else {
      setSelectedNode(null);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="h-full w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative flex">
      
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
        className="bg-slate-950"
        minZoom={0.1}
        maxZoom={4}
      >
        <Background 
            variant={BackgroundVariant.Dots} 
            gap={30} 
            size={1} 
            color="#334155" 
            className="opacity-50"
        />
        
        <Controls className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 fill-slate-500 rounded-lg shadow-lg" />
        
        {/* Modern Floating Control Panel */}
        <Panel position="top-left" className="m-6">
           <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-white/20 dark:border-slate-700 shadow-2xl w-72 space-y-5 animate-in slide-in-from-left-4 fade-in duration-500">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                 <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500">
                        <Layers className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-slate-800 dark:text-white">Topology Layers</span>
                 </div>
                 <Badge variant="info">{nodes.length}</Badge>
              </div>
              
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Storage Devices</span>
                    <ToggleSwitch 
                        checked={filters.showDisks} 
                        onChange={v => setFilters(p => ({...p, showDisks: v}))}
                    />
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Inactive Resources</span>
                    <ToggleSwitch 
                        checked={filters.showStopped} 
                        onChange={v => setFilters(p => ({...p, showStopped: v}))}
                    />
                 </div>
              </div>

              <div className="pt-2">
                 <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => fitView({ duration: 800 })}>
                    <Maximize className="w-3 h-3 mr-2" /> Center Map
                 </Button>
              </div>
           </div>
        </Panel>

        {/* Legend Panel */}
        <Panel position="bottom-left" className="m-6">
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm p-3 rounded-xl border border-slate-200 dark:border-slate-800/50 shadow-lg flex gap-4 text-[10px] text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div> Network Flow
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div> Storage Link
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Active
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div> Stopped
                </div>
            </div>
        </Panel>
      </ReactFlow>

      {/* Slide-out Details Inspector */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div 
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute right-0 top-0 bottom-0 w-[400px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col"
          >
             {/* Header */}
             <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-gradient-to-b from-slate-50 to-transparent dark:from-black/20">
                <div className="flex-1 pr-4">
                   <div className="flex items-center gap-2 mb-2">
                       <Badge variant="neutral" className="font-mono text-[10px]">{selectedNode.type}</Badge>
                       <span className={`w-2 h-2 rounded-full ${selectedNode.status === 'RUNNING' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`}></span>
                   </div>
                   <h3 className="text-xl font-bold text-slate-900 dark:text-white break-words leading-tight">{selectedNode.name}</h3>
                   <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <Globe className="w-3 h-3" /> {selectedNode.zone}
                   </div>
                </div>
                <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                   <X className="w-5 h-5 text-slate-500" />
                </button>
             </div>

             <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Status Card */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">State</div>
                      <div className={`text-lg font-bold flex items-center gap-2 ${selectedNode.status === 'RUNNING' ? 'text-emerald-500' : 'text-slate-500'}`}>
                         <Activity className="w-4 h-4" /> {selectedNode.status}
                      </div>
                   </div>
                   <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Config</div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                         {selectedNode.machineType || 'Standard'}
                      </div>
                   </div>
                </div>

                {/* Network */}
                <div>
                   <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 flex items-center gap-2 tracking-wider">
                      <NetworkIcon className="w-3 h-3" /> Network Interface
                   </h4>
                   {selectedNode.ips && selectedNode.ips.length > 0 ? selectedNode.ips.map((ip, i) => (
                      <div key={i} className="mb-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs shadow-sm">
                         <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <Box className="w-3 h-3 text-blue-500" /> VPC: {ip.network}
                            </span>
                         </div>
                         <div className="space-y-2 font-mono text-slate-500">
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2 rounded">
                                <span>Internal IP</span> 
                                <span className="text-slate-800 dark:text-slate-200 select-all">{ip.internal}</span>
                            </div>
                            {ip.external && (
                                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-900/30">
                                    <span className="text-blue-700 dark:text-blue-300">Public IP</span> 
                                    <span className="text-blue-700 dark:text-blue-300 font-bold select-all">{ip.external}</span>
                                </div>
                            )}
                         </div>
                      </div>
                   )) : (
                     <div className="text-slate-400 italic text-sm">No network interfaces attached.</div>
                   )}
                </div>

                {/* Storage */}
                {selectedNode.disks && selectedNode.disks.length > 0 && (
                   <div>
                       <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 flex items-center gap-2 tracking-wider">
                          <HardDrive className="w-3 h-3" /> Storage
                       </h4>
                       <div className="space-y-2">
                           {selectedNode.disks.map((disk, i) => (
                               <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs">
                                   <div className="flex items-center gap-2">
                                       <div className={`w-1.5 h-1.5 rounded-full ${disk.boot ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                                       <span className="font-medium text-slate-700 dark:text-slate-300">{disk.deviceName}</span>
                                   </div>
                                   <div className="font-mono text-slate-500">{disk.sizeGb} GB</div>
                               </div>
                           ))}
                       </div>
                   </div>
                )}
             </div>
             
             <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <Button className="w-full" variant="secondary" onClick={() => setSelectedNode(null)}>
                    <ArrowRight className="w-4 h-4 mr-2" /> Close Details
                </Button>
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
