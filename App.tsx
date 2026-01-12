
import React, { useState, useEffect, useCallback } from 'react';
import { GcpCredentials, FilterConfig, SavedView, QuotaEntry } from './types';
import { Layout } from './components/Layout';
import { ResourceTable } from './components/ResourceTable';
import { LogViewer } from './components/LogViewer';
import { Dashboard } from './components/Dashboard';
import { TopologyMap } from './components/TopologyMap';
import { LoginScreen } from './components/LoginScreen';
import { CommandPalette } from './components/CommandPalette';
import { PolicyManager } from './components/PolicyManager';
import { ComplianceReportModal } from './components/ComplianceReportModal';
import { GlobalContextMenu } from './components/GlobalContextMenu'; // Import
import { useNotifications } from './hooks/useNotifications';
import { useResourceManager } from './hooks/useResourceManager';
import { useLogs } from './hooks/useLogs';
import { Button, Input, Card, SectionHeader } from './components/DesignSystem';
import { Moon, Sun, Network, RefreshCw, ShieldCheck, FileText, Loader2, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Storage } from './utils/storage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QuotaVisuals } from './components/QuotaVisuals';
import { fetchQuotas } from './services/gcpService';

// Fix for framer-motion type mismatches
const MotionDiv = motion.div as any;

const DEFAULT_FILTER_CONFIG: FilterConfig = {
  search: '',
  statuses: [],
  types: [],
  zones: [],
  machineTypes: [],
  hasPublicIp: null,
  dateStart: '',
  dateEnd: '',
  labelLogic: 'AND',
  labels: [],
  showUnlabeledOnly: false
};

// Enterprise-grade transition with spring physics
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MotionDiv
    initial={{ opacity: 0, y: 15, scale: 0.99 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -15, scale: 0.99 }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    className="h-full"
  >
    {children}
  </MotionDiv>
);

