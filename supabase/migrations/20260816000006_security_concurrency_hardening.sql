-- ============================================================
-- RAAHI MINI — MIGRATION 6: SECURITY AND CONCURRENCY HARDENING
-- Additive corrections from the PR #1 architecture audit
-- ============================================================

-- Signup metadata is user-controlled. New accounts always start as passengers;
-- trusted role changes must be performed by an administrator.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, ''), '@', 1), 'User'),
    'passenger'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Prevent profile owners from escalating their role or clearing restrictions.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (phone, display_name) ON public.profiles TO authenticated;

-- Enforce the queue invariants independently of application code.
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_queue_live_driver_route
  ON public.driver_queue (driver_id, route_id)
  WHERE status IN ('WAITING', 'ACTIVE_COLLECTING');

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_queue_live_position
  ON public.driver_queue (route_id, queue_position)
  WHERE status IN ('WAITING', 'ACTIVE_COLLECTING');

-- Internal primitive. Caller-facing functions serialize on the route before use.
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
  v_trip_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_route_id::text, 0));

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

  IF v_driver.id IS NULL OR v_vehicle.id IS NULL OR v_driver.route_id IS DISTINCT FROM p_route_id THEN
    UPDATE public.driver_queue SET status = 'CANCELLED' WHERE id = v_next.id;
    RETURN public.activate_next_driver(p_route_id);
  END IF;

  UPDATE public.driver_queue
  SET status = 'ACTIVE_COLLECTING', activated_at = now()
  WHERE id = v_next.id;

  INSERT INTO public.trips (
    route_id, driver_id, vehicle_id, queue_entry_id, status, capacity
  )
  VALUES (
    p_route_id, v_driver.id, v_vehicle.id, v_next.id, 'ACTIVE_COLLECTING', v_vehicle.capacity
  )
  RETURNING id INTO v_trip_id;

  INSERT INTO public.trip_seats (trip_id, seat_number)
  SELECT v_trip_id, generate_series(1, v_vehicle.capacity);

  PERFORM public.record_audit('activate_next_driver', 'driver_queue', v_next.id,
    NULL, jsonb_build_object('route_id', p_route_id, 'trip_id', v_trip_id));

  RETURN jsonb_build_object(
    'success', true, 'queue_id', v_next.id, 'driver_id', v_next.driver_id, 'trip_id', v_trip_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.join_driver_queue(p_route_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver public.drivers;
  v_profile public.profiles;
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

  IF v_driver.id IS NULL OR v_driver.route_id IS DISTINCT FROM p_route_id OR v_driver.vehicle_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Driver is not assigned to this route and vehicle');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_route_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.driver_queue
    WHERE driver_id = v_driver.id AND route_id = p_route_id
      AND status IN ('WAITING', 'ACTIVE_COLLECTING')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already in queue for this route');
  END IF;

  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_next_position
  FROM public.driver_queue
  WHERE route_id = p_route_id AND status IN ('WAITING', 'ACTIVE_COLLECTING');

  INSERT INTO public.driver_queue (driver_id, route_id, queue_position, status)
  VALUES (v_driver.id, p_route_id, v_next_position, 'WAITING')
  RETURNING id INTO v_queue_id;

  SELECT public.activate_next_driver(p_route_id) INTO v_activation;

  PERFORM public.record_audit('join_driver_queue', 'driver_queue', v_queue_id,
    NULL, jsonb_build_object('route_id', p_route_id, 'driver_id', v_driver.id));

  RETURN jsonb_build_object('success', true, 'queue_id', v_queue_id, 'activation', v_activation);
END;
$$;

-- Expire exactly the requests changed by this arrival and release exactly their seats.
CREATE OR REPLACE FUNCTION public.driver_arrive_at_stop(p_trip_id UUID, p_stop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_trip public.trips;
  v_stop public.route_stops;
  v_released INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  SELECT id INTO v_driver_id FROM public.drivers
  WHERE profile_id = auth.uid() AND is_active = true;
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;

  IF v_trip.id IS NULL OR v_trip.driver_id IS DISTINCT FROM v_driver_id
     OR v_trip.status <> 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found, not authorized, or not collecting');
  END IF;

  SELECT * INTO v_stop FROM public.route_stops
  WHERE id = p_stop_id AND route_id = v_trip.route_id;

  IF v_stop.id IS NULL OR v_stop.stop_order < v_trip.current_stop_order THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or backwards stop transition');
  END IF;

  INSERT INTO public.trip_progress (trip_id, stop_id, stop_order)
  VALUES (p_trip_id, p_stop_id, v_stop.stop_order)
  ON CONFLICT (trip_id, stop_order) DO UPDATE SET arrived_at = now();

  WITH expired AS (
    UPDATE public.seat_requests
    SET status = 'EXPIRED', expired_at = now()
    WHERE trip_id = p_trip_id AND status = 'HELD'
      AND pickup_stop_order < v_stop.stop_order
    RETURNING seat_count
  )
  SELECT COALESCE(SUM(seat_count), 0) INTO v_released FROM expired;

  UPDATE public.trips
  SET current_stop_order = v_stop.stop_order,
      held_count = held_count - v_released
  WHERE id = p_trip_id;

  PERFORM public.record_audit('driver_arrive_at_stop', 'trips', p_trip_id,
    NULL, jsonb_build_object('stop', v_stop.name, 'stop_order', v_stop.stop_order,
      'released_seats', v_released));

  RETURN jsonb_build_object('success', true, 'current_stop_order', v_stop.stop_order,
    'stop_name', v_stop.name, 'released_seats', v_released);
END;
$$;

-- Sensitive tables are reachable only through the audited SECURITY DEFINER surface.
DROP POLICY IF EXISTS "drivers_public_read" ON public.drivers;
CREATE POLICY "drivers_own_or_admin_read" ON public.drivers
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

REVOKE ALL ON public.profiles, public.drivers, public.driver_queue, public.trips,
  public.trip_seats, public.seat_requests, public.trip_progress,
  public.behaviour_events, public.audit_log, public.admin_config
FROM anon, authenticated;

GRANT SELECT ON public.profiles, public.drivers TO authenticated;
GRANT UPDATE (phone, display_name) ON public.profiles TO authenticated;

-- No function is executable merely because it exists in public.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_active_locations() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_routes_for_location(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_active_car(UUID) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_role(), public.is_admin(), public.is_driver(),
  public.get_passenger_ride_status(UUID), public.get_my_active_request(),
  public.get_driver_active_car(), public.get_driver_queue_status(UUID),
  public.join_driver_queue(UUID), public.leave_driver_queue(UUID),
  public.request_seats(UUID, UUID, INTEGER), public.withdraw_seat_request(UUID),
  public.driver_confirm_payment(UUID), public.driver_mark_passenger_absent(UUID),
  public.driver_arrive_at_stop(UUID, UUID), public.driver_advance_stop(UUID),
  public.driver_close_empty_seats(UUID), public.start_trip(UUID),
  public.complete_trip(UUID), public.driver_cancel_trip(UUID),
  public.admin_restrict_user(UUID, TEXT), public.admin_unrestrict_user(UUID),
  public.admin_reorder_queue(UUID, INTEGER), public.admin_remove_from_queue(UUID),
  public.admin_get_active_trips(), public.admin_get_behaviour_events(INTEGER)
TO authenticated;

-- Keep future functions closed by default; migrations must opt into the public RPC surface.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Realtime subscriptions are invalidation signals only. These SELECT grants are
-- required for RLS-filtered change delivery; mutations remain RPC-only.
GRANT SELECT ON public.trips, public.trip_progress TO anon, authenticated;
GRANT SELECT ON public.seat_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_driver_id(), public.is_trip_driver(UUID)
TO authenticated;

-- A confirmed booking is still active; prevent the same passenger from opening
-- another held request on the same trip.
DROP INDEX IF EXISTS public.idx_one_active_request_per_passenger;
CREATE UNIQUE INDEX idx_one_active_request_per_passenger
  ON public.seat_requests (trip_id, passenger_id)
  WHERE status IN ('HELD', 'CONFIRMED');
