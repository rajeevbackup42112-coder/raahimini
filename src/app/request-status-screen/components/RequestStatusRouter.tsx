'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Car, Loader2, Phone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getMyDriverCancelledRequest, passengerReportRefundProblem, type DriverCancelledRequest } from '@/lib/raahiApi';
import { useAuth } from '@/contexts/AuthContext';
import RequestStatusContent from './RequestStatusContent';

export default function RequestStatusRouter() {
  const { user, loading: authLoading } = useAuth();
  const [cancelled, setCancelled] = useState<DriverCancelledRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);
  const [refundReported, setRefundReported] = useState(false);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const data = await getMyDriverCancelledRequest();
    setCancelled(data.has_driver_cancelled_request ? data : null);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, user]);

  if (authLoading || loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>;
  }

  if (!cancelled?.has_driver_cancelled_request) return <RequestStatusContent />;

  const callNumber = cancelled.driver_phone?.replace(/\D/g, '') || '';

  const reportRefund = async () => {
    if (!cancelled.request_id) return;
    setReporting(true);
    const result = await passengerReportRefundProblem(cancelled.request_id);
    setReporting(false);
    if (result.success) {
      setRefundReported(true);
      toast.success(result.already_reported ? 'Refund problem already reported' : 'Refund problem reported to Raahi Admin');
    }
    else toast.error(result.error || 'Could not report refund problem');
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-5 space-y-4 animate-fade-in">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-bold text-red-800">Driver cancelled this ride</p>
            <p className="text-sm text-red-700 mt-1">Your confirmed seat is no longer active. Raahi has reopened the route so another driver can collect passengers.</p>
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <p className="section-label">Cancelled Booking</p>
        <div><p className="text-xs text-muted-foreground">Route</p><p className="text-sm font-bold">{cancelled.route_label}</p></div>
        <div><p className="text-xs text-muted-foreground">Pickup</p><p className="text-sm font-bold">{cancelled.pickup_stop_name}</p></div>
        <div><p className="text-xs text-muted-foreground">Seats</p><p className="text-sm font-bold">{cancelled.seat_count}</p></div>
        <div><p className="text-xs text-muted-foreground">Cancelled driver</p><p className="text-sm font-bold">{cancelled.driver_display_name} · {cancelled.vehicle_number}</p></div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-800">If you already paid the driver</p>
        <p className="text-xs text-amber-700 mt-1">Payment was directly between you and the driver. Contact the driver for the refund. If there is a problem, report it to Raahi Admin below.</p>
      </div>

      <div className="space-y-2">
        {callNumber && <a href={`tel:+${callNumber.startsWith('91') ? callNumber : `91${callNumber}`}`} className="btn-accent w-full"><Phone size={18}/>Call Cancelled Driver</a>}
        {cancelled.route_id && <Link href={`/active-car-screen?route_id=${encodeURIComponent(cancelled.route_id)}`} className="btn-primary w-full"><Car size={18}/>Check for Another Car</Link>}
        <button onClick={reportRefund} disabled={reporting || refundReported} className="btn-outline w-full border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60">
          {reporting ? <Loader2 size={16} className="animate-spin"/> : <AlertTriangle size={16}/>} {refundReported ? 'Refund Problem Reported' : 'Report Refund Problem'}
        </button>
        <button onClick={load} className="btn-outline w-full"><RefreshCw size={16}/>Refresh</button>
      </div>
    </div>
  );
}
