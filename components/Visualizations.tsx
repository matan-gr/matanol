
import React, { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export const AnimatedCounter = ({ value, className = "" }: { value: number | string, className?: string }) => {
  // Extract number if value is string with formatting (e.g. "95%")
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g,"")) : value;
  const suffix = typeof value === 'string' ? value.replace(/[0-9.-]+/g, "") : "";
  
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => 
    Math.round(current).toLocaleString() + suffix
  );

  useEffect(() => {
    spring.set(isNaN(numericValue) ? 0 : numericValue);
  }, [spring, numericValue]);

  return <motion.span className={className}>{display}</motion.span>;
};

export const HealthGauge = ({ percentage }: { percentage: number }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  
  const color = percentage > 80 ? 'text-emerald-500' : percentage > 50 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-slate-800" />
        <motion.circle 
          cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" 
          strokeDasharray={circumference} 
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (percentage / 100) * circumference }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-bold ${color}`}>
            <AnimatedCounter value={percentage} />%
        </span>
        <span className="text-[10px] uppercase font-bold text-slate-400">Compliance</span>
      </div>
    </div>
  );
};

export const DonutChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
  const total = data.reduce((acc, cur) => acc + cur.value, 0);
  let currentAngle = 0;

  // If no data, show empty state
  if (total === 0) {
      return (
        <div className="w-24 h-24 rounded-full border-4 border-slate-200 dark:border-slate-800 flex items-center justify-center">
            <span className="text-xs text-slate-400">N/A</span>
        </div>
      );
  }

  const gradient = data.map(item => {
    const start = currentAngle;
    const percentage = (item.value / total) * 100;
    const end = currentAngle + percentage;
    currentAngle = end;
    return `${item.color} ${start}% ${end}%`;
  }).join(', ');

  return (
    <div className="relative w-32 h-32 rounded-full flex items-center justify-center group shadow-inner" style={{ background: `conic-gradient(${gradient})` }}>
       <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center z-10 shadow-lg">
          <div className="text-center">
             <div className="text-xs text-slate-500 font-medium">Total</div>
             <div className="text-xl font-bold text-slate-800 dark:text-white">
                <AnimatedCounter value={total} />
             </div>
          </div>
       </div>
    </div>
  );
};

export const BarChart = ({ data, max, barColor = 'bg-violet-500' }: { data: { label: string, value: number }[], max: number, barColor?: string }) => {
  return (
    <div className="space-y-3 w-full">
      {data.map((item, idx) => (
        <div key={idx} className="w-full">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2">{item.label}</span>
            <span className="text-slate-500 font-mono"><AnimatedCounter value={item.value} /></span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className={`h-full ${barColor} rounded-full`}
              initial={{ width: 0 }}
              whileInView={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="text-xs text-slate-400 text-center py-2">No data available</div>}
    </div>
  );
};

export const SparkLine = ({ data, color = "#3b82f6", height = 40 }: { data: number[], color?: string, height?: number }) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  
  // Create points
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * height; // Invert Y
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
      <motion.path
        d={`M ${points}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      {/* End dot */}
      <motion.circle 
        cx="100" 
        cy={height - ((data[data.length-1] - min) / range) * height} 
        r="3" 
        fill={color} 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.5 }}
        className="animate-pulse"
      />
    </svg>
  );
};
