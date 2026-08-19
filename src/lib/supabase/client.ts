import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | undefined;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function createClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        // OAuth codes are exchanged once by the canonical server callback.
        auth: {
          detectSessionInUrl: false,
        },
        global: {
          fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
            const response = await fetch(input, init);
            const url = requestUrl(input);

            // A stale/revoked refresh token can make supabase-js retry refreshes
            // indefinitely. Once Auth has rate-limited a refresh, stop the
            // background refresher for this page instead of flooding /auth/v1/token.
            // A fresh OAuth sign-in or page load will establish a clean session.
            if (
              response.status === 429 &&
              url.includes('/auth/v1/token') &&
              url.includes('grant_type=refresh_token')
            ) {
              browserClient?.auth.stopAutoRefresh();
            }

            return response;
          },
        },
      }
    );
  }

  return browserClient;
}
