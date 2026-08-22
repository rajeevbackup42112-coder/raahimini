-- Enforce per-route sequential dispatch: the next driver may collect only after the current trip completes.

CREATE OR REPLACE FUNCTION public.activate_next_driver(p_route_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_next public.driver_queue;
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_route public.routes;
  v_trip_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_route_id::text, 0));

  SELECT * INTO v_route
  FROM public.routes
  WHERE id = p_route_id AND is_active = true;
  IF v_route.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Route is not active');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trips
    WHERE route_id = p_route_id AND status = 'IN_PROGRESS'
  ) OR EXISTS (
    SELECT 1 FROM public.driver_queue
    WHERE route_id = p_route_id AND status = 'IN_PROGRESS'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'blocked_by_in_progress_trip', true,
      'error', 'Current route trip must complete before the next driver can collect'
    );
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

  INSERT INTO public.trips (route_id, driver_id, vehicle_id, queue_entry_id, status, capacity)
  VALUES (p_route_id, v_driver.id, v_vehicle.id, v_next.id, 'ACTIVE_COLLECTING', v_vehicle.capacity)
  RETURNING id INTO v_trip_id;

  INSERT INTO public.trip_seats (trip_id, seat_number)
  SELECT v_trip_id, generate_series(1, v_vehicle.capacity);

  PERFORM public.record_audit(
    'activate_next_driver', 'driver_queue', v_next.id,
    NULL, jsonb_build_object('route_id', p_route_id, 'trip_id', v_trip_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'queue_id', v_next.id,
    'driver_id', v_next.driver_id,
    'trip_id', v_trip_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_trip(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_driver_id uuid;
  v_trip public.trips;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a driver');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL OR v_trip.driver_id != v_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found or not authorized');
  END IF;

  IF v_trip.status = 'IN_PROGRESS' THEN
    RETURN jsonb_build_object('success', true, 'already_started', true);
  END IF;

  IF v_trip.status != 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip is not in ACTIVE_COLLECTING state');
  END IF;

  IF v_trip.held_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Cannot start: %s held request(s) must be resolved', v_trip.held_count));
  END IF;

  IF v_trip.confirmed_count + v_trip.driver_closed_count != v_trip.capacity THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Cannot start: confirmed(%s) + closed(%s) must equal capacity(%s)',
        v_trip.confirmed_count, v_trip.driver_closed_count, v_trip.capacity));
  END IF;

  UPDATE public.trips SET status = 'IN_PROGRESS', started_at = now() WHERE id = p_trip_id;
  UPDATE public.driver_queue SET status = 'IN_PROGRESS' WHERE id = v_trip.queue_entry_id;

  PERFORM public.record_audit(
    'start_trip', 'trips', p_trip_id,
    NULL, jsonb_build_object(
      'sequential_dispatch', true,
      'next_driver_deferred_until_completion', true
    )
  );

  RETURN jsonb_build_object('success', true, 'next_driver_deferred_until_completion', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_trip(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_driver_id uuid;
  v_trip public.trips;
  v_final_stop_order integer;
  v_activation jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE profile_id = auth.uid() AND is_active = true;
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not an active driver');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL OR v_trip.driver_id IS DISTINCT FROM v_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found or not authorized');
  END IF;

  IF v_trip.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  IF v_trip.status <> 'IN_PROGRESS' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip is not IN_PROGRESS');
  END IF;

  SELECT max(stop_order) INTO v_final_stop_order
  FROM public.route_stops
  WHERE route_id = v_trip.route_id;
  IF v_final_stop_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip route has no stops');
  END IF;

  IF v_trip.current_stop_order <> v_final_stop_order THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Trip can be completed only at the final stop',
      'current_stop_order', v_trip.current_stop_order,
      'final_stop_order', v_final_stop_order
    );
  END IF;

  UPDATE public.trips SET status = 'COMPLETED', completed_at = now() WHERE id = p_trip_id;
  UPDATE public.driver_queue SET status = 'DONE', completed_at = now() WHERE id = v_trip.queue_entry_id;
  UPDATE public.drivers SET trips_completed = trips_completed + 1 WHERE id = v_driver_id;

  INSERT INTO public.behaviour_events (actor_id, actor_role, event_type, trip_id)
  SELECT sr.passenger_id, 'passenger', 'trip_completed', p_trip_id
  FROM public.seat_requests sr
  WHERE sr.trip_id = p_trip_id AND sr.status = 'CONFIRMED';

  PERFORM public.record_behaviour(v_driver_id, 'driver', 'trip_completed', p_trip_id);
  SELECT public.activate_next_driver(v_trip.route_id) INTO v_activation;
  PERFORM public.record_audit(
    'complete_trip', 'trips', p_trip_id,
    NULL, jsonb_build_object('next_driver_activation', v_activation, 'sequential_dispatch', true)
  );

  RETURN jsonb_build_object('success', true, 'next_driver_activation', v_activation);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.activate_next_driver(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_next_driver(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.start_trip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_trip(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_trip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_trip(uuid) TO authenticated;
