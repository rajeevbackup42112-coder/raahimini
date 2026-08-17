import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

const PRODUCTION_ORIGIN = 'https://raahi-mini.netlify.app';

function getPublicOrigin(requestOrigin: string) {
  // Netlify can expose its immutable deploy hostname through NextRequest.url even
  // when the browser entered through the production domain. OAuth cookies are
  // scoped to the browser-facing domain, so production callbacks must always
  // return there after exchanging the authorization code.
  return process.env.NODE_ENV === 'production' ? PRODUCTION_ORIGIN : requestOrigin;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const publicOrigin = getPublicOrigin(origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
      if (safeNext.startsWith('/request-seat-screen')) {
        return NextResponse.redirect(`${publicOrigin}/resume-seat-request`);
      }
      return NextResponse.redirect(`${publicOrigin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${publicOrigin}/`);
}
