# Raahi Next

Raahi Next is the clean launch-candidate implementation of the Raahi 2.0 architecture.

It is intentionally separate from the existing Raahi implementation. The old product remains a reference source; Raahi Next imports only proven ideas that fit the frozen company, UML, experience and domain contracts.

## Runtime

- App: `http://localhost:4029`
- Local Supabase API: `http://127.0.0.1:55321`
- Local Supabase DB: `55322`
- Local Supabase Studio: `55323`

The local Supabase ports are deliberately isolated from existing Raahi work.

## Core commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

## Current build stage

Foundation 1:
- capability-based identity
- Market / Location / Corridor / Service Product
- Driver Home Market / verified Operating Market
- Driver Vehicle / Verification / Product Preference
- scoped Admin permissions
- shared Driver/Vehicle commitment ledger

See `docs/RAAHI_NEXT_BUILD_BLUEPRINT_V1.md` for the authoritative implementation sequence.

## Safety

Never place Supabase secret/service keys in `NEXT_PUBLIC_*` variables.
Never repurpose the existing Raahi V2 Dev database for this project.
Never touch Raahi School or port 4030 from this repository.
