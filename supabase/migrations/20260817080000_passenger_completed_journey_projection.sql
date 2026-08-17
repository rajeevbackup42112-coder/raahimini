-- ============================================================
-- RAAHI MINI — PASSENGER COMPLETED JOURNEY PROJECTION
-- Distinguish a genuinely active request from the latest
-- completed confirmed journey without mutating operational state.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_active_request()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_request public.seat_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT sr.* INTO v_request
  FROM public.seat_requests sr
  JOIN public.trips t ON t.id = sr.trip_id
  WHERE sr.passenger_id = auth.uid()
    AND sr.status IN ('HELD', 'CONFIRMED')
    AND t.status IN ('ACTIVE_COLLECTING', 'IN_PROGRESS')
  ORDER BY sr.created_at DESC
  LIMIT 1;

  IF v_request.id IS NOT NULL THEN
    RETURN public.get_passenger_ride_status(v_request.id)
      || jsonb_build_object('has_active_request', true, 'has_completed_trip', false);
  END IF;

  SELECT sr.* INTO v_request
  FROM public.seat_requests sr
  JOIN public.trips t ON t.id = sr.trip_id
  WHERE sr.passenger_id = auth.uid()
    AND sr.status = 'CONFIRMED'
    AND t.status = 'COMPLETED'
  ORDER BY t.completed_at DESC NULLS LAST, sr.created_at DESC
  LIMIT 1;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('has_active_request', false, 'has_completed_trip', false);
  END IF;

  RETURN public.get_passenger_ride_status(v_request.id)
    || jsonb_build_object('has_active_request', false, 'has_completed_trip', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_active_request() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_active_request() TO authenticated;
