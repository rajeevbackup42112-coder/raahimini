'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Car, Clock3, Loader2, RefreshCw, Users, UserRoundSearch } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminGetDashboardSummary, type AdminDashboardSummary } from '@/lib/adminControlApi';

export default function AdminDashboardOverview() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoading(true); setError('');
    try { setSummary(await adminGetDashboardSummary()); }
    catch (e: any) { setError(e.message || 'Could not load Admin dashboard'); }
    finally { setLoading(false); }
  }, [profile?.role]);

  useEffect(() => { void load(); }, [load]);
  if (profile?.role !== 'admin') return null;

  const attention = (summary?.open_support_cases ?? 0) + (summary?.operational_warnings ?? 0);
  const metrics = [
    { label: 'Active trips', value: summary?.active_trips ?? 0, sub: 'On the road', icon: <Car size={18} /> },
    { label: 'Collecting cars', value: summary?.collecting_cars ?? 0, sub: 'Picking up now', icon: <Clock3 size={18} /> },
    { label: 'Passengers waiting', value: summary?.held_requests ?? 0, sub: `${summary?.held_seats ?? 0} held seat${(summary?.held_seats ?? 0) === 1 ? '' : 's'}`, icon: <Users size={18} /> },
    { label: 'Drivers queued', value: summary?.waiting_drivers ?? 0, sub: 'FIFO supply', icon: <UserRoundSearch size={18} /> },
    { label: 'Attention', value: attention, sub: attention ? `${summary?.open_support_cases ?? 0} support · ${summary?.operational_warnings ?? 0} route warnings` : 'No open exceptions', icon: <AlertTriangle size={18} />, attention: true },
  ];

  return (
    <section className="mx-auto max-w-screen-2xl space-y-4 px-4 pt-5 sm:px-6">
      <div className="hero-surface">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">Operations command center</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">What is happening now</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">Live trips, collecting cars, passenger demand, driver supply and exceptions first. Recent activity and configuration follow live route health.</p></div>
          <button onClick={load} disabled={loading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20" aria-label="Refresh dashboard">{loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}</button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        {metrics.map((item) => (
          <div key={item.label} className={`rounded-2xl border bg-card p-4 card-shadow-sm ${item.attention && attention > 0 ? 'border-amber-300' : 'border-border'}`}>
            <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{item.label}</p><span className={item.attention && attention > 0 ? 'text-amber-600' : 'text-primary'}>{item.icon}</span></div>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{loading ? '-' : item.value}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
