'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Car, Clock3, Loader2, RefreshCw, Users, UserRoundSearch } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminGetDashboardSummary, adminGetRecentActivity, type AdminDashboardSummary, type AdminRecentActivity } from '@/lib/adminControlApi';

const actionLabels: Record<string, string> = {
  admin_onboard_driver: 'Driver onboarded',
  admin_restrict_user: 'User restricted',
  admin_unrestrict_user: 'User restored',
  admin_grant_admin: 'Admin access granted',
  admin_revoke_admin: 'Admin access removed',
  admin_resolve_support_case: 'Support case resolved',
  start_trip: 'Trip started',
  complete_trip: 'Trip completed',
  driver_cancel_trip: 'Trip cancelled',
};

export default function AdminDashboardOverview() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [activity, setActivity] = useState<AdminRecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoading(true); setError('');
    try {
      const [nextSummary, nextActivity] = await Promise.all([adminGetDashboardSummary(), adminGetRecentActivity(10)]);
      setSummary(nextSummary); setActivity(nextActivity);
    } catch (e: any) {
      setError(e.message || 'Could not load Admin dashboard');
    } finally { setLoading(false); }
  }, [profile?.role]);

  useEffect(() => { void load(); }, [load]);
  if (profile?.role !== 'admin') return null;

  const attention = (summary?.open_support_cases ?? 0) + (summary?.operational_warnings ?? 0);
  const metrics = [
    { label: 'Active trips', value: summary?.active_trips ?? 0, sub: 'On the road', icon: <Car size={18} /> },
    { label: 'Collecting cars', value: summary?.collecting_cars ?? 0, sub: 'Picking up now', icon: <Clock3 size={18} /> },
    { label: 'Passengers waiting', value: summary?.held_requests ?? 0, sub: `${summary?.held_seats ?? 0} held seat${(summary?.held_seats ?? 0) === 1 ? '' : 's'}`, icon: <Users size={18} /> },
    { label: 'Drivers queued', value: summary?.waiting_drivers ?? 0, sub: 'Waiting for FIFO turn', icon: <UserRoundSearch size={18} /> },
    { label: 'Attention', value: attention, sub: `${summary?.open_support_cases ?? 0} support · ${summary?.operational_warnings ?? 0} route warning${(summary?.operational_warnings ?? 0) === 1 ? '' : 's'}`, icon: <AlertTriangle size={18} /> },
  ];

  return (
    <section className="mx-auto max-w-screen-2xl space-y-5 px-4 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="section-label">Dashboard</p><h1 className="mt-1 text-2xl font-extrabold text-foreground">What is happening now</h1><p className="mt-1 text-xs text-muted-foreground">Live transport health first. Configuration and emergency controls stay separate.</p></div>
        <button onClick={load} disabled={loading} className="btn-outline px-3 py-2" aria-label="Refresh dashboard">{loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}</button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map((item) => <div key={item.label} className="feature-card p-4"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{item.label}</p><span className="text-primary">{item.icon}</span></div><p className="mt-2 text-2xl font-extrabold text-foreground">{loading ? '—' : item.value}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.sub}</p></div>)}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="feature-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="section-label">Recent activity</p><p className="mt-1 text-xs text-muted-foreground">Meaningful lifecycle and Admin events.</p></div>
            <Link href="/admin-panel/operations" className="text-xs font-semibold text-primary">Open Operations</Link>
          </div>
          <div className="mt-3 space-y-2">
            {!loading && activity.length === 0 && <p className="rounded-xl bg-muted/60 px-3 py-4 text-sm text-muted-foreground">No recent operational activity.</p>}
            {activity.map((item) => (
              <div key={item.activity_id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{actionLabels[item.action] || item.action}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.actor_name || 'System'}</p></div>
                <time className="shrink-0 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time>
              </div>
            ))}
          </div>
        </div>

        <div className="feature-card p-4">
          <p className="section-label">Admin areas</p>
          <div className="mt-3 space-y-2">
            <Link href="/admin-panel/users" className="block rounded-xl border border-border px-3 py-3 hover:bg-muted"><p className="text-sm font-bold text-foreground">Registered Users</p><p className="mt-0.5 text-xs text-muted-foreground">Search people, inspect state, onboard Drivers.</p></Link>
            <Link href="/admin-panel/route-settings" className="block rounded-xl border border-border px-3 py-3 hover:bg-muted"><p className="text-sm font-bold text-foreground">Routes</p><p className="mt-0.5 text-xs text-muted-foreground">Versioned route configuration, fares and publishing.</p></Link>
            <Link href="/admin-panel/operations" className="block rounded-xl border border-border px-3 py-3 hover:bg-muted"><p className="text-sm font-bold text-foreground">Operations</p><p className="mt-0.5 text-xs text-muted-foreground">Live trips, GPS, queues, support and safe recovery.</p></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
