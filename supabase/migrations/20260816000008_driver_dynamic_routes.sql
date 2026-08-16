-- ============================================================
-- RAAHI MINI — MIGRATION 8: DYNAMIC DRIVER ROUTE SELECTION
-- Drivers belong to Raahi + vehicle, not to one permanent route.
-- Driver selects current location, sees routes departing there,
-- then joins exactly one live route queue.
-- ============================================================

-- Replace the route-specific live-driver invariant with a global one:
-- a driver can wait/collect for only one route at a time.
DROP INDEX IF EXISTS public.idx_driver_queue_live_driver_route;
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_queue_one_live_per_driver
  ON public.driver_queue (driver_id)
  WHERE status IN ('WAITING', 'ACTIVE_COLLECTING');

-- Canonical driver route discovery. Current location is a declared operating
-- location (no GPS dependency); only routes DEPARTING that location are offered.
CREATE OR REPLACE FUNCTION public.get_driver_departing_routes(p_location_id UUID)
RETURNS TABLE (
  route_id UUID,
  route_code TEXT,
  from_location_id UUID,
  from_location_name TEXT,
  to_location_id UUID,
  to_location_name TEXT,
  direction_label TEXT,
  has_active_car BOOLEAN,
  available_seats INTEGER,
  waiting_drivers INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_driver() THEN
    RAISE EXCEPTION 'Driver access required';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.code,
    r.from_location_id,
    fl.name,
    r.to_location_id,
    tl.name,
    r.direction_label,
    (t.id IS NOT NULL),
    COALESCE(t.capacity - t.confirmed_count - t.held_count - t.driver_closed_count, 0),
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.driver_queue dq
      WHERE dq.route_id = r.id AND dq.status = 'WAITING'
    ), 0)
  FROM public.routes r
  JOIN public.locations fl ON fl.id = r.from_location_id
  JOIN public.locations tl ON tl.id = r.to_location_id
  LEFT JOIN public.trips t
    ON t.route_id = r.id AND t.status = 'ACTIVE_COLLECTING'
  WHERE r.is_active = true
    AND fl.is_active = true
    AND tl.is_active = true
    AND r.from_location_id = p_location_id
  ORDER BY r.code;
END;
$$;

-- Driver landing context. The latest completed trip destination is a suggestion,
-- not GPS truth and not a permanent profile field.
CREATE OR REPLACE FUNCTION public.get_driver_home_context()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver public.drivers;
  v_live_queue public.driver_queue;
  v_live_route public.routes;
  v_suggested_location_id UUID;
  v_suggested_location_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers
  WHERE profile_id = auth.uid() AND is_active = true;

  IF v_driver.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Active driver account required');
  END IF;

  SELECT * INTO v_live_queue
  FROM public.driver_queue
  WHERE driver_id = v_driver.id
    AND status IN ('WAITING', 'ACTIVE_COLLECTING')
  ORDER BY joined_at DESC
  LIMIT 1;

  IF v_live_queue.id IS NOT NULL THEN
    SELECT * INTO v_live_route FROM public.routes WHERE id = v_live_queue.route_id;
  END IF;

  SELECT r.to_location_id, l.name
  INTO v_suggested_location_id, v_suggested_location_name
  FROM public.trips t
  JOIN public.routes r ON r.id = t.route_id
  JOIN public.locations l ON l.id = r.to_location_id
  WHERE t.driver_id = v_driver.id AND t.status = 'COMPLETED'
  ORDER BY t.completed_at DESC NULLS LAST, t.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'driver_id', v_driver.id,
    'vehicle_id', v_driver.vehicle_id,
    'has_live_queue', v_live_queue.id IS NOT NULL,
    'queue_id', v_live_queue.id,
    'queue_status', v_live_queue.status,
    'queue_position', v_live_queue.queue_position,
    'queue_route_id', v_live_queue.route_id,
    'queue_route_label', v_live_route.direction_label,
    'suggested_location_id', v_suggested_location_id,
    'suggested_location_name', v_suggested_location_name
  );
END;
$$;

