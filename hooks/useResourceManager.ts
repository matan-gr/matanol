
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GceResource, GcpCredentials, LabelHistoryEntry, TaxonomyRule, GovernancePolicy } from '../types';
import { fetchAllResources, updateResourceLabels as updateResourceLabelsApi, fetchResource } from '../services/gcpService';
import { analyzeResourceBatch, generateComplianceReport } from '../services/geminiService';
import { generateMockResources } from '../services/mockService';
import { persistenceService } from '../services/persistenceService';
import { evaluateInventory, DEFAULT_TAXONOMY, getPolicies } from '../services/policyService';

export const useResourceManager = (
  addLog: (msg: string, level?: string) => void,
  addNotification: (msg: string, type?: 'success'|'error'|'info'|'warning') => void
) => {
  const [resources, setResources] = useState<GceResource[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState({ progress: 0, message: 'Ready' });
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [report, setReport] = useState<string>('');
  
  // Enhanced Batch Progress State
  const [batchProgress, setBatchProgress] = useState<{ processed: number, total: number, status: 'updating' | 'rolling-back' } | null>(null);
  
  const [taxonomy, setTaxonomy] = useState<TaxonomyRule[]>(DEFAULT_TAXONOMY);
  const [activePolicies, setActivePolicies] = useState<GovernancePolicy[]>(getPolicies(DEFAULT_TAXONOMY));

  const currentCredentials = useRef<GcpCredentials | null>(null);
  const pendingResources = useRef<GceResource[]>([]);

  // Derived state with memoization
  const governedResources = useMemo(() => {
    return evaluateInventory(resources, taxonomy, activePolicies);
  }, [resources, taxonomy, activePolicies]);

  const stats = useMemo(() => {
    const total = governedResources.length;
    const labeled = governedResources.filter(r => Object.keys(r.labels).length > 0).length;
    return { total, labeled, unlabeled: total - labeled };
  }, [governedResources]);

  const connectProject = useCallback(async (credentials: GcpCredentials) => {
    setIsConnecting(true);
    setLoadingStatus({ progress: 5, message: 'Authenticating...' });
    setResources([]); 
    pendingResources.current = []; 
    currentCredentials.current = credentials;
    
    try {
      setLoadingStatus({ progress: 15, message: 'Initializing Security Context...' });
      await persistenceService.init(credentials.projectId, credentials.accessToken);
      
      // Load history map early so we can attach it as resources stream in
      const historyMap = await persistenceService.getProjectHistory(credentials.projectId);

      setLoadingStatus({ progress: 20, message: 'Starting Resource Discovery...' });
      
      await fetchAllResources(
        credentials.projectId, 
        credentials.accessToken,
        (newChunk, source) => {
           // Hydrate chunk with persistent history
           const hydratedChunk = newChunk.map(r => ({
               ...r,
               history: historyMap[r.id] || []
           }));
           
           pendingResources.current = [...pendingResources.current, ...hydratedChunk];
           setLoadingStatus(prev => ({
               progress: Math.min(95, prev.progress + 5),
               message: `Discovered ${pendingResources.current.length} resources (${source})...`
           }));
        }
      );
      
      setResources(pendingResources.current);
      setLoadingStatus({ progress: 100, message: 'Inventory Synced.' });
      
      addLog('Discovery complete.', 'SUCCESS');
      addNotification(`Connected. Managed ${pendingResources.current.length} resources.`, 'success');
      return true;

    } catch (error: any) {
      const rawMsg = error.message || 'Unknown error';
      if (rawMsg.includes('401')) {
         addNotification('Session Expired. Please re-authenticate.', 'error');
      } else {
         addNotification(`Connection Error: ${rawMsg}`, 'error');
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [addLog, addNotification]);

  useEffect(() => {
    if (!isConnecting) return;
    const interval = setInterval(() => {
        if (pendingResources.current.length > resources.length) {
            setResources([...pendingResources.current]);
        }
    }, 500); 
    return () => clearInterval(interval);
  }, [isConnecting, resources.length]);


  const refreshResources = useCallback(async () => {
    if (!currentCredentials.current) return;
    return connectProject(currentCredentials.current);
  }, [connectProject]);

  const loadDemoData = useCallback(async () => {
    setIsConnecting(true);
    setLoadingStatus({ progress: 10, message: 'Loading Demo Environment...' });
    currentCredentials.current = { projectId: 'demo-mode', accessToken: 'demo-mode' };
    await new Promise(r => setTimeout(r, 800)); 
    const demoResources = generateMockResources(150); 
    setResources(demoResources);
    setLoadingStatus({ progress: 100, message: 'Demo Ready' });
    setIsConnecting(false);
    return true;
  }, []);

  const updateGovernance = useCallback((newTaxonomy: TaxonomyRule[], newPolicies: GovernancePolicy[]) => {
      setTaxonomy(newTaxonomy);
      setActivePolicies(newPolicies);
  }, []);

  const analyzeResources = useCallback(async () => {
    setIsAnalysing(true);
    addNotification('AI Auditor initiated. Scanning inventory...', 'info');
    
    try {
      // If AI Studio context is available (e.g. specialized environment), trigger key selection if needed.
      // Otherwise, assume process.env.API_KEY is available or will be handled by the service.
      if ((window as any).aistudio) {
         try {
             const hasKey = await (window as any).aistudio.hasSelectedApiKey();
             if(!hasKey) await (window as any).aistudio.openSelectKey();
         } catch(e) {
             console.warn("AI Studio Key selection skipped or failed", e);
         }
      }

      const unlabeled = resources.filter(r => Object.keys(r.labels).length === 0).slice(0, 50); 
      
      if (unlabeled.length === 0) {
        addNotification('Inventory is fully labeled. Generating report only.', 'info');
      } else {
        const results = await analyzeResourceBatch(unlabeled);
        setResources(prev => prev.map(res => {
            const match = results.find(r => r.resourceId === res.id);
            if (match) return { ...res, proposedLabels: match.suggestedLabels };
            return res;
        }));
        addNotification(`Analysis found ${results.length} improvement suggestions.`, 'success');
      }

      const reportText = await generateComplianceReport(resources);
      setReport(reportText);
      
    } catch (error: any) {
      console.error("Analysis Error:", error);
      addNotification(`AI Analysis failed: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setIsAnalysing(false);
    }
  }, [resources, addNotification]);

  const updateResourceLabels = useCallback(async (
    credentials: GcpCredentials, 
    resourceId: string, 
    newLabels: Record<string, string>,
    isProposal = false
  ) => {
    const resource = resources.find(r => r.id === resourceId);
    if (!resource) return;

    setResources(prev => prev.map(r => r.id === resourceId ? { ...r, isUpdating: true } : r));

    try {
      if (credentials.accessToken !== 'demo-mode') {
        await updateResourceLabelsApi(credentials.projectId, credentials.accessToken, resource, newLabels);
      } else {
        await new Promise(r => setTimeout(r, 600));
      }

      const historyEntry: LabelHistoryEntry = {
        timestamp: new Date(),
        actor: 'User',
        changeType: isProposal ? 'APPLY_PROPOSAL' : 'UPDATE',
        previousLabels: resource.labels,
        newLabels: newLabels
      };

      const updatedHistory = [historyEntry, ...(resource.history || [])];

      setResources(prev => prev.map(r => {
        if (r.id === resourceId) {
          return {
            ...r,
            labels: newLabels,
            proposedLabels: undefined,
            history: updatedHistory,
            isUpdating: false
          };
        }
        return r;
      }));

      // Persistent Save
      if (credentials.accessToken !== 'demo-mode') {
          persistenceService.saveHistory(credentials.projectId, resourceId, updatedHistory);
      }

      addNotification(`Updated ${resource.name}`, 'success');
    } catch (error: any) {
      setResources(prev => prev.map(r => r.id === resourceId ? { ...r, isUpdating: false } : r));
      addNotification(`Update failed: ${error.message}`, 'error');
    }
  }, [resources, addNotification]);

  /**
   * Atomic Bulk Update with Robust Rollback
   */
  const bulkUpdateLabels = useCallback(async (
    credentials: GcpCredentials,
    updates: Map<string, Record<string, string>>
  ) => {
     const idsToUpdate = Array.from(updates.keys());
     const count = idsToUpdate.length;
     
     // Snapshot original state
     const originalStates = new Map<string, Record<string, string>>();
     resources.forEach(r => {
         if (updates.has(r.id)) {
             originalStates.set(r.id, { ...r.labels });
         }
     });

     // 1. Optimistic UI update (Loading state only)
     setResources(prev => prev.map(r => updates.has(r.id) ? { ...r, isUpdating: true } : r));
     setBatchProgress({ processed: 0, total: count, status: 'updating' });

     const successfulUpdates: string[] = [];
     let errorOccurred: Error | null = null;

     // 2. Sequential Processing in Batches
     const BATCH_SIZE = 5; 
     
     for (let i = 0; i < count; i += BATCH_SIZE) {
         if (errorOccurred) break;

         const chunkIds = idsToUpdate.slice(i, i + BATCH_SIZE);
         
         const promises = chunkIds.map(async (id) => {
             const res = resources.find(r => r.id === id);
             const labels = updates.get(id);
             if (!res || !labels) return { id, status: 'skipped' };

             try {
                 if (credentials.accessToken !== 'demo-mode') {
                     await updateResourceLabelsApi(credentials.projectId, credentials.accessToken, res, labels);
                 } else {
                     await new Promise(r => setTimeout(r, 100)); 
                 }
                 return { id, status: 'fulfilled' };
             } catch (e: any) {
                 return { id, status: 'rejected', reason: e };
             }
         });

         const results = await Promise.all(promises);

         for (const result of results) {
             if (result.status === 'fulfilled') {
                 successfulUpdates.push(result.id as string);
             } else if (result.status === 'rejected') {
                 errorOccurred = result.reason as Error;
             }
         }

         setBatchProgress({ processed: Math.min(i + BATCH_SIZE, count), total: count, status: 'updating' });
         
         if (errorOccurred) break;
     }

     if (errorOccurred) {
         addNotification(`Transaction failed. Rolling back ${successfulUpdates.length} changes...`, 'warning');
         setBatchProgress({ processed: 0, total: successfulUpdates.length, status: 'rolling-back' }); 

         // --- ROLLBACK PHASE (Atomic Guarantee) ---
         let rollbackCount = 0;
         
         // Retry helper
         const retryRollback = async (fn: () => Promise<void>, retries = 3) => {
            for(let k=0; k<retries; k++) {
                try {
                    await fn();
                    return;
                } catch(e) {
                    if (k === retries - 1) throw e;
                    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, k)));
                }
            }
         };

         for (const id of successfulUpdates) {
             const res = resources.find(r => r.id === id);
             const originalLabels = originalStates.get(id);
             
             if (res && originalLabels) {
                 try {
                     if (credentials.accessToken !== 'demo-mode') {
                         await retryRollback(async () => {
                             // Fetch fresh fingerprint to avoid 412 Precondition Failed during rollback
                             const freshResource = await fetchResource(credentials.projectId, credentials.accessToken, res);
                             if (freshResource) {
                                 await updateResourceLabelsApi(credentials.projectId, credentials.accessToken, freshResource, originalLabels);
                             }
                         });
                     }
                     rollbackCount++;
                     setBatchProgress({ processed: rollbackCount, total: successfulUpdates.length, status: 'rolling-back' });
                 } catch (rollbackError) {
                     console.error(`Critical: Failed to rollback resource ${id}`, rollbackError);
                     addNotification(`Rollback failed for ${res.name}. State inconsistent.`, 'error');
                 }
             }
         }

         // Reset UI state to original (remove isUpdating, keep old labels)
         setResources(prev => prev.map(r => {
             if (updates.has(r.id)) {
                 return { ...r, isUpdating: false };
             }
             return r;
         }));
         
         addNotification(`Transaction aborted. ${rollbackCount}/${successfulUpdates.length} changes reverted.`, 'error');

     } else {
         // --- COMMIT PHASE ---
         // Update UI state with new labels only after full success
         
         const updatesToPersist = new Map<string, LabelHistoryEntry[]>();

         setResources(prev => prev.map(r => {
             if (updates.has(r.id)) {
                 const newLabels = updates.get(r.id)!;
                 
                 const historyEntry: LabelHistoryEntry = {
                     timestamp: new Date(),
                     actor: 'User (Batch)',
                     changeType: 'UPDATE',
                     previousLabels: originalStates.get(r.id) || {},
                     newLabels: newLabels
                 };
                 const newHistory = [historyEntry, ...(r.history || [])];
                 updatesToPersist.set(r.id, newHistory);

                 return { 
                     ...r, 
                     labels: newLabels, 
                     isUpdating: false, 
                     proposedLabels: undefined,
                     history: newHistory
                 };
             }
             return r;
         }));
         
         if (credentials.accessToken !== 'demo-mode') {
             persistenceService.bulkSaveHistory(credentials.projectId, updatesToPersist);
         }

         addNotification(`Transaction successful. Updated ${count} resources.`, 'success');
     }

     setTimeout(() => setBatchProgress(null), 1500);

  }, [resources, addNotification]);

  const revertResource = useCallback((id: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, proposedLabels: undefined } : r));
  }, []);
  const clearReport = () => setReport('');

  return {
    resources: governedResources,
    setResources,
    stats,
    isConnecting,
    loadingStatus, 
    isAnalysing,
    report,
    connectProject,
    refreshResources,
    loadDemoData,
    analyzeResources,
    updateResourceLabels,
    bulkUpdateLabels,
    revertResource,
    clearReport,
    batchProgress,
    updateGovernance
  };
};
