# Raahi Mini — Strict Operational Role Boundary

**Status:** Canonical architecture supplement to `RAAHI_MASTER_ARCHITECTURE.md` pending consolidation into the next Master Sheet edit.

## Rule

Every authenticated Raahi account has exactly one operational role: `passenger`, `driver`, or `admin`.

- **Passenger:** public discovery plus authenticated seat booking/status. May not perform driver or admin operations.
- **Driver:** driver route selection, FIFO queue, passenger handling and trip operations. May not create passenger seat requests.
- **Admin:** administration only. May not create passenger seat requests or operate a driver journey unless separately changed back to an allowed role through a trusted administrative process.

Public anonymous discovery remains available without authentication. Role separation applies once an authenticated account is present.

## Routing

- Authenticated `driver` accounts automatically land on the driver experience.
- Authenticated `admin` accounts automatically land on the Admin Panel.
- Authenticated `passenger` accounts cannot enter driver/admin operational routes.
- There is no user-facing role switcher.
- The public account menu exposes Driver sign-in for driver candidates, but no separate Admin sign-in choice. A trusted admin account is recognized from its server-side profile role after authentication and routed automatically.

## Identity clarity

The signed-in account surface must display the person's display name and role, with email available in the account menu. The role shown comes from `public.profiles`, not editable client metadata.

## Server enforcement

UI hiding is not a security boundary. `request_seats` must reject any authenticated account whose trusted profile role is not `passenger`.

Driver and Admin RPCs remain independently server-authorized.

## Admin delegation

An active, unrestricted admin may promote an existing passenger account to admin and revoke another admin through audited RPCs.

Safeguards:

1. Driver accounts cannot simultaneously be admins.
2. Restricted users cannot be promoted.
3. An admin cannot revoke their own admin access.
4. The final active admin cannot be removed.
5. Every grant/revoke is written to the audit log.
6. Client metadata can never self-promote a role.

## Admin manual-control boundary

Admin should correct coordination failures through canonical exception RPCs, not manually edit physical operational truth. Admin must not directly substitute passengers between seat requests, replace a driver on an active trip by editing rows, rewrite seat ownership, or mutate live trip/queue state outside invariant-preserving commands. Emergency controls must be explicit, audited, and preserve the same invariants as normal flows.
