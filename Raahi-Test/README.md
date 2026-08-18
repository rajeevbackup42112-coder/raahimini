# Raahi-Test

Lightweight Windows-friendly Playwright harness for Raahi Mini.

## Why this avoids Google's Playwright login block

Google OAuth is **never automated**. `setup-all-auth.bat` launches ordinary installed Google Chrome with a separate `--user-data-dir` for each Raahi persona. You sign in to Raahi manually once, using normal Chrome. After Chrome is closed, Playwright reuses that dedicated browser profile and the already-established Raahi/Supabase session. Automated tests do not visit `accounts.google.com`.

Never point this harness at your normal personal Chrome profile. It creates and uses only folders under `Raahi-Test/profiles/`, which are git-ignored.

## Personas

- `admin-ajit`
- `driver-dipti`
- `driver-rajeev4`
- `passenger-1`
- `passenger-2`

The setup page is `/admin-login` for every persona because it allows a clean Google OAuth sign-in without creating a passenger seat request. For a passenger account, seeing **Admin access not available** after OAuth is expected: it proves the passenger is authenticated but is not an Admin.

## One-time setup

1. Install Node.js if it is not already installed.
2. Double-click `setup-all-auth.bat`.
3. For each named persona, sign in to Raahi in the normal Chrome window that opens, then close that Chrome window completely.
4. After all five are saved, double-click `run-smoke.bat`.

If you prefer to set up one account at a time:

```bat
npm install
node src/setup-auth.mjs admin-ajit
node src/setup-auth.mjs driver-dipti
node src/setup-auth.mjs driver-rajeev4
node src/setup-auth.mjs passenger-1
node src/setup-auth.mjs passenger-2
```

## What the first smoke suite verifies

- anonymous Raahi browsing works without authentication;
- Admin session routes to `/admin-panel`;
- Driver sessions route to either driver route selection or an already-active car;
- Passenger sessions cannot enter `/admin-panel` and are returned to the public passenger experience;
- PASS/FAIL output is written to `reports/smoke-summary.txt` and `reports/smoke-summary.json`;
- failure screenshots are written to `reports/`.

## Target URL

Default: `https://raahi-mini.netlify.app`

To test another deployment without changing code:

```bat
set RAAHI_BASE_URL=https://your-staging-host.example
run-smoke.bat
```

## Security rules

- Browser profile/session folders are never committed.
- No Google password is stored by this harness.
- No Google login is scripted or bypassed.
- No Supabase service-role key or test-auth backdoor is introduced.
- The harness uses the same real Raahi role routing and server RPC authorization as a normal user session.

The next layer, after these five sessions are captured and the role smoke suite passes, is the deterministic multi-user journey test: driver FIFO/activation -> passenger HELD -> driver confirmation -> departure -> next driver activation -> ordered stops -> completion -> post-scenario database invariant audit.
