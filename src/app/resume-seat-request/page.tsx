'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { requestSeats } from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';

export default function ResumeSeatRequestPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (started.current) return;
    started.current = true;
    setError('');

    const tripId = localStorage.getItem('raahi_pending_trip_id');
    const stopId = localStorage.getItem('raahi_pending_stop_id');
    const seatCount = Number(localStorage.getItem('raahi_pending_seat_count') || '1');

    if (!tripId || !stopId || !Number.isInteger(seatCount) || seatCount < 1) {
      setError('Your saved seat request could not be restored. Please choose the ride again.');
      return;
    }

    const result = await requestSeats(tripId, stopId, seatCount);
    if (!result.success) {
      setError(result.error || 'Could not complete your seat request.');
      return;
    }

    if (result.request_id) localStorage.setItem('raahi_active_request_id', result.request_id);
    localStorage.removeItem('raahi_pending_route_id');
    localStorage.removeItem('raahi_pending_trip_id');
    localStorage.removeItem('raahi_pending_stop_id');
    localStorage.removeItem('raahi_pending_seat_count');
    router.replace('/request-status-screen');
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/');
      return;
    }
    run();
  }, [authLoading, user]);

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-4">
        <AlertTriangle size={38} className="mx-auto text-amber-500" />
        <h1 className="text-lg font-bold">Could not finish your request</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <button onClick={() => { started.current = false; run(); }} className="btn-primary flex-1">Try Again</button>
          <button onClick={() => router.replace('/')} className="btn-outline flex-1">Choose Ride Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
      <Loader2 size={34} className="mx-auto animate-spin text-primary" />
      <div>
        <h1 className="text-lg font-bold">Finishing your seat request</h1>
        <p className="text-sm text-muted-foreground mt-1">Your pickup point and seat count were saved before sign-in.</p>
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 size={14} /> Signed in securely
      </div>
    </div>
  );
}
