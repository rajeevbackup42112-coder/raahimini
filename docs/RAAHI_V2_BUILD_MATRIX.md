# Raahi V2 Scope & Build Matrix

Status: Beta1 implementation active; isolated V2 dev backend established
Branch: `v2.0-beta1`
Source of truth: `docs/RAAHI_V2_BIBLE.md`

## Governing rule

Raahi V2 is an evolution of the proven V1 engine, not a rewrite.

**V1 business invariants remain unchanged unless a V2 requirement explicitly needs a new rule and that rule is approved, isolated, and tested.**

## Environment strategy

Raahi V2 uses an isolated two-environment model:

- **Development:** Supabase project `Raahi V2 Dev`; all migrations, SQL invariants, browser acceptance and pre-release validation happen here first.
- **Production:** a second Supabase project will be created later from the same migration history only when the V2 release candidate is green and production deployment is approved.
- **Source control:** GitHub remains the canonical source of truth for application code, migrations and release tags. Environment isolation should be done with repositories/branches and credentials, not by fragmenting history unnecessarily across unrelated identities.
- **Hosting:** Rocket is the preferred deployment host while it provides staging/production separation, version history/rollback and custom-domain deployment without a separate hosting-credit burden. Hosting must consume environment-specific Supabase credentials; dev credentials must never be used by production.
- **Production V1:** the current Version-10 production system stays untouched until explicit V2 production GO.

## Locked V1 invariants

1. PostgreSQL remains authoritative operational state.
2. Frontend does not directly mutate core operational tables.
3. One canonical backend command/RPC owns each business transition.
4. Matching owns passenger-to-driver allocation.
5. Driver FIFO remains authoritative unless an explicitly approved deterministic rule changes it.
6. `driver_queue` owns origin FIFO/availability state.
7. `trips` own journey lifecycle.
8. Seat capacity cannot be exceeded under concurrent actions.
9. Cancellation/no-show releases seats exactly once and cannot corrupt another trip.
10. Origin queue advancement must not block later drivers while an earlier trip is already in progress.
11. Multiple simultaneous trips on the same corridor remain isolated.
12. Realtime is invalidation/refetch, never a second source of truth.
13. Core V1 booking/queue/trip behavior is regression-tested before and after every V2 milestone.

## Classification

- **V2.0 Launch** — required before production V2.
- **V2.0 Stretch** — valuable but may slip if launch reliability would be delayed.
- **Post-V2** — explicitly deferred.
- **Existing V1** — preserve; do not rebuild.
- **Modify V1 carefully** — touches a proven V1 flow and therefore requires invariant/regression testing.

## Build matrix

