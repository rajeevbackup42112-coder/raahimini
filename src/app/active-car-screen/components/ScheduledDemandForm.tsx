'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createScheduledDemandIntent } from '@/lib/demandApi';

interface Props {
  routeId: string;
  enabled: boolean;
  onNeedAuth: () => Promise<void>;
  onSaved?: () => Promise<void> | void;
}

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ScheduledDemandForm({ routeId, enabled, onNeedAuth, onSaved }: Props) {
  const defaults = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(8, 0, 0, 0);
    const end = new Date(start);
    end.setHours(9, 0, 0, 0);
    return { start: toLocalInputValue(start), end: toLocalInputValue(end) };
  }, []);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!enabled) {
      await onNeedAuth();
      return;
    }
    const earliest = new Date(start);
    const latest = new Date(end);
    if (!Number.isFinite(earliest.getTime()) || !Number.isFinite(latest.getTime())) {
      toast.error('Choose a valid travel window.');
      return;
    }
    if (earliest.getTime() <= Date.now()) {
      toast.error('Scheduled travel must be in the future.');
      return;
    }
    setBusy(true);
    const result = await createScheduledDemandIntent(routeId, earliest, latest);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error || 'Could not save travel plan.');
      return;
    }
    toast.success('Travel interest saved. Raahi will use it for planning only.');
    setOpen(false);
    await onSaved?.();
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="quiet-action w-full">
        <CalendarClock size={17} /> Plan a ride for later
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-left space-y-3">
      <div>
        <p className="text-sm font-bold text-foreground">When might you travel?</p>
        <p className="mt-1 text-xs text-muted-foreground">This is planning interest only. Raahi will never auto-book a seat.</p>
      </div>
      <label className="block text-xs font-semibold text-muted-foreground">
        Earliest
        <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground" />
      </label>
      <label className="block text-xs font-semibold text-muted-foreground">
        Latest
        <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground" />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-outline flex-1">Cancel</button>
        <button type="button" onClick={save} disabled={busy} className="btn-primary flex-1">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
          {busy ? 'Saving…' : enabled ? 'Save interest' : 'Sign in & save'}
        </button>
      </div>
    </div>
  );
}
