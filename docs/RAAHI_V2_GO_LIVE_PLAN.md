# Raahi 2.0 Demo Ready → Go Live Plan

Date: 2026-08-30
Branch: `demo-ready-investor-polish`
Base checkpoint before SMS/domain work: `1f074897059afeba2211a76c04331a554bab8465`
Validated engineering candidate: `b937c40996805caab57b804b5f588975a9e97aa6`

## Locked launch identity

- Parent brand domain: `myraahi.co.in`
- Raahi 2.0 production app: `ride.myraahi.co.in`
- Temporary rollback hostname: `myraahi.referralhub.co.in`
- Backend/auth authority: existing Raahi 2.0 Supabase project
- OTP delivery: Fast2SMS through Supabase Send SMS Hook
- Maps at launch: existing keyless OpenStreetMap implementation

## Non-negotiable boundaries

No cutover step may weaken FIFO, seat ownership, real-GPS departure, canonical trip lifecycle, verified-phone booking, role authorization, Share My Raahi privacy or V1/School isolation.

Production database, production Auth Hook and DNS remain unchanged until the candidate passes local contracts/build and required credentials/configuration are ready.

## Gate 1 — Candidate engineering

- [x] Demo Ready Screen 16 Admin Access visual acceptance.
- [x] Admin Access forward repair committed/pushed.
- [x] Fast2SMS Send SMS Hook committed and contract-tested.
- [x] New production hostname added to all production/test-auth safety guards.
- [x] TypeScript PASS.
- [x] Full contract suite PASS — 30/30 contracts.
- [x] Production Next.js build PASS — 23/23 pages.

## Gate 2 — Fast2SMS prerequisites

Required before real delivery:

- [ ] Fast2SMS account ready for production OTP traffic.
- [ ] Fast2SMS API authorization key created.
- [ ] Smart OTP / OTP template ID created and approved for the intended SMS channel.
- [ ] Template wording reviewed so it does not claim an expiry different from Supabase Auth.
- [ ] `FAST2SMS_API_KEY` stored only as a Supabase Edge Function secret.
- [ ] `FAST2SMS_OTP_ID` stored only as a Supabase Edge Function secret.
- [ ] Supabase Send SMS Hook secret stored as `SEND_SMS_HOOK_SECRETS`.

Delivery architecture:

`Raahi UI → Supabase Auth generates OTP → signed Send SMS Hook → send-sms Edge Function → Fast2SMS → phone`

Verification architecture:

`User enters OTP → Supabase Auth verifyOtp()`

Fast2SMS `/dev/otp/verify` is intentionally not part of Raahi authentication.

## Gate 3 — SMS activation test

- [ ] Deploy `send-sms` Edge Function with JWT verification disabled only because Auth Hooks run before a user JWT; Standard Webhooks signature verification stays mandatory inside the function.
- [ ] Configure the Supabase Send SMS Hook endpoint and generated hook secret.
- [ ] Run a signed synthetic hook request without a real SMS and confirm invalid signatures fail closed.
- [ ] Send one real OTP to a controlled Indian number.
- [ ] Verify that OTP through the normal Raahi Profile/Supabase `verifyOtp` flow.
- [ ] Confirm wrong/expired OTP remains rejected by Supabase.

## Gate 4 — New production hostname

Hosting must first accept `ride.myraahi.co.in` and provide the exact DNS target. Do not invent A/CNAME values.

Then:

- [ ] Add the hosting-provided DNS record in GoDaddy DNS for `ride`.
- [ ] Wait for hosting-domain verification and HTTPS certificate issuance.
- [ ] Set the application production site URL to `https://ride.myraahi.co.in`.
- [ ] Add `https://ride.myraahi.co.in/auth/callback` and any required app return paths to the Supabase Auth redirect allow-list.
- [ ] Verify Google OAuth configuration still targets the canonical Supabase callback and accepts the new app origin/redirect setup where required.
- [ ] Keep `myraahi.referralhub.co.in` working during the acceptance window.
- [ ] Do not redirect the old hostname until the new hostname passes real-account acceptance.

## Gate 5 — Database / backend preflight

Before applying the Demo Ready Admin Access repair:

Read-only preflight at 2026-08-30 03:41 IST is clean. Re-run immediately before any migration because operational state can change.

