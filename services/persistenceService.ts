
import { LabelHistoryEntry } from '../types';
import { ensureGovernanceBucket, fetchHistoryFromGcs, saveHistoryToGcs } from './gcpService';

const DB_NAME = 'CloudGov_Governance_DB';
const STORE_NAME = 'audit_history';
const DB_VERSION = 1;

export interface HistoryRecord {
  projectId: string;
  resourceId: string;
  entries: LabelHistoryEntry[];
  lastModified: number;
}

class PersistenceService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryCache: Map<string, LabelHistoryEntry[]> = new Map();
  private isRemoteEnabled = false;
  private currentProjectId = '';
  private currentToken = '';

  /**
   * Initialize the service with credentials.
   * In Real mode, this attempts to connect to GCS.
   */
  async init(projectId: string, accessToken: string) {
    this.currentProjectId = projectId;
    this.currentToken = accessToken;
    this.memoryCache.clear();

    if (accessToken === 'demo-mode') {
      this.isRemoteEnabled = false;
      return;
    }

    // Try to ensure remote bucket exists for Real Mode
    const hasBucket = await ensureGovernanceBucket(projectId, accessToken);
    this.isRemoteEnabled = hasBucket;
    
    if (hasBucket) {
      // Hydrate cache from Cloud
      const remoteData = await fetchHistoryFromGcs(projectId, accessToken);
      if (remoteData && remoteData.history) {
        Object.entries(remoteData.history).forEach(([resId, entries]) => {
           this.memoryCache.set(resId, entries as LabelHistoryEntry[]);
        });
      }
    }
  }

  // --- IndexedDB Logic (Local/Fallback) ---

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: ['projectId', 'resourceId'] });
          store.createIndex('projectId', 'projectId', { unique: false });
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

  // --- Public API ---

  async getProjectHistory(projectId: string): Promise<Record<string, LabelHistoryEntry[]>> {
    // If we have data in memory (from GCS init), return it
    if (this.memoryCache.size > 0 && this.currentProjectId === projectId) {
       const map: Record<string, LabelHistoryEntry[]> = {};
       this.memoryCache.forEach((v, k) => map[k] = v);
       return map;
    }

    // Fallback to IndexedDB
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('projectId');
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const results = request.result as HistoryRecord[];
        const historyMap: Record<string, LabelHistoryEntry[]> = {};
        results.forEach(record => {
          historyMap[record.resourceId] = record.entries;
        });
        resolve(historyMap);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async saveHistory(projectId: string, resourceId: string, entries: LabelHistoryEntry[]): Promise<void> {
    // Update Memory
    if (projectId === this.currentProjectId) {
       this.memoryCache.set(resourceId, entries);
    }

    // 1. Save Local (Reliability)
    const db = await this.getDB();
    const saveLocal = new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const record: HistoryRecord = { projectId, resourceId, entries, lastModified: Date.now() };
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    await saveLocal;

    // 2. Sync to Cloud (Security) - Fire & Forget
    if (this.isRemoteEnabled && projectId === this.currentProjectId) {
       this.syncToCloud();
    }
  }

  async bulkSaveHistory(projectId: string, updates: Map<string, LabelHistoryEntry[]>): Promise<void> {
    // Update Memory
    if (projectId === this.currentProjectId) {
       updates.forEach((v, k) => this.memoryCache.set(k, v));
    }

    const db = await this.getDB();
    const saveLocal = new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      updates.forEach((entries, resourceId) => {
        store.put({ projectId, resourceId, entries, lastModified: Date.now() });
      });
    });

    await saveLocal;

    if (this.isRemoteEnabled && projectId === this.currentProjectId) {
       this.syncToCloud();
    }
  }

  private debounceTimer: any = null;
  private syncToCloud() {
     // Debounce cloud writes to avoid spamming GCS on bulk updates
     if (this.debounceTimer) clearTimeout(this.debounceTimer);
     
     this.debounceTimer = setTimeout(async () => {
        const fullHistory: Record<string, LabelHistoryEntry[]> = {};
        this.memoryCache.forEach((v, k) => fullHistory[k] = v);
        
        await saveHistoryToGcs(this.currentProjectId, this.currentToken, {
           lastUpdated: new Date().toISOString(),
           history: fullHistory
        });
     }, 2000);
  }
}

export const persistenceService = new PersistenceService();
