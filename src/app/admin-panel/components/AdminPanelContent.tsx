'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { MapPin, Route, Users, Car, List, Activity, ShieldAlert, ChevronLeft, CheckCircle2, ArrowUp, ArrowDown, Trash2, Plus, Edit2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import {
  LOCATIONS, ROUTES, STOPS_GD01, STOPS_DG01,
  ADMIN_DRIVERS, ADMIN_ACTIVE_TRIPS, ADMIN_BEHAVIOUR_EVENTS
} from '@/lib/mockData';
import StatusBadge from '@/components/ui/StatusBadge';
import AppLogo from '@/components/ui/AppLogo';

// BACKEND INTEGRATION POINT: All admin mutations call admin RPCs:
// admin_restrict_user(), admin_unrestrict_user(), admin_reorder_queue(), admin_remove_from_queue()

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

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Admin Header */}
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
            <span className="text-xs font-semibold px-2.5 py-1 bg-red-50 text-red-700 rounded-lg border border-red-200">
              Admin Access
            </span>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex overflow-x-auto border-t border-border px-2 gap-0 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={`admin-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors duration-150 ${
                activeTab === tab.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
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

// ─── LOCATIONS TAB ─────────────────────────────────────────────────────────────
function LocationsTab() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Locations</h2>
        <button className="btn-primary py-2 px-3 text-sm">
          <Plus size={14} />
          Add Location
        </button>
      </div>
      <div className="space-y-2">
        {LOCATIONS.map((loc) => (
          <div key={loc.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-primary" />
              <div>
                <p className="text-sm font-bold text-foreground">{loc.name}</p>
                <p className="text-xs text-muted-foreground">Jharkhand, India</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={loc.active ? 'confirmed' : 'expired'} label={loc.active ? 'Active' : 'Inactive'} />
              <button className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                <Edit2 size={14} className="text-muted-foreground" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="card p-4 border-dashed border-2 border-border flex items-center justify-center gap-2 text-muted-foreground text-sm cursor-pointer hover:border-primary/40 hover:text-primary transition-colors duration-150">
        <Plus size={16} />
        Add Bokaro, Ranchi, or other locations
      </div>
    </div>
  );
}

// ─── ROUTES TAB ────────────────────────────────────────────────────────────────
function RoutesTab() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const allStops = [...STOPS_GD01, ...STOPS_DG01];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Routes & Stops</h2>
        <button className="btn-primary py-2 px-3 text-sm">
          <Plus size={14} />
          Add Route
        </button>
      </div>

      <div className="space-y-2">
        {ROUTES.map((route) => {
          const routeStops = allStops.filter((s) => s.route_id === route.id);
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
                    <p className="text-xs text-muted-foreground">{routeStops.length} stops configured</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status="confirmed" label="Active" />
                  <ChevronLeft size={16} className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? '-rotate-90' : 'rotate-180'}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <p className="section-label">Pickup Stops (ordered)</p>
                    <button className="text-xs font-semibold text-primary flex items-center gap-1">
                      <Plus size={12} /> Add Stop
                    </button>
                  </div>
                  {routeStops.map((stop, idx) => (
                    <div key={stop.id} className="flex items-center gap-3 bg-muted rounded-xl px-3 py-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {stop.stop_order}
                      </span>
                      <p className="text-sm font-medium text-foreground flex-1">{stop.name}</p>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {stop.minutes_from_prev > 0 ? `+${stop.minutes_from_prev} min` : 'Start'}
                      </span>
                      <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-border transition-colors">
                        <Edit2 size={12} className="text-muted-foreground" />
                      </button>
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

// ─── DRIVERS TAB ───────────────────────────────────────────────────────────────
function DriversTab() {
  const [drivers, setDrivers] = useState(ADMIN_DRIVERS);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleToggleRestriction = (driverId: string, currentStatus: string) => {
    setLoadingAction(`restrict-${driverId}`);
    const isRestricting = currentStatus === 'active';
    // BACKEND: admin_restrict_user(driverId) or admin_unrestrict_user(driverId) RPC
    setTimeout(() => {
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driverId ? { ...d, status: isRestricting ? 'restricted' : 'active' } : d
        )
      );
      setLoadingAction(null);
      toast.success(isRestricting ? 'Driver restricted' : 'Driver restriction lifted');
    }, 800);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Drivers ({drivers.length})</h2>
        <button className="btn-primary py-2 px-3 text-sm">
          <Plus size={14} />
          Add Driver
        </button>
      </div>

      <div className="space-y-2">
        {drivers.map((driver) => {
          const isRestricted = driver.status === 'restricted';
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
                      <p className="text-sm font-bold text-foreground">{driver.name}</p>
                      <StatusBadge
                        status={isRestricted ? 'cancelled' : 'confirmed'}
                        label={isRestricted ? 'Restricted' : 'Active'}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{driver.phone}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        <Car size={10} className="inline mr-0.5" />
                        {driver.vehicle}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Route: {driver.route}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {driver.trips_completed} trips
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleRestriction(driver.id, driver.status)}
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

// ─── QUEUE TAB ─────────────────────────────────────────────────────────────────
function QueueTab() {
  const [queue, setQueue] = useState(
    ADMIN_DRIVERS.filter((d) => d.queue_position !== null && d.route === 'GD-01')
      .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0))
  );

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const newQueue = [...queue];
    [newQueue[idx - 1], newQueue[idx]] = [newQueue[idx], newQueue[idx - 1]];
    setQueue(newQueue);
    // BACKEND: admin_reorder_queue(route_id, new_order) RPC
    toast.success('Queue reordered');
  };

  const moveDown = (idx: number) => {
    if (idx === queue.length - 1) return;
    const newQueue = [...queue];
    [newQueue[idx], newQueue[idx + 1]] = [newQueue[idx + 1], newQueue[idx]];
    setQueue(newQueue);
    toast.success('Queue reordered');
  };

  const removeFromQueue = (driverId: string) => {
    setQueue((prev) => prev.filter((d) => d.id !== driverId));
    // BACKEND: admin_remove_from_queue(driver_id, route_id) RPC
    toast.info('Driver removed from queue');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Driver Queue — GD-01</h2>
          <p className="text-xs text-muted-foreground">Gomoh → Dhanbad · FIFO order</p>
        </div>
        <button
          onClick={() => toast.info('Queue refreshed')}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors duration-150"
        >
          <RefreshCw size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-2">
        {queue.map((driver, idx) => (
          <div
            key={driver.id}
            className={`card p-4 flex items-center gap-3 ${idx === 0 ? 'border-primary/40 bg-secondary/30' : ''}`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
              idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
            }`}>
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{driver.name}</p>
              <p className="text-xs text-muted-foreground">{driver.vehicle} · {driver.trips_completed} trips</p>
            </div>
            {idx === 0 && (
              <StatusBadge status="collecting" label="Active" />
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ArrowUp size={13} className="text-muted-foreground" />
              </button>
              <button
                onClick={() => moveDown(idx)}
                disabled={idx === queue.length - 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ArrowDown size={13} className="text-muted-foreground" />
              </button>
              <button
                onClick={() => removeFromQueue(driver.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} className="text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {queue.length === 0 && (
        <div className="card p-8 text-center">
          <List size={32} className="mx-auto text-muted-foreground opacity-40 mb-2" />
          <p className="text-sm text-muted-foreground">No drivers in queue for GD-01</p>
        </div>
      )}
    </div>
  );
}

