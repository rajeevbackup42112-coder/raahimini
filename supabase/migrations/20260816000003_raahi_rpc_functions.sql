-- ============================================================
-- RAAHI MINI — MIGRATION 3: CANONICAL RPC FUNCTIONS
-- All business state transitions as SECURITY DEFINER RPCs
-- ============================================================

-- ─── HELPER: record audit event ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_audit(
  p_action TEXT,
  p_table_name TEXT DEFAULT NULL,
  p_record_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, old_data, new_data, metadata)
  VALUES (auth.uid(), p_action, p_table_name, p_record_id, p_old_data, p_new_data, p_metadata);
END;
$$;

-- ─── HELPER: record behaviour event ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_behaviour(
  p_actor_id UUID,
  p_actor_role public.user_role,
  p_event_type public.behaviour_event_type,
  p_trip_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.behaviour_events (actor_id, actor_role, event_type, trip_id, request_id, metadata)
  VALUES (p_actor_id, p_actor_role, p_event_type, p_trip_id, p_request_id, p_metadata);
END;
$$;

-- ─── join_driver_queue ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_driver_queue(p_route_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_profile public.profiles;
  v_next_position INTEGER;
  v_queue_id UUID;
BEGIN
  -- Authenticate
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get profile and verify driver role
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF v_profile.role NOT IN ('driver', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized as driver');
  END IF;
  IF v_profile.is_restricted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is restricted');
  END IF;

  -- Get driver record
  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid() AND is_active = true;
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active driver record found');
  END IF;

  -- Check not already in queue for this route
  IF EXISTS (
    SELECT 1 FROM public.driver_queue
    WHERE driver_id = v_driver_id AND route_id = p_route_id AND status IN ('WAITING', 'ACTIVE_COLLECTING')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already in queue for this route');
  END IF;

  -- Get next queue position
  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_next_position
  FROM public.driver_queue
  WHERE route_id = p_route_id AND status IN ('WAITING', 'ACTIVE_COLLECTING');

  -- Insert queue entry
  INSERT INTO public.driver_queue (driver_id, route_id, queue_position, status)
  VALUES (v_driver_id, p_route_id, v_next_position, 'WAITING')
  RETURNING id INTO v_queue_id;

  -- If no active collecting driver, activate this one
  IF NOT EXISTS (
    SELECT 1 FROM public.driver_queue
    WHERE route_id = p_route_id AND status = 'ACTIVE_COLLECTING'
  ) THEN
    UPDATE public.driver_queue
    SET status = 'ACTIVE_COLLECTING', activated_at = now()
    WHERE id = v_queue_id;
  END IF;

  PERFORM public.record_audit('join_driver_queue', 'driver_queue', v_queue_id,
    NULL, jsonb_build_object('route_id', p_route_id, 'driver_id', v_driver_id));

  RETURN jsonb_build_object('success', true, 'queue_id', v_queue_id);
END;
$$;

-- ─── leave_driver_queue ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leave_driver_queue(p_route_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_queue_entry public.driver_queue;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No driver record found');
  END IF;

  SELECT * INTO v_queue_entry FROM public.driver_queue
  WHERE driver_id = v_driver_id AND route_id = p_route_id AND status = 'WAITING'
  FOR UPDATE;

  IF v_queue_entry.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not in waiting queue for this route');
  END IF;

  UPDATE public.driver_queue SET status = 'CANCELLED' WHERE id = v_queue_entry.id;

  -- Reorder remaining queue
  UPDATE public.driver_queue
  SET queue_position = queue_position - 1
  WHERE route_id = p_route_id AND status = 'WAITING'
    AND queue_position > v_queue_entry.queue_position;

  PERFORM public.record_audit('leave_driver_queue', 'driver_queue', v_queue_entry.id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── activate_next_driver ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_next_driver(p_route_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_entry public.driver_queue;
BEGIN
  -- Find next WAITING driver in FIFO order
  SELECT * INTO v_next_entry
  FROM public.driver_queue
  WHERE route_id = p_route_id AND status = 'WAITING'
  ORDER BY queue_position ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_next_entry.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No waiting drivers in queue');
  END IF;

  UPDATE public.driver_queue
  SET status = 'ACTIVE_COLLECTING', activated_at = now()
  WHERE id = v_next_entry.id;

  PERFORM public.record_audit('activate_next_driver', 'driver_queue', v_next_entry.id,
    NULL, jsonb_build_object('route_id', p_route_id));

  RETURN jsonb_build_object('success', true, 'queue_id', v_next_entry.id, 'driver_id', v_next_entry.driver_id);
END;
$$;

-- ─── request_seats ────────────────────────────────────────────────────────────
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
BEGIN
  -- Authenticate
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF v_profile.is_restricted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is restricted');
  END IF;

  -- Validate seat count
  IF p_seat_count < 1 OR p_seat_count > 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid seat count');
  END IF;

  -- Lock and get trip
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
  END IF;
  IF v_trip.status != 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip is not accepting requests');
  END IF;

  -- Get stop and validate it has not been passed
  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_pickup_stop_id AND route_id = v_trip.route_id;
  IF v_stop.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid pickup stop for this route');
  END IF;
  IF v_stop.stop_order < v_trip.current_stop_order THEN
    RETURN jsonb_build_object('success', false, 'error', 'Driver has already passed this pickup point');
  END IF;

  -- Check no existing active request from this passenger on this trip
  IF EXISTS (
    SELECT 1 FROM public.seat_requests
    WHERE trip_id = p_trip_id AND passenger_id = auth.uid() AND status = 'HELD'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active request for this trip');
  END IF;

  -- Calculate available seats (atomic)
  v_available := v_trip.capacity - v_trip.confirmed_count - v_trip.held_count - v_trip.driver_closed_count;
  IF v_available < p_seat_count THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Only %s seat(s) available — cannot partially fulfil request', v_available));
  END IF;

  -- Create request
  INSERT INTO public.seat_requests (trip_id, passenger_id, pickup_stop_id, pickup_stop_order, seat_count, status)
  VALUES (p_trip_id, auth.uid(), p_pickup_stop_id, v_stop.stop_order, p_seat_count, 'HELD')
  RETURNING id INTO v_request_id;

  -- Update trip held count
  UPDATE public.trips SET held_count = held_count + p_seat_count WHERE id = p_trip_id;

  -- Record behaviour
  PERFORM public.record_behaviour(auth.uid(), 'passenger', 'request_created', p_trip_id, v_request_id);
  PERFORM public.record_audit('request_seats', 'seat_requests', v_request_id,
    NULL, jsonb_build_object('trip_id', p_trip_id, 'seat_count', p_seat_count, 'stop', v_stop.name));

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id, 'status', 'HELD');
END;
$$;

-- ─── withdraw_seat_request ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdraw_seat_request(p_request_id UUID)
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

  SELECT * INTO v_request FROM public.seat_requests
  WHERE id = p_request_id AND passenger_id = auth.uid()
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;
  IF v_request.status != 'HELD' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only HELD requests can be withdrawn');
  END IF;

  -- Update request
  UPDATE public.seat_requests
  SET status = 'WITHDRAWN', withdrawn_at = now()
  WHERE id = p_request_id;

  -- Release held seats
  UPDATE public.trips
  SET held_count = GREATEST(0, held_count - v_request.seat_count)
  WHERE id = v_request.trip_id;

  PERFORM public.record_behaviour(auth.uid(), 'passenger', 'request_withdrawn', v_request.trip_id, p_request_id);
  PERFORM public.record_audit('withdraw_seat_request', 'seat_requests', p_request_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── driver_confirm_payment ───────────────────────────────────────────────────
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
  v_stop public.route_stops;
  v_seat_numbers INTEGER[];
  v_next_seat INTEGER;
  i INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get driver
  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a driver');
  END IF;

  -- Get and lock request
  SELECT * INTO v_request FROM public.seat_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  -- Idempotent: already confirmed
  IF v_request.status = 'CONFIRMED' THEN
    RETURN jsonb_build_object('success', true, 'already_confirmed', true);
  END IF;

  IF v_request.status != 'HELD' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not in HELD state');
  END IF;

  -- Get and lock trip
  SELECT * INTO v_trip FROM public.trips WHERE id = v_request.trip_id FOR UPDATE;

  -- Verify driver owns this trip
  IF v_trip.driver_id != v_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this trip');
  END IF;

  -- Verify pickup opportunity not passed
  IF v_request.pickup_stop_order < v_trip.current_stop_order THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pickup opportunity has been passed');
  END IF;

  -- Allocate seat numbers
  v_seat_numbers := ARRAY[]::INTEGER[];
  FOR i IN 1..v_request.seat_count LOOP
    SELECT seat_number INTO v_next_seat
    FROM public.trip_seats
    WHERE trip_id = v_request.trip_id AND state = 'AVAILABLE'
    ORDER BY seat_number ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_next_seat IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No available seats to allocate');
    END IF;

    UPDATE public.trip_seats
    SET state = 'CONFIRMED', request_id = p_request_id
    WHERE trip_id = v_request.trip_id AND seat_number = v_next_seat;

    v_seat_numbers := array_append(v_seat_numbers, v_next_seat);
  END LOOP;

  -- Confirm request
  UPDATE public.seat_requests
  SET status = 'CONFIRMED', confirmed_at = now()
  WHERE id = p_request_id;

  -- Update trip counts
  UPDATE public.trips
  SET confirmed_count = confirmed_count + v_request.seat_count,
      held_count = GREATEST(0, held_count - v_request.seat_count)
  WHERE id = v_request.trip_id;

  PERFORM public.record_behaviour(v_request.passenger_id, 'passenger', 'booking_confirmed', v_request.trip_id, p_request_id);
  PERFORM public.record_audit('driver_confirm_payment', 'seat_requests', p_request_id,
    NULL, jsonb_build_object('seat_numbers', v_seat_numbers));

  RETURN jsonb_build_object('success', true, 'seat_numbers', v_seat_numbers);
END;
$$;

-- ─── driver_mark_passenger_absent ─────────────────────────────────────────────
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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a driver');
  END IF;

  SELECT * INTO v_request FROM public.seat_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.status != 'HELD' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or not HELD');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_request.trip_id FOR UPDATE;
  IF v_trip.driver_id != v_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this trip');
  END IF;

  -- Expire the request (driver passed pickup without confirmation)
  UPDATE public.seat_requests
  SET status = 'EXPIRED', expired_at = now()
  WHERE id = p_request_id;

  -- Release held seats
  UPDATE public.trips
  SET held_count = GREATEST(0, held_count - v_request.seat_count)
  WHERE id = v_request.trip_id;

  PERFORM public.record_behaviour(v_request.passenger_id, 'passenger', 'request_expired', v_request.trip_id, p_request_id);
  PERFORM public.record_audit('driver_mark_passenger_absent', 'seat_requests', p_request_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── driver_arrive_at_stop ────────────────────────────────────────────────────
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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a driver');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
  END IF;
  IF v_trip.driver_id != v_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this trip');
  END IF;
  IF v_trip.status != 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip is not in ACTIVE_COLLECTING state');
  END IF;

  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id AND route_id = v_trip.route_id;
  IF v_stop.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stop not found on this route');
  END IF;

  -- Record arrival
  INSERT INTO public.trip_progress (trip_id, stop_id, stop_order)
  VALUES (p_trip_id, p_stop_id, v_stop.stop_order)
  ON CONFLICT (trip_id, stop_order) DO UPDATE SET arrived_at = now();

  -- Update current stop
  UPDATE public.trips SET current_stop_order = v_stop.stop_order WHERE id = p_trip_id;

  -- Expire HELD requests for passengers at stops that have been passed
  UPDATE public.seat_requests
  SET status = 'EXPIRED', expired_at = now()
  WHERE trip_id = p_trip_id
    AND status = 'HELD'
    AND pickup_stop_order < v_stop.stop_order;

  -- Release held seats for expired requests
  WITH expired AS (
    SELECT SUM(seat_count) AS total
    FROM public.seat_requests
    WHERE trip_id = p_trip_id AND status = 'EXPIRED'
      AND expired_at >= now() - INTERVAL '5 seconds'
  )
  UPDATE public.trips
  SET held_count = GREATEST(0, held_count - COALESCE((SELECT total FROM expired), 0))
  WHERE id = p_trip_id;

  PERFORM public.record_audit('driver_arrive_at_stop', 'trips', p_trip_id,
    NULL, jsonb_build_object('stop', v_stop.name, 'stop_order', v_stop.stop_order));

  RETURN jsonb_build_object('success', true, 'current_stop_order', v_stop.stop_order, 'stop_name', v_stop.name);
END;
$$;

-- ─── driver_advance_stop (convenience: advance to next stop) ──────────────────
CREATE OR REPLACE FUNCTION public.driver_advance_stop(p_trip_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_trip public.trips;
  v_next_stop public.route_stops;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a driver');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;
  IF v_trip.id IS NULL OR v_trip.driver_id != v_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found or not authorized');
  END IF;

  -- Get next stop
  SELECT * INTO v_next_stop
  FROM public.route_stops
  WHERE route_id = v_trip.route_id AND stop_order = v_trip.current_stop_order + 1;

  IF v_next_stop.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already at last stop');
  END IF;

  RETURN public.driver_arrive_at_stop(p_trip_id, v_next_stop.id);
END;
$$;

-- ─── driver_close_empty_seats ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.driver_close_empty_seats(p_trip_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_trip public.trips;
  v_available INTEGER;
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
  IF v_trip.status != 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip is not in ACTIVE_COLLECTING state');
  END IF;

  -- Cannot close if there are held requests
  IF v_trip.held_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('%s held request(s) must be resolved before closing seats', v_trip.held_count));
  END IF;

  v_available := v_trip.capacity - v_trip.confirmed_count - v_trip.held_count - v_trip.driver_closed_count;
  IF v_available <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No available seats to close');
  END IF;

  -- Close available seats
  UPDATE public.trip_seats
  SET state = 'DRIVER_CLOSED'
  WHERE trip_id = p_trip_id AND state = 'AVAILABLE';

  -- Update trip counts
  UPDATE public.trips
  SET driver_closed_count = driver_closed_count + v_available
  WHERE id = p_trip_id;

  PERFORM public.record_audit('driver_close_empty_seats', 'trips', p_trip_id,
    NULL, jsonb_build_object('closed_count', v_available));

  RETURN jsonb_build_object('success', true, 'closed_count', v_available);
END;
$$;

-- ─── start_trip ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_trip(p_trip_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_trip public.trips;
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
  IF v_trip.id IS NULL OR v_trip.driver_id != v_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found or not authorized');
  END IF;

  -- Idempotent
  IF v_trip.status = 'IN_PROGRESS' THEN
    RETURN jsonb_build_object('success', true, 'already_started', true);
  END IF;

  IF v_trip.status != 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip is not in ACTIVE_COLLECTING state');
  END IF;

  -- DEPARTURE INVARIANT: confirmed + driver_closed = capacity AND held = 0
  IF v_trip.held_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Cannot start: %s held request(s) must be resolved', v_trip.held_count));
  END IF;

  IF v_trip.confirmed_count + v_trip.driver_closed_count != v_trip.capacity THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Cannot start: confirmed(%s) + closed(%s) must equal capacity(%s)',
        v_trip.confirmed_count, v_trip.driver_closed_count, v_trip.capacity));
  END IF;

  -- Start trip
  UPDATE public.trips
  SET status = 'IN_PROGRESS', started_at = now()
  WHERE id = p_trip_id;

  -- Mark queue entry as IN_PROGRESS
  UPDATE public.driver_queue
  SET status = 'IN_PROGRESS'
  WHERE id = v_trip.queue_entry_id;

  -- Activate next driver in queue (FIFO)
  SELECT public.activate_next_driver(v_trip.route_id) INTO v_activate_result;

  PERFORM public.record_audit('start_trip', 'trips', p_trip_id,
    NULL, jsonb_build_object('next_driver_activated', v_activate_result));

  RETURN jsonb_build_object('success', true, 'next_driver_activated', v_activate_result);
END;
$$;

-- ─── complete_trip ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_trip(p_trip_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
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

  -- Idempotent
  IF v_trip.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  IF v_trip.status != 'IN_PROGRESS' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip is not IN_PROGRESS');
  END IF;

  -- Complete trip
  UPDATE public.trips SET status = 'COMPLETED', completed_at = now() WHERE id = p_trip_id;

  -- Mark queue entry as DONE
  UPDATE public.driver_queue SET status = 'DONE', completed_at = now()
  WHERE id = v_trip.queue_entry_id;

  -- Increment driver trips_completed
  UPDATE public.drivers SET trips_completed = trips_completed + 1 WHERE id = v_driver_id;

  -- Record behaviour for all confirmed passengers
  INSERT INTO public.behaviour_events (actor_id, actor_role, event_type, trip_id)
  SELECT sr.passenger_id, 'passenger', 'trip_completed', p_trip_id
  FROM public.seat_requests sr
  WHERE sr.trip_id = p_trip_id AND sr.status = 'CONFIRMED';

  PERFORM public.record_behaviour(v_driver_id, 'driver', 'trip_completed', p_trip_id);
  PERFORM public.record_audit('complete_trip', 'trips', p_trip_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── driver_cancel_trip ───────────────────────────────────────────────────────
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
  IF v_trip.id IS NULL OR v_trip.driver_id != v_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trip not found or not authorized');
  END IF;

  IF v_trip.status NOT IN ('ACTIVE_COLLECTING') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only cancel ACTIVE_COLLECTING trips');
  END IF;

  -- Count confirmed passengers
  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.seat_requests WHERE trip_id = p_trip_id AND status = 'CONFIRMED';

  -- Classify cancellation
  IF v_confirmed_count > 0 THEN
    v_event_type := 'driver_cancel_after_confirmation';
  ELSE
    v_event_type := 'driver_cancel_before_confirmation';
  END IF;

  -- Cancel trip
  UPDATE public.trips SET status = 'CANCELLED', cancelled_at = now() WHERE id = p_trip_id;

  -- Release all held requests
  UPDATE public.seat_requests SET status = 'EXPIRED', expired_at = now()
  WHERE trip_id = p_trip_id AND status = 'HELD';

  -- Mark queue entry as CANCELLED
  UPDATE public.driver_queue SET status = 'CANCELLED' WHERE id = v_trip.queue_entry_id;

  -- Activate next driver
  SELECT public.activate_next_driver(v_trip.route_id) INTO v_activate_result;

  PERFORM public.record_behaviour(v_driver_id, 'driver', v_event_type, p_trip_id);
  PERFORM public.record_audit('driver_cancel_trip', 'trips', p_trip_id,
    NULL, jsonb_build_object('confirmed_count', v_confirmed_count, 'event_type', v_event_type));

  RETURN jsonb_build_object(
    'success', true,
    'event_type', v_event_type,
    'confirmed_passengers_affected', v_confirmed_count,
    'next_driver_activated', v_activate_result
  );
END;
$$;

-- ─── admin_restrict_user ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_restrict_user(p_user_id UUID, p_reason TEXT DEFAULT '')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  UPDATE public.profiles
  SET is_restricted = true, restriction_reason = p_reason
  WHERE id = p_user_id;

  PERFORM public.record_audit('admin_restrict_user', 'profiles', p_user_id,
    NULL, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── admin_unrestrict_user ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unrestrict_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  UPDATE public.profiles
  SET is_restricted = false, restriction_reason = NULL
  WHERE id = p_user_id;

  PERFORM public.record_audit('admin_unrestrict_user', 'profiles', p_user_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── admin_reorder_queue ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reorder_queue(p_queue_id UUID, p_new_position INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.driver_queue;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT * INTO v_entry FROM public.driver_queue WHERE id = p_queue_id AND status = 'WAITING';
  IF v_entry.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue entry not found or not WAITING');
  END IF;

  -- Shift other entries
  IF p_new_position < v_entry.queue_position THEN
    UPDATE public.driver_queue
    SET queue_position = queue_position + 1
    WHERE route_id = v_entry.route_id AND status = 'WAITING'
      AND queue_position >= p_new_position AND queue_position < v_entry.queue_position;
  ELSE
    UPDATE public.driver_queue
    SET queue_position = queue_position - 1
    WHERE route_id = v_entry.route_id AND status = 'WAITING'
      AND queue_position > v_entry.queue_position AND queue_position <= p_new_position;
  END IF;

  UPDATE public.driver_queue SET queue_position = p_new_position WHERE id = p_queue_id;

  PERFORM public.record_audit('admin_reorder_queue', 'driver_queue', p_queue_id,
    NULL, jsonb_build_object('new_position', p_new_position));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── admin_remove_from_queue ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_remove_from_queue(p_queue_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.driver_queue;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT * INTO v_entry FROM public.driver_queue WHERE id = p_queue_id AND status = 'WAITING';
  IF v_entry.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue entry not found or not WAITING');
  END IF;

  UPDATE public.driver_queue SET status = 'CANCELLED' WHERE id = p_queue_id;

  -- Reorder remaining
  UPDATE public.driver_queue
  SET queue_position = queue_position - 1
  WHERE route_id = v_entry.route_id AND status = 'WAITING'
    AND queue_position > v_entry.queue_position;

  PERFORM public.record_audit('admin_remove_from_queue', 'driver_queue', p_queue_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
