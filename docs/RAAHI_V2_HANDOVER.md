# Raahi V2 Handover

Updated: 2026-08-24 12:12 IST
Project: **Raahi 2.0 only — do not mix with Raahi School.**
Repository: `rajeevbackup42112-coder/raahimini`
Branch: `v2.0-beta1`
PR: **#68 — draft, open, unmerged**
Committed documentation head before this handover refresh: `04920b8`
Latest validated implementation checkpoint: `636ce21` — `fix: pipeline directional dispatch at trip start`
CI: **Validate Raahi Mini #299 SUCCESS** on the validated implementation line.

## Executive status

Raahi 2.0 is in **pre-RC1 hardening**. The major launch experience is built; current work is release confidence rather than broad feature construction.

The product now materially delivers the V2 objectives: passenger certainty, driver economics, Admin exception-first operations, active-trip privacy/GPS, loved-one visibility, repeat-use convenience and safer release discipline while preserving the proven V1/V10 engine.

The mobile-first simplification pass is now validated. Do **not** start another redesign pass; preserve the simplified hierarchy and close the remaining release-infrastructure gates.

## Canonical working model

The assistant acts as both Project Owner/Manager and Implementer/Builder. Work end-to-end when safe. Stop only for credentials/auth boundaries, billable resources, genuinely unresolved product choices, destructive/security-sensitive changes, or explicit production/merge approval.

## Major capabilities built and proven

- Unified login, trusted role routing, visible display identity and progressive profile completion.
- Passenger Home and unified journey/status experience.
- Exact numbered seat selection backed by the authoritative `trip_seats` ledger; deliberate Seat 3 hold/confirmation/My Ride display proven.
- No-driver demand intent remains separate from booking.
- Persistent demand recovery is implemented: Raahi remembers the request and can surface `A Raahi car is available`; explicit booking is still required.
- Passenger wait tolerance and urgency projection are implemented as advisory demand metadata.
- Driver current-route economics, fare/full-car context and demand guidance.
- Direction-specific pipelined FIFO dispatch: **Start Trip is the same-direction handoff**; opposite directions operate independently.
- Post-start-only reverse demand signal: **Low / Medium / High**, advisory only.
- Admin route-health-first dashboard, exceptions and structured support inbox/resolve flow.
- Structured Passenger/Driver Help that does not silently mutate trips.
- Active-trip-only GPS, Start Trip location gate, truthful fallback and automatic terminal cleanup.
- Share My Raahi one-trip secure link, anonymous read-only loved-one view, revoke behavior and up-to-30-minute successful-arrival visibility.
- My Raahi recent-route / Ride Again shortcut with no auto-booking.
- Driver daily summary based on completed trips/fare records.
- Current cancellation/no-show/Admin queue paths audited against V10 seat/FIFO/trip invariants.
- Staging-target safety guards, auth ingress/role-boundary contracts, RLS/RPC privilege checks and live invariant sweeps.

## Validation already green

- 17 business/safety contract files: PASS.
- TypeScript `tsc --noEmit`: PASS.
- Production Next.js build: PASS against isolated V2 Dev configuration.
- Mobile demand recovery: PASS through real driver lifecycle and explicit `Book Seat`.
- Wait tolerance 15/30/60: PASS through leave/reload persistence.
- Responsive authenticated sweep: 10/10 PASS across Passenger, Driver and Admin at 360/390/412px widths.
- Validate Raahi Mini #299: SUCCESS.
- Live pipelined-dispatch proof in isolated Raahi V2 Dev passed for same-direction handoff and opposite-direction independence.
- RLS/RPC privilege and live invariant sweep passed for current V2 additions.
- Exact-seat, support, GPS, Share My Raahi, terminal GPS cleanup, recent-route reuse and core passenger/driver/admin lifecycle acceptance have all been exercised successfully.

## Remaining release gates — do these next

1. **Clean-room migration replay:** replay canonical migrations from empty/disposable isolated RC database. Creating a new Supabase branch/project is billable and requires explicit user approval.
2. **Guaranteed non-production staging E2E:** target must positively attest isolated V2 backend before tests start.
3. **Rollback rehearsal on staging:** application rollback + forward-only database recovery procedure.
4. **Explicit user production approval:** only then merge PR #68, create V2 Production, configure secrets, migrate, deploy and tag.

## Local Dipti state

Canonical checkout: `C:\Users\Dipti\RaahiV2Current`

The branch currently matches `origin/v2.0-beta1`, but the working tree contains **local validation-only auth harness edits and helper scripts** (`next-env.d.ts`, test-auth/auth callback/middleware/contracts plus local patch/run helpers). These are not canonical product changes and must not be casually committed. Inspect before cleaning or switching worktrees.

## Single next action

The next unresolved RC gate is the clean-room migration replay, which requires explicit approval because creating a fresh Supabase branch/project is billable. Until that approval, preserve the validated mobile-first package and do not merge or deploy it.

## Hard boundaries

- Do not touch Raahi School.
- Do not merge PR #68 without explicit approval.
- Do not create V2 Production, configure production secrets, run production migrations, deploy production or tag `v2.0.0` without explicit approval.
- Do not touch V1 production or historical/production-linked Supabase during V2 work.
- Do not weaken authentication/test-auth safety to make browser tests pass.
- Demand, urgency, return-demand, economics, support, GPS and sharing must never bypass canonical booking/seat/FIFO/trip commands.
- Never force-push over newer work.

## New-chat bootstrap

> This is **Raahi 2.0 / raahimini**, not Raahi School. Read `docs/RAAHI_V2_HANDOVER.md`, `docs/RAAHI_V2_DECISIONS.md`, `docs/RAAHI_V2_BIBLE.md`, `docs/RAAHI_V2_BUILD_MATRIX.md`, and `docs/RAAHI_V2_RELEASE_READINESS.md`. Verify GitHub and the isolated V2 Dev environment before acting. Resume from the single next action. Work autonomously; stop only for credentials, billable infrastructure, a genuinely new product decision, destructive/security-sensitive action, or production/merge approval.
