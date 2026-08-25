# Raahi V2 — Environment Strategy

Status: adopted for V2 development and RC hardening

## Canonical ownership

GitHub remains the source of truth for application code, migrations, tests, release notes and immutable release tags. Environment separation is handled through Git refs, deployment environments and independent Supabase projects.

## Supabase

Environment intent:

1. `Raahi V2 Dev` — current isolated development/test backend.
2. `Raahi V2 Prod` — reserved for production and must not be created until the release candidate is green and explicit production approval is given.

Production must be created from the same canonical GitHub migration history, never by manually copying the development database. Dev and Prod credentials must never be shared.

A disposable development branch/project may be used for clean-room migration replay, but creating a billable Supabase branch requires explicit cost acknowledgement first.

## Hosting

No hosting provider is currently privileged as the Raahi V2 staging target.

A deployment may be used for RC staging only when its non-production semantics are explicit and machine-verifiable. A project or URL containing the word `staging` is not sufficient proof.

Required mapping:

- verified development / staging deployment -> `Raahi V2 Dev` Supabase only;
- future production deployment -> `Raahi V2 Prod` Supabase only.

Before staging E2E starts, `/api/staging-safety` must positively attest that the running app is test-enabled on an allowed staging host and points to the isolated V2 Dev Supabase project.

Generic deployment actions that do not expose a reliable preview/non-production selector must not be used as Raahi staging automation.

## Secrets

Environment-specific values stay outside Git:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or legacy anon key when needed
- server-only Supabase service-role key when explicitly needed
- OAuth/client secrets
- test-auth secrets

`.env.example` contains placeholders only.

Test auth is staging-only, disabled by default, host-allowlisted and hard-blocked on known production hosts.

## Release discipline

`feature branch -> CI -> isolated dev backend -> browser/invariant tests -> verified non-production staging -> release candidate -> rollback rehearsal -> production approval -> production migration -> production deployment -> immutable tag`

Production deployment always requires explicit user approval.

## Rollback

Frontend/application rollback uses the last known-good compatible Git commit or immutable hosting deployment. Operational database history is forward-only by default: database defects are repaired with reviewed forward migrations rather than restoring an older snapshot over newer passenger/driver journey data.

See `RAAHI_V2_ROLLBACK_RUNBOOK.md` for the full RC procedure.

## 2026-08-25 Rocket environment update

The user has now designated Rocket hosting roles explicitly:
- `myraahi-stage.referralhub.co.in` = active Stage for new work.
- `myraahi.referralhub.co.in` = frozen Rocket Version 4 baseline.

Because the existing Rocket bootstrap workaround tracks public Supabase client values in `.env`, the staging branch intentionally tracks only public V2 client configuration plus `NEXT_PUBLIC_SITE_URL=https://myraahi-stage.referralhub.co.in` and `RAAHI_TEST_AUTH_ENABLED=false`. Never add service-role or test-auth secrets to the tracked file.

Frontend hostname separation alone is not backend isolation. Before applying any Stage-only operational migration, verify that Stage does not share the same Supabase operational database as frozen Version 4. If it does share, stop and obtain explicit approval or provision a separately approved Stage backend first.

## Production train override — 2026-08-25

The user has explicitly selected incremental production versions on `https://myraahi.referralhub.co.in` instead of requiring a separate Stage deployment for the current simplification sequence. Version 4 is the application rollback baseline; subsequent versions are promoted directly one at a time with focused live acceptance.

This does not weaken security boundaries: production remains hard-blocked from test-auth, GitHub remains canonical, database migrations are forward-only, and each version requires a clean operational preflight before state-machine changes are applied.
