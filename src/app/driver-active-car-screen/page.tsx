import React from 'react';
import AppLayout from '@/components/AppLayout';
import DriverRoleGate from '@/components/DriverRoleGate';
import DriverActiveCarExperience from './components/DriverActiveCarExperience';
import DriverCancelTripPanel from './components/DriverCancelTripPanel';
import DriverSupportPanel from './components/DriverSupportPanel';
import DriverFareBanner from '@/components/DriverFareBanner';
import RealtimeRefreshBoundary from '@/components/RealtimeRefreshBoundary';

export default function DriverActiveCarPage() {
  return (
    <AppLayout headerTitle="Active car" headerBack showBottomNav={false}>
      <DriverRoleGate>
        <RealtimeRefreshBoundary>
          <DriverFareBanner />
          <DriverActiveCarExperience />
          <DriverSupportPanel />
          <DriverCancelTripPanel />
        </RealtimeRefreshBoundary>
      </DriverRoleGate>
    </AppLayout>
  );
}
