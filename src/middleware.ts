import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

function normalizeHost(value: string | null): string {
  if (!value) return '';
  return value.split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
}

function isRocketStagingHost(request: NextRequest): boolean {
  const hosts = [
    normalizeHost(request.headers.get('x-forwarded-host')),
    normalizeHost(request.headers.get('host')),
  ].filter(Boolean);
  return hosts.some((host) => host.endsWith('.public.builtwithrocket.new'));
}

function roleHome(role?: string | null) {
  if (role === 'admin') return '/admin-panel';
  if (role === 'driver') return '/driver-route-selection';
  return '/';
}

function isPassengerOnly(pathname: string) {
  return pathname.startsWith('/request-seat-screen') || pathname.startsWith('/resume-seat-request') || pathname.startsWith('/request-status-screen');
}

function isDriverOnly(pathname: string) {
  return pathname.startsWith('/driver-') && pathname !== '/driver-login';
}

function isAdminOnly(pathname: string) {
  return pathname.startsWith('/admin-') || pathname.startsWith('/admin-panel');
}

export async function middleware(request: NextRequest) {
  injectTokenFromHeader(request);
  const { pathname, search } = request.nextUrl;

  if (pathname === '/driver-login' || pathname === '/admin-login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    if (isDriverOnly(pathname) || isAdminOnly(pathname) || pathname === '/support' || pathname === '/profile') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = profile?.role || 'passenger';
  const home = roleHome(role);

  // Deterministic test personas are allowed to bypass phone verification only
  // on Rocket staging. The API that creates this marker is itself secret-protected
  // and hard-blocked on production hosts, and browser cookies cannot cross from
  // the staging domain to the production custom domain.
  const stagingTestSession =
    isRocketStagingHost(request) &&
    request.cookies.get('raahi-test-session')?.value === '1';

  const phoneVerified =
    stagingTestSession ||
    process.env.RAAHI_TEST_AUTH_ENABLED === 'true' ||
    Boolean(user.phone && user.phone_confirmed_at);

  if (pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = !phoneVerified && role !== 'admin' ? '/profile' : home;
    url.search = !phoneVerified && role !== 'admin' ? `?next=${encodeURIComponent(home)}` : '';
    return NextResponse.redirect(url);
  }

  if (role !== 'admin' && !phoneVerified && (pathname === home || isPassengerOnly(pathname) || isDriverOnly(pathname))) {
    const url = request.nextUrl.clone();
    url.pathname = '/profile';
    url.search = `?next=${encodeURIComponent(home)}`;
    return NextResponse.redirect(url);
  }

  if ((role === 'admin' || role === 'driver') && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = '';
    return NextResponse.redirect(url);
  }

  if ((isPassengerOnly(pathname) && role !== 'passenger') || (isDriverOnly(pathname) && role !== 'driver') || (isAdminOnly(pathname) && role !== 'admin')) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
