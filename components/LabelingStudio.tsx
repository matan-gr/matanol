
import React, { useState, useMemo, useEffect } from 'react';
import { GceResource } from '../types';
import { 
  Tag, Split, Eraser, ArrowRight, Save, X, 
  RefreshCw, Plus, Trash2, Regex as RegexIcon,
  Bot, Lightbulb, Check, Play, Layers,
  Replace, LayoutTemplate, Sparkles, AlertCircle,
  FileCode, SaveAll, Undo, ChevronRight, Eye, AlertTriangle,
  Scissors, Wand2, Loader2
} from 'lucide-react';
import { Button, Input, Select, Badge, Card, ToggleSwitch, Tooltip } from './DesignSystem';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { analyzeNamingPatterns } from '../services/geminiService';

// --- Types ---

type OperationType = 'ADD' | 'REMOVE' | 'REPLACE' | 'EXTRACT_REGEX' | 'PATTERN' | 'CASE_TRANSFORM';

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
    source?: 'name' | 'id'; 
    groups?: { index: number; targetKey: string }[]; // For Regex
    mappings?: { index: number; targetKey: string }[]; // For Pattern
    casing?: 'lowercase' | 'uppercase';
  };
  enabled: boolean;
}

interface LabelingStudioProps {
  isOpen: boolean;
  onClose: () => void;
  selectedResources: GceResource[];
  onApply: (updates: Map<string, Record<string, string>>) => void;
}

// --- Constants ---

const DEFAULT_OPERATIONS: Record<OperationType, LabelOperation> = {
  ADD: { id: '', type: 'ADD', config: { key: '', value: '' }, enabled: true },
  REMOVE: { id: '', type: 'REMOVE', config: { key: '' }, enabled: true },
  REPLACE: { id: '', type: 'REPLACE', config: { find: '', replace: '' }, enabled: true },
  EXTRACT_REGEX: { id: '', type: 'EXTRACT_REGEX', config: { regex: '^([a-z]+)-', groups: [{ index: 1, targetKey: 'env' }] }, enabled: true },
  PATTERN: { id: '', type: 'PATTERN', config: { delimiter: '-', mappings: [] }, enabled: true },
  CASE_TRANSFORM: { id: '', type: 'CASE_TRANSFORM', config: { casing: 'lowercase' }, enabled: true },
};

const MACROS = [
  { 
    name: "Standardize: Env & Owner", 
    ops: [
      { id: '1', type: 'ADD', config: { key: 'managed-by', value: 'yalla-label' }, enabled: true },
      { id: '2', type: 'PATTERN', config: { delimiter: '-', mappings: [{ index: 0, targetKey: 'env' }, { index: 1, targetKey: 'app' }] }, enabled: true }
    ] as LabelOperation[]
  },
  {
    name: "Cleanup: Remove Temp",
    ops: [
      { id: '1', type: 'REMOVE', config: { key: 'temp' }, enabled: true },
      { id: '2', type: 'REMOVE', config: { key: 'test-run' }, enabled: true }
    ] as LabelOperation[]
  }
];

const HELP_TEXTS = {
    ADD: "Adds a new label key-value pair. If the key exists, it will be overwritten.",
    REMOVE: "Removes a label if the key matches.",
    REPLACE: "Finds a specific label value across all keys and replaces it.",
    EXTRACT_REGEX: "Extracts parts of the resource Name using Regex capture groups.",
    PATTERN: "Splits the resource Name by a delimiter and maps position to label keys.",
    CASE_TRANSFORM: "Converts all label values to lowercase or uppercase for consistency.",
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
            if (currentLabels[k] === op.config.find) {
              currentLabels[k] = op.config.replace!;
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
    }
  });

  return currentLabels;
};

// --- Component ---