// ─── TRIPS TAB ─────────────────────────────────────────────────────────────────
function TripsTab() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Active Trips ({ADMIN_ACTIVE_TRIPS.length})</h2>
        <button
          onClick={() => toast.info('Trips refreshed')}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors duration-150"
        >
          <RefreshCw size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-3">
        {ADMIN_ACTIVE_TRIPS.map((trip) => (
          <div key={trip.id} className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{trip.route}</span>
                  <StatusBadge
                    status={trip.status === 'ACTIVE_COLLECTING' ? 'collecting' : 'in-progress'}
                    label={trip.status === 'ACTIVE_COLLECTING' ? 'Collecting' : 'In Progress'}
                  />
                </div>
                <p className="text-sm font-bold text-foreground mt-0.5">{trip.driver}</p>
                <p className="text-xs text-muted-foreground font-mono">{trip.id}</p>
              </div>
              {trip.started && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="text-sm font-bold text-foreground">{trip.started}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Capacity', value: trip.capacity, color: 'bg-muted' },
                { label: 'Confirmed', value: trip.confirmed, color: 'bg-green-50 text-green-700' },
                { label: 'Held', value: trip.held, color: 'bg-amber-50 text-amber-700' },
                { label: 'Available', value: trip.available, color: 'status-available' },
              ].map((stat) => (
                <div key={`trip-stat-${trip.id}-${stat.label}`} className={`rounded-xl px-2 py-2 text-center ${stat.color}`}>
                  <p className="text-lg font-bold tabular-nums">{stat.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BEHAVIOUR TAB ─────────────────────────────────────────────────────────────
function BehaviourTab() {
  const [events, setEvents] = useState(ADMIN_BEHAVIOUR_EVENTS);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleRestrict = (actorId: string) => {
    setLoadingAction(`restrict-${actorId}`);
    // BACKEND: admin_restrict_user(actor_id) RPC
    setTimeout(() => {
      setEvents((prev) =>
        prev.map((e) => e.id === actorId ? { ...e, action: 'restricted' } : e)
      );
      setLoadingAction(null);
      toast.success('User restricted');
    }, 700);
  };

  const EVENT_LABELS: Record<string, string> = {
    driver_cancel_after_confirmation: 'Cancel (after confirm)',
    driver_cancel_before_confirmation: 'Cancel (before confirm)',
    request_expired: 'Request Expired',
    confirmed_no_show: 'Confirmed No-show',
    passenger_complaint: 'Passenger Complaint',
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Behaviour Events</h2>
          <p className="text-xs text-muted-foreground">Manual review — no automated penalties yet</p>
        </div>
      </div>

      <div className="space-y-2">
        {events.map((event) => {
          const isRestricted = event.action === 'restricted';
          const isLoading = loadingAction === `restrict-${event.id}`;
          const isCritical = event.event.includes('after_confirmation') || event.count >= 3;

          return (
            <div key={event.id} className={`card p-4 ${isCritical ? 'border-red-200' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {isCritical ? (
                    <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Activity size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{event.actor}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        event.role === 'driver' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                              {event.role}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {EVENT_LABELS[event.event] ?? event.event} ·{' '}
                            <strong className="text-foreground">{event.count}×</strong> · Last: {event.last_occurrence}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRestricted ? (
                          <StatusBadge status="cancelled" label="Restricted" />
                        ) : (
                          <button
                            onClick={() => handleRestrict(event.id)}
                            disabled={!!loadingAction}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-all duration-150 active:scale-95 disabled:opacity-50"
                          >
                            {isLoading ? <Loader2 size={11} className="animate-spin" /> : <ShieldAlert size={11} />}
                            Restrict
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {events.length === 0 && (
              <div className="card p-8 text-center">
                <Activity size={32} className="mx-auto text-muted-foreground opacity-40 mb-2" />
                <p className="text-sm text-muted-foreground">No behaviour events recorded</p>
              </div>
            )}
          </div>
        );
      }