# Raahi Next — Slice 13 Acceptance — 2026-09-07

## Scope

Slice 13 completes **Local Offers**, the sponsored-commerce half of Wave 7.

Frozen ownership preserved:
- Businesses buy contextual visibility, not traveller identity or private journey history.
- Sponsored Offers are rendered separately from Ways to Go and never modify mobility ranking, allocation, matching, quotes, verification, Ride, Booking, Commitment or payment truth.
- Business/Offer administration is scoped through the existing `LOCAL_COMMERCE` Admin permission.
- Offer content approval and sponsorship status are separate authorities; both plus current schedule eligibility are required before Passenger visibility.
- Merchant/Admin analytics are aggregate daily impression/engagement facts only.

## Live migrations

1. `20260907054558_slice13_local_offers_schema`
   - 7,076 bytes
   - MD5 `b7c75eb781d671392257ac01a7ba6e2b`
2. `20260907054834_slice13_local_offers_commands`
   - 26,832 bytes
   - MD5 `d3c0a54febdf72c4c954124e95e03620`
3. `20260907054937_slice13_local_offers_projections_metrics`
   - 11,437 bytes
   - MD5 `f04b0e16da1358f9cbbbda5f11bee65a`

All three local migration files were reconstructed from Raahi Next Dev cloud history and matched the cloud byte length and MD5 exactly.
## Database acceptance

Rollback-only commerce acceptance proved:
- a scoped Commerce operator could create Business + Market scope, draft an Offer, activate sponsorship, submit, begin review and approve;
- correct Gomoh → Ranchi Airport context returned exactly one sponsored Offer;
- wrong destination returned zero;
- pause hid the Offer, resume restored it and remove hid it permanently;
- aggregate metrics became exactly 1 impression / 1 engagement;
- mobility counts stayed fixed at 12 Rides / 17 Ride Bookings / 12 Mobility Commitments throughout;
- the rollback transaction left no merchant fixture behind.

Direct-client table access remains denied for Businesses, Market scopes, Offers, Offer events and daily metrics. All foreign keys were indexed in the initial schema migration; post-DDL performance advisor reported no unindexed-FK finding.

## Application surfaces

Passenger:
- `/go` renders a distinct **Useful around this journey · Sponsored** section after mobility choices.
- Sponsored copy explicitly states that Offers are separate from Ways to Go and never change ride ranking or allocation.
- `/offers` is the dedicated browse surface.
- Journey-targeted Offers require matching origin/destination context; generic Market browse does not broaden them into unrelated journeys.
- Every reusable Offer card is labelled Sponsored and can record aggregate impression/engagement metrics only.

Commerce Admin:
- `/admin/businesses` is scoped to `LOCAL_COMMERCE` / Platform Admin authority.
- Operators can create Business identity, draft contextual Offers, set sponsorship, submit, review, approve/reject, pause/resume and remove.
- Workspace displays aggregate impressions/engagements only and explicitly excludes Passenger names, phones and private journey history.
## Real HTTP acceptance

Synthetic Gomoh Commerce operator created Business `da12cc64-1f9f-44d3-abc4-8013c0813e7c` and Offer `c99c5170-65c9-4b0c-913a-e5b0189d4c79` through real 4029 APIs.

- Dhanbad Commerce attempting Gomoh Business creation returned HTTP 403 `LOCAL_COMMERCE_SCOPE_REQUIRED`.
- Draft → sponsorship ACTIVE → SUBMITTED → UNDER_REVIEW → APPROVED all succeeded.
- Passenger Gomoh → Birsa Munda Airport, Ranchi `/go` rendered the sponsored Offer and ranking-separation copy.
- Context-aware `/offers` rendered it; generic Market browse correctly excluded the journey-targeted Offer.
- Passenger recorded one IMPRESSION and one ENGAGEMENT through the canonical metric API.
- Admin workspace rendered the Business/Offer with aggregate counts and privacy copy.
- Real PAUSE hid the Offer, RESUME restored it and REMOVE hid it permanently.
- Final first-fixture audit evidence: 8 immutable Offer events and 6 Offer audit events; mobility remained 12 Rides / 17 Ride Bookings / 12 Commitments.

A second approved fixture, Business `c8193ec0-fc0d-4eac-8e0b-fd0a6d727243` / Offer `2a3e1e90-4c81-480e-8c40-5771a3e3eb52`, was created solely for the final visible Chrome pass.

## Headed Chrome acceptance

Visible installed Chrome proved:
- `/go`: sponsored section, Offer and ranking-separation copy visible;
- context-aware `/offers`: sponsored browse copy and Offer visible;
- `/admin/businesses`: Local Offers workspace, synthetic Business/Offer and Passenger-privacy copy visible;
- no page errors;
- no Next.js runtime/hydration error dialog;
- no application/API 404 response.

One console 404 was identified exactly as `/favicon.ico`; it is unrelated cosmetic browser noise. Final screenshots are archived under `docs/archive/evidence/slice13/`.
## Cleanup and final gate

Both synthetic merchant fixtures were deleted after acceptance. Temporary `LOCAL_COMMERCE` scopes added only to the synthetic Gomoh/Dhanbad Test Mode Admins were also removed.

Final cleanup verification:
- 0 final test Offers;
- 0 final test Businesses;
- 0 temporary Commerce scopes;
- mobility unchanged at 12 Rides / 17 Ride Bookings / 12 Mobility Commitments.

Final engineering gate:
- Slice 13 contracts: **20/20 PASS**.
- Full Vitest suite: **218/218 PASS across 18 files**.
- TypeScript: PASS.
- ESLint: PASS.
- Production Next.js build: PASS.
- Build manifest contains `/offers`, `/admin/businesses`, `/api/offers/metric`, `/api/admin/local-commerce/business` and `/api/admin/local-commerce/offer`.
- Supabase security advisor: only the existing leaked-password-protection warning.
- Supabase performance advisor: no unindexed-FK finding; remaining notices are unused-index INFO on Dev.

Security warning reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Scope integrity

- No reset/clean was used.
- No live migration was replayed or rewritten.
- Passenger Offers and commerce analytics have no authority over mobility ranking or Passenger identity.
- Raahi School / SchoolTransportOS and port 4030 were not touched.
- Slice 13 completes the frozen product waves. The next unit is **Staging Readiness / Release Candidate hardening**, not another product slice.