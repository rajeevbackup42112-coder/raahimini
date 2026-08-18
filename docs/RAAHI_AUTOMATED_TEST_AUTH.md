# Raahi Mini — Automated Test Authentication

## Purpose

Google may block browser automation at the Google sign-in page. Raahi automated tests therefore do **not** automate Google OAuth. A dedicated staging deployment may establish a genuine Supabase Auth session for an allowlisted existing test account through `POST /api/test-auth`.

This endpoint is testing infrastructure only. Normal Raahi role routing, RLS/RPC authorization, passenger phone rules, queue logic, seat logic and trip logic are unchanged after the session exists.

## Security model

The endpoint is closed unless all of the following are true:

1. server-only `RAAHI_TEST_AUTH_ENABLED=true`;
2. the request hostname is present in server-only `RAAHI_TEST_AUTH_ALLOWED_HOSTS`;
3. the hostname is **not** the hard-blocked production host `raahi-mini.netlify.app`;
4. the request supplies the exact high-entropy `x-raahi-test-key` value from server-only `RAAHI_TEST_AUTH_KEY`;
5. the requested persona is present in `RAAHI_TEST_PERSONAS_JSON`;
6. the configured Supabase Auth user already exists;
7. that user's trusted `profiles.role` still matches the configured persona role and the account is unrestricted.

There is no `?test_user=` switch, no public role override and no password stored in the repository. The endpoint uses the Supabase service-role key only on the server. It first verifies an existing user by UUID so the magic-link generator cannot silently create a typoed test account.

On production or any non-allowlisted hostname the endpoint deliberately returns `404`.

## Staging environment variables

Configure these only on the dedicated staging deployment:

```text
SUPABASE_SERVICE_ROLE_KEY=<server-only Supabase service role key>
RAAHI_TEST_AUTH_ENABLED=true
RAAHI_TEST_AUTH_ALLOWED_HOSTS=<exact staging hostname>
RAAHI_TEST_AUTH_KEY=<long random secret, at least 32 random bytes recommended>
RAAHI_TEST_PERSONAS_JSON=<JSON shown below>
```

Current dedicated Raahi test personas can be configured as:

```json
{
  "passenger-1": {"userId":"87e6948e-3964-4b3c-b359-bea32b861561","role":"passenger"},
  "passenger-2": {"userId":"b8966112-a32a-439c-9e68-7ea8e7db3752","role":"passenger"},
  "driver-dipti": {"userId":"90883c8e-ffe6-4854-9ff1-c5f80cc445e7","role":"driver"},
  "driver-rajeev4": {"userId":"b4318eff-f019-4631-a82d-34da3435b6e4","role":"driver"},
  "admin-ajit": {"userId":"cb7f0d46-e909-4a75-ab0f-20eae6ab089d","role":"admin"}
}
```

Keep the JSON as one line when entering it in the hosting environment UI.

The staging deployment may point to the current Supabase project while we are initially proving browser orchestration, but destructive test scenarios must use only dedicated test identities/data. A separate Supabase staging project is preferable before broad automated regression runs.

## How the endpoint creates a real session

1. Playwright sends `POST /api/test-auth` with a persona name and the secret header.
2. Server validates environment, hostname, key, user UUID and trusted Raahi role.
3. Server uses Supabase Admin `generateLink(type: 'magiclink')` for that already-existing user's email. Supabase documents this as an admin mechanism for generating email action links/OTPs without sending the email.
4. Server takes the generated token hash and calls the normal Supabase `verifyOtp` path through Raahi's SSR client.
5. Supabase writes the same authenticated cookies the application uses normally.
6. Response tells the test which real Raahi screen to visit next. From that point onward there is no test-role override; authorization is the normal production authorization model.

## Playwright session helper

Use the browser context's request client so `Set-Cookie` is stored in that same context:

```ts
async function signInPersona(page, baseURL, persona, testKey) {
  const response = await page.request.post(`${baseURL}/api/test-auth`, {
    headers: {
      'x-raahi-test-key': testKey,
      'content-type': 'application/json',
    },
    data: { persona },
  });

  if (!response.ok()) {
    throw new Error(`test auth failed: ${response.status()} ${await response.text()}`);
  }

  const result = await response.json();
  await page.goto(`${baseURL}${result.redirectTo}`);
}
```

No Google page is opened. Each Playwright browser context can sign in independently as a different Raahi persona.

## Recommended first automated scenario

1. anonymous context browses locations/routes/current car;
2. `passenger-1` requests one seat;
3. `driver-rajeev4` sees the HELD request and confirms it;
4. passenger projection changes to CONFIRMED;
5. `passenger-2` exercises withdrawal/absence path;
6. second driver joins FIFO;
7. active driver closes remaining empty seats, starts, advances stops and completes;
8. next driver becomes collecting when expected;
9. database invariant audit returns zero violations;
10. repeat journey to verify terminal queue history.

## Production rule

Never enable automated test auth on the public production deployment. If a future production hostname replaces `raahi-mini.netlify.app`, add that hostname to the hard-blocked host list before DNS cutover.
