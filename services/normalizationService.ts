
import { GceResource } from '../types';
import { updateResourceLabels, fetchResource } from './gcpService';

export type NormalizationMap = Record<string, string>;

interface BatchResult {
    success: boolean;
    results: { id: string; success: boolean; error?: any }[];
    revertedCount?: number;
}

/**
 * Custom Rate Limiter (p-limit style)
 */
const createRateLimiter = (concurrency: number) => {
  const queue: (() => void)[] = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const run = queue.shift();
      if (run) run();
    }
  };

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    const waitForSlot = async () => {
      if (activeCount < concurrency) {
        activeCount++;
        return;
      }
      await new Promise<void>(resolve => queue.push(resolve));
      activeCount++;
    };

    await waitForSlot();

    try {
      return await fn();
    } finally {
      next();
    }
  };

  return run;
};

/**
 * Transactional Batch Normalizer
 * Ensures atomicity of the entire batch. If ANY update fails, it attempts to rollback ALL successful changes.
 */
export const batchNormalizeResources = async (
  resources: GceResource[],
  normalizationMap: NormalizationMap,
  projectId: string,
  accessToken: string
): Promise<BatchResult> => {
  const limit = createRateLimiter(8); // Concurrency limit
  const originalStates = new Map<string, Record<string, string>>();
  const successfulUpdates: string[] = [];
  
  // 1. Identify Targets
  const targets = resources.filter(resource => {
    return Object.values(resource.labels).some(val => 
      normalizationMap[val] && normalizationMap[val] !== val
    );
  });

  if (targets.length === 0) {
      return { success: true, results: [] };
  }

  // 2. Snapshot Original State (for rollback)
  targets.forEach(r => originalStates.set(r.id, { ...r.labels }));

  let errorOccurred = false;
  const results: { id: string; success: boolean; error?: any }[] = [];

  // 3. Execute Updates with Sequential Error Checking
  // We use Promise.all to maximize speed, but wrap it to detect failure
  const updatePromises = targets.map(resource => {
    return limit(async () => {
      if (errorOccurred) return { id: resource.id, success: false, skipped: true };

      const newLabels = { ...resource.labels };
      Object.entries(newLabels).forEach(([key, value]) => {
        if (normalizationMap[value] && normalizationMap[value] !== value) {
          newLabels[key] = normalizationMap[value];
        }
      });

      try {
        await updateResourceLabels(projectId, accessToken, resource, newLabels);
        successfulUpdates.push(resource.id);
        return { id: resource.id, success: true };
      } catch (error) {
        errorOccurred = true; // Signal abort
        console.error(`[Normalization] Failed to update ${resource.name}:`, error);
        return { id: resource.id, success: false, error };
      }
    });
  });

  const rawResults = await Promise.all(updatePromises);
  results.push(...rawResults);

  // 4. Rollback Phase (if needed)
  if (errorOccurred && successfulUpdates.length > 0) {
      console.warn(`[Normalization] Batch failed. Rolling back ${successfulUpdates.length} resources...`);
      
      const rollbackLimit = createRateLimiter(5); // Slower rollback to ensure safety
      
      const rollbackPromises = successfulUpdates.map(id => {
          return rollbackLimit(async () => {
              const res = resources.find(r => r.id === id);
              const oldLabels = originalStates.get(id);
              
              if (res && oldLabels) {
                  try {
                      // Fetch fresh fingerprint first (avoid 412 loop)
                      const fresh = await fetchResource(projectId, accessToken, res);
                      if (fresh) {
                          await updateResourceLabels(projectId, accessToken, fresh, oldLabels);
                      }
                  } catch (e) {
                      console.error(`[Normalization] Critical: Rollback failed for ${id}`, e);
                  }
              }
          });
      });

      await Promise.all(rollbackPromises);
      
      return { 
          success: false, 
          results, 
          revertedCount: successfulUpdates.length 
      };
  }

  return { success: !errorOccurred, results };
};
