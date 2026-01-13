
import React, { useState, useEffect } from 'react';
import { SectionHeader, Card, ToggleSwitch, Select, Button } from './DesignSystem';
import { Save, RefreshCw, AlertTriangle, CheckCircle2, Shield, Globe, Clock, Sliders } from 'lucide-react';
import { Storage } from '../utils/storage';
import { APP_VERSION } from '../constants';
import { motion, Variants } from 'framer-motion';

export const SettingsPage = ({ projectId }: { projectId: string }) => {
    const defaultSettings = {
        defaultRegion: 'us-central1',
        autoRefresh: '5m',
        safetyMode: true,
        confidenceThreshold: 0.8
    };

    const [settings, setSettings] = useState(defaultSettings);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (projectId) {
            Storage.get(projectId, 'app_settings', defaultSettings).then(setSettings);
        }
    }, [projectId]);

    const handleSave = () => {
        Storage.set(projectId, 'app_settings', settings);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleClearCache = async () => {
        if (confirm("Are you sure? This will remove all saved views, local history, and preferences for this project.")) {
            await Storage.clearProjectData(projectId);
            window.location.reload();
        }
    };

    const containerVariants: Variants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
    };

    return (
        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-4xl mx-auto space-y-8 pb-20"
        >
            <SectionHeader title="Configuration" subtitle="Manage application preferences and default behaviors." />

            <div className="grid grid-cols-1 gap-6">
                {/* General Preferences */}
                <Card className="p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-slate-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">General Preferences</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                <Globe className="w-4 h-4 text-slate-400" /> Default Region Scope
                            </label>
                            <Select 
                                value={settings.defaultRegion}
                                onChange={(e) => setSettings({...settings, defaultRegion: e.target.value})}
                            >
                                <option value="global">Global (All Regions)</option>
                                <option value="us-central1">us-central1 (Iowa)</option>
                                <option value="europe-west1">europe-west1 (Belgium)</option>
                                <option value="asia-east1">asia-east1 (Taiwan)</option>
                            </Select>
                            <p className="text-xs text-slate-500 mt-2 leading-snug">
                                Sets the primary region filter when loading the Inventory or Dashboard.
                            </p>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                <Clock className="w-4 h-4 text-slate-400" /> Auto-Refresh Interval
                            </label>
                            <Select 
                                value={settings.autoRefresh}
                                onChange={(e) => setSettings({...settings, autoRefresh: e.target.value})}
                            >
                                <option value="off">Manual Only</option>
                                <option value="1m">Every 1 Minute</option>
                                <option value="5m">Every 5 Minutes</option>
                                <option value="15m">Every 15 Minutes</option>
                            </Select>
                            <p className="text-xs text-slate-500 mt-2 leading-snug">
                                Frequency of background resource polling. Higher frequency may impact API quotas.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Automation & Safety */}
                <Card className="p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-indigo-500" />
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Automation Safety</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">CORE</span>
                    </div>
                    
                    <div className="p-6 space-y-8">
                        <div className="flex items-center justify-between group">
                            <div className="pr-4">
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">Safety Mode (Dry Run)</div>
                                <div className="text-xs text-slate-500 max-w-sm leading-relaxed">
                                    When enabled, bulk updates require explicit confirmation and show a "Simulate" step before applying changes to GCP.
                                </div>
                            </div>
                            <ToggleSwitch 
                                checked={settings.safetyMode} 
                                onChange={(v) => setSettings({...settings, safetyMode: v})} 
                            />
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                    AI Confidence Threshold
                                </label>
                                <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                                    {Math.round(settings.confidenceThreshold * 100)}%
                                </span>
                            </div>
                            <div className="relative h-6 w-full flex items-center">
                                <input 
                                    type="range" 
                                    min="0.5" 
                                    max="1.0" 
                                    step="0.05"
                                    value={settings.confidenceThreshold}
                                    onChange={(e) => setSettings({...settings, confidenceThreshold: parseFloat(e.target.value)})}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Suggestions with confidence scores below this value will be hidden automatically to prevent low-quality labeling.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* System Info */}
                <Card className="p-6 bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">System Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className="text-slate-500 dark:text-slate-400">App Version</span>
                            <span className="font-mono text-slate-900 dark:text-white">{APP_VERSION}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className="text-slate-500 dark:text-slate-400">Project ID</span>
                            <span className="font-mono text-slate-900 dark:text-white break-all text-right pl-4">{projectId}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className="text-slate-500 dark:text-slate-400">Environment</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">Production</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className="text-slate-500 dark:text-slate-400">API Status</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Connected
                            </span>
                        </div>
                    </div>
                    <div className="mt-6">
                        <Button variant="danger" size="sm" onClick={handleClearCache} leftIcon={<AlertTriangle className="w-4 h-4"/>}>
                            Reset Local Cache
                        </Button>
                    </div>
                </Card>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="fixed bottom-6 right-6 z-50"
            >
                <Button 
                    variant="primary" 
                    size="lg" 
                    onClick={handleSave} 
                    className={`shadow-xl transition-all duration-300 ${isSaved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                    leftIcon={isSaved ? <CheckCircle2 className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
                >
                    {isSaved ? 'Saved Successfully' : 'Save Changes'}
                </Button>
            </motion.div>
        </motion.div>
    );
};
