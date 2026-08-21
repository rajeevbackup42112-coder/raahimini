'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarClock, Loader2 } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import ScheduledDemandForm from '@/app/active-car-screen/components/ScheduledDemandForm';

export default function PlanRidePage() {
  return (
    <Suspense fallback={<PlanRideLoading />}>
      <PlanRideContent />
    </Suspense>
  );
}

function PlanRideLoading() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Plan a ride" showBack />
      <main className="mx-auto max-w-md px-4 py-16 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </main>
    </div>
  );
}

function PlanRideContent() {
  const searchParams = useSearchParams();
  const routeId = searchParams.get('route_id');
  const { user, profile, signInWithGoogle } = useAuth();

  if (!routeId) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Plan a ride" showBack />
        <main className="mx-auto max-w-md px-4 py-10 text-center space-y-4">
          <CalendarClock size={40} className="mx-auto text-muted-foreground opacity-40" />
          <p className="font-semibold text-foreground">Choose a route first</p>
          <p className="text-sm text-muted-foreground">Scheduled interest is always attached to a route.</p>
          <Link href="/" className="btn-primary inline-flex">Choose route</Link>
        </main>
      </div>
    );
  }

  const passenger = Boolean(user && profile?.role === 'passenger');

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Plan a ride" showBack />
      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        <div className="hero-surface">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Scheduled interest</p>
          <h1 className="mt-2 text-xl font-extrabold text-white">Tell Raahi when you may travel</h1>
          <p className="mt-2 text-sm text-white/75">This helps drivers and Raahi understand upcoming demand. It never reserves or auto-books a seat.</p>
        </div>
        {user && profile?.role !== 'passenger' ? (
          <div className="card p-5 text-sm text-muted-foreground">Scheduled ride interest is available to passenger accounts.</div>
        ) : (
          <ScheduledDemandForm
            routeId={routeId}
            enabled={passenger}
            onNeedAuth={() => signInWithGoogle(`/plan-ride?route_id=${routeId}`)}
          />
        )}
      </main>
    </div>
  );
}