| Capability | Classification | Target release | Frontend impact | Backend / data impact | V1 risk | Required tests |
|---|---|---|---|---|---|---|
| Preserve booking / queue / trip engine | Existing V1 | all | no redesign of business behavior | no semantic rewrite | Critical | full passenger, driver, admin regression |
| One public login entry point | V2.0 Launch | alpha1 | login/header/profile routing | role resolution only | Medium | passenger/driver/admin role routing, logout/login |
| Visible logged-in identity | V2.0 Launch | alpha1 | greeting/profile chip | profile projection | Low | auth refresh, role display |
| Raahi display name / nickname | V2.0 Launch | alpha1 | profile editor + display everywhere | add/normalize `display_name`; canonical update RPC | Low | create/update/read, fallback behavior |
| Shallow profile menu | V2.0 Launch | alpha1 | profile, support, logout, role | profile read/update RPCs | Low | role boundary, validation |
| Progressive profile completion | V2.0 Launch | alpha1 | ask only when action requires data | validation by action/RPC | Medium | browse without completion; booking/driver requirements |
| Green V2 design system | V2.0 Launch | alpha1 | global tokens/components | none | Low | visual smoke, responsive |
| Passenger Home redesign | V2.0 Launch | alpha2 | action-first live route card | existing projections preferred | Medium | no booking-state regression |
| Driver Home redesign | V2.0 Launch | alpha2 | one operational card / next action | existing driver/trip projections preferred | High | all driver lifecycle actions |
| Unified trip/status card | V2.0 Launch | alpha2 | passenger/driver/admin shared visual model | read projection only where possible | Medium | status consistency by role |
| Plain-language status copy | V2.0 Launch | alpha2 | replace internal terminology | none | Low | state-to-copy mapping |
| Loading/empty/error states | V2.0 Launch | alpha2 | stable UX | none | Low | slow/error/offline smoke |
| BookMyShow seat UI refinement | Modify V1 carefully | alpha2 | clearer seat states/actions | no booking semantics change | High | hold/confirm/cancel/concurrency |
| Route health indicator | V2.0 Launch | alpha2 | good/limited/no-driver | projection/derived read | Low | threshold correctness |
| My Raahi / repeat-user shortcuts | V2.0 Stretch | alpha2 | recent route, booking, Book Again | lightweight preference/read state | Low | no auto-book, stale-state handling |
| Zero-fee / clear-fare trust messaging | V2.0 Launch | alpha2 | home, booking, driver fare | none | Low | fare copy matches actual fare |
| Driver/passenger trust cards | V2.0 Launch | alpha2 | name, vehicle, seats, pickup | projection fields | Low | privacy/role visibility |
| Structured help / mismatch reasons | V2.0 Stretch | beta1 | one-tap support categories | support event/record RPC | Low | create/read/admin visibility |
| No-driver demand intent | V2.0 Launch | beta1 | “I need a ride” state | new demand-intent records + RPCs | Medium | must not create booking/queue state |
| Demand aggregation | V2.0 Launch | beta1 | passenger/driver/admin counts | aggregate demand projection | Medium | dedupe, expiry, concurrency |
| Wait-tolerance / urgency | V2.0 Stretch | beta1 | optional wait window | demand-intent field/RPC | Low | expiry/validation |
| Driver demand notifications | V2.0 Launch | beta1 | notification CTA: Go Available | notification events, rate limits | Medium | eligible drivers only, anti-spam |
| Admin unserved-demand alert | V2.0 Launch | beta1 | route exception card | demand projection/event | Low | aggregation accuracy |
| Demand activation loop | V2.0 Launch | beta1 | waiting state updates when supply appears | transition from demand intent to normal booking availability only | High | no fake booking; no duplicate activation |
| Return-demand visibility | V2.0 Launch | beta1 | return-demand card on driver home | route-direction demand projection | Medium | no FIFO/dispatch mutation |
| Return fill likelihood | V2.0 Stretch | beta1 | simple Low/Good/High signal | deterministic derived metric | Low | deterministic thresholds |
| Driver daily summary | V2.0 Stretch | rc1 | trips, passengers, earnings, fill/return | aggregate reads | Low | totals/isolation/date ranges |
| Scheduled travel intent | V2.0 Stretch | rc1 | future time-window intent | new intent records/RPCs | Low | no auto-book; expiry |
| Live GPS prerequisite at Start Trip | V2.0 Launch | beta2 | permission/fix gate | start-trip command validates usable location context | High | location on/off/no-fix; trip not stranded later |
| Active-trip location updates | V2.0 Launch | beta2 | live map/progress | temporary trip-location state + secure update RPC | Medium | active trip only; stop after complete |
| GPS graceful fallback | V2.0 Launch | beta2 | “temporarily unavailable” + route progress | last-known location / freshness | Low | signal loss and recovery |
| Share My Raahi token | V2.0 Launch | beta2 | share action | scoped, revocable, expiring token | Medium | expiry, revoke, cross-trip isolation |
| Loved-one tracking page | V2.0 Launch | beta2 | read-only trip view | secure token-based projection | Medium | no auth required; no mutation; privacy |
| Loved-one start/arrival notifications | V2.0 Stretch | rc1 | opt-in controls | notification subscriptions/events | Low | opt-in/out and trip scoping |
| Family / multi-seat labels | V2.0 Stretch | rc1 | Me/Wife/Child/Parent labels | booking metadata only | Medium | seat count semantics unchanged |
| Admin operations board | V2.0 Launch | rc1 | route cards instead of table-first | operational projections | Medium | reflects authoritative state |
| Admin exception inbox | V2.0 Launch | rc1 | only actionable exceptions | derived exception events/projections | Medium | no direct core-table mutation |
| Raahi Insights core metrics | V2.0 Stretch | rc1 | admin analytics | event/aggregate model | Low | metric correctness/privacy |
| Demand heat/time-of-day | V2.0 Stretch | rc1 | simple time-band view | aggregates | Low | date/timezone correctness |
| Local Offers | V2.0 Stretch | rc1 | dedicated non-intrusive area | promotions table + CRUD/RPC + expiry | Low | start/end dates, no live-trip interruption |
| Sponsored transparency message | V2.0 Stretch | rc1 | “helps keep Raahi free” | none | Low | copy/placement |
| Idea voting / Help Shape Raahi | V2.0 Stretch | rc1 | Yes/Maybe/No + optional comment | poll/vote RPCs | Low | one-user vote rules, aggregation |
| Complex wallet/payments | Post-V2 | post-v2 | none | none | — | — |
| Surge pricing | Post-V2 | post-v2 | none | none | — | — |
| Complex ratings/reputation | Post-V2 | post-v2 | none | none | — | — |
| AI/opaque dispatch | Post-V2 | post-v2 | none | none | Critical if introduced | — |
| Heavy ad marketplace | Post-V2 | post-v2 | none | none | — | — |

