
import React from 'react';
import { NAVIGATION_ITEMS, APP_NAME, APP_VERSION } from '../constants';
import { LogOut, Menu, X, CheckCircle, AlertCircle, Info, Moon, Sun, Bookmark, Trash2, ScanBarcode, Tag } from 'lucide-react';
import { Notification, SavedView } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden relative transition-colors duration-300 font-sans selection:bg-violet-500/30">
      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 md:px-0">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div 
              key={n.id}
              layout
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`
                pointer-events-auto flex items-start gap-3 px-4 py-4 rounded-xl shadow-2xl border backdrop-blur-md relative overflow-hidden group
                ${n.type === 'success' ? 'bg-white/90 dark:bg-slate-900/90 border-emerald-500/30 text-slate-800 dark:text-emerald-100' : 
                  n.type === 'error' ? 'bg-white/90 dark:bg-slate-900/90 border-red-500/30 text-slate-800 dark:text-red-100' : 
                  'bg-white/90 dark:bg-slate-900/90 border-blue-500/30 text-slate-800 dark:text-blue-100'}
              `}
            >
              {/* Progress Bar */}
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 5, ease: "linear" }}
                className={`absolute bottom-0 left-0 h-0.5 
                  ${n.type === 'success' ? 'bg-emerald-500' : n.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}
                `}
              />

              <div className={`mt-0.5 shrink-0
                 ${n.type === 'success' ? 'text-emerald-500' : n.type === 'error' ? 'text-red-500' : 'text-blue-500'}
              `}>
                {n.type === 'success' && <CheckCircle className="w-5 h-5" />}
                {n.type === 'error' && <AlertCircle className="w-5 h-5" />}
                {n.type === 'info' && <Info className="w-5 h-5" />}
              </div>
              
              <div className="flex-1 pr-4">
                 <h4 className="text-sm font-bold leading-none mb-1.5 tracking-tight">
                    {n.type === 'success' ? 'Operation Successful' : n.type === 'error' ? 'Operation Failed' : 'System Update'}
                 </h4>
                 <p className="text-sm opacity-90 leading-relaxed font-medium text-slate-600 dark:text-slate-300">{n.message}</p>
              </div>

              {onDismissNotification && (
                <button 
                  onClick={() => onDismissNotification(n.id)} 
                  className="absolute top-2 right-2 p-1.5 opacity-40 hover:opacity-100 transition-opacity rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900/80 border-r border-slate-300 dark:border-slate-800 backdrop-blur-xl transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0
        flex flex-col
      `}>
        {/* Refined Brand Logo */}
        <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-300 dark:border-slate-800 shrink-0">
          <div className="relative group cursor-default">
            <div className="absolute inset-0 bg-violet-600 rounded-xl blur opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
            <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 p-2 rounded-xl shadow-inner border border-white/10 text-white">
               <ScanBarcode className="w-6 h-6" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-0.5 border border-slate-300 dark:border-slate-800">
               <Tag className="w-3 h-3 text-violet-500" />
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-slate-900 dark:text-white tracking-tight text-base leading-none">
              {APP_NAME}
            </h1>
            <div className="flex items-center gap-1.5 mt-1.5">
               <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
               <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase">Enterprise</span>
            </div>
          </div>
        </div>

        {/* Scrollable Nav Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
          <nav className="space-y-1">
            <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500">
              Platform
            </div>
            {NAVIGATION_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden group
                  ${activeTab === item.id 
                    ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300' 
                    : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                `}
              >
                {activeTab === item.id && (
                    <motion.div layoutId="nav-pill" className="absolute left-0 w-1 h-6 bg-violet-500 rounded-r-full" />
                )}
                <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Saved Views Section */}
          <div className="space-y-1">
             <div className="px-2 mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500">
               <span>Saved Views</span>
               <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 rounded-full">{savedViews.length}</span>
             </div>
             
             {savedViews.length === 0 && (
                <div className="px-3 py-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-center">
                   <p className="text-xs text-slate-400">No views saved.</p>
                </div>
             )}

             <AnimatePresence>
               {savedViews.map(view => (
                 <motion.div 
                   key={view.id} 
                   layout
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -10 }}
                   className="group relative flex items-center"
                 >
                   <button
                     onClick={() => {
                       onSelectView?.(view);
                       setMobileMenuOpen(false);
                     }}
                     className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                   >
                     <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                     <span className="truncate">{view.name}</span>
                   </button>
                   <button 
                     onClick={(e) => { e.stopPropagation(); onDeleteView?.(view.id); }}
                     className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all"
                   >
                     <Trash2 className="w-3 h-3" />
                   </button>
                 </motion.div>
               ))}
             </AnimatePresence>
          </div>
        </div>

        {/* User / Footer */}
        <div className="p-4 border-t border-slate-300 dark:border-slate-800 flex flex-col gap-2 shrink-0 bg-slate-50/50 dark:bg-slate-950/30">
          <button
              onClick={toggleTheme}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-slate-300 dark:hover:border-slate-700 shadow-sm hover:shadow"
          >
              <div className="flex items-center gap-2">
                 {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                 <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>
              </div>
          </button>
          <button 
            onClick={onDisconnect}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
          
          <div className="mt-2 text-[10px] text-center text-slate-400 font-mono">
             v{APP_VERSION}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="flex items-center justify-between px-8 h-20 bg-white/80 dark:bg-slate-950/80 border-b border-slate-300 dark:border-slate-800 backdrop-blur-md sticky top-0 z-40 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden text-slate-500 dark:text-slate-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
               <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                 {NAVIGATION_ITEMS.find(n => n.id === activeTab)?.label}
               </h2>
               <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                  Manage your cloud resources effectively
               </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800">
              <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">System Online</span>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 relative scroll-smooth transition-colors duration-300">
           <div className="w-full max-w-[1920px] mx-auto space-y-8 px-2 md:px-6">
             {children}
           </div>
        </div>
      </main>
    </div>
  );
};
