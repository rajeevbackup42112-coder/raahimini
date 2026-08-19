import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function markNotification(requestId: string, status: 'SENT'|'FAILED'|'NOT_CONFIGURED') {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await admin.rpc('mark_support_request_notified', { p_request_id: requestId, p_status: status });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 });

  let payload: { subject?: unknown; message?: unknown; allowContact?: unknown };
  try { payload = await request.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 }); }

  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const allowContact = payload.allowContact === true;

  const { data, error } = await supabase.rpc('submit_support_request', {
    p_subject: subject,
    p_body: message,
    p_allow_contact: allowContact,
  });

  if (error || !(data as any)?.success) {
    return NextResponse.json({ success: false, error: (data as any)?.error || error?.message || 'Could not send support request' }, { status: 400 });
  }

  const requestId = (data as any).request_id as string;
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.RAAHI_SUPPORT_ADMIN_EMAIL;
  const fromEmail = process.env.RAAHI_SUPPORT_FROM_EMAIL || 'Raahi Support <onboarding@resend.dev>';

  if (!apiKey || !adminEmail) {
    await markNotification(requestId, 'NOT_CONFIGURED');
    return NextResponse.json({ success: true, requestId, emailNotified: false });
  }

  const { data: profile } = await supabase.from('profiles').select('display_name,role').eq('id', user.id).maybeSingle();
  const contactLine = allowContact
    ? `Contact allowed: yes\nEmail: ${user.email || 'not available'}\nPhone: ${user.phone || 'not available'}`
    : 'Contact allowed: no';

  const emailText = [
    `New Raahi support request`,
    `Request ID: ${requestId}`,
    `From: ${profile?.display_name || 'Raahi user'} (${profile?.role || 'user'})`,
    contactLine,
    `Subject: ${subject}`,
    '',
    message,
  ].join('\n');

  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: [adminEmail], subject: `[Raahi Support] ${subject}`, text: emailText }),
    });
    if (!emailResponse.ok) throw new Error(`Email provider returned ${emailResponse.status}`);
    await markNotification(requestId, 'SENT');
    return NextResponse.json({ success: true, requestId, emailNotified: true });
  } catch (emailError) {
    console.error('Support email notification failed', emailError);
    await markNotification(requestId, 'FAILED');
    // The support request is already safely stored; do not make the customer resubmit.
    return NextResponse.json({ success: true, requestId, emailNotified: false });
  }
}
