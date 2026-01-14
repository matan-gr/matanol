
import { GceResource, ResourceType, LabelHistoryEntry, AnalysisResult } from '../types';

// --- Constants & Generators ---

const USERS = [
  'jane.doe@company.com', 
  'devops-bot@company.iam.gserviceaccount.com', 
  'john.smith@company.com', 
  'terraform-cloud@system.gserviceaccount.com'
];

const ACTIONS = ['UPDATE', 'APPLY_PROPOSAL'];

const generateHistory = (count: number): LabelHistoryEntry[] => {
  if (count === 0) return [];
  const history: LabelHistoryEntry[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    // Random time in last 30 days
    const timeOffset = Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000); 
    history.push({
      timestamp: new Date(now - timeOffset),
      actor: USERS[Math.floor(Math.random() * USERS.length)],
      changeType: ACTIONS[Math.floor(Math.random() * ACTIONS.length)] as any,
      previousLabels: { 'env': 'dev', 'temp': 'true' },
      newLabels: { 'env': 'prod', 'cost-center': 'cc-102' }
    });
  }
  return history.sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
};

// --- Scenario Builders ---

const createResource = (
  partial: Partial<GceResource> & { name: string, type: ResourceType, zone: string }
): GceResource => {
  return {
    id: Math.random().toString(36).substring(2, 18),
    status: 'RUNNING',
    creationTimestamp: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)).toISOString(),
    labels: {},
    labelFingerprint: 'mock-fingerprint',
    history: generateHistory(Math.random() > 0.7 ? 2 : 0),
    provisioningModel: 'STANDARD',
    ...partial
  };
};

/**
 * Generates a realistic Enterprise environment
 */
