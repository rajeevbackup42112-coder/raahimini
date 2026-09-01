'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, Loader2, ShieldCheck, X } from 'lucide-react';
import { getRaahiTransactionAccess, type RaahiTransactionAccess } from '@/lib/launchApi';

type PendingAction = () => Promise<void> | void;

export function useRegulatoryLaunchGate() {
  const [access, setAccess] = useState<RaahiTransactionAccess>({});
  const [open, setOpen] = useState(false);

  const guard = useCallback(async (action: PendingAction) => {
    const current = await getRaahiTransactionAccess();
    setAccess(current);
    if (current.can_transact) {
      await action();
      return;
    }
    setOpen(true);
  }, []);

  const dialog = open ? <RegulatoryLaunchDialog access={access} onClose={()=>setOpen(false)}/> : null;
  return { guard, dialog, access };
}
function RegulatoryLaunchDialog({access,onClose}:{access:RaahiTransactionAccess;onClose:()=>void}) {
  return <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/55 sm:items-center sm:p-4">
    <div className="w-full max-w-lg rounded-t-3xl bg-card p-5 card-shadow-md sm:rounded-3xl sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><ShieldCheck size={19}/></div>
        <div className="min-w-0 flex-1"><p className="section-label">Controlled launch</p><h2 className="mt-1 text-xl font-extrabold">Ride transactions are still in pilot</h2></div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted" aria-label="Close"><X size={18}/></button>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{access.message||'Raahi is preparing its verified local Driver network. Browsing and Driver registration remain open while public ride transactions are held for regulatory clearance.'}</p>
      <div className="mt-4 rounded-2xl bg-secondary/60 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="font-bold text-foreground">You can still explore Raahi.</p>
        <p className="mt-1">Browse Shared Ride routes, Outstation areas, Local Offers and Driver verification. Public booking will open only after Raahi completes the required launch clearance.</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={onClose} className="btn-outline">Not now</button><Link href="/contact" className="btn-primary justify-center">Contact Raahi</Link></div>
    </div>
  </div>;
}

export function RegulatoryLaunchBanner() {
  const [access,setAccess]=useState<RaahiTransactionAccess|null>(null);
  useEffect(()=>{let live=true;void getRaahiTransactionAccess().then(v=>{if(live)setAccess(v)}).catch(()=>{});return()=>{live=false};},[]);
  if(!access||access.public_transactions_enabled) return null;
  if(access.pilot_account) return <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-center text-[11px] font-semibold text-blue-800"><FlaskConical size={13} className="mr-1 inline"/>Pilot account · transactional acceptance testing enabled.</div>;
  return <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[11px] font-semibold text-amber-900">Raahi is preparing its verified local Driver network. Browsing and registration are open; public ride transactions are not live yet.</div>;
}