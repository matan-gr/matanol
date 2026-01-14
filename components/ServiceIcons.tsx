
import React from 'react';

interface ServiceIconProps {
  type: string;
  className?: string;
}

export const ServiceIcon: React.FC<ServiceIconProps> = ({ type, className = "w-6 h-6" }) => {
  // Official Google Cloud Color Palette
  const G_BLUE = "#4285F4";
  const G_RED = "#EA4335";
  const G_GREEN = "#34A853";
  const G_YELLOW = "#FBBC04";
  const G_GREY = "#5F6368";
  const G_LIGHT_BLUE = "#A0C2F9";

  switch (type) {
    case 'INSTANCE': // Compute Engine
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Compute Engine</title>
          {/* Hexagon Base */}
          <path d="M12 22L3.34 17V7L12 2L20.66 7V17L12 22Z" fill={G_BLUE}/>
          {/* Internal Structure */}
          <path fillRule="evenodd" clipRule="evenodd" d="M7 10h2v4H7v-4zm8 0h2v4h-2v-4zM9 11h6v2H9v-2z" fill="white"/>
        </svg>
      );
    
    case 'GKE_CLUSTER': // Kubernetes Engine
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Kubernetes Engine</title>
          {/* Hexagon Base */}
          <path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" fill={G_BLUE}/>
          {/* Ship Wheel Spokes */}
          <g stroke="white" strokeWidth="1.5" strokeLinecap="round">
             <path d="M12 5.5v3M12 15.5v3M16.5 7.8l-1.5 2.6M9 13.6l-1.5 2.6M16.5 16.2l-1.5-2.6M9 10.4l-1.5-2.6M17.2 12h-3M9.8 12h-3"/>
          </g>
          {/* Center Hub */}
          <circle cx="12" cy="12" r="2.2" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>
      );

    case 'CLOUD_RUN': // Cloud Run
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Cloud Run</title>
          <circle cx="12" cy="12" r="10" fill={G_BLUE}/>
          <path d="M10 8.5L15 12L10 15.5V8.5Z" fill="white"/>
          <path d="M15 8.5L17 10V14L15 15.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );

    case 'CLOUD_SQL': // Cloud SQL
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Cloud SQL</title>
          {/* Cylinder Body */}
          <path d="M12 4C7.58 4 4 5.34 4 7V17C4 18.66 7.58 20 12 20C16.42 20 20 18.66 20 17V7C20 5.34 16.42 4 12 4Z" fill={G_BLUE}/>
          {/* Top Ellipse Highlight */}
          <ellipse cx="12" cy="7" rx="8" ry="3" fill={G_LIGHT_BLUE} fillOpacity="0.5"/>
          {/* Rings */}
          <path d="M4 12C4 13.66 7.58 15 12 15C16.42 15 20 13.66 20 12" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
          {/* Checkmark */}
          <path d="M15 13L17 15L21 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'BUCKET': // Cloud Storage
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Cloud Storage</title>
          {/* Bucket Shape */}
          <path d="M4 6H20V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V6Z" fill="#A0C2F9"/>
          {/* Band */}
          <rect x="4" y="9" width="16" height="2" fill={G_BLUE}/>
          {/* Handles */}
          <path d="M7 6V4C7 3.45 7.45 3 8 3H16C16.55 3 17 3.45 17 4V6" stroke={G_BLUE} strokeWidth="2" fill="none"/>
          <circle cx="12" cy="15" r="1.5" fill="white"/>
        </svg>
      );

    case 'DISK': // Persistent Disk
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Persistent Disk</title>
          <circle cx="12" cy="12" r="10" fill={G_RED}/>
          <circle cx="8" cy="12" r="1.5" fill="white"/>
          <circle cx="16" cy="12" r="1.5" fill="white"/>
          <path d="M8 12h8" stroke="white" strokeWidth="1.5" strokeOpacity="0.5"/>
        </svg>
      );

    case 'IMAGE': // Machine Image
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Machine Image</title>
          <circle cx="12" cy="12" r="10" fill={G_GREEN}/>
          <rect x="7.5" y="7.5" width="9" height="9" rx="1" fill="white"/>
          <circle cx="12" cy="12" r="2.5" fill={G_GREEN}/>
        </svg>
      );

    case 'SNAPSHOT': // Snapshot
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <title>Snapshot</title>
          <circle cx="12" cy="12" r="10" fill="#607D8B"/>
          <path d="M12 7v5l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1" strokeDasharray="3 3" fill="none"/>
        </svg>
      );

    default: // Generic Resource
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="7" height="7" rx="1" fill={G_GREY}/>
          <rect x="14" y="3" width="7" height="7" rx="1" fill={G_GREY}/>
          <rect x="3" y="14" width="7" height="7" rx="1" fill={G_GREY}/>
          <rect x="14" y="14" width="7" height="7" rx="1" fill={G_GREY}/>
        </svg>
      );
  }
};
