-- ============================================================
-- RAAHI MINI — MIGRATION 1: CORE SCHEMA
-- Enums, profiles, locations, routes, stops, drivers, vehicles
-- ============================================================

-- ─── ENUMS ────────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('passenger', 'driver', 'admin');

DROP TYPE IF EXISTS public.trip_status CASCADE;
CREATE TYPE public.trip_status AS ENUM ('ACTIVE_COLLECTING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

DROP TYPE IF EXISTS public.request_status CASCADE;
CREATE TYPE public.request_status AS ENUM ('HELD', 'CONFIRMED', 'WITHDRAWN', 'EXPIRED', 'MISSED');

DROP TYPE IF EXISTS public.seat_state CASCADE;
CREATE TYPE public.seat_state AS ENUM ('AVAILABLE', 'HELD', 'CONFIRMED', 'DRIVER_CLOSED');

DROP TYPE IF EXISTS public.behaviour_event_type CASCADE;
CREATE TYPE public.behaviour_event_type AS ENUM (
  'request_created',
  'request_withdrawn',
  'request_expired',
  'booking_confirmed',
  'confirmed_no_show',
  'trip_completed',
  'driver_cancel_before_confirmation',
  'driver_cancel_after_confirmation',
  'driver_no_show',
  'passenger_complaint',
  'refund_dispute'
);

DROP TYPE IF EXISTS public.driver_queue_status CASCADE;
CREATE TYPE public.driver_queue_status AS ENUM ('WAITING', 'ACTIVE_COLLECTING', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'passenger',
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  restriction_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── LOCATIONS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'Jharkhand',
  country TEXT NOT NULL DEFAULT 'India',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ROUTES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  from_location_id UUID NOT NULL REFERENCES public.locations(id),
  to_location_id UUID NOT NULL REFERENCES public.locations(id),
  direction_label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ROUTE_LOCATIONS (many-to-many: route ↔ location for browsing) ────────────
CREATE TABLE IF NOT EXISTS public.route_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  UNIQUE(route_id, location_id)
);

-- ─── ROUTE_STOPS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  minutes_from_prev INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(route_id, stop_order)
);

-- ─── VEHICLES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'Sedan',
  vehicle_model TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4 CHECK (capacity > 0 AND capacity <= 10),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── DRIVERS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id),
  route_id UUID REFERENCES public.routes(id),
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trips_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_routes_from_location ON public.routes(from_location_id);
CREATE INDEX IF NOT EXISTS idx_routes_to_location ON public.routes(to_location_id);
CREATE INDEX IF NOT EXISTS idx_route_locations_location ON public.route_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON public.route_stops(route_id, stop_order);
CREATE INDEX IF NOT EXISTS idx_drivers_profile ON public.drivers(profile_id);
CREATE INDEX IF NOT EXISTS idx_drivers_route ON public.drivers(route_id);

-- ─── TRIGGER: auto-create profile on auth user creation ───────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'User'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'passenger')::public.user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── TRIGGER: updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_drivers_updated_at ON public.drivers;
CREATE TRIGGER set_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Helper: is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper: is driver
CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'driver'
  );
$$;

-- Profiles: own row + admin
DROP POLICY IF EXISTS "profiles_own_read" ON public.profiles;
CREATE POLICY "profiles_own_read" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Locations: public read, admin write
DROP POLICY IF EXISTS "locations_public_read" ON public.locations;
CREATE POLICY "locations_public_read" ON public.locations
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "locations_admin_write" ON public.locations;
CREATE POLICY "locations_admin_write" ON public.locations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Routes: public read, admin write
DROP POLICY IF EXISTS "routes_public_read" ON public.routes;
CREATE POLICY "routes_public_read" ON public.routes
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "routes_admin_write" ON public.routes;
CREATE POLICY "routes_admin_write" ON public.routes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Route locations: public read, admin write
DROP POLICY IF EXISTS "route_locations_public_read" ON public.route_locations;
CREATE POLICY "route_locations_public_read" ON public.route_locations
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "route_locations_admin_write" ON public.route_locations;
CREATE POLICY "route_locations_admin_write" ON public.route_locations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Route stops: public read, admin write
DROP POLICY IF EXISTS "route_stops_public_read" ON public.route_stops;
CREATE POLICY "route_stops_public_read" ON public.route_stops
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "route_stops_admin_write" ON public.route_stops;
CREATE POLICY "route_stops_admin_write" ON public.route_stops
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Vehicles: public read, admin write
DROP POLICY IF EXISTS "vehicles_public_read" ON public.vehicles;
CREATE POLICY "vehicles_public_read" ON public.vehicles
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "vehicles_admin_write" ON public.vehicles;
CREATE POLICY "vehicles_admin_write" ON public.vehicles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Drivers: public read (display info only), admin write
DROP POLICY IF EXISTS "drivers_public_read" ON public.drivers;
CREATE POLICY "drivers_public_read" ON public.drivers
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "drivers_admin_write" ON public.drivers;
CREATE POLICY "drivers_admin_write" ON public.drivers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
