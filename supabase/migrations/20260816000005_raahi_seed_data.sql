-- ============================================================
-- RAAHI MINI — MIGRATION 5: SEED DATA
-- Locations, routes, route_locations, route_stops
-- Admin user + test drivers
-- ============================================================

DO $$
DECLARE
  v_gomoh_id UUID;
  v_dhanbad_id UUID;
  v_gd01_id UUID;
  v_dg01_id UUID;
  v_admin_uuid UUID := gen_random_uuid();
  v_driver1_uuid UUID := gen_random_uuid();
  v_driver2_uuid UUID := gen_random_uuid();
  v_driver3_uuid UUID := gen_random_uuid();
  v_vehicle1_id UUID;
  v_vehicle2_id UUID;
  v_vehicle3_id UUID;
BEGIN

  -- ─── LOCATIONS ──────────────────────────────────────────────────────────────
  INSERT INTO public.locations (name, state, is_active)
  VALUES ('Gomoh', 'Jharkhand', true)
  ON CONFLICT (name) DO NOTHING;

  INSERT INTO public.locations (name, state, is_active)
  VALUES ('Dhanbad', 'Jharkhand', true)
  ON CONFLICT (name) DO NOTHING;

  SELECT id INTO v_gomoh_id FROM public.locations WHERE name = 'Gomoh' LIMIT 1;
  SELECT id INTO v_dhanbad_id FROM public.locations WHERE name = 'Dhanbad' LIMIT 1;

  -- ─── ROUTES ─────────────────────────────────────────────────────────────────
  INSERT INTO public.routes (code, from_location_id, to_location_id, direction_label, is_active)
  VALUES ('GD-01', v_gomoh_id, v_dhanbad_id, 'Gomoh → Dhanbad', true)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.routes (code, from_location_id, to_location_id, direction_label, is_active)
  VALUES ('DG-01', v_dhanbad_id, v_gomoh_id, 'Dhanbad → Gomoh', true)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_gd01_id FROM public.routes WHERE code = 'GD-01' LIMIT 1;
  SELECT id INTO v_dg01_id FROM public.routes WHERE code = 'DG-01' LIMIT 1;

  -- ─── ROUTE_LOCATIONS ────────────────────────────────────────────────────────
  -- GD-01 is associated with both Gomoh and Dhanbad
  INSERT INTO public.route_locations (route_id, location_id)
  VALUES (v_gd01_id, v_gomoh_id) ON CONFLICT (route_id, location_id) DO NOTHING;

  INSERT INTO public.route_locations (route_id, location_id)
  VALUES (v_gd01_id, v_dhanbad_id) ON CONFLICT (route_id, location_id) DO NOTHING;

  -- DG-01 is associated with both Dhanbad and Gomoh
  INSERT INTO public.route_locations (route_id, location_id)
  VALUES (v_dg01_id, v_dhanbad_id) ON CONFLICT (route_id, location_id) DO NOTHING;

  INSERT INTO public.route_locations (route_id, location_id)
  VALUES (v_dg01_id, v_gomoh_id) ON CONFLICT (route_id, location_id) DO NOTHING;

  -- ─── ROUTE STOPS: GD-01 ─────────────────────────────────────────────────────
  INSERT INTO public.route_stops (route_id, stop_order, name, minutes_from_prev)
  VALUES
    (v_gd01_id, 1, 'Gomoh Station Gate', 0),
    (v_gd01_id, 2, 'Gomoh Chowk', 2),
    (v_gd01_id, 3, 'Bachra Road', 3),
    (v_gd01_id, 4, 'Sijua More', 5),
    (v_gd01_id, 5, 'Dhanbad Bypass', 8),
    (v_gd01_id, 6, 'Dhanbad Station', 7)
  ON CONFLICT (route_id, stop_order) DO NOTHING;

  -- ─── ROUTE STOPS: DG-01 ─────────────────────────────────────────────────────
  INSERT INTO public.route_stops (route_id, stop_order, name, minutes_from_prev)
  VALUES
    (v_dg01_id, 1, 'Dhanbad Station', 0),
    (v_dg01_id, 2, 'Bank More', 4),
    (v_dg01_id, 3, 'Saraidhela', 6),
    (v_dg01_id, 4, 'Sijua More', 5),
    (v_dg01_id, 5, 'Bachra Road', 4),
    (v_dg01_id, 6, 'Gomoh Station Gate', 6)
  ON CONFLICT (route_id, stop_order) DO NOTHING;

  -- ─── VEHICLES ───────────────────────────────────────────────────────────────
  INSERT INTO public.vehicles (registration_number, vehicle_type, vehicle_model, capacity, is_active)
  VALUES ('JH10AB4421', 'Sedan', 'Swift Dzire', 4, true)
  ON CONFLICT (registration_number) DO NOTHING;

  INSERT INTO public.vehicles (registration_number, vehicle_type, vehicle_model, capacity, is_active)
  VALUES ('JH10CD7832', 'Sedan', 'Honda Amaze', 4, true)
  ON CONFLICT (registration_number) DO NOTHING;

  INSERT INTO public.vehicles (registration_number, vehicle_type, vehicle_model, capacity, is_active)
  VALUES ('JH10EF1123', 'Sedan', 'Maruti Ciaz', 4, true)
  ON CONFLICT (registration_number) DO NOTHING;

  SELECT id INTO v_vehicle1_id FROM public.vehicles WHERE registration_number = 'JH10AB4421' LIMIT 1;
  SELECT id INTO v_vehicle2_id FROM public.vehicles WHERE registration_number = 'JH10CD7832' LIMIT 1;
  SELECT id INTO v_vehicle3_id FROM public.vehicles WHERE registration_number = 'JH10EF1123' LIMIT 1;

  -- Auth identities and privileged roles are intentionally not seeded.
  -- Create test users through Supabase Auth and assign trusted driver/admin roles
  -- through an administrator-controlled provisioning workflow.

  -- ─── ADMIN CONFIG ────────────────────────────────────────────────────────────
  INSERT INTO public.admin_config (key, value, description)
  VALUES
    ('gomoh_cluster_minutes', '5', 'Expected minutes to cover entire Gomoh pickup cluster'),
    ('dhanbad_cluster_minutes', '15', 'Expected minutes to cover entire Dhanbad pickup cluster'),
    ('max_seats_per_request', '4', 'Maximum seats a passenger can request at once'),
    ('request_hold_buffer_minutes', '2', 'Extra buffer minutes before expiring held requests')
  ON CONFLICT (key) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;
