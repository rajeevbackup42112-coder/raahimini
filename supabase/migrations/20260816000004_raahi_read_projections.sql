-- ============================================================
-- RAAHI MINI — MIGRATION 4: CANONICAL READ PROJECTIONS
-- Safe public and authenticated read functions
-- ============================================================

-- ─── get_active_locations ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_active_locations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  state TEXT,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, state, is_active
  FROM public.locations
  WHERE is_active = true
  ORDER BY name ASC;
$$;

-- ─── get_routes_for_location ──────────────────────────────────────────────────
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
    COALESCE(t.status::TEXT, NULL) AS active_car_status,
    COALESCE(
      t.capacity - t.confirmed_count - t.held_count - t.driver_closed_count,
      0
    ) AS available_seats
  FROM public.routes r
  JOIN public.route_locations rl ON rl.route_id = r.id AND rl.location_id = p_location_id
  JOIN public.locations fl ON fl.id = r.from_location_id
  JOIN public.locations tl ON tl.id = r.to_location_id
  LEFT JOIN public.trips t ON t.route_id = r.id AND t.status IN ('ACTIVE_COLLECTING', 'IN_PROGRESS')
  WHERE r.is_active = true
  ORDER BY r.code ASC;
END;
$$;

-- ─── get_public_active_car ────────────────────────────────────────────────────
-- Returns safe public projection — no passenger identity
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
  -- Get active collecting trip
  SELECT * INTO v_trip
  FROM public.trips
  WHERE route_id = p_route_id AND status IN ('ACTIVE_COLLECTING', 'IN_PROGRESS')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('has_active_car', false);
  END IF;

  SELECT * INTO v_driver FROM public.drivers WHERE id = v_trip.driver_id;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_trip.vehicle_id;

  v_available := v_trip.capacity - v_trip.confirmed_count - v_trip.held_count - v_trip.driver_closed_count;

  -- Build stops with ETA
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

-- ─── get_passenger_ride_status ────────────────────────────────────────────────
-- Authenticated passenger sees their own request + trip context
CREATE OR REPLACE FUNCTION public.get_passenger_ride_status(p_request_id UUID)
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
  v_pickup_stop public.route_stops;
  v_eta INTEGER;
  v_stops JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_request FROM public.seat_requests
  WHERE id = p_request_id AND passenger_id = auth.uid();

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Request not found');
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = v_request.trip_id;
  SELECT * INTO v_driver FROM public.drivers WHERE id = v_trip.driver_id;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_trip.vehicle_id;
  SELECT * INTO v_pickup_stop FROM public.route_stops WHERE id = v_request.pickup_stop_id;

  -- Calculate ETA to passenger's stop
  IF v_request.pickup_stop_order <= v_trip.current_stop_order THEN
    v_eta := 0;
  ELSE
    SELECT COALESCE(SUM(rs.minutes_from_prev), 0) INTO v_eta
    FROM public.route_stops rs
    WHERE rs.route_id = v_trip.route_id
      AND rs.stop_order > v_trip.current_stop_order
      AND rs.stop_order <= v_request.pickup_stop_order;
  END IF;

  -- Build stops progress
  SELECT jsonb_agg(
    jsonb_build_object(
      'stop_id', rs.id,
      'stop_order', rs.stop_order,
      'name', rs.name,
      'is_current', rs.stop_order = v_trip.current_stop_order,
      'is_passed', rs.stop_order < v_trip.current_stop_order
    ) ORDER BY rs.stop_order
  ) INTO v_stops
  FROM public.route_stops rs
  WHERE rs.route_id = v_trip.route_id;

  RETURN jsonb_build_object(
    'request_id', v_request.id,
    'trip_id', v_request.trip_id,
    'status', v_request.status,
    'pickup_stop_name', v_pickup_stop.name,
    'pickup_stop_order', v_request.pickup_stop_order,
    'seat_count', v_request.seat_count,
    'driver_display_name', v_driver.display_name,
    'driver_phone', v_driver.phone,
    'vehicle_number', v_vehicle.registration_number,
    'current_stop_name', (
      SELECT name FROM public.route_stops
      WHERE route_id = v_trip.route_id AND stop_order = v_trip.current_stop_order LIMIT 1
    ),
    'current_stop_order', v_trip.current_stop_order,
    'eta_minutes', v_eta,
    'trip_status', v_trip.status,
    'stops', COALESCE(v_stops, '[]'::JSONB)
  );
END;
$$;

-- ─── get_my_active_request ────────────────────────────────────────────────────
-- Returns authenticated passenger's current active request (if any)
CREATE OR REPLACE FUNCTION public.get_my_active_request()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.seat_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_request
  FROM public.seat_requests
  WHERE passenger_id = auth.uid() AND status IN ('HELD', 'CONFIRMED')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('has_active_request', false);
  END IF;

  RETURN public.get_passenger_ride_status(v_request.id) || jsonb_build_object('has_active_request', true);
END;
$$;

