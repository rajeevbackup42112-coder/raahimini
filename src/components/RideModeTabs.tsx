'use client';

import Link from 'next/link';

export default function RideModeTabs({active}:{active:'shared'|'outstation'}){
  return <div className="mx-auto w-full max-w-screen-xl px-4 pt-4 sm:px-6 lg:px-8">
    <div className="grid grid-cols-2 rounded-2xl bg-muted p-1 text-sm font-bold">
      <Link href="/" className={`rounded-xl px-3 py-2.5 text-center ${active==='shared'?'bg-card text-primary card-shadow-sm':'text-muted-foreground'}`}>Shared Ride</Link>
      <Link href="/outstation" className={`rounded-xl px-3 py-2.5 text-center ${active==='outstation'?'bg-card text-primary card-shadow-sm':'text-muted-foreground'}`}>Outstation</Link>
    </div>
  </div>;
}
