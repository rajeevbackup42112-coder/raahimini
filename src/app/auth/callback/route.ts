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

  if (!code) {
    return NextResponse.redirect(`${publicOrigin}/?auth_error=oauth_callback`);
  }

  const destination = safeRedirectPath(searchParams.get('next') ?? '/');
  const completionUrl = new URL('/auth/complete', publicOrigin);
  completionUrl.searchParams.set('code', code);
  completionUrl.searchParams.set('next', destination);

  const response = NextResponse.redirect(completionUrl);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}