-- Internal FIFO activation no longer checks a permanent driver.route_id.
-- The queue row itself is the driver's route choice for this journey.
CREATE OR REPLACE FUNCTION public.activate_next_driver(p_route_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next public.driver_queue;
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_route public.routes;
  v_trip_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_route_id::text, 0));

  SELECT * INTO v_route
  FROM public.routes
  WHERE id = p_route_id AND is_active = true;
  IF v_route.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Route is not active');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.driver_queue
    WHERE route_id = p_route_id AND status = 'ACTIVE_COLLECTING'
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_active', true);
  END IF;

  SELECT * INTO v_next
  FROM public.driver_queue
  WHERE route_id = p_route_id AND status = 'WAITING'
  ORDER BY queue_position, joined_at, id
  LIMIT 1
  FOR UPDATE;

  IF v_next.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No waiting drivers in queue');
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers
  WHERE id = v_next.driver_id AND is_active = true
  FOR UPDATE;

  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = v_driver.vehicle_id AND is_active = true;

  IF v_driver.id IS NULL OR v_vehicle.id IS NULL THEN
    UPDATE public.driver_queue SET status = 'CANCELLED' WHERE id = v_next.id;
    RETURN public.activate_next_driver(p_route_id);
  END IF;

  UPDATE public.driver_queue
  SET status = 'ACTIVE_COLLECTING', activated_at = now()
  WHERE id = v_next.id;

  INSERT INTO public.trips (
    route_id, driver_id, vehicle_id, queue_entry_id, status, capacity
  ) VALUES (
    p_route_id, v_driver.id, v_vehicle.id, v_next.id, 'ACTIVE_COLLECTING', v_vehicle.capacity
  )
  RETURNING id INTO v_trip_id;

  INSERT INTO public.trip_seats (trip_id, seat_number)
  SELECT v_trip_id, generate_series(1, v_vehicle.capacity);

  PERFORM public.record_audit('activate_next_driver', 'driver_queue', v_next.id,
    NULL, jsonb_build_object('route_id', p_route_id, 'trip_id', v_trip_id));

  RETURN jsonb_build_object(
    'success', true, 'queue_id', v_next.id,
    'driver_id', v_next.driver_id, 'trip_id', v_trip_id
  );
END;
$$;

-- Replace the old one-argument command so there is still exactly one canonical
-- join command. Server verifies selected route actually departs selected location.
DROP FUNCTION IF EXISTS public.join_driver_queue(UUID);
CREATE FUNCTION public.join_driver_queue(
  p_route_id UUID,
  p_current_location_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver public.drivers;
  v_profile public.profiles;
  v_route public.routes;
  v_next_position INTEGER;
  v_queue_id UUID;
  v_activation JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF v_profile.role <> 'driver' OR v_profile.is_restricted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active driver account required');
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers
  WHERE profile_id = auth.uid() AND is_active = true
  FOR UPDATE;

  IF v_driver.id IS NULL OR v_driver.vehicle_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active driver and vehicle required');
  END IF;

  SELECT * INTO v_route
  FROM public.routes
  WHERE id = p_route_id AND is_active = true;

  IF v_route.id IS NULL OR v_route.from_location_id IS DISTINCT FROM p_current_location_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected route does not depart from your current location');
  END IF;

  -- A driver cannot queue for a new ride while travelling or already queued.
  IF EXISTS (
    SELECT 1 FROM public.trips
    WHERE driver_id = v_driver.id AND status = 'IN_PROGRESS'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Complete your current trip before joining another route');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('driver:' || v_driver.id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('route:' || p_route_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.driver_queue
    WHERE driver_id = v_driver.id AND status IN ('WAITING', 'ACTIVE_COLLECTING')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already in a driver queue');
  END IF;

  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_next_position
  FROM public.driver_queue
  WHERE route_id = p_route_id AND status IN ('WAITING', 'ACTIVE_COLLECTING');

  INSERT INTO public.driver_queue (driver_id, route_id, queue_position, status)
  VALUES (v_driver.id, p_route_id, v_next_position, 'WAITING')
  RETURNING id INTO v_queue_id;

  SELECT public.activate_next_driver(p_route_id) INTO v_activation;

  PERFORM public.record_audit('join_driver_queue', 'driver_queue', v_queue_id,
    NULL, jsonb_build_object(
      'route_id', p_route_id,
      'driver_id', v_driver.id,
      'declared_current_location_id', p_current_location_id
    ));

  RETURN jsonb_build_object('success', true, 'queue_id', v_queue_id, 'activation', v_activation);
END;
$$;

-- Permanent route assignment is obsolete. Keep vehicle association only.
DROP INDEX IF EXISTS public.idx_drivers_route;
ALTER TABLE public.drivers DROP COLUMN IF EXISTS route_id;

-- Restore explicit RPC exposure after replacing functions.
REVOKE EXECUTE ON FUNCTION public.activate_next_driver(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_next_driver(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.join_driver_queue(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_driver_queue(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_driver_departing_routes(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_departing_routes(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_driver_home_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_home_context() TO authenticated;
