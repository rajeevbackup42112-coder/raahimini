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

## 2026-08-25 manual-acceptance product decisions

36. **Driver vehicle type is controlled data.** Admin Driver Onboarding uses a dropdown rather than free text. Current allowed UI values: Car, Hatchback, Sedan, SUV, MPV, Van.
37. **Driver seat capacity supports 4, 5, 6, 7 or 8 seats.** The Admin UI, client typing and canonical `admin_onboard_driver` backend validation must agree on this range.
38. **Passenger and Driver experiences will be simplified around one question: what happens next?** Technical state names, redundant status cards and internal queue/trip mechanics should remain hidden unless needed for recovery or support.
39. **Driver operational stops are action stops, not every route stop.** The Driver should normally see only stops where a passenger must be picked up or dropped off; intermediate route stops remain authoritative route data but should not create manual taps.
40. **Manual Start Trip is targeted for removal from the Driver workflow.** Once the manifest is closed, required pickups are complete and GPS is usable, Raahi should transition automatically into the travelling/drop-off phase. Until that refactor is implemented and regression-tested, the existing Start Trip RPC remains authoritative.
41. **Passenger live location must be a real map experience.** The current text-only live-location status is insufficient; active passengers should see the driver's plotted location, freshness/staleness and pickup/destination context, with route/stop progress as fallback.
42. **Admin owns operational complexity.** Admin should have Dashboard, Users, Routes and Operations surfaces. Passenger and Driver should remain intentionally minimal.
43. **Admin Users is the primary identity-management surface.** Admin can search/filter registered users, inspect profile/phone/role/operational state and invoke guarded role actions such as Driver onboarding from the user's detail view.
44. **Admin Route Management is full-control but guarded.** Admin may create/edit/duplicate/activate/deactivate/archive routes, add/edit/remove/reorder stops and handle emergencies, but destructive changes must not rewrite active-trip or historical route state. Versioning/future-effective changes are preferred.
45. **Acceptance discoveries may reopen release gates.** Previously green UI acceptance does not grandfather behavior after an approved workflow change; affected Passenger, Driver and Admin flows must be re-run after implementation.

## 2026-08-25 stage / Prod V4 split

46. **Prod V4 is frozen while simplification work proceeds.** `https://myraahi.referralhub.co.in` remains the known-good Version 4 deployment and is not to be modified during the stage refactor.
47. **Rocket Stage is now `https://myraahi-stage.referralhub.co.in`.** New application changes target the stage deployment first; the tracked Rocket bootstrap `NEXT_PUBLIC_SITE_URL` on the staging branch must point to this hostname.
48. **Do not apply stage backend migrations to a backend shared by Prod V4.** The current stage code still references Raahi V2 Dev. Until Stage has backend isolation, or the user explicitly approves shared-backend impact, new operational-state migrations remain committed in Git but unapplied.
49. **Operational-stop progression is backend-owned.** The planned contract moves a collecting Driver only to the next unresolved passenger pickup, allows in-progress progression directly to the route destination, and requires boarding confirmation at the actual pickup stop. FIFO, seat ledger, GPS and canonical trip transitions remain authoritative.

## 2026-08-25 production version train — supersedes the temporary Stage/Prod split

50. **User explicitly approved incremental production evolution.** The temporary freeze/isolate-stage plan in decisions 46–48 is superseded. Raahi will now move one numbered production version at a time on `https://myraahi.referralhub.co.in`, with acceptance between versions.
51. **Version 4 remains the rollback baseline.** Git branch `prod-v4-frozen` points at the application baseline before Version 5. Production database changes remain forward-only; rollback means compatible app rollback plus a reviewed forward database repair if required.
52. **Version 5 scope is deliberately narrow.** Driver progression changes from every route stop to the next unresolved passenger pickup while collecting, then the route destination after Start Trip. Manual Start Trip remains in Version 5 so FIFO/GPS handoff is changed separately in Version 6.
53. **Production test-auth must fail closed.** `myraahi.referralhub.co.in` is hard-blocked from staging/test-auth endpoints regardless of environment allowlists.
54. **Every production version is gated.** Code/build/contracts, database preflight, migration, deployment and live acceptance are recorded separately; a later version does not proceed until the current version is understood.
55. **Passenger and Driver share one operational truth.** Before pickup, Passenger may see pickup progress. Once the passenger is confirmed/boarded and the trip is `IN_PROGRESS`, Passenger must stop showing intermediate route-stop progression and instead show the same next meaningful event as Driver: the trip destination. Role copy may differ, but route state must not disagree.


## 2026-08-27 V6 validation and Admin implementation plan

