'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Send } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

export default function SupportPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [allowContact, setAllowContact] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (subject.trim().length < 3 || message.trim().length < 3) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, allowContact }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not send your message.');
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send your message.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AppLayout headerTitle="Contact Support" headerBack>
        <div className="max-w-md mx-auto px-4 py-10 text-center space-y-4">
          <CheckCircle2 size={48} className="mx-auto text-green-600" />
          <h1 className="text-xl font-bold">Message sent</h1>
          <p className="text-sm text-muted-foreground">Raahi support has received your message. If you allowed contact, the team may reach you using your verified account details.</p>
          <button onClick={() => { setSent(false); setSubject(''); setMessage(''); }} className="btn-outline mx-auto">Send another message</button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Contact Support" headerBack>
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="card p-4 flex items-start gap-3">
          <MessageCircle size={20} className="text-primary mt-0.5" />
          <div>
            <p className="font-semibold">How can we help?</p>
            <p className="text-xs text-muted-foreground mt-1">Your message goes to the Raahi admin team. The admin email address is never shown here.</p>
          </div>
        </div>

        <form onSubmit={submit} className="card p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value.slice(0,120))} className="input-field w-full" placeholder="What do you need help with?" />
            <p className="text-[11px] text-muted-foreground mt-1 text-right">{subject.length}/120</p>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value.slice(0,2000))} className="input-field w-full min-h-36 resize-y" placeholder="Describe the issue or question" />
            <p className="text-[11px] text-muted-foreground mt-1 text-right">{message.length}/2000</p>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer">
            <input type="checkbox" checked={allowContact} onChange={e => setAllowContact(e.target.checked)} className="mt-1" />
            <span>
              <span className="block text-sm font-semibold">You may contact me about this</span>
              <span className="block text-xs text-muted-foreground mt-0.5">If unchecked, your email and phone are not included with the support request for follow-up.</span>
            </span>
          </label>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button type="submit" disabled={busy || subject.trim().length < 3 || message.trim().length < 3} className="btn-primary w-full">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {busy ? 'Sending…' : 'Send to Raahi Support'}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
