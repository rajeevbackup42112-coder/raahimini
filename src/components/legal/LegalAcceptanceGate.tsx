'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { acceptMyLegalDocuments, getMyLegalAcceptanceState, isCurrentForMode, type LegalAcceptanceState } from '@/lib/legalApi';

type Mode = 'passenger' | 'driver';
type PendingAction = () => Promise<void> | void;

export function useLegalAcceptanceGate(mode: Mode) {
  const [state, setState] = useState<LegalAcceptanceState>({});
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [open, setOpen] = useState(false);

  const guard = useCallback(async (action: PendingAction) => {
    const current = await getMyLegalAcceptanceState();
    if (isCurrentForMode(current, mode)) {
      await action();
      return;
    }
    setState(current);
    setPending(() => action);
    setOpen(true);
  }, [mode]);

  const close = () => { setOpen(false); setPending(null); };
  const dialog = open ? <LegalAcceptanceDialog mode={mode} state={state} onClose={close} onAccepted={async () => {
    const next = pending;
    setOpen(false);
    setPending(null);
    if (next) await next();
  }} /> : null;

  return { guard, dialog };
}

function LegalAcceptanceDialog({ mode, state, onClose, onAccepted }: {
  mode: Mode;
  state: LegalAcceptanceState;
  onClose: () => void;
  onAccepted: () => Promise<void>;
}) {
  const needsBase = !state.terms_current || !state.privacy_current;
  const needsDriver = mode === 'driver' && !state.driver_terms_current;
  const [baseChecked, setBaseChecked] = useState(!needsBase);
  const [driverChecked, setDriverChecked] = useState(!needsDriver);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canContinue = baseChecked && (mode === 'passenger' || driverChecked);
  const accept = async () => {
    if (!canContinue) return;
    setBusy(true); setError('');
    try {
      await acceptMyLegalDocuments(mode);
      await onAccepted();
    } catch (e: any) {
      setError(e?.message || 'Could not save your agreement. Please try again.');
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 sm:items-center sm:p-4">
    <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 card-shadow-md sm:rounded-3xl sm:p-6">
      <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><ShieldCheck size={19}/></div><div className="min-w-0 flex-1"><p className="section-label">Before your first {mode === 'driver' ? 'Driver action' : 'booking'}</p><h2 className="mt-1 text-xl font-extrabold">A quick agreement, once</h2></div><button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted" aria-label="Close"><X size={18}/></button></div>
      <div className="mt-4 rounded-2xl bg-secondary/60 p-4 text-xs leading-relaxed text-muted-foreground"><p className="font-bold text-foreground">Clear fare. Pay the Driver directly.</p><p className="mt-1">Raahi helps passengers and independent local Drivers find each other. Raahi does not operate the vehicle and does not collect the ride fare.</p></div>
      <div className="mt-4 space-y-3">
        {needsBase && <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-3"><input type="checkbox" checked={baseChecked} onChange={e=>setBaseChecked(e.target.checked)} className="mt-1"/><span className="text-sm leading-relaxed">I agree to the <Link href="/terms" target="_blank" className="font-bold text-primary underline">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" className="font-bold text-primary underline">Privacy Policy</Link>.</span></label>}
        {needsDriver && <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-3"><input type="checkbox" checked={driverChecked} onChange={e=>setDriverChecked(e.target.checked)} className="mt-1"/><span className="text-sm leading-relaxed">I agree to the <Link href="/driver-terms" target="_blank" className="font-bold text-primary underline">Driver Terms</Link>, including vehicle responsibility, direct payment and safe-service obligations.</span></label>}
        {!needsBase && <p className="rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">Terms and Privacy already accepted for the current version.</p>}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Raahi records the document version and acceptance time. You will only be asked again if the applicable terms materially change.</p>
      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={onClose} className="btn-outline">Not now</button><button disabled={!canContinue||busy} onClick={()=>void accept()} className="btn-primary">{busy?<Loader2 size={16} className="animate-spin"/>:<ShieldCheck size={16}/>}Agree & continue</button></div>
    </div>
  </div>;
}
