# Raahi V2 — Rocket Deployment Checklist (Deferred / Historical)

Status: **not an approved Raahi V2 staging or production path.**

This file is retained only to document the earlier Rocket hosting option. The current RC1 release rule is defined in `RAAHI_V2_RELEASE_READINESS.md` and takes precedence over this document.

## Why this path is deferred

Raahi staging must be demonstrably non-production before any authenticated E2E is allowed to run. Earlier Rocket staging experiments did not provide a sufficiently strong machine-verifiable separation between preview/staging and production semantics.

Therefore:

- do not create or publish a Rocket staging deployment from this checklist;
- do not configure Raahi V2 production credentials in Rocket;
- do not use an old `builtwithrocket.new` URL as a fallback staging target;
- do not assume a deployment is safe merely because its project/name contains `staging`;
- do not enable Raahi test auth until the exact hostname and isolated V2 backend are positively verified.

## Current staging requirements

Any future hosting provider may be used only if all of these are true:

1. The deployment is explicitly and provably non-production.
2. It uses the isolated Raahi V2 Dev Supabase project, never V1/legacy/production credentials.
3. `RAAHI_TEST_AUTH_ALLOWED_HOSTS` contains only the exact staging hostname.
4. `/api/staging-safety` returns `safe: true` and the expected V2 Dev project ref.
5. The GitHub staging E2E workflow validates that attestation before Playwright starts.
6. The hosting workflow cannot silently promote the same deployment to production.
7. GitHub remains the canonical code source.

## Environment rules

For a verified non-production deployment only:

- `NEXT_PUBLIC_SUPABASE_URL` -> Raahi V2 Dev URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` -> Raahi V2 Dev publishable key
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> optional legacy fallback only
- `SUPABASE_SERVICE_ROLE_KEY` -> server-only and only when staging test auth genuinely requires it
- `RAAHI_TEST_AUTH_ENABLED` -> false by default; true only on the exact verified staging host

Never place a service-role key in browser/public variables.

## Production remains separately blocked

Production must not be created or deployed from this document. Production requires the full release-readiness gate, clean-room migration replay, verified staging E2E, rollback rehearsal, and explicit production approval.

Until those gates are complete, Rocket should be treated as **deferred**, not as Raahi V2's deployment plan.

## 2026-08-25 superseding Rocket decision

This historical status is superseded by the user's explicit hosting decision. Rocket is now the active Raahi V2 hosting path for the current manual-acceptance phase, with strict separation by deployment role:
- Stage: `myraahi-stage.referralhub.co.in`
- Frozen baseline: `myraahi.referralhub.co.in` Rocket Version 4

The safety principles above still apply. In particular, a different hostname does not prove a different database. Do not apply Stage-only operational migrations until the Stage backend is isolated from the frozen Version 4 backend, or the user explicitly approves shared-backend impact. GitHub remains canonical; do not make source edits only inside Rocket.

## 2026-08-25 production-train override

The user has now explicitly selected Rocket for controlled production versioning on `https://myraahi.referralhub.co.in`. The earlier "deferred" wording above is historical. For the current work, Rocket production deployments are allowed only as explicit numbered versions, with the prior version retained for application rollback and with GitHub remaining the canonical source.

Production test-auth remains disabled and the production hostname is hard-blocked in code. Database migrations remain forward-only and must be preflighted before each version.
