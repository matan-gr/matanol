
import React from 'react';
import { GceResource } from '../types';
import { 
  History, ArrowRight, Wand2, User, Clock, GitCommit, FileDiff, Trash2 
} from 'lucide-react';
import { Modal, Badge } from './DesignSystem';

interface AuditHistoryModalProps {
    resource: GceResource | null;
    onClose: () => void;
}

export const AuditHistoryModal = ({ resource, onClose }: AuditHistoryModalProps) => {
    if (!resource) return null;

    const formatTime = (ts: Date) => {
        return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
    };

    return (
        <Modal 
          isOpen={!!resource} 
          onClose={onClose} 
          title={`Label History for ${resource.name}`}
        >
           <div className="p-2 space-y-8 relative">
              {/* Timeline Vertical Line */}
              <div className="absolute left-[28px] top-6 bottom-6 w-0.5 bg-slate-200 dark:bg-slate-800"></div>
              
              {(!resource.history || resource.history.length === 0) && (
                 <div className="text-center py-12 text-slate-500 italic relative z-10 bg-transparent">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <History className="w-8 h-8 opacity-50" />
                    </div>
                    No label changes recorded for this resource yet.
                 </div>
              )}

              {resource.history?.map((entry, i) => (
                 <div key={i} className="relative z-10 flex gap-4 group">
                    {/* Timeline Node */}
                    <div className="shrink-0 pt-1">
                        <div className={`
                            w-14 h-14 rounded-full border-4 border-white dark:border-slate-900 shadow-md flex items-center justify-center relative
                            ${entry.changeType === 'APPLY_PROPOSAL' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}
                        `}>
                            {entry.changeType === 'APPLY_PROPOSAL' ? <Wand2 className="w-6 h-6" /> : <GitCommit className="w-6 h-6" />}
                        </div>
                    </div>

                    {/* Card Content */}
                    <div className="flex-1 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow">
                       <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-slate-800/50 pb-3">
                          <div>
                             <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                {entry.changeType === 'APPLY_PROPOSAL' ? 'AI Auto-Labeling' : 
                                 entry.changeType === 'REVERT' ? 'Reverted Changes' : 'Manual Update'}
                             </h4>
                             <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {formatTime(entry.timestamp)}
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <User className="w-3 h-3" /> {entry.actor}
                                </span>
                             </div>
                          </div>
                          <Badge variant="neutral">{entry.changeType}</Badge>
                       </div>
                       
                       <div className="space-y-3">
                          <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 tracking-wider">
                             <FileDiff className="w-3 h-3" /> Changes
                          </div>
                          
                          {/* Label Diffs */}
                          {Object.keys(entry.newLabels).map(k => {
                             const oldVal = entry.previousLabels[k];
                             const newVal = entry.newLabels[k];
                             if (oldVal === newVal) return null;

                             return (
                                <div key={k} className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                   <div className="font-mono text-slate-500 break-all text-right pr-2 border-r border-slate-200 dark:border-slate-800">
                                      {k}
                                   </div>
                                   <ArrowRight className="w-3 h-3 text-slate-300" />
                                   <div className="flex items-center gap-2 overflow-hidden">
                                      {oldVal ? (
                                         <span className="line-through text-red-400 opacity-60 truncate max-w-[80px] text-[10px]">{oldVal}</span>
                                      ) : (
                                         <span className="text-slate-300 italic text-[10px]">null</span>
                                      )}
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono truncate">{newVal}</span>
                                   </div>
                                </div>
                             )
                          })}
                          
                          {Object.keys(entry.previousLabels).map(k => {
                             if (entry.newLabels[k] === undefined) {
                                return (
                                   <div key={k} className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center text-xs p-2 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
                                      <div className="font-mono text-slate-500 break-all text-right pr-2 border-r border-red-200 dark:border-red-900/30">
                                         {k}
                                      </div>
                                      <ArrowRight className="w-3 h-3 text-red-300" />
                                      <span className="text-red-500 italic flex items-center gap-1">
                                         <Trash2 className="w-3 h-3" /> removed
                                      </span>
                                   </div>
                                )
                             }
                             return null;
                          })}
                       </div>
                    </div>
                 </div>
              ))}
           </div>
        </Modal>
    );
};
