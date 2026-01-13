
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
  const [batchProgress, setBatchProgress] = useState<{ processed: number, total: number } | null>(null);
  
  const [taxonomy, setTaxonomy] = useState<TaxonomyRule[]>(DEFAULT_TAXONOMY);
  const [activePolicies, setActivePolicies] = useState<GovernancePolicy[]>(getPolicies(DEFAULT_TAXONOMY));

  const currentCredentials = useRef<GcpCredentials | null>(null);
  // Ref for temporary storage of incoming stream data to debounce re-renders
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
    pendingResources.current = []; // Clear buffer
    currentCredentials.current = credentials;
    
    try {
      setLoadingStatus({ progress: 15, message: 'Initializing Security Context...' });
      await persistenceService.init(credentials.projectId, credentials.accessToken);

      setLoadingStatus({ progress: 20, message: 'Starting Resource Discovery...' });
      
      // STREAMING IMPLEMENTATION
      await fetchAllResources(
        credentials.projectId, 
        credentials.accessToken,
        (newChunk, source) => {
           // Buffer the data
           pendingResources.current = [...pendingResources.current, ...newChunk];
           
           // Immediate feedback in status bar, but debounce the heavy React render
           setLoadingStatus(prev => ({
               progress: Math.min(95, prev.progress + 5),
               message: `Discovered ${pendingResources.current.length} resources (${source})...`
           }));
        }
      );
      
      // Flush remaining buffer
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

  // Debounce Effect: Updates the main 'resources' state from the 'pendingResources' ref
  // This prevents UI freezing when thousands of resources arrive in rapid chunks.
  useEffect(() => {
    if (!isConnecting) return;

    const interval = setInterval(() => {
        if (pendingResources.current.length > resources.length) {
            setResources([...pendingResources.current]);
        }
    }, 500); // Update UI max every 500ms during load

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
    
    await new Promise(r => setTimeout(r, 800)); // Simulate network
    
    const demoResources = generateMockResources(150); // Increased for enterprise feel
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
    if (!window.aistudio) return;
    setIsAnalysing(true);
    addNotification('AI Auditor initiated. Scanning inventory...', 'info');
    
    try {
      const unlabeled = resources.filter(r => Object.keys(r.labels).length === 0).slice(0, 50); // Analyze top 50 to save tokens
      
      if (unlabeled.length === 0) {
        addNotification('Inventory is fully labeled. Generating report only.', 'info');
      } else {
        // Only run detailed analysis if there are unlabeled items
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
      
    } catch (error) {
      addNotification('AI Analysis failed. Check API Key.', 'error');
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

    // Optimistic UI Update
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

      setResources(prev => prev.map(r => {
        if (r.id === resourceId) {
          return {
            ...r,
            labels: newLabels,
            proposedLabels: undefined,
            history: [historyEntry, ...(r.history || [])],
            isUpdating: false
          };
        }
        return r;
      }));

      addNotification(`Updated ${resource.name}`, 'success');
    } catch (error: any) {
      setResources(prev => prev.map(r => r.id === resourceId ? { ...r, isUpdating: false } : r));
      addNotification(`Update failed: ${error.message}`, 'error');
    }
  }, [resources, addNotification]);

  /**
   * Atomic Bulk Update with Rollback Support
   */
  const bulkUpdateLabels = useCallback(async (
    credentials: GcpCredentials,
    updates: Map<string, Record<string, string>>
  ) => {
     const idsToUpdate = Array.from(updates.keys());
     const count = idsToUpdate.length;
     
     // Snapshot original state for rollback capability
     const originalStates = new Map<string, Record<string, string>>();
     resources.forEach(r => {
         if (updates.has(r.id)) {
             originalStates.set(r.id, { ...r.labels });
         }
     });

     // 1. Mark all as updating (Optimistic Visuals)
     setResources(prev => prev.map(r => updates.has(r.id) ? { ...r, isUpdating: true } : r));
     setBatchProgress({ processed: 0, total: count });

     const successfulUpdates: string[] = [];
     let errorOccurred = null;

     // 2. Process sequentially in chunks to allow stopping on error
     const BATCH_SIZE = 5; 
     
     for (let i = 0; i < count; i += BATCH_SIZE) {
         if (errorOccurred) break;

         const chunkIds = idsToUpdate.slice(i, i + BATCH_SIZE);
         const promises = chunkIds.map(async (id) => {
             if (errorOccurred) return; 

             const res = resources.find(r => r.id === id);
             const labels = updates.get(id);
             if (!res || !labels) return;

             try {
                 if (credentials.accessToken !== 'demo-mode') {
                     await updateResourceLabelsApi(credentials.projectId, credentials.accessToken, res, labels);
                 } else {
                     await new Promise(r => setTimeout(r, 100)); 
                 }
                 successfulUpdates.push(id);
             } catch (e: any) {
                 errorOccurred = e;
                 throw e; 
             }
         });

         try {
             await Promise.all(promises);
             setBatchProgress({ processed: Math.min(i + BATCH_SIZE, count), total: count });
         } catch (e) {
             errorOccurred = e;
             break; 
         }
     }

     if (errorOccurred) {
         addNotification(`Transaction failed. Rolling back ${successfulUpdates.length} changes...`, 'warning');
         setBatchProgress({ processed: successfulUpdates.length, total: successfulUpdates.length }); // Indication of rollback work

         // --- ROLLBACK PHASE ---
         // We must revert successful updates to their original state to ensure atomicity.
         for (const id of successfulUpdates) {
             const res = resources.find(r => r.id === id);
             const originalLabels = originalStates.get(id);
             
             if (res && originalLabels) {
                 try {
                     if (credentials.accessToken !== 'demo-mode') {
                         // IMPORTANT: We must fetch the FRESH resource to get the updated fingerprint 
                         // caused by the "successful" update we are now undoing.
                         const freshResource = await fetchResource(credentials.projectId, credentials.accessToken, res);
                         if (freshResource) {
                             await updateResourceLabelsApi(credentials.projectId, credentials.accessToken, freshResource, originalLabels);
                         }
                     }
                 } catch (rollbackError) {
                     console.error(`Critical: Failed to rollback resource ${id}`, rollbackError);
                     addNotification(`Rollback failed for ${res.name}. Manual check required.`, 'error');
                 }
             }
         }

         // Reset UI state to original (remove isUpdating flag)
         setResources(prev => prev.map(r => {
             if (updates.has(r.id)) {
                 return { ...r, isUpdating: false };
             }
             return r;
         }));
         
         addNotification('Transaction aborted. All changes reverted.', 'error');

     } else {
         // --- COMMIT PHASE ---
         // Success - Update UI and History locally
         setResources(prev => prev.map(r => {
             if (updates.has(r.id)) {
                 const newLabels = updates.get(r.id)!;
                 return { 
                     ...r, 
                     labels: newLabels, 
                     isUpdating: false, 
                     proposedLabels: undefined,
                     history: [
                         {
                             timestamp: new Date(),
                             actor: 'User (Batch)',
                             changeType: 'UPDATE',
                             previousLabels: originalStates.get(r.id) || {},
                             newLabels: newLabels
                         },
                         ...(r.history || [])
                     ]
                 };
             }
             return r;
         }));
         
         addNotification(`Transaction successful. Updated ${count} resources.`, 'success');
     }

     setTimeout(() => setBatchProgress(null), 1000);

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
