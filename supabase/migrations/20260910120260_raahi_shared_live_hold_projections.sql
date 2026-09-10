-- A hold is customer-visible only until expires_at. The persisted held_seats
-- counter is intentionally released lazily under the owning offering lock; it
-- may therefore include an expired hold for a short period. Public discovery
-- and Driver workspace availability must use the authoritative live match set
-- so an expired offer never makes usable capacity appear unavailable.

create or replace function private.live_shared_held_seats(p_offering_id uuid)
returns integer language sql stable security definer set search_path=''
as $$
  select coalesce(sum(m.seat_count),0)::integer
    from public.shared_trip_matches m
   where m.offering_id=p_offering_id
     and m.status='OFFERED'
     and m.expires_at>now();
$$;
revoke all on function private.live_shared_held_seats(uuid) from public,anon,authenticated;

a create or replace function private.decorate_trip_live_capacity(p_item jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_offering_id uuid;
  v_live_held integer;
  v_offered integer;
  v_booked integer;
  v_status text;
begin
  if p_item is null then return null; end if;
  v_offering_id:=nullif(p_item->>'offering_id','')::uuid;
  if v_offering_id is null then return p_item; end if;
  v_live_held:=private.live_shared_held_seats(v_offering_id);
  v_offered:=coalesce((p_item->>'offered_seats')::integer,0);
  v_booked:=coalesce((p_item->>'booked_seats')::integer,0);
  v_status:=p_item->>'status';
  return p_item || jsonb_build_object(
    'seats_left',greatest(v_offered-v_booked-v_live_held,0),
    'display_status',case when v_booked+v_live_held>=v_offered then 'FULL' else v_status end
  );
end; $$;
revoke all on function private.decorate_trip_live_capacity(jsonb) from public,anon,authenticated;

create or replace function private.decorate_trip_discovery_live_capacity(p_items jsonb)
returns jsonb language sql stable security definer set search_path=''
as $$
  select coalesce(jsonb_agg(private.decorate_trip_live_capacity(x.item) order by x.ord),'[]'::jsonb)
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) with ordinality x(item,ord);
$$;
revoke all on function private.decorate_trip_discovery_live_capacity(jsonb) from public,anon,authenticated;

create or replace function private.decorate_driver_trip_workspace_live_capacity(p_workspace jsonb)
returns jsonb language sql stable security definer set search_path=''
as $$
  select case
    when p_workspace is null then null
    else p_workspace || jsonb_build_object(
      'offerings',coalesce((
        select jsonb_agg(
          private.decorate_trip_live_capacity(x.item) ||
          jsonb_build_object(
            'protected_seats',
            private.live_shared_held_seats((x.item->>'offering_id')::uuid)
          )
          order by x.ord
        )
        from jsonb_array_elements(coalesce(p_workspace->'offerings','[]'::jsonb)) with ordinality x(item,ord)
      ),'[]'::jsonb)
    )
  end;
$$;
revoke all on function private.decorate_driver_trip_workspace_live_capacity(jsonb) from public,anon,authenticated;

create or replace function public.get_trip_discovery(p_origin_location_id uuid default null)
returns jsonb language sql stable security invoker set search_path=''
as $$
  select private.decorate_trip_discovery_live_capacity(
    private.filter_enabled_trip_discovery(private.get_trip_discovery(p_origin_location_id))
  );
$$;
revoke all on function public.get_trip_discovery(uuid) from public,anon,authenticated;
grant execute on function public.get_trip_discovery(uuid) to authenticated,service_role;

create or replace function public.get_trip_offering(p_offering_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$
  select private.decorate_trip_live_capacity(private.get_trip_offering(p_offering_id));
$$;
revoke all on function public.get_trip_offering(uuid) from public,anon,authenticated;
grant execute on function public.get_trip_offering(uuid) to authenticated;

create or replace function public.get_driver_trip_workspace()
returns jsonb language sql stable security invoker set search_path=''
as $$
  select private.decorate_driver_trip_workspace_live_capacity(private.get_driver_trip_workspace());
$$;
revoke all on function public.get_driver_trip_workspace() from public,anon,authenticated;
grant execute on function public.get_driver_trip_workspace() to authenticated;
