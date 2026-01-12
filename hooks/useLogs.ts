
import { useState, useCallback } from 'react';
import { LogEntry, GcpCredentials } from '../types';
import { fetchGcpAuditLogs } from '../services/gcpService';

const MAX_LOGS = 1000; // Hard limit for client-side storage

export const useLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const refreshGcpLogs = useCallback(async (credentials: GcpCredentials) => {
    if (!credentials.accessToken || credentials.accessToken === 'demo-mode') return;

    setIsLoadingLogs(true);
    try {
        const fetched = await fetchGcpAuditLogs(credentials.projectId, credentials.accessToken);
        
        setLogs(prevLogs => {
            // Merge new logs with existing, avoiding duplicates based on ID
            const newLogMap = new Map(fetched.map(l => [l.id, l]));
            const combined = [...fetched];
            
            // Add previous logs that aren't in the new batch
            prevLogs.forEach(l => {
                if (!newLogMap.has(l.id)) {
                    combined.push(l);
                }
            });

            // Sort by timestamp desc and slice to MAX_LOGS
            return combined
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, MAX_LOGS);
        });
    } catch (e) {
        console.error("Failed to fetch logs", e);
    } finally {
        setIsLoadingLogs(false);
    }
  }, []);

  return {
    logs,
    refreshGcpLogs,
    isLoadingLogs,
    setLogs 
  };
};
