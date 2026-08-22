'use client';

import { useState } from 'react';
import { HelpCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

type Role = 'passenger' | 'driver';
type Option = { value: string; label: string };

const passengerOptions: Option[] = [
  { value: 'FARE_ISSUE', label: 'Fare issue' },
  { value: 'EXTRA_MONEY', label: 'Driver asked for extra money' },
  { value: 'WRONG_DRIVER_VEHICLE', label: 'Wrong driver or vehicle' },
  { value: 'UNSAFE_BEHAVIOUR', label: 'Unsafe behaviour' },
  { value: 'BOOKING_PROBLEM', label: 'Booking problem' },
  { value: 'OTHER', label: 'Other' },
];

const driverOptions: Option[] = [
  { value: 'VEHICLE_BREAKDOWN', label: 'Vehicle breakdown' },
  { value: 'PASSENGER_NO_SHOW', label: 'Passenger no-show issue' },
  { value: 'FARE_ISSUE', label: 'Fare issue' },
  { value: 'UNSAFE_BEHAVIOUR', label: 'Unsafe behaviour' },
  { value: 'OTHER', label: 'Other' },
];

export default function SupportIssueButton({ role, tripId, requestId }: { role: Role; tripId?: string; requestId?: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const options = role === 'passenger' ? passengerOptions : driverOptions;

  const submit = async () => {
    if (!category) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_support_case', {
      p_category: category,
      p_trip_id: tripId || null,
      p_request_id: requestId || null,
      p_details: details.trim() || null,
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(error?.message || data?.error || 'Could not report this issue');
      return;
    }
    toast.success(data.already_open ? 'This issue is already with Raahi admin.' : 'Issue sent to Raahi admin.');
    setOpen(false);
    setCategory('');
    setDetails('');
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-outline w-full"><HelpCircle size={17} />Need Help?</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold">Tell Raahi what happened</h2><p className="mt-1 text-xs text-muted-foreground">This reports the issue to Raahi admin. It does not cancel or change your ride.</p></div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl hover:bg-muted"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              {options.map((option) => (
                <button key={option.value} type="button" onClick={() => setCategory(option.value)} className={`w-full rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold ${category === option.value ? 'border-primary bg-secondary text-primary' : 'border-border bg-card text-foreground'}`}>{option.label}</button>
              ))}
            </div>
            <textarea value={details} onChange={(event) => setDetails(event.target.value.slice(0, 500))} placeholder="Optional details" rows={3} className="input-field resize-none" />
            <p className="text-right text-[10px] text-muted-foreground">{details.length}/500</p>
            <button type="button" onClick={submit} disabled={busy || !category} className="btn-primary w-full">{busy ? <Loader2 size={17} className="animate-spin" /> : <HelpCircle size={17} />}{busy ? 'Sending…' : 'Send to Raahi'}</button>
          </div>
        </div>
      )}
    </>
  );
}
