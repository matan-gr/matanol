
import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, ToggleSwitch } from './DesignSystem';
import { GceResource } from '../types';
import { generateTerraformCode, generateTerraformImports, generatePulumiCode, generateGcloudScript } from '../services/iacService';
import { Copy, Check, Download, Code, Terminal, BookOpen, AlertTriangle, ArrowRight, ShieldCheck, Box, Layers, Zap } from 'lucide-react';

interface TerraformExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    resources: GceResource[];
    projectId: string;
}

type Format = 'TERRAFORM' | 'PULUMI' | 'CLI' | 'IMPORT';

export const TerraformExportModal: React.FC<TerraformExportModalProps> = ({ isOpen, onClose, resources, projectId }) => {
    const [format, setFormat] = useState<Format>('TERRAFORM');
    const [tfMode, setTfMode] = useState<'FULL' | 'LABELS_ONLY'>('LABELS_ONLY');
    const [code, setCode] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        switch (format) {
            case 'TERRAFORM':
                setCode(generateTerraformCode(resources, projectId, tfMode));
                break;
            case 'PULUMI':
                setCode(generatePulumiCode(resources, projectId));
                break;
            case 'CLI':
                setCode(generateGcloudScript(resources, projectId));
                break;
            case 'IMPORT':
                setCode(generateTerraformImports(resources, projectId));
                break;
        }
    }, [isOpen, format, tfMode, resources, projectId]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const element = document.createElement("a");
        const file = new Blob([code], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        
        let ext = '.txt';
        if (format === 'TERRAFORM') ext = '.tf';
        if (format === 'PULUMI') ext = '.ts';
        if (format === 'CLI' || format === 'IMPORT') ext = '.sh';

        element.download = `governance_fix_${projectId}${ext}`;
        document.body.appendChild(element);
        element.click();
    };

    const getFormatColor = (f: Format) => {
        if (format === f) return 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm ring-1 ring-indigo-500/20';
        return 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Drift Remediation & IaC Export" size="3xl" noPadding>
            <div className="flex flex-col lg:flex-row h-[75vh]">
                
                {/* Left: Configuration & Code */}
                <div className="flex-1 flex flex-col p-6 min-w-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    
                    {/* Toolbar */}
                    <div className="flex flex-col gap-4 mb-4 shrink-0">
                        <div className="flex justify-between items-center">
                            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                                <button onClick={() => setFormat('TERRAFORM')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${getFormatColor('TERRAFORM')}`}>
                                    <Box className="w-3.5 h-3.5" /> Terraform
                                </button>
                                <button onClick={() => setFormat('PULUMI')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${getFormatColor('PULUMI')}`}>
                                    <Layers className="w-3.5 h-3.5" /> Pulumi
                                </button>
                                <button onClick={() => setFormat('CLI')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${getFormatColor('CLI')}`}>
                                    <Terminal className="w-3.5 h-3.5" /> CLI Script
                                </button>
                                <button onClick={() => setFormat('IMPORT')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${getFormatColor('IMPORT')}`}>
                                    <Code className="w-3.5 h-3.5" /> Import
                                </button>
                            </div>
                            <Badge variant="neutral">{resources.length} Resources</Badge>
                        </div>

                        {/* Sub-options for Terraform */}
                        {format === 'TERRAFORM' && (
                            <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-indigo-500" />
                                    <span className="text-xs font-medium text-indigo-900 dark:text-indigo-200">Export Mode:</span>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setTfMode('LABELS_ONLY')}
                                        className={`text-[10px] px-2 py-1 rounded font-bold transition-colors ${tfMode === 'LABELS_ONLY' ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-800'}`}
                                    >
                                        Patch (Labels Only)
                                    </button>
                                    <button 
                                        onClick={() => setTfMode('FULL')}
                                        className={`text-[10px] px-2 py-1 rounded font-bold transition-colors ${tfMode === 'FULL' ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-800'}`}
                                    >
                                        Full Resource
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Code Editor Area */}
                    <div className="relative flex-1 group min-h-0 flex flex-col">
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button 
                                onClick={handleCopy}
                                className="p-2 bg-slate-700/80 hover:bg-slate-600 text-white rounded-md shadow-sm backdrop-blur-sm transition-colors"
                                title="Copy to Clipboard"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="bg-[#1e1e1e] rounded-t-xl border-b border-slate-700 px-4 py-2 flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono ml-2">
                                {format === 'TERRAFORM' ? 'main.tf' : format === 'PULUMI' ? 'index.ts' : 'remediate.sh'}
                            </span>
                        </div>
                        <pre className="flex-1 overflow-auto p-4 rounded-b-xl bg-[#1e1e1e] text-blue-100 font-mono text-[11px] leading-relaxed border border-slate-200 dark:border-slate-800 shadow-inner custom-scrollbar">
                            <code>{code}</code>
                        </pre>
                    </div>

                    <div className="flex justify-between items-center mt-4 shrink-0">
                        <span className="text-[10px] text-slate-400">Generated for {projectId}</span>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={onClose}>Close</Button>
                            <Button variant="primary" onClick={handleDownload} leftIcon={<Download className="w-4 h-4" />}>
                                Download
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right: Guide Sidebar */}
                <div className="w-full lg:w-80 bg-white dark:bg-slate-900 p-6 overflow-y-auto custom-scrollbar shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-6 text-indigo-600 dark:text-indigo-400">
                        <BookOpen className="w-5 h-5" />
                        <h3 className="font-bold text-sm uppercase tracking-wide">Drift Remediation Guide</h3>
                    </div>

                    <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400">
                        
                        {format === 'TERRAFORM' && (
                            <>
                                <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-200 dark:border-indigo-900/30 shadow-sm">
                                    <h4 className="font-bold text-indigo-900 dark:text-indigo-200 mb-2 flex items-center gap-2 text-xs">
                                        <Zap className="w-3.5 h-3.5 text-amber-500" /> Pro Tip: Use Patch Mode
                                    </h4>
                                    <p className="text-xs leading-relaxed text-indigo-800 dark:text-indigo-300">
                                        Avoid rewriting your entire resource configuration. Use <strong>Patch Mode</strong> to generate clean <code>labels = {"{...}"}</code> blocks that you can safely paste into your existing Terraform modules.
                                    </p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-wider">Workflow</h4>
                                    <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900"></div>
                                            <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs mb-1">1. Update Code</h5>
                                            <p className="text-xs">Copy the labels block into your <code>.tf</code> file.</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-900"></div>
                                            <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs mb-1">2. Verify</h5>
                                            <p className="text-xs">Run <code>terraform plan</code>. It should match the live state you configured here.</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {format === 'CLI' && (
                            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg border border-red-200 dark:border-red-900/30">
                                <h4 className="font-bold text-red-800 dark:text-red-300 text-xs mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> Immediate Application
                                </h4>
                                <p className="text-xs leading-relaxed text-red-700 dark:text-red-200">
                                    This script uses <code>gcloud</code> to directly modify resources. Use this for emergency governance fixes. Ensure you are authenticated via <code>gcloud auth login</code>.
                                </p>
                            </div>
                        )}

                        {format === 'IMPORT' && (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-lg">
                                <h4 className="font-bold text-emerald-700 dark:text-emerald-400 text-xs mb-1 flex items-center gap-2">
                                    <ShieldCheck className="w-3 h-3" /> Safe Onboarding
                                </h4>
                                <p className="text-[10px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                                    Use these commands to bring unmanaged "Shadow IT" resources into Terraform state for the first time without downtime.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
