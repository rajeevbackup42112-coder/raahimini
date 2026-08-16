import React from 'react';
import AppLayout from '@/components/AppLayout';
import RequestStatusRouter from './components/RequestStatusRouter';

export default function RequestStatusPage() {
  return (
    <AppLayout headerTitle="Your Request" headerBack>
      <RequestStatusRouter />
    </AppLayout>
  );
}
