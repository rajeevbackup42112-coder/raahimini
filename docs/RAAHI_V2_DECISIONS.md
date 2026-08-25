# Raahi V2 Decision Log

Updated: 2026-08-24
Scope: **Raahi 2.0 only — never mix with Raahi School.**

This file records product and engineering decisions that future chats must treat as intentional unless the user explicitly changes them.

## Product decisions

1. **V2 is an evolution, not a rewrite.** Preserve the proven V1/V10 engine and improve certainty, trust, economics, usability and operations around it.
2. **One public login.** Passenger, Driver and Admin use one normal public entry point; trusted backend role determines routing.
3. **Progressive identity.** Browsing stays light; verified phone/profile requirements appear only when an action genuinely needs them.
4. **Exact seat selection is real state.** The numbered seat selected in UI must be the exact seat held/confirmed in PostgreSQL.
5. **Demand intent is not a booking.** `I need a ride`, urgency, notifications and recovery may surface supply but may never create or reserve a seat.
6. **Passengers must explicitly book.** When supply appears, Raahi restores the ordinary booking flow; it never auto-books.
7. **Repeat-use shortcuts may remember, never transact.** My Raahi / Ride Again can restore route and preference context but cannot silently book.
8. **Driver economics are core V2 value.** Show fare/full-car context and useful demand guidance without turning economics into dispatch logic.
9. **Admin is exception-first.** Admin Home should answer `Is Raahi operating normally?`; detailed tables remain secondary.
10. **Support is separate from operations.** Filing a support case never silently cancels, rebooks, reorders or changes a trip.
## Dispatch and demand decisions

11. **Dispatch is directional and pipelined.** Each one-way route has its own FIFO pipeline.
12. **Start Trip is the dispatch handoff.** When Driver 1 starts a trip, the next same-direction FIFO driver may immediately become `ACTIVE_COLLECTING` for the next car.
13. **Trip completion is terminal bookkeeping, not queue handoff.** Completion must not activate another same-direction collector if the next collector was already activated at Start Trip.
14. **Opposite directions are independent.** Gomoh → Dhanbad activity must never block Dhanbad → Gomoh, and vice versa.
15. **One active collector per one-way route.** FIFO remains strict inside that route.
16. **Return demand is hidden before departure.** After Start Trip, the active driver may see only a coarse reverse-direction `Low / Medium / High` signal.
17. **Return demand is advisory only.** It cannot alter FIFO, queue position, driver activation, matching, booking, seats, fare or trip lifecycle.
18. **Wait tolerance is advisory only.** A passenger's 15/30/60-minute tolerance may drive urgency messaging but never dispatch priority.

## GPS, privacy and sharing decisions

19. **GPS is active-trip-only.** Location is not required merely to log in, choose a route or wait in queue.
20. **Start Trip requires a usable current fix.** This is the safety/privacy boundary for beginning live tracking.
21. **Temporary GPS loss must not strand a live trip.** Passenger UI falls back to route/stop progress and truthful stale/unavailable language.
22. **Tracking stops automatically at terminal trip state.** Live GPS is deleted/ended when the trip completes or is cancelled.
23. **Share My Raahi is one-trip, read-only, revocable and expiring.** Plaintext share tokens are not stored; phone numbers and booking history are not exposed.
24. **Successful arrival has a short visibility window.** A shared trip may remain viewable for up to 30 minutes after arrival so a loved one can see that the passenger arrived.

## Architecture, release and scope decisions

25. **PostgreSQL/Supabase is authoritative operational state.** Frontend remains thin; canonical RPCs own business transitions.
26. **Realtime is invalidation/refetch only.** It is never a second source of truth.
27. **V2 Dev is isolated.** V1 production/historical Supabase stays untouched until explicit V2 production approval.
28. **GitHub is canonical for code and migrations.** No hosting-side manual source edits.
29. **Production database is forward-only by default.** Repair schema/data defects with reviewed forward migrations rather than destructive restores or ad-hoc rewrites.
30. **No automatic production action.** PR #68 merge, V2 Production creation, production secrets, production migrations, production deployment and the `v2.0.0` tag all require explicit user approval.
31. **Billable clean-room infrastructure requires approval.** A new Supabase branch/project must not be created without explicit cost authorization.
32. **Staging must fail closed.** Automated staging E2E may run only against a positively attested non-production target using isolated V2 credentials.
33. **Stretch features cannot delay transport reliability.** Loved-one notifications, family labels, extended insights, promotions and voting remain optional until launch gates are green.
34. **Do not rush wallets, mandatory online payments, surge pricing, opaque AI dispatch, heavy ads or complex ratings.** Add only with proven operational/business need.
35. **Mobile-first simplicity is a release principle.** Passenger and Driver screens should foreground one current state and one dominant next action; secondary operational detail should be progressively disclosed. Mobile/touch acceptance is primary, while Admin may retain richer desktop views.

## Handover decision rule

Future chats must start from `RAAHI_V2_HANDOVER.md`, then consult this Decision Log, the Bible, Build Matrix and Release Readiness before editing code. If code, documentation and memory disagree, verify GitHub and isolated V2 Dev state and update the documents rather than guessing.
