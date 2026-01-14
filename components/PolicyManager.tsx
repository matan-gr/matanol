
import React, { useState, useMemo } from 'react';
import { GovernancePolicy, TaxonomyRule, GceResource, PolicyCategory, PolicySeverity, FilterConfig, PolicyRuleConfig, RuleType } from '../types';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, BookOpen, 
  Plus, Trash2, Edit3, Save, X, Lightbulb, Check, Info, ArrowRight,
  PieChart, DollarSign, Lock, Activity, Eye, Filter, Settings, Layers, Box
} from 'lucide-react';
import { Card, ToggleSwitch, Button, Input, Badge, Select, Modal } from './DesignSystem';
import { getPolicies, DEFAULT_TAXONOMY, createCustomPolicy } from '../services/policyService';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedCounter, HealthGauge } from './Visualizations';

interface PolicyManagerProps {
  resources: GceResource[];
  onUpdatePolicies: (taxonomy: TaxonomyRule[], policies: GovernancePolicy[]) => void;
  onNavigateToViolations: (filter?: Partial<FilterConfig>) => void;
}

const PolicyEditorModal = ({ 
    isOpen, 
    onClose, 
    onSave, 
    initialPolicy,
    availableCategories 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    onSave: (p: GovernancePolicy) => void,
    initialPolicy?: GovernancePolicy,
    availableCategories: string[]
}) => {
    const [name, setName] = useState(initialPolicy?.name || '');
    const [description, setDescription] = useState(initialPolicy?.description || '');
    const [category, setCategory] = useState<string>(initialPolicy?.category || 'OPERATIONS');
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [severity, setSeverity] = useState<PolicySeverity>(initialPolicy?.severity || 'WARNING');
    
    const [ruleType, setRuleType] = useState<RuleType>(initialPolicy?.ruleConfig?.type || 'REQUIRED_LABEL');
    const [params, setParams] = useState(initialPolicy?.ruleConfig?.params || { key: '', values: [], regex: '' });

    if (!isOpen) return null;

    const handleSave = () => {
        if (!name || !description || !category) return;
        
        // Clean params based on type
        const cleanParams = { ...params };
        if (ruleType === 'REQUIRED_LABEL') { delete cleanParams.regex; delete cleanParams.values; }
        if (ruleType === 'NAME_REGEX') { delete cleanParams.key; delete cleanParams.values; }
        
        const newPolicy = createCustomPolicy(name, description, severity, category, { type: ruleType, params: cleanParams });
        if (initialPolicy) newPolicy.id = initialPolicy.id; // Preserve ID on edit
        
        onSave(newPolicy);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialPolicy ? "Edit Policy" : "Create New Policy"}>
            <div className="p-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Policy Name</label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Enforce Team Label" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Description</label>
                        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Explain the rule..." />
                    </div>
                    
                    {/* Category Selection */}
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex justify-between">
                            Category
                            <button 
                                onClick={() => { setIsCustomCategory(!isCustomCategory); if(!isCustomCategory) setCategory(''); }} 
                                className="text-indigo-500 hover:underline cursor-pointer"
                            >
                                {isCustomCategory ? "Select Existing" : "Create New"}
                            </button>
                        </label>
                        {isCustomCategory ? (
                            <Input 
                                value={category} 
                                onChange={e => setCategory(e.target.value)} 
                                placeholder="New Category Name" 
                                autoFocus
                            />
                        ) : (
                            <Select value={category} onChange={e => setCategory(e.target.value)}>
                                {availableCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </Select>
                        )}
                    </div>

                    {/* Severity Selection */}
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Severity</label>
                        <Select value={severity} onChange={e => setSeverity(e.target.value as any)}>
                            <option value="INFO">Info</option>
                            <option value="WARNING">Warning</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="CRITICAL">Critical</option>
                        </Select>
                    </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4"/> Rule Logic
                    </h4>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Rule Type</label>
                            <Select value={ruleType} onChange={e => setRuleType(e.target.value as any)}>
                                <option value="REQUIRED_LABEL">Require Label Presence</option>
                                <option value="ALLOWED_VALUES">Restrict Label Values</option>
                                <option value="NAME_REGEX">Naming Convention (Regex)</option>
                                <option value="REGION_RESTRICTION">Region Restriction</option>
                            </Select>
                        </div>

                        {ruleType === 'REQUIRED_LABEL' && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                                <label className="text-[10px] uppercase font-bold text-indigo-500 mb-1 block">Required Label Key</label>
                                <Input value={params.key || ''} onChange={e => setParams({...params, key: e.target.value})} placeholder="e.g. cost-center" />
                                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2">Resources missing this label key will be flagged.</p>
                            </div>
                        )}

                        {ruleType === 'ALLOWED_VALUES' && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg space-y-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-indigo-500 mb-1 block">Target Label Key</label>
                                    <Input value={params.key || ''} onChange={e => setParams({...params, key: e.target.value})} placeholder="e.g. environment" />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-indigo-500 mb-1 block">Allowed Values (Comma Separated)</label>
                                    <Input value={params.values?.join(',') || ''} onChange={e => setParams({...params, values: e.target.value.split(',').map(s => s.trim())})} placeholder="prod, dev, staging" />
                                </div>
                            </div>
                        )}

                        {ruleType === 'NAME_REGEX' && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                                <label className="text-[10px] uppercase font-bold text-indigo-500 mb-1 block">Regex Pattern</label>
                                <Input value={params.regex || ''} onChange={e => setParams({...params, regex: e.target.value})} placeholder="e.g. ^[a-z]+-[a-z]+-[0-9]+$" className="font-mono" />
                                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2">Resources with names NOT matching this pattern will be flagged.</p>
                            </div>
                        )}

                        {ruleType === 'REGION_RESTRICTION' && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                                <label className="text-[10px] uppercase font-bold text-indigo-500 mb-1 block">Allowed Region Prefixes</label>
                                <Input value={params.values?.join(',') || ''} onChange={e => setParams({...params, values: e.target.value.split(',').map(s => s.trim())})} placeholder="e.g. us-, europe-west1" />
                                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2">Resources in zones starting with other prefixes will be flagged.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button variant="primary" onClick={handleSave} disabled={!name}>Save Policy</Button>
                </div>
            </div>
        </Modal>
    )
}

