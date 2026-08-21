# Raahi V2 Beta1 — Backend Gate

Status: BLOCKED pending a safe isolated database target

## Why this gate exists

Beta1 frontend now depends on demand-intent RPCs, but Raahi production must remain untouched and the existing separate Supabase project named `Raahi` is not a clean V2 development database.

Read-only inspection shows that project contains the older queue/matcher architecture and legacy historical RPC surface. It must not be repurposed implicitly.

## Safe next backend options

Only one of these should be used:

1. A fresh isolated Supabase development project explicitly designated for Raahi V2.
2. A paid Supabase branch later, when the user approves the cost.
3. A local Supabase stack when Docker or another supported local Postgres workflow is available.

Until one exists:
- do not apply Beta1 DDL to `Raahi Mini` production-linked Supabase
- do not repurpose the older `Raahi` project without explicit approval
- do not fake demand RPC responses in production code
- keep Beta1 PR draft

## Backend acceptance before Beta1 can progress to release testing

- migration applies cleanly to isolated Postgres
- RLS and EXECUTE grants verified
- NOW intent dedupe verified
- scheduled window validation verified
- cancellation ownership verified
- expiry verified
- public summaries expose aggregate counts only
- demand functions do not mutate trips, driver queue, seat requests or trip seats
- FIFO behavior remains unchanged under concurrent demand
- security/performance advisors reviewed after DDL
