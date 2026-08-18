import React from 'react';
import AppLayout from '@/components/AppLayout';
import DriverActiveCarContent from './components/DriverActiveCarContent';
import DriverCancelTripPanel from './components/DriverCancelTripPanel';
import DriverFareBanner from '@/components/DriverFareBanner';

export default function DriverActiveCarPage() {
  return (
    <AppLayout headerTitle="Driver — Active Car" headerBack>
      <DriverFareBanner />
      <DriverActiveCarContent />
      <DriverCancelTripPanel />
    </AppLayout>
  );
}
