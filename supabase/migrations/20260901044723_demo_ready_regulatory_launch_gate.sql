-- Raahi regulatory launch gate.
-- Public browsing/recruitment stays open; real transactions require public enablement or an explicit pilot account.

create table if not exists public.raahi_launch_control (
  id smallint primary key default 1 check (id=1),
  public_transactions_enabled boolean not null default false,
  public_message text not null default 'Raahi is preparing a verified local Driver network. Browsing and Driver registration are open; real ride transactions remain in a controlled pilot while regulatory clearance is completed.',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.raahi_launch_control(id,public_transactions_enabled)
values(1,false) on conflict(id) do nothing;

create table if not exists public.raahi_transaction_pilot_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_enabled boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.raahi_launch_control enable row level security;
alter table public.raahi_transaction_pilot_users enable row level security;
revoke all on public.raahi_launch_control from public,anon,authenticated;
revoke all on public.raahi_transaction_pilot_users from public,anon,authenticated;
create or replace function public.get_raahi_transaction_access()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_enabled boolean:=false; v_message text; v_pilot boolean:=false;
begin
  select public_transactions_enabled,public_message into v_enabled,v_message
  from public.raahi_launch_control where id=1;
  if auth.uid() is not null then
    select exists(select 1 from public.raahi_transaction_pilot_users p where p.user_id=auth.uid() and p.is_enabled) into v_pilot;
  end if;
  return jsonb_build_object(
    'public_transactions_enabled',coalesce(v_enabled,false),
    'pilot_account',coalesce(v_pilot,false),
    'can_transact',coalesce(v_enabled,false) or coalesce(v_pilot,false),
    'mode',case when coalesce(v_enabled,false) then 'PUBLIC' when coalesce(v_pilot,false) then 'PILOT' else 'BROWSE_ONLY' end,
    'message',coalesce(v_message,'Raahi ride transactions are not open to the public yet.')
  );
end; $$;

create or replace function public.can_raahi_user_transact(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select public_transactions_enabled from public.raahi_launch_control where id=1),false)
    or exists(select 1 from public.raahi_transaction_pilot_users p where p.user_id=p_user_id and p.is_enabled);
$$;

revoke all on function public.get_raahi_transaction_access() from public;
grant execute on function public.get_raahi_transaction_access() to anon,authenticated;
revoke all on function public.can_raahi_user_transact(uuid) from public,anon,authenticated;
create or replace function public.admin_set_raahi_public_transactions(p_enabled boolean,p_message text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  update public.raahi_launch_control set
    public_transactions_enabled=coalesce(p_enabled,false),
    public_message=coalesce(nullif(trim(p_message),''),public_message),
    updated_at=now(),updated_by=auth.uid()
  where id=1;
  perform public.record_audit('admin_set_raahi_public_transactions','raahi_launch_control',null,null,
    jsonb_build_object('public_transactions_enabled',coalesce(p_enabled,false)),null);
  return jsonb_build_object('success',true,'public_transactions_enabled',coalesce(p_enabled,false));
end; $$;

create or replace function public.admin_set_raahi_pilot_user(p_user_id uuid,p_enabled boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then return jsonb_build_object('success',false,'error','User not found'); end if;
  insert into public.raahi_transaction_pilot_users(user_id,is_enabled,note,created_by,updated_at)
  values(p_user_id,coalesce(p_enabled,false),nullif(trim(coalesce(p_note,'')),''),auth.uid(),now())
  on conflict(user_id) do update set is_enabled=excluded.is_enabled,note=excluded.note,updated_at=now();
  return jsonb_build_object('success',true,'user_id',p_user_id,'is_enabled',coalesce(p_enabled,false));
end; $$;

revoke all on function public.admin_set_raahi_public_transactions(boolean,text) from public,anon,service_role;
revoke all on function public.admin_set_raahi_pilot_user(uuid,boolean,text) from public,anon,service_role;
grant execute on function public.admin_set_raahi_public_transactions(boolean,text) to authenticated;
grant execute on function public.admin_set_raahi_pilot_user(uuid,boolean,text) to authenticated;
create or replace function public.enforce_raahi_regulatory_launch_gate()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_requires_gate boolean:=false;
begin
  if v_uid is null then return new; end if;

  if tg_table_name in ('seat_requests','driver_queue') and tg_op='INSERT' then
    v_requires_gate:=true;
  elsif tg_table_name='outstation_requests' then
    v_requires_gate:=tg_op='INSERT' or (tg_op='UPDATE' and new.accepted_quote_id is not null and new.accepted_quote_id is distinct from old.accepted_quote_id);
  elsif tg_table_name='outstation_quotes' then
    v_requires_gate:=tg_op='INSERT' or (tg_op='UPDATE' and new.status='OFFERED' and (
      new.total_price is distinct from old.total_price or new.includes_tolls is distinct from old.includes_tolls
      or new.includes_parking is distinct from old.includes_parking or new.driver_note is distinct from old.driver_note
    ));
  end if;

  if v_requires_gate and not public.can_raahi_user_transact(v_uid) then
    raise exception 'RAAHI_TRANSACTION_PILOT_ONLY' using errcode='P0001';
  end if;
  return new;
end; $$;
revoke all on function public.enforce_raahi_regulatory_launch_gate() from public,anon,authenticated;

drop trigger if exists regulatory_launch_seat_requests on public.seat_requests;
create trigger regulatory_launch_seat_requests before insert on public.seat_requests
for each row execute function public.enforce_raahi_regulatory_launch_gate();
drop trigger if exists regulatory_launch_outstation_requests on public.outstation_requests;
create trigger regulatory_launch_outstation_requests
before insert or update of accepted_quote_id on public.outstation_requests
for each row execute function public.enforce_raahi_regulatory_launch_gate();

drop trigger if exists regulatory_launch_driver_queue on public.driver_queue;
create trigger regulatory_launch_driver_queue before insert on public.driver_queue
for each row execute function public.enforce_raahi_regulatory_launch_gate();

drop trigger if exists regulatory_launch_outstation_quotes on public.outstation_quotes;
create trigger regulatory_launch_outstation_quotes before insert or update on public.outstation_quotes
for each row execute function public.enforce_raahi_regulatory_launch_gate();
