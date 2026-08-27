'use client';

import { useState } from 'react';
import DriverTripLocationPanel from './DriverTripLocationPanel';
import DriverActiveCarContent from './DriverActiveCarContent';

export default function DriverActiveCarExperience() {
  const [locationReady, setLocationReady] = useState(false);
  const [tripRevision, setTripRevision] = useState(0);
  return (
    <>
      <DriverTripLocationPanel onReadyChange={setLocationReady} refreshToken={tripRevision} />
      <DriverActiveCarContent locationReady={locationReady} onTripStarted={() => setTripRevision((value) => value + 1)} />
    </>
  );
}