61. **V6 supersedes the partial V5 Passenger patch.** The primary Passenger journey no longer exposes stop-by-stop Driver Progress; it uses Requested → Confirmed → On the way → Arrived and the same destination truth as Driver after Start Trip.
62. **V7 is now Automatic Start Trip.** Version numbering moved because the live V5 Passenger mismatch required its own accepted production increment first.
63. **Admin primary navigation will converge on Dashboard · Users · Routes · Operations.** Existing specialist pages may be reused internally but should no longer define the main information architecture.
64. **Registered Users gets a dedicated guarded read projection.** Do not overload `admin_list_role_accounts()`, which intentionally excludes Drivers for Admin-role management.
65. **Structural route edits require versioning/future-effective publishing.** Existing `seat_requests` and trips reference current route/stop rows, so stop deletion/reordering must never rewrite live or historical meaning in place.
66. **Admin complexity remains bounded by canonical commands.** Full control means audited recovery/configuration powers, not raw seat ownership mutation, FIFO bypass, phone-verification bypass or GPS fabrication. See `RAAHI_V2_ADMIN_CONTROL_PLAN.md`.

## 2026-08-27 V7 automatic departure decisions

67. **V7 automatic departure reuses canonical `start_trip`.** Do not duplicate the trip transition in client code or create a second dispatch pathway; the existing RPC remains the sole FIFO/GPS-protected boundary.
68. **Close Empty Seats remains explicit.** Closing unused capacity is a Driver manifest decision; automatic departure occurs only after the manifest becomes departure-eligible.
69. **Manual Start Trip UI is removed in V7.** Once departure eligibility and usable GPS are simultaneously true, the client invokes the canonical transition automatically and exactly once per trip attempt.
70. **UI GPS readiness expires before backend freshness.** The client clears pre-departure readiness at 50 seconds while `start_trip` independently rejects fixes older than 60 seconds or worse than 200m accuracy.
71. **Complete Trip remains manual in V7.** Automatic completion is a separate lifecycle slice and must not be bundled into the departure change.
72. **V6 production bundle was verified before V7.** The deployed Passenger bundle contains Requested / On the way / You are aboard / destination-focused behavior and no legacy Driver Progress string; paired authenticated visual acceptance was not separately captured before the user directed the train to continue.


## 2026-08-27 V8 Passenger live map decisions

73. **V8 uses the existing authorized live-location projection.** No new GPS write path or broader read permission is introduced; the map consumes `get_active_trip_location()` only while the passenger trip is `IN_PROGRESS`.
74. **The V8 map uses a keyless OpenStreetMap embed, not a billable map API.** Exact coordinates are sent only to the map provider when the authenticated Passenger has already been authorized to read that active trip location; the embed uses `referrerPolicy="no-referrer"`.
75. **Freshness is explicit.** Backend `is_fresh` remains the truth (45-second window). Fresh fixes are labeled live, older coordinates are labeled last known, and no-coordinate state shows an unavailable fallback rather than fabricating movement.
76. **The active Passenger journey becomes map-first.** During `IN_PROGRESS`, redundant confirmation and standalone destination cards are suppressed; the map card carries live driver position plus boarded-at and destination context. No V8 database migration is required.

## 2026-08-27 V9 Admin Dashboard + Registered Users decisions

77. **V8 is the application rollback baseline before Admin restructuring.** `prod-v8-frozen` points at `3222802dcec1caa79140ff76b51b41e6d8e3914d`.
78. **V9 primary Admin navigation is Dashboard · Users · Routes · Operations.** Legacy specialist views may remain behind those sections, but they no longer define Admin Home.
79. **All-user identity is exposed only through a dedicated admin-only projection.** `admin_list_registered_users()` may join `auth.users` for email and authoritative `phone_confirmed_at`, but execute permission remains authenticated-only and the function rejects non-admin callers.
80. **Admin Dashboard summary and recent activity are read-only.** Counts and audit projections must not mutate rides or become a second operational command path.
81. **Driver onboarding remains canonical.** Users → Make Driver deep-links the selected profile into the existing `admin_onboard_driver` flow; V9 does not duplicate onboarding logic.
82. **V9 is additive during live operations.** One live trip/queue entry does not block the read-only migration; no seat, trip, queue, GPS, phone verification or historical route row is modified.


## 2026-08-27 V10 Route Management decisions

83. **Structural route edits never mutate the published route in place.** Admin edits an inactive/non-current DRAFT row with its own route_stops.
84. **Publish is future-effective and server-gated.** A current route cannot be superseded while it has an ACTIVE_COLLECTING/IN_PROGRESS trip, WAITING/ACTIVE_COLLECTING Driver queue entry, or ACTIVE passenger demand intent.
85. **Historical route meaning is immutable.** Publishing archives the old route row and preserves its route_stops; historical trips/seat requests continue to reference those exact rows.
86. **Only one current published version exists per route family and one current published route may own a route code.** Draft/history rows do not become public route options.
87. **Drafts are invisible to transport users.** DRAFT implies `is_current=false` and `is_active=false`; normal route discovery still requires active routes.
88. **Route deletion is draft-only.** Unpublished drafts may be discarded; published routes use Archive rather than destructive delete.
89. **Repeat-use shortcuts follow the current version.** Completed-trip display remains historical, while `Ride this route again` uses `repeat_route_id` resolved to the current active published member of that route family.
90. **V10 does not redefine the ride engine.** `start_trip`, `activate_next_driver`, `join_driver_queue`, `request_seats`, seat ownership, GPS and phone verification remain canonical and unchanged.

