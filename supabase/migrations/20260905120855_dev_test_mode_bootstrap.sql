-- Development-only test persona bootstrap.
-- Closed by default in every environment; Raahi Next Dev is enabled out-of-band.

create table if not exists private.test_mode_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  bootstrap_secret text not null,
  updated_at timestamptz not null default now()
);

revoke all on private.test_mode_config from public, anon, authenticated;

create or replace function private.dev_bootstrap_test_persona(
  p_bootstrap_secret text,
  p_display_name text,
  p_test_email text,
  p_persona text,
  p_home_market_code text default null,
  p_admin_market_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_home_market_id uuid;
  v_admin_market_id uuid;
  v_is_anonymous boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
  v_result jsonb;
begin
  if v_profile_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if not v_is_anonymous then
    raise exception 'TEST_IDENTITY_REQUIRED';
  end if;
  if not exists (
    select 1 from private.test_mode_config c
    where c.singleton
      and c.enabled
      and c.bootstrap_secret = p_bootstrap_secret
  ) then
    raise exception 'TEST_MODE_DISABLED';
  end if;
  if char_length(trim(coalesce(p_display_name, ''))) not between 2 and 80 then
    raise exception 'INVALID_DISPLAY_NAME';
  end if;
  if char_length(trim(coalesce(p_test_email, ''))) not between 5 and 160
     or position('@' in p_test_email) < 2 then
    raise exception 'INVALID_TEST_EMAIL';
  end if;
  if p_persona not in (
    'PASSENGER','DRIVER','PASSENGER_DRIVER','MARKET_ADMIN','PLATFORM_ADMIN'
  ) then
    raise exception 'INVALID_TEST_PERSONA';
  end if;

  update public.profiles
  set display_name = trim(p_display_name), updated_at = now()
  where id = v_profile_id;
  insert into public.account_capabilities(profile_id, capability)
  values (v_profile_id, 'PASSENGER')
  on conflict (profile_id, capability) do update set revoked_at = null;

  update public.account_capabilities
  set revoked_at = now()
  where profile_id = v_profile_id
    and capability in ('DRIVER','ADMIN')
    and revoked_at is null;

  update public.admin_scope_assignments
  set revoked_at = now()
  where profile_id = v_profile_id and revoked_at is null;

  if p_persona in ('DRIVER','PASSENGER_DRIVER') then
    select id into v_home_market_id
    from public.markets
    where code = upper(trim(coalesce(p_home_market_code, '')))
      and status in ('PREPARING','PILOT','ACTIVE','SCALING');
    if v_home_market_id is null then
      raise exception 'VALID_HOME_MARKET_REQUIRED';
    end if;

    insert into public.account_capabilities(profile_id, capability)
    values (v_profile_id, 'DRIVER')
    on conflict (profile_id, capability) do update set revoked_at = null;

    insert into public.drivers(profile_id, home_market_id, standing)
    values (v_profile_id, v_home_market_id, 'ACTIVE')
    on conflict (profile_id) do update set
      home_market_id = excluded.home_market_id,
      standing = 'ACTIVE', updated_at = now();
  end if;
  if p_persona = 'MARKET_ADMIN' then
    select id into v_admin_market_id
    from public.markets
    where code = upper(trim(coalesce(p_admin_market_code, '')))
      and status in ('PREPARING','PILOT','ACTIVE','SCALING');
    if v_admin_market_id is null then
      raise exception 'VALID_ADMIN_MARKET_REQUIRED';
    end if;

    insert into public.account_capabilities(profile_id, capability)
    values (v_profile_id, 'ADMIN')
    on conflict (profile_id, capability) do update set revoked_at = null;

    insert into public.admin_scope_assignments(
      profile_id, permission, scope_type, market_id, granted_by
    ) values (
      v_profile_id, 'MARKET_OPERATIONS', 'MARKET', v_admin_market_id, v_profile_id
    );
  elsif p_persona = 'PLATFORM_ADMIN' then
    insert into public.account_capabilities(profile_id, capability)
    values (v_profile_id, 'ADMIN')
    on conflict (profile_id, capability) do update set revoked_at = null;

    insert into public.admin_scope_assignments(
      profile_id, permission, scope_type, granted_by
    ) values (
      v_profile_id, 'PLATFORM_ADMIN', 'PLATFORM', v_profile_id
    );
  end if;
  insert into public.audit_events(
    actor_profile_id, market_id, action, entity_type, entity_id, metadata
  ) values (
    v_profile_id,
    coalesce(v_admin_market_id, v_home_market_id),
    'TEST_PERSONA_BOOTSTRAPPED',
    'PROFILE',
    v_profile_id,
    jsonb_build_object('persona', p_persona, 'test_email', trim(p_test_email))
  );

  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'display_name', trim(p_display_name),
    'test_email', trim(p_test_email),
    'persona', p_persona,
    'home_market_id', v_home_market_id,
    'admin_market_id', v_admin_market_id
  );
  return v_result;
end;
$$;

revoke all on function private.dev_bootstrap_test_persona(
  text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function private.dev_bootstrap_test_persona(
  text, text, text, text, text, text
) to authenticated;
create function public.dev_bootstrap_test_persona(
  p_bootstrap_secret text,
  p_display_name text,
  p_test_email text,
  p_persona text,
  p_home_market_code text default null,
  p_admin_market_code text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.dev_bootstrap_test_persona(
    p_bootstrap_secret,
    p_display_name,
    p_test_email,
    p_persona,
    p_home_market_code,
    p_admin_market_code
  );
$$;

revoke all on function public.dev_bootstrap_test_persona(
  text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.dev_bootstrap_test_persona(
  text, text, text, text, text, text
) to authenticated;
