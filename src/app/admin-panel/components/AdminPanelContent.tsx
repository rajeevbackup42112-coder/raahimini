'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { MapPin, Route, Users, Car, List, Activity, ShieldAlert, ChevronLeft, CheckCircle2, Plus, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import {
  adminGetLocations, adminGetRoutes, adminGetDrivers, adminGetActiveTrips,
  adminGetBehaviourEvents, adminRestrictUser, adminUnrestrictUser,
  getDriverQueueStatus
} from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';
import AppLogo from '@/components/ui/AppLogo';

type AdminTab = 'locations' | 'routes' | 'drivers' | 'queue' | 'trips' | 'behaviour';

const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'locations', label: 'Locations', icon: <MapPin size={16} /> },
  { id: 'routes', label: 'Routes & Stops', icon: <Route size={16} /> },
  { id: 'drivers', label: 'Drivers', icon: <Users size={16} /> },
  { id: 'queue', label: 'Driver Queue', icon: <List size={16} /> },
  { id: 'trips', label: 'Active Trips', icon: <Car size={16} /> },
  { id: 'behaviour', label: 'Behaviour', icon: <Activity size={16} /> },
];

export default function AdminPanelContent() {
  const [activeTab, setActiveTab] = useState<AdminTab>('trips');
  const { profile, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 py-8 text-center space-y-3">
        <ShieldAlert size={40} className="mx-auto text-muted-foreground opacity-40" />
        <p className="text-base font-semibold text-foreground">Admin Access Required</p>
        <p className="text-sm text-muted-foreground">Sign in with an admin account to access this panel.</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto">
      <header className="sticky top-0 z-40 bg-card border-b border-border card-shadow">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link href="/" className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-muted transition-colors duration-150">
            <ChevronLeft size={20} className="text-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <AppLogo size={28} />
            <span className="font-bold text-base text-foreground">Raahi Admin</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl bg-muted px-2.5 py-1.5 sm:flex">
              <span className="gradient-primary flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white">
                {(profile.display_name || 'A').slice(0, 1).toUpperCase()}
              </span>
              <div className="leading-tight">
                <p className="max-w-[140px] truncate text-xs font-bold text-foreground">{profile.display_name || 'Raahi Admin'}</p>
                <p className="text-[10px] text-muted-foreground">Admin</p>
              </div>
            </div>
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Admin Access</span>
          </div>
        </div>
        <div className="flex overflow-x-auto border-t border-border px-2 gap-0 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={`admin-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors duration-150 ${
                activeTab === tab.id
                  ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-4">
        {activeTab === 'locations' && <LocationsTab />}
        {activeTab === 'routes' && <RoutesTab />}
        {activeTab === 'drivers' && <DriversTab />}
        {activeTab === 'queue' && <QueueTab />}
        {activeTab === 'trips' && <TripsTab />}
        {activeTab === 'behaviour' && <BehaviourTab />}
      </div>
    </div>
  );
}

