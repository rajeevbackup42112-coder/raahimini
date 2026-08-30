'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, HelpCircle, Loader2, MessagesSquare, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type SupportCase = {
  case_id: string;
  reporter_name: string | null;
  reporter_role: string;
  category: string;
  route_code: string | null;
  trip_id: string | null;
  request_id: string | null;
  details: string | null;
  created_at: string;
};

const labels: Record<string, string> = {
  FARE_ISSUE: 'Fare issue',
  WRONG_DRIVER_VEHICLE: 'Wrong driver / vehicle',
  EXTRA_MONEY: 'Driver asked for extra money',
  UNSAFE_BEHAVIOUR: 'Unsafe behaviour',
  BOOKING_PROBLEM: 'Booking problem',
  PASSENGER_NO_SHOW: 'Passenger no-show issue',
  VEHICLE_BREAKDOWN: 'Vehicle breakdown',
  OTHER: 'Other',
};

export default function AdminSupportInbox() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('admin_get_open_support_cases');
    if (error) toast.error(error.message); else setCases((data || []) as SupportCase[]);
    setLoading(false);
  }, [profile?.role]);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (caseId: string) => {
    setBusy(caseId);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('admin_resolve_support_case', { p_case_id: caseId });
    setBusy(null);
    if (error || !data?.success) return toast.error(error?.message || data?.error || 'Could not resolve case');
    toast.success('Support case resolved');
    await load();
  };

  if (profile?.role !== 'admin') return null;

  return (
    <section className="mx-auto max-w-screen-2xl px-4 pt-4">
      <div className="feature-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary"><HelpCircle size={19} className="text-primary" /></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Support inbox</p><h2 className="mt-1 text-base font-bold text-foreground">{loading ? 'Checking reports…' : cases.length ? `${cases.length} open report${cases.length === 1 ? '' : 's'}` : 'No open support reports'}</h2></div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin-panel/contact" className="btn-outline px-3 py-2"><MessagesSquare size={15}/>General contact</Link>
            <button onClick={load} disabled={loading} className="btn-outline px-3 py-2" aria-label="Refresh support inbox">{loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}</button>
          </div>
        </div>

        {!loading && cases.length > 0 && (
          <div className="mt-4 space-y-2">
            {cases.map((item) => (
              <div key={item.case_id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{labels[item.category] || item.category}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.reporter_name || 'Raahi user'} · {item.reporter_role}{item.route_code ? ` · ${item.route_code}` : ''}</p>
                    {item.details && <p className="mt-2 text-sm text-foreground">{item.details}</p>}
                  </div>
                  <button onClick={() => resolve(item.case_id)} disabled={busy === item.case_id} className="btn-outline shrink-0 text-green-700">{busy === item.case_id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{busy === item.case_id ? 'Working…' : 'Resolve'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
