import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | undefined;
let refreshRateLimited = false;
let staleSessionCleanupScheduled = false;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isRefreshRequest(url: string): boolean {
  return url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token');
}

function invalidRefreshResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Refresh token is invalid or expired',
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function scheduleStaleSessionCleanup(): void {
  if (staleSessionCleanupScheduled) return;
  staleSessionCleanupScheduled = true;

  // createBrowserClient can issue its first refresh before browserClient has
  // been assigned. Run cleanup in the next task so the singleton is available.
  setTimeout(() => {
    const client = browserClient;
    if (!client) return;

    client.auth.stopAutoRefresh();
    void client.auth.signOut({ scope: 'local' }).catch(() => {
      // The important part is stopping the retry storm. A subsequent explicit
      // sign-in will replace any stale local session material.
    });
  }, 0);
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
            const url = requestUrl(input);
            const refreshRequest = isRefreshRequest(url);

            // Once this page has hit the Auth refresh-token rate limit, never
            // send another refresh request from the same stale session. Return
            // a non-retryable auth error so supabase-js exits its retry loop.
            if (refreshRateLimited && refreshRequest) {
              return invalidRefreshResponse();
            }

            const response = await fetch(input, init);

            if (response.status === 429 && refreshRequest) {
              refreshRateLimited = true;
              scheduleStaleSessionCleanup();
              return invalidRefreshResponse();
            }

            return response;
          },
        },
      }
    );
  }

  return browserClient;
}
