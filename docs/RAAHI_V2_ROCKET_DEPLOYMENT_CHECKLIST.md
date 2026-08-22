# Raahi V2 — Rocket Deployment Checklist

Purpose: keep Rocket as deployment/hosting while GitHub remains canonical and Supabase remains authoritative backend state.

## Development / staging deployment

Configure Rocket with environment-specific values only:

- `NEXT_PUBLIC_SUPABASE_URL` -> Raahi V2 Dev URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` -> Raahi V2 Dev publishable key
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> optional legacy fallback only
- `SUPABASE_SERVICE_ROLE_KEY` -> server-only and only when a dedicated test-auth workflow genuinely requires it
- `RAAHI_TEST_AUTH_ENABLED=false` by default

Do not place service-role keys in browser/public variables.

## Production deployment

Create and configure only after release-candidate approval:

- `NEXT_PUBLIC_SUPABASE_URL` -> Raahi V2 Prod URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` -> Raahi V2 Prod publishable key
- no Dev project credentials
- production OAuth callback URLs only
- test-auth disabled

## Git mapping

Recommended:

- feature branches -> CI only
- release candidate / staging Git ref -> Rocket staging deployment
- immutable release tag -> Rocket production deployment

Rocket must not become the canonical code store. Any Rocket-side code change must be committed back to GitHub before it is accepted.

## Pre-deploy checks

1. CI type-check and production build are green.
2. Correct Supabase project ref is documented for the target environment.
3. No service-role key is exposed to browser variables.
4. Database migrations for that release are already tested on Dev.
5. Browser smoke/E2E is green on non-production.
6. OAuth callback/domain configuration is validated.
7. Rollback target is known.

## Production approval gate

Do not deploy to production or create the production Supabase project merely because staging is working. Production deployment remains an explicit approval action after the release candidate passes the full release gate.
