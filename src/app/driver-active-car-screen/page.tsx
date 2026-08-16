import React from 'react';
import AppLayout from '@/components/AppLayout';
import DriverActiveCarContent from './components/DriverActiveCarContent';
import DriverCancelTripPanel from './components/DriverCancelTripPanel';

export default function DriverActiveCarPage() {
  return (
    <AppLayout headerTitle="Driver — Active Car" headerBack>
      <DriverActiveCarContent />
      <DriverCancelTripPanel />
    </AppLayout>
  );
}
