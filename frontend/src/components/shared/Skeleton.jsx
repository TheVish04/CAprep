import React from 'react';
import './Skeleton.css';

/**
 * Simple loading skeleton component for Dashboard, Questions list, and Resources list
 */
const Skeleton = ({ variant = 'text', className = '', style = {} }) => {
  const baseClass = 'skeleton-shimmer';
  
  if (variant === 'card') {
    return (
      <div className={`${baseClass} ${className}`} style={{ height: 128, ...style }} />
    );
  }
  
  if (variant === 'chart') {
    return (
      <div className={`${baseClass} ${className}`} style={{ height: 256, ...style }} />
    );
  }
  
  if (variant === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`${baseClass}`} style={{ height: 48, width: '100%' }} />
        ))}
      </div>
    );
  }
  
  return (
    <div className={`${baseClass} ${className}`} style={{ height: 16, ...style }} />
  );
};

/**
 * Dashboard skeleton - mimics dashboard layout with shimmer
 */
export const DashboardSkeleton = () => (
  <div className="skeleton-dashboard" style={{ padding: '100px 20px 40px', maxWidth: 1400, margin: '0 auto' }}>
    <div className="skeleton-shimmer" style={{ height: 32, width: '40%', marginBottom: 24 }} />
    <div className="skeleton-row">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton-card skeleton-shimmer" style={{ height: 96 }} />
      ))}
    </div>
    <div className="skeleton-shimmer" style={{ height: 280, width: '100%', marginBottom: 24 }} />
    <div className="skeleton-row">
      <div className="skeleton-shimmer" style={{ flex: 1, minWidth: 200, height: 200 }} />
      <div className="skeleton-shimmer" style={{ flex: 1, minWidth: 200, height: 200 }} />
    </div>
    <div className="skeleton-row">
      <div className="skeleton-shimmer" style={{ flex: 1, minWidth: 200, height: 240 }} />
      <div className="skeleton-shimmer" style={{ flex: 1, minWidth: 200, height: 240 }} />
    </div>
  </div>
);

/**
 * Questions list skeleton with shimmer
 */
export const QuestionsListSkeleton = () => (
  <div className="skeleton-questions-list">
    <div className="skeleton-shimmer" style={{ height: 40, width: '100%', marginBottom: 20 }} />
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="skeleton-item skeleton-shimmer" style={{ height: 100, width: '100%' }} />
    ))}
  </div>
);

/**
 * Resources list skeleton - mimics resource cards with shimmer
 */
export const ResourcesListSkeleton = () => (
  <div className="skeleton-resources-list">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="skeleton-item" style={{ marginBottom: 20 }}>
        <div className="skeleton-shimmer" style={{ height: 28, width: '70%', marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div className="skeleton-shimmer" style={{ height: 24, width: 80 }} />
          <div className="skeleton-shimmer" style={{ height: 24, width: 60 }} />
          <div className="skeleton-shimmer" style={{ height: 24, width: 50 }} />
        </div>
        <div className="skeleton-shimmer" style={{ height: 40, width: 120 }} />
      </div>
    ))}
  </div>
);

export default Skeleton;
