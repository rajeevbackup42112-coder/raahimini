import React from 'react';
import AppLayout from '@/components/AppLayout';
import DriverRoleGate from '@/components/DriverRoleGate';
import DriverActiveCarContent from './components/DriverActiveCarContent';
import DriverCancelTripPanel from './components/DriverCancelTripPanel';
import DriverSupportPanel from './components/DriverSupportPanel';
import DriverTripLocationPanel from './components/DriverTripLocationPanel';
import DriverFareBanner from '@/components/DriverFareBanner';
import RealtimeRefreshBoundary from '@/components/RealtimeRefreshBoundary';

export default function DriverActiveCarPage() {
  return (
    <AppLayout headerTitle="Driver — Active Car" headerBack>
      <DriverRoleGate>
        <RealtimeRefreshBoundary>
          <DriverFareBanner />
          <DriverTripLocationPanel />
          <DriverActiveCarContent />
          <DriverSupportPanel />
          <DriverCancelTripPanel />
        </RealtimeRefreshBoundary>
      </DriverRoleGate>
    </AppLayout>
  );
}
