
export enum AppState {
  CONNECTING = 'CONNECTING',
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  ANALYSIS = 'ANALYSIS',
  REPORTING = 'REPORTING',
}

export interface GcpCredentials {
  projectId: string;
  accessToken: string;
}

export interface AppSettings {
  defaultRegion: string;
  autoAnalyze: boolean;
  costCenterFormat: string;
  departmentList: string[];
}

export type ResourceType = 'INSTANCE' | 'DISK' | 'SNAPSHOT' | 'IMAGE' | 'CLOUD_RUN' | 'CLOUD_SQL' | 'BUCKET' | 'GKE_CLUSTER';
export type ProvisioningModel = 'STANDARD' | 'SPOT' | 'RESERVED';

export interface LabelHistoryEntry {
  timestamp: Date;
  actor: string;
  previousLabels: Record<string, string>;
  newLabels: Record<string, string>;
  changeType: 'UPDATE' | 'APPLY_PROPOSAL' | 'REVERT';
}

export interface ResourceDisk {
  deviceName: string;
  sizeGb: number;
  type: string;
  boot: boolean;
  interface?: string; // NVMe, SCSI
}

export interface ResourceIP {
  network: string;
  internal: string;
  external?: string;
}

// --- Governance Types ---
export type PolicySeverity = 'CRITICAL' | 'MEDIUM' | 'WARNING' | 'INFO';
export type PolicyCategory = string; // Allows custom categories
export type RuleType = 'REQUIRED_LABEL' | 'ALLOWED_VALUES' | 'NAME_REGEX' | 'REGION_RESTRICTION' | 'CUSTOM';

export interface PolicyRuleConfig {
  type: RuleType;
  params: {
    key?: string;       // For label keys
    values?: string[];  // For allowed values / regions
    regex?: string;     // For name matching
  };
}

export interface PolicyViolation {
  policyId: string;
  message: string;
  severity: PolicySeverity;
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  isEnabled: boolean;
  severity: PolicySeverity;
  isCustom?: boolean;
  ruleConfig?: PolicyRuleConfig; // Store config to allow editing
  check: (r: GceResource) => string | null; // Returns error message or null
}

export interface TaxonomyRule {
  key: string;
  allowedValues: string[];
  isRequired: boolean;
}
// ------------------------

export interface GceResource {
  id: string;
  name: string;
  description?: string;
  type: ResourceType;
  zone: string;
  machineType?: string;
  sizeGb?: string;
  status: string;
  creationTimestamp: string;
  
  provisioningModel: ProvisioningModel;

  disks?: ResourceDisk[];
  ips?: ResourceIP[];
  tags?: string[];
  serviceAccount?: string;
  
  gpus?: { name: string; count: number }[];
  provisionedIops?: number;
  provisionedThroughput?: number;
  sourceDisk?: string;

  // Cloud Run Specifics
  url?: string;
  memory?: string;
  cpu?: string;
  ingress?: 'all' | 'internal' | 'internal-and-cloud-lb';

  // Bucket Specifics
  publicAccess?: boolean;
  locationType?: string; // region, dual-region, multi-region

  databaseVersion?: string;
  storageClass?: string;
  family?: string;
  clusterDetails?: {
    nodeCount: number;
    version: string;
    endpoint: string;
    isAutopilot: boolean;
    network?: string;
    subnetwork?: string;
    servicesIpv4Cidr?: string;
    statusMessage?: string;
    nodePools?: {
      name: string;
      version: string;
      status: string;
      nodeCount: number;
      machineType?: string;
    }[];
  };

  labels: Record<string, string>;
  labelFingerprint: string;
  
  // UI State
  proposedLabels?: Record<string, string>;
  isDirty?: boolean;
  history?: LabelHistoryEntry[];
  isUpdating?: boolean;
  
  // New Governance Field
  violations?: PolicyViolation[];
}

// --- Time Machine Types ---
export interface ResourceSnapshot {
  id: string;
  name: string;
  type: ResourceType;
  status: string;
  zone: string;
  labelHash: string; // To detect modifications cheaply
  meta: any; // Tiny critical metadata (size, machineType)
}

export interface TimelineEntry {
  date: string; // ISO Date "YYYY-MM-DD"
  timestamp: number;
  resources: ResourceSnapshot[];
}

export type DiffType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

export interface DiffResult {
  id: string;
  name: string;
  type: ResourceType;
  changeType: DiffType;
  details: string;
  past?: ResourceSnapshot;
  present?: GceResource;
}
// --------------------------

export interface LogEntry {
  id: string;
  timestamp: Date;
  severity: 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL';
  methodName: string;
  principalEmail: string;
  resourceName: string;
  summary: string;
  source: 'APP' | 'GCP';
  callerIp?: string;
  userAgent?: string;
  status?: { code?: number; message?: string };
  location?: string;
  metadata?: Record<string, any>;
  serviceName?: string;
}

export interface AnalysisResult {
  resourceId: string;
  suggestedLabels: Record<string, string>;
  reasoning: string;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface FilterConfig {
  search: string;
  statuses: string[];
  types: string[];
  zones: string[];
  machineTypes: string[];
  hasPublicIp: boolean | null;
  dateStart: string;
  dateEnd: string;
  labelLogic: 'AND' | 'OR';
  labels: { key: string; value: string }[];
  showUnlabeledOnly: boolean;
  tags?: string[];
  showViolationsOnly?: boolean;
  violatedPolicyId?: string; // NEW: Filter by specific policy
}

export interface SavedView {
  id: string;
  name: string;
  config: FilterConfig;
  createdAt: number;
}

export interface QuotaEntry {
  metric: string;
  limit: number;
  usage: number;
  region: string;
  percentage: number;
}
