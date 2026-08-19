import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getPublicOrigin(requestOrigin: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  return configuredOrigin || requestOrigin;
}

function safeRedirectPath(next: string) {
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next.startsWith('/request-seat-screen') ? '/resume-seat-request' : next;
}

function roleHome(role?: string | null) {
  if (role === 'admin') return '/admin-panel';
  if (role === 'driver') return '/driver-route-selection';
  return '/';
}

function completionHtml(destination: string) {
  const safeDestination = JSON.stringify(destination).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Completing sign-in — Raahi Mini</title></head><body><p>Completing sign-in…</p><script>window.location.replace(${safeDestination});</script></body></html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const publicOrigin = getPublicOrigin(origin);

  if (!code) return NextResponse.redirect(`${publicOrigin}/?auth_error=oauth_callback`);

  let finalDestination = '/';
  const response = new NextResponse(completionHtml(`${publicOrigin}/`), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      Pragma: 'no-cache',
      Expires: '0',
      'Referrer-Policy': 'no-referrer',
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...options, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    const failed = NextResponse.redirect(`${publicOrigin}/?auth_error=oauth_callback`);
    failed.headers.set('Cache-Control', 'private, no-store');
    return failed;
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  const role = profile?.role || 'passenger';
  const home = roleHome(role);
  const requested = safeRedirectPath(searchParams.get('next') ?? '/');

  // Only passengers may resume a passenger booking flow. Driver/admin always land on their own home.
  finalDestination = role === 'passenger' && requested !== '/' ? requested : home;
  if (role !== 'admin' && !(data.user.phone && data.user.phone_confirmed_at)) {
    finalDestination = `/profile?next=${encodeURIComponent(finalDestination)}`;
  }

  const html = completionHtml(`${publicOrigin}${finalDestination}`);
  const finalResponse = new NextResponse(html, { status: 200, headers: response.headers });
  response.cookies.getAll().forEach(cookie => finalResponse.cookies.set(cookie));
  return finalResponse;
}
