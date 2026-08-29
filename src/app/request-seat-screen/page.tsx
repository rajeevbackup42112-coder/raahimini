import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import RequestSeatContent from './components/RequestSeatContent';
import RouteRealtimeRefreshBoundary from '@/components/RouteRealtimeRefreshBoundary';
import { Loader2 } from 'lucide-react';

export default function RequestSeatPage() {
  return (
    <AppLayout headerTitle="Choose seats" headerBack>
      <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>}>
        <RouteRealtimeRefreshBoundary>
          <RequestSeatContent />
        </RouteRealtimeRefreshBoundary>
      </Suspense>
    </AppLayout>
  );
}