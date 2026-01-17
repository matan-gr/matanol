
import React, { useState, useMemo, useEffect } from 'react';
import { GceResource } from '../types';
import { 
  Tag, Eraser, ArrowRight, Save, X, 
  RefreshCw, Plus, Trash2,
  Lightbulb, Check, Layers,
  Replace, Eye, Scissors, Wand2, Loader2, Split,
  HelpCircle, Info, BookOpen, AlertCircle, BarChart3, Merge, ArrowDownToLine, MousePointerClick, MessageSquare, List
} from 'lucide-react';
import { Button, Input, ToggleSwitch, Badge, Tooltip, Modal, Select } from './DesignSystem';
import { motion, AnimatePresence } from 'framer-motion';
import { validateKey, validateValue } from '../utils/validation';

// --- Types ---

type OperationType = 'ADD' | 'REMOVE' | 'REPLACE' | 'EXTRACT_REGEX' | 'PATTERN' | 'CASE_TRANSFORM' | 'NORMALIZE_VALUES';

interface LabelOperation {
  id: string;
  type: OperationType;
  config: {
    key?: string;
    value?: string;
    find?: string;
    replace?: string;
    regex?: string;
    delimiter?: string;
    groups?: { index: number; targetKey: string }[];
    mappings?: { index: number; targetKey: string }[];
    casing?: 'lowercase' | 'uppercase';
    // For Normalization
    targetKey?: string;
    valueMap?: Record<string, string>; // { "bad_value": "good_value" }
  };
  enabled: boolean;
}

interface LabelingStudioProps {
  isOpen: boolean;
  onClose: () => void;
  selectedResources: GceResource[];
  onApply: (updates: Map<string, Record<string, string>>, reason?: string) => void;
}

// --- Constants ---

const DEFAULT_OPERATIONS: Record<OperationType, LabelOperation> = {
  ADD: { id: '', type: 'ADD', config: { key: '', value: '' }, enabled: true },
  REMOVE: { id: '', type: 'REMOVE', config: { key: '' }, enabled: true },
  REPLACE: { id: '', type: 'REPLACE', config: { find: '', replace: '' }, enabled: true },
  EXTRACT_REGEX: { id: '', type: 'EXTRACT_REGEX', config: { regex: '^([a-z]+)-', groups: [{ index: 1, targetKey: 'env' }] }, enabled: true },
  PATTERN: { id: '', type: 'PATTERN', config: { delimiter: '-', mappings: [] }, enabled: true },
  CASE_TRANSFORM: { id: '', type: 'CASE_TRANSFORM', config: { casing: 'lowercase' }, enabled: true },
  NORMALIZE_VALUES: { id: '', type: 'NORMALIZE_VALUES', config: { targetKey: '', valueMap: {} }, enabled: true },
};

const OP_DESCRIPTIONS: Record<OperationType, { label: string, desc: string, icon: any }> = {
    ADD: { label: "Add Label", desc: "Apply a specific Key:Value pair to all resources.", icon: Plus },
    REMOVE: { label: "Remove Label", desc: "Delete a label if it exists.", icon: Eraser },
    REPLACE: { label: "Find & Replace", desc: "Replace specific text within label values.", icon: Replace },
    PATTERN: { label: "Split Pattern", desc: "Split resource Name by a delimiter (e.g. '-') to extract values.", icon: Split },
    EXTRACT_REGEX: { label: "Regex Extract", desc: "Advanced extraction from Name using Regular Expressions.", icon: Scissors },
    CASE_TRANSFORM: { label: "Case Transform", desc: "Force keys/values to lowercase or uppercase.", icon: RefreshCw },
    NORMALIZE_VALUES: { label: "Normalize Values", desc: "Map multiple inconsistent values to a single standard.", icon: Merge },
};

// --- Logic ---

