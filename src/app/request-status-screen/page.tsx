import React from 'react';
import AppLayout from '@/components/AppLayout';
import RequestStatusRouter from './components/RequestStatusRouter';
import RealtimeRefreshBoundary from '@/components/RealtimeRefreshBoundary';

export default function RequestStatusPage() {
  return (
    <AppLayout headerTitle="My ride" headerBack>
      <RealtimeRefreshBoundary>
        <RequestStatusRouter />
      </RealtimeRefreshBoundary>
    </AppLayout>
  );
}
