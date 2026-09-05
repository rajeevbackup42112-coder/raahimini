# Raahi Next — Build Blueprint v1

**Status:** Frozen implementation baseline
**Date:** 2026-09-05
**Product:** Clean launch candidate for Raahi 2.0
**Runtime port:** 4029

## 1. Purpose

Raahi Next is a clean implementation of the frozen Raahi 2.0 company, marketplace, UML, experience and domain contracts.

The old Raahi codebase is a reference system, not a dependency. Reuse is allowed only when a component or idea survives the new architecture unchanged.

Build doctrine:
- Build one Raahi platform with many Market contexts.
- Keep business state server-authoritative.
- Keep commands separate from projections.
- Make all marketplace mutations idempotent and auditable.
- Use one cross-service Driver/Vehicle commitment authority.
- Keep Passenger search location flexible; verify Driver Operating Market.
- Prefer configuration over city-specific code.
- Ship complete vertical slices, not partially rebuilt feature collections.

## 2. Technical baseline

- Next.js 16.3.3 Active LTS, App Router.
- React 19.2.x.
- TypeScript strict mode.
- Tailwind CSS 4.
- Supabase Postgres/Auth/Storage/Realtime.
- Supabase cookie-based SSR clients via `@supabase/ssr`.
- Node.js runtime by default; Edge only for a proven need.
- npm lockfile is authoritative.

## 3. Repository architecture

```text
src/
  app/                    # route composition only
  features/               # passenger, driver, admin feature modules
  domain/                 # pure domain types, rules, state machines
  server/                 # commands, projections, auth, policy adapters
  components/             # shared product UI
  lib/                    # framework/infrastructure utilities
supabase/
  migrations/             # clean migration history
  seed/                   # deterministic non-production seed fixtures
tests/
  contracts/              # P0/P1 business invariant tests
  concurrency/            # atomicity/race tests
  e2e/                    # browser journeys
  fixtures/               # scenario builders
docs/                     # frozen architecture and build records
```

Rules:
- `app/` never owns marketplace rules.
- `features/` may orchestrate UI but cannot mutate database tables directly.
- `domain/` contains no Next.js or Supabase imports.
- `server/commands` is the only application mutation boundary.
- `server/projections` returns privacy-scoped read models.
- Browser clients never receive service-role credentials.
- Raw verification documents never flow through consumer projections.

## 4. Environment model

Environments are physically separate:
- Local/unit development.
- Raahi Next Dev Supabase project.
- Staging / hosted acceptance.
- Production only after release gate.

The existing Raahi V2 Dev database is reference-only for Raahi Next and must not be repurposed.

## 5. Foundation 1 — mandatory domain

Foundation 1 is complete only when these concepts exist as first-class server-authoritative objects:

### Identity
- User/Profile
- Account Capability: PASSENGER, DRIVER, ADMIN
- Driver Profile
- Vehicle
- Verification / Standing

### Geography and operations
- Market
- Market Membership / Admin Scope
- Location
- Corridor
- Service Product
- Product Feature Switch

### Driver supply context
- Driver Home Market
- Driver Current Operating Market
- Operating Market verification event
- Driver Service Preference
- Driver Product Availability

### Marketplace integrity
- Mobility Commitment
- Audit Event
- Rule Configuration

Gomoh and Dhanbad must both exist in deterministic seed data from the first Foundation acceptance run, even if only Gomoh products are enabled.

## 6. Market rule

A Market is an operating boundary, not necessarily a legal municipality.

Customer-facing examples may be `Raahi Gomoh` or `Raahi Dhanbad`; the database models `Market` so nearby areas can later be reorganized without code changes.

Every journey has one Origin Market.
Passenger-selected origin determines the Market context for discovery.
Driver supply eligibility uses verified Current Operating Market, not Home Market.

## 7. Command and projection boundary

Mutations are commands. Reads are projections.

Examples of commands:
- grant capability
- set Driver Home Market
- set / verify Operating Market
- opt into a Service Product
- join or leave Driver availability
- create Passenger request
- run Fixed matcher
- accept Outstation agreement
- create or release Mobility Commitment

Every command must:
1. authenticate the actor;
2. authorize capability and scope;
3. validate current authoritative state;
4. execute atomically;
5. write business events/audit where material;
6. return the resulting authoritative state.

Consumer reads use scoped projections, not unrestricted table reads.

## 8. Security baseline

- RLS enabled on every exposed table.
- Authorization never depends on user-editable metadata.
- Admin authority = permission + scope, never a single unrestricted `admin` flag.
- SECURITY DEFINER is exceptional and must have explicit caller checks, fixed search path and restricted EXECUTE grants.
- Exact phone, live location and verification evidence are progressively revealed only when operationally necessary.
- Market Admin cannot dispatch, reorder FIFO, rewrite agreed fare or mark another user's payment declaration.
- Audit records are append-oriented and never edited to hide history.

## 9. Testing gates

Every implementation checkpoint runs:
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

Database waves additionally require migration replay, RLS tests, concurrency tests and Supabase security/performance advisors before acceptance.

## 10. Build sequence

### Wave 1 — Foundation
Identity capabilities, Markets, Locations, Corridors, Service Products, Home/Operating Market, Driver preferences, Admin scopes, commitment ledger.

### Wave 2 — Fixed One Way
Passenger demand queue, Driver supply queue, compatible batching, atomic match, Ride/Booking/Event creation, trust reveal, approach, arrival, boarding, completion, payment acknowledgement and support.

### Wave 3 — Fixed Round Trip
Two-leg commitment, reserved return capacity, destination wait, return reminders and return-failure handling.

### Wave 4 — Outstation
Private request, eligible leads, versioned quote/agreement, atomic passenger acceptance, shared commitment guard, reopen after Driver cancellation and common fulfilment/payment.

### Wave 5 — Carpool
Driver-owned personal journey, spare-seat booking and re-consent for material changes.

### Wave 6 — Raahi Trips / Explore
Published leisure journey, threshold confirmation, booking, two-leg fulfilment and discovery surfaces.

### Wave 7 — Local Offers + Market Intelligence
Contextual sponsored services, Travel Intent aggregation, emerging corridor review, Market dashboards and state portfolio operations.

## 11. Release doctrine

For each product: Add → contract-test → concurrency-test → security-test → canary Market → manual acceptance → enable → observe → expand.

No live object is migrated mid-journey between engines. Feature switches are product/Market scoped.

The first investor/launch candidate is not reached by feature count. It is reached when one complete vertical is beautiful, reliable, auditable and explainable end to end.

## 12. First acceptance target

Gomoh → Dhanbad Fixed One Way is the first complete vertical.
Dhanbad exists simultaneously as a real Market so reverse-origin and Driver Operating Market rules are proven from the beginning.

P0 acceptance includes: no assignment below clearing policy, hidden identities pre-match, fair FIFO, group atomicity, one-winner atomic commitment, verified Driver/Vehicle, GPS arrival guard, no-show handling, direct-payment truth language, issue Case separation and stale-client idempotency.