const applyOperations = (labels: Record<string, string>, resourceName: string, ops: LabelOperation[]) => {
  let currentLabels = { ...labels };

  ops.filter(o => o.enabled).forEach(op => {
    switch (op.type) {
      case 'ADD':
        if (op.config.key && op.config.value) {
          currentLabels[op.config.key] = op.config.value;
        }
        break;
      case 'REMOVE':
        if (op.config.key && currentLabels[op.config.key] !== undefined) {
          delete currentLabels[op.config.key];
        }
        break;
      case 'REPLACE':
        if (op.config.find && op.config.replace) {
          Object.keys(currentLabels).forEach(k => {
            if (currentLabels[k].includes(op.config.find!)) {
              currentLabels[k] = currentLabels[k].replace(op.config.find!, op.config.replace!);
            }
          });
        }
        break;
      case 'EXTRACT_REGEX':
        if (op.config.regex && op.config.groups) {
          try {
            const re = new RegExp(op.config.regex);
            const match = resourceName.match(re);
            if (match) {
              op.config.groups.forEach(g => {
                if (match[g.index]) {
                  currentLabels[g.targetKey] = match[g.index];
                }
              });
            }
          } catch (e) { /* Ignore invalid regex while typing */ }
        }
        break;
      case 'PATTERN':
        if (op.config.delimiter && op.config.mappings) {
          const parts = resourceName.split(op.config.delimiter);
          op.config.mappings.forEach(m => {
            if (parts[m.index]) {
              currentLabels[m.targetKey] = parts[m.index];
            }
          });
        }
        break;
      case 'CASE_TRANSFORM':
        const newLabels: Record<string, string> = {};
        Object.entries(currentLabels).forEach(([k, v]) => {
          const newK = k.toLowerCase(); 
          const newV = op.config.casing === 'lowercase' ? v.toLowerCase() : v.toUpperCase();
          newLabels[newK] = newV;
        });
        currentLabels = newLabels;
        break;
      case 'NORMALIZE_VALUES':
        if (op.config.targetKey && op.config.valueMap) {
            const target = op.config.targetKey;
            const currentVal = currentLabels[target];
            if (currentVal && op.config.valueMap[currentVal]) {
                currentLabels[target] = op.config.valueMap[currentVal];
            }
        }
        break;
    }
  });

  return currentLabels;
};

// --- Sub-Components ---