export const App = () => {
  // State
  const [credentials, setCredentials] = useState<GcpCredentials | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [isDark, setIsDark] = useState(true);
  const [quotas, setQuotas] = useState<QuotaEntry[]>([]);
  const [isLoadingQuotas, setIsLoadingQuotas] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false); // Global Palette State

  // Hooks
  const { notifications, addNotification, dismissNotification } = useNotifications();
  const { 
    resources, 
    stats, 
    isConnecting, 
    loadingStatus, 
    report, 
    isAnalysing, // Used for button state
    connectProject, 
    loadDemoData, 
    analyzeResources, 
    updateResourceLabels, 
    revertResource, 
    clearReport,
    batchProgress,
    bulkUpdateLabels,
    updateGovernance
  } = useResourceManager(
    (msg, level) => {}, 
    addNotification
  );
  
  const { logs, refreshGcpLogs, isLoadingLogs } = useLogs();

  // Load Preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    if (credentials?.projectId) {
       const views = Storage.get<SavedView[]>(credentials.projectId, 'saved_views', []);
       setSavedViews(views);
    }
  }, [credentials?.projectId]);

  // Show report when generated
  useEffect(() => {
    if (report && !isAnalysing) {
        setShowReport(true);
    }
  }, [report, isAnalysing]);

  // Global Key Listener for Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers
  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      if (next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const handleConnect = async (creds: GcpCredentials) => {
    const success = await connectProject(creds);
    if (success) {
      setCredentials(creds);
      setActiveTab('dashboard');
      refreshGcpLogs(creds);
      
      // Fetch Quotas asynchronously
      setIsLoadingQuotas(true);
      fetchQuotas(creds.projectId, creds.accessToken)
        .then(setQuotas)
        .catch(e => console.error("Quota fetch error", e))
        .finally(() => setIsLoadingQuotas(false));
    }
  };

  const handleDemo = () => {
    loadDemoData();
    setCredentials({ projectId: 'demo-mode', accessToken: 'demo-mode' });
    setActiveTab('dashboard');
    // Fake quotas for demo
    setQuotas([
        { metric: 'CPUS', limit: 24, usage: 20, region: 'us-central1', percentage: 83.3 },
        { metric: 'SSD_TOTAL_GB', limit: 1024, usage: 800, region: 'us-central1', percentage: 78.1 },
        { metric: 'IN_USE_ADDRESSES', limit: 8, usage: 8, region: 'global', percentage: 100 },
        { metric: 'NVIDIA_A100_GPUS', limit: 12, usage: 0, region: 'us-central1', percentage: 0 },
    ]);
  };

  const handleDisconnect = () => {
    setCredentials(null);
    setActiveTab('dashboard');
    setFilterConfig(DEFAULT_FILTER_CONFIG);
  };

  const handleSaveView = (name: string) => {
    if (!credentials?.projectId) return;
    const newView: SavedView = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      config: filterConfig,
      createdAt: Date.now()
    };
    const updatedViews = [...savedViews, newView];
    setSavedViews(updatedViews);
    Storage.set(credentials.projectId, 'saved_views', updatedViews);
    addNotification(`View "${name}" saved.`, 'success');
  };

  const handleLoadView = (view: SavedView) => {
    setFilterConfig(view.config);
    addNotification(`View "${view.name}" loaded.`, 'info');
  };

  const handleDeleteView = (id: string) => {
    if (!credentials?.projectId) return;
    const updatedViews = savedViews.filter(v => v.id !== id);
    setSavedViews(updatedViews);
    Storage.set(credentials.projectId, 'saved_views', updatedViews);
    addNotification('View deleted.', 'info');
  };

  // Render Login
  if (!credentials) {
    return (
      <ErrorBoundary>
        <LoginScreen 
          onConnect={handleConnect} 
          isConnecting={isConnecting}
          loadingStatus={loadingStatus}
          onDemo={handleDemo}
        />
        {/* Render Toast Container even on Login Screen - reuse Layout's logic but simplified for login */}
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
            <AnimatePresence>
                {notifications.map(n => (
                    <MotionDiv key={n.id} initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0}} className="bg-slate-900 border border-red-500/50 p-4 rounded-xl shadow-2xl pointer-events-auto text-white flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                           <div className="font-bold text-sm">System Alert</div>
                           <div className="text-sm opacity-80">{n.message}</div>
                        </div>
                    </MotionDiv>
                ))}
            </AnimatePresence>
        </div>
      </ErrorBoundary>
    );
  }

  // Main App
  return (
    <ErrorBoundary>
      <CommandPalette 
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        resources={resources}
        onNavigate={setActiveTab}
        onSelectResource={(id) => {
            setFilterConfig(prev => ({ ...prev, search: id }));
        }}
        onToggleTheme={toggleTheme}
        onDisconnect={handleDisconnect}
      />
      
      <GlobalContextMenu 
        onOpenCommandPalette={() => setIsPaletteOpen(true)}
        onNavigate={setActiveTab}
        onToggleTheme={toggleTheme}
        onDisconnect={handleDisconnect}
        isDark={isDark}
      />
      
      <Layout 
        activeTab={activeTab} 
        onNavigate={setActiveTab}
        onDisconnect={handleDisconnect}
        notifications={notifications}
        onDismissNotification={dismissNotification}
        isDark={isDark}
        toggleTheme={toggleTheme}
        savedViews={savedViews}
        onSelectView={handleLoadView}
        onDeleteView={handleDeleteView}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <PageTransition key="dashboard">
              <Dashboard resources={resources} stats={stats} onNavigate={setActiveTab} />
            </PageTransition>
          )}

          {activeTab === 'inventory' && (
            <PageTransition key="inventory">
              <SectionHeader 
                title="Resource Inventory" 
                subtitle="Manage, label, and audit your entire cloud footprint."
                action={
                    <Button 
                        variant="secondary" 
                        onClick={analyzeResources} 
                        isLoading={isAnalysing}
                        className={`
                            border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30
                            ${isAnalysing ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-900'}
                        `}
                        leftIcon={isAnalysing ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    >
                        {isAnalysing ? 'Running AI Auditor...' : 'Run AI Audit'}
                    </Button>
                }
              />
              <ResourceTable 
                resources={resources}
                filterConfig={filterConfig}
                onFilterChange={setFilterConfig}
                onSaveView={handleSaveView}
                savedViews={savedViews}
                onLoadView={handleLoadView}
                onDeleteView={handleDeleteView}
                onApplyLabels={(id, labels) => updateResourceLabels(credentials, id, labels, true)}
                onUpdateLabels={(id, labels) => updateResourceLabels(credentials, id, labels, false)}
                onRevert={revertResource}
                onBulkUpdateLabels={(updates) => bulkUpdateLabels(credentials, updates)}
                onRefresh={() => handleConnect(credentials)} // Reuse connect for full refresh
                isLoading={isConnecting}
                batchProgress={batchProgress}
              />
              
              <ComplianceReportModal 
                 isOpen={showReport}
                 onClose={() => setShowReport(false)}
                 report={report}
              />
            </PageTransition>
          )}

          {activeTab === 'topology' && (
            <PageTransition key="topology">
                <div className="h-[calc(100vh-140px)] min-h-[600px] flex flex-col">
                    <SectionHeader title="Network Topology" subtitle="Visualize resource relationships and connectivity." />
                    <TopologyMap resources={resources} />
                </div>
            </PageTransition>
          )}

          {activeTab === 'quotas' && (
             <PageTransition key="quotas">
                <SectionHeader 
                    title="Quotas & Limits" 
                    subtitle="Monitor capacity usage across regions to prevent outages." 
                    action={
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                                setIsLoadingQuotas(true);
                                fetchQuotas(credentials.projectId, credentials.accessToken)
                                    .then(setQuotas)
                                    .finally(() => setIsLoadingQuotas(false));
                            }}
                            isLoading={isLoadingQuotas}
                            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoadingQuotas ? 'animate-spin' : ''}`} />}
                        >
                            Refresh
                        </Button>
                    }
                />
                <QuotaVisuals quotas={quotas} isLoading={isLoadingQuotas} />
             </PageTransition>
          )}

          {activeTab === 'policy' && (
             <PageTransition key="policy">
                <SectionHeader 
                    title="Governance Center" 
                    subtitle="Define labeling taxonomies and enforce active compliance policies." 
                />
                <PolicyManager resources={resources} onUpdatePolicies={updateGovernance} />
             </PageTransition>
          )}

          {activeTab === 'logs' && (
            <PageTransition key="logs">
                <div className="h-[calc(100vh-140px)] min-h-[600px] flex flex-col">
                    <SectionHeader title="Audit Logs" subtitle="Trace administrative actions and API calls." />
                    <LogViewer 
                        logs={logs} 
                        onRefresh={() => refreshGcpLogs(credentials)} 
                        isLoading={isLoadingLogs} 
                    />
                </div>
            </PageTransition>
          )}
        </AnimatePresence>
      </Layout>
    </ErrorBoundary>
  );
};
