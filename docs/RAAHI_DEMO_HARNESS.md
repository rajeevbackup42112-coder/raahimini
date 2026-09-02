# Raahi Scenario Demo Harness

## Purpose

`/demo` is a synthetic marketplace simulator for investor walkthroughs, regression acceptance and Driver/Admin training. It is intentionally separate from real Raahi transactions.

## Isolation rules

- Demo scenario controls change browser React state only.
- The demo experience must not import Supabase or call production table/RPC write APIs.
- Demo personas do not use Google sign-in.
- Simulated verification approvals, quotes, seat races and GPS updates never create production records.
- The public regulatory transaction switch remains untouched.
- `/demo` is `noindex` and is not added to the public sitemap.
- Normal Passenger/Driver/Admin role redirects are bypassed only for `/demo` so every synthetic persona can be displayed.

## Initial personas

- Rajeev1 — Passenger
- Rajeev4 — Driver, Tata Tiago, 4 seats
- Naresh — Driver, Maruti Ertiga, 6 seats
- Ajit — Admin

## Initial scenarios

1. Driver verification: missing → pending → rejection → approval → operational unlock.
2. Shared Ride FIFO: route selection → active Driver → waiting Driver → Passenger view → FIFO promotion.
3. Exact-seat race: four seats → 3-seat hold → oversized competing request blocked → final seat succeeds.
4. Bokaro Outstation: area-routed lead → two eligible Drivers → ignore → quote → Passenger acceptance/privacy transition.
5. Trip lifecycle: accepted booking → fresh simulated GPS → collecting → in progress → completion.
6. Local Offers: empty state → Admin draft → activation → clearly marked Sponsored Passenger view.
7. Regulatory launch gate: public OFF → non-pilot blocked → controlled pilot exercise → public remains OFF.

## Deployment plan

This branch must not replace `ride.myraahi.co.in`. After the branch passes CI, it should be reviewed on the Dipti machine using the normal production-build/headed-browser workflow. Only after visual acceptance should it be deployed to a dedicated demo hostname such as `ride-demo.myraahi.co.in`.

Raahi School Transport and its existing hostnames are out of scope and must not be changed.