## 2026-08-27 V10 live acceptance + V11 Operations decisions

91. **V10 draft isolation is production-proven.** Editing a draft does not alter the current published route or a live trip; server-side Publish remains blocked while live trip/queue/demand exists.
92. **V11 Operations is observation-first.** Live trip state, GPS health, queues and support are consolidated before recovery controls.
93. **V11 adds no new emergency mutation primitive.** Queue reorder/remove, Driver deactivation, support resolution and Route controls reuse existing audited RPCs; raw seat/FIFO/GPS/phone/active-Driver mutation remains forbidden.
94. **Admin GPS health is descriptive.** V11 mirrors fresh/stale/poor/missing location truth and Driver next-action state without writing GPS or trip lifecycle state.
95. **Admin account access belongs in the header/Profile.** Dashboard · Users · Routes · Operations remains the complete primary operational navigation.

## 2026-08-27 V11 Operations live decisions

91. **V11 Operations is the canonical Admin intervention surface.** Live trips, GPS health, FIFO queues, support and guarded Driver recovery are consolidated under Operations.
92. **V11 adds observation, not a second ride engine.** `admin_get_live_trip_operations()` is read-only/Admin-only; existing guarded queue, support, Driver and Route RPCs remain the only mutations exposed.
93. **Unsafe emergency powers remain intentionally absent.** Admin cannot rewrite seat ownership, replace an active-trip Driver, bypass FIFO, edit verified-phone truth or fabricate GPS.
94. **V11 is production-accepted and frozen.** `prod-v11-frozen` points to `66c543e865d2998c5bf3c066b56f81acb19ffa87`.

## 2026-08-27 V12 automatic completion decisions

96. **Destination arrival remains explicit.** V12 does not infer arrival from GPS; the Driver still records arrival through the existing destination progression action.
97. **Completion reuses canonical `complete_trip`.** The client automatically invokes the existing command only after backend next-action truth becomes `COMPLETE_TRIP`; no second terminal pathway is introduced.
98. **Manual Complete Trip UI is removed.** The final Driver decision is Arrived at destination, not a redundant second confirmation.
99. **Automatic completion is attempt-guarded.** The client makes one automatic completion attempt per trip state and offers only a retry if canonical finalization fails.
100. **V12 is application-only.** Final-stop authorization, queue DONE, accounting, behaviour/audit events, GPS cleanup and share expiry remain backend-owned and unchanged.

## 2026-08-28 V13 pre-go-live hardening decisions

101. **A protected Admin tree must not render Admin chrome before authorization resolves.** `/admin-panel` is gated as a whole; anonymous and non-Admin users do not receive Dashboard/Users/Routes/Operations UI.
102. **Role authorization waits for profile truth.** Initial/sign-in loading remains active until the authenticated profile row resolves, preventing transient false Passenger/Driver/Admin denial screens.
103. **Expired demand is not operational demand.** Route Publish/Archive blockers and Admin route counts require `status='ACTIVE'` and `latest_at >= now()`; stale status alone must never freeze future route configuration.
104. **V13 is a hardening-only release.** It does not change seat ownership, FIFO, GPS, Start Trip, Complete Trip, phone verification, route history or any ride lifecycle command.

## 2026-08-28 V14 auth hydration decisions

101. **Do not await Supabase-backed profile work inside `onAuthStateChange`.** The auth event callback must return synchronously; profile hydration is deferred before awaiting database work.
102. **Protected role screens remain loading until profile truth resolves.** Avoid transient false denials without holding the Supabase auth event lock.
103. **V14 is application-only.** V13 database hardening remains applied; no ride-engine, FIFO, seat, GPS, phone-verification or route semantics are changed.

## 2026-08-28 final release decision

101. **V14 is the accepted launch source.** `prod-v14-frozen` preserves `38b7519d615e171c59d537b18a61c1ba303c132f` after full headed production acceptance.
102. **Real-user acceptance closes the historical evidence gaps that were exercised in the final ride.** The final session proved automatic departure with usable real browser GPS, Passenger live/stale/recovered map behavior, paired Passenger/Driver lifecycle truth, FIFO handoff and automatic completion.
103. **GO-LIVE requires a clean operational state.** Final acceptance ended with zero live trips, live queues, HELD requests, current ACTIVE demand, open support cases, route drafts and live GPS rows.
104. **Launch support must preserve canonical boundaries.** No launch-day shortcut may bypass FIFO, GPS truth, seat ownership, verified-phone state or backend lifecycle commands.
