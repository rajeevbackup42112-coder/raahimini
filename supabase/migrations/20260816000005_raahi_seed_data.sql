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

  -- ─── AUTH USERS (admin + test drivers) ──────────────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (v_admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@raahimini.in', crypt('raahi@admin2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('display_name', 'Raahi Admin', 'role', 'admin'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (v_driver1_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ramesh@raahimini.in', crypt('driver@2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('display_name', 'Ramesh K.', 'role', 'driver', 'phone', '9876543210'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (v_driver2_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'suresh@raahimini.in', crypt('driver@2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('display_name', 'Suresh M.', 'role', 'driver', 'phone', '7012345678'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (v_driver3_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'vikram@raahimini.in', crypt('driver@2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('display_name', 'Vikram S.', 'role', 'driver', 'phone', '9456789012'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- Wait for trigger to create profiles, then create driver records
  -- (trigger handle_new_user fires on auth.users INSERT)

  -- ─── DRIVER RECORDS ─────────────────────────────────────────────────────────
  INSERT INTO public.drivers (profile_id, vehicle_id, route_id, display_name, phone, is_active)
  VALUES (v_driver1_uuid, v_vehicle1_id, v_gd01_id, 'Ramesh K.', '9876543210', true)
  ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.drivers (profile_id, vehicle_id, route_id, display_name, phone, is_active)
  VALUES (v_driver2_uuid, v_vehicle2_id, v_gd01_id, 'Suresh M.', '7012345678', true)
  ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.drivers (profile_id, vehicle_id, route_id, display_name, phone, is_active)
  VALUES (v_driver3_uuid, v_vehicle3_id, v_dg01_id, 'Vikram S.', '9456789012', true)
  ON CONFLICT (profile_id) DO NOTHING;

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
