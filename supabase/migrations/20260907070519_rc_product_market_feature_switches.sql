insert into public.market_feature_flags(market_id,flag_key,enabled,config,updated_by)
select p.market_id,'product_'||lower(p.code),p.status in ('PILOT','ACTIVE'),jsonb_build_object('product_code',p.code,'service_type',p.service_type,'seeded_from_lifecycle',p.status),null
from public.service_products p
where p.market_id is not null
on conflict (market_id,flag_key) do nothing;

create or replace function private.product_feature_enabled(p_product_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select coalesce((select f.enabled from public.service_products p join public.market_feature_flags f on f.market_id=p.market_id and f.flag_key='product_'||lower(p.code) where p.id=p_product_id),false);
$$;
revoke all on function private.product_feature_enabled(uuid) from public,anon,authenticated;
grant execute on function private.product_feature_enabled(uuid) to authenticated;

create or replace function private.filter_enabled_product_array(p_items jsonb)
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(x.item order by x.ord),'[]'::jsonb)
 from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) with ordinality x(item,ord)
 join public.service_products p on p.id=(x.item->>'product_id')::uuid
 where private.product_feature_enabled(p.id);
$$;
revoke all on function private.filter_enabled_product_array(jsonb) from public,anon,authenticated;
grant execute on function private.filter_enabled_product_array(jsonb) to authenticated;

create or replace function private.filter_fixed_driver_product_array(p_items jsonb)
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(x.item order by x.ord),'[]'::jsonb)
 from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) with ordinality x(item,ord)
 join public.service_products p on p.id=(x.item->>'product_id')::uuid
 where private.product_feature_enabled(p.id) or nullif(x.item->>'availability_id','') is not null;
$$;
revoke all on function private.filter_fixed_driver_product_array(jsonb) from public,anon,authenticated;
grant execute on function private.filter_fixed_driver_product_array(jsonb) to authenticated;

