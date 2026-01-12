
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Command, Monitor, Server, Database, 
  Settings, LogOut, Moon, Sun, ArrowRight, 
  Layout, Network, FileText, Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GceResource } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  resources: GceResource[];
  onNavigate: (page: string) => void;
  onSelectResource: (resourceId: string) => void;
  onToggleTheme: () => void;
  onDisconnect: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  sub?: string;
  type: string;
  icon: React.ElementType;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  resources,
  onNavigate,
  onSelectResource,
  onToggleTheme,
  onDisconnect
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter Items
  const items = useMemo<PaletteItem[]>(() => {
    if (!isOpen) return [];
    
    const searchLower = search.toLowerCase();
    
    // Static Actions
    const actions: PaletteItem[] = [
      { id: 'nav-dashboard', label: 'Go to Dashboard', type: 'ACTION', icon: Layout, action: () => onNavigate('dashboard') },
      { id: 'nav-inventory', label: 'Go to Inventory', type: 'ACTION', icon: Server, action: () => onNavigate('inventory') },
      { id: 'nav-topology', label: 'Go to Topology', type: 'ACTION', icon: Network, action: () => onNavigate('topology') },
      { id: 'nav-quotas', label: 'View Quotas', type: 'ACTION', icon: Gauge, action: () => onNavigate('quotas') },
      { id: 'nav-logs', label: 'View Logs', type: 'ACTION', icon: FileText, action: () => onNavigate('logs') },
      { id: 'theme-toggle', label: 'Toggle Theme', type: 'ACTION', icon: Moon, action: onToggleTheme },
      { id: 'disconnect', label: 'Disconnect Account', type: 'ACTION', icon: LogOut, action: onDisconnect },
    ].filter(i => i.label.toLowerCase().includes(searchLower));

    // Resources (Limit to 5)
    const resourceItems: PaletteItem[] = resources
      .filter(r => 
        r.name.toLowerCase().includes(searchLower) || 
        r.id.toLowerCase().includes(searchLower)
      )
      .slice(0, 5)
      .map(r => ({
        id: r.id,
        label: r.name,
        sub: r.type,
        type: 'RESOURCE',
        icon: r.type === 'INSTANCE' ? Monitor : r.type === 'CLOUD_SQL' ? Database : Server,
        action: () => {
          onNavigate('inventory');
          // In a real app, this would also set a focus filter
          setTimeout(() => onSelectResource(r.id), 100);
        }
      }));

    return [...actions, ...resourceItems];
  }, [search, isOpen, resources, onNavigate, onToggleTheme, onDisconnect, onSelectResource]);

  // Keyboard Navigation within the palette
  useEffect(() => {
    const handleNav = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].action();
          onClose();
          setSearch('');
        }
      }
    };
    window.addEventListener('keydown', handleNav);
    return () => window.removeEventListener('keydown', handleNav);
  }, [isOpen, items, selectedIndex, onClose]);

  // Reset index on search change
  useEffect(() => setSelectedIndex(0), [search]);

  // Auto-focus input when opened is handled by `autoFocus` prop + rendering

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="w-full max-w-xl bg-white dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative z-10"
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input 
            autoFocus
            className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 h-6"
            placeholder="Type a command or search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-1">
             <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">ESC</kbd>
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
          {items.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              No results found for "{search}"
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                    setSearch('');
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                    ${index === selectedIndex 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
                  `}
                >
                  <item.icon className={`w-4 h-4 ${index === selectedIndex ? 'text-white' : 'text-slate-400'}`} />
                  <div className="flex flex-col items-start flex-1">
                    <span className="font-medium">{item.label}</span>
                    {item.sub && <span className={`text-[10px] ${index === selectedIndex ? 'text-indigo-200' : 'text-slate-500'}`}>{item.sub}</span>}
                  </div>
                  {index === selectedIndex && <ArrowRight className="w-4 h-4 opacity-50" />}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
           <div className="flex gap-2">
              <span><strong className="font-medium">↑↓</strong> to navigate</span>
              <span><strong className="font-medium">↵</strong> to select</span>
           </div>
           <div className="flex items-center gap-1">
              <Command className="w-3 h-3" /> 
              <span>Cmd+K</span>
           </div>
        </div>
      </motion.div>
    </div>
  );
};
