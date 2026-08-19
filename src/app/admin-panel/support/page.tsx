'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Inbox, Loader2, Mail, Phone, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AppHeader from '@/components/AppHeader';

type SupportItem = {
  request_id: string;
  user_id: string;
  display_name: string;
  user_role: string;
  subject: string;
  body: string;
  allow_contact: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  status: 'OPEN'|'IN_PROGRESS'|'RESOLVED';
  notification_status: string;
  created_at: string;
};

export default function AdminSupportPage() {
  const [items, setItems] = useState<SupportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('admin_get_support_requests', { p_limit: 100 });
    if (error) setError(error.message);
    else setItems((data || []) as SupportItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: SupportItem['status']) => {
    setBusyId(id);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('admin_update_support_status', { p_request_id: id, p_status: status });
    setBusyId(null);
    if (error || !(data as any)?.success) setError((data as any)?.error || error?.message || 'Could not update support request');
    else setItems(current => current.map(item => item.request_id === id ? { ...item, status } : item));
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Support Inbox" showBack />
      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div><h1 className="text-xl font-bold">Customer Support</h1><p className="text-sm text-muted-foreground">Passenger and driver messages. Contact details appear only when permission was given.</p></div>
          <button onClick={load} className="btn-outline"><RefreshCw size={16}/>Refresh</button>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div> : items.length === 0 ? (
          <div className="card p-10 text-center"><Inbox size={40} className="mx-auto text-muted-foreground opacity-40"/><p className="font-semibold mt-3">No support messages</p></div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <article key={item.request_id} className="card p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap"><h2 className="font-bold">{item.subject}</h2><span className="text-[11px] rounded-full bg-muted px-2 py-0.5 uppercase">{item.user_role}</span></div>
                    <p className="text-xs text-muted-foreground mt-1">{item.display_name} · {new Date(item.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={13}/>{item.status}</div>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{item.body}</p>
                <div className="rounded-xl bg-muted px-3 py-2 text-xs space-y-1">
                  <p><strong>Contact permission:</strong> {item.allow_contact ? 'Yes' : 'No'}</p>
                  {item.allow_contact && item.contact_email && <p className="flex items-center gap-1"><Mail size={12}/>{item.contact_email}</p>}
                  {item.allow_contact && item.contact_phone && <p className="flex items-center gap-1"><Phone size={12}/>{item.contact_phone}</p>}
                  <p><strong>Email notification:</strong> {item.notification_status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busyId===item.request_id || item.status==='OPEN'} onClick={()=>setStatus(item.request_id,'OPEN')} className="btn-outline text-xs">Open</button>
                  <button disabled={busyId===item.request_id || item.status==='IN_PROGRESS'} onClick={()=>setStatus(item.request_id,'IN_PROGRESS')} className="btn-outline text-xs">In progress</button>
                  <button disabled={busyId===item.request_id || item.status==='RESOLVED'} onClick={()=>setStatus(item.request_id,'RESOLVED')} className="btn-primary text-xs"><CheckCircle2 size={14}/>Resolved</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
