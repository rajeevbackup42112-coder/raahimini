-- Require a Supabase Auth-confirmed phone before the canonical passenger booking transition.
-- Auth is the verification authority; public.profiles.phone is display/contact data only.

BEGIN;

CREATE OR REPLACE FUNCTION public.request_seats(p_trip_id uuid, p_pickup_stop_id uuid, p_seat_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_trip public.trips; v_stop public.route_stops; v_profile public.profiles; v_request_id UUID; v_available INTEGER; v_seats INTEGER[]; v_written INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success',false,'error','Authentication required'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id=auth.uid() AND phone IS NOT NULL AND length(btrim(phone))>0 AND phone_confirmed_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('success',false,'error','Verify your mobile number before requesting a seat');
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=auth.uid();
  IF v_profile.id IS NULL OR v_profile.is_restricted THEN RETURN jsonb_build_object('success',false,'error','Account is restricted or unavailable'); END IF;
  IF p_seat_count<1 OR p_seat_count>4 THEN RETURN jsonb_build_object('success',false,'error','Invalid seat count'); END IF;
  SELECT * INTO v_trip FROM public.trips WHERE id=p_trip_id FOR UPDATE;
  IF v_trip.id IS NULL OR v_trip.status<>'ACTIVE_COLLECTING' THEN RETURN jsonb_build_object('success',false,'error','Trip is not accepting requests'); END IF;
  SELECT * INTO v_stop FROM public.route_stops WHERE id=p_pickup_stop_id AND route_id=v_trip.route_id;
  IF v_stop.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Invalid pickup stop for this route'); END IF;
  IF v_stop.stop_order<v_trip.current_stop_order THEN RETURN jsonb_build_object('success',false,'error','Driver has already passed this pickup point'); END IF;
  IF EXISTS(SELECT 1 FROM public.seat_requests WHERE trip_id=p_trip_id AND passenger_id=auth.uid() AND status IN('HELD','CONFIRMED')) THEN
    RETURN jsonb_build_object('success',false,'error','You already have an active request for this trip');
  END IF;
  v_available:=v_trip.capacity-v_trip.confirmed_count-v_trip.held_count-v_trip.driver_closed_count;
  IF v_available<p_seat_count THEN RETURN jsonb_build_object('success',false,'error',format('Only %s seat(s) available — cannot partially fulfil request',v_available)); END IF;
  SELECT ARRAY(SELECT seat_number FROM public.trip_seats WHERE trip_id=p_trip_id AND state='AVAILABLE' ORDER BY seat_number LIMIT p_seat_count FOR UPDATE) INTO v_seats;
  IF COALESCE(array_length(v_seats,1),0)<>p_seat_count THEN RAISE EXCEPTION 'Seat ledger mismatch for trip %',p_trip_id; END IF;
  INSERT INTO public.seat_requests(trip_id,passenger_id,pickup_stop_id,pickup_stop_order,seat_count,status)
    VALUES(p_trip_id,auth.uid(),p_pickup_stop_id,v_stop.stop_order,p_seat_count,'HELD') RETURNING id INTO v_request_id;
  UPDATE public.trip_seats SET state='HELD',request_id=v_request_id,updated_at=now()
    WHERE trip_id=p_trip_id AND seat_number=ANY(v_seats) AND state='AVAILABLE';
  GET DIAGNOSTICS v_written=ROW_COUNT;
  IF v_written<>p_seat_count THEN RAISE EXCEPTION 'Could not reserve requested seat ledger for trip %',p_trip_id; END IF;
  UPDATE public.trips SET held_count=held_count+p_seat_count WHERE id=p_trip_id;
  PERFORM public.record_behaviour(auth.uid(),'passenger','request_created',p_trip_id,v_request_id,jsonb_build_object('seat_numbers',v_seats));
  PERFORM public.record_audit('request_seats','seat_requests',v_request_id,NULL,jsonb_build_object('trip_id',p_trip_id,'seat_count',p_seat_count,'stop',v_stop.name,'seat_numbers',v_seats),NULL);
  RETURN jsonb_build_object('success',true,'request_id',v_request_id,'status','HELD','seat_numbers',v_seats);
END;$function$;

REVOKE ALL ON FUNCTION public.request_seats(uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_seats(uuid,uuid,integer) TO authenticated;

COMMIT;
