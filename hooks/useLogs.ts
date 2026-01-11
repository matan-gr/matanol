import { useState, useCallback } from 'react';
import { LogEntry, GcpCredentials } from '../types';
import { fetchGcpAuditLogs } from '../services/gcpService';

export const useLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Add local log entry (legacy support for app internal logs)
  const addAppLog = useCallback((message: string, level: string = 'INFO') => {
    // For now, we might choose NOT to mix these with GCP logs if we want purity.
    // But for "Connecting..." feedback, we might use notifications instead.
    // If we want to show them, we can conform to LogEntry structure:
    /*
    setLogs(prev => [{
        id: Math.random().toString(36),
        timestamp: new Date(),
        severity: level as any,
        methodName: 'App.Internal',
        principalEmail: 'Current User',
        resourceName: 'System',
        summary: message,
        source: 'APP'
    }, ...prev]);
    */
  }, []);

  const refreshGcpLogs = useCallback(async (credentials: GcpCredentials) => {
    if (!credentials.accessToken || credentials.accessToken === 'demo-mode') return;

    setIsLoadingLogs(true);
    try {
        const fetched = await fetchGcpAuditLogs(credentials.projectId, credentials.accessToken);
        setLogs(fetched);
    } catch (e) {
        console.error("Failed to fetch logs", e);
    } finally {
        setIsLoadingLogs(false);
    }
  }, []);

  return {
    logs,
    addAppLog,
    refreshGcpLogs,
    isLoadingLogs,
    setLogs // Exposed for demo data injection if needed
  };
};