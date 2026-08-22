'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, Loader2, Share2, X } from 'lucide-react';
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
      <button type="button" onClick={createLink} disabled={busy} className="btn-outline w-full">
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
        {busy ? 'Creating secure link…' : 'Share My Raahi'}
      </button>

      {open && shareUrl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-6 space-y-4 animate-slide-up">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-600" /><h2 className="text-lg font-bold">Secure trip link ready</h2></div>
                <p className="mt-2 text-sm text-muted-foreground">Anyone with this link can follow only this trip. Your phone number and booking history are never shown.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl hover:bg-muted"><X size={18} /></button>
            </div>
            <div className="rounded-xl bg-muted px-3 py-3 text-xs text-muted-foreground break-all">{shareUrl}</div>
            <button type="button" onClick={share} className="btn-primary w-full"><Copy size={17} />Share / Copy Link</button>
            <button type="button" onClick={revoke} disabled={busy} className="btn-outline w-full text-red-600">{busy ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}Revoke this link</button>
            <p className="text-center text-[11px] text-muted-foreground">The link stays available for up to 30 minutes after arrival, then expires automatically. You can revoke it earlier at any time.</p>
          </div>
        </div>
      )}
    </>
  );
}
