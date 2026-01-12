
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GceResource, GcpCredentials, LabelHistoryEntry, TaxonomyRule, GovernancePolicy } from '../types';
import { fetchAllResources, updateResourceLabels as updateResourceLabelsApi } from '../services/gcpService';
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

  const bulkUpdateLabels = useCallback(async (
    credentials: GcpCredentials,
    updates: Map<string, Record<string, string>>
  ) => {
     const idsToUpdate = Array.from(updates.keys());
     const count = idsToUpdate.length;
     
     // 1. Mark all as updating
     setResources(prev => prev.map(r => updates.has(r.id) ? { ...r, isUpdating: true } : r));
     setBatchProgress({ processed: 0, total: count });

     // 2. Process in chunks
     const BATCH_SIZE = 10; 
     let processed = 0;
     let success = 0;
     let failed = 0;

     // Helper to update a chunk
     const processChunk = async (ids: string[]) => {
        const promises = ids.map(async (id) => {
            const res = resources.find(r => r.id === id);
            const labels = updates.get(id);
            if (!res || !labels) return;

            try {
                if (credentials.accessToken !== 'demo-mode') {
                    await updateResourceLabelsApi(credentials.projectId, credentials.accessToken, res, labels);
                } else {
                    await new Promise(r => setTimeout(r, 100)); // fast mock
                }
                
                // Update local state immediately for this item
                setResources(prev => prev.map(r => {
                    if (r.id === id) {
                        return { ...r, labels, isUpdating: false, proposedLabels: undefined };
                    }
                    return r;
                }));
                success++;
            } catch (e) {
                failed++;
                setResources(prev => prev.map(r => r.id === id ? { ...r, isUpdating: false } : r));
            } finally {
                processed++;
                setBatchProgress({ processed, total: count });
            }
        });
        await Promise.all(promises);
     };

     // Chunk loop
     for (let i = 0; i < count; i += BATCH_SIZE) {
         await processChunk(idsToUpdate.slice(i, i + BATCH_SIZE));
     }

     addNotification(`Batch finished: ${success} ok, ${failed} failed`, failed > 0 ? 'info' : 'success');
     setTimeout(() => setBatchProgress(null), 3000);

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
