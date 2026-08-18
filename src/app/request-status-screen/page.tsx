import React from 'react';
import AppLayout from '@/components/AppLayout';
import RequestStatusRouter from './components/RequestStatusRouter';
import RealtimeRefreshBoundary from '@/components/RealtimeRefreshBoundary';

export default function RequestStatusPage() {
  return (
    <AppLayout headerTitle="Your Request" headerBack>
      <RealtimeRefreshBoundary>
        <RequestStatusRouter />
      </RealtimeRefreshBoundary>
    </AppLayout>
  );
}
