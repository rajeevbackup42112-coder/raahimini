import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | undefined;

const ROCKET_PREVIEW_URL = 'https://placeholder.supabase.co';
const ROCKET_PREVIEW_KEY = 'rocket-preview-placeholder';

function getSupabasePublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ROCKET_PREVIEW_KEY
  );
}

export function createClient(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ROCKET_PREVIEW_URL;

    browserClient = createBrowserClient(url, getSupabasePublicKey(), {
      // OAuth codes are exchanged once by the canonical server callback.
      auth: {
        detectSessionInUrl: false,
      },
    });
  }

  return browserClient;
}
