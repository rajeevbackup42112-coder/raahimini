import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HARD_BLOCKED_HOSTS = new Set([
  'raahi-mini.netlify.app',
]);

type PersonaRole = 'passenger' | 'driver' | 'admin';
type PersonaConfig = {
  userId: string;
  role: PersonaRole;
};

type PersonaMap = Record<string, PersonaConfig>;

function normalizeHost(value: string | null): string {
  if (!value) return '';
  return value.split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseAllowedHosts(): Set<string> {
  return new Set(
    (process.env.RAAHI_TEST_AUTH_ALLOWED_HOSTS || '')
      .split(',')
      .map((host) => normalizeHost(host))
      .filter(Boolean)
  );
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
  // Deliberately return 404 so production does not advertise that a test-auth
  // endpoint exists.
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const forwardedHost = normalizeHost(request.headers.get('x-forwarded-host'));
  const directHost = normalizeHost(request.headers.get('host'));
  const host = forwardedHost || directHost;
  const allowedHosts = parseAllowedHosts();

  if (
    process.env.RAAHI_TEST_AUTH_ENABLED !== 'true' ||
    !host ||
    HARD_BLOCKED_HOSTS.has(host) ||
    !allowedHosts.has(host)
  ) {
    return disabled();
  }

  const configuredKey = process.env.RAAHI_TEST_AUTH_KEY || '';
  const suppliedKey = request.headers.get('x-raahi-test-key') || '';
  if (!configuredKey || !suppliedKey || !safeEqual(configuredKey, suppliedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let persona: string;
  try {
    const body = (await request.json()) as { persona?: unknown };
    persona = typeof body.persona === 'string' ? body.persona : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  let personas: PersonaMap;
  try {
    personas = parsePersonas();
  } catch {
    return NextResponse.json({ error: 'Test auth is misconfigured' }, { status: 503 });
  }

  const target = personas[persona];
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

  // Verify the generated token through the normal Supabase Auth surface. The
  // SSR client writes the same authenticated cookies used by the real app.
  const supabase = await createServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });

  if (verifyError) {
    return NextResponse.json({ error: 'Could not establish test session' }, { status: 500 });
  }

  const redirectTo = target.role === 'admin'
    ? '/admin-panel'
    : target.role === 'driver'
      ? '/driver-route-selection'
      : '/';

  return NextResponse.json({ success: true, persona, role: target.role, redirectTo });
}
