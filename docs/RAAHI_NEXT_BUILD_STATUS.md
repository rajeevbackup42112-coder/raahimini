# Raahi Next — Build Status

**Checkpoint date:** 2026-09-05
**Stage:** Gate 0 complete; Slice 1 implemented; hosted-auth acceptance pending

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

## Slice 1 — Driver Operating Market

### Implemented
- Added configurable `market_presence_zones`; Market verification is data-driven rather than city-branch code.
- Operating Market stores verified Market, verification zone, timestamp, method and GPS accuracy; exact Driver coordinates are not retained in Operating Market state.
- Added canonical `driver_set_operating_market` command with Driver capability/standing checks, physical presence verification, commitment conflict guard and idempotency.
- Idempotency is claimed before time-sensitive GPS validation so a successful retry returns the original result even after its GPS evidence ages out.
- Added `get_my_drive_context` projection with Home Market, current Operating Market and eligible Market choices.
- Privileged RPC implementations live in `private`; exposed public functions are `SECURITY INVOKER` wrappers.
- Added `/drive`, `/api/driver/operating-market`, Google sign-in entry and OAuth callback plumbing.
- Browser never writes Operating Market tables directly.

### Real database proof
- Valid Gomoh-home Driver → Dhanbad Operating Market: PASS.
- Passenger capability preserved while Driver context changes: PASS.
- Remote Gomoh coordinates attempting Dhanbad: rejected with `LOCATION_NOT_VERIFIED`.
- Same idempotency key + changed input: rejected with `IDEMPOTENCY_CONFLICT`.
- Completed command retried after GPS evidence becomes stale: returns original successful result.
- Active conflicting Gomoh commitment → Dhanbad switch: rejected with `ACTIVE_COMMITMENT_CONFLICT`.
- Public wrappers remain executable by authenticated Driver; anonymous command execution denied.
- Supabase security advisor after RPC hardening: **0 findings**.

### Application/browser proof
- Slice 1 contract suite added; current Vitest total: **27/27 PASS**.
- TypeScript: PASS.
- ESLint: PASS.
- Production Next.js build: PASS.
- Browser `/drive` unauthenticated guard: PASS.
- Browser sign-in page: PASS.
- Starter `Create Next App` metadata removed; page title is `Raahi`.
- Google OAuth initiation reaches `Raahi Next Dev`, but Supabase currently returns `Unsupported provider: provider is not enabled`.

### Acceptance status
Slice 1 implementation is complete enough to checkpoint. Full real-user browser acceptance is **BLOCKED only on Google provider configuration in the new Supabase project**. No email/password or test-only bypass has been introduced.

Once Google OAuth is enabled using the existing Google ecosystem, run the final headed acceptance:
1. sign in with a real Driver account;
2. verify current Operating Market;
3. reject a physically wrong Market;
4. confirm Home Market remains unchanged;
5. confirm Passenger capability remains present;
6. confirm choosing a Market does not auto-enrol a Product.

After that, Slice 2 is Passenger search + join Fixed demand for Gomoh → Dhanbad.
