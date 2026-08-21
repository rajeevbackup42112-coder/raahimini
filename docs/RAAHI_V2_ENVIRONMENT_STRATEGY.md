# Raahi V2 — Environment Strategy

Status: adopted for V2 development

## Canonical ownership

GitHub remains the source of truth for application code, migrations, tests, release notes and immutable release tags. A separate GitHub login is not required for isolation; environment separation is handled through branches, deployment environments and independent Supabase projects.

## Supabase

Use the two active free-project slots as:

1. `Raahi V2 Dev` — current isolated development/test backend.
2. `Raahi V2 Prod` — reserved for release-candidate/production only and should not be created until the release candidate is green.

Production must be created from the same GitHub migration history, never by manually copying the development database. Dev and Prod credentials must never be shared.

## Hosting

Rocket is the preferred frontend hosting/deployment target while its version/deployment model remains suitable for Raahi. GitHub remains canonical; Rocket should deploy from Git refs rather than becoming the source of code.

Target deployment mapping:

- development / test deployment -> `Raahi V2 Dev` Supabase
- production deployment -> `Raahi V2 Prod` Supabase

No frontend deployment may point to the wrong Supabase environment.

## Secrets

Environment-specific values stay outside Git:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or current publishable key
- server-only Supabase service-role key when explicitly needed
- OAuth/client secrets
- test-auth secrets

`.env.example` contains placeholders only.

## Release discipline

`feature branch -> CI -> isolated dev backend -> browser/invariant tests -> release candidate -> production approval -> production migration -> production deployment -> immutable tag`

Production deployment always requires explicit user approval.

## Rollback

Frontend rollback uses the last known-good immutable Git tag / hosting version. Database migrations must be additive or have an explicitly reviewed recovery plan before production application.
