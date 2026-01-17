
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

  constructor(maxConcurrency = 12) { 
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

const apiLimiter = new RateLimiter(12);

const parseGcpError = async (response: Response): Promise<string> => {
  try {
    const errorData = await response.json();
    if (errorData?.error) {
      const code = errorData.error.code || response.status;
      const mainMsg = errorData.error.message;
      const details = errorData.error.details?.[0]?.reason || '';
      
      if (code === 403) return `Access Denied: ${mainMsg}`;
      if (code === 401) return `Session Expired`;
      if (code === 429) return `Rate Limit Exceeded`;
      if (code === 412) return `Conflict: Resource modified by another process`;
      
      return `${mainMsg} ${details}`.trim() || response.statusText;
    }
    return `${response.status} ${response.statusText}`;
  } catch (e) {
    return `${response.status} ${response.statusText}`;
  }
};

export const fetchWithBackoff = async (
  url: string, 
  options: RequestInit, 
  retries = 3, 
  backoff = 500
): Promise<Response> => {
  try {
    const response = await fetch(url, options);

    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      if (retries > 0) {
        const jitter = Math.random() * 200;
        await new Promise(resolve => setTimeout(resolve, backoff + jitter));
        return fetchWithBackoff(url, options, retries - 1, backoff * 1.5);
      }
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      const jitter = Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, backoff + jitter));
      return fetchWithBackoff(url, options, retries - 1, backoff * 1.5);
    }
    throw new Error(`Network Request Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// --- API Implementation ---

const fetchPagedResource = async <T>(
  urlFactory: (pageToken?: string) => string,
  accessToken: string,
  itemsKey: string, 
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
        if (response.status === 401) throw new Error("401");
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
    console.warn("Paged fetch interrupted:", error);
  }
  return resources;
};

// --- Resource Fetchers ---

const fetchComputeEngine = async (projectId: string, accessToken: string) => {
  const fields = `items/*/instances(id,name,description,machineType,cpuPlatform,status,creationTimestamp,scheduling/provisioningModel,disks(deviceName,diskSizeGb,type,boot,interface),guestAccelerators(acceleratorType,acceleratorCount),networkInterfaces(network,networkIP,accessConfigs/natIP),tags/items,serviceAccounts/email,labels,labelFingerprint),nextPageToken`;
  const url = `${BASE_URL}/${projectId}/aggregated/instances?maxResults=500&fields=${encodeURIComponent(fields)}`;
  
  const response = await apiLimiter.add(() => fetchWithBackoff(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }));

  if (!response.ok) {
    if (response.status === 401) throw new Error("401");
    return [];
  }

  const data = await response.json();
  const resources: GceResource[] = [];

  if (data.items) {
    for (const [scope, scopeData] of Object.entries(data.items)) {
      if ((scopeData as any).instances) {
        const zone = scope.replace('zones/', '').replace('regions/', '');
        (scopeData as any).instances.forEach((inst: any) => {
           const machineTypeShort = inst.machineType?.split('/').pop() || 'unknown';
           
           resources.push({
              id: String(inst.id),
              name: inst.name,
              description: inst.description || (inst.cpuPlatform ? `CPU: ${inst.cpuPlatform}` : undefined),
              type: 'INSTANCE',
              zone: zone,
              machineType: machineTypeShort,
              cpuPlatform: inst.cpuPlatform,
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
                interface: d.interface 
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
  // Added resourcePolicies to fetch list
  const fields = `items/*/disks(id,name,description,sizeGb,type,status,creationTimestamp,labels,labelFingerprint,provisionedIops,provisionedThroughput,resourcePolicies),nextPageToken`;
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
              machineType: disk.type?.split('/').pop(), // e.g. pd-ssd
              status: disk.status || 'READY',
              creationTimestamp: disk.creationTimestamp,
              provisioningModel: 'STANDARD',
              provisionedIops: disk.provisionedIops,
              provisionedThroughput: disk.provisionedThroughput,
              resourcePolicies: disk.resourcePolicies?.map((rp: string) => rp.split('/').pop()), // Extract policy names
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

// New Snapshot Fetcher
const fetchSnapshots = async (projectId: string, accessToken: string) => {
  return fetchPagedResource(
    (pageToken) => `${BASE_URL}/${projectId}/global/snapshots?maxResults=500${pageToken ? `&pageToken=${pageToken}` : ''}`,
    accessToken, 'items',
    (snap: any) => ({
      id: String(snap.id),
      name: snap.name,
      description: snap.description,
      type: 'SNAPSHOT' as ResourceType,
      zone: 'global',
      sizeGb: snap.diskSizeGb,
      status: snap.status,
      creationTimestamp: snap.creationTimestamp,
      provisioningModel: 'STANDARD' as ProvisioningModel,
      sourceDisk: snap.sourceDisk?.split('/').pop(), // Extract disk name
      labels: snap.labels || {},
      labelFingerprint: snap.labelFingerprint,
      history: []
    })
  );
};

export const fetchAllResources = async (
  projectId: string,
  accessToken: string,
  onChunk: (resources: GceResource[], source: string) => void
): Promise<void> => {
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
      name: 'Snapshots',
      fn: () => fetchSnapshots(projectId, accessToken)
    },
    {
      name: 'Cloud Run Services',
      fn: () => fetchPagedResource(
        () => `${RUN_BASE_URL}/${projectId}/locations/-/services`,
        accessToken, 'services', 
        (svc: any) => {
            const container = svc.template?.containers?.[0];
            const limits = container?.resources?.limits;
            let ingress: 'all' | 'internal' = 'all';
            if (svc.ingress === 'INGRESS_TRAFFIC_INTERNAL_ONLY' || svc.ingress === 'INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER') {
                ingress = 'internal';
            }

            return {
                id: svc.name,
                name: svc.name.split('/').pop(),
                description: svc.description,
                type: 'CLOUD_RUN' as ResourceType,
                zone: svc.name.split('/')[3],
                status: 'READY',
                creationTimestamp: svc.createTime,
                provisioningModel: 'STANDARD' as ProvisioningModel,
                machineType: 'Serverless',
                url: svc.uri,
                cpu: limits?.cpu,
                memory: limits?.memory,
                ingress: ingress,
                labels: svc.labels || {},
                labelFingerprint: svc.etag, // Correct ETag mapping
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
                    nodeCount: np.initialNodeCount || 0,
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
                labelFingerprint: inst.etag, // Correct ETag mapping
                ips: inst.ipAddresses?.map((ip: any) => ({
                    network: 'Cloud SQL',
                    internal: ip.type === 'PRIVATE' ? ip.ipAddress : undefined,
                    external: ip.type === 'PRIMARY' ? ip.ipAddress : undefined
                })).filter((i: any) => i.internal || i.external) || [],
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
                    locationType: bucket.locationType,
                    publicAccess: isPublic,
                    labels: bucket.labels || {},
                    labelFingerprint: bucket.etag,
                    history: []
                };
            }
        )
    }
  ];

  const promises = tasks.map(async (task) => {
    try {
      const data = await task.fn();
      if (data && data.length > 0) {
        onChunk(data, task.name);
      }
    } catch (e: any) {
      if (e.message === '401') throw e; 
      safeLog(`Fetch warning for ${task.name}`, e);
    }
  });

  const results = await Promise.allSettled(promises);
  const authFailure = results.find(r => r.status === 'rejected' && (r.reason as Error).message === '401');
  if (authFailure) throw new Error("Authentication Failed (401)");
};

export const fetchResource = async (projectId: string, accessToken: string, resource: GceResource): Promise<GceResource | null> => {
  let url = '';
  
  if (resource.type === 'INSTANCE') {
    url = `${BASE_URL}/${projectId}/zones/${resource.zone}/instances/${resource.name}`;
  } else if (resource.type === 'DISK') {
    url = `${BASE_URL}/${projectId}/zones/${resource.zone}/disks/${resource.name}`;
  } else if (resource.type === 'SNAPSHOT') {
    url = `${BASE_URL}/${projectId}/global/snapshots/${resource.name}`;
  } else if (resource.type === 'BUCKET') {
    url = `${STORAGE_BASE_URL}/${resource.name}`;
  } else if (resource.type === 'CLOUD_RUN') {
    url = `https://run.googleapis.com/v2/projects/${projectId}/locations/${resource.zone}/services/${resource.name}`;
  } else if (resource.type === 'CLOUD_SQL') {
    url = `${SQL_ADMIN_URL}/${projectId}/instances/${resource.name}`;
  } else if (resource.type === 'GKE_CLUSTER') {
    url = `${CONTAINER_BASE_URL}/${projectId}/locations/${resource.zone}/clusters/${resource.name}`;
  } else {
      return null;
  }

  try {
      const response = await apiLimiter.add(() => fetchWithBackoff(url, {
          headers: { Authorization: `Bearer ${accessToken}` }
      }));
      if (!response.ok) return null;
      const data = await response.json();
      
      return {
          ...resource,
          labelFingerprint: data.labelFingerprint || data.etag || ''
      };
  } catch (e) {
      return null;
  }
};

