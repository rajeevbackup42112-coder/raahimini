'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, Loader2, Share2, ShieldCheck, TimerReset, X } from 'lucide-react';
import { toast } from 'sonner';
import { createTripShareLink, revokeTripShareLink } from '@/lib/shareApi';

export default function ShareMyRaahiButton({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const createLink = async () => {
    setBusy(true);
    const result = await createTripShareLink(requestId);
    setBusy(false);
    if (!result.success || !result.token) {
      toast.error(result.error || 'Could not create a secure trip link');
      return;
    }
    const url = `${window.location.origin}/shared-trip?token=${encodeURIComponent(result.token)}`;
    setShareUrl(url);
    setOpen(true);
  };

  const share = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Follow my Raahi trip', text: 'Follow my live Raahi trip', url: shareUrl });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(shareUrl);
    toast.success('Secure trip link copied');
  };

  const revoke = async () => {
    setBusy(true);
    const result = await revokeTripShareLink(requestId);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error || 'Could not revoke trip link');
      return;
    }
    setShareUrl('');
    setOpen(false);
    toast.success('Shared trip link revoked');
  };

  return (
    <>
      <button type="button" onClick={createLink} disabled={busy} className="btn-outline min-h-12 w-full">
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
        {busy ? 'Creating secure link…' : 'Share My Raahi'}
      </button>

      {open && shareUrl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-card card-shadow-md animate-slide-up sm:rounded-3xl">
            <div className="bg-gradient-to-br from-primary to-[#267746] px-6 pb-6 pt-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><ShieldCheck size={21} /></div>
                <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Close share dialog"><X size={18} /></button>
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs font-bold text-white/75"><CheckCircle2 size={15} /> Secure trip link ready</div>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Share the journey, not the account.</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75">Anyone with this link can follow only this trip. Your phone number and booking history are never shown.</p>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-3 gap-2">
                <TrustChip title="One trip only" />
                <TrustChip title="No phone shared" />
                <TrustChip title="Revoke anytime" />
              </div>
              <div className="rounded-2xl border border-border bg-muted/60 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Private link</p>
                <p className="mt-1 truncate text-xs font-semibold text-foreground">{shareUrl}</p>
              </div>
              <button type="button" onClick={share} className="btn-primary w-full py-3.5"><Copy size={17} />Share secure link</button>
              <button type="button" onClick={revoke} disabled={busy} className="quiet-action w-full text-red-600 hover:bg-red-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}Revoke this link</button>
              <div className="flex items-start gap-3 rounded-2xl bg-muted/60 px-4 py-3">
                <TimerReset size={17} className="mt-0.5 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">The link stays available for up to 30 minutes after arrival, then expires automatically.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TrustChip({ title }: { title: string }) {
  return <div className="rounded-xl border border-border bg-card px-2 py-2.5 text-center text-[10px] font-bold leading-tight text-foreground">{title}</div>;
}
