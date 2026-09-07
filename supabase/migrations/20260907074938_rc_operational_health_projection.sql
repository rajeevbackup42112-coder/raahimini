create or replace function private.get_operational_health_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_can_global boolean:=false;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists(select 1 from public.account_capabilities c where c.profile_id=v_uid and c.capability='ADMIN' and c.revoked_at is null) then
    raise exception 'ADMIN_CAPABILITY_REQUIRED';
  end if;

  select exists(
    select 1 from public.admin_scope_assignments a
    where a.profile_id=v_uid and a.revoked_at is null
      and a.permission='PLATFORM_ADMIN' and a.scope_type='PLATFORM'
  ) into v_can_global;

  with visible_markets as (
    select distinct m.id,m.code,m.name,m.status,m.state_code
    from public.markets m
    join public.admin_scope_assignments a on a.profile_id=v_uid and a.revoked_at is null
    where a.permission in ('MARKET_OPERATIONS','STATE_OPERATIONS','SUPPORT','PLATFORM_ADMIN')
      and (
        a.scope_type='PLATFORM'
        or (a.scope_type='MARKET' and a.market_id=m.id)
        or (a.scope_type='STATE' and a.state_code=m.state_code)
      )
  ), market_health as (
    select vm.*,
      (select count(*) from public.service_products p where p.market_id=vm.id) as product_count,
      (select count(*) from public.service_products p join public.market_feature_flags f on f.market_id=p.market_id and f.flag_key='product_'||lower(p.code) where p.market_id=vm.id and p.status in ('PILOT','ACTIVE') and f.enabled) as enabled_product_count,
      (select count(*) from public.fixed_passenger_requests r join public.service_products p on p.id=r.product_id where p.market_id=vm.id and r.status='QUEUED') as fixed_queued_requests,
      (select min(r.queued_at) from public.fixed_passenger_requests r join public.service_products p on p.id=r.product_id where p.market_id=vm.id and r.status='QUEUED') as oldest_fixed_queued_at,
      (select count(*) from public.fixed_passenger_requests r join public.service_products p on p.id=r.product_id where p.market_id=vm.id and r.status='QUEUED' and r.match_skip_count>0) as fixed_skipped_requests,
      (select count(*) from public.rides r where r.origin_market_id=vm.id and r.status not in ('COMPLETED','CANCELLED','DRIVER_FAILED','SYSTEM_EXCEPTION')) as live_rides,
      (select count(*) from public.rides r where r.origin_market_id=vm.id and r.status in ('DRIVER_FAILED','SYSTEM_EXCEPTION')) as exception_rides,
      (select count(*) from public.rides r where r.origin_market_id=vm.id and r.status not in ('COMPLETED','CANCELLED','DRIVER_FAILED','SYSTEM_EXCEPTION') and r.commitment_ends_at is not null and r.commitment_ends_at<now()) as overdue_rides,
      (select count(*) from public.mobility_commitments c where c.origin_market_id=vm.id and c.status in ('RESERVED','ACTIVE')) as active_commitments,
      (select count(*) from public.mobility_commitments c where c.origin_market_id=vm.id and c.status in ('RESERVED','ACTIVE') and c.ends_at<now()) as overdue_commitments,
      (select count(*) from public.cases c where c.origin_market_id=vm.id and c.status not in ('RESOLVED','CLOSED_NO_ACTION','DUPLICATE','UNABLE_TO_DETERMINE')) as unresolved_cases,
      (select count(*) from public.cases c where c.origin_market_id=vm.id and c.status='ESCALATED') as escalated_cases,
      (select count(*) from public.payment_acknowledgements pa join public.rides r on r.id=pa.ride_id where r.origin_market_id=vm.id and pa.status='PAYMENT_DISPUTED') as payment_disputes,
      (select count(*) from public.payment_acknowledgements pa join public.rides r on r.id=pa.ride_id where r.origin_market_id=vm.id and pa.status='DUE' and pa.created_at<now()-interval '24 hours') as due_over_24h,
      (select count(*) from public.payment_acknowledgements pa join public.rides r on r.id=pa.ride_id where r.origin_market_id=vm.id and pa.status='PASSENGER_MARKED_PAID' and pa.updated_at<now()-interval '12 hours') as marked_paid_over_12h,
      (select count(*) from public.ride_events e join public.rides r on r.id=e.ride_id where r.origin_market_id=vm.id and e.occurred_at>=now()-interval '24 hours' and e.metadata ? 'accuracy_meters') as accepted_gps_samples_24h,
      (select max(case when e.metadata ? 'accuracy_meters' and (e.metadata->>'accuracy_meters') ~ '^[0-9]+([.][0-9]+)?$' then (e.metadata->>'accuracy_meters')::numeric end) from public.ride_events e join public.rides r on r.id=e.ride_id where r.origin_market_id=vm.id and e.occurred_at>=now()-interval '24 hours') as worst_accepted_gps_accuracy_meters_24h,
      (select max(e.occurred_at) from public.ride_events e join public.rides r on r.id=e.ride_id where r.origin_market_id=vm.id) as latest_ride_event_at,
      (select max(ci.created_at) from public.command_idempotency ci join public.service_products p on ci.actor_scope='system:fixed-match:'||p.id::text where p.market_id=vm.id and ci.command_name='match_fixed_product') as latest_fixed_match_command_at
    from visible_markets vm
  )
  select jsonb_build_object(
    'generated_at',now(),
    'can_view_global',v_can_global,
    'thresholds',jsonb_build_object('stuck_command_minutes',5,'due_payment_hours',24,'marked_paid_wait_hours',12),
    'global',case when v_can_global then jsonb_build_object(
      'stuck_commands_over_5m',(select count(*) from public.command_idempotency c where c.status='IN_PROGRESS' and c.created_at<now()-interval '5 minutes'),
      'failed_commands_24h',(select count(*) from public.command_idempotency c where c.status='FAILED' and c.created_at>=now()-interval '24 hours'),
      'commands_24h',(select count(*) from public.command_idempotency c where c.created_at>=now()-interval '24 hours')
    ) else null end,
    'telemetry_coverage',jsonb_build_array(
      jsonb_build_object('key','command_ledger','status','AVAILABLE','detail','Idempotent command state is persisted and queryable.'),
      jsonb_build_object('key','accepted_gps_evidence','status','AVAILABLE','detail','Accepted arrival/completion GPS accuracy and zone evidence is persisted in Ride events.'),
      jsonb_build_object('key','support_cases','status','AVAILABLE','detail','Support and payment exceptions are persisted as Cases and payment acknowledgement state.'),
      jsonb_build_object('key','notification_delivery','status','GAP','detail','External notification delivery outcomes are not persisted in Raahi Next yet.'),
      jsonb_build_object('key','rejected_gps_attempts','status','GAP','detail','Rejected GPS attempts are returned to callers but are not persisted as operational observations yet.')
    ),
    'markets',coalesce((select jsonb_agg(jsonb_build_object(
      'market_id',h.id,'market_code',h.code,'market_name',h.name,'market_status',h.status,
      'product_count',h.product_count,'enabled_product_count',h.enabled_product_count,
      'fixed_queued_requests',h.fixed_queued_requests,'oldest_fixed_queued_at',h.oldest_fixed_queued_at,'fixed_skipped_requests',h.fixed_skipped_requests,
      'live_rides',h.live_rides,'exception_rides',h.exception_rides,'overdue_rides',h.overdue_rides,
      'active_commitments',h.active_commitments,'overdue_commitments',h.overdue_commitments,
      'unresolved_cases',h.unresolved_cases,'escalated_cases',h.escalated_cases,
      'payment_disputes',h.payment_disputes,'due_over_24h',h.due_over_24h,'marked_paid_over_12h',h.marked_paid_over_12h,
      'accepted_gps_samples_24h',h.accepted_gps_samples_24h,'worst_accepted_gps_accuracy_meters_24h',h.worst_accepted_gps_accuracy_meters_24h,
      'latest_ride_event_at',h.latest_ride_event_at,'latest_fixed_match_command_at',h.latest_fixed_match_command_at
    ) order by h.name) from market_health h),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;$$;
revoke all on function private.get_operational_health_workspace() from public,anon,authenticated;
grant execute on function private.get_operational_health_workspace() to authenticated;

create or replace function public.get_operational_health_workspace()
returns jsonb language sql stable set search_path=''
as $$ select private.get_operational_health_workspace(); $$;
revoke all on function public.get_operational_health_workspace() from public,anon;
grant execute on function public.get_operational_health_workspace() to authenticated;