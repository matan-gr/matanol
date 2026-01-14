
import React, { useMemo, useState } from 'react';
import { GceResource } from '../types';
import { Button, Card, Badge, GlassCard, Tooltip } from './DesignSystem';
import { 
  Shield, AlertTriangle, ArrowRight, 
  Server, HardDrive, Zap, Globe, MapPin, 
  Cloud, Database, 
  CheckCircle2, AlertOctagon, Terminal,
  Bot, RefreshCw, DollarSign, Box,
  Layers, Ship,
  Lock, Wallet, Cpu, Info
} from 'lucide-react';
import { DonutChart, AnimatedCounter } from './Visualizations';
import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { RegionIcon } from './RegionIcon';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { generateDashboardBrief } from '../services/geminiService';
import { MarkdownView } from './MarkdownView';

interface DashboardProps {
  resources: GceResource[];
  stats: { total: number; labeled: number; unlabeled: number };
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ resources, stats, onNavigate }) => {
  const analysis = useDashboardAnalytics(resources, stats);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

  // --- Derived Metrics ---
  const potentialSavings = useMemo(() => {
    let wastedDiskGb = 0;
    analysis.stoppedInstances.forEach(vm => {
       if (vm.disks) vm.disks.forEach(d => wastedDiskGb += d.sizeGb);
    });
    const storageWasteCost = wastedDiskGb * 0.08; 
    const ipWasteCost = analysis.stoppedInstances.length * 7.30; 
    return {
       monthly: storageWasteCost + ipWasteCost,
       wastedGb: wastedDiskGb,
    };
  }, [analysis.stoppedInstances]);

  const resourceDistribution = useMemo(() => [
    { label: 'VMs', value: analysis.vmCount, color: '#3b82f6' }, // blue-500
    { label: 'K8s', value: analysis.gkeCount, color: '#0ea5e9' }, // sky-500
    { label: 'Run', value: analysis.cloudRunCount, color: '#6366f1' }, // indigo-500
    { label: 'SQL', value: analysis.sqlCount, color: '#06b6d4' }, // cyan-500
    { label: 'Disks', value: analysis.diskCount, color: '#a855f7' }, // purple-500
    { label: 'Storage', value: analysis.bucketCount, color: '#eab308' }, // yellow-500
  ].filter(x => x.value > 0).sort((a, b) => b.value - a.value), [analysis]);

  const handleGenerateInsights = async () => {
     setIsGeneratingInsight(true);
     try {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if(!hasKey) await window.aistudio.openSelectKey();
        }
        
        const brief = await generateDashboardBrief({
           stoppedCount: analysis.stoppedInstances.length,
           stoppedDiskGb: potentialSavings.wastedGb,
           publicIpCount: analysis.publicIpCount,
           unlabeledCount: stats.unlabeled,
           totalDiskGb: analysis.totalDiskGb,
           totalResources: stats.total,
           estimatedMonthlyWaste: potentialSavings.monthly
        });
        setAiInsight(brief);
     } catch (e) {
        console.error("Failed to gen insights", e);
     } finally {
        setIsGeneratingInsight(false);
     }
  };

  // --- Animation Variants ---
  const containerVars: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVars: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 20 } }
  };

  return (
    <motion.div 
      variants={containerVars}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-12"
    >
      {/* 1. Command Header */}
      <motion.div variants={itemVars} className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <Badge variant="neutral" className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border-slate-200 dark:border-slate-700">
                <Globe className="w-3 h-3 mr-1" /> Global Fleet
             </Badge>
             <span className="text-xs text-slate-400">Live Inventory</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Cloud Overview
          </h1>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" size="sm" className="bg-white/50 dark:bg-slate-800/50" onClick={() => onNavigate('logs')} leftIcon={<Terminal className="w-4 h-4" />}>Audit Logs</Button>
           <Button variant="primary" size="sm" onClick={() => onNavigate('inventory')} rightIcon={<ArrowRight className="w-4 h-4" />} className="shadow-lg shadow-indigo-500/20">Manage Resources</Button>
        </div>
      </motion.div>
      
      {/* 2. Primary KPI Grid - Real Data Only */}
      <motion.div variants={itemVars} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         
         {/* Total Resources with Composition Bar */}
         <GlassCard className="p-5 overflow-visible relative group">
             <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Resources</p>
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                   <Layers className="w-5 h-5" />
                </div>
             </div>
             <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                <AnimatedCounter value={stats.total} />
             </div>
             {/* Mini Stacked Bar */}
             <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                {resourceDistribution.map((item, idx) => (
                   <div key={idx} className="h-full" style={{ width: `${(item.value / stats.total) * 100}%`, backgroundColor: item.color }} />
                ))}
             </div>
             <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>{resourceDistribution[0]?.label || 'Resources'}</span>
                <span>{Math.round((resourceDistribution[0]?.value / stats.total) * 100) || 0}%</span>
             </div>
         </GlassCard>

         {/* Est. Waste with Source Breakdown */}
         <GlassCard className="p-5 overflow-visible relative group">
             <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Est. Monthly Waste</p>
                <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600 dark:text-rose-400">
                   <Wallet className="w-5 h-5" />
                </div>
             </div>
             <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4 tabular-nums">
                $<AnimatedCounter value={potentialSavings.monthly.toFixed(0)} />
             </div>
             <div className="flex gap-2 text-[10px]">
                <Badge variant="error" className="px-1.5">{analysis.stoppedInstances.length} Idle VMs</Badge>
                <Badge variant="warning" className="px-1.5">{potentialSavings.wastedGb}GB Unused</Badge>
             </div>
         </GlassCard>

         {/* Compliance Score with Gauge */}
         <GlassCard className="p-5 overflow-visible relative group">
             <div className="flex justify-between items-start">
                <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Governance Score</p>
                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
                        <AnimatedCounter value={analysis.complianceRate} />%
                    </div>
                    <div className="text-[10px] text-slate-400">{stats.labeled} of {stats.total} labeled</div>
                </div>
                <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                        <motion.circle 
                        cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" 
                        strokeDasharray={2 * Math.PI * 40} 
                        initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 40 - (analysis.complianceRate / 100) * 2 * Math.PI * 40 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={analysis.complianceRate >= 90 ? 'text-emerald-500' : 'text-amber-500'}
                        />
                    </svg>
                </div>
             </div>
         </GlassCard>

         {/* Active Alerts */}
         <GlassCard className="p-5 overflow-visible relative group">
             <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Risks</p>
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400">
                   <AlertOctagon className="w-5 h-5" />
                </div>
             </div>
             <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                <AnimatedCounter value={analysis.publicIpCount + analysis.stoppedInstances.length} />
             </div>
             <div className="flex flex-col gap-1">
                {analysis.publicIpCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400 font-bold">
                        <Globe className="w-3 h-3" /> {analysis.publicIpCount} Public IPs Exposed
                    </div>
                )}
                {analysis.stoppedInstances.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        <DollarSign className="w-3 h-3" /> {analysis.stoppedInstances.length} Stopped Instances
                    </div>
                )}
                {analysis.publicIpCount === 0 && analysis.stoppedInstances.length === 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> All Systems Nominal
                    </div>
                )}
             </div>
         </GlassCard>
      </motion.div>

      {/* 3. Main Dashboard Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
         
         {/* LEFT COLUMN (2/3): Fleet Composition & AI */}
         <div className="xl:col-span-2 space-y-6">
            
            {/* Fleet Composition Panel */}
            <motion.div variants={itemVars} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                   <Server className="w-5 h-5 text-indigo-500" /> Fleet Composition
                </h3>

                <div className="flex flex-col md:flex-row gap-8 items-center">
                   {/* Chart */}
                   <div className="shrink-0 relative group">
                      <div className="absolute inset-0 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all duration-700"></div>
                      <DonutChart data={resourceDistribution} />
                   </div>

                   {/* Legend & Details - Two Column Layout with Headings */}
                   <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      <div className="space-y-3">
                         <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800">Compute & Containers</h4>
                         <DetailRow label="Virtual Machines" count={analysis.vmCount} total={stats.total} color="bg-blue-500" icon={Cpu} />
                         <DetailRow label="GKE Clusters" count={analysis.gkeCount} total={stats.total} color="bg-sky-500" icon={Ship} />
                         <DetailRow label="Cloud Run Services" count={analysis.cloudRunCount} total={stats.total} color="bg-indigo-500" icon={Cloud} />
                      </div>
                      <div className="space-y-3">
                         <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800">Data & Storage</h4>
                         <DetailRow label="Cloud SQL Instances" count={analysis.sqlCount} total={stats.total} color="bg-cyan-500" icon={Database} />
                         <DetailRow label="Persistent Disks" count={analysis.diskCount} total={stats.total} color="bg-purple-500" icon={HardDrive} />
                         <DetailRow label="Cloud Storage Buckets" count={analysis.bucketCount} total={stats.total} color="bg-yellow-500" icon={Box} />
                      </div>
                   </div>
                </div>
            </motion.div>

            {/* AI Insights Panel */}
            <motion.div variants={itemVars} className="bg-gradient-to-br from-white via-indigo-50/50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 rounded-2xl p-1 shadow-lg border border-indigo-100 dark:border-slate-800 text-slate-900 dark:text-white relative group overflow-hidden">
               <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none mix-blend-overlay"></div>
               {/* Decorative glows */}
               <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
               <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-violet-500/10 dark:bg-violet-500/20 rounded-full blur-3xl pointer-events-none"></div>

               <div className="bg-white/60 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl p-6 h-full relative z-10">
                  <div className="flex justify-between items-start mb-6">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg shadow-lg">
                           <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                           <h3 className="font-bold text-slate-900 dark:text-white text-lg">AI Consultant</h3>
                           <p className="text-xs text-slate-500 dark:text-slate-400">Strategic analysis engine</p>
                        </div>
                     </div>
                     {!aiInsight && (
                        <Button 
                           variant="primary" 
                           size="sm"
                           onClick={handleGenerateInsights}
                           isLoading={isGeneratingInsight}
                           leftIcon={<RefreshCw className="w-3.5 h-3.5"/>}
                           className="bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-sm border border-indigo-100 dark:border-transparent hover:bg-indigo-50 dark:hover:bg-white/20 backdrop-blur-md"
                        >
                           Analyze
                        </Button>
                     )}
                  </div>

                  <AnimatePresence mode="wait">
                     {aiInsight ? (
                        <motion.div 
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           className="prose prose-slate dark:prose-invert prose-sm max-w-none bg-slate-50 dark:bg-slate-950/50 p-6 rounded-xl border border-slate-200 dark:border-white/10"
                        >
                           <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-white/10 pb-4">
                              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                 <CheckCircle2 className="w-3 h-3" /> Analysis Complete
                              </span>
                              <button onClick={() => setAiInsight(null)} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Clear</button>
                           </div>
                           <MarkdownView content={aiInsight} />
                           <div className="mt-6 flex justify-end">
                              <Button variant="secondary" size="sm" onClick={() => onNavigate('inventory')} className="bg-white text-slate-900 hover:bg-slate-200 border-none shadow-sm">
                                 Take Action
                              </Button>
                           </div>
                        </motion.div>
                     ) : (
                        <div className="py-8 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-slate-50/50 dark:bg-white/5">
                           {isGeneratingInsight ? (
                              <div className="space-y-4">
                                 <div className="flex gap-1 justify-center">
                                    <motion.div animate={{ height: [10, 20, 10] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 bg-indigo-500 rounded-full" />
                                    <motion.div animate={{ height: [15, 25, 15] }} transition={{ repeat: Infinity, duration: 1, delay: 0.1 }} className="w-1 bg-violet-500 rounded-full" />
                                    <motion.div animate={{ height: [10, 20, 10] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 bg-fuchsia-500 rounded-full" />
                                 </div>
                                 <p className="text-sm text-slate-500 dark:text-slate-300 font-mono">Analyzing {stats.total} data points...</p>
                              </div>
                           ) : (
                              <>
                                 <Zap className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-3" />
                                 <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                                    Generate a comprehensive report on cost optimization, security risks, and governance gaps.
                                 </p>
                              </>
                           )}
                        </div>
                     )}
                  </AnimatePresence>
               </div>
            </motion.div>
         </div>

         {/* RIGHT COLUMN (1/3): Geo & Risks */}
         <div className="space-y-6">
            
            {/* Geographic Distribution */}
            <motion.div variants={itemVars} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-[380px]">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <Globe className="w-4 h-4" /> Global Presence
                   </h3>
                   <Badge variant="neutral">{analysis.topZones.length} Regions</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                   {analysis.topZones.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs italic">
                         <MapPin className="w-8 h-8 mb-2 opacity-20" />
                         No regional data
                      </div>
                   )}
                   {analysis.topZones.map(([zone, count]) => (
                      <div key={zone} className="group">
                         <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-2">
                               <RegionIcon zone={zone} className="w-4 h-3 rounded-[2px] shadow-sm" />
                               <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-500 transition-colors">{zone}</span>
                            </div>
                            <span className="text-xs font-mono text-slate-500 tabular-nums">{count}</span>
                         </div>
                         <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                               initial={{ width: 0 }}
                               whileInView={{ width: `${(count / analysis.maxZone) * 100}%` }}
                               transition={{ duration: 1, ease: "easeOut" }}
                               className="h-full bg-slate-400 dark:bg-slate-600 group-hover:bg-indigo-500 transition-colors"
                            />
                         </div>
                      </div>
                   ))}
                </div>
            </motion.div>

            {/* Operational Risks Feed */}
            <motion.div variants={itemVars} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden h-[400px] flex flex-col">
               <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-red-500"></div>
               
               <div className="flex justify-between items-center mb-6 pl-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                     <AlertTriangle className="w-4 h-4 text-amber-500" /> Operational Risks
                  </h3>
                  {analysis.stoppedInstances.length + analysis.publicIpCount > 0 && (
                     <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                     </span>
                  )}
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar pl-4 pr-2 space-y-3">
                  {analysis.stoppedInstances.length === 0 && analysis.publicIpCount === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-3">
                           <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">System Healthy</p>
                        <p className="text-xs text-slate-500">No major anomalies detected.</p>
                     </div>
                  ) : (
                     <>
                        {analysis.stoppedInstances.map(vm => (
                           <div key={vm.id} className="p-3 bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20 rounded-lg flex items-start gap-3 group hover:border-red-300 dark:hover:border-red-900/50 transition-colors cursor-pointer" onClick={() => onNavigate('inventory')}>
                              <div className="mt-0.5"><DollarSign className="w-4 h-4 text-red-500" /></div>
                              <div className="flex-1">
                                 <div className="flex justify-between">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:underline">{vm.name}</span>
                                    <span className="text-[10px] bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200 dark:border-slate-800">Stopped</span>
                                 </div>
                                 <p className="text-[10px] text-slate-500 mt-1">
                                    Idle resources incurring storage costs.
                                 </p>
                              </div>
                           </div>
                        ))}
                        {analysis.publicIpCount > 0 && (
                           <div className="p-3 bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20 rounded-lg flex items-start gap-3 group hover:border-amber-300 dark:hover:border-amber-900/50 transition-colors cursor-pointer" onClick={() => onNavigate('inventory')}>
                              <div className="mt-0.5"><Lock className="w-4 h-4 text-amber-500" /></div>
                              <div className="flex-1">
                                 <div className="flex justify-between">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Public Exposure</span>
                                    <span className="text-[10px] bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200 dark:border-slate-800 tabular-nums">{analysis.publicIpCount} IPs</span>
                                 </div>
                                 <p className="text-[10px] text-slate-500 mt-1">
                                    Resources accessible from internet.
                                 </p>
                              </div>
                           </div>
                        )}
                     </>
                  )}
               </div>
            </motion.div>
         </div>
      </div>
    </motion.div>
  );
};

const DetailRow = ({ label, count, total, color, icon: Icon }: any) => {
   const percent = total > 0 ? (count / total) * 100 : 0;
   if (count === 0) return null; // Hide empty categories in detailed list
   
   return (
      <div className="group">
         <div className="flex justify-between items-center mb-1 text-xs">
            <div className="flex items-center gap-2">
               <div className={`p-1 rounded ${color.replace('bg-', 'bg-').replace('500', '100')} dark:bg-opacity-20`}>
                  <Icon className={`w-3 h-3 ${color.replace('bg-', 'text-')}`} />
               </div>
               <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
            </div>
            <div className="flex gap-2">
               <span className="font-bold text-slate-900 dark:text-white tabular-nums"><AnimatedCounter value={count} /></span>
               <span className="text-slate-400 tabular-nums w-8 text-right">{Math.round(percent)}%</span>
            </div>
         </div>
         <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
               initial={{ width: 0 }}
               whileInView={{ width: `${percent}%` }}
               transition={{ duration: 1, ease: "easeOut" }}
               className={`h-full ${color} rounded-full`}
            />
         </div>
      </div>
   )
}
