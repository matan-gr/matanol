
import React, { useState, useEffect, useMemo } from 'react';
import { GceResource, TimelineEntry, DiffResult, ResourceSnapshot } from '../types';
import { persistenceService } from '../services/persistenceService';
import { generateMockTimeline } from '../services/mockService';
import { 
  History, ArrowRight, GitCommit, Calendar, 
  Plus, Minus, RefreshCw, Search, Server, HardDrive, 
  Database, Box, Ship, Cloud, Monitor, Sparkles, CheckCircle2, Clock
} from 'lucide-react';
import { Badge, Button, Input } from './DesignSystem';
import { motion, AnimatePresence } from 'framer-motion';

interface TimeMachineProps {
  currentResources: GceResource[];
  projectId: string;
}

const ResourceIcon = ({ type }: { type: string }) => {
    switch(type) {
        case 'INSTANCE': return <Server className="w-4 h-4" />;
        case 'DISK': return <HardDrive className="w-4 h-4" />;
        case 'CLOUD_SQL': return <Database className="w-4 h-4" />;
        case 'BUCKET': return <Box className="w-4 h-4" />;
        case 'GKE_CLUSTER': return <Ship className="w-4 h-4" />;
        case 'CLOUD_RUN': return <Cloud className="w-4 h-4" />;
        default: return <Monitor className="w-4 h-4" />;
    }
};

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};

