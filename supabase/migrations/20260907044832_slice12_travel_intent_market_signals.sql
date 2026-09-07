create table public.travel_intents (
  id uuid primary key default gen_random_uuid(),
  passenger_profile_id uuid not null references public.profiles(id) on delete cascade,
  origin_location_id uuid not null references public.locations(id),
  destination_location_id uuid not null references public.locations(id),
  origin_market_id uuid references public.markets(id),
  desired_departure_at timestamptz,
  desired_window_end_at timestamptz,
  seat_count integer not null default 1 check (seat_count between 1 and 12),
  acceptable_service_type text not null default 'ANY' check (acceptable_service_type in ('ANY','FIXED_ONE_WAY','FIXED_ROUND_TRIP','OUTSTATION','CARPOOL','RAAHI_TRIP')),
  notification_interest boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED','RESOLVED')),
  resolved_product_id uuid references public.service_products(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (origin_location_id <> destination_location_id),
  check (desired_window_end_at is null or (desired_departure_at is not null and desired_window_end_at >= desired_departure_at)),
  check ((status='RESOLVED' and resolved_product_id is not null) or status<>'RESOLVED')
);

create unique index uq_travel_intents_active_exact
on public.travel_intents(passenger_profile_id,origin_location_id,destination_location_id,coalesce(desired_departure_at,'infinity'::timestamptz),acceptable_service_type)
where status='ACTIVE';
create index idx_travel_intents_passenger_status on public.travel_intents(passenger_profile_id,status,created_at desc);
create index idx_travel_intents_market_corridor on public.travel_intents(origin_market_id,origin_location_id,destination_location_id,created_at desc) where status='ACTIVE';
create index idx_travel_intents_destination on public.travel_intents(destination_location_id,created_at desc) where status='ACTIVE';
create index idx_travel_intents_resolved_product on public.travel_intents(resolved_product_id) where resolved_product_id is not null;
create trigger travel_intents_set_updated_at before update on public.travel_intents for each row execute function private.set_updated_at();

create table public.emerging_corridor_opportunities (
  id uuid primary key default gen_random_uuid(),
  origin_market_id uuid not null references public.markets(id),
  origin_location_id uuid not null references public.locations(id),
  destination_location_id uuid not null references public.locations(id),
  status text not null default 'DEMAND_SIGNALLED' check (status in ('DEMAND_SIGNALLED','UNDER_EVALUATION','PILOT_APPROVED','PILOT','ACTIVE','PAUSED','RETIRED')),
  signalled_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(origin_market_id,origin_location_id,destination_location_id),
  check (origin_location_id <> destination_location_id)
);
create index idx_emerging_corridor_market_status on public.emerging_corridor_opportunities(origin_market_id,status,signalled_at desc);
create index idx_emerging_corridor_destination on public.emerging_corridor_opportunities(destination_location_id);
create index idx_emerging_corridor_reviewed_by on public.emerging_corridor_opportunities(reviewed_by) where reviewed_by is not null;
create trigger emerging_corridor_set_updated_at before update on public.emerging_corridor_opportunities for each row execute function private.set_updated_at();

alter table public.travel_intents enable row level security;
alter table public.emerging_corridor_opportunities enable row level security;
revoke all on public.travel_intents from public,anon,authenticated;
revoke all on public.emerging_corridor_opportunities from public,anon,authenticated;
create policy travel_intents_no_direct_client_access on public.travel_intents for all to anon,authenticated using(false) with check(false);
create policy emerging_corridor_no_direct_client_access on public.emerging_corridor_opportunities for all to anon,authenticated using(false) with check(false);

create or replace function private.ensure_emerging_corridor_signal(p_market_id uuid,p_origin_location_id uuid,p_destination_location_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if p_market_id is null then return null; end if;
 insert into public.emerging_corridor_opportunities(origin_market_id,origin_location_id,destination_location_id,status)
 values(p_market_id,p_origin_location_id,p_destination_location_id,'DEMAND_SIGNALLED')
 on conflict(origin_market_id,origin_location_id,destination_location_id) do update set updated_at=public.emerging_corridor_opportunities.updated_at
 returning id into v_id;
 return v_id;
end; $$;
revoke all on function private.ensure_emerging_corridor_signal(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.create_travel_intent(
 p_origin_location_id uuid,p_destination_location_id uuid,p_desired_departure_at timestamptz,p_desired_window_end_at timestamptz,p_seat_count integer,p_acceptable_service_type text,p_notification_interest boolean,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_profile uuid:=auth.uid(); v_origin public.locations%rowtype; v_destination public.locations%rowtype; v_idem public.command_idempotency; v_hash text; v_existing public.travel_intents%rowtype; v_id uuid:=gen_random_uuid(); v_limit int:=20; v_count int; v_result jsonb;
begin
 if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
 v_hash:=md5(concat_ws('|',p_origin_location_id,p_destination_location_id,p_desired_departure_at,p_desired_window_end_at,p_seat_count,p_acceptable_service_type,p_notification_interest));
 v_idem:=private.claim_user_command('create_travel_intent',p_idempotency_key,v_hash); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_origin from public.locations where id=p_origin_location_id and is_active; if not found then raise exception 'TRAVEL_INTENT_ORIGIN_INVALID'; end if;
 select * into v_destination from public.locations where id=p_destination_location_id and is_active; if not found then raise exception 'TRAVEL_INTENT_DESTINATION_INVALID'; end if;
 if p_origin_location_id=p_destination_location_id then raise exception 'TRAVEL_INTENT_SAME_LOCATION'; end if;
 if p_seat_count is null or p_seat_count<1 or p_seat_count>12 then raise exception 'TRAVEL_INTENT_SEAT_COUNT_INVALID'; end if;
 if p_acceptable_service_type not in ('ANY','FIXED_ONE_WAY','FIXED_ROUND_TRIP','OUTSTATION','CARPOOL','RAAHI_TRIP') then raise exception 'TRAVEL_INTENT_SERVICE_INVALID'; end if;
 if p_desired_window_end_at is not null and (p_desired_departure_at is null or p_desired_window_end_at<p_desired_departure_at) then raise exception 'TRAVEL_INTENT_WINDOW_INVALID'; end if;
 select * into v_existing from public.travel_intents t where t.passenger_profile_id=v_profile and t.origin_location_id=p_origin_location_id and t.destination_location_id=p_destination_location_id and t.desired_departure_at is not distinct from p_desired_departure_at and t.acceptable_service_type=p_acceptable_service_type and t.status='ACTIVE' limit 1 for update;
 if found then
  v_result:=jsonb_build_object('intent_id',v_existing.id,'status',v_existing.status,'deduplicated',true,'notification_interest',v_existing.notification_interest,'creates_booking',false);
  return private.complete_user_command(v_idem.id,v_result);
 end if;
 if v_origin.market_id is not null then
  select greatest(1,least(100,coalesce(nullif(f.config->>'max_intents_per_user_24h','')::int,20))) into v_limit from public.market_feature_flags f where f.market_id=v_origin.market_id and f.flag_key='travel_intent';
  v_limit:=coalesce(v_limit,20);
 end if;
 select count(*) into v_count from public.travel_intents t where t.passenger_profile_id=v_profile and t.created_at>=now()-interval '24 hours';
 if v_count>=v_limit then raise exception 'TRAVEL_INTENT_RATE_LIMITED'; end if;
 insert into public.travel_intents(id,passenger_profile_id,origin_location_id,destination_location_id,origin_market_id,desired_departure_at,desired_window_end_at,seat_count,acceptable_service_type,notification_interest,status)
 values(v_id,v_profile,p_origin_location_id,p_destination_location_id,v_origin.market_id,p_desired_departure_at,p_desired_window_end_at,p_seat_count,p_acceptable_service_type,p_notification_interest,'ACTIVE');
 perform private.ensure_emerging_corridor_signal(v_origin.market_id,p_origin_location_id,p_destination_location_id);
 v_result:=jsonb_build_object('intent_id',v_id,'status','ACTIVE','deduplicated',false,'origin_market_id',v_origin.market_id,'seat_count',p_seat_count,'acceptable_service_type',p_acceptable_service_type,'notification_interest',p_notification_interest,'creates_booking',false);
 return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.create_travel_intent(uuid,uuid,timestamptz,timestamptz,integer,text,boolean,text) from public,anon,authenticated;
grant execute on function private.create_travel_intent(uuid,uuid,timestamptz,timestamptz,integer,text,boolean,text) to authenticated;
create or replace function public.create_travel_intent(p_origin_location_id uuid,p_destination_location_id uuid,p_desired_departure_at timestamptz,p_desired_window_end_at timestamptz,p_seat_count integer,p_acceptable_service_type text,p_notification_interest boolean,p_idempotency_key text)
returns jsonb language sql security invoker set search_path='' as $$ select private.create_travel_intent(p_origin_location_id,p_destination_location_id,p_desired_departure_at,p_desired_window_end_at,p_seat_count,p_acceptable_service_type,p_notification_interest,p_idempotency_key); $$;
revoke all on function public.create_travel_intent(uuid,uuid,timestamptz,timestamptz,integer,text,boolean,text) from public,anon,authenticated;
grant execute on function public.create_travel_intent(uuid,uuid,timestamptz,timestamptz,integer,text,boolean,text) to authenticated;

create or replace function private.cancel_travel_intent(p_intent_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_i public.travel_intents%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
 v_idem:=private.claim_user_command('cancel_travel_intent',p_idempotency_key,md5(p_intent_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_i from public.travel_intents where id=p_intent_id and passenger_profile_id=v_profile for update; if not found then raise exception 'TRAVEL_INTENT_NOT_FOUND'; end if;
 if v_i.status='CANCELLED' then v_result:=jsonb_build_object('intent_id',v_i.id,'status','CANCELLED'); return private.complete_user_command(v_idem.id,v_result); end if;
 if v_i.status<>'ACTIVE' then raise exception 'TRAVEL_INTENT_NOT_CANCELLABLE'; end if;
 update public.travel_intents set status='CANCELLED',cancelled_at=now(),updated_at=now() where id=v_i.id;
 v_result:=jsonb_build_object('intent_id',v_i.id,'status','CANCELLED'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.cancel_travel_intent(uuid,text) from public,anon,authenticated;
grant execute on function private.cancel_travel_intent(uuid,text) to authenticated;
create or replace function public.cancel_travel_intent(p_intent_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.cancel_travel_intent(p_intent_id,p_idempotency_key); $$;
revoke all on function public.cancel_travel_intent(uuid,text) from public,anon,authenticated; grant execute on function public.cancel_travel_intent(uuid,text) to authenticated;

create or replace function private.update_intent_notification_preference(p_intent_id uuid,p_notification_interest boolean,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile uuid:=auth.uid(); v_i public.travel_intents%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 if v_profile is null or not private.has_capability('PASSENGER') then raise exception 'PASSENGER_CAPABILITY_REQUIRED'; end if;
 v_idem:=private.claim_user_command('update_intent_notification_preference',p_idempotency_key,md5(concat_ws('|',p_intent_id,p_notification_interest))); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_i from public.travel_intents where id=p_intent_id and passenger_profile_id=v_profile for update; if not found then raise exception 'TRAVEL_INTENT_NOT_FOUND'; end if;
 if v_i.status<>'ACTIVE' then raise exception 'TRAVEL_INTENT_NOT_ACTIVE'; end if;
 update public.travel_intents set notification_interest=p_notification_interest,updated_at=now() where id=v_i.id;
 v_result:=jsonb_build_object('intent_id',v_i.id,'status','ACTIVE','notification_interest',p_notification_interest); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.update_intent_notification_preference(uuid,boolean,text) from public,anon,authenticated;
grant execute on function private.update_intent_notification_preference(uuid,boolean,text) to authenticated;
create or replace function public.update_intent_notification_preference(p_intent_id uuid,p_notification_interest boolean,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.update_intent_notification_preference(p_intent_id,p_notification_interest,p_idempotency_key); $$;
revoke all on function public.update_intent_notification_preference(uuid,boolean,text) from public,anon,authenticated; grant execute on function public.update_intent_notification_preference(uuid,boolean,text) to authenticated;

create or replace function private.get_my_travel_intents()
returns jsonb language sql security definer stable set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object('intent_id',t.id,'status',t.status,'origin_location_id',t.origin_location_id,'origin_name',o.name,'destination_location_id',t.destination_location_id,'destination_name',d.name,'desired_departure_at',t.desired_departure_at,'desired_window_end_at',t.desired_window_end_at,'seat_count',t.seat_count,'acceptable_service_type',t.acceptable_service_type,'notification_interest',t.notification_interest,'created_at',t.created_at,'resolved_product_id',t.resolved_product_id) order by t.created_at desc),'[]'::jsonb)
 from public.travel_intents t join public.locations o on o.id=t.origin_location_id join public.locations d on d.id=t.destination_location_id where t.passenger_profile_id=auth.uid();
$$;
revoke all on function private.get_my_travel_intents() from public,anon,authenticated; grant execute on function private.get_my_travel_intents() to authenticated;
create or replace function public.get_my_travel_intents() returns jsonb language sql security invoker stable set search_path='' as $$ select private.get_my_travel_intents(); $$;
revoke all on function public.get_my_travel_intents() from public,anon,authenticated; grant execute on function public.get_my_travel_intents() to authenticated;

create or replace function private.get_market_intelligence_context()
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_result jsonb;
begin
 if v_uid is null or not private.has_capability('ADMIN') then raise exception 'ADMIN_CAPABILITY_REQUIRED'; end if;
 select jsonb_build_object('markets',coalesce(jsonb_agg(jsonb_build_object('market_id',x.id,'code',x.code,'name',x.name,'status',x.status,'state_code',x.state_code) order by x.name),'[]'::jsonb)) into v_result
 from (select distinct m.id,m.code,m.name,m.status,m.state_code from public.markets m join public.admin_scope_assignments a on a.profile_id=v_uid and a.revoked_at is null where m.status in ('PREPARING','PILOT','ACTIVE','SCALING','PAUSED') and (a.scope_type='PLATFORM' or (a.scope_type='STATE' and a.state_code=m.state_code) or (a.scope_type='MARKET' and a.market_id=m.id)) and a.permission in ('MARKET_OPERATIONS','STATE_OPERATIONS','PLATFORM_ADMIN')) x;
 return v_result;
end; $$;
revoke all on function private.get_market_intelligence_context() from public,anon,authenticated; grant execute on function private.get_market_intelligence_context() to authenticated;
create or replace function public.get_market_intelligence_context() returns jsonb language sql security invoker stable set search_path='' as $$ select private.get_market_intelligence_context(); $$;
revoke all on function public.get_market_intelligence_context() from public,anon,authenticated; grant execute on function public.get_market_intelligence_context() to authenticated;

create or replace function private.get_market_opportunity_signals(p_market_id uuid)
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not (private.has_admin_permission('MARKET_OPERATIONS',p_market_id) or private.has_admin_permission('STATE_OPERATIONS',p_market_id)) then raise exception 'ADMIN_SCOPE_REQUIRED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('opportunity_id',q.opportunity_id,'status',q.status,'origin_location_id',q.origin_location_id,'origin_name',q.origin_name,'destination_location_id',q.destination_location_id,'destination_name',q.destination_name,'intent_count',q.intent_count,'seat_demand',q.seat_demand,'notification_interest_count',q.notification_interest_count,'desired_next_7d',q.desired_next_7d,'desired_next_30d',q.latest_intent_at,'latest_intent_at',q.latest_intent_at,'signalled_at',q.signalled_at,'reviewed_at',q.reviewed_at) order by q.intent_count desc,q.latest_intent_at desc nulls last),'[]'::jsonb) into v_result
 from (select e.id opportunity_id,e.status,e.origin_location_id,o.name origin_name,e.destination_location_id,d.name destination_name,e.signalled_at,e.reviewed_at,count(t.id) filter(where t.status='ACTIVE')::int intent_count,coalesce(sum(t.seat_count) filter(where t.status='ACTIVE'),0)::int seat_demand,count(t.id) filter(where t.status='ACTIVE' and t.notification_interest)::int notification_interest_count,count(t.id) filter(where t.status='ACTIVE' and t.desired_departure_at>=now() and t.desired_departure_at<now()+interval '7 days')::int desired_next_7d,count(t.id) filter(where t.status='ACTIVE' and t.desired_departure_at>=now() and t.desired_departure_at<now()+interval '30 days')::int desired_next_30d,max(t.created_at) filter(where t.status='ACTIVE') latest_intent_at from public.emerging_corridor_opportunities e join public.locations o on o.id=e.origin_location_id join public.locations d on d.id=e.destination_location_id left join public.travel_intents t on t.origin_market_id=e.origin_market_id and t.origin_location_id=e.origin_location_id and t.destination_location_id=e.destination_location_id where e.origin_market_id=p_market_id group by e.id,e.status,e.origin_location_id,o.name,e.destination_location_id,d.name,e.signalled_at,e.reviewed_at) q;
 return v_result;
end; $$;
revoke all on function private.get_market_opportunity_signals(uuid) from public,anon,authenticated; grant execute on function private.get_market_opportunity_signals(uuid) to authenticated;
create or replace function public.get_market_opportunity_signals(p_market_id uuid) returns jsonb language sql security invoker stable set search_path='' as $$ select private.get_market_opportunity_signals(p_market_id); $$;
revoke all on function public.get_market_opportunity_signals(uuid) from public,anon,authenticated; grant execute on function public.get_market_opportunity_signals(uuid) to authenticated;

create or replace function private.admin_begin_emerging_corridor_review(p_opportunity_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_o public.emerging_corridor_opportunities%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 v_idem:=private.claim_user_command('admin_begin_emerging_corridor_review',p_idempotency_key,md5(p_opportunity_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_o from public.emerging_corridor_opportunities where id=p_opportunity_id for update; if not found then raise exception 'EMERGING_CORRIDOR_NOT_FOUND'; end if;
 if not (private.has_admin_permission('MARKET_OPERATIONS',v_o.origin_market_id) or private.has_admin_permission('STATE_OPERATIONS',v_o.origin_market_id)) then raise exception 'ADMIN_SCOPE_REQUIRED'; end if;
 if v_o.status='UNDER_EVALUATION' then v_result:=jsonb_build_object('opportunity_id',v_o.id,'status',v_o.status); return private.complete_user_command(v_idem.id,v_result); end if;
 if v_o.status<>'DEMAND_SIGNALLED' then raise exception 'EMERGING_CORRIDOR_TRANSITION_INVALID'; end if;
 update public.emerging_corridor_opportunities set status='UNDER_EVALUATION',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=v_o.id;
 insert into public.audit_events(actor_profile_id,market_id,action,entity_type,entity_id,metadata) values(auth.uid(),v_o.origin_market_id,'EMERGING_CORRIDOR_REVIEW_STARTED','EMERGING_CORRIDOR_OPPORTUNITY',v_o.id,jsonb_build_object('origin_location_id',v_o.origin_location_id,'destination_location_id',v_o.destination_location_id));
 v_result:=jsonb_build_object('opportunity_id',v_o.id,'status','UNDER_EVALUATION'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_begin_emerging_corridor_review(uuid,text) from public,anon,authenticated; grant execute on function private.admin_begin_emerging_corridor_review(uuid,text) to authenticated;
create or replace function public.admin_begin_emerging_corridor_review(p_opportunity_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_begin_emerging_corridor_review(p_opportunity_id,p_idempotency_key); $$;
revoke all on function public.admin_begin_emerging_corridor_review(uuid,text) from public,anon,authenticated; grant execute on function public.admin_begin_emerging_corridor_review(uuid,text) to authenticated;