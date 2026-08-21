# Raahi V2 Alpha1 — Auth & Profile Audit

Status: completed initial source audit
Branch: `v2-scope-freeze`
Scope: V2 `alpha1` — one login entry point, visible identity, nickname/profile, trusted role routing

## Executive finding

The current codebase already contains much of the machinery V2 needs, but the user-facing login model is still fragmented.

Key fact: `profiles.display_name` already exists in the canonical schema and is auto-populated at auth-user creation. Therefore alpha1 does **not** need a new nickname column. It needs a safe profile-update command/RPC, UI editing, and consistent rendering.

The main V2 change should be to unify entry and routing, not to redesign auth from scratch.

## 1. Current login entry points

### Driver
- route: `/driver-login`
- Google OAuth
- redirects back to `/driver-login`
- if `profile.role === 'driver'`, forwards to `/driver-route-selection`
- otherwise shows “Driver account not activated yet”

### Admin
- route: `/admin-login`
- Google OAuth
- redirects back to `/admin-login`
- if `profile.role === 'admin'`, forwards to `/admin-panel`
- otherwise shows “Admin access not available”

### Passenger
- browsing is anonymous
- sign-in occurs only when needed by an action such as requesting a seat
- profile page currently assumes Google sign-in for passenger identity/phone management

### Test-only auth
- `/test-login` and `/api/test-auth` support automated staging tests
- these must remain available for E2E but hidden from production-facing UX

## 2. Current role-detection and routing

Role authority is `profiles.role` with enum values:
- passenger
- driver
- admin

`RoleRouteGuard` enforces:
- admin → admin panel
- driver → driver route selection for non-driver paths
- passenger blocked from driver/admin operational surfaces

This is already close to the V2 desired behavior: authenticate once, then trust the backend profile role.

### Alpha1 rule
Do not infer role from which button the user clicked.

After successful auth:
1. load `profiles`;
2. resolve trusted role from `profiles.role`;
3. route deterministically:
   - passenger → passenger/home context
   - driver → `/driver-route-selection`
   - admin → `/admin-panel`

## 3. Current profile schema

`public.profiles` already contains:
- `id`
- `phone`
- `display_name`
- `role`
- `is_restricted`
- `restriction_reason`
- timestamps

`handle_new_user()` currently initializes `display_name` from, in order:
1. auth metadata `display_name`
2. auth metadata `full_name`
3. email prefix
4. `User`

Therefore **no schema change is required merely to introduce nickname/display-name support.**

## 4. Current identity rendering

`AppHeader` already computes:

`profile.display_name || user.user_metadata.full_name || email prefix || 'User'`

and shows the role label.

This is directionally correct for V2.

However, there are still direct user-account/email references in role-specific login and profile screens. Examples:
- Driver login mismatch message shows `user.email`
- Admin login mismatch message shows `user.email`
- Profile page headline shows `user.email`

Alpha1 should make `profile.display_name` the primary visible identity and demote email/phone to secondary account detail.

## 5. Direct profile-table writes found

`AuthContext.tsx` directly updates `profiles.phone` after:
- phone-change verification
- phone identity removal

This violates the desired V2 architectural rule that UI/client code should not directly mutate canonical profile state.

### Alpha1 backend correction
Introduce one canonical self-service profile command, for example:

`update_my_profile(p_display_name text default null, p_phone text default null)`

or split commands if phone-auth synchronization requires separate semantics.

The command must:
- act only on `auth.uid()`;
- prevent role mutation;
- prevent restriction/admin fields from being changed;
- validate display-name length/content;
- update timestamps consistently;
- preserve phone/auth consistency rules.

Do **not** expose a generic unrestricted profile update RPC.

## 6. Alpha1 implementation delta

### Backend
1. Add canonical nickname/self-profile update RPC.
2. Grant execute only to authenticated users.
3. Keep `role`, `is_restricted`, and admin-only fields immutable to self-service callers.
4. If phone synchronization remains client-driven through Supabase Auth, move only the `profiles.phone` mirror write behind a narrowly scoped canonical command.

### Auth context
1. Add `updateDisplayName()` or `updateMyProfile()` method.
2. Replace direct `profiles.update(...)` phone writes with canonical RPC call(s).
3. Keep profile refresh after successful updates.
4. Preserve Google OAuth, OTP, and staging test-auth mechanisms.

### Login UX
1. Replace public Driver/Admin login links with one public **Sign in** entry.
2. After auth, let trusted `profiles.role` route automatically.
3. Remove role choice from the public login screen.
4. Keep role-specific pages only as compatibility redirects during alpha1 if needed; do not expose them as primary entry points.

### Header/profile UX
1. Show display name prominently.
2. Show role label subtly.
3. Add “What should Raahi call you?” editor.
4. Keep email/phone as secondary account detail.
5. Once logged in, show profile/menu rather than another login button.

## 7. Compatibility hazards

### Hazard A — existing deep links
Existing links may still point to `/driver-login` or `/admin-login`.

Mitigation: retain routes temporarily and redirect them into the unified login flow with a safe `next` parameter; never use them to assign role.

### Hazard B — role activation flow
A passenger account may later be promoted by trusted admin to driver/admin.

Mitigation: auth identity remains the same; only `profiles.role` changes through trusted admin workflow. Unified login then naturally routes correctly on next profile refresh/sign-in.

### Hazard C — profile load timing
`RoleRouteGuard` waits for both `user` and `profile`.

Mitigation: unified login must show a stable resolving/loading state until profile is known; never route by fallback metadata role.

### Hazard D — existing role E2E tests
Current tests explicitly validate passenger, driver, and admin landing behavior.

Mitigation: preserve these tests and add unified-login-specific cases rather than replacing role-boundary coverage.

## 8. Required alpha1 tests

### Existing tests that must remain green
- anonymous passenger browsing
- anonymous blocked from protected screens
- passenger lands as passenger
- passenger blocked from driver/admin operations
- driver lands in driver flow
- driver blocked from admin operations
- admin lands in admin panel

### New tests
1. unified sign-in entry visible to anonymous users;
2. no separate public Driver/Admin login buttons;
3. passenger authentication routes to passenger context;
4. driver authentication routes to driver context;
5. admin authentication routes to admin context;
6. display name renders from `profiles.display_name`;
7. user can update own display name;
8. user cannot change own role through profile update command;
9. user cannot change restriction/admin fields;
10. direct profile writes are absent from client code for fields covered by canonical commands;
11. legacy `/driver-login` and `/admin-login` deep links cannot bypass role authority;
12. profile-load delay does not flash or route to the wrong role;
13. logout returns to neutral passenger/public state.

## 9. Recommended alpha1 code order

1. Add canonical self-profile RPC.
2. Add RPC contract test / SQL invariant test.
3. Update `AuthContext` to use the RPC.
4. Extend Profile UI with nickname editor.
5. Create one unified public sign-in route/component.
6. Convert driver/admin login pages into compatibility redirects or wrappers.
7. Update `AppHeader` public menu to one Sign in entry.
8. Add Playwright unified-login tests.
9. Run existing role/auth E2E suite.
10. Only then move alpha1 toward staging.

## Decision

**Proceed with alpha1. No V1 booking/queue/trip business rule needs to change for identity/unified login.**

The only architecture cleanup required in this slice is replacing direct self-profile table mutations with canonical command(s) while preserving the existing trusted `profiles.role` model.
