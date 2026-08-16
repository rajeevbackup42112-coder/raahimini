-- ============================================================
-- RAAHI MINI — MIGRATION 13: HELD-SEAT LEDGER
-- A HELD request owns concrete trip_seats rows, not only a counter.
-- ============================================================

ALTER TABLE public.trip_seats DROP CONSTRAINT IF EXISTS trip_seats_request_ownership;
ALTER TABLE public.trip_seats ADD CONSTRAINT trip_seats_request_ownership CHECK (
  (state IN ('AVAILABLE','DRIVER_CLOSED') AND request_id IS NULL)
  OR (state IN ('HELD','CONFIRMED') AND request_id IS NOT NULL)
);

-- Internal helper. Caller already owns/locks the request + trip transaction.
CREATE OR REPLACE FUNCTION public.release_held_request_seats(p_request_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.trip_seats
  SET state='AVAILABLE', request_id=NULL, updated_at=now()
  WHERE request_id=p_request_id AND state='HELD';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.release_held_request_seats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_held_request_seats(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.request_seats(
  p_trip_id UUID, p_pickup_stop_id UUID, p_seat_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_trip public.trips;
  v_stop public.route_stops;
  v_profile public.profiles;
  v_request_id UUID;
  v_available INTEGER;
  v_seats INTEGER[];
  v_written INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Authentication required');
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=auth.uid();
  IF v_profile.id IS NULL OR v_profile.is_restricted THEN
    RETURN jsonb_build_object('success',false,'error','Account is restricted or unavailable');
  END IF;
  IF p_seat_count < 1 OR p_seat_count > 4 THEN
    RETURN jsonb_build_object('success',false,'error','Invalid seat count');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id=p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL OR v_trip.status <> 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success',false,'error','Trip is not accepting requests');
  END IF;

  SELECT * INTO v_stop FROM public.route_stops
  WHERE id=p_pickup_stop_id AND route_id=v_trip.route_id;
  IF v_stop.id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Invalid pickup stop for this route');
  END IF;
  IF v_stop.stop_order < v_trip.current_stop_order THEN
    RETURN jsonb_build_object('success',false,'error','Driver has already passed this pickup point');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.seat_requests
    WHERE trip_id=p_trip_id AND passenger_id=auth.uid()
      AND status IN ('HELD','CONFIRMED')
  ) THEN
    RETURN jsonb_build_object('success',false,'error','You already have an active request for this trip');
  END IF;

  v_available := v_trip.capacity-v_trip.confirmed_count-v_trip.held_count-v_trip.driver_closed_count;
  IF v_available < p_seat_count THEN
    RETURN jsonb_build_object('success',false,'error',
      format('Only %s seat(s) available — cannot partially fulfil request',v_available));
  END IF;

  SELECT ARRAY(
    SELECT seat_number FROM public.trip_seats
    WHERE trip_id=p_trip_id AND state='AVAILABLE'
    ORDER BY seat_number LIMIT p_seat_count FOR UPDATE
  ) INTO v_seats;
  IF COALESCE(array_length(v_seats,1),0) <> p_seat_count THEN
    RAISE EXCEPTION 'Seat ledger mismatch for trip %',p_trip_id;
  END IF;

  INSERT INTO public.seat_requests(
    trip_id,passenger_id,pickup_stop_id,pickup_stop_order,seat_count,status
  ) VALUES (
    p_trip_id,auth.uid(),p_pickup_stop_id,v_stop.stop_order,p_seat_count,'HELD'
  ) RETURNING id INTO v_request_id;

  UPDATE public.trip_seats
  SET state='HELD',request_id=v_request_id,updated_at=now()
  WHERE trip_id=p_trip_id AND seat_number=ANY(v_seats) AND state='AVAILABLE';
  GET DIAGNOSTICS v_written = ROW_COUNT;
  IF v_written <> p_seat_count THEN
    RAISE EXCEPTION 'Could not reserve requested seat ledger for trip %',p_trip_id;
  END IF;

  UPDATE public.trips SET held_count=held_count+p_seat_count WHERE id=p_trip_id;
  PERFORM public.record_behaviour(auth.uid(),'passenger','request_created',p_trip_id,v_request_id,
    jsonb_build_object('seat_numbers',v_seats));
  PERFORM public.record_audit('request_seats','seat_requests',v_request_id,NULL,
    jsonb_build_object('trip_id',p_trip_id,'seat_count',p_seat_count,'stop',v_stop.name,'seat_numbers',v_seats),NULL);

  RETURN jsonb_build_object('success',true,'request_id',v_request_id,'status','HELD','seat_numbers',v_seats);
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_seat_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_req public.seat_requests; v_trip public.trips; v_released INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success',false,'error','Not authenticated'); END IF;
  SELECT * INTO v_req FROM public.seat_requests
    WHERE id=p_request_id AND passenger_id=auth.uid() FOR UPDATE;
  IF v_req.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Request not found'); END IF;
  IF v_req.status <> 'HELD' THEN RETURN jsonb_build_object('success',false,'error','Only HELD requests can be withdrawn'); END IF;
  SELECT * INTO v_trip FROM public.trips WHERE id=v_req.trip_id FOR UPDATE;

  SELECT public.release_held_request_seats(p_request_id) INTO v_released;
  IF v_released <> v_req.seat_count THEN RAISE EXCEPTION 'Held-seat ledger mismatch for request %',p_request_id; END IF;

  UPDATE public.seat_requests SET status='WITHDRAWN',withdrawn_at=now() WHERE id=p_request_id;
  UPDATE public.trips SET held_count=held_count-v_req.seat_count WHERE id=v_req.trip_id;
  PERFORM public.record_behaviour(auth.uid(),'passenger','request_withdrawn',v_req.trip_id,p_request_id);
  PERFORM public.record_audit('withdraw_seat_request','seat_requests',p_request_id);
  RETURN jsonb_build_object('success',true,'released_seats',v_released);
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_confirm_payment(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_driver_id UUID; v_req public.seat_requests; v_trip public.trips;
  v_seats INTEGER[]; v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success',false,'error','Not authenticated'); END IF;
  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id=auth.uid() AND is_active=true;
  IF v_driver_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Not a driver'); END IF;

  SELECT * INTO v_req FROM public.seat_requests WHERE id=p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Request not found'); END IF;
  IF v_req.status='CONFIRMED' THEN
    SELECT ARRAY(SELECT seat_number FROM public.trip_seats WHERE request_id=p_request_id AND state='CONFIRMED' ORDER BY seat_number)
      INTO v_seats;
    RETURN jsonb_build_object('success',true,'already_confirmed',true,'seat_numbers',v_seats);
  END IF;
  IF v_req.status <> 'HELD' THEN RETURN jsonb_build_object('success',false,'error','Request is not HELD'); END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id=v_req.trip_id FOR UPDATE;
  IF v_trip.driver_id IS DISTINCT FROM v_driver_id OR v_trip.status <> 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success',false,'error','Not authorized for this collecting trip');
  END IF;
  IF v_req.pickup_stop_order < v_trip.current_stop_order THEN
    RETURN jsonb_build_object('success',false,'error','Pickup opportunity has been passed');
  END IF;

  SELECT ARRAY(
    SELECT seat_number FROM public.trip_seats
    WHERE trip_id=v_req.trip_id AND request_id=p_request_id AND state='HELD'
    ORDER BY seat_number FOR UPDATE
  ) INTO v_seats;
  IF COALESCE(array_length(v_seats,1),0) <> v_req.seat_count THEN
    RAISE EXCEPTION 'Held-seat ledger mismatch for request %',p_request_id;
  END IF;

  UPDATE public.trip_seats SET state='CONFIRMED',updated_at=now()
  WHERE request_id=p_request_id AND state='HELD';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> v_req.seat_count THEN RAISE EXCEPTION 'Confirmation ledger mismatch for request %',p_request_id; END IF;

  UPDATE public.seat_requests SET status='CONFIRMED',confirmed_at=now() WHERE id=p_request_id;
  UPDATE public.trips
    SET confirmed_count=confirmed_count+v_req.seat_count,held_count=held_count-v_req.seat_count
    WHERE id=v_req.trip_id;
  PERFORM public.record_behaviour(v_req.passenger_id,'passenger','booking_confirmed',v_req.trip_id,p_request_id);
  PERFORM public.record_audit('driver_confirm_payment','seat_requests',p_request_id,NULL,
    jsonb_build_object('seat_numbers',v_seats),NULL);
  RETURN jsonb_build_object('success',true,'seat_numbers',v_seats);
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_arrive_at_stop(p_trip_id UUID,p_stop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_driver_id UUID; v_trip public.trips; v_stop public.route_stops;
  v_ids UUID[]; v_id UUID; v_count INTEGER; v_released INTEGER:=0; v_ledger INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success',false,'error','Not authenticated'); END IF;
  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id=auth.uid() AND is_active=true;
  SELECT * INTO v_trip FROM public.trips WHERE id=p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL OR v_trip.driver_id IS DISTINCT FROM v_driver_id OR v_trip.status <> 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success',false,'error','Trip not found, not authorized, or not collecting');
  END IF;
  SELECT * INTO v_stop FROM public.route_stops WHERE id=p_stop_id AND route_id=v_trip.route_id;
  IF v_stop.id IS NULL OR v_stop.stop_order < v_trip.current_stop_order THEN
    RETURN jsonb_build_object('success',false,'error','Invalid or backwards stop transition');
  END IF;

  INSERT INTO public.trip_progress(trip_id,stop_id,stop_order)
  VALUES(p_trip_id,p_stop_id,v_stop.stop_order)
  ON CONFLICT(trip_id,stop_order) DO UPDATE SET arrived_at=now();

  SELECT ARRAY(
    SELECT id FROM public.seat_requests
    WHERE trip_id=p_trip_id AND status='HELD' AND pickup_stop_order < v_stop.stop_order
    ORDER BY created_at FOR UPDATE
  ) INTO v_ids;

  FOREACH v_id IN ARRAY COALESCE(v_ids,ARRAY[]::UUID[]) LOOP
    SELECT seat_count INTO v_count FROM public.seat_requests WHERE id=v_id;
    SELECT public.release_held_request_seats(v_id) INTO v_ledger;
    IF v_ledger <> v_count THEN RAISE EXCEPTION 'Expiry ledger mismatch for request %',v_id; END IF;
    UPDATE public.seat_requests SET status='EXPIRED',expired_at=now() WHERE id=v_id;
    v_released := v_released+v_count;
    PERFORM public.record_behaviour((SELECT passenger_id FROM public.seat_requests WHERE id=v_id),
      'passenger','request_expired',p_trip_id,v_id);
  END LOOP;

  UPDATE public.trips SET current_stop_order=v_stop.stop_order,held_count=held_count-v_released WHERE id=p_trip_id;
  PERFORM public.record_audit('driver_arrive_at_stop','trips',p_trip_id,NULL,
    jsonb_build_object('stop',v_stop.name,'stop_order',v_stop.stop_order,'released_seats',v_released),NULL);
  RETURN jsonb_build_object('success',true,'current_stop_order',v_stop.stop_order,'stop_name',v_stop.name,'released_seats',v_released);
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_mark_passenger_absent(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_driver_id UUID; v_req public.seat_requests; v_trip public.trips; v_released INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success',false,'error','Not authenticated'); END IF;
  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id=auth.uid() AND is_active=true;
  IF v_driver_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Not a driver'); END IF;
  SELECT * INTO v_req FROM public.seat_requests WHERE id=p_request_id FOR UPDATE;
  IF v_req.id IS NULL OR v_req.status <> 'HELD' THEN RETURN jsonb_build_object('success',false,'error','Request not found or not HELD'); END IF;
  SELECT * INTO v_trip FROM public.trips WHERE id=v_req.trip_id FOR UPDATE;
  IF v_trip.driver_id IS DISTINCT FROM v_driver_id OR v_trip.status <> 'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success',false,'error','Not authorized for this collecting trip');
  END IF;
  SELECT public.release_held_request_seats(p_request_id) INTO v_released;
  IF v_released <> v_req.seat_count THEN RAISE EXCEPTION 'Held-seat ledger mismatch for request %',p_request_id; END IF;
  UPDATE public.seat_requests SET status='EXPIRED',expired_at=now() WHERE id=p_request_id;
  UPDATE public.trips SET held_count=held_count-v_req.seat_count WHERE id=v_req.trip_id;
  PERFORM public.record_behaviour(v_req.passenger_id,'passenger','request_expired',v_req.trip_id,p_request_id);
  PERFORM public.record_audit('driver_mark_passenger_absent','seat_requests',p_request_id);
  RETURN jsonb_build_object('success',true,'released_seats',v_released);
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_cancel_trip(p_trip_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_driver_id UUID; v_trip public.trips; v_req public.seat_requests;
  v_released INTEGER:=0; v_one INTEGER; v_confirmed INTEGER:=0;
  v_event public.behaviour_event_type; v_next JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success',false,'error','Not authenticated'); END IF;
  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id=auth.uid() AND is_active=true;
  IF v_driver_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Not a driver'); END IF;
  SELECT * INTO v_trip FROM public.trips WHERE id=p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL OR v_trip.driver_id IS DISTINCT FROM v_driver_id THEN
    RETURN jsonb_build_object('success',false,'error','Trip not found or not authorized');
  END IF;
  IF v_trip.status <> 'ACTIVE_COLLECTING' THEN RETURN jsonb_build_object('success',false,'error','Can only cancel ACTIVE_COLLECTING trips'); END IF;

  FOR v_req IN SELECT * FROM public.seat_requests WHERE trip_id=p_trip_id AND status='HELD' FOR UPDATE LOOP
    SELECT public.release_held_request_seats(v_req.id) INTO v_one;
    IF v_one <> v_req.seat_count THEN RAISE EXCEPTION 'Cancellation ledger mismatch for request %',v_req.id; END IF;
    v_released := v_released+v_one;
    UPDATE public.seat_requests SET status='EXPIRED',expired_at=now() WHERE id=v_req.id;
  END LOOP;
  IF v_released <> v_trip.held_count THEN RAISE EXCEPTION 'Held counter/ledger mismatch on trip %',p_trip_id; END IF;

  SELECT COALESCE(SUM(seat_count),0)::INTEGER INTO v_confirmed
  FROM public.seat_requests WHERE trip_id=p_trip_id AND status='CONFIRMED';
  UPDATE public.seat_requests SET status='DRIVER_CANCELLED',cancelled_at=now()
  WHERE trip_id=p_trip_id AND status='CONFIRMED';

  v_event := CASE WHEN v_confirmed>0 THEN 'driver_cancel_after_confirmation'::public.behaviour_event_type
                  ELSE 'driver_cancel_before_confirmation'::public.behaviour_event_type END;
  UPDATE public.trips SET status='CANCELLED',cancelled_at=now(),held_count=0 WHERE id=p_trip_id;
  UPDATE public.driver_queue SET status='CANCELLED' WHERE id=v_trip.queue_entry_id;
  SELECT public.activate_next_driver(v_trip.route_id) INTO v_next;

  PERFORM public.record_behaviour(v_driver_id,'driver',v_event,p_trip_id,NULL,
    jsonb_build_object('confirmed_seats_affected',v_confirmed,'held_seats_released',v_released));
  PERFORM public.record_audit('driver_cancel_trip','trips',p_trip_id,NULL,
    jsonb_build_object('confirmed_seats_affected',v_confirmed,'held_seats_released',v_released,'event_type',v_event),NULL);
  RETURN jsonb_build_object('success',true,'event_type',v_event,'confirmed_seats_affected',v_confirmed,
    'held_seats_released',v_released,'next_driver_activated',v_next);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_seats(UUID,UUID,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_seats(UUID,UUID,INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.withdraw_seat_request(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.withdraw_seat_request(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_confirm_payment(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_confirm_payment(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_arrive_at_stop(UUID,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_arrive_at_stop(UUID,UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_mark_passenger_absent(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_mark_passenger_absent(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_cancel_trip(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_cancel_trip(UUID) TO authenticated;
