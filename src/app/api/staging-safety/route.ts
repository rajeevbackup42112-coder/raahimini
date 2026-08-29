import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const V2_DEV_PROJECT_REF = 'euqonxznewasaymdzach';
const HARD_BLOCKED_HOSTS = new Set([
  'raahi-mini.netlify.app',
  'raahi-mini.referralhub.co.in',
  'myraahi.referralhub.co.in',
  'ride.myraahi.co.in',
]);

function normalizeHost(value: string | null): string {
  if (!value) return '';
  return value.split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
}

function allowedHosts(): Set<string> {
  return new Set((process.env.RAAHI_TEST_AUTH_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => normalizeHost(host))
    .filter(Boolean));
}

function projectRefFromUrl(value: string): string {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith('.supabase.co') ? host.split('.')[0] : '';
  } catch {
    return '';
  }
}

export async function GET(request: NextRequest) {
  const candidates = [
    normalizeHost(request.headers.get('x-forwarded-host')),
    normalizeHost(request.headers.get('host')),
  ].filter(Boolean);
  const permitted = allowedHosts();
  const allowed = candidates.some((host) => permitted.has(host));
  const blocked = candidates.some((host) => HARD_BLOCKED_HOSTS.has(host));

  if (process.env.RAAHI_TEST_AUTH_ENABLED !== 'true' || !allowed || blocked) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const projectRef = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  const safe = projectRef === V2_DEV_PROJECT_REF;

  return NextResponse.json(
    { safe, environment: 'staging', supabaseProjectRef: projectRef },
    { status: safe ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