export const generateMockResources = (count: number = 50): GceResource[] => {
  const resources: GceResource[] = [];

  // 1. The "Legacy Production" Monolith (High Cost, Stable)
  // -------------------------------------------------------
  const prodNet = 'vpc-production';
  const prodSubnet = 'subnet-us-central1';
  
  // Database Primary
  resources.push(createResource({
    name: 'prod-legacy-db-primary',
    type: 'CLOUD_SQL',
    zone: 'us-central1-a',
    machineType: 'db-custom-16-65536',
    sizeGb: '1024',
    databaseVersion: 'POSTGRES_13',
    status: 'RUNNABLE',
    labels: { environment: 'production', app: 'legacy-core', 'cost-center': 'cc-500', owner: 'data-team' },
    ips: [{ network: prodNet, internal: '10.0.1.5' }]
  }));

  // App Servers Group
  for(let i=1; i<=3; i++) {
    resources.push(createResource({
      name: `prod-app-server-0${i}`,
      type: 'INSTANCE',
      zone: 'us-central1-a',
      machineType: 'n2-standard-8',
      status: 'RUNNING',
      labels: { environment: 'production', app: 'legacy-core', 'cost-center': 'cc-500' }, // Missing owner (Policy Violation)
      ips: [{ network: prodNet, internal: `10.0.1.1${i}` }],
      disks: [{ deviceName: 'boot', sizeGb: 100, type: 'pd-ssd', boot: true }]
    }));
  }

  // 2. The "Modern Cloud Native" Stack (GKE + Cloud Run)
  // ----------------------------------------------------
  // GKE Cluster
  resources.push(createResource({
    name: 'k8s-prod-us-east',
    type: 'GKE_CLUSTER',
    zone: 'us-east1-b',
    status: 'RUNNING',
    labels: { environment: 'production', orchestrator: 'gke', 'cost-center': 'cc-600', owner: 'platform-eng' },
    clusterDetails: {
      nodeCount: 12,
      version: '1.27.3-gke.100',
      endpoint: '34.72.10.5',
      isAutopilot: true,
      network: prodNet,
      subnetwork: 'subnet-us-east1',
      nodePools: [{ name: 'autopilot-pool', version: '1.27.3', status: 'RUNNING', nodeCount: 12, machineType: 'e2-standard-4' }]
    }
  }));

  // Microservices (Cloud Run)
  ['payment-service', 'auth-service', 'notification-service'].forEach((svc, idx) => {
    resources.push(createResource({
      name: `prod-${svc}`,
      type: 'CLOUD_RUN',
      zone: 'us-east1',
      status: 'READY',
      machineType: 'Serverless',
      url: `https://${svc}-xh5k.a.run.app`,
      labels: { environment: 'production', microservice: svc, 'cost-center': 'cc-600' },
      ingress: idx === 0 ? 'all' : 'internal' // Payments is public, others internal
    }));
  });

  // 3. The "Shadow IT" / Dev Chaos (Messy, Violations, Waste)
  // ---------------------------------------------------------
  const devNet = 'default';
  
  // Huge Stopped GPU Instance (Waste)
  resources.push(createResource({
    name: 'dev-ml-experiment-gpu',
    type: 'INSTANCE',
    zone: 'us-west1-b',
    machineType: 'a2-highgpu-1g', // Expensive!
    status: 'STOPPED', // Stopped but costing storage
    provisioningModel: 'STANDARD',
    labels: { created_by: 'intern' }, // Non-standard label
    ips: [{ network: devNet, internal: '10.128.0.5', external: '35.202.10.1' }], // Public IP on dev box
    disks: [
      { deviceName: 'boot', sizeGb: 50, type: 'pd-standard', boot: true },
      { deviceName: 'training-data', sizeGb: 2000, type: 'pd-ssd', boot: false } // Huge wasted disk
    ]
  }));

  // Unlabeled Test VMs
  for(let i=1; i<=4; i++) {
    resources.push(createResource({
      name: `test-box-${i}`,
      type: 'INSTANCE',
      zone: 'us-west1-b',
      machineType: 'e2-micro',
      status: 'RUNNING',
      provisioningModel: 'SPOT',
      labels: {}, // 100% Unlabeled
      ips: [{ network: devNet, internal: `10.128.0.1${i}`, external: `34.100.20.${i}` }], // Exposed
      disks: [{ deviceName: 'boot', sizeGb: 20, type: 'pd-balanced', boot: true }]
    }));
  }

  // Orphaned Disks
  resources.push(createResource({
    name: 'backup-disk-nov-2023',
    type: 'DISK',
    zone: 'us-central1-a',
    sizeGb: '500',
    machineType: 'pd-standard',
    status: 'READY', // Not attached
    labels: { description: 'do-not-delete' }
  }));

  // 4. Global Storage
  // -----------------
  resources.push(createResource({
    name: 'company-assets-public',
    type: 'BUCKET',
    zone: 'us-multi-region',
    storageClass: 'STANDARD',
    status: 'READY',
    publicAccess: true,
    locationType: 'multi-region',
    labels: { 'data-classification': 'public', environment: 'production' }
  }));

  resources.push(createResource({
    name: 'finance-records-archive',
    type: 'BUCKET',
    zone: 'us-east1',
    storageClass: 'COLDLINE',
    status: 'READY',
    publicAccess: false,
    labels: { 'data-classification': 'restricted', 'dept': 'finance' } // Non-standard key 'dept'
  }));

  return resources;
};

/**
 * Simulates the AI Labeling logic purely client-side for the Demo
 */
export const mockAnalyzeResources = (resources: GceResource[]): AnalysisResult[] => {
  return resources.map(r => {
    const suggestions: Record<string, string> = {};
    
    // Simple heuristic rules to mimic AI
    if (r.name.includes('prod')) suggestions['environment'] = 'production';
    else if (r.name.includes('dev') || r.name.includes('test')) suggestions['environment'] = 'development';
    else if (r.name.includes('staging')) suggestions['environment'] = 'staging';

    if (r.name.includes('db') || r.name.includes('sql')) suggestions['app'] = 'database';
    else if (r.name.includes('web') || r.name.includes('frontend')) suggestions['app'] = 'frontend';
    else if (r.name.includes('api') || r.name.includes('svc')) suggestions['app'] = 'backend';

    if (!r.labels['cost-center']) {
      suggestions['cost-center'] = r.name.includes('prod') ? 'cc-500' : 'cc-100';
    }

    if (!r.labels['owner']) {
        suggestions['owner'] = 'platform-engineering';
    }

    return {
      resourceId: r.id,
      suggestedLabels: suggestions,
      reasoning: "Based on resource name patterns and common infrastructure conventions."
    };
  }).filter(res => Object.keys(res.suggestedLabels).length > 0);
};