- [x] 0 live trips at preflight.
- [x] 0 live Driver queue entries at preflight.
- [x] 0 HELD requests at preflight.
- [x] 0 current ACTIVE demand requiring preservation at preflight.
- [x] 0 open support cases at preflight.
- [x] 0 route drafts at preflight.
- [x] 0 live GPS rows at preflight.
- [ ] Apply `20260829162500_demo_ready_admin_role_accounts_type_fix.sql` as a reviewed forward migration.
- [ ] Verify `admin_list_role_accounts()` succeeds for Admin and remains inaccessible to unauthorized callers.
- [ ] Verify grant/revoke/self/final-admin/Driver-role protections are unchanged.

## Gate 6 — New-domain real-account acceptance

Run on `https://ride.myraahi.co.in` with real accounts and real browsers/devices:

- [ ] Passenger login and verified-phone profile.
- [ ] One OTP send + Supabase verification through Fast2SMS.
- [ ] Passenger route discovery / no-car state.
- [ ] Seat hold / exact-seat ownership.
- [ ] Driver Home / queue / collecting.
- [ ] Real browser GPS automatic departure.
- [ ] Passenger live map and lifecycle truth.
- [ ] Share My Raahi anonymous read-only view.
- [ ] Explicit arrival + automatic completion.
- [ ] Admin Dashboard / Users / Routes / Operations / Admin Access.
- [ ] Production `/api/test-auth` remains unavailable/fail-closed on the new hostname.
- [ ] Terminal cleanup returns operational state to zero.

## Gate 7 — Cutover and rollback

Only after Gate 6 passes:

- [ ] Mark the accepted Demo Ready/go-live Git commit with a frozen release ref.
- [ ] Make `ride.myraahi.co.in` the canonical public Raahi 2.0 URL.
- [ ] Keep the old hostname available for a short monitored rollback window.
- [ ] If application rollback is required, use the last compatible frozen app ref; database remains forward-only and is repaired with reviewed forward migrations.
- [ ] Update final handover, Bible, Decisions, Build Matrix and Release Readiness with exact refs and acceptance evidence.

## Current external inputs still required

1. Fast2SMS API authorization key.
2. Fast2SMS OTP ID/template.
3. Hosting-provider custom-domain target for `ride.myraahi.co.in`.
4. Explicit approval immediately before production migration, production Edge Function/hook enablement, or DNS cutover.
# 2026-08-31 revised closure sequence

The validated candidate now includes Outstation Areas v2, master Raahi branding, deterministic dependencies and the completed dependency-security upgrade. Local evidence is TypeScript PASS, 36/36 contracts PASS, `git diff --check` PASS, production audit 0 vulnerabilities, production build 32/32 pages and isolated route smoke PASS.

## Gate A — source checkpoint and CI

- [x] Review final status/diff, including deletion of tracked `.env` and addition of `package-lock.json`.
- [x] Commit the complete validated candidate plus canonical documentation.
- [x] Push checkpoint `0e455f00ad52d0dfa95d3cf32f74aee338cfe490` to remote `demo-ready-investor-polish` without force.
- [x] Record exact checkpoint SHA: `0e455f00ad52d0dfa95d3cf32f74aee338cfe490`.
- [x] GitHub `Demo Ready Validate` run `33357751663` completed successfully for that exact checkpoint.

## Gate B — Netlify without production cutover

- [ ] Confirm the Netlify build uses the committed lockfile and `npm ci`/production build path.
- [ ] Confirm required environment-variable names are configured without exposing secret values.
- [ ] Deploy/inspect the exact checkpoint on a Netlify-owned preview or site URL when current access permits.
- [ ] Verify HTTPS, primary public routes, callback routing, protected-route behavior and production test-auth/staging fail-closed behavior.
- [ ] Do not attach or change GoDaddy DNS yet.

## Gate C — owner-only production configuration

Explicit approval is required immediately before any of the following:

- GoDaddy DNS changes for `ride.myraahi.co.in`;
- production Supabase redirect allow-list or Site URL changes;
- Google OAuth production origin/redirect changes;
- production database migrations;
- Fast2SMS secrets, Edge Function/Auth Hook activation or real OTP traffic;
- irreversible Netlify production settings.

After approval, perform the smallest reversible change, verify it, then proceed. Keep `myraahi.referralhub.co.in` available throughout the rollback window and preserve `prod-v14-frozen` → `38b7519d615e171c59d537b18a61c1ba303c132f`.

## Gate D — hosted acceptance

Run real-browser Passenger, Driver and Admin acceptance on the hosted candidate, including Outstation Areas v2, Driver Verification privacy, Contact Raahi, Local Offers, Shared Ride regression, GPS/start/completion, Share My Raahi, and final synthetic/operational cleanup. Freeze the final release ref only after this gate passes.
