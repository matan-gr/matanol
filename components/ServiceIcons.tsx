
import React from 'react';

interface ServiceIconProps {
  type: string;
  className?: string;
}

export const ServiceIcon: React.FC<ServiceIconProps> = ({ type, className = "w-6 h-6" }) => {
  // Official Google Cloud Color Palette & Tints
  const C = {
    blue: "#4285F4",
    blueDark: "#174EA6",
    blueLight: "#E8F0FE",
    
    red: "#EA4335",
    redDark: "#B31412",
    redLight: "#FCE8E6",
    
    green: "#34A853",
    greenDark: "#188038",
    greenLight: "#E6F4EA",
    
    yellow: "#FBBC04",
    yellowDark: "#F29900",
    yellowLight: "#FEF7E0",
    
    grey: "#5F6368",
    greyDark: "#202124",
    greyLight: "#F1F3F4",
  };

  const strokeStyle = {
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (type) {
    case 'INSTANCE': // Compute Engine: Chip Metaphor
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Compute Engine</title>
          {/* Main Chip Body */}
          <rect x="4" y="4" width="16" height="16" rx="2.5" fill={C.blueLight} stroke={C.blue} {...strokeStyle} />
          
          {/* Inner Processing Core */}
          <rect x="8.5" y="8.5" width="7" height="7" rx="1" fill={C.blue} />
          
          {/* Connection Pins - Top/Bottom */}
          <path d="M7 4V2" stroke={C.blue} {...strokeStyle}/>
          <path d="M12 4V2" stroke={C.blue} {...strokeStyle}/>
          <path d="M17 4V2" stroke={C.blue} {...strokeStyle}/>
          <path d="M7 22V20" stroke={C.blue} {...strokeStyle}/>
          <path d="M12 22V20" stroke={C.blue} {...strokeStyle}/>
          <path d="M17 22V20" stroke={C.blue} {...strokeStyle}/>

          {/* Connection Pins - Left/Right */}
          <path d="M4 7H2" stroke={C.blue} {...strokeStyle}/>
          <path d="M4 12H2" stroke={C.blue} {...strokeStyle}/>
          <path d="M4 17H2" stroke={C.blue} {...strokeStyle}/>
          <path d="M22 7H20" stroke={C.blue} {...strokeStyle}/>
          <path d="M22 12H20" stroke={C.blue} {...strokeStyle}/>
          <path d="M22 17H20" stroke={C.blue} {...strokeStyle}/>
        </svg>
      );
    
    case 'GKE_CLUSTER': // Kubernetes Engine: Ship's Wheel
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Kubernetes Engine</title>
          {/* Wheel Rim */}
          <circle cx="12" cy="12" r="8" fill={C.blueLight} stroke={C.blue} {...strokeStyle} />
          
          {/* Central Hub */}
          <circle cx="12" cy="12" r="2.5" fill={C.blue} />
          
          {/* Wheel Spokes (Geometric Distribution) */}
          <path d="M12 4V1.5" stroke={C.blue} {...strokeStyle} />
          <path d="M12 20V22.5" stroke={C.blue} {...strokeStyle} />
          <path d="M19 12H21.5" stroke={C.blue} {...strokeStyle} />
          <path d="M5 12H2.5" stroke={C.blue} {...strokeStyle} />
          
          <path d="M17.66 6.34L19.4 4.6" stroke={C.blue} {...strokeStyle} />
          <path d="M6.34 17.66L4.6 19.4" stroke={C.blue} {...strokeStyle} />
          <path d="M17.66 17.66L19.4 19.4" stroke={C.blue} {...strokeStyle} />
          <path d="M6.34 6.34L4.6 4.6" stroke={C.blue} {...strokeStyle} />
        </svg>
      );

    case 'CLOUD_RUN': // Cloud Run: Hexagon Container + Motion
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Cloud Run</title>
          {/* Hexagonal Container Shape */}
          <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" fill={C.blueLight} stroke={C.blue} {...strokeStyle} />
          
          {/* "Run" Symbol / Fast Forward Arrow */}
          <path d="M9 8L15 12L9 16" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6 12H14" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      );

    case 'CLOUD_SQL': // Cloud SQL: Stacked Database
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Cloud SQL</title>
          {/* Top Cylinder Cap */}
          <ellipse cx="12" cy="6" rx="8" ry="3" fill={C.blueLight} stroke={C.blue} {...strokeStyle} />
          
          {/* Cylinder Body */}
          <path d="M4 6V18C4 19.66 7.58 21 12 21C16.42 21 20 19.66 20 18V6" fill={C.blueLight} stroke={C.blue} {...strokeStyle} />
          
          {/* Mid-Section Dividers */}
          <path d="M4 10C4 11.66 7.58 13 12 13C16.42 13 20 11.66 20 10" stroke={C.blue} strokeOpacity="0.5" {...strokeStyle} />
          <path d="M4 14C4 15.66 7.58 17 12 17C16.42 17 20 15.66 20 14" stroke={C.blue} strokeOpacity="0.5" {...strokeStyle} />
          
          {/* SQL Badge */}
          <rect x="13" y="13" width="9" height="9" rx="2" fill={C.blue} stroke="#fff" strokeWidth="1" />
          <path d="M15 17.5L16.5 19L20 15.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );

    case 'BUCKET': // Cloud Storage: Bucket
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Cloud Storage</title>
          {/* Bucket Shape */}
          <path d="M4 8H20L19 19C18.9 20.7 17.5 22 15.8 22H8.2C6.5 22 5.1 20.7 5 19L4 8Z" fill={C.greyLight} stroke={C.grey} {...strokeStyle} />
          {/* Handle */}
          <path d="M4 8C4 5 7 2 12 2C17 2 20 5 20 8" stroke={C.grey} {...strokeStyle} />
          {/* Rim Line */}
          <path d="M5 12H19" stroke={C.grey} strokeOpacity="0.3" strokeDasharray="3 3" {...strokeStyle} />
        </svg>
      );

    case 'DISK': // Persistent Disk: Platter
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Persistent Disk</title>
          {/* Disk Body */}
          <circle cx="12" cy="12" r="9" fill={C.yellowLight} stroke={C.yellow} {...strokeStyle} />
          {/* Spindle */}
          <circle cx="12" cy="12" r="3" fill="#fff" stroke={C.yellow} strokeWidth="1.5" />
          {/* Actuator Arm */}
          <path d="M12 12L17 16" stroke={C.yellow} strokeWidth="2" strokeLinecap="round"/>
          <circle cx="17" cy="16" r="1.5" fill={C.yellow} />
        </svg>
      );

    case 'IMAGE': // Machine Image: Disk + Frame
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Machine Image</title>
          <rect x="3" y="3" width="18" height="18" rx="4" fill={C.greenLight} stroke={C.green} {...strokeStyle} />
          <circle cx="8" cy="8" r="2" fill={C.green} />
          <path d="M21 15L16 10L5 21" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'SNAPSHOT': // Snapshot: Camera Shutter
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Snapshot</title>
          <circle cx="12" cy="12" r="9" fill={C.greyLight} stroke={C.grey} {...strokeStyle} />
          <path d="M12 12L12 5" stroke={C.grey} {...strokeStyle} />
          <path d="M12 12L18.5 14" stroke={C.grey} {...strokeStyle} />
          <path d="M12 12L7 16" stroke={C.grey} {...strokeStyle} />
          <circle cx="12" cy="12" r="2" fill={C.grey} />
        </svg>
      );

    default: // Generic Resource
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Resource</title>
          <rect x="3" y="3" width="7" height="7" rx="2" fill={C.greyLight} stroke={C.grey} {...strokeStyle}/>
          <rect x="14" y="3" width="7" height="7" rx="2" fill={C.greyLight} stroke={C.grey} {...strokeStyle}/>
          <rect x="3" y="14" width="7" height="7" rx="2" fill={C.greyLight} stroke={C.grey} {...strokeStyle}/>
          <rect x="14" y="14" width="7" height="7" rx="2" fill={C.greyLight} stroke={C.grey} {...strokeStyle}/>
        </svg>
      );
  }
};
