-- Slice 8A: Fixed Round Trip catalog + shared Fixed-kernel service-type generalization.
-- Existing Fixed functions remain canonical; this migration changes only their
-- exact service-type eligibility predicate so One Way behavior is preserved.

insert into public.service_products(code,market_id,corridor_id,service_type,display_name,status,public_summary)
select 'GOMOH_DHANBAD_FIXED_RT', m.id, c.id, 'FIXED_ROUND_TRIP',
       'Gomoh to Dhanbad — Shared Round Trip', 'PILOT',
       'Shared round trip with the same Driver and Vehicle reserved through the return.'
from public.markets m
join public.locations o on o.market_id=m.id and o.code='GOMOH'
join public.locations d on d.code='DHANBAD'
join public.corridors c on c.origin_location_id=o.id and c.destination_location_id=d.id
where m.code='GOMOH'
on conflict (code) do nothing;

insert into public.service_product_rule_versions(product_id,version_no,rules)
select p.id,1,jsonb_build_object(
  'capacity_policy','FULL_CAPACITY','fare_per_seat_inr',300,'currency','INR',
  'max_seats_per_request',4,'driver_ack_seconds',120,'boarding_wait_minutes',10,
  'refill_window_minutes',5,'matcher_candidate_window',12,'commitment_horizon_minutes',420,
  'return_wait_minutes',120,'return_boarding_wait_minutes',10,
  'outbound_completion_zone_code','DHANBAD_CORE','outbound_completion_radius_meters',5000,
  'outbound_completion_max_accuracy_meters',200,'outbound_completion_max_location_age_seconds',60,
  'return_completion_zone_code','GOMOH_CORE','return_completion_radius_meters',5000,
  'return_completion_max_accuracy_meters',200,'return_completion_max_location_age_seconds',60
)
from public.service_products p where p.code='GOMOH_DHANBAD_FIXED_RT'
on conflict (product_id,version_no) do nothing;

update public.service_products set current_rules_version=1
where code='GOMOH_DHANBAD_FIXED_RT';
do $$
declare
  v_sig regprocedure;
  v_def text;
  v_next text;
begin
  foreach v_sig in array array[
    'private.fixed_product_market_is_live(uuid)'::regprocedure,
    'private.get_mobility_options(uuid,uuid)'::regprocedure,
    'private.get_fixed_product_detail(uuid)'::regprocedure,
    'private.join_fixed_queue(uuid,integer,jsonb,text)'::regprocedure,
    'private.set_driver_product_preference(uuid,boolean,text)'::regprocedure,
    'private.join_fixed_driver_queue(uuid,uuid,text)'::regprocedure,
    'private.get_fixed_driver_workspace()'::regprocedure,
    'private.fixed_driver_match_eligible(uuid,uuid,uuid,timestamptz)'::regprocedure,
    'private.match_fixed_product(uuid,text)'::regprocedure
  ] loop
    v_def := pg_get_functiondef(v_sig);
    v_next := replace(
      v_def,
      'p.service_type = ''FIXED_ONE_WAY''',
      'p.service_type in (''FIXED_ONE_WAY'',''FIXED_ROUND_TRIP'')'
    );
    if v_next = v_def then
      raise exception 'FIXED_KERNEL_PREDICATE_NOT_FOUND: %', v_sig;
    end if;
    execute v_next;
  end loop;
end;
$$;