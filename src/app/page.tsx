import React from 'react';
import AppLayout from '@/components/AppLayout';
import LocationContent from './components/LocationContent';
import RealtimeRefreshBoundary from '@/components/RealtimeRefreshBoundary';

export default function LocationPage() {
  return (
    <AppLayout>
      <RealtimeRefreshBoundary>
        <LocationContent />
      </RealtimeRefreshBoundary>
    </AppLayout>
  );
}