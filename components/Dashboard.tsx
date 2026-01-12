
import React, { useMemo, useState } from 'react';
import { GceResource } from '../types';
import { Button, Card, Badge } from './DesignSystem';
import { 
  Shield, AlertTriangle, ArrowRight, 
  Server, HardDrive, Zap, Globe, MapPin, 
  Image as ImageIcon, Cloud, Database, 
  CheckCircle2, XCircle, LayoutGrid, Terminal,
  Bot, RefreshCw, DollarSign, Box, Camera,
  TrendingUp, Activity, Layers, PieChart
} from 'lucide-react';
import { HealthGauge, DonutChart, SparkLine } from './Visualizations';
import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { RegionIcon } from './RegionIcon';
import { motion, AnimatePresence } from 'framer-motion';
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

  // Derived metrics for scores
  const wasteScore = useMemo(() => {
    const total = resources.length || 1;
    const waste = analysis.stoppedInstances.length;
    // Heuristic: Penalty for stopped instances
    return Math.max(0, 100 - Math.round((waste / total) * 200)); 
  }, [resources.length, analysis.stoppedInstances.length]);

  const securityScore = useMemo(() => {
    const total = resources.length || 1;
    const exposed = analysis.publicIpCount;
    // Heuristic: Penalty for public IPs
    return Math.max(0, 100 - Math.round((exposed / total) * 150));
  }, [resources.length, analysis.publicIpCount]);

  // Pricing Estimations
  const potentialSavings = useMemo(() => {
    let wastedDiskGb = 0;
    // Find disks attached to stopped VMs
    analysis.stoppedInstances.forEach(vm => {
       if (vm.disks) {
          vm.disks.forEach(d => wastedDiskGb += d.sizeGb);
       }
    });
    
    // Rough monthly estimation
    const monthlySavings = wastedDiskGb * 0.04; 
    return {
       monthly: monthlySavings,
       wastedGb: wastedDiskGb
    };
  }, [analysis.stoppedInstances]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

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
           unlabeledCount: stats.unlabeled
        });
        setAiInsight(brief);
     } catch (e) {
        console.error("Failed to gen insights", e);
     } finally {
        setIsGeneratingInsight(false);
     }
  };

  // Animation variants
  const containerVars = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVars = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVars}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-12"
    >
      {/* 1. Header Section */}
      <motion.div variants={itemVars} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {greeting}, Admin
          </h1>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mt-2 text-sm">
            <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5"/> Project Alpha</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
            <span className="font-mono text-xs opacity-80">{stats.total} Active Resources</span>
          </div>
        </div>
        <div className="flex gap-3">
           <Button variant="secondary" size="sm" onClick={() => onNavigate('logs')} leftIcon={<Terminal className="w-4 h-4" />}>Audit Logs</Button>
           <Button variant="primary" size="sm" onClick={() => onNavigate('inventory')} rightIcon={<ArrowRight className="w-4 h-4" />}>Manage Fleet</Button>
        </div>
      </motion.div>
      
      {/* 2. Key Performance Indicators */}
      <motion.div variants={itemVars} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         
         <KpiCard 
            title="Governance Score"
            value={`${analysis.complianceRate}%`}
            icon={LayoutGrid}
            trend={analysis.complianceRate >= 95 ? 'Excellent' : analysis.complianceRate > 80 ? 'Good' : 'Needs Work'}
            color={analysis.complianceRate >= 90 ? 'emerald' : 'amber'}
            subtext={`${stats.labeled}/${stats.total} labeled`}
         />

         <KpiCard 
            title="Security Posture"
            value={`${securityScore}/100`}
            icon={Shield}
            trend={analysis.publicIpCount === 0 ? 'Secure' : `${analysis.publicIpCount} Exposed IPs`}
            color={securityScore > 90 ? 'blue' : 'red'}
            subtext="Internet Exposure Risk"
         />

         <KpiCard 
            title="Active Savings"
            value={analysis.spotCount > 0 ? `${analysis.spotCount} Spot VMs` : 'No Spot VMs'}
            icon={DollarSign}
            trend="Cost Optimization"
            color="purple"
            subtext={`${Math.round((analysis.spotCount / (analysis.vmCount || 1)) * 100)}% of fleet is Spot`}
         />

         <KpiCard 
            title="Orphaned Storage"
            value={`${potentialSavings.wastedGb} GB`}
            icon={HardDrive}
            trend={potentialSavings.monthly > 0 ? `~$${potentialSavings.monthly.toFixed(2)}/mo waste` : 'Optimized'}
            color={potentialSavings.wastedGb > 0 ? 'orange' : 'emerald'}
            subtext="Attached to stopped VMs"
         />
      </motion.div>

      {/* 3. AI Executive Brief */}
      <motion.div variants={itemVars}>
         <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-1 shadow-lg shadow-violet-500/20">
            <div className="bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-xl p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-violet-500 to-fuchsia-500 p-3 rounded-2xl shadow-inner text-white">
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Executive Insights</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Strategic analysis of your cloud footprint.</p>
                        </div>
                    </div>
                    {!aiInsight && (
                        <Button 
                            variant="primary" 
                            size="md"
                            onClick={handleGenerateInsights}
                            isLoading={isGeneratingInsight}
                            leftIcon={<RefreshCw className="w-4 h-4"/>}
                            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 border-none shadow-xl"
                        >
                            Generate Brief
                        </Button>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {aiInsight ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="prose prose-sm dark:prose-invert max-w-none bg-slate-50 dark:bg-white/5 p-6 rounded-xl border border-slate-100 dark:border-white/5"
                        >
                            <MarkdownView content={aiInsight} />
                            <div className="mt-4 flex justify-end">
                                <button onClick={() => setAiInsight(null)} className="text-xs text-indigo-500 hover:underline">Clear</button>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                            <Zap className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-sm text-slate-500 max-w-md">
                                Gemini is ready to analyze your {stats.total} resources to identify cost savings, security gaps, and governance improvements.
                            </p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
         </div>
      </motion.div>

      {/* 4. Infrastructure Overview Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
         
         {/* Left: Compute & Services */}
         <motion.div variants={itemVars} className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-500" /> Compute & Services
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <ResourceStatCard 
                    label="Virtual Machines" 
                    value={analysis.vmCount} 
                    icon={Server} 
                    color="blue"
                    metrics={[
                        { label: 'On-Demand', value: analysis.onDemandCount },
                        { label: 'Spot', value: analysis.spotCount }
                    ]}
                />
                <ResourceStatCard 
                    label="Cloud Run" 
                    value={analysis.cloudRunCount} 
                    icon={Cloud} 
                    color="indigo"
                    metrics={[
                        { label: 'Services', value: analysis.cloudRunCount }
                    ]}
                />
                <ResourceStatCard 
                    label="Cloud SQL" 
                    value={analysis.sqlCount} 
                    icon={Database} 
                    color="cyan"
                    metrics={[
                        { label: 'Instances', value: analysis.sqlCount }
                    ]}
                />
                {/* Global Region Map */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Active Regions</span>
                        <Globe className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="space-y-3 flex-1 overflow-auto custom-scrollbar max-h-[120px]">
                        {analysis.topZones.length === 0 && <span className="text-xs text-slate-400 italic">No resources</span>}
                        {analysis.topZones.map(([zone, count]) => (
                            <div key={zone} className="flex justify-between items-center text-xs">
                                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                    <RegionIcon zone={zone} /> {zone}
                                </span>
                                <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
         </motion.div>

         {/* Right: Storage & Artifacts */}
         <motion.div variants={itemVars} className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-purple-500" /> Storage & Artifacts
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <ResourceStatCard 
                    label="Persistent Disks" 
                    value={analysis.diskCount} 
                    icon={HardDrive} 
                    color="purple"
                    metrics={[
                        { label: 'Total Capacity', value: `${analysis.totalDiskGb} GB` }
                    ]}
                />
                <ResourceStatCard 
                    label="Object Storage" 
                    value={analysis.bucketCount} 
                    icon={Box} 
                    color="yellow"
                    metrics={[
                        { label: 'Buckets', value: analysis.bucketCount }
                    ]}
                />
                <ResourceStatCard 
                    label="Disk Snapshots" 
                    value={analysis.snapshotCount} 
                    icon={Camera} 
                    color="pink"
                    metrics={[
                        { label: 'Backup Size', value: `${analysis.totalSnapshotGb} GB` }
                    ]}
                />
                <ResourceStatCard 
                    label="Machine Images" 
                    value={analysis.imageCount} 
                    icon={ImageIcon} 
                    color="orange"
                    metrics={[
                        { label: 'Image Size', value: `${analysis.totalImageGb} GB` }
                    ]}
                />
            </div>
         </motion.div>
      </div>

      {/* 5. Bottom Detail Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* Label Distribution */}
         <motion.div variants={itemVars} className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500">
                  <Layers className="w-5 h-5" />
               </div>
               <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">Tagging Coverage</h3>
                  <p className="text-xs text-slate-500">Top used label keys across fleet.</p>
               </div>
            </div>
            
            <div className="space-y-4">
               {analysis.labelDistribution.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">No labels found on any resources.</div>
               )}
               {analysis.labelDistribution.map((item, i) => (
                  <div key={item.label}>
                     <div className="flex justify-between text-xs mb-1.5 font-medium">
                        <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                        <span className="text-slate-400">{item.value}</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                           initial={{ width: 0 }}
                           whileInView={{ width: `${(item.value / analysis.maxLabelCount) * 100}%` }}
                           transition={{ duration: 1, delay: i * 0.1 }}
                           className="h-full bg-indigo-500 rounded-full"
                        />
                     </div>
                  </div>
               ))}
            </div>
         </motion.div>

         {/* Actionable Alerts */}
         <motion.div variants={itemVars} className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden relative">
            <div className="flex items-center justify-between mb-6 relative z-10">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-500">
                     <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">Governance Alerts</h3>
               </div>
               {analysis.stoppedInstances.length > 0 && (
                  <Badge variant="error" className="animate-pulse">{analysis.stoppedInstances.length} Issues</Badge>
               )}
            </div>

            <div className="relative z-10">
               {analysis.stoppedInstances.length === 0 && analysis.publicIpCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                     <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3 opacity-20" />
                     <p>No critical issues detected. System healthy.</p>
                  </div>
               ) : (
                  <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                     {analysis.stoppedInstances.slice(0, 5).map(vm => (
                        <div key={vm.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 group">
                           <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                              <div>
                                 <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{vm.name}</div>
                                 <div className="text-[10px] text-slate-500">Stopped Instance • Costing Storage</div>
                              </div>
                           </div>
                           <Button 
                              size="xs" 
                              variant="ghost" 
                              className="text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 h-7"
                              onClick={() => onNavigate('inventory')}
                           >
                              Inspect
                           </Button>
                        </div>
                     ))}
                     {analysis.publicIpCount > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                           <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                              <div>
                                 <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Public Internet Exposure</div>
                                 <div className="text-[10px] text-slate-500">{analysis.publicIpCount} resources have external IPs</div>
                              </div>
                           </div>
                           <Button 
                              size="xs" 
                              variant="ghost" 
                              className="text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40 h-7"
                              onClick={() => onNavigate('inventory')}
                           >
                              Review
                           </Button>
                        </div>
                     )}
                  </div>
               )}
            </div>
         </motion.div>
      </div>
    </motion.div>
  );
};

// --- Subcomponents ---

const KpiCard = ({ title, value, icon: Icon, trend, color, subtext }: any) => {
   const colors: any = {
      emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
      blue: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
      purple: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
      orange: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
      amber: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
      red: 'text-red-500 bg-red-50 dark:bg-red-900/20',
   };

   return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
         <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl ${colors[color]}`}>
               <Icon className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${colors[color]}`}>
               {trend}
            </span>
         </div>
         <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-1">{title}</div>
            <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">{subtext}</div>
         </div>
      </div>
   );
};

const ResourceStatCard = ({ label, value, icon: Icon, color, metrics }: any) => {
   const colorStyles: any = {
      blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
      purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
      orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
      indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
      pink: 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400',
      cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400',
      yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
   };

   return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
         <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorStyles[color]}`}>
                   <Icon className="w-4 h-4" />
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{label}</span>
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">{value}</span>
         </div>
         <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            {metrics.map((m: any, i: number) => (
               <div key={i} className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span>{m.label}</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{m.value}</span>
               </div>
            ))}
         </div>
      </div>
   );
};
