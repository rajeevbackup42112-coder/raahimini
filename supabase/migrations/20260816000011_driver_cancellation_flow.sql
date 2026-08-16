-- RAAHI MINI — MIGRATION 11
-- Driver cancellation after confirmation must not leave passengers stuck in CONFIRMED.

ALTER TABLE public.seat_requests
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.driver_cancel_trip(p_trip_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_trip public.trips;
  v_confirmed_count INTEGER;
  v_event_type public.behaviour_event_type;
  v_activate_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a driver');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL OR v_trip.driver_id IS DISTINCT FROM v_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found or not authorized');
  END IF;

  IF v_trip.status <> 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only cancel ACTIVE_COLLECTING trips');
  END IF;

  SELECT COALESCE(SUM(seat_count), 0)::INTEGER INTO v_confirmed_count
  FROM public.seat_requests
  WHERE trip_id = p_trip_id AND status = 'CONFIRMED';

  IF v_confirmed_count > 0 THEN
    v_event_type := 'driver_cancel_after_confirmation';
  ELSE
    v_event_type := 'driver_cancel_before_confirmation';
  END IF;

  UPDATE public.trips
  SET status = 'CANCELLED', cancelled_at = now(), held_count = 0
  WHERE id = p_trip_id;

  UPDATE public.seat_requests
  SET status = 'EXPIRED', expired_at = now()
  WHERE trip_id = p_trip_id AND status = 'HELD';

  UPDATE public.seat_requests
  SET status = 'DRIVER_CANCELLED', cancelled_at = now()
  WHERE trip_id = p_trip_id AND status = 'CONFIRMED';

  UPDATE public.driver_queue SET status = 'CANCELLED'
  WHERE id = v_trip.queue_entry_id;

  SELECT public.activate_next_driver(v_trip.route_id) INTO v_activate_result;

  PERFORM public.record_behaviour(
    v_driver_id, 'driver', v_event_type, p_trip_id, NULL,
    jsonb_build_object('confirmed_seats_affected', v_confirmed_count)
  );

  PERFORM public.record_audit(
    'driver_cancel_trip', 'trips', p_trip_id, NULL,
    jsonb_build_object('confirmed_seats_affected', v_confirmed_count, 'event_type', v_event_type),
    NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_type', v_event_type,
    'confirmed_seats_affected', v_confirmed_count,
    'next_driver_activated', v_activate_result
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_driver_cancelled_request()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.seat_requests;
  v_trip public.trips;
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_route public.routes;
  v_stop public.route_stops;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_request
  FROM public.seat_requests
  WHERE passenger_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_request.id IS NULL OR v_request.status <> 'DRIVER_CANCELLED' THEN
    RETURN jsonb_build_object('has_driver_cancelled_request', false);
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_request.trip_id;
  SELECT * INTO v_driver FROM public.drivers WHERE id = v_trip.driver_id;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_trip.vehicle_id;
  SELECT * INTO v_route FROM public.routes WHERE id = v_trip.route_id;
  SELECT * INTO v_stop FROM public.route_stops WHERE id = v_request.pickup_stop_id;

  RETURN jsonb_build_object(
    'has_driver_cancelled_request', true,
    'request_id', v_request.id,
    'trip_id', v_trip.id,
    'route_id', v_trip.route_id,
    'route_label', v_route.direction_label,
    'seat_count', v_request.seat_count,
    'pickup_stop_name', v_stop.name,
    'driver_display_name', v_driver.display_name,
    'driver_phone', v_driver.phone,
    'vehicle_number', v_vehicle.registration_number,
    'cancelled_at', v_request.cancelled_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.passenger_report_refund_problem(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.seat_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_request
  FROM public.seat_requests
  WHERE id = p_request_id AND passenger_id = auth.uid()
  FOR UPDATE;

  IF v_request.id IS NULL OR v_request.status <> 'DRIVER_CANCELLED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No cancelled confirmed request found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.behaviour_events
    WHERE actor_id = auth.uid()
      AND event_type = 'refund_dispute'
      AND request_id = p_request_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_reported', true);
  END IF;

  PERFORM public.record_behaviour(
    auth.uid(), 'passenger', 'refund_dispute', v_request.trip_id, p_request_id,
    jsonb_build_object('source', 'passenger_cancelled_ride_screen')
  );

  PERFORM public.record_audit(
    'passenger_report_refund_problem', 'seat_requests', p_request_id, NULL, NULL,
    jsonb_build_object('passenger_id', auth.uid())
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.driver_cancel_trip(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_cancel_trip(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_driver_cancelled_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_driver_cancelled_request() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.passenger_report_refund_problem(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.passenger_report_refund_problem(UUID) TO authenticated;
