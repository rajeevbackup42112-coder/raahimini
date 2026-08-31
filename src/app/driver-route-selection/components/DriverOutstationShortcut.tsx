'use client';

import Link from 'next/link';
import { ArrowRight, CarFront } from 'lucide-react';

export default function DriverOutstationShortcut(){
  return <div className="mx-auto max-w-screen-lg px-4 pb-2 sm:px-6">
    <Link href="/driver-outstation" className="feature-card flex items-center gap-3 p-4 transition hover:border-primary/30 sm:p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><CarFront size={20}/></div>
      <div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-foreground">Outstation opportunities</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Choose Outstation pickup areas independently from Shared Ride, then quote or ignore matching Passenger requests without changing FIFO.</p></div>
      <ArrowRight size={17} className="shrink-0 text-primary"/>
    </Link>
  </div>;
}
