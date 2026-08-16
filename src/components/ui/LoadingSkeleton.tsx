import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-muted rounded-xl ${className}`} />
  );
}

export function ActiveCarSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4 animate-fade-in">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={`skel-badge-${i}`} className="h-16 flex-1 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-8 w-48" />
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={`skel-stop-${i}`} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function RouteListSkeleton() {
  return (
    <div className="px-4 space-y-3 animate-fade-in">
      {[1, 2, 3].map((i) => (
        <Skeleton key={`skel-route-${i}`} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}