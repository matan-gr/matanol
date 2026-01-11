
import React, { useMemo } from 'react';
import { GceResource } from '../types';
import { Button } from './DesignSystem';
import { 
  Shield, AlertTriangle, ArrowRight, 
  Server, HardDrive, Zap, Globe, MapPin, 
  Image as ImageIcon, Cloud, Database, 
  CheckCircle2, XCircle, LayoutGrid, Terminal
} from 'lucide-react';
import { HealthGauge, DonutChart, SparkLine } from './Visualizations';
import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { RegionIcon } from './RegionIcon';
import { motion } from 'framer-motion';

interface DashboardProps {
  resources: GceResource[];
  stats: { total: number; labeled: number; unlabeled: number };
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ resources, stats, onNavigate }) => {
  const analysis = useDashboardAnalytics(resources, stats);

  // Derived metrics for the new design
  const wasteScore = useMemo(() => {
    // Simple heuristic: Orphaned resources reduce score
    const total = resources.length || 1;
    const waste = analysis.stoppedInstances.length;
    return Math.max(0, 100 - Math.round((waste / total) * 100));
  }, [resources.length, analysis.stoppedInstances.length]);

  const securityScore = useMemo(() => {
    const total = resources.length || 1;
    const exposed = analysis.publicIpCount;
    return Math.max(0, 100 - Math.round((exposed / total) * 100));
  }, [resources.length, analysis.publicIpCount]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // Animation variants
  const containerVars = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVars = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={containerVars}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-12"
    >
      {/* Header */}
      <motion.div variants={itemVars} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting}, Admin
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Here is your cloud governance overview for <span className="font-semibold text-slate-700 dark:text-slate-300">Project Alpha</span>.
          </p>
        </div>
        <div className="flex gap-3">
           <Button variant="secondary" size="sm" onClick={() => onNavigate('logs')} leftIcon={<Terminal className="w-4 h-4" />}>Audit Logs</Button>
           <Button variant="primary" size="sm" onClick={() => onNavigate('inventory')} rightIcon={<ArrowRight className="w-4 h-4" />}>Manage Fleet</Button>
        </div>
      </motion.div>
      
      {/* KPI Cards */}
      <motion.div variants={itemVars} className="grid grid-cols-1 md:grid-cols-3 gap-6">
         
         {/* 1. Governance Score */}
         <div className="relative group overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-emerald-500/20"></div>
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Compliance</h3>
                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{analysis.complianceRate}%</div>
               </div>
               <div className={`p-2 rounded-lg ${analysis.complianceRate > 90 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                  <LayoutGrid className="w-5 h-5" />
               </div>
            </div>
            <div className="space-y-2">
               <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis.complianceRate}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full ${analysis.complianceRate > 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
               </div>
               <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{stats.labeled}</span> resources labeled out of {stats.total}.
               </p>
            </div>
         </div>

         {/* 2. Security Posture */}
         <div className="relative group overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 transition-colors ${analysis.publicIpCount === 0 ? 'bg-blue-500/10 group-hover:bg-blue-500/20' : 'bg-red-500/10 group-hover:bg-red-500/20'}`}></div>
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Security</h3>
                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                     {securityScore}/100
                  </div>
               </div>
               <div className={`p-2 rounded-lg ${analysis.publicIpCount === 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'}`}>
                  <Shield className="w-5 h-5" />
               </div>
            </div>
            <div className="space-y-3">
               <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {analysis.publicIpCount === 0 ? (
                     <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  ) : (
                     <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                  {analysis.publicIpCount === 0 ? "No public endpoints detected" : `${analysis.publicIpCount} resources publicly exposed`}
               </div>
               <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  IAM Policy Check Passed
               </div>
            </div>
         </div>

         {/* 3. Cost Efficiency */}
         <div className="relative group overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-purple-500/20"></div>
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Efficiency</h3>
                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{wasteScore}/100</div>
               </div>
               <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                  <Zap className="w-5 h-5" />
               </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
               <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Waste</span>
                  <span className={`text-lg font-bold ${analysis.stoppedInstances.length > 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                     {analysis.stoppedInstances.length}
                  </span>
                  <span className="text-[9px] text-slate-400 leading-none">Stopped VMs</span>
               </div>
               <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Savings</span>
                  <span className="text-lg font-bold text-emerald-500">
                     {analysis.spotCount}
                  </span>
                  <span className="text-[9px] text-slate-400 leading-none">Spot VMs</span>
               </div>
            </div>
         </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* Left Column: Inventory Breakdown */}
         <motion.div variants={itemVars} className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
               <Server className="w-5 h-5 text-blue-500" />
               Resource Landscape
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
               <ResourceCard 
                  label="Compute" 
                  count={analysis.vmCount} 
                  icon={Server} 
                  color="blue"
                  subtext={`${analysis.onDemandCount} OD / ${analysis.spotCount} Spot`}
               />
               <ResourceCard 
                  label="Database" 
                  count={analysis.sqlCount} 
                  icon={Database} 
                  color="orange"
                  subtext="Cloud SQL"
               />
               <ResourceCard 
                  label="Serverless" 
                  count={analysis.cloudRunCount} 
                  icon={Cloud} 
                  color="indigo"
                  subtext="Cloud Run"
               />
               <ResourceCard 
                  label="Storage" 
                  count={analysis.diskCount} 
                  icon={HardDrive} 
                  color="purple"
                  subtext="Persistent Disks"
               />
               <ResourceCard 
                  label="Images" 
                  count={analysis.imageCount} 
                  icon={ImageIcon} 
                  color="pink"
                  subtext="Machine Images"
               />
               <ResourceCard 
                  label="Snapshots" 
                  count={analysis.snapshotCount} 
                  icon={ImageIcon} 
                  color="cyan"
                  subtext="Disk Backups"
               />
            </div>

            {/* Zone Analysis */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-800 dark:text-white">Geographic Distribution</h3>
                  <Globe className="w-4 h-4 text-slate-400" />
               </div>
               <div className="space-y-4">
                  {analysis.topZones.length === 0 && <div className="text-slate-400 text-sm italic">No resources found.</div>}
                  {analysis.topZones.map(([zone, count], idx) => (
                     <div key={zone} className="relative group">
                        <div className="flex justify-between text-xs mb-1.5 relative z-10">
                           <span className="font-mono font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2">
                              <RegionIcon zone={zone} className="w-4 h-3 rounded-[1px] shadow-sm" /> 
                              {zone === 'global' ? 'Global Multi-region' : zone}
                           </span>
                           <span className="font-bold text-slate-800 dark:text-white">{count}</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                           <motion.div 
                              initial={{ width: 0 }}
                              whileInView={{ width: `${(count / analysis.maxZone) * 100}%` }}
                              transition={{ duration: 0.8, delay: idx * 0.1 }}
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                           ></motion.div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </motion.div>

         {/* Right Column: Insights & Actions */}
         <motion.div variants={itemVars} className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
               <AlertTriangle className="w-5 h-5 text-amber-500" />
               Action Center
            </h2>

            {/* Orphaned Resources Widget */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 overflow-hidden shadow-sm">
               <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/10">
                  <div className="flex justify-between items-center">
                     <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Attention Needed</span>
                     <span className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {analysis.stoppedInstances.length} Issues
                     </span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-800 dark:text-white">
                     Stopped instances incurring costs
                  </div>
               </div>
               
               <div className="p-2 space-y-1">
                  {analysis.stoppedInstances.length === 0 ? (
                     <div className="p-8 text-center text-slate-400 text-sm">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
                        No orphaned resources detected.
                     </div>
                  ) : (
                     analysis.stoppedInstances.slice(0, 4).map(r => (
                        <div key={r.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors group cursor-default">
                           <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{r.name}</span>
                              <span className="text-[10px] text-slate-500">{r.zone} • {r.machineType}</span>
                           </div>
                           <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                     ))
                  )}
               </div>
               
               {analysis.stoppedInstances.length > 0 && (
                  <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                     <Button 
                        size="xs" 
                        variant="ghost" 
                        className="w-full text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                        onClick={() => onNavigate('inventory')}
                     >
                        Review All {analysis.stoppedInstances.length} Items
                     </Button>
                  </div>
               )}
            </div>

            {/* Label Distribution */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
               <h3 className="font-bold text-slate-800 dark:text-white mb-4 text-sm uppercase tracking-wide">Label Coverage</h3>
               <div className="space-y-4">
                  {analysis.labelDistribution.length === 0 && <div className="text-slate-400 text-sm italic">No labels found.</div>}
                  {analysis.labelDistribution.map((item, i) => (
                     <div key={item.label} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                           <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">{item.value}</span>
                     </div>
                  ))}
               </div>
               <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <DonutChart data={[
                     { label: 'Spot', value: analysis.spotCount, color: '#a855f7' },
                     { label: 'Reserved', value: analysis.reservedCount, color: '#10b981' },
                     { label: 'On-Demand', value: analysis.onDemandCount, color: '#3b82f6' },
                  ]} />
                  <div className="text-center mt-2 text-[10px] text-slate-400">VM Pricing Models</div>
               </div>
            </div>

         </motion.div>
      </div>
    </motion.div>
  );
};

// --- Subcomponents ---

interface ResourceCardProps {
   label: string;
   count: number;
   icon: React.ElementType;
   color: 'blue' | 'purple' | 'orange' | 'indigo' | 'pink' | 'cyan';
   subtext: string;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ label, count, icon: Icon, color, subtext }) => {
   const colorStyles = {
      blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
      purple: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
      orange: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
      indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
      pink: 'bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400',
      cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400',
   };

   return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm group">
         <div className="flex justify-between items-start">
            <div className={`p-2 rounded-lg ${colorStyles[color]} transition-transform group-hover:scale-110 duration-300`}>
               <Icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{count}</div>
         </div>
         <div className="mt-3">
            <div className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{label}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{subtext}</div>
         </div>
      </div>
   );
};
