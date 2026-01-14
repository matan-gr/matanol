
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
  const stroke = 8;
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  
  const color = percentage >= 80 ? 'text-emerald-500' : percentage >= 50 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
        {/* Track */}
        <circle 
          cx="50" cy="50" r={normalizedRadius} 
          stroke="currentColor" strokeWidth={stroke} fill="transparent" 
          className="text-slate-100 dark:text-slate-800/50" 
        />
        {/* Progress */}
        <motion.circle 
          cx="50" cy="50" r={normalizedRadius} 
          stroke="currentColor" strokeWidth={stroke} fill="transparent" 
          strokeDasharray={circumference} 
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (percentage / 100) * circumference }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }} // Custom easing
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-bold ${color} tracking-tighter`}>
            <AnimatedCounter value={percentage} />%
        </span>
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Health</span>
      </div>
    </div>
  );
};

export const DonutChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
  const total = data.reduce((acc, cur) => acc + cur.value, 0);
  const size = 160;
  const center = size / 2;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
      return (
        <div className="w-32 h-32 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center">
            <span className="text-xs text-slate-400 font-medium">No Data</span>
        </div>
      );
  }

  let accumulatedPercent = 0;

  return (
    <div className="relative w-32 h-32 flex items-center justify-center group">
       <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 w-full h-full drop-shadow-sm">
          {data.map((item, index) => {
             const percent = item.value / total;
             const strokeDasharray = `${percent * circumference} ${circumference}`;
             const strokeDashoffset = -accumulatedPercent * circumference;
             accumulatedPercent += percent;

             return (
                <motion.circle
                   key={item.label}
                   cx={center}
                   cy={center}
                   r={radius}
                   fill="transparent"
                   stroke={item.color}
                   strokeWidth={strokeWidth}
                   strokeDasharray={strokeDasharray}
                   strokeDashoffset={strokeDashoffset}
                   initial={{ opacity: 0, strokeDasharray: `0 ${circumference}` }}
                   animate={{ opacity: 1, strokeDasharray }}
                   transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                   className="hover:opacity-80 transition-opacity cursor-pointer"
                >
                   <title>{item.label}: {item.value}</title>
                </motion.circle>
             );
          })}
       </svg>
       {/* Center Text */}
       <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total</div>
          <div className="text-xl font-bold text-slate-800 dark:text-white leading-none mt-0.5">
             <AnimatedCounter value={total} />
          </div>
       </div>
    </div>
  );
};

export const BarChart = ({ data, max, barColor = 'bg-indigo-500' }: { data: { label: string, value: number }[], max: number, barColor?: string }) => {
  return (
    <div className="space-y-3 w-full">
      {data.map((item, idx) => (
        <div key={idx} className="w-full group">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-600 dark:text-slate-300 truncate pr-2 group-hover:text-indigo-500 transition-colors">{item.label}</span>
            <span className="text-slate-500 font-mono tabular-nums"><AnimatedCounter value={item.value} /></span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className={`h-full ${barColor} rounded-full`}
              initial={{ width: 0 }}
              whileInView={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
              transition={{ duration: 0.8, ease: "circOut" }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="text-xs text-slate-400 text-center py-4 italic">No metrics available</div>}
    </div>
  );
};

export const SparkLine = ({ data, color = "#6366f1", height = 40 }: { data: number[], color?: string, height?: number }) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * height; 
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible opacity-80" preserveAspectRatio="none">
      <defs>
        <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <motion.path
        d={`M0 ${height} L ${points} L ${width} ${height} Z`}
        fill="url(#gradient)"
        stroke="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      <motion.path
        d={`M ${points}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
