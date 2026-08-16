'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Car, User, CheckCircle2, Clock, MapPin, RefreshCw, Loader2 } from 'lucide-react';
import { getPublicActiveCar, type ActiveCarPublic, type StopWithEta } from '@/lib/raahiApi';
import { createClient } from '@/lib/supabase/client';
import SeatCountBadge from '@/components/ui/SeatCountBadge';
import StatusBadge from '@/components/ui/StatusBadge';

export default function ActiveCarContent() {
  const searchParams = useSearchParams();
  const routeId = searchParams.get('route_id');
  const [car, setCar] = useState<ActiveCarPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCar = useCallback(async (showRefreshing = false) => {
    if (!routeId) {
      setError('No route selected. Go back and choose a route.');
      setLoading(false);
      return;
    }
    if (showRefreshing) setRefreshing(true);
    const data = await getPublicActiveCar(routeId);
    setCar(data);
    setLoading(false);
    setRefreshing(false);
  }, [routeId]);

  useEffect(() => {
    fetchCar();
  }, [fetchCar]);

  // Realtime: subscribe to trips changes → refetch canonical projection
  useEffect(() => {
    if (!routeId) return;
    const supabase = createClient();
    const channel = supabase
      .channel('active_car_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        fetchCar();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_progress' }, () => {
        fetchCar();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [routeId, fetchCar]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center">
        <Car size={40} className="mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/" className="btn-primary mt-4 inline-flex">Choose Route</Link>
      </div>
    );
  }

  if (!car?.has_active_car) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-4">
        <Car size={40} className="mx-auto text-muted-foreground opacity-40" />
        <p className="text-base font-semibold text-foreground">No Active Car Right Now</p>
        <p className="text-sm text-muted-foreground">Check back soon — a driver will join the queue shortly.</p>
        <button
          onClick={() => fetchCar(true)}
          className="btn-outline mx-auto"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    );
  }

  const isCollecting = car.status === 'ACTIVE_COLLECTING';

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4 animate-fade-in">
      {/* Route Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label">{car.status === 'ACTIVE_COLLECTING' ? 'Active Car' : 'In Transit'}</p>
          <h2 className="text-lg font-bold text-foreground mt-0.5">{car.vehicle_model} · {car.vehicle_number}</h2>
        </div>
        <button
          onClick={() => fetchCar(true)}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors duration-150 active:scale-95"
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={`text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Driver Card */}
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
            <User size={24} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground text-base">{car.driver_display_name}</span>
              <StatusBadge status={isCollecting ? 'collecting' : 'in-progress'} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{car.vehicle_model} · {car.vehicle_number}</p>
            <p className="text-xs text-muted-foreground">{car.vehicle_type}</p>
          </div>
        </div>
      </div>

      {/* Seat Count Badges */}
      <div>
        <p className="section-label mb-2">Seat Status</p>
        <div className="grid grid-cols-4 gap-2">
          <SeatCountBadge label="Capacity" count={car.capacity ?? 0} variant="capacity" />
          <SeatCountBadge label="Confirmed" count={car.confirmed_count ?? 0} variant="confirmed" />
          <SeatCountBadge label="Held" count={car.held_count ?? 0} variant="held" />
          <SeatCountBadge label="Available" count={car.available_count ?? 0} variant="available" />
        </div>
      </div>

      {/* Pickup Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Pickup Route</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={12} />
            <span>Driver at <strong className="text-foreground">{car.current_stop_name}</strong></span>
          </div>
        </div>
        <div className="space-y-0">
          {(car.stops ?? []).map((stop, idx) => (
            <StopRow
              key={stop.stop_id}
              stop={stop}
              isLast={idx === (car.stops?.length ?? 0) - 1}
            />
          ))}
        </div>
      </div>

      {/* Request Seat CTA */}
      {isCollecting && (car.available_count ?? 0) > 0 ? (
        <Link
          href={`/request-seat-screen?route_id=${routeId}&trip_id=${car.trip_id}`}
          className="btn-primary w-full text-center"
        >
          <Car size={18} />
          Request a Seat
        </Link>
      ) : isCollecting && (car.available_count ?? 0) === 0 ? (
        <div className="flex items-center justify-center gap-2 bg-muted rounded-2xl px-5 py-4 text-muted-foreground text-sm font-semibold">
          <CheckCircle2 size={18} />
          Car is Full — Next car coming soon
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 bg-blue-50 rounded-2xl px-5 py-4 text-blue-700 text-sm font-semibold">
          <Car size={18} />
          Car is En Route — Check back for next departure
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground pb-2">
        Live updates · Tap <RefreshCw size={10} className="inline" /> to refresh manually
      </p>
    </div>
  );
}

function StopRow({ stop, isLast }: { stop: StopWithEta; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center w-5 flex-shrink-0">
        <div className={
          stop.is_current ? 'stop-dot-active' :
          stop.is_passed ? 'stop-dot-passed' : 'stop-dot-upcoming'
        } />
        {!isLast && (
          <div className={stop.is_passed ? 'stop-line-passed' : 'stop-line'} />
        )}
      </div>
      <div className={`flex-1 flex items-start justify-between pb-4 ${isLast ? 'pb-0' : ''}`}>
        <div>
          <p className={`text-sm font-semibold leading-tight ${
            stop.is_current ? 'text-primary' : stop.is_passed ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}>
            {stop.name}
          </p>
          {stop.is_current && (
            <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Driver Here Now</span>
          )}
          {stop.is_passed && !stop.is_current && (
            <span className="text-[10px] text-muted-foreground">Passed</span>
          )}
        </div>
        <div className="text-right">
          {stop.is_current && (
            <span className="text-xs font-bold text-primary">Now</span>
          )}
          {!stop.is_current && !stop.is_passed && stop.eta_minutes !== null && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={11} />
              <span>~{stop.eta_minutes} min</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}