function LocationsTab() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetLocations().then((data) => { setLocations(data); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Locations</h2>
        <button className="btn-primary py-2 px-3 text-sm" onClick={() => toast.info('Add location via database migration')}>
          <Plus size={14} />
          Add Location
        </button>
      </div>
      <div className="space-y-2">
        {locations.map((loc) => (
          <div key={loc.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-primary" />
              <div>
                <p className="text-sm font-bold text-foreground">{loc.name}</p>
                <p className="text-xs text-muted-foreground">{loc.state}, India</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={loc.is_active ? 'confirmed' : 'expired'} label={loc.is_active ? 'Active' : 'Inactive'} />
            </div>
          </div>
        ))}
      </div>
      <div className="card p-4 border-dashed border-2 border-border flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <Plus size={16} />
        Add Bokaro, Ranchi, or other locations via Admin RPC
      </div>
    </div>
  );
}

function RoutesTab() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  useEffect(() => {
    adminGetRoutes().then((data) => { setRoutes(data); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Routes & Stops</h2>
      </div>
      <div className="space-y-2">
        {routes.map((route) => {
          const stops = (route.route_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
          const isExpanded = selectedRoute === route.id;
          return (
            <div key={route.id} className="card overflow-hidden">
              <button
                onClick={() => setSelectedRoute(isExpanded ? null : route.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors duration-150"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{route.code}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">{route.direction_label}</p>
                    <p className="text-xs text-muted-foreground">{stops.length} stops configured</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status="confirmed" label="Active" />
                  <ChevronLeft size={16} className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? '-rotate-90' : 'rotate-180'}`} />
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-2 animate-fade-in">
                  <p className="section-label">Pickup Stops (ordered)</p>
                  {stops.map((stop: any) => (
                    <div key={stop.id} className="flex items-center gap-3 bg-muted rounded-xl px-3 py-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {stop.stop_order}
                      </span>
                      <p className="text-sm font-medium text-foreground flex-1">{stop.name}</p>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {stop.minutes_from_prev > 0 ? `+${stop.minutes_from_prev} min` : 'Start'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DriversTab() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    const data = await adminGetDrivers();
    setDrivers(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const handleToggleRestriction = async (driverId: string, profileId: string, isRestricted: boolean) => {
    setLoadingAction(`restrict-${driverId}`);
    const result = isRestricted
      ? await adminUnrestrictUser(profileId)
      : await adminRestrictUser(profileId, 'Admin restriction');
    setLoadingAction(null);
    if (result.success) {
      toast.success(isRestricted ? 'Driver restriction lifted' : 'Driver restricted');
      fetchDrivers();
    } else {
      toast.error(result.error || 'Action failed');
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Drivers ({drivers.length})</h2>
      </div>
      <div className="space-y-2">
        {drivers.map((driver) => {
          const isRestricted = driver.profiles?.is_restricted ?? false;
          const isLoading = loadingAction === `restrict-${driver.id}`;
          return (
            <div key={driver.id} className={`card p-4 ${isRestricted ? 'opacity-75' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isRestricted ? 'bg-red-50' : 'bg-secondary'}`}>
                    <Users size={18} className={isRestricted ? 'text-red-500' : 'text-primary'} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{driver.display_name}</p>
                      <StatusBadge
                        status={isRestricted ? 'cancelled' : 'confirmed'}
                        label={isRestricted ? 'Restricted' : 'Active'}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{driver.phone}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        <Car size={10} className="inline mr-0.5" />
                        {driver.vehicles?.registration_number ?? 'No vehicle'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Route: {driver.routes?.code ?? 'N/A'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {driver.trips_completed} trips
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleRestriction(driver.id, driver.profile_id, isRestricted)}
                  disabled={!!loadingAction}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95 ${
                    isRestricted
                      ? 'bg-green-50 text-green-700 hover:bg-green-100' :'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : isRestricted ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <ShieldAlert size={12} />
                  )}
                  {isRestricted ? 'Unrestrict' : 'Restrict'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QueueTab() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetRoutes().then((data) => {
      setRoutes(data);
      if (data.length > 0) setSelectedRouteId(data[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedRouteId) {
      getDriverQueueStatus(selectedRouteId).then(setQueue);
    }
  }, [selectedRouteId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Driver Queue</h2>
          <p className="text-xs text-muted-foreground">FIFO order · One ACTIVE_COLLECTING per route</p>
        </div>
        <button
          onClick={() => selectedRouteId && getDriverQueueStatus(selectedRouteId).then(setQueue)}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors duration-150"
        >
          <RefreshCw size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Route selector */}
      <div className="flex gap-2">
        {routes.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRouteId(r.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              selectedRouteId === r.id ? 'border-primary bg-secondary text-primary' : 'border-border text-muted-foreground'
            }`}
          >
            {r.code}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {queue.map((entry: any, idx: number) => (
          <div
            key={entry.queue_id}
            className={`card p-4 flex items-center gap-3 ${idx === 0 ? 'border-primary/40 bg-secondary/30' : ''}`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
              idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
            }`}>
              {entry.queue_position}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{entry.driver_name}</p>
              <p className="text-xs text-muted-foreground">{entry.vehicle_number}</p>
            </div>
            <StatusBadge
              status={entry.status === 'ACTIVE_COLLECTING' ? 'collecting' : 'held'}
              label={entry.status === 'ACTIVE_COLLECTING' ? 'Active' : 'Waiting'}
            />
          </div>
        ))}
        {queue.length === 0 && (
          <div className="card p-8 text-center">
            <List size={32} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <p className="text-sm text-muted-foreground">No drivers in queue for {selectedRoute?.code}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TripsTab() {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = useCallback(async () => {
    const data = await adminGetActiveTrips();
    setTrips(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Active Trips ({trips.length})</h2>
        <button onClick={fetchTrips} className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors duration-150">
          <RefreshCw size={16} className="text-muted-foreground" />
        </button>
      </div>
      <div className="space-y-3">
        {trips.map((trip) => (
          <div key={trip.trip_id} className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{trip.route_code}</span>
                  <StatusBadge
                    status={trip.status === 'ACTIVE_COLLECTING' ? 'collecting' : 'in-progress'}
                    label={trip.status === 'ACTIVE_COLLECTING' ? 'Collecting' : 'In Progress'}
                  />
                </div>
                <p className="text-sm font-bold text-foreground mt-0.5">{trip.driver_name}</p>
                <p className="text-xs text-muted-foreground">{trip.vehicle_number}</p>
              </div>
              {trip.started_at && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="text-xs font-bold text-foreground">
                    {new Date(trip.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Capacity', value: trip.capacity, cls: 'bg-muted' },
                { label: 'Confirmed', value: trip.confirmed, cls: 'bg-green-50 text-green-700' },
                { label: 'Held', value: trip.held, cls: 'bg-amber-50 text-amber-700' },
                { label: 'Available', value: trip.available, cls: 'bg-blue-50 text-blue-700' },
              ].map((stat) => (
                <div key={`${trip.trip_id}-${stat.label}`} className={`rounded-xl px-2 py-2 text-center ${stat.cls}`}>
                  <p className="text-lg font-bold tabular-nums">{stat.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {trips.length === 0 && (
          <div className="card p-8 text-center">
            <Car size={32} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <p className="text-sm text-muted-foreground">No active trips right now</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BehaviourTab() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    const data = await adminGetBehaviourEvents(50);
    setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleRestrict = async (actorId: string) => {
    setLoadingAction(`restrict-${actorId}`);
    const result = await adminRestrictUser(actorId, 'Admin restriction via behaviour review');
    setLoadingAction(null);
    if (result.success) {
      toast.success('User restricted');
      fetchEvents();
    } else {
      toast.error(result.error || 'Action failed');
    }
  };

  const EVENT_LABELS: Record<string, string> = {
    driver_cancel_after_confirmation: 'Cancel (after confirm)',
    driver_cancel_before_confirmation: 'Cancel (before confirm)',
    request_expired: 'Request Expired',
    confirmed_no_show: 'Confirmed No-show',
    passenger_complaint: 'Passenger Complaint',
    booking_confirmed: 'Booking Confirmed',
    trip_completed: 'Trip Completed',
    request_created: 'Request Created',
    request_withdrawn: 'Request Withdrawn',
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Behaviour Events</h2>
          <p className="text-xs text-muted-foreground">Manual review — no automated penalties yet</p>
        </div>
        <button onClick={fetchEvents} className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors duration-150">
          <RefreshCw size={16} className="text-muted-foreground" />
        </button>
      </div>
      <div className="space-y-2">
        {events.map((event) => {
          const isCritical = event.event_type?.includes('after_confirmation') || event.event_type?.includes('complaint');
          const isLoading = loadingAction === `restrict-${event.event_id}`;
          return (
            <div key={event.event_id} className={`card p-4 ${isCritical ? 'border-red-200' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {isCritical ? (
                    <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Activity size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{event.actor_name}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        event.actor_role === 'driver' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                      }`}>
                        {event.actor_role}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {EVENT_LABELS[event.event_type] ?? event.event_type} ·{' '}
                      {new Date(event.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
                {isCritical && (
                  <button
                    onClick={() => handleRestrict(event.actor_id ?? event.event_id)}
                    disabled={!!loadingAction}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-all duration-150 active:scale-95 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={11} className="animate-spin" /> : <ShieldAlert size={11} />}
                    Restrict
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="card p-8 text-center">
            <Activity size={32} className="mx-auto text-muted-foreground opacity-40 mb-2" />
            <p className="text-sm text-muted-foreground">No behaviour events recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}