export const updateResourceLabels = async (
  projectId: string,
  accessToken: string,
  resource: GceResource,
  newLabels: Record<string, string>,
  retryOn412 = true
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
    // Cloud Run v2 requires strict ETag in body for concurrency control
    body = { labels: newLabels, etag: resource.labelFingerprint }; 
  } else if (resource.type === 'CLOUD_SQL') {
    url = `${SQL_ADMIN_URL}/${projectId}/instances/${resource.name}`;
    method = 'PATCH';
    // Cloud SQL patch also benefits from ETag for safety
    body = { settings: { userLabels: newLabels }, etag: resource.labelFingerprint };
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
  
  const response = await apiLimiter.add(() => fetchWithBackoff(url, {
    method: method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }));

   if (!response.ok) {
    if (response.status === 412 && retryOn412) {
        console.warn(`Concurrent modification detected on ${resource.name}. Fetching latest state and retrying...`);
        const freshResource = await fetchResource(projectId, accessToken, resource);
        if (freshResource) {
            return updateResourceLabels(projectId, accessToken, freshResource, newLabels, false);
        }
    }

    const errorMessage = await parseGcpError(response);
    throw new Error(errorMessage);
  }
  
  return response.json();
};

export const ensureGovernanceBucket = async (projectId: string, accessToken: string): Promise<boolean> => {
  const bucketName = `yalla-gov-${projectId}`;
  const url = `${STORAGE_BASE_URL}/${bucketName}`;
  
  try {
    const check = await fetchWithBackoff(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (check.ok) return true;
    
    if (check.status === 404) {
      const create = await fetchWithBackoff(`${STORAGE_BASE_URL}?project=${projectId}`, {
        method: 'POST',
        headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: bucketName,
            location: 'US',
            storageClass: 'STANDARD',
            iamConfiguration: {
                uniformBucketLevelAccess: { enabled: true }
            }
        })
      });
      return create.ok;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export const fetchFileFromGcs = async (
    projectId: string, 
    accessToken: string, 
    fileName: string
): Promise<{ blob: Blob, generation: string } | null> => {
    const bucketName = `yalla-gov-${projectId}`;
    const url = `${STORAGE_BASE_URL}/${bucketName}/o/${fileName}?alt=media`;
    
    try {
        const res = await fetchWithBackoff(url, { 
            headers: { Authorization: `Bearer ${accessToken}` } 
        });
        
        if (res.ok) {
            const blob = await res.blob();
            const generation = res.headers.get('x-goog-generation') || '0';
            return { blob, generation };
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const saveFileToGcs = async (
    projectId: string, 
    accessToken: string, 
    fileName: string, 
    data: Blob,
    ifGenerationMatch?: string
): Promise<string | null> => {
    const bucketName = `yalla-gov-${projectId}`;
    let url = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${fileName}`;
    
    if (ifGenerationMatch) {
        url += `&ifGenerationMatch=${ifGenerationMatch}`;
    }

    try {
        const res = await fetchWithBackoff(url, {
            method: 'POST',
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json', 
            },
            body: data 
        });
        
        if (res.ok) {
            const json = await res.json();
            return json.generation; 
        } else if (res.status === 412) {
            throw new Error("Precondition Failed: The file has been modified by another process.");
        }
        
        return null;
    } catch (e) {
        console.error(`Failed to save ${fileName} to GCS`, e);
        throw e;
    }
};

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
        status: e.protoPayload?.status,
        callerIp: e.protoPayload?.requestMetadata?.callerIp,
        userAgent: e.protoPayload?.requestMetadata?.callerSuppliedUserAgent,
        metadata: e.protoPayload?.request,
        serviceName: e.protoPayload?.serviceName
    }));
  } catch (error) {
    return [];
  }
};

export const fetchQuotas = async (projectId: string, accessToken: string): Promise<QuotaEntry[]> => {
    const ALWAYS_SHOW_METRICS = [
        'CPUS', 'NVIDIA_A100_GPUS', 'NVIDIA_T4_GPUS', 
        'SSD_TOTAL_GB', 'DISKS_TOTAL_GB', 
        'IN_USE_ADDRESSES', 'GLOBAL_INTERNAL_ADDRESSES',
        'INSTANCES'
    ];

    try {
        const url = `${BASE_URL}/${projectId}/regions`;
        const response = await apiLimiter.add(() => fetchWithBackoff(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
        
        if (!response.ok) {
            console.error(`Quota fetch failed: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        const quotas: QuotaEntry[] = [];
        
        if (data.items) {
            data.items.forEach((r: any) => {
                r.quotas?.forEach((q: any) => {
                    const isKeyMetric = ALWAYS_SHOW_METRICS.includes(q.metric);
                    if(q.limit > 0 && (q.usage > 0 || isKeyMetric)) { 
                        quotas.push({ 
                            metric: q.metric, 
                            limit: q.limit, 
                            usage: q.usage, 
                            region: r.name, 
                            percentage: (q.usage/q.limit)*100 
                        });
                    }
                });
            });
        }
        return quotas;
    } catch(e) { 
        console.error("Quota fetch error", e);
        return []; 
    }
};
