# Raahi V2 Handover

Updated: 2026-08-23
Project: **Raahi 2.0 only** — do not mix with Raahi School.
Branch: `v2.0-beta1`
PR: #68 — draft, open, unmerged.
Implementation checkpoint: `636ce21e3e08e67e0efb3f7ff4a0564f34eb85b7` (`fix: pipeline directional dispatch at trip start`).
CI: Validate Raahi Mini #299 — **SUCCESS** on the implementation checkpoint.

## Working model

The user does not have Codex credits. The assistant must operate as both:
- **Project Owner / Manager** — preserve product intent, prioritize, maintain release gates, identify risk, and keep the Bible/handover current.
- **Implementer / Builder** — inspect and edit code, migrations, UI, tests, validation and documentation directly.

Take work end-to-end whenever it is secure to do so. Escalate only for explicit production/merge approval, credentials, billable resources, or a genuinely unresolved product/business choice.

## Canonical product rules changed on 2026-08-23

1. Dispatch is **direction-specific and pipelined**. `Start Trip` is the handoff point.
2. For Gomoh → Dhanbad: Driver 1 `ACTIVE_COLLECTING` → presses Start Trip → Driver 1 `IN_PROGRESS` + next FIFO driver immediately `ACTIVE_COLLECTING` for the next car.
3. Dhanbad → Gomoh operates independently under the same rule. Opposite directions never block each other.
4. Only one `ACTIVE_COLLECTING` driver may exist per one-way route; FIFO stays strict within that route.
5. Trip completion is terminal bookkeeping, not the dispatch handoff.
6. Return-demand strength is hidden before departure. After Start Trip, the active driver may see only **Low / Medium / High** for the reverse direction.
7. Return-demand is advisory only and can never alter FIFO, queue position, activation, booking, seats, fare or trip lifecycle.
## Live proof completed in isolated Raahi V2 Dev

Migration `20260823071332_v2_rc1_pipelined_dispatch.sql` is applied to Raahi V2 Dev.

Observed sequence:
- GD Driver 1 was `ACTIVE_COLLECTING #1`; Pipeline Driver 3 was `WAITING #2`.
- Driver 1 Start Trip moved Driver 1 to `IN_PROGRESS` and immediately activated Driver 3 with a new collecting trip.
- DG remained independently `ACTIVE_COLLECTING` throughout.
- Pipeline Driver 4 joined as `WAITING #3`.
- Completing Driver 1 left Driver 3 active and Driver 4 waiting — no completion-time handoff occurred.
- Driver 3 Start Trip then immediately activated Driver 4.
- The return-demand RPC returned `has_signal: false` before Start Trip and `Low` after Start Trip.
- Synthetic GD test trips were closed through canonical lifecycle commands; no synthetic live GD queue/trip/GPS state remained afterward.

## Validation at this checkpoint

- 17 business/safety contract files: PASS locally on Windows.
- TypeScript `tsc --noEmit`: PASS.
- Production Next.js build: PASS on the exact implementation patch using isolated V2 Dev environment variables; the temporary env file was removed afterward.
- Supabase new-function grants verified: anon cannot execute Start/Complete/return-demand; `activate_next_driver` remains service-role-only.
- Supabase security advisor still reports the known RPC-only RLS/no-policy and SECURITY DEFINER warnings already documented in release-readiness; no new unauthenticated execution grant was introduced.
- Test-auth contract was made line-ending independent so the security guard passes on Windows and Linux.

## Major Raahi 2.0 capabilities already built/proven

Visual exact-seat booking, passenger journey status, demand activation/recovery, wait tolerance, driver current-route economics, Admin route health, structured support, active-trip GPS, Share My Raahi, recent-route reuse, driver daily summary, cancellation/no-show invariant audit, staging-target safety and backend security/invariant guards.
## Remaining release gates

1. Wait for GitHub Validate Raahi Mini #299 on implementation head `636ce21...` and resolve any failure before moving on.
2. Headed browser acceptance for demand recovery: `I need a ride` → leave page → supply appears → Home recovery card → explicit Book Seat.
3. Headed wait-tolerance acceptance including persistence after navigation/reload.
4. Final responsive authenticated Passenger / Driver / Admin sweep, including post-start Low/Medium/High return-demand display.
5. Clean-room migration replay on an isolated release-candidate database. Creating a new Supabase branch/project is billable and requires explicit user approval.
6. Guaranteed non-production staging E2E and rollback rehearsal.
7. Explicit user approval before merging PR #68, creating V2 Production, configuring production secrets, running production migrations or deploying production.

## Single next action

Resume headed browser acceptance on Dipti, starting with the passenger demand-recovery scenario, then the post-start driver return-demand UI and responsive role sweep.

## Hard boundaries

Do not touch Raahi School. Do not merge PR #68 or deploy production without explicit approval. Do not touch production-linked/historical Supabase. Do not weaken authentication or expose server secrets. Demand, urgency, economics, GPS, support and sharing features must never mutate FIFO/seat/trip state outside canonical commands.
