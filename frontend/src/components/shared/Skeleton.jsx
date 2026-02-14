import React from 'react';

/**
 * Simple loading skeleton component for Dashboard and Questions list
 */
const Skeleton = ({ variant = 'text', className = '', style = {} }) => {
  const baseClass = 'animate-pulse bg-gray-200 rounded';
  
  if (variant === 'card') {
    return (
      <div className={`${baseClass} h-32 ${className}`} style={style} />
    );
  }
  
  if (variant === 'chart') {
    return (
      <div className={`${baseClass} h-64 ${className}`} style={style} />
    );
  }
  
  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`${baseClass} h-12 w-full`} />
        ))}
      </div>
    );
  }
  
  // text (default)
  return (
    <div className={`${baseClass} h-4 ${className}`} style={style} />
  );
};

/**
 * Dashboard skeleton - mimics dashboard layout
 */
export const DashboardSkeleton = () => (
  <div className="p-6 space-y-6 animate-pulse">
    <div className="h-8 bg-gray-200 rounded w-1/3" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 bg-gray-200 rounded" />
      ))}
    </div>
    <div className="h-64 bg-gray-200 rounded" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="h-48 bg-gray-200 rounded" />
      <div className="h-48 bg-gray-200 rounded" />
    </div>
  </div>
);

/**
 * Questions list skeleton
 */
export const QuestionsListSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-10 bg-gray-200 rounded w-full" />
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="h-24 bg-gray-200 rounded w-full" />
      ))}
    </div>
  </div>
);

export default Skeleton;
