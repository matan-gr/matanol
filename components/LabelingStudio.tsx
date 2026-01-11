
import React, { useState, useMemo, useEffect } from 'react';
import { GceResource } from '../types';
import { LABEL_TEMPLATES } from '../constants';
import { analyzeNamingPatterns } from '../services/geminiService';
import { 
  Tag, Split, Eraser, ArrowRight, Save, X, 
  RefreshCw, Wand2, Plus, Trash2, Regex as RegexIcon,
  Bot, Lightbulb, Check, ChevronRight, AlertTriangle, Code,
  LayoutTemplate, CheckCircle2, AlertOctagon, HelpCircle
} from 'lucide-react';
import { Button, Input, Select, Badge, Card, ToggleSwitch } from './DesignSystem';
import { validateKey, validateValue } from '../utils/validation';

const MODE_INSTRUCTIONS: Record<string, string> = {
  STATIC: "Apply standardized labels to all selected resources. Define key-value pairs (e.g., 'cost-center: cc-123') that will be added or overwritten.",
  PATTERN: "Split resource names by a delimiter (e.g., '-') to extract dynamic values. Map each segment position to a label key.",
  REGEX: "Use regular expressions for advanced extraction. Define a pattern with capture groups (...) and assign a label key to each group index.",
  CLEANUP: "Bulk remove labels by key. Enter the label keys you wish to delete from the selected resources. This operation cannot be undone."
};

interface LabelingStudioProps {
  isOpen: boolean;
  onClose: () => void;
  selectedResources: GceResource[];
  onApply: (updates: Map<string, Record<string, string>>) => void;
}

