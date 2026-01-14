
import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from './DesignSystem';
import { GceResource } from '../types';
import { generateTerraformCode, generateTerraformImports } from '../services/iacService';
import { Copy, Check, Download, Code, Terminal, BookOpen, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

interface TerraformExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    resources: GceResource[];
    projectId: string;
}

export const TerraformExportModal: React.FC<TerraformExportModalProps> = ({ isOpen, onClose, resources, projectId }) => {
    const [mode, setMode] = useState<'HCL' | 'IMPORT'>('HCL');
    const [code, setCode] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (mode === 'HCL') {
                setCode(generateTerraformCode(resources, projectId));
            } else {
                setCode(generateTerraformImports(resources, projectId));
            }
        }
    }, [isOpen, mode, resources, projectId]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const element = document.createElement("a");
        const file = new Blob([code], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = mode === 'HCL' ? `governance_${projectId}.tf` : `import_${projectId}.sh`;
        document.body.appendChild(element);
        element.click();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Infrastructure as Code Export" size="3xl" noPadding>
            <div className="flex flex-col lg:flex-row h-[70vh]">
                
                {/* Left: Configuration & Code */}
                <div className="flex-1 flex flex-col p-6 min-w-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button
                                onClick={() => setMode('HCL')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${mode === 'HCL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <Code className="w-4 h-4" /> Definitions (.tf)
                            </button>
                            <button
                                onClick={() => setMode('IMPORT')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${mode === 'IMPORT' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <Terminal className="w-4 h-4" /> Import Commands
                            </button>
                        </div>
                        <Badge variant="neutral">{resources.length} Resources</Badge>
                    </div>

                    <div className="relative flex-1 group min-h-0">
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button 
                                onClick={handleCopy}
                                className="p-2 bg-slate-700/80 hover:bg-slate-600 text-white rounded-md shadow-sm backdrop-blur-sm transition-colors"
                                title="Copy to Clipboard"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        <pre className="h-full overflow-auto p-4 rounded-xl bg-[#1e1e1e] text-blue-100 font-mono text-xs leading-relaxed border border-slate-200 dark:border-slate-800 shadow-inner custom-scrollbar">
                            <code>{code}</code>
                        </pre>
                    </div>

                    <div className="flex justify-end gap-3 mt-4 shrink-0">
                        <Button variant="ghost" onClick={onClose}>Close</Button>
                        <Button variant="primary" onClick={handleDownload} leftIcon={<Download className="w-4 h-4" />}>
                            Download {mode === 'HCL' ? '.tf' : '.sh'}
                        </Button>
                    </div>
                </div>

                {/* Right: Explanation & Guide */}
                <div className="w-full lg:w-80 bg-white dark:bg-slate-900 p-6 overflow-y-auto custom-scrollbar shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-4 text-indigo-600 dark:text-indigo-400">
                        <BookOpen className="w-5 h-5" />
                        <h3 className="font-bold text-sm uppercase tracking-wide">Drift Remediation</h3>
                    </div>

                    <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400">
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-900/30 shadow-sm">
                            <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2 text-xs">
                                <AlertTriangle className="w-4 h-4" /> What is Drift?
                            </h4>
                            <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300/80">
                                When you change labels in this dashboard, your Cloud state diverges from your Terraform code. The next <code>terraform apply</code> might revert your changes.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white mb-3 text-xs uppercase tracking-wider">Workflow</h4>
                            
                            <div className="relative pl-4 border-l-2 border-indigo-100 dark:border-slate-800 space-y-6">
                                <div className="relative">
                                    <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900"></div>
                                    <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs mb-1">1. Update Code</h5>
                                    <p className="text-xs">
                                        Copy the <code>labels {'{ ... }'}</code> block from the export and paste it into your existing <code>.tf</code> file for the corresponding resource.
                                    </p>
                                </div>

                                <div className="relative">
                                    <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900"></div>
                                    <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs mb-1">2. Run Plan</h5>
                                    <p className="text-xs">
                                        Run <code>terraform plan</code>. It should show <strong>No Changes</strong> if the labels match perfectly.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-lg">
                            <h4 className="font-bold text-emerald-700 dark:text-emerald-400 text-xs mb-1 flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3" /> Safe Import
                            </h4>
                            <p className="text-[10px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                                Use the <strong>Import Commands</strong> tab to generate CLI scripts for onboarding unmanaged "Shadow IT" resources into Terraform for the first time.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
