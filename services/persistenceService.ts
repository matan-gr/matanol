
import { LabelHistoryEntry, TaxonomyRule, GovernancePolicy, SavedView, AppSettings, GceResource, TimelineEntry, ResourceSnapshot } from '../types';
import { ensureGovernanceBucket, fetchFileFromGcs, saveFileToGcs } from './gcpService';
import { compressData, decompressData } from '../utils/compression';
import { restoreGovernanceContext, getPolicies, DEFAULT_TAXONOMY } from './policyService';

const DB_NAME = 'CloudGov_Governance_DB';
const HISTORY_STORE_NAME = 'audit_history';
const GOV_STORE_NAME = 'governance_config';
const DB_VERSION = 4; // Version bump for upgrades

export interface HistoryRecord {
  projectId: string;
  resourceId: string;
  entries: LabelHistoryEntry[];
  lastModified: number;
}

export interface GovernanceRecord {
  projectId: string;
  taxonomy: TaxonomyRule[];
  policies: GovernancePolicy[]; 
  savedViews: SavedView[];
  settings: Partial<AppSettings>;
  lastModified: number;
}

// Metadata for optimistic locking
interface FileMetadata {
    generation: string;
    lastSynced: number;
}

class PersistenceService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  
  // In-memory cache for fast access
  private memoryHistoryCache: Map<string, LabelHistoryEntry[]> = new Map();
  private memoryGovCache: GovernanceRecord | null = null;
  private memoryTimelineCache: TimelineEntry[] | null = null;
  
  // Optimistic Locking state
  private meta: Record<string, FileMetadata> = {};

  private isRemoteEnabled = false;
  private currentProjectId = '';
  private currentToken = '';

  /**
   * Initialize the service.
   * Loads local data immediately, then attempts to sync with cloud.
   */
  async init(projectId: string, accessToken: string) {
    this.currentProjectId = projectId;
    this.currentToken = accessToken;
    
    // Clear caches from previous session to ensure security
    this.clearMemory();

    if (accessToken === 'demo-mode') {
      this.isRemoteEnabled = false;
      return;
    }

    try {
        const hasBucket = await ensureGovernanceBucket(projectId, accessToken);
        this.isRemoteEnabled = hasBucket;
        
        if (hasBucket) {
            // Background syncs
            this.syncHistoryFromCloud(projectId);
            this.syncGovernanceFromCloud(projectId);
        }
    } catch (e) {
        console.warn("Failed to init remote persistence", e);
        this.isRemoteEnabled = false;
    }
  }

  private clearMemory() {
      this.memoryHistoryCache.clear();
      this.memoryGovCache = null;
      this.memoryTimelineCache = null;
      this.meta = {};
  }

  // --- DB Operations ---

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
          const store = db.createObjectStore(HISTORY_STORE_NAME, { keyPath: ['projectId', 'resourceId'] });
          store.createIndex('projectId', 'projectId', { unique: false });
        }

        if (!db.objectStoreNames.contains(GOV_STORE_NAME)) {
          db.createObjectStore(GOV_STORE_NAME, { keyPath: 'projectId' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.error("Database error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  // --- HISTORY API ---

  async getProjectHistory(projectId: string): Promise<Record<string, LabelHistoryEntry[]>> {
    // 1. Return memory cache if available
    if (this.memoryHistoryCache.size > 0 && this.currentProjectId === projectId) {
       const map: Record<string, LabelHistoryEntry[]> = {};
       this.memoryHistoryCache.forEach((v, k) => map[k] = v);
       return map;
    }

    // 2. Fallback to IndexedDB
    try {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([HISTORY_STORE_NAME], 'readonly');
            const store = transaction.objectStore(HISTORY_STORE_NAME);
            const index = store.index('projectId');
            const request = index.getAll(projectId);

            request.onsuccess = () => {
                const results = request.result as HistoryRecord[];
                const historyMap: Record<string, LabelHistoryEntry[]> = {};
                results.forEach(record => {
                    historyMap[record.resourceId] = record.entries;
                    // Hydrate memory cache
                    if (projectId === this.currentProjectId) {
                        this.memoryHistoryCache.set(record.resourceId, record.entries);
                    }
                });
                resolve(historyMap);
            };
            request.onerror = () => reject(request.error);
        });
    } catch(e) {
        return {};
    }
  }

  async saveHistory(projectId: string, resourceId: string, entries: LabelHistoryEntry[]): Promise<void> {
    if (projectId === this.currentProjectId) {
       this.memoryHistoryCache.set(resourceId, entries);
    }

    // Local Save (Fire & Forget)
    this.saveHistoryLocal(projectId, resourceId, entries);

    // Remote Sync (Debounced)
    if (this.isRemoteEnabled && projectId === this.currentProjectId) {
       this.triggerHistorySync();
    }
  }

  async bulkSaveHistory(projectId: string, updates: Map<string, LabelHistoryEntry[]>): Promise<void> {
    if (projectId === this.currentProjectId) {
       updates.forEach((v, k) => this.memoryHistoryCache.set(k, v));
    }

    // Local Save
    const db = await this.getDB();
    const tx = db.transaction([HISTORY_STORE_NAME], 'readwrite');
    const store = tx.objectStore(HISTORY_STORE_NAME);
    
    updates.forEach((entries, resourceId) => {
        store.put({ projectId, resourceId, entries, lastModified: Date.now() });
    });

    // Remote Sync
    if (this.isRemoteEnabled && projectId === this.currentProjectId) {
       this.triggerHistorySync();
    }
  }

  private async saveHistoryLocal(projectId: string, resourceId: string, entries: LabelHistoryEntry[]) {
      const db = await this.getDB();
      const tx = db.transaction([HISTORY_STORE_NAME], 'readwrite');
      tx.objectStore(HISTORY_STORE_NAME).put({ projectId, resourceId, entries, lastModified: Date.now() });
  }

  // --- GOVERNANCE API ---

  async getGovernance(projectId: string): Promise<GovernanceRecord | null> {
      // Memory
      if (this.memoryGovCache && this.memoryGovCache.projectId === projectId) {
          return this.memoryGovCache;
      }

      // Local DB
      try {
          const db = await this.getDB();
          const record = await new Promise<GovernanceRecord>((resolve) => {
              const req = db.transaction([GOV_STORE_NAME], 'readonly').objectStore(GOV_STORE_NAME).get(projectId);
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(null as any);
          });
          
          if (record) {
              if (projectId === this.currentProjectId) this.memoryGovCache = record;
              return record;
          }
      } catch (e) { /* ignore */ }

      return null;
  }

  async saveGovernance(projectId: string, data: Partial<GovernanceRecord>): Promise<void> {
      const current = await this.getGovernance(projectId) || { 
          projectId, 
          taxonomy: DEFAULT_TAXONOMY, 
          policies: getPolicies(DEFAULT_TAXONOMY),
          savedViews: [], 
          settings: {} 
      } as GovernanceRecord;

      const updated: GovernanceRecord = {
          ...current,
          ...data,
          policies: data.policies ? data.policies.map(p => {
              // Strip functions before storage
              const { check, ...rest } = p; 
              return rest as GovernancePolicy;
          }) : current.policies,
          lastModified: Date.now()
      };

      if (projectId === this.currentProjectId) {
          this.memoryGovCache = updated;
      }

      // Local Save
      const db = await this.getDB();
      const tx = db.transaction([GOV_STORE_NAME], 'readwrite');
      tx.objectStore(GOV_STORE_NAME).put(updated);

      // Remote Sync
      if (this.isRemoteEnabled && projectId === this.currentProjectId) {
          this.triggerGovernanceSync(updated);
      }
  }

  // --- TIME MACHINE API ---

  async getTimeline(projectId: string): Promise<TimelineEntry[]> {
      if (this.memoryTimelineCache && this.currentProjectId === projectId) {
          return this.memoryTimelineCache;
      }
      if (this.isRemoteEnabled) {
          const res = await fetchFileFromGcs(projectId, this.currentToken, 'timeline.json');
          if (res) {
              const data = await decompressData<TimelineEntry[]>(res.blob);
              if (data) {
                  this.memoryTimelineCache = data;
                  this.meta['timeline.json'] = { generation: res.generation, lastSynced: Date.now() };
                  return data;
              }
          }
      }
      return [];
  }

  async saveInventorySnapshot(projectId: string, resources: GceResource[]): Promise<void> {
      if (!this.isRemoteEnabled) return;

      const today = new Date().toISOString().split('T')[0];
      let timeline = await this.getTimeline(projectId);
      
      // Filter out existing snapshot for today to update it
      timeline = timeline.filter(t => t.date !== today);

      // Compact Snapshot
      const snapshot: ResourceSnapshot[] = resources.map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          status: r.status,
          zone: r.zone,
          labelHash: JSON.stringify(r.labels), 
          meta: {
              machineType: r.machineType,
              sizeGb: r.sizeGb
          }
      }));

      const newEntry: TimelineEntry = {
          date: today,
          timestamp: Date.now(),
          resources: snapshot
      };

      // Keep last 90 days
      const updatedTimeline = [newEntry, ...timeline]
          .sort((a,b) => b.timestamp - a.timestamp)
          .slice(0, 90);
      
      this.memoryTimelineCache = updatedTimeline;

      // Compress and Upload with Optimistic Locking
      const blob = await compressData(updatedTimeline);
      const filename = 'timeline.json';
      const generation = this.meta[filename]?.generation;

      try {
          // We try to save. If generation mismatch, we should fetch latest, merge, and retry.
          // For timeline, simple overwrite/latest wins is usually acceptable as it's append-only per day.
          const newGen = await saveFileToGcs(projectId, this.currentToken, filename, blob, generation);
          if (newGen) {
              this.meta[filename] = { generation: newGen, lastSynced: Date.now() };
          }
      } catch (e) {
          console.warn("Timeline save failed or conflict", e);
      }
  }

  // --- SYNC ENGINE (COMPRESSED & ROBUST) ---

  private historyDebounce: any;
  private triggerHistorySync() {
     if (this.historyDebounce) clearTimeout(this.historyDebounce);
     this.historyDebounce = setTimeout(() => this.performHistorySync(), 3000);
  }

  private async performHistorySync() {
      if (!this.currentProjectId) return;
      const filename = 'history.json';
      
      // 1. Prepare Data
      const fullHistory: Record<string, LabelHistoryEntry[]> = {};
      this.memoryHistoryCache.forEach((v, k) => fullHistory[k] = v);
      const payload = { lastUpdated: new Date().toISOString(), history: fullHistory };
      const blob = await compressData(payload);

      // 2. Upload with Retry logic
      try {
          const currentGen = this.meta[filename]?.generation;
          const newGen = await saveFileToGcs(this.currentProjectId, this.currentToken, filename, blob, currentGen);
          if (newGen) {
              this.meta[filename] = { generation: newGen, lastSynced: Date.now() };
          } else {
              // Null usually means conflict (if logic in saveFile matches)
              // If conflict, we fetch remote, merge, and retry once
              await this.syncHistoryFromCloud(this.currentProjectId); // Re-fetch and merge
              // We don't immediately retry upload to avoid loops, next edit will trigger sync
          }
      } catch (e) {
          console.error("History sync failed", e);
          if (String(e).includes('Precondition Failed')) {
              await this.syncHistoryFromCloud(this.currentProjectId);
          }
      }
  }

  private async syncHistoryFromCloud(projectId: string) {
      const filename = 'history.json';
      const res = await fetchFileFromGcs(projectId, this.currentToken, filename);
      if (!res) return;

      const data = await decompressData<any>(res.blob);
      if (data && data.history) {
          // Merge Logic: Local memory is master for current session, but we merge missing keys/entries
          Object.entries(data.history).forEach(([resId, entries]) => {
              const local = this.memoryHistoryCache.get(resId) || [];
              const remote = entries as LabelHistoryEntry[];
              
              // Simple merge: Combine unique by timestamp+actor
              const combined = [...local];
              remote.forEach(r => {
                  if (!local.some(l => l.timestamp === r.timestamp && l.actor === r.actor)) {
                      combined.push(r);
                  }
              });
              
              combined.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              this.memoryHistoryCache.set(resId, combined);
          });
          
          this.meta[filename] = { generation: res.generation, lastSynced: Date.now() };
      }
  }

  private govDebounce: any;
  private triggerGovernanceSync(record: GovernanceRecord) {
      if (this.govDebounce) clearTimeout(this.govDebounce);
      this.govDebounce = setTimeout(() => this.performGovSync(record), 2000);
  }

  private async performGovSync(record: GovernanceRecord) {
      const filename = 'governance.json';
      const blob = await compressData(record);
      const generation = this.meta[filename]?.generation;

      try {
          const newGen = await saveFileToGcs(this.currentProjectId, this.currentToken, filename, blob, generation);
          if (newGen) {
              this.meta[filename] = { generation: newGen, lastSynced: Date.now() };
          }
      } catch (e) {
          console.warn("Governance sync conflict, fetching latest...");
          await this.syncGovernanceFromCloud(this.currentProjectId);
      }
  }

  private async syncGovernanceFromCloud(projectId: string) {
      const filename = 'governance.json';
      const res = await fetchFileFromGcs(projectId, this.currentToken, filename);
      if (!res) return;

      const remoteGov = await decompressData<GovernanceRecord>(res.blob);
      if (remoteGov) {
          // Check timestamp to see if remote is newer
          if (!this.memoryGovCache || remoteGov.lastModified > this.memoryGovCache.lastModified) {
              this.memoryGovCache = remoteGov;
              // Update local DB too
              const db = await this.getDB();
              db.transaction([GOV_STORE_NAME], 'readwrite').objectStore(GOV_STORE_NAME).put(remoteGov);
          }
          this.meta[filename] = { generation: res.generation, lastSynced: Date.now() };
      }
  }
}

export const persistenceService = new PersistenceService();