export const TimeMachine: React.FC<TimeMachineProps> = ({ currentResources, projectId }) => {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [filterSearch, setFilterSearch] = useState('');

  // 1. Fetch Timeline on Mount
  useEffect(() => {
    const loadTimeline = async () => {
      setIsLoading(true);
      try {
        const data = await persistenceService.getTimeline(projectId);
        setTimeline(data);
        if (data.length > 0 && !selectedDate) {
            // Default to the most recent snapshot that ISN'T today (to show some potential diff), 
            // otherwise just the latest.
            const today = new Date().toISOString().split('T')[0];
            const historic = data.find(t => t.date !== today);
            setSelectedDate(historic ? historic.date : data[0].date);
        }
      } catch (e) {
        console.error("Failed to load timeline", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadTimeline();
  }, [projectId]);

  // Demo Generator
  const generateSamples = () => {
      const mockTimeline = generateMockTimeline(currentResources);
      setTimeline(mockTimeline);
      setSelectedDate(mockTimeline[0].date); // Set to oldest
  };

  // 2. Compute Diff
  const diffResults = useMemo<DiffResult[]>(() => {
    if (!selectedDate) return [];
    
    const snapshotEntry = timeline.find(t => t.date === selectedDate);
    if (!snapshotEntry) return [];

    const snapshotMap = new Map(snapshotEntry.resources.map(r => [r.id, r]));
    const currentMap = new Map(currentResources.map(r => [r.id, r]));
    
    const diffs: DiffResult[] = [];

    // Check Added & Modified
    currentResources.forEach(curr => {
        const past = snapshotMap.get(curr.id);
        if (!past) {
            diffs.push({
                id: curr.id,
                name: curr.name,
                type: curr.type,
                changeType: 'ADDED',
                details: 'New Resource',
                present: curr
            });
        } else {
            // Check drift (status changed, labels changed)
            // Note: Timeline snapshot labels are stringified in labelHash or we can reconstruct if stored properly.
            // PersistenceService stores a `labelHash` string in ResourceSnapshot.
            // We compare current labels stringified to that hash.
            const currentHash = JSON.stringify(curr.labels);
            
            if (past.labelHash !== currentHash || past.status !== curr.status) {
                const details = [];
                if (past.status !== curr.status) details.push(`Status: ${past.status} → ${curr.status}`);
                if (past.labelHash !== currentHash) details.push(`Labels updated`);
                
                diffs.push({
                    id: curr.id,
                    name: curr.name,
                    type: curr.type,
                    changeType: 'MODIFIED',
                    details: details.join(', '),
                    past,
                    present: curr
                });
            }
        }
    });

    // Check Removed
    snapshotEntry.resources.forEach(past => {
        if (!currentMap.has(past.id)) {
            diffs.push({
                id: past.id,
                name: past.name,
                type: past.type,
                changeType: 'REMOVED',
                details: 'Resource deleted',
                past
            });
        }
    });

    // Sort: Removed -> Added -> Modified
    return diffs.sort((a, b) => {
        const order = { REMOVED: 0, ADDED: 1, MODIFIED: 2, UNCHANGED: 3 };
        return order[a.changeType] - order[b.changeType];
    });

  }, [selectedDate, timeline, currentResources]);

  // 3. Filter Results
  const filteredDiffs = useMemo(() => {
      if (!filterSearch) return diffResults;
      const lower = filterSearch.toLowerCase();
      return diffResults.filter(d => 
          d.name.toLowerCase().includes(lower) || 
          d.id.toLowerCase().includes(lower) ||
          d.changeType.toLowerCase().includes(lower)
      );
  }, [diffResults, filterSearch]);

  const stats = {
      added: diffResults.filter(d => d.changeType === 'ADDED').length,
      removed: diffResults.filter(d => d.changeType === 'REMOVED').length,
      modified: diffResults.filter(d => d.changeType === 'MODIFIED').length,
  };

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 animate-pulse">
              <History className="w-12 h-12 mb-4 opacity-50" />
              <p>Loading timeline snapshots...</p>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Left: Timeline Control */}
        <div className="w-full md:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col shadow-sm shrink-0">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-indigo-500" /> Snapshots
                </h3>
            </div>
            
            {timeline.length === 0 ? (
                <div className="p-6 text-center">
                    <p className="text-xs text-slate-500 mb-4">No history found. Create snapshots to track changes.</p>
                    <Button variant="secondary" size="sm" onClick={generateSamples} leftIcon={<Sparkles className="w-3 h-3 text-amber-500"/>} className="w-full">
                        Generate Demo Data
                    </Button>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {timeline.map((entry) => (
                        <button
                            key={entry.date}
                            onClick={() => setSelectedDate(entry.date)}
                            className={`w-full text-left px-3 py-3 rounded-lg text-xs font-medium transition-all flex justify-between items-center group relative
                                ${selectedDate === entry.date 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}
                            `}
                        >
                            <div className="flex flex-col">
                                <span className="font-bold">{formatDate(entry.date)}</span>
                                <span className={`text-[10px] ${selectedDate === entry.date ? 'text-indigo-200' : 'text-slate-400'}`}>{entry.resources.length} Items</span>
                            </div>
                            
                            {selectedDate === entry.date && <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>}
                            
                            {entry.date === new Date().toISOString().split('T')[0] && (
                                <span className={`absolute top-2 right-2 text-[8px] px-1.5 py-0.5 rounded border ${selectedDate === entry.date ? 'border-white/30 text-white' : 'border-slate-200 text-slate-400'}`}>Today</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Right: Diff View */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-xl shrink-0">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <GitCommit className="w-5 h-5 text-indigo-500" /> 
                            Configuration Drift
                        </h2>
                        {selectedDate && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                                <Clock className="w-3 h-3" />
                                Comparing <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedDate}</span> vs <span className="font-bold text-emerald-600 dark:text-emerald-400">Live State</span>
                            </p>
                        )}
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg">
                            <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{stats.added}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg">
                            <Minus className="w-4 h-4 text-red-600 dark:text-red-400" />
                            <span className="text-sm font-bold text-red-700 dark:text-red-300">{stats.removed}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg">
                            <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{stats.modified}</span>
                        </div>
                    </div>
                </div>

                <Input 
                    icon={<Search className="w-4 h-4"/>} 
                    placeholder="Filter changes..." 
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    className="h-9 text-sm"
                />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {timeline.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <History className="w-12 h-12 opacity-20 mb-2" />
                        <p className="text-sm">Select or generate history to begin analysis.</p>
                    </div>
                ) : filteredDiffs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/10 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h3 className="font-bold text-slate-700 dark:text-slate-200">System Synchronized</h3>
                        <p className="text-sm mt-1">No configuration drift detected since {selectedDate}.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence>
                            {filteredDiffs.map(diff => (
                                <motion.div 
                                    key={diff.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`
                                        p-4 rounded-xl border flex items-start gap-4 shadow-sm bg-white dark:bg-slate-900 transition-colors
                                        ${diff.changeType === 'ADDED' ? 'border-emerald-200 dark:border-emerald-900/50' : 
                                          diff.changeType === 'REMOVED' ? 'border-red-200 dark:border-red-900/50' : 
                                          'border-amber-200 dark:border-amber-900/50'}
                                    `}
                                >
                                    {/* Icon Column */}
                                    <div className={`
                                        p-2 rounded-lg shrink-0 mt-0.5
                                        ${diff.changeType === 'ADDED' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 
                                          diff.changeType === 'REMOVED' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 
                                          'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}
                                    `}>
                                        {diff.changeType === 'ADDED' ? <Plus className="w-5 h-5" /> : 
                                         diff.changeType === 'REMOVED' ? <Minus className="w-5 h-5" /> : 
                                         <RefreshCw className="w-5 h-5" />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-900 dark:text-white text-sm">{diff.name}</span>
                                                    <Badge variant="neutral" className="text-[10px] flex items-center gap-1">
                                                        <ResourceIcon type={diff.type} /> {diff.type}
                                                    </Badge>
                                                </div>
                                                <div className="font-mono text-xs text-slate-400 truncate">{diff.id}</div>
                                            </div>
                                            <Badge variant={diff.changeType === 'ADDED' ? 'success' : diff.changeType === 'REMOVED' ? 'error' : 'warning'}>
                                                {diff.changeType}
                                            </Badge>
                                        </div>
                                        
                                        {/* Diff Details */}
                                        <div className="text-xs space-y-1">
                                            {diff.changeType === 'MODIFIED' && diff.present && diff.past && (
                                                <div className="grid grid-cols-2 gap-4 mt-2 bg-slate-50 dark:bg-slate-950/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                                                    <div>
                                                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Before</div>
                                                        <div className="font-mono text-slate-500">{diff.past.status}</div>
                                                        {diff.past.labelHash && (
                                                            <div className="mt-1 text-[10px] text-slate-400 italic">Labels Hash: {diff.past.labelHash.substring(0,8)}...</div>
                                                        )}
                                                    </div>
                                                    <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                                                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">After</div>
                                                        <div className={`font-mono font-bold ${diff.present.status !== diff.past.status ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                                            {diff.present.status}
                                                        </div>
                                                        {JSON.stringify(diff.present.labels) !== diff.past.labelHash && (
                                                            <div className="mt-1 text-[10px] text-amber-600 font-medium">Labels Changed</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {diff.changeType === 'ADDED' && (
                                                <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                    <Plus className="w-3 h-3" /> New resource detected in scan
                                                </div>
                                            )}
                                            
                                            {diff.changeType === 'REMOVED' && (
                                                <div className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                                    <Minus className="w-3 h-3" /> Resource no longer found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