type Mode = 'STATIC' | 'PATTERN' | 'REGEX' | 'CLEANUP';

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

  // Cleanup Mode State
  const [keysToRemove, setKeysToRemove] = useState<string[]>(['']);

  // Derived for Pattern Preview
  const sampleName = selectedResources[0]?.name || '';
  const sampleTokens = useMemo(() => sampleName.split(delimiter), [sampleName, delimiter]);

  // Helper to find mapping for a specific index
  const getMappingForIndex = (index: number) => mappings.find(m => m.position === index);

  // --- Logic ---

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const names = selectedResources.map(r => r.name);
      const result = await analyzeNamingPatterns(names);
      
      setAiAdvice(result.advice);
      if (result.suggestedMode) {
        setMode(result.suggestedMode);
      }
      
      // Apply Configuration Safely
      if (result.suggestedMode === 'PATTERN' && result.config) {
        if (result.config.delimiter) setDelimiter(result.config.delimiter);
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
      else if (mode === 'CLEANUP') {
        keysToRemove.forEach(key => {
          if (key && newLabels[key]) {
            changes.push(`Removed ${key}`);
            delete newLabels[key];
          }
        });
      }

      if (changes.length > 0) {
        updates.set(r.id, {
          original: r.labels,
          new: newLabels,
          changes
        });
      }
    });

    return updates;
  }, [selectedResources, mode, staticLabels, delimiter, mappings, keysToRemove, regexPattern, regexGroups]);

  const handleApply = () => {
    const payload = new Map<string, Record<string, string>>();
    previewData.forEach((val, id) => {
      payload.set(id, val.new);
    });
    onApply(payload);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      
      <div className="relative bg-slate-50 dark:bg-slate-950 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        
        {/* Left Sidebar: AI Copilot & Context */}
        <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20">
           <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                 <Wand2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                 Label Studio
              </h2>
              <div className="mt-2 flex items-center gap-2">
                 <Badge variant="neutral">{selectedResources.length} Resources</Badge>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* AI Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-500/30">
                 <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-300 font-semibold text-sm">
                    <Bot className="w-4 h-4" /> AI Assistant
                 </div>
                 {aiAdvice ? (
                    <div className="space-y-3">
                       <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                          "{aiAdvice}"
                       </p>
                       <div className="flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Config Auto-Applied
                       </div>
                       <Button size="xs" variant="secondary" onClick={() => setAiAdvice(null)} className="w-full mt-2">Reset Assistant</Button>
                    </div>
                 ) : (
                    <div className="space-y-3">
                       <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          I can analyze your resource names and automatically configure the extraction rules.
                       </p>
                       <Button 
                          size="sm" 
                          variant="primary" 
                          className="w-full shadow-md"
                          onClick={handleAiAnalysis}
                          isLoading={isAnalyzing}
                          leftIcon={<Wand2 className="w-3 h-3" />}
                       >
                          Auto-Detect Patterns
                       </Button>
                    </div>
                 )}
              </div>

              {/* Instructions based on selection */}
              <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Dynamic Instructions</h4>
                  
                  {/* Mode-specific guidance */}
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4 flex gap-2">
                     <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                     <span>{MODE_INSTRUCTIONS[mode]}</span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
                     {selectedResources.some(r => r.name.includes('-') || r.name.includes('_')) && (
                        <div className="flex gap-2 animate-in fade-in">
                           <div className="mt-0.5 min-w-[16px]"><Split className="w-4 h-4 text-blue-500" /></div>
                           <p>We detected delimiters in your resource names. <strong>Pattern Extraction</strong> is recommended.</p>
                        </div>
                     )}
                     {selectedResources.some(r => Object.keys(r.labels).length === 0) && (
                        <div className="flex gap-2 animate-in fade-in">
                           <div className="mt-0.5 min-w-[16px]"><Tag className="w-4 h-4 text-emerald-500" /></div>
                           <p>Some resources have no labels. Use <strong>Static Assignment</strong> to set a baseline.</p>
                        </div>
                     )}
                  </div>
              </div>
           </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 min-w-0">
           
           {/* Navigation Tabs */}
           <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur flex justify-between items-center">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {[
                    { id: 'STATIC', icon: Tag, label: 'Static' },
                    { id: 'PATTERN', icon: Split, label: 'Pattern' },
                    { id: 'REGEX', icon: RegexIcon, label: 'Regex' },
                    { id: 'CLEANUP', icon: Eraser, label: 'Cleanup' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id as Mode)}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                        ${mode === m.id 
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}
                      `}
                    >
                      <m.icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  ))}
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                 <X className="w-6 h-6" />
              </button>
           </div>

           <div className="flex-1 flex overflow-hidden">
              {/* Editor Pane (Middle) */}
              <div className="w-[45%] border-r border-slate-200 dark:border-slate-800 p-8 overflow-y-auto">
                 <div className="max-w-md mx-auto space-y-8 animate-in slide-in-from-left-4 duration-300">
                    
                    {/* STATIC MODE */}
                    {mode === 'STATIC' && (
                      <div className="space-y-6">
                        <div>
                           <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Static Labels</h3>
                           <p className="text-sm text-slate-500 mt-1">Apply specific key-value pairs to every selected resource.</p>
                        </div>
                        
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                           <div className="mb-4">
                              <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block">Quick Templates</label>
                              <Select 
                                 onChange={(e) => { addTemplateToStatic(e.target.value); e.target.value = ''; }} 
                                 className="text-xs"
                              >
                                 <option value="">Load a common label...</option>
                                 {LABEL_TEMPLATES.map((t, i) => <option key={i} value={`${t.key}::${t.value}`}>{t.label}</option>)}
                              </Select>
                           </div>

                           <div className="space-y-3">
                              {staticLabels.map((lbl, idx) => (
                                <div key={idx} className="flex gap-2 group items-start">
                                  <Input 
                                    placeholder="Key" 
                                    value={lbl.key} 
                                    onChange={e => {
                                      const n = [...staticLabels]; n[idx].key = e.target.value; setStaticLabels(n);
                                    }} 
                                    error={validateKey(lbl.key) || undefined}
                                  />
                                  <Input 
                                    placeholder="Value" 
                                    value={lbl.value} 
                                    onChange={e => {
                                      const n = [...staticLabels]; n[idx].value = e.target.value; setStaticLabels(n);
                                    }} 
                                    error={validateValue(lbl.value) || undefined}
                                  />
                                  <button onClick={() => setStaticLabels(staticLabels.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors mt-2">
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              ))}
                              <Button variant="ghost" className="w-full border-dashed border-slate-300 dark:border-slate-700" onClick={() => setStaticLabels([...staticLabels, {key:'', value:''}])} leftIcon={<Plus className="w-4 h-4"/>}>Add Label</Button>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* PATTERN MODE */}
                    {mode === 'PATTERN' && (
                      <div className="space-y-6">
                        <div>
                           <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Pattern Extraction</h3>
                           <p className="text-sm text-slate-500 mt-1">Split resource names by a delimiter and map segments to labels.</p>
                        </div>
                        
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                           <div>
                              <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block">Separator</label>
                              <div className="flex gap-4">
                                 {['-', '_', '.'].map(char => (
                                    <button 
                                       key={char} 
                                       onClick={() => setDelimiter(char)}
                                       className={`flex-1 py-2 rounded-lg border font-mono text-lg font-bold transition-all ${delimiter === char ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}
                                    >
                                       {char}
                                    </button>
                                 ))}
                              </div>
                           </div>
                           
                           {/* Visual Preview of Tokens */}
                           <div className="bg-slate-100 dark:bg-slate-950/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                             <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">Token Preview (First Resource)</div>
                             <div className="flex flex-wrap gap-2">
                               {sampleTokens.map((token, idx) => {
                                 const mapping = getMappingForIndex(idx);
                                 return (
                                   <div key={idx} className="flex flex-col items-center min-w-[30px] animate-in fade-in zoom-in-95 duration-300">
                                      <span className="text-[9px] text-slate-400 font-mono mb-1">{idx + 1}</span>
                                      <Badge 
                                        variant={mapping ? 'info' : 'neutral'} 
                                        className={`font-mono text-xs px-2 py-1 transition-all ${mapping ? 'ring-2 ring-blue-500/20 shadow-sm scale-105' : 'opacity-70'}`}
                                      >
                                        {token}
                                      </Badge>
                                      {mapping ? (
                                        <div className="mt-1 flex flex-col items-center animate-in slide-in-from-top-1">
                                            <div className="w-px h-2 bg-blue-300 dark:bg-blue-700"></div>
                                            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">{mapping.key}</span>
                                        </div>
                                      ) : (
                                        <div className="h-6"></div> // Spacer to keep alignment
                                      )}
                                   </div>
                                 );
                               })}
                             </div>
                           </div>

                           <div className="space-y-3">
                              <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Positional Mappings</label>
                              {mappings.map((map, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 animate-in slide-in-from-left-2">
                                  {/* Position Selector */}
                                  <div className="flex flex-col w-12 pt-1">
                                     <label className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Pos</label>
                                     <input 
                                        type="number" 
                                        min="1" 
                                        max={Math.max(sampleTokens.length, 10)}
                                        value={map.position + 1}
                                        onChange={e => updateMappingPosition(idx, parseInt(e.target.value) - 1)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1 py-1 text-center text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                     />
                                  </div>

                                  {/* Live Token Preview */}
                                  <div className="flex flex-col items-center px-3 border-l border-r border-slate-200 dark:border-slate-800 mx-1 min-w-[80px] pt-1">
                                     <span className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Value</span>
                                     <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[80px]" title={sampleTokens[map.position] || ''}>
                                        {sampleTokens[map.position] || <span className="text-slate-300 italic">-</span>}
                                     </span>
                                  </div>

                                  <div className="pt-3"><ArrowRight className="w-4 h-4 text-slate-300" /></div>
                                  
                                  <Input 
                                    placeholder="Target Label Key" 
                                    value={map.key} 
                                    onChange={e => {
                                       const n = [...mappings]; n[idx].key = e.target.value; setMappings(n);
                                    }} 
                                    className="flex-1"
                                    error={validateKey(map.key) || undefined}
                                  />
                                  
                                  <button onClick={() => setMappings(mappings.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors p-1 mt-2"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              ))}
                              <Button variant="ghost" size="sm" onClick={() => setMappings([...mappings, {position: mappings.length, key: ''}])} leftIcon={<Plus className="w-3 h-3"/>}>Add Mapping</Button>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* REGEX MODE */}
                    {mode === 'REGEX' && (
                       <div className="space-y-6">
                          <div>
                             <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Regex Capture</h3>
                             <p className="text-sm text-slate-500 mt-1">Use Regular Expressions to extract complex substrings.</p>
                          </div>
                          
                          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                             <div>
                                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block flex justify-between">
                                   Pattern 
                                   <a href="https://regex101.com" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 normal-case font-normal"><Code className="w-3 h-3"/> Test Regex</a>
                                </label>
                                <Input 
                                   value={regexPattern} 
                                   onChange={(e) => setRegexPattern(e.target.value)} 
                                   className="font-mono text-sm"
                                   placeholder="^([a-z]+)-(\d+)$"
                                />
                             </div>

                             <div className="space-y-3">
                                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Capture Groups</label>
                                {regexGroups.map((group, idx) => (
                                  <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex flex-col items-center min-w-[3rem]">
                                       <span className="text-[10px] text-slate-400 font-bold uppercase">Group</span>
                                       <span className="text-lg font-mono font-bold text-slate-700 dark:text-slate-300">${group.index}</span>
                                    </div>
                                    <div className="pt-3"><ArrowRight className="w-4 h-4 text-slate-300" /></div>
                                    <Input 
                                      placeholder="Target Label Key" 
                                      value={group.key} 
                                      onChange={e => {
                                         const n = [...regexGroups]; n[idx].key = e.target.value; setRegexGroups(n);
                                      }} 
                                      className="flex-1"
                                      error={validateKey(group.key) || undefined}
                                    />
                                    <button onClick={() => setRegexGroups(regexGroups.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 mt-2"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                ))}
                                <Button variant="ghost" size="sm" onClick={() => setRegexGroups([...regexGroups, {index: regexGroups.length + 1, key: ''}])} leftIcon={<Plus className="w-3 h-3"/>}>Add Group</Button>
                             </div>
                          </div>
                       </div>
                    )}

                    {/* CLEANUP MODE */}
                    {mode === 'CLEANUP' && (
                       <div className="space-y-6">
                         <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Bulk Cleanup</h3>
                            <p className="text-sm text-slate-500 mt-1">Remove specific deprecated labels from all resources.</p>
                         </div>
                         
                         <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-lg flex gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
                            <div className="text-sm text-amber-800 dark:text-amber-200/80 leading-relaxed">
                                <strong>Caution:</strong> Removing labels is irreversible. Ensure these keys are no longer needed for billing or compliance policies.
                            </div>
                         </div>

                         <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                            <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Keys to Remove</label>
                            
                            {/* Common Keys Quick Add */}
                            <div className="flex flex-wrap gap-2 mb-2">
                                {['temp', 'temporary', 'test', 'debug', 'owner', 'created-by'].map(k => (
                                    <button
                                        key={k}
                                        onClick={() => !keysToRemove.includes(k) && setKeysToRemove([...keysToRemove, k])}
                                        className="text-[10px] px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                                    >
                                        + {k}
                                    </button>
                                ))}
                            </div>

                            {keysToRemove.map((k, idx) => (
                              <div key={idx} className="flex gap-2 group items-start">
                                 <div className="relative flex-1">
                                     <Tag className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                     <Input 
                                        placeholder="Label Key to Remove" 
                                        value={k} 
                                        onChange={e => {
                                            const n = [...keysToRemove]; n[idx] = e.target.value; setKeysToRemove(n);
                                        }} 
                                        className="pl-9"
                                        error={validateKey(k) || undefined}
                                     />
                                 </div>
                                 <button 
                                    onClick={() => setKeysToRemove(keysToRemove.filter((_, i) => i !== idx))} 
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors mt-0.5"
                                >
                                    <Trash2 className="w-5 h-5" />
                                 </button>
                              </div>
                            ))}
                            <Button 
                                variant="ghost" 
                                className="w-full border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" 
                                onClick={() => setKeysToRemove([...keysToRemove, ''])} 
                                leftIcon={<Plus className="w-4 h-4"/>}
                            >
                                Add Key to Remove
                            </Button>
                         </div>
                       </div>
                    )}
                 </div>
              </div>

              {/* Preview Pane (Right) */}
              <div className="flex-1 bg-slate-100 dark:bg-black/20 flex flex-col min-w-0">
                 <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5" /> Impact Simulation
                    </h3>
                    <div className="flex gap-2">
                       <Badge variant="info">{previewData.size} Affected</Badge>
                       {selectedResources.length - previewData.size > 0 && <Badge variant="neutral">{selectedResources.length - previewData.size} Unchanged</Badge>}
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {previewData.size === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                        <Wand2 className="w-16 h-16 mb-4 stroke-[1]" />
                        <p className="font-medium">Configure rules to see live preview</p>
                        <p className="text-sm mt-2">Changes will appear here before you commit.</p>
                      </div>
                    ) : (
                      Array.from(previewData.entries()).map(([id, data]) => {
                        const resource = selectedResources.find(r => r.id === id);
                        if (!resource) return null;
                        return (
                          <div key={id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                               <div className="flex items-center gap-3">
                                  <div className="font-bold text-slate-800 dark:text-slate-200">{resource.name}</div>
                                  <div className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{resource.id}</div>
                               </div>
                               <div className="flex flex-wrap gap-1 justify-end max-w-[40%]">
                                 {data.changes.map((change, i) => {
                                    const isRemoval = change.startsWith('Removed');
                                    return (
                                       <Badge 
                                          key={i} 
                                          variant={isRemoval ? 'error' : 'success'} 
                                          className={`text-[10px] ${isRemoval ? 'border-red-200 dark:border-red-800' : 'border-emerald-200 dark:border-emerald-800'}`}
                                       >
                                          {change}
                                       </Badge>
                                    );
                                 })}
                               </div>
                            </div>
                            
                            <div className="flex items-stretch text-xs rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                              <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-200 dark:border-slate-800 relative">
                                <div className="absolute top-2 right-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Original</div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {Object.entries(data.original).map(([k,v]) => (
                                     <span key={k} className="px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900">{k}:{v}</span>
                                  ))}
                                  {Object.keys(data.original).length === 0 && <span className="text-slate-400 italic">No labels</span>}
                                </div>
                              </div>
                              <div className="w-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
                                 <ArrowRight className="w-4 h-4" />
                              </div>
                              <div className="flex-1 p-3 bg-blue-50/30 dark:bg-blue-900/10 relative">
                                <div className="absolute top-2 right-2 text-[9px] font-bold text-blue-500 uppercase tracking-widest">Result</div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {Object.entries(data.new).map(([k,v]) => {
                                     const isNew = data.original[k] !== v;
                                     return (
                                       <span key={k} className={`px-1.5 py-0.5 rounded border shadow-sm ${isNew ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 font-semibold' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                                          {k}:{v}
                                       </span>
                                     )
                                  })}
                                  {Object.keys(data.new).length === 0 && <span className="text-slate-400 italic">No labels</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                 </div>
                 
                 <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                    <div className="text-xs text-slate-500">
                       <strong>Safe Mode:</strong> No changes are applied until you confirm.
                    </div>
                    <div className="flex gap-3">
                       <Button variant="secondary" onClick={onClose}>Cancel</Button>
                       <Button 
                         variant="primary" 
                         onClick={handleApply} 
                         disabled={previewData.size === 0}
                         leftIcon={<Save className="w-4 h-4" />}
                         className="px-6"
                       >
                         Commit {previewData.size} Updates
                       </Button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
