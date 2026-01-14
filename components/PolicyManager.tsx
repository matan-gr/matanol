
import React, { useState, useMemo } from 'react';
import { GovernancePolicy, TaxonomyRule, GceResource, PolicyCategory, PolicySeverity, FilterConfig, PolicyRuleConfig, RuleType } from '../types';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, BookOpen, 
  Plus, Trash2, Edit3, Save, X, Lightbulb, Check, Info, ArrowRight,
  PieChart, DollarSign, Lock, Activity, Eye, Filter, Settings
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
    initialPolicy 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    onSave: (p: GovernancePolicy) => void,
    initialPolicy?: GovernancePolicy
}) => {
    const [name, setName] = useState(initialPolicy?.name || '');
    const [description, setDescription] = useState(initialPolicy?.description || '');
    const [category, setCategory] = useState<PolicyCategory>(initialPolicy?.category || 'OPERATIONS');
    const [severity, setSeverity] = useState<PolicySeverity>(initialPolicy?.severity || 'WARNING');
    
    const [ruleType, setRuleType] = useState<RuleType>(initialPolicy?.ruleConfig?.type || 'REQUIRED_LABEL');
    const [params, setParams] = useState(initialPolicy?.ruleConfig?.params || { key: '', values: [], regex: '' });

    if (!isOpen) return null;

    const handleSave = () => {
        if (!name || !description) return;
        
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
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Category</label>
                        <Select value={category} onChange={e => setCategory(e.target.value as any)}>
                            <option value="OPERATIONS">Operations</option>
                            <option value="SECURITY">Security</option>
                            <option value="COST">Cost</option>
                        </Select>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Severity</label>
                        <Select value={severity} onChange={e => setSeverity(e.target.value as any)}>
                            <option value="INFO">Info</option>
                            <option value="WARNING">Warning</option>
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
  const [selectedCategory, setSelectedCategory] = useState<PolicyCategory | 'ALL'>('ALL');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<GovernancePolicy | undefined>(undefined);

  // Compute Compliance Statistics
  const stats = useMemo(() => {
    const totalResources = resources.length || 1;
    const violatedResources = resources.filter(r => (r.violations?.length || 0) > 0).length;
    const cleanResources = totalResources - violatedResources;
    const score = Math.round((cleanResources / totalResources) * 100);
    
    // Category Breakdown
    const byCategory = {
        SECURITY: 0,
        COST: 0,
        OPERATIONS: 0
    };

    resources.forEach(r => {
        r.violations?.forEach(v => {
            const policy = policies.find(p => p.id === v.policyId);
            if (policy) {
                byCategory[policy.category]++;
            }
        });
    });

    return { score, violatedResources, cleanResources, totalResources, byCategory };
  }, [resources, policies]);

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

            {/* Category Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <CategoryCard 
                  title="Security Posture" 
                  icon={Lock} 
                  count={stats.byCategory.SECURITY} 
                  color="text-amber-500" 
                  bg="bg-amber-500"
                  onClick={() => { setSelectedCategory('SECURITY'); setActiveTab('policies'); }}
               />
               <CategoryCard 
                  title="Cost Efficiency" 
                  icon={DollarSign} 
                  count={stats.byCategory.COST} 
                  color="text-emerald-500" 
                  bg="bg-emerald-500"
                  onClick={() => { setSelectedCategory('COST'); setActiveTab('policies'); }}
               />
               <CategoryCard 
                  title="Operational Standards" 
                  icon={Activity} 
                  count={stats.byCategory.OPERATIONS} 
                  color="text-blue-500" 
                  bg="bg-blue-500"
                  onClick={() => { setSelectedCategory('OPERATIONS'); setActiveTab('policies'); }}
               />
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
               {['ALL', 'SECURITY', 'COST', 'OPERATIONS'].map(cat => (
                  <button
                     key={cat}
                     onClick={() => setSelectedCategory(cat as any)}
                     className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                     {cat === 'ALL' ? 'All Policies' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                  </button>
               ))}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredPolicies.map(policy => (
                    <div key={policy.id} className={`p-5 rounded-xl border transition-all flex flex-col md:flex-row md:items-center gap-6 ${policy.isEnabled ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60 grayscale'}`}>
                        {/* Icon & Info */}
                        <div className="flex items-start gap-4 flex-1">
                            <div className={`p-3 rounded-xl shrink-0 ${policy.category === 'SECURITY' ? 'bg-amber-100 text-amber-600' : policy.category === 'COST' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'} dark:bg-opacity-20`}>
                                {policy.category === 'SECURITY' ? <Lock className="w-5 h-5" /> : policy.category === 'COST' ? <DollarSign className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h4 className="font-bold text-slate-900 dark:text-white">{policy.name}</h4>
                                    <Badge variant={policy.severity === 'CRITICAL' ? 'error' : policy.severity === 'WARNING' ? 'warning' : 'info'} className="text-[9px]">
                                        {policy.severity}
                                    </Badge>
                                    {policy.isCustom && <Badge variant="purple" className="text-[9px]">Custom</Badge>}
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
                ))}
            </div>
         </div>
      )}

      {/* Editor Modal */}
      <PolicyEditorModal 
         isOpen={isModalOpen}
         onClose={() => setIsModalOpen(false)}
         onSave={handleSavePolicy}
         initialPolicy={editingPolicy}
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
