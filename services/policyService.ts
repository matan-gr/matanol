
import { GceResource, GovernancePolicy, PolicyViolation, TaxonomyRule } from '../types';

// --- Default Taxonomy Rules (Enterprise Standards) ---
export const DEFAULT_TAXONOMY: TaxonomyRule[] = [
  { key: 'environment', allowedValues: ['production', 'staging', 'development', 'dr'], isRequired: true },
  { key: 'cost-center', allowedValues: [], isRequired: true }, // Empty array = allow any value, just check presence
  { key: 'owner', allowedValues: [], isRequired: true },
  { key: 'data-classification', allowedValues: ['public', 'internal', 'confidential', 'restricted'], isRequired: false },
];

// --- Policy Implementations ---

const checkRequiredLabels = (r: GceResource, rules: TaxonomyRule[]): string | null => {
  const missing = rules.filter(rule => rule.isRequired && !r.labels[rule.key]);
  if (missing.length > 0) {
    return `Missing required labels: ${missing.map(m => m.key).join(', ')}`;
  }
  return null;
};

const checkAllowedValues = (r: GceResource, rules: TaxonomyRule[]): string | null => {
  const invalid = rules.filter(rule => {
    const val = r.labels[rule.key];
    // If label exists AND allowedValues has items AND val is not in allowedValues
    return val && rule.allowedValues.length > 0 && !rule.allowedValues.includes(val);
  });

  if (invalid.length > 0) {
    return `Invalid label values for: ${invalid.map(i => `${i.key} (found: ${r.labels[i.key]})`).join(', ')}`;
  }
  return null;
};

const checkNamingConvention = (r: GceResource): string | null => {
  // Enterprise Standard: [env]-[app]-[role]-[index]
  // Rough check: Must be lowercase, no spaces, at least one hyphen
  if (!/^[a-z0-9-]+$/.test(r.name)) {
    return "Name contains uppercase or special characters.";
  }
  if (!r.name.includes('-')) {
    return "Name does not follow hyphenated convention (e.g. env-app-role).";
  }
  return null;
};

const checkPublicExposure = (r: GceResource): string | null => {
  // If it's tagged 'internal' or 'restricted' but has public IP
  const classification = r.labels['data-classification'];
  const hasPublicIp = r.ips?.some(ip => !!ip.external);
  
  if (hasPublicIp && (classification === 'confidential' || classification === 'restricted')) {
    return "Public IP detected on Restricted/Confidential asset.";
  }
  return null;
};

const checkCostCenterFormat = (r: GceResource): string | null => {
  const cc = r.labels['cost-center'];
  if (cc && !/^cc-\d{3,5}$/.test(cc)) {
    return "Cost Center format invalid. Must match 'cc-XXXX'.";
  }
  return null;
};

// --- Policy Registry ---

export const getPolicies = (taxonomy: TaxonomyRule[]): GovernancePolicy[] => [
  {
    id: 'req-labels',
    name: 'Mandatory Labeling',
    description: 'Ensure all resources have the critical labels defined in the Taxonomy.',
    isEnabled: true,
    severity: 'CRITICAL',
    check: (r) => checkRequiredLabels(r, taxonomy)
  },
  {
    id: 'taxonomy-values',
    name: 'Controlled Vocabulary',
    description: 'Labels must match the allowed values list (e.g. environment must be "production", not "prod").',
    isEnabled: true,
    severity: 'WARNING',
    check: (r) => checkAllowedValues(r, taxonomy)
  },
  {
    id: 'naming-std',
    name: 'Naming Convention',
    description: 'Resources must be lowercase, hyphenated, and follow standard patterns.',
    isEnabled: true,
    severity: 'INFO',
    check: (r) => checkNamingConvention(r)
  },
  {
    id: 'data-sovereignty',
    name: 'Data Sovereignty (Geo)',
    description: 'Resources should typically stay within approved regions (us-*, europe-west1).',
    isEnabled: false, // Disabled by default
    severity: 'WARNING',
    check: (r) => {
      const allowedPrefixes = ['us-', 'europe-west1', 'global'];
      if (!allowedPrefixes.some(p => r.zone.startsWith(p))) {
        return `Resource located in non-standard region: ${r.zone}`;
      }
      return null;
    }
  },
  {
    id: 'security-exposure',
    name: 'DLP Public Exposure',
    description: 'Confidential assets must not have external IP addresses.',
    isEnabled: true,
    severity: 'CRITICAL',
    check: (r) => checkPublicExposure(r)
  },
  {
    id: 'cost-center-fmt',
    name: 'Cost Center Format',
    description: 'Cost centers must follow the "cc-XXXX" accounting format.',
    isEnabled: true,
    severity: 'WARNING',
    check: (r) => checkCostCenterFormat(r)
  }
];

/**
 * Evaluates a single resource against all enabled policies.
 */
export const evaluateResource = (
  resource: GceResource, 
  policies: GovernancePolicy[]
): PolicyViolation[] => {
  const violations: PolicyViolation[] = [];

  policies.forEach(policy => {
    if (policy.isEnabled) {
      const result = policy.check(resource);
      if (result) {
        violations.push({
          policyId: policy.id,
          message: result,
          severity: policy.severity
        });
      }
    }
  });

  return violations;
};

/**
 * Batch evaluates entire inventory.
 */
export const evaluateInventory = (
  resources: GceResource[],
  taxonomy: TaxonomyRule[] = DEFAULT_TAXONOMY,
  customPolicies?: GovernancePolicy[]
): GceResource[] => {
  const activePolicies = customPolicies || getPolicies(taxonomy);

  return resources.map(r => ({
    ...r,
    violations: evaluateResource(r, activePolicies)
  }));
};
