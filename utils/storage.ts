
/**
 * Storage Utility for Enterprise Resource Governance
 * 
 * Handles local persistence of user configurations (Views, Settings).
 * Uses IndexedDB for secure, asynchronous, and structured storage.
 * 
 * Note: Sensitive credentials (Access Tokens) are NEVER stored here 
 * and remain in memory only.
 */

const DB_NAME = 'YallaLabel_ConfigDB';
const STORE_NAME = 'user_configs';
const DB_VERSION = 1;

class ConfigStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.error("Config Database error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Save data scoped to a specific project context
   */
  async set(projectId: string, key: string, data: any): Promise<void> {
    if (!projectId) return;
    try {
      const storageKey = `${projectId}_${key}`;
      const db = await this.getDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, storageKey);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('Storage write failed', e);
    }
  }

  /**
   * Retrieve data scoped to a specific project context
   */
  async get<T>(projectId: string, key: string, defaultValue: T): Promise<T> {
    if (!projectId) return defaultValue;
    try {
      const storageKey = `${projectId}_${key}`;
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(storageKey);

        request.onsuccess = () => {
          resolve(request.result !== undefined ? request.result as T : defaultValue);
        };

        request.onerror = () => {
          resolve(defaultValue);
        };
      });
    } catch (e) {
      return defaultValue;
    }
  }

  /**
   * Clear all data for a specific project
   */
  async clearProjectData(projectId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          const key = cursor.key as string;
          if (key.startsWith(`${projectId}_`)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    } catch (e) {
      console.error("Failed to clear project data", e);
    }
  }
}

export const Storage = new ConfigStorage();
