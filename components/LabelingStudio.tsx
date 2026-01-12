
import React, { useState, useMemo, useEffect } from 'react';
import { GceResource } from '../types';
import { LABEL_TEMPLATES } from '../constants';
import { analyzeNamingPatterns } from '../services/geminiService';
import { 
  Tag, Split, Eraser, ArrowRight, Save, X, 
  RefreshCw, Wand2, Plus, Trash2, Regex as RegexIcon,
  Bot, Lightbulb, Check, ChevronRight, AlertTriangle, Code,
  LayoutTemplate, CheckCircle2, AlertOctagon, HelpCircle,
  Replace
} from 'lucide-react';
import { Button, Input, Select, Badge, Card, ToggleSwitch, Modal } from './DesignSystem';
import { validateKey, validateValue } from '../utils/validation';

const MODE_INSTRUCTIONS: Record<string, string> = {
  STATIC: "Apply standardized labels to all selected resources. Define key-value pairs (e.g., 'cost-center: cc-123') that will be added or overwritten.",
  PATTERN: "Split resource names by a delimiter (e.g., '-') to extract dynamic values. Map each segment position to a label key.",
  REGEX: "Use regular expressions for advanced extraction. Define a pattern with capture groups (...) and assign a label key to each group index.",
  NORMALIZATION: "Standardize label values across your fleet. Define mapping rules (e.g., 'prod' -> 'production') to automatically update any label matching the criteria.",
  CLEANUP: "Bulk remove labels by key. Select existing keys found on resources or enter manually. This operation cannot be undone."
};

// Color Palette for Token Mapping Visualization
const MAPPING_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800',
  'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800',
  'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800',
  'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
  'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/40 dark:text-pink-200 dark:border-pink-800',
  'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-200 dark:border-cyan-800',
];

interface LabelingStudioProps {
  isOpen: boolean;
  onClose: () => void;
  selectedResources: GceResource[];
  onApply: (updates: Map<string, Record<string, string>>) => void;
}

type Mode = 'STATIC' | 'PATTERN' | 'REGEX' | 'NORMALIZATION' | 'CLEANUP';