create or replace function private.trip_offering_feature_enabled(p_offering_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select coalesce((select private.product_feature_enabled(t.product_id) from public.trip_offerings t where t.id=p_offering_id),false);
$$;
revoke all on function private.trip_offering_feature_enabled(uuid) from public,anon,authenticated;
grant execute on function private.trip_offering_feature_enabled(uuid) to authenticated;

create or replace function private.admin_set_product_feature_switch(p_product_id uuid,p_enabled boolean,p_reason text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_product public.service_products%rowtype; v_prev boolean; v_idem public.command_idempotency; v_hash text; v_result jsonb;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if not exists(
   select 1 from public.account_capabilities c join public.admin_scope_assignments a on a.profile_id=c.profile_id
   where c.profile_id=auth.uid() and c.capability='ADMIN' and c.revoked_at is null and a.revoked_at is null
     and a.permission='PLATFORM_ADMIN' and a.scope_type='PLATFORM'
 ) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
 select * into v_product from public.service_products where id=p_product_id;
 if not found or v_product.market_id is null then raise exception 'SERVICE_PRODUCT_NOT_FOUND'; end if;
 if length(trim(coalesce(p_reason,'')))<4 then raise exception 'FEATURE_SWITCH_REASON_REQUIRED'; end if;
 v_hash:=md5(concat_ws('|',p_product_id::text,p_enabled::text,trim(p_reason)));
 v_idem:=private.claim_user_command('admin_set_product_feature_switch',p_idempotency_key,v_hash);
 if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select coalesce(f.enabled,false) into v_prev from public.market_feature_flags f where f.market_id=v_product.market_id and f.flag_key='product_'||lower(v_product.code);
 insert into public.market_feature_flags(market_id,flag_key,enabled,config,updated_by,updated_at)
 values(v_product.market_id,'product_'||lower(v_product.code),p_enabled,jsonb_build_object('product_code',v_product.code,'service_type',v_product.service_type,'reason',trim(p_reason)),auth.uid(),now())
 on conflict (market_id,flag_key) do update set enabled=excluded.enabled,config=coalesce(public.market_feature_flags.config,'{}'::jsonb)||excluded.config,updated_by=excluded.updated_by,updated_at=now();
 insert into public.audit_events(actor_profile_id,market_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),v_product.market_id,'PRODUCT_FEATURE_SWITCH_SET','SERVICE_PRODUCT',v_product.id,jsonb_build_object('product_code',v_product.code,'service_type',v_product.service_type,'previous_enabled',coalesce(v_prev,false),'enabled',p_enabled,'reason',trim(p_reason)));
 v_result:=jsonb_build_object('product_id',v_product.id,'product_code',v_product.code,'market_id',v_product.market_id,'lifecycle_status',v_product.status,'previous_enabled',coalesce(v_prev,false),'enabled',p_enabled);
 return private.complete_user_command(v_idem.id,v_result);
end;$$;
revoke all on function private.admin_set_product_feature_switch(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function private.admin_set_product_feature_switch(uuid,boolean,text,text) to authenticated;

create or replace function public.admin_set_product_feature_switch(p_product_id uuid,p_enabled boolean,p_reason text,p_idempotency_key text)
returns jsonb language sql set search_path=''
as $$ select private.admin_set_product_feature_switch(p_product_id,p_enabled,p_reason,p_idempotency_key); $$;
revoke all on function public.admin_set_product_feature_switch(uuid,boolean,text,text) from public,anon;
grant execute on function public.admin_set_product_feature_switch(uuid,boolean,text,text) to authenticated;

create or replace function private.get_release_control_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_can_manage boolean; v_result jsonb;
begin
 if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
 if not exists(select 1 from public.account_capabilities c where c.profile_id=v_uid and c.capability='ADMIN' and c.revoked_at is null) then raise exception 'ADMIN_CAPABILITY_REQUIRED'; end if;
 select exists(select 1 from public.admin_scope_assignments a where a.profile_id=v_uid and a.revoked_at is null and a.permission='PLATFORM_ADMIN' and a.scope_type='PLATFORM') into v_can_manage;
 select jsonb_build_object('can_manage',v_can_manage,'markets',coalesce(jsonb_agg(jsonb_build_object(
   'market_id',m.id,'market_code',m.code,'market_name',m.name,'market_status',m.status,
   'products',coalesce((select jsonb_agg(jsonb_build_object(
     'product_id',p.id,'product_code',p.code,'display_name',p.display_name,'service_type',p.service_type,'lifecycle_status',p.status,
     'feature_enabled',coalesce(f.enabled,false),'effective_available',(p.status in ('PILOT','ACTIVE') and coalesce(f.enabled,false)),
     'flag_key','product_'||lower(p.code),'updated_at',f.updated_at,'updated_by',up.display_name,'config',coalesce(f.config,'{}'::jsonb)
   ) order by p.display_name) from public.service_products p left join public.market_feature_flags f on f.market_id=p.market_id and f.flag_key='product_'||lower(p.code) left join public.profiles up on up.id=f.updated_by where p.market_id=m.id),'[]'::jsonb)
 ) order by m.name),'[]'::jsonb)) into v_result
 from public.markets m
 where exists(select 1 from public.admin_scope_assignments a where a.profile_id=v_uid and a.revoked_at is null and a.permission in ('MARKET_OPERATIONS','STATE_OPERATIONS','PLATFORM_ADMIN') and (a.scope_type='PLATFORM' or (a.scope_type='MARKET' and a.market_id=m.id) or (a.scope_type='STATE' and a.state_code=m.state_code)));
 return v_result;
end;$$;
revoke all on function private.get_release_control_workspace() from public,anon,authenticated;
grant execute on function private.get_release_control_workspace() to authenticated;

create or replace function public.get_release_control_workspace()
returns jsonb language sql stable set search_path=''
as $$ select private.get_release_control_workspace(); $$;
revoke all on function public.get_release_control_workspace() from public,anon;
grant execute on function public.get_release_control_workspace() to authenticated;

create or replace function public.get_mobility_options(p_origin_location_id uuid,p_destination_location_id uuid)
returns jsonb language sql stable set search_path=''
as $$ select private.filter_enabled_product_array(private.get_mobility_options(p_origin_location_id,p_destination_location_id)); $$;

create or replace function public.get_fixed_product_detail(p_product_id uuid)
returns jsonb language sql stable set search_path=''
as $$ select case when private.product_feature_enabled(p_product_id) then private.get_fixed_product_detail(p_product_id) else null end; $$;

create or replace function public.get_live_outstation_products()
returns jsonb language sql stable set search_path=''
as $$ select private.filter_enabled_product_array(private.get_live_outstation_products()); $$;

create or replace function public.get_outstation_product_detail(p_product_id uuid)
returns jsonb language sql stable set search_path=''
as $$ select case when private.product_feature_enabled(p_product_id) then private.get_outstation_product_detail(p_product_id) else null end; $$;

create or replace function public.get_carpool_catalog()
returns jsonb language plpgsql stable set search_path=''
as $$ declare v jsonb; begin v:=private.get_carpool_catalog(); return jsonb_set(v,'{products}',private.filter_enabled_product_array(v->'products'),true); end; $$;

create or replace function public.get_trip_catalog()
returns jsonb language plpgsql stable set search_path=''
as $$ declare v jsonb; begin v:=private.get_trip_catalog(); return jsonb_set(v,'{products}',private.filter_enabled_product_array(v->'products'),true); end; $$;

create or replace function public.get_fixed_driver_workspace()
returns jsonb language plpgsql stable set search_path=''
as $$ declare v jsonb; begin v:=private.get_fixed_driver_workspace(); return jsonb_set(v,'{products}',private.filter_fixed_driver_product_array(v->'products'),true); end; $$;

create or replace function public.get_driver_outstation_workspace()
returns jsonb language plpgsql stable set search_path=''
as $$ declare v jsonb; begin v:=private.get_driver_outstation_workspace(); return jsonb_set(v,'{products}',private.filter_enabled_product_array(v->'products'),true); end; $$;

create or replace function public.get_driver_carpool_workspace()
returns jsonb language plpgsql stable set search_path=''
as $$ declare v jsonb; begin v:=private.get_driver_carpool_workspace(); return jsonb_set(v,'{catalog,products}',private.filter_enabled_product_array(v#>'{catalog,products}'),true); end; $$;

create or replace function public.get_driver_trip_workspace()
returns jsonb language plpgsql stable set search_path=''
as $$ declare v jsonb; begin v:=private.get_driver_trip_workspace(); return jsonb_set(v,'{catalog,products}',private.filter_enabled_product_array(v#>'{catalog,products}'),true); end; $$;

create or replace function public.join_fixed_queue(p_product_id uuid,p_seat_count integer,p_boarding_context jsonb,p_idempotency_key text)
returns jsonb language plpgsql set search_path=''
as $$ begin if not private.product_feature_enabled(p_product_id) then raise exception 'FIXED_PRODUCT_NOT_AVAILABLE'; end if; return private.join_fixed_queue(p_product_id,p_seat_count,p_boarding_context,p_idempotency_key); end; $$;

create or replace function public.join_fixed_driver_queue(p_product_id uuid,p_vehicle_id uuid,p_idempotency_key text)
returns jsonb language plpgsql set search_path=''
as $$ begin if not private.product_feature_enabled(p_product_id) then raise exception 'FIXED_PRODUCT_NOT_AVAILABLE'; end if; return private.join_fixed_driver_queue(p_product_id,p_vehicle_id,p_idempotency_key); end; $$;

create or replace function public.set_driver_product_preference(p_product_id uuid,p_enabled boolean,p_idempotency_key text)
returns jsonb language plpgsql set search_path=''
as $$ begin if p_enabled and not private.product_feature_enabled(p_product_id) then raise exception 'FIXED_PRODUCT_NOT_AVAILABLE'; end if; return private.set_driver_product_preference(p_product_id,p_enabled,p_idempotency_key); end; $$;

create or replace function public.passenger_create_outstation_request(p_product_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,p_destination_text text,p_travel_type text,p_departure_at timestamptz,p_return_at timestamptz,p_passenger_count integer,p_passenger_note text,p_idempotency_key text)
returns jsonb language plpgsql set search_path=''
as $$ begin if not private.product_feature_enabled(p_product_id) then raise exception 'OUTSTATION_PRODUCT_NOT_AVAILABLE'; end if; return private.passenger_create_outstation_request(p_product_id,p_origin_location_id,p_destination_location_id,p_destination_text,p_travel_type,p_departure_at,p_return_at,p_passenger_count,p_passenger_note,p_idempotency_key); end; $$;

create or replace function public.driver_set_outstation_preference(p_product_id uuid,p_enabled boolean,p_idempotency_key text)
returns jsonb language plpgsql set search_path=''
as $$ begin if p_enabled and not private.product_feature_enabled(p_product_id) then raise exception 'OUTSTATION_PRODUCT_NOT_AVAILABLE'; end if; return private.driver_set_outstation_preference(p_product_id,p_enabled,p_idempotency_key); end; $$;

create or replace function public.publish_carpool_journey(p_product_id uuid,p_vehicle_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,p_departure_at timestamptz,p_offered_seats integer,p_contribution_per_seat_inr integer,p_idempotency_key text)
returns jsonb language plpgsql set search_path=''
as $$ begin if not private.product_feature_enabled(p_product_id) then raise exception 'CARPOOL_PRODUCT_NOT_AVAILABLE'; end if; return private.publish_carpool_journey(p_product_id,p_vehicle_id,p_origin_location_id,p_destination_location_id,p_departure_at,p_offered_seats,p_contribution_per_seat_inr,p_idempotency_key); end; $$;

create or replace function public.create_trip_draft(p_product_id uuid,p_vehicle_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,p_departure_at timestamptz,p_return_departure_at timestamptz,p_offered_seats integer,p_price_per_seat_inr integer,p_min_confirmation_seats integer,p_confirmation_deadline timestamptz,p_itinerary_context text,p_idempotency_key text)
returns jsonb language plpgsql set search_path=''
as $$ begin if not private.product_feature_enabled(p_product_id) then raise exception 'TRIP_PRODUCT_NOT_AVAILABLE'; end if; return private.create_trip_draft(p_product_id,p_vehicle_id,p_origin_location_id,p_destination_location_id,p_departure_at,p_return_departure_at,p_offered_seats,p_price_per_seat_inr,p_min_confirmation_seats,p_confirmation_deadline,p_itinerary_context,p_idempotency_key); end; $$;

create or replace function public.publish_trip_offering(p_offering_id uuid,p_idempotency_key text)
returns jsonb language plpgsql set search_path=''
as $$ begin if not private.trip_offering_feature_enabled(p_offering_id) then raise exception 'TRIP_PRODUCT_NOT_AVAILABLE'; end if; return private.publish_trip_offering(p_offering_id,p_idempotency_key); end; $$;