-- ─── get_driver_active_car ────────────────────────────────────────────────────
-- Returns full driver view of their active trip
CREATE OR REPLACE FUNCTION public.get_driver_active_car()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_trip public.trips;
  v_vehicle public.vehicles;
  v_route public.routes;
  v_from_loc public.locations;
  v_to_loc public.locations;
  v_requests JSONB;
  v_stops JSONB;
  v_available INTEGER;
  v_departure_eligible BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id = auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No driver record found');
  END IF;

  -- Get active trip
  SELECT * INTO v_trip
  FROM public.trips
  WHERE driver_id = v_driver_id AND status IN ('ACTIVE_COLLECTING', 'IN_PROGRESS')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_trip.id IS NULL THEN
    RETURN jsonb_build_object('has_active_trip', false);
  END IF;

  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_trip.vehicle_id;
  SELECT * INTO v_route FROM public.routes WHERE id = v_trip.route_id;
  SELECT * INTO v_from_loc FROM public.locations WHERE id = v_route.from_location_id;
  SELECT * INTO v_to_loc FROM public.locations WHERE id = v_route.to_location_id;

  v_available := v_trip.capacity - v_trip.confirmed_count - v_trip.held_count - v_trip.driver_closed_count;

  -- Departure eligibility
  v_departure_eligible := (
    v_trip.held_count = 0 AND
    v_trip.confirmed_count + v_trip.driver_closed_count = v_trip.capacity
  );

  -- Build passenger requests (with passenger display name, masked phone)
  SELECT jsonb_agg(
    jsonb_build_object(
      'request_id', sr.id,
      'passenger_display_name', p.display_name,
      'phone_masked', CASE
        WHEN length(p.phone) >= 10
        THEN '+91 ' || left(p.phone, 2) || 'xxx xx' || right(p.phone, 4)
        ELSE 'N/A'
      END,
      'pickup_stop_name', rs.name,
      'pickup_stop_order', sr.pickup_stop_order,
      'seat_count', sr.seat_count,
      'status', sr.status
    ) ORDER BY sr.created_at ASC
  ) INTO v_requests
  FROM public.seat_requests sr
  JOIN public.profiles p ON p.id = sr.passenger_id
  JOIN public.route_stops rs ON rs.id = sr.pickup_stop_id
  WHERE sr.trip_id = v_trip.id AND sr.status IN ('HELD', 'CONFIRMED');

  -- Build stops
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
    'has_active_trip', true,
    'trip_id', v_trip.id,
    'route_id', v_trip.route_id,
    'route_code', v_route.code,
    'route_label', v_route.direction_label,
    'from_location', v_from_loc.name,
    'to_location', v_to_loc.name,
    'status', v_trip.status,
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
      WHERE route_id = v_trip.route_id AND stop_order = v_trip.current_stop_order LIMIT 1
    ),
    'departure_eligible', v_departure_eligible,
    'passenger_requests', COALESCE(v_requests, '[]'::JSONB),
    'stops', COALESCE(v_stops, '[]'::JSONB)
  );
END;
$$;

-- ─── get_driver_queue_status ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_driver_queue_status(p_route_id UUID)
RETURNS TABLE (
  queue_id UUID,
  driver_id UUID,
  driver_name TEXT,
  vehicle_number TEXT,
  queue_position INTEGER,
  status TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dq.id AS queue_id,
    d.id AS driver_id,
    d.display_name AS driver_name,
    v.registration_number AS vehicle_number,
    dq.queue_position,
    dq.status::TEXT,
    dq.joined_at
  FROM public.driver_queue dq
  JOIN public.drivers d ON d.id = dq.driver_id
  LEFT JOIN public.vehicles v ON v.id = d.vehicle_id
  WHERE dq.route_id = p_route_id AND dq.status IN ('WAITING', 'ACTIVE_COLLECTING')
  ORDER BY dq.queue_position ASC;
$$;

-- ─── admin_get_active_trips ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_active_trips()
RETURNS TABLE (
  trip_id UUID,
  route_code TEXT,
  driver_name TEXT,
  vehicle_number TEXT,
  status TEXT,
  confirmed INTEGER,
  held INTEGER,
  available INTEGER,
  capacity INTEGER,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    t.id AS trip_id,
    r.code AS route_code,
    d.display_name AS driver_name,
    v.registration_number AS vehicle_number,
    t.status::TEXT,
    t.confirmed_count AS confirmed,
    t.held_count AS held,
    (t.capacity - t.confirmed_count - t.held_count - t.driver_closed_count) AS available,
    t.capacity,
    t.started_at,
    t.created_at
  FROM public.trips t
  JOIN public.routes r ON r.id = t.route_id
  JOIN public.drivers d ON d.id = t.driver_id
  JOIN public.vehicles v ON v.id = t.vehicle_id
  WHERE t.status IN ('ACTIVE_COLLECTING', 'IN_PROGRESS')
  ORDER BY t.created_at DESC;
END;
$$;

-- ─── admin_get_behaviour_events ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_behaviour_events(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  event_id UUID,
  actor_id UUID,
  actor_name TEXT,
  actor_role TEXT,
  event_type TEXT,
  trip_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    be.id AS event_id,
    be.actor_id,
    p.display_name AS actor_name,
    be.actor_role::TEXT,
    be.event_type::TEXT,
    be.trip_id,
    be.created_at
  FROM public.behaviour_events be
  JOIN public.profiles p ON p.id = be.actor_id
  ORDER BY be.created_at DESC
  LIMIT p_limit;
END;
$$;
