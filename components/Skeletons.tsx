
import React from 'react';
import { GRID_TEMPLATE } from './ResourceTable';

export const TableRowSkeleton = () => {
  return (
    <div className={`${GRID_TEMPLATE} px-4 py-4 border-b border-slate-100 dark:border-slate-800/60 animate-pulse`}>
      {/* 1. Select */}
      <div className="flex justify-center">
        <div className="w-5 h-5 bg-slate-200 dark:bg-slate-800 rounded"></div>
      </div>
      {/* 2. Identity */}
      <div>
        <div className="flex flex-col gap-2 w-full">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
        </div>
      </div>
      {/* 3. Infrastructure */}
      <div>
        <div className="flex flex-col gap-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-24"></div>
        </div>
      </div>
      {/* 4. Config */}
      <div>
        <div className="flex flex-col gap-2">
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
          <div className="flex gap-1">
             <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-8"></div>
             <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-8"></div>
          </div>
        </div>
      </div>
      {/* 5. State */}
      <div>
        <div className="flex flex-col gap-2">
          <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-20"></div>
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
        </div>
      </div>
      {/* 6. Labels */}
      <div>
        <div className="flex gap-1.5 flex-wrap">
          {[1, 2].map(i => (
            <div key={i} className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
          ))}
        </div>
      </div>
      {/* 7. Actions */}
      <div className="text-right">
        <div className="flex justify-end gap-2">
          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
};
