-- ============================================================
-- RAAHI MINI — MIGRATION 16: LIVE FIFO RANKS
-- Historical queue_position remains audit/order data; UI gets dense live rank.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_driver_queue_status(p_route_id UUID)
RETURNS TABLE(
  queue_id UUID,
  driver_id UUID,
  driver_name TEXT,
  vehicle_number TEXT,
  queue_position INTEGER,
  status TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT dq.id,
         d.id,
         d.display_name,
         v.registration_number,
         ROW_NUMBER() OVER(
           ORDER BY CASE WHEN dq.status='ACTIVE_COLLECTING' THEN 0 ELSE 1 END,
                    dq.queue_position,dq.joined_at,dq.id
         )::INTEGER AS queue_position,
         dq.status::TEXT,
         dq.joined_at
  FROM public.driver_queue dq
  JOIN public.drivers d ON d.id=dq.driver_id
  LEFT JOIN public.vehicles v ON v.id=d.vehicle_id
  WHERE dq.route_id=p_route_id AND dq.status IN('WAITING','ACTIVE_COLLECTING')
  ORDER BY queue_position;
$$;

CREATE OR REPLACE FUNCTION public.get_driver_home_context()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_driver public.drivers;
  v_live_queue public.driver_queue;
  v_live_route public.routes;
  v_active_trip public.trips;
  v_active_route public.routes;
  v_suggested_location_id UUID;
  v_suggested_location_name TEXT;
  v_live_rank INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT * INTO v_driver FROM public.drivers WHERE profile_id=auth.uid() AND is_active=true;
  IF v_driver.id IS NULL THEN RETURN jsonb_build_object('error','Active driver account required'); END IF;

  SELECT * INTO v_active_trip FROM public.trips
  WHERE driver_id=v_driver.id AND status IN('ACTIVE_COLLECTING','IN_PROGRESS')
  ORDER BY created_at DESC LIMIT 1;
  IF v_active_trip.id IS NOT NULL THEN
    SELECT * INTO v_active_route FROM public.routes WHERE id=v_active_trip.route_id;
  END IF;

  SELECT * INTO v_live_queue FROM public.driver_queue
  WHERE driver_id=v_driver.id AND status IN('WAITING','ACTIVE_COLLECTING')
  ORDER BY joined_at DESC LIMIT 1;

  IF v_live_queue.id IS NOT NULL THEN
    SELECT * INTO v_live_route FROM public.routes WHERE id=v_live_queue.route_id;
    SELECT ranked.live_rank INTO v_live_rank
    FROM (
      SELECT id,
             ROW_NUMBER() OVER(
               ORDER BY CASE WHEN status='ACTIVE_COLLECTING' THEN 0 ELSE 1 END,
                        queue_position,joined_at,id
             )::INTEGER AS live_rank
      FROM public.driver_queue
      WHERE route_id=v_live_queue.route_id AND status IN('WAITING','ACTIVE_COLLECTING')
    ) ranked
    WHERE ranked.id=v_live_queue.id;
  END IF;

  SELECT r.to_location_id,l.name INTO v_suggested_location_id,v_suggested_location_name
  FROM public.trips t
  JOIN public.routes r ON r.id=t.route_id
  JOIN public.locations l ON l.id=r.to_location_id
  WHERE t.driver_id=v_driver.id AND t.status='COMPLETED'
  ORDER BY t.completed_at DESC NULLS LAST,t.created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'driver_id',v_driver.id,
    'vehicle_id',v_driver.vehicle_id,
    'has_active_trip',v_active_trip.id IS NOT NULL,
    'active_trip_id',v_active_trip.id,
    'active_trip_status',v_active_trip.status,
    'active_trip_route_id',v_active_trip.route_id,
    'active_trip_route_label',v_active_route.direction_label,
    'has_live_queue',v_live_queue.id IS NOT NULL,
    'queue_id',v_live_queue.id,
    'queue_status',v_live_queue.status,
    'queue_position',v_live_rank,
    'queue_route_id',v_live_queue.route_id,
    'queue_route_label',v_live_route.direction_label,
    'suggested_location_id',v_suggested_location_id,
    'suggested_location_name',v_suggested_location_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_driver_queue_status(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_driver_queue_status(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_driver_home_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_driver_home_context() TO authenticated;
