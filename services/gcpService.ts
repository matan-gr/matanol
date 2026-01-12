
import { GceResource, ResourceType, ProvisioningModel, LogEntry, QuotaEntry } from '../types';

const BASE_URL = 'https://compute.googleapis.com/compute/v1/projects';
const RUN_BASE_URL = 'https://run.googleapis.com/v2/projects';
const SQL_ADMIN_URL = 'https://sqladmin.googleapis.com/sql/v1beta4/projects';
const STORAGE_BASE_URL = 'https://storage.googleapis.com/storage/v1/b';
const CONTAINER_BASE_URL = 'https://container.googleapis.com/v1/projects';
const LOGGING_URL = 'https://logging.googleapis.com/v2/entries:list';

// --- Resilience Utilities ---

// Security: Redact sensitive data from logs
const safeLog = (message: string, error: any) => {
  const sanitize = (str: string) => str.replace(/Bearer\s+[a-zA-Z0-9\-\._~\+\/]+=*/gi, 'Bearer [REDACTED]');
  
  let errorMsg = '';
  if (error instanceof Error) {
    errorMsg = error.message;
  } else if (typeof error === 'object') {
    try {
      errorMsg = JSON.stringify(error);
    } catch {
      errorMsg = 'Unknown Error';
    }
  } else {
    errorMsg = String(error);
  }

  console.warn(sanitize(`${message}: ${errorMsg}`));
};

// Simple concurrency limiter to prevent 429 Quota Exceeded
class RateLimiter {
  private queue: (() => Promise<any>)[] = [];
  private active = 0;
  private maxConcurrency: number;

  constructor(maxConcurrency = 8) { // GCP limit is often around 10-20 concurrent reqs/sec per IP
    this.maxConcurrency = maxConcurrency;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const task = async () => {
        this.active++;
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.active--;
          this.next();
        }
      };

      if (this.active < this.maxConcurrency) {
        task();
      } else {
        this.queue.push(task);
      }
    });
  }

  private next() {
    if (this.active < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      task?.();
    }
  }
}

const apiLimiter = new RateLimiter(8);

const parseGcpError = async (response: Response): Promise<string> => {
  try {
    const errorData = await response.json();
    if (errorData?.error) {
      const code = errorData.error.code || response.status;
      const mainMsg = errorData.error.message;
      
      if (code === 403) return `Access Denied: ${mainMsg}`;
      if (code === 401) return `Session Expired`;
      if (code === 429) return `Rate Limit Exceeded`;
      
      return mainMsg || response.statusText;
    }
    return `${response.status} ${response.statusText}`;
  } catch (e) {
    return `${response.status} ${response.statusText}`;
  }
};

