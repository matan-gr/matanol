
import React, { useState, useEffect } from 'react';
import { SectionHeader, Card, ToggleSwitch, Select, Button } from './DesignSystem';
import { Save, AlertTriangle, CheckCircle2, Shield, Globe, Clock, Sliders } from 'lucide-react';
import { APP_VERSION } from '../constants';
import { AppSettings } from '../types';
import { motion, Variants } from 'framer-motion';

interface SettingsPageProps {
    projectId: string;
    settings: AppSettings;
    onUpdate: (s: AppSettings) => void;
}

export const SettingsPage = ({ projectId, settings, onUpdate }: SettingsPageProps) => {
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleSave = () => {
        onUpdate(localSettings);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
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
                                value={localSettings.defaultRegion}
                                onChange={(e) => setLocalSettings({...localSettings, defaultRegion: e.target.value})}
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
                                <Clock className="w-4 h-4 text-slate-400" /> Auto-Analyze
                            </label>
                            <div className="flex items-center gap-3">
                                <ToggleSwitch 
                                    checked={localSettings.autoAnalyze}
                                    onChange={(v) => setLocalSettings({...localSettings, autoAnalyze: v})}
                                />
                                <span className="text-xs text-slate-500">Run AI Audit on connection</span>
                            </div>
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
                            <span className="text-slate-500 dark:text-slate-400">Config Sync</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> GCS Bucket
                            </span>
                        </div>
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
                    {isSaved ? 'Saved to Cloud' : 'Save Config'}
                </Button>
            </motion.div>
        </motion.div>
    );
};
