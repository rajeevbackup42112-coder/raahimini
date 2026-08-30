import React from 'react';
import AppLayout from '@/components/AppLayout';
import LocationContent from './components/LocationContent';
import RealtimeRefreshBoundary from '@/components/RealtimeRefreshBoundary';
import RideModeTabs from '@/components/RideModeTabs';

export default function LocationPage() {
  return (
    <AppLayout>
      <RideModeTabs active="shared" />
      <RealtimeRefreshBoundary>
        <LocationContent />
      </RealtimeRefreshBoundary>
    </AppLayout>
  );
}
