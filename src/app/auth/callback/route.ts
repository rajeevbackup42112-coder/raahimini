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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const publicOrigin = getPublicOrigin(origin);
  const destination = safeRedirectPath(searchParams.get('next') ?? '/');
  let response = NextResponse.redirect(`${publicOrigin}${destination}`);

  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  if (!code) {
    return NextResponse.redirect(`${publicOrigin}/`);
  }

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