export const PolicyManager: React.FC<PolicyManagerProps> = ({ resources, onUpdatePolicies, onNavigateToViolations }) => {
  const [taxonomy, setTaxonomy] = useState<TaxonomyRule[]>(DEFAULT_TAXONOMY);
  const [policies, setPolicies] = useState<GovernancePolicy[]>(getPolicies(DEFAULT_TAXONOMY));
  
  const [activeTab, setActiveTab] = useState<'overview' | 'policies'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<GovernancePolicy | undefined>(undefined);

  // Compute Compliance Statistics
  const stats = useMemo(() => {
    const totalResources = resources.length || 1;
    const violatedResources = resources.filter(r => (r.violations?.length || 0) > 0).length;
    const cleanResources = totalResources - violatedResources;
    const score = Math.round((cleanResources / totalResources) * 100);
    
    // Category Breakdown (Dynamic)
    const byCategory: Record<string, number> = {};
    policies.forEach(p => byCategory[p.category] = 0); // Init

    resources.forEach(r => {
        r.violations?.forEach(v => {
            const policy = policies.find(p => p.id === v.policyId);
            if (policy) {
                byCategory[policy.category] = (byCategory[policy.category] || 0) + 1;
            }
        });
    });

    return { score, violatedResources, cleanResources, totalResources, byCategory };
  }, [resources, policies]);

  // Derive unique categories
  const availableCategories = useMemo(() => {
      const cats = new Set<string>();
      policies.forEach(p => cats.add(p.category));
      return Array.from(cats).sort();
  }, [policies]);

  // Handlers
  const togglePolicy = (id: string) => {
    const newPolicies = policies.map(p => p.id === id ? { ...p, isEnabled: !p.isEnabled } : p);
    setPolicies(newPolicies);
    onUpdatePolicies(taxonomy, newPolicies);
  };

  const updateSeverity = (id: string, severity: PolicySeverity) => {
    const newPolicies = policies.map(p => p.id === id ? { ...p, severity } : p);
    setPolicies(newPolicies);
    onUpdatePolicies(taxonomy, newPolicies);
  };

  const deletePolicy = (id: string) => {
      const newPolicies = policies.filter(p => p.id !== id);
      setPolicies(newPolicies);
      onUpdatePolicies(taxonomy, newPolicies);
  };

  const handleSavePolicy = (newPolicy: GovernancePolicy) => {
      let newPolicies;
      if (editingPolicy) {
          newPolicies = policies.map(p => p.id === newPolicy.id ? newPolicy : p);
      } else {
          newPolicies = [...policies, newPolicy];
      }
      setPolicies(newPolicies);
      onUpdatePolicies(taxonomy, newPolicies);
      setEditingPolicy(undefined);
  };

  const openCreateModal = () => {
      setEditingPolicy(undefined);
      setIsModalOpen(true);
  };

  const openEditModal = (p: GovernancePolicy) => {
      setEditingPolicy(p);
      setIsModalOpen(true);
  };

  const filteredPolicies = selectedCategory === 'ALL' ? policies : policies.filter(p => p.category === selectedCategory);

  // Helper for severity styling
  const getSeverityBadge = (severity: PolicySeverity) => {
      switch(severity) {
          case 'CRITICAL': return <Badge variant="error" className="text-[9px]">CRITICAL</Badge>;
          case 'MEDIUM': return <Badge variant="purple" className="text-[9px]">MEDIUM</Badge>;
          case 'WARNING': return <Badge variant="warning" className="text-[9px]">WARNING</Badge>;
          case 'INFO': return <Badge variant="info" className="text-[9px]">INFO</Badge>;
          default: return <Badge variant="neutral" className="text-[9px]">{severity}</Badge>;
      }
  };

  // Helper for category icon/color (simple hash-based selection)
  const getCategoryStyles = (cat: string) => {
      const styles = [
          { color: 'text-amber-500', bg: 'bg-amber-500', icon: Lock, lightBg: 'bg-amber-100', lightText: 'text-amber-600' },
          { color: 'text-emerald-500', bg: 'bg-emerald-500', icon: DollarSign, lightBg: 'bg-emerald-100', lightText: 'text-emerald-600' },
          { color: 'text-blue-500', bg: 'bg-blue-500', icon: Activity, lightBg: 'bg-blue-100', lightText: 'text-blue-600' },
          { color: 'text-violet-500', bg: 'bg-violet-500', icon: Layers, lightBg: 'bg-violet-100', lightText: 'text-violet-600' },
          { color: 'text-pink-500', bg: 'bg-pink-500', icon: Box, lightBg: 'bg-pink-100', lightText: 'text-pink-600' }
      ];
      
      // Fixed mapping for known types
      if (cat === 'SECURITY') return styles[0];
      if (cat === 'COST') return styles[1];
      if (cat === 'OPERATIONS') return styles[2];
      
      // Hash-based for custom
      const idx = Math.abs(cat.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % styles.length;
      return styles[idx];
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
      
      {/* 1. Header & Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
             <button 
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
             >
                <PieChart className="w-4 h-4" /> Overview
             </button>
             <button 
                onClick={() => setActiveTab('policies')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'policies' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
             >
                <ShieldCheck className="w-4 h-4" /> Rules Engine
             </button>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-xs text-slate-500 font-mono">
                {resources.length} Assets Monitored
             </span>
          </div>
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
         <div className="space-y-6">
            {/* Top Score */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <Card className="md:col-span-3 bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-none shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                  <div className="p-8 flex items-center justify-between relative z-10">
                     <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-200 mb-2">Governance Score</h3>
                        <div className="text-5xl font-black tracking-tighter mb-2">
                           <AnimatedCounter value={stats.score} />%
                        </div>
                        <p className="text-indigo-200/80 text-sm max-w-md">
                           {stats.score >= 90 ? 'Excellent compliance posture. Maintain current policies.' : 'Optimization required. Review active violations.'}
                        </p>
                     </div>
                     <div className="hidden md:block">
                        <HealthGauge percentage={stats.score} />
                     </div>
                  </div>
               </Card>
               
               <Card className="flex flex-col justify-center items-center p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                   <div className="text-center mb-4">
                      <div className="text-3xl font-bold text-red-600 dark:text-red-500 mb-1">
                         <AnimatedCounter value={stats.violatedResources} />
                      </div>
                      <div className="text-xs font-bold uppercase text-slate-400 tracking-wider">Violations</div>
                   </div>
                   <Button 
                      size="sm" 
                      variant="danger" 
                      className="w-full"
                      onClick={() => onNavigateToViolations({ showViolationsOnly: true })}
                      leftIcon={<Eye className="w-4 h-4" />}
                   >
                      View All
                   </Button>
               </Card>
            </div>

            {/* Category Breakdown - Dynamic Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {availableCategories.map(cat => {
                   const style = getCategoryStyles(cat);
                   const count = stats.byCategory[cat] || 0;
                   return (
                       <CategoryCard 
                          key={cat}
                          title={cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()} 
                          icon={style.icon} 
                          count={count} 
                          color={style.color} 
                          bg={style.bg}
                          onClick={() => { setSelectedCategory(cat); setActiveTab('policies'); }}
                       />
                   )
               })}
            </div>
         </div>
      )}

      {/* TAB: POLICIES */}
      {activeTab === 'policies' && (
         <div className="space-y-6">
            <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
               <div>
                  <h4 className="font-bold text-indigo-900 dark:text-indigo-100 text-sm">Policy Engine</h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                     Define automated rules to govern your infrastructure.
                  </p>
               </div>
               <Button onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4"/>}>New Custom Policy</Button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
               <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedCategory === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >
                  All Policies
               </button>
               {availableCategories.map(cat => (
                  <button
                     key={cat}
                     onClick={() => setSelectedCategory(cat)}
                     className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                     {cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()}
                  </button>
               ))}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredPolicies.map(policy => {
                    const style = getCategoryStyles(policy.category);
                    const Icon = style.icon;

                    return (
                        <div key={policy.id} className={`p-5 rounded-xl border transition-all flex flex-col md:flex-row md:items-center gap-6 ${policy.isEnabled ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60 grayscale'}`}>
                            {/* Icon & Info */}
                            <div className="flex items-start gap-4 flex-1">
                                <div className={`p-3 rounded-xl shrink-0 ${style.lightBg} ${style.lightText} dark:bg-opacity-20`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-bold text-slate-900 dark:text-white">{policy.name}</h4>
                                        {getSeverityBadge(policy.severity)}
                                        {policy.isCustom && <Badge variant="purple" className="text-[9px]">Custom</Badge>}
                                        <Badge variant="neutral" className="text-[9px] opacity-70">{policy.category}</Badge>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                                        {policy.description}
                                    </p>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-6 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6">
                                
                                {/* Actions for Custom Policies */}
                                {policy.isCustom && (
                                    <div className="flex gap-2">
                                        <Button size="xs" variant="ghost" onClick={() => openEditModal(policy)}><Edit3 className="w-3.5 h-3.5"/></Button>
                                        <Button size="xs" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => deletePolicy(policy.id)}><Trash2 className="w-3.5 h-3.5"/></Button>
                                    </div>
                                )}

                                {!policy.isCustom && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] uppercase font-bold text-slate-400">Severity</span>
                                        <select 
                                            value={policy.severity}
                                            onChange={(e) => updateSeverity(policy.id, e.target.value as PolicySeverity)}
                                            className="text-xs bg-slate-50 dark:bg-slate-800 border-none rounded py-1 pl-2 pr-6 cursor-pointer focus:ring-0 font-bold text-slate-700 dark:text-slate-300"
                                            disabled={!policy.isEnabled}
                                        >
                                            <option value="INFO">Info</option>
                                            <option value="WARNING">Warning</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                    </div>
                                )}
                                
                                <ToggleSwitch checked={policy.isEnabled} onChange={() => togglePolicy(policy.id)} />
                                
                                <Button 
                                    size="xs" 
                                    variant="ghost" 
                                    className="text-slate-400 hover:text-indigo-600" 
                                    onClick={() => onNavigateToViolations({ showViolationsOnly: true, violatedPolicyId: policy.id })} 
                                    title="Filter Inventory by this policy"
                                >
                                    <Filter className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
         </div>
      )}

      {/* Editor Modal */}
      <PolicyEditorModal 
         isOpen={isModalOpen}
         onClose={() => setIsModalOpen(false)}
         onSave={handleSavePolicy}
         initialPolicy={editingPolicy}
         availableCategories={availableCategories}
      />
    </div>
  );
};

const CategoryCard = ({ title, icon: Icon, count, color, bg, onClick }: any) => (
    <div 
        onClick={onClick}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all group hover:border-indigo-300 dark:hover:border-indigo-700"
    >
        <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{count}</div>
        <div className="text-xs text-slate-500">Violations Detected</div>
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-4 overflow-hidden">
            <div className={`h-full ${bg} opacity-80 group-hover:opacity-100 transition-opacity`} style={{ width: `${Math.min(100, count * 5)}%` }}></div>
        </div>
        <div className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">{title}</div>
    </div>
);
