import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HARD_BLOCKED_HOSTS = new Set([
  'raahi-mini.netlify.app',
  'raahi-mini.referralhub.co.in',
]);

type PersonaRole = 'passenger' | 'driver' | 'admin';
type PersonaConfig = {
  userId: string;
  role: PersonaRole;
};

type PersonaMap = Record<string, PersonaConfig>;

const LOGIN_PERSONAS: PersonaMap = {
  'ajit-admin': { userId: 'cb7f0d46-e909-4a75-ab0f-20eae6ab089d', role: 'admin' },
  'dipti-driver': { userId: '90883c8e-ffe6-4854-9ff1-c5f80cc445e7', role: 'driver' },
  'rajeev4-driver': { userId: 'b4318eff-f019-4631-a82d-34da3435b6e4', role: 'driver' },
  rajeev1: { userId: 'ac22d5a7-74da-4c3f-ab2a-d485d8d28cd1', role: 'passenger' },
  rajeev2: { userId: '87e6948e-3964-4b3c-b359-bea32b861561', role: 'passenger' },
  rajeev3: { userId: 'b8966112-a32a-439c-9e68-7ea8e7db3752', role: 'passenger' },
  naresh: { userId: '344b8770-ba98-4688-a23b-3cbf899795f2', role: 'passenger' },
};

function normalizeHost(value: string | null): string {
  if (!value) return '';
  return value.split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
}

function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parsePersonas(): PersonaMap {
  const raw = process.env.RAAHI_TEST_PERSONAS_JSON;
  if (!raw) return {};

  const parsed = JSON.parse(raw) as PersonaMap;
  const result: PersonaMap = {};

  for (const [name, config] of Object.entries(parsed || {})) {
    if (!config || typeof config.userId !== 'string') continue;
    if (!['passenger', 'driver', 'admin'].includes(config.role)) continue;
    result[name] = config;
  }

  return result;
}

function disabled(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const candidateHosts = [
    normalizeHost(request.headers.get('x-forwarded-host')),
    normalizeHost(request.headers.get('host')),
  ].filter(Boolean);

  const hitsBlockedHost = candidateHosts.some((host) => HARD_BLOCKED_HOSTS.has(host));

  if (
    process.env.RAAHI_TEST_AUTH_ENABLED !== 'true' ||
    candidateHosts.length === 0 ||
    hitsBlockedHost
  ) {
    return disabled();
  }

  let body: { persona?: unknown; loginId?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { persona?: unknown; loginId?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const configuredKey = process.env.RAAHI_TEST_AUTH_KEY || '';
  const suppliedKey = request.headers.get('x-raahi-test-key') || (typeof body.password === 'string' ? body.password : '');
  if (!configuredKey || !suppliedKey || !safeEqual(configuredKey, suppliedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginId = typeof body.loginId === 'string' ? normalizeLogin(body.loginId) : '';
  const persona = typeof body.persona === 'string' ? body.persona : '';

  let personas: PersonaMap;
  try {
    personas = parsePersonas();
  } catch {
    return NextResponse.json({ error: 'Test auth is misconfigured' }, { status: 503 });
  }

  const target = (loginId ? LOGIN_PERSONAS[loginId] : undefined) || personas[persona];
  const personaName = loginId || persona;
  if (!target) {
    return NextResponse.json({ error: 'Unknown test persona' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Test auth is unavailable' }, { status: 503 });
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(target.userId);
  const user = userData.user;
  if (userError || !user?.email) {
    return NextResponse.json({ error: 'Configured test user does not exist' }, { status: 503 });
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role,is_restricted')
    .eq('id', target.userId)
    .single();

  if (profileError || !profile || profile.is_restricted || profile.role !== target.role) {
    return NextResponse.json({ error: 'Configured test persona no longer matches its trusted Raahi role' }, { status: 409 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return NextResponse.json({ error: 'Could not create test session' }, { status: 500 });
  }

  const supabase = await createServerClient();
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });

  const session = verifyData.session;
  if (verifyError || !session?.access_token || !session.refresh_token) {
    return NextResponse.json({ error: 'Could not establish test session' }, { status: 500 });
  }

  const redirectTo = target.role === 'admin'
    ? '/admin-panel'
    : target.role === 'driver'
      ? '/driver-route-selection'
      : '/';

  // The staging-only endpoint establishes the genuine Supabase session through
  // the server client's auth cookies. The browser only needs the destination;
  // returning/re-applying the same refresh token client-side creates a duplicate
  // handoff path and can cause unnecessary refresh-token rotation.
  const response = NextResponse.json({
    success: true,
    persona: personaName,
    role: target.role,
    redirectTo,
  });

  // Explicitly mark this browser session as a deterministic staging persona.
  // Middleware can use this marker even on hosting platforms where non-public
  // env values are not consistently available in the edge runtime. The marker
  // is trusted only on builtwithrocket staging hosts and production hosts remain
  // hard-blocked from the test-auth endpoint.
  response.cookies.set('raahi-test-session', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  return response;
}
