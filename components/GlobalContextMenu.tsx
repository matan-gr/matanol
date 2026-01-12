
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Command, Layout, Server, Moon, Sun, LogOut, 
  Terminal, Monitor, ChevronRight
} from 'lucide-react';

interface GlobalContextMenuProps {
  onOpenCommandPalette: () => void;
  onNavigate: (tab: string) => void;
  onToggleTheme: () => void;
  onDisconnect: () => void;
  isDark: boolean;
}

export const GlobalContextMenu: React.FC<GlobalContextMenuProps> = ({ 
  onOpenCommandPalette,
  onNavigate,
  onToggleTheme,
  onDisconnect,
  isDark
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setIsVisible(true);
      
      // Adjust position to prevent overflow
      let x = e.pageX;
      let y = e.pageY;
      
      // Simple bound check (approximate width/height of menu)
      if (x + 220 > window.innerWidth) x = window.innerWidth - 230;
      if (y + 300 > window.innerHeight) y = window.innerHeight - 310;

      setPosition({ x, y });
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };

    const handleScroll = () => {
        if (isVisible) setIsVisible(false);
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isVisible]);

  const handleAction = (action: () => void) => {
    action();
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[9999] w-56 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden py-1.5"
          style={{ top: position.y, left: position.x }}
        >
          <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800/50 mb-1">
             <button
                onClick={() => handleAction(onOpenCommandPalette)}
                className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors group"
             >
                <div className="flex items-center gap-2">
                   <Command className="w-4 h-4" />
                   <span>Command Palette</span>
                </div>
                <span className="text-[10px] bg-indigo-500/50 px-1.5 py-0.5 rounded text-indigo-100 border border-indigo-400/30">⌘K</span>
             </button>
          </div>

          <div className="px-1 space-y-0.5">
             <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Navigation</div>
             <MenuItem icon={Layout} label="Dashboard" onClick={() => handleAction(() => onNavigate('dashboard'))} />
             <MenuItem icon={Server} label="Resource Inventory" onClick={() => handleAction(() => onNavigate('inventory'))} />
             <MenuItem icon={Monitor} label="Topology Map" onClick={() => handleAction(() => onNavigate('topology'))} />
             <MenuItem icon={Terminal} label="Audit Logs" onClick={() => handleAction(() => onNavigate('logs'))} />
          </div>

          <div className="my-1.5 border-t border-slate-100 dark:border-slate-800/50"></div>

          <div className="px-1 space-y-0.5">
             <MenuItem 
                icon={isDark ? Sun : Moon} 
                label={isDark ? "Light Mode" : "Dark Mode"} 
                onClick={() => handleAction(onToggleTheme)} 
             />
             <MenuItem 
                icon={LogOut} 
                label="Disconnect" 
                onClick={() => handleAction(onDisconnect)} 
                danger 
             />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const MenuItem = ({ icon: Icon, label, onClick, danger }: any) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors
      ${danger 
        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}
    `}
  >
    <div className="flex items-center gap-2.5">
       <Icon className="w-4 h-4 opacity-70" />
       <span>{label}</span>
    </div>
    {!danger && <ChevronRight className="w-3 h-3 opacity-30" />}
  </button>
);
