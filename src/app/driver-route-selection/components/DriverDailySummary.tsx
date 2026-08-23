'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock3, IndianRupee, Loader2, RefreshCw, Route, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Summary = {
  success: boolean;
  trips_completed: number;
  passengers_carried: number;
  fare_collected_estimate: number;
  average_fill_minutes: number | null;
};

export default function DriverDailySummary() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (profile?.role !== 'driver') return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('get_driver_daily_summary');
    setSummary((data as Summary) || null);
    setLoading(false);
  }, [profile?.role]);

  useEffect(() => { void load(); }, [load]);
  if (profile?.role !== 'driver') return null;

  return (
    <section className="mx-auto max-w-screen-lg px-4 pt-4 sm:px-6">
      <div className="feature-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Today</p><h2 className="mt-1 text-base font-bold text-foreground">Your Raahi day</h2><p className="mt-1 text-xs text-muted-foreground">Completed trips only · fare shown is the in-app fare estimate.</p></div>
          <button type="button" onClick={load} disabled={loading} className="btn-outline px-3 py-2" aria-label="Refresh daily summary">{loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={<Route size={15} />} label="Trips" value={String(summary?.trips_completed ?? 0)} />
          <Stat icon={<Users size={15} />} label="Passengers" value={String(summary?.passengers_carried ?? 0)} />
          <Stat icon={<IndianRupee size={15} />} label="Fare estimate" value={`₹${summary?.fare_collected_estimate ?? 0}`} />
          <Stat icon={<Clock3 size={15} />} label="Avg fill time" value={summary?.average_fill_minutes == null ? '—' : `${summary.average_fill_minutes} min`} />
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl bg-muted/60 px-3 py-3"><div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{icon}{label}</div><p className="mt-1 text-lg font-bold text-foreground">{value}</p></div>;
}
