import React from 'react';
import AppLayout from '@/components/AppLayout';
import RequestSeatContent from './components/RequestSeatContent';

export default function RequestSeatPage() {
  return (
    <AppLayout headerTitle="Request a Seat" headerBack>
      <RequestSeatContent />
    </AppLayout>
  );
}