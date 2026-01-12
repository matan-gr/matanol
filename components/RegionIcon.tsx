
import React from 'react';
import { Globe } from 'lucide-react';

interface RegionIconProps {
  zone: string;
  className?: string;
}

export const RegionIcon: React.FC<RegionIconProps> = ({ zone, className = "w-4 h-4" }) => {
  const z = zone.toLowerCase();

  // --- High Fidelity SVG Flags ---
  
  // United States (us-*)
  const USFlag = () => (
    <svg viewBox="0 0 32 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="24" rx="2" fill="#B22234"/>
      <path d="M0 4H32M0 8H32M0 12H32M0 16H32M0 20H32" stroke="white" strokeWidth="2"/>
      <rect width="14" height="13" rx="1" fill="#3C3B6E"/>
      {/* 9 Rows of Stars (simplified as dots for 32px scale) */}
      <g fill="white" opacity="0.9">
         <circle cx="2" cy="2" r="0.8"/> <circle cx="5" cy="2" r="0.8"/> <circle cx="8" cy="2" r="0.8"/> <circle cx="11" cy="2" r="0.8"/>
         <circle cx="3.5" cy="4.2" r="0.8"/> <circle cx="6.5" cy="4.2" r="0.8"/> <circle cx="9.5" cy="4.2" r="0.8"/>
         <circle cx="2" cy="6.4" r="0.8"/> <circle cx="5" cy="6.4" r="0.8"/> <circle cx="8" cy="6.4" r="0.8"/> <circle cx="11" cy="6.4" r="0.8"/>
         <circle cx="3.5" cy="8.6" r="0.8"/> <circle cx="6.5" cy="8.6" r="0.8"/> <circle cx="9.5" cy="8.6" r="0.8"/>
         <circle cx="2" cy="10.8" r="0.8"/> <circle cx="5" cy="10.8" r="0.8"/> <circle cx="8" cy="10.8" r="0.8"/> <circle cx="11" cy="10.8" r="0.8"/>
      </g>
    </svg>
  );

  // European Union (europe-*)
  const EUFlag = () => (
    <svg viewBox="0 0 32 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="24" rx="2" fill="#003399"/>
      <g fill="#FFCC00">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
            const rad = (deg - 90) * (Math.PI / 180);
            const cx = 16 + 7 * Math.cos(rad);
            const cy = 12 + 7 * Math.sin(rad);
            return <circle key={deg} cx={cx} cy={cy} r="1.2" />
        })}
      </g>
    </svg>
  );

  // Japan (asia-northeast*)
  const JPFlag = () => (
    <svg viewBox="0 0 32 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="24" rx="2" fill="white" stroke="#E2E8F0" strokeWidth="1"/>
      <circle cx="16" cy="12" r="7" fill="#BC002D"/>
    </svg>
  );

  // India (asia-south*)
  const INFlag = () => (
    <svg viewBox="0 0 32 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="24" rx="2" fill="white"/>
      <rect width="32" height="8" rx="2" fill="#FF9933"/>
      <rect y="16" width="32" height="8" rx="2" fill="#138808"/>
      <circle cx="16" cy="12" r="3.5" stroke="#000080" strokeWidth="0.8" fill="white"/>
      <circle cx="16" cy="12" r="1" fill="#000080"/>
      <path d="M16 8.5L16 15.5 M12.5 12L19.5 12 M13.5 9.5L18.5 14.5 M13.5 14.5L18.5 9.5" stroke="#000080" strokeWidth="0.5"/>
    </svg>
  );

  // Australia (australia-*)
  const AUFlag = () => (
    <svg viewBox="0 0 32 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="24" rx="2" fill="#00008B"/>
      {/* Union Jack Canton */}
      <path d="M0 0H14V12H0V0Z" fill="#00247D"/>
      <path d="M0 0L14 12M14 0L0 12" stroke="white" strokeWidth="2.5"/>
      <path d="M0 0L14 12M14 0L0 12" stroke="#CC0000" strokeWidth="1"/>
      <path d="M7 0V12M0 6H14" stroke="white" strokeWidth="2.5"/>
      <path d="M7 0V12M0 6H14" stroke="#CC0000" strokeWidth="1.2"/>
      {/* Southern Cross */}
      <g fill="white">
        <path d="M24 4.5L24.5 6L26 6L25 7L25.5 8.5L24 7.5L22.5 8.5L23 7L22 6L23.5 6Z" transform="scale(0.8) translate(6,0)"/> 
        <circle cx="26" cy="10" r="1.2" />
        <circle cx="22" cy="14" r="1.5" />
        <circle cx="28" cy="13" r="1.2" />
        <circle cx="25" cy="18" r="1.5" />
        {/* Commonwealth Star */}
        <circle cx="7" cy="18" r="2.5" /> 
      </g>
    </svg>
  );

  // Canada (northamerica-northeast*)
  const CAFlag = () => (
    <svg viewBox="0 0 32 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="24" rx="2" fill="#FF0000"/>
      <rect x="8" width="16" height="24" fill="white"/>
      {/* Maple Leaf */}
      <path d="M16 4L17.5 9L21 8L19 12H21.5L17 17V20H15V17L10.5 12H13L11 8L14.5 9L16 4Z" fill="#FF0000"/>
    </svg>
  );

  // Brazil (southamerica-*)
  const BRFlag = () => (
    <svg viewBox="0 0 32 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="24" rx="2" fill="#009B3A"/>
      <path d="M16 3L29 12L16 21L3 12L16 3Z" fill="#FEDF00"/>
      <circle cx="16" cy="12" r="5" fill="#002776"/>
      <path d="M12 11C14 10 18 10 20 13" stroke="white" strokeWidth="0.8" fill="none"/>
    </svg>
  );

  // Taiwan (asia-east1)
  const TWFlag = () => (
    <svg viewBox="0 0 32 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="24" rx="2" fill="#FE0000"/>
      <rect width="16" height="12" rx="1" fill="#000095"/>
      <circle cx="8" cy="6" r="3.5" fill="white"/>
      <circle cx="8" cy="6" r="1.5" fill="#000095" opacity="0.1"/>
      <g stroke="#000095" strokeWidth="0.5">
         <path d="M8 2.5V9.5"/> <path d="M4.5 6H11.5"/>
         <path d="M5.5 3.5L10.5 8.5"/> <path d="M10.5 3.5L5.5 8.5"/>
      </g>
    </svg>
  );

  // Global / Generic
  const GlobalIcon = () => (
    <div className={`rounded-full bg-slate-100 dark:bg-slate-800 p-[1px] ${className}`}>
        <Globe className="w-full h-full text-slate-500" />
    </div>
  );

  // --- Logic ---
  
  if (z === 'global') return <GlobalIcon />;

  // Exact starts
  if (z.startsWith('us-')) return <USFlag />;
  if (z.startsWith('northamerica-')) return <CAFlag />;
  if (z.startsWith('southamerica-')) return <BRFlag />;
  if (z.startsWith('australia-')) return <AUFlag />;
  
  // Asia breakdown
  if (z.startsWith('asia-northeast')) return <JPFlag />;
  if (z.startsWith('asia-south')) return <INFlag />;
  if (z.startsWith('asia-east1')) return <TWFlag />;
  
  // Europe breakdown
  if (z.startsWith('europe-')) return <EUFlag />;

  // Fallback
  return <GlobalIcon />;
};
