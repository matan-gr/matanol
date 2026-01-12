
import { GceResource, ResourceType, LabelHistoryEntry, ProvisioningModel, ResourceDisk, ResourceIP } from '../types';

const ZONES = ['us-central1-a', 'us-central1-b', 'us-central1-f', 'europe-west1-d', 'europe-west1-b', 'asia-east1-a', 'asia-northeast1-a'];
const REGIONS = ['us-central1', 'europe-west1', 'asia-east1', 'asia-northeast1', 'us-east1'];
const MACHINE_TYPES = ['n1-standard-1', 'e2-medium', 'e2-small', 'c2-standard-4', 'm1-ultramem-40', 't2d-standard-16'];
const SQL_TIERS = ['db-f1-micro', 'db-g1-small', 'db-n1-standard-1', 'db-custom-4-16384'];
const DISK_TYPES = ['pd-standard', 'pd-ssd', 'pd-balanced', 'pd-extreme'];

const generateId = () => Math.random().toString(36).substring(2, 18);
const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateHistory = (count: number): LabelHistoryEntry[] => {
  const history: LabelHistoryEntry[] = [];
  const actors = ['jane.doe@company.com', 'system-automation', 'terraform-cloud', 'compliance-bot@yalla-label.iam.gserviceaccount.com'];
  
  for (let i = 0; i < count; i++) {
    const isAi = Math.random() > 0.8;
    history.push({
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)), // up to 90 days ago
      actor: isAi ? 'Yalla AI' : getRandomItem(actors),
      changeType: isAi ? 'APPLY_PROPOSAL' : 'UPDATE',
      previousLabels: { 'env': 'dev' },
      newLabels: { 'env': 'prod', 'reviewed': 'true', 'cost-center': 'cc-123' }
    });
  }
  return history.sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const createResourceBase = (name: string, type: ResourceType, zone: string) => ({
    id: generateId(),
    name,
    type,
    zone,
    description: Math.random() > 0.7 ? 'Automatically provisioned via Terraform pipeline.' : undefined,
    creationTimestamp: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)).toISOString(),
    labels: {},
    labelFingerprint: generateId(),
    history: generateHistory(Math.random() > 0.7 ? 3 : 0), // 30% chance of history
    isDirty: false
});

// Creates a set of related resources (e.g., VM + Disk + IP)
const createVmCluster = (prefix: string, env: string, zone: string, count: number, isSpot = false) => {
    const resources: GceResource[] = [];
    
    for(let i=1; i<=count; i++) {
        const name = `${prefix}-${i.toString().padStart(2, '0')}`;
        const machineType = getRandomItem(MACHINE_TYPES);
        const bootDiskType = Math.random() > 0.5 ? 'pd-ssd' : 'pd-balanced';
        
        // VM
        const vm: GceResource = {
            ...createResourceBase(name, 'INSTANCE', zone),
            status: Math.random() > 0.1 ? 'RUNNING' : 'STOPPED', // 90% uptime
            machineType,
            provisioningModel: isSpot ? 'SPOT' : 'STANDARD',
            ips: [
                {
                    network: 'vpc-main',
                    internal: `10.128.${Math.floor(Math.random()*20)}.${Math.floor(Math.random()*255)}`,
                    external: Math.random() > 0.6 ? `34.${Math.floor(Math.random()*100)}.${Math.floor(Math.random()*255)}.12` : undefined
                }
            ],
            disks: [
                { deviceName: `${name}-boot`, sizeGb: 20, type: bootDiskType, boot: true, interface: 'NVMe' }
            ],
            tags: ['http-server', 'https-server', env === 'production' ? 'prod-access' : 'dev-access'],
            serviceAccount: `service-${Math.floor(Math.random()*1000)}@yalla-label.iam.gserviceaccount.com`,
            labels: {
                environment: env,
                managed_by: 'terraform',
                app: prefix.split('-')[0] // rough guess
            }
        };
        resources.push(vm);

        // Data Disk (20% chance)
        if (Math.random() > 0.8) {
            const diskName = `${name}-data`;
            const diskType = getRandomItem(DISK_TYPES);
            vm.disks?.push({ deviceName: diskName, sizeGb: 100, type: diskType, boot: false, interface: 'SCSI' });
            // Add actual Disk Resource
            resources.push({
                ...createResourceBase(diskName, 'DISK', zone),
                sizeGb: '100',
                machineType: diskType, // Store disk type here for display
                status: 'READY',
                provisioningModel: 'STANDARD',
                provisionedIops: diskType.includes('ssd') ? 3000 : undefined,
                provisionedThroughput: diskType.includes('ssd') ? 120 : undefined,
                labels: { ...vm.labels, 'attachment': name }
            });
        }
    }
    return resources;
};

