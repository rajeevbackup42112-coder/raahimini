# Raahi Next — Slice 12 Acceptance — 2026-09-07

## Scope

Slice 12 implements **Travel Intent + Emerging Corridor Intelligence** inside Wave 7.

Frozen ownership preserved:
- Travel Intent is Passenger demand evidence, not a Booking, Ride, seat hold or Driver commitment.
- Emerging Corridor Opportunity is aggregate Market evidence, not a Corridor/Product launch.
- Passenger identity, phone and journey history are absent from the Market opportunity projection.
- Human Market/State review may move evidence to `UNDER_EVALUATION`; it cannot autonomously create mobility supply.
- Local Offers remain outside this slice so sponsored commerce does not influence mobility ranking.

## Live migrations

1. `20260907044832_slice12_travel_intent_market_signals`
   - 22,511 bytes
   - MD5 `1c1c9d471a0e5ef6319bac812e347596`
2. `20260907045301_slice12_market_opportunity_projection_fix`
   - 2,642 bytes
   - MD5 `56e80d13ced06b0887e3d4c4f02d6456`
3. `20260907051630_slice12_fk_index_hardening`
   - 235 bytes
   - MD5 `98f9e6e1a82569ceafc67953789d2c72`

## Database acceptance

Rollback-only acceptance proved:
- original create + idempotent retry + duplicate create under a new key produced one ACTIVE Travel Intent and one corridor opportunity;
- Ride and Mobility Commitment counts were unchanged;
- Gomoh → Birsa Munda Airport, Ranchi aggregate evidence returned 2 intents, 5 seats, 1 notification-interest request, 1 desired departure in the next 7 days and 2 in the next 30 days;
- Dhanbad Market Admin attempting Gomoh intelligence was rejected with `ADMIN_SCOPE_REQUIRED`;
- Gomoh Market Admin moved the evidence to `UNDER_EVALUATION` and wrote exactly one audit fact;
- Corridor, Product, Ride and Commitment counts remained unchanged after review.

The first opportunity projection contained a runtime defect: `desired_next_30d` returned `latest_intent_at`. This was corrected forward-only in `20260907045301`; the already-live migration was not edited or replayed.

The post-DDL performance advisor found two unindexed Slice 12 origin-location foreign keys. `20260907051630` added both covering indexes; the follow-up advisor reported no unindexed-FK findings.

## Application surfaces

Passenger:
- `/go` preserves existing Fixed, Carpool, Outstation and Trips discovery.
- A gap can be recorded with “Can’t find the right ride? Tell Raahi you want to go.”
- Copy explicitly states that Travel Intent does not book a ride, hold a seat or create a Driver commitment.
- Notification interest is opt-in and separate from operational ride notifications.
- `/interests` lets the Passenger inspect, cancel and change notification preference on their own intents.
Admin:
- `/admin` is scoped to authorized Market/State/Platform operations.
- Dashboard question is “Where should this Market grow next?”
- Evidence is aggregate only: intent count, seat demand, next-7-day demand, next-30-day demand and notification-interest count.
- `Review opportunity` starts human evaluation only; the UI explicitly states that review does not create a Corridor, Product, booking or Driver commitment.

All Slice 12 material API writes use canonical RPCs only:
- `create_travel_intent`
- `cancel_travel_intent`
- `update_intent_notification_preference`
- `admin_begin_emerging_corridor_review`

No Slice 12 API route performs direct `.from(...).insert/update/delete` mutation.

## Real HTTP acceptance

Synthetic Passenger `slice12-passenger@raahi.test`:
- `/go` returned HTTP 200 with Travel Intent CTA.
- Create returned intent `8bcf9820-42fa-4fc7-a3e5-ed53592f9f14`, `status=ACTIVE`, `seat_count=2`, `creates_booking=false`.
- `/interests` rendered the journey and “not a booking” ownership copy.
- Notification preference changed to true through the canonical API.
- Passenger then cancelled the intent successfully.
Synthetic Admin acceptance:
- Gomoh Market Admin login redirected to `/admin`; Gomoh → Ranchi Airport aggregate evidence rendered.
- Dhanbad Market Admin saw no Gomoh opportunity (`cross_leak=false`).
- Headed Gomoh Admin started review on opportunity `6d4cea25-b9bd-46c3-a30c-ceb08366cecb`; status became `UNDER_EVALUATION`.

## Headed Chrome acceptance

A real installed Chrome session driven through Puppeteer proved:
- Passenger `/go`: CTA and “does not book a ride” copy visible.
- Passenger saved a Travel Intent through visible UI and `/interests` showed it ACTIVE.
- Passenger cancelled through visible UI and `/interests` showed it CANCELLED.
- Gomoh Admin saw the aggregate route and privacy copy and started review through the visible button.
- Dhanbad Admin did not see the Gomoh route.
- No page error or Next.js hydration/runtime error was captured.
- One console 404 was `/favicon.ico`; it is an unrelated cosmetic asset request, not an application/API failure. A temporary `icon.svg` experiment caused a Next dev 500 and was removed immediately; the server returned to HTTP 200 and no icon file is part of Slice 12.

Headed Passenger intent `89c865fa-82a6-42e1-a3b4-dd801824e249` and all other Slice 12 synthetic intents/opportunities were deleted after acceptance. Final Dev check returned 0 Slice 12 test intents and 0 Slice 12 test opportunities.

## Final gate

- Slice 12 contracts: **24/24 PASS**.
- Full Vitest suite: **198/198 PASS across 17 files**.
- TypeScript: PASS.
- ESLint: PASS.
- Production Next.js build: PASS.
- Build manifest contains `/admin`, `/interests`, all Travel Intent APIs and Admin review API.
- Supabase security advisor: only the existing project-level leaked-password-protection warning.
- Supabase performance advisor after FK hardening: no unindexed-FK findings; remaining notices are unused-index INFO on Dev.

Security warning reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Scope integrity

- No reset/clean was used.
- No live migration was replayed or rewritten.
- Test acceptance did not leave synthetic corridor evidence behind.
- Raahi School / SchoolTransportOS and port 4030 were not touched.
- Next executable slice is **Local Offers**, kept separate from mobility ranking and Passenger identity.
