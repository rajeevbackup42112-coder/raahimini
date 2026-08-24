'use client';

import { useState } from 'react';
import DriverTripLocationPanel from './DriverTripLocationPanel';
import DriverActiveCarContent from './DriverActiveCarContent';

export default function DriverActiveCarExperience() {
  const [locationReady, setLocationReady] = useState(false);
  return (
    <>
      <DriverTripLocationPanel onReadyChange={setLocationReady} />
      <DriverActiveCarContent locationReady={locationReady} />
    </>
  );
}
