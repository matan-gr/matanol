
import React, { useCallback, useEffect, useState, memo, useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  BackgroundVariant,
  ConnectionLineType,
  MiniMap
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import dagre from 'dagre';
import { GceResource } from '../types';
import { 
  Server, HardDrive, Globe, Cloud, Database, Monitor, 
  Network as NetworkIcon, Maximize, Cpu, Box, Layers, Ship,
  Zap, AlertCircle, X, Terminal, Activity, GitBranch
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
const BASE_NODE_WIDTH = 280;
const BASE_NODE_HEIGHT = 100;
const WORKER_NODE_SIZE = 40;
const WORKER_GAP = 10;
const CLUSTER_PADDING = 60;

// --- Helper Components ---

const StatusIndicator = ({ status }: { status: string }) => {
  const isRunning = status === 'RUNNING' || status === 'READY' || status === 'RUNNABLE';
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
    relative w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-500 group
    ${selected 
      ? 'bg-blue-600/10 shadow-[0_0_60px_rgba(37,99,235,0.2)] scale-110 z-50 ring-2 ring-blue-500' 
      : 'bg-white/80 dark:bg-slate-900/80 border-2 border-slate-200 dark:border-slate-700 border-dashed hover:border-solid hover:border-blue-400 dark:hover:border-blue-600'}
  `}>
    <Handle type="source" position={Position.Right} className="!opacity-0" />
    <Handle type="target" position={Position.Left} className="!opacity-0" />
    
    <div className="relative z-10 p-4 bg-slate-50 dark:bg-slate-950 rounded-full shadow-inner">
        <NetworkIcon className={`w-8 h-8 ${selected ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />
    </div>

    <div className={`
        mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest text-center truncate max-w-[140px]
        ${selected ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-500'}
    `}>
      {data.label}
    </div>
    <div className="text-[9px] text-slate-400 font-mono mt-0.5">VPC Network</div>
  </div>
));

const SubnetNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
    <div className={`
      relative w-32 h-16 rounded-lg flex items-center justify-center transition-all duration-300
      ${selected 
        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 ring-1 ring-indigo-500' 
        : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-indigo-400'}
    `}>
      <Handle type="target" position={Position.Left} className="!w-1 !h-4 !bg-slate-300 rounded-sm !-left-[1px]" />
      <Handle type="source" position={Position.Right} className="!w-1 !h-4 !bg-slate-300 rounded-sm !-right-[1px]" />
      
      <div className="flex items-center gap-2 px-2">
          <GitBranch className="w-4 h-4 text-slate-400 transform rotate-90" />
          <div className="flex flex-col">
             <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[90px]" title={data.label}>{data.label}</span>
             <span className="text-[8px] text-slate-400 font-mono">{data.region}</span>
          </div>
      </div>
    </div>
));

const InternetNode = memo(({ selected }: { selected: boolean }) => (
    <div className={`
      relative w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-500
      ${selected ? 'scale-110 shadow-lg ring-2 ring-indigo-500' : 'hover:scale-105'}
    `}>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      
      <div className="p-3 bg-indigo-500 rounded-full shadow-lg text-white">
          <Globe className="w-8 h-8" />
      </div>
      <div className="mt-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Internet</div>
    </div>
));

const CloudRunNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`
    relative min-w-[220px] rounded-2xl overflow-hidden transition-all duration-300
    ${selected 
      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 scale-105 z-50' 
      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-md'}
  `}>
    <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-indigo-400 !rounded-full !-left-[3px] !border-none" />
    
    <div className="absolute top-0 right-0 p-2 opacity-20">
       <Cloud className="w-12 h-12" />
    </div>

    <div className="p-4 relative z-10">
       <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded-lg ${selected ? 'bg-white/20' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
             <Zap className={`w-4 h-4 ${selected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${selected ? 'text-indigo-200' : 'text-slate-500'}`}>Serverless</span>
       </div>
       <div className={`text-sm font-bold truncate mb-1 ${selected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{data.label}</div>
       <div className={`text-xs ${selected ? 'text-indigo-100' : 'text-slate-500'}`}>{data.url?.replace('https://', '') || 'No URL'}</div>
    </div>
    
    <div className={`h-1 w-full ${selected ? 'bg-indigo-400 animate-pulse' : 'bg-slate-100 dark:bg-slate-800'}`}></div>
    <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-indigo-400 !rounded-full !-right-[3px] !border-none" />
  </div>
));

const ClusterGroupNode = memo(({ data, selected, style }: { data: any, selected: boolean, style?: React.CSSProperties }) => (
  <div 
    className={`
      relative rounded-3xl transition-all duration-300 border-2
      ${selected 
        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-900/10 shadow-[0_0_40px_rgba(14,165,233,0.15)]' 
        : 'border-slate-200 dark:border-slate-800 border-dashed bg-slate-50/50 dark:bg-slate-900/50'}
    `}
    style={{ width: style?.width, height: style?.height }}
  >
    <Handle type="target" position={Position.Left} className="!w-2 !h-8 !bg-sky-400 !rounded-full !-left-[5px] !border-none" />
    
    <div className="absolute -top-4 left-6 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full flex items-center gap-2 shadow-sm">
        <Ship className="w-3.5 h-3.5 text-sky-500" />
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{data.label}</span>
        <Badge variant="info" className="text-[9px] px-1.5 py-0">K8s</Badge>
    </div>

    <div className="absolute bottom-2 right-4 text-[10px] text-slate-400 font-mono">
       {data.resource.clusterDetails?.version}
    </div>
  </div>
));

const GkeWorkerNode = memo(({ data }: { data: any }) => (
  <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center relative group hover:scale-110 transition-transform">
     <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800"></div>
     <Cpu className="w-5 h-5 text-slate-400 group-hover:text-sky-500 transition-colors" />
  </div>
));

const ResourceNode = memo(({ data, selected }: { data: any, selected: boolean }) => {
  const isRunning = data.status === 'RUNNING' || data.status === 'READY' || data.status === 'RUNNABLE';
  const isDimmed = data.isDimmed;

  const getIcon = () => {
    switch(data.type) {
      case 'INSTANCE': return <Server className={`w-5 h-5 ${isRunning ? 'text-emerald-500' : 'text-slate-400'}`} />;
      case 'DISK': return <HardDrive className="w-5 h-5 text-purple-500" />;
      case 'CLOUD_SQL': return <Database className="w-5 h-5 text-orange-500" />;
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
                   {data.type === 'CLOUD_SQL' ? 'Cloud SQL' : data.type.replace('_', ' ')}
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
           {data.type === 'CLOUD_SQL' && (
              <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded-md border border-slate-100 dark:border-slate-800">
                 <Database className="w-3 h-3 text-slate-400" />
                 <span className="font-mono">{data.machineType}</span>
              </div>
           )}
           {data.type === 'DISK' && (
              <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded-md border border-slate-100 dark:border-slate-800">
                 <HardDrive className="w-3 h-3 text-slate-400" />
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
  subnet: SubnetNode,
  resource: ResourceNode,
  internet: InternetNode,
  clusterGroup: ClusterGroupNode,
  gkeNode: GkeWorkerNode,
  cloudRun: CloudRunNode
};

// --- Layout Engine ---

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ 
    rankdir: direction, 
    align: 'DL', 
    nodesep: 60, 
    ranksep: 150, 
    ranker: 'network-simplex'
  });

  nodes.forEach((node) => {
    // Only layout top-level nodes
    if (node.parentNode) return;

    let width = BASE_NODE_WIDTH;
    let height = BASE_NODE_HEIGHT;
    
    if (node.type === 'network') { width = 180; height = 180; }
    if (node.type === 'subnet') { width = 140; height = 80; }
    if (node.type === 'internet') { width = 120; height = 120; }
    if (node.type === 'cloudRun') { width = 220; height = 120; }
    if (node.type === 'clusterGroup') { 
        width = (node.style?.width as number) || 300;
        height = (node.style?.height as number) || 200;
    }

    dagreGraph.setNode(node.id, { width: width + 40, height: height + 40 });
  });

  edges.forEach((edge) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (sourceNode && !sourceNode.parentNode && targetNode && !targetNode.parentNode) {
        dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    if (node.parentNode) return node; 

    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node; 

    const width = node.type === 'clusterGroup' ? (node.style?.width as number) : (node.type === 'network' ? 180 : node.type === 'subnet' ? 140 : node.type === 'internet' ? 120 : node.type === 'cloudRun' ? 220 : BASE_NODE_WIDTH);
    const height = node.type === 'clusterGroup' ? (node.style?.height as number) : (node.type === 'network' ? 180 : node.type === 'subnet' ? 80 : node.type === 'internet' ? 120 : node.type === 'cloudRun' ? 120 : BASE_NODE_HEIGHT);

    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
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
     // Support selection of subnet nodes too (though they lack detailed resource data, we can show a summary if needed, but for now we focus on GceResource)
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
    const createdSubnets = new Set<string>();
    const createdZones = new Set<string>();
    let hasPublicAccess = false;

    const activeResources = resources.filter(r => filters.showStopped || (r.status !== 'STOPPED' && r.status !== 'TERMINATED'));

    // 1. Create Networks & Subnets
    activeResources.forEach(r => {
      // Standard VM IPs
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
        
        // Infer Subnet from Zone if explicit subnet mapping isn't available
        // Ideally API provides this, but we fallback to a visual "Subnet" node per zone for the network
        const subnetId = `sub-${ip.network}-${r.zone}`;
        if (!createdSubnets.has(subnetId)) {
            createdSubnets.add(subnetId);
            rawNodes.push({
                id: subnetId,
                type: 'subnet',
                data: { label: `sub-${r.zone}`, region: r.zone },
                position: { x: 0, y: 0 },
                zIndex: 15
            });
            // Link Net -> Subnet
            rawEdges.push({
                id: `e-net-${ip.network}-${subnetId}`,
                source: `net-${ip.network}`,
                target: subnetId,
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#94a3b8', strokeWidth: 1.5 }
            });
        }

        if (ip.external) hasPublicAccess = true;
      });

      // GKE Networks & Subnets
      if (r.type === 'GKE_CLUSTER' && r.clusterDetails?.network) {
          const netName = r.clusterDetails.network.split('/').pop() || 'default';
          const subName = r.clusterDetails.subnetwork?.split('/').pop() || `sub-${r.zone}`;
          
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

          const subnetId = `sub-${netName}-${subName}`;
          if (!createdSubnets.has(subnetId)) {
              createdSubnets.add(subnetId);
              rawNodes.push({
                  id: subnetId,
                  type: 'subnet',
                  data: { label: subName, region: r.zone },
                  position: { x: 0, y: 0 },
                  zIndex: 15
              });
              rawEdges.push({
                  id: `e-net-${netName}-${subnetId}`,
                  source: `net-${netName}`,
                  target: subnetId,
                  type: 'smoothstep',
                  style: { stroke: '#94a3b8', strokeWidth: 1.5 }
              });
          }
      }
    });

    // 2. Internet Gateway (if needed)
    if (hasPublicAccess) {
        rawNodes.push({
            id: 'internet-gateway',
            type: 'internet',
            data: { label: 'Internet' },
            position: { x: 0, y: 0 },
            zIndex: 5
        });
    }

    // 3. Create Global/Zone Hubs for Orphans
    if (filters.showOrphans) {
        activeResources.forEach(r => {
            const hasNet = (r.ips && r.ips.length > 0) || (r.type === 'GKE_CLUSTER' && r.clusterDetails?.network);
            if (!hasNet && r.type !== 'DISK') { // Disks handle their own linking
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

    // 4. Create Resources & Edges
    activeResources.forEach(r => {
      
      // -- GKE CLUSTERS --
      if (r.type === 'GKE_CLUSTER') {
          const nodeCount = r.clusterDetails?.nodeCount || 1;
          const cols = Math.ceil(Math.sqrt(nodeCount));
          const rows = Math.ceil(nodeCount / cols);
          
          const clusterWidth = Math.max(200, (cols * (WORKER_NODE_SIZE + WORKER_GAP)) + (CLUSTER_PADDING * 2));
          const clusterHeight = Math.max(120, (rows * (WORKER_NODE_SIZE + WORKER_GAP)) + (CLUSTER_PADDING * 1.5));

          rawNodes.push({
              id: r.id,
              type: 'clusterGroup',
              data: { label: r.name, resource: r },
              position: { x: 0, y: 0 },
              style: { width: clusterWidth, height: clusterHeight },
              zIndex: 20
          });

          // Worker Nodes
          const visualNodeCount = Math.min(nodeCount, 20);
          for (let i = 0; i < visualNodeCount; i++) {
              const col = i % cols;
              const row = Math.floor(i / cols);
              rawNodes.push({
                  id: `${r.id}-worker-${i}`,
                  type: 'gkeNode',
                  data: { label: `Node ${i}` },
                  position: { 
                      x: CLUSTER_PADDING + (col * (WORKER_NODE_SIZE + WORKER_GAP)), 
                      y: 50 + (row * (WORKER_NODE_SIZE + WORKER_GAP)) 
                  },
                  parentNode: r.id,
                  extent: 'parent',
                  zIndex: 21,
                  draggable: false
              });
          }

          // Network Connection (Subnet -> Cluster)
          const netName = r.clusterDetails?.network?.split('/').pop() || 'default';
          const subName = r.clusterDetails?.subnetwork?.split('/').pop() || `sub-${r.zone}`;
          const subnetId = `sub-${netName}-${subName}`;
          
          if (createdSubnets.has(subnetId)) {
              rawEdges.push({
                  id: `e-${subnetId}-${r.id}`,
                  source: subnetId,
                  target: r.id,
                  type: 'smoothstep',
                  animated: true,
                  style: { stroke: '#3b82f6', strokeWidth: 2 }
              });
          }
          return;
      }

      // -- CLOUD RUN --
      if (r.type === 'CLOUD_RUN') {
          rawNodes.push({
              id: r.id,
              type: 'cloudRun',
              data: { label: r.name, url: r.url, resource: r },
              position: { x: 0, y: 0 },
              zIndex: 25
          });
          
          rawEdges.push({
              id: `e-${r.id}-internet`,
              source: r.id,
              target: 'internet-gateway',
              type: 'default',
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '3,3' }
          });
          return;
      }

      // -- STANDARD RESOURCES (VMs, SQL, BUCKETS) --
      const isRunning = r.status === 'RUNNING' || r.status === 'READY' || r.status === 'RUNNABLE';
      
      // Skip disks here, handled as attachments or separate if not attached (TODO: robust detached disk logic)
      if (r.type === 'DISK') return; 

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
          isDimmed: false 
        },
        position: { x: 0, y: 0 },
        zIndex: 20,
      });

      // Connections
      let connected = false;
      
      r.ips?.forEach(ip => {
        const subnetId = `sub-${ip.network}-${r.zone}`;
        if (createdSubnets.has(subnetId)) {
            rawEdges.push({
              id: `e-${subnetId}-${r.id}`,
              source: subnetId,
              target: r.id,
              type: 'smoothstep',
              animated: isRunning,
              style: { stroke: isRunning ? '#10b981' : '#64748b', strokeWidth: 1.5 },
            });
            connected = true;
        }

        if (ip.external) {
            rawEdges.push({
                id: `e-${r.id}-internet`,
                source: r.id,
                target: 'internet-gateway',
                type: 'default',
                animated: true,
                style: { stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5,5' },
                label: 'Public IP'
            });
        }
      });

      if (!connected && filters.showOrphans && r.type !== 'BUCKET') {
          rawEdges.push({
              id: `e-hub-${r.zone}-${r.id}`,
              source: `hub-${r.zone}`,
              target: r.id,
              type: 'smoothstep',
              style: { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5,5' }
          });
      }

      // Attached Disks
      if (filters.showDisks && r.disks) {
        r.disks.forEach((d, idx) => {
          const diskId = `${r.id}-disk-${idx}`;
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

  }, [topologyHash, fitView, setNodes, setEdges]); 

  // Focus Mode
  useEffect(() => {
    setNodes((nds) => 
      nds.map((node) => {
        const isSelected = node.id === selectedNodeId;
        const isNeighbor = edges.some(e => 
            (e.source === selectedNodeId && e.target === node.id) || 
            (e.target === selectedNodeId && e.source === node.id)
        );
        
        const isFocus = !selectedNodeId || isSelected || isNeighbor || node.parentNode === selectedNodeId || (node.id === selectedNodeId);
        const newDimmed = !isFocus;

        if (node.data.isDimmed === newDimmed && node.selected === isSelected) return node;
        
        return {
          ...node,
          selected: isSelected,
          data: { ...node.data, isDimmed: newDimmed }
        };
      })
    );

    setEdges((eds) => 
        eds.map((edge) => {
            const isConnected = edge.source === selectedNodeId || edge.target === selectedNodeId;
            const isFocus = !selectedNodeId || isConnected;
            const newOpacity = isFocus ? 1 : 0.1;
            const newWidth = isConnected ? 3 : 1; 
            const newZ = isConnected ? 50 : 0;

            if (edge.style?.opacity === newOpacity && edge.style?.strokeWidth === newWidth && edge.zIndex === newZ) return edge;

            return {
                ...edge,
                style: { ...edge.style, opacity: newOpacity, strokeWidth: newWidth },
                zIndex: newZ
            };
        })
    );
  }, [selectedNodeId, topologyHash]); 

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Allows selecting all major resource types + clusters
    if (['resource', 'clusterGroup', 'cloudRun'].includes(node.type || '')) {
      setSelectedNodeId(node.id);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm relative flex">
      
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
            nodeColor={(n) => {
                if (n.type === 'network') return '#3b82f6';
                if (n.type === 'subnet') return '#6366f1';
                if (n.type === 'clusterGroup') return '#0ea5e9';
                if (n.type === 'cloudRun') return '#8b5cf6';
                return '#cbd5e1';
            }}
            maskColor="rgba(15, 23, 42, 0.1)"
            className="!bg-white/50 dark:!bg-slate-900/50 !border-slate-200 dark:!border-slate-800 rounded-lg hidden md:block"
        />

        <Panel position="top-left" className="m-4">
           <div className="glass-panel p-4 rounded-xl shadow-lg w-64 space-y-4 animate-in fade-in slide-in-from-left-4 hidden md:block">
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
            className="absolute right-0 top-0 bottom-0 w-full md:w-[420px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col"
          >
             {/* Panel Header */}
             <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div className="flex justify-between items-start mb-4">
                   <div className="flex gap-2">
                       <Badge variant="neutral" className="font-mono">{selectedResource.type}</Badge>
                       <Badge variant={selectedResource.status === 'RUNNING' || selectedResource.status === 'READY' || selectedResource.status === 'RUNNABLE' ? 'success' : 'error'}>{selectedResource.status}</Badge>
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
                
                {/* Specific Details based on Type */}
                {selectedResource.type === 'GKE_CLUSTER' && (
                    <div className="p-4 bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800 rounded-xl space-y-3">
                        <div className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide">Kubernetes Details</div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 block mb-1">Version</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">{selectedResource.clusterDetails?.version}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">Total Nodes</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">{selectedResource.clusterDetails?.nodeCount}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-slate-500 block mb-1">Endpoint</span>
                                <code className="bg-white dark:bg-slate-900 px-2 py-1 rounded border border-sky-200 dark:border-sky-800 text-slate-600 dark:text-slate-300 block w-full truncate">
                                    {selectedResource.clusterDetails?.endpoint}
                                </code>
                            </div>
                        </div>
                    </div>
                )}

                {selectedResource.type === 'CLOUD_SQL' && (
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-xl space-y-3">
                        <div className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide">Database Instance</div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 block mb-1">Tier</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">{selectedResource.machineType}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">Storage</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">{selectedResource.sizeGb} GB</span>
                            </div>
                        </div>
                    </div>
                )}

                {selectedResource.type === 'DISK' && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800 rounded-xl space-y-3">
                        <div className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">Disk Performance</div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 block mb-1">Type</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">{selectedResource.machineType}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">Size</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">{selectedResource.sizeGb} GB</span>
                            </div>
                        </div>
                    </div>
                )}

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
                                  <span>{ip.network}</span>
                                </div>
                               <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 font-mono text-slate-600 dark:text-slate-400">
                                  <div className="flex justify-between"><span>Internal</span> <span className="select-all">{ip.internal}</span></div>
                                  {ip.external && <div className="flex justify-between text-blue-600 dark:text-blue-400"><span>Public</span> <span className="select-all">{ip.external}</span></div>}
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                )}
             </div>

             {/* Actions Footer */}
             <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 grid grid-cols-2 gap-3">
                <Button variant="secondary" size="sm" onClick={() => {}} leftIcon={<Terminal className="w-3 h-3"/>}>Console</Button>
                <Button variant="secondary" size="sm" onClick={() => {}} leftIcon={<Activity className="w-3 h-3"/>}>Metrics</Button>
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
