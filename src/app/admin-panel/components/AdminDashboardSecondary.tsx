'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CarFront, Loader2, Megaphone, Settings2, UsersRound, Waypoints } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminGetRecentActivity, type AdminRecentActivity } from '@/lib/adminControlApi';

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
  create_outstation_request: 'Outstation request created',
  driver_send_outstation_quote: 'Outstation quote sent',
  accept_outstation_quote: 'Outstation quote accepted',
};

export default function AdminDashboardSecondary() {
  const { profile } = useAuth();
  const [activity, setActivity] = useState<AdminRecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoading(true);
    try { setActivity(await adminGetRecentActivity(6)); }
    finally { setLoading(false); }
  }, [profile?.role]);

  useEffect(() => { void load(); }, [load]);
  if (profile?.role !== 'admin') return null;

  const areas = [
    { href: '/admin-panel/operations', title: 'Operations', text: 'Live trips, GPS, queues, support and safe recovery.', icon: <Settings2 size={18} /> },
    { href: '/admin-panel/outstation', title: 'Outstation', text: 'Observe Passenger leads, Driver quotes and accepted cars.', icon: <CarFront size={18} /> },
    { href: '/admin-panel/users', title: 'Registered Users', text: 'Search people, inspect state and onboard Drivers.', icon: <UsersRound size={18} /> },
    { href: '/admin-panel/route-settings', title: 'Routes', text: 'Versioned configuration, fares and publishing.', icon: <Waypoints size={18} /> },
    { href: '/admin-panel/promotions', title: 'Local Offers', text: 'Publish clearly marked local sponsorships and record collected amount.', icon: <Megaphone size={18} /> },
  ];

  return (
    <section className="mx-auto grid max-w-screen-2xl gap-4 px-4 pt-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-3xl border border-border bg-card p-4 card-shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="section-label">Recent activity</p><h2 className="mt-1 text-lg font-extrabold tracking-tight">What just changed</h2></div><Link href="/admin-panel/operations" className="inline-flex items-center gap-1 text-xs font-bold text-primary">Operations <ArrowRight size={13} /></Link></div>
        <div className="mt-4 space-y-1">
          {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}
          {!loading && activity.length === 0 && <p className="rounded-2xl bg-muted/60 px-4 py-5 text-sm text-muted-foreground">No recent operational activity.</p>}
          {activity.map((item) => (
            <div key={item.activity_id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/60">
              <div className="min-w-0"><p className="truncate text-sm font-bold text-foreground">{actionLabels[item.action] || item.action}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.actor_name || 'System'}</p></div>
              <time className="shrink-0 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 card-shadow-sm sm:p-5">
        <p className="section-label">Admin areas</p><h2 className="mt-1 text-lg font-extrabold tracking-tight">Manage Raahi</h2>
        <div className="mt-4 space-y-2">
          {areas.map((area) => <Link key={area.href} href={area.href} className="flex items-center gap-3 rounded-2xl border border-border px-3 py-3 hover:border-primary/30 hover:bg-muted/50"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">{area.icon}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">{area.title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{area.text}</p></div><ArrowRight size={15} className="shrink-0 text-muted-foreground" /></Link>)}
        </div>
      </div>
    </section>
  );
}