const ValueDistributionChart = ({ 
    resources, 
    targetKey, 
    onMerge 
}: { 
    resources: GceResource[], 
    targetKey: string,
    onMerge: (from: string[], to: string) => void
}) => {
    const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
    const [mergeTarget, setMergeTarget] = useState('');

    const distribution = useMemo(() => {
        const counts: Record<string, number> = {};
        resources.forEach(r => {
            const val = r.labels[targetKey];
            if (val) counts[val] = (counts[val] || 0) + 1;
        });
        return Object.entries(counts).sort((a,b) => b[1] - a[1]);
    }, [resources, targetKey]);

    const maxCount = distribution.length > 0 ? distribution[0][1] : 1;

    const handleToggle = (val: string) => {
        setSelectedValues(prev => {
            const next = new Set(prev);
            if (next.has(val)) next.delete(val); else next.add(val);
            // If selecting, populate merge target with first selection if empty
            if (!next.has(val) && mergeTarget === '') setMergeTarget(val); 
            return next;
        });
    };

    const executeMerge = () => {
        if (!mergeTarget || selectedValues.size === 0) return;
        const valuesToMerge = Array.from(selectedValues).filter(v => v !== mergeTarget) as string[];
        if (valuesToMerge.length === 0) return;
        
        onMerge(valuesToMerge, mergeTarget);
        setSelectedValues(new Set());
        setMergeTarget('');
    };

    if (!targetKey) return <div className="text-center text-slate-400 py-10 italic">Select a Label Key to analyze</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <div>
                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-1">Value Distribution</h4>
                    <p className="text-xs text-slate-400">Select inconsistencies to merge.</p>
                </div>
                {selectedValues.size > 0 && (
                    <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg border border-indigo-100 dark:border-indigo-800 animate-in slide-in-from-right-4 fade-in">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Merge {selectedValues.size} into:</span>
                        <Input 
                            value={mergeTarget} 
                            onChange={e => setMergeTarget(e.target.value)} 
                            className="h-7 w-32 text-xs" 
                            placeholder="Target value"
                        />
                        <Button size="xs" variant="primary" onClick={executeMerge} leftIcon={<Merge className="w-3 h-3"/>}>
                            Fix
                        </Button>
                    </div>
                )}
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {distribution.map(([val, count]) => {
                    const isSelected = selectedValues.has(val);
                    const percentage = (count / maxCount) * 100;
                    
                    return (
                        <div 
                            key={val}
                            onClick={() => handleToggle(val)}
                            className={`
                                relative flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all group
                                ${isSelected 
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-500 shadow-sm' 
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}
                            `}
                        >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            
                            <div className="flex-1 z-10">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className={`font-mono font-medium ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{val}</span>
                                    <span className="text-slate-400">{count}</span>
                                </div>
                                {/* Bar */}
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        className={`h-full rounded-full ${isSelected ? 'bg-indigo-500' : 'bg-slate-400 dark:bg-slate-600 group-hover:bg-slate-500'}`}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
                {distribution.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs">No values found for this key.</div>
                )}
            </div>
        </div>
    );
};

// --- Main Component ---

export const LabelingStudio: React.FC<LabelingStudioProps> = ({ 
  isOpen, onClose, selectedResources, onApply 
}) => {
  const [pipeline, setPipeline] = useState<LabelOperation[]>([]);
  const [viewMode, setViewMode] = useState<'BUILD' | 'REVIEW'>('BUILD');
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'CLUSTERING'>('PIPELINE'); 
  const [clusteringKey, setClusteringKey] = useState<string>('');
  const [changeReason, setChangeReason] = useState('');

  const allKeys = useMemo(() => {
      const keys = new Set<string>();
      selectedResources.forEach(r => Object.keys(r.labels).forEach(k => keys.add(k)));
      return Array.from(keys).sort();
  }, [selectedResources]);

  useEffect(() => {
    if (isOpen) {
        if (allKeys.includes('environment')) setClusteringKey('environment');
        else if (allKeys.length > 0) setClusteringKey(allKeys[0]);
        setChangeReason('');
    }
    if (!isOpen) {
        setViewMode('BUILD'); 
        setPipeline([]);
    }
  }, [isOpen, allKeys]);

  const addOperation = (type: OperationType, initialConfig?: any) => {
    const newOp = { 
      ...DEFAULT_OPERATIONS[type], 
      id: Math.random().toString(36).substr(2, 9),
      config: initialConfig || JSON.parse(JSON.stringify(DEFAULT_OPERATIONS[type].config))
    };
    setPipeline(prev => [...prev, newOp]);
    return newOp.id;
  };

  const removeOperation = (id: string) => {
    setPipeline(prev => prev.filter(p => p.id !== id));
  };

  const updateOperation = (id: string, updates: Partial<LabelOperation>) => {
    setPipeline(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updateConfig = (id: string, field: string, value: any) => {
    setPipeline(prev => prev.map(p => {
      if (p.id !== id) return p;
      return { ...p, config: { ...p.config, [field]: value } };
    }));
  };

  const handleNormalizationMerge = (badValues: string[], targetValue: string) => {
      // Check if we already have a normalization op for this key
      const existingOp = pipeline.find(p => p.type === 'NORMALIZE_VALUES' && p.config.targetKey === clusteringKey);
      
      const newValueMap = existingOp ? { ...existingOp.config.valueMap } : {};
      badValues.forEach(bad => newValueMap[bad] = targetValue);

      if (existingOp) {
          updateConfig(existingOp.id, 'valueMap', newValueMap);
      } else {
          addOperation('NORMALIZE_VALUES', { targetKey: clusteringKey, valueMap: newValueMap });
      }
      
      setActiveTab('PIPELINE'); // Switch back to pipeline to show the added rule
  };

  // --- Calculations ---

  const previewData = useMemo(() => {
    const changes = new Map<string, { original: Record<string, string>, final: Record<string, string>, diff: any[] }>();
    
    selectedResources.forEach(res => {
      const final = applyOperations(res.labels, res.name, pipeline);
      
      const diff: any[] = [];
      const allKeys = new Set([...Object.keys(res.labels), ...Object.keys(final)]);
      
      allKeys.forEach(k => {
        const oldV = res.labels[k];
        const newV = final[k];
        if (oldV !== newV) {
          diff.push({ 
            key: k, 
            oldVal: oldV, 
            newVal: newV, 
            type: !oldV ? 'ADD' : !newV ? 'REMOVE' : 'MODIFY' 
          });
        }
      });

      if (diff.length > 0) {
        changes.set(res.id, { original: res.labels, final, diff });
      }
    });

    return changes;
  }, [selectedResources, pipeline]);

  const stats = useMemo(() => {
    let adds = 0, mods = 0, dels = 0;
    previewData.forEach(data => {
      data.diff.forEach(d => {
        if (d.type === 'ADD') adds++;
        if (d.type === 'MODIFY') mods++;
        if (d.type === 'REMOVE') dels++;
      });
    });
    return { adds, mods, dels, totalResources: previewData.size };
  }, [previewData]);

  const handleApply = () => {
    const updates = new Map<string, Record<string, string>>();
    previewData.forEach((val, key) => {
      updates.set(key, val.final);
    });
    onApply(updates, changeReason);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" 
        onClick={onClose} 
      />

      {/* Main Window */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl h-[90vh] bg-slate-50 dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-500/20">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Data Wrangling Studio</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                 <span>{selectedResources.length} resources selected</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
             <button 
                onClick={() => { setActiveTab('PIPELINE'); setViewMode('BUILD'); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'PIPELINE' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <Layers className="w-4 h-4" /> Pipeline
                {pipeline.length > 0 && <span className="bg-indigo-100 text-indigo-600 px-1.5 rounded-full text-[9px]">{pipeline.length}</span>}
             </button>
             <button 
                onClick={() => { setActiveTab('CLUSTERING'); setViewMode('BUILD'); }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'CLUSTERING' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <BarChart3 className="w-4 h-4" /> Analyze
             </button>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
             <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- BUILD MODE --- */}
        {viewMode === 'BUILD' && (
            <div className="flex-1 flex overflow-hidden animate-in fade-in duration-300">
                
                {/* LEFT COLUMN: Controls */}
                <div className="w-full md:w-[500px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                    
                    {/* CLUSTERING VIEW */}
                    {activeTab === 'CLUSTERING' && (
                        <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
                            <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-4 rounded-xl">
                                <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 mb-2 flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4" /> Smart Normalization
                                </h3>
                                <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                                    Identify inconsistent label values (e.g. <code>prod</code> vs <code>production</code>) and merge them into a single standard. 
                                    This creates rules in your pipeline automatically.
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Target Label Key</label>
                                <Select value={clusteringKey} onChange={e => setClusteringKey(e.target.value)} className="w-full">
                                    <option value="" disabled>Select a key...</option>
                                    {allKeys.map(k => <option key={k} value={k}>{k}</option>)}
                                </Select>
                            </div>

                            <div className="flex-1 min-h-0">
                                <ValueDistributionChart 
                                    resources={selectedResources} 
                                    targetKey={clusteringKey} 
                                    onMerge={handleNormalizationMerge}
                                />
                            </div>
                        </div>
                    )}

                    {/* PIPELINE VIEW */}
                    {activeTab === 'PIPELINE' && (
                        <div className="flex-1 flex flex-col">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/30 flex justify-between items-center">
                                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Active Operations</h3>
                                {pipeline.length > 0 && (
                                    <button onClick={() => setPipeline([])} className="text-[10px] text-red-500 hover:underline">Clear All</button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/20">
                                {pipeline.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                            <Plus className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <p className="text-sm font-medium">Pipeline is empty</p>
                                        <p className="text-xs mt-1">Add an operation below.</p>
                                    </div>
                                )}
                                
                                <AnimatePresence>
                                {pipeline.map((op, idx) => (
                                    <motion.div
                                        key={op.id}
                                        layout
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className={`relative bg-white dark:bg-slate-800/50 border rounded-xl shadow-sm transition-all group ${op.enabled ? 'border-slate-200 dark:border-slate-700' : 'opacity-60 border-slate-100 dark:border-slate-800'}`}
                                    >
                                        <div className="flex items-center gap-3 p-3 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl">
                                            <div className="flex flex-col items-center justify-center gap-1">
                                                <span className="text-[10px] font-mono text-slate-300 dark:text-slate-600 bg-slate-100 dark:bg-slate-900 w-5 h-5 flex items-center justify-center rounded-full">{idx + 1}</span>
                                                <ToggleSwitch checked={op.enabled} onChange={(v) => updateOperation(op.id, { enabled: v })} />
                                            </div>
                                            
                                            <div className="flex-1">
                                                <Badge variant="neutral" className="text-[9px] px-1.5 py-0.5 mb-1">
                                                    {OP_DESCRIPTIONS[op.type].label}
                                                </Badge>
                                                {/* Readable Summary */}
                                                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    {op.type === 'ADD' && `${op.config.key} : ${op.config.value}`}
                                                    {op.type === 'REMOVE' && `Delete "${op.config.key}"`}
                                                    {op.type === 'NORMALIZE_VALUES' && `Fix values for "${op.config.targetKey}"`}
                                                    {op.type === 'PATTERN' && `Split by "${op.config.delimiter}"`}
                                                    {op.type === 'CASE_TRANSFORM' && `${op.config.casing} keys/values`}
                                                    {op.type === 'REPLACE' && `Replace "${op.config.find}" with "${op.config.replace}"`}
                                                    {!['ADD','REMOVE','NORMALIZE_VALUES','PATTERN','CASE_TRANSFORM','REPLACE'].includes(op.type) && 'Configure below...'}
                                                </div>
                                            </div>

                                            <button onClick={() => removeOperation(op.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Config Body */}
                                        {op.enabled && (
                                            <div className="p-4 space-y-3">
                                                {op.type === 'ADD' && (
                                                    <div className="flex gap-3">
                                                        <Input placeholder="Key" value={op.config.key} onChange={e => updateConfig(op.id, 'key', e.target.value)} className="h-8 text-xs font-mono" />
                                                        <Input placeholder="Value" value={op.config.value} onChange={e => updateConfig(op.id, 'value', e.target.value)} className="h-8 text-xs font-mono" />
                                                    </div>
                                                )}
                                                {op.type === 'REMOVE' && (
                                                    <Input placeholder="Key to remove" value={op.config.key} onChange={e => updateConfig(op.id, 'key', e.target.value)} className="h-8 text-xs font-mono" />
                                                )}
                                                {op.type === 'REPLACE' && (
                                                    <div className="flex gap-3">
                                                        <Input placeholder="Find text" value={op.config.find} onChange={e => updateConfig(op.id, 'find', e.target.value)} className="h-8 text-xs font-mono" />
                                                        <Input placeholder="Replace with" value={op.config.replace} onChange={e => updateConfig(op.id, 'replace', e.target.value)} className="h-8 text-xs font-mono" />
                                                    </div>
                                                )}
                                                {op.type === 'CASE_TRANSFORM' && (
                                                    <Select value={op.config.casing} onChange={e => updateConfig(op.id, 'casing', e.target.value)} className="h-8 text-xs">
                                                        <option value="lowercase">Lowercase (recommended)</option>
                                                        <option value="uppercase">Uppercase</option>
                                                    </Select>
                                                )}
                                                {op.type === 'NORMALIZE_VALUES' && (
                                                    <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800 font-mono">
                                                        {Object.entries(op.config.valueMap || {}).map(([bad, good]) => (
                                                            <div key={bad} className="flex justify-between">
                                                                <span className="line-through opacity-50">{bad}</span>
                                                                <ArrowRight className="w-3 h-3 mx-1 inline opacity-50" />
                                                                <span className="text-emerald-600 font-bold">{good}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Pattern config logic would go here similar to Add/Remove */}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                                </AnimatePresence>
                            </div>

                            {/* Action Bar */}
                            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-2 gap-3">
                                <Button size="sm" variant="secondary" onClick={() => addOperation('ADD')} leftIcon={<Plus className="w-3 h-3"/>} className="justify-start">Add Label</Button>
                                <Button size="sm" variant="secondary" onClick={() => addOperation('CASE_TRANSFORM')} leftIcon={<RefreshCw className="w-3 h-3"/>} className="justify-start">Change Case</Button>
                                <Button size="sm" variant="secondary" onClick={() => addOperation('REPLACE')} leftIcon={<Replace className="w-3 h-3"/>} className="justify-start">Find Replace</Button>
                                <Button size="sm" variant="ghost" onClick={() => addOperation('REMOVE')} leftIcon={<Eraser className="w-3 h-3"/>} className="justify-start text-red-500">Remove Key</Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Live Preview (Always Visible) */}
                <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50">
                    <div className="h-12 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 bg-white dark:bg-slate-900 shrink-0">
                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Preview</span>
                        </div>
                        <div className="flex gap-4 text-xs">
                            <span className="text-emerald-600 font-medium">+{stats.adds} Adds</span>
                            <span className="text-amber-600 font-medium">~{stats.mods} Mods</span>
                            <span className="text-red-600 font-medium">-{stats.dels} Dels</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <div className="space-y-4">
                        {stats.totalResources === 0 && (
                            <div className="text-center text-slate-400 py-10">Select resources to see preview.</div>
                        )}
                        
                        {Array.from(previewData.entries()).map(([id, data]) => {
                            const resName = selectedResources.find(r => r.id === id)?.name || id;
                            const hasChanges = data.diff.length > 0;

                            if (!hasChanges) return null; // Only show changed items in focus view?

                            return (
                                <motion.div layoutId={id} key={id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{resName}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="p-3 bg-white dark:bg-slate-900">
                                        <div className="space-y-1.5">
                                            {data.diff.map((d, i) => (
                                                <div key={i} className={`flex items-center gap-2 text-xs p-1.5 rounded border ${d.type === 'ADD' ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-300' : d.type === 'REMOVE' ? 'bg-red-50 border-red-100 text-red-800 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-300' : 'bg-amber-50 border-amber-100 text-amber-800 dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-300'}`}>
                                                    {d.type === 'ADD' && <Plus className="w-3 h-3" />}
                                                    {d.type === 'REMOVE' && <Trash2 className="w-3 h-3" />}
                                                    {d.type === 'MODIFY' && <RefreshCw className="w-3 h-3" />}
                                                    
                                                    <span className="font-bold font-mono">{d.key}:</span>
                                                    
                                                    {d.type === 'MODIFY' ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="line-through opacity-50">{d.oldVal}</span>
                                                            <ArrowRight className="w-3 h-3 opacity-50" />
                                                            <span className="font-bold">{d.newVal}</span>
                                                        </div>
                                                    ) : d.type === 'REMOVE' ? (
                                                        <span className="line-through opacity-70">{d.oldVal}</span>
                                                    ) : (
                                                        <span className="font-bold">{d.newVal}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                        {stats.mods + stats.adds + stats.dels === 0 && (
                            <div className="text-center text-slate-400 py-10 italic">No changes generated yet.</div>
                        )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- REVIEW MODE --- */}
        {viewMode === 'REVIEW' && (
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 animate-in zoom-in-95 duration-300">
                <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="w-8 h-8" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ready to Apply?</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                        This operation will update <strong>{stats.totalResources} resources</strong>. A history snapshot will be created automatically.
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 mb-8 text-left">
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" /> Change Reason (Audit Log)
                        </label>
                        <Input 
                            value={changeReason}
                            onChange={e => setChangeReason(e.target.value)}
                            placeholder="e.g. Q3 Cost Center cleanup..."
                            className="bg-white dark:bg-slate-900"
                            autoFocus
                        />
                    </div>

                    <div className="flex items-center justify-center gap-4">
                        <Button variant="ghost" size="lg" onClick={() => setViewMode('BUILD')}>Back to Rules</Button>
                        <Button 
                            variant="primary" 
                            size="lg" 
                            className="px-8 shadow-xl shadow-emerald-500/30 bg-emerald-600 hover:bg-emerald-500"
                            onClick={handleApply}
                            disabled={!changeReason}
                        >
                            Confirm Update
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {/* Footer */}
        {viewMode === 'BUILD' && (
            <div className="h-20 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <InfoTip icon={Lightbulb}>
                        Tip: Use <strong>Analyze</strong> to find inconsistent values like 'prod' vs 'production'.
                    </InfoTip>
                </div>
                <div className="flex gap-4">
                    <Button variant="ghost" size="lg" onClick={onClose}>Cancel</Button>
                    <Button 
                        variant="primary" 
                        size="lg" 
                        onClick={() => setViewMode('REVIEW')}
                        disabled={stats.totalResources === 0 || (stats.adds === 0 && stats.mods === 0 && stats.dels === 0)}
                        className="shadow-xl shadow-indigo-500/20 px-8"
                        rightIcon={<ArrowRight className="w-5 h-5" />}
                    >
                        Review Changes
                    </Button>
                </div>
            </div>
        )}
      </motion.div>
    </div>
  );
};

const InfoTip = ({ icon: Icon, children }: any) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
     <Icon className="w-3.5 h-3.5 text-amber-500" />
     <span className="text-xs">{children}</span>
  </div>
);