## Milestones

### v2.0-alpha1 — Identity + unified login + design tokens
Exit criteria:
- one public login path;
- correct automatic role routing;
- logged-in display name visible;
- nickname editable through canonical backend command;
- V2 green design tokens applied consistently to the shared design system;
- profile/logout flow stable;
- V1 passenger/driver/admin smoke suite remains green.

### v2.0-alpha2 — Core UI redesign
Exit criteria:
- Passenger Home, Driver Home, and Live Trip/Booking Status redesigned;
- unified trip card/state language;
- seat booking semantics unchanged;
- no V1 journey regression.

### v2.0-beta1 — Demand activation + return logic
Exit criteria:
- demand intent is explicitly separate from booking;
- no-driver state creates aggregated demand safely;
- eligible driver/admin notifications are rate-limited;
- supply appearing re-enables normal booking flow;
- return-demand visibility is read-only with respect to FIFO/matching.

### v2.0-beta2 — GPS + loved-one tracking
Exit criteria:
- usable GPS is required only to start an active trip;
- tracking runs only during active trip state;
- temporary GPS loss does not strand the trip;
- share link is read-only, scoped, revocable and expiring;
- trip completion ends active tracking.

### v2.0-rc1 — Admin/supporting features
Exit criteria:
- admin operations board and exception inbox;
- driver summary/insights where ready;
- promotions and polls only if transport reliability is already green;
- complete regression + staging E2E.

### v2.0.0 — Production
Exit criteria:
- release checklist complete;
- staging smoke suite green;
- database invariant suite green;
- rollback path verified;
- production approval;
- immutable release tag created.

## Release discipline

For every milestone:

`branch → build → automated tests → isolated dev → staging → smoke/E2E → production approval → tag`

No milestone may trade ride reliability for UI polish, ads, polls, or analytics.

## Immediate next implementation task

Continue Beta1 on the isolated V2 dev backend by replaying the remaining frozen V10 migrations, validating production-parity invariants, and then running browser acceptance against the dev Supabase project. Do not create the V2 production Supabase project until the release candidate is green and production deployment is explicitly approved.
