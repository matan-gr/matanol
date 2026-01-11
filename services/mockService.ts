import { GceResource, ResourceType, LabelHistoryEntry, ProvisioningModel, ResourceDisk, ResourceIP } from '../types';

const ZONES = ['us-central1-a', 'us-central1-b', 'europe-west1-d', 'asia-east1-a'];
const MACHINE_TYPES = ['n1-standard-1', 'e2-medium', 'c2-standard-4', 'm1-ultramem-40', 'e2-micro'];
const ENVIRONMENTS = ['production', 'staging', 'development', 'qa'];
const DEPARTMENTS = ['engineering', 'finance', 'marketing', 'data-science', 'hr'];
const APPLICATIONS = ['web-portal', 'payment-gateway', 'user-db', 'analytics-engine', 'internal-tools'];

const generateId = () => Math.random().toString(36).substring(2, 15);

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateHistory = (count: number): LabelHistoryEntry[] => {
  const history: LabelHistoryEntry[] = [];
  for (let i = 0; i < count; i++) {
    history.push({
      timestamp: new Date(Date.now() - Math.random() * 10000000000), // Random time in past
      actor: Math.random() > 0.5 ? 'jane.doe@company.com' : 'system-automation',
      changeType: 'UPDATE',
      previousLabels: { 'env': 'dev' },
      newLabels: { 'env': 'prod', 'reviewed': 'true' }
    });
  }
  return history;
};

const generateDisks = (vmName: string): ResourceDisk[] => {
  const disks: ResourceDisk[] = [];
  // Boot disk
  disks.push({
    deviceName: `${vmName}-boot`,
    sizeGb: Math.random() > 0.5 ? 20 : 50,
    type: 'PERSISTENT',
    boot: true
  });
  // Optional data disk
  if (Math.random() > 0.6) {
    disks.push({
      deviceName: `${vmName}-data`,
      sizeGb: Math.floor(Math.random() * 500) + 100,
      type: 'PERSISTENT',
      boot: false
    });
  }
  return disks;
};

const generateIPs = (): ResourceIP[] => {
  const ips: ResourceIP[] = [];
  // Internal
  ips.push({
    network: 'default',
    internal: `10.128.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
    external: Math.random() > 0.3 ? `34.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}` : undefined
  });
  return ips;
};

export const generateMockResources = (count: number = 30): GceResource[] => {
  const resources: GceResource[] = [];

  for (let i = 0; i < count; i++) {
    const env = getRandomItem(ENVIRONMENTS);
    const app = getRandomItem(APPLICATIONS);
    const type = Math.random() > 0.7 ? 'DISK' : 'INSTANCE';
    const isLabeled = Math.random() > 0.4;
    
    const name = `${env}-${app}-${type === 'INSTANCE' ? 'vm' : 'disk'}-${Math.floor(Math.random() * 99)}`;
    const machineType = type === 'INSTANCE' ? getRandomItem(MACHINE_TYPES) : undefined;
    
    // FinOps logic
    let provisioning: ProvisioningModel = 'STANDARD';
    if (type === 'INSTANCE') {
        const rand = Math.random();
        if (rand > 0.7) provisioning = 'SPOT';
        else if (rand > 0.9) provisioning = 'RESERVED';
    }

    const labels: Record<string, string> = {};
    if (isLabeled) {
      labels['environment'] = env;
      labels['application'] = app;
      labels['department'] = getRandomItem(DEPARTMENTS);
      if (Math.random() > 0.5) labels['cost-center'] = `cc-${Math.floor(Math.random() * 5000)}`;
    }

    resources.push({
      id: generateId(),
      name: name,
      type: type as ResourceType,
      zone: getRandomItem(ZONES),
      machineType: machineType,
      sizeGb: type === 'DISK' ? (Math.floor(Math.random() * 500) + 10).toString() : undefined,
      status: Math.random() > 0.2 ? (type === 'INSTANCE' ? 'RUNNING' : 'READY') : 'STOPPED',
      creationTimestamp: new Date(Date.now() - Math.random() * 30000000000).toISOString(),
      
      provisioningModel: provisioning,
      disks: type === 'INSTANCE' ? generateDisks(name) : undefined,
      ips: type === 'INSTANCE' ? generateIPs() : undefined,
      
      labels: labels,
      labelFingerprint: generateId(),
      history: generateHistory(Math.floor(Math.random() * 5)),
      isDirty: false
    });
  }
  return resources;
};