'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, IndianRupee, Loader2, Route, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import AdminPrimaryNav from '../components/AdminPrimaryNav';
import { createClient } from '@/lib/supabase/client';
import { adminGetRoutes } from '@/lib/raahiApi';

export default function RouteSettingsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [routes, setRoutes] = useState<any[]>([]);
  const [draftFare, setDraftFare] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await adminGetRoutes();
    setRoutes(rows);
    setDraftFare(Object.fromEntries(rows.map((r: any) => [r.id, String(r.fare_per_seat ?? 150)])));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && profile?.role === 'admin') load();
  }, [authLoading, profile?.role, load]);

  const saveFare = async (route: any) => {
    const fare = Number(draftFare[route.id]);
    if (!Number.isInteger(fare) || fare < 20 || fare > 5000) {
      toast.error('Fare must be a whole number between ₹20 and ₹5000');
      return;
    }
    setBusy(`fare-${route.id}`);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('admin_set_route_fare', { p_route_id: route.id, p_fare_per_seat: fare });
    setBusy(null);
    if (error || !data?.success) return toast.error(error?.message || data?.error || 'Could not update fare');
    toast.success(`Fare set to ₹${fare}/seat for future cars`);
    await load();
  };

  const toggleRoute = async (route: any) => {
    const next = !route.is_active;
    if (!next && !window.confirm(`Disable ${route.code}? Raahi will reject this if a driver is queued or a trip is live.`)) return;
    setBusy(`active-${route.id}`);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('admin_set_route_active', { p_route_id: route.id, p_is_active: next });
    setBusy(null);
    if (error || !data?.success) return toast.error(error?.message || data?.error || 'Could not update route');
    toast.success(next ? 'Route enabled' : 'Route disabled');
    await load();
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (profile?.role !== 'admin') return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Admin access required.</div>;

  return (
    <div className="min-h-screen bg-background">
      <AdminPrimaryNav active="routes" />

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Fare changes apply only to cars created after the change. A car already collecting keeps the fare it started with. A route with a live queue or trip cannot be disabled.
        </div>

        {routes.map((route: any) => {
          const fareBusy = busy === `fare-${route.id}`;
          const activeBusy = busy === `active-${route.id}`;
          return (
            <div key={route.id} className="card p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><p className="text-sm font-bold">{route.code}</p><span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${route.is_active ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'}`}>{route.is_active ? 'Active' : 'Disabled'}</span></div>
                  <p className="text-xs text-muted-foreground mt-1">{route.from_location?.name} → {route.to_location?.name}</p>
                </div>
                <button disabled={activeBusy} onClick={() => toggleRoute(route)} className="btn-outline shrink-0">
                  {activeBusy ? <Loader2 size={15} className="animate-spin" /> : route.is_active ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                  {route.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Fare per seat</label>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="relative flex-1">
                    <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      inputMode="numeric"
                      value={draftFare[route.id] ?? ''}
                      onChange={(e) => setDraftFare((current) => ({ ...current, [route.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                      className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
                      aria-label={`Fare for ${route.code}`}
                    />
                  </div>
                  <button disabled={fareBusy || String(route.fare_per_seat ?? 150) === draftFare[route.id]} onClick={() => saveFare(route)} className="btn-primary shrink-0">
                    {fareBusy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Save Fare
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Current: ₹{route.fare_per_seat ?? 150}/seat · future cars only</p>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
