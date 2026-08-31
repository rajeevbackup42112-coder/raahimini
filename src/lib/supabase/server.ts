import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ROCKET_PREVIEW_URL = 'https://placeholder.supabase.co';
const ROCKET_PREVIEW_KEY = 'rocket-preview-placeholder';

function getSupabasePublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ROCKET_PREVIEW_KEY
  );
}

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ROCKET_PREVIEW_URL;

  return createServerClient(url, getSupabasePublicKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              sameSite: 'none',
              secure: true,
            })
          );
        } catch {
          // Server Component read-only context — expected
        }
      },
    },
  });
}