const fetchWithBackoff = async (
  url: string, 
  options: RequestInit, 
  retries = 3, 
  backoff = 1000
): Promise<Response> => {
  try {
    const response = await fetch(url, options);

    // Retry on 429 (Rate Limit) or 5xx (Server Error)
    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithBackoff(url, options, retries - 1, backoff * 2);
      }
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithBackoff(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
};

// --- API Implementation ---

// Generic fetcher that handles pagination automatically
const fetchPagedResource = async <T>(
  urlFactory: (pageToken?: string) => string,
  accessToken: string,
  itemsKey: string, // e.g. 'items' or 'services'
  mapper: (item: any) => T,
  method = 'GET'
): Promise<T[]> => {
  let resources: T[] = [];
  let nextPageToken: string | undefined = undefined;

  try {
    do {
      const url = urlFactory(nextPageToken);
      const response = await apiLimiter.add(() => fetchWithBackoff(url, {
        method,
        headers: { Authorization: `Bearer ${accessToken}` },
      }));

      if (!response.ok) {
        // Soft fail: return what we have so far if pagination fails halfway, 
        // unless it's auth error which is critical.
        if (response.status === 401) throw new Error("401");
        // Sanitize URL before logging warning
        const safeUrl = url.split('?')[0]; 
        console.warn(`Partial fetch failure: ${response.status} for ${safeUrl}`);
        return resources; 
      }

      const data = await response.json();
      nextPageToken = data.nextPageToken;

      const rawItems = itemsKey.split('.').reduce((obj, key) => obj?.[key], data);
      
      if (Array.isArray(rawItems)) {
        rawItems.forEach(item => {
          try {
            resources.push(mapper(item));
          } catch (e) {
            // Skip malformed items
          }
        });
      }
    } while (nextPageToken);
  } catch (error: any) {
    if (error.message === '401') throw error;
    // Otherwise swallow error to allow other resources to load
  }
  return resources;
};

// --- Resource Fetchers ---

const fetchComputeEngine = async (projectId: string, accessToken: string) => {
  // We use aggregatedList for efficiency, but it can be slow.
  // Added 'interface' to disks request
  const fields = `items/*/instances(id,name,description,machineType,cpuPlatform,status,creationTimestamp,scheduling/provisioningModel,disks(deviceName,diskSizeGb,type,boot,interface),guestAccelerators(acceleratorType,acceleratorCount),networkInterfaces(network,networkIP,accessConfigs/natIP),tags/items,serviceAccounts/email,labels,labelFingerprint),nextPageToken`;
  const url = `${BASE_URL}/${projectId}/aggregated/instances?maxResults=500&fields=${encodeURIComponent(fields)}`;
  
  const response = await apiLimiter.add(() => fetchWithBackoff(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }));

  if (!response.ok) {
    if (response.status === 401) throw new Error("401");
    // 403 likely means Compute API not enabled or no permissions. Return empty to avoid crashing app.
    return [];
  }

  const data = await response.json();
  const resources: GceResource[] = [];

  if (data.items) {
    for (const [scope, scopeData] of Object.entries(data.items)) {
      if ((scopeData as any).instances) {
        const zone = scope.replace('zones/', '').replace('regions/', '');
        (scopeData as any).instances.forEach((inst: any) => {
           // Parse machine type from URL "zones/us-central1-a/machineTypes/n1-standard-1"
           const machineTypeShort = inst.machineType?.split('/').pop() || 'unknown';
           
           resources.push({
              id: String(inst.id), // Ensure string ID
              name: inst.name,
              description: inst.description || (inst.cpuPlatform ? `CPU: ${inst.cpuPlatform}` : undefined),
              type: 'INSTANCE',
              zone: zone,
              machineType: machineTypeShort,
              status: inst.status || 'UNKNOWN',
              creationTimestamp: inst.creationTimestamp,
              provisioningModel: inst.scheduling?.provisioningModel === 'SPOT' ? 'SPOT' : 'STANDARD',
              labels: inst.labels || {},
              labelFingerprint: inst.labelFingerprint || '',
              tags: inst.tags?.items || [],
              serviceAccount: inst.serviceAccounts?.[0]?.email,
              disks: inst.disks?.map((d: any) => ({
                deviceName: d.deviceName,
                sizeGb: parseInt(d.diskSizeGb || '0', 10),
                type: d.type ? d.type.split('/').pop() : 'pd-standard',
                boot: !!d.boot,
                interface: d.interface // NVMe, SCSI
              })) || [],
              gpus: inst.guestAccelerators?.map((g: any) => ({
                  name: g.acceleratorType?.split('/').pop(),
                  count: g.acceleratorCount
              })) || [],
              ips: inst.networkInterfaces?.map((ni: any) => ({
                network: ni.network?.split('/').pop() || 'default',
                internal: ni.networkIP,
                external: ni.accessConfigs?.[0]?.natIP
              })) || [],
              history: []
           });
        });
      }
    }
  }
  return resources;
};