export const LabelingStudio: React.FC<LabelingStudioProps> = ({ 
  isOpen, onClose, selectedResources, onApply 
}) => {
  const [pipeline, setPipeline] = useState<LabelOperation[]>([]);
  const [viewMode, setViewMode] = useState<'BUILD' | 'REVIEW'>('BUILD');
  const [analyzingOpId, setAnalyzingOpId] = useState<string | null>(null);
  
  // Initialize
  useEffect(() => {
    if (isOpen && pipeline.length === 0) {
      addOperation('ADD');
    }
    if (!isOpen) {
        setViewMode('BUILD'); // Reset on close
    }
  }, [isOpen]);

  const addOperation = (type: OperationType) => {
    const newOp = { 
      ...DEFAULT_OPERATIONS[type], 
      id: Math.random().toString(36).substr(2, 9),
      config: JSON.parse(JSON.stringify(DEFAULT_OPERATIONS[type].config))
    };
    setPipeline(prev => [...prev, newOp]);
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

  const handleAutoDetect = async (opId: string) => {
    if (selectedResources.length === 0) return;
    setAnalyzingOpId(opId);
    
    try {
        if ((window as any).aistudio) {
             const hasKey = await (window as any).aistudio.hasSelectedApiKey();
             if (!hasKey) {
                 await (window as any).aistudio.openSelectKey();
             }
        }

        const names = selectedResources.slice(0, 20).map(r => r.name);
        const result = await analyzeNamingPatterns(names);

        if (result.suggestedMode === 'PATTERN' && result.config?.delimiter) {
            updateConfig(opId, 'delimiter', result.config.delimiter);
            
            if (result.config.mappings && Array.isArray(result.config.mappings)) {
                const mapped = result.config.mappings.map((m: any) => ({
                    index: m.position,
                    targetKey: m.key
                }));
                updateConfig(opId, 'mappings', mapped);
            }
        }
    } catch (error) {
        console.error("Auto-detect failed", error);
    } finally {
        setAnalyzingOpId(null);
    }
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
    onApply(updates);
    onClose();
  };

  const sampleResource = selectedResources[0];

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
        <div className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Labeling Studio</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                 <span>Batch Processor</span>
                 <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                 <span>{selectedResources.length} resources selected</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {viewMode === 'BUILD' && (
                <div className="hidden md:flex items-center gap-2 mr-4 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg">
                    <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Macros</span>
                    {MACROS.map((m, i) => (
                    <button 
                        key={i} 
                        onClick={() => setPipeline([...pipeline, ...m.ops.map(o => ({...o, id: Math.random().toString(36)}))])}
                        className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors"
                    >
                        {m.name}
                    </button>
                    ))}
                </div>
             )}
             <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
               <X className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* --- BUILD MODE --- */}
        {viewMode === 'BUILD' && (
            <div className="flex-1 flex overflow-hidden animate-in fade-in duration-300">
                
                {/* LEFT: Rule Builder */}
                <div className="w-full md:w-[480px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/30 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4"/> Operations
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/20">
                        {pipeline.length === 0 && (
                        <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No rules defined.</p>
                            <p className="text-xs mt-1">Add an operation to start.</p>
                        </div>
                        )}
                        
                        <AnimatePresence>
                        {pipeline.map((op, idx) => (
                            <motion.div
                            key={op.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`relative bg-white dark:bg-slate-800/50 border rounded-xl shadow-sm transition-all group hover:shadow-md ${op.enabled ? 'border-slate-200 dark:border-slate-700' : 'opacity-60 border-slate-100 dark:border-slate-800'}`}
                            >
                            {/* Operation Header */}
                            <div className="flex items-center gap-3 p-3 border-b border-slate-100 dark:border-slate-700/50">
                                <div className="flex flex-col items-center justify-center gap-1">
                                    <span className="text-[10px] font-mono text-slate-300 dark:text-slate-600">{idx + 1}</span>
                                    <ToggleSwitch checked={op.enabled} onChange={(v) => updateOperation(op.id, { enabled: v })} />
                                </div>
                                
                                <div className="flex-1">
                                    <select 
                                        value={op.type} 
                                        onChange={(e) => updateOperation(op.id, { type: e.target.value as OperationType, config: { ...DEFAULT_OPERATIONS[e.target.value as OperationType].config } })}
                                        className="w-full bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                                    >
                                        <option value="ADD">Add Label</option>
                                        <option value="REMOVE">Remove Label</option>
                                        <option value="REPLACE">Normalize Value</option>
                                        <option value="PATTERN">Pattern Split</option>
                                        <option value="EXTRACT_REGEX">Extract (Regex)</option>
                                        <option value="CASE_TRANSFORM">Change Casing</option>
                                    </select>
                                </div>

                                <button onClick={() => removeOperation(op.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Config Body */}
                            {op.enabled && (
                                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 text-sm space-y-3">
                                    {op.type === 'ADD' && (
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Key</label>
                                            <Input placeholder="e.g. environment" value={op.config.key} onChange={e => updateConfig(op.id, 'key', e.target.value)} className="h-8 text-xs font-mono" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Value</label>
                                            <Input placeholder="e.g. production" value={op.config.value} onChange={e => updateConfig(op.id, 'value', e.target.value)} className="h-8 text-xs font-mono" />
                                        </div>
                                    </div>
                                    )}
                                    {op.type === 'REMOVE' && (
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Target Key</label>
                                        <Input placeholder="e.g. temp-id" value={op.config.key} onChange={e => updateConfig(op.id, 'key', e.target.value)} className="h-8 text-xs font-mono border-red-200 focus:border-red-500" />
                                    </div>
                                    )}
                                    {op.type === 'REPLACE' && (
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Find</label>
                                            <Input placeholder="old-val" value={op.config.find} onChange={e => updateConfig(op.id, 'find', e.target.value)} className="h-8 text-xs font-mono" />
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-400 mb-2" />
                                        <div className="flex-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Replace</label>
                                            <Input placeholder="new-val" value={op.config.replace} onChange={e => updateConfig(op.id, 'replace', e.target.value)} className="h-8 text-xs font-mono" />
                                        </div>
                                    </div>
                                    )}
                                    {op.type === 'PATTERN' && (
                                      <div className="space-y-4">
                                         <div>
                                           <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex justify-between items-center">
                                              Delimiter
                                              <span className="text-[9px] text-indigo-500">Auto-Detect available</span>
                                           </label>
                                           <div className="flex gap-2">
                                             {['-', '_', '.', '/'].map(char => (
                                               <button
                                                 key={char}
                                                 onClick={() => updateConfig(op.id, 'delimiter', char)}
                                                 className={`w-8 h-8 rounded border flex items-center justify-center font-mono text-sm transition-colors
                                                   ${op.config.delimiter === char ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                               >
                                                 {char}
                                               </button>
                                             ))}
                                             <Input 
                                               className="w-12 h-8 text-center font-mono" 
                                               placeholder="Char" 
                                               value={op.config.delimiter} 
                                               onChange={e => updateConfig(op.id, 'delimiter', e.target.value)} 
                                               maxLength={1}
                                             />
                                             <Button 
                                                size="xs" 
                                                variant="ghost" 
                                                onClick={() => handleAutoDetect(op.id)}
                                                disabled={!!analyzingOpId}
                                                className="h-8 px-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800"
                                                title="AI Auto-Detect Pattern"
                                             >
                                                {analyzingOpId === op.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                             </Button>
                                           </div>
                                         </div>

                                         {sampleResource && op.config.delimiter && (
                                           <div className="bg-slate-100 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                                              <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1">
                                                <Eye className="w-3 h-3" /> Token Preview: <span className="text-slate-600 dark:text-slate-300 normal-case ml-1 font-mono">{sampleResource.name}</span>
                                              </div>
                                              <div className="flex items-start gap-3 pb-2">
                                                 {sampleResource.name.split(op.config.delimiter).map((token, idx) => {
                                                    const mapping = op.config.mappings?.find(m => m.index === idx);
                                                    const assignedKey = mapping?.targetKey || '';
                                                    
                                                    return (
                                                      <div key={idx} className="flex flex-col gap-2 min-w-[80px]">
                                                         <Tooltip content={`Value: ${token}`} placement="top">
                                                            <div className={`
                                                               px-2 py-1.5 rounded-md text-xs font-mono text-center border truncate transition-colors duration-200
                                                               ${assignedKey 
                                                                 ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-sm' 
                                                                 : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}
                                                            `}>
                                                               {token}
                                                            </div>
                                                         </Tooltip>
                                                         <div className="relative group/line flex flex-col items-center">
                                                            <div className={`w-px h-3 mb-1 transition-colors ${assignedKey ? 'bg-blue-300 dark:bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                                            <Input 
                                                               placeholder="Key..." 
                                                               value={assignedKey}
                                                               className={`h-6 text-[10px] text-center px-1 ${assignedKey ? 'border-blue-300 focus:border-blue-500 bg-blue-50 dark:bg-blue-900/10' : ''}`}
                                                               onChange={(e) => {
                                                                  const val = e.target.value;
                                                                  const newMappings = op.config.mappings?.filter(m => m.index !== idx) || [];
                                                                  if (val) newMappings.push({ index: idx, targetKey: val });
                                                                  updateConfig(op.id, 'mappings', newMappings);
                                                               }}
                                                            />
                                                         </div>
                                                      </div>
                                                    );
                                                 })}
                                              </div>
                                           </div>
                                         )}
                                      </div>
                                    )}
                                    {op.type === 'EXTRACT_REGEX' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Regex Pattern</label>
                                            <Input placeholder="^([a-z]+)-" value={op.config.regex} onChange={e => updateConfig(op.id, 'regex', e.target.value)} className="h-8 text-xs font-mono text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-800/30">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Group 1 Map</span>
                                                <ArrowRight className="w-3 h-3 text-blue-400" />
                                                <Input placeholder="Target Key (e.g. env)" value={op.config.groups?.[0].targetKey} onChange={e => {
                                                    const groups = [...(op.config.groups || [])];
                                                    if(groups[0]) groups[0].targetKey = e.target.value;
                                                    updateConfig(op.id, 'groups', groups);
                                                }} className="h-7 text-xs font-mono w-full" />
                                            </div>
                                        </div>
                                    </div>
                                    )}
                                    {op.type === 'CASE_TRANSFORM' && (
                                    <div className="flex gap-2">
                                        <button onClick={() => updateConfig(op.id, 'casing', 'lowercase')} className={`flex-1 py-1 text-xs border rounded ${op.config.casing === 'lowercase' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-200'}`}>lowercase</button>
                                        <button onClick={() => updateConfig(op.id, 'casing', 'uppercase')} className={`flex-1 py-1 text-xs border rounded ${op.config.casing === 'uppercase' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-200'}`}>UPPERCASE</button>
                                    </div>
                                    )}
                                    
                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                                        <div className="flex items-start gap-2 text-[10px] text-slate-500">
                                            <Lightbulb className="w-3 h-3 mt-0.5 text-amber-500" />
                                            <span>{HELP_TEXTS[op.type]}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            </motion.div>
                        ))}
                        </AnimatePresence>
                    </div>

                    {/* Add Button Area */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-2 gap-2">
                        <Button size="sm" variant="secondary" onClick={() => addOperation('ADD')} leftIcon={<Plus className="w-3 h-3"/>}>Add Label</Button>
                        <Button size="sm" variant="secondary" onClick={() => addOperation('PATTERN')} leftIcon={<Scissors className="w-3 h-3"/>}>Split Pattern</Button>
                        <Button size="sm" variant="secondary" onClick={() => addOperation('REPLACE')} leftIcon={<Replace className="w-3 h-3"/>}>Normalize</Button>
                        <Button size="sm" variant="secondary" onClick={() => addOperation('REMOVE')} leftIcon={<Eraser className="w-3 h-3"/>} className="text-red-600 hover:bg-red-50">Cleanup</Button>
                    </div>
                </div>

                {/* RIGHT: Live Preview */}
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
                            return (
                                <motion.div layoutId={id} key={id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{resName}</span>
                                            {selectedResources.find(r => r.id === id)?.type === 'INSTANCE' && <Badge variant="info" className="px-1 py-0 text-[9px]">VM</Badge>}
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-400">{id}</span>
                                    </div>
                                    <div className="p-3 flex items-start gap-4 text-xs">
                                        {/* Before */}
                                        <div className="flex-1 space-y-1">
                                            <div className="text-[10px] uppercase font-bold text-slate-300 mb-1">Before</div>
                                            {Object.keys(data.original).length === 0 && <span className="text-slate-300 italic">No labels</span>}
                                            {Object.entries(data.original).map(([k, v]) => (
                                                <div key={k} className="flex gap-1 font-mono text-slate-500">
                                                    <span>{k}:</span><span className="text-slate-700 dark:text-slate-400">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="self-stretch w-px bg-slate-100 dark:bg-slate-800"></div>

                                        {/* Diff View */}
                                        <div className="flex-[1.5] space-y-1">
                                            <div className="text-[10px] uppercase font-bold text-slate-300 mb-1">Pending Changes</div>
                                            {data.diff.map((d, i) => (
                                                <div key={i} className={`flex items-center gap-2 p-1 rounded font-mono ${d.type === 'ADD' ? 'bg-emerald-50 dark:bg-emerald-900/20' : d.type === 'REMOVE' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                                                    {d.type === 'ADD' && <Plus className="w-3 h-3 text-emerald-500" />}
                                                    {d.type === 'REMOVE' && <Trash2 className="w-3 h-3 text-red-500" />}
                                                    {d.type === 'MODIFY' && <RefreshCw className="w-3 h-3 text-amber-500" />}
                                                    
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{d.key}:</span>
                                                    
                                                    {d.type === 'MODIFY' ? (
                                                        <span className="flex items-center gap-1">
                                                            <span className="line-through opacity-50">{d.oldVal}</span>
                                                            <ArrowRight className="w-3 h-3 opacity-50" />
                                                            <span className="font-bold">{d.newVal}</span>
                                                        </span>
                                                    ) : d.type === 'REMOVE' ? (
                                                        <span className="line-through opacity-50">{d.oldVal}</span>
                                                    ) : (
                                                        <span className="font-bold">{d.newVal}</span>
                                                    )}
                                                </div>
                                            ))}
                                            {data.diff.length === 0 && <span className="text-slate-300 italic">No changes</span>}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- REVIEW MODE --- */}
        {viewMode === 'REVIEW' && (
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 animate-in zoom-in-95 duration-300">
                <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <SaveAll className="w-8 h-8" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Confirm Label Updates</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
                        You are about to update <strong>{stats.totalResources} resources</strong>. 
                        This action will be recorded in the audit logs.
                    </p>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.adds}</div>
                            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-500 uppercase tracking-wider">Additions</div>
                        </div>
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.mods}</div>
                            <div className="text-xs font-bold text-amber-800 dark:text-amber-500 uppercase tracking-wider">Modifications</div>
                        </div>
                        <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.dels}</div>
                            <div className="text-xs font-bold text-red-800 dark:text-red-500 uppercase tracking-wider">Deletions</div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                        <Button variant="ghost" size="lg" onClick={() => setViewMode('BUILD')} leftIcon={<Undo className="w-4 h-4"/>}>Back to Edit</Button>
                        <Button 
                            variant="primary" 
                            size="lg" 
                            className="px-8 shadow-xl shadow-indigo-500/30"
                            onClick={handleApply}
                            leftIcon={<Check className="w-5 h-5"/>}
                        >
                            Commit Changes
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
                        Tip: Drag operations to reorder execution priority.
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
