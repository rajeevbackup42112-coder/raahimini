# Raahi Next — Build Status

**Checkpoint date:** 2026-09-05
**Stage:** Gate 0 complete; Slice 1 starting

## Gate 0 — GREEN

Raahi Next now has a dedicated clean application, Git branch and Supabase database.

### Preserved legacy/reference state
- Existing Raahi code remains untouched for reference.
- GitHub reference branch: `raahi-v2-reference-2026-09-05` at `f592e29`.
- Existing `Raahi V2 Dev` Supabase project was paused, not deleted, to free the Free-plan project slot.
- `SchoolTransportOS Dev` was not touched.

### Raahi Next resources
- Workspace: `C:\Users\Dipti\AppData\Local\Temp\raahi-next`.
- Runtime port: `4029`.
- GitHub repository: `rajeevbackup42112-coder/raahimini`.
- GitHub branch: `raahi-next-clean`.
- Supabase project: `Raahi Next Dev` (`dfgxtooftvtecfcogeiv`, `ap-southeast-2`).
- Supabase project cost at creation: `$0/month` under the current Free plan.

### Foundation migrations replayed successfully
1. `20260905103622_foundation_identity_markets_products`
2. `20260905103649_foundation_driver_supply_context`
3. `20260905103716_foundation_admin_commitments`
4. `20260905103738_foundation_command_integrity`
5. `20260905104010_foundation_advisor_hardening`

### Real database acceptance evidence
- Clean migrations applied to a fresh project and deterministic Gomoh/Dhanbad seed loaded.
- Anonymous catalog RLS exposes Gomoh + `GOMOH_DHANBAD_FIXED_OW` only; Dhanbad PREPARING/draft Product remains hidden.
- Authenticated self-RLS proved one user can read only their own Profile/Capabilities; new user receives Passenger capability.
- Same-Driver overlapping commitment: blocked by Postgres exclusion constraint.
- Same-Vehicle overlapping commitment: blocked by Postgres exclusion constraint.
- Duplicate idempotency identity: blocked.
- Historical Product-rule mutation: blocked.
- Selecting a Vehicle without Driver access: blocked.
- Revoking access to the currently selected Vehicle: blocked.
- Supabase security advisor: **0 findings**.
- Performance advisor: no unindexed-FK findings; only expected unused-index INFO on the new empty database.

### Application gate
- Next.js 16.3.3 / React 19.2.x / strict TypeScript.
- Supabase SSR browser/server clients added with Next.js 16 `proxy.ts` session refresh.
- App is connected locally to `Raahi Next Dev` via publishable client credentials only.
- No service-role/server secret is stored in the app environment.
- TypeScript: PASS.
- ESLint: PASS.
- Vitest: 18/18 PASS.
- Production build: PASS.

### Non-blocking housekeeping
- Local Supabase CLI has no authenticated access token, so generated database types have not yet been written to the repository. The connected Supabase service can generate them; this will be completed once CLI/project auth is configured, and does not alter product behavior.
- Google OAuth will reuse the existing Google ecosystem where appropriate, but provider secrets/redirect configuration will be handled during the authentication integration slice rather than copied manually.

## Next executable stage
**Slice 1 — Driver chooses and verifies Current Operating Market.**

The command must prove: physical presence, Driver capability/standing, one Operating Market, commitment conflict protection, event history, idempotency, and no automatic Product enrolment.
