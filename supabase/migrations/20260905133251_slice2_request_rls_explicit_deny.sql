-- Slice 2 hardening: make the intentional browser deny explicit for advisors.

create policy fixed_requests_deny_direct_browser_access
on public.fixed_passenger_requests
for all to anon, authenticated
using (false)
with check (false);
