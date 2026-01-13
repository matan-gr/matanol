
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { LogEntry } from '../types';
import { 
  Terminal, Download, RefreshCw, User, Box, Activity, 
  ChevronRight, ChevronDown, FileText, Monitor, Globe, 
  AlertOctagon, AlertTriangle, Search, Info, Code, FileJson
} from 'lucide-react';
import { Button, Input, Badge } from './DesignSystem';
import { motion, AnimatePresence } from 'framer-motion';

interface LogViewerProps {
  logs: LogEntry[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

// --- Helpers ---

const getMethodLabel = (methodName: string) => {
  const parts = methodName.split('.');
  const action = parts.pop();
  const resource = parts.pop();
  
  // Custom Mappings
  if (methodName.includes('setLabels')) return 'Update Labels';
  if (methodName.includes('insert')) return `Create ${resource?.replace(/s$/, '')}`;
  if (methodName.includes('delete')) return `Delete ${resource?.replace(/s$/, '')}`;
  if (methodName.includes('stop')) return `Stop ${resource?.replace(/s$/, '')}`;
  if (methodName.includes('start')) return `Start ${resource?.replace(/s$/, '')}`;
  
  // Fallback: Humanize PascalCase or camelCase
  return (action || methodName).replace(/([A-Z])/g, ' $1').trim();
};

const ServiceIcon = ({ service }: { service?: string }) => {
  if (service?.includes('compute')) return <Activity className="w-3.5 h-3.5 text-blue-500" />;
  if (service?.includes('storage')) return <Box className="w-3.5 h-3.5 text-yellow-500" />;
  if (service?.includes('sql')) return <Activity className="w-3.5 h-3.5 text-cyan-500" />; // Database icon not available in this scope, reused Activity
  return <Terminal className="w-3.5 h-3.5 text-slate-400" />;
};

const JsonTree = ({ data }: { data: any }) => (
  <pre className="font-mono text-[10px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-all bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
    {JSON.stringify(data, null, 2)}
  </pre>
);

export const LogViewer: React.FC<LogViewerProps> = React.memo(({ logs, onRefresh, isLoading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Filter Logic
  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const lower = search.toLowerCase();
    return logs.filter(l => 
        l.methodName.toLowerCase().includes(lower) || 
        l.principalEmail.toLowerCase().includes(lower) || 
        l.resourceName.toLowerCase().includes(lower) ||
        (l.status && l.status.message && l.status.message.toLowerCase().includes(lower))
    );
  }, [logs, search]);

  // Scroll Handling
  useEffect(() => {
    if (autoScroll && scrollRef.current && !expandedId && !search) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll, expandedId, search]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (isAtBottom !== autoScroll) setAutoScroll(isAtBottom);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full ring-1 ring-slate-900/5">
      
      {/* 1. Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 shrink-0 gap-4">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
              <Terminal className="w-4 h-4 text-slate-500 dark:text-slate-400" />
           </div>
           <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Audit Trail</h3>
              <p className="text-[10px] text-slate-500 font-medium">{filteredLogs.length} events logged</p>
           </div>
        </div>

        <div className="flex-1 max-w-md">
           <Input 
              placeholder="Search logs (method, user, resource)..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              icon={<Search className="w-3.5 h-3.5" />}
              className="bg-white dark:bg-slate-900 h-9 text-xs"
           />
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
             <Button 
                variant="outline" 
                size="sm" 
                onClick={onRefresh} 
                disabled={isLoading}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
                className="bg-white dark:bg-slate-900"
             >
                Refresh
             </Button>
          )}
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-slate-500">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* 2. List Header */}
      <div className="grid grid-cols-[40px_120px_1fr_1.5fr_1.5fr] gap-4 px-4 py-2 bg-slate-100 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800 pr-6 shrink-0 tracking-wider">
         <div className="text-center">#</div>
         <div>Timestamp</div>
         <div>Action</div>
         <div>Resource</div>
         <div>Actor</div>
      </div>

      {/* 3. Log List */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-0 font-sans text-xs divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-950 scroll-smooth"
      >
        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
             <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                <Search className="w-6 h-6 opacity-30" />
             </div>
             <p>No matching logs found</p>
          </div>
        )}

        {filteredLogs.map((log) => {
          const isExpanded = expandedId === log.id;
          const isError = log.severity === 'ERROR' || log.severity === 'CRITICAL' || (log.status && log.status.code !== 0);
          const methodLabel = getMethodLabel(log.methodName);

          return (
            <div key={log.id} className="group">
              <div 
                onClick={() => toggleExpand(log.id)}
                className={`
                   grid grid-cols-[40px_120px_1fr_1.5fr_1.5fr] gap-4 px-4 py-3 cursor-pointer transition-all items-center border-l-2
                   ${isExpanded 
                     ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-blue-500' 
                     : isError 
                        ? 'border-l-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/10' 
                        : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900/40'}
                `}
              >
                {/* Icon Column */}
                <div className="flex justify-center">
                    <div className={`
                       w-6 h-6 rounded-md flex items-center justify-center 
                       ${isError ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}
                    `}>
                        {isError ? <AlertOctagon className="w-3.5 h-3.5" /> : <ServiceIcon service={log.serviceName} />}
                    </div>
                </div>

                {/* Time */}
                <div className="flex flex-col text-slate-500 dark:text-slate-400">
                  <span className="font-mono text-[11px] font-medium">{log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                  <span className="text-[9px] opacity-70">{log.timestamp.toLocaleDateString()}</span>
                </div>
                
                {/* Action */}
                <div className="flex items-center gap-2 min-w-0">
                   <span className={`font-semibold truncate ${isError ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {methodLabel}
                   </span>
                   {isError && <Badge variant="error" className="px-1 py-0 text-[9px]">FAIL</Badge>}
                </div>

                {/* Resource */}
                <div className="flex items-center gap-1.5 min-w-0 text-slate-600 dark:text-slate-400">
                  <Box className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  <span className="truncate font-mono text-[11px]" title={log.resourceName}>{log.resourceName}</span>
                </div>

                {/* Actor */}
                <div className="flex items-center gap-1.5 min-w-0 justify-between">
                   <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 shrink-0 opacity-50" />
                      <span className="truncate text-slate-600 dark:text-slate-400" title={log.principalEmail}>
                         {log.principalEmail.replace('serviceAccount:', '').split('@')[0]}
                      </span>
                   </div>
                   {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-300" /> : <ChevronRight className="w-3 h-3 text-slate-300" />}
                </div>
              </div>

              {/* Expanded Details Pane */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-50 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800"
                  >
                     <div className="px-14 py-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                        
                        {/* Left: Summary & Metadata */}
                        <div className="space-y-4">
                           <div>
                              <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1">
                                 <Info className="w-3 h-3" /> Event Summary
                              </h4>
                              <div className="space-y-2 text-xs">
                                 <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800 border-dashed">
                                    <span className="text-slate-500">Method</span>
                                    <code className="bg-white dark:bg-slate-900 px-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono">{log.methodName}</code>
                                 </div>
                                 <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800 border-dashed">
                                    <span className="text-slate-500">Principal</span>
                                    <span className="text-slate-700 dark:text-slate-300">{log.principalEmail}</span>
                                 </div>
                                 {log.callerIp && (
                                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800 border-dashed">
                                       <span className="text-slate-500">Caller IP</span>
                                       <span className="font-mono text-slate-700 dark:text-slate-300">{log.callerIp}</span>
                                    </div>
                                 )}
                                 {log.userAgent && (
                                    <div className="py-1">
                                       <span className="text-slate-500 block mb-1">User Agent</span>
                                       <div className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 p-1.5 rounded break-all leading-tight">
                                          {log.userAgent}
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </div>

                           {log.status && log.status.code !== 0 && (
                              <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3 rounded-lg">
                                 <div className="text-[10px] uppercase font-bold text-red-500 mb-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Error Details
                                 </div>
                                 <div className="text-xs text-red-700 dark:text-red-300 font-mono">
                                    Code {log.status.code}: {log.status.message}
                                 </div>
                              </div>
                           )}
                        </div>

                        {/* Right: Payload Inspector */}
                        <div className="space-y-2">
                           <div className="flex justify-between items-center">
                              <h4 className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                 <FileJson className="w-3 h-3" /> Request Payload
                              </h4>
                              {log.metadata && <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-500 px-1.5 rounded">JSON</span>}
                           </div>
                           
                           {log.metadata ? (
                              <JsonTree data={log.metadata} />
                           ) : (
                              <div className="h-24 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 border-dashed text-slate-400 text-xs italic">
                                 No detailed payload captured
                              </div>
                           )}
                        </div>

                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
});
