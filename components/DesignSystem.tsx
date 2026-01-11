
import React, { useState, useRef, useEffect } from 'react';
import { Loader2, AlertCircle, X, ChevronRight, Check, ChevronDown } from 'lucide-react';

// --- Types ---
export type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'outline' | 'glass';
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// --- Utilities ---
const getVariantClasses = (variant: Variant, disabled?: boolean) => {
  if (disabled) return 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed shadow-none';
  
  switch (variant) {
    case 'primary': return 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 dark:shadow-blue-500/30 border border-transparent focus:ring-blue-500';
    case 'secondary': return 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 focus:ring-slate-400 shadow-sm';
    case 'danger': return 'bg-white dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 focus:ring-red-500';
    case 'success': return 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 border border-transparent focus:ring-emerald-500';
    case 'ghost': return 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent focus:ring-slate-400';
    case 'outline': return 'bg-transparent border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-white focus:ring-slate-400';
    case 'glass': return 'bg-white/70 dark:bg-slate-900/50 hover:bg-white/90 dark:hover:bg-slate-900/70 text-slate-800 dark:text-white border border-white/20 dark:border-white/10 backdrop-blur-md shadow-sm focus:ring-white/50';
    default: return 'bg-slate-900 dark:bg-slate-800 text-white';
  }
};

const getSizeClasses = (size: Size) => {
  switch (size) {
    case 'xs': return 'px-2 py-1 text-[10px] h-6';
    case 'sm': return 'px-3 py-1.5 text-xs h-8';
    case 'md': return 'px-4 py-2 text-sm h-10';
    case 'lg': return 'px-6 py-3 text-base h-12';
    case 'xl': return 'px-8 py-4 text-lg h-14';
    default: return 'px-4 py-2 text-sm h-10';
  }
};

// --- Components ---

export const Spinner = ({ className = "w-4 h-4" }: { className?: string }) => (
  <Loader2 className={`animate-spin ${className}`} />
);

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: Variant; 
  size?: Size; 
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}>(({ className = '', variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 select-none
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950
        active:scale-[0.98] disabled:active:scale-100 disabled:opacity-70
        ${getVariantClasses(variant, disabled)}
        ${getSizeClasses(size)}
        ${className}
      `}
      {...props}
    >
      {isLoading && <Spinner className="w-4 h-4" />}
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
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
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full bg-white dark:bg-slate-900/50 border rounded-lg py-2.5 text-sm text-slate-900 dark:text-slate-100 
            placeholder:text-slate-400 dark:placeholder:text-slate-600 
            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm
            disabled:bg-slate-50 disabled:dark:bg-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed
            ${icon ? 'pl-10 pr-4' : 'px-4'}
            ${error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}
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
          w-full appearance-none bg-white dark:bg-slate-900/50 border rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-sm
          hover:border-slate-300 dark:hover:border-slate-700
          ${error ? 'border-red-500/50' : 'border-slate-200 dark:border-slate-800'}
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
          w-full text-left bg-white dark:bg-slate-900/50 border rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all flex justify-between items-center shadow-sm
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}
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
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected.includes(option.value) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
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
    <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500'}`}>
      <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 shadow-sm ${checked ? 'translate-x-5' : ''}`} />
    </div>
    {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{label}</span>}
  </div>
);

export const Badge = ({ children, variant = 'neutral', className = '' }: { children: React.ReactNode, variant?: 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'purple', className?: string }) => {
  const styles = {
    success: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    warning: 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    error: 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border-red-200 dark:border-red-500/20',
    info: 'bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    purple: 'bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};

export const Tooltip = ({ 
  content, 
  children,
  placement = 'top' 
}: { 
  content: string, 
  children: React.ReactNode,
  placement?: 'top' | 'bottom' | 'left' | 'right' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-t-slate-900 border-b-transparent border-l-transparent border-r-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-slate-900 border-t-transparent border-l-transparent border-r-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-l-slate-900 border-r-transparent border-t-transparent border-b-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-r-slate-900 border-l-transparent border-t-transparent border-b-transparent',
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute ${positionClasses[placement]} w-max max-w-xs p-2 bg-slate-900 text-white text-xs font-medium rounded shadow-xl z-[60] animate-in fade-in zoom-in-95 duration-150 pointer-events-none`}>
          {content}
          <div className={`absolute border-4 ${arrowClasses[placement]}`}></div>
        </div>
      )}
    </div>
  );
};

export const GlassCard = ({ children, className = '', title, action }: { children: React.ReactNode, className?: string, title?: React.ReactNode, action?: React.ReactNode }) => (
  <div className={`glass-panel rounded-xl shadow-sm dark:shadow-2xl overflow-hidden flex flex-col ${className}`}>
    {(title || action) && (
      <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-white/40 dark:bg-white/5 backdrop-blur-md">
        <div className="font-semibold text-slate-800 dark:text-slate-100 tracking-tight">{title}</div>
        <div>{action}</div>
      </div>
    )}
    <div className="p-0 flex-1 relative">
      {children}
    </div>
  </div>
);

// Alias Card to GlassCard for consistent usage update
export const Card = GlassCard;

export const SectionHeader = ({ title, subtitle, action }: { title: string, subtitle?: string, action?: React.ReactNode }) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
    <div>
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">{title}</h2>
      {subtitle && <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-2xl">{subtitle}</p>}
    </div>
    {action && <div className="flex gap-3 shrink-0">{action}</div>}
  </div>
);

export const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={onClose} />
      
      {/* Content */}
      <div className="relative glass-panel bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-white/50 dark:bg-transparent">
          {children}
        </div>
      </div>
    </div>
  );
};
