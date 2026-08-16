import React from 'react';
import AppLayout from '@/components/AppLayout';
import DriverActiveCarContent from './components/DriverActiveCarContent';

export default function DriverActiveCarPage() {
  return (
    <AppLayout headerTitle="Driver — Active Car" headerBack>
      <DriverActiveCarContent />
    </AppLayout>
  );
}