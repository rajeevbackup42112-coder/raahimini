create or replace function private.get_market_opportunity_signals(p_market_id uuid)
returns jsonb language plpgsql security definer stable set search_path=''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not (private.has_admin_permission('MARKET_OPERATIONS',p_market_id) or private.has_admin_permission('STATE_OPERATIONS',p_market_id)) then raise exception 'ADMIN_SCOPE_REQUIRED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'opportunity_id',q.opportunity_id,
   'status',q.status,
   'origin_location_id',q.origin_location_id,
   'origin_name',q.origin_name,
   'destination_location_id',q.destination_location_id,
   'destination_name',q.destination_name,
   'intent_count',q.intent_count,
   'seat_demand',q.seat_demand,
   'notification_interest_count',q.notification_interest_count,
   'desired_next_7d',q.desired_next_7d,
   'desired_next_30d',q.desired_next_30d,
   'latest_intent_at',q.latest_intent_at,
   'signalled_at',q.signalled_at,
   'reviewed_at',q.reviewed_at
 ) order by q.intent_count desc,q.latest_intent_at desc nulls last),'[]'::jsonb) into v_result
 from (
   select e.id opportunity_id,e.status,e.origin_location_id,o.name origin_name,e.destination_location_id,d.name destination_name,e.signalled_at,e.reviewed_at,
     count(t.id) filter(where t.status='ACTIVE')::int intent_count,
     coalesce(sum(t.seat_count) filter(where t.status='ACTIVE'),0)::int seat_demand,
     count(t.id) filter(where t.status='ACTIVE' and t.notification_interest)::int notification_interest_count,
     count(t.id) filter(where t.status='ACTIVE' and t.desired_departure_at>=now() and t.desired_departure_at<now()+interval '7 days')::int desired_next_7d,
     count(t.id) filter(where t.status='ACTIVE' and t.desired_departure_at>=now() and t.desired_departure_at<now()+interval '30 days')::int desired_next_30d,
     max(t.created_at) filter(where t.status='ACTIVE') latest_intent_at
   from public.emerging_corridor_opportunities e
   join public.locations o on o.id=e.origin_location_id
   join public.locations d on d.id=e.destination_location_id
   left join public.travel_intents t on t.origin_market_id=e.origin_market_id and t.origin_location_id=e.origin_location_id and t.destination_location_id=e.destination_location_id
   where e.origin_market_id=p_market_id
   group by e.id,e.status,e.origin_location_id,o.name,e.destination_location_id,d.name,e.signalled_at,e.reviewed_at
 ) q;
 return v_result;
end; $$;
revoke all on function private.get_market_opportunity_signals(uuid) from public,anon,authenticated;
grant execute on function private.get_market_opportunity_signals(uuid) to authenticated;