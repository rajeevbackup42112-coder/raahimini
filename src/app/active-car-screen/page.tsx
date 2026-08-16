import React from 'react';
import AppLayout from '@/components/AppLayout';
import ActiveCarContent from './components/ActiveCarContent';

export default function ActiveCarPage() {
  return (
    <AppLayout headerTitle="Active Car" headerBack>
      <ActiveCarContent />
    </AppLayout>
  );
}