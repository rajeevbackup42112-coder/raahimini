'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { requestSeats } from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';
import { useLegalAcceptanceGate } from '@/components/legal/LegalAcceptanceGate';
import { useRegulatoryLaunchGate } from '@/components/launch/RegulatoryLaunchGate';

export default function ResumeSeatRequestPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { guard: guardLegal, dialog: legalDialog } = useLegalAcceptanceGate('passenger');
  const { guard: guardLaunch, dialog: launchDialog } = useRegulatoryLaunchGate();
  const started = useRef(false);
  const [error, setError] = useState('');

  const clearPending = () => {
    localStorage.removeItem('raahi_pending_route_id');
    localStorage.removeItem('raahi_pending_trip_id');
    localStorage.removeItem('raahi_pending_stop_id');
    localStorage.removeItem('raahi_pending_seat_count');
    localStorage.removeItem('raahi_pending_seat_numbers');
  };

  const run = async () => {
    if (started.current) return;
    started.current = true;
    setError('');

    const tripId = localStorage.getItem('raahi_pending_trip_id');
    const stopId = localStorage.getItem('raahi_pending_stop_id');
    const seatCount = Number(localStorage.getItem('raahi_pending_seat_count') || '0');
    let seatNumbers: number[] = [];
    try {
      const raw = localStorage.getItem('raahi_pending_seat_numbers');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) seatNumbers = parsed.filter((value) => Number.isInteger(value)).map(Number);
    } catch {
      seatNumbers = [];
    }

    if (!tripId || !stopId || !Number.isInteger(seatCount) || seatCount < 1 || seatNumbers.length !== seatCount) {
      setError('Your saved seat selection could not be restored. Please choose the ride and seats again.');
      return;
    }

    let result: any;
    try { await guardLaunch(async () => { await guardLegal(async () => { result = await requestSeats(tripId, stopId, seatCount, seatNumbers); }); }); }
    catch (e: any) { setError(e?.message || 'Could not check the booking agreement.'); return; }
    if (!result) return;
    if (!result.success) {
      setError(result.error || 'Could not complete your seat request. Your selected seats may no longer be available.');
      return;
    }

    if (result.request_id) localStorage.setItem('raahi_active_request_id', result.request_id);
    clearPending();
    router.replace('/request-status-screen');
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/');
      return;
    }
    if (!user.phone || !user.phone_confirmed_at) {
      router.replace('/profile?next=%2Fresume-seat-request');
      return;
    }
    void run();
  }, [authLoading, user, router]);

  if (error) {
    return (<>{launchDialog}{legalDialog}
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-lg font-bold">Your seats need another look</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <button onClick={() => { started.current = false; void run(); }} className="btn-primary flex-1">Try Again</button>
          <button onClick={() => { clearPending(); router.replace('/'); }} className="btn-outline flex-1">Choose Seats Again</button>
        </div>
      </div></>
    );
  }

  return (
    <>{launchDialog}{legalDialog}<div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
      <Loader2 size={34} className="mx-auto animate-spin text-primary" />
      <div>
        <h1 className="text-lg font-bold">Holding your selected seats</h1>
        <p className="text-sm text-muted-foreground mt-1">Your pickup point and exact seat choices were saved before sign-in.</p>
      </div>
    </div></>
  );
}