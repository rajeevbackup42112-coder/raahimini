-- RAAHI MINI — MIGRATION 12
-- Public discovery must expose only the one car currently accepting passengers.
-- IN_PROGRESS trips remain visible only to their own passengers/driver/admin.

CREATE OR REPLACE FUNCTION public.get_routes_for_location(p_location_id UUID)
RETURNS TABLE (
  route_id UUID,
  route_code TEXT,
  from_location_name TEXT,
  to_location_name TEXT,
  direction_label TEXT,
  has_active_car BOOLEAN,
  active_car_status TEXT,
  available_seats INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS route_id,
    r.code AS route_code,
    fl.name AS from_location_name,
    tl.name AS to_location_name,
    r.direction_label,
    (t.id IS NOT NULL) AS has_active_car,
    t.status::TEXT AS active_car_status,
    COALESCE(t.capacity - t.confirmed_count - t.held_count - t.driver_closed_count, 0) AS available_seats
  FROM public.routes r
  JOIN public.route_locations rl ON rl.route_id = r.id AND rl.location_id = p_location_id
  JOIN public.locations fl ON fl.id = r.from_location_id
  JOIN public.locations tl ON tl.id = r.to_location_id
  LEFT JOIN public.trips t
    ON t.route_id = r.id AND t.status = 'ACTIVE_COLLECTING'
  WHERE r.is_active = true
  ORDER BY r.code ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_active_car(p_route_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trips;
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_stops JSONB;
  v_available INTEGER;
BEGIN
  SELECT * INTO v_trip
  FROM public.trips
  WHERE route_id = p_route_id AND status = 'ACTIVE_COLLECTING'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('has_active_car', false);
  END IF;

  SELECT * INTO v_driver FROM public.drivers WHERE id = v_trip.driver_id;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_trip.vehicle_id;

  v_available := v_trip.capacity - v_trip.confirmed_count - v_trip.held_count - v_trip.driver_closed_count;

  SELECT jsonb_agg(
    jsonb_build_object(
      'stop_id', rs.id,
      'stop_order', rs.stop_order,
      'name', rs.name,
      'is_current', rs.stop_order = v_trip.current_stop_order,
      'is_passed', rs.stop_order < v_trip.current_stop_order,
      'eta_minutes', CASE
        WHEN rs.stop_order < v_trip.current_stop_order THEN NULL
        WHEN rs.stop_order = v_trip.current_stop_order THEN 0
        ELSE (
          SELECT COALESCE(SUM(rs2.minutes_from_prev), 0)
          FROM public.route_stops rs2
          WHERE rs2.route_id = v_trip.route_id
            AND rs2.stop_order > v_trip.current_stop_order
            AND rs2.stop_order <= rs.stop_order
        )
      END
    ) ORDER BY rs.stop_order
  ) INTO v_stops
  FROM public.route_stops rs
  WHERE rs.route_id = v_trip.route_id;

  RETURN jsonb_build_object(
    'has_active_car', true,
    'trip_id', v_trip.id,
    'route_id', v_trip.route_id,
    'status', v_trip.status,
    'driver_display_name', v_driver.display_name,
    'vehicle_type', v_vehicle.vehicle_type,
    'vehicle_model', v_vehicle.vehicle_model,
    'vehicle_number', v_vehicle.registration_number,
    'capacity', v_trip.capacity,
    'confirmed_count', v_trip.confirmed_count,
    'held_count', v_trip.held_count,
    'driver_closed_count', v_trip.driver_closed_count,
    'available_count', v_available,
    'current_stop_order', v_trip.current_stop_order,
    'current_stop_name', (
      SELECT name FROM public.route_stops
      WHERE route_id = v_trip.route_id AND stop_order = v_trip.current_stop_order
      LIMIT 1
    ),
    'stops', COALESCE(v_stops, '[]'::JSONB)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_routes_for_location(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_active_car(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_routes_for_location(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_active_car(UUID) TO anon, authenticated;
