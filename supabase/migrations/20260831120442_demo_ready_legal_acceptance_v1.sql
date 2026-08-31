-- Raahi launch legal acceptance v1.
-- Browsing stays open; transactional Passenger/Driver actions require current documents.

create table if not exists public.user_legal_acceptances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  terms_version text,
  terms_accepted_at timestamptz,
  privacy_version text,
  privacy_accepted_at timestamptz,
  driver_terms_version text,
  driver_terms_accepted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_legal_acceptances enable row level security;
revoke all on public.user_legal_acceptances from public, anon, authenticated;

create or replace function public.get_my_legal_acceptance_state()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.user_legal_acceptances;
begin
  if auth.uid() is null then return jsonb_build_object('authenticated',false); end if;
  select * into v from public.user_legal_acceptances where user_id=auth.uid();
  return jsonb_build_object(
    'authenticated',true,
    'terms_version','2026-08-31-v1',
    'privacy_version','2026-08-31-v1',
    'driver_terms_version','2026-08-31-v1',
    'terms_current',coalesce(v.terms_version='2026-08-31-v1',false),
    'privacy_current',coalesce(v.privacy_version='2026-08-31-v1',false),
    'driver_terms_current',coalesce(v.driver_terms_version='2026-08-31-v1',false),
    'terms_accepted_at',v.terms_accepted_at,
    'privacy_accepted_at',v.privacy_accepted_at,
    'driver_terms_accepted_at',v.driver_terms_accepted_at
  );
end; $$;
create or replace function public.accept_my_legal_documents(
  p_accept_passenger boolean default false,
  p_accept_driver boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'error','Sign in required'); end if;
  if not coalesce(p_accept_passenger,false) and not coalesce(p_accept_driver,false) then
    return jsonb_build_object('success',false,'error','Choose the documents you agree to');
  end if;
  if coalesce(p_accept_driver,false) and not exists(select 1 from public.profiles where id=auth.uid() and role='driver') then
    return jsonb_build_object('success',false,'error','Driver Terms can only be accepted by a Driver account');
  end if;

  insert into public.user_legal_acceptances(user_id) values(auth.uid())
  on conflict(user_id) do nothing;

  if coalesce(p_accept_passenger,false) then
    update public.user_legal_acceptances set
      terms_accepted_at=case when terms_version='2026-08-31-v1' then terms_accepted_at else now() end, terms_version='2026-08-31-v1',
      privacy_accepted_at=case when privacy_version='2026-08-31-v1' then privacy_accepted_at else now() end, privacy_version='2026-08-31-v1', updated_at=now()
    where user_id=auth.uid();
  end if;

  if coalesce(p_accept_driver,false) then
    update public.user_legal_acceptances set
      terms_accepted_at=case when terms_version='2026-08-31-v1' then terms_accepted_at else now() end, terms_version='2026-08-31-v1',
      privacy_accepted_at=case when privacy_version='2026-08-31-v1' then privacy_accepted_at else now() end, privacy_version='2026-08-31-v1',
      driver_terms_version='2026-08-31-v1', driver_terms_accepted_at=now(), updated_at=now()
    where user_id=auth.uid();
  end if;

  perform public.record_audit('accept_legal_documents','user_legal_acceptances',auth.uid(),null,
    jsonb_build_object('passenger_documents',coalesce(p_accept_passenger,false),'driver_terms',coalesce(p_accept_driver,false),'version','2026-08-31-v1'),null);
  return jsonb_build_object('success',true,'state',public.get_my_legal_acceptance_state());
end; $$;

grant execute on function public.get_my_legal_acceptance_state() to authenticated;
grant execute on function public.accept_my_legal_documents(boolean,boolean) to authenticated;
create or replace function public.has_current_passenger_legal_acceptance(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.user_legal_acceptances a
    where a.user_id=p_user_id
      and a.terms_version='2026-08-31-v1'
      and a.privacy_version='2026-08-31-v1'
  );
$$;

create or replace function public.has_current_driver_legal_acceptance(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.user_legal_acceptances a
    where a.user_id=p_user_id
      and a.terms_version='2026-08-31-v1'
      and a.privacy_version='2026-08-31-v1'
      and a.driver_terms_version='2026-08-31-v1'
  );
$$;

revoke all on function public.has_current_passenger_legal_acceptance(uuid) from public, anon, authenticated;
revoke all on function public.has_current_driver_legal_acceptance(uuid) from public, anon, authenticated;

create or replace function public.enforce_legal_acceptance_v1()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then return new; end if;

  if tg_table_name='seat_requests' then
    if not public.has_current_passenger_legal_acceptance(v_uid) then raise exception 'LEGAL_ACCEPTANCE_REQUIRED:PASSENGER'; end if;
  elsif tg_table_name='outstation_requests' then
    if tg_op='INSERT' or (new.accepted_quote_id is not null and new.accepted_quote_id is distinct from old.accepted_quote_id) then
      if not public.has_current_passenger_legal_acceptance(v_uid) then raise exception 'LEGAL_ACCEPTANCE_REQUIRED:PASSENGER'; end if;
    end if;
  elsif tg_table_name in ('driver_queue','outstation_quotes') then
    if not public.has_current_driver_legal_acceptance(v_uid) then raise exception 'LEGAL_ACCEPTANCE_REQUIRED:DRIVER'; end if;
  end if;
  return new;
end; $$;
revoke all on function public.enforce_legal_acceptance_v1() from public, anon, authenticated;

drop trigger if exists legal_acceptance_seat_requests on public.seat_requests;
create trigger legal_acceptance_seat_requests
before insert on public.seat_requests
for each row execute function public.enforce_legal_acceptance_v1();

drop trigger if exists legal_acceptance_outstation_requests on public.outstation_requests;
create trigger legal_acceptance_outstation_requests
before insert or update of accepted_quote_id on public.outstation_requests
for each row execute function public.enforce_legal_acceptance_v1();

drop trigger if exists legal_acceptance_driver_queue on public.driver_queue;
create trigger legal_acceptance_driver_queue
before insert on public.driver_queue
for each row execute function public.enforce_legal_acceptance_v1();

drop trigger if exists legal_acceptance_outstation_quotes on public.outstation_quotes;
create trigger legal_acceptance_outstation_quotes
before insert on public.outstation_quotes
for each row execute function public.enforce_legal_acceptance_v1();
