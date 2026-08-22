# Raahi V2 Beta1 — SQL Acceptance Matrix

Purpose: define the backend acceptance tests before any demand migration is applied to an isolated database.

## Identity and authorization

| ID | Scenario | Expected |
|---|---|---|
| DMD-01 | anonymous caller creates NOW intent | rejected |
| DMD-02 | authenticated passenger creates NOW intent for active route | success |
| DMD-03 | driver/admin attempts passenger self-service intent | rejected unless explicitly using a separate admin command |
| DMD-04 | passenger cancels another passenger's intent | rejected |
| DMD-05 | passenger cancels own active intent | success |
| DMD-06 | passenger cancels same intent again | idempotent success / already inactive |

## NOW intent lifecycle

| ID | Scenario | Expected |
|---|---|---|
| DMD-10 | create NOW with 30-minute wait | one ACTIVE row |
| DMD-11 | repeat equivalent NOW request | same/equivalent intent returned; no duplicate active row |
| DMD-12 | wait tolerance below allowed minimum | rejected |
| DMD-13 | wait tolerance above allowed maximum | rejected |
| DMD-14 | stale NOW intent reaches expiry | status EXPIRED |
| DMD-15 | route becomes inactive | new intent rejected; existing handling deterministic |

## Scheduled intent lifecycle

| ID | Scenario | Expected |
|---|---|---|
| DMD-20 | future earliest/latest window | success |
| DMD-21 | latest before earliest | rejected |
| DMD-22 | fully past window | rejected |
| DMD-23 | scheduled window expires | status EXPIRED |
| DMD-24 | scheduled intent exists | no booking/seat/trip is created |

## Privacy and projections

| ID | Scenario | Expected |
|---|---|---|
| DMD-30 | public route summary queried | route_id, NOW count, scheduled count, coarse label only |
| DMD-31 | summary result inspected | no passenger IDs, names, phones or emails |
| DMD-32 | 0 active intents | label NONE |
| DMD-33 | 1 NOW intent | label LOW |
| DMD-34 | 2–3 NOW intents | label MEDIUM |
| DMD-35 | 4+ NOW intents | label HIGH |

## Engine isolation

Capture counts/hashes before and after demand commands.

| ID | Protected state | Expected after create/cancel/expire demand |
|---|---|---|
| DMD-40 | `driver_queue` | unchanged |
| DMD-41 | `trips` | unchanged |
| DMD-42 | `seat_requests` | unchanged |
| DMD-43 | `trip_seats` | unchanged |
| DMD-44 | fare snapshots | unchanged |
| DMD-45 | driver FIFO positions | unchanged |

## Concurrency

| ID | Scenario | Expected |
|---|---|---|
| DMD-50 | two simultaneous equivalent NOW creates by same passenger | one active equivalent intent |
| DMD-51 | many passengers create intent on same route | exact aggregate count |
| DMD-52 | create and cancel race on same intent | deterministic final state; no duplicates |
| DMD-53 | demand creation while driver queue activates | queue order and trip activation unaffected |

## Security surface

Verify after migration:
- RLS enabled on `demand_intents`
- direct anonymous/authenticated table mutations not required by UI
- SECURITY DEFINER functions use constrained `search_path`
- functions verify `auth.uid()` and trusted profile role where applicable
- PUBLIC function EXECUTE removed
- only intended anon/authenticated RPC grants exist
- Supabase security advisor reviewed
- Supabase performance advisor reviewed

## Release rule

Beta1 demand backend is not eligible for production consideration until all applicable DMD tests pass on an isolated database and the existing Raahi booking/queue/trip invariant suite remains green.
