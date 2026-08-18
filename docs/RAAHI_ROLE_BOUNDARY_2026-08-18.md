# Raahi Mini — Strict Operational Role Boundary

**Status:** Historical architecture checkpoint. Fully consolidated into `RAAHI_MASTER_ARCHITECTURE.md` on 2026-08-18. The Master Architecture Sheet is now the only canonical architecture authority.

This document is retained only as a record of the decision that every authenticated Raahi account has exactly one operational role: `passenger`, `driver`, or `admin`.

- Passenger: public discovery plus authenticated seat booking/status.
- Driver: route/FIFO/passenger/trip operations; cannot request passenger seats.
- Admin: administration only; cannot book or operate a driver journey while holding admin role.
- No user-facing role switcher.
- Trusted display name and server-side role are shown in signed-in identity UI.
- Client metadata cannot self-promote roles.
- Driver/admin RPCs remain server-authorized independently of UI hiding.
- Admin delegation is audited and prevents mixed driver/admin roles, restricted promotion, self-removal, and removal of the final active admin.
- Admin operational corrections must use explicit invariant-preserving commands rather than direct row editing.

For current behaviour and all future changes, use `docs/RAAHI_MASTER_ARCHITECTURE.md`.
