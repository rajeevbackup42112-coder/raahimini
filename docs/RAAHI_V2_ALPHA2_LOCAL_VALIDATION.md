# Raahi V2 Alpha2 — Local Validation Runbook

Branch: `v2.0-alpha2`
Purpose: browser/mobile validation only. Do not apply V2 migrations to the production-linked Supabase project.

## Safety first

1. Stop any process listening on port `4030`.
2. If a local Next.js server is needed, bind it only to `127.0.0.1`.
3. Do not expose the local server on `0.0.0.0`, `::`, LAN, tunnel, or public URL.
4. Do not deploy this branch to Production.

Recommended local serve command after a successful build:

```powershell
npm.cmd run serve -- -H 127.0.0.1 -p 4030
```

Verify the listener is localhost-only:

```powershell
Get-NetTCPConnection -LocalPort 4030 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
```

Expected address: `127.0.0.1` only.

## Build gate

From a clean checkout of `v2.0-alpha2`:

```powershell
npm.cmd install --no-audit --no-fund
npm.cmd run type-check
npm.cmd run build
```

Both type-check and production build must pass.

## Passenger checks

- Anonymous browsing still works without login.
- Home shows green V2 identity and clear-fare/no-platform-fee message.
- Selecting a location shows route-health cards and fare.
- Live collecting route opens `Live Raahi` card.
- Available collecting car shows `Book Seat`.
- Full car shows the explicit full-car outcome instead of a booking action.
- Signed-in passenger with a live request sees `My Raahi · Live now` near the top of Home.
- Passenger status uses the same live-card language and journey progress.

## Driver checks

- Driver Home greets the trusted driver and preserves current-location selection.
- Route card shows one next action: `Join queue` or `Go available now`.
- Existing driver queue behavior is unchanged.
- Active trip uses the unified live card.
- Active trip shows confirmed seats, seats left, fare, expected collected amount, held-seat attention, and one next action.
- Existing confirm passenger, absent, close seats, start trip, next stop and complete trip actions still behave as before.

## Regression boundaries

Do not alter or "fix" the V1 engine during this UI validation unless a reproducible regression is proven.

Specifically preserve:
- passenger seat allocation and capacity rules
- HELD/CONFIRMED lifecycle
- driver FIFO
- trip start/completion semantics
- fare snapshots
- cancellation/no-show rules
- PostgreSQL authority
- Realtime as invalidation/refetch only

## Evidence to record

Record only:
- type-check result
- build result
- localhost listener result
- passenger Home result
- passenger live/status result
- driver Home result
- driver active-trip result
- any reproducible defect with route/state and exact visible symptom

Do not capture credentials, tokens, cookies, OTPs, or secrets in screenshots/logs.
