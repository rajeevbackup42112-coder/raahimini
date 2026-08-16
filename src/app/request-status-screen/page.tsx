import React from 'react';
import AppLayout from '@/components/AppLayout';
import RequestStatusContent from './components/RequestStatusContent';

export default function RequestStatusPage() {
  return (
    <AppLayout headerTitle="Your Request" headerBack>
      <RequestStatusContent />
    </AppLayout>
  );
}