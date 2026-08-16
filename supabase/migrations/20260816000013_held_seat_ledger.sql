-- ============================================================
-- RAAHI MINI — MIGRATION 13: AUTHORITATIVE HELD-SEAT LEDGER
-- Every HELD/CONFIRMED request owns concrete trip_seats rows.
-- Trip counters remain fast projections, but the seat ledger now mirrors them.
-- ============================================================

ALTER TABLE public.trip_seats
  DROP CONSTRAINT IF EXISTS trip_seats_request_ownership;
ALTER TABLE public.trip_seats
  ADD CONSTRAINT trip_seats_request_ownership CHECK (
    (state IN ('AVAILABLE', 'DRIVER_CLOSED') AND request_id IS NULL)
    OR
    (state IN ('HELD', 'CONFIRMED') AND request_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.request_seats(
  p_trip_id UUID,
  p_pickup_stop_id UUID,
  p_seat_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trips;
  v_stop public.route_stops;
  v_profile public.profiles;
  v_request_id UUID;
  v_available INTEGER;
  v_seat_numbers INTEGER[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF v_profile.id IS NULL OR v_profile.is_restricted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is restricted or unavailable');
  END IF;

  IF p_seat_count < 1 OR p_seat_count > 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid seat count');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
  END IF;
  IF v_trip.status <> 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip is not accepting requests');
  END IF;

  SELECT * INTO v_stop
  FROM public.route_stops
  WHERE id = p_pickup_stop_id AND route_id = v_trip.route_id;
  IF v_stop.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid pickup stop for this route');
  END IF;
  IF v_stop.stop_order < v_trip.current_stop_order THEN
    RETURN jsonb_build_object('success', false, 'error', 'Driver has already passed this pickup point');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.seat_requests
    WHERE trip_id = p_trip_id
      AND passenger_id = auth.uid()
      AND status IN ('HELD', 'CONFIRMED')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active request for this trip');
  END IF;

  v_available := v_trip.capacity - v_trip.confirmed_count - v_trip.held_count - v_trip.driver_closed_count;
  IF v_available < p_seat_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Only %s seat(s) available — cannot partially fulfil request', v_available)
    );
  END IF;

  SELECT ARRAY(
    SELECT seat_number
    FROM public.trip_seats
    WHERE trip_id = p_trip_id AND state = 'AVAILABLE'
    ORDER BY seat_number
    LIMIT p_seat_count
    FOR UPDATE
  ) INTO v_seat_numbers;

  IF COALESCE(array_length(v_seat_numbers, 1), 0) <> p_seat_count THEN
    RAISE EXCEPTION 'Seat ledger mismatch for trip %', p_trip_id;
  END IF;

  INSERT INTO public.seat_requests (
    trip_id, passenger_id, pickup_stop_id, pickup_stop_order, seat_count, status
  ) VALUES (
    p_trip_id, auth.uid(), p_pickup_stop_id, v_stop.stop_order, p_seat_count, 'HELD'
  ) RETURNING id INTO v_request_id;

  UPDATE public.trip_seats
  SET state = 'HELD', request_id = v_request_id, updated_at = now()
  WHERE trip_id = p_trip_id AND seat_number = ANY(v_seat_numbers) AND state = 'AVAILABLE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to reserve seat ledger for trip %', p_trip_id;
  END IF;

  UPDATE public.trips
  SET held_count = held_count + p_seat_count
  WHERE id = p_trip_id;

  PERFORM public.record_behaviour(
    auth.uid(), 'passenger', 'request_created', p_trip_id, v_request_id,
    jsonb_build_object('seat_numbers', v_seat_numbers)
  );
  PERFORM public.record_audit(
    'request_seats', 'seat_requests', v_request_id, NULL,
    jsonb_build_object(
      'trip_id', p_trip_id,
      'seat_count', p_seat_count,
      'stop', v_stop.name,
      'seat_numbers', v_seat_numbers
    ), NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'status', 'HELD',
    'seat_numbers', v_seat_numbers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_seat_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.seat_requests;
  v_trip public.trips;
  v_released INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_request
  FROM public.seat_requests
  WHERE id = p_request_id AND passenger_id = auth.uid()
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;
  IF v_request.status <> 'HELD' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only HELD requests can be withdrawn');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_request.trip_id FOR UPDATE;

  UPDATE public.trip_seats
  SET state = 'AVAILABLE', request_id = NULL, updated_at = now()
  WHERE trip_id = v_request.trip_id
    AND request_id = p_request_id
    AND state = 'HELD';
  GET DIAGNOSTICS v_released = ROW_COUNT;

  IF v_released <> v_request.seat_count THEN
    RAISE EXCEPTION 'Held-seat ledger mismatch for request %', p_request_id;
  END IF;

  UPDATE public.seat_requests
  SET status = 'WITHDRAWN', withdrawn_at = now()
  WHERE id = p_request_id;

  UPDATE public.trips
  SET held_count = held_count - v_request.seat_count
  WHERE id = v_request.trip_id;

  PERFORM public.record_behaviour(auth.uid(), 'passenger', 'request_withdrawn', v_request.trip_id, p_request_id);
  PERFORM public.record_audit('withdraw_seat_request', 'seat_requests', p_request_id);

  RETURN jsonb_build_object('success', true, 'released_seats', v_released);
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_confirm_payment(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_request public.seat_requests;
  v_trip public.trips;
  v_seat_numbers INTEGER[];
  v_confirmed INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE profile_id = auth.uid() AND is_active = true;
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a driver');
  END IF;

  SELECT * INTO v_request
  FROM public.seat_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status = 'CONFIRMED' THEN
    SELECT ARRAY_AGG(seat_number ORDER BY seat_number) INTO v_seat_numbers
    FROM public.trip_seats
    WHERE request_id = p_request_id AND state = 'CONFIRMED';
    RETURN jsonb_build_object('success', true, 'already_confirmed', true, 'seat_numbers', v_seat_numbers);
  END IF;
  IF v_request.status <> 'HELD' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not in HELD state');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_request.trip_id FOR UPDATE;
  IF v_trip.id IS NULL OR v_trip.driver_id IS DISTINCT FROM v_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this trip');
  END IF;
  IF v_trip.status <> 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip is no longer collecting passengers');
  END IF;
  IF v_request.pickup_stop_order < v_trip.current_stop_order THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pickup opportunity has been passed');
  END IF;

  SELECT ARRAY_AGG(seat_number ORDER BY seat_number) INTO v_seat_numbers
  FROM public.trip_seats
  WHERE trip_id = v_request.trip_id
    AND request_id = p_request_id
    AND state = 'HELD'
  FOR UPDATE;

  IF COALESCE(array_length(v_seat_numbers, 1), 0) <> v_request.seat_count THEN
    RAISE EXCEPTION 'Held-seat ledger mismatch for request %', p_request_id;
  END IF;

  UPDATE public.trip_seats
  SET state = 'CONFIRMED', updated_at = now()
  WHERE trip_id = v_request.trip_id
    AND request_id = p_request_id
    AND state = 'HELD';
  GET DIAGNOSTICS v_confirmed = ROW_COUNT;

  UPDATE public.seat_requests
  SET status = 'CONFIRMED', confirmed_at = now()
  WHERE id = p_request_id;

  UPDATE public.trips
  SET confirmed_count = confirmed_count + v_request.seat_count,
      held_count = held_count - v_request.seat_count
  WHERE id = v_request.trip_id;

  PERFORM public.record_behaviour(v_request.passenger_id, 'passenger', 'booking_confirmed', v_request.trip_id, p_request_id);
  PERFORM public.record_audit(
    'driver_confirm_payment', 'seat_requests', p_request_id, NULL,
    jsonb_build_object('seat_numbers', v_seat_numbers), NULL
  );

  RETURN jsonb_build_object('success', true, 'seat_numbers', v_seat_numbers, 'confirmed_seats', v_confirmed);
END;
$$;

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
  v_expired_ids UUID[] := ARRAY[]::UUID[];
  v_ledger_released INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE profile_id = auth.uid() AND is_active = true;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL OR v_trip.driver_id IS DISTINCT FROM v_driver_id
     OR v_trip.status <> 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found, not authorized, or not collecting');
  END IF;

  SELECT * INTO v_stop
  FROM public.route_stops
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
    WHERE trip_id = p_trip_id
      AND status = 'HELD'
      AND pickup_stop_order < v_stop.stop_order
    RETURNING id, seat_count
  )
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]), COALESCE(SUM(seat_count), 0)::INTEGER
  INTO v_expired_ids, v_released
  FROM expired;

  IF COALESCE(array_length(v_expired_ids, 1), 0) > 0 THEN
    UPDATE public.trip_seats
    SET state = 'AVAILABLE', request_id = NULL, updated_at = now()
    WHERE trip_id = p_trip_id
      AND request_id = ANY(v_expired_ids)
      AND state = 'HELD';
    GET DIAGNOSTICS v_ledger_released = ROW_COUNT;

    IF v_ledger_released <> v_released THEN
      RAISE EXCEPTION 'Expired-seat ledger mismatch on trip %', p_trip_id;
    END IF;
  END IF;

  UPDATE public.trips
  SET current_stop_order = v_stop.stop_order,
      held_count = held_count - v_released
  WHERE id = p_trip_id;

  PERFORM public.record_audit(
    'driver_arrive_at_stop', 'trips', p_trip_id, NULL,
    jsonb_build_object('stop', v_stop.name, 'stop_order', v_stop.stop_order, 'released_seats', v_released), NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'current_stop_order', v_stop.stop_order,
    'stop_name', v_stop.name,
    'released_seats', v_released
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_mark_passenger_absent(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_request public.seat_requests;
  v_trip public.trips;
  v_released INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid() AND is_active = true;
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a driver');
  END IF;

  SELECT * INTO v_request
  FROM public.seat_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF v_request.id IS NULL OR v_request.status <> 'HELD' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or not HELD');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_request.trip_id FOR UPDATE;
  IF v_trip.driver_id IS DISTINCT FROM v_driver_id OR v_trip.status <> 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this collecting trip');
  END IF;

  UPDATE public.trip_seats
  SET state = 'AVAILABLE', request_id = NULL, updated_at = now()
  WHERE trip_id = v_request.trip_id
    AND request_id = p_request_id
    AND state = 'HELD';
  GET DIAGNOSTICS v_released = ROW_COUNT;

  IF v_released <> v_request.seat_count THEN
    RAISE EXCEPTION 'Held-seat ledger mismatch for request %', p_request_id;
  END IF;

  UPDATE public.seat_requests
  SET status = 'EXPIRED', expired_at = now()
  WHERE id = p_request_id;

  UPDATE public.trips
  SET held_count = held_count - v_request.seat_count
  WHERE id = v_request.trip_id;

  PERFORM public.record_behaviour(v_request.passenger_id, 'passenger', 'request_expired', v_request.trip_id, p_request_id);
  PERFORM public.record_audit('driver_mark_passenger_absent', 'seat_requests', p_request_id);

  RETURN jsonb_build_object('success', true, 'released_seats', v_released);
END;
$$;

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
  v_released_held INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid() AND is_active = true;
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

  v_event_type := CASE
    WHEN v_confirmed_count > 0 THEN 'driver_cancel_after_confirmation'::public.behaviour_event_type
    ELSE 'driver_cancel_before_confirmation'::public.behaviour_event_type
  END;

  UPDATE public.trip_seats
  SET state = 'AVAILABLE', request_id = NULL, updated_at = now()
  WHERE trip_id = p_trip_id AND state = 'HELD';
  GET DIAGNOSTICS v_released_held = ROW_COUNT;

  IF v_released_held <> v_trip.held_count THEN
    RAISE EXCEPTION 'Held-seat ledger mismatch on cancelled trip %', p_trip_id;
  END IF;

  UPDATE public.seat_requests
  SET status = 'EXPIRED', expired_at = now()
  WHERE trip_id = p_trip_id AND status = 'HELD';

  UPDATE public.seat_requests
  SET status = 'DRIVER_CANCELLED', cancelled_at = now()
  WHERE trip_id = p_trip_id AND status = 'CONFIRMED';

  UPDATE public.trips
  SET status = 'CANCELLED', cancelled_at = now(), held_count = 0
  WHERE id = p_trip_id;

  UPDATE public.driver_queue
  SET status = 'CANCELLED'
  WHERE id = v_trip.queue_entry_id;

  SELECT public.activate_next_driver(v_trip.route_id) INTO v_activate_result;

  PERFORM public.record_behaviour(
    v_driver_id, 'driver', v_event_type, p_trip_id, NULL,
    jsonb_build_object(
      'confirmed_seats_affected', v_confirmed_count,
      'held_seats_released', v_released_held
    )
  );
  PERFORM public.record_audit(
    'driver_cancel_trip', 'trips', p_trip_id, NULL,
    jsonb_build_object(
      'confirmed_seats_affected', v_confirmed_count,
      'held_seats_released', v_released_held,
      'event_type', v_event_type
    ), NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_type', v_event_type,
    'confirmed_seats_affected', v_confirmed_count,
    'held_seats_released', v_released_held,
    'next_driver_activated', v_activate_result
  );
END;
$$;

-- Restore explicit callable surface after replacing functions.
REVOKE EXECUTE ON FUNCTION public.request_seats(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_seats(UUID, UUID, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.withdraw_seat_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_seat_request(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_confirm_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_confirm_payment(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_arrive_at_stop(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_arrive_at_stop(UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_mark_passenger_absent(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_mark_passenger_absent(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_cancel_trip(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_cancel_trip(UUID) TO authenticated;
