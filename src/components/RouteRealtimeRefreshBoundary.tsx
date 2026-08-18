'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import RealtimeRefreshBoundary from '@/components/RealtimeRefreshBoundary';

export default function RouteRealtimeRefreshBoundary({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  return <RealtimeRefreshBoundary routeId={searchParams.get('route_id')}>{children}</RealtimeRefreshBoundary>;
}
