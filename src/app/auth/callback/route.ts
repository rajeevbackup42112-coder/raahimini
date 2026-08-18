import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PRODUCTION_ORIGIN = 'https://raahi-mini.netlify.app';

function getPublicOrigin(requestOrigin: string) {
  return process.env.NODE_ENV === 'production' ? PRODUCTION_ORIGIN : requestOrigin;
}

function safeRedirectPath(next: string) {
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next.startsWith('/request-seat-screen') ? '/resume-seat-request' : next;
}

function completionHtml(destination: string) {
  const safeDestination = JSON.stringify(destination).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Completing sign-in — Raahi Mini</title>
</head>
<body>
  <p>Completing sign-in…</p>
  <script>window.location.replace(${safeDestination});</script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const publicOrigin = getPublicOrigin(origin);
  const destination = safeRedirectPath(searchParams.get('next') ?? '/');

  if (!code) {
    return NextResponse.redirect(`${publicOrigin}/?auth_error=oauth_callback`);
  }

  // A 200 completion document makes Netlify commit the Set-Cookie headers before
  // the browser navigates to the saved destination.
  const response = new NextResponse(completionHtml(`${publicOrigin}${destination}`), {
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
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const failed = NextResponse.redirect(`${publicOrigin}/?auth_error=oauth_callback`);
    failed.headers.set('Cache-Control', 'private, no-store');
    return failed;
  }

  return response;
}
