import React from 'react';
import { NAVIGATION_ITEMS, APP_NAME } from '../constants';
import { LogOut, Menu, X, CheckCircle2, AlertTriangle, Info, Moon, Sun, Bookmark, Trash2, Tags, Search, ChevronRight, AlertOctagon, Terminal, Zap } from 'lucide-react';
import { Notification, SavedView } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

// Fix for framer-motion type mismatches
const MotionDiv = motion.div as any;
const MotionLi = motion.li as any;

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onNavigate: (id: string) => void;
  onDisconnect: () => void;
  notifications?: Notification[];
  onDismissNotification?: (id: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
  savedViews?: SavedView[];
  onSelectView?: (view: SavedView) => void;
  onDeleteView?: (id: string) => void;
}

const ToastItem: React.FC<{ n: Notification, onDismiss: (id: string) => void }> = ({ n, onDismiss }) => {
    // Determine styles based on type
    let styles = {
        bg: 'bg-white/90 dark:bg-slate-900/90',
        border: 'border-slate-200 dark:border-slate-700',
        iconColor: 'text-slate-500',
        titleColor: 'text-slate-800 dark:text-slate-200',
        progress: 'bg-slate-400',
        Icon: Info
    };

    switch (n.type) {
        case 'success':
            styles = {
                bg: 'bg-emerald-50/95 dark:bg-slate-900/95',
                border: 'border-emerald-200 dark:border-emerald-900/50',
                iconColor: 'text-emerald-500',
                titleColor: 'text-emerald-800 dark:text-emerald-400',
                progress: 'bg-emerald-500',
                Icon: CheckCircle2
            };
            break;
        case 'error':
            styles = {
                bg: 'bg-red-50/95 dark:bg-slate-900/95',
                border: 'border-red-200 dark:border-red-900/50',
                iconColor: 'text-red-500',
                titleColor: 'text-red-800 dark:text-red-400',
                progress: 'bg-red-500',
                Icon: AlertOctagon
            };
            break;
        case 'warning':
            styles = {
                bg: 'bg-amber-50/95 dark:bg-slate-900/95',
                border: 'border-amber-200 dark:border-amber-900/50',
                iconColor: 'text-amber-500',
                titleColor: 'text-amber-800 dark:text-amber-400',
                progress: 'bg-amber-500',
                Icon: AlertTriangle
            };
            break;
        case 'info':
            styles = {
                bg: 'bg-blue-50/95 dark:bg-slate-900/95',
                border: 'border-blue-200 dark:border-blue-900/50',
                iconColor: 'text-blue-500',
                titleColor: 'text-blue-800 dark:text-blue-400',
                progress: 'bg-blue-500',
                Icon: Info
            };
            break;
    }

    return (
        <MotionDiv 
            layout
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`
                pointer-events-auto flex flex-col w-full rounded-xl shadow-2xl border backdrop-blur-md overflow-hidden relative mb-3
                ${styles.bg} ${styles.border}
            `}
        >
            <div className="flex items-start gap-3 p-4">
                <div className={`shrink-0 mt-0.5 ${styles.iconColor}`}>
                    <styles.Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 pr-6">
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${styles.titleColor}`}>
                        {n.type === 'info' ? 'System Notification' : n.type}
                    </h4>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                        {n.message}
                    </p>
                    <div className="mt-2 text-[10px] font-mono text-slate-400 dark:text-slate-500 opacity-70">
                        {APP_NAME} System
                    </div>
                </div>
                <button 
                    onClick={() => onDismiss(n.id)}
                    className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            
            {/* Progress Bar */}
            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800/50">
                <MotionDiv 
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: n.type === 'error' ? 8 : 5, ease: "linear" }}
                    className={`h-full ${styles.progress}`}
                />
            </div>
        </MotionDiv>
    );
};

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onNavigate, 
  onDisconnect,
  notifications = [],
  onDismissNotification,
  isDark,
  toggleTheme,
  savedViews = [],
  onSelectView,
  onDeleteView
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden relative transition-colors duration-300 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/30 selection:text-indigo-900 dark:selection:text-indigo-100">
      
      {/* Toast Notification Hub */}
      <div className="fixed top-20 right-6 z-[100] flex flex-col items-end w-full max-w-[380px] pointer-events-none gap-2">
        <AnimatePresence mode="popLayout">
          {notifications.map((n) => (
             <ToastItem key={n.id} n={n} onDismiss={onDismissNotification!} />
          ))}
        </AnimatePresence>
      </div>

      {/* --- Sidebar Navigation --- */}
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[280px] bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800/60 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0
        flex flex-col
      `}>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
          <div className="relative group cursor-default">
            {/* Yalla Label Logo: Tags with Lightning */}
            <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30">
               <Tags className="w-5 h-5" />
               <div className="absolute -top-1.5 -right-1.5 bg-amber-400 rounded-full p-0.5 border-2 border-white dark:border-[#0B1120]">
                  <Zap className="w-3 h-3 text-amber-900 fill-amber-900" />
               </div>
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="font-bold text-slate-900 dark:text-white tracking-tight text-base leading-none">
              {APP_NAME}
            </h1>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Enterprise
            </span>
          </div>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8 custom-scrollbar">
          
          {/* Main Module */}
          <nav>
            <div className="px-2 mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Core Platform
            </div>
            <ul className="space-y-1">
              {NAVIGATION_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <MotionLi key={item.id} className="relative">
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <button
                      onClick={() => {
                        onNavigate(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`
                        relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200
                        ${isActive 
                          ? 'text-indigo-700 dark:text-indigo-300' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                      `}
                    >
                      <item.icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600'}`} />
                      <span>{item.label}</span>
                      {isActive && (
                        <motion.div 
                          layoutId="activeIndicator"
                          className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
                        />
                      )}
                    </button>
                  </MotionLi>
                );
              })}
            </ul>
          </nav>

          {/* Saved Views / Quick Access */}
          <div>
             <div className="px-2 mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
               <span>Quick Access</span>
               {savedViews.length > 0 && <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-mono">{savedViews.length}</span>}
             </div>
             
             {savedViews.length === 0 && (
                <div className="mx-2 px-4 py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-center bg-slate-50/50 dark:bg-slate-900/30">
                   <Bookmark className="w-4 h-4 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                   <p className="text-[10px] text-slate-400">Save specific filters<br/>for quick access.</p>
                </div>
             )}

             <ul className="space-y-0.5">
               <AnimatePresence>
                 {savedViews.map(view => (
                   <MotionLi 
                     key={view.id} 
                     layout
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -10 }}
                     className="group relative"
                   >
                     <button
                       onClick={() => {
                         onSelectView?.(view);
                         setMobileMenuOpen(false);
                       }}
                       className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                     >
                       <div className="w-1 h-4 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-indigo-400 transition-colors"></div>
                       <span className="truncate">{view.name}</span>
                     </button>
                     <button 
                       onClick={(e) => { e.stopPropagation(); onDeleteView?.(view.id); }}
                       className="absolute right-2 top-1.5 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                     >
                       <Trash2 className="w-3 h-3" />
                     </button>
                   </MotionLi>
                 ))}
               </AnimatePresence>
             </ul>
          </div>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="flex items-center justify-between px-6 md:px-8 h-[72px] shrink-0 border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden text-slate-500 dark:text-slate-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Breadcrumb / Context */}
            <div className="flex flex-col">
               <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                 {NAVIGATION_ITEMS.find(n => n.id === activeTab)?.label}
               </h2>
               <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>Project Alpha</span>
                  <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                  <span className="text-slate-400">us-central1</span>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Trigger (Visual Only) */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500 cursor-default">
               <Search className="w-3.5 h-3.5" />
               <span className="pr-4">Search resources...</span>
               <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-bold text-slate-400 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">⌘K</kbd>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>

            <button
                onClick={toggleTheme}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Toggle Theme"
            >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button 
               onClick={onDisconnect}
               className="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
               title="Disconnect"
            >
                <LogOut className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
              <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide hidden sm:inline">Live</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 relative scroll-smooth bg-slate-50 dark:bg-slate-950">
           <div className="w-full max-w-[1600px] mx-auto space-y-8 pb-10">
             {children}
           </div>
        </div>
      </main>
    </div>
  );
};