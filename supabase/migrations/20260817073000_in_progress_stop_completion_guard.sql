-- ============================================================
-- RAAHI MINI — IN-PROGRESS STOP PROGRESSION AND COMPLETION GUARD
-- Preserve ordered stop progression after departure and allow
-- completion only after the driver reaches the route's final stop.
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
  IF v_trip.id IS NULL OR v_trip.driver_id IS DISTINCT FROM v_driver_id
     OR v_trip.status NOT IN ('ACTIVE_COLLECTING','IN_PROGRESS') THEN
    RETURN jsonb_build_object('success',false,'error','Trip not found, not authorized, or not active');
  END IF;

  SELECT * INTO v_stop FROM public.route_stops WHERE id=p_stop_id AND route_id=v_trip.route_id;
  IF v_stop.id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Invalid stop for this route');
  END IF;
  IF v_stop.stop_order < v_trip.current_stop_order THEN
    RETURN jsonb_build_object('success',false,'error','Cannot move backwards on the route');
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

CREATE OR REPLACE FUNCTION public.complete_trip(p_trip_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_driver_id UUID;
  v_trip public.trips;
  v_final_stop_order INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid() AND is_active = true;
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

  SELECT MAX(stop_order) INTO v_final_stop_order
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
  PERFORM public.record_audit('complete_trip', 'trips', p_trip_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.driver_arrive_at_stop(UUID,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_arrive_at_stop(UUID,UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_trip(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_trip(UUID) TO authenticated;