export const LabelingStudio: React.FC<LabelingStudioProps> = ({ 
  isOpen, 
  onClose, 
  selectedResources, 
  onApply 
}) => {
  const [mode, setMode] = useState<Mode>('STATIC');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  
  // Static Mode State
  const [staticLabels, setStaticLabels] = useState<{key: string, value: string}[]>([{key: '', value: ''}]);
  
  // Pattern Mode State
  const [delimiter, setDelimiter] = useState('-');
  const [mappings, setMappings] = useState<{position: number, key: string}[]>([{position: 0, key: ''}]);
  
  // Regex Mode State
  const [regexPattern, setRegexPattern] = useState('^([a-z]+)-([a-z]+)-(\\d+)$');
  const [regexGroups, setRegexGroups] = useState<{index: number, key: string}[]>([{index: 1, key: 'env'}, {index: 2, key: 'app'}]);

  // Normalization Mode State
  const [normalizationRules, setNormalizationRules] = useState<{from: string, to: string}[]>([{from: '', to: ''}]);

  // Cleanup Mode State
  const [keysToRemove, setKeysToRemove] = useState<string[]>(['']);

  // Derived for Pattern Preview
  const sampleName = selectedResources[0]?.name || '';
  const sampleTokens = useMemo(() => sampleName.split(delimiter), [sampleName, delimiter]);

  // Derived for Cleanup Mode (Auto-suggest keys)
  const availableKeysToRemove = useMemo(() => {
     const keys = new Set<string>();
     selectedResources.forEach(r => Object.keys(r.labels).forEach(k => keys.add(k)));
     return Array.from(keys).sort();
  }, [selectedResources]);

  // Helper to find mapping for a specific index
  const getMappingForIndex = (index: number) => mappings.find(m => m.position === index);

  // Get color for a mapping index
  const getMappingColor = (index: number) => {
     // Find which mapping entry this index corresponds to, to assign consistent color based on list order
     const mappingIdx = mappings.findIndex(m => m.position === index);
     if (mappingIdx === -1) return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'; // Default gray
     return MAPPING_COLORS[mappingIdx % MAPPING_COLORS.length];
  };

  // --- Logic ---

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const names = selectedResources.map(r => r.name);
      const result = await analyzeNamingPatterns(names);
      
      setAiAdvice(result.advice);
      if (result.suggestedMode) {
        setMode(result.suggestedMode as Mode);
      }
      
      // Apply Configuration Safely
      if (result.suggestedMode === 'PATTERN' && result.config) {
        if (result.config.delimiter) {
            setDelimiter(result.config.delimiter);
        }
        if (Array.isArray(result.config.mappings) && result.config.mappings.length > 0) {
          setMappings(result.config.mappings);
        }
      } else if (result.suggestedMode === 'REGEX' && result.config) {
        if (result.config.regex) setRegexPattern(result.config.regex);
        if (Array.isArray(result.config.groups) && result.config.groups.length > 0) {
          setRegexGroups(result.config.groups);
        }
      }
    } catch (error) {
      setAiAdvice("Failed to analyze patterns. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addTemplateToStatic = (templateString: string) => {
    if(!templateString) return;
    const [k, v] = templateString.split('::');
    const exists = staticLabels.some(l => l.key === k);
    if(exists) {
        setStaticLabels(prev => prev.map(l => l.key === k ? { ...l, value: v } : l));
    } else {
        setStaticLabels(prev => {
           const last = prev[prev.length - 1];
           if (last && last.key === '' && last.value === '') return [...prev.slice(0, -1), { key: k, value: v }];
           return [...prev, { key: k, value: v }];
        });
    }
  };

  const addKeyToRemove = (key: string) => {
      setKeysToRemove(prev => {
          if (prev.includes(key)) return prev;
          // Filter out empty entries to keep list clean
          const cleaned = prev.filter(k => k.trim() !== '');
          return [...cleaned, key];
      });
  };

  const updateMappingPosition = (idx: number, newPos: number) => {
     // Ensure newPos is valid
     if (newPos < 0) return;
     setMappings(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], position: newPos };
        // Sort by position to keep list ordered
        return next.sort((a,b) => a.position - b.position);
     });
  };

  // Preview Calculation
  const previewData = useMemo(() => {
    const updates = new Map<string, { original: Record<string, string>, new: Record<string, string>, changes: string[] }>();
    let regex: RegExp | null = null;
    
    if (mode === 'REGEX') {
        try { regex = new RegExp(regexPattern); } catch (e) { regex = null; }
    }

    selectedResources.forEach(r => {
      let newLabels = { ...r.labels };
      const changes: string[] = [];

      if (mode === 'STATIC') {
        staticLabels.forEach(({key, value}) => {
          if (key && value) {
            if (newLabels[key] !== value) changes.push(`Set ${key}=${value}`);
            newLabels[key] = value;
          }
        });
      } 
      else if (mode === 'PATTERN') {
        const parts = r.name.split(delimiter);
        mappings.forEach(({position, key}) => {
          if (key && parts[position]) {
            const val = parts[position];
            if (newLabels[key] !== val) changes.push(`Extracted ${key}=${val}`);
            newLabels[key] = val;
          }
        });
      }
      else if (mode === 'REGEX' && regex) {
        const match = r.name.match(regex);
        if (match) {
            regexGroups.forEach(({index, key}) => {
                if (key && match[index]) {
                    const val = match[index];
                    if (newLabels[key] !== val) changes.push(`Regex ${key}=${val}`);
                    newLabels[key] = val;
                }
            });
        }
      }
      else if (mode === 'NORMALIZATION') {
        Object.entries(newLabels).forEach(([key, value]) => {
           const rule = normalizationRules.find(rule => rule.from === value);
           if (rule && rule.to && value !== rule.to) {
              changes.push(`Normalized ${key}: '${value}' -> '${rule.to}'`);
              newLabels[key] = rule.to;
           }
        });
      }
      else if (mode === 'CLEANUP') {
        keysToRemove.forEach(k => {
            if (k && newLabels[k] !== undefined) {
                changes.push(`Removed ${k}`);
                delete newLabels[k];
            }
        });
      }

      if (changes.length > 0) {
        updates.set(r.id, { original: r.labels, new: newLabels, changes });
      }
    });
    
    return updates;
  }, [selectedResources, mode, staticLabels, delimiter, mappings, regexPattern, regexGroups, normalizationRules, keysToRemove]);

  const handleApply = () => {
     const updates = new Map<string, Record<string, string>>();
     previewData.forEach((val, key) => {
         updates.set(key, val.new);
     });
     onApply(updates);
     onClose();
  };

  // Determine if config is valid to allow apply
  const isValid = useMemo(() => {
    if (mode === 'STATIC') return staticLabels.some(l => l.key && l.value);
    if (mode === 'PATTERN') return mappings.some(m => m.key);
    if (mode === 'REGEX') return regexGroups.some(g => g.key);
    if (mode === 'NORMALIZATION') return normalizationRules.some(r => r.from && r.to);
    if (mode === 'CLEANUP') return keysToRemove.some(k => k);
    return false;
  }, [mode, staticLabels, mappings, regexGroups, normalizationRules, keysToRemove]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Labeling Studio"
    >
      <div className="space-y-6">
         {/* 1. Mode Selector */}
         <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
            {(['STATIC', 'PATTERN', 'REGEX', 'NORMALIZATION', 'CLEANUP'] as Mode[]).map(m => (
               <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 min-w-[80px] py-2 text-[10px] sm:text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${mode === m ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}
               >
                  {m === 'STATIC' && <Tag className="w-3 h-3" />}
                  {m === 'PATTERN' && <Split className="w-3 h-3" />}
                  {m === 'REGEX' && <RegexIcon className="w-3 h-3" />}
                  {m === 'NORMALIZATION' && <Replace className="w-3 h-3" />}
                  {m === 'CLEANUP' && <Eraser className="w-3 h-3" />}
                  <span className="hidden sm:inline">{m === 'NORMALIZATION' ? 'NORMALIZE' : m}</span>
                  <span className="sm:hidden">{m === 'NORMALIZATION' ? 'NORM' : m.slice(0,4)}</span>
               </button>
            ))}
         </div>

         {/* 2. AI Assistant (For Pattern/Regex) */}
         {(mode === 'PATTERN' || mode === 'REGEX') && (
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10 rounded-xl p-4 border border-violet-100 dark:border-violet-900/20 relative overflow-hidden">
               <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3">
                     <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                        <Wand2 className="w-5 h-5 text-violet-500" />
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">AI Pattern Detector</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Let Gemini analyze your resource names to detect naming conventions.</p>
                     </div>
                  </div>
                  <Button 
                     size="sm" 
                     variant="primary" 
                     className="bg-violet-600 hover:bg-violet-700 text-white" 
                     onClick={handleAiAnalysis} 
                     isLoading={isAnalyzing}
                     leftIcon={<Bot className="w-4 h-4"/>}
                  >
                     Analyze Names
                  </Button>
               </div>
               {aiAdvice && (
                  <div className="mt-3 pt-3 border-t border-violet-200 dark:border-violet-800 flex gap-2 animate-in fade-in slide-in-from-top-1">
                     <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                     <p className="text-xs text-slate-700 dark:text-slate-300 italic">"{aiAdvice}"</p>
                  </div>
               )}
            </div>
         )}

         {/* 3. Configuration Form */}
         <Card className="bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800">
             <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                 <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                     <Code className="w-4 h-4" /> Configuration
                 </h4>
                 <div className="text-[10px] text-slate-500 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 hidden sm:block">
                    {MODE_INSTRUCTIONS[mode].split('.')[0]}.
                 </div>
             </div>
             
             <div className="p-5">
                {/* STATIC CONFIG */}
                {mode === 'STATIC' && (
                    <div className="space-y-3">
                        {staticLabels.map((l, idx) => (
                           <div key={idx} className="flex gap-2 items-center">
                              <Input placeholder="Key" value={l.key} onChange={e => { const n = [...staticLabels]; n[idx].key = e.target.value; setStaticLabels(n); }} className="font-mono text-xs" />
                              <span className="text-slate-400">=</span>
                              <Input placeholder="Value" value={l.value} onChange={e => { const n = [...staticLabels]; n[idx].value = e.target.value; setStaticLabels(n); }} className="font-mono text-xs" />
                              <button onClick={() => setStaticLabels(p => p.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                           </div>
                        ))}
                        <div className="flex gap-2">
                           <Button size="xs" variant="ghost" onClick={() => setStaticLabels(p => [...p, {key:'', value:''}])} leftIcon={<Plus className="w-3 h-3"/>}>Add Field</Button>
                           <Select className="w-32 h-7 py-1 text-xs" onChange={(e) => { addTemplateToStatic(e.target.value); e.target.value=''; }}>
                               <option value="">Templates...</option>
                               {LABEL_TEMPLATES.map(t => <option key={t.key} value={`${t.key}::${t.value}`}>{t.label}</option>)}
                           </Select>
                        </div>
                    </div>
                )}

                {/* PATTERN CONFIG */}
                {mode === 'PATTERN' && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                           <div className="w-32">
                              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Delimiter</label>
                              <Input value={delimiter} onChange={e => setDelimiter(e.target.value)} className="font-mono text-center font-bold" />
                           </div>
                           <div className="flex-1 bg-slate-100 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                              <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Preview Tokenization</label>
                              <div className="flex gap-1.5 pb-1">
                                 {sampleTokens.map((token, idx) => {
                                    const mapping = getMappingForIndex(idx);
                                    return (
                                        <div key={idx} className={`px-2 py-1.5 rounded text-xs font-mono border flex flex-col items-center min-w-[40px] transition-colors ${getMappingColor(idx)}`}>
                                            <span className="opacity-50 text-[9px] block mb-0.5">#{idx}</span>
                                            <span className="font-bold">{token}</span>
                                            {mapping && mapping.key && (
                                                <div className="mt-1.5 pt-1 border-t border-current w-full text-center opacity-90 text-[9px] font-bold truncate max-w-[80px]">
                                                    {mapping.key}
                                                </div>
                                            )}
                                        </div>
                                    )
                                 })}
                              </div>
                           </div>
                        </div>
                        
                        <div className="space-y-2">
                           <label className="text-[10px] uppercase font-bold text-slate-500 block">Mapping Rules</label>
                           {mappings.map((m, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                 <span className="text-xs text-slate-500 font-mono w-8">Pos:</span>
                                 <Input 
                                    type="number" 
                                    value={m.position} 
                                    onChange={e => updateMappingPosition(idx, parseInt(e.target.value))} 
                                    className="w-16 text-center font-mono text-xs" 
                                 />
                                 <ArrowRight className="w-3 h-3 text-slate-400" />
                                 <Input 
                                    placeholder="Target Label Key (e.g. environment)" 
                                    value={m.key} 
                                    onChange={e => { const n = [...mappings]; n[idx].key = e.target.value; setMappings(n); }} 
                                    className={`flex-1 font-mono text-xs ${getMappingColor(m.position)}`}
                                 />
                                 <button onClick={() => setMappings(p => p.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                              </div>
                           ))}
                           <Button size="xs" variant="ghost" onClick={() => setMappings(p => [...p, {position: p.length, key: ''}])} leftIcon={<Plus className="w-3 h-3"/>}>Add Mapping</Button>
                        </div>
                    </div>
                )}

                {/* REGEX CONFIG */}
                {mode === 'REGEX' && (
                    <div className="space-y-4">
                        <div>
                           <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Regex Pattern</label>
                           <Input 
                              value={regexPattern} 
                              onChange={e => setRegexPattern(e.target.value)} 
                              className="font-mono text-sm tracking-wide bg-slate-100 dark:bg-slate-900" 
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] uppercase font-bold text-slate-500 block">Capture Groups</label>
                           {regexGroups.map((g, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                 <span className="text-xs text-slate-500 font-mono w-12">Group:</span>
                                 <Input 
                                    type="number" 
                                    value={g.index} 
                                    onChange={e => { const n = [...regexGroups]; n[idx].index = parseInt(e.target.value); setRegexGroups(n); }} 
                                    className="w-16 text-center font-mono text-xs" 
                                 />
                                 <ArrowRight className="w-3 h-3 text-slate-400" />
                                 <Input 
                                    placeholder="Label Key" 
                                    value={g.key} 
                                    onChange={e => { const n = [...regexGroups]; n[idx].key = e.target.value; setRegexGroups(n); }} 
                                    className="flex-1 font-mono text-xs"
                                 />
                                 <button onClick={() => setRegexGroups(p => p.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                              </div>
                           ))}
                           <Button size="xs" variant="ghost" onClick={() => setRegexGroups(p => [...p, {index: p.length + 1, key: ''}])} leftIcon={<Plus className="w-3 h-3"/>}>Add Group</Button>
                        </div>
                    </div>
                )}

                {/* NORMALIZATION CONFIG */}
                {mode === 'NORMALIZATION' && (
                    <div className="space-y-3">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-start gap-3 text-sm text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                           <Replace className="w-5 h-5 shrink-0 mt-0.5" />
                           <p>Value Replacement Rules: If any label has the value in the <strong>From</strong> field, it will be updated to the <strong>To</strong> field.</p>
                        </div>
                        {normalizationRules.map((rule, idx) => (
                           <div key={idx} className="flex gap-2 items-center">
                              <Input 
                                 placeholder="From (e.g. 'prod')" 
                                 value={rule.from} 
                                 onChange={e => { const n = [...normalizationRules]; n[idx].from = e.target.value; setNormalizationRules(n); }} 
                                 className="font-mono text-xs"
                              />
                              <ArrowRight className="w-4 h-4 text-slate-400" />
                              <Input 
                                 placeholder="To (e.g. 'production')" 
                                 value={rule.to} 
                                 onChange={e => { const n = [...normalizationRules]; n[idx].to = e.target.value; setNormalizationRules(n); }} 
                                 className="font-mono text-xs" 
                              />
                              <button onClick={() => setNormalizationRules(p => p.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                           </div>
                        ))}
                        <Button size="xs" variant="ghost" onClick={() => setNormalizationRules(p => [...p, {from: '', to: ''}])} leftIcon={<Plus className="w-3 h-3"/>}>Add Rule</Button>
                    </div>
                )}

                {/* CLEANUP CONFIG */}
                {mode === 'CLEANUP' && (
                    <div className="space-y-4">
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg flex items-center gap-3 text-sm text-red-800 dark:text-red-300 border border-red-100 dark:border-red-900/30">
                           <AlertTriangle className="w-5 h-5" />
                           <span>Warning: Labels listed below will be permanently removed from all {selectedResources.length} selected resources.</span>
                        </div>
                        
                        {/* Quick Select Chips */}
                        <div>
                           <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block tracking-wider">Quick Select Existing Keys</label>
                           <div className="flex flex-wrap gap-2 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 max-h-32 overflow-y-auto custom-scrollbar">
                              {availableKeysToRemove.length === 0 && <span className="text-xs text-slate-400 italic">No labels found on selected resources.</span>}
                              {availableKeysToRemove.map(k => (
                                 <button 
                                    key={k}
                                    onClick={() => {
                                        if(!keysToRemove.includes(k)) {
                                            setKeysToRemove(prev => [...prev.filter(i => i.trim() !== ''), k]);
                                        }
                                    }}
                                    disabled={keysToRemove.includes(k)}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                        keysToRemove.includes(k) 
                                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 border-transparent cursor-not-allowed line-through decoration-red-500' 
                                        : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                    }`}
                                 >
                                    {k}
                                 </button>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-2">
                           <label className="text-[10px] uppercase font-bold text-slate-500 block">Keys to Remove</label>
                           {keysToRemove.map((k, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                 <Input 
                                    placeholder="Label Key to Remove" 
                                    value={k} 
                                    onChange={e => { const n = [...keysToRemove]; n[idx] = e.target.value; setKeysToRemove(n); }} 
                                    className="font-mono text-xs border-red-200 focus:border-red-500 focus:ring-red-500/20" 
                                 />
                                 <button onClick={() => setKeysToRemove(p => p.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                              </div>
                           ))}
                           <Button size="xs" variant="ghost" onClick={() => setKeysToRemove(p => [...p, ''])} leftIcon={<Plus className="w-3 h-3"/>}>Add Key</Button>
                        </div>
                    </div>
                )}
             </div>
         </Card>

         {/* 4. Live Preview */}
         <div className="space-y-2">
            <div className="flex justify-between items-center">
               <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                  Preview Changes ({previewData.size} resources affected)
               </h4>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden max-h-60 overflow-y-auto">
               <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold uppercase sticky top-0">
                     <tr>
                        <th className="px-4 py-2 w-1/3">Resource</th>
                        <th className="px-4 py-2">Planned Changes</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                     {selectedResources.slice(0, 10).map(r => {
                        const change = previewData.get(r.id);
                        return (
                           <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-2 font-mono text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={r.name}>
                                 {r.name}
                              </td>
                              <td className="px-4 py-2">
                                 {change ? (
                                    <div className="flex flex-col gap-1">
                                       {change.changes.map((c, i) => (
                                          <div key={i} className={`flex items-center gap-1 ${mode === 'CLEANUP' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                             {mode === 'CLEANUP' ? <Eraser className="w-3 h-3" /> : <Plus className="w-3 h-3" />} {c}
                                          </div>
                                       ))}
                                    </div>
                                 ) : (
                                    <span className="text-slate-400 italic">No changes</span>
                                 )}
                              </td>
                           </tr>
                        )
                     })}
                     {selectedResources.length > 10 && (
                        <tr>
                           <td colSpan={2} className="px-4 py-2 text-center text-slate-400 italic bg-slate-50 dark:bg-slate-950">
                              ...and {selectedResources.length - 10} more
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      <div className="mt-6 flex justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
         <div className="text-xs text-slate-500 flex items-center gap-1">
            <AlertOctagon className="w-3 h-3" />
            Changes are applied immediately.
         </div>
         <div className="flex gap-3">
             <Button variant="ghost" onClick={onClose}>Cancel</Button>
             <Button 
                variant={mode === 'CLEANUP' ? 'danger' : 'primary'}
                onClick={handleApply} 
                disabled={!isValid || previewData.size === 0}
                leftIcon={mode === 'CLEANUP' ? <Trash2 className="w-4 h-4"/> : <CheckCircle2 className="w-4 h-4"/>}
             >
                {mode === 'CLEANUP' ? 'Delete Labels' : 'Apply Changes'} ({previewData.size})
             </Button>
         </div>
      </div>
    </Modal>
  );
};
