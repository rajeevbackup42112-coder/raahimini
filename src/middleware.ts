import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  if (process.env.RAAHI_DEMO_ENABLED === 'true') {
    const pathname = request.nextUrl.pathname;
    if (pathname === '/demo' || pathname.startsWith('/demo/') || pathname === '/robots.txt' || pathname === '/manifest.json') {
      return NextResponse.next();
    }
    const demoUrl = request.nextUrl.clone();
    demoUrl.pathname = '/demo';
    demoUrl.search = '';
    return NextResponse.redirect(demoUrl);
  }

  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh the normal Supabase session when present. Authentication enters
  // through supported Supabase OAuth/OTP/test-session flows, never a custom header.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