const fetchDisks = async (projectId: string, accessToken: string) => {
  const fields = `items/*/disks(id,name,description,sizeGb,type,status,creationTimestamp,labels,labelFingerprint,provisionedIops,provisionedThroughput),nextPageToken`;
  const url = `${BASE_URL}/${projectId}/aggregated/disks?maxResults=500&fields=${encodeURIComponent(fields)}`;
  
  const response = await apiLimiter.add(() => fetchWithBackoff(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
  if (!response.ok) return [];
  const data = await response.json();
  const resources: GceResource[] = [];

  if (data.items) {
    Object.entries(data.items).forEach(([scope, scopeData]: [string, any]) => {
      if (scopeData.disks) {
        const zone = scope.replace('zones/', '');
        scopeData.disks.forEach((disk: any) => {
           resources.push({
              id: String(disk.id),
              name: disk.name,
              description: disk.description,
              type: 'DISK',
              zone,
              sizeGb: disk.sizeGb,
              machineType: disk.type?.split('/').pop(),
              status: disk.status || 'READY',
              creationTimestamp: disk.creationTimestamp,
              provisioningModel: 'STANDARD',
              provisionedIops: disk.provisionedIops,
              provisionedThroughput: disk.provisionedThroughput,
              labels: disk.labels || {},
              labelFingerprint: disk.labelFingerprint,
              history: []
           });
        });
      }
    });
  }
  return resources;
};

// --- Incremental Loader ---

export const fetchAllResources = async (
  projectId: string,
  accessToken: string,
  onChunk: (resources: GceResource[], source: string) => void
): Promise<void> => {
  
  // We launch distinct fetchers in parallel, but rate-limited by the `apiLimiter` class internally.
  // As each fetcher completes, we pump data to the UI.

  const tasks = [
    {
      name: 'Virtual Machines',
      fn: () => fetchComputeEngine(projectId, accessToken)
    },
    {
      name: 'Persistent Disks',
      fn: () => fetchDisks(projectId, accessToken)
    },
    {
      name: 'Cloud Run Services',
      fn: () => fetchPagedResource(
        () => `${RUN_BASE_URL}/${projectId}/locations/-/services`, // Use wildcards for global discovery
        accessToken, 'services', 
        (svc: any) => {
            // Cloud Run v2 API mapping
            const container = svc.template?.containers?.[0];
            const limits = container?.resources?.limits;
            
            // Ingress mapping
            let ingress: 'all' | 'internal' = 'all';
            if (svc.ingress === 'INGRESS_TRAFFIC_INTERNAL_ONLY' || svc.ingress === 'INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER') {
                ingress = 'internal';
            }

            return {
                id: svc.name, // Full resource name as ID is safer for Cloud Run
                name: svc.name.split('/').pop(),
                description: svc.description,
                type: 'CLOUD_RUN' as ResourceType,
                zone: svc.name.split('/')[3], // locations/us-central1/services/...
                status: 'READY', // Cloud Run is always "ready" if listed, or check `conditions`
                creationTimestamp: svc.createTime,
                provisioningModel: 'STANDARD' as ProvisioningModel,
                machineType: 'Serverless',
                url: svc.uri,
                cpu: limits?.cpu,
                memory: limits?.memory,
                ingress: ingress,
                labels: svc.labels || {},
                labelFingerprint: svc.etag,
                history: []
            };
        }
      )
    },
    {
      name: 'GKE Clusters',
      fn: () => fetchPagedResource(
        () => `${CONTAINER_BASE_URL}/${projectId}/locations/-/clusters`,
        accessToken, 'clusters',
        (cluster: any) => ({
            id: cluster.name,
            name: cluster.name,
            description: cluster.description,
            type: 'GKE_CLUSTER' as ResourceType,
            zone: cluster.location,
            status: cluster.status,
            creationTimestamp: cluster.createTime,
            provisioningModel: 'STANDARD' as ProvisioningModel,
            labels: cluster.resourceLabels || {},
            labelFingerprint: cluster.labelFingerprint || '',
            clusterDetails: {
                nodeCount: cluster.currentNodeCount || 0,
                version: cluster.currentMasterVersion || 'unknown',
                endpoint: cluster.endpoint || '',
                isAutopilot: cluster.autopilot?.enabled || false,
                network: cluster.networkConfig?.network?.split('/').pop() || 'default',
                subnetwork: cluster.networkConfig?.subnetwork?.split('/').pop(),
                nodePools: cluster.nodePools?.map((np: any) => ({
                    name: np.name,
                    version: np.version,
                    status: np.status,
                    nodeCount: np.initialNodeCount || 0, // Note: autoscaled pools might have 0 initial
                    machineType: np.config?.machineType || 'auto'
                })) || []
            },
            history: []
        })
      )
    },
    {
        name: 'Cloud SQL',
        fn: () => fetchPagedResource(
            () => `${SQL_ADMIN_URL}/${projectId}/instances`,
            accessToken, 'items',
            (inst: any) => ({
                id: inst.name,
                name: inst.name,
                type: 'CLOUD_SQL' as ResourceType,
                zone: inst.gceZone || inst.region || 'global',
                machineType: inst.settings?.tier || 'db-custom',
                sizeGb: inst.settings?.dataDiskSizeGb,
                databaseVersion: inst.databaseVersion,
                status: inst.state || 'UNKNOWN',
                creationTimestamp: inst.createTime || new Date().toISOString(),
                provisioningModel: 'STANDARD' as ProvisioningModel,
                labels: inst.settings?.userLabels || {},
                labelFingerprint: inst.etag,
                history: []
            })
        )
    },
    {
        name: 'Storage Buckets',
        fn: () => fetchPagedResource(
            () => `${STORAGE_BASE_URL}?project=${projectId}`,
            accessToken, 'items',
            (bucket: any) => {
                // Heuristic for public access: 
                // if iamConfiguration.publicAccessPrevention is NOT enforced, it *might* be public via ACLs.
                // A true public check requires analyzing IAM policies which is expensive.
                // We will assume "Public" if prevention is not enforced for visibility.
                const isPublic = bucket.iamConfiguration?.publicAccessPrevention !== 'enforced';

                return {
                    id: bucket.id,
                    name: bucket.name,
                    type: 'BUCKET' as ResourceType,
                    zone: bucket.location.toLowerCase(),
                    status: 'READY',
                    creationTimestamp: bucket.timeCreated,
                    provisioningModel: 'STANDARD' as ProvisioningModel,
                    storageClass: bucket.storageClass,
                    locationType: bucket.locationType, // multi-region, region, etc.
                    publicAccess: isPublic,
                    labels: bucket.labels || {},
                    labelFingerprint: bucket.etag,
                    history: []
                };
            }
        )
    }
  ];

  // Execute all tasks. We don't await them sequentially.
  // We use Promise.allSettled to ensure one failure doesn't kill the whole app.
  const promises = tasks.map(async (task) => {
    try {
      const data = await task.fn();
      if (data && data.length > 0) {
        onChunk(data, task.name);
      }
    } catch (e: any) {
      if (e.message === '401') throw e; // Fatal auth error
      safeLog(`Fetch warning for ${task.name}`, e);
      // We do not rethrow, so partial results can be displayed
    }
  });

  const results = await Promise.allSettled(promises);
  
  // Check for critical auth failures in the results
  const authFailure = results.find(r => r.status === 'rejected' && (r.reason as Error).message === '401');
  if (authFailure) throw new Error("Authentication Failed (401)");
};

export const updateResourceLabels = async (
  projectId: string,
  accessToken: string,
  resource: GceResource,
  newLabels: Record<string, string>
) => {
  let url = '';
  let method = 'POST';
  let body: any = {
    labels: newLabels,
    labelFingerprint: resource.labelFingerprint
  };
  
  if (resource.type === 'INSTANCE') {
    url = `${BASE_URL}/${projectId}/zones/${resource.zone}/instances/${resource.name}/setLabels`;
  } else if (resource.type === 'DISK') {
    url = `${BASE_URL}/${projectId}/zones/${resource.zone}/disks/${resource.name}/setLabels`;
  } else if (resource.type === 'IMAGE') {
    url = `${BASE_URL}/${projectId}/global/images/${resource.name}/setLabels`;
  } else if (resource.type === 'SNAPSHOT') {
    url = `${BASE_URL}/${projectId}/global/snapshots/${resource.name}/setLabels`;
  } else if (resource.type === 'CLOUD_RUN') {
    url = `https://run.googleapis.com/v2/projects/${projectId}/locations/${resource.zone}/services/${resource.name}?updateMask=labels`;
    method = 'PATCH';
    body = { labels: newLabels }; 
  } else if (resource.type === 'CLOUD_SQL') {
    url = `${SQL_ADMIN_URL}/${projectId}/instances/${resource.name}`;
    method = 'PATCH';
    body = { settings: { userLabels: newLabels } };
  } else if (resource.type === 'BUCKET') {
    url = `${STORAGE_BASE_URL}/${resource.name}`;
    method = 'PATCH';
    const finalLabelsForGcs: Record<string, string | null> = { ...newLabels };
    Object.keys(resource.labels).forEach(key => {
      if (!newLabels.hasOwnProperty(key)) {
        finalLabelsForGcs[key] = null;
      }
    });
    body = { labels: finalLabelsForGcs };
  } else if (resource.type === 'GKE_CLUSTER') {
    url = `${CONTAINER_BASE_URL}/${projectId}/locations/${resource.zone}/clusters/${resource.name}:setResourceLabels`;
    method = 'POST';
    body = {
      resourceLabels: newLabels,
      labelFingerprint: resource.labelFingerprint
    };
  } else {
    throw new Error(`Updating labels for type ${resource.type} not supported yet.`);
  }
  
  // Rate limited update
  const response = await apiLimiter.add(() => fetchWithBackoff(url, {
    method: method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }));

   if (!response.ok) {
    const errorMessage = await parseGcpError(response);
    throw new Error(errorMessage);
  }
  
  return response.json();
};

export const ensureGovernanceBucket = async (projectId: string, accessToken: string): Promise<boolean> => {
    // Placeholder: In a real app, strictly check permissions first
    // This reduces 403 noise in the console.
    return false; 
};

export const fetchHistoryFromGcs = async (projectId: string, accessToken: string): Promise<any> => { return null; };
export const saveHistoryToGcs = async (projectId: string, accessToken: string, data: any): Promise<void> => {};

export const fetchGcpAuditLogs = async (
  projectId: string,
  accessToken: string,
  pageSize = 50
): Promise<LogEntry[]> => {
  try {
    const response = await fetchWithBackoff(LOGGING_URL, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${accessToken}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        resourceNames: [`projects/${projectId}`],
        // Optimization: Fetch only relevant fields to reduce payload size
        filter: `protoPayload.serviceName=("compute.googleapis.com" OR "run.googleapis.com" OR "cloudsql.googleapis.com") AND logName:"projects/${projectId}/logs/cloudaudit.googleapis.com%2Factivity"`,
        orderBy: 'timestamp desc',
        pageSize
      })
    });

    if (!response.ok) return [];
    const data = await response.json();
    if (!data.entries) return [];

    return data.entries.map((e: any) => ({
        id: e.insertId,
        timestamp: new Date(e.timestamp),
        severity: e.severity || 'INFO',
        methodName: e.protoPayload?.methodName || 'Unknown',
        principalEmail: e.protoPayload?.authenticationInfo?.principalEmail || 'Unknown',
        resourceName: e.protoPayload?.resourceName?.split('/').pop() || 'Unknown',
        summary: `${e.protoPayload?.methodName} on ${e.protoPayload?.resourceName}`,
        source: 'GCP',
        status: e.protoPayload?.status
    }));
  } catch (error) {
    return [];
  }
};

export const fetchQuotas = async (projectId: string, accessToken: string): Promise<QuotaEntry[]> => {
    // Simplified quota fetcher for resilience
    try {
        const url = `${BASE_URL}/${projectId}/regions`;
        const response = await apiLimiter.add(() => fetchWithBackoff(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
        if(!response.ok) return [];
        const data = await response.json();
        const quotas: QuotaEntry[] = [];
        data.items?.forEach((r: any) => {
            r.quotas?.forEach((q: any) => {
                if(q.limit > 0 && (q.usage / q.limit) > 0.5) { // Only showing >50% usage to reduce noise
                    quotas.push({ metric: q.metric, limit: q.limit, usage: q.usage, region: r.name, percentage: (q.usage/q.limit)*100 });
                }
            })
        });
        return quotas;
    } catch(e) { return []; }
}
