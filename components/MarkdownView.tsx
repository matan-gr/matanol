
import React from 'react';
import { CheckCircle2, AlertCircle, ChevronRight, Info } from 'lucide-react';

export const MarkdownView = ({ content }: { content: string }) => {
  if (!content) return null;
  
  // Robust parsing for headers, bullets, bold
  const lines = content.split('\n');
  
  return (
    <div className="space-y-4 font-sans text-slate-600 dark:text-slate-300 leading-relaxed selection:bg-indigo-100 dark:selection:bg-indigo-900/30">
      {lines.map((line, i) => {
        // H3 - Section Headers
        if (line.trim().startsWith('## ')) {
            return (
                <h3 key={i} className="text-lg font-bold text-slate-800 dark:text-white mt-8 mb-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="w-1.5 h-6 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-full"></span>
                    {line.replace('## ', '').replace(/\*\*/g, '')}
                </h3>
            );
        }
        
        // H2 - Main Headers (Executive Summary)
        if (line.trim().startsWith('# ')) {
            return (
                <h2 key={i} className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-900 dark:from-white dark:via-indigo-200 dark:to-white mt-2 mb-6 tracking-tight">
                    {line.replace('# ', '').replace(/\*\*/g, '')}
                </h2>
            );
        }

        // List Items
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
             const text = line.replace(/^[-*] /, '');
             // Determine icon based on content context
             let Icon = ChevronRight;
             let iconColor = "text-slate-400";
             let containerClass = "hover:bg-slate-50 dark:hover:bg-white/5";
             
             if (text.toLowerCase().includes('cost') || text.toLowerCase().includes('saving')) {
                 iconColor = "text-emerald-500";
             } else if (text.toLowerCase().includes('risk') || text.toLowerCase().includes('security') || text.toLowerCase().includes('exposure')) {
                 Icon = AlertCircle;
                 iconColor = "text-amber-500";
                 containerClass = "bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20";
             } else if (text.toLowerCase().includes('recommend') || text.toLowerCase().includes('action')) {
                 Icon = CheckCircle2;
                 iconColor = "text-blue-500";
             }

             // Handle bolding
             const parts = text.split(/\*\*(.*?)\*\*/g);
             return (
               <div key={i} className={`flex items-start gap-3 ml-2 p-2 rounded-lg transition-colors ${containerClass}`}>
                 <div className={`mt-1 shrink-0 ${iconColor}`}>
                    <Icon className="w-4 h-4" />
                 </div>
                 <p className="text-sm">
                    {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-slate-800 dark:text-slate-100 font-bold bg-slate-200/50 dark:bg-slate-700/50 px-1 rounded shadow-sm">{part}</strong> : part)}
                 </p>
               </div>
             );
        }

        // Empty Lines
        if (line.trim() === '') return <div key={i} className="h-2" />;
        
        // Paragraphs with Bold support
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
            <p key={i} className="text-sm text-slate-600 dark:text-slate-400">
                {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-slate-900 dark:text-white font-bold">{part}</strong> : part)}
            </p>
        );
      })}
    </div>
  );
};
