
import { GceResource, GovernancePolicy, PolicyViolation, TaxonomyRule, PolicyRuleConfig, PolicySeverity } from '../types';

// --- Default Taxonomy Rules (Enterprise Standards) ---
export const DEFAULT_TAXONOMY: TaxonomyRule[] = [
  { key: 'environment', allowedValues: ['production', 'staging', 'development', 'dr'], isRequired: true },
  { key: 'cost-center', allowedValues: [], isRequired: true }, // Empty array = allow any value, just check presence
  { key: 'owner', allowedValues: [], isRequired: true },
  { key: 'data-classification', allowedValues: ['public', 'internal', 'confidential', 'restricted'], isRequired: false },
];

// --- Policy Logic Implementation ---

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
    return val && rule.allowedValues.length > 0 && !rule.allowedValues.includes(val);
  });

  if (invalid.length > 0) {
    return `Invalid label values for: ${invalid.map(i => `${i.key} (found: ${r.labels[i.key]})`).join(', ')}`;
  }
  return null;
};

// --- Dynamic Check Generator ---
const createDynamicCheck = (config: PolicyRuleConfig): ((r: GceResource) => string | null) => {
  switch (config.type) {
    case 'REQUIRED_LABEL':
      return (r) => {
        if (config.params.key && !r.labels[config.params.key]) {
          return `Missing mandatory label: "${config.params.key}"`;
        }
        return null;
      };
    case 'ALLOWED_VALUES':
      return (r) => {
        const key = config.params.key;
        const val = key ? r.labels[key] : undefined;
        if (key && val && config.params.values && config.params.values.length > 0) {
          if (!config.params.values.includes(val)) {
            return `Value "${val}" for label "${key}" is not allowed. Options: ${config.params.values.join(', ')}`;
          }
        }
        return null;
      };
    case 'NAME_REGEX':
      return (r) => {
        if (config.params.regex) {
          try {
            const re = new RegExp(config.params.regex);
            if (!re.test(r.name)) {
              return `Resource name does not match required pattern: ${config.params.regex}`;
            }
          } catch (e) {
            return `Invalid Regex configuration`;
          }
        }
        return null;
      };
    case 'REGION_RESTRICTION':
      return (r) => {
        if (r.zone === 'global') return null;
        if (config.params.values && config.params.values.length > 0) {
          // Check if zone starts with any allowed region prefix (e.g. us-central1 matches us-central1-a)
          const allowed = config.params.values.some(region => r.zone.startsWith(region));
          if (!allowed) {
            return `Resource located in unauthorized region: ${r.zone}. Allowed: ${config.params.values.join(', ')}`;
          }
        }
        return null;
      };
    default:
      return () => null;
  }
};

// --- Helper: Hydrate Policy ---
// Takes a raw policy object (potentially from storage) and re-attaches the check function
export const hydratePolicy = (policy: GovernancePolicy): GovernancePolicy => {
  if (policy.ruleConfig) {
    return {
      ...policy,
      check: createDynamicCheck(policy.ruleConfig)
    };
  }
  return policy;
};

