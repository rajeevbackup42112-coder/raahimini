-- ============================================================
-- RAAHI MINI — MIGRATION 2: OPERATIONAL TABLES
-- driver_queue, trips, trip_seats, seat_requests, trip_progress,
-- behaviour_events, audit_log, admin_config
-- ============================================================

-- ─── DRIVER QUEUE ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  queue_position INTEGER NOT NULL,
  status public.driver_queue_status NOT NULL DEFAULT 'WAITING',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(driver_id, route_id, status)
);

-- Only one ACTIVE_COLLECTING per route direction
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_per_route
  ON public.driver_queue (route_id)
  WHERE status = 'ACTIVE_COLLECTING';

CREATE INDEX IF NOT EXISTS idx_driver_queue_route_status ON public.driver_queue(route_id, status, queue_position);
CREATE INDEX IF NOT EXISTS idx_driver_queue_driver ON public.driver_queue(driver_id);

-- ─── TRIPS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id),
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  queue_entry_id UUID REFERENCES public.driver_queue(id),
  status public.trip_status NOT NULL DEFAULT 'ACTIVE_COLLECTING',
  capacity INTEGER NOT NULL,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  held_count INTEGER NOT NULL DEFAULT 0,
  driver_closed_count INTEGER NOT NULL DEFAULT 0,
  current_stop_order INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_counts_non_negative CHECK (
    confirmed_count >= 0 AND held_count >= 0 AND driver_closed_count >= 0
  ),
  CONSTRAINT chk_counts_within_capacity CHECK (
    confirmed_count + held_count + driver_closed_count <= capacity
  )
);

CREATE INDEX IF NOT EXISTS idx_trips_route_status ON public.trips(route_id, status);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);

-- Only one ACTIVE_COLLECTING trip per route
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_trip_per_route
  ON public.trips (route_id)
  WHERE status = 'ACTIVE_COLLECTING';

-- ─── TRIP_SEATS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  seat_number INTEGER NOT NULL,
  state public.seat_state NOT NULL DEFAULT 'AVAILABLE',
  request_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_trip_seats_trip ON public.trip_seats(trip_id, state);

-- ─── SEAT_REQUESTS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seat_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES public.profiles(id),
  pickup_stop_id UUID NOT NULL REFERENCES public.route_stops(id),
  pickup_stop_order INTEGER NOT NULL,
  seat_count INTEGER NOT NULL CHECK (seat_count > 0 AND seat_count <= 4),
  status public.request_status NOT NULL DEFAULT 'HELD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ
);

-- Prevent duplicate active request from same passenger on same trip
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_request_per_passenger
  ON public.seat_requests (trip_id, passenger_id)
  WHERE status = 'HELD';

CREATE INDEX IF NOT EXISTS idx_seat_requests_trip ON public.seat_requests(trip_id, status);
CREATE INDEX IF NOT EXISTS idx_seat_requests_passenger ON public.seat_requests(passenger_id);

-- ─── TRIP_PROGRESS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES public.route_stops(id),
  stop_order INTEGER NOT NULL,
  arrived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, stop_order)
);

CREATE INDEX IF NOT EXISTS idx_trip_progress_trip ON public.trip_progress(trip_id, stop_order);

-- ─── BEHAVIOUR_EVENTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.behaviour_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  actor_role public.user_role NOT NULL,
  event_type public.behaviour_event_type NOT NULL,
  trip_id UUID REFERENCES public.trips(id),
  request_id UUID REFERENCES public.seat_requests(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_behaviour_events_actor ON public.behaviour_events(actor_id, event_type);
CREATE INDEX IF NOT EXISTS idx_behaviour_events_trip ON public.behaviour_events(trip_id);

-- ─── AUDIT_LOG ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- ─── ADMIN_CONFIG ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_trips_updated_at ON public.trips;
CREATE TRIGGER set_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_trip_seats_updated_at ON public.trip_seats;
CREATE TRIGGER set_trip_seats_updated_at
  BEFORE UPDATE ON public.trip_seats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_seat_requests_updated_at ON public.seat_requests;
CREATE TRIGGER set_seat_requests_updated_at
  BEFORE UPDATE ON public.seat_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.driver_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behaviour_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- Helper: get driver record for current user
CREATE OR REPLACE FUNCTION public.get_my_driver_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id FROM public.drivers d WHERE d.profile_id = auth.uid() LIMIT 1;
$$;

-- Helper: check if current user is the driver of a trip
CREATE OR REPLACE FUNCTION public.is_trip_driver(p_trip_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips t
    JOIN public.drivers d ON t.driver_id = d.id
    WHERE t.id = p_trip_id AND d.profile_id = auth.uid()
  );
$$;

-- Driver queue: public read (for queue position display), driver/admin write via RPC
DROP POLICY IF EXISTS "driver_queue_public_read" ON public.driver_queue;
CREATE POLICY "driver_queue_public_read" ON public.driver_queue
  FOR SELECT TO public USING (true);

-- Trips: public read (safe projection via RPC), no direct write
DROP POLICY IF EXISTS "trips_public_read" ON public.trips;
CREATE POLICY "trips_public_read" ON public.trips
  FOR SELECT TO public USING (true);

-- Trip seats: public read
DROP POLICY IF EXISTS "trip_seats_public_read" ON public.trip_seats;
CREATE POLICY "trip_seats_public_read" ON public.trip_seats
  FOR SELECT TO public USING (true);

-- Seat requests: passenger sees own, driver sees requests for their active trip, admin sees all
DROP POLICY IF EXISTS "seat_requests_passenger_read" ON public.seat_requests;
CREATE POLICY "seat_requests_passenger_read" ON public.seat_requests
  FOR SELECT TO authenticated
  USING (
    passenger_id = auth.uid()
    OR public.is_trip_driver(trip_id)
    OR public.is_admin()
  );

-- Trip progress: public read
DROP POLICY IF EXISTS "trip_progress_public_read" ON public.trip_progress;
CREATE POLICY "trip_progress_public_read" ON public.trip_progress
  FOR SELECT TO public USING (true);

-- Behaviour events: own + admin
DROP POLICY IF EXISTS "behaviour_events_read" ON public.behaviour_events;
CREATE POLICY "behaviour_events_read" ON public.behaviour_events
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR public.is_admin());

-- Audit log: admin only
DROP POLICY IF EXISTS "audit_log_admin_read" ON public.audit_log;
CREATE POLICY "audit_log_admin_read" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_admin());

-- Admin config: admin only
DROP POLICY IF EXISTS "admin_config_admin_all" ON public.admin_config;
CREATE POLICY "admin_config_admin_all" ON public.admin_config
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
