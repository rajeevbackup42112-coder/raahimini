-- ============================================================
-- RAAHI MINI — MIGRATION 14: PICKUP PROGRESSION GUARDS
-- Driver cannot skip stops or expire a passenger before reaching their stop.
-- ============================================================

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
  IF v_trip.id IS NULL OR v_trip.driver_id IS DISTINCT FROM v_driver_id OR v_trip.status<>'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success',false,'error','Trip not found, not authorized, or not collecting');
  END IF;

  SELECT * INTO v_stop FROM public.route_stops WHERE id=p_stop_id AND route_id=v_trip.route_id;
  IF v_stop.id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Invalid stop for this route');
  END IF;
  IF v_stop.stop_order < v_trip.current_stop_order THEN
    RETURN jsonb_build_object('success',false,'error','Cannot move backwards on the pickup route');
  END IF;
  IF v_stop.stop_order > v_trip.current_stop_order + 1 THEN
    RETURN jsonb_build_object('success',false,'error','Stops must be progressed in order');
  END IF;

  INSERT INTO public.trip_progress(trip_id,stop_id,stop_order)
  VALUES(p_trip_id,p_stop_id,v_stop.stop_order)
  ON CONFLICT(trip_id,stop_order) DO UPDATE SET arrived_at=now();

  SELECT ARRAY(
    SELECT id FROM public.seat_requests
    WHERE trip_id=p_trip_id AND status='HELD' AND pickup_stop_order<v_stop.stop_order
    ORDER BY created_at FOR UPDATE
  ) INTO v_ids;

  FOREACH v_id IN ARRAY COALESCE(v_ids,ARRAY[]::UUID[]) LOOP
    SELECT seat_count INTO v_count FROM public.seat_requests WHERE id=v_id;
    SELECT public.release_held_request_seats(v_id) INTO v_ledger;
    IF v_ledger<>v_count THEN RAISE EXCEPTION 'Expiry ledger mismatch for request %',v_id; END IF;
    UPDATE public.seat_requests SET status='EXPIRED',expired_at=now() WHERE id=v_id;
    v_released:=v_released+v_count;
    PERFORM public.record_behaviour(
      (SELECT passenger_id FROM public.seat_requests WHERE id=v_id),
      'passenger','request_expired',p_trip_id,v_id
    );
  END LOOP;

  UPDATE public.trips
  SET current_stop_order=v_stop.stop_order,held_count=held_count-v_released
  WHERE id=p_trip_id;

  PERFORM public.record_audit(
    'driver_arrive_at_stop','trips',p_trip_id,NULL,
    jsonb_build_object('stop',v_stop.name,'stop_order',v_stop.stop_order,'released_seats',v_released),NULL
  );
  RETURN jsonb_build_object('success',true,'current_stop_order',v_stop.stop_order,
    'stop_name',v_stop.name,'released_seats',v_released);
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
  IF v_req.id IS NULL OR v_req.status<>'HELD' THEN
    RETURN jsonb_build_object('success',false,'error','Request not found or not HELD');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id=v_req.trip_id FOR UPDATE;
  IF v_trip.driver_id IS DISTINCT FROM v_driver_id OR v_trip.status<>'ACTIVE_COLLECTING' THEN
    RETURN jsonb_build_object('success',false,'error','Not authorized for this collecting trip');
  END IF;

  IF v_trip.current_stop_order < v_req.pickup_stop_order THEN
    RETURN jsonb_build_object('success',false,'error','Passenger cannot be marked absent before reaching their pickup stop');
  END IF;

  SELECT public.release_held_request_seats(p_request_id) INTO v_released;
  IF v_released<>v_req.seat_count THEN RAISE EXCEPTION 'Held-seat ledger mismatch for request %',p_request_id; END IF;

  UPDATE public.seat_requests SET status='EXPIRED',expired_at=now() WHERE id=p_request_id;
  UPDATE public.trips SET held_count=held_count-v_req.seat_count WHERE id=v_req.trip_id;
  PERFORM public.record_behaviour(v_req.passenger_id,'passenger','request_expired',v_req.trip_id,p_request_id,
    jsonb_build_object('reason','passenger_absent_at_pickup'));
  PERFORM public.record_audit('driver_mark_passenger_absent','seat_requests',p_request_id,NULL,NULL,
    jsonb_build_object('pickup_stop_order',v_req.pickup_stop_order,'current_stop_order',v_trip.current_stop_order));

  RETURN jsonb_build_object('success',true,'released_seats',v_released);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.driver_arrive_at_stop(UUID,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_arrive_at_stop(UUID,UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_mark_passenger_absent(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_mark_passenger_absent(UUID) TO authenticated;
