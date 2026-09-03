import React from 'react';
import AppLayout from '@/components/AppLayout';
import LocationContent from './components/LocationContent';
import UnifiedTravelPlanner from './components/UnifiedTravelPlanner';
import RealtimeRefreshBoundary from '@/components/RealtimeRefreshBoundary';
import SponsoredLocalOffer from '@/components/SponsoredLocalOffer';

export default function LocationPage() {
  return (
    <AppLayout>
      <UnifiedTravelPlanner />
      <RealtimeRefreshBoundary>
        <LocationContent />
      </RealtimeRefreshBoundary>
      <SponsoredLocalOffer />
    </AppLayout>
  );
}