export const generateMockResources = (count: number = 50): GceResource[] => {
  let allResources: GceResource[] = [];

  // 1. Production Web Cluster (US)
  allResources.push(...createVmCluster('prod-frontend', 'production', 'us-central1-a', 5, false));
  allResources.push(...createVmCluster('prod-api', 'production', 'us-central1-b', 3, false));
  
  // 2. Dev Environment (Spot Instances - Cost Saving)
  allResources.push(...createVmCluster('dev-worker', 'development', 'us-central1-f', 4, true));

  // 3. Database Layer (Cloud SQL)
  allResources.push({
      ...createResourceBase('prod-main-db-primary', 'CLOUD_SQL', 'us-central1'),
      machineType: 'db-custom-4-16384',
      sizeGb: '250',
      databaseVersion: 'POSTGRES_14',
      status: 'RUNNABLE',
      provisioningModel: 'STANDARD',
      labels: { environment: 'production', tier: 'backend', 'cost-center': 'finance' },
      ips: [{ network: 'vpc-main', internal: '10.128.0.5' }]
  });
  
  // 4. Orphaned Disks (Waste)
  ['old-backup-disk-1', 'migrated-data-temp'].forEach(name => {
      allResources.push({
          ...createResourceBase(name, 'DISK', 'us-central1-a'),
          sizeGb: '500',
          machineType: 'pd-standard',
          status: 'READY', // Not attached
          provisioningModel: 'STANDARD',
          labels: { 'created-by': 'unknown' } 
      });
  });

  // 5. Global Storage (Buckets)
  ['assets-cdn-prod', 'logs-archive-2023', 'terraform-state-prod'].forEach(name => {
      allResources.push({
          ...createResourceBase(name, 'BUCKET', 'us-multi-region'),
          storageClass: name.includes('archive') ? 'COLDLINE' : 'STANDARD',
          status: 'READY',
          provisioningModel: 'STANDARD',
          locationType: 'multi-region',
          publicAccess: name.includes('cdn'), // CDN is public
          labels: { environment: 'production', 'data-classification': 'internal' }
      });
  });

  // 6. Cloud Run Services (Modern Apps)
  ['auth-service-v2', 'payment-processor'].forEach(name => {
      allResources.push({
          ...createResourceBase(name, 'CLOUD_RUN', 'us-central1'),
          status: 'READY',
          machineType: 'Serverless',
          url: `https://${name}-832js.a.run.app`,
          provisioningModel: 'STANDARD',
          memory: '512Mi',
          cpu: '1.0',
          ingress: name.includes('auth') ? 'all' : 'internal',
          labels: { environment: 'production', 'revision': '231' }
      });
  });

  // 7. Snapshots (Backups)
  allResources.push({
      ...createResourceBase('snapshot-prod-db-pre-migration', 'SNAPSHOT', 'global'),
      sizeGb: '250',
      status: 'READY',
      provisioningModel: 'STANDARD',
      labels: { 'retention': '7d', 'auto-snapshot': 'true' }
  });

  // 8. GKE Clusters (Kubernetes)
  allResources.push({
      ...createResourceBase('k8s-prod-us-west', 'GKE_CLUSTER', 'us-west1-b'),
      status: 'RUNNING',
      provisioningModel: 'STANDARD',
      labels: { environment: 'production', 'orchestrator': 'gke' },
      clusterDetails: {
          nodeCount: 12,
          version: '1.27.4-gke.100',
          endpoint: '34.120.55.10',
          isAutopilot: false,
          network: 'vpc-main',
          subnetwork: 'subnet-us-west1',
          servicesIpv4Cidr: '10.40.0.0/20',
          nodePools: [
              { name: 'default-pool', version: '1.27.4-gke.100', status: 'RUNNING', nodeCount: 3, machineType: 'e2-standard-4' },
              { name: 'high-mem-pool', version: '1.27.4-gke.100', status: 'RUNNING', nodeCount: 9, machineType: 'm1-ultramem-40' }
          ]
      }
  });
  
  allResources.push({
      ...createResourceBase('k8s-dev-autopilot', 'GKE_CLUSTER', 'us-central1'),
      status: 'RUNNING',
      provisioningModel: 'STANDARD',
      labels: { environment: 'development', 'mode': 'autopilot' },
      clusterDetails: {
          nodeCount: 3, 
          version: '1.28.1-gke.200',
          endpoint: '35.192.11.22',
          isAutopilot: true,
          network: 'vpc-dev',
          subnetwork: 'subnet-us-central1-dev',
          servicesIpv4Cidr: '10.50.0.0/20',
          nodePools: [
              { name: 'autopilot-default', version: '1.28.1-gke.200', status: 'RUNNING', nodeCount: 3, machineType: 'autopilot-managed' }
          ]
      }
  });

  // 9. Chaos / Unlabeled Resources (The "Mess" to clean up)
  const messyNames = ['instance-20231102', 'test-vm-do-not-delete', 'gke-cluster-1-default-pool-39a1', 'temp-download-box'];
  messyNames.forEach(name => {
      allResources.push({
          ...createResourceBase(name, 'INSTANCE', getRandomItem(ZONES)),
          status: 'RUNNING',
          machineType: 'e2-micro',
          provisioningModel: 'STANDARD',
          labels: {}, // Intentionally empty
          ips: [{ network: 'default', internal: '10.142.0.2', external: '35.202.10.1' }],
          disks: [{ deviceName: name, sizeGb: 10, type: 'pd-standard', boot: true, interface: 'SCSI' }]
      });
  });

  return allResources;
};
