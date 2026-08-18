import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import ActiveCarContent from './components/ActiveCarContent';
import RouteFareBanner from '@/components/RouteFareBanner';
import RouteRealtimeRefreshBoundary from '@/components/RouteRealtimeRefreshBoundary';
import { Loader2 } from 'lucide-react';

export default function ActiveCarPage() {
  return (
    <AppLayout headerTitle="Active Car" headerBack>
      <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>}>
        <RouteRealtimeRefreshBoundary>
          <RouteFareBanner />
          <ActiveCarContent />
        </RouteRealtimeRefreshBoundary>
      </Suspense>
    </AppLayout>
  );
}