export const createCustomPolicy = (
  name: string,
  description: string,
  severity: PolicySeverity,
  category: string,
  config: PolicyRuleConfig
): GovernancePolicy => {
  const policy: GovernancePolicy = {
    id: `custom-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    category,
    severity,
    isEnabled: true,
    isCustom: true,
    ruleConfig: config,
    check: () => null // Placeholder, hydrated below
  };
  return hydratePolicy(policy);
};

// --- Static Policies ---

const checkNamingConvention = (r: GceResource): string | null => {
  if (!/^[a-z0-9-]+$/.test(r.name)) return "Name contains uppercase or special characters.";
  if (!r.name.includes('-')) return "Name does not follow hyphenated convention.";
  return null;
};

const checkPublicExposure = (r: GceResource): string | null => {
  const classification = r.labels['data-classification'];
  const hasPublicIp = r.ips?.some(ip => !!ip.external) || r.type === 'CLOUD_RUN' && r.ingress === 'all';
  
  if (hasPublicIp && (classification === 'confidential' || classification === 'restricted')) {
    return "Public IP detected on Restricted/Confidential asset.";
  }
  if (hasPublicIp && r.type === 'CLOUD_SQL') {
      return "Database instance has public IP assignment.";
  }
  return null;
};

const checkCostCenterFormat = (r: GceResource): string | null => {
  const cc = r.labels['cost-center'];
  if (cc && !/^cc-\d{3,5}$/.test(cc)) return "Cost Center format invalid. Must match 'cc-XXXX'.";
  return null;
};

const checkUtilization = (r: GceResource): string | null => {
    if (r.type === 'INSTANCE' && r.status === 'STOPPED') return "Resource is STOPPED but incurring storage costs.";
    return null;
};

export const getPolicies = (taxonomy: TaxonomyRule[]): GovernancePolicy[] => [
  {
    id: 'req-labels',
    name: 'Mandatory Labeling',
    description: 'Ensure all resources have the critical labels defined in the Taxonomy.',
    category: 'OPERATIONS',
    isEnabled: true,
    severity: 'CRITICAL',
    check: (r) => checkRequiredLabels(r, taxonomy)
  },
  {
    id: 'taxonomy-values',
    name: 'Controlled Vocabulary',
    description: 'Labels must match the allowed values list.',
    category: 'OPERATIONS',
    isEnabled: true,
    severity: 'WARNING',
    check: (r) => checkAllowedValues(r, taxonomy)
  },
  {
    id: 'naming-std',
    name: 'Naming Convention',
    description: 'Resources must be lowercase, hyphenated, and follow standard patterns.',
    category: 'OPERATIONS',
    isEnabled: true,
    severity: 'INFO',
    check: (r) => checkNamingConvention(r)
  },
  {
    id: 'security-exposure',
    name: 'Public Exposure Risk',
    description: 'Confidential assets and Databases must not have external IP addresses.',
    category: 'SECURITY',
    isEnabled: true,
    severity: 'CRITICAL',
    check: (r) => checkPublicExposure(r)
  },
  {
    id: 'cost-center-fmt',
    name: 'Cost Center Format',
    description: 'Cost centers must follow the "cc-XXXX" accounting format.',
    category: 'COST',
    isEnabled: true,
    severity: 'WARNING',
    check: (r) => checkCostCenterFormat(r)
  },
  {
    id: 'idle-waste',
    name: 'Idle Resource Waste',
    description: 'Detects resources that are stopped but still incurring storage costs.',
    category: 'COST',
    isEnabled: true,
    severity: 'MEDIUM',
    check: (r) => checkUtilization(r)
  }
];

/**
 * Re-attaches logic to loaded policies.
 * 1. For Standard policies: Merges saved config (enabled/severity) with code-defined logic.
 * 2. For Custom policies: Re-generates the check function from the saved ruleConfig.
 */
export const restoreGovernanceContext = (
  savedPolicies: GovernancePolicy[], 
  savedTaxonomy: TaxonomyRule[]
): GovernancePolicy[] => {
  const standardPolicies = getPolicies(savedTaxonomy); // Get fresh code-backed standard policies
  
  // Create a map for quick lookup of standard policies
  const standardMap = new Map(standardPolicies.map(p => [p.id, p]));

  // Merge saved state
  const restored = savedPolicies.map(p => {
    if (p.isCustom) {
      // Re-generate logic from config
      return hydratePolicy(p); 
    } else {
      // Re-attach code to standard policy, but keep saved config (severity, enabled, category)
      const standard = standardMap.get(p.id);
      if (standard) {
        // We override standard props with saved props, but force the 'check' function from standard
        return { ...standard, ...p, check: standard.check };
      }
      return p; // Should not happen unless standard policy ID changed in code
    }
  });

  // Ensure any NEW standard policies added to codebase since last save are included
  standardPolicies.forEach(sp => {
      if (!restored.find(p => p.id === sp.id)) {
          restored.push(sp);
      }
  });

  return restored;
};

export const evaluateResource = (
  resource: GceResource, 
  policies: GovernancePolicy[]
): PolicyViolation[] => {
  const violations: PolicyViolation[] = [];

  policies.forEach(policy => {
    if (policy.isEnabled) {
      // Defensive check in case hydration failed
      if (!policy.check) return; 
      
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

export const evaluateInventory = (
  resources: GceResource[],
  taxonomy: TaxonomyRule[] = DEFAULT_TAXONOMY,
  customPolicies?: GovernancePolicy[]
): GceResource[] => {
  // If custom policies provided, use them. Otherwise default.
  // NOTE: If using custom, ensure default static ones are included if desired in caller.
  const activePolicies = customPolicies || getPolicies(taxonomy);

  return resources.map(r => ({
    ...r,
    violations: evaluateResource(r, activePolicies)
  }));
};
