
import React, { useState, useMemo } from 'react';
import { GovernancePolicy, TaxonomyRule, GceResource } from '../types';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, BookOpen, 
  Plus, Trash2, Edit3, Save, X, Lightbulb, Check, Info, ArrowRight
} from 'lucide-react';
import { Card, ToggleSwitch, Button, Input, Badge } from './DesignSystem';
import { getPolicies, DEFAULT_TAXONOMY } from '../services/policyService';
import { motion, AnimatePresence } from 'framer-motion';

interface PolicyManagerProps {
  resources: GceResource[];
  onUpdatePolicies: (taxonomy: TaxonomyRule[], policies: GovernancePolicy[]) => void;
}

export const PolicyManager: React.FC<PolicyManagerProps> = ({ resources, onUpdatePolicies }) => {
  const [taxonomy, setTaxonomy] = useState<TaxonomyRule[]>(DEFAULT_TAXONOMY);
  const [policies, setPolicies] = useState<GovernancePolicy[]>(getPolicies(DEFAULT_TAXONOMY));
  
  const [activeTab, setActiveTab] = useState<'taxonomy' | 'policies'>('taxonomy');
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  
  // Temp state for editing
  const [tempRule, setTempRule] = useState<TaxonomyRule>({ key: '', allowedValues: [], isRequired: true });

  // Compute Compliance Score
  const stats = useMemo(() => {
    const totalResources = resources.length || 1;
    const violatedResources = resources.filter(r => (r.violations?.length || 0) > 0).length;
    const cleanResources = totalResources - violatedResources;
    const score = Math.round((cleanResources / totalResources) * 100);
    
    return { score, violatedResources, cleanResources, totalResources };
  }, [resources]);

  // Handlers
  const togglePolicy = (id: string) => {
    const newPolicies = policies.map(p => p.id === id ? { ...p, isEnabled: !p.isEnabled } : p);
    setPolicies(newPolicies);
    onUpdatePolicies(taxonomy, newPolicies);
  };

  const handleEditOpen = (rule: TaxonomyRule, index: number) => {
    setTempRule({ ...rule });
    setEditingRuleIndex(index);
    setIsAddingRule(true);
  };

  const handleCreateOpen = () => {
    setTempRule({ key: '', allowedValues: [], isRequired: true });
    setEditingRuleIndex(null);
    setIsAddingRule(true);
  };

  const saveTaxonomyRule = () => {
    let newTaxonomy;
    if (editingRuleIndex !== null) {
      newTaxonomy = [...taxonomy];
      newTaxonomy[editingRuleIndex] = tempRule;
    } else {
      newTaxonomy = [...taxonomy, tempRule];
    }
    setTaxonomy(newTaxonomy);
    setIsAddingRule(false);
    setEditingRuleIndex(null);
    
    // Refresh policies to respect new taxonomy
    const updatedPolicies = getPolicies(newTaxonomy).map(p => {
       const existing = policies.find(ep => ep.id === p.id);
       return existing ? { ...p, isEnabled: existing.isEnabled } : p;
    });
    setPolicies(updatedPolicies);
    onUpdatePolicies(newTaxonomy, updatedPolicies);
  };

  const deleteRule = (index: number) => {
      const newTaxonomy = taxonomy.filter((_, i) => i !== index);
      setTaxonomy(newTaxonomy);
      const updatedPolicies = getPolicies(newTaxonomy).map(p => {
        const existing = policies.find(ep => ep.id === p.id);
        return existing ? { ...p, isEnabled: existing.isEnabled } : p;
     });
     setPolicies(updatedPolicies);
     onUpdatePolicies(newTaxonomy, updatedPolicies);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      
      {/* 1. Governance Guide (Dismissible) */}
      <AnimatePresence>
        {showGuide && (
            <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
            >
                <div className="bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-5 mb-6 relative">
                    <button onClick={() => setShowGuide(false)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex gap-4">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg h-fit">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Getting Started with Governance</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
                                Establish control over your cloud inventory in two steps:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">1</div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Define Label Standards (Taxonomy)</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">2</div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Enforcement Policies</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">3</div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Review Violations in Inventory</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Scorecard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <Card className="md:col-span-3 bg-white dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
            <div className="p-6 flex items-center justify-between">
               <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Compliance Score</div>
                  <div className="flex items-baseline gap-3">
                     <span className={`text-4xl font-black tracking-tight ${stats.score > 80 ? 'text-emerald-500' : stats.score > 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {stats.score}%
                     </span>
                     <span className="text-sm font-medium text-slate-400">
                        {stats.cleanResources} / {stats.totalResources} Resources Passing
                     </span>
                  </div>
               </div>
               <div className="h-16 w-16 md:h-20 md:w-20">
                  <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                    <circle 
                      cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" 
                      strokeDasharray={2 * Math.PI * 40} 
                      strokeDashoffset={2 * Math.PI * 40 - (stats.score / 100) * 2 * Math.PI * 40}
                      className={stats.score > 80 ? 'text-emerald-500' : stats.score > 50 ? 'text-amber-500' : 'text-red-500'}
                    />
                  </svg>
               </div>
            </div>
         </Card>
         <Card className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-center items-center p-4">
             <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full mb-2">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
             </div>
             <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.violatedResources}</div>
             <div className="text-xs text-slate-500 font-medium">Active Violations</div>
         </Card>
      </div>

      {/* 3. Main Controls */}
      <div>
          <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
             <button 
                onClick={() => setActiveTab('taxonomy')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'taxonomy' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
             >
                <BookOpen className="w-4 h-4" /> Taxonomy Standards
             </button>
             <button 
                onClick={() => setActiveTab('policies')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'policies' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
             >
                <ShieldCheck className="w-4 h-4" /> Enforcement Policies
             </button>
          </div>

          {/* TAB: TAXONOMY */}
          {activeTab === 'taxonomy' && (
             <div className="space-y-6">
                {!isAddingRule && (
                    <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                        <div>
                            <h4 className="font-bold text-indigo-900 dark:text-indigo-100 text-sm">Define Your Standards</h4>
                            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                                Add label keys that are mandatory for your organization.
                            </p>
                        </div>
                        <Button onClick={handleCreateOpen} leftIcon={<Plus className="w-4 h-4"/>}>Add New Standard</Button>
                    </div>
                )}

                {/* Editor Panel */}
                <AnimatePresence>
                    {isAddingRule && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg mb-6 relative">
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="text-sm font-bold uppercase text-slate-500 tracking-wider">
                                        {editingRuleIndex !== null ? 'Edit Standard' : 'New Standard'}
                                    </h4>
                                    <button onClick={() => setIsAddingRule(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">Label Key</label>
                                        <Input 
                                            value={tempRule.key} 
                                            onChange={e => setTempRule({...tempRule, key: e.target.value})} 
                                            placeholder="e.g. cost-center"
                                            className="font-mono text-sm"
                                            autoFocus
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">The exact key name (case-sensitive) required on resources.</p>
                                    </div>
                                    
                                    <div className="flex items-center pt-6">
                                        <ToggleSwitch 
                                            checked={tempRule.isRequired} 
                                            onChange={v => setTempRule({...tempRule, isRequired: v})} 
                                            label="Mandatory on all resources?" 
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">Allowed Values (Controlled Vocabulary)</label>
                                        <Input 
                                            value={tempRule.allowedValues.join(', ')} 
                                            onChange={e => setTempRule({...tempRule, allowedValues: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} 
                                            placeholder="e.g. production, staging, dev (Leave empty to allow any text)"
                                            className="font-mono text-sm"
                                        />
                                        <div className="flex flex-wrap gap-2 mt-2 min-h-[24px]">
                                            {tempRule.allowedValues.length > 0 ? (
                                                tempRule.allowedValues.map((val, i) => (
                                                    <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                                        {val}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-400 italic flex items-center gap-1"><Info className="w-3 h-3"/> Any text value will be accepted.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Button variant="ghost" onClick={() => setIsAddingRule(false)}>Cancel</Button>
                                    <Button 
                                        variant="primary" 
                                        disabled={!tempRule.key} 
                                        onClick={saveTaxonomyRule} 
                                        leftIcon={<Save className="w-4 h-4"/>}
                                    >
                                        Save Standard
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Rules List */}
                <div className="grid grid-cols-1 gap-3">
                    {taxonomy.length === 0 && !isAddingRule && (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                            <p className="text-slate-400">No standards defined yet.</p>
                        </div>
                    )}
                    {taxonomy.map((rule, idx) => (
                        <div key={idx} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-all hover:border-indigo-300 dark:hover:border-indigo-700">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col gap-1 w-40 shrink-0">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Label Key</span>
                                    <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded w-fit">
                                        {rule.key}
                                    </span>
                                </div>
                                
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Allowed Values</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {rule.allowedValues.length > 0 ? (
                                            rule.allowedValues.map((v, i) => (
                                                <Badge key={i} variant="neutral" className="font-mono text-[10px]">{v}</Badge>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Free text</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {rule.isRequired && (
                                    <Badge variant="error" className="hidden sm:inline-flex">Required</Badge>
                                )}
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="xs" variant="ghost" onClick={() => handleEditOpen(rule, idx)}>
                                        <Edit3 className="w-3.5 h-3.5"/>
                                    </Button>
                                    <Button size="xs" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => deleteRule(idx)}>
                                        <Trash2 className="w-3.5 h-3.5"/>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
          )}

          {/* TAB: POLICIES */}
          {activeTab === 'policies' && (
             <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-6">
                    <div className="flex gap-3">
                        <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Policies enforce the standards defined in the Taxonomy tab. 
                            Enable <strong>Mandatory Labeling</strong> to flag resources missing keys, and 
                            <strong>Controlled Vocabulary</strong> to flag invalid values.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {policies.map(policy => (
                        <div key={policy.id} className={`p-5 rounded-xl border transition-all ${policy.isEnabled ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900 shadow-sm' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-80'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${policy.isEnabled ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                        <ShieldCheck className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{policy.name}</h4>
                                        <Badge variant={policy.severity === 'CRITICAL' ? 'error' : 'warning'} className="mt-1 text-[10px]">
                                            {policy.severity}
                                        </Badge>
                                    </div>
                                </div>
                                <ToggleSwitch checked={policy.isEnabled} onChange={() => togglePolicy(policy.id)} />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed min-h-[40px]">
                                {policy.description}
                            </p>
                        </div>
                    ))}
                </div>
             </div>
          )}
      </div>
    </div>
  );
};
