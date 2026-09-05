# Raahi Next — Build Status

**Checkpoint date:** 2026-09-05
**Stage:** Foundation 1 bootstrap

## PASS

- Clean Next.js 16.3.3 / React 19.2.8 application created.
- Runtime isolated on port 4029.
- Frozen Architecture, UML, Experience and Target Domain documents copied as authority.
- Build Blueprint v1 written.
- Capability-based identity domain contract created.
- Market / Location / Corridor / Service Product migration drafted.
- Driver / Vehicle / Verification / Home + Operating Market migration drafted.
- Permission + Scope Admin and shared Commitment migration drafted.
- Deterministic Gomoh + Dhanbad seed created.
- Static schema contracts created.
- pgTAP Foundation security contract created.
- TypeScript: PASS.
- ESLint: PASS.
- Vitest: 12/12 PASS.
- Next.js production build: PASS.

## BLOCKED — not waived

Real Postgres migration replay is not yet proven because Dipti currently has neither Docker nor Podman available to Supabase CLI.
A clean Raahi Next cloud Supabase project also has not been created because project creation requires explicit organization/cost confirmation.

Until database replay, pgTAP, RLS behavior, concurrency checks and Supabase advisors pass, Foundation 1 is **not** marked complete.

## Next executable gate

1. Create/connect the dedicated Raahi Next Dev Supabase project.
2. Replay all clean migrations + seed from zero.
3. Run pgTAP security tests.
4. Add command-level tests for Operating Market verification and commitment conflicts.
5. Run security + performance advisors.
6. Only then begin Fixed One Way supply/demand tables and matcher.

## Gate 0 local hardening — 2026-09-05

Completed without touching any legacy Raahi environment:
- First clean Git checkpoint created: `cfa9aca foundation: bootstrap raahi next architecture`.
- Added command idempotency persistence contract.
- Replaced mutable Product rules with immutable Product rule versions + current version pointer.
- Added active Vehicle → Driver Vehicle access FK and revocation guards.
- Documented `profiles.phone` as a non-authoritative convenience copy; verified phone truth remains trusted Auth/verification state.
- Added canonical server command envelope/result types.
- Updated pgTAP Foundation security contract for final schema shape.
- Added CI app gate using Node 24 + `npm ci` + `npm run check`.
- Local application gate after hardening: TypeScript PASS, ESLint PASS, Vitest 18/18 PASS, production build PASS.

Still blocked, not waived:
- real Postgres migration replay;
- pgTAP execution against Postgres;
- RLS behavior tests with real actors;
- commitment concurrency tests against Postgres;
- generated database types;
- Supabase advisors.

Those require a runnable Postgres/Supabase environment. Dipti still has no Docker/Podman, so the next practical Gate 0 step is a dedicated Raahi Next Dev Supabase project.
