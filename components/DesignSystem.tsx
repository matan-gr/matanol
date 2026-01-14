
import React, { useState, useRef, useEffect } from 'react';
import { Loader2, AlertCircle, X, ChevronRight, Check, ChevronDown } from 'lucide-react';
import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion';

// --- Types ---
export type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'outline' | 'glass';
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// --- Utilities ---
const getVariantClasses = (variant: Variant, disabled?: boolean) => {
  if (disabled) return 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed shadow-none';
  
  switch (variant) {
    case 'primary': 
        return 'bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 border border-transparent focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-950 relative overflow-hidden group';
    case 'secondary': 
        return 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 shadow-sm';
    case 'danger': 
        return 'bg-white dark:bg-red-950/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 focus:ring-2 focus:ring-red-500/20 shadow-sm';
    case 'success': 
        return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 border border-transparent focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1';
    case 'ghost': 
        return 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent';
    case 'outline': 
        return 'bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800';
    case 'glass': 
        return 'bg-white/80 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-900 backdrop-blur-md shadow-sm';
    default: 
        return 'bg-slate-900 dark:bg-white text-white dark:text-slate-900';
  }
};

const getSizeClasses = (size: Size) => {
  switch (size) {
    case 'xs': return 'px-2.5 py-1 text-[10px] h-6 rounded font-semibold tracking-wide';
    case 'sm': return 'px-3.5 py-1.5 text-xs h-8 rounded-md font-medium';
    case 'md': return 'px-5 py-2 text-sm h-10 rounded-lg font-medium';
    case 'lg': return 'px-6 py-3 text-base h-12 rounded-xl font-medium';
    case 'xl': return 'px-8 py-4 text-lg h-14 rounded-2xl font-bold';
    default: return 'px-4 py-2 text-sm h-10 rounded-lg';
  }
};

// --- Components ---

export const Spinner = ({ className = "w-4 h-4" }: { className?: string }) => (
  <Loader2 className={`animate-spin ${className}`} />
);

export const Button = React.forwardRef<HTMLButtonElement, Omit<HTMLMotionProps<"button">, "children"> & { 
  variant?: Variant; 
  size?: Size; 
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}>(({ className = '', variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      whileHover={disabled ? undefined : { y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 transition-all duration-200 select-none
        focus:outline-none 
        disabled:opacity-60 disabled:cursor-not-allowed
        ${getVariantClasses(variant as Variant, disabled)}
        ${getSizeClasses(size as Size)}
        ${className}
      `}
      {...props}
    >
      {/* Shimmer Effect for Primary Buttons */}
      {variant === 'primary' && !disabled && !isLoading && (
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
      )}
      
      <span className="relative z-10 flex items-center gap-2">
        {isLoading && <Spinner className="w-4 h-4" />}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </span>
    </motion.button>
  );
});

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { 
  error?: string;
  icon?: React.ReactNode;
}>(({ className = '', error, icon, ...props }, ref) => {
  return (
    <div className="w-full">
      <div className="relative group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full bg-white dark:bg-slate-950 border rounded-lg py-2.5 text-sm text-slate-900 dark:text-slate-100 
            placeholder:text-slate-400 dark:placeholder:text-slate-600
            focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm
            disabled:bg-slate-50 disabled:dark:bg-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed
            ${icon ? 'pl-10 pr-3' : 'px-3'}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <div className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1 animate-in slide-in-from-top-1">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string;
}>(({ className = '', error, children, ...props }, ref) => {
  return (
    <div className="w-full relative">
      <select
        ref={ref}
        className={`
          w-full appearance-none bg-white dark:bg-slate-950 border rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 
          focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-sm
          hover:border-slate-400 dark:hover:border-slate-600
          ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-[11px] text-red-500 dark:text-red-400 mt-1 block">{error}</span>}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
        <ChevronRight className="w-4 h-4 rotate-90" />
      </div>
    </div>
  );
});

export const MultiSelect = ({ 
  label, 
  options, 
  selected, 
  onChange,
  placeholder = "Select..."
}: { 
  label?: string, 
  options: { label: string, value: string }[], 
  selected: string[], 
  onChange: (values: string[]) => void,
  placeholder?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(s => s !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const displayText = selected.length === 0 
    ? placeholder 
    : selected.length === 1 
      ? options.find(o => o.value === selected[0])?.label 
      : `${selected.length} selected`;

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 block tracking-wider">{label}</label>}
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full text-left bg-white dark:bg-slate-950 border rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 
          focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all flex justify-between items-center shadow-sm
          ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'}
        `}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5 custom-scrollbar">
          {options.map((option) => (
            <div 
              key={option.value} 
              onClick={() => toggleOption(option.value)}
              className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 transition-colors select-none"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected.includes(option.value) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                {selected.includes(option.value) && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="truncate">{option.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ToggleSwitch = ({ checked, onChange, label }: { checked: boolean, onChange: (val: boolean) => void, label?: string }) => (
  <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onChange(!checked)}>
    <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 border ${checked ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 group-hover:border-slate-400'}`}>
      <motion.div 
        className="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </div>
    {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{label}</span>}
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode, variant?: 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'purple', className?: string }> = ({ children, variant = 'neutral', className = '' }) => {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
    info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    purple: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold border tracking-wide shadow-sm select-none ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};

export const Tooltip: React.FC<{ 
  content: string, 
  children: React.ReactNode,
  placement?: 'top' | 'bottom' | 'left' | 'right' 
}> = ({ 
  content, 
  children,
  placement = 'top' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={`absolute ${positionClasses[placement]} w-max max-w-xs px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded shadow-xl z-[60] pointer-events-none`}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Spotlight Card (Cursor Tracking) ---
export const GlassCard: React.FC<{ children: React.ReactNode, className?: string, title?: React.ReactNode, action?: React.ReactNode }> = ({ children, className = '', title, action }) => {
  const divRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    divRef.current.style.setProperty('--mouse-x', `${x}px`);
    divRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div 
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={`glass-panel rounded-xl shadow-sm flex flex-col spotlight-card ${className}`}
    >
      {(title || action) && (
        <div className="px-6 py-4 border-b border-slate-200/50 dark:border-white/5 flex items-center justify-between relative z-10">
          <div className="font-semibold text-slate-900 dark:text-slate-100 tracking-tight text-sm uppercase">{title}</div>
          <div>{action}</div>
        </div>
      )}
      <div className="p-0 flex-1 relative z-10">
        {children}
      </div>
    </div>
  );
};

export const Card = GlassCard;

export const SectionHeader = ({ title, subtitle, action }: { title: string, subtitle?: string, action?: React.ReactNode }) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
    <div>
      <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">{title}</h2>
      {subtitle && <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-2xl font-medium">{subtitle}</p>}
    </div>
    {action && <div className="flex gap-3 shrink-0">{action}</div>}
  </div>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Content */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden ring-1 ring-slate-900/5"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 backdrop-blur-md">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-white dark:bg-slate-900">
          {children}
        </div>
      </motion.div>
    </div>
  );
};
